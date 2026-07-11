const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const db = require('./config/db');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors());
app.use(express.json());

// Load routes
const { router: authRouter } = require('./routes/auth');
const projectsRouter = require('./routes/projects');
const sprintsRouter = require('./routes/sprints');
const issuesRouter = require('./routes/issues');
const usersRouter = require('./routes/users');

app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/sprints', sprintsRouter);
app.use('/api/issues', issuesRouter);
app.use('/api/users', usersRouter);

// Status route
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Auto-run schema.sql on startup to ensure database tables are created
async function initializeDatabase() {
  console.log('Initializing database schema...');
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      
      // Split the script by semicolon, handling potential empty statements
      const statements = sql
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);

      // Run each statement one by one
      for (const statement of statements) {
        await db.pool.query(statement);
      }
      console.log('Database schema initialized successfully.');
    } else {
      console.warn('schema.sql not found, skipping database initialization.');
    }
  } catch (err) {
    console.error('Error initializing database schema:', err.message);
  }
}

// Start Server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  // Give MySQL container a moment to boot in Docker environment before running queries
  setTimeout(async () => {
    await initializeDatabase();
  }, 5000);
});
