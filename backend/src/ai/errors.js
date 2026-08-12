/**
 * Typed AI errors — thrown by the ai/ layer so controllers can distinguish
 * "the AI is down" from real application errors and degrade gracefully
 * (save the record with ai_status='failed') instead of persisting fake data.
 */

class AiUnavailableError extends Error {
  /**
   * @param {string} message
   * @param {object} [opts]
   * @param {Error}  [opts.cause]      original error
   * @param {string} [opts.reason]     'timeout' | 'rate_limit' | 'api_error' | 'invalid_output' | 'not_configured'
   * @param {number} [opts.attempts]   how many attempts were made
   */
  constructor(message, { cause, reason = 'api_error', attempts } = {}) {
    super(message);
    this.name = 'AiUnavailableError';
    this.reason = reason;
    this.attempts = attempts;
    this.cause = cause;
    this.statusCode = 503;
  }
}

class AiOutputValidationError extends AiUnavailableError {
  constructor(message, opts = {}) {
    super(message, { ...opts, reason: 'invalid_output' });
    this.name = 'AiOutputValidationError';
  }
}

module.exports = { AiUnavailableError, AiOutputValidationError };
