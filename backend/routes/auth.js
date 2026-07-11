const express = require('express');
const router = express.Router();
const db = require('../config/db');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'jira_clone_secret';

// Middleware to authenticate JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const users = await db.query('SELECT id, name, email, imageUrl FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: users[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login (mock login/onboarding)
router.post('/login', async (req, res) => {
  const { email, name, imageUrl } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    // Find or create user
    let users = await db.query('SELECT id, name, email, imageUrl FROM users WHERE email = ?', [email]);
    let user;

    if (users.length === 0) {
      const id = 'user_' + Date.now();
      const userName = name || email.split('@')[0];
      const img = imageUrl || 'https://avatar.iran.liara.run/public/girl';
      await db.query(
        'INSERT INTO users (id, name, email, imageUrl) VALUES (?, ?, ?, ?)',
        [id, userName, email, img]
      );
      user = { id, name: userName, email, imageUrl: img };
    } else {
      user = users[0];
    }

    // Generate JWT token
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = {
  router,
  authenticateToken
};
