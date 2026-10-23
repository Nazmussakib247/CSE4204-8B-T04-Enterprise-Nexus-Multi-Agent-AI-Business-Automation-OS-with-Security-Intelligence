const supabase = require('../config/supabase');
const { generateJson } = require('../ai/client');
const { writeAuditLog } = require('../utils/audit');
const { buildExecutivePdf } = require('../utils/pdf');
const { getStoreSalesSummary } = require('../utils/storeSales');
const { getOrCreateBriefing, PERIODS } = require('../utils/executiveBriefing');
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

// GET /api/executive/intelligence?period=daily|week|month
// The first visit for a period creates a persistent Groq intelligence briefing;
// later visits return the saved snapshot immediately.
const getIntelligenceBriefing = async (req, res, next) => {
  try {
    const period = PERIODS[req.query.period] ? req.query.period : 'daily';
    const data = await getOrCreateBriefing(req.user.id, period);
    res.json({ data });
  } catch (error) { next(error); }
};

// POST /api/executive/intelligence/refresh — manually regenerate the selected period.
const refreshIntelligenceBriefing = async (req, res, next) => {
  try {
    const period = PERIODS[req.body?.period] ? req.body.period : 'daily';
    const data = await getOrCreateBriefing(req.user.id, period, true);
    writeAuditLog({ userId: req.user.id, action: 'executive.intelligence.refresh', resourceType: 'executive_report', resourceId: data.id, metadata: { period }, req });
    res.status(201).json({ data });
  } catch (error) { next(error); }
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

// POST /api/executive/ask — Groq Q&A over enterprise data
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
      preferProvider: 'groq',
      strictProvider: true,
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

const SOURCE_CONFIG = {
  hr: { label: 'HR', terms: ['job', 'recruit', 'recruitment', 'hiring', 'hire', 'candidate', 'application', 'applicant', 'cv', 'resume', 'employee', 'hr', 'চাকরি', 'রিক্রুট', 'নিয়োগ', 'প্রার্থী'] },
  finance: { label: 'Finance', terms: ['sale', 'sales', 'revenue', 'store', 'order', 'finance', 'expense', 'transaction', 'budget', 'profit', 'payment', 'সেল', 'বিক্রয়', 'রাজস্ব', 'অর্ডার', 'ফাইন্যান্স', 'খরচ'] },
  analytics: { label: 'Analytics', terms: ['sale', 'sales', 'revenue', 'store', 'order', 'analytics', 'metric', 'kpi', 'performance', 'trend', 'compare', 'insight', 'সেল', 'বিক্রয়', 'রাজস্ব', 'অর্ডার', 'অ্যানালিটিক্স', 'পারফরম্যান্স'] },
  support: { label: 'Support', terms: ['support', 'ticket', 'customer', 'complaint', 'issue', 'helpdesk', 'সাপোর্ট', 'টিকেট', 'কাস্টমার', 'অভিযোগ'] },
  security: { label: 'Security', terms: ['security', 'audit', 'login', 'breach', 'threat', 'attack', 'suspicious', 'access', 'vulnerability', 'সিকিউরিটি', 'নিরাপত্তা', 'অডিট', 'লগইন', 'হুমকি'] },
};

const selectedSources = (question) => {
  const normalized = question.toLowerCase();
  const sources = Object.entries(SOURCE_CONFIG)
    .filter(([, config]) => config.terms.some((term) => normalized.includes(term)))
    .map(([agent]) => agent);
  return sources.length ? sources : ['analytics'];
};

const assertData = ({ data, error }, fallback = []) => {
  if (error) throw error;
  return data || fallback;
};

const collectFinance = async () => {
  const [sales, records] = await Promise.all([
    getStoreSalesSummary(),
    supabase.from('finance_records').select('category, amount, severity, expense_date, description').order('created_at', { ascending: false }).limit(20),
  ]);
  return { store_sales: sales, recent_finance_records: assertData(records) };
};

const collectAnalytics = async () => {
  const [sales, hr, finance, support, reports] = await Promise.all([
    getStoreSalesSummary(),
    supabase.from('hr_reports').select('id', { count: 'exact', head: true }),
    supabase.from('finance_records').select('id', { count: 'exact', head: true }),
    supabase.from('support_tickets').select('id, status, urgency', { count: 'exact' }).order('created_at', { ascending: false }).limit(20),
    supabase.from('analytics_reports').select('overall_score, performance_rating, kpi_snapshot, ai_insights').order('created_at', { ascending: false }).limit(1),
  ]);
  return {
    storefront_sales: sales,
    record_counts: { hr_reports: hr.count || 0, finance_records: finance.count || 0, support_tickets: support.count || 0 },
    recent_support_tickets: assertData(support),
    latest_analytics_report: assertData(reports)[0] || null,
  };
};

const collectHr = async () => {
  const [jobs, applications, reports] = await Promise.all([
    supabase.from('job_postings').select('id, title, department, status, created_at').order('created_at', { ascending: false }).limit(20),
    supabase.from('job_applications').select('id, status, ai_score, ai_recommendation, created_at').order('created_at', { ascending: false }).limit(30),
    supabase.from('hr_reports').select('candidate_name, job_title, recommendation, ai_score, created_at').order('created_at', { ascending: false }).limit(20),
  ]);
  return { job_postings: assertData(jobs), applications: assertData(applications), recent_candidate_reports: assertData(reports) };
};

const collectSupport = async () => {
  const tickets = await supabase.from('support_tickets').select('id, query, intent, urgency, sentiment, status, escalated, created_at').order('created_at', { ascending: false }).limit(30);
  return { recent_tickets: assertData(tickets) };
};

const collectSecurity = async () => {
  const events = await supabase.from('audit_logs').select('action, resource_type, success, created_at').order('created_at', { ascending: false }).limit(50);
  const recent = assertData(events);
  return {
    audit_summary: { recent_event_count: recent.length, failed_event_count: recent.filter((event) => event.success === false).length },
    recent_audit_events: recent,
  };
};

const COLLECTORS = { hr: collectHr, finance: collectFinance, analytics: collectAnalytics, support: collectSupport, security: collectSecurity };

const runGroqExecutive = async ({ question, conversation, recentMessages, req, onDelegation }) => {
  const sources = selectedSources(question);
  const delegations = sources.map((agent) => ({ agent, label: SOURCE_CONFIG[agent].label, question, status: 'started' }));
  delegations.forEach(onDelegation);

  const settled = await Promise.all(sources.map(async (agent, index) => {
    try {
      const data = await COLLECTORS[agent]();
      const delegation = { ...delegations[index], status: 'completed', answer_preview: 'Live database context retrieved' };
      delegations[index] = delegation;
      onDelegation(delegation);
      await writeAuditLog({ userId: req.user.id, action: `agent:${agent}.executive_query`, resourceType: 'agent_activity', metadata: { question_preview: question.slice(0, 160), data_source: 'live_database' }, req });
      return [agent, data];
    } catch (error) {
      const delegation = { ...delegations[index], status: 'failed', answer_preview: 'Data source could not be read' };
      delegations[index] = delegation;
      onDelegation(delegation);
      return [agent, { error: 'Data source unavailable for this request.' }];
    }
  }));

  const liveContext = Object.fromEntries(settled);
  const response = await generateJson({
    preferProvider: 'groq',
    strictProvider: true,
    systemInstruction: 'You are the Enterprise NeXus Executive Agent. Every answer is generated by Groq. Answer in the user\'s language, using only the verified live data supplied. Give a direct useful answer with concise numbers and next steps when useful. Never fabricate a fact or say information is unavailable if relevant data is supplied. For store revenue, use only the supplied total_revenue, which includes paid, shipped, and delivered orders. If a supplied dataset is empty, state that it currently has no matching records. Return JSON only.',
    prompt: `${buildContextPrompt(conversation, recentMessages, question)}\n\nVERIFIED LIVE DATA FROM SELECTED AGENTS:\n${JSON.stringify(liveContext)}`,
    responseSchema: { type: 'object', properties: { answer: { type: 'string' } }, required: ['answer'] },
  });
  return { answer: response.answer, delegations };
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

    const output = await runGroqExecutive({
      question: question.trim(), conversation, recentMessages, req,
      onDelegation: (delegation) => {
        const existing = delegations.findIndex((item) => item.agent === delegation.agent);
        if (existing === -1) delegations.push(delegation); else delegations[existing] = delegation;
        if (streaming) sse(res, 'delegation', delegation);
      },
    });
    const answer = output.answer;

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

module.exports = { getReports, getLatestReport, getReport, createReport, getDailyBriefing, getIntelligenceBriefing, refreshIntelligenceBriefing, exportBriefingPdf, askAI, askConversation, getConversations, getMessages };
