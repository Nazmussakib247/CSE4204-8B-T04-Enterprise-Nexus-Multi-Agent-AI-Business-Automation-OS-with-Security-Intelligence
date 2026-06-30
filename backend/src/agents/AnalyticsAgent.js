const BaseAgent = require('./BaseAgent');

class AnalyticsAgent extends BaseAgent {
  constructor() { super('analytics'); }

  buildPrompt({ kpiData, datePeriodStart, datePeriodEnd }) {
    return `
You are a business analytics AI. Analyse the following KPI data and generate a performance report.

REPORTING PERIOD: ${datePeriodStart} to ${datePeriodEnd}

KPI DATA:
${JSON.stringify(kpiData, null, 2)}

Generate a comprehensive analytics report. Respond ONLY with valid JSON:
{
  "performance_rating": "excellent|good|average|poor",
  "overall_score":      0-100,
  "ai_insights":        "string (executive summary, 3-5 sentences)",
  "action_items":       ["string (actionable recommendation)"],
  "highlights":         ["string"],
  "risks":              ["string"]
}`;
  }

  parseResponse(text) {
    const clean = text.replace(/```json|```/g, '').trim();
    try { return JSON.parse(clean); } catch {
      return {
        performance_rating: 'average',
        overall_score: 50,
        ai_insights:   text,
        action_items:  [],
        highlights:    [],
        risks:         [],
      };
    }
  }
}

module.exports = new AnalyticsAgent();
