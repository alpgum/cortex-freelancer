/**
 * CF-267: Uptime Monitoring with Vercel Analytics + UptimeRobot
 * Client-side health checks for key endpoints with status dashboard.
 */
(function () {
  'use strict';

  var ENDPOINTS = [
    { name: 'Landing Page', url: '/', critical: true },
    { name: 'App Dashboard', url: '/app/', critical: true },
    { name: 'API Health', url: '/api/health', critical: true },
    { name: 'AI Chat', url: '/api/chat', critical: true, method: 'OPTIONS' },
    { name: 'Stripe Config', url: '/api/stripe-config', critical: false }
  ];

  var CHECK_INTERVAL = 60000; // 1 minute
  var HISTORY_KEY = 'cortex_uptime_history';
  var MAX_HISTORY = 1440; // 24 hours of minute-by-minute checks
  var intervalId = null;

  /**
   * Check a single endpoint.
   * @param {{ name: string, url: string, method?: string }} endpoint
   * @returns {Promise<{ name: string, url: string, status: string, latency: number, statusCode: number }>}
   */
  async function checkEndpoint(endpoint) {
    var start = Date.now();
    try {
      var res = await fetch(endpoint.url, {
        method: endpoint.method || 'HEAD',
        cache: 'no-store'
      });
      var latency = Date.now() - start;
      return {
        name: endpoint.name,
        url: endpoint.url,
        status: res.ok ? 'up' : 'degraded',
        latency: latency,
        statusCode: res.status,
        timestamp: new Date().toISOString()
      };
    } catch (_err) {
      return {
        name: endpoint.name,
        url: endpoint.url,
        status: 'down',
        latency: Date.now() - start,
        statusCode: 0,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Check all endpoints.
   * @returns {Promise<Array>}
   */
  async function checkAll() {
    var results = await Promise.all(ENDPOINTS.map(checkEndpoint));
    saveHistory(results);
    return results;
  }

  /**
   * Save check results to local history.
   * @param {Array} results
   */
  function saveHistory(results) {
    try {
      var history = getHistory();
      history.push({
        timestamp: new Date().toISOString(),
        results: results
      });
      if (history.length > MAX_HISTORY) {
        history = history.slice(-MAX_HISTORY);
      }
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (_err) {
      // Storage full — clear old entries
      localStorage.removeItem(HISTORY_KEY);
    }
  }

  /**
   * Get check history.
   * @returns {Array}
   */
  function getHistory() {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    } catch (_e) {
      return [];
    }
  }

  /**
   * Calculate uptime percentage for an endpoint over recent history.
   * @param {string} endpointName
   * @returns {{ uptime: number, checks: number, downtime: number }}
   */
  function getUptimeStats(endpointName) {
    var history = getHistory();
    var total = 0;
    var up = 0;

    history.forEach(function (entry) {
      (entry.results || []).forEach(function (r) {
        if (r.name === endpointName) {
          total++;
          if (r.status === 'up') up++;
        }
      });
    });

    return {
      uptime: total > 0 ? Math.round((up / total) * 10000) / 100 : 100,
      checks: total,
      downtime: total - up
    };
  }

  /**
   * Get average latency for an endpoint.
   * @param {string} endpointName
   * @returns {number}
   */
  function getAvgLatency(endpointName) {
    var history = getHistory();
    var total = 0;
    var count = 0;

    history.forEach(function (entry) {
      (entry.results || []).forEach(function (r) {
        if (r.name === endpointName && r.latency) {
          total += r.latency;
          count++;
        }
      });
    });

    return count > 0 ? Math.round(total / count) : 0;
  }

  /**
   * Get overall system status.
   * @param {Array} results — latest check results
   * @returns {'operational'|'degraded'|'outage'}
   */
  function getOverallStatus(results) {
    var criticalDown = results.some(function (r) {
      return r.status === 'down' && ENDPOINTS.some(function (e) {
        return e.name === r.name && e.critical;
      });
    });
    if (criticalDown) return 'outage';

    var anyIssue = results.some(function (r) {
      return r.status !== 'up';
    });
    return anyIssue ? 'degraded' : 'operational';
  }

  /**
   * Start periodic monitoring.
   * @param {number} [interval]
   */
  function startMonitoring(interval) {
    stopMonitoring();
    intervalId = setInterval(checkAll, interval || CHECK_INTERVAL);
    checkAll(); // Immediate first check
  }

  /**
   * Stop periodic monitoring.
   */
  function stopMonitoring() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  /**
   * Render status dashboard.
   * @param {HTMLElement} container
   * @param {Array} results
   */
  function render(container, results) {
    if (!container) return;

    var overall = getOverallStatus(results);
    var statusColors = { operational: '#10b981', degraded: '#f59e0b', outage: '#ef4444' };
    var statusLabels = { operational: 'All Systems Operational', degraded: 'Partial Degradation', outage: 'Major Outage' };

    var html = '<div style="padding:16px;border-radius:8px;background:' + statusColors[overall] + '15;border:1px solid ' + statusColors[overall] + ';margin-bottom:16px">' +
      '<div style="font-weight:600;color:' + statusColors[overall] + '">' + statusLabels[overall] + '</div></div>';

    results.forEach(function (r) {
      var color = r.status === 'up' ? '#10b981' : r.status === 'degraded' ? '#f59e0b' : '#ef4444';
      var stats = getUptimeStats(r.name);
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px;border-bottom:1px solid #f3f4f6">' +
        '<div><span style="font-weight:500">' + r.name + '</span>' +
        ' <span style="font-size:12px;color:#9ca3af">' + stats.uptime + '% uptime</span></div>' +
        '<div style="display:flex;align-items:center;gap:8px">' +
        '<span style="font-size:13px;color:#6b7280">' + r.latency + 'ms</span>' +
        '<span style="width:8px;height:8px;border-radius:50%;background:' + color + '"></span>' +
        '</div></div>';
    });

    container.innerHTML = html;
  }

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.UptimeMonitor = {
    ENDPOINTS: ENDPOINTS,
    checkEndpoint: checkEndpoint,
    checkAll: checkAll,
    getHistory: getHistory,
    getUptimeStats: getUptimeStats,
    getAvgLatency: getAvgLatency,
    getOverallStatus: getOverallStatus,
    startMonitoring: startMonitoring,
    stopMonitoring: stopMonitoring,
    render: render
  };
})();
