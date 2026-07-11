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

module.exports = router;
