const { GoogleGenerativeAI } = require('@google/generative-ai');
const aiCache      = require('../utils/aiCache');
const tokenTracker = require('../utils/tokenTracker');
const logger       = require('../utils/logger');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

class BaseAgent {
  constructor(agentType) {
    this.agentType = agentType;
    this.model     = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    });
  }

  /**
   * Build the prompt string — override in subclasses.
   * @param {*} input
   * @returns {string}
   */
  buildPrompt(input) {
    return String(input);
  }

  /**
   * Parse the raw Gemini text — override in subclasses.
   * @param {string} text
   * @returns {*}
   */
  parseResponse(text) {
    // Default: try JSON parse, fall back to plain text
    try { return JSON.parse(text); } catch { return text; }
  }

  /**
   * Core invoke — with cache lookup, Gemini call, token recording.
   * @param {*} input
   * @param {{ userId?: string, taskId?: string, skipCache?: boolean }} opts
   * @returns {Promise<*>}
   */
  async invoke(input, opts = {}) {
    const prompt = this.buildPrompt(input);

    if (!opts.skipCache) {
      const cached = await aiCache.get(prompt, this.agentType);
      if (cached) return this.parseResponse(cached);
    }

    logger.info(`[${this.agentType}] Calling Gemini`, { preview: prompt.slice(0, 80) });

    const result  = await this.model.generateContent(prompt);
    const resp    = await result.response;
    const rawText = resp.text();

    // Token usage (Gemini returns usageMetadata)
    const usage = resp.usageMetadata || {};
    await tokenTracker.record({
      userId:       opts.userId,
      agentType:    this.agentType,
      taskId:       opts.taskId,
      inputTokens:  usage.promptTokenCount     || 0,
      outputTokens: usage.candidatesTokenCount || 0,
    });

    await aiCache.set(prompt, rawText, this.agentType);
    return this.parseResponse(rawText);
  }
}

module.exports = BaseAgent;
