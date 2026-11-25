const express = require('express');
const db = require('../db/store');
const { authenticate, authorize } = require('../middleware/auth');
const { getActivity } = require('../events/appEvents');

const router = express.Router();
router.use(authenticate, authorize('admin')); // RBAC: admins only

const publicUser = (u) => ({ id: u._id, username: u.username, email: u.email, role: u.role, createdAt: u.createdAt });

// GET /api/admin/users
router.get('/users', (req, res) => res.json(db.users.find().map(publicUser)));

// PATCH /api/admin/users/:id/role   { "role": "admin" | "user" }
router.patch('/users/:id/role', (req, res) => {
  const { role } = req.body || {};
  if (!['admin', 'user'].includes(role)) return res.status(400).json({ message: 'role must be "admin" or "user"' });
  if (!db.isValidId(req.params.id) || !db.users.findById(req.params.id)) return res.status(404).json({ message: 'User not found' });
  res.json(publicUser(db.users.updateById(req.params.id, { role })));
});

// DELETE /api/admin/users/:id  (also removes their notes)
router.delete('/users/:id', (req, res) => {
  if (!db.isValidId(req.params.id) || !db.users.findById(req.params.id)) return res.status(404).json({ message: 'User not found' });
  if (req.params.id === req.user.id) return res.status(400).json({ message: 'You cannot delete yourself' });
  db.notes.find((n) => n.owner === req.params.id).forEach((n) => db.notes.deleteById(n._id));
  db.users.deleteById(req.params.id);
  res.json({ message: 'User and their notes deleted' });
});

// GET /api/admin/notes  -> all notes of all users
router.get('/notes', (req, res) => res.json(db.notes.find()));

// GET /api/admin/activity -> feed produced by EventEmitter listeners
router.get('/activity', (req, res) => res.json(getActivity()));

module.exports = router;
