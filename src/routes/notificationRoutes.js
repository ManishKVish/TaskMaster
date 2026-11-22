const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { registerSseClient } = require('../services/notificationService');

router.use(authenticateToken);

// List notifications
router.get('/', (req, res) => {
  const notifications = db.prepare(`
    SELECT * FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(req.user.id);

  return res.status(200).json({
    success: true,
    data: { notifications }
  });
});

// Mark all as read
router.patch('/read-all', (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  return res.status(200).json({
    success: true,
    message: 'All notifications marked as read.'
  });
});

// Server-Sent Events (SSE) Stream
router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', message: 'SSE notification stream established.' })}\n\n`);

  registerSseClient(req.user.id, res);
});

module.exports = router;
