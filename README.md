# Arbeit Task Manager 🚀

A modern, high-performance, and feature-rich Jira-style Task Manager application built with **React/Vite** for the frontend, **Node.js/Express** for the backend, and **MySQL** for persistent database storage. The entire project is dockerized for seamless setup and local development.

---

## 🛠️ Technology Stack

- **Frontend:** React, Vite, Lucide Icons, Canvas Confetti
- **Backend:** Node.js, Express, JSON Web Tokens (JWT), `mysql2`
- **Database:** MySQL 8.0
- **Containerization:** Docker & Docker Compose

---

## ✨ Features

- **Project Management:** Create, delete, and view projects with unique keys (e.g. `SCRUM`, `JIRA`).
- **Kanban Board:** Manage tasks using a dynamic drag-and-drop Kanban board (To Do, In Progress, In Review, Done).
- **Sprint Management:** Group issues into Sprints, schedule durations, start/complete active Sprints.
- **Issue Tracking:** Detail issues with priority (Low, Medium, High, Urgent), assignees, and detailed descriptions.
- **Interactive Authentications:** Simple token-based onboarding and mock session profiles.

---

## 📂 Project Structure

```text
arbeit-task-manager/
├── backend/
│   ├── config/          # Database configuration
│   ├── routes/          # Express route handlers (auth, issues, projects, sprints, users)
│   ├── Dockerfile       # Backend docker image configuration
│   ├── schema.sql       # Database schema initialization script
│   └── server.js        # Main entry point for the backend server
├── frontend/
│   ├── src/             # React application files (App.jsx, App.css, main.jsx)
│   ├── Dockerfile       # Frontend docker image configuration
│   ├── index.html       # Entry HTML document
│   └── vite.config.js   # Vite configurations & API reverse-proxy setup
├── docker-compose.yml   # Multi-container orchestrator
└── README.md            # Project documentation
```

---

## 🚀 Quick Start (Using Docker Compose)

The easiest way to run the entire stack locally is by utilizing Docker Compose. 

### Prerequisites
Make sure you have **Docker** and **Docker Compose** installed on your system.

### Running the Application
1. Clone the repository and navigate to the project root:
   ```bash
   git clone https://github.com/Anusha-2005/Arbeit-Task-Manager.git
   cd Arbeit-Task-Manager
   ```
2. Spin up the containers:
   ```bash
   docker-compose up --build
   ```
3. Once running, access the services:
   - **Frontend:** `http://localhost:3000`
   - **Backend API:** `http://localhost:5000`
   - **MySQL Database:** `localhost:3306` (Root Password: `password`)

---

## 💻 Manual Setup (Local Development)

If you prefer running the application without Docker, you can set it up manually.

### 1. Database Setup
Ensure you have MySQL installed and running locally. Run the queries inside `backend/schema.sql` to initialize the database tables and insert the default user.

### 2. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `backend/` directory:
   ```env
   PORT=5000
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=neondb
   JWT_SECRET=your_jwt_secret
   ```
4. Start the server in development mode:
   ```bash
   npm run dev
   ```

### 3. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to `http://localhost:3000`.

---

## 🔒 Environment Variables Reference

| Variable | Description | Default (Docker) |
| :--- | :--- | :--- |
| `PORT` | Backend server port | `5000` |
| `DB_HOST` | MySQL hostname | `db` |
| `DB_USER` | MySQL database user | `root` |
| `DB_PASSWORD` | MySQL database password | `password` |
| `DB_NAME` | Database schema name | `neondb` |
| `JWT_SECRET` | Secret key for signing authorization tokens | `jira_clone_secret` |
