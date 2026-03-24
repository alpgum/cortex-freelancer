/**
 * CF-104: Global error boundary with error reporting
 * window.onerror + unhandledrejection → logging endpoint.
 */
(function () {
  'use strict';
  window.CortexFreelancer = window.CortexFreelancer || {};

  var ERROR_ENDPOINT = '/api/track';
  var MAX_ERRORS_PER_SESSION = 20;
  var errorCount = 0;

  function reportError(payload) {
    if (errorCount >= MAX_ERRORS_PER_SESSION) return;
    errorCount++;
    try {
      var body = JSON.stringify({
        event: 'client_error',
        data: {
          message: payload.message || 'Unknown error',
          source: payload.source || '',
          lineno: payload.lineno || 0,
          colno: payload.colno || 0,
          stack: payload.stack || '',
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        }
      });
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

  window.onerror = function (message, source, lineno, colno, error) {
    reportError({
      message: message,
      source: source,
      lineno: lineno,
      colno: colno,
      stack: error && error.stack ? error.stack.substring(0, 1000) : ''
    });
  };

  window.addEventListener('unhandledrejection', function (event) {
    var reason = event.reason || {};
    reportError({
      message: typeof reason === 'string' ? reason : (reason.message || 'Unhandled promise rejection'),
      stack: reason.stack ? reason.stack.substring(0, 1000) : '',
      source: 'unhandledrejection'
    });
  });

  window.CortexFreelancer.GlobalErrorBoundary = {
    reportError: reportError,
    getErrorCount: function () { return errorCount; }
  };
})();
