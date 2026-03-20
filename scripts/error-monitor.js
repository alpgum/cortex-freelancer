(function() {
  var MAX_ERRORS = 50;
  var STORAGE_KEY = 'cortex_errors';

  function getErrors() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch(e) { return []; }
  }

  function saveError(entry) {
    var errors = getErrors();
    errors.push(entry);
    if (errors.length > MAX_ERRORS) errors = errors.slice(-MAX_ERRORS);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(errors)); } catch(e) {}
  }

  window.onerror = function(message, source, lineno, colno) {
    saveError({
      timestamp: new Date().toISOString(),
      message: String(message),
      file: source || '',
      line: (lineno || '') + (colno ? ':' + colno : '')
    });
  };

  window.onunhandledrejection = function(event) {
    var msg = event.reason ? (event.reason.message || String(event.reason)) : 'Unhandled Promise rejection';
    saveError({
      timestamp: new Date().toISOString(),
      message: msg,
      file: '',
      line: ''
    });
  };

  // Expose helpers for admin page
  window.__cortexErrors = {
    getAll: getErrors,
    clear: function() { localStorage.removeItem(STORAGE_KEY); },
    count: function() { return getErrors().length; }
  };
})();
