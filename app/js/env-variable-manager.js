/**
 * CF-261: Vercel Environment Variable Manager
 * Validates required env vars are present, provides fallbacks, and surfaces missing config.
 */
(function () {
  'use strict';

  var REQUIRED_VARS = [
    { key: 'ANTHROPIC_API_KEY', label: 'Anthropic API', mask: true },
    { key: 'STRIPE_SECRET_KEY', label: 'Stripe Secret', mask: true },
    { key: 'STRIPE_PUBLISHABLE_KEY', label: 'Stripe Publishable', mask: false },
    { key: 'STRIPE_WEBHOOK_SECRET', label: 'Stripe Webhook', mask: true },
    { key: 'FIREBASE_API_KEY', label: 'Firebase API', mask: false },
    { key: 'FIREBASE_PROJECT_ID', label: 'Firebase Project', mask: false },
    { key: 'FIREBASE_AUTH_DOMAIN', label: 'Firebase Auth Domain', mask: false },
    { key: 'SENDGRID_API_KEY', label: 'SendGrid', mask: true },
    { key: 'SENTRY_DSN', label: 'Sentry DSN', mask: false }
  ];

  var STATUS_OK = 'ok';
  var STATUS_MISSING = 'missing';
  var STATUS_EMPTY = 'empty';

  /**
   * Check a single env var status (server-side helper — used via /api/health).
   * On the client we check via the health endpoint.
   */
  function checkVar(name, value) {
    if (value === undefined || value === null) return STATUS_MISSING;
    if (String(value).trim() === '') return STATUS_EMPTY;
    return STATUS_OK;
  }

  /**
   * Validate all required vars from a config object.
   * @param {Object} config — key/value pairs
   * @returns {{ valid: boolean, results: Array<{ key: string, label: string, status: string }> }}
   */
  function validateAll(config) {
    config = config || {};
    var results = [];
    var allValid = true;

    REQUIRED_VARS.forEach(function (v) {
      var status = checkVar(v.key, config[v.key]);
      if (status !== STATUS_OK) allValid = false;
      results.push({ key: v.key, label: v.label, status: status });
    });

    return { valid: allValid, results: results };
  }

  /**
   * Fetch env health from the API.
   * @returns {Promise<{ valid: boolean, results: Array }>}
   */
  async function fetchEnvHealth() {
    try {
      var res = await fetch('/api/health?check=env');
      if (res.ok) return await res.json();
    } catch (_err) {
      // Fall through
    }
    return { valid: false, results: [], error: 'unreachable' };
  }

  /**
   * Mask a secret value for display.
   * @param {string} value
   * @returns {string}
   */
  function maskValue(value) {
    if (!value || value.length < 8) return '****';
    return value.slice(0, 4) + '****' + value.slice(-4);
  }

  /**
   * Render env status into a container.
   * @param {HTMLElement} container
   * @param {Array} results
   */
  function render(container, results) {
    if (!container) return;
    container.innerHTML = '';

    var table = document.createElement('table');
    table.setAttribute('style', 'width:100%;border-collapse:collapse;font-size:14px');

    var header = document.createElement('tr');
    header.innerHTML =
      '<th style="text-align:left;padding:8px;border-bottom:2px solid #e5e7eb">Variable</th>' +
      '<th style="text-align:left;padding:8px;border-bottom:2px solid #e5e7eb">Status</th>';
    table.appendChild(header);

    var statusIcons = { ok: '\u2705', missing: '\u274C', empty: '\u26A0\uFE0F' };
    var statusLabels = { ok: 'Configured', missing: 'Missing', empty: 'Empty' };

    (results || []).forEach(function (r) {
      var row = document.createElement('tr');
      row.innerHTML =
        '<td style="padding:8px;border-bottom:1px solid #f3f4f6">' + escapeHtml(r.label || r.key) + '</td>' +
        '<td style="padding:8px;border-bottom:1px solid #f3f4f6">' +
          (statusIcons[r.status] || '') + ' ' + (statusLabels[r.status] || r.status) +
        '</td>';
      table.appendChild(row);
    });

    container.appendChild(table);
  }

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.EnvVariableManager = {
    REQUIRED_VARS: REQUIRED_VARS,
    validateAll: validateAll,
    fetchEnvHealth: fetchEnvHealth,
    maskValue: maskValue,
    render: render
  };
})();
