const BaseAgent = require('./BaseAgent');

class ExecutiveAgent extends BaseAgent {
  constructor() { super('executive'); }

  buildPrompt({ hrSummary, financeSummary, supportSummary, analyticsSummary, date }) {
    return `
You are a C-suite strategic advisor AI. Synthesise agent outputs into an executive board briefing.

DATE: ${date || new Date().toISOString().split('T')[0]}

Follow this 5-step chain-of-thought:
STEP 1 — SITUATION: Summarise the current business state from data.
STEP 2 — PERFORMANCE: Assess performance across HR, Finance, Support, Analytics.
STEP 3 — RISKS: Identify the top 3 strategic risks.
STEP 4 — OPPORTUNITIES: Identify top 3 growth or efficiency opportunities.
STEP 5 — RECOMMENDATIONS: Provide 3 prioritised board-level recommendations.

INPUT DATA:
HR Summary:        ${JSON.stringify(hrSummary       || {})}
Finance Summary:   ${JSON.stringify(financeSummary  || {})}
Support Summary:   ${JSON.stringify(supportSummary  || {})}
Analytics Summary: ${JSON.stringify(analyticsSummary|| {})}

Respond ONLY with valid JSON:
{
  "briefing_text": "string (full narrative, 4-6 paragraphs)",
  "performance_summary": {
    "hr_score":       0-100,
    "finance_score":  0-100,
    "support_score":  0-100,
    "analytics_score":0-100,
    "overall_health": "excellent|good|fair|poor"
  },
  "risks":            ["string"],
  "opportunities":    ["string"],
  "recommendations":  ["string"]
}`;
  }

  parseResponse(text) {
    const clean = text.replace(/```json|```/g, '').trim();
    try { return JSON.parse(clean); } catch {
      return {
        briefing_text:       text,
        performance_summary: {},
        risks:               [],
        opportunities:       [],
        recommendations:     [],
      };
    }
  }
}

module.exports = new ExecutiveAgent();
