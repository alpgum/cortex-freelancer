/**
 * [CF-101] Fix uncaught promise rejections in fetch calls
 * [CF-104] Global error boundary with error reporting
 *
 * Catches all uncaught errors and unhandled promise rejections,
 * logs them to console, and sends to Sentry if available.
 * Also provides a safe fetch wrapper.
 */
(function () {
  'use strict';

  var MAX_ERRORS = 20;
  var errorCount = 0;

  // ── [CF-104] Global error handler ──
  window.onerror = function (message, source, lineno, colno, error) {
    if (errorCount >= MAX_ERRORS) return;
    errorCount++;

    var info = {
      type: 'error',
      message: message,
      source: source,
      line: lineno,
      col: colno,
      stack: error && error.stack ? error.stack.substring(0, 500) : null,
      url: location.href,
      timestamp: new Date().toISOString()
    };

    console.error('[ErrorBoundary]', info.message, '(' + info.source + ':' + info.line + ')');

    // Send to Sentry if available
    if (typeof Sentry !== 'undefined' && Sentry.captureException && error) {
      try { Sentry.captureException(error); } catch (e) { /* ignore */ }
    }
  };

  // ── [CF-101] Unhandled promise rejection handler ──
  window.addEventListener('unhandledrejection', function (event) {
    if (errorCount >= MAX_ERRORS) return;
    errorCount++;

    var reason = event.reason;
    var message = reason instanceof Error ? reason.message : String(reason || 'Unknown rejection');
    var stack = reason instanceof Error ? (reason.stack || '').substring(0, 500) : '';

    console.error('[ErrorBoundary] Unhandled rejection:', message);

    // Send to Sentry if available
    if (typeof Sentry !== 'undefined' && Sentry.captureException && reason instanceof Error) {
      try { Sentry.captureException(reason); } catch (e) { /* ignore */ }
    }

    // Prevent default browser handling (noisy console errors)
    event.preventDefault();
  });

  // ── [CF-101] Safe fetch wrapper ──
  // Drop-in replacement for fetch() that never throws unhandled rejections
  window.cortexFetch = function (url, options) {
    return fetch(url, options).catch(function (err) {
      console.warn('[cortexFetch] Network error for', typeof url === 'string' ? url : (url && url.url) || 'unknown', ':', err.message);
      // Return a synthetic offline response
      return new Response(JSON.stringify({ error: 'offline', message: err.message }), {
        status: 0,
        statusText: 'Network Error',
        headers: { 'Content-Type': 'application/json' }
      });
    });
  };

})();
