const express = require('express');
const db = require('../db/store');
const { authenticate } = require('../middleware/auth');
const { appEvents, EVENTS } = require('../events/appEvents');

const router = express.Router();
router.use(authenticate); // every notes route is protected

const shape = (n) => ({ _id: n._id, title: n.title, content: n.content, owner: n.owner, createdAt: n.createdAt, updatedAt: n.updatedAt });

/** Loads the note, enforces ownership (admins may access any note). */
function loadNote(req, res, next) {
  if (!db.isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid note id' });
  const note = db.notes.findById(req.params.id);
  if (!note) return res.status(404).json({ message: 'Note not found' });
  if (note.owner !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'You do not have access to this note' });
  }
  req.note = note;
  next();
}

function validate(body, partial = false) {
  const { title, content } = body || {};
  if (!partial && (!title || !content)) return 'title and content are required';
  if (title !== undefined && (typeof title !== 'string' || !title.trim())) return 'title must be a non-empty string';
  if (content !== undefined && (typeof content !== 'string' || !content.trim())) return 'content must be a non-empty string';
  if (partial && title === undefined && content === undefined) return 'Provide title and/or content to update';
  return null;
}

// POST /api/notes
router.post('/', (req, res) => {
  const err = validate(req.body);
  if (err) return res.status(400).json({ message: err });
  const note = db.notes.create({ title: req.body.title.trim(), content: req.body.content, owner: req.user.id });
  appEvents.emit(EVENTS.NOTE_CREATED, note);
  res.status(201).json(shape(note));
});

// GET /api/notes  -> only the logged-in user's notes
router.get('/', (req, res) => {
  res.json(db.notes.find((n) => n.owner === req.user.id).map(shape));
});

// GET /api/notes/:id
router.get('/:id', loadNote, (req, res) => res.json(shape(req.note)));

// PUT /api/notes/:id
router.put('/:id', loadNote, (req, res) => {
  const err = validate(req.body, true);
  if (err) return res.status(400).json({ message: err });
  const changes = {};
  if (req.body.title !== undefined) changes.title = req.body.title.trim();
  if (req.body.content !== undefined) changes.content = req.body.content;
  const updated = db.notes.updateById(req.note._id, changes);
  appEvents.emit(EVENTS.NOTE_UPDATED, updated);
  res.json(shape(updated));
});

// DELETE /api/notes/:id
router.delete('/:id', loadNote, (req, res) => {
  db.notes.deleteById(req.note._id);
  appEvents.emit(EVENTS.NOTE_DELETED, req.note);
  res.json({ message: 'Note deleted', id: req.note._id });
});

module.exports = router;
