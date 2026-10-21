const supabase = require('../config/supabase');
const { generateJson } = require('../ai/client');

const BOOKED_STATUSES = new Set(['paid', 'shipped', 'delivered']);
const PERIODS = { daily: 1, week: 7, month: 30 };
const dateKey = (date) => date.toISOString().slice(0, 10);

const periodBounds = (period) => {
  const days = PERIODS[period] || 1;
  const now = new Date();
  const start = new Date(now); start.setUTCDate(start.getUTCDate() - (days - 1)); start.setUTCHours(0, 0, 0, 0);
  const previousStart = new Date(start); previousStart.setUTCDate(previousStart.getUTCDate() - days);
  return { period: PERIODS[period] ? period : 'daily', days, start, previousStart, end: now };
};

const mustData = ({ data, error }) => { if (error) throw error; return data || []; };
const revenue = (orders) => orders.filter((order) => BOOKED_STATUSES.has(order.status)).reduce((sum, order) => sum + Number(order.total || 0), 0);
const money = (value) => Math.round(value * 100) / 100;

async function buildSnapshot(period) {
  const bounds = periodBounds(period);
  const [ordersRes, financeRes, ticketsRes, jobsRes, applicationsRes, auditsRes] = await Promise.all([
    supabase.from('orders').select('total,status,created_at').gte('created_at', bounds.previousStart.toISOString()),
    supabase.from('finance_records').select('category,amount,severity,is_anomaly,expense_date,description').gte('created_at', bounds.start.toISOString()).order('created_at', { ascending: false }).limit(100),
    supabase.from('support_tickets').select('query,intent,urgency,sentiment,status,escalated,created_at').gte('created_at', bounds.start.toISOString()).order('created_at', { ascending: false }).limit(100),
    supabase.from('job_postings').select('title,department,status,created_at').gte('created_at', bounds.start.toISOString()).limit(100),
    supabase.from('job_applications').select('status,ai_score,ai_recommendation,created_at').gte('created_at', bounds.start.toISOString()).limit(100),
    supabase.from('audit_logs').select('action,success,created_at').gte('created_at', bounds.start.toISOString()).limit(100),
  ]);
  const orders = mustData(ordersRes);
  const currentOrders = orders.filter((order) => new Date(order.created_at) >= bounds.start);
  const previousOrders = orders.filter((order) => new Date(order.created_at) < bounds.start);
  const currentRevenue = revenue(currentOrders);
  const previousRevenue = revenue(previousOrders);
  const finance = mustData(financeRes);
  const tickets = mustData(ticketsRes);
  const applications = mustData(applicationsRes);
  const audits = mustData(auditsRes);
  const sentiment = ['positive', 'neutral', 'negative'].reduce((outcome, key) => ({ ...outcome, [key]: tickets.filter((ticket) => ticket.sentiment === key).length }), {});
  const recurringRequests = [...tickets]
    .filter((ticket) => ticket.query)
    .reduce((groups, ticket) => { const key = (ticket.intent || 'general').slice(0, 80); groups[key] = (groups[key] || 0) + 1; return groups; }, {});

  return {
    period: { type: bounds.period, days: bounds.days, start: dateKey(bounds.start), end: dateKey(bounds.end) },
    sales: { revenue: money(currentRevenue), orders: currentOrders.filter((order) => BOOKED_STATUSES.has(order.status)).length, previous_revenue: money(previousRevenue), change_percent: previousRevenue ? money(((currentRevenue - previousRevenue) / previousRevenue) * 100) : null },
    finance: { total_records: finance.length, total_amount: money(finance.reduce((sum, item) => sum + Number(item.amount || 0), 0)), anomalies: finance.filter((item) => item.is_anomaly), high_severity: finance.filter((item) => item.severity === 'high') },
    customers: { ticket_count: tickets.length, open_tickets: tickets.filter((ticket) => ticket.status !== 'resolved').length, escalated_tickets: tickets.filter((ticket) => ticket.escalated).length, sentiment, top_request_intents: Object.entries(recurringRequests).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([intent, count]) => ({ intent, count })) },
    hiring: { jobs_created: mustData(jobsRes).length, applications: applications.length, shortlisted: applications.filter((item) => item.ai_recommendation === 'shortlist').length },
    security: { audit_events: audits.length, failed_events: audits.filter((item) => item.success === false).length },
  };
}

async function generateBriefing(snapshot) {
  const response = await generateJson({
    preferProvider: 'groq', strictProvider: true,
    systemInstruction: 'You are an expert business executive analyst. Use only the supplied data. Write a clear executive briefing: explain sales movement, customer sentiment and requests, finance risks/anomalies, hiring and security. State that a data point has no comparison where applicable. Give prioritized concrete recommendations. Return JSON only.',
    prompt: `EXECUTIVE PERIOD SNAPSHOT:\n${JSON.stringify(snapshot)}`,
    responseSchema: { type: 'object', properties: { summary: { type: 'string' }, recommendations: { type: 'array', items: { type: 'string' } }, alerts: { type: 'array', items: { type: 'string' } } }, required: ['summary', 'recommendations', 'alerts'] },
  });
  return response;
}

async function getOrCreateBriefing(userId, requestedPeriod = 'daily', force = false) {
  const bounds = periodBounds(requestedPeriod);
  if (!force) {
    const { data, error } = await supabase.from('executive_reports').select('*').eq('user_id', userId).eq('period_type', bounds.period).eq('period_start', dateKey(bounds.start)).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    if (data) return data;
  }
  const snapshot = await buildSnapshot(bounds.period);
  const generated = await generateBriefing(snapshot);
  const { data, error } = await supabase.from('executive_reports').insert({ user_id: userId, performance_summary: generated.summary, ai_briefing: generated.summary, briefing_data: { snapshot, alerts: generated.alerts }, recommendations: generated.recommendations, period_type: bounds.period, period_start: dateKey(bounds.start), period_end: dateKey(bounds.end) }).select().single();
  if (error) throw error;
  return data;
}

module.exports = { getOrCreateBriefing, buildSnapshot, PERIODS };
