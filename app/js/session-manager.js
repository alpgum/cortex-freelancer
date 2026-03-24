/**
 * Cortex Freelancer — Session Manager
 * [CF-225] Multi-device session management. Shows active sessions with device,
 * browser, approximate location, and last active time. Stores sessions in
 * Firestore and allows remote logout from the settings page.
 *
 * @namespace window.CortexFreelancer.SessionManager
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var LOG_PREFIX = '[CF-225]';
  var STYLE_ID = 'cortex-session-manager-styles';
  var SESSION_ID_KEY = 'cf_session_mgr_id';
  var HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
  var STALE_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

  var state = {
    initialized: false,
    sessionId: null,
    heartbeatTimer: null,
    authUnsubscribe: null,
    uid: null
  };

  // ── Helpers ─────────────────────────────────────────────────────────

  function log() {
    var args = [LOG_PREFIX].concat(Array.prototype.slice.call(arguments));
    console.log.apply(console, args);
  }

  function warn() {
    var args = [LOG_PREFIX].concat(Array.prototype.slice.call(arguments));
    console.warn.apply(console, args);
  }

  function generateId() {
    var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    var id = '';
    for (var i = 0; i < 24; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }

  function getFirestore() {
    if (typeof firebase !== 'undefined' && firebase.firestore) {
      return firebase.firestore();
    }
    return null;
  }

  function getAuth() {
    if (typeof firebase !== 'undefined' && firebase.auth) {
      return firebase.auth();
    }
    return null;
  }

  function getCurrentUid() {
    var auth = getAuth();
    return auth && auth.currentUser ? auth.currentUser.uid : null;
  }

  function sessionsRef(uid) {
    var db = getFirestore();
    if (!db || !uid) return null;
    return db.collection('users').doc(uid).collection('sessions');
  }

  // ── Device / browser detection ──────────────────────────────────────

  function detectDevice() {
    var ua = navigator.userAgent || '';

    var device = 'Desktop';
    if (/Mobi|Android/i.test(ua)) device = 'Mobile';
    else if (/Tablet|iPad/i.test(ua)) device = 'Tablet';

    var browser = 'Unknown';
    if (/Edg\//i.test(ua)) browser = 'Edge';
    else if (/Chrome\//i.test(ua)) browser = 'Chrome';
    else if (/Firefox\//i.test(ua)) browser = 'Firefox';
    else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';

    var os = 'Unknown';
    if (/Windows/i.test(ua)) os = 'Windows';
    else if (/Mac OS/i.test(ua)) os = 'macOS';
    else if (/Linux/i.test(ua)) os = 'Linux';
    else if (/Android/i.test(ua)) os = 'Android';
    else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';

    return {
      device: device,
      browser: browser,
      os: os,
      userAgent: ua.substring(0, 200)
    };
  }

  /**
   * Fetch approximate location from a public IP API.
   * Falls back gracefully if unavailable.
   */
  function fetchLocation() {
    return fetch('https://ipapi.co/json/')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        return {
          ip: data.ip || 'Unknown',
          city: data.city || 'Unknown',
          region: data.region || '',
          country: data.country_name || 'Unknown'
        };
      })
      .catch(function () {
        return { ip: 'Unknown', city: 'Unknown', region: '', country: 'Unknown' };
      });
  }

  // ── Session CRUD ────────────────────────────────────────────────────

  function getOrCreateSessionId() {
    try {
      var id = sessionStorage.getItem(SESSION_ID_KEY);
      if (id) return id;
    } catch (e) { /* ignore */ }

    var newId = generateId();
    try {
      sessionStorage.setItem(SESSION_ID_KEY, newId);
    } catch (e) { /* ignore */ }
    return newId;
  }

  /**
   * Register or refresh the current session in Firestore.
   * @returns {Promise<void>}
   */
  function registerSession() {
    var uid = getCurrentUid();
    if (!uid) return Promise.reject(new Error('Not authenticated'));

    var ref = sessionsRef(uid);
    if (!ref) return Promise.reject(new Error('Firestore not available'));

    state.uid = uid;
    state.sessionId = getOrCreateSessionId();

    var deviceInfo = detectDevice();

    return fetchLocation().then(function (location) {
      return ref.doc(state.sessionId).set({
        sessionId: state.sessionId,
        device: deviceInfo.device,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        userAgent: deviceInfo.userAgent,
        ip: location.ip,
        city: location.city,
        region: location.region,
        country: location.country,
        lastActive: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        active: true
      }, { merge: true });
    }).then(function () {
      log('Session registered:', state.sessionId);
    });
  }

  /**
   * Update the lastActive timestamp for the current session (heartbeat).
   */
  function heartbeat() {
    var uid = state.uid || getCurrentUid();
    var ref = sessionsRef(uid);
    if (!ref || !state.sessionId) return;

    ref.doc(state.sessionId).update({
      lastActive: new Date().toISOString()
    }).catch(function (err) {
      warn('Heartbeat failed:', err);
    });
  }

  function startHeartbeat() {
    stopHeartbeat();
    state.heartbeatTimer = setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);
  }

  function stopHeartbeat() {
    if (state.heartbeatTimer) {
      clearInterval(state.heartbeatTimer);
      state.heartbeatTimer = null;
    }
  }

  /**
   * Fetch all sessions for the current user.
   * @returns {Promise<Array>}  Array of session objects, sorted by lastActive desc
   */
  function getSessions() {
    var uid = state.uid || getCurrentUid();
    var ref = sessionsRef(uid);
    if (!ref) return Promise.reject(new Error('Firestore not available'));

    return ref.where('active', '==', true)
      .orderBy('lastActive', 'desc')
      .get()
      .then(function (snapshot) {
        var sessions = [];
        snapshot.forEach(function (doc) {
          var data = doc.data();
          data.id = doc.id;
          data.isCurrent = doc.id === state.sessionId;
          sessions.push(data);
        });

        // Clean up stale sessions
        var now = Date.now();
        sessions = sessions.filter(function (s) {
          var lastActive = new Date(s.lastActive).getTime();
          if (now - lastActive > STALE_THRESHOLD_MS) {
            ref.doc(s.id).update({ active: false }).catch(function () {});
            return false;
          }
          return true;
        });

        return sessions;
      });
  }

  /**
   * Revoke a specific session (remote logout).
   * @param {string} sessionId
   * @returns {Promise<void>}
   */
  function revokeSession(sessionId) {
    var uid = state.uid || getCurrentUid();
    var ref = sessionsRef(uid);
    if (!ref) return Promise.reject(new Error('Firestore not available'));

    if (sessionId === state.sessionId) {
      warn('Cannot revoke current session from here. Use sign-out instead.');
      return Promise.reject(new Error('Cannot revoke current session'));
    }

    return ref.doc(sessionId).update({
      active: false,
      revokedAt: new Date().toISOString()
    }).then(function () {
      log('Session revoked:', sessionId);
    });
  }

  /**
   * Revoke all sessions except the current one.
   * @returns {Promise<number>}  Number of sessions revoked
   */
  function revokeAllOther() {
    return getSessions().then(function (sessions) {
      var uid = state.uid || getCurrentUid();
      var ref = sessionsRef(uid);
      if (!ref) return 0;

      var batch = getFirestore().batch();
      var count = 0;

      for (var i = 0; i < sessions.length; i++) {
        if (!sessions[i].isCurrent) {
          batch.update(ref.doc(sessions[i].id), {
            active: false,
            revokedAt: new Date().toISOString()
          });
          count++;
        }
      }

      if (count === 0) return 0;

      return batch.commit().then(function () {
        log('Revoked', count, 'other sessions.');
        return count;
      });
    });
  }

  // ── UI rendering ────────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent =
      '.cf-sessions-list {' +
        'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;' +
      '}' +
      '.cf-session-card {' +
        'display: flex; align-items: center; justify-content: space-between;' +
        'padding: 14px 16px; margin-bottom: 8px; border-radius: 10px;' +
        'background: #1e1e2e; border: 1px solid #2d2d44;' +
        'transition: border-color 0.2s;' +
      '}' +
      '.cf-session-card--current {' +
        'border-color: #4ecca3;' +
      '}' +
      '.cf-session-info { flex: 1; }' +
      '.cf-session-device {' +
        'font-size: 14px; font-weight: 600; color: #e0e0e0; margin: 0 0 4px;' +
      '}' +
      '.cf-session-meta {' +
        'font-size: 12px; color: #888; margin: 0;' +
      '}' +
      '.cf-session-badge {' +
        'display: inline-block; padding: 2px 8px; border-radius: 4px;' +
        'font-size: 11px; font-weight: 600; margin-left: 8px;' +
        'background: rgba(78,204,163,0.15); color: #4ecca3;' +
      '}' +
      '.cf-session-revoke {' +
        'padding: 6px 14px; border: 1px solid #444; border-radius: 6px;' +
        'background: transparent; color: #ff6b6b; font-size: 12px;' +
        'cursor: pointer; white-space: nowrap; transition: background 0.2s;' +
      '}' +
      '.cf-session-revoke:hover {' +
        'background: rgba(255,107,107,0.1);' +
      '}' +
      '.cf-sessions-revoke-all {' +
        'display: block; width: 100%; margin-top: 12px; padding: 10px;' +
        'border: 1px solid #444; border-radius: 8px; background: transparent;' +
        'color: #ff6b6b; font-size: 13px; cursor: pointer;' +
        'transition: background 0.2s;' +
      '}' +
      '.cf-sessions-revoke-all:hover {' +
        'background: rgba(255,107,107,0.1);' +
      '}' +
      '.cf-sessions-empty {' +
        'color: #888; font-size: 13px; text-align: center; padding: 20px;' +
      '}' +
      '.cf-sessions-loading {' +
        'color: #888; font-size: 13px; text-align: center; padding: 20px;' +
      '}';
    document.head.appendChild(s);
  }

  function formatLastActive(isoString) {
    if (!isoString) return 'Unknown';
    var date = new Date(isoString);
    var now = new Date();
    var diffMs = now - date;
    var diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return diffMin + 'm ago';
    var diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return diffHr + 'h ago';
    var diffDays = Math.floor(diffHr / 24);
    if (diffDays < 30) return diffDays + 'd ago';
    return date.toLocaleDateString();
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }

  /**
   * Render active sessions UI into a container element.
   *
   * @param {string|HTMLElement} container  CSS selector or DOM element
   * @returns {Promise<void>}
   */
  function renderSessionsUI(container) {
    injectStyles();

    var el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) {
      warn('Container not found:', container);
      return Promise.resolve();
    }

    el.innerHTML = '<div class="cf-sessions-loading">Loading sessions...</div>';

    return getSessions().then(function (sessions) {
      if (sessions.length === 0) {
        el.innerHTML = '<div class="cf-sessions-empty">No active sessions found.</div>';
        return;
      }

      var html = '<div class="cf-sessions-list">';

      for (var i = 0; i < sessions.length; i++) {
        var s = sessions[i];
        var currentClass = s.isCurrent ? ' cf-session-card--current' : '';
        var badge = s.isCurrent ? '<span class="cf-session-badge">This device</span>' : '';
        var location = escapeHtml(s.city || 'Unknown');
        if (s.country && s.country !== 'Unknown') {
          location += ', ' + escapeHtml(s.country);
        }

        html += '<div class="cf-session-card' + currentClass + '" data-session-id="' + escapeHtml(s.id) + '">';
        html += '<div class="cf-session-info">';
        html += '<p class="cf-session-device">' + escapeHtml(s.browser || 'Unknown') + ' on ' + escapeHtml(s.os || s.device || 'Unknown') + badge + '</p>';
        html += '<p class="cf-session-meta">' + location + ' &middot; ' + escapeHtml(s.ip || '') + ' &middot; ' + formatLastActive(s.lastActive) + '</p>';
        html += '</div>';

        if (!s.isCurrent) {
          html += '<button class="cf-session-revoke" data-revoke="' + escapeHtml(s.id) + '">Revoke</button>';
        }

        html += '</div>';
      }

      if (sessions.length > 1) {
        html += '<button class="cf-sessions-revoke-all" id="cf-revoke-all-sessions">Revoke All Other Sessions</button>';
      }

      html += '</div>';
      el.innerHTML = html;

      // Bind revoke buttons
      var revokeButtons = el.querySelectorAll('.cf-session-revoke');
      for (var j = 0; j < revokeButtons.length; j++) {
        revokeButtons[j].addEventListener('click', function (e) {
          var btn = e.target;
          var sid = btn.getAttribute('data-revoke');
          btn.disabled = true;
          btn.textContent = 'Revoking...';
          revokeSession(sid).then(function () {
            renderSessionsUI(el);
          }).catch(function () {
            btn.disabled = false;
            btn.textContent = 'Revoke';
          });
        });
      }

      var revokeAllBtn = document.getElementById('cf-revoke-all-sessions');
      if (revokeAllBtn) {
        revokeAllBtn.addEventListener('click', function () {
          revokeAllBtn.disabled = true;
          revokeAllBtn.textContent = 'Revoking...';
          revokeAllOther().then(function () {
            renderSessionsUI(el);
          }).catch(function () {
            revokeAllBtn.disabled = false;
            revokeAllBtn.textContent = 'Revoke All Other Sessions';
          });
        });
      }
    }).catch(function (err) {
      el.innerHTML = '<div class="cf-sessions-empty">Failed to load sessions.</div>';
      warn('Failed to render sessions:', err);
    });
  }

  // ── Init / Destroy ──────────────────────────────────────────────────

  /**
   * Initialize session manager. Registers the current session and starts
   * the heartbeat. Listens for auth state changes.
   *
   * @param {Object} [options]
   * @param {string} [options.containerId]  Optional container to auto-render sessions UI
   * @returns {Promise<void>}
   */
  function init(options) {
    if (state.initialized) {
      log('Already initialized.');
      return Promise.resolve();
    }

    state.initialized = true;

    var uid = getCurrentUid();
    if (uid) {
      return registerSession().then(function () {
        startHeartbeat();
        if (options && options.containerId) {
          renderSessionsUI('#' + options.containerId);
        }
        log('Initialized.');
      }).catch(function (err) {
        warn('Init registration failed:', err);
      });
    }

    // Listen for auth state changes
    var auth = getAuth();
    if (auth) {
      state.authUnsubscribe = auth.onAuthStateChanged(function (user) {
        if (user) {
          registerSession().then(function () {
            startHeartbeat();
            if (options && options.containerId) {
              renderSessionsUI('#' + options.containerId);
            }
          }).catch(function (err) {
            warn('Auth-triggered registration failed:', err);
          });
        } else {
          stopHeartbeat();
          state.uid = null;
          state.sessionId = null;
        }
      });
    }

    log('Initialized (waiting for auth).');
    return Promise.resolve();
  }

  /**
   * Tear down — stop heartbeat, remove listeners.
   */
  function destroy() {
    stopHeartbeat();
    if (state.authUnsubscribe) {
      state.authUnsubscribe();
      state.authUnsubscribe = null;
    }
    state.initialized = false;
    state.uid = null;
    state.sessionId = null;
    log('Destroyed.');
  }

  // ── Public API ──────────────────────────────────────────────────────

  window.CortexFreelancer.SessionManager = {
    init: init,
    destroy: destroy,
    registerSession: registerSession,
    getSessions: getSessions,
    revokeSession: revokeSession,
    revokeAllOther: revokeAllOther,
    renderSessionsUI: renderSessionsUI,
    getCurrentSessionId: function () { return state.sessionId; }
  };

  console.log('[CF] Session manager loaded');
})();
