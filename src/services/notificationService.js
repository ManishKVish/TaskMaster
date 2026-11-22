const db = require('../db/database');

// Active WebSocket connections keyed by userId: Set<WebSocket>
const wsClients = new Map();

// Active SSE response streams keyed by userId: Set<Response>
const sseClients = new Map();

function registerWsClient(userId, ws) {
  if (!wsClients.has(userId)) {
    wsClients.set(userId, new Set());
  }
  wsClients.get(userId).add(ws);

  ws.on('close', () => {
    const userSockets = wsClients.get(userId);
    if (userSockets) {
      userSockets.delete(ws);
      if (userSockets.size === 0) {
        wsClients.delete(userId);
      }
    }
  });
}

function registerSseClient(userId, res) {
  if (!sseClients.has(userId)) {
    sseClients.set(userId, new Set());
  }
  sseClients.get(userId).add(res);

  res.on('close', () => {
    const userStreams = sseClients.get(userId);
    if (userStreams) {
      userStreams.delete(res);
      if (userStreams.size === 0) {
        sseClients.delete(userId);
      }
    }
  });
}

function sendNotification(userId, title, message, taskId = null) {
  try {
    const stmt = db.prepare(`
      INSERT INTO notifications (user_id, title, message, task_id)
      VALUES (?, ?, ?, ?)
    `);
    const info = stmt.run(userId, title, message, taskId);
    const notification = {
      id: Number(info.lastInsertRowid),
      user_id: userId,
      title,
      message,
      task_id: taskId,
      is_read: 0,
      created_at: new Date().toISOString()
    };

    const payloadStr = JSON.stringify(notification);

    // Push via WebSocket
    const sockets = wsClients.get(userId);
    if (sockets) {
      for (const ws of sockets) {
        if (ws.readyState === 1) { // OPEN
          ws.send(payloadStr);
        }
      }
    }

    // Push via SSE
    const streams = sseClients.get(userId);
    if (streams) {
      for (const res of streams) {
        res.write(`data: ${payloadStr}\n\n`);
      }
    }

    return notification;
  } catch (err) {
    console.error('Error sending notification:', err.message);
    return null;
  }
}

module.exports = {
  registerWsClient,
  registerSseClient,
  sendNotification
};
