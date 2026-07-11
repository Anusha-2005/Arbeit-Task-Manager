const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('./auth');

// POST /api/issues - Create a new issue
router.post('/', authenticateToken, async (req, res) => {
  const { title, description, status, priority, assigneeId, projectId, sprintId } = req.body;
  
  if (!title || !status || !priority || !projectId) {
    return res.status(400).json({ error: 'Title, status, priority, and projectId are required' });
  }

  const id = 'issue_' + Date.now();
  const reporterId = req.user.id;

  try {
    // Determine the next order index for this status in this project
    const result = await db.query(
      'SELECT COALESCE(MAX(\`order\`), -1) + 1 AS nextOrder FROM issues WHERE projectId = ? AND status = ?',
      [projectId, status]
    );
    const order = result[0].nextOrder;

    await db.query(
      'INSERT INTO issues (id, title, description, status, \`order\`, priority, assigneeId, reporterId, projectId, sprintId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, title, description || null, status, order, priority, assigneeId || null, reporterId, projectId, sprintId || null]
    );

    // Fetch the created issue with user details
    const issues = await db.query(`
      SELECT i.*, 
             u1.name AS assigneeName, u1.imageUrl AS assigneeImageUrl, u1.email AS assigneeEmail,
             u2.name AS reporterName, u2.imageUrl AS reporterImageUrl, u2.email AS reporterEmail
      FROM issues i
      LEFT JOIN users u1 ON i.assigneeId = u1.id
      LEFT JOIN users u2 ON i.reporterId = u2.id
      WHERE i.id = ?
    `, [id]);

    res.status(201).json(issues[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/issues/reorder - Bulk update issue orders and statuses (for drag-and-drop)
router.patch('/reorder', authenticateToken, async (req, res) => {
  const { issues } = req.body; // Array of { id, status, order }
  if (!issues || !Array.isArray(issues)) {
    return res.status(400).json({ error: 'Issues array is required' });
  }

  const connection = await db.pool.getConnection();
  try {
    await connection.beginTransaction();

    for (let item of issues) {
      await connection.execute(
        'UPDATE issues SET status = ?, \`order\` = ? WHERE id = ?',
        [item.status, item.order, item.id]
      );
    }

    await connection.commit();
    res.json({ message: 'Issues reordered successfully' });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

// PATCH /api/issues/:id - Update individual issue fields
router.patch('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { title, description, status, priority, assigneeId, sprintId } = req.body;

  try {
    // Build dynamic UPDATE query
    const updates = [];
    const params = [];

    if (title !== undefined) { updates.push('title = ?'); params.push(title); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (priority !== undefined) { updates.push('priority = ?'); params.push(priority); }
    if (assigneeId !== undefined) { updates.push('assigneeId = ?'); params.push(assigneeId || null); }
    if (sprintId !== undefined) { updates.push('sprintId = ?'); params.push(sprintId || null); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(id);
    await db.query(`UPDATE issues SET ${updates.join(', ')} WHERE id = ?`, params);

    // Fetch the updated issue with user details
    const issues = await db.query(`
      SELECT i.*, 
             u1.name AS assigneeName, u1.imageUrl AS assigneeImageUrl, u1.email AS assigneeEmail,
             u2.name AS reporterName, u2.imageUrl AS reporterImageUrl, u2.email AS reporterEmail
      FROM issues i
      LEFT JOIN users u1 ON i.assigneeId = u1.id
      LEFT JOIN users u2 ON i.reporterId = u2.id
      WHERE i.id = ?
    `, [id]);

    if (issues.length === 0) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    res.json(issues[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/issues/:id - Delete an issue
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM issues WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Issue not found' });
    }
    res.json({ message: 'Issue deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
