/* ===== [250] ERROR TRACKER — Global Error + Unhandled Rejection Logger ===== */
(function() {
  'use strict';

  var MAX_ERRORS = 50;
  var COLLECTION = 'client_errors';

  var errorQueue = [];

  function getFirestore() {
    return window._cortexFirestore || null;
  }

  function formatError(msg, source, line, col, errorObj) {
    return {
      message: String(msg || 'Unknown error').substring(0, 500),
      source: String(source || '').substring(0, 200),
      line: line || null,
      col: col || null,
      stack: errorObj && errorObj.stack ? errorObj.stack.substring(0, 1000) : null,
      url: window.location.pathname,
      userAgent: navigator.userAgent.substring(0, 200),
      timestamp: new Date().toISOString()
    };
  }

  function logToFirestore(errorData) {
    var db = getFirestore();
    if (!db) {
      // Queue for later if Firestore not ready yet
      if (errorQueue.length < MAX_ERRORS) errorQueue.push(errorData);
      return;
    }
    try {
      db.collection(COLLECTION).add(errorData);
    } catch (e) {
      // Silently fail — don't cause more errors
    }
  }

  function flushQueue() {
    var db = getFirestore();
    if (!db || errorQueue.length === 0) return;
    var queue = errorQueue.splice(0);
    queue.forEach(function(err) {
      try { db.collection(COLLECTION).add(err); } catch (e) { /* ignore */ }
    });
  }

  // window.onerror — catches runtime JS errors
  window.onerror = function(msg, source, line, col, errorObj) {
    var data = formatError(msg, source, line, col, errorObj);
    logToFirestore(data);
    // Also log to local storage for admin panel
    if (window.__cortexErrors) {
      window.__cortexErrors.add(data);
    }
    // Don't suppress the error
    return false;
  };

  // unhandledrejection — catches unhandled Promise rejections
  window.addEventListener('unhandledrejection', function(e) {
    var reason = e.reason;
    var msg = reason instanceof Error ? reason.message : String(reason || 'Unhandled rejection');
    var stack = reason instanceof Error ? reason.stack : null;
    var data = {
      message: msg.substring(0, 500),
      source: 'unhandledrejection',
      line: null,
      col: null,
      stack: stack ? stack.substring(0, 1000) : null,
      url: window.location.pathname,
      userAgent: navigator.userAgent.substring(0, 200),
      timestamp: new Date().toISOString()
    };
    logToFirestore(data);
    if (window.__cortexErrors) {
      window.__cortexErrors.add(data);
    }
  });

  // Flush queued errors once Firestore is available
  var flushInterval = setInterval(function() {
    if (getFirestore()) {
      flushQueue();
      clearInterval(flushInterval);
    }
  }, 2000);
  setTimeout(function() { clearInterval(flushInterval); }, 30000);
})();
