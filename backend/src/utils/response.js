/**
 * Send a standardised success envelope.
 */
const success = (res, data = {}, message = 'OK', status = 200) =>
  res.status(status).json({ success: true, message, data });

/**
 * Send a standardised error envelope.
 */
const error = (res, message = 'Internal Server Error', status = 500, details = null) => {
  const body = { success: false, message };
  if (details && process.env.NODE_ENV !== 'production') body.details = details;
  return res.status(status).json(body);
};

/**
 * Paginate a SQL query result.
 * @param {number} page  - 1-indexed page number
 * @param {number} limit - items per page
 * @returns {{ offset: number, limit: number, meta: Function }}
 */
const paginate = (page = 1, limit = 20) => {
  const p = Math.max(1, parseInt(page));
  const l = Math.min(100, Math.max(1, parseInt(limit)));
  return {
    offset: (p - 1) * l,
    limit:  l,
    meta: (total) => ({ page: p, limit: l, total, pages: Math.ceil(total / l) }),
  };
};

module.exports = { success, error, paginate };
