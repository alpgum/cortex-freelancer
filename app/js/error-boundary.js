/**
 * [CF-104] Global Error Boundary with Error Reporting
 * Enhanced error handling: window.onerror, unhandledrejection, network errors,
 * error grouping, breadcrumbs, user context, and error reporting dashboard.
 *
 * Extends: global-error-boundary.js
 * Exposed on window.CortexFreelancer.ErrorBoundary
 */
(function () {
  'use strict';

  var ERROR_ENDPOINT = '/api/track';
  var MAX_ERRORS_PER_SESSION = 50;
  var MAX_BREADCRUMBS = 30;
  var STORAGE_KEY = 'cortex_error_log';

  var errorCount = 0;
  var breadcrumbs = [];
  var errorGroups = {};
  var userContext = {};
  var originalHandlers = {
    onerror: window.onerror,
    onunhandledrejection: null
  };

  // ─── Breadcrumbs ────────────────────────────────────────────────────

  function addBreadcrumb(category, message, data) {
    breadcrumbs.push({
      category: category,
      message: message,
      data: data || null,
      timestamp: new Date().toISOString()
    });
    if (breadcrumbs.length > MAX_BREADCRUMBS) breadcrumbs.shift();
  }

  // Auto-capture navigation breadcrumbs
  function _setupBreadcrumbCapture() {
    // Click tracking
    document.addEventListener('click', function (e) {
      var target = e.target;
      var label = target.tagName;
      if (target.id) label += '#' + target.id;
      else if (target.className && typeof target.className === 'string') label += '.' + target.className.split(' ')[0];
      addBreadcrumb('ui', 'click', { element: label });
    }, true);

    // Navigation tracking
    var originalPushState = history.pushState;
    if (originalPushState) {
      history.pushState = function () {
        addBreadcrumb('navigation', 'pushState', { url: arguments[2] });
        return originalPushState.apply(this, arguments);
      };
    }

    // Fetch tracking
    var originalFetch = window.fetch;
    if (originalFetch) {
      window.fetch = function (url, opts) {
        var method = (opts && opts.method) || 'GET';
        addBreadcrumb('http', method + ' ' + (typeof url === 'string' ? url : url.url || 'unknown'));

        return originalFetch.apply(this, arguments).then(function (response) {
          if (!response.ok) {
            addBreadcrumb('http', 'Error ' + response.status, { url: typeof url === 'string' ? url : url.url });
          }
          return response;
        }).catch(function (err) {
          addBreadcrumb('http', 'Network error', { url: typeof url === 'string' ? url : url.url, error: err.message });
          throw err;
        });
      };
    }
  }

  // ─── Error Grouping ─────────────────────────────────────────────────

  function _getErrorFingerprint(payload) {
    return (payload.message || '').substring(0, 100) + '|' + (payload.source || '') + '|' + (payload.lineno || 0);
  }

  // ─── Error Reporting ────────────────────────────────────────────────

  function reportError(payload) {
    if (errorCount >= MAX_ERRORS_PER_SESSION) return;
    errorCount++;

    var fingerprint = _getErrorFingerprint(payload);
    if (!errorGroups[fingerprint]) {
      errorGroups[fingerprint] = { count: 0, firstSeen: new Date().toISOString() };
    }
    errorGroups[fingerprint].count++;

    // Deduplicate rapid-fire identical errors
    if (errorGroups[fingerprint].count > 5) return;

    var errorData = {
      event: 'client_error',
      data: {
        message: payload.message || 'Unknown error',
        source: payload.source || '',
        lineno: payload.lineno || 0,
        colno: payload.colno || 0,
        stack: payload.stack ? payload.stack.substring(0, 2000) : '',
        type: payload.type || 'error',
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        breadcrumbs: breadcrumbs.slice(-10),
        userContext: userContext,
        fingerprint: fingerprint,
        groupCount: errorGroups[fingerprint].count,
        sessionErrorCount: errorCount
      }
    };

    // Persist locally
    _persistError(errorData.data);

    // Send to endpoint
    try {
      var body = JSON.stringify(errorData);
      if (navigator.sendBeacon) {
        navigator.sendBeacon(ERROR_ENDPOINT, body);
      } else {
        fetch(ERROR_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body,
          keepalive: true
        }).catch(function () { /* silent */ });
      }
    } catch (e) { /* prevent infinite loop */ }
  }

  function _persistError(errorData) {
    try {
      var log = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      log.push({
        message: errorData.message,
        source: errorData.source,
        type: errorData.type,
        timestamp: errorData.timestamp,
        url: errorData.url
      });
      if (log.length > 100) log = log.slice(-100);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
    } catch (e) { /* ignore */ }
  }

  // ─── Error Handlers ─────────────────────────────────────────────────

  window.onerror = function (message, source, lineno, colno, error) {
    addBreadcrumb('error', message);
    reportError({
      message: message,
      source: source,
      lineno: lineno,
      colno: colno,
      stack: error && error.stack ? error.stack : '',
      type: 'uncaught'
    });

    // Chain to original handler
    if (typeof originalHandlers.onerror === 'function') {
      return originalHandlers.onerror.call(window, message, source, lineno, colno, error);
    }
  };

  window.addEventListener('unhandledrejection', function (event) {
    var reason = event.reason || {};
    addBreadcrumb('error', 'Unhandled rejection');
    reportError({
      message: typeof reason === 'string' ? reason : (reason.message || 'Unhandled promise rejection'),
      stack: reason.stack ? reason.stack : '',
      source: 'unhandledrejection',
      type: 'unhandledrejection'
    });
  });

  // ─── Public API ─────────────────────────────────────────────────────

  function setUserContext(ctx) {
    userContext = ctx || {};
  }

  function captureException(error, extra) {
    if (!(error instanceof Error)) {
      error = new Error(String(error));
    }
    reportError({
      message: error.message,
      stack: error.stack || '',
      source: 'manual',
      type: 'captured',
      lineno: 0,
      colno: 0
    });
  }

  function captureMessage(message, level) {
    addBreadcrumb('message', message);
    reportError({
      message: message,
      source: 'manual',
      type: level || 'info'
    });
  }

  function getErrorLog() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch (e) { return []; }
  }

  function clearErrorLog() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    errorGroups = {};
    errorCount = 0;
  }

  function getErrorCount() { return errorCount; }

  function getErrorGroups() {
    return Object.keys(errorGroups).map(function (fp) {
      return {
        fingerprint: fp,
        count: errorGroups[fp].count,
        firstSeen: errorGroups[fp].firstSeen
      };
    }).sort(function (a, b) { return b.count - a.count; });
  }

  // ─── Rendering ──────────────────────────────────────────────────────

  function renderErrorDashboard(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var log = getErrorLog();
    var groups = getErrorGroups();

    var html = '<div class="eb-dashboard">';

    // Summary
    html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;">';
    html += '<div style="background:#fef2f2;border-radius:10px;padding:14px;text-align:center;">';
    html += '<div style="font-size:24px;font-weight:700;color:#dc2626;">' + errorCount + '</div>';
    html += '<div style="font-size:12px;color:#6b7280;">Session Errors</div></div>';
    html += '<div style="background:#f9fafb;border-radius:10px;padding:14px;text-align:center;">';
    html += '<div style="font-size:24px;font-weight:700;color:#374151;">' + groups.length + '</div>';
    html += '<div style="font-size:12px;color:#6b7280;">Unique Groups</div></div>';
    html += '<div style="background:#f9fafb;border-radius:10px;padding:14px;text-align:center;">';
    html += '<div style="font-size:24px;font-weight:700;color:#374151;">' + log.length + '</div>';
    html += '<div style="font-size:12px;color:#6b7280;">Total Logged</div></div>';
    html += '</div>';

    // Recent errors
    if (log.length > 0) {
      html += '<h4 style="margin:0 0 10px;">Recent Errors</h4>';
      log.slice(-10).reverse().forEach(function (e) {
        html += '<div style="background:#fff;border:1px solid #fecaca;border-radius:8px;padding:10px;margin-bottom:8px;font-size:13px;">';
        html += '<div style="font-weight:500;color:#dc2626;">' + _esc(e.message).substring(0, 100) + '</div>';
        html += '<div style="font-size:11px;color:#6b7280;margin-top:4px;">' + (e.type || 'error') + ' • ' + (e.source || 'unknown') + ' • ' + _relativeTime(e.timestamp) + '</div>';
        html += '</div>';
      });
    } else {
      html += '<div style="text-align:center;padding:30px;color:#6b7280;">No errors logged this session.</div>';
    }

    html += '</div>';
    container.innerHTML = html;
  }

  function _esc(str) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(str || ''));
    return d.innerHTML;
  }

  function _relativeTime(iso) {
    var diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return Math.round(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.round(diff / 3600000) + 'h ago';
    return Math.round(diff / 86400000) + 'd ago';
  }

  // ─── Init ───────────────────────────────────────────────────────────

  function init() {
    _setupBreadcrumbCapture();
    addBreadcrumb('lifecycle', 'ErrorBoundary initialized');
    console.log('[ErrorBoundary] Initialized with breadcrumb capture');
  }

  // ─── Expose ─────────────────────────────────────────────────────────
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.ErrorBoundary = {
    init: init,
    reportError: reportError,
    captureException: captureException,
    captureMessage: captureMessage,
    addBreadcrumb: addBreadcrumb,
    setUserContext: setUserContext,
    getErrorCount: getErrorCount,
    getErrorLog: getErrorLog,
    clearErrorLog: clearErrorLog,
    getErrorGroups: getErrorGroups,
    renderErrorDashboard: renderErrorDashboard
  };
})();
