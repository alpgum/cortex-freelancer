/**
 * CF-266: Structured Logging for API Functions
 * Consistent JSON logging with request ID, user ID, action, and timing.
 */
(function () {
  'use strict';

  var LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
  var currentLevel = LOG_LEVELS.info;
  var logBuffer = [];
  var MAX_BUFFER = 200;
  var requestCounter = 0;

  /**
   * Generate a unique request ID.
   * @returns {string}
   */
  function generateRequestId() {
    requestCounter++;
    return 'req_' + Date.now().toString(36) + '_' + requestCounter.toString(36);
  }

  /**
   * Set minimum log level.
   * @param {'debug'|'info'|'warn'|'error'} level
   */
  function setLevel(level) {
    if (LOG_LEVELS[level] !== undefined) {
      currentLevel = LOG_LEVELS[level];
    }
  }

  /**
   * Create a structured log entry.
   * @param {string} level
   * @param {string} action
   * @param {Object} [data]
   * @returns {Object}
   */
  function createEntry(level, action, data) {
    return {
      timestamp: new Date().toISOString(),
      level: level,
      action: action,
      requestId: data && data.requestId ? data.requestId : null,
      userId: data && data.userId ? data.userId : null,
      duration: data && data.duration !== undefined ? data.duration : null,
      meta: data && data.meta ? data.meta : null,
      message: data && data.message ? data.message : null,
      error: data && data.error ? String(data.error) : null
    };
  }

  /**
   * Write a log entry.
   * @param {string} level
   * @param {string} action
   * @param {Object} [data]
   */
  function log(level, action, data) {
    if (LOG_LEVELS[level] === undefined || LOG_LEVELS[level] < currentLevel) return;

    var entry = createEntry(level, action, data);

    logBuffer.push(entry);
    if (logBuffer.length > MAX_BUFFER) {
      logBuffer = logBuffer.slice(-MAX_BUFFER);
    }

    // Console output in dev
    var env = typeof window !== 'undefined' && window.location
      ? window.location.hostname : '';
    if (env === 'localhost' || env === '127.0.0.1') {
      var consoleFn = level === 'error' ? console.error
        : level === 'warn' ? console.warn
        : console.log;
      consoleFn('[' + entry.timestamp + '] ' + level.toUpperCase() + ' ' + action, entry);
    }

    return entry;
  }

  function debug(action, data) { return log('debug', action, data); }
  function info(action, data) { return log('info', action, data); }
  function warn(action, data) { return log('warn', action, data); }
  function error(action, data) { return log('error', action, data); }

  /**
   * Create a timed logger for measuring operation duration.
   * @param {string} action
   * @param {Object} [data]
   * @returns {{ end: function, fail: function }}
   */
  function startTimer(action, data) {
    var start = Date.now();
    var reqId = generateRequestId();
    var baseData = Object.assign({}, data || {}, { requestId: reqId });

    info(action + '.start', baseData);

    return {
      end: function (extraData) {
        var merged = Object.assign({}, baseData, extraData || {}, { duration: Date.now() - start });
        info(action + '.end', merged);
        return merged;
      },
      fail: function (err, extraData) {
        var merged = Object.assign({}, baseData, extraData || {}, {
          duration: Date.now() - start,
          error: err ? err.message || String(err) : 'unknown'
        });
        error(action + '.fail', merged);
        return merged;
      }
    };
  }

  /**
   * Get recent log entries.
   * @param {{ level?: string, action?: string, limit?: number }} [filters]
   * @returns {Array}
   */
  function getEntries(filters) {
    filters = filters || {};
    var result = logBuffer.slice();

    if (filters.level) {
      var minLevel = LOG_LEVELS[filters.level] || 0;
      result = result.filter(function (e) { return LOG_LEVELS[e.level] >= minLevel; });
    }
    if (filters.action) {
      var pattern = filters.action;
      result = result.filter(function (e) { return e.action.indexOf(pattern) >= 0; });
    }
    if (filters.limit) {
      result = result.slice(-filters.limit);
    }

    return result;
  }

  /**
   * Flush buffer and return all entries.
   * @returns {Array}
   */
  function flush() {
    var entries = logBuffer.slice();
    logBuffer = [];
    return entries;
  }

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.StructuredLogging = {
    setLevel: setLevel,
    log: log,
    debug: debug,
    info: info,
    warn: warn,
    error: error,
    startTimer: startTimer,
    getEntries: getEntries,
    flush: flush,
    generateRequestId: generateRequestId
  };
})();
