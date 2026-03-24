/**
 * [CF-018] Job Keyword Alert System with Email Notifications
 * Users set keyword alerts, configure check intervals, notification queue for new matches.
 * Exposed as window.CortexFreelancer.JobAlerts
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_job_alerts';

  var CHECK_INTERVALS = [
    { value: 5, label: 'Every 5 minutes' },
    { value: 15, label: 'Every 15 minutes' },
    { value: 30, label: 'Every 30 minutes' },
    { value: 60, label: 'Every hour' },
    { value: 240, label: 'Every 4 hours' },
    { value: 1440, label: 'Once a day' }
  ];

  var NOTIFICATION_METHODS = [
    { value: 'email', label: 'Email' },
    { value: 'browser', label: 'Browser Notification' },
    { value: 'both', label: 'Email + Browser' }
  ];

  // ─── Mock Jobs Feed ─────────────────────────────────────────────────
  var MOCK_FEED = [
    { id: 'a001', title: 'Senior React Developer for SaaS Platform', skills: ['React', 'TypeScript', 'Node.js'], budget: '$60-90/hr', postedAt: Date.now() - 600000 },
    { id: 'a002', title: 'Python Data Pipeline Engineer', skills: ['Python', 'Airflow', 'PostgreSQL'], budget: '$5,000-8,000', postedAt: Date.now() - 1200000 },
    { id: 'a003', title: 'WordPress Theme Customization', skills: ['WordPress', 'PHP', 'CSS'], budget: '$200-500', postedAt: Date.now() - 1800000 },
    { id: 'a004', title: 'React Native Mobile App Developer', skills: ['React Native', 'JavaScript', 'Firebase'], budget: '$3,000-6,000', postedAt: Date.now() - 3600000 },
    { id: 'a005', title: 'DevOps Engineer — Kubernetes Setup', skills: ['Kubernetes', 'Docker', 'AWS'], budget: '$70-110/hr', postedAt: Date.now() - 5400000 },
    { id: 'a006', title: 'Full-Stack TypeScript Developer', skills: ['TypeScript', 'Next.js', 'Prisma'], budget: '$50-80/hr', postedAt: Date.now() - 7200000 },
    { id: 'a007', title: 'Machine Learning Model Optimization', skills: ['Python', 'PyTorch', 'MLOps'], budget: '$8,000-15,000', postedAt: Date.now() - 9000000 },
    { id: 'a008', title: 'UI/UX Designer for Fintech App', skills: ['Figma', 'UI Design', 'Prototyping'], budget: '$2,000-4,000', postedAt: Date.now() - 10800000 }
  ];

  // ─── State ──────────────────────────────────────────────────────────
  var state = {
    alerts: [],
    notifications: [],
    checkTimers: {},
    container: null
  };

  // ─── Persistence ────────────────────────────────────────────────────
  function loadAlerts() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  function saveAlerts() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.alerts)); } catch (e) { /* noop */ }
  }

  // ─── Alert Matching ─────────────────────────────────────────────────
  function matchJobToAlert(job, alert) {
    var keywords = alert.keywords.toLowerCase().split(',').map(function (k) { return k.trim(); }).filter(Boolean);
    var text = (job.title + ' ' + job.skills.join(' ')).toLowerCase();
    return keywords.some(function (kw) { return text.indexOf(kw) !== -1; });
  }

  function checkAlert(alert) {
    var matches = MOCK_FEED.filter(function (job) { return matchJobToAlert(job, alert); });
    var newMatches = matches.filter(function (job) {
      return !alert.seenJobIds || alert.seenJobIds.indexOf(job.id) === -1;
    });

    if (newMatches.length > 0) {
      if (!alert.seenJobIds) alert.seenJobIds = [];
      newMatches.forEach(function (job) {
        alert.seenJobIds.push(job.id);
        state.notifications.unshift({
          id: 'n' + Date.now() + Math.random().toString(36).substr(2, 4),
          alertName: alert.name,
          jobTitle: job.title,
          jobBudget: job.budget,
          method: alert.notifyMethod,
          timestamp: Date.now(),
          read: false
        });
      });
      alert.lastChecked = Date.now();
      alert.matchCount = (alert.matchCount || 0) + newMatches.length;
      saveAlerts();

      // Browser notification
      if ((alert.notifyMethod === 'browser' || alert.notifyMethod === 'both') && 'Notification' in window && Notification.permission === 'granted') {
        newMatches.forEach(function (job) {
          new Notification('Job Alert: ' + alert.name, { body: job.title + ' — ' + job.budget });
        });
      }
    }
    return newMatches;
  }

  function startAlertTimer(alert) {
    if (state.checkTimers[alert.id]) clearInterval(state.checkTimers[alert.id]);
    if (!alert.enabled) return;
    state.checkTimers[alert.id] = setInterval(function () {
      checkAlert(alert);
      if (state.container) render(state.container);
    }, alert.intervalMinutes * 60000);
  }

  // ─── Helpers ────────────────────────────────────────────────────────
  function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function timeAgo(ts) {
    var diff = Date.now() - ts;
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return mins + 'm ago';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    return Math.floor(hrs / 24) + 'd ago';
  }

  function generateId() { return 'alert_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6); }

  // ─── Render ─────────────────────────────────────────────────────────
  function render(containerId) {
    var container = typeof containerId === 'string'
      ? document.getElementById(containerId) || document.querySelector(containerId)
      : containerId;
    if (!container) return;
    state.container = container;

    container.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.style.cssText = 'font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#1a1a2e;color:#e0e0e0;border-radius:12px;padding:24px;max-width:900px;';

    var unreadCount = state.notifications.filter(function (n) { return !n.read; }).length;
    var html = '<h2 style="margin:0 0 20px;color:#00d4aa;font-size:22px;">Job Alerts' +
      (unreadCount > 0 ? ' <span style="background:#e74c3c;color:#fff;padding:2px 8px;border-radius:10px;font-size:13px;">' + unreadCount + ' new</span>' : '') +
      '</h2>';

    // New alert form
    html += '<div style="background:#16213e;border-radius:10px;padding:16px;margin-bottom:20px;border:1px solid #2d2d44;">' +
      '<h3 style="margin:0 0 12px;font-size:15px;color:#ccc;">Create New Alert</h3>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:12px;">' +
        '<div><label style="font-size:12px;color:#888;display:block;margin-bottom:4px;">Alert Name</label>' +
          '<input id="cf-ja-name" type="text" placeholder="e.g. React Jobs" style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:6px;border:1px solid #333;background:#0f3460;color:#e0e0e0;font-size:13px;"></div>' +
        '<div><label style="font-size:12px;color:#888;display:block;margin-bottom:4px;">Keywords (comma-separated)</label>' +
          '<input id="cf-ja-keywords" type="text" placeholder="react, typescript, node" style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:6px;border:1px solid #333;background:#0f3460;color:#e0e0e0;font-size:13px;"></div>' +
        '<div><label style="font-size:12px;color:#888;display:block;margin-bottom:4px;">Check Interval</label>' +
          '<select id="cf-ja-interval" style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:6px;border:1px solid #333;background:#0f3460;color:#e0e0e0;font-size:13px;">' +
          CHECK_INTERVALS.map(function (o) { return '<option value="' + o.value + '">' + o.label + '</option>'; }).join('') +
          '</select></div>' +
        '<div><label style="font-size:12px;color:#888;display:block;margin-bottom:4px;">Notify Via</label>' +
          '<select id="cf-ja-method" style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:6px;border:1px solid #333;background:#0f3460;color:#e0e0e0;font-size:13px;">' +
          NOTIFICATION_METHODS.map(function (o) { return '<option value="' + o.value + '">' + o.label + '</option>'; }).join('') +
          '</select></div>' +
      '</div>' +
      '<button id="cf-ja-create" style="padding:8px 20px;border-radius:6px;border:none;background:#00d4aa;color:#1a1a2e;font-weight:600;font-size:13px;cursor:pointer;">Create Alert</button>' +
      '</div>';

    // Active alerts
    html += '<h3 style="margin:0 0 12px;font-size:16px;color:#ccc;">Active Alerts (' + state.alerts.length + ')</h3>';

    if (state.alerts.length === 0) {
      html += '<div style="text-align:center;padding:24px;color:#666;background:#16213e;border-radius:10px;margin-bottom:20px;">No alerts configured. Create one above to get started.</div>';
    } else {
      state.alerts.forEach(function (alert, idx) {
        var statusColor = alert.enabled ? '#00d4aa' : '#666';
        html += '<div style="background:#16213e;border-radius:10px;padding:14px;margin-bottom:10px;border:1px solid #2d2d44;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">' +
          '<div style="flex:1;min-width:200px;">' +
            '<div style="display:flex;align-items:center;gap:8px;">' +
              '<span style="width:8px;height:8px;border-radius:50%;background:' + statusColor + ';display:inline-block;"></span>' +
              '<strong style="font-size:14px;">' + escapeHtml(alert.name) + '</strong>' +
            '</div>' +
            '<div style="font-size:12px;color:#888;margin-top:4px;">Keywords: <span style="color:#6c5ce7;">' + escapeHtml(alert.keywords) + '</span></div>' +
            '<div style="font-size:11px;color:#666;margin-top:2px;">' +
              CHECK_INTERVALS.find(function (o) { return o.value === alert.intervalMinutes; }).label +
              ' · ' + NOTIFICATION_METHODS.find(function (o) { return o.value === alert.notifyMethod; }).label +
              ' · ' + (alert.matchCount || 0) + ' matches' +
              (alert.lastChecked ? ' · Last checked: ' + timeAgo(alert.lastChecked) : '') +
            '</div>' +
          '</div>' +
          '<div style="display:flex;gap:6px;">' +
            '<button class="cf-ja-check" data-idx="' + idx + '" style="padding:6px 12px;border-radius:6px;border:1px solid #333;background:#0f3460;color:#00d4aa;font-size:12px;cursor:pointer;">Check Now</button>' +
            '<button class="cf-ja-toggle" data-idx="' + idx + '" style="padding:6px 12px;border-radius:6px;border:1px solid #333;background:#0f3460;color:' + (alert.enabled ? '#fdcb6e' : '#00d4aa') + ';font-size:12px;cursor:pointer;">' + (alert.enabled ? 'Pause' : 'Resume') + '</button>' +
            '<button class="cf-ja-delete" data-idx="' + idx + '" style="padding:6px 12px;border-radius:6px;border:1px solid #e74c3c;background:transparent;color:#e74c3c;font-size:12px;cursor:pointer;">Delete</button>' +
          '</div>' +
        '</div>';
      });
    }

    // Notification queue
    html += '<h3 style="margin:16px 0 12px;font-size:16px;color:#ccc;">Notification Queue (' + state.notifications.length + ')' +
      (state.notifications.length > 0 ? ' <button id="cf-ja-clear-notifs" style="padding:3px 10px;border-radius:4px;border:1px solid #555;background:transparent;color:#888;font-size:11px;cursor:pointer;margin-left:8px;">Clear All</button>' : '') +
      '</h3>';

    if (state.notifications.length === 0) {
      html += '<div style="text-align:center;padding:20px;color:#666;background:#16213e;border-radius:10px;">No notifications yet.</div>';
    } else {
      html += '<div style="max-height:300px;overflow-y:auto;">';
      state.notifications.slice(0, 50).forEach(function (notif) {
        var bg = notif.read ? '#16213e' : '#1a2744';
        var icon = notif.method === 'email' ? '&#9993;' : notif.method === 'browser' ? '&#128276;' : '&#9993;&#128276;';
        html += '<div class="cf-ja-notif" data-id="' + notif.id + '" style="background:' + bg + ';border-radius:8px;padding:10px 14px;margin-bottom:6px;border:1px solid #2d2d44;cursor:pointer;display:flex;justify-content:space-between;align-items:center;">' +
          '<div>' +
            '<span style="font-size:13px;color:#e0e0e0;">' + icon + ' <strong>' + escapeHtml(notif.alertName) + '</strong>: ' + escapeHtml(notif.jobTitle) + '</span>' +
            '<div style="font-size:11px;color:#888;margin-top:2px;">' + notif.jobBudget + ' · ' + timeAgo(notif.timestamp) + '</div>' +
          '</div>' +
          (notif.read ? '' : '<span style="width:8px;height:8px;border-radius:50%;background:#e74c3c;display:inline-block;flex-shrink:0;"></span>') +
        '</div>';
      });
      html += '</div>';
    }

    wrap.innerHTML = html;
    container.appendChild(wrap);
    bindEvents(wrap);
  }

  function bindEvents(wrap) {
    // Create alert
    wrap.querySelector('#cf-ja-create').addEventListener('click', function () {
      var name = wrap.querySelector('#cf-ja-name').value.trim();
      var keywords = wrap.querySelector('#cf-ja-keywords').value.trim();
      if (!name || !keywords) return;

      var alert = {
        id: generateId(),
        name: name,
        keywords: keywords,
        intervalMinutes: parseInt(wrap.querySelector('#cf-ja-interval').value, 10),
        notifyMethod: wrap.querySelector('#cf-ja-method').value,
        enabled: true,
        createdAt: Date.now(),
        lastChecked: null,
        matchCount: 0,
        seenJobIds: []
      };
      state.alerts.push(alert);
      saveAlerts();
      startAlertTimer(alert);
      render(state.container);
    });

    // Check now
    var checkBtns = wrap.querySelectorAll('.cf-ja-check');
    for (var i = 0; i < checkBtns.length; i++) {
      checkBtns[i].addEventListener('click', function () {
        var idx = parseInt(this.getAttribute('data-idx'), 10);
        checkAlert(state.alerts[idx]);
        render(state.container);
      });
    }

    // Toggle
    var toggleBtns = wrap.querySelectorAll('.cf-ja-toggle');
    for (var j = 0; j < toggleBtns.length; j++) {
      toggleBtns[j].addEventListener('click', function () {
        var idx = parseInt(this.getAttribute('data-idx'), 10);
        state.alerts[idx].enabled = !state.alerts[idx].enabled;
        saveAlerts();
        startAlertTimer(state.alerts[idx]);
        render(state.container);
      });
    }

    // Delete
    var delBtns = wrap.querySelectorAll('.cf-ja-delete');
    for (var k = 0; k < delBtns.length; k++) {
      delBtns[k].addEventListener('click', function () {
        var idx = parseInt(this.getAttribute('data-idx'), 10);
        var alert = state.alerts[idx];
        if (state.checkTimers[alert.id]) clearInterval(state.checkTimers[alert.id]);
        state.alerts.splice(idx, 1);
        saveAlerts();
        render(state.container);
      });
    }

    // Clear notifications
    var clearBtn = wrap.querySelector('#cf-ja-clear-notifs');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        state.notifications = [];
        render(state.container);
      });
    }

    // Mark notification read
    var notifEls = wrap.querySelectorAll('.cf-ja-notif');
    for (var m = 0; m < notifEls.length; m++) {
      notifEls[m].addEventListener('click', function () {
        var id = this.getAttribute('data-id');
        state.notifications.forEach(function (n) { if (n.id === id) n.read = true; });
        render(state.container);
      });
    }
  }

  // ─── Public API ─────────────────────────────────────────────────────
  function init() {
    state.alerts = loadAlerts();
    state.alerts.forEach(function (alert) { startAlertTimer(alert); });
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  function destroy() {
    Object.keys(state.checkTimers).forEach(function (id) { clearInterval(state.checkTimers[id]); });
    state.checkTimers = {};
    if (state.container) state.container.innerHTML = '';
    state.container = null;
  }

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.JobAlerts = {
    init: init,
    render: render,
    destroy: destroy,
    getAlerts: function () { return state.alerts.slice(); },
    getNotifications: function () { return state.notifications.slice(); },
    checkAll: function () {
      state.alerts.forEach(function (alert) { if (alert.enabled) checkAlert(alert); });
    }
  };
})();
