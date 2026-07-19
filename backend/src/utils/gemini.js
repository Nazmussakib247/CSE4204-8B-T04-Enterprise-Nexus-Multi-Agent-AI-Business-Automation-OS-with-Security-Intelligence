const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Get a Gemini model instance
 */
function getModel(modelName = 'gemini-1.5-flash') {
  return genAI.getGenerativeModel({ model: modelName });
}

/**
 * CV Screening — returns { ai_score, confidence, recommendation, narrative_summary, score_breakdown }
 */
async function screenCV({ candidate_name, job_title, cv_text = '' }) {
  const model = getModel();
  const prompt = `You are an expert HR AI assistant. Evaluate this candidate for the role and return ONLY valid JSON (no markdown, no explanation).

Candidate: ${candidate_name}
Job Title: ${job_title}
CV / Profile:
${cv_text || '(No CV text provided — evaluate based on name and job title alone)'}

Return this exact JSON shape:
{
  "ai_score": <integer 0-100>,
  "confidence": <float 0-1>,
  "recommendation": <"shortlist" | "review" | "reject">,
  "narrative_summary": "<2-3 sentence summary>",
  "score_breakdown": {
    "skills_match": <0-100>,
    "experience": <0-100>,
    "communication": <0-100>,
    "culture_fit": <0-100>
  }
}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    // Strip markdown code fences if present
    const clean = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    return JSON.parse(clean);
  } catch (err) {
    console.error('[Gemini] screenCV error:', err.message);
    // Fallback values so the record still saves
    return {
      ai_score: 50,
      confidence: 0.5,
      recommendation: 'review',
      narrative_summary: 'AI analysis unavailable. Please review manually.',
      score_breakdown: { skills_match: 50, experience: 50, communication: 50, culture_fit: 50 },
    };
  }
}

/**
 * Finance Anomaly Detection — returns { severity, ai_analysis, anomaly_flags }
 */
async function detectAnomaly({ category, amount, description, expense_date }) {
  const model = getModel();
  const prompt = `You are a financial risk AI. Analyse this transaction for anomalies and return ONLY valid JSON.

Category: ${category}
Amount: ${amount}
Date: ${expense_date}
Description: ${description || 'N/A'}

Return this exact JSON shape:
{
  "severity": <"normal" | "medium" | "high" | "critical">,
  "ai_analysis": "<1-2 sentence explanation of risk level>",
  "anomaly_flags": ["<flag1>", "<flag2>"]
}

Rules:
- critical: amount > 100000 or obviously fraudulent pattern
- high: amount > 50000 or unusual category mismatch
- medium: amount > 20000 or suspicious description
- normal: everything looks routine`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const clean = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    return JSON.parse(clean);
  } catch (err) {
    console.error('[Gemini] detectAnomaly error:', err.message);
    return { severity: 'normal', ai_analysis: 'AI analysis unavailable.', anomaly_flags: [] };
  }
}

/**
 * Support Sentiment Analysis — returns { sentiment, urgency, intent, confidence, ai_response }
 */
async function analyseSentiment({ query: ticketQuery }) {
  const model = getModel();
  const prompt = `You are a customer support AI. Analyse this support query and return ONLY valid JSON.

Query: "${ticketQuery}"

Return this exact JSON shape:
{
  "sentiment": <"positive" | "neutral" | "negative">,
  "urgency": <"low" | "medium" | "high">,
  "intent": "<short intent label, e.g. 'billing issue', 'technical problem', 'feature request'>",
  "confidence": <float 0-1>,
  "ai_response": "<helpful 1-2 sentence response to the customer>"
}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const clean = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    return JSON.parse(clean);
  } catch (err) {
    console.error('[Gemini] analyseSentiment error:', err.message);
    return {
      sentiment: 'neutral',
      urgency: 'medium',
      intent: 'general inquiry',
      confidence: 0.5,
      ai_response: 'Thank you for reaching out. Our team will review your request shortly.',
    };
  }
}

// exports below

/**
 * Analytics KPI Generation — analyses cross-module data and returns performance insights
 */
async function generateAnalyticsReport({ hr, finance, support }) {
  const model = getModel();
  const prompt = `You are a business intelligence AI. Analyse this enterprise data and generate a KPI performance report. Return ONLY valid JSON.

HR Data (${hr.length} reports): ${JSON.stringify(hr.slice(0, 20))}
Finance Data (${finance.length} records): ${JSON.stringify(finance.slice(0, 20))}
Support Data (${support.length} tickets): ${JSON.stringify(support.slice(0, 20))}

Return this exact JSON shape:
{
  "performance_rating": <"excellent" | "good" | "average" | "poor">,
  "overall_score": <integer 0-100>,
  "ai_insights": "<3-4 sentence executive summary of performance>",
  "action_items": ["<action1>", "<action2>", "<action3>"],
  "kpi_snapshot": {
    "hr_shortlist_rate": <0-100>,
    "finance_anomaly_rate": <0-100>,
    "support_resolution_rate": <0-100>,
    "escalation_rate": <0-100>
  }
}

Calculate kpi_snapshot from the data. Be data-driven and specific.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const clean = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    return JSON.parse(clean);
  } catch (err) {
    console.error('[Gemini] generateAnalyticsReport error:', err.message);
    return {
      performance_rating: 'average',
      overall_score: 65,
      ai_insights: 'AI analysis unavailable. Please check your Gemini API key.',
      action_items: ['Review HR pipeline', 'Monitor finance anomalies', 'Resolve open support tickets'],
      kpi_snapshot: { hr_shortlist_rate: 0, finance_anomaly_rate: 0, support_resolution_rate: 0, escalation_rate: 0 },
    };
  }
}

/**
 * Invoice Parsing — extracts structured expense fields from raw invoice/receipt text.
 * Returns { category, amount, expense_date, description, vendor }
 */
async function parseInvoice({ invoice_text = '' }) {
  const model = getModel();
  const today = new Date().toISOString().slice(0, 10);
  const prompt = `You are an accounts-payable AI. Extract the expense details from this invoice/receipt text and return ONLY valid JSON (no markdown).

INVOICE TEXT:
${invoice_text.slice(0, 6000)}

Return this exact JSON shape:
{
  "vendor": "<vendor/supplier name or empty string>",
  "category": <one of: "Travel" | "Software" | "Hardware" | "Office" | "Marketing" | "Utilities" | "Consulting" | "Payroll" | "Other">,
  "amount": <total amount as a number, no currency symbol>,
  "expense_date": "<invoice date as YYYY-MM-DD; if none found use ${today}>",
  "description": "<short 1-line description of what was purchased>"
}

Rules:
- amount must be the grand total (largest total/amount due), as a plain number.
- If a field is missing, use a sensible default (amount 0, date ${today}, category "Other").`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const clean = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(clean);
    parsed.amount = Number(parsed.amount) || 0;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.expense_date || '')) parsed.expense_date = today;
    return parsed;
  } catch (err) {
    console.error('[Gemini] parseInvoice error:', err.message);
    return { vendor: '', category: 'Other', amount: 0, expense_date: today, description: 'Could not parse invoice automatically.' };
  }
}

module.exports = { screenCV, detectAnomaly, analyseSentiment, generateAnalyticsReport, parseInvoice };
