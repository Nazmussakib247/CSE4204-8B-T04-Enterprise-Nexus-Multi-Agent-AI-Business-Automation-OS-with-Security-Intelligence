/**
 * Finance Agent — expense analysis and anomaly triage over finance_records.
 */
const { z } = require('zod');
const { tool } = require('@langchain/core/tools');
const Joi = require('joi');
const { BaseAgent } = require('../ai/BaseAgent');
const { scopedQuery } = require('./tools/scopedQuery');
const { detectAnomaly } = require('../utils/gemini');
const { writeAuditLog } = require('../utils/audit');
const { getStoreSalesSummary } = require('../utils/storeSales');

const SYSTEM_PROMPT = `You are the Enterprise NeXus Finance Agent. You help the user understand their
expenses, storefront sales, spot anomalies, and keep records triaged.

Rules:
- Use your tools to fetch real data before answering. Never invent amounts or transactions.
- You can only see the current user's own records.
- Amounts are in the user's ledger currency; report them as plain numbers.
- When you have enough information, reply with ONLY a JSON object: {"answer": "<your answer>"}.`;

const outputSchema = Joi.object({ answer: Joi.string().min(1).required() });

const periodStart = (period) => {
  const now = new Date();
  if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === 'quarter') return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
  if (period === 'year') return new Date(now.getFullYear(), 0, 1);
  return null; // 'all'
};

const buildTools = (userId, req) => [
  tool(
    async () => JSON.stringify(await getStoreSalesSummary()),
    {
      name: 'get_store_sales_summary',
      description: 'Get aggregate booked storefront revenue, order count, and average order value. Store sales are separate from expense records.',
      schema: z.object({}),
    }
  ),

  tool(
    async ({ category, severity, from, to, min_amount, limit }) => {
      let q = scopedQuery('finance_records', userId)
        .select('id, category, amount, expense_date, description, severity, ai_analysis, ai_status')
        .order('expense_date', { ascending: false })
        .limit(Math.min(limit ?? 20, 50));
      if (category) q = q.eq('category', category);
      if (severity) q = q.eq('severity', severity);
      if (from) q = q.gte('expense_date', from);
      if (to) q = q.lte('expense_date', to);
      if (min_amount !== undefined) q = q.gte('amount', min_amount);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return JSON.stringify({ count: data.length, records: data });
    },
    {
      name: 'query_expenses',
      description: 'List the user\'s expense records, optionally filtered by category, severity, date range (YYYY-MM-DD), or minimum amount.',
      schema: z.object({
        category: z.string().optional(),
        severity: z.enum(['normal', 'medium', 'high', 'critical']).optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        min_amount: z.number().optional(),
        limit: z.number().int().min(1).max(50).optional(),
      }),
    }
  ),

  tool(
    async ({ period }) => {
      let q = scopedQuery('finance_records', userId).select('category, amount, severity, expense_date');
      const start = periodStart(period);
      if (start) q = q.gte('expense_date', start.toISOString().slice(0, 10));
      const { data, error } = await q;
      if (error) throw new Error(error.message);

      const by_category = {};
      let total = 0;
      let anomalies = 0;
      for (const r of data) {
        by_category[r.category] = Math.round(((by_category[r.category] || 0) + Number(r.amount)) * 100) / 100;
        total += Number(r.amount);
        if (['high', 'critical'].includes(r.severity)) anomalies++;
      }
      return JSON.stringify({
        period,
        record_count: data.length,
        total_spend: Math.round(total * 100) / 100,
        by_category,
        anomaly_count: anomalies,
      });
    },
    {
      name: 'get_category_stats',
      description: 'Aggregate spend per category for a period (month = current month, quarter = last 3 months, year = current year, all = everything).',
      schema: z.object({ period: z.enum(['month', 'quarter', 'year', 'all']) }),
    }
  ),

  tool(
    async () => {
      // Re-run anomaly detection for records whose AI analysis failed or is missing.
      const { data: pending, error } = await scopedQuery('finance_records', userId)
        .select('id, category, amount, expense_date, description')
        .neq('ai_status', 'completed')
        .order('expense_date', { ascending: false })
        .limit(5);
      if (error) throw new Error(error.message);
      if (!pending.length) return JSON.stringify({ analysed: 0, message: 'No records pending analysis.' });

      const results = [];
      for (const record of pending) {
        const aiResult = await detectAnomaly({
          category: record.category,
          amount: record.amount,
          description: record.description,
          expense_date: record.expense_date,
        });
        const { error: updateError } = await scopedQuery('finance_records', userId)
          .update({
            severity: aiResult.severity,
            ai_analysis: aiResult.ai_analysis,
            ai_status: 'completed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', record.id);
        if (updateError) throw new Error(updateError.message);
        results.push({ id: record.id, severity: aiResult.severity });
      }

      // Write-action: explicit domain audit entry
      writeAuditLog({
        userId,
        action: 'agent:finance.detect_anomalies_batch',
        resourceType: 'finance_record',
        metadata: { analysed: results.length, results },
        req,
      });

      return JSON.stringify({ analysed: results.length, results });
    },
    {
      name: 'detect_anomalies_batch',
      description: 'Re-run AI anomaly detection on up to 5 expense records whose analysis previously failed or is pending, and persist the results.',
      schema: z.object({}),
    }
  ),

  tool(
    async ({ id, severity, reason }) => {
      const { data, error } = await scopedQuery('finance_records', userId)
        .update({
          severity,
          ai_analysis: `Flagged by Finance Agent: ${reason}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();
      if (error || !data) throw new Error('Record not found');

      // Write-action: explicit domain audit entry
      writeAuditLog({
        userId,
        action: 'agent:finance.flag_transaction',
        resourceType: 'finance_record',
        resourceId: id,
        metadata: { severity, reason },
        req,
      });

      return JSON.stringify({ flagged: true, record: data });
    },
    {
      name: 'flag_transaction',
      description: 'Manually flag one expense record with a severity level and a reason. Persists the flag and audits the action.',
      schema: z.object({
        id: z.string(),
        severity: z.enum(['normal', 'medium', 'high', 'critical']),
        reason: z.string().min(3),
      }),
    }
  ),
];

const createFinanceAgent = (userId, req) =>
  new BaseAgent({
    name: 'finance',
    systemPrompt: SYSTEM_PROMPT,
    tools: buildTools(userId, req),
    outputSchema,
  });

module.exports = { createFinanceAgent };
