const supabase = require('../config/supabase');
const logger = require('./logger');

/**
 * Write an audit log entry — fire-and-forget (never throws).
 * @param {object} opts
 * @param {string} opts.userId
 * @param {string} opts.action  e.g. 'auth.login', 'hr.report.create'
 * @param {string} [opts.resourceType]
 * @param {string} [opts.resourceId]
 * @param {object} [opts.metadata]  any extra JSON payload
 * @param {object} [opts.req]       Express request (for IP / user-agent)
 * @param {boolean} [opts.success]
 */
const writeAuditLog = async ({ userId, action, resourceType, resourceId, metadata, req, success = true }) => {
  try {
    const ipAddress = req
      ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null)
      : null;
    const userAgent = req?.headers?.['user-agent'] || null;
    const correlationId = req?.correlationId || null;

    await supabase.from('audit_logs').insert({
      user_id: userId || null,
      action,
      resource_type: resourceType || null,
      resource_id: resourceId ? String(resourceId) : null,
      metadata: metadata || null,
      ip_address: ipAddress,
      user_agent: userAgent,
      correlation_id: correlationId,
      success,
    });
  } catch (err) {
    // Never let audit logging crash the main request
    logger.error('[Audit] Failed to write audit log', { action, userId, err: err.message });
  }
};

module.exports = { writeAuditLog };
