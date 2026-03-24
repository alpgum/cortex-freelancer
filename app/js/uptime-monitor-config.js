/**
 * CF-267: Uptime Monitoring Configuration (Enhanced)
 * Client-side health check dashboard: ping /api/health + key endpoints,
 * show status indicators, response times, uptime percentage from localStorage.
 */
(function () {
  'use strict';

  // ─── Endpoint Registry ────────────────────────────────────
  var ENDPOINTS = [
    { name: 'API Health',       url: '/api/health',         critical: true,  method: 'GET' },
    { name: 'Landing Page',     url: '/',                   critical: true,  method: 'HEAD' },
    { name: 'App Dashboard',    url: '/app/',               critical: true,  method: 'HEAD' },
    { name: 'AI Chat',          url: '/api/chat',           critical: true,  method: 'OPTIONS' },
    { name: 'Stripe Config',    url: '/api/stripe-config',  critical: false, method: 'GET' },
    { name: 'Checkout',         url: '/api/checkout',       critical: false, method: 'OPTIONS' },
    { name: 'Contact Form',     url: '/api/contact',        critical: false, method: 'OPTIONS' }
  ];

  var STORAGE_KEY = 'cortex_uptime_v2';
  var CHECK_INTERVAL = 60000;
  var MAX_HISTORY = 1440; // 24h at 1 check/min
  var LATENCY_WARN_MS = 2000;
  var LATENCY_CRITICAL_MS = 5000;
  var _intervalId = null;

  // ─── Health Checks ────────────────────────────────────────

  /**
   * Ping a single endpoint and return result.
   * @param {{ name: string, url: string, method?: string, critical?: boolean }} endpoint
   * @returns {Promise<Object>}
   */
  async function checkEndpoint(endpoint) {
    var start = Date.now();
    try {
      var res = await fetch(endpoint.url, {
        method: endpoint.method || 'HEAD',
        cache: 'no-store',
        signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined
      });
      var latency = Date.now() - start;
      var status = res.ok ? 'up' : (res.status >= 500 ? 'down' : 'degraded');

      return {
        name: endpoint.name,
        url: endpoint.url,
        critical: !!endpoint.critical,
        status: status,
        latency: latency,
        statusCode: res.status,
        timestamp: new Date().toISOString()
      };
    } catch (_err) {
      return {
        name: endpoint.name,
        url: endpoint.url,
        critical: !!endpoint.critical,
        status: 'down',
        latency: Date.now() - start,
        statusCode: 0,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Check all registered endpoints.
   * @returns {Promise<Array>}
   */
  async function checkAll() {
    var results = await Promise.all(ENDPOINTS.map(checkEndpoint));
    _saveHistory(results);
    return results;
  }

  // ─── History Management ───────────────────────────────────

  function _loadHistory() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (_e) {
      return [];
    }
  }

  function _saveHistory(results) {
    try {
      var history = _loadHistory();
      history.push({ timestamp: new Date().toISOString(), results: results });
      if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (_err) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  /**
   * Get check history.
   * @returns {Array}
   */
  function getHistory() {
    return _loadHistory();
  }

  /**
   * Clear stored history.
   */
  function clearHistory() {
    localStorage.removeItem(STORAGE_KEY);
  }

  // ─── Stats ────────────────────────────────────────────────

  /**
   * Get uptime stats for a specific endpoint.
   * @param {string} endpointName
   * @returns {{ uptime: number, checks: number, downtime: number, avgLatency: number, maxLatency: number }}
   */
  function getUptimeStats(endpointName) {
    var history = _loadHistory();
    var total = 0, up = 0, latencySum = 0, maxLatency = 0;

    history.forEach(function (entry) {
      (entry.results || []).forEach(function (r) {
        if (r.name === endpointName) {
          total++;
          if (r.status === 'up') up++;
          if (r.latency) {
            latencySum += r.latency;
            if (r.latency > maxLatency) maxLatency = r.latency;
          }
        }
      });
    });

    return {
      uptime: total > 0 ? Math.round((up / total) * 10000) / 100 : 100,
      checks: total,
      downtime: total - up,
      avgLatency: total > 0 ? Math.round(latencySum / total) : 0,
      maxLatency: maxLatency
    };
  }

  /**
   * Get overall system status from latest results.
   * @param {Array} results
   * @returns {'operational'|'degraded'|'outage'}
   */
  function getOverallStatus(results) {
    var criticalDown = results.some(function (r) { return r.critical && r.status === 'down'; });
    if (criticalDown) return 'outage';
    var anyIssue = results.some(function (r) { return r.status !== 'up'; });
    return anyIssue ? 'degraded' : 'operational';
  }

  // ─── Monitoring Lifecycle ─────────────────────────────────

  /**
   * Start periodic monitoring.
   * @param {number} [interval]
   */
  function startMonitoring(interval) {
    stopMonitoring();
    _intervalId = setInterval(checkAll, interval || CHECK_INTERVAL);
    checkAll();
  }

  /**
   * Stop periodic monitoring.
   */
  function stopMonitoring() {
    if (_intervalId) {
      clearInterval(_intervalId);
      _intervalId = null;
    }
  }

  /**
   * Check if monitoring is active.
   * @returns {boolean}
   */
  function isMonitoring() {
    return _intervalId !== null;
  }

  // ─── Render ───────────────────────────────────────────────

  /**
   * Render the uptime dashboard into a container.
   * @param {HTMLElement} container
   * @param {Array} results — latest check results
   */
  function render(container, results) {
    if (!container) return;

    var overall = getOverallStatus(results);
    var colors = { operational: '#10b981', degraded: '#f59e0b', outage: '#ef4444' };
    var labels = { operational: 'All Systems Operational', degraded: 'Partial Degradation', outage: 'Major Outage' };

    var html = '<div style="padding:16px;border-radius:8px;background:' + colors[overall] + '15;border:1px solid ' + colors[overall] + ';margin-bottom:16px">' +
      '<div style="display:flex;align-items:center;gap:8px">' +
      '<span style="width:12px;height:12px;border-radius:50%;background:' + colors[overall] + '"></span>' +
      '<span style="font-weight:600;color:' + colors[overall] + '">' + labels[overall] + '</span>' +
      '</div></div>';

    results.forEach(function (r) {
      var stats = getUptimeStats(r.name);
      var color = r.status === 'up' ? '#10b981' : r.status === 'degraded' ? '#f59e0b' : '#ef4444';
      var latencyColor = r.latency > LATENCY_CRITICAL_MS ? '#ef4444' : r.latency > LATENCY_WARN_MS ? '#f59e0b' : '#6b7280';

      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px;border-bottom:1px solid #f3f4f6">' +
        '<div>' +
        '<span style="font-weight:500">' + r.name + '</span>' +
        (r.critical ? ' <span style="font-size:10px;background:#fee2e2;color:#dc2626;padding:1px 4px;border-radius:3px">CRITICAL</span>' : '') +
        '<div style="font-size:12px;color:#9ca3af">' + stats.uptime + '% uptime &middot; avg ' + stats.avgLatency + 'ms</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:8px">' +
        '<span style="font-size:13px;color:' + latencyColor + '">' + r.latency + 'ms</span>' +
        '<span style="width:8px;height:8px;border-radius:50%;background:' + color + '"></span>' +
        '</div></div>';
    });

    container.innerHTML = html;
  }

  // ─── Export ───────────────────────────────────────────────
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.UptimeMonitorConfig = {
    ENDPOINTS: ENDPOINTS,
    checkEndpoint: checkEndpoint,
    checkAll: checkAll,
    getHistory: getHistory,
    clearHistory: clearHistory,
    getUptimeStats: getUptimeStats,
    getOverallStatus: getOverallStatus,
    startMonitoring: startMonitoring,
    stopMonitoring: stopMonitoring,
    isMonitoring: isMonitoring,
    render: render,
    version: '1.0.0'
  };
})();
