/* ============================================
   CORTEX FREELANCER — Browser Notification System
   notifications.js
   ============================================
   Manages browser push notifications for:
   - Timer running > 8h (forgot to stop?)
   - Follow-up due today
   - Invoice overdue
   - Deadline in 24h
   Respects quiet hours. Click navigates to tool.
   ============================================ */
;(function(global) {
  'use strict';

  var STORAGE_KEY = 'cortex_browser_notif_state';
  var CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
  var EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;

  // localStorage keys we read from other modules
  var KEYS = {
    timerState:  'cortex_timer_state',
    followups:   'cortex_followup_reminders',
    invoices:    'cortex_invoices',
    projects:    'cortex_projects',
    settings:    'cortex_settings',
  };

  // ── Helpers ───────────────────────────────────────────────
  function loadJSON(key, fallback) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch(e) { return fallback; }
  }

  function saveJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); }
    catch(e) { /* silent */ }
  }

  function todayStr() { return new Date().toISOString().split('T')[0]; }

  function daysUntil(dateStr) {
    if (!dateStr) return Infinity;
    var target = new Date(dateStr); target.setHours(0,0,0,0);
    var today = new Date(); today.setHours(0,0,0,0);
    return Math.floor((target - today) / 86400000);
  }

  // ── State: track which notifications we already fired today ──
  function getState() {
    var st = loadJSON(STORAGE_KEY, { date: '', fired: [] });
    if (st.date !== todayStr()) {
      st = { date: todayStr(), fired: [] };
      saveJSON(STORAGE_KEY, st);
    }
    return st;
  }

  function markFired(id) {
    var st = getState();
    if (st.fired.indexOf(id) === -1) {
      st.fired.push(id);
      saveJSON(STORAGE_KEY, st);
    }
  }

  function wasFired(id) {
    return getState().fired.indexOf(id) !== -1;
  }

  // ── Quiet Hours ───────────────────────────────────────────
  function isQuietHours() {
    var settings = loadJSON(KEYS.settings, {});
    var notifSettings = (settings && settings.notifications) || {};
    var quietStart = notifSettings.quietHoursStart; // e.g. "22:00"
    var quietEnd = notifSettings.quietHoursEnd;     // e.g. "08:00"
    if (!quietStart || !quietEnd) return false;

    var now = new Date();
    var mins = now.getHours() * 60 + now.getMinutes();
    var startMins = parseTime(quietStart);
    var endMins = parseTime(quietEnd);

    if (startMins < endMins) {
      // same day range, e.g. 13:00 - 15:00
      return mins >= startMins && mins < endMins;
    }
    // overnight range, e.g. 22:00 - 08:00
    return mins >= startMins || mins < endMins;
  }

  function parseTime(str) {
    var parts = str.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1] || '0', 10);
  }

  // ── Permission ────────────────────────────────────────────
  function hasPermission() {
    return typeof Notification !== 'undefined' && Notification.permission === 'granted';
  }

  function requestPermission(cb) {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'granted') { if (cb) cb(true); return; }
    if (Notification.permission === 'denied') { if (cb) cb(false); return; }
    Notification.requestPermission().then(function(result) {
      if (cb) cb(result === 'granted');
    });
  }

  // ── Send Notification ─────────────────────────────────────
  function send(id, title, body, url, icon) {
    if (!hasPermission()) return;
    if (isQuietHours()) return;
    if (wasFired(id)) return;

    markFired(id);

    var notif = new Notification(title, {
      body: body,
      icon: icon || '/favicon.ico',
      tag: id,
      requireInteraction: false,
    });

    notif.onclick = function() {
      window.focus();
      if (url) window.location.href = url;
      notif.close();
    };
  }

  // ── Check: Timer Running > 8h ─────────────────────────────
  function checkTimerOverrun() {
    var timer = loadJSON(KEYS.timerState, null);
    if (!timer || !timer.running || !timer.startedAt) return;

    var elapsed = Date.now() - new Date(timer.startedAt).getTime();
    if (elapsed >= EIGHT_HOURS_MS) {
      var hours = Math.floor(elapsed / 3600000);
      send(
        'timer_overrun_' + todayStr(),
        'Timer still running!',
        'Your timer has been running for ' + hours + 'h. Did you forget to stop it?',
        '/app/tools/time-tracker.html',
        '/favicon.ico'
      );
    }
  }

  // ── Check: Follow-ups Due Today ────────────────────────────
  function checkFollowups() {
    var reminders = loadJSON(KEYS.followups, []);
    for (var i = 0; i < reminders.length; i++) {
      var r = reminders[i];
      if (r.status === 'completed' || r.status === 'dismissed') continue;
      var days = daysUntil(r.dueDate || r.due);
      if (days <= 0) {
        var label = r.label || r.type || 'Follow-up';
        var client = r.client || r.clientName || '';
        send(
          'followup_' + r.id,
          'Follow-up due: ' + label,
          client ? 'Client: ' + client : 'You have a follow-up due today.',
          '/app/tools/client-crm.html'
        );
      }
    }
  }

  // ── Check: Invoice Overdue ─────────────────────────────────
  function checkInvoices() {
    var invoices = loadJSON(KEYS.invoices, []);
    for (var i = 0; i < invoices.length; i++) {
      var inv = invoices[i];
      if (inv.status === 'paid' || inv.status === 'cancelled') continue;
      var due = inv.dueDate || inv.due;
      if (!due) continue;
      var days = daysUntil(due);
      if (days < 0) {
        var amount = inv.total || inv.amount || '';
        var cur = inv.currency || '$';
        send(
          'invoice_overdue_' + inv.id,
          'Invoice overdue',
          'Invoice #' + (inv.number || inv.id) + (amount ? ' (' + cur + amount + ')' : '') + ' is overdue by ' + Math.abs(days) + ' day(s).',
          '/app/tools/invoice.html'
        );
      }
    }
  }

  // ── Check: Deadline in 24h ─────────────────────────────────
  function checkDeadlines() {
    var projects = loadJSON(KEYS.projects, []);
    for (var i = 0; i < projects.length; i++) {
      var p = projects[i];
      if (p.status === 'completed' || p.status === 'archived') continue;
      var deadline = p.deadline || p.dueDate || p.endDate;
      if (!deadline) continue;
      var days = daysUntil(deadline);
      if (days === 0 || days === 1) {
        send(
          'deadline_' + p.id + '_' + todayStr(),
          'Deadline ' + (days === 0 ? 'today!' : 'tomorrow'),
          (p.name || p.title || 'Project') + ' is due ' + (days === 0 ? 'today' : 'tomorrow') + '.',
          '/app/tools/project-tracker.html'
        );
      }
    }
  }

  // ── Main Check Loop ───────────────────────────────────────
  var _intervalId = null;

  function runAllChecks() {
    if (!hasPermission()) return;
    if (isQuietHours()) return;

    checkTimerOverrun();
    checkFollowups();
    checkInvoices();
    checkDeadlines();
  }

  function start() {
    if (_intervalId) return;
    runAllChecks();
    _intervalId = setInterval(runAllChecks, CHECK_INTERVAL);
  }

  function stop() {
    if (_intervalId) {
      clearInterval(_intervalId);
      _intervalId = null;
    }
  }

  // ── Init: request permission & start checking ─────────────
  function init() {
    var settings = loadJSON(KEYS.settings, {});
    var notifEnabled = settings && settings.notifications && settings.notifications.browserNotifications;

    // Only auto-request if user has opted in via settings
    if (notifEnabled) {
      requestPermission(function(granted) {
        if (granted) start();
      });
    } else if (hasPermission()) {
      // Permission already granted from before, still respect settings toggle
      // Don't start unless browserNotifications is true
    }
  }

  // ── Public API ────────────────────────────────────────────
  var API = {
    init: init,
    start: start,
    stop: stop,
    requestPermission: requestPermission,
    hasPermission: hasPermission,
    isQuietHours: isQuietHours,
    runAllChecks: runAllChecks,
    send: send, // manual notification: send(id, title, body, url)
  };

  global.CortexBrowserNotifications = API;

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(typeof globalThis !== 'undefined' ? globalThis : this);
