/**
 * CF-266: Structured Logging (Enhanced)
 * JSON logger with requestId, userId, action, timing.
 * Console output in dev, batch POST to /api/logs in prod.
 * Includes withContext() for request-scoped logging.
 */
(function () {
  'use strict';

  // ─── Config ───────────────────────────────────────────────
  var LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
  var LOG_ENDPOINT = '/api/logs';
  var BATCH_SIZE = 50;
  var FLUSH_INTERVAL_MS = 10000; // 10 seconds
  var MAX_BUFFER = 500;

  var _level = LOG_LEVELS.info;
  var _buffer = [];
  var _flushTimer = null;
  var _requestCounter = 0;
  var _globalContext = {};
  var _isDev = false;

  // ─── Init ─────────────────────────────────────────────────

  /**
   * Initialize the logger.
   * @param {{ level?: string, userId?: string, context?: Object }} [config]
   */
  function init(config) {
    config = config || {};
    if (config.level && LOG_LEVELS[config.level] !== undefined) {
      _level = LOG_LEVELS[config.level];
    }
    if (config.userId) _globalContext.userId = config.userId;
    if (config.context) Object.assign(_globalContext, config.context);

    var host = window.location.hostname;
    _isDev = host === 'localhost' || host === '127.0.0.1';

    // Auto-flush in prod
    if (!_isDev && !_flushTimer) {
      _flushTimer = setInterval(flush, FLUSH_INTERVAL_MS);
    }

    // Flush on page unload
    window.addEventListener('beforeunload', function () { flush(); });
  }

  // ─── Request ID ───────────────────────────────────────────

  /**
   * Generate a unique request ID.
   * @returns {string}
   */
  function generateRequestId() {
    _requestCounter++;
    return 'req_' + Date.now().toString(36) + '_' + _requestCounter.toString(36);
  }

  // ─── Level Control ────────────────────────────────────────

  /**
   * Set minimum log level.
   * @param {'debug'|'info'|'warn'|'error'} level
   */
  function setLevel(level) {
    if (LOG_LEVELS[level] !== undefined) _level = LOG_LEVELS[level];
  }

  // ─── Core Logger ──────────────────────────────────────────

  /**
   * Create and emit a structured log entry.
   * @param {string} level
   * @param {string} action
   * @param {Object} [data]
   * @returns {Object|null}
   */
  function log(level, action, data) {
    if (LOG_LEVELS[level] === undefined || LOG_LEVELS[level] < _level) return null;

    data = data || {};
    var entry = {
      timestamp: new Date().toISOString(),
      level: level,
      action: action,
      requestId: data.requestId || null,
      userId: data.userId || _globalContext.userId || null,
      duration: data.duration !== undefined ? data.duration : null,
      message: data.message || null,
      error: data.error ? String(data.error) : null,
      meta: data.meta || null
    };

    // Buffer for prod flush
    _buffer.push(entry);
    if (_buffer.length > MAX_BUFFER) {
      _buffer = _buffer.slice(-MAX_BUFFER);
    }

    // Console in dev
    if (_isDev) {
      var fn = level === 'error' ? console.error
        : level === 'warn' ? console.warn
        : level === 'debug' ? (console.debug || console.log)
        : console.log;
      fn('[' + entry.timestamp + '] ' + level.toUpperCase() + ' ' + action, entry);
    }

    // Auto-flush when batch full in prod
    if (!_isDev && _buffer.length >= BATCH_SIZE) {
      flush();
    }

    return entry;
  }

  function debug(action, data) { return log('debug', action, data); }
  function info(action, data)  { return log('info', action, data); }
  function warn(action, data)  { return log('warn', action, data); }
  function error(action, data) { return log('error', action, data); }

  // ─── Timed Operations ─────────────────────────────────────

  /**
   * Start a timer for measuring operation duration.
   * @param {string} action
   * @param {Object} [data]
   * @returns {{ end: function, fail: function, requestId: string }}
   */
  function startTimer(action, data) {
    var start = Date.now();
    var reqId = generateRequestId();
    var baseData = Object.assign({}, data || {}, { requestId: reqId });

    info(action + '.start', baseData);

    return {
      requestId: reqId,
      end: function (extraData) {
        var merged = Object.assign({}, baseData, extraData || {}, { duration: Date.now() - start });
        return info(action + '.end', merged);
      },
      fail: function (err, extraData) {
        var merged = Object.assign({}, baseData, extraData || {}, {
          duration: Date.now() - start,
          error: err ? (err.message || String(err)) : 'unknown'
        });
        return error(action + '.fail', merged);
      }
    };
  }

  // ─── Context Scoping ──────────────────────────────────────

  /**
   * Create a scoped logger with pre-bound context (requestId, userId, etc.).
   * @param {Object} context — { requestId?, userId?, ... }
   * @returns {{ debug, info, warn, error, startTimer }}
   */
  function withContext(context) {
    var ctx = Object.assign({}, _globalContext, context);
    var scopedReqId = ctx.requestId || generateRequestId();
    ctx.requestId = scopedReqId;

    function scopedLog(level, action, data) {
      return log(level, action, Object.assign({}, ctx, data || {}));
    }

    return {
      debug: function (action, data) { return scopedLog('debug', action, data); },
      info:  function (action, data) { return scopedLog('info', action, data); },
      warn:  function (action, data) { return scopedLog('warn', action, data); },
      error: function (action, data) { return scopedLog('error', action, data); },
      startTimer: function (action, data) {
        var start = Date.now();
        var baseData = Object.assign({}, ctx, data || {});
        scopedLog('info', action + '.start', baseData);
        return {
          requestId: scopedReqId,
          end: function (extraData) {
            return scopedLog('info', action + '.end', Object.assign({}, baseData, extraData || {}, { duration: Date.now() - start }));
          },
          fail: function (err, extraData) {
            return scopedLog('error', action + '.fail', Object.assign({}, baseData, extraData || {}, {
              duration: Date.now() - start,
              error: err ? (err.message || String(err)) : 'unknown'
            }));
          }
        };
      },
      requestId: scopedReqId
    };
  }

  // ─── Buffer & Flush ───────────────────────────────────────

  /**
   * Get buffered log entries with optional filters.
   * @param {{ level?: string, action?: string, limit?: number }} [filters]
   * @returns {Array}
   */
  function getEntries(filters) {
    filters = filters || {};
    var result = _buffer.slice();

    if (filters.level) {
      var minLevel = LOG_LEVELS[filters.level] || 0;
      result = result.filter(function (e) { return LOG_LEVELS[e.level] >= minLevel; });
    }
    if (filters.action) {
      var pat = filters.action;
      result = result.filter(function (e) { return e.action.indexOf(pat) >= 0; });
    }
    if (filters.limit) {
      result = result.slice(-filters.limit);
    }
    return result;
  }

  /**
   * Flush buffered entries. In prod, POST to /api/logs. Returns flushed entries.
   * @returns {Array}
   */
  function flush() {
    var entries = _buffer.splice(0, _buffer.length);
    if (entries.length === 0) return entries;

    if (!_isDev) {
      try {
        var body = JSON.stringify({ entries: entries });
        if (navigator.sendBeacon) {
          navigator.sendBeacon(LOG_ENDPOINT, body);
        } else {
          fetch(LOG_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: body,
            keepalive: true
          }).catch(function () {});
        }
      } catch (_err) {
        // Silent fail
      }
    }

    return entries;
  }

  /**
   * Clear the buffer without sending.
   */
  function clear() {
    _buffer = [];
  }

  // ─── Export ───────────────────────────────────────────────
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.StructuredLogger = {
    init: init,
    setLevel: setLevel,
    log: log,
    debug: debug,
    info: info,
    warn: warn,
    error: error,
    startTimer: startTimer,
    withContext: withContext,
    getEntries: getEntries,
    flush: flush,
    clear: clear,
    generateRequestId: generateRequestId,
    version: '1.0.0'
  };
})();
