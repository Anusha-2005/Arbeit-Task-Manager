const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const db = require('./config/db');

require('dotenv').config();

const http = require('http');
const { Server } = require('socket.io');

const app = express();
const PORT = process.env.PORT || 5000;

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE']
  }
});

// Expose io instance to express routes
app.set('io', io);

// Enable CORS
app.use(cors());
app.use(express.json());

// Load routes
const { router: authRouter } = require('./routes/auth');
const projectsRouter = require('./routes/projects');
const sprintsRouter = require('./routes/sprints');
const issuesRouter = require('./routes/issues');
const usersRouter = require('./routes/users');
const notificationsRouter = require('./routes/notifications');

app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/sprints', sprintsRouter);
app.use('/api/issues', issuesRouter);
app.use('/api/users', usersRouter);
app.use('/api/notifications', notificationsRouter);

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

// Socket Room listeners
io.on('connection', (socket) => {
  console.log('User connected to socket:', socket.id);

  socket.on('join-project', (projectId) => {
    socket.join(projectId);
    console.log(`Socket ${socket.id} joined project room: ${projectId}`);
  });

  socket.on('leave-project', (projectId) => {
    socket.leave(projectId);
    console.log(`Socket ${socket.id} left project room: ${projectId}`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Start Server
server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  // Give MySQL container a moment to boot in Docker environment before running queries
  setTimeout(async () => {
    await initializeDatabase();
  }, 5000);
});
