/**
 * Analytics Agent — cross-module KPIs and executive reporting.
 */
const { z } = require('zod');
const { tool } = require('@langchain/core/tools');
const Joi = require('joi');
const { BaseAgent } = require('../ai/BaseAgent');
const { scopedQuery } = require('./tools/scopedQuery');
const { generateAnalyticsReport } = require('../utils/gemini');
const { writeAuditLog } = require('../utils/audit');

const SYSTEM_PROMPT = `You are the Enterprise NeXus Analytics Agent. You give the user a cross-module
view of HR, Finance, and Support performance.

Rules:
- Use your tools to fetch real data before answering. Never invent KPIs.
- You can only see the current user's own data.
- generate_report is expensive (full AI report, saved to the database) — only call it when the user
  explicitly asks for a report; otherwise use the cheaper stats tools.
- When you have enough information, reply with ONLY a JSON object: {"answer": "<your answer>"}.`;

const outputSchema = Joi.object({ answer: Joi.string().min(1).required() });

const fetchModuleData = async (userId) => {
  const [hrRes, finRes, supRes] = await Promise.all([
    scopedQuery('hr_reports', userId).select('recommendation, ai_score, ai_status'),
    scopedQuery('finance_records', userId).select('category, amount, severity, ai_status'),
    scopedQuery('support_tickets', userId).select('sentiment, urgency, status, escalated, ai_status'),
  ]);
  for (const r of [hrRes, finRes, supRes]) if (r.error) throw new Error(r.error.message);
  return { hr: hrRes.data, finance: finRes.data, support: supRes.data };
};

const buildTools = (userId, req) => [
  tool(
    async () => {
      const { hr, finance, support } = await fetchModuleData(userId);
      const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
      const snapshot = {
        hr: {
          total: hr.length,
          shortlist_rate: pct(hr.filter((r) => r.recommendation === 'shortlist').length, hr.length),
        },
        finance: {
          total: finance.length,
          total_spend: Math.round(finance.reduce((s, r) => s + Number(r.amount), 0) * 100) / 100,
          anomaly_rate: pct(finance.filter((r) => ['high', 'critical'].includes(r.severity)).length, finance.length),
        },
        support: {
          total: support.length,
          resolution_rate: pct(support.filter((t) => t.status === 'resolved').length, support.length),
          escalation_rate: pct(support.filter((t) => t.escalated).length, support.length),
        },
      };
      return JSON.stringify(snapshot);
    },
    {
      name: 'get_kpi_snapshot',
      description: 'Cross-module KPI snapshot: HR shortlist rate, Finance spend and anomaly rate, Support resolution and escalation rates.',
      schema: z.object({}),
    }
  ),

  tool(
    async ({ module }) => {
      const { hr, finance, support } = await fetchModuleData(userId);
      let stats;
      if (module === 'hr') {
        const scored = hr.filter((r) => typeof r.ai_score === 'number');
        stats = {
          total: hr.length,
          shortlisted: hr.filter((r) => r.recommendation === 'shortlist').length,
          review: hr.filter((r) => r.recommendation === 'review').length,
          rejected: hr.filter((r) => r.recommendation === 'reject').length,
          avg_score: scored.length ? Math.round(scored.reduce((s, r) => s + r.ai_score, 0) / scored.length) : null,
          pending_ai: hr.filter((r) => r.ai_status !== 'completed').length,
        };
      } else if (module === 'finance') {
        const by_category = {};
        for (const r of finance) {
          by_category[r.category] = Math.round(((by_category[r.category] || 0) + Number(r.amount)) * 100) / 100;
        }
        stats = {
          total: finance.length,
          total_spend: Math.round(finance.reduce((s, r) => s + Number(r.amount), 0) * 100) / 100,
          by_category,
          anomalies: finance.filter((r) => ['high', 'critical'].includes(r.severity)).length,
          pending_ai: finance.filter((r) => r.ai_status !== 'completed').length,
        };
      } else {
        stats = {
          total: support.length,
          open: support.filter((t) => t.status === 'open').length,
          resolved: support.filter((t) => t.status === 'resolved').length,
          escalated: support.filter((t) => t.escalated).length,
          negative: support.filter((t) => t.sentiment === 'negative').length,
          pending_ai: support.filter((t) => t.ai_status !== 'completed').length,
        };
      }
      return JSON.stringify({ module, stats });
    },
    {
      name: 'compute_module_stats',
      description: 'Detailed statistics for one module: hr, finance, or support.',
      schema: z.object({ module: z.enum(['hr', 'finance', 'support']) }),
    }
  ),

  tool(
    async () => {
      const { hr, finance, support } = await fetchModuleData(userId);
      const report = await generateAnalyticsReport({ hr, finance, support });

      const { data, error } = await scopedQuery('analytics_reports', userId)
        .insert({
          performance_rating: report.performance_rating,
          overall_score: report.overall_score,
          ai_insights: report.ai_insights,
          action_items: report.action_items,
          kpi_snapshot: report.kpi_snapshot,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);

      // Write-action: explicit domain audit entry
      writeAuditLog({
        userId,
        action: 'agent:analytics.generate_report',
        resourceType: 'analytics_report',
        resourceId: data?.id,
        metadata: { performance_rating: report.performance_rating, overall_score: report.overall_score },
        req,
      });

      return JSON.stringify({ saved: true, report });
    },
    {
      name: 'generate_report',
      description: 'Generate a full AI performance report across HR, Finance, and Support, and save it to analytics_reports. Expensive — use only on explicit request.',
      schema: z.object({}),
    }
  ),
];

const createAnalyticsAgent = (userId, req) =>
  new BaseAgent({
    name: 'analytics',
    systemPrompt: SYSTEM_PROMPT,
    tools: buildTools(userId, req),
    outputSchema,
  });

module.exports = { createAnalyticsAgent };
