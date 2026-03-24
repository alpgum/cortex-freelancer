/**
 * [CF-225] Multi-Device Session Management
 *
 * Track active sessions across devices, display them in the settings panel,
 * and allow remote logout. Sessions are stored in Firestore under
 * users/{uid}/sessions/{sessionId}.
 *
 * Exposed on window.CortexFreelancer.SessionManagement
 *
 * Public API:
 *   init(options)              - Start tracking, register session, begin heartbeat
 *   registerSession()          - Create or refresh current session document
 *   getSessions()              - Fetch all active sessions for the current user
 *   revokeSession(sessionId)   - Revoke a specific session (remote logout)
 *   revokeAllOtherSessions()   - Revoke every session except the current one
 *   renderSessionsUI(container)- Render the sessions list into a DOM element
 *   destroy()                  - Stop heartbeat, remove listeners, clean up
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ── Constants ────────────────────────────────────────────────────────

  var SESSION_ID_KEY = 'cf_session_id';
  var HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
  var STALE_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
  var CSS_INJECTED = false;

  // ── Internal State ───────────────────────────────────────────────────

  var state = {
    initialized: false,
    sessionId: null,
    heartbeatTimer: null,
    visibilityHandler: null,
    options: {}
  };

  // ── Firebase Helpers ─────────────────────────────────────────────────

  function getFirestore() {
    if (typeof firebase !== 'undefined' && firebase.firestore) {
      return firebase.firestore();
    }
    return null;
  }

  function getCurrentUser() {
    if (typeof firebase !== 'undefined' && firebase.auth) {
      return firebase.auth().currentUser;
    }
    return null;
  }

  function sessionsCollection() {
    var db = getFirestore();
    var user = getCurrentUser();
    if (!db || !user) return null;
    return db.collection('users').doc(user.uid).collection('sessions');
  }

  // ── ID Generation ────────────────────────────────────────────────────

  function generateSessionId() {
    var ts = Date.now().toString(36);
    var rand = '';
    for (var i = 0; i < 12; i++) {
      rand += Math.random().toString(36).charAt(2) || '0';
    }
    return 'sess_' + ts + '_' + rand;
  }

  function getOrCreateSessionId() {
    var existing = null;
    try {
      existing = sessionStorage.getItem(SESSION_ID_KEY);
    } catch (e) { /* ignore */ }

    if (existing) return existing;

    var id = generateSessionId();
    try {
      sessionStorage.setItem(SESSION_ID_KEY, id);
    } catch (e) { /* ignore */ }
    return id;
  }

  // ── Device / Browser / OS Detection ──────────────────────────────────

  function parseUserAgent() {
    var ua = navigator.userAgent || '';

    // Device type
    var deviceType = 'Desktop';
    if (/Mobi|Android.*Mobile|iPhone|iPod/i.test(ua)) {
      deviceType = 'Mobile';
    } else if (/iPad|Android(?!.*Mobile)|Tablet/i.test(ua)) {
      deviceType = 'Tablet';
    }

    // Browser
    var browser = 'Unknown';
    if (/Edg\//i.test(ua)) {
      browser = 'Edge';
    } else if (/OPR\/|Opera/i.test(ua)) {
      browser = 'Opera';
    } else if (/Chrome\/.*Safari/i.test(ua) && !/Edg/i.test(ua)) {
      browser = 'Chrome';
    } else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) {
      browser = 'Safari';
    } else if (/Firefox\//i.test(ua)) {
      browser = 'Firefox';
    } else if (/MSIE|Trident/i.test(ua)) {
      browser = 'Internet Explorer';
    }

    // Browser version (first numeric match after browser token)
    var browserVersion = '';
    var versionPatterns = {
      'Edge': /Edg\/(\d+[\d.]*)/,
      'Opera': /(?:OPR|Opera)\/(\d+[\d.]*)/,
      'Chrome': /Chrome\/(\d+[\d.]*)/,
      'Safari': /Version\/(\d+[\d.]*)/,
      'Firefox': /Firefox\/(\d+[\d.]*)/,
      'Internet Explorer': /(?:MSIE |rv:)(\d+[\d.]*)/
    };
    var vp = versionPatterns[browser];
    if (vp) {
      var vm = ua.match(vp);
      if (vm) browserVersion = vm[1];
    }

    // Operating System
    var os = 'Unknown';
    if (/Windows/i.test(ua)) {
      os = 'Windows';
    } else if (/Mac OS X|Macintosh/i.test(ua)) {
      os = 'macOS';
    } else if (/CrOS/i.test(ua)) {
      os = 'Chrome OS';
    } else if (/Linux/i.test(ua) && !/Android/i.test(ua)) {
      os = 'Linux';
    } else if (/Android/i.test(ua)) {
      os = 'Android';
    } else if (/iPhone|iPad|iPod/i.test(ua)) {
      os = 'iOS';
    }

    return {
      deviceType: deviceType,
      browser: browser,
      browserVersion: browserVersion,
      os: os,
      userAgent: ua
    };
  }

  // ── Location Approximation ───────────────────────────────────────────

  function getTimezoneLocation() {
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      // Convert "America/New_York" to "New York"
      var parts = tz.split('/');
      var city = (parts[parts.length - 1] || '').replace(/_/g, ' ');
      return {
        timezone: tz,
        city: city,
        display: city || tz || 'Unknown location'
      };
    } catch (e) {
      return { timezone: '', city: '', display: 'Unknown location' };
    }
  }

  /**
   * Attempt to enrich location via a free IP geolocation API.
   * Falls back to timezone-based location on failure.
   */
  function fetchIPLocation() {
    var fallback = getTimezoneLocation();

    return fetch('https://ipapi.co/json/', { mode: 'cors' })
      .then(function (res) {
        if (!res.ok) throw new Error('IP lookup failed');
        return res.json();
      })
      .then(function (data) {
        return {
          ip: data.ip || '',
          city: data.city || fallback.city,
          region: data.region || '',
          country: data.country_name || '',
          timezone: data.timezone || fallback.timezone,
          display: [data.city, data.region, data.country_name].filter(Boolean).join(', ') || fallback.display
        };
      })
      .catch(function () {
        return {
          ip: '',
          city: fallback.city,
          region: '',
          country: '',
          timezone: fallback.timezone,
          display: fallback.display
        };
      });
  }

  // ── Relative Time Formatting ─────────────────────────────────────────

  function formatRelativeTime(timestamp) {
    if (!timestamp) return 'Unknown';

    var now = Date.now();
    var ts = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
    var diffMs = now - ts;

    if (diffMs < 0) return 'Just now';

    var seconds = Math.floor(diffMs / 1000);
    var minutes = Math.floor(seconds / 60);
    var hours = Math.floor(minutes / 60);
    var days = Math.floor(hours / 24);

    if (seconds < 60) return 'Just now';
    if (minutes === 1) return '1 minute ago';
    if (minutes < 60) return minutes + ' minutes ago';
    if (hours === 1) return '1 hour ago';
    if (hours < 24) return hours + ' hours ago';
    if (days === 1) return 'Yesterday';
    if (days < 7) return days + ' days ago';
    if (days < 30) {
      var weeks = Math.floor(days / 7);
      return weeks === 1 ? '1 week ago' : weeks + ' weeks ago';
    }
    if (days < 365) {
      var months = Math.floor(days / 30);
      return months === 1 ? '1 month ago' : months + ' months ago';
    }

    // Fallback to formatted date
    try {
      return new Date(ts).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return new Date(ts).toDateString();
    }
  }

  // ── Device Icon SVG ──────────────────────────────────────────────────

  function getDeviceIcon(deviceType) {
    var icons = {
      Desktop: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
      Mobile: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>',
      Tablet: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>'
    };
    return icons[deviceType] || icons.Desktop;
  }

  // ── Session CRUD ─────────────────────────────────────────────────────

  function buildSessionData(location) {
    var device = parseUserAgent();
    return {
      sessionId: state.sessionId,
      deviceType: device.deviceType,
      browser: device.browser,
      browserVersion: device.browserVersion,
      os: device.os,
      ip: (location && location.ip) || '',
      location: (location && location.display) || getTimezoneLocation().display,
      timezone: (location && location.timezone) || getTimezoneLocation().timezone,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastActive: firebase.firestore.FieldValue.serverTimestamp(),
      active: true
    };
  }

  /**
   * Register the current session in Firestore.
   */
  function registerSession() {
    var col = sessionsCollection();
    if (!col) return Promise.reject(new Error('No Firestore or user'));

    return fetchIPLocation().then(function (location) {
      var data = buildSessionData(location);
      return col.doc(state.sessionId).set(data, { merge: true });
    });
  }

  /**
   * Send a heartbeat to update lastActive.
   */
  function sendHeartbeat() {
    var col = sessionsCollection();
    if (!col || !state.sessionId) return;

    col.doc(state.sessionId).update({
      lastActive: firebase.firestore.FieldValue.serverTimestamp(),
      active: true
    }).catch(function (err) {
      console.warn('[SessionManagement] Heartbeat failed:', err.message);
    });
  }

  /**
   * Fetch all sessions for the current user, sorted by lastActive desc.
   * Automatically cleans up stale sessions older than STALE_THRESHOLD_MS.
   */
  function getSessions() {
    var col = sessionsCollection();
    if (!col) return Promise.reject(new Error('No Firestore or user'));

    return col.orderBy('lastActive', 'desc').get().then(function (snapshot) {
      var sessions = [];
      var staleIds = [];
      var now = Date.now();

      snapshot.forEach(function (doc) {
        var data = doc.data();
        var lastActive = data.lastActive
          ? (data.lastActive.toMillis ? data.lastActive.toMillis() : new Date(data.lastActive).getTime())
          : 0;

        if (data.active === false) return;

        // Mark stale sessions for cleanup
        if (lastActive && (now - lastActive) > STALE_THRESHOLD_MS) {
          staleIds.push(doc.id);
          return;
        }

        sessions.push({
          id: doc.id,
          deviceType: data.deviceType || 'Desktop',
          browser: data.browser || 'Unknown',
          browserVersion: data.browserVersion || '',
          os: data.os || 'Unknown',
          ip: data.ip || '',
          location: data.location || 'Unknown',
          timezone: data.timezone || '',
          lastActive: lastActive,
          createdAt: data.createdAt
            ? (data.createdAt.toMillis ? data.createdAt.toMillis() : new Date(data.createdAt).getTime())
            : 0,
          isCurrent: doc.id === state.sessionId,
          active: data.active !== false
        });
      });

      // Clean up stale sessions in background
      if (staleIds.length > 0) {
        var batch = getFirestore().batch();
        staleIds.forEach(function (id) {
          batch.delete(col.doc(id));
        });
        batch.commit().catch(function () { /* ignore cleanup errors */ });
      }

      return sessions;
    });
  }

  /**
   * Revoke a specific session (remote logout).
   */
  function revokeSession(sessionId) {
    if (!sessionId) return Promise.reject(new Error('Session ID is required'));
    if (sessionId === state.sessionId) {
      return Promise.reject(new Error('Cannot revoke your current session from here. Use sign out instead.'));
    }

    var col = sessionsCollection();
    if (!col) return Promise.reject(new Error('No Firestore or user'));

    return col.doc(sessionId).update({
      active: false,
      revokedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  /**
   * Revoke all sessions except the current one.
   */
  function revokeAllOtherSessions() {
    return getSessions().then(function (sessions) {
      var col = sessionsCollection();
      if (!col) return Promise.reject(new Error('No Firestore or user'));

      var otherSessions = sessions.filter(function (s) {
        return !s.isCurrent;
      });

      if (otherSessions.length === 0) return Promise.resolve(0);

      var batch = getFirestore().batch();
      otherSessions.forEach(function (s) {
        batch.update(col.doc(s.id), {
          active: false,
          revokedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      });

      return batch.commit().then(function () {
        return otherSessions.length;
      });
    });
  }

  // ── Confirmation Dialog ──────────────────────────────────────────────

  function showConfirmDialog(options) {
    return new Promise(function (resolve) {
      injectCSS();

      var overlay = document.createElement('div');
      overlay.className = 'cf-session-overlay';
      overlay.innerHTML =
        '<div class="cf-session-confirm-modal">' +
          '<h3 class="cf-session-confirm-title">' + (options.title || 'Confirm') + '</h3>' +
          '<p class="cf-session-confirm-text">' + (options.message || 'Are you sure?') + '</p>' +
          '<div class="cf-session-confirm-actions">' +
            '<button class="cf-session-btn cf-session-btn-cancel" id="cf-session-cancel">Cancel</button>' +
            '<button class="cf-session-btn cf-session-btn-danger" id="cf-session-confirm">' + (options.confirmLabel || 'Confirm') + '</button>' +
          '</div>' +
        '</div>';

      document.body.appendChild(overlay);

      var confirmBtn = overlay.querySelector('#cf-session-confirm');
      var cancelBtn = overlay.querySelector('#cf-session-cancel');

      function close(result) {
        if (overlay.parentNode) {
          document.body.removeChild(overlay);
        }
        resolve(result);
      }

      confirmBtn.addEventListener('click', function () { close(true); });
      cancelBtn.addEventListener('click', function () { close(false); });
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) close(false);
      });
    });
  }

  // ── CSS Injection ────────────────────────────────────────────────────

  function injectCSS() {
    if (CSS_INJECTED) return;
    CSS_INJECTED = true;

    var style = document.createElement('style');
    style.textContent = [
      /* Overlay & Modal */
      '.cf-session-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 16px; }',
      '.cf-session-confirm-modal { background: #fff; border-radius: 14px; max-width: 400px; width: 100%; padding: 24px; box-shadow: 0 20px 60px rgba(0,0,0,0.18); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }',
      '.cf-session-confirm-title { font-size: 17px; font-weight: 700; color: #1e293b; margin: 0 0 8px; }',
      '.cf-session-confirm-text { font-size: 14px; color: #475569; line-height: 1.5; margin: 0 0 20px; }',
      '.cf-session-confirm-actions { display: flex; gap: 10px; justify-content: flex-end; }',

      /* Buttons */
      '.cf-session-btn { padding: 9px 18px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; border: none; transition: background 0.15s, box-shadow 0.15s; }',
      '.cf-session-btn-cancel { background: #f1f5f9; color: #334155; }',
      '.cf-session-btn-cancel:hover { background: #e2e8f0; }',
      '.cf-session-btn-danger { background: #dc2626; color: #fff; }',
      '.cf-session-btn-danger:hover { background: #b91c1c; }',
      '.cf-session-btn-primary { background: #2563eb; color: #fff; }',
      '.cf-session-btn-primary:hover { background: #1d4ed8; }',
      '.cf-session-btn:disabled { opacity: 0.5; cursor: not-allowed; }',

      /* Sessions Panel */
      '.cf-sessions-panel { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }',
      '.cf-sessions-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }',
      '.cf-sessions-header h3 { font-size: 16px; font-weight: 700; color: #1e293b; margin: 0; }',
      '.cf-sessions-revoke-all { font-size: 13px; color: #dc2626; background: none; border: none; cursor: pointer; font-weight: 500; padding: 4px 8px; border-radius: 6px; transition: background 0.15s; }',
      '.cf-sessions-revoke-all:hover { background: #fef2f2; }',
      '.cf-sessions-revoke-all:disabled { opacity: 0.5; cursor: not-allowed; }',

      /* Session Card */
      '.cf-sessions-list { display: flex; flex-direction: column; gap: 10px; }',
      '.cf-session-card { display: flex; align-items: flex-start; gap: 14px; padding: 14px 16px; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; transition: border-color 0.15s, box-shadow 0.15s; }',
      '.cf-session-card:hover { border-color: #cbd5e1; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }',
      '.cf-session-card--current { border-color: #93c5fd; background: #eff6ff; }',
      '.cf-session-card--current:hover { border-color: #60a5fa; }',

      '.cf-session-icon { flex-shrink: 0; width: 40px; height: 40px; border-radius: 10px; background: #f1f5f9; display: flex; align-items: center; justify-content: center; color: #475569; }',
      '.cf-session-card--current .cf-session-icon { background: #dbeafe; color: #2563eb; }',

      '.cf-session-info { flex: 1; min-width: 0; }',
      '.cf-session-info-row { display: flex; align-items: center; gap: 8px; margin-bottom: 2px; }',
      '.cf-session-device { font-size: 14px; font-weight: 600; color: #1e293b; }',
      '.cf-session-badge { display: inline-block; font-size: 11px; font-weight: 600; color: #2563eb; background: #dbeafe; padding: 2px 8px; border-radius: 10px; line-height: 1.4; }',
      '.cf-session-meta { font-size: 13px; color: #64748b; line-height: 1.4; }',
      '.cf-session-meta span { margin-right: 6px; }',
      '.cf-session-meta span::after { content: "\\00b7"; margin-left: 6px; color: #cbd5e1; }',
      '.cf-session-meta span:last-child::after { content: ""; margin-left: 0; }',

      '.cf-session-actions { flex-shrink: 0; align-self: center; }',
      '.cf-session-revoke-btn { font-size: 13px; color: #dc2626; background: none; border: 1px solid #fecaca; cursor: pointer; padding: 6px 12px; border-radius: 6px; font-weight: 500; transition: background 0.15s, border-color 0.15s; }',
      '.cf-session-revoke-btn:hover { background: #fef2f2; border-color: #dc2626; }',
      '.cf-session-revoke-btn:disabled { opacity: 0.5; cursor: not-allowed; }',

      /* Loading & Empty */
      '.cf-sessions-loading { text-align: center; padding: 32px 16px; color: #94a3b8; font-size: 14px; }',
      '.cf-sessions-empty { text-align: center; padding: 32px 16px; color: #94a3b8; font-size: 14px; }',
      '.cf-sessions-error { text-align: center; padding: 20px 16px; color: #dc2626; font-size: 14px; background: #fef2f2; border-radius: 8px; }',
      '.cf-sessions-toast { position: fixed; bottom: 24px; right: 24px; background: #1e293b; color: #fff; padding: 12px 20px; border-radius: 10px; font-size: 14px; z-index: 10001; box-shadow: 0 8px 24px rgba(0,0,0,0.15); animation: cf-session-toast-in 0.25s ease; }',
      '@keyframes cf-session-toast-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }'
    ].join('\n');
    document.head.appendChild(style);
  }

  // ── Toast Notification ───────────────────────────────────────────────

  function showToast(message, duration) {
    var el = document.createElement('div');
    el.className = 'cf-sessions-toast';
    el.textContent = message;
    document.body.appendChild(el);

    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, duration || 3000);
  }

  // ── UI Rendering ─────────────────────────────────────────────────────

  function renderSessionCard(session) {
    var card = document.createElement('div');
    card.className = 'cf-session-card' + (session.isCurrent ? ' cf-session-card--current' : '');

    var browserLabel = session.browser;
    if (session.browserVersion) {
      browserLabel += ' ' + session.browserVersion.split('.')[0];
    }

    card.innerHTML =
      '<div class="cf-session-icon">' + getDeviceIcon(session.deviceType) + '</div>' +
      '<div class="cf-session-info">' +
        '<div class="cf-session-info-row">' +
          '<span class="cf-session-device">' + escapeHtml(session.os) + ' - ' + escapeHtml(session.deviceType) + '</span>' +
          (session.isCurrent ? '<span class="cf-session-badge">This device</span>' : '') +
        '</div>' +
        '<div class="cf-session-meta">' +
          '<span>' + escapeHtml(browserLabel) + '</span>' +
          '<span>' + escapeHtml(session.location) + '</span>' +
          '<span>' + formatRelativeTime(session.lastActive) + '</span>' +
        '</div>' +
      '</div>' +
      (session.isCurrent
        ? ''
        : '<div class="cf-session-actions">' +
            '<button class="cf-session-revoke-btn" data-session-id="' + escapeHtml(session.id) + '">Revoke</button>' +
          '</div>'
      );

    return card;
  }

  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  /**
   * Render the full sessions management UI into a container element.
   * @param {HTMLElement|string} container - DOM element or selector
   */
  function renderSessionsUI(container) {
    var el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) {
      console.warn('[SessionManagement] Container not found:', container);
      return;
    }

    injectCSS();

    el.innerHTML =
      '<div class="cf-sessions-panel">' +
        '<div class="cf-sessions-header">' +
          '<h3>Active Sessions</h3>' +
          '<button class="cf-sessions-revoke-all" id="cf-sessions-revoke-all" disabled>Revoke all other sessions</button>' +
        '</div>' +
        '<div class="cf-sessions-list" id="cf-sessions-list">' +
          '<div class="cf-sessions-loading">Loading sessions...</div>' +
        '</div>' +
      '</div>';

    var listEl = el.querySelector('#cf-sessions-list');
    var revokeAllBtn = el.querySelector('#cf-sessions-revoke-all');

    function refreshList() {
      listEl.innerHTML = '<div class="cf-sessions-loading">Loading sessions...</div>';

      getSessions().then(function (sessions) {
        listEl.innerHTML = '';

        if (sessions.length === 0) {
          listEl.innerHTML = '<div class="cf-sessions-empty">No active sessions found.</div>';
          revokeAllBtn.disabled = true;
          return;
        }

        var hasOthers = false;

        sessions.forEach(function (session) {
          if (!session.isCurrent) hasOthers = true;
          var card = renderSessionCard(session);
          listEl.appendChild(card);
        });

        revokeAllBtn.disabled = !hasOthers;

        // Bind revoke buttons
        var revokeBtns = listEl.querySelectorAll('.cf-session-revoke-btn');
        for (var i = 0; i < revokeBtns.length; i++) {
          revokeBtns[i].addEventListener('click', handleRevokeClick);
        }
      }).catch(function (err) {
        console.error('[SessionManagement] Failed to load sessions:', err);
        listEl.innerHTML = '<div class="cf-sessions-error">Failed to load sessions. Please try again.</div>';
      });
    }

    function handleRevokeClick(e) {
      var btn = e.currentTarget;
      var sessionId = btn.getAttribute('data-session-id');
      if (!sessionId) return;

      showConfirmDialog({
        title: 'Revoke Session',
        message: 'This will sign out the selected device. The user on that device will need to log in again.',
        confirmLabel: 'Revoke Session'
      }).then(function (confirmed) {
        if (!confirmed) return;

        btn.disabled = true;
        btn.textContent = 'Revoking...';

        revokeSession(sessionId).then(function () {
          showToast('Session revoked successfully.');
          refreshList();
        }).catch(function (err) {
          console.error('[SessionManagement] Revoke failed:', err);
          showToast('Failed to revoke session. Please try again.');
          btn.disabled = false;
          btn.textContent = 'Revoke';
        });
      });
    }

    revokeAllBtn.addEventListener('click', function () {
      showConfirmDialog({
        title: 'Revoke All Other Sessions',
        message: 'This will sign out all other devices. Only your current session will remain active.',
        confirmLabel: 'Revoke All'
      }).then(function (confirmed) {
        if (!confirmed) return;

        revokeAllBtn.disabled = true;
        revokeAllBtn.textContent = 'Revoking...';

        revokeAllOtherSessions().then(function (count) {
          showToast(count + ' session' + (count !== 1 ? 's' : '') + ' revoked.');
          revokeAllBtn.textContent = 'Revoke all other sessions';
          refreshList();
        }).catch(function (err) {
          console.error('[SessionManagement] Revoke all failed:', err);
          showToast('Failed to revoke sessions. Please try again.');
          revokeAllBtn.disabled = false;
          revokeAllBtn.textContent = 'Revoke all other sessions';
        });
      });
    });

    refreshList();

    // Return refresh function so callers can manually trigger a refresh
    return { refresh: refreshList };
  }

  // ── Heartbeat Management ─────────────────────────────────────────────

  function startHeartbeat() {
    stopHeartbeat();

    // Send initial heartbeat
    sendHeartbeat();

    state.heartbeatTimer = setInterval(function () {
      sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    // Also send heartbeat when tab becomes visible again
    state.visibilityHandler = function () {
      if (!document.hidden) {
        sendHeartbeat();
      }
    };
    document.addEventListener('visibilitychange', state.visibilityHandler);
  }

  function stopHeartbeat() {
    if (state.heartbeatTimer) {
      clearInterval(state.heartbeatTimer);
      state.heartbeatTimer = null;
    }
    if (state.visibilityHandler) {
      document.removeEventListener('visibilitychange', state.visibilityHandler);
      state.visibilityHandler = null;
    }
  }

  // ── Lifecycle ────────────────────────────────────────────────────────

  /**
   * Initialize session management. Call after user is authenticated.
   * @param {Object} [options]
   * @param {number} [options.heartbeatInterval] - Heartbeat interval in ms (default: 120000)
   * @param {boolean} [options.autoRegister] - Auto-register session on init (default: true)
   */
  function init(options) {
    if (state.initialized) {
      console.warn('[SessionManagement] Already initialized.');
      return Promise.resolve();
    }

    var user = getCurrentUser();
    if (!user) {
      console.warn('[SessionManagement] No authenticated user. Call init() after login.');
      return Promise.reject(new Error('No authenticated user'));
    }

    state.options = options || {};
    state.sessionId = getOrCreateSessionId();
    state.initialized = true;

    if (state.options.heartbeatInterval) {
      // Allow custom heartbeat but enforce a minimum of 30 seconds
      HEARTBEAT_INTERVAL_MS = Math.max(30000, state.options.heartbeatInterval);
    }

    var shouldRegister = state.options.autoRegister !== false;

    if (shouldRegister) {
      return registerSession().then(function () {
        startHeartbeat();
      }).catch(function (err) {
        console.error('[SessionManagement] Failed to register session:', err);
        // Start heartbeat anyway so we can retry
        startHeartbeat();
      });
    }

    startHeartbeat();
    return Promise.resolve();
  }

  /**
   * Tear down session management. Stops heartbeat and cleans up.
   * Optionally marks the current session as inactive.
   * @param {Object} [options]
   * @param {boolean} [options.markInactive] - Mark current session as inactive (default: true)
   */
  function destroy(options) {
    var opts = options || {};
    stopHeartbeat();

    var shouldMarkInactive = opts.markInactive !== false;

    if (shouldMarkInactive && state.sessionId) {
      var col = sessionsCollection();
      if (col) {
        col.doc(state.sessionId).update({
          active: false,
          lastActive: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(function () { /* best effort */ });
      }
    }

    state.initialized = false;
    state.sessionId = null;

    try {
      sessionStorage.removeItem(SESSION_ID_KEY);
    } catch (e) { /* ignore */ }
  }

  // ── Public API ───────────────────────────────────────────────────────

  window.CortexFreelancer.SessionManagement = {
    init: init,
    registerSession: registerSession,
    getSessions: getSessions,
    revokeSession: revokeSession,
    revokeAllOtherSessions: revokeAllOtherSessions,
    renderSessionsUI: renderSessionsUI,
    destroy: destroy,

    // Expose utilities for external use
    getSessionId: function () { return state.sessionId; },
    formatRelativeTime: formatRelativeTime,
    parseUserAgent: parseUserAgent
  };

})();
