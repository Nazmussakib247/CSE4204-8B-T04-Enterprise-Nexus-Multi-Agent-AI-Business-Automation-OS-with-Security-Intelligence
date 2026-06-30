const BaseAgent = require('./BaseAgent');

class FinanceAgent extends BaseAgent {
  constructor() { super('finance'); }

  buildPrompt({ records, newRecord }) {
    const historyStr = records && records.length
      ? JSON.stringify(records.slice(0, 50))
      : 'No prior records available.';

    return `
You are a financial analyst AI specialising in corporate expense management.

HISTORICAL EXPENSE RECORDS (latest 50):
${historyStr}

NEW EXPENSE RECORD TO ANALYSE:
${JSON.stringify(newRecord)}

Tasks:
1. Determine if this expense is anomalous compared to historical spending.
2. Classify severity: low | medium | high | critical
3. Provide a concise AI analysis (2-3 sentences).

Respond ONLY with valid JSON:
{
  "severity":    "low|medium|high|critical",
  "is_anomaly":  true|false,
  "ai_analysis": "string",
  "flags":       ["string"]
}`;
  }

  parseResponse(text) {
    const clean = text.replace(/```json|```/g, '').trim();
    try { return JSON.parse(clean); } catch {
      return { severity: 'low', is_anomaly: false, ai_analysis: text, flags: [] };
    }
  }
}

module.exports = new FinanceAgent();
