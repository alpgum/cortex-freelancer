/**
 * Cortex Freelancer — Time Engine v1.0
 * 
 * Standalone time tracking engine with localStorage persistence.
 * Designed for cross-tool import: invoice generator, income dashboard,
 * weekly summary, project tracker, etc.
 * 
 * Usage:
 *   <script src="js/time-engine.js"></script>
 *   const engine = CortexTimeEngine;
 *   engine.startTimer({ project: 'Website', client: 'Acme', desc: 'Homepage' });
 *   engine.stopTimer();  // returns the saved entry
 *   engine.getEntries(); // all persisted entries
 * 
 * Or as ES module:
 *   import { CortexTimeEngine } from './js/time-engine.js';
 */

;(function(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CortexTimeEngine = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  /* ======== Storage Keys ======== */
  var KEYS = {
    entries:    'cortex_time_entries',
    projects:   'cortex_time_projects',
    clients:    'cortex_time_clients',
    rate:       'cortex_time_rate',
    timerState: 'cortex_timer_state'
  };

  /* ======== Low-level persistence ======== */
  function getJSON(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch(e) { return fallback; }
  }
  function setJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); }
    catch(e) { console.warn('[time-engine] localStorage write failed', e); }
  }

  /* ======== Date helpers ======== */
  function todayStr() { return new Date().toISOString().split('T')[0]; }

  function weekStartStr() {
    var d = new Date();
    d.setDate(d.getDate() - d.getDay());
    return d.toISOString().split('T')[0];
  }

  function lastWeekRange() {
    var d = new Date();
    d.setDate(d.getDate() - d.getDay() - 7);
    var start = d.toISOString().split('T')[0];
    d.setDate(d.getDate() + 6);
    return { start: start, end: d.toISOString().split('T')[0] };
  }

  function monthStr() { return todayStr().substring(0, 7); }

  function timeToMinutes(t) {
    var p = t.split(':');
    return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  function dateFromTs(ts) {
    var d = new Date(ts);
    return {
      date: d.toISOString().split('T')[0],
      time: pad2(d.getHours()) + ':' + pad2(d.getMinutes())
    };
  }

  function generateId() { return Date.now() + Math.floor(Math.random() * 1000); }

  /* ======== Entries CRUD ======== */
  function getEntries() { return getJSON(KEYS.entries, []); }
  function saveEntries(entries) { setJSON(KEYS.entries, entries); }

  function addEntry(entry) {
    if (!entry.id) entry.id = generateId();
    if (!entry.date) entry.date = todayStr();
    if (!entry.project) entry.project = 'Untitled';
    if (typeof entry.hours !== 'number' && entry.startTime && entry.endTime) {
      var sm = timeToMinutes(entry.startTime);
      var em = timeToMinutes(entry.endTime);
      entry.hours = em > sm ? Math.round((em - sm) / 60 * 100) / 100 : 0;
    }
    var entries = getEntries();
    entries.unshift(entry);
    saveEntries(entries);
    return entry;
  }

  function updateEntry(id, updates) {
    var entries = getEntries();
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].id === id) {
        for (var k in updates) {
          if (updates.hasOwnProperty(k)) entries[i][k] = updates[k];
        }
        // Recalc hours if times changed
        if (entries[i].startTime && entries[i].endTime) {
          var sm = timeToMinutes(entries[i].startTime);
          var em = timeToMinutes(entries[i].endTime);
          if (em > sm) entries[i].hours = Math.round((em - sm) / 60 * 100) / 100;
        }
        saveEntries(entries);
        return entries[i];
      }
    }
    return null;
  }

  function deleteEntry(id) {
    var entries = getEntries().filter(function(e) { return e.id !== id; });
    saveEntries(entries);
    return entries;
  }

  function clearEntries() {
    localStorage.removeItem(KEYS.entries);
  }

  /* ======== Projects & Clients ======== */
  function getProjects() { return getJSON(KEYS.projects, []); }
  function saveProjects(p) { setJSON(KEYS.projects, p); }
  function getClients() { return getJSON(KEYS.clients, []); }
  function saveClients(c) { setJSON(KEYS.clients, c); }

  function ensureProject(name) {
    if (!name) return;
    var list = getProjects();
    if (list.indexOf(name) === -1) {
      list.push(name);
      list.sort();
      saveProjects(list);
    }
  }

  function ensureClient(name) {
    if (!name) return;
    var list = getClients();
    if (list.indexOf(name) === -1) {
      list.push(name);
      list.sort();
      saveClients(list);
    }
  }

  function addProject(name) {
    if (!name || !name.trim()) return false;
    name = name.trim();
    var list = getProjects();
    if (list.indexOf(name) !== -1) return false;
    list.push(name);
    list.sort();
    saveProjects(list);
    return true;
  }

  function removeProject(name) {
    saveProjects(getProjects().filter(function(p) { return p !== name; }));
  }

  function addClient(name) {
    if (!name || !name.trim()) return false;
    name = name.trim();
    var list = getClients();
    if (list.indexOf(name) !== -1) return false;
    list.push(name);
    list.sort();
    saveClients(list);
    return true;
  }

  function removeClient(name) {
    saveClients(getClients().filter(function(c) { return c !== name; }));
  }

  /* ======== Hourly Rate ======== */
  function getRate() { return parseFloat(localStorage.getItem(KEYS.rate)) || 0; }
  function setRate(r) { localStorage.setItem(KEYS.rate, String(r)); }

  /* ======== Timer (start / stop / pause) ======== */
  var _timerInterval = null;
  var _timerCallbacks = [];

  function getTimerState() { return getJSON(KEYS.timerState, null); }

  function isTimerRunning() {
    var state = getTimerState();
    return !!(state && state.start);
  }

  function startTimer(opts) {
    opts = opts || {};
    var state = {
      start: Date.now(),
      project: opts.project || '',
      client: opts.client || '',
      desc: opts.desc || ''
    };
    setJSON(KEYS.timerState, state);
    ensureProject(state.project);
    ensureClient(state.client);
    _startTicking();
    return state;
  }

  function stopTimer() {
    var state = getTimerState();
    if (!state || !state.start) return null;

    _stopTicking();
    var startMs = state.start;
    var endMs = Date.now();
    var elapsedH = (endMs - startMs) / 3600000;

    var startInfo = dateFromTs(startMs);
    var endInfo = dateFromTs(endMs);

    var entry = addEntry({
      date: startInfo.date,
      startTime: startInfo.time,
      endTime: endInfo.time,
      hours: Math.round(elapsedH * 100) / 100,
      project: state.project || 'Untitled',
      client: state.client || '',
      desc: state.desc || 'Timer session'
    });

    localStorage.removeItem(KEYS.timerState);
    return entry;
  }

  function pauseTimer() {
    // Save elapsed so far, remove running state
    var state = getTimerState();
    if (!state || !state.start) return null;
    _stopTicking();

    var elapsed = Date.now() - state.start;
    state.paused = true;
    state.elapsed = elapsed;
    state.start = null;
    setJSON(KEYS.timerState, state);
    return state;
  }

  function resumeTimer() {
    var state = getTimerState();
    if (!state || !state.paused) return null;

    state.start = Date.now() - (state.elapsed || 0);
    state.paused = false;
    delete state.elapsed;
    setJSON(KEYS.timerState, state);
    _startTicking();
    return state;
  }

  function getElapsed() {
    var state = getTimerState();
    if (!state) return 0;
    if (state.paused) return state.elapsed || 0;
    if (state.start) return Date.now() - state.start;
    return 0;
  }

  function getElapsedFormatted() {
    var ms = getElapsed();
    var totalSec = Math.floor(ms / 1000);
    var h = pad2(Math.floor(totalSec / 3600));
    var m = pad2(Math.floor((totalSec % 3600) / 60));
    var s = pad2(totalSec % 60);
    return h + ':' + m + ':' + s;
  }

  function onTimerTick(cb) {
    _timerCallbacks.push(cb);
  }

  function _startTicking() {
    _stopTicking();
    _timerInterval = setInterval(function() {
      var formatted = getElapsedFormatted();
      _timerCallbacks.forEach(function(cb) { cb(formatted, getElapsed()); });
    }, 1000);
  }

  function _stopTicking() {
    if (_timerInterval) {
      clearInterval(_timerInterval);
      _timerInterval = null;
    }
  }

  // Auto-restore ticking if timer was running on load
  function _autoRestore() {
    var state = getTimerState();
    if (state && state.start && !state.paused) {
      _startTicking();
    }
  }

  /* ======== Filtering ======== */
  function filterEntries(opts) {
    opts = opts || {};
    var entries = getEntries();
    var today = todayStr();
    var ws = weekStartStr();
    var ms = monthStr();
    var lw = lastWeekRange();

    return entries.filter(function(e) {
      // Date range filter
      if (opts.view === 'today' && e.date !== today) return false;
      if (opts.view === 'week' && e.date < ws) return false;
      if (opts.view === 'lastweek' && (e.date < lw.start || e.date > lw.end)) return false;
      if (opts.view === 'month' && e.date.substring(0, 7) !== ms) return false;
      if (opts.view === 'custom') {
        if (opts.from && e.date < opts.from) return false;
        if (opts.to && e.date > opts.to) return false;
      }
      // Project/client filter
      if (opts.project && e.project !== opts.project) return false;
      if (opts.client && e.client !== opts.client) return false;
      return true;
    });
  }

  /* ======== Stats / Aggregation ======== */
  function getStats(opts) {
    var entries = opts ? filterEntries(opts) : getEntries();
    var rate = getRate();
    var today = todayStr();
    var ws = weekStartStr();
    var ms = monthStr();

    var totalH = 0, todayH = 0, weekH = 0, monthH = 0;
    var byProject = {};
    var byClient = {};
    var byDate = {};

    entries.forEach(function(e) {
      var h = e.hours || 0;
      totalH += h;
      if (e.date === today) todayH += h;
      if (e.date >= ws) weekH += h;
      if (e.date.substring(0, 7) === ms) monthH += h;

      var proj = e.project || 'Untitled';
      var cli = e.client || 'No Client';
      byProject[proj] = (byProject[proj] || 0) + h;
      byClient[cli] = (byClient[cli] || 0) + h;
      byDate[e.date] = (byDate[e.date] || 0) + h;
    });

    return {
      totalHours: totalH,
      todayHours: todayH,
      weekHours: weekH,
      monthHours: monthH,
      totalBillable: totalH * rate,
      todayBillable: todayH * rate,
      weekBillable: weekH * rate,
      monthBillable: monthH * rate,
      entryCount: entries.length,
      rate: rate,
      byProject: byProject,
      byClient: byClient,
      byDate: byDate
    };
  }

  function getDailyTotals(days) {
    days = days || 7;
    var entries = getEntries();
    var result = [];
    for (var i = 0; i < days; i++) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      var ds = d.toISOString().split('T')[0];
      var dayLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      var hours = 0;
      entries.forEach(function(e) {
        if (e.date === ds) hours += (e.hours || 0);
      });
      result.push({ date: ds, label: dayLabel, hours: hours, billable: hours * getRate() });
    }
    return result;
  }

  function getWeeklyTotal() {
    var ws = weekStartStr();
    var entries = getEntries();
    var total = 0;
    entries.forEach(function(e) {
      if (e.date >= ws) total += (e.hours || 0);
    });
    return { hours: total, billable: total * getRate() };
  }

  /* ======== CSV Export ======== */
  function toCSV(opts) {
    var entries = opts ? filterEntries(opts) : getEntries();
    var rate = getRate();
    var lines = ['Date,Start Time,End Time,Project,Client,Hours,Amount,Description'];
    entries.forEach(function(e) {
      var amount = ((e.hours || 0) * rate).toFixed(2);
      lines.push(
        '"' + e.date + '",' +
        '"' + (e.startTime || '') + '",' +
        '"' + (e.endTime || '') + '",' +
        '"' + (e.project || '').replace(/"/g, '""') + '",' +
        '"' + (e.client || '').replace(/"/g, '""') + '",' +
        (e.hours || 0) + ',' +
        amount + ',' +
        '"' + (e.desc || '').replace(/"/g, '""') + '"'
      );
    });
    return lines.join('\n');
  }

  /* ======== Public API ======== */
  var api = {
    // Version
    version: '1.0.0',

    // Entries CRUD
    getEntries: getEntries,
    addEntry: addEntry,
    updateEntry: updateEntry,
    deleteEntry: deleteEntry,
    clearEntries: clearEntries,

    // Projects & Clients
    getProjects: getProjects,
    getClients: getClients,
    addProject: addProject,
    removeProject: removeProject,
    addClient: addClient,
    removeClient: removeClient,
    ensureProject: ensureProject,
    ensureClient: ensureClient,

    // Rate
    getRate: getRate,
    setRate: setRate,

    // Timer
    startTimer: startTimer,
    stopTimer: stopTimer,
    pauseTimer: pauseTimer,
    resumeTimer: resumeTimer,
    isTimerRunning: isTimerRunning,
    getTimerState: getTimerState,
    getElapsed: getElapsed,
    getElapsedFormatted: getElapsedFormatted,
    onTimerTick: onTimerTick,

    // Filtering & Stats
    filterEntries: filterEntries,
    getStats: getStats,
    getDailyTotals: getDailyTotals,
    getWeeklyTotal: getWeeklyTotal,

    // Export
    toCSV: toCSV,

    // Helpers (useful for other tools)
    todayStr: todayStr,
    weekStartStr: weekStartStr,
    monthStr: monthStr,
    KEYS: KEYS
  };

  // Auto-restore timer on load
  if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _autoRestore);
    } else {
      _autoRestore();
    }
  }

  return api;
});
