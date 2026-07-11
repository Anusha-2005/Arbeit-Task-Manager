const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('./auth');

// GET /api/projects - Get all projects
router.get('/', authenticateToken, async (req, res) => {
  try {
    const projects = await db.query('SELECT * FROM projects ORDER BY createdAt DESC');
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id - Get project details with sprints and issues
router.get('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const projects = await db.query('SELECT * FROM projects WHERE id = ?', [id]);
    if (projects.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const project = projects[0];

    // Fetch sprints
    const sprints = await db.query('SELECT * FROM sprints WHERE projectId = ? ORDER BY createdAt DESC', [id]);

    // Fetch issues with assignee and reporter names
    const issues = await db.query(`
      SELECT i.*, 
             u1.name AS assigneeName, u1.imageUrl AS assigneeImageUrl, u1.email AS assigneeEmail,
             u2.name AS reporterName, u2.imageUrl AS reporterImageUrl, u2.email AS reporterEmail
      FROM issues i
      LEFT JOIN users u1 ON i.assigneeId = u1.id
      LEFT JOIN users u2 ON i.reporterId = u2.id
      WHERE i.projectId = ? 
      ORDER BY i.status, i.order ASC
    `, [id]);

    res.json({
      ...project,
      sprints,
      issues
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects - Create a new project
router.post('/', authenticateToken, async (req, res) => {
  const { name, key, description, organizationId } = req.body;
  if (!name || !key) {
    return res.status(400).json({ error: 'Name and key are required' });
  }

  const id = 'proj_' + Date.now();
  const orgId = organizationId || 'org_default';

  try {
    // Check if key exists in org
    const existing = await db.query('SELECT id FROM projects WHERE organizationId = ? AND `key` = ?', [orgId, key]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'A project with this key already exists in the organization.' });
    }

    await db.query(
      'INSERT INTO projects (id, name, `key`, description, organizationId) VALUES (?, ?, ?, ?, ?)',
      [id, name, key.toUpperCase(), description, orgId]
    );

    const newProject = await db.query('SELECT * FROM projects WHERE id = ?', [id]);
    res.status(201).json(newProject[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/projects/:id - Delete a project
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM projects WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
