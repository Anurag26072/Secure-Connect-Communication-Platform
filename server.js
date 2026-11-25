const http = require('http');
const path = require('path');
const express = require('express');
const config = require('./src/config');
const initChat = require('./src/sockets/chat');

const app = express();
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/notes', require('./src/routes/notes'));
app.use('/api/admin', require('./src/routes/admin'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// 404 + error handlers
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Malformed JSON body' });
  console.error('[error]', err);
  res.status(500).json({ message: 'Internal server error' });
});

const server = http.createServer(app);
initChat(server);

if (require.main === module) {
  server.listen(config.port, () => console.log(`[server] listening on http://localhost:${config.port}`));
}

module.exports = { app, server };
