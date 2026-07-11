const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('./auth');

// POST /api/sprints - Create a new sprint
router.post('/', authenticateToken, async (req, res) => {
  const { name, startDate, endDate, projectId } = req.body;
  if (!name || !startDate || !endDate || !projectId) {
    return res.status(400).json({ error: 'All fields (name, startDate, endDate, projectId) are required' });
  }

  const id = 'sprint_' + Date.now();

  try {
    // Check name uniqueness per project
    const existing = await db.query('SELECT id FROM sprints WHERE projectId = ? AND name = ?', [projectId, name]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Sprint name must be unique in this project' });
    }

    await db.query(
      'INSERT INTO sprints (id, name, startDate, endDate, projectId) VALUES (?, ?, ?, ?, ?)',
      [id, name, new Date(startDate), new Date(endDate), projectId]
    );

    const newSprint = await db.query('SELECT * FROM sprints WHERE id = ?', [id]);
    res.status(201).json(newSprint[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/sprints/:id/status - Update sprint status
router.patch('/:id/status', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // PLANNED, ACTIVE, COMPLETED

  if (!status || !['PLANNED', 'ACTIVE', 'COMPLETED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  try {
    const sprints = await db.query('SELECT name, projectId FROM sprints WHERE id = ?', [id]);
    if (sprints.length === 0) {
      return res.status(404).json({ error: 'Sprint not found' });
    }
    const sprintName = sprints[0].name;
    const projectId = sprints[0].projectId;

    const result = await db.query('UPDATE sprints SET status = ? WHERE id = ?', [status, id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Sprint not found' });
    }
    const updatedSprint = await db.query('SELECT * FROM sprints WHERE id = ?', [id]);

    // WebSocket broadcast
    const io = req.app.get('io');
    io.to(projectId).emit('board-updated', { projectId });

    // Notifications for sprint status change
    if (status === 'ACTIVE' || status === 'COMPLETED') {
      const assignees = await db.query(
        'SELECT DISTINCT assigneeId FROM issues WHERE sprintId = ? AND assigneeId IS NOT NULL',
        [id]
      );
      const action = status === 'ACTIVE' ? 'started' : 'completed';
      const msg = `Sprint "${sprintName}" has been ${action}!`;
      
      for (const row of assignees) {
        if (row.assigneeId !== req.user.id) {
          const notifId = 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
          await db.query('INSERT INTO notifications (id, message, userId) VALUES (?, ?, ?)', [notifId, msg, row.assigneeId]);
          io.emit(`notification-${row.assigneeId}`, { message: msg });
        }
      }
    }

    res.json(updatedSprint[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
