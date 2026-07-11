const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('./auth');

// GET /api/users - Get all users
router.get('/', authenticateToken, async (req, res) => {
  try {
    const users = await db.query('SELECT id, name, email, imageUrl FROM users');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/profile - Update current user profile
router.put('/profile', authenticateToken, async (req, res) => {
  const { name, imageUrl, password } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }
  try {
    let query = 'UPDATE users SET name = ?, imageUrl = ?';
    let params = [name, imageUrl || null];

    if (password) {
      query += ', password = ?';
      params.push(password);
    }

    query += ' WHERE id = ?';
    params.push(req.user.id);

    await db.query(query, params);

    const users = await db.query('SELECT id, name, email, imageUrl FROM users WHERE id = ?', [req.user.id]);
    res.json({ user: users[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
