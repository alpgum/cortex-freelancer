/**
 * CF-207: Auth Session Timeout
 * Auto-logout after 30 days of inactivity, show re-login prompt,
 * preserve user context on re-authentication.
 *
 * @namespace window.CortexFreelancer.AuthSessionTimeout
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_last_activity';
  var CONTEXT_KEY = 'cortex_session_context';
  var TIMEOUT_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
  var CHECK_INTERVAL_MS = 60 * 1000; // Check every minute

  var checkTimer = null;
  var activityEvents = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];

  // ─── Activity Tracking ─────────────────────────────────

  /**
   * Record current timestamp as last activity.
   */
  function recordActivity() {
    try {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
    } catch (e) {
      // Silently fail
    }
  }

  /**
   * Get the last activity timestamp.
   * @returns {number} Timestamp in ms, or 0
   */
  function getLastActivity() {
    try {
      var ts = localStorage.getItem(STORAGE_KEY);
      return ts ? parseInt(ts, 10) : 0;
    } catch (e) {
      return 0;
    }
  }

  /**
   * Check if the session has expired.
   * @returns {boolean}
   */
  function isSessionExpired() {
    var last = getLastActivity();
    if (!last) return false;
    return (Date.now() - last) > TIMEOUT_MS;
  }

  // ─── User Context Preservation ─────────────────────────

  /**
   * Save user context before logout so it can be restored on re-auth.
   * @param {Object} context - Arbitrary context data to preserve
   */
  function saveContext(context) {
    try {
      localStorage.setItem(CONTEXT_KEY, JSON.stringify(context));
    } catch (e) {
      console.warn('[AuthSessionTimeout] Failed to save context:', e);
    }
  }

  /**
   * Retrieve preserved user context after re-auth.
   * @returns {Object|null}
   */
  function getPreservedContext() {
    try {
      var raw = localStorage.getItem(CONTEXT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Clear preserved context after it has been consumed.
   */
  function clearPreservedContext() {
    try {
      localStorage.removeItem(CONTEXT_KEY);
    } catch (e) {
      // Silently fail
    }
  }

  // ─── Re-login Prompt ───────────────────────────────────

  /**
   * Inject session timeout CSS once.
   */
  function injectStyles() {
    if (document.getElementById('cortex-session-timeout-styles')) return;
    var style = document.createElement('style');
    style.id = 'cortex-session-timeout-styles';
    style.textContent =
      '.cortex-session-overlay {' +
        'position: fixed; top: 0; left: 0; width: 100%; height: 100%;' +
        'background: rgba(0,0,0,0.6); z-index: 99999;' +
        'display: flex; align-items: center; justify-content: center;' +
        'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;' +
      '}' +
      '.cortex-session-dialog {' +
        'background: #fff; border-radius: 14px; padding: 36px 40px;' +
        'max-width: 420px; width: 90%; text-align: center;' +
        'box-shadow: 0 12px 40px rgba(0,0,0,0.2);' +
      '}' +
      '.cortex-session-dialog .icon { font-size: 48px; margin-bottom: 16px; }' +
      '.cortex-session-dialog h3 {' +
        'margin: 0 0 8px; font-size: 20px; color: #2d3436;' +
      '}' +
      '.cortex-session-dialog p {' +
        'color: #636e72; font-size: 14px; margin: 0 0 24px; line-height: 1.5;' +
      '}' +
      '.cortex-session-dialog .btn-login {' +
        'display: inline-block; padding: 12px 32px; background: #6c5ce7; color: #fff;' +
        'border: none; border-radius: 8px; font-size: 15px; font-weight: 600;' +
        'cursor: pointer; transition: background 0.2s;' +
      '}' +
      '.cortex-session-dialog .btn-login:hover { background: #5b4bd5; }';
    document.head.appendChild(style);
  }

  var overlayEl = null;

  /**
   * Show the re-login prompt dialog.
   */
  function showReloginPrompt() {
    if (overlayEl) return; // Already showing
    injectStyles();

    overlayEl = document.createElement('div');
    overlayEl.className = 'cortex-session-overlay';
    overlayEl.innerHTML =
      '<div class="cortex-session-dialog">' +
        '<div class="icon">&#128274;</div>' +
        '<h3>Session Expired</h3>' +
        '<p>Your session has expired due to inactivity.<br>Please sign in again to continue.</p>' +
        '<button class="btn-login" id="cortex-session-relogin">Sign In</button>' +
      '</div>';

    document.body.appendChild(overlayEl);

    var btn = overlayEl.querySelector('#cortex-session-relogin');
    btn.addEventListener('click', function () {
      dismissPrompt();
      window.dispatchEvent(new CustomEvent('cortex:navigate', {
        detail: { page: 'login', reason: 'session-expired' }
      }));
    });
  }

  /**
   * Remove the re-login prompt.
   */
  function dismissPrompt() {
    if (overlayEl && overlayEl.parentNode) {
      overlayEl.parentNode.removeChild(overlayEl);
    }
    overlayEl = null;
  }

  // ─── Session Check & Logout ────────────────────────────

  /**
   * Perform logout via Firebase (if available) and dispatch event.
   */
  function performLogout() {
    // Preserve current page/context before logout
    saveContext({
      currentPath: window.location.pathname + window.location.search,
      timestamp: new Date().toISOString()
    });

    if (typeof firebase !== 'undefined' && firebase.auth) {
      firebase.auth().signOut().catch(function (e) {
        console.warn('[AuthSessionTimeout] Firebase signOut error:', e);
      });
    }

    window.dispatchEvent(new CustomEvent('cortex:session-expired'));
    showReloginPrompt();
  }

  /**
   * Check session validity and logout if expired.
   */
  function checkSession() {
    if (isSessionExpired()) {
      stopMonitoring();
      performLogout();
    }
  }

  // ─── Activity Listeners ────────────────────────────────

  var throttleTimer = null;

  /**
   * Throttled activity handler.
   */
  function onActivity() {
    if (throttleTimer) return;
    throttleTimer = setTimeout(function () {
      throttleTimer = null;
    }, 5000);
    recordActivity();
  }

  /**
   * Start listening for user activity events.
   */
  function startActivityListeners() {
    activityEvents.forEach(function (evt) {
      document.addEventListener(evt, onActivity, { passive: true });
    });
  }

  /**
   * Stop listening for user activity events.
   */
  function stopActivityListeners() {
    activityEvents.forEach(function (evt) {
      document.removeEventListener(evt, onActivity);
    });
  }

  // ─── Monitoring ────────────────────────────────────────

  /**
   * Start session timeout monitoring.
   */
  function startMonitoring() {
    // Record initial activity
    if (!getLastActivity()) {
      recordActivity();
    }

    startActivityListeners();

    // Check periodically
    if (checkTimer) clearInterval(checkTimer);
    checkTimer = setInterval(checkSession, CHECK_INTERVAL_MS);

    // Also check immediately
    checkSession();
  }

  /**
   * Stop session timeout monitoring.
   */
  function stopMonitoring() {
    stopActivityListeners();
    if (checkTimer) {
      clearInterval(checkTimer);
      checkTimer = null;
    }
    if (throttleTimer) {
      clearTimeout(throttleTimer);
      throttleTimer = null;
    }
  }

  /**
   * Reset the session (call after successful re-auth).
   */
  function resetSession() {
    recordActivity();
    dismissPrompt();
    startMonitoring();
  }

  /**
   * Initialize the module.
   */
  function init() {
    injectStyles();
    startMonitoring();
    console.log('[AuthSessionTimeout] Module initialized (30-day timeout)');
  }

  /**
   * Clean up the module.
   */
  function destroy() {
    stopMonitoring();
    dismissPrompt();
  }

  // ─── Namespace Export ──────────────────────────────────

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.AuthSessionTimeout = {
    init: init,
    destroy: destroy,
    startMonitoring: startMonitoring,
    stopMonitoring: stopMonitoring,
    resetSession: resetSession,
    isSessionExpired: isSessionExpired,
    getPreservedContext: getPreservedContext,
    clearPreservedContext: clearPreservedContext
  };
})();
