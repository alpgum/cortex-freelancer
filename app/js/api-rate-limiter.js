/**
 * Cortex Freelancer — Upwork API Rate Limit Handler
 * [CF-080] Exponential backoff, request queuing, and rate limit dashboard.
 */

(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Constants ────────────────────────────────────────────────────

  var STORAGE_KEY = 'cf_rate_limiter';

  var DEFAULTS = {
    maxRetries: 5,
    baseDelayMs: 1000,
    maxDelayMs: 60000,
    maxConcurrent: 3,
    requestsPerMinute: 30,
    requestsPerHour: 500,
    jitterFactor: 0.3       // ±30% jitter on backoff
  };

  // ─── Rate Limiter Core ────────────────────────────────────────────

  function createRateLimiter(config) {
    var cfg = Object.assign({}, DEFAULTS, config);

    var state = {
      queue: [],
      active: 0,
      history: [],           // { timestamp, endpoint, status, duration, retries }
      windowMinute: [],      // timestamps within current minute
      windowHour: [],        // timestamps within current hour
      paused: false,
      stats: {
        totalRequests: 0,
        successCount: 0,
        retryCount: 0,
        failCount: 0,
        rateLimitHits: 0,
        avgResponseTime: 0,
        lastRateLimitAt: null
      }
    };

    // Load persisted stats
    _loadStats(state);

    // ─── Backoff Calculation ──────────────────────────────────────

    function calculateBackoff(attempt) {
      // Exponential backoff: base * 2^attempt with jitter
      var delay = cfg.baseDelayMs * Math.pow(2, attempt);
      delay = Math.min(delay, cfg.maxDelayMs);

      // Add jitter: ±jitterFactor
      var jitter = delay * cfg.jitterFactor;
      delay += (Math.random() * 2 - 1) * jitter;

      return Math.max(0, Math.round(delay));
    }

    // ─── Window Rate Checking ─────────────────────────────────────

    function _pruneWindow(window, maxAgeMs) {
      var cutoff = Date.now() - maxAgeMs;
      while (window.length > 0 && window[0] < cutoff) {
        window.shift();
      }
    }

    function canSendRequest() {
      if (state.paused) return false;
      if (state.active >= cfg.maxConcurrent) return false;

      _pruneWindow(state.windowMinute, 60000);
      _pruneWindow(state.windowHour, 3600000);

      if (state.windowMinute.length >= cfg.requestsPerMinute) return false;
      if (state.windowHour.length >= cfg.requestsPerHour) return false;

      return true;
    }

    function _recordRequest() {
      var now = Date.now();
      state.windowMinute.push(now);
      state.windowHour.push(now);
      state.active++;
      state.stats.totalRequests++;
    }

    function _completeRequest() {
      state.active = Math.max(0, state.active - 1);
    }

    // ─── Request Execution ────────────────────────────────────────

    /**
     * Execute a request with rate limiting and retry logic.
     * @param {Function} requestFn - async function that makes the actual request.
     *   Must return { status, data, headers } or throw.
     * @param {Object} opts - { endpoint, priority, maxRetries }
     * @returns {Promise} resolves with response data
     */
    function execute(requestFn, opts) {
      opts = opts || {};

      return new Promise(function (resolve, reject) {
        var task = {
          fn: requestFn,
          endpoint: opts.endpoint || 'unknown',
          priority: opts.priority || 0,
          maxRetries: opts.maxRetries !== undefined ? opts.maxRetries : cfg.maxRetries,
          attempt: 0,
          createdAt: Date.now(),
          resolve: resolve,
          reject: reject
        };

        _enqueue(task);
        _processQueue();
      });
    }

    function _enqueue(task) {
      // Insert by priority (higher priority first)
      var inserted = false;
      for (var i = 0; i < state.queue.length; i++) {
        if (task.priority > state.queue[i].priority) {
          state.queue.splice(i, 0, task);
          inserted = true;
          break;
        }
      }
      if (!inserted) state.queue.push(task);
    }

    function _processQueue() {
      while (state.queue.length > 0 && canSendRequest()) {
        var task = state.queue.shift();
        _executeTask(task);
      }

      // Schedule retry if queue has items but can't send yet
      if (state.queue.length > 0 && !canSendRequest()) {
        var waitMs = _getWaitTime();
        setTimeout(function () { _processQueue(); }, waitMs);
      }
    }

    function _getWaitTime() {
      if (state.paused) return 5000;

      // Check which limit we're hitting
      _pruneWindow(state.windowMinute, 60000);
      if (state.windowMinute.length >= cfg.requestsPerMinute) {
        // Wait until oldest entry in minute window expires
        return Math.max(100, 60000 - (Date.now() - state.windowMinute[0]) + 100);
      }

      if (state.active >= cfg.maxConcurrent) return 500;

      return 1000;
    }

    function _executeTask(task) {
      _recordRequest();
      var startTime = Date.now();

      try {
        var result = task.fn();

        // Handle both sync and async
        if (result && typeof result.then === 'function') {
          result.then(
            function (response) { _handleSuccess(task, response, startTime); },
            function (error) { _handleError(task, error, startTime); }
          );
        } else {
          _handleSuccess(task, result, startTime);
        }
      } catch (error) {
        _handleError(task, error, startTime);
      }
    }

    function _handleSuccess(task, response, startTime) {
      var duration = Date.now() - startTime;
      _completeRequest();

      // Check for rate limit response
      var status = response && response.status;
      if (status === 429) {
        _handleRateLimit(task, response, startTime);
        return;
      }

      state.stats.successCount++;
      _updateAvgResponseTime(duration);
      _addHistory(task.endpoint, status || 200, duration, task.attempt);
      _saveStats(state);

      task.resolve(response);
      _processQueue();
    }

    function _handleError(task, error, startTime) {
      var duration = Date.now() - startTime;
      _completeRequest();

      var status = error && (error.status || error.statusCode);

      // Rate limit (429)
      if (status === 429) {
        _handleRateLimit(task, error, startTime);
        return;
      }

      // Server errors (5xx) — retry
      if (status >= 500 && task.attempt < task.maxRetries) {
        _retry(task);
        return;
      }

      // Network errors — retry
      if (!status && task.attempt < task.maxRetries) {
        _retry(task);
        return;
      }

      // Final failure
      state.stats.failCount++;
      _addHistory(task.endpoint, status || 0, duration, task.attempt);
      _saveStats(state);

      task.reject(error);
      _processQueue();
    }

    function _handleRateLimit(task, response, startTime) {
      state.stats.rateLimitHits++;
      state.stats.lastRateLimitAt = new Date().toISOString();

      // Check Retry-After header
      var retryAfter = null;
      if (response && response.headers) {
        retryAfter = response.headers['retry-after'] || response.headers['Retry-After'];
      }

      var waitMs;
      if (retryAfter) {
        waitMs = parseInt(retryAfter, 10) * 1000;
        if (isNaN(waitMs)) waitMs = calculateBackoff(task.attempt);
      } else {
        waitMs = calculateBackoff(task.attempt);
      }

      _addHistory(task.endpoint, 429, Date.now() - startTime, task.attempt);

      if (task.attempt < task.maxRetries) {
        task.attempt++;
        state.stats.retryCount++;
        setTimeout(function () {
          _enqueue(task);
          _processQueue();
        }, waitMs);
      } else {
        state.stats.failCount++;
        _saveStats(state);
        task.reject(new Error('Rate limit exceeded after ' + task.maxRetries + ' retries'));
        _processQueue();
      }
    }

    function _retry(task) {
      task.attempt++;
      state.stats.retryCount++;
      var delay = calculateBackoff(task.attempt);
      setTimeout(function () {
        _enqueue(task);
        _processQueue();
      }, delay);
    }

    // ─── History & Stats ──────────────────────────────────────────

    function _addHistory(endpoint, status, duration, retries) {
      state.history.push({
        timestamp: new Date().toISOString(),
        endpoint: endpoint,
        status: status,
        duration: duration,
        retries: retries
      });
      // Keep last 200 entries
      if (state.history.length > 200) {
        state.history = state.history.slice(-200);
      }
    }

    function _updateAvgResponseTime(duration) {
      var total = state.stats.totalRequests;
      if (total <= 1) {
        state.stats.avgResponseTime = duration;
      } else {
        state.stats.avgResponseTime = Math.round(
          (state.stats.avgResponseTime * (total - 1) + duration) / total
        );
      }
    }

    function _loadStats(st) {
      try {
        var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        if (saved.stats) Object.assign(st.stats, saved.stats);
      } catch (e) { /* ignore */ }
    }

    function _saveStats(st) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ stats: st.stats }));
      } catch (e) { /* ignore */ }
    }

    // ─── Control Methods ──────────────────────────────────────────

    function pause() {
      state.paused = true;
    }

    function resume() {
      state.paused = false;
      _processQueue();
    }

    function clearQueue() {
      var cleared = state.queue.length;
      state.queue.forEach(function (task) {
        task.reject(new Error('Queue cleared'));
      });
      state.queue = [];
      return cleared;
    }

    function resetStats() {
      state.stats = {
        totalRequests: 0, successCount: 0, retryCount: 0,
        failCount: 0, rateLimitHits: 0, avgResponseTime: 0, lastRateLimitAt: null
      };
      state.history = [];
      _saveStats(state);
    }

    function getStatus() {
      _pruneWindow(state.windowMinute, 60000);
      _pruneWindow(state.windowHour, 3600000);

      return {
        paused: state.paused,
        queueLength: state.queue.length,
        activeRequests: state.active,
        requestsThisMinute: state.windowMinute.length,
        requestsThisHour: state.windowHour.length,
        limitsPerMinute: cfg.requestsPerMinute,
        limitsPerHour: cfg.requestsPerHour,
        maxConcurrent: cfg.maxConcurrent,
        minuteUtilization: Math.round((state.windowMinute.length / cfg.requestsPerMinute) * 100),
        hourUtilization: Math.round((state.windowHour.length / cfg.requestsPerHour) * 100),
        stats: Object.assign({}, state.stats),
        recentHistory: state.history.slice(-20)
      };
    }

    function updateConfig(newConfig) {
      Object.assign(cfg, newConfig);
    }

    // ─── Public API ───────────────────────────────────────────────

    return {
      execute: execute,
      pause: pause,
      resume: resume,
      clearQueue: clearQueue,
      resetStats: resetStats,
      getStatus: getStatus,
      updateConfig: updateConfig,
      calculateBackoff: calculateBackoff,
      canSendRequest: canSendRequest
    };
  }

  // ─── Singleton Instance ───────────────────────────────────────────

  var defaultLimiter = createRateLimiter();

  // ─── Dashboard Renderer ───────────────────────────────────────────

  function renderDashboard(containerId, limiter) {
    var container = document.getElementById(containerId);
    if (!container) return;

    limiter = limiter || defaultLimiter;
    var status = limiter.getStatus();

    var html = '<div class="cf-rate-dashboard">';
    html += '<h3>⚡ API Rate Limit Dashboard</h3>';

    // Status indicator
    var statusColor = status.paused ? '#ff4444' : (status.minuteUtilization > 80 ? '#ffaa00' : '#00ff88');
    var statusLabel = status.paused ? '⏸ Paused' : (status.minuteUtilization > 80 ? '⚠️ High Usage' : '✅ Normal');
    html += '<div class="cf-rate-status" style="border-left:4px solid ' + statusColor + '">';
    html += '<strong>' + statusLabel + '</strong>';
    html += ' · Queue: ' + status.queueLength;
    html += ' · Active: ' + status.activeRequests + '/' + status.maxConcurrent;
    html += '</div>';

    // Rate meters
    html += '<div class="cf-rate-meters">';
    html += _renderMeter('Per Minute', status.requestsThisMinute, status.limitsPerMinute, status.minuteUtilization);
    html += _renderMeter('Per Hour', status.requestsThisHour, status.limitsPerHour, status.hourUtilization);
    html += '</div>';

    // Stats
    html += '<div class="cf-rate-stats">';
    html += '<div>📊 Total: <strong>' + status.stats.totalRequests + '</strong></div>';
    html += '<div>✅ Success: <strong>' + status.stats.successCount + '</strong></div>';
    html += '<div>🔄 Retries: <strong>' + status.stats.retryCount + '</strong></div>';
    html += '<div>❌ Failed: <strong>' + status.stats.failCount + '</strong></div>';
    html += '<div>🚫 Rate Limited: <strong>' + status.stats.rateLimitHits + '</strong></div>';
    html += '<div>⏱️ Avg Response: <strong>' + status.stats.avgResponseTime + 'ms</strong></div>';
    if (status.stats.lastRateLimitAt) {
      html += '<div>⏰ Last 429: <strong>' + new Date(status.stats.lastRateLimitAt).toLocaleTimeString() + '</strong></div>';
    }
    html += '</div>';

    // Success rate
    var successRate = status.stats.totalRequests > 0
      ? Math.round((status.stats.successCount / status.stats.totalRequests) * 100)
      : 100;
    html += '<div class="cf-rate-success">Success Rate: <strong>' + successRate + '%</strong></div>';

    // Recent history
    if (status.recentHistory.length > 0) {
      html += '<details class="cf-rate-history"><summary>📜 Recent Requests (' + status.recentHistory.length + ')</summary>';
      html += '<div class="cf-rate-history-list">';
      status.recentHistory.slice().reverse().forEach(function (h) {
        var icon = h.status === 200 ? '✅' : h.status === 429 ? '🚫' : '❌';
        html += '<div class="cf-rate-history-item">';
        html += icon + ' ' + h.endpoint + ' — ' + h.status + ' (' + h.duration + 'ms)';
        if (h.retries > 0) html += ' [' + h.retries + ' retries]';
        html += '</div>';
      });
      html += '</div></details>';
    }

    // Controls
    html += '<div class="cf-rate-controls">';
    html += '<button class="cf-rate-btn" id="cf-rate-toggle">' + (status.paused ? '▶ Resume' : '⏸ Pause') + '</button>';
    html += '<button class="cf-rate-btn" id="cf-rate-clear">🗑 Clear Queue</button>';
    html += '<button class="cf-rate-btn" id="cf-rate-reset">↺ Reset Stats</button>';
    html += '</div>';

    html += '</div>';

    container.innerHTML = html;

    // Bind controls
    var toggleBtn = document.getElementById('cf-rate-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', function () {
        if (status.paused) limiter.resume(); else limiter.pause();
        renderDashboard(containerId, limiter);
      });
    }
    var clearBtn = document.getElementById('cf-rate-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        limiter.clearQueue();
        renderDashboard(containerId, limiter);
      });
    }
    var resetBtn = document.getElementById('cf-rate-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        limiter.resetStats();
        renderDashboard(containerId, limiter);
      });
    }
  }

  function _renderMeter(label, current, max, pct) {
    var color = pct > 80 ? '#ff4444' : pct > 50 ? '#ffaa00' : '#00ff88';
    return '<div class="cf-rate-meter">' +
      '<span>' + label + ': ' + current + '/' + max + '</span>' +
      '<div class="cf-rate-bar"><div class="cf-rate-bar-fill" style="width:' + pct + '%;background:' + color + '"></div></div>' +
      '</div>';
  }

  // ─── Export ───────────────────────────────────────────────────────

  window.CortexFreelancer.ApiRateLimiter = {
    create: createRateLimiter,
    default: defaultLimiter,
    execute: function (fn, opts) { return defaultLimiter.execute(fn, opts); },
    pause: function () { return defaultLimiter.pause(); },
    resume: function () { return defaultLimiter.resume(); },
    getStatus: function () { return defaultLimiter.getStatus(); },
    clearQueue: function () { return defaultLimiter.clearQueue(); },
    resetStats: function () { return defaultLimiter.resetStats(); },
    renderDashboard: renderDashboard
  };

})();
