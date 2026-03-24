/**
 * CF-280: Dependency Vulnerability Scanning
 * Monitors npm dependencies for known vulnerabilities and generates reports.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_dep_scan';

  var SEVERITY_ORDER = { critical: 0, high: 1, moderate: 2, low: 3, info: 4 };
  var SEVERITY_COLORS = { critical: '#ef4444', high: '#f97316', moderate: '#f59e0b', low: '#3b82f6', info: '#9ca3af' };

  /**
   * Parse npm audit JSON output.
   * @param {Object} auditOutput — raw npm audit --json output
   * @returns {{ total: number, vulnerabilities: Array, summary: Object }}
   */
  function parseAuditOutput(auditOutput) {
    if (!auditOutput) return { total: 0, vulnerabilities: [], summary: {} };

    var vulns = [];
    var advisories = auditOutput.advisories || auditOutput.vulnerabilities || {};

    Object.keys(advisories).forEach(function (key) {
      var adv = advisories[key];
      vulns.push({
        id: adv.id || key,
        name: adv.module_name || adv.name || key,
        severity: adv.severity || 'info',
        title: adv.title || adv.via?.[0]?.title || 'Unknown vulnerability',
        url: adv.url || adv.via?.[0]?.url || '',
        range: adv.vulnerable_versions || adv.range || '*',
        fixAvailable: !!(adv.fixAvailable || adv.fix_available),
        path: adv.findings?.[0]?.paths?.[0] || adv.effects?.join(' > ') || ''
      });
    });

    vulns.sort(function (a, b) {
      return (SEVERITY_ORDER[a.severity] || 4) - (SEVERITY_ORDER[b.severity] || 4);
    });

    var summary = { critical: 0, high: 0, moderate: 0, low: 0, info: 0, total: vulns.length };
    vulns.forEach(function (v) {
      if (summary[v.severity] !== undefined) summary[v.severity]++;
    });

    return { total: vulns.length, vulnerabilities: vulns, summary: summary };
  }

  /**
   * Generate npm audit command.
   * @param {{ production?: boolean, json?: boolean }} [options]
   * @returns {string}
   */
  function generateAuditCommand(options) {
    options = options || {};
    var cmd = 'npm audit';
    if (options.production) cmd += ' --production';
    if (options.json !== false) cmd += ' --json';
    return cmd;
  }

  /**
   * Generate Dependabot config YAML.
   * @returns {string}
   */
  function generateDependabotConfig() {
    return [
      'version: 2',
      'updates:',
      '  - package-ecosystem: npm',
      '    directory: "/"',
      '    schedule:',
      '      interval: weekly',
      '      day: monday',
      '    open-pull-requests-limit: 10',
      '    labels:',
      '      - dependencies',
      '      - security',
      '    assignees:',
      '      - alperengumusdograyan',
      '    commit-message:',
      '      prefix: "chore(deps):"',
      '    ignore:',
      '      - dependency-name: "*"',
      '        update-types:',
      '          - version-update:semver-major'
    ].join('\n');
  }

  /**
   * Generate GitHub Actions workflow for scanning.
   * @returns {string}
   */
  function generateScanWorkflow() {
    return [
      'name: Dependency Scan',
      'on:',
      '  schedule:',
      '    - cron: "0 9 * * 1"',
      '  push:',
      '    paths:',
      '      - package-lock.json',
      'jobs:',
      '  audit:',
      '    runs-on: ubuntu-latest',
      '    steps:',
      '      - uses: actions/checkout@v4',
      '      - uses: actions/setup-node@v4',
      '        with:',
      '          node-version: 20',
      '      - run: npm ci',
      '      - run: npm audit --production',
      '        continue-on-error: true',
      '      - uses: actions/upload-artifact@v4',
      '        with:',
      '          name: audit-report',
      '          path: npm-audit.json'
    ].join('\n');
  }

  /**
   * Save scan results.
   * @param {Object} result
   */
  function saveResult(result) {
    var history = getHistory();
    history.push({
      timestamp: new Date().toISOString(),
      summary: result.summary,
      total: result.total
    });
    if (history.length > 50) history = history.slice(-50);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); }
    catch (_e) { localStorage.removeItem(STORAGE_KEY); }
  }

  /**
   * Get scan history.
   * @returns {Array}
   */
  function getHistory() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch (_e) { return []; }
  }

  /**
   * Get health status based on latest scan.
   * @returns {{ status: string, message: string }}
   */
  function getHealth() {
    var history = getHistory();
    if (history.length === 0) return { status: 'unknown', message: 'No scans yet' };

    var latest = history[history.length - 1];
    var s = latest.summary || {};

    if ((s.critical || 0) > 0) return { status: 'critical', message: s.critical + ' critical vulnerabilities' };
    if ((s.high || 0) > 0) return { status: 'warning', message: s.high + ' high severity vulnerabilities' };
    if (latest.total > 0) return { status: 'info', message: latest.total + ' total vulnerabilities' };
    return { status: 'healthy', message: 'No known vulnerabilities' };
  }

  /**
   * Render scan results.
   * @param {HTMLElement} container
   * @param {{ vulnerabilities: Array, summary: Object }} result
   */
  function render(container, result) {
    if (!container) return;

    var s = result ? result.summary : {};
    var html = '<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">';

    ['critical', 'high', 'moderate', 'low'].forEach(function (sev) {
      var count = s[sev] || 0;
      html += '<div style="padding:8px 16px;border-radius:6px;border:1px solid ' + SEVERITY_COLORS[sev] + ';' +
        'background:' + SEVERITY_COLORS[sev] + '10;text-align:center;min-width:80px">' +
        '<div style="font-size:18px;font-weight:700;color:' + SEVERITY_COLORS[sev] + '">' + count + '</div>' +
        '<div style="font-size:11px;color:#6b7280">' + sev.charAt(0).toUpperCase() + sev.slice(1) + '</div></div>';
    });
    html += '</div>';

    if (result && result.vulnerabilities) {
      result.vulnerabilities.slice(0, 20).forEach(function (v) {
        html += '<div style="display:flex;justify-content:space-between;padding:8px;border-bottom:1px solid #f3f4f6;font-size:13px">' +
          '<div><span style="font-weight:600">' + escapeHtml(v.name) + '</span>' +
          ' <span style="color:#6b7280">' + escapeHtml(v.title) + '</span></div>' +
          '<span style="color:' + (SEVERITY_COLORS[v.severity] || '#9ca3af') + ';font-weight:600;font-size:12px">' +
          v.severity.toUpperCase() + '</span></div>';
      });
    }

    container.innerHTML = html;
  }

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.DependencyScanner = {
    parseAuditOutput: parseAuditOutput,
    generateAuditCommand: generateAuditCommand,
    generateDependabotConfig: generateDependabotConfig,
    generateScanWorkflow: generateScanWorkflow,
    saveResult: saveResult,
    getHistory: getHistory,
    getHealth: getHealth,
    render: render
  };
})();
