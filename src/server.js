const http = require('http');
const { WebSocketServer } = require('ws');
const url = require('url');
const jwt = require('jsonwebtoken');
const app = require('./app');
const { JWT_SECRET } = require('./middleware/auth');
const { registerWsClient } = require('./services/notificationService');

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// Initialize WebSocket Server
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const parsedUrl = url.parse(request.url, true);
  if (parsedUrl.pathname === '/ws') {
    const token = parsedUrl.query.token;
    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request, decoded);
      });
    } catch (err) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
    }
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws, request, user) => {
  registerWsClient(user.id, ws);
  ws.send(JSON.stringify({ type: 'CONNECTED', message: `Welcome ${user.email} to real-time TaskMaster stream!` }));
});

server.listen(PORT, () => {
  console.log(`TaskMaster API running on port ${PORT}`);
  console.log(`WebSocket endpoint available at ws://localhost:${PORT}/ws?token=<JWT>`);
});

module.exports = server;
