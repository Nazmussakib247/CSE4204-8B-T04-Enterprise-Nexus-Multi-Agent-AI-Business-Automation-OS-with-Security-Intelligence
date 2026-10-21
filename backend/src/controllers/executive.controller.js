const supabase = require('../config/supabase');
const { generateJson, AiUnavailableError } = require('../ai/client');
const { writeAuditLog } = require('../utils/audit');
const { buildExecutivePdf } = require('../utils/pdf');
const { createExecutiveAgent } = require('../agents/executive.agent');
const {
  getOrCreateConversation, loadRecentMessages, appendMessages, updateRollingSummary,
  listConversations, getConversationMessages, buildContextPrompt,
} = require('../agents/memory');

const MAX_MESSAGE_LENGTH = 2000;
const sse = (res, event, payload) => res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);

// Shared: gather the cross-domain briefing snapshot for the office.
const gatherBriefing = async () => {
  const [hrRes, financeRes, supportRes, analyticsRes] = await Promise.all([
    supabase.from('hr_reports').select('id, candidate_name, recommendation, ai_score').order('created_at', { ascending: false }).limit(5),
    supabase.from('finance_records').select('id, category, amount, severity').order('created_at', { ascending: false }).limit(5),
    supabase.from('support_tickets').select('id, urgency, sentiment, status, escalated').order('created_at', { ascending: false }).limit(5),
    supabase.from('analytics_reports').select('overall_score, performance_rating, kpi_snapshot').order('created_at', { ascending: false }).limit(1),
  ]);

  return {
    hr: { recent: hrRes.data || [] },
    finance: { recent: financeRes.data || [] },
    support: { recent: supportRes.data || [] },
    analytics: { latest: analyticsRes.data?.[0] || null },
  };
};

// GET /api/executive/reports
const getReports = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('executive_reports')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (error) throw error;
    res.json({ data, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    next(err);
  }
};

// GET /api/executive/reports/latest
const getLatestReport = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('executive_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return res.status(404).json({ error: 'No executive report found' });
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

// GET /api/executive/reports/:id
const getReport = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('executive_reports')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Report not found' });
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

// POST /api/executive/reports
const createReport = async (req, res, next) => {
  try {
    const { performance_summary } = req.body;

    if (!performance_summary) {
      return res.status(400).json({ error: 'performance_summary is required' });
    }

    const { data, error } = await supabase
      .from('executive_reports')
      .insert({ user_id: req.user.id, performance_summary })
      .select()
      .single();

    if (error) throw error;

    writeAuditLog({
      userId: req.user.id,
      action: 'executive.report.create',
      resourceType: 'executive_report',
      resourceId: data.id,
      req,
    });

    res.status(201).json({ message: 'Executive report created', data });
  } catch (err) {
    next(err);
  }
};

// GET /api/executive/briefing — cross-domain daily briefing
const getDailyBriefing = async (req, res, next) => {
  try {
    const briefing = await gatherBriefing();
    res.json({ briefing, generated_at: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
};

// GET /api/executive/briefing/pdf — export the daily briefing as a PDF (FR-28 / UC-12)
const exportBriefingPdf = async (req, res, next) => {
  try {
    const briefing = await gatherBriefing();
    const generatedAt = new Date().toISOString();
    const fileName = `executive-briefing-${generatedAt.slice(0, 10)}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    const doc = buildExecutivePdf({ user: req.user, briefing, generatedAt });
    doc.on('error', next);
    doc.pipe(res);

    writeAuditLog({
      userId: req.user.id,
      action: 'executive.briefing.export_pdf',
      resourceType: 'executive_report',
      req,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/executive/ask — Gemini Q&A over enterprise data
const askAI = async (req, res, next) => {
  try {
    const { question } = req.body;
    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'question is required' });
    }

    const userId = req.user.id;

    // Gather context from all modules
    const [hrRes, financeRes, supportRes, analyticsRes] = await Promise.all([
      supabase.from('hr_reports').select('candidate_name, recommendation, ai_score, job_title').order('created_at', { ascending: false }).limit(10),
      supabase.from('finance_records').select('category, amount, severity, expense_date, description').order('created_at', { ascending: false }).limit(10),
      supabase.from('support_tickets').select('query, intent, urgency, sentiment, status, escalated').order('created_at', { ascending: false }).limit(10),
      supabase.from('analytics_reports').select('overall_score, performance_rating, ai_insights, action_items, kpi_snapshot').order('created_at', { ascending: false }).limit(3),
    ]);

    const context = {
      hr: hrRes.data || [],
      finance: financeRes.data || [],
      support: supportRes.data || [],
      analytics: analyticsRes.data || [],
    };

    const prompt = `You are an executive AI assistant for an enterprise management system. 
Answer the following question based ONLY on the enterprise data provided below.
Be concise, insightful, and actionable.

ENTERPRISE DATA:
HR Reports (recent ${context.hr.length}): ${JSON.stringify(context.hr)}
Finance Records (recent ${context.finance.length}): ${JSON.stringify(context.finance)}
Support Tickets (recent ${context.support.length}): ${JSON.stringify(context.support)}
Analytics Reports (recent ${context.analytics.length}): ${JSON.stringify(context.analytics)}

QUESTION: ${question}

Provide a direct, data-driven answer. If the data doesn't contain enough information to answer, say so clearly.`;

    const { answer } = await generateJson({
      systemInstruction: 'You are an executive AI assistant. Return only the requested JSON.',
      prompt,
      responseSchema: {
        type: 'object',
        properties: { answer: { type: 'string' } },
        required: ['answer'],
      },
    });

    writeAuditLog({
      userId,
      action: 'executive.ai.ask',
      metadata: { question: question.substring(0, 100) },
      req,
    });

    res.json({ answer, context_size: { hr: context.hr.length, finance: context.finance.length, support: context.support.length, analytics: context.analytics.length } });
  } catch (err) {
    next(err);
  }
};

const runGroqFallback = async (question, conversation, recentMessages) => {
  const briefing = await gatherBriefing();
  const answer = await generateJson({
    preferProvider: 'groq',
    systemInstruction: 'You are Enterprise NeXus Executive Agent. Answer conversationally in the user\'s language. Use the supplied business context when relevant, explain project questions clearly, and never invent internal facts. Return JSON only.',
    prompt: `${buildContextPrompt(conversation, recentMessages, question)}\n\nLIVE BUSINESS CONTEXT:\n${JSON.stringify(briefing)}`,
    responseSchema: { type: 'object', properties: { answer: { type: 'string' } }, required: ['answer'] },
  });
  return answer.answer;
};

// POST /api/v1/executive/ask — persistent topic-based executive chat.
const askConversation = async (req, res, next) => {
  const streaming = req.headers.accept?.includes('text/event-stream');
  try {
    const { question, conversation_id: conversationId } = req.body || {};
    if (!question || typeof question !== 'string' || !question.trim()) return res.status(400).json({ error: 'question is required' });
    if (question.length > MAX_MESSAGE_LENGTH) return res.status(413).json({ error: `question too long (max ${MAX_MESSAGE_LENGTH} chars)` });

    const conversation = await getOrCreateConversation(req.user.id, conversationId, question.trim());
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    const recentMessages = await loadRecentMessages(conversation.id);
    const delegations = [];

    if (streaming) {
      res.status(200);
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();
    }

    let answer;
    try {
      const agent = createExecutiveAgent(req.user.id, req, {
        onDelegation: (delegation) => {
          delegations.push(delegation);
          if (streaming) sse(res, 'delegation', delegation);
        },
      });
      const output = await agent.run(buildContextPrompt(conversation, recentMessages, question.trim()), { userId: req.user.id, req });
      answer = output.answer;
    } catch (error) {
      if (!(error instanceof AiUnavailableError)) throw error;
      answer = await runGroqFallback(question.trim(), conversation, recentMessages);
    }

    const toolMessages = delegations
      .filter((item) => item.status === 'completed')
      .map((item) => ({ role: 'tool', content: `[${item.label || item.agent} Agent] ${item.answer_preview || 'Completed'}`, metadata: { delegation: item } }));
    await appendMessages(conversation.id, [
      { role: 'user', content: question.trim() },
      ...toolMessages,
      { role: 'assistant', content: answer, metadata: { delegations } },
    ]);
    // Persist the recent turn immediately. The AI summary is useful for long
    // threads but must never hold up the visible reply.
    await supabase.from('agent_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversation.id);
    void updateRollingSummary(conversation, question.trim(), answer);
    writeAuditLog({ userId: req.user.id, action: 'executive.conversation.ask', resourceType: 'agent_conversation', resourceId: conversation.id, metadata: { question_preview: question.slice(0, 200), delegated_agents: delegations.map((item) => item.agent) }, req });

    if (streaming) {
      for (const token of answer.match(/.{1,80}(?:\s|$)/g) || [answer]) sse(res, 'token', { text: token });
      sse(res, 'done', { conversation_id: conversation.id, delegations });
      return res.end();
    }
    res.json({ answer, conversation_id: conversation.id, delegations });
  } catch (error) {
    if (streaming && res.headersSent) { sse(res, 'error', { message: 'The Executive Agent could not complete that request.' }); return res.end(); }
    next(error);
  }
};

const getConversations = async (req, res, next) => {
  try { res.json({ data: await listConversations(req.user.id) }); } catch (error) { next(error); }
};

const getMessages = async (req, res, next) => {
  try {
    const data = await getConversationMessages(req.user.id, req.params.id);
    if (!data) return res.status(404).json({ error: 'Conversation not found' });
    res.json({ data });
  } catch (error) { next(error); }
};

module.exports = { getReports, getLatestReport, getReport, createReport, getDailyBriefing, exportBriefingPdf, askAI, askConversation, getConversations, getMessages };
