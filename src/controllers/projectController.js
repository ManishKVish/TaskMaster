const db = require('../db/database');
const { sendNotification } = require('../services/notificationService');

exports.createProject = (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Project name is required.', code: 'VALIDATION_ERROR' }
      });
    }

    const insertProj = db.prepare(`
      INSERT INTO projects (name, description, owner_id)
      VALUES (?, ?, ?)
    `);
    const result = insertProj.run(name.trim(), description || '', req.user.id);
    const projectId = Number(result.lastInsertRowid);

    // Automatically add creator as OWNER member
    const insertMember = db.prepare(`
      INSERT INTO project_members (project_id, user_id, role)
      VALUES (?, ?, 'OWNER')
    `);
    insertMember.run(projectId, req.user.id);

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);

    return res.status(201).json({
      success: true,
      message: 'Project created successfully.',
      data: { project }
    });
  } catch (err) {
    next(err);
  }
};

exports.getProjects = (req, res, next) => {
  try {
    const stmt = db.prepare(`
      SELECT p.*, u.name as owner_name, pm.role as user_role
      FROM projects p
      JOIN project_members pm ON p.id = pm.project_id
      JOIN users u ON p.owner_id = u.id
      WHERE pm.user_id = ?
      ORDER BY p.created_at DESC
    `);
    const projects = stmt.all(req.user.id);
    return res.status(200).json({
      success: true,
      data: { projects }
    });
  } catch (err) {
    next(err);
  }
};

exports.getProjectById = (req, res, next) => {
  try {
    const projectId = req.params.id;
    const project = db.prepare(`
      SELECT p.*, u.name as owner_name
      FROM projects p
      JOIN users u ON p.owner_id = u.id
      WHERE p.id = ?
    `).get(projectId);

    if (!project) {
      return res.status(404).json({
        success: false,
        error: { message: 'Project not found.', code: 'NOT_FOUND' }
      });
    }

    const members = db.prepare(`
      SELECT u.id, u.name, u.email, pm.role, pm.joined_at
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = ?
    `).all(projectId);

    return res.status(200).json({
      success: true,
      data: { project, members }
    });
  } catch (err) {
    next(err);
  }
};

exports.addMember = (req, res, next) => {
  try {
    const projectId = req.params.id;
    const { email, role } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: { message: 'User email is required to add a member.', code: 'VALIDATION_ERROR' }
      });
    }

    const userToAdd = db.prepare('SELECT id, name, email FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (!userToAdd) {
      return res.status(404).json({
        success: false,
        error: { message: 'No registered user found with this email.', code: 'USER_NOT_FOUND' }
      });
    }

    // Verify requesting user is OWNER or ADMIN
    const membership = db.prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, req.user.id);
    if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
      return res.status(403).json({
        success: false,
        error: { message: 'Only project owners and admins can add new members.', code: 'FORBIDDEN' }
      });
    }

    try {
      db.prepare(`
        INSERT INTO project_members (project_id, user_id, role)
        VALUES (?, ?, ?)
      `).run(projectId, userToAdd.id, role || 'MEMBER');
    } catch (e) {
      if (e.message.includes('UNIQUE')) {
        return res.status(409).json({
          success: false,
          error: { message: 'User is already a member of this project.', code: 'ALREADY_MEMBER' }
        });
      }
      throw e;
    }

    sendNotification(
      userToAdd.id,
      'Project Invitation',
      `${req.user.name} added you to project #${projectId}.`
    );

    return res.status(201).json({
      success: true,
      message: 'Member added successfully.',
      data: { user: userToAdd, role: role || 'MEMBER' }
    });
  } catch (err) {
    next(err);
  }
};
