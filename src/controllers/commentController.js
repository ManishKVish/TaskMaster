const db = require('../db/database');
const { sendNotification } = require('../services/notificationService');

exports.addComment = (req, res, next) => {
  try {
    const taskId = req.params.id;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Comment content cannot be empty.', code: 'VALIDATION_ERROR' }
      });
    }

    const task = db.prepare('SELECT id, title, created_by, assigned_to FROM tasks WHERE id = ?').get(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        error: { message: 'Task not found.', code: 'NOT_FOUND' }
      });
    }

    const insertStmt = db.prepare(`
      INSERT INTO comments (task_id, user_id, content)
      VALUES (?, ?, ?)
    `);
    const result = insertStmt.run(taskId, req.user.id, content.trim());
    const commentId = Number(result.lastInsertRowid);

    const comment = db.prepare(`
      SELECT c.*, u.name as user_name, u.email as user_email
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `).get(commentId);

    // Notify task assignee if someone else commented
    if (task.assigned_to && task.assigned_to !== req.user.id) {
      sendNotification(
        task.assigned_to,
        'New Comment on Task',
        `${req.user.name} commented on "${task.title}": "${content.slice(0, 50)}..."`,
        task.id
      );
    }

    return res.status(201).json({
      success: true,
      message: 'Comment added successfully.',
      data: { comment }
    });
  } catch (err) {
    next(err);
  }
};

exports.getComments = (req, res, next) => {
  try {
    const taskId = req.params.id;
    const comments = db.prepare(`
      SELECT c.*, u.name as user_name, u.email as user_email
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.task_id = ?
      ORDER BY c.created_at ASC
    `).all(taskId);

    return res.status(200).json({
      success: true,
      count: comments.length,
      data: { comments }
    });
  } catch (err) {
    next(err);
  }
};
