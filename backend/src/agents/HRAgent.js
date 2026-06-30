const BaseAgent = require('./BaseAgent');

class HRAgent extends BaseAgent {
  constructor() { super('hr'); }

  buildPrompt({ cvText, jobTitle, jobDescription }) {
    return `
You are an expert HR recruitment AI. Analyse the following CV and score the candidate.

JOB TITLE: ${jobTitle || 'Not specified'}
JOB DESCRIPTION: ${jobDescription || 'Not provided'}

CV TEXT:
${cvText}

Respond ONLY with valid JSON matching this exact schema:
{
  "candidate_name": "string",
  "job_title": "string",
  "ai_score": 0-100,
  "confidence": 0.0-1.0,
  "recommendation": "hire|interview|reject",
  "narrative_summary": "string (2-4 sentences)",
  "score_breakdown": {
    "technical_skills": 0-100,
    "experience":       0-100,
    "education":        0-100,
    "communication":    0-100,
    "cultural_fit":     0-100
  },
  "extracted_profile": {
    "name":       "string",
    "email":      "string or null",
    "phone":      "string or null",
    "skills":     ["string"],
    "years_experience": 0,
    "highest_education": "string"
  }
}`;
  }

  parseResponse(text) {
    const clean = text.replace(/```json|```/g, '').trim();
    try { return JSON.parse(clean); } catch {
      return { error: 'Failed to parse AI response', raw: text };
    }
  }
}

module.exports = new HRAgent();
