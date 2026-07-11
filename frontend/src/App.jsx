import React, { useState, useEffect } from 'react';
import { 
  FolderPlus, Plus, Calendar, CheckSquare, 
  Trash2, LogOut, Loader2, ArrowLeft,
  ChevronRight, AlertCircle, Play, CheckCircle,
  Bell, MessageSquare
} from 'lucide-react';
import confetti from 'canvas-confetti';
import io from 'socket.io-client';

const API_BASE = '/api';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!token);
  
  // Dashboard & Navigation state
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [projectDetail, setProjectDetail] = useState(null);
  const [activeView, setActiveView] = useState('dashboard'); // dashboard, board
  const [usersList, setUsersList] = useState([]);

  // Filters state
  const [selectedSprintFilter, setSelectedSprintFilter] = useState('all'); // 'all', 'backlog', or specific sprintId
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState('ALL'); // 'ALL', 'LOW', 'MEDIUM', 'HIGH', 'URGENT'
  const [searchQuery, setSearchQuery] = useState('');

  // Form states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginName, setLoginName] = useState('');
  
  const [showNewProjModal, setShowNewProjModal] = useState(false);
  const [newProjName, setNewProjName] = useState('');
  const [newProjKey, setNewProjKey] = useState('');
  const [newProjDesc, setNewProjDesc] = useState('');

  const [showNewSprintModal, setShowNewSprintModal] = useState(false);
  const [newSprintName, setNewSprintName] = useState('');
  const [newSprintStart, setNewSprintStart] = useState('');
  const [newSprintEnd, setNewSprintEnd] = useState('');

  const [showNewIssueModal, setShowNewIssueModal] = useState(false);
  const [newIssueTitle, setNewIssueTitle] = useState('');
  const [newIssueDesc, setNewIssueDesc] = useState('');
  const [newIssuePriority, setNewIssuePriority] = useState('MEDIUM');
  const [newIssueAssignee, setNewIssueAssignee] = useState('');
  const [newIssueSprint, setNewIssueSprint] = useState('');

  const [showIssueDetailModal, setShowIssueDetailModal] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState(null);

  // Issue Detail edit states
  const [isEditingIssue, setIsEditingIssue] = useState(false);
  const [editIssueTitle, setEditIssueTitle] = useState('');
  const [editIssueDesc, setEditIssueDesc] = useState('');
  const [editIssuePriority, setEditIssuePriority] = useState('MEDIUM');
  const [editIssueAssignee, setEditIssueAssignee] = useState('');
  const [editIssueSprint, setEditIssueSprint] = useState('');

  // Notifications states
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Socket state
  const [socket, setSocket] = useState(null);

  // Comments states
  const [comments, setComments] = useState([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(false);

  // Drag over states
  const [dragOverCol, setDragOverCol] = useState(null);

  // --- API FETCH HELPER ---
  const fetchApi = async (endpoint, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
    const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP error ${res.status}`);
    }
    return res.json();
  };

  // Check login session & get details
  useEffect(() => {
    if (token) {
      setLoading(true);
      fetchApi('/auth/me')
        .then(data => {
          setUser(data.user);
          loadDashboardData();
        })
        .catch(err => {
          console.error(err);
          handleLogout();
        })
        .finally(() => setLoading(false));
    }
  }, [token]);

  // Load projects and users list
  const loadDashboardData = async () => {
    try {
      const [projData, usersData] = await Promise.all([
        fetchApi('/projects'),
        fetchApi('/users')
      ]);
      setProjects(projData);
      setUsersList(usersData);
    } catch (err) {
      alert('Error loading dashboard: ' + err.message);
    }
  };

  // Load individual project details (sprints + issues)
  const loadProjectDetail = async (id) => {
    try {
      const data = await fetchApi(`/projects/${id}`);
      setProjectDetail(data);
    } catch (err) {
      alert('Error loading project details: ' + err.message);
    }
  };

  // Load unread notifications
  const loadNotifications = async () => {
    try {
      const data = await fetchApi('/notifications');
      setNotifications(data);
    } catch (err) {
      console.error('Failed to load notifications:', err.message);
    }
  };

  // Mark single notification as read
  const handleMarkAsRead = async (notifId) => {
    try {
      await fetchApi(`/notifications/${notifId}/read`, { method: 'PATCH' });
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, isRead: 1 } : n));
    } catch (err) {
      console.error(err);
    }
  };

  // Mark all notifications as read
  const handleMarkAllAsRead = async () => {
    try {
      await fetchApi('/notifications/read-all', { method: 'PATCH' });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: 1 })));
    } catch (err) {
      console.error(err);
    }
  };

  // Load comments
  const loadComments = async (issueId) => {
    setCommentsLoading(true);
    try {
      const data = await fetchApi(`/issues/${issueId}/comments`);
      setComments(data);
    } catch (err) {
      console.error('Failed to load comments:', err.message);
    } finally {
      setCommentsLoading(false);
    }
  };

  // Add a new comment
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    try {
      const newComment = await fetchApi(`/issues/${selectedIssue.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content: newCommentText })
      });
      setComments(prev => [...prev, newComment]);
      setNewCommentText('');
    } catch (err) {
      alert('Failed to post comment: ' + err.message);
    }
  };

  // Project Selection handler
  useEffect(() => {
    if (selectedProjectId) {
      loadProjectDetail(selectedProjectId);
      setSelectedSprintFilter('all');
      setSelectedPriorityFilter('ALL');
      setSearchQuery('');
    }
  }, [selectedProjectId]);

  // Load notifications on load/login
  useEffect(() => {
    if (token && user) {
      loadNotifications();
    }
  }, [token, user]);

  // Load comments when selectedIssue changes
  useEffect(() => {
    if (selectedIssue?.id) {
      loadComments(selectedIssue.id);
    }
  }, [selectedIssue?.id]);

  // WebSockets Setup
  useEffect(() => {
    if (token && user) {
      // Connect to same origin host, Vite proxy handles WebSockets by default
      const socketUrl = window.location.origin;
      const newSocket = io(socketUrl, {
        path: '/socket.io'
      });
      
      setSocket(newSocket);

      // Listen to notifications for this user
      newSocket.on(`notification-${user.id}`, (data) => {
        setNotifications(prev => [
          { id: 'notif_' + Date.now(), message: data.message, isRead: 0, createdAt: new Date() },
          ...prev
        ]);
      });

      return () => newSocket.close();
    }
  }, [token, user]);

  // Join/Leave project rooms on project selection
  useEffect(() => {
    if (socket && selectedProjectId) {
      socket.emit('join-project', selectedProjectId);

      socket.on('board-updated', (data) => {
        if (data.projectId === selectedProjectId) {
          loadProjectDetail(selectedProjectId);
        }
      });

      socket.on('issue-updated', (data) => {
        if (data.projectId === selectedProjectId) {
          loadProjectDetail(selectedProjectId);
          if (selectedIssue && selectedIssue.id === data.issueId) {
            loadComments(data.issueId);
          }
        }
      });

      return () => {
        socket.emit('leave-project', selectedProjectId);
        socket.off('board-updated');
        socket.off('issue-updated');
      };
    }
  }, [socket, selectedProjectId, selectedIssue]);

  // Auth Handlers
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginEmail) return;
    setLoading(true);
    try {
      const data = await fetchApi('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: loginEmail, name: loginName })
      });
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
    } catch (err) {
      alert('Login failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken('');
    setUser(null);
    setProjects([]);
    setProjectDetail(null);
    setSelectedProjectId(null);
    setActiveView('dashboard');
  };

  // Create Project
  const handleCreateProject = async (e) => {
    e.preventDefault();
    try {
      await fetchApi('/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: newProjName,
          key: newProjKey,
          description: newProjDesc
        })
      });
      setShowNewProjModal(false);
      setNewProjName('');
      setNewProjKey('');
      setNewProjDesc('');
      loadDashboardData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Create Sprint
  const handleCreateSprint = async (e) => {
    e.preventDefault();
    try {
      await fetchApi('/sprints', {
        method: 'POST',
        body: JSON.stringify({
          name: newSprintName,
          startDate: newSprintStart,
          endDate: newSprintEnd,
          projectId: selectedProjectId
        })
      });
      setShowNewSprintModal(false);
      setNewSprintName('');
      setNewSprintStart('');
      setNewSprintEnd('');
      loadProjectDetail(selectedProjectId);
    } catch (err) {
      alert(err.message);
    }
  };

  // Create Issue
  const handleCreateIssue = async (e) => {
    e.preventDefault();
    try {
      await fetchApi('/issues', {
        method: 'POST',
        body: JSON.stringify({
          title: newIssueTitle,
          description: newIssueDesc,
          status: 'TODO',
          priority: newIssuePriority,
          assigneeId: newIssueAssignee || null,
          sprintId: newIssueSprint || null,
          projectId: selectedProjectId
        })
      });
      setShowNewIssueModal(false);
      setNewIssueTitle('');
      setNewIssueDesc('');
      setNewIssuePriority('MEDIUM');
      setNewIssueAssignee('');
      setNewIssueSprint('');
      loadProjectDetail(selectedProjectId);
    } catch (err) {
      alert(err.message);
    }
  };

  // Delete Project
  const handleDeleteProject = async (projId, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this project?')) return;
    try {
      await fetchApi(`/projects/${projId}`, { method: 'DELETE' });
      loadDashboardData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Start Sprint (set to ACTIVE)
  const handleStartSprint = async (sprintId) => {
    try {
      await fetchApi(`/sprints/${sprintId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'ACTIVE' })
      });
      loadProjectDetail(selectedProjectId);
    } catch (err) {
      alert(err.message);
    }
  };

  // Complete Sprint (set to COMPLETED)
  const handleCompleteSprint = async (sprintId) => {
    try {
      await fetchApi(`/sprints/${sprintId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'COMPLETED' })
      });
      confetti({ particleCount: 150, spread: 80 });
      loadProjectDetail(selectedProjectId);
    } catch (err) {
      alert(err.message);
    }
  };

  // Update Individual Issue Status
  const handleUpdateIssueStatus = async (issueId, newStatus) => {
    try {
      const updatedData = await fetchApi(`/issues/${issueId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      if (selectedIssue && selectedIssue.id === issueId) {
        setSelectedIssue(updatedData);
      }
      loadProjectDetail(selectedProjectId);
      if (newStatus === 'DONE') {
        confetti({ particleCount: 50, spread: 60 });
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // Update Issue details (title, description, assignee, priority, sprint)
  const handleUpdateIssueDetails = async (e) => {
    e.preventDefault();
    try {
      const updatedData = await fetchApi(`/issues/${selectedIssue.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: editIssueTitle,
          description: editIssueDesc,
          priority: editIssuePriority,
          assigneeId: editIssueAssignee || null,
          sprintId: editIssueSprint || null
        })
      });
      
      setSelectedIssue(updatedData);
      setIsEditingIssue(false);
      loadProjectDetail(selectedProjectId);
    } catch (err) {
      alert('Failed to update issue: ' + err.message);
    }
  };

  // Delete Issue
  const handleDeleteIssue = async (issueId) => {
    if (!confirm('Are you sure you want to delete this issue?')) return;
    try {
      await fetchApi(`/issues/${issueId}`, { method: 'DELETE' });
      setShowIssueDetailModal(false);
      loadProjectDetail(selectedProjectId);
    } catch (err) {
      alert(err.message);
    }
  };

  // --- HTML5 DRAG & DROP FOR KANBAN ---
  const handleDragStart = (e, issueId) => {
    e.dataTransfer.setData('text/plain', issueId);
  };

  const handleDragOver = (e, columnStatus) => {
    e.preventDefault();
    setDragOverCol(columnStatus);
  };

  const handleDragLeave = () => {
    setDragOverCol(null);
  };

  const handleDrop = async (e, targetStatus) => {
    e.preventDefault();
    setDragOverCol(null);
    const issueId = e.dataTransfer.getData('text/plain');
    if (!issueId) return;

    // Find issue and update its status
    const list = projectDetail.issues || [];
    const targetIssue = list.find(i => i.id === issueId);
    if (!targetIssue || targetIssue.status === targetStatus) return;

    // Build the bulk update list
    // 1. Move target issue to targetStatus, insert it at the end of the new column
    const otherIssuesInTargetCol = list.filter(i => i.status === targetStatus);
    const updatedTargetIssue = { ...targetIssue, status: targetStatus, order: otherIssuesInTargetCol.length };

    // 2. Build list of issues requiring order refresh
    const issuesToUpdate = [
      { id: updatedTargetIssue.id, status: updatedTargetIssue.status, order: updatedTargetIssue.order }
    ];

    // Optimistic UI updates
    setProjectDetail(prev => ({
      ...prev,
      issues: prev.issues.map(i => i.id === issueId ? { ...i, status: targetStatus, order: otherIssuesInTargetCol.length } : i)
    }));

    try {
      // Call backend to update status & orders
      await fetchApi('/issues/reorder', {
        method: 'PATCH',
        body: JSON.stringify({ issues: issuesToUpdate })
      });
      loadProjectDetail(selectedProjectId);
      if (targetStatus === 'DONE') {
        confetti({ particleCount: 70, spread: 50 });
      }
    } catch (err) {
      alert('Failed to drop: ' + err.message);
      loadProjectDetail(selectedProjectId);
    }
  };

  // --- RENDERING ROUTINES ---
  if (loading && !user) {
    return (
      <div className="login-container">
        <Loader2 className="animate-spin" size={40} color="#0ea5e9" />
      </div>
    );
  }

  // Auth Screen
  if (!user) {
    return (
      <div className="login-container">
        <form className="login-card" onSubmit={handleLogin}>
          <h2>Arbeit Tasks</h2>
          <p>Manage sprints, boards, and team productivity in real-time.</p>
          <div className="form-group">
            <input 
              type="text" 
              placeholder="Your Name (Optional)" 
              className="form-control"
              value={loginName}
              onChange={e => setLoginName(e.target.value)}
            />
          </div>
          <div className="form-group">
            <input 
              type="email" 
              placeholder="Email address" 
              className="form-control"
              value={loginEmail}
              onChange={e => setLoginEmail(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
            Get Started
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* HEADER */}
      <header className="app-header">
        <div className="logo-section" onClick={() => { setActiveView('dashboard'); setSelectedProjectId(null); }}>
          <h1>ARBEIT</h1>
        </div>
        <div className="nav-controls">
          {activeView === 'board' && (
            <button className="btn btn-secondary" onClick={() => { setActiveView('dashboard'); setSelectedProjectId(null); }}>
              <ArrowLeft size={16} /> Back to Projects
            </button>
          )}

          {/* Notifications Dropdown */}
          <div style={{ position: 'relative' }}>
            <button 
              className="btn btn-secondary" 
              style={{ position: 'relative', padding: '0.6rem' }} 
              onClick={() => setShowNotifications(!showNotifications)}
              title="Notifications"
            >
              <Bell size={18} />
              {notifications.filter(n => !n.isRead).length > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  background: 'var(--danger)',
                  color: 'white',
                  borderRadius: '50%',
                  width: '18px',
                  height: '18px',
                  fontSize: '0.7rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  boxShadow: '0 0 0 2px rgb(15, 23, 42)'
                }}>
                  {notifications.filter(n => !n.isRead).length}
                </span>
              )}
            </button>
            {showNotifications && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: '0',
                marginTop: '0.8rem',
                width: '320px',
                background: 'rgb(24, 32, 51)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-premium)',
                zIndex: 999,
                overflow: 'hidden'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.8rem 1rem',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                  background: 'rgba(0, 0, 0, 0.15)'
                }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Notifications</h4>
                  {notifications.filter(n => !n.isRead).length > 0 && (
                    <button 
                      style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '500' }}
                      onClick={handleMarkAllAsRead}
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      No notifications yet.
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div 
                        key={n.id} 
                        style={{
                          padding: '0.8rem 1rem',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.2rem',
                          background: n.isRead ? 'transparent' : 'rgba(14, 165, 233, 0.04)',
                          transition: 'var(--transition-smooth)'
                        }}
                      >
                        <p style={{ fontSize: '0.85rem', color: n.isRead ? 'var(--text-secondary)' : 'var(--text-primary)', lineHeight: '1.3' }}>{n.message}</p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {!n.isRead && (
                            <button 
                              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.7rem', cursor: 'pointer', textDecoration: 'underline' }}
                              onClick={() => handleMarkAsRead(n.id)}
                            >
                              Mark read
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="user-profile">
            <img src={user.imageUrl} alt={user.name} className="user-avatar" />
            <span className="user-name">{user.name}</span>
          </div>
          <button className="btn btn-secondary" onClick={handleLogout} title="Log Out">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* MAIN VIEW */}
      <main className="app-main">
        {activeView === 'dashboard' ? (
          // --- DASHBOARD ---
          <div>
            <div className="dashboard-header">
              <h2>My Projects</h2>
              <button className="btn btn-primary" onClick={() => setShowNewProjModal(true)}>
                <FolderPlus size={16} /> New Project
              </button>
            </div>

            <div className="project-grid">
              {projects.map(proj => (
                <div 
                  key={proj.id} 
                  className="project-card" 
                  onClick={() => { setSelectedProjectId(proj.id); setActiveView('board'); }}
                >
                  <div className="project-meta">
                    <span className="project-key">{proj.key}</span>
                    <h3>{proj.name}</h3>
                    <p className="project-desc">{proj.description || 'No description provided.'}</p>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button 
                      className="btn btn-secondary btn-danger" 
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                      onClick={e => handleDeleteProject(proj.id, e)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {projects.length === 0 && (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                  <AlertCircle size={32} style={{ marginBottom: '1rem', color: 'var(--text-muted)' }} />
                  <p>No projects found. Create your first project to start tracking tasks!</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          // --- BOARD VIEW ---
          projectDetail && (
            <div className="board-container">
              <div className="board-header">
                <div className="board-info">
                  <h2>{projectDetail.name} <span className="project-key" style={{ marginBottom: 0 }}>{projectDetail.key}</span></h2>
                  <p>{projectDetail.description}</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button className="btn btn-secondary" onClick={() => setShowNewSprintModal(true)}>
                    <Calendar size={16} /> Add Sprint
                  </button>
                  <button className="btn btn-primary" onClick={() => setShowNewIssueModal(true)}>
                    <Plus size={16} /> Create Issue
                  </button>
                </div>
              </div>

              {/* FILTERS AND SEARCH */}
              <div className="board-filters" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', background: 'rgba(255, 255, 255, 0.03)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
                <div style={{ flex: '1', minWidth: '200px' }}>
                  <input 
                    type="text" 
                    placeholder="Search issues by title/description..." 
                    className="form-control"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
                
                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Sprint:</span>
                    <select 
                      className="form-control" 
                      style={{ padding: '0.4rem 0.8rem', width: 'auto', minWidth: '150px' }}
                      value={selectedSprintFilter}
                      onChange={e => setSelectedSprintFilter(e.target.value)}
                    >
                      <option value="all">All Sprints</option>
                      <option value="backlog">Backlog (No Sprint)</option>
                      {(projectDetail.sprints || []).map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Priority:</span>
                    <select 
                      className="form-control" 
                      style={{ padding: '0.4rem 0.8rem', width: 'auto' }}
                      value={selectedPriorityFilter}
                      onChange={e => setSelectedPriorityFilter(e.target.value)}
                    >
                      <option value="ALL">All Priorities</option>
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* ACTIVE SPRINT METRIC */}
              {projectDetail.sprints && projectDetail.sprints.length > 0 && (
                <div className="sprint-section" style={{ marginTop: 0 }}>
                  <div className="sprint-info">
                    <h3>
                      <span className={`sprint-badge ${projectDetail.sprints[0].status.toLowerCase()}`}>
                        {projectDetail.sprints[0].status}
                      </span>
                      {projectDetail.sprints[0].name}
                    </h3>
                    <p className="sprint-dates">
                      Duration: {new Date(projectDetail.sprints[0].startDate).toLocaleDateString()} - {new Date(projectDetail.sprints[0].endDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    {projectDetail.sprints[0].status === 'PLANNED' && (
                      <button className="btn btn-primary" onClick={() => handleStartSprint(projectDetail.sprints[0].id)}>
                        <Play size={14} /> Start Sprint
                      </button>
                    )}
                    {projectDetail.sprints[0].status === 'ACTIVE' && (
                      <button className="btn btn-success" onClick={() => handleCompleteSprint(projectDetail.sprints[0].id)}>
                        <CheckCircle size={14} /> Complete Sprint
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* KANBAN BOARD */}
              <div className="board-columns">
                {['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'].map(status => {
                  const filteredIssues = (projectDetail.issues || []).filter(i => {
                    // 1. Status check
                    if (i.status !== status) return false;
                    
                    // 2. Sprint check
                    if (selectedSprintFilter === 'backlog') {
                      if (i.sprintId) return false;
                    } else if (selectedSprintFilter !== 'all') {
                      if (i.sprintId !== selectedSprintFilter) return false;
                    }
                    
                    // 3. Priority check
                    if (selectedPriorityFilter !== 'ALL') {
                      if (i.priority !== selectedPriorityFilter) return false;
                    }
                    
                    // 4. Search check (title matching query)
                    if (searchQuery.trim()) {
                      const query = searchQuery.toLowerCase();
                      const matchTitle = i.title.toLowerCase().includes(query);
                      const matchDesc = (i.description || '').toLowerCase().includes(query);
                      if (!matchTitle && !matchDesc) return false;
                    }
                    
                    return true;
                  });
                  return (
                    <div 
                      key={status} 
                      className="board-col"
                      onDragOver={e => handleDragOver(e, status)}
                      onDragLeave={handleDragLeave}
                      onDrop={e => handleDrop(e, status)}
                    >
                      <div className="col-header">
                        <span className="col-title">{status.replace('_', ' ')}</span>
                        <span className="col-count">{filteredIssues.length}</span>
                      </div>
                      <div className={`col-cards ${dragOverCol === status ? 'drag-over' : ''}`}>
                        {filteredIssues.map(issue => (
                          <div 
                            key={issue.id} 
                            className="card-item"
                            draggable
                            onDragStart={e => handleDragStart(e, issue.id)}
                            onClick={() => { 
                              setSelectedIssue(issue); 
                              setEditIssueTitle(issue.title);
                              setEditIssueDesc(issue.description || '');
                              setEditIssuePriority(issue.priority);
                              setEditIssueAssignee(issue.assigneeId || '');
                              setEditIssueSprint(issue.sprintId || '');
                              setIsEditingIssue(false);
                              setShowIssueDetailModal(true); 
                            }}
                          >
                            <h4 className="card-title">{issue.title}</h4>
                            <div className="card-footer">
                              <span className={`priority-tag ${issue.priority.toLowerCase()}`}>
                                {issue.priority}
                              </span>
                              {issue.assigneeImageUrl && (
                                <img 
                                  src={issue.assigneeImageUrl} 
                                  alt={issue.assigneeName} 
                                  className="user-avatar" 
                                  style={{ width: 24, height: 24 }}
                                  title={`Assigned to ${issue.assigneeName}`}
                                />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        )}
      </main>

      {/* --- NEW PROJECT MODAL --- */}
      {showNewProjModal && (
        <div className="modal-overlay">
          <form className="modal-content" onSubmit={handleCreateProject}>
            <h3>Create New Project</h3>
            <div className="form-group">
              <label>Project Name</label>
              <input 
                type="text" 
                className="form-control" 
                value={newProjName}
                onChange={e => setNewProjName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Project Key (eg: SCRUM, JIRA)</label>
              <input 
                type="text" 
                className="form-control" 
                value={newProjKey}
                onChange={e => setNewProjKey(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea 
                className="form-control" 
                rows="3"
                value={newProjDesc}
                onChange={e => setNewProjDesc(e.target.value)}
              />
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowNewProjModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Create</button>
            </div>
          </form>
        </div>
      )}

      {/* --- NEW SPRINT MODAL --- */}
      {showNewSprintModal && (
        <div className="modal-overlay">
          <form className="modal-content" onSubmit={handleCreateSprint}>
            <h3>Add New Sprint</h3>
            <div className="form-group">
              <label>Sprint Name</label>
              <input 
                type="text" 
                className="form-control" 
                value={newSprintName}
                onChange={e => setNewSprintName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Start Date</label>
              <input 
                type="date" 
                className="form-control" 
                value={newSprintStart}
                onChange={e => setNewSprintStart(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>End Date</label>
              <input 
                type="date" 
                className="form-control" 
                value={newSprintEnd}
                onChange={e => setNewSprintEnd(e.target.value)}
                required
              />
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowNewSprintModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Create</button>
            </div>
          </form>
        </div>
      )}

      {/* --- NEW ISSUE MODAL --- */}
      {showNewIssueModal && (
        <div className="modal-overlay">
          <form className="modal-content" onSubmit={handleCreateIssue}>
            <h3>Create Issue</h3>
            <div className="form-group">
              <label>Title</label>
              <input 
                type="text" 
                className="form-control" 
                value={newIssueTitle}
                onChange={e => setNewIssueTitle(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea 
                className="form-control" 
                rows="3"
                value={newIssueDesc}
                onChange={e => setNewIssueDesc(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Priority</label>
              <select 
                className="form-control" 
                value={newIssuePriority}
                onChange={e => setNewIssuePriority(e.target.value)}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
            <div className="form-group">
              <label>Assignee</label>
              <select 
                className="form-control" 
                value={newIssueAssignee}
                onChange={e => setNewIssueAssignee(e.target.value)}
              >
                <option value="">Unassigned</option>
                {usersList.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Sprint (Optional)</label>
              <select 
                className="form-control" 
                value={newIssueSprint}
                onChange={e => setNewIssueSprint(e.target.value)}
              >
                <option value="">Backlog</option>
                {(projectDetail.sprints || []).map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
                ))}
              </select>
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowNewIssueModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Create</button>
            </div>
          </form>
        </div>
      )}

      {/* --- ISSUE DETAIL MODAL --- */}
      {showIssueDetailModal && selectedIssue && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '650px' }}>
            {isEditingIssue ? (
              <form onSubmit={handleUpdateIssueDetails}>
                <span className="project-key" style={{ marginBottom: '0.8rem' }}>Editing {selectedIssue.id}</span>
                <div className="form-group" style={{ marginTop: '0.5rem' }}>
                  <label>Title</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={editIssueTitle} 
                    onChange={e => setEditIssueTitle(e.target.value)} 
                    required 
                  />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', margin: '1.5rem 0' }}>
                  <div>
                    <h5 style={{ color: 'var(--text-secondary)', marginBottom: '0.4rem', fontSize: '0.85rem' }}>Description</h5>
                    <textarea 
                      className="form-control" 
                      rows="8" 
                      value={editIssueDesc} 
                      onChange={e => setEditIssueDesc(e.target.value)} 
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                      <h5 style={{ color: 'var(--text-secondary)', marginBottom: '0.2rem', fontSize: '0.85rem' }}>Priority</h5>
                      <select 
                        className="form-control" 
                        value={editIssuePriority} 
                        onChange={e => setEditIssuePriority(e.target.value)}
                      >
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="URGENT">Urgent</option>
                      </select>
                    </div>
                    <div>
                      <h5 style={{ color: 'var(--text-secondary)', marginBottom: '0.2rem', fontSize: '0.85rem' }}>Assignee</h5>
                      <select 
                        className="form-control" 
                        value={editIssueAssignee} 
                        onChange={e => setEditIssueAssignee(e.target.value)}
                      >
                        <option value="">Unassigned</option>
                        {usersList.map(u => (
                          <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <h5 style={{ color: 'var(--text-secondary)', marginBottom: '0.2rem', fontSize: '0.85rem' }}>Sprint</h5>
                      <select 
                        className="form-control" 
                        value={editIssueSprint} 
                        onChange={e => setEditIssueSprint(e.target.value)}
                      >
                        <option value="">Backlog</option>
                        {(projectDetail.sprints || []).map(s => (
                          <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="form-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setIsEditingIssue(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Save Changes</button>
                </div>
              </form>
            ) : (
              <>
                <span className="project-key" style={{ marginBottom: '0.8rem' }}>{selectedIssue.id}</span>
                <h3>{selectedIssue.title}</h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', margin: '1.5rem 0' }}>
                  <div>
                    <h5 style={{ color: 'var(--text-secondary)', marginBottom: '0.4rem', fontSize: '0.85rem' }}>Description</h5>
                    <p style={{ color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: '1.4', background: 'rgba(0,0,0,0.1)', padding: '0.8rem', borderRadius: '4px', whiteSpace: 'pre-wrap', marginBottom: '1.5rem' }}>
                      {selectedIssue.description || 'No description provided.'}
                    </p>

                    <h5 style={{ color: 'var(--text-secondary)', marginBottom: '0.6rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <MessageSquare size={14} /> Discussions ({comments.length})
                    </h5>

                    {/* Comments list */}
                    <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1rem', paddingRight: '0.4rem' }}>
                      {commentsLoading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
                          <Loader2 className="animate-spin" size={20} color="var(--primary)" />
                        </div>
                      ) : comments.length === 0 ? (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.5rem 0' }}>No comments yet. Start the conversation!</p>
                      ) : (
                        comments.map(c => (
                          <div key={c.id} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', background: 'rgba(255, 255, 255, 0.02)', padding: '0.6rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
                            <img src={c.userImageUrl || 'https://avatar.iran.liara.run/public/girl'} alt={c.userName} className="user-avatar" style={{ width: 24, height: 24, flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-primary)' }}>{c.userName}</span>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(c.createdAt).toLocaleDateString()}</span>
                              </div>
                              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4', wordBreak: 'break-word' }}>{c.content}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Comment Form */}
                    <form onSubmit={handleAddComment} style={{ display: 'flex', gap: '0.5rem' }}>
                      <input 
                        type="text" 
                        placeholder="Write a comment..." 
                        className="form-control" 
                        style={{ padding: '0.5rem 0.8rem', fontSize: '0.85rem' }}
                        value={newCommentText}
                        onChange={e => setNewCommentText(e.target.value)}
                        required
                      />
                      <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                        Send
                      </button>
                    </form>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                      <h5 style={{ color: 'var(--text-secondary)', marginBottom: '0.2rem', fontSize: '0.85rem' }}>Status</h5>
                      <select 
                        className="form-control" 
                        value={selectedIssue.status}
                        onChange={e => handleUpdateIssueStatus(selectedIssue.id, e.target.value)}
                      >
                        <option value="TODO">To Do</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="IN_REVIEW">In Review</option>
                        <option value="DONE">Done</option>
                      </select>
                    </div>
                    <div>
                      <h5 style={{ color: 'var(--text-secondary)', marginBottom: '0.2rem', fontSize: '0.85rem' }}>Priority</h5>
                      <span className={`priority-tag ${selectedIssue.priority.toLowerCase()}`} style={{ display: 'inline-block', marginTop: '0.2rem' }}>
                        {selectedIssue.priority}
                      </span>
                    </div>
                    <div>
                      <h5 style={{ color: 'var(--text-secondary)', marginBottom: '0.2rem', fontSize: '0.85rem' }}>Assignee</h5>
                      <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                        {selectedIssue.assigneeImageUrl ? (
                          <>
                            <img src={selectedIssue.assigneeImageUrl} className="user-avatar" style={{ width: 24, height: 24 }} alt="" />
                            <span>{selectedIssue.assigneeName}</span>
                          </>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <h5 style={{ color: 'var(--text-secondary)', marginBottom: '0.2rem', fontSize: '0.85rem' }}>Reporter</h5>
                      <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                        <img src={selectedIssue.reporterImageUrl || 'https://avatar.iran.liara.run/public/girl'} className="user-avatar" style={{ width: 24, height: 24 }} alt="" />
                        <span>{selectedIssue.reporterName}</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="form-actions">
                  <button className="btn btn-primary" onClick={() => setIsEditingIssue(true)}>Edit Details</button>
                  <button className="btn btn-secondary btn-danger" onClick={() => handleDeleteIssue(selectedIssue.id)}>
                    <Trash2 size={14} /> Delete
                  </button>
                  <button className="btn btn-secondary" onClick={() => setShowIssueDetailModal(false)}>Close</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
