/* ===== [249] SESSION LOG — Click & Navigation Tracker for Debugging ===== */
(function() {
  'use strict';

  var LOG_KEY = 'cortex_session_log';
  var MAX_ENTRIES = 200;

  function getLog() {
    try { return JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); }
    catch (e) { return []; }
  }

  function saveLog(log) {
    if (log.length > MAX_ENTRIES) log = log.slice(-MAX_ENTRIES);
    try { localStorage.setItem(LOG_KEY, JSON.stringify(log)); } catch (e) { /* quota */ }
  }

  function addEntry(type, data) {
    var log = getLog();
    log.push({
      type: type,
      data: data,
      url: window.location.pathname,
      timestamp: new Date().toISOString(),
      sessionId: getSessionId()
    });
    saveLog(log);
  }

  function getSessionId() {
    var sid = sessionStorage.getItem('cortex_session_id');
    if (!sid) {
      sid = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      sessionStorage.setItem('cortex_session_id', sid);
    }
    return sid;
  }

  // Track clicks
  document.addEventListener('click', function(e) {
    var target = e.target.closest('a, button, [onclick]');
    if (!target) return;
    var info = {
      tag: target.tagName.toLowerCase(),
      text: (target.textContent || '').trim().substring(0, 80),
      id: target.id || null,
      className: (target.className || '').substring(0, 100),
      href: target.href || null
    };
    addEntry('click', info);
  }, true);

  // Track page navigations
  addEntry('pageview', { referrer: document.referrer || null });

  // Track hash changes
  window.addEventListener('hashchange', function() {
    addEntry('hashchange', { hash: window.location.hash });
  });

  // Track visibility changes (tab switch)
  document.addEventListener('visibilitychange', function() {
    addEntry('visibility', { state: document.visibilityState });
  });

  // Expose for debugging
  window.CortexSessionLog = {
    getAll: getLog,
    clear: function() { localStorage.removeItem(LOG_KEY); },
    getSessionId: getSessionId
  };
})();
