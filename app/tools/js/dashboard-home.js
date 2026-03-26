/* ============================================
   CORTEX FREELANCER — Dashboard Home
   Operational command center: timer, deadlines,
   follow-ups, invoices, activity feed.
   ============================================ */
;(function() {
  'use strict';

  // ── Storage Keys ──────────────────────────────────────────
  var KEYS = {
    timerState: 'cortex_timer_state',
    timeEntries: 'cortex_time_entries',
    followups: 'cortex_followup_reminders',
    invoices: 'cortex_invoices',
    projects: 'cortex_projects',
    proposals: 'cortex_proposals',
    clients: 'cortex_client_directory',
    activity: 'cortex_dashboard_activity',
    expenses: 'cortex_expenses',
    statusUpdates: 'cortex_status_updates',
    caseStudies: 'cortex_cs_gen_drafts',
    clientOnboarding: 'cortex_client_onboarding',
    redFlags: 'cortex_redflag_history',
    commMessages: 'cortex_comm_messages'
  };

  // ── Helpers ───────────────────────────────────────────────
  function loadJSON(key, fallback) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch (e) { return fallback; }
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function todayStr() { return new Date().toISOString().split('T')[0]; }

  function daysUntil(dateStr) {
    if (!dateStr) return 999;
    var target = new Date(dateStr); target.setHours(0, 0, 0, 0);
    var today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.floor((target - today) / 86400000);
  }

  function formatRelative(days) {
    if (days < -1) return Math.abs(days) + 'd overdue';
    if (days === -1) return 'Yesterday';
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return 'In ' + days + ' days';
  }

  function formatDate(iso) {
    if (!iso) return '\u2014';
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function timeAgo(iso) {
    if (!iso) return '';
    var diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return formatDate(iso);
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  function fmtCurrency(n) {
    if (!n && n !== 0) return '$0';
    if (n >= 1000) return '$' + (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return '$' + Math.round(n);
  }

  // ── Timer Widget ──────────────────────────────────────────
  var _timerInterval = null;

  function getTimerState() { return loadJSON(KEYS.timerState, null); }

  function getElapsed(state) {
    if (!state) return 0;
    if (state.paused) return state.elapsed || 0;
    if (state.start) return Date.now() - state.start;
    return 0;
  }

  function formatElapsed(ms) {
    var sec = Math.floor(ms / 1000);
    return pad2(Math.floor(sec / 3600)) + ':' + pad2(Math.floor((sec % 3600) / 60)) + ':' + pad2(sec % 60);
  }

  function renderTimer() {
    var display = document.getElementById('dhTimerDisplay');
    var project = document.getElementById('dhTimerProject');
    var client = document.getElementById('dhTimerClient');
    var status = document.getElementById('dhTimerStatus');
    var startBtn = document.getElementById('dhTimerStart');
    var stopBtn = document.getElementById('dhTimerStop');
    var pauseBtn = document.getElementById('dhTimerPause');
    if (!display) return;

    var state = getTimerState();

    if (!state) {
      display.textContent = '00:00:00';
      display.classList.add('idle');
      project.textContent = 'No active timer';
      client.textContent = 'Start tracking your time';
      status.innerHTML = '<span class="dot stopped"></span>Stopped';
      startBtn.style.display = '';
      stopBtn.style.display = 'none';
      pauseBtn.style.display = 'none';
      return;
    }

    display.classList.remove('idle');
    project.textContent = state.project || 'Untitled Project';
    client.textContent = state.client || '';

    if (state.paused) {
      display.textContent = formatElapsed(state.elapsed || 0);
      status.innerHTML = '<span class="dot paused"></span>Paused';
      startBtn.textContent = 'Resume';
      startBtn.style.display = '';
      stopBtn.style.display = '';
      pauseBtn.style.display = 'none';
    } else {
      display.textContent = formatElapsed(getElapsed(state));
      status.innerHTML = '<span class="dot running"></span>Running';
      startBtn.style.display = 'none';
      stopBtn.style.display = '';
      pauseBtn.style.display = '';
    }
  }

  function startTimerTick() {
    stopTimerTick();
    _timerInterval = setInterval(renderTimer, 1000);
  }

  function stopTimerTick() {
    if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }
  }

  function handleTimerStart() {
    var state = getTimerState();
    if (state && state.paused) {
      // Resume
      if (window.CortexTimeEngine) {
        window.CortexTimeEngine.resumeTimer();
      } else {
        state.start = Date.now() - (state.elapsed || 0);
        state.paused = false;
        delete state.elapsed;
        localStorage.setItem(KEYS.timerState, JSON.stringify(state));
      }
      startTimerTick();
      renderTimer();
      return;
    }
    // Open time tracker for new timer
    window.location.href = '/app/tools/time-tracker.html';
  }

  function handleTimerStop() {
    if (window.CortexTimeEngine) {
      window.CortexTimeEngine.stopTimer();
    } else {
      localStorage.removeItem(KEYS.timerState);
    }
    stopTimerTick();
    renderTimer();
    showToast('Timer stopped & saved', 'success');
  }

  function handleTimerPause() {
    if (window.CortexTimeEngine) {
      window.CortexTimeEngine.pauseTimer();
    } else {
      var state = getTimerState();
      if (state && state.start) {
        state.elapsed = Date.now() - state.start;
        state.paused = true;
        state.start = null;
        localStorage.setItem(KEYS.timerState, JSON.stringify(state));
      }
    }
    stopTimerTick();
    renderTimer();
  }

  // ── Metrics ───────────────────────────────────────────────
  function renderMetrics() {
    var entries = loadJSON(KEYS.timeEntries, []);
    var invoices = loadJSON(KEYS.invoices, []);
    var followups = loadJSON(KEYS.followups, []);
    var projects = loadJSON(KEYS.projects, []);
    var rate = parseFloat(localStorage.getItem('cortex_time_rate')) || 0;
    var today = todayStr();
    var weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    var ws = weekStart.toISOString().split('T')[0];

    // Today hours
    var todayH = 0;
    entries.forEach(function(e) { if (e.date === today) todayH += (e.hours || 0); });
    var el = document.getElementById('dhMetricHours');
    if (el) el.textContent = todayH.toFixed(1) + 'h';

    // Active projects
    var active = projects.filter(function(p) {
      return p.status === 'active' || p.status === 'in-progress' || p.status === 'in_progress';
    });
    el = document.getElementById('dhMetricProjects');
    if (el) el.textContent = active.length;

    // Pending follow-ups
    var pending = followups.filter(function(f) {
      return !f.dismissed && !f.completed && daysUntil(f.dueDate || f.date) <= 7;
    });
    el = document.getElementById('dhMetricFollowups');
    if (el) el.textContent = pending.length;

    // Week earnings
    var weekH = 0;
    entries.forEach(function(e) { if (e.date >= ws) weekH += (e.hours || 0); });
    el = document.getElementById('dhMetricEarnings');
    if (el) el.textContent = fmtCurrency(weekH * rate);
  }

  // ── Deadlines (next 7 days) ───────────────────────────────
  function renderDeadlines() {
    var container = document.getElementById('dhDeadlines');
    if (!container) return;

    var projects = loadJSON(KEYS.projects, []);
    var followups = loadJSON(KEYS.followups, []);
    var items = [];

    // Project deadlines
    projects.forEach(function(p) {
      var deadline = p.deadline || p.dueDate || p.endDate;
      if (!deadline) return;
      var days = daysUntil(deadline);
      if (days > 7) return;
      items.push({
        type: 'project',
        name: p.name || p.title || 'Untitled',
        date: deadline,
        days: days,
        icon: 'time',
        label: p.client || 'Project'
      });
    });

    // Follow-up deadlines
    followups.forEach(function(f) {
      if (f.dismissed || f.completed) return;
      var due = f.dueDate || f.date;
      if (!due) return;
      var days = daysUntil(due);
      if (days > 7) return;
      items.push({
        type: 'followup',
        name: f.label || f.title || f.type || 'Follow-up',
        date: due,
        days: days,
        icon: 'client',
        label: f.clientName || f.client || 'Follow-up'
      });
    });

    items.sort(function(a, b) { return a.days - b.days; });

    if (items.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No upcoming deadlines this week</p></div>';
      return;
    }

    var html = '';
    items.forEach(function(item) {
      var urgency = item.days < 0 ? 'overdue' : item.days <= 1 ? 'urgent' : item.days <= 3 ? 'soon' : '';
      html += '<div class="deadline-row ' + urgency + '">' +
        '<div class="activity-icon ' + item.icon + '">' + (item.type === 'project' ? '\u23F0' : '\u{1F4AC}') + '</div>' +
        '<div class="deadline-info">' +
          '<div class="deadline-name">' + esc(item.name) + '</div>' +
          '<div class="deadline-label">' + esc(item.label) + '</div>' +
        '</div>' +
        '<div class="deadline-due ' + urgency + '">' + formatRelative(item.days) + '</div>' +
      '</div>';
    });
    container.innerHTML = html;
  }

  // ── Pending Follow-ups ────────────────────────────────────
  function renderFollowups() {
    var container = document.getElementById('dhFollowups');
    if (!container) return;

    var followups = loadJSON(KEYS.followups, []);
    var pending = followups.filter(function(f) {
      return !f.dismissed && !f.completed;
    }).sort(function(a, b) {
      return daysUntil(a.dueDate || a.date) - daysUntil(b.dueDate || b.date);
    }).slice(0, 5);

    if (pending.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No pending follow-ups</p></div>';
      return;
    }

    var html = '';
    pending.forEach(function(f) {
      var due = f.dueDate || f.date;
      var days = daysUntil(due);
      var urgency = days < 0 ? 'overdue' : days <= 1 ? 'urgent' : '';
      html += '<div class="followup-row">' +
        '<div class="followup-dot ' + (days < 0 ? 'overdue' : days <= 1 ? 'urgent' : 'normal') + '"></div>' +
        '<div class="followup-info">' +
          '<div class="followup-name">' + esc(f.label || f.title || f.type || 'Follow-up') + '</div>' +
          '<div class="followup-client">' + esc(f.clientName || f.client || '') + '</div>' +
        '</div>' +
        '<div class="deadline-due ' + urgency + '">' + formatRelative(days) + '</div>' +
      '</div>';
    });
    container.innerHTML = html;
  }

  // ── Overdue Invoices ──────────────────────────────────────
  function renderInvoices() {
    var container = document.getElementById('dhInvoices');
    if (!container) return;

    var invoices = loadJSON(KEYS.invoices, []);
    var overdue = invoices.filter(function(inv) {
      if (inv.status === 'paid' || inv.status === 'cancelled') return false;
      var due = inv.dueDate || inv.due_date;
      if (!due) return false;
      return daysUntil(due) < 0;
    }).sort(function(a, b) {
      return daysUntil(a.dueDate || a.due_date) - daysUntil(b.dueDate || b.due_date);
    });

    // Also show unpaid invoices due soon
    var upcoming = invoices.filter(function(inv) {
      if (inv.status === 'paid' || inv.status === 'cancelled') return false;
      var due = inv.dueDate || inv.due_date;
      if (!due) return false;
      var d = daysUntil(due);
      return d >= 0 && d <= 7;
    });

    var all = overdue.concat(upcoming).slice(0, 5);

    if (all.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No overdue or upcoming invoices</p></div>';
      return;
    }

    var html = '';
    all.forEach(function(inv) {
      var due = inv.dueDate || inv.due_date;
      var days = daysUntil(due);
      var isOverdue = days < 0;
      var amount = inv.total || inv.amount || 0;
      html += '<div class="invoice-row">' +
        '<div class="invoice-badge ' + (isOverdue ? 'overdue' : 'pending') + '">' +
          (isOverdue ? 'Overdue' : 'Due') +
        '</div>' +
        '<div class="invoice-info">' +
          '<div class="invoice-client">' + esc(inv.clientName || inv.client || 'Client') + '</div>' +
          '<div class="invoice-id">' + esc(inv.number || inv.invoiceNumber || '#' + (inv.id || '').toString().slice(-4)) + '</div>' +
        '</div>' +
        '<div class="invoice-amount">' + fmtCurrency(amount) + '</div>' +
        '<div class="deadline-due ' + (isOverdue ? 'overdue' : '') + '">' + formatRelative(days) + '</div>' +
      '</div>';
    });
    container.innerHTML = html;
  }

  // ── Activity Feed ─────────────────────────────────────────
  var _activeFilter = 'all';

  function collectActivities() {
    var activities = [];

    // Time entries
    var entries = loadJSON(KEYS.timeEntries, []);
    entries.slice(0, 20).forEach(function(e) {
      activities.push({
        cat: 'time', icon: 'time', emoji: '\u23F1',
        text: 'Tracked <strong>' + (e.hours || 0).toFixed(1) + 'h</strong> on ' + esc(e.project || 'Untitled'),
        time: e.date + 'T' + (e.endTime || e.startTime || '12:00'),
        ts: new Date(e.date + 'T' + (e.endTime || e.startTime || '12:00')).getTime()
      });
    });

    // Invoices
    var invoices = loadJSON(KEYS.invoices, []);
    invoices.slice(0, 10).forEach(function(inv) {
      activities.push({
        cat: 'money', icon: 'money', emoji: '\u{1F4B3}',
        text: (inv.status === 'paid' ? 'Received' : 'Sent invoice') +
          ' <strong>' + fmtCurrency(inv.total || inv.amount || 0) + '</strong>' +
          (inv.clientName || inv.client ? ' to ' + esc(inv.clientName || inv.client) : ''),
        time: inv.createdAt || inv.date || inv.issueDate,
        ts: new Date(inv.createdAt || inv.date || inv.issueDate || 0).getTime()
      });
    });

    // Proposals
    var proposals = loadJSON(KEYS.proposals, []);
    proposals.slice(0, 10).forEach(function(p) {
      activities.push({
        cat: 'client', icon: 'client', emoji: '\u{1F4DD}',
        text: 'Drafted proposal for <strong>' + esc(p.clientName || p.client || p.title || 'client') + '</strong>',
        time: p.createdAt || p.date,
        ts: new Date(p.createdAt || p.date || 0).getTime()
      });
    });

    // Follow-ups completed
    var followups = loadJSON(KEYS.followups, []);
    followups.filter(function(f) { return f.completed; }).slice(0, 5).forEach(function(f) {
      activities.push({
        cat: 'client', icon: 'settings', emoji: '\u2705',
        text: 'Completed follow-up: <strong>' + esc(f.label || f.title || 'Task') + '</strong>',
        time: f.completedAt || f.dueDate || f.date,
        ts: new Date(f.completedAt || f.dueDate || f.date || 0).getTime()
      });
    });

    // Expenses
    var expenses = loadJSON(KEYS.expenses, []);
    expenses.slice(0, 10).forEach(function(ex) {
      activities.push({
        cat: 'money', icon: 'money', emoji: '\u{1F4B8}',
        text: 'Logged expense <strong>' + fmtCurrency(ex.amount || 0) + '</strong>' +
          (ex.category ? ' in ' + esc(ex.category) : '') +
          (ex.description ? ' — ' + esc(ex.description.substring(0, 40)) : ''),
        time: ex.createdAt || ex.date,
        ts: new Date(ex.createdAt || ex.date || 0).getTime()
      });
    });

    // Status updates
    var statusUpdates = loadJSON(KEYS.statusUpdates, []);
    statusUpdates.slice(0, 5).forEach(function(su) {
      activities.push({
        cat: 'project', icon: 'settings', emoji: '\u{1F4E2}',
        text: 'Generated status update' +
          (su.projectName || su.project ? ' for <strong>' + esc(su.projectName || su.project) + '</strong>' : ''),
        time: su.createdAt || su.date,
        ts: new Date(su.createdAt || su.date || 0).getTime()
      });
    });

    // Case studies
    var caseStudies = loadJSON(KEYS.caseStudies, []);
    caseStudies.slice(0, 5).forEach(function(cs) {
      activities.push({
        cat: 'project', icon: 'client', emoji: '\u{1F4D1}',
        text: 'Created case study: <strong>' + esc(cs.title || cs.projectName || 'Untitled') + '</strong>',
        time: cs.createdAt || cs.date,
        ts: new Date(cs.createdAt || cs.date || 0).getTime()
      });
    });

    // Client onboarding
    var onboardings = loadJSON(KEYS.clientOnboarding, []);
    onboardings.slice(0, 5).forEach(function(ob) {
      activities.push({
        cat: 'client', icon: 'client', emoji: '\u{1F91D}',
        text: 'Onboarded client <strong>' + esc(ob.clientName || ob.client || 'New Client') + '</strong>',
        time: ob.createdAt || ob.date,
        ts: new Date(ob.createdAt || ob.date || 0).getTime()
      });
    });

    // Red flag analyses
    var redFlags = loadJSON(KEYS.redFlags, []);
    redFlags.slice(0, 5).forEach(function(rf) {
      activities.push({
        cat: 'client', icon: 'time', emoji: '\u{1F6A9}',
        text: 'Red flag analysis on <strong>' + esc(rf.clientName || rf.client || rf.title || 'client') + '</strong>' +
          (rf.riskLevel ? ' — ' + esc(rf.riskLevel) + ' risk' : ''),
        time: rf.createdAt || rf.date,
        ts: new Date(rf.createdAt || rf.date || 0).getTime()
      });
    });

    // Client communications
    var comms = loadJSON(KEYS.commMessages, []);
    comms.slice(0, 10).forEach(function(cm) {
      activities.push({
        cat: 'client', icon: 'client', emoji: '\u{1F4E7}',
        text: (cm.direction === 'sent' ? 'Sent' : 'Logged') + ' message to <strong>' +
          esc(cm.clientName || cm.client || cm.recipient || 'client') + '</strong>',
        time: cm.createdAt || cm.date || cm.sentAt,
        ts: new Date(cm.createdAt || cm.date || cm.sentAt || 0).getTime()
      });
    });

    // Project milestones from projects
    var projects = loadJSON(KEYS.projects, []);
    projects.forEach(function(p) {
      if (p.completedAt) {
        activities.push({
          cat: 'project', icon: 'settings', emoji: '\u{1F3C6}',
          text: 'Completed project <strong>' + esc(p.name || p.title || 'Untitled') + '</strong>',
          time: p.completedAt,
          ts: new Date(p.completedAt || 0).getTime()
        });
      }
      if (p.createdAt) {
        activities.push({
          cat: 'project', icon: 'client', emoji: '\u{1F4C2}',
          text: 'Started project <strong>' + esc(p.name || p.title || 'Untitled') + '</strong>',
          time: p.createdAt,
          ts: new Date(p.createdAt || 0).getTime()
        });
      }
    });

    // Global activity log (written by any tool via CortexActivity.log)
    var globalLog = loadJSON(KEYS.activity, []);
    globalLog.slice(0, 15).forEach(function(entry) {
      activities.push({
        cat: entry.cat || 'project',
        icon: entry.icon || 'settings',
        emoji: entry.emoji || '\u{1F4CC}',
        text: entry.text || '',
        time: entry.time,
        ts: new Date(entry.time || 0).getTime()
      });
    });

    // Deduplicate by text+ts (some tools may double-log)
    var seen = {};
    activities = activities.filter(function(a) {
      var key = a.text + '|' + a.ts;
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });

    activities.sort(function(a, b) { return b.ts - a.ts; });
    return activities;
  }

  function renderActivityFeed(filter) {
    var container = document.getElementById('dhActivityFeed');
    if (!container) return;

    if (filter) _activeFilter = filter;

    var activities = collectActivities();

    // Apply filter
    if (_activeFilter !== 'all') {
      activities = activities.filter(function(a) { return a.cat === _activeFilter; });
    }

    activities = activities.slice(0, 10);

    if (activities.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No recent activity' +
        (_activeFilter !== 'all' ? ' in this category' : '') +
        '. Start using tools to see your feed here.</p></div>';
      return;
    }

    var html = '';
    activities.forEach(function(a) {
      html += '<div class="activity-item" data-cat="' + a.cat + '">' +
        '<div class="activity-icon ' + a.icon + '">' + a.emoji + '</div>' +
        '<div class="activity-text">' + a.text + '</div>' +
        '<div class="activity-time">' + timeAgo(a.time) + '</div>' +
      '</div>';
    });
    container.innerHTML = html;

    // Update filter tab active states
    var tabs = document.querySelectorAll('.af-filter-tab');
    tabs.forEach(function(tab) {
      tab.classList.toggle('active', tab.getAttribute('data-filter') === _activeFilter);
    });
  }

  // ── Toast ─────────────────────────────────────────────────
  function showToast(msg, type) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = 'toast active' + (type ? ' ' + type : '');
    setTimeout(function() { t.classList.remove('active'); }, 2500);
  }

  // ── Greeting ──────────────────────────────────────────────
  function renderGreeting() {
    var el = document.getElementById('dhGreeting');
    if (!el) return;
    var h = new Date().getHours();
    var greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';

    var name = 'Freelancer';
    try {
      var cached = JSON.parse(localStorage.getItem('cortex_firebase_user') || '{}');
      if (cached.displayName) name = cached.displayName.split(' ')[0];
    } catch (e) { /* noop */ }

    el.innerHTML = greeting + ', <span>' + esc(name) + '</span>';

    var dateEl = document.getElementById('dhDate');
    if (dateEl) {
      dateEl.textContent = new Date().toLocaleDateString(undefined, {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
      });
    }
  }

  // ── Init ──────────────────────────────────────────────────
  function init() {
    renderGreeting();
    renderTimer();
    renderMetrics();
    renderDeadlines();
    renderFollowups();
    renderInvoices();
    renderActivityFeed();

    // Start timer tick if running
    var state = getTimerState();
    if (state && state.start && !state.paused) {
      startTimerTick();
    }

    // Wire up timer buttons
    var startBtn = document.getElementById('dhTimerStart');
    var stopBtn = document.getElementById('dhTimerStop');
    var pauseBtn = document.getElementById('dhTimerPause');
    if (startBtn) startBtn.addEventListener('click', handleTimerStart);
    if (stopBtn) stopBtn.addEventListener('click', handleTimerStop);
    if (pauseBtn) pauseBtn.addEventListener('click', handleTimerPause);

    // Wire up activity feed filter tabs
    var filtersEl = document.getElementById('dhFeedFilters');
    if (filtersEl) {
      filtersEl.addEventListener('click', function(e) {
        var tab = e.target.closest('.af-filter-tab');
        if (!tab) return;
        renderActivityFeed(tab.getAttribute('data-filter'));
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ── Global Activity Logger ──────────────────────────────────
  // Any tool can call CortexActivity.log() to push events into the feed
  function logActivity(entry) {
    if (!entry || !entry.text) return;
    var log = loadJSON(KEYS.activity, []);
    log.unshift({
      cat: entry.cat || 'project',
      icon: entry.icon || 'settings',
      emoji: entry.emoji || '\u{1F4CC}',
      text: entry.text,
      time: entry.time || new Date().toISOString()
    });
    // Keep max 50 entries
    if (log.length > 50) log = log.slice(0, 50);
    try { localStorage.setItem(KEYS.activity, JSON.stringify(log)); } catch (e) { /* quota */ }
  }

  window.CortexActivity = {
    log: logActivity,
    CATEGORIES: { time: 'time', money: 'money', client: 'client', project: 'project' }
  };

  // Public API
  window.CortexDashboardHome = {
    refresh: function() {
      renderGreeting();
      renderTimer();
      renderMetrics();
      renderDeadlines();
      renderFollowups();
      renderInvoices();
      renderActivityFeed();
    },
    filterFeed: function(cat) { renderActivityFeed(cat); }
  };
})();
