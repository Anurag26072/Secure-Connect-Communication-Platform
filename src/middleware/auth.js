const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db/store');

/** Reads JWT from "Authorization: Bearer <t>" header or a "token" cookie. */
function extractToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7).trim();
  return parseCookies(req.headers.cookie).token || null;
}

function parseCookies(raw = '') {
  const out = {};
  raw.split(';').forEach((pair) => {
    const i = pair.indexOf('=');
    if (i > -1) out[pair.slice(0, i).trim()] = decodeURIComponent(pair.slice(i + 1).trim());
  });
  return out;
}

function verifyToken(token) {
  const payload = jwt.verify(token, config.jwtSecret);
  const user = db.users.findById(payload.id);
  if (!user) throw new Error('User no longer exists');
  return { id: user._id, username: user.username, email: user.email, role: user.role };
}

/** Protects a route: 403 without token, 401 for invalid/expired token. */
function authenticate(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(403).json({ message: 'No token provided' });
  try {
    req.user = verifyToken(token);
    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    res.status(401).json({ message });
  }
}

/** RBAC: allow only the listed roles. Use after authenticate. */
const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied: insufficient permissions' });
  }
  next();
};

module.exports = { authenticate, authorize, verifyToken, extractToken, parseCookies };
