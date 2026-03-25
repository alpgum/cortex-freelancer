/**
 * Cortex Freelancer — Project Timeline Planner
 * [CFX-070] Comprehensive project management with timeline creation,
 * milestone tracking, deadline alerts, Gantt chart visualization,
 * progress monitoring, client update scheduling, and timeline optimization.
 *
 * Features:
 *   - Create projects with phases, milestones, and deadlines
 *   - Interactive Gantt chart visualization (canvas-based)
 *   - Deadline alert system with configurable thresholds
 *   - Progress tracking per milestone and overall
 *   - Client update scheduling with auto-reminders
 *   - Timeline optimization via AI suggestions
 *   - Critical path detection
 *   - Export timeline as JSON / CSV
 *   - localStorage persistence (cortex_project_timelines)
 *   - GTM event tracking
 */

(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_project_timelines';
  var ALERTS_KEY = 'cortex_timeline_alerts';
  var SETTINGS_KEY = 'cortex_timeline_settings';

  // ─── Status & Priority Config ────────────────────────────────────────

  var MILESTONE_STATUS = {
    not_started:  { label: 'Not Started',  color: '#666666', bg: 'rgba(102,102,102,0.12)', border: 'rgba(102,102,102,0.3)', icon: '○' },
    in_progress:  { label: 'In Progress',  color: '#ff8844', bg: 'rgba(255,136,68,0.12)',  border: 'rgba(255,136,68,0.3)',  icon: '◐' },
    review:       { label: 'In Review',    color: '#64b4ff', bg: 'rgba(100,180,255,0.12)', border: 'rgba(100,180,255,0.3)', icon: '◑' },
    completed:    { label: 'Completed',    color: '#00ff88', bg: 'rgba(0,255,136,0.12)',   border: 'rgba(0,255,136,0.3)',   icon: '●' },
    blocked:      { label: 'Blocked',      color: '#ff4466', bg: 'rgba(255,68,102,0.12)',  border: 'rgba(255,68,102,0.3)',  icon: '✕' },
    on_hold:      { label: 'On Hold',      color: '#ffc800', bg: 'rgba(255,200,0,0.12)',   border: 'rgba(255,200,0,0.3)',   icon: '⏸' }
  };

  var PRIORITY_LEVELS = {
    critical: { label: 'Critical', color: '#ff4466', weight: 4 },
    high:     { label: 'High',     color: '#ff8844', weight: 3 },
    medium:   { label: 'Medium',   color: '#ffc800', weight: 2 },
    low:      { label: 'Low',      color: '#64b4ff', weight: 1 }
  };

  var ALERT_THRESHOLDS = {
    overdue:  { days: 0,  label: 'Overdue',       color: '#ff4466', icon: '🔴' },
    urgent:   { days: 1,  label: 'Due Tomorrow',   color: '#ff8844', icon: '🟠' },
    warning:  { days: 3,  label: 'Due in 3 Days',  color: '#ffc800', icon: '🟡' },
    upcoming: { days: 7,  label: 'Due This Week',  color: '#64b4ff', icon: '🔵' }
  };

  // ─── Data Helpers ────────────────────────────────────────────────────

  function generateId() {
    return 'tl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
  }

  function loadProjects() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  function saveProjects(projects) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    } catch (e) { /* storage full */ }
  }

  function loadSettings() {
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? JSON.parse(raw) : getDefaultSettings();
    } catch (e) { return getDefaultSettings(); }
  }

  function saveSettings(settings) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) { /* storage full */ }
  }

  function getDefaultSettings() {
    return {
      alertDaysBefore: 3,
      showWeekends: true,
      autoSaveInterval: 30,
      clientUpdateFrequency: 'weekly',
      defaultWorkHoursPerDay: 8,
      notificationsEnabled: true
    };
  }

  function pushEvent(action, data) {
    if (window.dataLayer) {
      window.dataLayer.push({ event: 'tool_used', tool_name: 'project-timeline', action: action, data: data || {} });
    }
  }

  // ─── Date Utilities ──────────────────────────────────────────────────

  function toDateStr(d) {
    if (!d) return '';
    var date = new Date(d);
    return date.toISOString().split('T')[0];
  }

  function parseDate(str) {
    if (!str) return null;
    var parts = str.split('-');
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  }

  function daysBetween(d1, d2) {
    var a = new Date(d1); a.setHours(0, 0, 0, 0);
    var b = new Date(d2); b.setHours(0, 0, 0, 0);
    return Math.round((b - a) / 86400000);
  }

  function addDays(date, days) {
    var d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  function today() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function formatDate(str) {
    if (!str) return '—';
    var d = new Date(str);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatDateShort(str) {
    if (!str) return '—';
    var d = new Date(str);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function isWeekend(date) {
    var day = new Date(date).getDay();
    return day === 0 || day === 6;
  }

  function workingDaysBetween(d1, d2) {
    var count = 0;
    var current = new Date(d1);
    var end = new Date(d2);
    while (current <= end) {
      if (!isWeekend(current)) count++;
      current = addDays(current, 1);
    }
    return count;
  }

  // ─── Project Model ──────────────────────────────────────────────────

  function createProject(data) {
    return {
      id: generateId(),
      name: data.name || 'Untitled Project',
      client: data.client || '',
      description: data.description || '',
      startDate: data.startDate || toDateStr(today()),
      endDate: data.endDate || '',
      budget: parseFloat(data.budget) || 0,
      hourlyRate: parseFloat(data.hourlyRate) || 0,
      status: 'active',
      phases: data.phases || [],
      milestones: data.milestones || [],
      clientUpdates: data.clientUpdates || [],
      tags: data.tags || [],
      notes: data.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  function createMilestone(data) {
    return {
      id: generateId(),
      name: data.name || 'Untitled Milestone',
      description: data.description || '',
      phaseId: data.phaseId || null,
      startDate: data.startDate || '',
      dueDate: data.dueDate || '',
      completedDate: data.completedDate || null,
      status: data.status || 'not_started',
      priority: data.priority || 'medium',
      progress: parseInt(data.progress) || 0,
      estimatedHours: parseFloat(data.estimatedHours) || 0,
      actualHours: parseFloat(data.actualHours) || 0,
      dependencies: data.dependencies || [],
      assignee: data.assignee || '',
      deliverables: data.deliverables || [],
      paymentAmount: parseFloat(data.paymentAmount) || 0,
      paymentStatus: data.paymentStatus || 'pending',
      color: data.color || null,
      createdAt: new Date().toISOString()
    };
  }

  function createPhase(data) {
    return {
      id: generateId(),
      name: data.name || 'Untitled Phase',
      startDate: data.startDate || '',
      endDate: data.endDate || '',
      color: data.color || '#ff8844',
      order: data.order || 0
    };
  }

  function createClientUpdate(data) {
    return {
      id: generateId(),
      scheduledDate: data.scheduledDate || '',
      type: data.type || 'progress',
      subject: data.subject || '',
      notes: data.notes || '',
      sent: false,
      sentDate: null,
      createdAt: new Date().toISOString()
    };
  }

  // ─── Progress Calculations ──────────────────────────────────────────

  function calculateProjectProgress(project) {
    var milestones = project.milestones || [];
    if (milestones.length === 0) return 0;

    var totalWeight = 0;
    var completedWeight = 0;

    milestones.forEach(function (m) {
      var weight = (PRIORITY_LEVELS[m.priority] || PRIORITY_LEVELS.medium).weight;
      totalWeight += weight;
      completedWeight += (m.progress / 100) * weight;
    });

    return totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
  }

  function calculatePhaseProgress(project, phaseId) {
    var milestones = (project.milestones || []).filter(function (m) { return m.phaseId === phaseId; });
    if (milestones.length === 0) return 0;

    var total = 0;
    milestones.forEach(function (m) { total += m.progress || 0; });
    return Math.round(total / milestones.length);
  }

  function getProjectStats(project) {
    var milestones = project.milestones || [];
    var now = today();
    var stats = {
      total: milestones.length,
      completed: 0,
      inProgress: 0,
      blocked: 0,
      overdue: 0,
      upcoming: 0,
      totalEstimatedHours: 0,
      totalActualHours: 0,
      totalBudget: 0,
      earnedBudget: 0,
      progress: 0,
      onTrack: true,
      daysRemaining: 0,
      healthScore: 100
    };

    milestones.forEach(function (m) {
      stats.totalEstimatedHours += m.estimatedHours || 0;
      stats.totalActualHours += m.actualHours || 0;
      stats.totalBudget += m.paymentAmount || 0;

      if (m.status === 'completed') {
        stats.completed++;
        stats.earnedBudget += m.paymentAmount || 0;
      } else if (m.status === 'in_progress' || m.status === 'review') {
        stats.inProgress++;
      } else if (m.status === 'blocked') {
        stats.blocked++;
      }

      if (m.status !== 'completed' && m.dueDate && new Date(m.dueDate) < now) {
        stats.overdue++;
      } else if (m.status !== 'completed' && m.dueDate) {
        var daysUntil = daysBetween(now, new Date(m.dueDate));
        if (daysUntil <= 7 && daysUntil >= 0) stats.upcoming++;
      }
    });

    stats.progress = calculateProjectProgress(project);

    if (project.endDate) {
      stats.daysRemaining = Math.max(0, daysBetween(now, new Date(project.endDate)));
    }

    // Health score: deduct for overdue, blocked, behind schedule
    stats.healthScore = 100;
    stats.healthScore -= stats.overdue * 15;
    stats.healthScore -= stats.blocked * 10;
    if (stats.totalEstimatedHours > 0 && stats.totalActualHours > stats.totalEstimatedHours * 1.2) {
      stats.healthScore -= 20;
    }
    stats.healthScore = Math.max(0, Math.min(100, stats.healthScore));
    stats.onTrack = stats.healthScore >= 60;

    return stats;
  }

  // ─── Deadline Alerts ────────────────────────────────────────────────

  function getAlerts(projects) {
    var now = today();
    var alerts = [];

    projects.forEach(function (project) {
      if (project.status !== 'active') return;

      // Project deadline alert
      if (project.endDate) {
        var projectDaysLeft = daysBetween(now, new Date(project.endDate));
        if (projectDaysLeft <= 7 && projectDaysLeft >= 0) {
          alerts.push({
            type: projectDaysLeft <= 0 ? 'overdue' : projectDaysLeft <= 1 ? 'urgent' : projectDaysLeft <= 3 ? 'warning' : 'upcoming',
            projectId: project.id,
            projectName: project.name,
            message: projectDaysLeft <= 0
              ? 'Project "' + project.name + '" deadline has passed!'
              : 'Project "' + project.name + '" due in ' + projectDaysLeft + ' day' + (projectDaysLeft !== 1 ? 's' : ''),
            dueDate: project.endDate,
            daysLeft: projectDaysLeft
          });
        }
      }

      // Milestone alerts
      (project.milestones || []).forEach(function (m) {
        if (m.status === 'completed') return;
        if (!m.dueDate) return;

        var daysLeft = daysBetween(now, new Date(m.dueDate));

        if (daysLeft <= 7) {
          alerts.push({
            type: daysLeft < 0 ? 'overdue' : daysLeft <= 1 ? 'urgent' : daysLeft <= 3 ? 'warning' : 'upcoming',
            projectId: project.id,
            projectName: project.name,
            milestoneId: m.id,
            milestoneName: m.name,
            message: daysLeft < 0
              ? '"' + m.name + '" is ' + Math.abs(daysLeft) + ' day' + (Math.abs(daysLeft) !== 1 ? 's' : '') + ' overdue'
              : '"' + m.name + '" due in ' + daysLeft + ' day' + (daysLeft !== 1 ? 's' : ''),
            dueDate: m.dueDate,
            daysLeft: daysLeft,
            priority: m.priority
          });
        }
      });

      // Client update alerts
      (project.clientUpdates || []).forEach(function (u) {
        if (u.sent) return;
        if (!u.scheduledDate) return;
        var daysUntil = daysBetween(now, new Date(u.scheduledDate));
        if (daysUntil <= 1 && daysUntil >= 0) {
          alerts.push({
            type: 'upcoming',
            projectId: project.id,
            projectName: project.name,
            message: 'Client update due ' + (daysUntil === 0 ? 'today' : 'tomorrow') + ': ' + (u.subject || 'Progress update'),
            dueDate: u.scheduledDate,
            daysLeft: daysUntil,
            isClientUpdate: true
          });
        }
      });
    });

    // Sort: overdue first, then by days remaining
    alerts.sort(function (a, b) {
      if (a.daysLeft !== b.daysLeft) return a.daysLeft - b.daysLeft;
      return 0;
    });

    return alerts;
  }

  // ─── Critical Path Detection ────────────────────────────────────────

  function findCriticalPath(project) {
    var milestones = project.milestones || [];
    if (milestones.length === 0) return [];

    // Build dependency graph
    var byId = {};
    milestones.forEach(function (m) { byId[m.id] = m; });

    // Find milestones with no dependents (end nodes)
    var hasDependents = {};
    milestones.forEach(function (m) {
      (m.dependencies || []).forEach(function (depId) {
        hasDependents[depId] = true;
      });
    });

    // Calculate earliest start/finish for each milestone
    var earlyStart = {};
    var earlyFinish = {};
    var duration = {};

    milestones.forEach(function (m) {
      duration[m.id] = m.estimatedHours ? Math.ceil(m.estimatedHours / 8) : daysBetween(
        new Date(m.startDate || project.startDate),
        new Date(m.dueDate || project.endDate || m.startDate || project.startDate)
      );
      if (duration[m.id] < 1) duration[m.id] = 1;
    });

    function calcEarlyStart(mId) {
      if (earlyStart[mId] !== undefined) return earlyStart[mId];
      var m = byId[mId];
      if (!m) return 0;

      var deps = m.dependencies || [];
      if (deps.length === 0) {
        earlyStart[mId] = 0;
        earlyFinish[mId] = duration[mId];
        return 0;
      }

      var maxFinish = 0;
      deps.forEach(function (depId) {
        calcEarlyStart(depId);
        if (earlyFinish[depId] > maxFinish) maxFinish = earlyFinish[depId];
      });

      earlyStart[mId] = maxFinish;
      earlyFinish[mId] = maxFinish + duration[mId];
      return earlyStart[mId];
    }

    milestones.forEach(function (m) { calcEarlyStart(m.id); });

    // Find the longest path (critical path)
    var maxFinish = 0;
    var endNodes = [];
    milestones.forEach(function (m) {
      if (earlyFinish[m.id] >= maxFinish) {
        if (earlyFinish[m.id] > maxFinish) endNodes = [];
        maxFinish = earlyFinish[m.id];
        endNodes.push(m.id);
      }
    });

    // Trace back through dependencies to build critical path
    var criticalIds = {};
    function traceback(mId) {
      criticalIds[mId] = true;
      var m = byId[mId];
      if (!m) return;
      (m.dependencies || []).forEach(function (depId) {
        if (earlyFinish[depId] === earlyStart[mId]) {
          traceback(depId);
        }
      });
    }
    endNodes.forEach(traceback);

    return milestones.filter(function (m) { return criticalIds[m.id]; })
      .sort(function (a, b) { return (earlyStart[a.id] || 0) - (earlyStart[b.id] || 0); });
  }

  // ─── Gantt Chart Renderer (Canvas) ──────────────────────────────────

  var GanttChart = {
    canvas: null,
    ctx: null,
    project: null,
    scrollX: 0,
    scrollY: 0,
    rowHeight: 44,
    headerHeight: 60,
    labelWidth: 220,
    dayWidth: 32,
    hoveredRow: -1,
    tooltipData: null,

    init: function (canvasId, project) {
      this.canvas = document.getElementById(canvasId);
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext('2d');
      this.project = project;
      this.scrollX = 0;
      this.scrollY = 0;
      this._setupEvents();
      this.render();
    },

    _setupEvents: function () {
      var self = this;
      var isDragging = false;
      var lastX = 0;
      var lastY = 0;

      this.canvas.addEventListener('mousedown', function (e) {
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        self.canvas.style.cursor = 'grabbing';
      });

      window.addEventListener('mousemove', function (e) {
        if (isDragging) {
          self.scrollX -= e.clientX - lastX;
          self.scrollY -= e.clientY - lastY;
          self.scrollX = Math.max(0, self.scrollX);
          self.scrollY = Math.max(0, self.scrollY);
          lastX = e.clientX;
          lastY = e.clientY;
          self.render();
        } else if (self.canvas) {
          var rect = self.canvas.getBoundingClientRect();
          var mx = e.clientX - rect.left;
          var my = e.clientY - rect.top;
          var row = Math.floor((my - self.headerHeight + self.scrollY) / self.rowHeight);
          if (row !== self.hoveredRow) {
            self.hoveredRow = row;
            self.render();
          }
        }
      });

      window.addEventListener('mouseup', function () {
        if (isDragging) {
          isDragging = false;
          if (self.canvas) self.canvas.style.cursor = 'grab';
        }
      });

      this.canvas.addEventListener('wheel', function (e) {
        e.preventDefault();
        self.scrollX += e.deltaX || 0;
        self.scrollY += e.deltaY || 0;
        self.scrollX = Math.max(0, self.scrollX);
        self.scrollY = Math.max(0, self.scrollY);
        self.render();
      }, { passive: false });
    },

    _getDateRange: function () {
      var proj = this.project;
      var start = proj.startDate ? new Date(proj.startDate) : today();
      var end = proj.endDate ? new Date(proj.endDate) : addDays(today(), 90);

      (proj.milestones || []).forEach(function (m) {
        if (m.startDate && new Date(m.startDate) < start) start = new Date(m.startDate);
        if (m.dueDate && new Date(m.dueDate) > end) end = new Date(m.dueDate);
      });

      // Add padding
      start = addDays(start, -3);
      end = addDays(end, 7);

      return { start: start, end: end, days: daysBetween(start, end) };
    },

    render: function () {
      if (!this.canvas || !this.ctx || !this.project) return;

      var canvas = this.canvas;
      var ctx = this.ctx;
      var dpr = window.devicePixelRatio || 1;

      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.scale(dpr, dpr);

      var w = canvas.offsetWidth;
      var h = canvas.offsetHeight;
      var milestones = this.project.milestones || [];
      var range = this._getDateRange();
      var criticalPath = findCriticalPath(this.project);
      var criticalIds = {};
      criticalPath.forEach(function (m) { criticalIds[m.id] = true; });

      // Background
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, w, h);

      // Draw time header
      this._drawHeader(ctx, w, range);

      // Draw rows
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, this.headerHeight, w, h - this.headerHeight);
      ctx.clip();

      for (var i = 0; i < milestones.length; i++) {
        this._drawRow(ctx, i, milestones[i], w, range, criticalIds);
      }

      ctx.restore();

      // Today line
      var todayOffset = daysBetween(range.start, today());
      var todayX = this.labelWidth + todayOffset * this.dayWidth - this.scrollX;
      if (todayX >= this.labelWidth && todayX <= w) {
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(todayX, 0);
        ctx.lineTo(todayX, h);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#00ff88';
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.fillText('TODAY', todayX + 4, 12);
      }

      // Label column background (overlay)
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, this.headerHeight, this.labelWidth, h - this.headerHeight);

      // Draw labels
      for (var j = 0; j < milestones.length; j++) {
        this._drawLabel(ctx, j, milestones[j], criticalIds);
      }

      canvas.style.cursor = 'grab';
    },

    _drawHeader: function (ctx, w, range) {
      var hh = this.headerHeight;

      ctx.fillStyle = '#111118';
      ctx.fillRect(0, 0, w, hh);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, hh);
      ctx.lineTo(w, hh);
      ctx.stroke();

      // Draw month headers and day markers
      var current = new Date(range.start);
      var lastMonth = -1;

      for (var d = 0; d <= range.days; d++) {
        var x = this.labelWidth + d * this.dayWidth - this.scrollX;
        if (x < this.labelWidth - this.dayWidth || x > w + this.dayWidth) {
          current = addDays(current, 1);
          continue;
        }

        var month = current.getMonth();
        if (month !== lastMonth) {
          ctx.fillStyle = '#e0e0e0';
          ctx.font = 'bold 11px Inter, sans-serif';
          ctx.fillText(current.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), x + 2, 18);
          lastMonth = month;
        }

        // Day number
        var dayNum = current.getDate();
        var isWknd = isWeekend(current);
        ctx.fillStyle = isWknd ? '#333' : '#666';
        ctx.font = '10px Inter, sans-serif';
        ctx.fillText(dayNum, x + 2, 38);

        // Weekend shading
        if (isWknd) {
          ctx.fillStyle = 'rgba(255,255,255,0.02)';
          ctx.fillRect(x, hh, this.dayWidth, 2000);
        }

        // Grid line
        if (dayNum === 1) {
          ctx.strokeStyle = 'rgba(255,255,255,0.08)';
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, 2000);
          ctx.stroke();
        }

        current = addDays(current, 1);
      }
    },

    _drawRow: function (ctx, index, milestone, w, range, criticalIds) {
      var y = this.headerHeight + index * this.rowHeight - this.scrollY;
      if (y < this.headerHeight - this.rowHeight || y > ctx.canvas.offsetHeight) return;

      // Row background
      if (index === this.hoveredRow) {
        ctx.fillStyle = 'rgba(255,136,68,0.04)';
        ctx.fillRect(this.labelWidth, y, w - this.labelWidth, this.rowHeight);
      }

      // Row separator
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.beginPath();
      ctx.moveTo(this.labelWidth, y + this.rowHeight);
      ctx.lineTo(w, y + this.rowHeight);
      ctx.stroke();

      // Bar
      if (milestone.startDate && milestone.dueDate) {
        var startOffset = daysBetween(range.start, new Date(milestone.startDate));
        var endOffset = daysBetween(range.start, new Date(milestone.dueDate));
        var barX = this.labelWidth + startOffset * this.dayWidth - this.scrollX;
        var barW = Math.max((endOffset - startOffset + 1) * this.dayWidth, this.dayWidth);
        var barY = y + 8;
        var barH = this.rowHeight - 16;

        var status = MILESTONE_STATUS[milestone.status] || MILESTONE_STATUS.not_started;
        var isCritical = criticalIds[milestone.id];

        // Bar background
        ctx.fillStyle = isCritical ? 'rgba(255,68,102,0.15)' : status.bg;
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW, barH, 6);
        ctx.fill();

        // Bar border
        ctx.strokeStyle = isCritical ? '#ff4466' : status.border;
        ctx.lineWidth = isCritical ? 2 : 1;
        ctx.stroke();

        // Progress fill
        if (milestone.progress > 0) {
          var progressW = barW * (milestone.progress / 100);
          ctx.fillStyle = status.color + '33';
          ctx.beginPath();
          ctx.roundRect(barX, barY, progressW, barH, 6);
          ctx.fill();
        }

        // Progress text
        ctx.fillStyle = status.color;
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(milestone.progress + '%', barX + barW / 2, barY + barH / 2 + 4);
        ctx.textAlign = 'left';
      }

      // Dependency arrows
      var self = this;
      (milestone.dependencies || []).forEach(function (depId) {
        var depMilestone = null;
        var depIndex = -1;
        (self.project.milestones || []).forEach(function (m, idx) {
          if (m.id === depId) { depMilestone = m; depIndex = idx; }
        });
        if (!depMilestone || !depMilestone.dueDate || !milestone.startDate) return;

        var fromOffset = daysBetween(range.start, new Date(depMilestone.dueDate));
        var fromX = self.labelWidth + (fromOffset + 1) * self.dayWidth - self.scrollX;
        var fromY = self.headerHeight + depIndex * self.rowHeight - self.scrollY + self.rowHeight / 2;

        var toOffset = daysBetween(range.start, new Date(milestone.startDate));
        var toX = self.labelWidth + toOffset * self.dayWidth - self.scrollX;
        var toY = y + self.rowHeight / 2;

        ctx.strokeStyle = 'rgba(255,136,68,0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(fromX + 10, fromY);
        ctx.lineTo(fromX + 10, toY);
        ctx.lineTo(toX, toY);
        ctx.stroke();

        // Arrow head
        ctx.fillStyle = 'rgba(255,136,68,0.6)';
        ctx.beginPath();
        ctx.moveTo(toX, toY - 4);
        ctx.lineTo(toX, toY + 4);
        ctx.lineTo(toX - 6, toY);
        ctx.closePath();
        ctx.fill();
      });
    },

    _drawLabel: function (ctx, index, milestone, criticalIds) {
      var y = this.headerHeight + index * this.rowHeight - this.scrollY;
      if (y < this.headerHeight - this.rowHeight || y > ctx.canvas.offsetHeight) return;

      // Label background
      ctx.fillStyle = index === this.hoveredRow ? '#151520' : '#0a0a0f';
      ctx.fillRect(0, y, this.labelWidth, this.rowHeight);

      // Separator
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.beginPath();
      ctx.moveTo(0, y + this.rowHeight);
      ctx.lineTo(this.labelWidth, y + this.rowHeight);
      ctx.stroke();

      // Status indicator
      var status = MILESTONE_STATUS[milestone.status] || MILESTONE_STATUS.not_started;
      ctx.fillStyle = status.color;
      ctx.beginPath();
      ctx.arc(14, y + this.rowHeight / 2, 5, 0, Math.PI * 2);
      ctx.fill();

      // Name
      var isCritical = criticalIds[milestone.id];
      ctx.fillStyle = isCritical ? '#ff4466' : '#e0e0e0';
      ctx.font = (isCritical ? 'bold ' : '') + '12px Inter, sans-serif';
      var displayName = milestone.name.length > 22 ? milestone.name.substring(0, 22) + '…' : milestone.name;
      ctx.fillText(displayName, 28, y + this.rowHeight / 2 + 4);

      // Priority badge
      var priority = PRIORITY_LEVELS[milestone.priority];
      if (priority) {
        ctx.fillStyle = priority.color + '33';
        ctx.beginPath();
        ctx.roundRect(this.labelWidth - 50, y + 12, 40, 18, 4);
        ctx.fill();
        ctx.fillStyle = priority.color;
        ctx.font = '9px Inter, sans-serif';
        ctx.fillText(priority.label, this.labelWidth - 46, y + 24);
      }

      // Vertical separator
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath();
      ctx.moveTo(this.labelWidth, y);
      ctx.lineTo(this.labelWidth, y + this.rowHeight);
      ctx.stroke();
    },

    update: function (project) {
      this.project = project;
      this.render();
    },

    resize: function () {
      this.render();
    }
  };

  // ─── Client Update Scheduler ────────────────────────────────────────

  function generateClientUpdateSchedule(project, frequency) {
    var updates = [];
    if (!project.startDate || !project.endDate) return updates;

    var start = new Date(project.startDate);
    var end = new Date(project.endDate);
    var interval = frequency === 'daily' ? 1 : frequency === 'biweekly' ? 14 : frequency === 'monthly' ? 30 : 7;
    var current = addDays(start, interval);
    var index = 1;

    while (current <= end) {
      updates.push(createClientUpdate({
        scheduledDate: toDateStr(current),
        type: 'progress',
        subject: 'Progress Update #' + index + ' — ' + project.name,
        notes: ''
      }));
      current = addDays(current, interval);
      index++;
    }

    // Final delivery update
    updates.push(createClientUpdate({
      scheduledDate: toDateStr(end),
      type: 'delivery',
      subject: 'Final Delivery — ' + project.name,
      notes: 'Project completion and handoff'
    }));

    return updates;
  }

  // ─── Timeline Export ────────────────────────────────────────────────

  function exportAsJSON(project) {
    var data = JSON.stringify(project, null, 2);
    downloadFile(project.name.replace(/[^a-z0-9]/gi, '_') + '_timeline.json', data, 'application/json');
  }

  function exportAsCSV(project) {
    var rows = [['Milestone', 'Phase', 'Status', 'Priority', 'Start Date', 'Due Date', 'Progress', 'Est. Hours', 'Actual Hours', 'Payment', 'Assignee']];
    var phasesById = {};
    (project.phases || []).forEach(function (p) { phasesById[p.id] = p.name; });

    (project.milestones || []).forEach(function (m) {
      rows.push([
        '"' + (m.name || '').replace(/"/g, '""') + '"',
        '"' + (phasesById[m.phaseId] || 'No Phase') + '"',
        (MILESTONE_STATUS[m.status] || {}).label || m.status,
        (PRIORITY_LEVELS[m.priority] || {}).label || m.priority,
        m.startDate || '',
        m.dueDate || '',
        m.progress + '%',
        m.estimatedHours || 0,
        m.actualHours || 0,
        '$' + (m.paymentAmount || 0),
        '"' + (m.assignee || '').replace(/"/g, '""') + '"'
      ]);
    });

    var csv = rows.map(function (r) { return r.join(','); }).join('\n');
    downloadFile(project.name.replace(/[^a-z0-9]/gi, '_') + '_timeline.csv', csv, 'text/csv');
  }

  function downloadFile(filename, content, type) {
    var blob = new Blob([content], { type: type });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ─── AI Timeline Optimization ───────────────────────────────────────

  function optimizeTimeline(project, callback) {
    var payload = {
      projectName: project.name,
      client: project.client,
      startDate: project.startDate,
      endDate: project.endDate,
      budget: project.budget,
      hourlyRate: project.hourlyRate,
      milestones: (project.milestones || []).map(function (m) {
        return {
          name: m.name,
          status: m.status,
          priority: m.priority,
          startDate: m.startDate,
          dueDate: m.dueDate,
          estimatedHours: m.estimatedHours,
          actualHours: m.actualHours,
          progress: m.progress,
          dependencies: m.dependencies
        };
      }),
      phases: project.phases || []
    };

    fetch('/api/project-timeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data.error) {
        callback(data.error, null);
      } else {
        callback(null, data);
      }
    })
    .catch(function (err) {
      callback(err.message || 'Network error', null);
    });
  }

  // ─── Template Projects ──────────────────────────────────────────────

  var TEMPLATES = {
    web_app: {
      name: 'Web Application',
      phases: [
        { name: 'Discovery & Planning', color: '#64b4ff', order: 0 },
        { name: 'Design', color: '#ffc800', order: 1 },
        { name: 'Development', color: '#ff8844', order: 2 },
        { name: 'Testing & QA', color: '#ff4466', order: 3 },
        { name: 'Launch', color: '#00ff88', order: 4 }
      ],
      milestones: [
        { name: 'Requirements gathering', phase: 0, days: [0, 5], priority: 'high', hours: 16 },
        { name: 'Technical architecture', phase: 0, days: [3, 8], priority: 'high', hours: 12 },
        { name: 'Wireframes & mockups', phase: 1, days: [7, 14], priority: 'medium', hours: 20 },
        { name: 'UI design finalization', phase: 1, days: [12, 19], priority: 'high', hours: 24 },
        { name: 'Frontend development', phase: 2, days: [17, 35], priority: 'critical', hours: 60 },
        { name: 'Backend API development', phase: 2, days: [17, 35], priority: 'critical', hours: 60 },
        { name: 'Database setup & integration', phase: 2, days: [20, 30], priority: 'high', hours: 20 },
        { name: 'Integration testing', phase: 3, days: [33, 40], priority: 'high', hours: 16 },
        { name: 'User acceptance testing', phase: 3, days: [38, 44], priority: 'medium', hours: 12 },
        { name: 'Deployment & launch', phase: 4, days: [43, 47], priority: 'critical', hours: 8 },
        { name: 'Post-launch monitoring', phase: 4, days: [47, 54], priority: 'medium', hours: 10 }
      ]
    },
    mobile_app: {
      name: 'Mobile Application',
      phases: [
        { name: 'Research & Planning', color: '#64b4ff', order: 0 },
        { name: 'UI/UX Design', color: '#ffc800', order: 1 },
        { name: 'Core Development', color: '#ff8844', order: 2 },
        { name: 'Testing', color: '#ff4466', order: 3 },
        { name: 'App Store Submission', color: '#00ff88', order: 4 }
      ],
      milestones: [
        { name: 'Market research & requirements', phase: 0, days: [0, 5], priority: 'high', hours: 16 },
        { name: 'User flow mapping', phase: 0, days: [3, 7], priority: 'medium', hours: 10 },
        { name: 'App wireframes', phase: 1, days: [6, 12], priority: 'high', hours: 18 },
        { name: 'Visual design system', phase: 1, days: [10, 17], priority: 'high', hours: 20 },
        { name: 'Core feature development', phase: 2, days: [15, 40], priority: 'critical', hours: 80 },
        { name: 'API integration', phase: 2, days: [25, 38], priority: 'high', hours: 30 },
        { name: 'Beta testing', phase: 3, days: [38, 48], priority: 'high', hours: 20 },
        { name: 'Bug fixes & optimization', phase: 3, days: [45, 52], priority: 'critical', hours: 16 },
        { name: 'Store submission & review', phase: 4, days: [50, 57], priority: 'high', hours: 8 }
      ]
    },
    branding: {
      name: 'Branding Project',
      phases: [
        { name: 'Discovery', color: '#64b4ff', order: 0 },
        { name: 'Concept', color: '#ffc800', order: 1 },
        { name: 'Refinement', color: '#ff8844', order: 2 },
        { name: 'Delivery', color: '#00ff88', order: 3 }
      ],
      milestones: [
        { name: 'Brand audit & research', phase: 0, days: [0, 5], priority: 'high', hours: 12 },
        { name: 'Competitor analysis', phase: 0, days: [3, 7], priority: 'medium', hours: 8 },
        { name: 'Initial concepts (3 directions)', phase: 1, days: [7, 14], priority: 'critical', hours: 20 },
        { name: 'Client review & direction selection', phase: 1, days: [14, 17], priority: 'high', hours: 4 },
        { name: 'Logo refinement', phase: 2, days: [17, 24], priority: 'critical', hours: 16 },
        { name: 'Brand guidelines document', phase: 2, days: [22, 30], priority: 'high', hours: 20 },
        { name: 'Asset delivery & handoff', phase: 3, days: [28, 33], priority: 'high', hours: 8 }
      ]
    }
  };

  function applyTemplate(templateKey, startDate, client) {
    var tmpl = TEMPLATES[templateKey];
    if (!tmpl) return null;

    var start = parseDate(startDate) || today();
    var phases = tmpl.phases.map(function (p) {
      return createPhase({ name: p.name, color: p.color, order: p.order });
    });

    var milestones = tmpl.milestones.map(function (m) {
      return createMilestone({
        name: m.name,
        phaseId: phases[m.phase].id,
        startDate: toDateStr(addDays(start, m.days[0])),
        dueDate: toDateStr(addDays(start, m.days[1])),
        priority: m.priority,
        estimatedHours: m.hours
      });
    });

    // Add dependencies (sequential within phase)
    for (var i = 1; i < milestones.length; i++) {
      if (tmpl.milestones[i].phase === tmpl.milestones[i - 1].phase) {
        milestones[i].dependencies = [milestones[i - 1].id];
      }
    }

    var lastMilestone = tmpl.milestones[tmpl.milestones.length - 1];
    var endDate = toDateStr(addDays(start, lastMilestone.days[1]));

    return createProject({
      name: tmpl.name + (client ? ' — ' + client : ''),
      client: client || '',
      startDate: startDate || toDateStr(today()),
      endDate: endDate,
      phases: phases,
      milestones: milestones
    });
  }

  // ─── Public API ─────────────────────────────────────────────────────

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.ProjectTimeline = {
    // Data
    loadProjects: loadProjects,
    saveProjects: saveProjects,
    loadSettings: loadSettings,
    saveSettings: saveSettings,

    // Models
    createProject: createProject,
    createMilestone: createMilestone,
    createPhase: createPhase,
    createClientUpdate: createClientUpdate,

    // Calculations
    calculateProjectProgress: calculateProjectProgress,
    calculatePhaseProgress: calculatePhaseProgress,
    getProjectStats: getProjectStats,
    findCriticalPath: findCriticalPath,
    getAlerts: getAlerts,

    // Templates
    TEMPLATES: TEMPLATES,
    applyTemplate: applyTemplate,

    // Visualization
    GanttChart: GanttChart,

    // Client updates
    generateClientUpdateSchedule: generateClientUpdateSchedule,

    // Export
    exportAsJSON: exportAsJSON,
    exportAsCSV: exportAsCSV,

    // AI
    optimizeTimeline: optimizeTimeline,

    // Config
    MILESTONE_STATUS: MILESTONE_STATUS,
    PRIORITY_LEVELS: PRIORITY_LEVELS,
    ALERT_THRESHOLDS: ALERT_THRESHOLDS,

    // Utils
    formatDate: formatDate,
    formatDateShort: formatDateShort,
    daysBetween: daysBetween,
    toDateStr: toDateStr,
    pushEvent: pushEvent
  };

  // Alias
  window.CortexProjectTimeline = window.CortexFreelancer.ProjectTimeline;

})();
