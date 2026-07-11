const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('./auth');

// GET /api/notifications - Get all notifications for logged in user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const notifications = await db.query(
      'SELECT * FROM notifications WHERE userId = ? ORDER BY createdAt DESC',
      [req.user.id]
    );
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/notifications/:id/read - Mark notification as read
router.patch('/:id/read', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      'UPDATE notifications SET isRead = TRUE WHERE id = ? AND userId = ?',
      [id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/notifications/read-all - Mark all notifications as read
router.patch('/read-all', authenticateToken, async (req, res) => {
  try {
    await db.query(
      'UPDATE notifications SET isRead = TRUE WHERE userId = ?',
      [req.user.id]
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
