const db = require('../db/database');
const { sendNotification } = require('../services/notificationService');
const { generateTaskDescription, summarizeTask } = require('../services/aiService');

exports.createTask = async (req, res, next) => {
  try {
    const { title, description, status, priority, due_date, project_id, assigned_to } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Task title is required.', code: 'VALIDATION_ERROR' }
      });
    }

    const taskStatus = status || 'TODO';
    const taskPriority = priority || 'MEDIUM';

    const insertStmt = db.prepare(`
      INSERT INTO tasks (title, description, status, priority, due_date, project_id, created_by, assigned_to)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertStmt.run(
      title.trim(),
      description || '',
      taskStatus,
      taskPriority,
      due_date || null,
      project_id ? Number(project_id) : null,
      req.user.id,
      assigned_to ? Number(assigned_to) : null
    );

    const taskId = Number(result.lastInsertRowid);
    const task = db.prepare(`
      SELECT t.*, u1.name as creator_name, u2.name as assignee_name, p.name as project_name
      FROM tasks t
      LEFT JOIN users u1 ON t.created_by = u1.id
      LEFT JOIN users u2 ON t.assigned_to = u2.id
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.id = ?
    `).get(taskId);

    // Send notification if assigned
    if (task.assigned_to && task.assigned_to !== req.user.id) {
      sendNotification(
        task.assigned_to,
        'New Task Assigned',
        `You were assigned to task: "${task.title}" by ${req.user.name}.`,
        task.id
      );
    }

    return res.status(201).json({
      success: true,
      message: 'Task created successfully.',
      data: { task }
    });
  } catch (err) {
    next(err);
  }
};

exports.getTasks = (req, res, next) => {
  try {
    const {
      status,
      priority,
      assigned_to,
      project_id,
      search,
      sort_by = 'created_at',
      order = 'DESC',
      limit = 50,
      offset = 0
    } = req.query;

    let query = `
      SELECT t.*, u1.name as creator_name, u2.name as assignee_name, p.name as project_name
      FROM tasks t
      LEFT JOIN users u1 ON t.created_by = u1.id
      LEFT JOIN users u2 ON t.assigned_to = u2.id
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ` AND t.status = ?`;
      params.push(status);
    }

    if (priority) {
      query += ` AND t.priority = ?`;
      params.push(priority);
    }

    if (assigned_to) {
      if (assigned_to === 'me') {
        query += ` AND t.assigned_to = ?`;
        params.push(req.user.id);
      } else {
        query += ` AND t.assigned_to = ?`;
        params.push(Number(assigned_to));
      }
    }

    if (project_id) {
      query += ` AND t.project_id = ?`;
      params.push(Number(project_id));
    }

    if (search) {
      query += ` AND (t.title LIKE ? OR t.description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    // Safe sorting columns
    const allowedSortColumns = {
      created_at: 't.created_at',
      due_date: 't.due_date',
      priority: 't.priority',
      title: 't.title',
      status: 't.status'
    };

    const sortCol = allowedSortColumns[sort_by] || 't.created_at';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    query += ` ORDER BY ${sortCol} ${sortOrder} LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const tasks = db.prepare(query).all(...params);

    return res.status(200).json({
      success: true,
      count: tasks.length,
      data: { tasks }
    });
  } catch (err) {
    next(err);
  }
};

exports.getTaskById = (req, res, next) => {
  try {
    const taskId = req.params.id;
    const task = db.prepare(`
      SELECT t.*, u1.name as creator_name, u2.name as assignee_name, p.name as project_name
      FROM tasks t
      LEFT JOIN users u1 ON t.created_by = u1.id
      LEFT JOIN users u2 ON t.assigned_to = u2.id
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.id = ?
    `).get(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: { message: 'Task not found.', code: 'NOT_FOUND' }
      });
    }

    const comments = db.prepare(`
      SELECT c.*, u.name as user_name, u.email as user_email
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.task_id = ?
      ORDER BY c.created_at ASC
    `).all(taskId);

    const attachments = db.prepare(`
      SELECT a.*, u.name as uploader_name
      FROM attachments a
      JOIN users u ON a.user_id = u.id
      WHERE a.task_id = ?
      ORDER BY a.created_at DESC
    `).all(taskId);

    return res.status(200).json({
      success: true,
      data: { task, comments, attachments }
    });
  } catch (err) {
    next(err);
  }
};

exports.updateTask = (req, res, next) => {
  try {
    const taskId = req.params.id;
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { message: 'Task not found.', code: 'NOT_FOUND' }
      });
    }

    const { title, description, status, priority, due_date, assigned_to, project_id } = req.body;

    const updateStmt = db.prepare(`
      UPDATE tasks
      SET title = COALESCE(?, title),
          description = COALESCE(?, description),
          status = COALESCE(?, status),
          priority = COALESCE(?, priority),
          due_date = COALESCE(?, due_date),
          assigned_to = COALESCE(?, assigned_to),
          project_id = COALESCE(?, project_id),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    updateStmt.run(
      title !== undefined ? title : null,
      description !== undefined ? description : null,
      status !== undefined ? status : null,
      priority !== undefined ? priority : null,
      due_date !== undefined ? due_date : null,
      assigned_to !== undefined ? (assigned_to ? Number(assigned_to) : null) : null,
      project_id !== undefined ? (project_id ? Number(project_id) : null) : null,
      taskId
    );

    const updatedTask = db.prepare(`
      SELECT t.*, u1.name as creator_name, u2.name as assignee_name
      FROM tasks t
      LEFT JOIN users u1 ON t.created_by = u1.id
      LEFT JOIN users u2 ON t.assigned_to = u2.id
      WHERE t.id = ?
    `).get(taskId);

    // Notify assignee if assignment or status changed
    if (updatedTask.assigned_to && updatedTask.assigned_to !== req.user.id) {
      if (status && status !== existing.status) {
        sendNotification(
          updatedTask.assigned_to,
          'Task Status Updated',
          `Task "${updatedTask.title}" changed status to ${updatedTask.status}.`,
          updatedTask.id
        );
      } else if (assigned_to && Number(assigned_to) !== existing.assigned_to) {
        sendNotification(
          updatedTask.assigned_to,
          'Task Assigned to You',
          `You have been assigned to "${updatedTask.title}".`,
          updatedTask.id
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Task updated successfully.',
      data: { task: updatedTask }
    });
  } catch (err) {
    next(err);
  }
};

exports.deleteTask = (req, res, next) => {
  try {
    const taskId = req.params.id;
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: { message: 'Task not found.', code: 'NOT_FOUND' }
      });
    }

    db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);

    return res.status(200).json({
      success: true,
      message: 'Task deleted successfully.'
    });
  } catch (err) {
    next(err);
  }
};

exports.generateAiDescription = async (req, res, next) => {
  try {
    const { title, context } = req.body;
    if (!title) {
      return res.status(400).json({
        success: false,
        error: { message: 'Title is required for AI description generation.', code: 'VALIDATION_ERROR' }
      });
    }
    const description = await generateTaskDescription(title, context);
    return res.status(200).json({
      success: true,
      data: { generated_description: description }
    });
  } catch (err) {
    next(err);
  }
};

exports.getAiSummary = async (req, res, next) => {
  try {
    const taskId = req.params.id;
    const task = db.prepare(`
      SELECT t.*, u.name as assigned_to_name
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.id = ?
    `).get(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: { message: 'Task not found.', code: 'NOT_FOUND' }
      });
    }

    const comments = db.prepare(`
      SELECT c.*, u.name as user_name
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.task_id = ?
    `).all(taskId);

    const summary = await summarizeTask(task, comments);
    return res.status(200).json({
      success: true,
      data: { summary }
    });
  } catch (err) {
    next(err);
  }
};
