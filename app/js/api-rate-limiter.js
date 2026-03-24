/**
 * Cortex Freelancer — Upwork API Rate Limit Handler with Retry Queue
 * [CF-080] Exponential backoff, request queuing, and rate limit dashboard.
 *
 * Features:
 *   - Configurable rate limits (per-minute, per-hour, max concurrent)
 *   - Priority-based request queue (higher priority processed first)
 *   - Exponential backoff with jitter for retries
 *   - Retry-After header respect for 429 responses
 *   - Automatic retry for 5xx and network errors
 *   - Real-time dashboard with meters, stats, and history
 *   - Pause/resume/clear controls
 *   - Per-endpoint analytics tracking
 *   - Circuit breaker pattern (auto-pause after repeated failures)
 *   - Factory for custom limiter instances
 *   - init()/render(containerId) interface
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
    jitterFactor: 0.3,
    circuitBreakerThreshold: 10,  // consecutive failures before auto-pause
    circuitBreakerCooldownMs: 30000
  };

  var _initialized = false;
  var _dashboardRefreshTimer = null;

  // ─── Rate Limiter Factory ─────────────────────────────────────────

  function createRateLimiter(config) {
    var cfg = Object.assign({}, DEFAULTS, config);

    var state = {
      queue: [],
      active: 0,
      history: [],
      windowMinute: [],
      windowHour: [],
      paused: false,
      circuitOpen: false,
      consecutiveFailures: 0,
      endpointStats: {},
      stats: {
        totalRequests: 0,
        successCount: 0,
        retryCount: 0,
        failCount: 0,
        rateLimitHits: 0,
        avgResponseTime: 0,
        lastRateLimitAt: null,
        circuitBreaks: 0,
        peakQueueSize: 0,
        startedAt: new Date().toISOString()
      }
    };

    _loadStats(state);

    // ─── Backoff ──────────────────────────────────────────────────

    function calculateBackoff(attempt) {
      var delay = cfg.baseDelayMs * Math.pow(2, attempt);
      delay = Math.min(delay, cfg.maxDelayMs);
      var jitter = delay * cfg.jitterFactor;
      delay += (Math.random() * 2 - 1) * jitter;
      return Math.max(0, Math.round(delay));
    }

    // ─── Window Rate Checking ─────────────────────────────────────

    function _pruneWindow(window, maxAgeMs) {
      var cutoff = Date.now() - maxAgeMs;
      while (window.length > 0 && window[0] < cutoff) window.shift();
    }

    function canSendRequest() {
      if (state.paused || state.circuitOpen) return false;
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
      if (state.queue.length > state.stats.peakQueueSize) state.stats.peakQueueSize = state.queue.length;
    }

    function _completeRequest() {
      state.active = Math.max(0, state.active - 1);
    }

    // ─── Circuit Breaker ──────────────────────────────────────────

    function _checkCircuitBreaker() {
      if (state.consecutiveFailures >= cfg.circuitBreakerThreshold && !state.circuitOpen) {
        state.circuitOpen = true;
        state.stats.circuitBreaks++;
        try {
          window.dispatchEvent(new CustomEvent('cf:ratelimit:circuit-open', {
            detail: { failures: state.consecutiveFailures }
          }));
        } catch (e) { /* old */ }

        setTimeout(function () {
          state.circuitOpen = false;
          state.consecutiveFailures = 0;
          _processQueue();
        }, cfg.circuitBreakerCooldownMs);
      }
    }

    function _resetCircuitBreaker() {
      state.consecutiveFailures = 0;
    }

    // ─── Request Execution ────────────────────────────────────────

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
        _executeTask(state.queue.shift());
      }
      if (state.queue.length > 0 && !canSendRequest()) {
        setTimeout(_processQueue, _getWaitTime());
      }
    }

    function _getWaitTime() {
      if (state.paused || state.circuitOpen) return 5000;
      _pruneWindow(state.windowMinute, 60000);
      if (state.windowMinute.length >= cfg.requestsPerMinute) {
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

      var status = response && response.status;
      if (status === 429) { _handleRateLimit(task, response, startTime); return; }

      state.stats.successCount++;
      _resetCircuitBreaker();
      _updateAvgResponseTime(duration);
      _addHistory(task.endpoint, status || 200, duration, task.attempt);
      _updateEndpointStats(task.endpoint, status || 200, duration);
      _saveStats(state);

      task.resolve(response);
      _processQueue();
    }

    function _handleError(task, error, startTime) {
      var duration = Date.now() - startTime;
      _completeRequest();

      var status = error && (error.status || error.statusCode);

      if (status === 429) { _handleRateLimit(task, error, startTime); return; }

      // Retryable errors (5xx, network)
      if ((status >= 500 || !status) && task.attempt < task.maxRetries) {
        state.consecutiveFailures++;
        _checkCircuitBreaker();
        _retry(task);
        return;
      }

      state.stats.failCount++;
      state.consecutiveFailures++;
      _checkCircuitBreaker();
      _addHistory(task.endpoint, status || 0, duration, task.attempt);
      _updateEndpointStats(task.endpoint, status || 0, duration);
      _saveStats(state);

      task.reject(error);
      _processQueue();
    }

    function _handleRateLimit(task, response, startTime) {
      state.stats.rateLimitHits++;
      state.stats.lastRateLimitAt = new Date().toISOString();

      var retryAfter = null;
      if (response && response.headers) {
        retryAfter = response.headers['retry-after'] || response.headers['Retry-After'];
      }
      var waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : calculateBackoff(task.attempt);
      if (isNaN(waitMs)) waitMs = calculateBackoff(task.attempt);

      _addHistory(task.endpoint, 429, Date.now() - startTime, task.attempt);
      _updateEndpointStats(task.endpoint, 429, Date.now() - startTime);

      if (task.attempt < task.maxRetries) {
        task.attempt++;
        state.stats.retryCount++;
        setTimeout(function () { _enqueue(task); _processQueue(); }, waitMs);
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
      setTimeout(function () { _enqueue(task); _processQueue(); }, calculateBackoff(task.attempt));
    }

    // ─── History & Stats ──────────────────────────────────────────

    function _addHistory(endpoint, status, duration, retries) {
      state.history.push({ timestamp: new Date().toISOString(), endpoint: endpoint, status: status, duration: duration, retries: retries });
      if (state.history.length > 200) state.history = state.history.slice(-200);
    }

    function _updateEndpointStats(endpoint, status, duration) {
      if (!state.endpointStats[endpoint]) {
        state.endpointStats[endpoint] = { total: 0, success: 0, errors: 0, rateLimited: 0, avgDuration: 0 };
      }
      var es = state.endpointStats[endpoint];
      es.total++;
      if (status >= 200 && status < 300) es.success++;
      else if (status === 429) es.rateLimited++;
      else es.errors++;
      es.avgDuration = Math.round((es.avgDuration * (es.total - 1) + duration) / es.total);
    }

    function _updateAvgResponseTime(duration) {
      var total = state.stats.totalRequests;
      state.stats.avgResponseTime = total <= 1 ? duration : Math.round((state.stats.avgResponseTime * (total - 1) + duration) / total);
    }

    function _loadStats(st) {
      try { var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); if (saved.stats) Object.assign(st.stats, saved.stats); } catch (e) { /* */ }
    }

    function _saveStats(st) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ stats: st.stats })); } catch (e) { /* */ }
    }

    // ─── Controls ─────────────────────────────────────────────────

    function pause()  { state.paused = true; }
    function resume() { state.paused = false; state.circuitOpen = false; state.consecutiveFailures = 0; _processQueue(); }

    function clearQueue() {
      var cleared = state.queue.length;
      state.queue.forEach(function (t) { t.reject(new Error('Queue cleared')); });
      state.queue = [];
      return cleared;
    }

    function resetStats() {
      state.stats = {
        totalRequests: 0, successCount: 0, retryCount: 0, failCount: 0,
        rateLimitHits: 0, avgResponseTime: 0, lastRateLimitAt: null,
        circuitBreaks: 0, peakQueueSize: 0, startedAt: new Date().toISOString()
      };
      state.history = [];
      state.endpointStats = {};
      _saveStats(state);
    }

    function getStatus() {
      _pruneWindow(state.windowMinute, 60000);
      _pruneWindow(state.windowHour, 3600000);

      return {
        paused: state.paused,
        circuitOpen: state.circuitOpen,
        consecutiveFailures: state.consecutiveFailures,
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
        endpointStats: Object.assign({}, state.endpointStats),
        recentHistory: state.history.slice(-20),
        config: Object.assign({}, cfg)
      };
    }

    function updateConfig(newConfig) { Object.assign(cfg, newConfig); }

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

  // ─── Singleton ────────────────────────────────────────────────────

  var defaultLimiter = createRateLimiter();

  // ─── Dashboard Renderer ───────────────────────────────────────────

  function render(containerId, limiter) {
    var container = document.getElementById(containerId);
    if (!container) return;

    limiter = limiter || defaultLimiter;
    var status = limiter.getStatus();

    var html = '<div class="cf-rate-dashboard">';
    html += '<h3 style="margin:0 0 16px">⚡ API Rate Limit Dashboard</h3>';

    // ── Status indicator
    var statusColor, statusLabel;
    if (status.paused) { statusColor = '#ff4444'; statusLabel = '⏸ Paused'; }
    else if (status.circuitOpen) { statusColor = '#ff0066'; statusLabel = '🔌 Circuit Open'; }
    else if (status.minuteUtilization > 80) { statusColor = '#ffaa00'; statusLabel = '⚠️ High Usage'; }
    else { statusColor = '#00ff88'; statusLabel = '✅ Normal'; }

    html += '<div style="padding:12px;margin-bottom:16px;border-left:4px solid ' + statusColor + ';border-radius:6px;background:rgba(255,255,255,0.03);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">';
    html += '<div><strong>' + statusLabel + '</strong>';
    html += ' · Queue: <strong>' + status.queueLength + '</strong>';
    html += ' · Active: <strong>' + status.activeRequests + '/' + status.maxConcurrent + '</strong>';
    if (status.circuitOpen) html += ' · <span style="color:#ff0066">Cooling down…</span>';
    html += '</div>';
    html += '<div style="font-size:0.8em;color:#888">Since ' + new Date(status.stats.startedAt).toLocaleString() + '</div>';
    html += '</div>';

    // ── Rate meters
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">';
    html += _renderMeter('Per Minute', status.requestsThisMinute, status.limitsPerMinute, status.minuteUtilization);
    html += _renderMeter('Per Hour', status.requestsThisHour, status.limitsPerHour, status.hourUtilization);
    html += '</div>';

    // ── Stats grid
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:16px">';
    var statItems = [
      { label: 'Total', value: status.stats.totalRequests, icon: '📊' },
      { label: 'Success', value: status.stats.successCount, icon: '✅', color: '#00ff88' },
      { label: 'Retries', value: status.stats.retryCount, icon: '🔄', color: '#ffaa00' },
      { label: 'Failed', value: status.stats.failCount, icon: '❌', color: '#ff4444' },
      { label: 'Rate Limited', value: status.stats.rateLimitHits, icon: '🚫', color: '#ff0066' },
      { label: 'Avg Response', value: status.stats.avgResponseTime + 'ms', icon: '⏱️' },
      { label: 'Circuit Breaks', value: status.stats.circuitBreaks, icon: '🔌' },
      { label: 'Peak Queue', value: status.stats.peakQueueSize, icon: '📈' }
    ];
    statItems.forEach(function (item) {
      html += '<div style="padding:8px;background:rgba(255,255,255,0.03);border-radius:6px;text-align:center">';
      html += '<div style="font-size:0.7em;color:#888">' + item.icon + ' ' + item.label + '</div>';
      html += '<div style="font-size:1.1em;font-weight:600;color:' + (item.color || '#eee') + '">' + item.value + '</div>';
      html += '</div>';
    });
    html += '</div>';

    // ── Success rate bar
    var successRate = status.stats.totalRequests > 0
      ? Math.round((status.stats.successCount / status.stats.totalRequests) * 100) : 100;
    var srColor = successRate >= 95 ? '#00ff88' : successRate >= 80 ? '#ffaa00' : '#ff4444';
    html += '<div style="margin-bottom:16px">';
    html += '<div style="display:flex;justify-content:space-between;font-size:0.85em;color:#aaa;margin-bottom:4px"><span>Success Rate</span><span style="color:' + srColor + '">' + successRate + '%</span></div>';
    html += '<div style="height:6px;background:#1a1a1a;border-radius:3px;overflow:hidden"><div style="height:100%;width:' + successRate + '%;background:' + srColor + ';border-radius:3px"></div></div>';
    html += '</div>';

    // ── Endpoint stats
    var endpoints = Object.keys(status.endpointStats);
    if (endpoints.length > 0) {
      html += '<details style="margin-bottom:12px"><summary style="cursor:pointer;color:#888;font-size:0.85em">📡 Endpoint Stats (' + endpoints.length + ')</summary>';
      html += '<div style="margin-top:8px;overflow-x:auto"><table style="width:100%;font-size:0.8em;border-collapse:collapse">';
      html += '<tr style="color:#888"><th style="text-align:left;padding:4px 6px">Endpoint</th><th style="padding:4px 6px">Total</th><th style="padding:4px 6px">OK</th><th style="padding:4px 6px">Err</th><th style="padding:4px 6px">429</th><th style="padding:4px 6px">Avg ms</th></tr>';
      endpoints.forEach(function (ep) {
        var es = status.endpointStats[ep];
        html += '<tr style="border-top:1px solid #1a1a1a"><td style="padding:4px 6px;color:#ccc;font-family:monospace">' + ep + '</td>';
        html += '<td style="padding:4px 6px;text-align:center">' + es.total + '</td>';
        html += '<td style="padding:4px 6px;text-align:center;color:#00ff88">' + es.success + '</td>';
        html += '<td style="padding:4px 6px;text-align:center;color:#ff4444">' + es.errors + '</td>';
        html += '<td style="padding:4px 6px;text-align:center;color:#ff0066">' + es.rateLimited + '</td>';
        html += '<td style="padding:4px 6px;text-align:center">' + es.avgDuration + '</td></tr>';
      });
      html += '</table></div></details>';
    }

    // ── Recent history
    if (status.recentHistory.length > 0) {
      html += '<details style="margin-bottom:12px"><summary style="cursor:pointer;color:#888;font-size:0.85em">📜 Recent Requests (' + status.recentHistory.length + ')</summary>';
      html += '<div style="margin-top:8px;max-height:200px;overflow-y:auto">';
      status.recentHistory.slice().reverse().forEach(function (h) {
        var icon = h.status >= 200 && h.status < 300 ? '✅' : h.status === 429 ? '🚫' : '❌';
        html += '<div style="padding:3px 0;font-size:0.8em;color:#bbb;border-bottom:1px solid #1a1a1a">';
        html += icon + ' <span style="font-family:monospace;color:#999">' + h.endpoint + '</span>';
        html += ' — ' + h.status + ' (' + h.duration + 'ms)';
        if (h.retries > 0) html += ' <span style="color:#ffaa00">[' + h.retries + ' retries]</span>';
        html += ' <span style="color:#444">' + new Date(h.timestamp).toLocaleTimeString() + '</span>';
        html += '</div>';
      });
      html += '</div></details>';
    }

    // ── Config display
    html += '<details style="margin-bottom:12px"><summary style="cursor:pointer;color:#888;font-size:0.85em">⚙️ Configuration</summary>';
    html += '<div style="margin-top:8px;font-size:0.8em;color:#bbb;display:grid;grid-template-columns:1fr 1fr;gap:4px">';
    html += '<span>Max Retries: ' + status.config.maxRetries + '</span>';
    html += '<span>Base Delay: ' + status.config.baseDelayMs + 'ms</span>';
    html += '<span>Max Delay: ' + status.config.maxDelayMs + 'ms</span>';
    html += '<span>Jitter: ±' + (status.config.jitterFactor * 100) + '%</span>';
    html += '<span>Circuit Threshold: ' + status.config.circuitBreakerThreshold + '</span>';
    html += '<span>Cooldown: ' + (status.config.circuitBreakerCooldownMs / 1000) + 's</span>';
    html += '</div></details>';

    // ── Controls
    html += '<div style="display:flex;gap:8px;flex-wrap:wrap">';
    html += '<button id="cf-rate-toggle" style="padding:6px 14px;border:1px solid #333;border-radius:6px;background:#1a1a1a;color:#ccc;cursor:pointer;font-size:0.85em">' + (status.paused ? '▶ Resume' : '⏸ Pause') + '</button>';
    html += '<button id="cf-rate-clear" style="padding:6px 14px;border:1px solid #333;border-radius:6px;background:#1a1a1a;color:#ccc;cursor:pointer;font-size:0.85em">🗑 Clear Queue (' + status.queueLength + ')</button>';
    html += '<button id="cf-rate-reset" style="padding:6px 14px;border:1px solid #333;border-radius:6px;background:#1a1a1a;color:#ccc;cursor:pointer;font-size:0.85em">↺ Reset Stats</button>';
    html += '<button id="cf-rate-refresh" style="padding:6px 14px;border:1px solid #333;border-radius:6px;background:#1a1a1a;color:#ccc;cursor:pointer;font-size:0.85em">🔄 Refresh</button>';
    html += '</div>';

    html += '</div>';
    container.innerHTML = html;

    // ── Bind controls
    var toggle = document.getElementById('cf-rate-toggle');
    if (toggle) toggle.addEventListener('click', function () {
      if (status.paused) limiter.resume(); else limiter.pause();
      render(containerId, limiter);
    });
    var clear = document.getElementById('cf-rate-clear');
    if (clear) clear.addEventListener('click', function () { limiter.clearQueue(); render(containerId, limiter); });
    var reset = document.getElementById('cf-rate-reset');
    if (reset) reset.addEventListener('click', function () { limiter.resetStats(); render(containerId, limiter); });
    var refresh = document.getElementById('cf-rate-refresh');
    if (refresh) refresh.addEventListener('click', function () { render(containerId, limiter); });
  }

  function _renderMeter(label, current, max, pct) {
    var color = pct > 80 ? '#ff4444' : pct > 50 ? '#ffaa00' : '#00ff88';
    return '<div style="padding:10px;background:rgba(255,255,255,0.03);border-radius:6px">' +
      '<div style="display:flex;justify-content:space-between;font-size:0.85em;color:#aaa;margin-bottom:4px">' +
      '<span>' + label + '</span><span>' + current + '/' + max + '</span></div>' +
      '<div style="height:8px;background:#1a1a1a;border-radius:4px;overflow:hidden">' +
      '<div style="height:100%;width:' + pct + '%;background:' + color + ';border-radius:4px;transition:width 0.3s"></div>' +
      '</div></div>';
  }

  // ─── Init ─────────────────────────────────────────────────────────

  function init() {
    if (_initialized) return;
    _initialized = true;
  }

  // ─── Export ───────────────────────────────────────────────────────

  window.CortexFreelancer.ApiRateLimiter = {
    // Lifecycle
    init: init,
    render: render,

    // Factory
    create: createRateLimiter,

    // Default instance proxy
    default: defaultLimiter,
    execute: function (fn, opts) { return defaultLimiter.execute(fn, opts); },
    pause: function () { return defaultLimiter.pause(); },
    resume: function () { return defaultLimiter.resume(); },
    getStatus: function () { return defaultLimiter.getStatus(); },
    clearQueue: function () { return defaultLimiter.clearQueue(); },
    resetStats: function () { return defaultLimiter.resetStats(); },
    updateConfig: function (cfg) { return defaultLimiter.updateConfig(cfg); },
    calculateBackoff: function (attempt) { return defaultLimiter.calculateBackoff(attempt); },
    canSendRequest: function () { return defaultLimiter.canSendRequest(); },

    // Dashboard
    renderDashboard: render
  };

})();
