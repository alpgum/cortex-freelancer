/**
 * CF-265: Sentry Error Monitoring Configuration (Enhanced)
 * DSN config, environment detection, breadcrumbs, user context from auth,
 * custom tags, captureError() and captureMessage() wrappers.
 */
(function () {
  'use strict';

  // ─── Config ───────────────────────────────────────────────
  var MAX_BREADCRUMBS = 100;
  var DEFAULT_SAMPLE_RATE = 1.0;
  var RELAY_ENDPOINT = '/api/sentry-relay';

  var _initialized = false;
  var _dsn = '';
  var _environment = '';
  var _release = '';
  var _sampleRate = DEFAULT_SAMPLE_RATE;
  var _breadcrumbs = [];
  var _user = null;
  var _tags = {};
  var _extraContext = {};

  // ─── Environment Detection ────────────────────────────────

  /**
   * Auto-detect environment from hostname.
   * @returns {string}
   */
  function detectEnvironment() {
    var host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return 'development';
    if (host.includes('preview') || host.includes('staging') || host.includes('vercel.app')) return 'staging';
    return 'production';
  }

  /**
   * Read DSN from meta tag.
   * @returns {string}
   */
  function readDsnFromMeta() {
    var el = document.querySelector('meta[name="sentry-dsn"]');
    return el ? el.getAttribute('content') : '';
  }

  /**
   * Read release version from meta tag or script data attribute.
   * @returns {string}
   */
  function readRelease() {
    var el = document.querySelector('meta[name="app-version"]');
    if (el) return el.getAttribute('content');
    var script = document.querySelector('script[data-release]');
    return script ? script.getAttribute('data-release') : '';
  }

  // ─── Init ─────────────────────────────────────────────────

  /**
   * Initialize Sentry configuration.
   * @param {{ dsn?: string, environment?: string, release?: string, sampleRate?: number, tags?: Object }} config
   */
  function init(config) {
    if (_initialized) return;
    config = config || {};

    _dsn = config.dsn || readDsnFromMeta();
    _environment = config.environment || detectEnvironment();
    _release = config.release || readRelease() || '0.0.0';
    _sampleRate = config.sampleRate !== undefined ? config.sampleRate : DEFAULT_SAMPLE_RATE;

    _tags.environment = _environment;
    _tags.release = _release;
    _tags.url = window.location.pathname;
    if (config.tags) {
      Object.keys(config.tags).forEach(function (k) { _tags[k] = config.tags[k]; });
    }

    // Auto-capture unhandled errors
    window.addEventListener('error', function (event) {
      captureError(event.error || new Error(event.message), {
        source: 'window.onerror',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });

    // Auto-capture unhandled promise rejections
    window.addEventListener('unhandledrejection', function (event) {
      captureError(event.reason || new Error('Unhandled promise rejection'), {
        source: 'unhandledrejection'
      });
    });

    // Auto-bind to auth state changes if Firebase is available
    _bindAuthContext();

    _initialized = true;
    addBreadcrumb({ category: 'sentry', message: 'Sentry initialized', level: 'info' });
  }

  /**
   * Bind to Firebase auth state to auto-set user context.
   */
  function _bindAuthContext() {
    try {
      if (window.firebase && window.firebase.auth) {
        window.firebase.auth().onAuthStateChanged(function (user) {
          if (user) {
            setUser({
              id: user.uid,
              email: user.email || '',
              displayName: user.displayName || ''
            });
          } else {
            setUser(null);
          }
        });
      }
    } catch (_err) {
      // Firebase not available — skip auto-bind
    }
  }

  // ─── Breadcrumbs ──────────────────────────────────────────

  /**
   * Add a breadcrumb for debugging context.
   * @param {{ category: string, message: string, level?: string, data?: Object }} crumb
   */
  function addBreadcrumb(crumb) {
    _breadcrumbs.push({
      timestamp: new Date().toISOString(),
      category: crumb.category || 'default',
      message: crumb.message || '',
      level: crumb.level || 'info',
      data: crumb.data || null
    });
    if (_breadcrumbs.length > MAX_BREADCRUMBS) {
      _breadcrumbs = _breadcrumbs.slice(-MAX_BREADCRUMBS);
    }
  }

  // ─── User Context ─────────────────────────────────────────

  /**
   * Set user context for error reports.
   * @param {{ id: string, email?: string, displayName?: string, plan?: string }|null} user
   */
  function setUser(user) {
    _user = user;
    if (user) {
      _tags.userId = user.id;
      if (user.plan) _tags.userPlan = user.plan;
    } else {
      delete _tags.userId;
      delete _tags.userPlan;
    }
  }

  /**
   * Set a custom tag.
   * @param {string} key
   * @param {string} value
   */
  function setTag(key, value) {
    _tags[key] = value;
  }

  /**
   * Set extra context data.
   * @param {string} key
   * @param {*} value
   */
  function setExtra(key, value) {
    _extraContext[key] = value;
  }

  // ─── Capture Methods ──────────────────────────────────────

  /**
   * Build the common payload envelope.
   * @param {string} level
   * @returns {Object}
   */
  function _buildPayload(level) {
    return {
      dsn: _dsn,
      timestamp: new Date().toISOString(),
      level: level,
      environment: _environment,
      release: _release,
      url: window.location.href,
      userAgent: navigator.userAgent,
      user: _user,
      tags: Object.assign({}, _tags),
      extra: Object.assign({}, _extraContext),
      breadcrumbs: _breadcrumbs.slice()
    };
  }

  /**
   * Capture an error/exception.
   * @param {Error|string} error
   * @param {Object} [extra] — additional context
   */
  function captureError(error, extra) {
    if (!_dsn) return;
    if (Math.random() > _sampleRate) return;

    var err = typeof error === 'string' ? new Error(error) : error;
    var payload = _buildPayload('error');
    payload.message = err ? err.message : 'Unknown error';
    payload.stack = err && err.stack ? err.stack : null;
    payload.errorName = err && err.name ? err.name : 'Error';
    if (extra) payload.extra = Object.assign(payload.extra, extra);

    addBreadcrumb({
      category: 'error',
      message: payload.message,
      level: 'error',
      data: extra
    });

    _send(payload);
  }

  /**
   * Capture a non-error message.
   * @param {string} message
   * @param {'info'|'warning'|'error'|'debug'} [level]
   * @param {Object} [extra]
   */
  function captureMessage(message, level, extra) {
    if (!_dsn) return;

    var payload = _buildPayload(level || 'info');
    payload.message = message;
    if (extra) payload.extra = Object.assign(payload.extra, extra);

    addBreadcrumb({
      category: 'message',
      message: message,
      level: level || 'info'
    });

    _send(payload);
  }

  /**
   * Send payload to relay endpoint.
   * @param {Object} payload
   */
  function _send(payload) {
    try {
      var body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        navigator.sendBeacon(RELAY_ENDPOINT, body);
      } else {
        fetch(RELAY_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body,
          keepalive: true
        }).catch(function () {});
      }
    } catch (_err) {
      // Silent — error reporting must never cause errors
    }
  }

  /**
   * Get current configuration snapshot (for diagnostics).
   * @returns {Object}
   */
  function getConfig() {
    return {
      initialized: _initialized,
      dsn: _dsn ? '***' + _dsn.slice(-8) : '',
      environment: _environment,
      release: _release,
      sampleRate: _sampleRate,
      breadcrumbCount: _breadcrumbs.length,
      tags: Object.assign({}, _tags),
      hasUser: !!_user
    };
  }

  // ─── Export ───────────────────────────────────────────────
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.SentryConfig = {
    init: init,
    captureError: captureError,
    captureMessage: captureMessage,
    addBreadcrumb: addBreadcrumb,
    setUser: setUser,
    setTag: setTag,
    setExtra: setExtra,
    getConfig: getConfig,
    detectEnvironment: detectEnvironment,
    version: '1.0.0'
  };
})();
