/**
 * Tiny persistent document store (JSON file) used as the database.
 * Works with zero setup (no MongoDB install needed). Collections behave like
 * MongoDB collections: documents get a 24-char hex `_id`, plus timestamps.
 * Writes are atomic (temp file + rename) and serialized through a queue.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');

const file = path.resolve(config.dbFile);
fs.mkdirSync(path.dirname(file), { recursive: true });

let data = { users: [], notes: [], messages: [] };
if (fs.existsSync(file)) {
  try {
    data = { ...data, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch (err) {
    console.error('[db] could not parse db file, starting fresh:', err.message);
  }
}

let writing = false;
let dirty = false;
function persist() {
  dirty = true;
  if (writing) return;
  writing = true;
  setImmediate(function flush() {
    dirty = false;
    const tmp = file + '.tmp';
    fs.writeFile(tmp, JSON.stringify(data, null, 2), (err) => {
      if (!err) fs.rename(tmp, file, () => {});
      writing = false;
      if (dirty) persist();
    });
  });
}

const newId = () => crypto.randomBytes(12).toString('hex');
const clone = (o) => (o ? JSON.parse(JSON.stringify(o)) : o);

function collection(name) {
  const col = () => data[name];
  return {
    create(doc) {
      const now = new Date().toISOString();
      const record = { _id: newId(), ...doc, createdAt: now, updatedAt: now };
      col().push(record);
      persist();
      return clone(record);
    },
    findById(id) {
      return clone(col().find((d) => d._id === id));
    },
    findOne(predicate) {
      return clone(col().find(predicate));
    },
    find(predicate = () => true) {
      return clone(col().filter(predicate));
    },
    updateById(id, changes) {
      const rec = col().find((d) => d._id === id);
      if (!rec) return null;
      Object.assign(rec, changes, { updatedAt: new Date().toISOString() });
      persist();
      return clone(rec);
    },
    deleteById(id) {
      const i = col().findIndex((d) => d._id === id);
      if (i === -1) return false;
      col().splice(i, 1);
      persist();
      return true;
    },
  };
}

module.exports = {
  users: collection('users'),
  notes: collection('notes'),
  messages: collection('messages'),
  isValidId: (id) => typeof id === 'string' && /^[0-9a-f]{24}$/.test(id),
};
