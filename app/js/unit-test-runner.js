/**
 * CF-270: Unit Test Runner Dashboard
 * Manage and display unit test results for API endpoints using Vitest.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_test_results';

  var API_TESTS = [
    { id: 'checkout', name: 'POST /api/checkout', endpoint: '/api/checkout', method: 'POST' },
    { id: 'webhook', name: 'POST /api/stripe-webhook', endpoint: '/api/stripe-webhook', method: 'POST' },
    { id: 'chat', name: 'POST /api/chat', endpoint: '/api/chat', method: 'POST' },
    { id: 'waitlist', name: 'POST /api/waitlist', endpoint: '/api/waitlist', method: 'POST' },
    { id: 'verify-sub', name: 'POST /api/verify-subscription', endpoint: '/api/verify-subscription', method: 'POST' },
    { id: 'health', name: 'GET /api/health', endpoint: '/api/health', method: 'GET' },
    { id: 'contact', name: 'POST /api/contact', endpoint: '/api/contact', method: 'POST' },
    { id: 'feedback', name: 'POST /api/feedback', endpoint: '/api/feedback', method: 'POST' },
    { id: 'stats', name: 'GET /api/stats', endpoint: '/api/stats', method: 'GET' },
    { id: 'customer', name: 'POST /api/customer', endpoint: '/api/customer', method: 'POST' },
    { id: 'portal', name: 'POST /api/portal', endpoint: '/api/portal', method: 'POST' },
    { id: 'apply-coupon', name: 'POST /api/apply-coupon', endpoint: '/api/apply-coupon', method: 'POST' },
    { id: 'referral', name: 'POST /api/referral', endpoint: '/api/referral', method: 'POST' },
    { id: 'export-data', name: 'GET /api/export-data', endpoint: '/api/export-data', method: 'GET' },
    { id: 'delete-account', name: 'POST /api/delete-account', endpoint: '/api/delete-account', method: 'POST' },
    { id: 'send-email', name: 'POST /api/send-email', endpoint: '/api/send-email', method: 'POST' },
    { id: 'track', name: 'POST /api/track', endpoint: '/api/track', method: 'POST' },
    { id: 'tool-stats', name: 'GET /api/tool-stats', endpoint: '/api/tool-stats', method: 'GET' },
    { id: 'support', name: 'POST /api/support', endpoint: '/api/support', method: 'POST' },
    { id: 'download', name: 'GET /api/download', endpoint: '/api/download', method: 'GET' }
  ];

  /**
   * Run a smoke test on a single endpoint.
   * @param {{ endpoint: string, method: string }} test
   * @returns {Promise<{ id: string, status: string, latency: number, statusCode: number, error?: string }>}
   */
  async function runSmokeTest(test) {
    var start = Date.now();
    try {
      var opts = { method: test.method === 'GET' ? 'GET' : 'OPTIONS' };
      var res = await fetch(test.endpoint, opts);
      return {
        id: test.id,
        status: res.status < 500 ? 'pass' : 'fail',
        latency: Date.now() - start,
        statusCode: res.status
      };
    } catch (err) {
      return {
        id: test.id,
        status: 'error',
        latency: Date.now() - start,
        statusCode: 0,
        error: err.message
      };
    }
  }

  /**
   * Run all smoke tests.
   * @returns {Promise<{ results: Array, summary: Object }>}
   */
  async function runAll() {
    var results = await Promise.all(API_TESTS.map(runSmokeTest));
    var summary = getSummary(results);
    saveResults({ timestamp: new Date().toISOString(), results: results, summary: summary });
    return { results: results, summary: summary };
  }

  /**
   * Get test summary.
   * @param {Array} results
   * @returns {{ total: number, passed: number, failed: number, errors: number, duration: number }}
   */
  function getSummary(results) {
    var passed = 0;
    var failed = 0;
    var errors = 0;
    var totalLatency = 0;

    (results || []).forEach(function (r) {
      if (r.status === 'pass') passed++;
      else if (r.status === 'fail') failed++;
      else errors++;
      totalLatency += r.latency || 0;
    });

    return {
      total: results.length,
      passed: passed,
      failed: failed,
      errors: errors,
      duration: totalLatency
    };
  }

  /**
   * Save test results.
   * @param {Object} run
   */
  function saveResults(run) {
    try {
      var history = getHistory();
      history.push(run);
      if (history.length > 50) history = history.slice(-50);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (_e) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  /**
   * Get test history.
   * @returns {Array}
   */
  function getHistory() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (_e) {
      return [];
    }
  }

  /**
   * Generate Vitest config.
   * @returns {string}
   */
  function generateVitestConfig() {
    return [
      'import { defineConfig } from "vitest/config";',
      '',
      'export default defineConfig({',
      '  test: {',
      '    environment: "node",',
      '    include: ["tests/**/*.test.js"],',
      '    coverage: {',
      '      provider: "v8",',
      '      reporter: ["text", "json", "html"],',
      '      include: ["api/**/*.js"]',
      '    },',
      '    timeout: 10000',
      '  }',
      '});'
    ].join('\n');
  }

  /**
   * Render test results.
   * @param {HTMLElement} container
   * @param {{ results: Array, summary: Object }} run
   */
  function render(container, run) {
    if (!container || !run) return;

    var s = run.summary;
    var passRate = s.total > 0 ? Math.round((s.passed / s.total) * 100) : 0;
    var color = passRate === 100 ? '#10b981' : passRate >= 80 ? '#f59e0b' : '#ef4444';

    var html = '<div style="display:flex;gap:16px;margin-bottom:16px">';
    html += '<div style="flex:1;padding:12px;border-radius:8px;background:#f0fdf4;text-align:center"><div style="font-size:24px;font-weight:700;color:#10b981">' + s.passed + '</div><div style="font-size:12px;color:#6b7280">Passed</div></div>';
    html += '<div style="flex:1;padding:12px;border-radius:8px;background:#fef2f2;text-align:center"><div style="font-size:24px;font-weight:700;color:#ef4444">' + s.failed + '</div><div style="font-size:12px;color:#6b7280">Failed</div></div>';
    html += '<div style="flex:1;padding:12px;border-radius:8px;background:#f5f3ff;text-align:center"><div style="font-size:24px;font-weight:700;color:#8b5cf6">' + s.duration + 'ms</div><div style="font-size:12px;color:#6b7280">Duration</div></div>';
    html += '</div>';

    html += '<div style="margin-bottom:8px;font-weight:600;color:' + color + '">' + passRate + '% Pass Rate</div>';

    run.results.forEach(function (r) {
      var icon = r.status === 'pass' ? '\u2705' : r.status === 'fail' ? '\u274C' : '\u26A0\uFE0F';
      var testDef = API_TESTS.find(function (t) { return t.id === r.id; });
      html += '<div style="display:flex;justify-content:space-between;padding:8px;border-bottom:1px solid #f3f4f6;font-size:14px">' +
        '<span>' + icon + ' ' + (testDef ? testDef.name : r.id) + '</span>' +
        '<span style="color:#9ca3af">' + r.latency + 'ms | ' + r.statusCode + '</span></div>';
    });

    container.innerHTML = html;
  }

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.UnitTestRunner = {
    API_TESTS: API_TESTS,
    runSmokeTest: runSmokeTest,
    runAll: runAll,
    getSummary: getSummary,
    getHistory: getHistory,
    generateVitestConfig: generateVitestConfig,
    render: render
  };
})();
