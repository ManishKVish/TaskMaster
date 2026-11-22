const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { generateToken } = require('../middleware/auth');

exports.register = async (req, res, next) => {
  try {
    const { name, email, password, bio, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: { message: 'Name, email, and password are required.', code: 'VALIDATION_ERROR' }
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: { message: 'Password must be at least 6 characters long.', code: 'WEAK_PASSWORD' }
      });
    }

    const checkStmt = db.prepare('SELECT id FROM users WHERE email = ?');
    const existing = checkStmt.get(email.toLowerCase().trim());
    if (existing) {
      return res.status(409).json({
        success: false,
        error: { message: 'User with this email already exists.', code: 'EMAIL_ALREADY_EXISTS' }
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const insertStmt = db.prepare(`
      INSERT INTO users (name, email, password_hash, bio, role)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = insertStmt.run(
      name.trim(),
      email.toLowerCase().trim(),
      passwordHash,
      bio || '',
      role || 'USER'
    );

    const userId = Number(result.lastInsertRowid);
    const user = {
      id: userId,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      bio: bio || '',
      role: role || 'USER'
    };

    const token = generateToken(user);

    return res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      data: { user, token }
    });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { message: 'Email and password are required.', code: 'VALIDATION_ERROR' }
      });
    }

    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    const user = stmt.get(email.toLowerCase().trim());

    if (!user) {
      return res.status(401).json({
        success: false,
        error: { message: 'Invalid email or password.', code: 'INVALID_CREDENTIALS' }
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: { message: 'Invalid email or password.', code: 'INVALID_CREDENTIALS' }
      });
    }

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      bio: user.bio,
      role: user.role
    };

    const token = generateToken(safeUser);

    return res.status(200).json({
      success: true,
      message: 'Logged in successfully.',
      data: { user: safeUser, token }
    });
  } catch (err) {
    next(err);
  }
};

exports.getProfile = (req, res, next) => {
  try {
    const stmt = db.prepare('SELECT id, name, email, bio, role, created_at FROM users WHERE id = ?');
    const user = stmt.get(req.user.id);
    return res.status(200).json({
      success: true,
      data: { user }
    });
  } catch (err) {
    next(err);
  }
};

exports.updateProfile = (req, res, next) => {
  try {
    const { name, bio } = req.body;
    const stmt = db.prepare(`
      UPDATE users
      SET name = COALESCE(?, name),
          bio = COALESCE(?, bio),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(name || null, bio || null, req.user.id);

    const updatedUser = db.prepare('SELECT id, name, email, bio, role, updated_at FROM users WHERE id = ?').get(req.user.id);

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      data: { user: updatedUser }
    });
  } catch (err) {
    next(err);
  }
};

exports.logout = (req, res) => {
  // Stateless JWT: inform client to discard token
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully.'
  });
};
