/**
 * End-to-end test: boots the server on a temp DB and exercises every requirement.
 * Run with:  npm test
 */
const os = require('os');
const path = require('path');
const fs = require('fs');

process.env.PORT = '5055';
process.env.JWT_SECRET = 'test_secret';
process.env.ADMIN_EMAIL = 'admin@example.com';
process.env.DB_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sc-')), 'db.json');

const { server } = require('../server');
const { io: ioc } = require('socket.io-client');
const BASE = 'http://localhost:5055';

let passed = 0, failed = 0;
const check = (name, cond, extra = '') => {
  cond ? passed++ : failed++;
  console.log(`${cond ? '  PASS' : '  FAIL'}  ${name}${cond ? '' : ' ' + extra}`);
};
async function call(method, url, body, token, extraHeaders = {}) {
  const res = await fetch(BASE + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...extraHeaders },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})), headers: res.headers };
}
const connect = (token) => new Promise((resolve, reject) => {
  const s = ioc(BASE, { auth: { token }, forceNew: true });
  s.on('connect', () => resolve(s));
  s.on('connect_error', reject);
});
const once = (s, ev) => new Promise((r) => s.once(ev, r));

(async () => {
  await new Promise((r) => server.listen(5055, r));

  console.log('\nAuth');
  let r = await call('POST', '/api/auth/signup', { username: 'victor', email: 'victor@example.com', password: '123456' });
  check('signup -> 201', r.status === 201 && r.body.message === 'User registered' && r.body.id);
  check('signup does not leak password', !('password' in r.body));
  r = await call('POST', '/api/auth/signup', { username: 'victor', email: 'victor@example.com', password: '123456' });
  check('duplicate signup -> 409', r.status === 409);
  r = await call('POST', '/api/auth/signup', { username: 'x', email: 'bad', password: '123456' });
  check('invalid email -> 400', r.status === 400);
  r = await call('POST', '/api/auth/signup', { username: 'x', email: 'x@x.com', password: '1' });
  check('short password -> 400', r.status === 400);
  await new Promise((r) => setTimeout(r, 100));
  const stored2 = JSON.parse(fs.readFileSync(process.env.DB_FILE, 'utf8'));
  check('password stored as bcrypt hash', stored2.users[0].password.startsWith('$2b$'));

  r = await call('POST', '/api/auth/login', { email: 'victor@example.com', password: 'wrong' });
  check('wrong password -> 401', r.status === 401);
  r = await call('POST', '/api/auth/login', { email: 'victor@example.com', password: '123456' });
  check('login -> 200 + token', r.status === 200 && r.body.message === 'Login successful' && r.body.token);
  const token = r.body.token;
  check('login sets token cookie', (r.headers.get('set-cookie') || '').startsWith('token='));

  console.log('\nProtected routes');
  r = await call('GET', '/api/notes');
  check('no token -> 403 "No token provided"', r.status === 403 && r.body.message === 'No token provided');
  r = await call('GET', '/api/notes', null, 'garbage');
  check('bad token -> 401', r.status === 401);
  r = await call('GET', '/api/notes', null, null, { Cookie: 'token=' + token });
  check('valid cookie token -> 200', r.status === 200);
  r = await call('GET', '/api/auth/me', null, token);
  check('/me returns user', r.status === 200 && r.body.username === 'victor' && r.body.role === 'user');

  console.log('\nNotes CRUD');
  r = await call('POST', '/api/notes', { title: 'My First Note', content: 'This is my first note of web dev -III' }, token);
  check('create note -> 201 with owner', r.status === 201 && r.body._id && r.body.owner);
  const noteId = r.body._id;
  r = await call('POST', '/api/notes', { title: 'My Second Note', content: 'This is my second note of web dev -III' }, token);
  r = await call('POST', '/api/notes', { title: '' }, token);
  check('invalid note -> 400', r.status === 400);
  r = await call('GET', '/api/notes', null, token);
  check('list notes -> 2', r.status === 200 && r.body.length === 2);
  r = await call('GET', '/api/notes/' + noteId, null, token);
  check('get one note', r.status === 200 && r.body.title === 'My First Note');
  r = await call('PUT', '/api/notes/' + noteId, { title: 'Edited' }, token);
  check('update note', r.status === 200 && r.body.title === 'Edited' && r.body.content.includes('first'));
  r = await call('GET', '/api/notes/zzz', null, token);
  check('bad id -> 400', r.status === 400);
  r = await call('GET', '/api/notes/' + '0'.repeat(24), null, token);
  check('missing note -> 404', r.status === 404);

  console.log('\nAuthorization / RBAC');
  await call('POST', '/api/auth/signup', { username: 'eve', email: 'eve@example.com', password: 'abcdef' });
  const eve = (await call('POST', '/api/auth/login', { email: 'eve@example.com', password: 'abcdef' })).body.token;
  r = await call('GET', '/api/notes/' + noteId, null, eve);
  check("other user can't read my note -> 403", r.status === 403);
  r = await call('DELETE', '/api/notes/' + noteId, null, eve);
  check("other user can't delete my note -> 403", r.status === 403);
  r = await call('GET', '/api/notes', null, eve);
  check("other user's list is empty", r.body.length === 0);
  r = await call('GET', '/api/admin/users', null, token);
  check('normal user blocked from /admin -> 403', r.status === 403);
  await call('POST', '/api/auth/signup', { username: 'root', email: 'admin@example.com', password: 'adminpw' });
  const admin = (await call('POST', '/api/auth/login', { email: 'admin@example.com', password: 'adminpw' })).body.token;
  r = await call('GET', '/api/admin/users', null, admin);
  check('admin can list users', r.status === 200 && r.body.length === 3 && !('password' in r.body[0]));
  r = await call('GET', '/api/admin/notes', null, admin);
  check('admin can view all notes', r.status === 200 && r.body.length === 2);
  r = await call('GET', '/api/notes/' + noteId, null, admin);
  check('admin can read any note', r.status === 200);
  r = await call('GET', '/api/admin/activity', null, admin);
  check('EventEmitter activity feed populated', r.status === 200 && r.body.some((e) => e.type === 'user:registered') && r.body.some((e) => e.type === 'note:created'));
  r = await call('DELETE', '/api/notes/' + noteId, null, token);
  check('owner deletes note', r.status === 200);

  console.log('\nSocket.IO chat');
  let rejected = false;
  try { await connect(); } catch (e) { rejected = e.message === 'No token provided'; }
  check('socket without token rejected', rejected);
  rejected = false;
  try { await connect('bad'); } catch (e) { rejected = e.message === 'Invalid token'; }
  check('socket with bad token rejected', rejected);

  const a = await connect(token), b = await connect(eve);
  await new Promise((r) => setTimeout(r, 100));
  const gotB = once(b, 'chatMessage');
  a.emit('chatMessage', { text: 'Hey team, backend is ready' });
  const m = await gotB;
  check('message broadcast to other user in room', m.username === 'victor' && m.text === 'Hey team, backend is ready');

  b.emit('joinRoom', 'private');
  await once(b, 'joined');
  let leaked = false;
  a.on('chatMessage', (x) => { if (x.text === 'secret') leaked = true; });
  b.emit('chatMessage', { text: 'secret' });
  await new Promise((r) => setTimeout(r, 200));
  check('rooms are isolated', !leaked);

  const errP = once(a, 'error_message');
  a.emit('chatMessage', { text: '   ' });
  check('empty message rejected', typeof (await errP) === 'string');

  const c = ioc(BASE, { auth: { token }, forceNew: true });
  const hist = await once(c, 'joined'); // listener attached before the server auto-joins "general"
  check('history delivered on join', hist.history.some((x) => x.text === 'Hey team, backend is ready'));

  [a, b, c].forEach((s) => s.disconnect());
  console.log(`\n${passed} passed, ${failed} failed`);
  server.close();
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
