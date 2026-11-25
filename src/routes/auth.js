const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db/store');
const { authenticate } = require('../middleware/auth');
const { appEvents, EVENTS } = require('../events/appEvents');

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/auth/signup
router.post('/signup', async (req, res, next) => {
  try {
    const { username, email, password } = req.body || {};
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'username, email and password are required' });
    }
    if (typeof username !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: 'Invalid input types' });
    }
    if (!EMAIL_RE.test(email)) return res.status(400).json({ message: 'Invalid email format' });
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (db.users.findOne((u) => u.email === cleanEmail)) {
      return res.status(409).json({ message: 'Email already registered' });
    }
    if (db.users.findOne((u) => u.username.toLowerCase() === username.trim().toLowerCase())) {
      return res.status(409).json({ message: 'Username already taken' });
    }

    const hashed = await bcrypt.hash(password, config.saltRounds);
    const role = config.adminEmail && cleanEmail === config.adminEmail ? 'admin' : 'user';
    const user = db.users.create({ username: username.trim(), email: cleanEmail, password: hashed, role });

    appEvents.emit(EVENTS.USER_REGISTERED, { id: user._id, username: user.username, email: user.email, role });
    res.status(201).json({ message: 'User registered', id: user._id, username: user.username, email: user.email });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: 'email and password are required' });
    }
    const cleanEmail = email.trim().toLowerCase();
    const user = db.users.findOne((u) => u.email === cleanEmail);
    // Same message for unknown email / wrong password (no user enumeration)
    const ok = user && (await bcrypt.compare(password, user.password));
    if (!ok) {
      appEvents.emit(EVENTS.LOGIN_FAILED, { email: cleanEmail });
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user._id, role: user.role, username: user.username }, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn,
    });
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 1000 });
    appEvents.emit(EVENTS.USER_LOGGED_IN, { id: user._id, username: user.username });
    res.status(200).json({ message: 'Login successful', token });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

// GET /api/auth/me  (protected)
router.get('/me', authenticate, (req, res) => res.json(req.user));

module.exports = router;
