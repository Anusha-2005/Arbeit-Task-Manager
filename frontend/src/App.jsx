import React, { useState, useEffect } from 'react';
import { 
  FolderPlus, Plus, Calendar, CheckSquare, 
  Trash2, LogOut, Loader2, ArrowLeft,
  ChevronRight, AlertCircle, Play, CheckCircle,
  Bell, MessageSquare, Sun, Moon, Sparkles
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
  const [loginPassword, setLoginPassword] = useState('');
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  
  // Profile editing states
  const [profileName, setProfileName] = useState('');
  const [profileAvatar, setProfileAvatar] = useState('');
  const [profilePassword, setProfilePassword] = useState('');
  const [selectedAnalyticsProjectId, setSelectedAnalyticsProjectId] = useState('all');
  
  const [showNewProjModal, setShowNewProjModal] = useState(false);
  const [newProjName, setNewProjName] = useState('');
  const [newProjDesc, setNewProjDesc] = useState('');

  const [showNewSprintModal, setShowNewSprintModal] = useState(false);
  const [newSprintName, setNewSprintName] = useState('');
  const [newSprintStart, setNewSprintStart] = useState('');
  const [newSprintEnd, setNewSprintEnd] = useState('');

  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [boardViewMode, setBoardViewMode] = useState('kanban'); // 'kanban' or 'calendar'
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const [showNewIssueModal, setShowNewIssueModal] = useState(false);
  const [newIssueTitle, setNewIssueTitle] = useState('');
  const [newIssueDesc, setNewIssueDesc] = useState('');
  const [newIssuePriority, setNewIssuePriority] = useState('MEDIUM');
  const [newIssueAssignee, setNewIssueAssignee] = useState('');
  const [newIssueSprint, setNewIssueSprint] = useState('');
  const [newIssueDueDate, setNewIssueDueDate] = useState('');

  const [showIssueDetailModal, setShowIssueDetailModal] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState(null);

  // Issue Detail edit states
  const [isEditingIssue, setIsEditingIssue] = useState(false);
  const [editIssueTitle, setEditIssueTitle] = useState('');
  const [editIssueDesc, setEditIssueDesc] = useState('');
  const [editIssuePriority, setEditIssuePriority] = useState('MEDIUM');
  const [editIssueAssignee, setEditIssueAssignee] = useState('');
  const [editIssueSprint, setEditIssueSprint] = useState('');
  const [editIssueDueDate, setEditIssueDueDate] = useState('');
  const [myAssignedIssues, setMyAssignedIssues] = useState([]);
  const [newIssueEffort, setNewIssueEffort] = useState(1);
  const [editIssueEffort, setEditIssueEffort] = useState(1);

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

  // UI/UX Enhancements States
  const [toasts, setToasts] = useState([]);
  const [draggingIssueId, setDraggingIssueId] = useState(null);
  const [enabledWidgets, setEnabledWidgets] = useState({
    summary: true,
    priorities: true,
    completion: true
  });
  const [tourStep, setTourStep] = useState(null);
  const [boardLoading, setBoardLoading] = useState(false);

  // --- API FETCH HELPER ---
  const fetchApi = async (endpoint, options = {}) => {
    const activeToken = localStorage.getItem('token') || token;
    const headers = {
      'Content-Type': 'application/json',
      ...(activeToken ? { 'Authorization': `Bearer ${activeToken}` } : {})
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

  // Toast notifications helper
  const showToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Onboarding tour trigger
  useEffect(() => {
    if (user) {
      const tourDone = localStorage.getItem('tour_completed');
      if (!tourDone) {
        setTourStep(1);
      }
    } else {
      setTourStep(null);
    }
  }, [user]);

  // Load projects and users list
  const loadDashboardData = async () => {
    try {
      const [projData, usersData, assignedIssuesData] = await Promise.all([
        fetchApi('/projects'),
        fetchApi('/users'),
        fetchApi('/issues/assigned')
      ]);
      setProjects(projData);
      setUsersList(usersData);
      setMyAssignedIssues(assignedIssuesData);
    } catch (err) {
      showToast('Error loading dashboard: ' + err.message, 'danger');
    }
  };

  // Card-on-Card Drop Vertical Reordering
  const handleDragOverCard = (e) => {
    e.preventDefault();
  };

  const handleDropOnCard = async (e, targetIssue) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverCol(null);
    if (!draggingIssueId || draggingIssueId === targetIssue.id) return;

    const list = [...(projectDetail.issues || [])];
    const sourceIndex = list.findIndex(i => i.id === draggingIssueId);
    const targetIndex = list.findIndex(i => i.id === targetIssue.id);
    if (sourceIndex === -1 || targetIndex === -1) return;

    const sourceIssue = { ...list[sourceIndex], status: targetIssue.status };
    
    list.splice(sourceIndex, 1);
    
    const newTargetIndex = list.findIndex(i => i.id === targetIssue.id);
    list.splice(newTargetIndex, 0, sourceIssue);

    const columnIssues = list.filter(i => i.status === targetIssue.status);
    const updatedIssues = columnIssues.map((issue, idx) => ({
      id: issue.id,
      status: issue.status,
      order: idx
    }));

    // Optimistic UI updates
    setProjectDetail(prev => ({
      ...prev,
      issues: prev.issues.map(i => {
        const match = updatedIssues.find(up => up.id === i.id);
        if (match) return { ...i, status: match.status, order: match.order };
        if (i.id === draggingIssueId) return { ...i, status: targetIssue.status };
        return i;
      })
    }));

    try {
      await fetchApi('/issues/reorder', {
        method: 'PATCH',
        body: JSON.stringify({ issues: updatedIssues })
      });
      showToast('Task reordered', 'success');
      loadProjectDetail(selectedProjectId);
    } catch (err) {
      showToast('Failed to reorder: ' + err.message, 'danger');
      loadProjectDetail(selectedProjectId);
    }
  };

  // Load individual project details (sprints + issues)
  const loadProjectDetail = async (id) => {
    setBoardLoading(true);
    try {
      const data = await fetchApi(`/projects/${id}`);
      setProjectDetail(data);
    } catch (err) {
      showToast('Error loading project: ' + err.message, 'danger');
    } finally {
      setBoardLoading(false);
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
      showToast('Failed to post comment: ' + err.message, 'danger');
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
    if (!loginEmail || !loginPassword) return;
    if (authMode === 'register' && !loginName) {
      showToast('Name is required for registration', 'warning');
      return;
    }
    setLoading(true);
    try {
      const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';
      const body = authMode === 'login' 
        ? { email: loginEmail, password: loginPassword }
        : { email: loginEmail, name: loginName, password: loginPassword };

      const data = await fetchApi(endpoint, {
        method: 'POST',
        body: JSON.stringify(body)
      });
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
      
      // Load dashboard data synchronously using the new token
      await loadDashboardData();
      
      showToast(authMode === 'login' ? 'Logged in successfully' : 'Account created', 'success');
    } catch (err) {
      showToast((authMode === 'login' ? 'Login failed: ' : 'Registration failed: ') + err.message, 'danger');
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

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!profileName.trim()) {
      showToast('Name cannot be blank', 'warning');
      return;
    }
    setLoading(true);
    try {
      const data = await fetchApi('/users/profile', {
        method: 'PUT',
        body: JSON.stringify({
          name: profileName,
          imageUrl: profileAvatar,
          password: profilePassword || undefined
        })
      });
      setUser(data.user);
      showToast('Profile updated successfully', 'success');
      setActiveView('dashboard');
    } catch (err) {
      showToast('Failed to update profile: ' + err.message, 'danger');
    } finally {
      setLoading(false);
    }
  };

  // Create Project
  const handleCreateProject = async (e) => {
    e.preventDefault();
    const generatedKey = newProjName
      .split(' ')
      .filter(word => word.trim().length > 0)
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 5);

    const projectKey = generatedKey.length > 1 ? generatedKey : newProjName.slice(0, 4).toUpperCase();
    const finalKey = projectKey || 'PROJ';

    try {
      await fetchApi('/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: newProjName,
          key: finalKey,
          description: newProjDesc
        })
      });
      setShowNewProjModal(false);
      setNewProjName('');
      setNewProjDesc('');
      loadDashboardData();
      showToast('Project created successfully', 'success');
    } catch (err) {
      showToast('Failed to create project: ' + err.message, 'danger');
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
      showToast('Phase created successfully', 'success');
    } catch (err) {
      showToast('Failed to create phase: ' + err.message, 'danger');
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
          dueDate: newIssueDueDate || null,
          estimatedEffort: newIssueEffort,
          projectId: selectedProjectId
        })
      });
      setShowNewIssueModal(false);
      setNewIssueTitle('');
      setNewIssueDesc('');
      setNewIssuePriority('MEDIUM');
      setNewIssueAssignee('');
      setNewIssueSprint('');
      setNewIssueDueDate('');
      setNewIssueEffort(1);
      loadProjectDetail(selectedProjectId);
      showToast('Task created successfully', 'success');
    } catch (err) {
      showToast('Failed to create task: ' + err.message, 'danger');
    }
  };

  // Delete Project
  const handleDeleteProject = async (projId, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this project?')) return;
    try {
      await fetchApi(`/projects/${projId}`, { method: 'DELETE' });
      loadDashboardData();
      showToast('Project deleted successfully', 'info');
    } catch (err) {
      showToast('Failed to delete project: ' + err.message, 'danger');
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
      showToast('Phase started successfully', 'success');
    } catch (err) {
      showToast('Failed to start phase: ' + err.message, 'danger');
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
      showToast('Phase completed successfully', 'success');
    } catch (err) {
      showToast('Failed to complete phase: ' + err.message, 'danger');
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
      showToast('Task status updated', 'info');
      if (newStatus === 'DONE') {
        confetti({ particleCount: 50, spread: 60 });
      }
    } catch (err) {
      showToast('Failed to update: ' + err.message, 'danger');
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
          sprintId: editIssueSprint || null,
          dueDate: editIssueDueDate || null,
          estimatedEffort: editIssueEffort
        })
      });
      
      setSelectedIssue(updatedData);
      setIsEditingIssue(false);
      loadProjectDetail(selectedProjectId);
      showToast('Task details saved', 'success');
    } catch (err) {
      showToast('Failed to save: ' + err.message, 'danger');
    }
  };

  // Delete Issue
  const handleDeleteIssue = async (issueId) => {
    if (!confirm('Are you sure you want to delete this issue?')) return;
    try {
      await fetchApi(`/issues/${issueId}`, { method: 'DELETE' });
      setShowIssueDetailModal(false);
      loadProjectDetail(selectedProjectId);
      showToast('Task deleted successfully', 'info');
    } catch (err) {
      showToast('Failed to delete: ' + err.message, 'danger');
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
      showToast('Failed to move: ' + err.message, 'danger');
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
          <p>Manage tasks, boards, and team productivity in real-time.</p>
          
          {authMode === 'register' && (
            <div className="form-group">
              <input 
                type="text" 
                placeholder="Full Name" 
                className="form-control"
                value={loginName}
                onChange={e => setLoginName(e.target.value)}
                required
              />
            </div>
          )}
          
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

          <div className="form-group">
            <input 
              type="password" 
              placeholder="Password" 
              className="form-control"
              value={loginPassword}
              onChange={e => setLoginPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
            {authMode === 'login' ? 'Sign In' : 'Create Account'}
          </button>

          <p style={{ marginTop: '1.5rem', fontSize: '0.85rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            {authMode === 'login' ? (
              <>
                Don't have an account?{' '}
                <span 
                  style={{ color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => setAuthMode('register')}
                >
                  Sign Up
                </span>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <span 
                  style={{ color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => setAuthMode('login')}
                >
                  Log In
                </span>
              </>
            )}
          </p>
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

          <div 
            className="user-profile" 
            style={{ cursor: 'pointer' }}
            onClick={() => {
              setProfileName(user.name);
              setProfileAvatar(user.imageUrl || '');
              setProfilePassword('');
              setActiveView('profile');
              setSelectedProjectId(null);
            }}
            title="View Profile"
          >
            <img src={user.imageUrl} alt={user.name} className="user-avatar" />
            <span className="user-name">{user.name}</span>
          </div>
          <button 
            className="btn btn-secondary" 
            onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')} 
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            style={{ padding: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
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

            {/* Dashboard Widgets Settings toggles */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.02)', padding: '0.8rem 1.2rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', width: 'fit-content' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '500' }}>Dashboard Widgets:</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={enabledWidgets.summary} onChange={e => setEnabledWidgets(prev => ({ ...prev, summary: e.target.checked }))} /> Summary
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={enabledWidgets.priorities} onChange={e => setEnabledWidgets(prev => ({ ...prev, priorities: e.target.checked }))} /> Priority Breakdown
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={enabledWidgets.completion} onChange={e => setEnabledWidgets(prev => ({ ...prev, completion: e.target.checked }))} /> Completion Rate
              </label>
            </div>

            {/* Widgets Grid */}
            <div className="widgets-grid" style={{ marginBottom: '2rem' }}>
              {enabledWidgets.summary && (
                <div className="widget-card">
                  <h4>Summary Metrics</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                    <div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>TOTAL PROJECTS</p>
                      <p className="widget-stat">{projects.length}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>UNREAD ALERTS</p>
                      <p className="widget-stat" style={{ background: 'linear-gradient(135deg, var(--danger) 0%, var(--warning) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        {notifications.filter(n => !n.isRead).length}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {enabledWidgets.priorities && (() => {
                let low = 0, medium = 0, high = 0, urgent = 0;
                const list = projectDetail?.issues || [];
                list.forEach(i => {
                  if (i.priority === 'LOW') low++;
                  else if (i.priority === 'MEDIUM') medium++;
                  else if (i.priority === 'HIGH') high++;
                  else if (i.priority === 'URGENT') urgent++;
                });
                return (
                  <div className="widget-card">
                    <h4>Task Priorities {projectDetail ? `(${projectDetail.key})` : '(Enter a Project to view)'}</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.2rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <span>Urgent: {urgent}</span>
                        <span>High: {high}</span>
                        <span>Med: {medium}</span>
                        <span>Low: {low}</span>
                      </div>
                      <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', marginTop: '0.4rem' }}>
                        <div style={{ width: `${(urgent / (urgent+high+medium+low || 1))*100}%`, background: 'var(--danger)' }} />
                        <div style={{ width: `${(high / (urgent+high+medium+low || 1))*100}%`, background: 'var(--warning)' }} />
                        <div style={{ width: `${(medium / (urgent+high+medium+low || 1))*100}%`, background: 'var(--primary)' }} />
                        <div style={{ width: `${(low / (urgent+high+medium+low || 1))*100}%`, background: 'var(--success)' }} />
                      </div>
                    </div>
                  </div>
                );
              })()}

              {enabledWidgets.completion && (() => {
                const list = projectDetail?.issues || [];
                const total = list.length;
                const done = list.filter(i => i.status === 'DONE').length;
                const rate = total > 0 ? Math.round((done / total) * 100) : 0;
                return (
                  <div className="widget-card">
                    <h4>Completion Rate {projectDetail ? `(${projectDetail.key})` : ''}</h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.4rem' }}>
                      <p className="widget-stat" style={{ fontSize: '2.4rem' }}>{rate}%</p>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                          {done} of {total} tasks completed
                        </p>
                        <div className="progress-bar-container">
                          <div className="progress-bar-fill" style={{ width: `${rate}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* --- AI WORKLOAD COACH PANEL --- */}
            <div className="ai-coach-section" style={{ background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%)', border: '1px solid rgba(14, 165, 233, 0.2)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '2rem', boxShadow: 'var(--shadow-premium)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.1, pointerEvents: 'none' }}>
                <Sparkles size={120} color="var(--primary)" />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '1.2rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Sparkles size={18} style={{ color: '#f59e0b' }} /> ✨ AI Workload & Deadline Coach
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                
                {/* PERSONAL TASK RECOMMENDATIONS */}
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.2rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: '600', marginBottom: '0.8rem', color: 'var(--text-secondary)' }}>
                    🎯 Your Priority Recommendations
                  </h4>
                  {(() => {
                    if (myAssignedIssues.length === 0) {
                      return (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
                          No pending tasks assigned to you. Take a task from a project board to begin!
                        </p>
                      );
                    }

                    const scoredTasks = myAssignedIssues.map(issue => {
                      let score = 0;
                      let deadlineText = '';
                      let isOverdue = false;
                      if (issue.dueDate) {
                        const due = new Date(issue.dueDate);
                        const now = new Date();
                        const diffTime = due.getTime() - now.getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        
                        if (diffDays < 0) {
                          score += 100;
                          isOverdue = true;
                          deadlineText = `Overdue by ${Math.abs(diffDays)} day(s)`;
                        } else if (diffDays === 0) {
                          score += 90;
                          deadlineText = 'Due TODAY';
                        } else if (diffDays === 1) {
                          score += 80;
                          deadlineText = 'Due tomorrow';
                        } else if (diffDays <= 3) {
                          score += 50;
                          deadlineText = `Due in ${diffDays} days`;
                        } else if (diffDays <= 7) {
                          score += 20;
                          deadlineText = `Due in ${diffDays} days`;
                        } else {
                          score += 5;
                          deadlineText = `Due in ${diffDays} days`;
                        }
                      } else {
                        deadlineText = 'No deadline set';
                      }

                      if (issue.priority === 'URGENT') score += 40;
                      else if (issue.priority === 'HIGH') score += 20;
                      else if (issue.priority === 'MEDIUM') score += 10;
                      
                      if (issue.status === 'IN_PROGRESS') score += 15;
                      else if (issue.status === 'IN_REVIEW') score += 5;
                      else if (issue.status === 'TODO') score += 10;

                      const effort = issue.estimatedEffort || 1;
                      score += (5 / effort); 

                      return { ...issue, score, deadlineText, isOverdue };
                    });

                    scoredTasks.sort((a, b) => b.score - a.score);
                    const topTask = scoredTasks[0];
                    const runnerUps = scoredTasks.slice(1, 4);

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ background: 'rgba(14, 165, 233, 0.05)', border: '1px solid rgba(14, 165, 233, 0.15)', borderRadius: 'var(--radius-sm)', padding: '0.8rem 1rem' }}>
                          <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--primary)', fontWeight: '700', letterSpacing: '0.05em' }}>
                            🏆 Recommended Next Action
                          </span>
                          <h5 style={{ fontSize: '0.95rem', fontWeight: '600', margin: '0.2rem 0 0.4rem 0', color: 'var(--text-primary)' }}>
                            {topTask.title} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>({topTask.projectKey})</span>
                          </h5>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                            Why? This is an <strong>{topTask.priority}</strong> priority task in <strong>{topTask.status.replace('_', ' ')}</strong> status, marked as <strong>{topTask.deadlineText}</strong> (Effort: {topTask.estimatedEffort || 1} story points).
                          </p>
                          <span 
                            style={{ fontSize: '0.75rem', color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline', marginTop: '0.4rem', display: 'inline-block' }}
                            onClick={() => { setSelectedProjectId(topTask.projectId); setActiveView('board'); }}
                          >
                            Jump to board &rarr;
                          </span>
                        </div>

                        {runnerUps.length > 0 && (
                          <div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600', display: 'block', marginBottom: '0.4rem' }}>
                              Next in Queue:
                            </span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              {runnerUps.map((t, idx) => (
                                <div 
                                  key={t.id} 
                                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)', padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.02)', fontSize: '0.8rem', cursor: 'pointer' }}
                                  onClick={() => { setSelectedProjectId(t.projectId); setActiveView('board'); }}
                                >
                                  <span style={{ color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                                    {idx + 2}. {t.title}
                                  </span>
                                  <span style={{ fontSize: '0.7rem', color: t.priority === 'URGENT' ? 'var(--danger)' : t.priority === 'HIGH' ? 'var(--warning)' : 'var(--text-muted)' }}>
                                    {t.deadlineText}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '0.6rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          You have <strong>{myAssignedIssues.length} pending task(s)</strong> assigned to you.
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* PROJECT-LEVEL DIAGNOSTICS */}
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.2rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: '600', marginBottom: '0.8rem', color: 'var(--text-secondary)' }}>
                    💡 Project Health & Schedule Insights
                  </h4>
                  {(() => {
                    const recommendations = [];

                    projects.forEach(p => {
                      const st = p.stats || { TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0 };
                      const unresolved = (st.TODO || 0) + (st.IN_PROGRESS || 0) + (st.IN_REVIEW || 0);
                      const total = unresolved + (st.DONE || 0);
                      const completionRate = total > 0 ? Math.round((st.DONE / total) * 100) : 0;

                      if (unresolved > 4) {
                        recommendations.push({
                          type: 'warning',
                          text: `High Workload Alert on project "${p.name}": There are ${unresolved} active unresolved tasks. Consider assigning them to other team members or splitting phases.`,
                          project: p
                        });
                      }

                      const sp = p.sprints || { PLANNED: 0, ACTIVE: 0, COMPLETED: 0 };
                      if (sp.PLANNED > 0 && sp.ACTIVE === 0) {
                        recommendations.push({
                          type: 'info',
                          text: `Schedule Optimization: "${p.name}" has planned phases but no active phase running. Start a phase to boost team momentum.`,
                          project: p
                        });
                      }

                      if (completionRate >= 60 && completionRate < 100 && unresolved > 0) {
                        recommendations.push({
                          type: 'success',
                          text: `Boost Velocity: "${p.name}" is ${completionRate}% complete! Prioritize the remaining ${unresolved} task(s) to close this development cycle.`,
                          project: p
                        });
                      }
                    });

                    if (recommendations.length === 0) {
                      return (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
                          All projects are healthy! Workloads are optimal, and no immediate schedule adjustments are needed.
                        </p>
                      );
                    }

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        {recommendations.slice(0, 3).map((rec, i) => (
                          <div key={i} style={{ display: 'flex', gap: '0.6rem', background: 'rgba(255,255,255,0.01)', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)', borderLeft: `3px solid ${rec.type === 'warning' ? '#ef4444' : rec.type === 'success' ? '#10b981' : '#0ea5e9'}`, alignItems: 'flex-start' }}>
                            <div style={{ fontSize: '0.95rem', marginTop: '-2px' }}>
                              {rec.type === 'warning' ? '⚠️' : rec.type === 'success' ? '🎯' : '💡'}
                            </div>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontSize: '0.8rem', color: 'var(--text-primary)', margin: 0, lineHeight: '1.4' }}>{rec.text}</p>
                              <span 
                                style={{ fontSize: '0.7rem', color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline', marginTop: '0.2rem', display: 'inline-block' }}
                                onClick={() => { setSelectedProjectId(rec.project.id); setActiveView('board'); }}
                              >
                                Go to Project Board &rarr;
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

              </div>
            </div>

            {/* --- DASHBOARD ANALYTICS SECTION --- */}
            <div className="analytics-section" style={{ background: 'var(--card-bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: '1.5rem', marginBottom: '2rem', boxShadow: 'var(--shadow-premium)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '700', margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  📊 Analytics Overview
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Project:</span>
                  <select 
                    className="form-control"
                    style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                    value={selectedAnalyticsProjectId}
                    onChange={e => setSelectedAnalyticsProjectId(e.target.value)}
                  >
                    <option value="all">All Projects (Aggregated)</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.key})</option>
                    ))}
                  </select>
                </div>
              </div>

              {(() => {
                let todo = 0, inProgress = 0, inReview = 0, done = 0;
                let plannedPhases = 0, activePhases = 0, completedPhases = 0;

                if (selectedAnalyticsProjectId === 'all') {
                  projects.forEach(p => {
                    const st = p.stats || { TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0 };
                    todo += st.TODO || 0;
                    inProgress += st.IN_PROGRESS || 0;
                    inReview += st.IN_REVIEW || 0;
                    done += st.DONE || 0;

                    const sp = p.sprints || { PLANNED: 0, ACTIVE: 0, COMPLETED: 0 };
                    plannedPhases += sp.PLANNED || 0;
                    activePhases += sp.ACTIVE || 0;
                    completedPhases += sp.COMPLETED || 0;
                  });
                } else {
                  const p = projects.find(proj => proj.id === selectedAnalyticsProjectId);
                  if (p) {
                    const st = p.stats || { TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0 };
                    todo = st.TODO || 0;
                    inProgress = st.IN_PROGRESS || 0;
                    inReview = st.IN_REVIEW || 0;
                    done = st.DONE || 0;

                    const sp = p.sprints || { PLANNED: 0, ACTIVE: 0, COMPLETED: 0 };
                    plannedPhases = sp.PLANNED || 0;
                    activePhases = sp.ACTIVE || 0;
                    completedPhases = sp.COMPLETED || 0;
                  }
                }

                const totalTasks = todo + inProgress + inReview + done;
                const totalPhases = plannedPhases + activePhases + completedPhases;

                if (totalTasks === 0 && totalPhases === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      No tasks or phases created yet. Create a project and add tasks to see metrics.
                    </div>
                  );
                }

                const todoPct = totalTasks > 0 ? Math.round((todo / totalTasks) * 100) : 0;
                const progressPct = totalTasks > 0 ? Math.round((inProgress / totalTasks) * 100) : 0;
                const reviewPct = totalTasks > 0 ? Math.round((inReview / totalTasks) * 100) : 0;
                const donePct = totalTasks > 0 ? Math.round((done / totalTasks) * 100) : 0;

                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                    
                    {/* Task Status Distribution Card */}
                    <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', padding: '1.2rem' }}>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: '600', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                        Task Status Distribution
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                            <span>To Do ({todo})</span>
                            <span>{todoPct}%</span>
                          </div>
                          <div className="progress-bar-container" style={{ height: '8px' }}>
                            <div className="progress-bar-fill" style={{ width: `${todoPct}%`, background: 'var(--text-muted)' }} />
                          </div>
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                            <span>In Progress ({inProgress})</span>
                            <span>{progressPct}%</span>
                          </div>
                          <div className="progress-bar-container" style={{ height: '8px' }}>
                            <div className="progress-bar-fill" style={{ width: `${progressPct}%`, background: 'var(--primary)' }} />
                          </div>
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                            <span>In Review ({inReview})</span>
                            <span>{reviewPct}%</span>
                          </div>
                          <div className="progress-bar-container" style={{ height: '8px' }}>
                            <div className="progress-bar-fill" style={{ width: `${reviewPct}%`, background: 'var(--warning)' }} />
                          </div>
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                            <span>Completed Tasks ({done})</span>
                            <span>{donePct}%</span>
                          </div>
                          <div className="progress-bar-container" style={{ height: '8px' }}>
                            <div className="progress-bar-fill" style={{ width: `${donePct}%`, background: 'var(--success)' }} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Phase Progress Card */}
                    <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', padding: '1.2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: '600', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                          Timeframe Phase Analytics
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.8rem', textAlign: 'center', marginBottom: '1rem' }}>
                          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.6rem', borderRadius: '4px' }}>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: 0 }}>PLANNED</p>
                            <p style={{ fontSize: '1.2rem', fontWeight: '700', margin: '0.2rem 0 0 0', color: 'var(--primary)' }}>{plannedPhases}</p>
                          </div>
                          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.6rem', borderRadius: '4px' }}>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: 0 }}>ACTIVE</p>
                            <p style={{ fontSize: '1.2rem', fontWeight: '700', margin: '0.2rem 0 0 0', color: 'var(--warning)' }}>{activePhases}</p>
                          </div>
                          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.6rem', borderRadius: '4px' }}>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: 0 }}>COMPLETED</p>
                            <p style={{ fontSize: '1.2rem', fontWeight: '700', margin: '0.2rem 0 0 0', color: 'var(--success)' }}>{completedPhases}</p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                          <span>Phase Completion Rate</span>
                          <span>{totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0}%</span>
                        </div>
                        <div className="progress-bar-container" style={{ height: '8px' }}>
                          <div className="progress-bar-fill" style={{ width: `${totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0}%`, background: 'var(--success)' }} />
                        </div>
                      </div>
                    </div>

                  </div>
                );
              })()}
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
        ) : activeView === 'profile' ? (
          // --- PROFILE VIEW ---
          <div style={{ maxWidth: '600px', margin: '2rem auto', padding: '2rem', background: 'var(--card-bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-premium)' }}>
            <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: '700', background: 'linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>My Profile</h2>
            
            <form onSubmit={handleUpdateProfile}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <img 
                  src={profileAvatar || 'https://avatar.iran.liara.run/public/girl'} 
                  alt="Profile Avatar" 
                  style={{ width: '80px', height: '80px', borderRadius: '50%', border: '3px solid var(--primary)', objectFit: 'cover' }} 
                />
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                  {['girl', 'boy', 'avatar1', 'avatar2'].map((preset) => {
                    const presetUrl = `https://avatar.iran.liara.run/public/${preset === 'girl' ? 'girl' : preset === 'boy' ? 'boy' : preset === 'avatar1' ? '45' : '72'}`;
                    return (
                      <button 
                        key={preset}
                        type="button" 
                        className="btn btn-secondary" 
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', border: profileAvatar === presetUrl ? '1px solid var(--primary)' : '1px solid transparent' }}
                        onClick={() => setProfileAvatar(presetUrl)}
                      >
                        {preset.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="form-group">
                <label>Email Address (Cannot be changed)</label>
                <input 
                  type="email" 
                  className="form-control" 
                  value={user.email} 
                  disabled 
                  style={{ opacity: 0.6, cursor: 'not-allowed' }}
                />
              </div>

              <div className="form-group">
                <label>Full Name</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={profileName} 
                  onChange={e => setProfileName(e.target.value)} 
                  required 
                />
              </div>

              <div className="form-group">
                <label>Profile Image URL</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={profileAvatar} 
                  onChange={e => setProfileAvatar(e.target.value)} 
                />
              </div>

              <div className="form-group">
                <label>New Password (Leave blank to keep unchanged)</label>
                <input 
                  type="password" 
                  className="form-control" 
                  placeholder="••••••••" 
                  value={profilePassword} 
                  onChange={e => setProfilePassword(e.target.value)} 
                />
              </div>

              <div className="form-actions" style={{ marginTop: '2rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setActiveView('dashboard')}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        ) : (
          // --- BOARD VIEW ---
          projectDetail && (
            <div className="board-container">
              <div className="board-header">
                <div className="board-info">
                  <h2>{projectDetail.name} <span className="project-key" style={{ marginBottom: 0 }}>{projectDetail.key}</span></h2>
                  <p>{projectDetail.description}</p>
                  
                  {/* Project Progress Meter */}
                  {(() => {
                    const total = projectDetail.issues?.length || 0;
                    const done = projectDetail.issues?.filter(i => i.status === 'DONE').length || 0;
                    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                    return (
                      <div style={{ marginTop: '0.8rem', width: '280px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                          <span>Project Progress</span>
                          <span>{pct}% ({done}/{total})</span>
                        </div>
                        <div className="progress-bar-container" style={{ height: '5px' }}>
                          <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ display: 'flex', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                    <button 
                      className={`btn ${boardViewMode === 'kanban' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '0.4rem 0.8rem', borderRadius: 0, fontSize: '0.85rem' }}
                      onClick={() => setBoardViewMode('kanban')}
                    >
                      Kanban
                    </button>
                    <button 
                      className={`btn ${boardViewMode === 'calendar' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '0.4rem 0.8rem', borderRadius: 0, fontSize: '0.85rem' }}
                      onClick={() => setBoardViewMode('calendar')}
                    >
                      Calendar
                    </button>
                  </div>
                  <button className="btn btn-secondary" onClick={() => setShowNewSprintModal(true)}>
                    <Calendar size={16} /> Add Phase
                  </button>
                  <button className="btn btn-primary" onClick={() => setShowNewIssueModal(true)}>
                    <Plus size={16} /> Create Task
                  </button>
                </div>
              </div>

              {/* FILTERS AND SEARCH */}
              <div className="board-filters" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', background: 'rgba(255, 255, 255, 0.03)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
                <div style={{ flex: '1', minWidth: '200px' }}>
                  <input 
                    type="text" 
                    placeholder="Search tasks by title/description..." 
                    className="form-control"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
                
                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Phase:</span>
                    <select 
                      className="form-control" 
                      style={{ padding: '0.4rem 0.8rem', width: 'auto', minWidth: '150px' }}
                      value={selectedSprintFilter}
                      onChange={e => setSelectedSprintFilter(e.target.value)}
                    >
                      <option value="all">All Phases</option>
                      <option value="backlog">Backlog (No Phase)</option>
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

                    {/* Phase Progress Bar */}
                    {(() => {
                      const activePhase = projectDetail.sprints[0];
                      const phaseTasks = projectDetail.issues?.filter(i => i.sprintId === activePhase.id) || [];
                      const phaseTotal = phaseTasks.length;
                      const phaseDone = phaseTasks.filter(i => i.status === 'DONE').length;
                      const phasePct = phaseTotal > 0 ? Math.round((phaseDone / phaseTotal) * 100) : 0;
                      return (
                        <div style={{ marginTop: '0.6rem', width: '220px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.15rem' }}>
                            <span>Phase Progress</span>
                            <span>{phasePct}% ({phaseDone}/{phaseTotal})</span>
                          </div>
                          <div className="progress-bar-container" style={{ height: '4px' }}>
                            <div className="progress-bar-fill" style={{ width: `${phasePct}%` }} />
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  <div>
                    {projectDetail.sprints[0].status === 'PLANNED' && (
                      <button className="btn btn-primary" onClick={() => handleStartSprint(projectDetail.sprints[0].id)}>
                        <Play size={14} /> Start Phase
                      </button>
                    )}
                    {projectDetail.sprints[0].status === 'ACTIVE' && (
                      <button className="btn btn-success" onClick={() => handleCompleteSprint(projectDetail.sprints[0].id)}>
                        <CheckCircle size={14} /> Complete Phase
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* KANBAN OR CALENDAR BOARD */}
              {boardViewMode === 'kanban' ? (
                <div className="board-columns">
                  {['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'].map(status => {
                    const filteredIssues = (projectDetail.issues || []).filter(i => {
                      if (i.status !== status) return false;
                      if (selectedSprintFilter === 'backlog') {
                        if (i.sprintId) return false;
                      } else if (selectedSprintFilter !== 'all') {
                        if (i.sprintId !== selectedSprintFilter) return false;
                      }
                      if (selectedPriorityFilter !== 'ALL') {
                        if (i.priority !== selectedPriorityFilter) return false;
                      }
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
                          {boardLoading ? (
                            <>
                              <div className="skeleton-card animate-pulse" />
                              <div className="skeleton-card animate-pulse" />
                            </>
                          ) : (
                            filteredIssues.map(issue => (
                              <div 
                                key={issue.id} 
                                className="card-item"
                                draggable
                                onDragStart={e => handleDragStart(e, issue.id)}
                                onDragOver={handleDragOverCard}
                                onDrop={e => handleDropOnCard(e, issue)}
                                onClick={() => { 
                                  setSelectedIssue(issue); 
                                  setEditIssueTitle(issue.title);
                                  setEditIssueDesc(issue.description || '');
                                  setEditIssuePriority(issue.priority);
                                  setEditIssueAssignee(issue.assigneeId || '');
                                  setEditIssueSprint(issue.sprintId || '');
                                  setEditIssueDueDate(issue.dueDate ? issue.dueDate.substring(0, 10) : '');
                                  setEditIssueEffort(issue.estimatedEffort || 1);
                                  setIsEditingIssue(false);
                                  setShowIssueDetailModal(true); 
                                }}
                              >
                                <h4 className="card-title">{issue.title}</h4>
                                <div className="card-footer">
                                  <span className={`priority-tag ${issue.priority.toLowerCase()}`}>
                                    {issue.priority}
                                  </span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                (() => {
                  const year = calendarMonth.getFullYear();
                  const month = calendarMonth.getMonth();
                  const firstDayIndex = new Date(year, month, 1).getDay();
                  const totalDays = new Date(year, month + 1, 0).getDate();
                  
                  const dayCells = [];
                  for (let i = 0; i < firstDayIndex; i++) {
                    dayCells.push(null);
                  }
                  for (let day = 1; day <= totalDays; day++) {
                    dayCells.push(new Date(year, month, day));
                  }

                  return (
                    <div className="calendar-view-container" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', boxShadow: 'var(--shadow-premium)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700' }}>
                          {calendarMonth.toLocaleString('default', { month: 'long' })} {year}
                        </h3>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                            onClick={() => setCalendarMonth(new Date(year, month - 1, 1))}
                          >
                            &larr; Previous
                          </button>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                            onClick={() => setCalendarMonth(new Date())}
                          >
                            Today
                          </button>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                            onClick={() => setCalendarMonth(new Date(year, month + 1, 1))}
                          >
                            Next &rarr;
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', textAlign: 'center', fontWeight: '600', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                          <div key={day} style={{ padding: '0.5rem 0' }}>{day}</div>
                        ))}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', minHeight: '360px' }}>
                        {dayCells.map((date, idx) => {
                          if (!date) {
                            return <div key={`empty-${idx}`} style={{ background: 'rgba(255,255,255,0.01)', borderRadius: 'var(--radius-sm)', border: '1px solid transparent' }} />;
                          }

                          const isToday = new Date().toDateString() === date.toDateString();
                          const dayTasks = (projectDetail.issues || []).filter(issue => {
                            if (!issue.dueDate) return false;
                            const issueDate = new Date(issue.dueDate);
                            return issueDate.getFullYear() === date.getFullYear() &&
                                   issueDate.getMonth() === date.getMonth() &&
                                   issueDate.getDate() === date.getDate();
                          });

                          return (
                            <div 
                              key={date.toISOString()} 
                              style={{ 
                                background: isToday ? 'rgba(14, 165, 233, 0.05)' : 'rgba(255,255,255,0.02)', 
                                border: isToday ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '0.6rem',
                                display: 'flex',
                                flexDirection: 'column',
                                minHeight: '80px',
                                transition: 'all 0.2s',
                                cursor: 'pointer'
                              }}
                              onClick={() => {
                                setNewIssueDueDate(date.toISOString().substring(0, 10));
                                setShowNewIssueModal(true);
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: isToday ? '700' : '500', color: isToday ? 'var(--primary)' : 'var(--text-secondary)' }}>
                                  {date.getDate()}
                                </span>
                                {dayTasks.length > 0 && (
                                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                    {dayTasks.length} task{dayTasks.length > 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                              
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', overflowY: 'auto', flex: 1, maxHeight: '80px' }}>
                                {dayTasks.map(issue => (
                                  <div 
                                    key={issue.id} 
                                    style={{ 
                                      fontSize: '0.75rem', 
                                      padding: '0.2rem 0.4rem', 
                                      borderRadius: '3px', 
                                      background: issue.priority === 'URGENT' ? 'rgba(239, 68, 68, 0.15)' : issue.priority === 'HIGH' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.05)',
                                      color: issue.priority === 'URGENT' ? 'var(--danger)' : issue.priority === 'HIGH' ? 'var(--warning)' : 'var(--text-primary)',
                                      borderLeft: `3px solid ${issue.priority === 'URGENT' ? 'var(--danger)' : issue.priority === 'HIGH' ? 'var(--warning)' : 'var(--text-secondary)'}`,
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis'
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedIssue(issue);
                                      setEditIssueTitle(issue.title);
                                      setEditIssueDesc(issue.description || '');
                                      setEditIssuePriority(issue.priority);
                                      setEditIssueAssignee(issue.assigneeId || '');
                                      setEditIssueSprint(issue.sprintId || '');
                                      setEditIssueDueDate(issue.dueDate ? issue.dueDate.substring(0, 10) : '');
                                      setEditIssueEffort(issue.estimatedEffort || 1);
                                      setIsEditingIssue(false);
                                      setShowIssueDetailModal(true);
                                    }}
                                    title={`${issue.title} (${issue.priority})`}
                                  >
                                    {issue.title}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()
              )}
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
            <h3>Add New Phase</h3>
            <div className="form-group">
              <label>Phase Name</label>
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
              <label>Phase (Optional)</label>
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
            <div className="form-group">
              <label>Due Date / Deadline</label>
              <input 
                type="date" 
                className="form-control" 
                value={newIssueDueDate}
                onChange={e => setNewIssueDueDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Estimated Effort (Story Points / Hours)</label>
              <input 
                type="number" 
                min="1"
                className="form-control" 
                value={newIssueEffort}
                onChange={e => setNewIssueEffort(parseInt(e.target.value) || 1)}
              />
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
                      <h5 style={{ color: 'var(--text-secondary)', marginBottom: '0.2rem', fontSize: '0.85rem' }}>Phase</h5>
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

                    <div>
                      <h5 style={{ color: 'var(--text-secondary)', marginBottom: '0.2rem', fontSize: '0.85rem' }}>Due Date</h5>
                      <input 
                        type="date" 
                        className="form-control" 
                        value={editIssueDueDate} 
                        onChange={e => setEditIssueDueDate(e.target.value)}
                      />
                    </div>

                    <div>
                      <h5 style={{ color: 'var(--text-secondary)', marginBottom: '0.2rem', fontSize: '0.85rem' }}>Estimated Effort</h5>
                      <input 
                        type="number" 
                        min="1"
                        className="form-control" 
                        value={editIssueEffort} 
                        onChange={e => setEditIssueEffort(parseInt(e.target.value) || 1)}
                      />
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
                      <h5 style={{ color: 'var(--text-secondary)', marginBottom: '0.2rem', fontSize: '0.85rem' }}>Due Date</h5>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        {selectedIssue.dueDate ? new Date(selectedIssue.dueDate).toLocaleDateString() : 'No deadline set'}
                      </span>
                    </div>

                    <div>
                      <h5 style={{ color: 'var(--text-secondary)', marginBottom: '0.2rem', fontSize: '0.85rem' }}>Estimated Effort</h5>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        {selectedIssue.estimatedEffort || 1} story points
                      </span>
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

      {/* --- TOAST CONTAINER --- */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast-item ${t.type}`}>
            {t.type === 'success' ? '✔️' : t.type === 'danger' ? '❌' : 'ℹ️'} {t.message}
          </div>
        ))}
      </div>

      {/* --- ONBOARDING TOUR --- */}
      {tourStep !== null && (
        <>
          <div className="tour-overlay" onClick={() => { localStorage.setItem('tour_completed', 'true'); setTourStep(null); }} />
          
          {tourStep === 1 && (
            <div className="tour-tooltip bottom" style={{ top: '220px', left: '60px' }}>
              <h4 style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '0.95rem' }}>Step 1: Create a Project</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                Start by creating your first project workspace. Click "Create Project" to get started.
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', width: '100%' }}>
                <button className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => { localStorage.setItem('tour_completed', 'true'); setTourStep(null); showToast('Tour skipped', 'info'); }}>Skip</button>
                <button className="btn btn-primary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => setTourStep(2)}>Next</button>
              </div>
            </div>
          )}
          
          {tourStep === 2 && (
            <div className="tour-tooltip bottom" style={{ top: '240px', right: '140px' }}>
              <h4 style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '0.95rem' }}>Step 2: Add Phases & Deadlines</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                Group tasks into specific timeframes. Click "Add Phase" to set start and end dates.
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', width: '100%' }}>
                <button className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => setTourStep(1)}>Back</button>
                <button className="btn btn-primary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => setTourStep(3)}>Next</button>
              </div>
            </div>
          )}
          
          {tourStep === 3 && (
            <div className="tour-tooltip bottom" style={{ top: '240px', right: '20px' }}>
              <h4 style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '0.95rem' }}>Step 3: Create Tasks</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                Add tasks, assign them to team members, and select a priority level.
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', width: '100%' }}>
                <button className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => setTourStep(2)}>Back</button>
                <button className="btn btn-primary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => { localStorage.setItem('tour_completed', 'true'); setTourStep(null); showToast('Tour finished! Enjoy Arbeit.', 'success'); }}>Finish</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
