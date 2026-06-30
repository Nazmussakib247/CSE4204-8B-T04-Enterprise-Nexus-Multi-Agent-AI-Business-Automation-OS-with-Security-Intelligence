const BaseAgent = require('./BaseAgent');

class SupportAgent extends BaseAgent {
  constructor() { super('support'); }

  buildPrompt({ query, ticketHistory }) {
    const histStr = ticketHistory && ticketHistory.length
      ? JSON.stringify(ticketHistory.slice(0, 10))
      : 'No prior ticket history.';

    return `
You are an enterprise support AI assistant. Help the user with their query.

PREVIOUS TICKETS (context):
${histStr}

USER QUERY:
${query}

Respond ONLY with valid JSON:
{
  "ai_response":  "string (helpful, professional answer, max 300 words)",
  "intent":       "string (e.g. billing_query, technical_issue, access_request, general_enquiry)",
  "urgency":      "low|medium|high|critical",
  "sentiment":    "positive|neutral|negative",
  "confidence":   0.0-1.0,
  "escalated":    true|false,
  "escalation_reason": "string or null"
}`;
  }

  parseResponse(text) {
    const clean = text.replace(/```json|```/g, '').trim();
    try { return JSON.parse(clean); } catch {
      return {
        ai_response: text,
        intent:      'general_enquiry',
        urgency:     'low',
        sentiment:   'neutral',
        confidence:  0.5,
        escalated:   false,
        escalation_reason: null,
      };
    }
  }
}

module.exports = new SupportAgent();
