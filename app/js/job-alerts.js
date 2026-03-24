/**
 * [CF-018] Job Keyword Alert System with Email Notifications
 * Let users set keyword alerts, check periodically for new matches,
 * and notify via browser notifications and email webhook.
 *
 * window.CortexFreelancer.JobAlerts
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Constants ──────────────────────────────────────────────────────
  var STORAGE_KEY = 'cortex_job_alerts';
  var SEEN_KEY = 'cortex_job_alerts_seen';
  var DEFAULT_INTERVAL_MS = 600000; // 10 minutes
  var MAX_ALERTS = 20;
  var MAX_SEEN = 2000;

  var CSS_INJECTED = false;
  function injectCSS() {
    if (CSS_INJECTED) return;
    CSS_INJECTED = true;
    var style = document.createElement('style');
    style.textContent = [
      '.ja-panel{background:#111;border:1px solid #222;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;overflow:hidden}',
      '.ja-header{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:#151515;border-bottom:1px solid #222}',
      '.ja-header h2{margin:0;color:#e0e0e0;font-size:16px;font-weight:700}',
      '.ja-body{padding:16px 18px}',
      '.ja-form{display:flex;flex-direction:column;gap:12px;margin-bottom:20px;padding:16px;background:#151515;border:1px solid #222;border-radius:10px}',
      '.ja-form-title{color:#a78bfa;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}',
      '.ja-form-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}',
      '.ja-input{background:#1a1a1a;border:1px solid #333;color:#e0e0e0;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;flex:1;min-width:160px;transition:border-color .2s}',
      '.ja-input:focus{border-color:#7c3aed}',
      '.ja-input-sm{width:90px;flex:0}',
      '.ja-select{background:#1a1a1a;border:1px solid #333;color:#e0e0e0;border-radius:8px;padding:8px 12px;font-size:13px;cursor:pointer;outline:none}',
      '.ja-checkbox{display:flex;align-items:center;gap:6px;cursor:pointer}',
      '.ja-checkbox input{accent-color:#7c3aed;width:16px;height:16px}',
      '.ja-checkbox span{color:#ccc;font-size:13px}',
      '.ja-btn{border:none;border-radius:8px;padding:8px 18px;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s}',
      '.ja-btn-primary{background:#7c3aed;color:#fff}',
      '.ja-btn-primary:hover{background:#6d28d9}',
      '.ja-btn-danger{background:#dc2626;color:#fff}',
      '.ja-btn-danger:hover{background:#b91c1c}',
      '.ja-btn-secondary{background:#222;color:#aaa;border:1px solid #333}',
      '.ja-btn-secondary:hover{background:#2a2a2a;color:#fff}',
      '.ja-btn-sm{padding:5px 12px;font-size:12px}',
      '.ja-alert-list{display:flex;flex-direction:column;gap:10px}',
      '.ja-alert-card{background:#151515;border:1px solid #222;border-radius:10px;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px}',
      '.ja-alert-info{flex:1}',
      '.ja-alert-kw{color:#e0e0e0;font-size:14px;font-weight:600}',
      '.ja-alert-meta{color:#666;font-size:12px;margin-top:4px}',
      '.ja-alert-meta span{margin-right:12px}',
      '.ja-alert-status{font-size:11px;padding:3px 8px;border-radius:10px;font-weight:600}',
      '.ja-alert-status.active{background:#065f46;color:#34d399}',
      '.ja-alert-status.paused{background:#713f12;color:#fbbf24}',
      '.ja-alert-actions{display:flex;gap:6px}',
      '.ja-matches{margin-top:16px}',
      '.ja-matches-title{color:#888;font-size:13px;font-weight:600;margin-bottom:8px}',
      '.ja-match{padding:10px 14px;background:#0d0d0d;border:1px solid #1a1a1a;border-radius:8px;margin-bottom:6px}',
      '.ja-match-title{color:#e0e0e0;font-size:13px;font-weight:600}',
      '.ja-match-title a{color:#e0e0e0;text-decoration:none}',
      '.ja-match-title a:hover{color:#7c3aed}',
      '.ja-match-meta{color:#666;font-size:11px;margin-top:2px}',
      '.ja-empty{color:#555;font-size:13px;text-align:center;padding:20px}',
      '.ja-notification{position:fixed;top:20px;right:20px;background:#1e1b4b;border:1px solid #7c3aed;border-radius:12px;padding:14px 18px;color:#e0e0e0;font-size:13px;z-index:10000;max-width:360px;box-shadow:0 8px 24px rgba(0,0,0,.4);animation:ja-slide-in .3s ease}',
      '.ja-notification-title{font-weight:700;margin-bottom:4px}',
      '.ja-notification-close{position:absolute;top:8px;right:12px;background:none;border:none;color:#888;cursor:pointer;font-size:16px}',
      '@keyframes ja-slide-in{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}',
      '@media(max-width:600px){.ja-form-row{flex-direction:column}.ja-alert-card{flex-direction:column;align-items:flex-start}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  // ─── Helpers ────────────────────────────────────────────────────────
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  function generateId() {
    return 'alert_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  }

  function timeAgo(dateStr) {
    if (!dateStr) return '';
    var diff = Date.now() - new Date(dateStr).getTime();
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    var hours = Math.floor(mins / 60);
    if (hours < 24) return hours + 'h ago';
    var days = Math.floor(hours / 24);
    return days + 'd ago';
  }

  // ─── Storage ────────────────────────────────────────────────────────
  function loadAlerts() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveAlerts(alerts) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts.slice(0, MAX_ALERTS)));
    } catch (e) { /* quota */ }
  }

  function loadSeen() {
    try {
      var raw = localStorage.getItem(SEEN_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveSeen(seen) {
    try {
      var keys = Object.keys(seen);
      if (keys.length > MAX_SEEN) {
        var trimmed = {};
        var recent = keys.slice(-Math.floor(MAX_SEEN / 2));
        for (var i = 0; i < recent.length; i++) trimmed[recent[i]] = seen[recent[i]];
        seen = trimmed;
      }
      localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
    } catch (e) { /* quota */ }
  }

  // ─── Matching ───────────────────────────────────────────────────────
  function matchesAlert(job, alert) {
    var text = ((job.title || '') + ' ' + (job.description || '') + ' ' + ((job.skills || []).join(' '))).toLowerCase();

    var keywords = alert.keywords.toLowerCase().split(/\s+/).filter(Boolean);
    for (var i = 0; i < keywords.length; i++) {
      if (text.indexOf(keywords[i]) === -1) return false;
    }

    if (alert.budgetMin > 0 && job.budget) {
      var budget = parseFloat(String(job.budget).replace(/[^0-9.]/g, ''));
      if (!isNaN(budget) && budget < alert.budgetMin) return false;
    }

    if (alert.category) {
      var jobCat = (job.category || '').toLowerCase();
      if (jobCat && jobCat.indexOf(alert.category.toLowerCase()) === -1) return false;
    }

    return true;
  }

  function findMatches(jobs, alert, seen) {
    var matches = [];
    for (var i = 0; i < jobs.length; i++) {
      var jobKey = jobs[i].title + '|' + (jobs[i].url || jobs[i].id);
      if (seen[alert.id + ':' + jobKey]) continue;
      if (matchesAlert(jobs[i], alert)) {
        matches.push(jobs[i]);
      }
    }
    return matches;
  }

  // ─── Notifications ─────────────────────────────────────────────────
  function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  function sendBrowserNotification(title, body, url) {
    if ('Notification' in window && Notification.permission === 'granted') {
      var notif = new Notification(title, {
        body: body,
        icon: '🔔',
        tag: 'cortex-job-alert'
      });
      if (url) {
        notif.addEventListener('click', function () {
          window.open(url, '_blank');
        });
      }
      setTimeout(function () { notif.close(); }, 10000);
    }
  }

  function showInAppNotification(title, body) {
    var el = document.createElement('div');
    el.className = 'ja-notification';
    el.innerHTML = '<div class="ja-notification-title">' + esc(title) + '</div>' +
      '<div>' + esc(body) + '</div>' +
      '<button class="ja-notification-close">&times;</button>';

    document.body.appendChild(el);

    var closeBtn = el.querySelector('.ja-notification-close');
    closeBtn.addEventListener('click', function () { el.remove(); });
    setTimeout(function () { if (el.parentNode) el.remove(); }, 8000);
  }

  function sendEmailNotification(alert, matches, webhookURL) {
    if (!webhookURL || !matches.length) return;

    var payload = {
      alert: alert.keywords,
      matchCount: matches.length,
      matches: matches.slice(0, 5).map(function (j) {
        return { title: j.title, url: j.url, budget: j.budget };
      }),
      timestamp: new Date().toISOString()
    };

    if (window.fetch) {
      fetch(webhookURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(function () { /* silent */ });
    }
  }

  // ─── Check Cycle ───────────────────────────────────────────────────
  var checkTimers = {};

  function startChecking(alert, getJobs, webhookURL) {
    if (checkTimers[alert.id]) clearInterval(checkTimers[alert.id]);

    var interval = alert.intervalMs || DEFAULT_INTERVAL_MS;
    checkTimers[alert.id] = setInterval(function () {
      if (!alert.active) return;

      var jobs = [];
      if (typeof getJobs === 'function') {
        jobs = getJobs();
      } else if (window.CortexFreelancer.JobSearch) {
        var search = window.CortexFreelancer.JobSearch;
        jobs = typeof search.getAllJobs === 'function' ? search.getAllJobs() : [];
      }

      var seen = loadSeen();
      var matches = findMatches(jobs, alert, seen);

      if (matches.length > 0) {
        for (var i = 0; i < matches.length; i++) {
          var key = alert.id + ':' + matches[i].title + '|' + (matches[i].url || matches[i].id);
          seen[key] = Date.now();
        }
        saveSeen(seen);

        alert.lastMatch = new Date().toISOString();
        alert.totalMatches = (alert.totalMatches || 0) + matches.length;
        alert.recentMatches = matches.slice(0, 5);
        saveAlerts(loadAlerts().map(function (a) { return a.id === alert.id ? alert : a; }));

        var title = '🔔 ' + matches.length + ' new job' + (matches.length > 1 ? 's' : '') + ' for "' + alert.keywords + '"';
        var body = matches[0].title + (matches.length > 1 ? ' and ' + (matches.length - 1) + ' more' : '');

        if (alert.browserNotify !== false) {
          sendBrowserNotification(title, body, matches[0].url);
        }
        showInAppNotification(title, body);
        sendEmailNotification(alert, matches, webhookURL);

        if (alert.onMatch) alert.onMatch(matches, alert);
      }
    }, interval);
  }

  function stopChecking(alertId) {
    if (checkTimers[alertId]) {
      clearInterval(checkTimers[alertId]);
      delete checkTimers[alertId];
    }
  }

  function stopAll() {
    for (var id in checkTimers) {
      clearInterval(checkTimers[id]);
    }
    checkTimers = {};
  }

  // ─── Render ─────────────────────────────────────────────────────────
  function renderPanel(container, state) {
    injectCSS();
    var alerts = state.alerts;

    var h = '<div class="ja-panel">';
    h += '<div class="ja-header"><h2>🔔 Job Alerts</h2></div>';
    h += '<div class="ja-body">';

    h += '<div class="ja-form">';
    h += '<div class="ja-form-title">Create New Alert</div>';
    h += '<div class="ja-form-row">';
    h += '<input type="text" class="ja-input" id="ja-keywords" placeholder="Keywords (e.g. React, Python, UI design)">';
    h += '</div>';
    h += '<div class="ja-form-row">';
    h += '<input type="number" class="ja-input ja-input-sm" id="ja-budgetMin" placeholder="Min $" min="0">';
    h += '<select class="ja-select" id="ja-interval">';
    h += '<option value="300000">Every 5 min</option>';
    h += '<option value="600000" selected>Every 10 min</option>';
    h += '<option value="1800000">Every 30 min</option>';
    h += '<option value="3600000">Every hour</option>';
    h += '</select>';
    h += '<label class="ja-checkbox"><input type="checkbox" id="ja-browserNotify" checked><span>Browser alerts</span></label>';
    h += '<button class="ja-btn ja-btn-primary" data-ja="create">Create Alert</button>';
    h += '</div>';
    h += '</div>';

    if (alerts.length === 0) {
      h += '<div class="ja-empty">No alerts set up yet. Create one above to get notified of new matching jobs.</div>';
    } else {
      h += '<div class="ja-alert-list">';
      for (var i = 0; i < alerts.length; i++) {
        var a = alerts[i];
        h += '<div class="ja-alert-card" data-alert-id="' + esc(a.id) + '">';
        h += '<div class="ja-alert-info">';
        h += '<div class="ja-alert-kw">' + esc(a.keywords) + '</div>';
        h += '<div class="ja-alert-meta">';
        if (a.budgetMin > 0) h += '<span>Min $' + a.budgetMin + '</span>';
        h += '<span>Every ' + Math.round((a.intervalMs || DEFAULT_INTERVAL_MS) / 60000) + 'min</span>';
        if (a.totalMatches) h += '<span>' + a.totalMatches + ' matches</span>';
        if (a.lastMatch) h += '<span>Last: ' + timeAgo(a.lastMatch) + '</span>';
        h += '</div>';

        if (a.recentMatches && a.recentMatches.length > 0) {
          h += '<div class="ja-matches">';
          h += '<div class="ja-matches-title">Recent matches:</div>';
          for (var m = 0; m < Math.min(a.recentMatches.length, 3); m++) {
            var match = a.recentMatches[m];
            h += '<div class="ja-match">';
            h += '<div class="ja-match-title"><a href="' + esc(match.url || '#') + '" target="_blank">' + esc(match.title) + '</a></div>';
            if (match.budget) h += '<div class="ja-match-meta">$' + esc(match.budget) + '</div>';
            h += '</div>';
          }
          h += '</div>';
        }

        h += '</div>';
        h += '<span class="ja-alert-status ' + (a.active ? 'active' : 'paused') + '">' + (a.active ? 'Active' : 'Paused') + '</span>';
        h += '<div class="ja-alert-actions">';
        h += '<button class="ja-btn ja-btn-secondary ja-btn-sm" data-ja="toggle" data-id="' + esc(a.id) + '">' + (a.active ? 'Pause' : 'Resume') + '</button>';
        h += '<button class="ja-btn ja-btn-danger ja-btn-sm" data-ja="delete" data-id="' + esc(a.id) + '">Delete</button>';
        h += '</div>';
        h += '</div>';
      }
      h += '</div>';
    }

    h += '</div></div>';
    container.innerHTML = h;
  }

  // ─── Init ──────────────────────────────────────────────────────────
  function init(containerId, options) {
    var opts = options || {};
    var container = typeof containerId === 'string'
      ? document.getElementById(containerId) || document.querySelector(containerId)
      : containerId;
    if (!container) return null;

    requestNotificationPermission();

    var state = {
      alerts: loadAlerts(),
      webhookURL: opts.webhookURL || '',
      getJobs: opts.getJobs || null
    };

    for (var i = 0; i < state.alerts.length; i++) {
      if (state.alerts[i].active) {
        startChecking(state.alerts[i], state.getJobs, state.webhookURL);
      }
    }

    function update() {
      renderPanel(container, state);
      bindEvents();
    }

    function bindEvents() {
      var createBtn = container.querySelector('[data-ja="create"]');
      if (createBtn) {
        createBtn.addEventListener('click', function () {
          var kwInput = document.getElementById('ja-keywords');
          var kw = kwInput ? kwInput.value.trim() : '';
          if (!kw) return;

          var budgetMin = parseInt((document.getElementById('ja-budgetMin') || {}).value, 10) || 0;
          var intervalMs = parseInt((document.getElementById('ja-interval') || {}).value, 10) || DEFAULT_INTERVAL_MS;
          var browserNotify = document.getElementById('ja-browserNotify') ? document.getElementById('ja-browserNotify').checked : true;

          var alert = {
            id: generateId(),
            keywords: kw,
            budgetMin: budgetMin,
            category: '',
            intervalMs: intervalMs,
            browserNotify: browserNotify,
            active: true,
            createdAt: new Date().toISOString(),
            lastMatch: null,
            totalMatches: 0,
            recentMatches: []
          };

          state.alerts.push(alert);
          saveAlerts(state.alerts);
          startChecking(alert, state.getJobs, state.webhookURL);
          update();
        });
      }

      var toggleBtns = container.querySelectorAll('[data-ja="toggle"]');
      for (var t = 0; t < toggleBtns.length; t++) {
        toggleBtns[t].addEventListener('click', function () {
          var id = this.getAttribute('data-id');
          for (var j = 0; j < state.alerts.length; j++) {
            if (state.alerts[j].id === id) {
              state.alerts[j].active = !state.alerts[j].active;
              if (state.alerts[j].active) {
                startChecking(state.alerts[j], state.getJobs, state.webhookURL);
              } else {
                stopChecking(id);
              }
              break;
            }
          }
          saveAlerts(state.alerts);
          update();
        });
      }

      var deleteBtns = container.querySelectorAll('[data-ja="delete"]');
      for (var d = 0; d < deleteBtns.length; d++) {
        deleteBtns[d].addEventListener('click', function () {
          var id = this.getAttribute('data-id');
          stopChecking(id);
          state.alerts = state.alerts.filter(function (a) { return a.id !== id; });
          saveAlerts(state.alerts);
          update();
        });
      }
    }

    update();

    return {
      getAlerts: function () { return state.alerts; },
      addAlert: function (kw, opts) {
        var a = {
          id: generateId(),
          keywords: kw,
          budgetMin: (opts && opts.budgetMin) || 0,
          category: (opts && opts.category) || '',
          intervalMs: (opts && opts.intervalMs) || DEFAULT_INTERVAL_MS,
          browserNotify: opts ? opts.browserNotify !== false : true,
          active: true,
          createdAt: new Date().toISOString(),
          lastMatch: null,
          totalMatches: 0,
          recentMatches: []
        };
        state.alerts.push(a);
        saveAlerts(state.alerts);
        startChecking(a, state.getJobs, state.webhookURL);
        update();
        return a;
      },
      removeAlert: function (id) {
        stopChecking(id);
        state.alerts = state.alerts.filter(function (a) { return a.id !== id; });
        saveAlerts(state.alerts);
        update();
      },
      checkNow: function (jobs) {
        var seen = loadSeen();
        var allMatches = [];
        for (var i = 0; i < state.alerts.length; i++) {
          if (!state.alerts[i].active) continue;
          var matches = findMatches(jobs, state.alerts[i], seen);
          allMatches = allMatches.concat(matches);
        }
        return allMatches;
      },
      destroy: function () { stopAll(); container.innerHTML = ''; }
    };
  }

  // ─── Programmatic API (no UI) ──────────────────────────────────────
  function createAlert(keywords, options) {
    var alerts = loadAlerts();
    var alert = {
      id: generateId(),
      keywords: keywords,
      budgetMin: (options && options.budgetMin) || 0,
      category: (options && options.category) || '',
      intervalMs: (options && options.intervalMs) || DEFAULT_INTERVAL_MS,
      browserNotify: true,
      active: true,
      createdAt: new Date().toISOString(),
      lastMatch: null,
      totalMatches: 0,
      recentMatches: []
    };
    alerts.push(alert);
    saveAlerts(alerts);
    return alert;
  }

  function checkAlerts(jobs) {
    var alerts = loadAlerts();
    var seen = loadSeen();
    var results = [];

    for (var i = 0; i < alerts.length; i++) {
      if (!alerts[i].active) continue;
      var matches = findMatches(jobs, alerts[i], seen);
      if (matches.length > 0) {
        results.push({ alert: alerts[i], matches: matches });
        for (var m = 0; m < matches.length; m++) {
          var key = alerts[i].id + ':' + matches[m].title + '|' + (matches[m].url || matches[m].id);
          seen[key] = Date.now();
        }
      }
    }

    saveSeen(seen);
    return results;
  }

  // ─── Public API ────────────────────────────────────────────────────
  window.CortexFreelancer.JobAlerts = {
    init: init,
    createAlert: createAlert,
    checkAlerts: checkAlerts,
    getAlerts: loadAlerts,
    matchesAlert: matchesAlert,
    version: '1.0.0'
  };

})();
