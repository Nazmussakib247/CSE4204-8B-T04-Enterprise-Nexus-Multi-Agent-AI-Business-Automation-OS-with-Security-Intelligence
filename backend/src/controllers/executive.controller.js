const supabase = require('../config/supabase');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { writeAuditLog } = require('../utils/audit');
const { buildExecutivePdf } = require('../utils/pdf');

// Shared: gather the cross-domain briefing snapshot for a user
const gatherBriefing = async (userId) => {
  const [hrRes, financeRes, supportRes, analyticsRes] = await Promise.all([
    supabase.from('hr_reports').select('id, candidate_name, recommendation, ai_score').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
    supabase.from('finance_records').select('id, category, amount, severity').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
    supabase.from('support_tickets').select('id, urgency, sentiment, status, escalated').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
    supabase.from('analytics_reports').select('overall_score, performance_rating, kpi_snapshot').eq('user_id', userId).order('created_at', { ascending: false }).limit(1),
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
      .eq('user_id', req.user.id)
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
      .eq('user_id', req.user.id)
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
      .eq('user_id', req.user.id)
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
    const briefing = await gatherBriefing(req.user.id);
    res.json({ briefing, generated_at: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
};

// GET /api/executive/briefing/pdf — export the daily briefing as a PDF (FR-28 / UC-12)
const exportBriefingPdf = async (req, res, next) => {
  try {
    const briefing = await gatherBriefing(req.user.id);
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
      supabase.from('hr_reports').select('candidate_name, recommendation, ai_score, job_title').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
      supabase.from('finance_records').select('category, amount, severity, expense_date, description').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
      supabase.from('support_tickets').select('query, intent, urgency, sentiment, status, escalated').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
      supabase.from('analytics_reports').select('overall_score, performance_rating, ai_insights, action_items, kpi_snapshot').eq('user_id', userId).order('created_at', { ascending: false }).limit(3),
    ]);

    const context = {
      hr: hrRes.data || [],
      finance: financeRes.data || [],
      support: supportRes.data || [],
      analytics: analyticsRes.data || [],
    };

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `You are an executive AI assistant for an enterprise management system. 
Answer the following question based ONLY on the enterprise data provided below.
Be concise, insightful, and actionable. Format your response clearly.

ENTERPRISE DATA:
HR Reports (recent ${context.hr.length}): ${JSON.stringify(context.hr)}
Finance Records (recent ${context.finance.length}): ${JSON.stringify(context.finance)}
Support Tickets (recent ${context.support.length}): ${JSON.stringify(context.support)}
Analytics Reports (recent ${context.analytics.length}): ${JSON.stringify(context.analytics)}

QUESTION: ${question}

Provide a direct, data-driven answer. If the data doesn't contain enough information to answer, say so clearly.`;

    const result = await model.generateContent(prompt);
    const answer = result.response.text();

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

module.exports = { getReports, getLatestReport, getReport, createReport, getDailyBriefing, exportBriefingPdf, askAI };
