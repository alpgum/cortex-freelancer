/**
 * CF-277: Performance Budgets & Monitoring
 * Web Vitals tracking (LCP < 2.5s, FID < 100ms, CLS < 0.1) with regression alerts.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_perf_metrics';

  var BUDGETS = {
    LCP: { target: 2500, unit: 'ms', label: 'Largest Contentful Paint', good: 2500, poor: 4000 },
    FID: { target: 100, unit: 'ms', label: 'First Input Delay', good: 100, poor: 300 },
    CLS: { target: 0.1, unit: '', label: 'Cumulative Layout Shift', good: 0.1, poor: 0.25 },
    FCP: { target: 1800, unit: 'ms', label: 'First Contentful Paint', good: 1800, poor: 3000 },
    TTFB: { target: 800, unit: 'ms', label: 'Time to First Byte', good: 800, poor: 1800 },
    INP: { target: 200, unit: 'ms', label: 'Interaction to Next Paint', good: 200, poor: 500 }
  };

  /**
   * Observe Web Vitals using PerformanceObserver.
   * @param {function({ name: string, value: number })} callback
   */
  function observeWebVitals(callback) {
    if (typeof PerformanceObserver === 'undefined') return;

    // LCP
    try {
      var lcpObs = new PerformanceObserver(function (list) {
        var entries = list.getEntries();
        var last = entries[entries.length - 1];
        if (last) callback({ name: 'LCP', value: last.startTime });
      });
      lcpObs.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (_e) {}

    // FID
    try {
      var fidObs = new PerformanceObserver(function (list) {
        var entries = list.getEntries();
        if (entries[0]) callback({ name: 'FID', value: entries[0].processingStart - entries[0].startTime });
      });
      fidObs.observe({ type: 'first-input', buffered: true });
    } catch (_e) {}

    // CLS
    try {
      var clsValue = 0;
      var clsObs = new PerformanceObserver(function (list) {
        list.getEntries().forEach(function (entry) {
          if (!entry.hadRecentInput) clsValue += entry.value;
        });
        callback({ name: 'CLS', value: clsValue });
      });
      clsObs.observe({ type: 'layout-shift', buffered: true });
    } catch (_e) {}

    // FCP
    try {
      var fcpObs = new PerformanceObserver(function (list) {
        var entries = list.getEntries();
        var fcp = entries.find(function (e) { return e.name === 'first-contentful-paint'; });
        if (fcp) callback({ name: 'FCP', value: fcp.startTime });
      });
      fcpObs.observe({ type: 'paint', buffered: true });
    } catch (_e) {}

    // TTFB
    try {
      var nav = performance.getEntriesByType('navigation');
      if (nav[0]) callback({ name: 'TTFB', value: nav[0].responseStart });
    } catch (_e) {}
  }

  /**
   * Check a metric against its budget.
   * @param {string} name
   * @param {number} value
   * @returns {'good'|'needs-improvement'|'poor'}
   */
  function checkBudget(name, value) {
    var budget = BUDGETS[name];
    if (!budget) return 'good';
    if (value <= budget.good) return 'good';
    if (value <= budget.poor) return 'needs-improvement';
    return 'poor';
  }

  /**
   * Save a metric measurement.
   * @param {{ name: string, value: number }} metric
   */
  function recordMetric(metric) {
    var metrics = getMetrics();
    metrics.push({
      name: metric.name,
      value: metric.value,
      rating: checkBudget(metric.name, metric.value),
      url: window.location.pathname,
      timestamp: new Date().toISOString()
    });

    if (metrics.length > 500) metrics = metrics.slice(-500);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(metrics));
    } catch (_e) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  /**
   * Get stored metrics.
   * @param {string} [name] — filter by metric name
   * @returns {Array}
   */
  function getMetrics(name) {
    try {
      var all = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
      if (name) return all.filter(function (m) { return m.name === name; });
      return all;
    } catch (_e) {
      return [];
    }
  }

  /**
   * Get average for a metric.
   * @param {string} name
   * @returns {number}
   */
  function getAverage(name) {
    var metrics = getMetrics(name);
    if (metrics.length === 0) return 0;
    var sum = metrics.reduce(function (a, m) { return a + m.value; }, 0);
    return Math.round((sum / metrics.length) * 100) / 100;
  }

  /**
   * Check for regressions (average exceeds budget).
   * @returns {Array<{ name: string, average: number, budget: number, status: string }>}
   */
  function checkRegressions() {
    var results = [];

    Object.keys(BUDGETS).forEach(function (name) {
      var avg = getAverage(name);
      if (avg > 0) {
        var budget = BUDGETS[name];
        results.push({
          name: name,
          average: avg,
          budget: budget.target,
          status: checkBudget(name, avg)
        });
      }
    });

    return results;
  }

  /**
   * Start monitoring (observe + record).
   */
  function startMonitoring() {
    observeWebVitals(function (metric) {
      recordMetric(metric);
    });
  }

  /**
   * Render performance dashboard.
   * @param {HTMLElement} container
   */
  function render(container) {
    if (!container) return;

    var regressions = checkRegressions();
    var statusColors = { good: '#10b981', 'needs-improvement': '#f59e0b', poor: '#ef4444' };

    var html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:16px">';

    Object.keys(BUDGETS).forEach(function (name) {
      var budget = BUDGETS[name];
      var avg = getAverage(name);
      var status = avg > 0 ? checkBudget(name, avg) : 'good';
      var color = statusColors[status];
      var display = avg > 0 ? (name === 'CLS' ? avg.toFixed(3) : Math.round(avg) + budget.unit) : '--';

      html += '<div style="padding:12px;border-radius:8px;border:1px solid #e5e7eb;text-align:center">' +
        '<div style="font-size:11px;color:#9ca3af;margin-bottom:4px">' + name + '</div>' +
        '<div style="font-size:20px;font-weight:700;color:' + color + '">' + display + '</div>' +
        '<div style="font-size:11px;color:#9ca3af">Target: ' +
        (name === 'CLS' ? budget.target : budget.target + budget.unit) + '</div></div>';
    });

    html += '</div>';
    container.innerHTML = html;
  }

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.PerformanceBudgets = {
    BUDGETS: BUDGETS,
    observeWebVitals: observeWebVitals,
    checkBudget: checkBudget,
    recordMetric: recordMetric,
    getMetrics: getMetrics,
    getAverage: getAverage,
    checkRegressions: checkRegressions,
    startMonitoring: startMonitoring,
    render: render
  };
})();
