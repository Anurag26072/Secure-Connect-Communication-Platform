const { Server } = require('socket.io');
const db = require('../db/store');
const { verifyToken, parseCookies } = require('../middleware/auth');
const { appEvents, EVENTS } = require('../events/appEvents');

const DEFAULT_ROOM = 'general';
const ROOM_RE = /^[\w-]{1,30}$/;

function initChat(httpServer) {
  const io = new Server(httpServer);

  // Authenticate every socket with the same JWT used by the REST API.
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      (socket.handshake.headers.authorization || '').replace('Bearer ', '') ||
      parseCookies(socket.handshake.headers.cookie).token;
    if (!token) return next(new Error('No token provided'));
    try {
      socket.user = verifyToken(token);
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  const roomUsers = (room) => {
    const set = io.sockets.adapter.rooms.get(room);
    if (!set) return [];
    return [...new Set([...set].map((id) => io.sockets.sockets.get(id)?.user.username))].filter(Boolean);
  };

  io.on('connection', (socket) => {
    const { username } = socket.user;
    console.log(`User connected: ${socket.id}`);
    appEvents.emit(EVENTS.SOCKET_CONNECTED, { id: socket.id, username });

    function join(room) {
      if (!ROOM_RE.test(room)) return socket.emit('error_message', 'Invalid room name');
      socket.join(room);
      socket.currentRoom = room;
      console.log(`${socket.id} joined room ${room}`);
      socket.emit('joined', { room, history: db.messages.find((m) => m.room === room).slice(-50) });
      io.to(room).emit('system', { room, text: `${username} joined ${room}`, users: roomUsers(room) });
    }

    join(DEFAULT_ROOM);

    socket.on('joinRoom', (room) => {
      if (typeof room !== 'string') return;
      if (socket.currentRoom && socket.currentRoom !== room) leave(socket.currentRoom);
      join(room);
    });

    function leave(room) {
      socket.leave(room);
      io.to(room).emit('system', { room, text: `${username} left ${room}`, users: roomUsers(room) });
    }
    socket.on('leaveRoom', (room) => typeof room === 'string' && leave(room));

    socket.on('chatMessage', (payload) => {
      const text = typeof payload === 'string' ? payload : payload?.text;
      const room = (typeof payload === 'object' && payload?.room) || socket.currentRoom || DEFAULT_ROOM;
      if (typeof text !== 'string' || !text.trim() || text.length > 1000) {
        return socket.emit('error_message', 'Message must be 1-1000 characters');
      }
      if (!socket.rooms.has(room)) return socket.emit('error_message', 'Join the room first');
      const msg = db.messages.create({ room, userId: socket.user.id, username, text: text.trim() });
      console.log(`[${room}] ${username}: ${msg.text}`);
      appEvents.emit(EVENTS.CHAT_MESSAGE, msg);
      io.to(room).emit('chatMessage', { room, username, text: msg.text, at: msg.createdAt });
    });

    socket.on('typing', () => socket.to(socket.currentRoom || DEFAULT_ROOM).emit('typing', { username }));

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id} (${username})`);
      appEvents.emit(EVENTS.SOCKET_DISCONNECTED, { id: socket.id, username });
      if (socket.currentRoom) io.to(socket.currentRoom).emit('system', { room: socket.currentRoom, text: `${username} left`, users: roomUsers(socket.currentRoom) });
    });
  });

  return io;
}

module.exports = initChat;
