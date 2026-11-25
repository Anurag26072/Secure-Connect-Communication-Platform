/**
 * Event-driven features using Node.js EventEmitter.
 * Routes/sockets only EMIT domain events; listeners here react to them
 * (logging, activity feed). This keeps route handlers decoupled.
 */
const EventEmitter = require('events');

class AppEmitter extends EventEmitter {}
const appEvents = new AppEmitter();

const EVENTS = {
  USER_REGISTERED: 'user:registered',
  USER_LOGGED_IN: 'user:loggedIn',
  LOGIN_FAILED: 'user:loginFailed',
  NOTE_CREATED: 'note:created',
  NOTE_UPDATED: 'note:updated',
  NOTE_DELETED: 'note:deleted',
  CHAT_MESSAGE: 'chat:message',
  SOCKET_CONNECTED: 'socket:connected',
  SOCKET_DISCONNECTED: 'socket:disconnected',
};

// In-memory activity feed (latest 100) exposed to admins.
const activity = [];
function record(type, payload) {
  activity.unshift({ type, ...payload, at: new Date().toISOString() });
  if (activity.length > 100) activity.pop();
}

appEvents.on(EVENTS.USER_REGISTERED, (u) => {
  console.log(`[event] user registered: ${u.username} <${u.email}> role=${u.role}`);
  record(EVENTS.USER_REGISTERED, { userId: u.id, username: u.username });
});
appEvents.on(EVENTS.USER_LOGGED_IN, (u) => {
  console.log(`[event] user logged in: ${u.username}`);
  record(EVENTS.USER_LOGGED_IN, { userId: u.id, username: u.username });
});
appEvents.on(EVENTS.LOGIN_FAILED, ({ email }) => {
  console.warn(`[event] failed login attempt for: ${email}`);
  record(EVENTS.LOGIN_FAILED, { email });
});
appEvents.on(EVENTS.NOTE_CREATED, (n) => {
  console.log(`[event] note created: "${n.title}" by ${n.owner}`);
  record(EVENTS.NOTE_CREATED, { noteId: n._id, owner: n.owner });
});
appEvents.on(EVENTS.NOTE_UPDATED, (n) => {
  console.log(`[event] note updated: "${n.title}"`);
  record(EVENTS.NOTE_UPDATED, { noteId: n._id, owner: n.owner });
});
appEvents.on(EVENTS.NOTE_DELETED, (n) => {
  console.log(`[event] note deleted: "${n.title}"`);
  record(EVENTS.NOTE_DELETED, { noteId: n._id, owner: n.owner });
});
appEvents.on(EVENTS.CHAT_MESSAGE, (m) => record(EVENTS.CHAT_MESSAGE, { room: m.room, username: m.username }));

module.exports = { appEvents, EVENTS, getActivity: () => activity.slice() };
