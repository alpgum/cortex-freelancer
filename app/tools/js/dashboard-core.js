/* ============================================
   CORTEX FREELANCER — Dashboard Core
   cf3-010 | dashboard-core.js
   Data aggregation, real-time updates, activity feed
   ============================================ */

;(function(global) {
  'use strict';

  // ── Helpers ────────────────────────────────────────────────
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return document.querySelectorAll(sel); }

  function formatCurrency(amount, symbol) {
    symbol = symbol || '$';
    return symbol + parseFloat(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function formatHours(h) {
    return parseFloat(h || 0).toFixed(1);
  }

  function timeAgo(dateStr) {
    if (!dateStr) return '—';
    var diff = Date.now() - new Date(dateStr).getTime();
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    var days = Math.floor(hrs / 24);
    if (days < 7) return days + 'd ago';
    return new Date(dateStr).toLocaleDateString();
  }

  function getGreeting() {
    var h = new Date().getHours();
    if (h < 6) return 'Night owl mode';
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    if (h < 21) return 'Good evening';
    return 'Night owl mode';
  }

  function getTodayFormatted() {
    return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }

  // Project colors for chart
  var PROJECT_COLORS = ['#ff8844', '#00ff88', '#4488ff', '#aa66ff', '#ffc800', '#ff4444', '#44ddff', '#ff66aa'];

  // ── Data Sources ───────────────────────────────────────────
  function getTimeStats() {
    if (typeof CortexTimeEngine !== 'undefined') {
      return CortexTimeEngine.getStats();
    }
    return { totalHours: 0, todayHours: 0, weekHours: 0, monthHours: 0, totalBillable: 0, todayBillable: 0, weekBillable: 0, monthBillable: 0, entryCount: 0, rate: 0, byProject: {}, byClient: {}, byDate: {} };
  }

  function getDailyTotals() {
    if (typeof CortexTimeEngine !== 'undefined') {
      return CortexTimeEngine.getDailyTotals(7);
    }
    return [];
  }

  function getClientStats() {
    try {
      var raw = localStorage.getItem('cortex_client_directory');
      if (!raw) return { total: 0, active: 0, prospects: 0, totalRevenue: 0, avgRate: 0, clients: [] };
      var data = JSON.parse(raw);
      var clients = data.clients || [];
      var active = clients.filter(function(c) { return c.status === 'active'; }).length;
      var prospects = clients.filter(function(c) { return c.status === 'prospect'; }).length;
      var totalRevenue = clients.reduce(function(sum, c) {
        return sum + (c.projects || []).reduce(function(s, p) { return s + (parseFloat(p.amount) || 0); }, 0);
      }, 0);
      var ratedClients = clients.filter(function(c) { return c.hourlyRate; });
      var avgRate = ratedClients.length > 0
        ? ratedClients.reduce(function(s, c) { return s + parseFloat(c.hourlyRate); }, 0) / ratedClients.length
        : 0;
      return { total: clients.length, active: active, prospects: prospects, totalRevenue: totalRevenue, avgRate: avgRate, clients: clients };
    } catch(e) {
      return { total: 0, active: 0, prospects: 0, totalRevenue: 0, avgRate: 0, clients: [] };
    }
  }

  function getSettings() {
    if (typeof CortexSettings !== 'undefined') {
      return {
        displayName: CortexSettings.get('user.displayName') || '',
        businessName: CortexSettings.get('business.name') || '',
        businessTitle: CortexSettings.get('business.title') || '',
        currency: CortexSettings.get('user.currency') || 'USD',
        currencySymbol: CortexSettings.getCurrencySymbol(CortexSettings.get('rates.defaultCurrency') || CortexSettings.get('user.currency') || 'USD'),
        rate: CortexSettings.get('rates.defaultHourlyRate') || 0,
        formattedRate: CortexSettings.getFormattedRate(),
        paymentTerms: CortexSettings.getPaymentTermsLabel(),
        isConfigured: CortexSettings.isConfigured()
      };
    }
    return { displayName: '', businessName: '', businessTitle: '', currency: 'USD', currencySymbol: '$', rate: 0, formattedRate: 'Not set', paymentTerms: 'Net 30', isConfigured: false };
  }

  function getTimerState() {
    if (typeof CortexTimeEngine !== 'undefined') {
      return {
        running: CortexTimeEngine.isTimerRunning(),
        state: CortexTimeEngine.getTimerState(),
        elapsed: CortexTimeEngine.getElapsedFormatted()
      };
    }
    return { running: false, state: null, elapsed: '00:00:00' };
  }

  // ── Activity Feed Generator ────────────────────────────────
  function buildActivityFeed() {
    var activities = [];

    // Time entries (recent)
    if (typeof CortexTimeEngine !== 'undefined') {
      var entries = CortexTimeEngine.getEntries();
      entries.slice(0, 5).forEach(function(e) {
        activities.push({
          type: 'time',
          icon: '⏱️',
          text: 'Tracked <strong>' + formatHours(e.hours) + 'h</strong> on ' + esc(e.project || 'Untitled'),
          time: e.date + 'T' + (e.endTime || '12:00'),
          ts: new Date(e.date + 'T' + (e.endTime || '12:00')).getTime()
        });
      });
    }

    // Client activity
    var clientData = getClientStats();
    clientData.clients.slice(0, 3).forEach(function(c) {
      activities.push({
        type: 'client',
        icon: '👤',
        text: (c.status === 'active' ? 'Active client' : 'Added') + ' <strong>' + esc(c.name) + '</strong>' + (c.company ? ' (' + esc(c.company) + ')' : ''),
        time: c.updatedAt || c.createdAt,
        ts: new Date(c.updatedAt || c.createdAt).getTime()
      });
    });

    // Follow-up reminders
    if (typeof CortexFollowUp !== 'undefined') {
      var pending = CortexFollowUp.getPending();
      pending.slice(0, 3).forEach(function(f) {
        activities.push({
          type: 'followup',
          icon: '🔔',
          text: 'Follow-up due for <strong>' + esc(f.clientName) + '</strong>' + (f.projectName ? ' — ' + esc(f.projectName) : ''),
          time: f.dueDate,
          ts: new Date(f.dueDate).getTime()
        });
      });
    }

    // Settings changes
    if (typeof CortexSettings !== 'undefined') {
      var settings = CortexSettings.get();
      if (settings._lastModified) {
        activities.push({
          type: 'settings',
          icon: '⚙️',
          text: 'Settings <strong>updated</strong>',
          time: settings._lastModified,
          ts: new Date(settings._lastModified).getTime()
        });
      }
    }

    // Sort by timestamp desc
    activities.sort(function(a, b) { return (b.ts || 0) - (a.ts || 0); });

    return activities.slice(0, 8);
  }

  // ── Render Functions ───────────────────────────────────────

  function renderHeader() {
    var settings = getSettings();
    var name = settings.displayName || settings.businessName || '';
    var greeting = getGreeting();

    var greetEl = $('#dash-greeting');
    if (greetEl) {
      greetEl.innerHTML = greeting + (name ? ', <span>' + esc(name) + '</span>' : '') + ' 👋';
    }

    var subEl = $('#dash-subtitle');
    if (subEl) {
      var timer = getTimerState();
      if (timer.running && timer.state) {
        subEl.textContent = '🟢 Timer running — ' + (timer.state.project || 'Untitled project');
      } else {
        subEl.textContent = 'Your freelance command center';
      }
    }

    var dateEl = $('#dash-date');
    if (dateEl) {
      dateEl.textContent = getTodayFormatted();
    }
  }

  function renderMetrics() {
    var timeStats = getTimeStats();
    var clientStats = getClientStats();
    var settings = getSettings();
    var sym = settings.currencySymbol;

    // Today Hours
    var todayH = $('#metric-today-hours');
    if (todayH) todayH.textContent = formatHours(timeStats.todayHours) + 'h';

    var todayEarn = $('#metric-today-earnings');
    if (todayEarn) todayEarn.innerHTML = formatCurrency(timeStats.todayBillable, sym);

    // Week Hours
    var weekH = $('#metric-week-hours');
    if (weekH) weekH.textContent = formatHours(timeStats.weekHours) + 'h';

    var weekEarn = $('#metric-week-earnings');
    if (weekEarn) weekEarn.innerHTML = formatCurrency(timeStats.weekBillable, sym);

    // Active Clients
    var activeC = $('#metric-active-clients');
    if (activeC) activeC.textContent = clientStats.active;

    var prospectC = $('#metric-prospects');
    if (prospectC) prospectC.textContent = clientStats.prospects + ' prospects';

    // Total Revenue
    var revEl = $('#metric-total-revenue');
    if (revEl) revEl.textContent = formatCurrency(clientStats.totalRevenue, sym);

    var projCount = $('#metric-project-count');
    if (projCount) {
      var totalProj = clientStats.clients.reduce(function(s, c) { return s + (c.projects || []).length; }, 0);
      projCount.textContent = totalProj + ' projects';
    }

    // Month hours
    var monthH = $('#metric-month-hours');
    if (monthH) monthH.textContent = formatHours(timeStats.monthHours) + 'h';

    var monthEarn = $('#metric-month-earnings');
    if (monthEarn) monthEarn.innerHTML = formatCurrency(timeStats.monthBillable, sym);

    // Rate
    var rateEl = $('#metric-rate');
    if (rateEl) rateEl.textContent = settings.formattedRate;
  }

  function renderTimer() {
    var timer = getTimerState();
    var display = $('#timer-display');
    var project = $('#timer-project');
    var client = $('#timer-client');
    var statusEl = $('#timer-status');
    var actions = $('#timer-actions');

    if (!display) return;

    if (timer.state && (timer.state.start || timer.state.paused)) {
      display.textContent = timer.elapsed;
      display.classList.remove('idle');
      if (project) project.textContent = timer.state.project || 'Untitled Project';
      if (client) client.textContent = timer.state.client || '';

      if (timer.state.paused) {
        if (statusEl) statusEl.innerHTML = '<span class="dot paused"></span> Paused';
        if (actions) actions.innerHTML =
          '<button class="timer-btn start" onclick="DashboardCore.resumeTimer()">▶ Resume</button>' +
          '<button class="timer-btn stop" onclick="DashboardCore.stopTimer()">■ Stop</button>';
      } else {
        if (statusEl) statusEl.innerHTML = '<span class="dot running"></span> Running';
        if (actions) actions.innerHTML =
          '<button class="timer-btn pause" onclick="DashboardCore.pauseTimer()">⏸ Pause</button>' +
          '<button class="timer-btn stop" onclick="DashboardCore.stopTimer()">■ Stop</button>';
      }
    } else {
      display.textContent = '00:00:00';
      display.classList.add('idle');
      if (project) project.textContent = 'No active timer';
      if (client) client.textContent = 'Start tracking to see time here';
      if (statusEl) statusEl.innerHTML = '<span class="dot stopped"></span> Idle';
      if (actions) actions.innerHTML =
        '<button class="timer-btn start" onclick="DashboardCore.quickStartTimer()">▶ Start Timer</button>';
    }
  }

  function renderWeeklyChart() {
    var container = $('#weekly-chart');
    if (!container) return;

    var dailyTotals = getDailyTotals();
    var maxH = Math.max.apply(null, dailyTotals.map(function(d) { return d.hours; }).concat([1]));
    var today = new Date().toISOString().split('T')[0];

    // Reverse to show Mon→Sun left-to-right
    var reversed = dailyTotals.slice().reverse();

    container.innerHTML = reversed.map(function(d) {
      var pct = Math.max((d.hours / maxH) * 100, 2);
      var isToday = d.date === today;
      var dayLabel = d.label.split(',')[0]; // "Mon"
      return '<div class="chart-bar-col">' +
        '<span class="chart-bar-val">' + (d.hours > 0 ? formatHours(d.hours) : '') + '</span>' +
        '<div class="chart-bar' + (isToday ? ' today' : '') + '" style="height:' + pct + '%"></div>' +
        '<span class="chart-bar-label">' + dayLabel + '</span>' +
        '</div>';
    }).join('');
  }

  function renderClientPipeline() {
    var container = $('#client-pipeline');
    if (!container) return;

    var clientData = getClientStats();
    var clients = clientData.clients.slice(0, 6);

    if (clients.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">👥</div><p>No clients yet</p></div>';
      return;
    }

    container.innerHTML = clients.map(function(c) {
      var revenue = (c.projects || []).reduce(function(s, p) { return s + (parseFloat(p.amount) || 0); }, 0);
      var status = c.status || 'inactive';
      return '<div class="pipeline-row">' +
        '<span class="pipeline-dot ' + status + '"></span>' +
        '<span class="pipeline-name">' + esc(c.name) + '</span>' +
        (c.company ? '<span class="pipeline-company">' + esc(c.company) + '</span>' : '') +
        '<span class="pipeline-revenue">' + formatCurrency(revenue) + '</span>' +
        '</div>';
    }).join('');
  }

  function renderProjectBreakdown() {
    var container = $('#project-breakdown');
    if (!container) return;

    var timeStats = getTimeStats();
    var projects = timeStats.byProject;
    var rate = timeStats.rate;
    var keys = Object.keys(projects).sort(function(a, b) { return projects[b] - projects[a]; });

    if (keys.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">📁</div><p>Track time to see project breakdown</p></div>';
      return;
    }

    container.innerHTML = keys.slice(0, 6).map(function(proj, i) {
      var hours = projects[proj];
      var color = PROJECT_COLORS[i % PROJECT_COLORS.length];
      return '<div class="project-row">' +
        '<span class="project-color" style="background:' + color + '"></span>' +
        '<span class="project-name">' + esc(proj) + '</span>' +
        '<span class="project-hours">' + formatHours(hours) + 'h</span>' +
        '<span class="project-amount">' + formatCurrency(hours * rate) + '</span>' +
        '</div>';
    }).join('');
  }

  function renderActivityFeed() {
    var container = $('#activity-feed');
    if (!container) return;

    var activities = buildActivityFeed();

    if (activities.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>Your recent activity will appear here</p></div>';
      return;
    }

    container.innerHTML = activities.map(function(a) {
      return '<div class="activity-item">' +
        '<div class="activity-icon ' + a.type + '">' + a.icon + '</div>' +
        '<div class="activity-text">' + a.text + '</div>' +
        '<span class="activity-time">' + timeAgo(a.time) + '</span>' +
        '</div>';
    }).join('');
  }

  function renderBusinessInfo() {
    var container = $('#business-info');
    if (!container) return;

    var settings = getSettings();

    if (!settings.isConfigured) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">⚙️</div><p>Configure your business in Settings</p>' +
        '<a href="settings.html" class="qa-btn primary" style="display:inline-flex;text-decoration:none">Open Settings</a></div>';
      return;
    }

    container.innerHTML =
      '<div class="biz-info">' +
      '<div class="biz-item"><div class="biz-item-label">Business</div><div class="biz-item-value">' + esc(settings.businessName || settings.displayName || 'Not set') + '</div></div>' +
      '<div class="biz-item"><div class="biz-item-label">Title</div><div class="biz-item-value">' + esc(settings.businessTitle || 'Not set') + '</div></div>' +
      '<div class="biz-item"><div class="biz-item-label">Hourly Rate</div><div class="biz-item-value">' + settings.formattedRate + '</div></div>' +
      '<div class="biz-item"><div class="biz-item-label">Payment Terms</div><div class="biz-item-value">' + esc(settings.paymentTerms) + '</div></div>' +
      '</div>';
  }

  // ── Full Render ────────────────────────────────────────────
  function renderProductivityAnalytics() {
    if (typeof ProductivityAnalytics !== 'undefined') {
      ProductivityAnalytics.renderProductivityWidget();
    }
  }

  function renderAll() {
    renderHeader();
    renderMetrics();
    renderTimer();
    renderWeeklyChart();
    renderClientPipeline();
    renderProjectBreakdown();
    renderProductivityAnalytics();
    renderActivityFeed();
    renderBusinessInfo();
  }

  // ── Timer Controls ─────────────────────────────────────────
  function quickStartTimer() {
    if (typeof CortexTimeEngine === 'undefined') return;
    var projects = CortexTimeEngine.getProjects();
    var project = projects.length > 0 ? projects[0] : 'General';
    CortexTimeEngine.startTimer({ project: project, desc: 'Dashboard quick start' });
    renderAll();
    showToast('Timer started — ' + project);
  }

  function stopTimer() {
    if (typeof CortexTimeEngine === 'undefined') return;
    var entry = CortexTimeEngine.stopTimer();
    renderAll();
    if (entry) {
      showToast('Saved ' + formatHours(entry.hours) + 'h to ' + (entry.project || 'Untitled'));
    }
  }

  function pauseTimer() {
    if (typeof CortexTimeEngine === 'undefined') return;
    CortexTimeEngine.pauseTimer();
    renderAll();
    showToast('Timer paused');
  }

  function resumeTimer() {
    if (typeof CortexTimeEngine === 'undefined') return;
    CortexTimeEngine.resumeTimer();
    renderAll();
    showToast('Timer resumed');
  }

  // ── Toast ──────────────────────────────────────────────────
  function showToast(message, type) {
    type = type || 'success';
    var toast = document.getElementById('toast');
    if (!toast) return;
    toast.className = 'toast ' + type;
    toast.innerHTML = (type === 'success' ? '✓' : '✕') + ' ' + esc(message);
    requestAnimationFrame(function() { toast.classList.add('active'); });
    setTimeout(function() { toast.classList.remove('active'); }, 3000);
  }

  // ── Auto-refresh ───────────────────────────────────────────
  var _refreshInterval = null;

  function startAutoRefresh() {
    // Update timer display every second if timer is running
    if (typeof CortexTimeEngine !== 'undefined') {
      CortexTimeEngine.onTimerTick(function(formatted) {
        var display = $('#timer-display');
        if (display) display.textContent = formatted;
      });
    }

    // Refresh all data every 30 seconds
    _refreshInterval = setInterval(function() {
      renderMetrics();
      renderWeeklyChart();
      renderClientPipeline();
      renderProjectBreakdown();
      renderActivityFeed();
    }, 30000);
  }

  function stopAutoRefresh() {
    if (_refreshInterval) {
      clearInterval(_refreshInterval);
      _refreshInterval = null;
    }
  }

  // ── Keyboard Shortcuts ─────────────────────────────────────
  function initKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
      // Ctrl/Cmd + Shift + T = Quick start timer
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        var timer = getTimerState();
        if (timer.running) {
          stopTimer();
        } else {
          quickStartTimer();
        }
      }
    });
  }

  // ── Init ───────────────────────────────────────────────────
  function init() {
    renderAll();
    startAutoRefresh();
    initKeyboardShortcuts();
  }

  // ── Public API ─────────────────────────────────────────────
  var DashboardCore = {
    init: init,
    renderAll: renderAll,
    quickStartTimer: quickStartTimer,
    stopTimer: stopTimer,
    pauseTimer: pauseTimer,
    resumeTimer: resumeTimer,
    showToast: showToast,
    getTimeStats: getTimeStats,
    getClientStats: getClientStats,
    getSettings: getSettings
  };

  global.DashboardCore = DashboardCore;

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Cleanup on unload
  window.addEventListener('beforeunload', stopAutoRefresh);

})(typeof window !== 'undefined' ? window : globalThis);
