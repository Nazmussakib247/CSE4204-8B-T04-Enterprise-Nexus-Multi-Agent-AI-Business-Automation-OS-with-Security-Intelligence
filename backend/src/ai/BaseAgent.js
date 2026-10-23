/**
 * BaseAgent — foundation class for all NeXus AI agents.
 *
 * Features:
 *  - System prompt + LangChain ChatGoogleGenerativeAI
 *  - Tool-calling loop: bindTools + manual iteration over tool_calls (max 5)
 *  - Structured JSON output validated with Joi
 *  - Every tool call audited to audit_logs with action prefix "agent:"
 *
 * Subclass or instantiate directly:
 *   const agent = new BaseAgent({ name: 'cv-screener', systemPrompt, tools, outputSchema });
 *   const result = await agent.run('Screen this candidate ...', { userId, req });
 */
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { SystemMessage, HumanMessage, ToolMessage } = require('@langchain/core/messages');
const logger = require('../utils/logger');
const { writeAuditLog } = require('../utils/audit');
const { getModelName } = require('./client');
const { AiUnavailableError, AiOutputValidationError } = require('./errors');

const MAX_TOOL_ITERATIONS = 5;

class BaseAgent {
  /**
   * @param {object} opts
   * @param {string} opts.name           agent name, used in audit actions ("agent:<name>:<tool>")
   * @param {string} opts.systemPrompt   system instruction for the model
   * @param {import('@langchain/core/tools').StructuredTool[]} [opts.tools]
   * @param {import('joi').Schema} [opts.outputSchema]  Joi schema for the final JSON output
   * @param {number} [opts.maxIterations]
   * @param {object} [opts.llm]          injectable chat model (for tests)
   */
  constructor({ name, systemPrompt, tools = [], outputSchema = null, maxIterations = MAX_TOOL_ITERATIONS, llm = null }) {
    if (!name) throw new Error('BaseAgent requires a name');
    if (!systemPrompt) throw new Error('BaseAgent requires a systemPrompt');

    this.name = name;
    this.systemPrompt = systemPrompt;
    this.tools = tools;
    this.outputSchema = outputSchema;
    this.maxIterations = maxIterations;

    this.llm =
      llm ||
      new ChatGoogleGenerativeAI({
        model: getModelName(),
        apiKey: process.env.GEMINI_API_KEY,
        temperature: 0,
        maxRetries: 2,
      });
  }

  /**
   * Run the agent: tool loop first, then parse + validate the final answer.
   *
   * @param {string} input                     the user/task prompt
   * @param {object} [ctx]
   * @param {string} [ctx.userId]              for audit logging
   * @param {object} [ctx.req]                 Express request (for audit IP/UA)
   * @returns {Promise<object>} validated JSON output
   * @throws {AiUnavailableError}
   */
  async run(input, { userId = null, req = null } = {}) {
    if (!process.env.GEMINI_API_KEY && !this._llmInjected()) {
      throw new AiUnavailableError('GEMINI_API_KEY is not configured', { reason: 'not_configured' });
    }

    /** Per-run tool trace: [{ tool, args, result_summary, success }] */
    this.lastRunSteps = [];

    const model = this.tools.length ? this.llm.bindTools(this.tools) : this.llm;
    const messages = [new SystemMessage(this.systemPrompt), new HumanMessage(input)];

    let response;
    try {
      response = await model.invoke(messages);

      let iterations = 0;
      while (Array.isArray(response.tool_calls) && response.tool_calls.length > 0) {
        if (iterations >= this.maxIterations) {
          logger.warn(`[Agent:${this.name}] max tool iterations (${this.maxIterations}) reached`);
          break;
        }
        iterations += 1;
        messages.push(response);

        for (const call of response.tool_calls) {
          const toolMessage = await this._executeToolCall(call, { userId, req });
          messages.push(toolMessage);
        }

        response = await model.invoke(messages);
      }
    } catch (err) {
      if (err instanceof AiUnavailableError) throw err;
      throw new AiUnavailableError(`Agent "${this.name}" LLM call failed: ${err.message}`, { cause: err });
    }

    return this._parseAndValidate(response);
  }

  /** Execute one tool call, audit it, and return a ToolMessage (never throws). */
  async _executeToolCall(call, { userId, req }) {
    const tool = this.tools.find((t) => t.name === call.name);
    let outputText;
    let success = true;

    if (!tool) {
      outputText = `Error: unknown tool "${call.name}"`;
      success = false;
    } else {
      try {
        const result = await tool.invoke(call.args);
        outputText = typeof result === 'string' ? result : JSON.stringify(result);
      } catch (err) {
        outputText = `Error: tool "${call.name}" failed: ${err.message}`;
        success = false;
        logger.error(`[Agent:${this.name}] tool ${call.name} failed`, { error: err.message });
      }
    }

    this.lastRunSteps.push({
      tool: call.name,
      args: call.args,
      result_summary: String(outputText).slice(0, 300),
      success,
    });

    // Audit every tool call — fire-and-forget, prefixed with "agent:"
    writeAuditLog({
      userId,
      action: `agent:${this.name}:${call.name}`,
      resourceType: 'ai_tool_call',
      metadata: {
        agent: this.name,
        tool: call.name,
        args: call.args,
        output_preview: String(outputText).slice(0, 500),
      },
      req,
      success,
    });

    return new ToolMessage({
      tool_call_id: call.id || `${this.name}-${call.name}`,
      name: call.name,
      content: outputText,
    });
  }

  /** Parse the model's final message as JSON and validate against the Joi schema. */
  _parseAndValidate(response) {
    const raw =
      typeof response.content === 'string'
        ? response.content
        : (response.content || [])
            .map((part) => (typeof part === 'string' ? part : part.text || ''))
            .join('');

    // Tool-calling cannot be combined with Gemini's native JSON mode, so the
    // final message may arrive fenced — tolerate ```json ... ``` wrappers here.
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      throw new AiOutputValidationError(
        `Agent "${this.name}" returned non-JSON output: ${err.message}`,
        { cause: err }
      );
    }

    if (this.outputSchema) {
      const { error, value } = this.outputSchema.validate(parsed, { stripUnknown: true });
      if (error) {
        throw new AiOutputValidationError(
          `Agent "${this.name}" output failed validation: ${error.message}`,
          { cause: error }
        );
      }
      return value;
    }
    return parsed;
  }

  _llmInjected() {
    return !(this.llm instanceof ChatGoogleGenerativeAI);
  }
}

module.exports = { BaseAgent, MAX_TOOL_ITERATIONS };
