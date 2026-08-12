/**
 * Domain AI functions — thin wrappers over the hardened ai/ layer.
 *
 * Export names/signatures are unchanged so controllers keep working.
 * IMPORTANT: on AI failure these now throw AiUnavailableError instead of
 * returning fake fallback data. Controllers catch it and persist the record
 * with ai_status='failed' and NULL AI fields.
 */
const { generateJson } = require('../ai/client');
const { AiUnavailableError } = require('../ai/errors');

// ---------- Gemini native response schemas (OpenAPI subset) ----------

const CV_SCHEMA = {
  type: 'object',
  properties: {
    ai_score: { type: 'integer' },
    confidence: { type: 'number' },
    recommendation: { type: 'string', enum: ['shortlist', 'review', 'reject'] },
    narrative_summary: { type: 'string' },
    score_breakdown: {
      type: 'object',
      properties: {
        skills_match: { type: 'integer' },
        experience: { type: 'integer' },
        communication: { type: 'integer' },
        culture_fit: { type: 'integer' },
      },
      required: ['skills_match', 'experience', 'communication', 'culture_fit'],
    },
  },
  required: ['ai_score', 'confidence', 'recommendation', 'narrative_summary', 'score_breakdown'],
};

const ANOMALY_SCHEMA = {
  type: 'object',
  properties: {
    severity: { type: 'string', enum: ['normal', 'medium', 'high', 'critical'] },
    ai_analysis: { type: 'string' },
    anomaly_flags: { type: 'array', items: { type: 'string' } },
  },
  required: ['severity', 'ai_analysis', 'anomaly_flags'],
};

const SENTIMENT_SCHEMA = {
  type: 'object',
  properties: {
    sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
    urgency: { type: 'string', enum: ['low', 'medium', 'high'] },
    intent: { type: 'string' },
    confidence: { type: 'number' },
    ai_response: { type: 'string' },
  },
  required: ['sentiment', 'urgency', 'intent', 'confidence', 'ai_response'],
};

const ANALYTICS_SCHEMA = {
  type: 'object',
  properties: {
    performance_rating: { type: 'string', enum: ['excellent', 'good', 'average', 'poor'] },
    overall_score: { type: 'integer' },
    ai_insights: { type: 'string' },
    action_items: { type: 'array', items: { type: 'string' } },
    kpi_snapshot: {
      type: 'object',
      properties: {
        hr_shortlist_rate: { type: 'number' },
        finance_anomaly_rate: { type: 'number' },
        support_resolution_rate: { type: 'number' },
        escalation_rate: { type: 'number' },
      },
      required: ['hr_shortlist_rate', 'finance_anomaly_rate', 'support_resolution_rate', 'escalation_rate'],
    },
  },
  required: ['performance_rating', 'overall_score', 'ai_insights', 'action_items', 'kpi_snapshot'],
};

const INVOICE_SCHEMA = {
  type: 'object',
  properties: {
    vendor: { type: 'string' },
    category: {
      type: 'string',
      enum: ['Travel', 'Software', 'Hardware', 'Office', 'Marketing', 'Utilities', 'Consulting', 'Payroll', 'Other'],
    },
    amount: { type: 'number' },
    expense_date: { type: 'string' },
    description: { type: 'string' },
  },
  required: ['vendor', 'category', 'amount', 'expense_date', 'description'],
};

// ---------- Domain functions (same signatures as before) ----------

/**
 * CV Screening — returns { ai_score, confidence, recommendation, narrative_summary, score_breakdown }
 * @throws {AiUnavailableError}
 */
async function screenCV({ candidate_name, job_title, cv_text = '' }) {
  return generateJson({
    systemInstruction:
      'You are an expert HR AI assistant. Evaluate candidates rigorously and return only the requested JSON.',
    prompt: `Evaluate this candidate for the role.

Candidate: ${candidate_name}
Job Title: ${job_title}
CV / Profile:
${cv_text || '(No CV text provided — evaluate based on name and job title alone)'}

Fields: ai_score (0-100), confidence (0-1), recommendation (shortlist|review|reject),
narrative_summary (2-3 sentences), score_breakdown with skills_match/experience/communication/culture_fit (each 0-100).`,
    responseSchema: CV_SCHEMA,
  });
}

/**
 * Finance Anomaly Detection — returns { severity, ai_analysis, anomaly_flags }
 * @throws {AiUnavailableError}
 */
async function detectAnomaly({ category, amount, description, expense_date }) {
  return generateJson({
    systemInstruction: 'You are a financial risk AI. Analyse transactions for anomalies.',
    prompt: `Analyse this transaction for anomalies.

Category: ${category}
Amount: ${amount}
Date: ${expense_date}
Description: ${description || 'N/A'}

Severity rules:
- critical: amount > 100000 or obviously fraudulent pattern
- high: amount > 50000 or unusual category mismatch
- medium: amount > 20000 or suspicious description
- normal: everything looks routine

Fields: severity, ai_analysis (1-2 sentence explanation), anomaly_flags (array of short flag strings).`,
    responseSchema: ANOMALY_SCHEMA,
  });
}

/**
 * Support Sentiment Analysis — returns { sentiment, urgency, intent, confidence, ai_response }
 * @throws {AiUnavailableError}
 */
async function analyseSentiment({ query: ticketQuery }) {
  return generateJson({
    systemInstruction: 'You are a customer support AI. Analyse support queries.',
    prompt: `Analyse this support query: "${ticketQuery}"

Fields: sentiment (positive|neutral|negative), urgency (low|medium|high),
intent (short label, e.g. 'billing issue'), confidence (0-1),
ai_response (helpful 1-2 sentence response to the customer).`,
    responseSchema: SENTIMENT_SCHEMA,
  });
}

/**
 * Analytics KPI Generation — analyses cross-module data and returns performance insights
 * @throws {AiUnavailableError}
 */
async function generateAnalyticsReport({ hr, finance, support }) {
  return generateJson({
    systemInstruction: 'You are a business intelligence AI. Generate data-driven KPI performance reports.',
    prompt: `Analyse this enterprise data and generate a KPI performance report.

HR Data (${hr.length} reports): ${JSON.stringify(hr.slice(0, 20))}
Finance Data (${finance.length} records): ${JSON.stringify(finance.slice(0, 20))}
Support Data (${support.length} tickets): ${JSON.stringify(support.slice(0, 20))}

Fields: performance_rating (excellent|good|average|poor), overall_score (0-100),
ai_insights (3-4 sentence executive summary), action_items (3 items),
kpi_snapshot with hr_shortlist_rate/finance_anomaly_rate/support_resolution_rate/escalation_rate (each 0-100, calculated from the data).
Be data-driven and specific.`,
    responseSchema: ANALYTICS_SCHEMA,
  });
}

/**
 * Invoice Parsing — extracts structured expense fields from raw invoice/receipt text.
 * Returns { vendor, category, amount, expense_date, description }
 * @throws {AiUnavailableError}
 */
async function parseInvoice({ invoice_text = '' }) {
  const today = new Date().toISOString().slice(0, 10);
  const parsed = await generateJson({
    systemInstruction: 'You are an accounts-payable AI. Extract expense details from invoice/receipt text.',
    prompt: `Extract the expense details from this invoice/receipt text.

INVOICE TEXT:
${invoice_text.slice(0, 6000)}

Rules:
- amount must be the grand total (largest total/amount due), as a plain number, no currency symbol.
- expense_date as YYYY-MM-DD; if none found use ${today}.
- If a field is missing, use a sensible default (amount 0, date ${today}, category "Other").`,
    responseSchema: INVOICE_SCHEMA,
  });

  // Deterministic normalisation (not fake data — just type/format hygiene)
  parsed.amount = Number(parsed.amount) || 0;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.expense_date || '')) parsed.expense_date = today;
  return parsed;
}

module.exports = {
  screenCV,
  detectAnomaly,
  analyseSentiment,
  generateAnalyticsReport,
  parseInvoice,
  AiUnavailableError,
};
