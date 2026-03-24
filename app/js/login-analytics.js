/**
 * Cortex Freelancer — Login Analytics Tracking
 * [CF-220] Track login method, frequency, session duration,
 * and pages visited per session. Stores in Firestore analytics collection.
 *
 * @namespace window.CortexFreelancer.LoginAnalytics
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Constants ──────────────────────────────────────────────────

  var COLLECTION = 'login_analytics';
  var SESSION_KEY = 'cf_analytics_session';
  var LOCAL_QUEUE_KEY = 'cf_analytics_queue';
  var FLUSH_INTERVAL = 30000;
  var MAX_QUEUE_SIZE = 100;

  // ─── State ──────────────────────────────────────────────────────

  var session = null;
  var flushTimer = null;

  // ─── Helpers ────────────────────────────────────────────────────

  function getFirestore() {
    if (typeof firebase !== 'undefined' && firebase.firestore) {
      return firebase.firestore();
    }
    return null;
  }

  function generateSessionId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 8);
  }

  function getSession() {
    if (session) return session;
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        session = JSON.parse(raw);
        return session;
      }
    } catch (e) {
      // ignore
    }
    return null;
  }

  function saveSession(s) {
    session = s;
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    } catch (e) {
      // ignore
    }
  }

  function queueEvent(event) {
    try {
      var raw = localStorage.getItem(LOCAL_QUEUE_KEY);
      var queue = raw ? JSON.parse(raw) : [];
      queue.push(event);
      if (queue.length > MAX_QUEUE_SIZE) {
        queue = queue.slice(-MAX_QUEUE_SIZE);
      }
      localStorage.setItem(LOCAL_QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {
      // ignore
    }
  }

  function getQueue() {
    try {
      var raw = localStorage.getItem(LOCAL_QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function clearQueue() {
    try {
      localStorage.removeItem(LOCAL_QUEUE_KEY);
    } catch (e) {
      // ignore
    }
  }

  // ─── Firestore Operations ──────────────────────────────────────

  function writeToFirestore(uid, event) {
    var db = getFirestore();
    if (!db) {
      queueEvent(event);
      return Promise.resolve();
    }

    return db.collection(COLLECTION).add({
      uid: uid,
      event: event.type,
      data: event.data || {},
      sessionId: event.sessionId,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      clientTimestamp: event.timestamp
    }).catch(function (err) {
      console.warn('[LoginAnalytics] Firestore write failed, queuing:', err.message);
      queueEvent(event);
    });
  }

  function flushQueue(uid) {
    var queue = getQueue();
    if (queue.length === 0) return;

    var db = getFirestore();
    if (!db) return;

    var batch = db.batch();
    var count = Math.min(queue.length, 50);

    for (var i = 0; i < count; i++) {
      var ref = db.collection(COLLECTION).doc();
      batch.set(ref, {
        uid: uid,
        event: queue[i].type,
        data: queue[i].data || {},
        sessionId: queue[i].sessionId,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        clientTimestamp: queue[i].timestamp
      });
    }

    batch.commit().then(function () {
      var remaining = queue.slice(count);
      if (remaining.length > 0) {
        try {
          localStorage.setItem(LOCAL_QUEUE_KEY, JSON.stringify(remaining));
        } catch (e) { /* ignore */ }
      } else {
        clearQueue();
      }
    }).catch(function () {
      // keep queue for next flush
    });
  }

  // ─── Page Tracking ──────────────────────────────────────────────

  function trackPageVisit() {
    var s = getSession();
    if (!s) return;

    var page = window.location.pathname + window.location.hash;
    if (s.pages[s.pages.length - 1] === page) return;

    s.pages.push(page);
    s.pageCount = s.pages.length;
    saveSession(s);
  }

  function setupPageTracking() {
    // Track hash changes (SPA navigation)
    window.addEventListener('hashchange', trackPageVisit);

    // Track popstate
    window.addEventListener('popstate', trackPageVisit);

    // Track initial page
    trackPageVisit();
  }

  function setupSessionEnd(uid) {
    var endSession = function () {
      var s = getSession();
      if (!s) return;

      s.endedAt = Date.now();
      s.duration = s.endedAt - s.startedAt;

      var event = {
        type: 'session_end',
        sessionId: s.id,
        timestamp: Date.now(),
        data: {
          duration: s.duration,
          pageCount: s.pageCount,
          pages: s.pages
        }
      };

      // Use sendBeacon for reliability on page unload
      var db = getFirestore();
      if (db) {
        writeToFirestore(uid, event);
      } else {
        queueEvent(event);
      }

      if (flushTimer) clearInterval(flushTimer);
    };

    window.addEventListener('beforeunload', endSession);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') {
        endSession();
      }
    });
  }

  // ─── Public API ─────────────────────────────────────────────────

  window.CortexFreelancer.LoginAnalytics = {
    /**
     * Track a login event.
     * @param {{ uid: string, method: string, email?: string }} opts
     */
    trackLogin: function (opts) {
      var uid = opts.uid;
      var method = opts.method || 'unknown';

      var s = {
        id: generateSessionId(),
        uid: uid,
        method: method,
        startedAt: Date.now(),
        endedAt: null,
        duration: null,
        pages: [],
        pageCount: 0
      };
      saveSession(s);

      var event = {
        type: 'login',
        sessionId: s.id,
        timestamp: Date.now(),
        data: {
          method: method,
          email: opts.email || null,
          userAgent: navigator.userAgent
        }
      };

      writeToFirestore(uid, event);

      // Flush any queued events
      flushQueue(uid);

      // Start periodic flush
      if (flushTimer) clearInterval(flushTimer);
      flushTimer = setInterval(function () {
        flushQueue(uid);
      }, FLUSH_INTERVAL);

      setupPageTracking();
      setupSessionEnd(uid);
    },

    /**
     * Track a logout event.
     * @param {string} uid
     */
    trackLogout: function (uid) {
      var s = getSession();
      var sessionId = s ? s.id : 'unknown';
      var duration = s ? Date.now() - s.startedAt : 0;

      var event = {
        type: 'logout',
        sessionId: sessionId,
        timestamp: Date.now(),
        data: {
          duration: duration,
          pageCount: s ? s.pageCount : 0
        }
      };

      writeToFirestore(uid, event);

      session = null;
      try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
      if (flushTimer) clearInterval(flushTimer);
    },

    /**
     * Track a custom analytics event.
     * @param {string} uid
     * @param {string} eventType
     * @param {Object} [data]
     */
    track: function (uid, eventType, data) {
      var s = getSession();
      var event = {
        type: eventType,
        sessionId: s ? s.id : 'none',
        timestamp: Date.now(),
        data: data || {}
      };
      writeToFirestore(uid, event);
    },

    /** Get current session info. */
    getSession: function () {
      var s = getSession();
      if (!s) return null;
      return {
        id: s.id,
        method: s.method,
        startedAt: s.startedAt,
        duration: Date.now() - s.startedAt,
        pageCount: s.pageCount,
        pages: s.pages.slice()
      };
    }
  };
})();
