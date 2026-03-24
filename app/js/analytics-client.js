/**
 * CFX-043: Local-first analytics client
 * - No PII
 * - Anon session id in localStorage
 * - Offline queue + flush
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cfx_analytics_queue_v1';
  var SESSION_KEY = 'cfx_analytics_session_v1';
  var ANON_USER_KEY = 'cfx_analytics_anon_user_v1';

  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function getSessionId() {
    try {
      var id = localStorage.getItem(SESSION_KEY);
      if (!id) {
        id = 's_' + uuid();
        localStorage.setItem(SESSION_KEY, id);
      }
      return id;
    } catch (e) {
      return 's_' + Date.now();
    }
  }

  function getAnonUserId() {
    try {
      var id = localStorage.getItem(ANON_USER_KEY);
      if (!id) {
        id = 'u_' + uuid();
        localStorage.setItem(ANON_USER_KEY, id);
      }
      return id;
    } catch (e) {
      return null;
    }
  }

  function loadQueue() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function saveQueue(q) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(q.slice(-200))); } catch (e) {}
  }

  function enqueue(evt) {
    var q = loadQueue();
    q.push(evt);
    saveQueue(q);
  }

  function send(evt) {
    // Prefer sendBeacon for unload-safe, fallback to fetch
    try {
      var blob = new Blob([JSON.stringify(evt)], { type: 'application/json' });
      if (navigator.sendBeacon && navigator.sendBeacon('/api/analytics', blob)) {
        return Promise.resolve(true);
      }
    } catch (e) {}

    return fetch('/api/analytics', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(evt),
      keepalive: true
    }).then(function () { return true; }).catch(function () { return false; });
  }

  function flush() {
    var q = loadQueue();
    if (!q.length) return;

    // serialize to avoid stampedes
    var remaining = [];
    var p = Promise.resolve();
    q.forEach(function (evt) {
      p = p.then(function () {
        return send(evt).then(function (ok) {
          if (!ok) remaining.push(evt);
        });
      });
    });

    p.then(function () {
      saveQueue(remaining);
    });
  }

  function track(type, name, props) {
    props = props || {};
    var evt = {
      ts: Date.now(),
      type: type,
      name: name,
      sessionId: getSessionId(),
      anonUserId: getAnonUserId(),
      page: location.pathname,
      referrer: document.referrer || null,
      transport: props.transport || 'unknown',
      perf: props.perf || undefined,
      meta: props.meta || undefined
    };

    // send immediately; queue if fails
    send(evt).then(function (ok) {
      if (!ok) enqueue(evt);
    });
  }

  // Auto page view
  function pageView() {
    track('page', 'page_view');
  }

  window.CortexAnalytics = {
    track: track,
    flush: flush,
    pageView: pageView,
    getSessionId: getSessionId
  };

  // Flush on regain connectivity
  window.addEventListener('online', flush);

  // initial
  try { pageView(); } catch (e) {}
  // delayed flush
  setTimeout(flush, 2000);
})();
