const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('./auth');

// POST /api/issues - Create a new issue
router.post('/', authenticateToken, async (req, res) => {
  const { title, description, status, priority, assigneeId, projectId, sprintId, dueDate } = req.body;
  
  if (!title || !status || !priority || !projectId) {
    return res.status(400).json({ error: 'Title, status, priority, and projectId are required' });
  }

  const id = 'issue_' + Date.now();
  const reporterId = req.user.id;

  try {
    // Determine the next order index for this status in this project
    const result = await db.query(
      'SELECT COALESCE(MAX(`order`), -1) + 1 AS nextOrder FROM issues WHERE projectId = ? AND status = ?',
      [projectId, status]
    );
    const order = result[0].nextOrder;

    await db.query(
      'INSERT INTO issues (id, title, description, status, `order`, priority, assigneeId, reporterId, projectId, sprintId, dueDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, title, description || null, status, order, priority, assigneeId || null, reporterId, projectId, sprintId || null, dueDate || null]
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

    const io = req.app.get('io');
    // Broadcast creation to project room
    io.to(projectId).emit('board-updated', { projectId });

    // Generate notification if assigned to someone else
    if (assigneeId && assigneeId !== reporterId) {
      const notifId = 'notif_' + Date.now();
      const msg = `You have been assigned to issue: ${title}`;
      await db.query('INSERT INTO notifications (id, message, userId) VALUES (?, ?, ?)', [notifId, msg, assigneeId]);
      io.emit(`notification-${assigneeId}`, { message: msg });
    }

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

    // Fetch projectId to broadcast update
    if (issues.length > 0) {
      const firstIssueId = issues[0].id;
      const projResult = await db.query('SELECT projectId FROM issues WHERE id = ?', [firstIssueId]);
      if (projResult.length > 0) {
        const projectId = projResult[0].projectId;
        const io = req.app.get('io');
        io.to(projectId).emit('board-updated', { projectId });
      }
    }

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
  const { title, description, status, priority, assigneeId, sprintId, dueDate } = req.body;

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
    if (dueDate !== undefined) { updates.push('dueDate = ?'); params.push(dueDate || null); }

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

    const updatedIssue = issues[0];
    const io = req.app.get('io');
    io.to(updatedIssue.projectId).emit('board-updated', { projectId: updatedIssue.projectId });

    // Generate notification if assignee changed and it's not the current user
    if (assigneeId !== undefined && assigneeId && assigneeId !== req.user.id) {
      const notifId = 'notif_' + Date.now();
      const msg = `You have been assigned to issue: ${updatedIssue.title}`;
      await db.query('INSERT INTO notifications (id, message, userId) VALUES (?, ?, ?)', [notifId, msg, assigneeId]);
      io.emit(`notification-${assigneeId}`, { message: msg });
    }

    res.json(updatedIssue);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/issues/:id - Delete an issue
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const targetIssues = await db.query('SELECT projectId FROM issues WHERE id = ?', [id]);

    const result = await db.query('DELETE FROM issues WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    if (targetIssues.length > 0) {
      const projectId = targetIssues[0].projectId;
      const io = req.app.get('io');
      io.to(projectId).emit('board-updated', { projectId });
    }

    res.json({ message: 'Issue deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/issues/:issueId/comments - Get comments for an issue
router.get('/:issueId/comments', authenticateToken, async (req, res) => {
  const { issueId } = req.params;
  try {
    const comments = await db.query(`
      SELECT c.*, u.name AS userName, u.imageUrl AS userImageUrl, u.email AS userEmail
      FROM comments c
      JOIN users u ON c.userId = u.id
      WHERE c.issueId = ?
      ORDER BY c.createdAt ASC
    `, [issueId]);
    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/issues/:issueId/comments - Post a new comment
router.post('/:issueId/comments', authenticateToken, async (req, res) => {
  const { issueId } = req.params;
  const { content } = req.body;
  if (!content) {
    return res.status(400).json({ error: 'Comment content is required' });
  }

  const id = 'comment_' + Date.now();
  const userId = req.user.id;

  try {
    await db.query(
      'INSERT INTO comments (id, content, issueId, userId) VALUES (?, ?, ?, ?)',
      [id, content, issueId, userId]
    );

    const comments = await db.query(`
      SELECT c.*, u.name AS userName, u.imageUrl AS userImageUrl, u.email AS userEmail
      FROM comments c
      JOIN users u ON c.userId = u.id
      WHERE c.id = ?
    `, [id]);

    // Broadcast comment addition to project room via WebSockets
    const io = req.app.get('io');
    const issues = await db.query('SELECT projectId FROM issues WHERE id = ?', [issueId]);
    if (issues.length > 0) {
      const projectId = issues[0].projectId;
      io.to(projectId).emit('issue-updated', { projectId, issueId });
    }

    res.status(201).json(comments[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
