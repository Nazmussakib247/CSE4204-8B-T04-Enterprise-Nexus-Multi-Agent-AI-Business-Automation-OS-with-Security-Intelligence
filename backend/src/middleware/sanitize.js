const xss = require('xss');

/**
 * Recursively sanitise all string values in an object against XSS.
 */
const sanitiseObject = (obj) => {
  if (typeof obj === 'string') return xss(obj);
  if (Array.isArray(obj))     return obj.map(sanitiseObject);
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, sanitiseObject(v)])
    );
  }
  return obj;
};

const sanitize = (req, _res, next) => {
  if (req.body)   req.body   = sanitiseObject(req.body);
  if (req.query)  req.query  = sanitiseObject(req.query);
  if (req.params) req.params = sanitiseObject(req.params);
  next();
};

module.exports = { sanitize };
