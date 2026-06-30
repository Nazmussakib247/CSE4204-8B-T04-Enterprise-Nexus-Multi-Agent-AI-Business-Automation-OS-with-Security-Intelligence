const jwt = require('jsonwebtoken');

const ACCESS_SECRET  = process.env.JWT_SECRET          || 'changeme_access';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET  || 'changeme_refresh';
const ACCESS_EXP     = process.env.JWT_EXPIRES_IN      || '15m';
const REFRESH_EXP    = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

const signAccess = (payload)  => jwt.sign(payload, ACCESS_SECRET,  { expiresIn: ACCESS_EXP });
const signRefresh = (payload) => jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXP });

const verifyAccess  = (token) => jwt.verify(token, ACCESS_SECRET);
const verifyRefresh = (token) => jwt.verify(token, REFRESH_SECRET);

module.exports = { signAccess, signRefresh, verifyAccess, verifyRefresh };
