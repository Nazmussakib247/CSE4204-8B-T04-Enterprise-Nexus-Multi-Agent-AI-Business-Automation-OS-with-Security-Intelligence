/**
 * HR Agent — candidate screening insights over the user's own hr_reports.
 */
const { z } = require('zod');
const { tool } = require('@langchain/core/tools');
const Joi = require('joi');
const { BaseAgent } = require('../ai/BaseAgent');
const { scopedQuery } = require('./tools/scopedQuery');
const { screenCV } = require('../utils/gemini');
const { writeAuditLog } = require('../utils/audit');

const SYSTEM_PROMPT = `You are the Enterprise NeXus HR Agent. You help the user analyse their CV-screening
pipeline: candidates, AI scores, recommendations, and hiring statistics.

Rules:
- Use your tools to fetch real data before answering. Never invent candidates or scores.
- You can only see the current user's own reports; never speculate about other users' data.
- When you have enough information, reply with ONLY a JSON object: {"answer": "<your answer>"}.
- Keep answers concise and concrete (names, scores, counts).`;

const outputSchema = Joi.object({ answer: Joi.string().min(1).required() });

const buildTools = (userId, req) => [
  tool(
    async ({ recommendation, min_score, max_score, job_title, limit }) => {
      let q = scopedQuery('hr_reports', userId)
        .select('id, candidate_name, job_title, ai_score, confidence, recommendation, ai_status, created_at')
        .order('created_at', { ascending: false })
        .limit(Math.min(limit ?? 20, 50));
      if (recommendation) q = q.eq('recommendation', recommendation);
      if (min_score !== undefined) q = q.gte('ai_score', min_score);
      if (max_score !== undefined) q = q.lte('ai_score', max_score);
      if (job_title) q = q.ilike('job_title', `%${job_title}%`);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return JSON.stringify({ count: data.length, candidates: data });
    },
    {
      name: 'query_candidates',
      description: 'List the user\'s screened candidates, optionally filtered by recommendation (shortlist|review|reject), score range, or job title substring.',
      schema: z.object({
        recommendation: z.enum(['shortlist', 'review', 'reject']).optional(),
        min_score: z.number().min(0).max(100).optional(),
        max_score: z.number().min(0).max(100).optional(),
        job_title: z.string().optional(),
        limit: z.number().int().min(1).max(50).optional(),
      }),
    }
  ),

  tool(
    async ({ ids }) => {
      const { data, error } = await scopedQuery('hr_reports', userId)
        .select('id, candidate_name, job_title, ai_score, confidence, recommendation, narrative_summary, score_breakdown')
        .in('id', ids);
      if (error) throw new Error(error.message);
      return JSON.stringify({ requested: ids.length, found: data.length, candidates: data });
    },
    {
      name: 'compare_candidates',
      description: 'Fetch full screening details (scores, breakdowns, summaries) for specific candidate report IDs so they can be compared.',
      schema: z.object({ ids: z.array(z.string()).min(2).max(10) }),
    }
  ),

  tool(
    async () => {
      const { data, error } = await scopedQuery('hr_reports', userId)
        .select('recommendation, ai_score, ai_status');
      if (error) throw new Error(error.message);
      const scored = data.filter((r) => typeof r.ai_score === 'number');
      const stats = {
        total: data.length,
        shortlisted: data.filter((r) => r.recommendation === 'shortlist').length,
        review: data.filter((r) => r.recommendation === 'review').length,
        rejected: data.filter((r) => r.recommendation === 'reject').length,
        pending_ai: data.filter((r) => r.ai_status !== 'completed').length,
        avg_score: scored.length
          ? Math.round(scored.reduce((s, r) => s + r.ai_score, 0) / scored.length)
          : null,
      };
      return JSON.stringify(stats);
    },
    {
      name: 'get_hiring_stats',
      description: 'Aggregate hiring-pipeline statistics: totals per recommendation, average AI score, and reports still missing AI analysis.',
      schema: z.object({}),
    }
  ),

  tool(
    async ({ id }) => {
      const { data: report, error } = await scopedQuery('hr_reports', userId)
        .select('*')
        .eq('id', id)
        .single();
      if (error || !report) throw new Error('Report not found');

      const aiResult = await screenCV({
        candidate_name: report.candidate_name,
        job_title: report.job_title,
        cv_text: report.extracted_profile?.cv_text || '',
      });

      const { data: updated, error: updateError } = await scopedQuery('hr_reports', userId)
        .update({
          ai_score: aiResult.ai_score,
          confidence: aiResult.confidence,
          recommendation: aiResult.recommendation,
          narrative_summary: aiResult.narrative_summary,
          score_breakdown: aiResult.score_breakdown,
          ai_status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();
      if (updateError) throw new Error(updateError.message);

      // Write-action: explicit domain audit entry (on top of BaseAgent's tool audit)
      writeAuditLog({
        userId,
        action: 'agent:hr.rescreen_candidate',
        resourceType: 'hr_report',
        resourceId: id,
        metadata: { new_score: aiResult.ai_score, new_recommendation: aiResult.recommendation },
        req,
      });

      return JSON.stringify({ rescreened: true, report: updated });
    },
    {
      name: 'rescreen_candidate',
      description: 'Re-run AI screening for one candidate report by ID and persist the fresh scores. Use when a report failed analysis or needs a second opinion.',
      schema: z.object({ id: z.string() }),
    }
  ),
];

const createHrAgent = (userId, req) =>
  new BaseAgent({
    name: 'hr',
    systemPrompt: SYSTEM_PROMPT,
    tools: buildTools(userId, req),
    outputSchema,
  });

module.exports = { createHrAgent };
