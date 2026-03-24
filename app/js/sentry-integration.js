/**
 * CF-265: Sentry Error Monitoring Integration
 * Lightweight Sentry setup for frontend JS errors and API function errors.
 */
(function () {
  'use strict';

  var SENTRY_DSN_META = 'sentry-dsn';
  var MAX_BREADCRUMBS = 50;
  var SAMPLE_RATE = 1.0;
  var initialized = false;
  var dsn = '';
  var breadcrumbs = [];
  var userId = null;
  var tags = {};

  /**
   * Initialize Sentry with DSN.
   * @param {{ dsn: string, sampleRate?: number, userId?: string, environment?: string }} config
   */
  function init(config) {
    config = config || {};
    dsn = config.dsn || getMetaDsn();
    if (!dsn) return;

    userId = config.userId || null;
    tags.environment = config.environment || getEnvironment();

    window.addEventListener('error', function (event) {
      captureException(event.error || new Error(event.message), {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });

    window.addEventListener('unhandledrejection', function (event) {
      captureException(event.reason || new Error('Unhandled promise rejection'), {
        type: 'unhandledrejection'
      });
    });

    initialized = true;
  }

  function getMetaDsn() {
    var el = document.querySelector('meta[name="' + SENTRY_DSN_META + '"]');
    return el ? el.getAttribute('content') : '';
  }

  function getEnvironment() {
    var host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return 'development';
    if (host.includes('preview') || host.includes('staging')) return 'staging';
    return 'production';
  }

  /**
   * Add a breadcrumb for debugging context.
   * @param {{ category: string, message: string, level?: string, data?: Object }} crumb
   */
  function addBreadcrumb(crumb) {
    breadcrumbs.push({
      timestamp: new Date().toISOString(),
      category: crumb.category || 'default',
      message: crumb.message || '',
      level: crumb.level || 'info',
      data: crumb.data || null
    });
    if (breadcrumbs.length > MAX_BREADCRUMBS) {
      breadcrumbs = breadcrumbs.slice(-MAX_BREADCRUMBS);
    }
  }

  /**
   * Capture an exception and send to Sentry.
   * @param {Error} error
   * @param {Object} [extra]
   */
  function captureException(error, extra) {
    if (!dsn) return;
    if (Math.random() > SAMPLE_RATE) return;

    var payload = {
      dsn: dsn,
      timestamp: new Date().toISOString(),
      level: 'error',
      message: error ? error.message : 'Unknown error',
      stack: error && error.stack ? error.stack : null,
      url: window.location.href,
      userAgent: navigator.userAgent,
      userId: userId,
      tags: tags,
      extra: extra || {},
      breadcrumbs: breadcrumbs.slice()
    };

    sendToSentry(payload);
  }

  /**
   * Capture a message (non-error event).
   * @param {string} message
   * @param {string} [level]
   */
  function captureMessage(message, level) {
    if (!dsn) return;

    var payload = {
      dsn: dsn,
      timestamp: new Date().toISOString(),
      level: level || 'info',
      message: message,
      url: window.location.href,
      userId: userId,
      tags: tags,
      breadcrumbs: breadcrumbs.slice()
    };

    sendToSentry(payload);
  }

  /**
   * Set user context.
   * @param {{ id: string, email?: string, plan?: string }} user
   */
  function setUser(user) {
    userId = user ? user.id : null;
    if (user) {
      tags.userPlan = user.plan || 'free';
    }
  }

  /**
   * Set a custom tag.
   * @param {string} key
   * @param {string} value
   */
  function setTag(key, value) {
    tags[key] = value;
  }

  /**
   * Send payload to Sentry endpoint.
   * @param {Object} payload
   */
  function sendToSentry(payload) {
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/sentry-relay', JSON.stringify(payload));
      } else {
        fetch('/api/sentry-relay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true
        }).catch(function () {});
      }
    } catch (_err) {
      // Silent fail — we don't want error reporting to cause errors
    }
  }

  /**
   * Check if Sentry is initialized.
   * @returns {boolean}
   */
  function isInitialized() {
    return initialized;
  }

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.SentryIntegration = {
    init: init,
    captureException: captureException,
    captureMessage: captureMessage,
    addBreadcrumb: addBreadcrumb,
    setUser: setUser,
    setTag: setTag,
    isInitialized: isInitialized
  };
})();
