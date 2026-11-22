const path = require('path');
const fs = require('fs');
const db = require('../db/database');

exports.uploadAttachment = (req, res, next) => {
  try {
    const taskId = req.params.id;
    const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        error: { message: 'Task not found.', code: 'NOT_FOUND' }
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { message: 'No file uploaded.', code: 'FILE_REQUIRED' }
      });
    }

    const insertStmt = db.prepare(`
      INSERT INTO attachments (task_id, user_id, filename, original_name, mime_type, file_size, file_path)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertStmt.run(
      taskId,
      req.user.id,
      req.file.filename,
      req.file.originalname,
      req.file.mimetype,
      req.file.size,
      req.file.path
    );

    const attachmentId = Number(result.lastInsertRowid);
    const attachment = db.prepare('SELECT * FROM attachments WHERE id = ?').get(attachmentId);

    return res.status(201).json({
      success: true,
      message: 'Attachment uploaded successfully.',
      data: { attachment }
    });
  } catch (err) {
    next(err);
  }
};

exports.getAttachments = (req, res, next) => {
  try {
    const taskId = req.params.id;
    const attachments = db.prepare(`
      SELECT a.*, u.name as uploader_name
      FROM attachments a
      JOIN users u ON a.user_id = u.id
      WHERE a.task_id = ?
      ORDER BY a.created_at DESC
    `).all(taskId);

    return res.status(200).json({
      success: true,
      count: attachments.length,
      data: { attachments }
    });
  } catch (err) {
    next(err);
  }
};

exports.downloadAttachment = (req, res, next) => {
  try {
    const attachmentId = req.params.attachmentId;
    const attachment = db.prepare('SELECT * FROM attachments WHERE id = ?').get(attachmentId);

    if (!attachment || !fs.existsSync(attachment.file_path)) {
      return res.status(404).json({
        success: false,
        error: { message: 'Attachment file not found.', code: 'NOT_FOUND' }
      });
    }

    return res.download(attachment.file_path, attachment.original_name);
  } catch (err) {
    next(err);
  }
};
