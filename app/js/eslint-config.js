/**
 * CF-269: ESLint Configuration Module (Enhanced)
 * Generate .eslintrc.json content, recommended browser rules,
 * globals whitelist, and renderLintReport() for displaying results.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_eslint_config';

  // ─── Browser Globals Whitelist ────────────────────────────
  var BROWSER_GLOBALS = {
    'window': 'readonly',
    'document': 'readonly',
    'navigator': 'readonly',
    'console': 'readonly',
    'fetch': 'readonly',
    'setTimeout': 'readonly',
    'setInterval': 'readonly',
    'clearTimeout': 'readonly',
    'clearInterval': 'readonly',
    'localStorage': 'readonly',
    'sessionStorage': 'readonly',
    'AbortController': 'readonly',
    'URL': 'readonly',
    'URLSearchParams': 'readonly',
    'FormData': 'readonly',
    'Promise': 'readonly',
    'Map': 'readonly',
    'Set': 'readonly',
    'Symbol': 'readonly',
    'MutationObserver': 'readonly',
    'IntersectionObserver': 'readonly',
    'ResizeObserver': 'readonly',
    'CustomEvent': 'readonly',
    'EventSource': 'readonly',
    'WebSocket': 'readonly',
    'Blob': 'readonly',
    'File': 'readonly',
    'FileReader': 'readonly',
    'crypto': 'readonly',
    'performance': 'readonly',
    'requestAnimationFrame': 'readonly',
    'cancelAnimationFrame': 'readonly',
    'atob': 'readonly',
    'btoa': 'readonly',
    'structuredClone': 'readonly',
    'queueMicrotask': 'readonly'
  };

  var APP_GLOBALS = {
    'firebase': 'readonly',
    'Stripe': 'readonly',
    'Chart': 'readonly',
    'CortexFreelancer': 'writable'
  };

  // ─── Recommended Rules ────────────────────────────────────
  var RECOMMENDED_RULES = {
    // Possible errors
    'no-console': 'off',
    'no-debugger': 'warn',
    'no-dupe-args': 'error',
    'no-dupe-keys': 'error',
    'no-duplicate-case': 'error',
    'no-empty': 'warn',
    'no-extra-semi': 'warn',
    'no-func-assign': 'error',
    'no-inner-declarations': 'error',
    'no-irregular-whitespace': 'warn',
    'no-unreachable': 'error',
    'valid-typeof': 'error',

    // Best practices
    'curly': ['warn', 'multi-line'],
    'eqeqeq': ['warn', 'always', { 'null': 'ignore' }],
    'no-caller': 'error',
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-wrappers': 'error',
    'no-throw-literal': 'warn',
    'no-unused-expressions': 'warn',
    'no-useless-call': 'warn',
    'no-useless-concat': 'warn',
    'no-with': 'error',
    'radix': 'warn',

    // Variables
    'no-delete-var': 'error',
    'no-shadow-restricted-names': 'error',
    'no-undef': 'error',
    'no-unused-vars': ['warn', { 'args': 'after-used', 'argsIgnorePattern': '^_', 'varsIgnorePattern': '^_' }],
    'no-use-before-define': ['error', { 'functions': false }],

    // Style
    'new-cap': ['warn', { 'capIsNew': false }],
    'no-array-constructor': 'warn',
    'no-new-object': 'warn',
    'semi': ['error', 'always'],
    'quotes': ['warn', 'single'],
    'indent': ['warn', 2],
    'max-len': ['warn', { 'code': 120 }],
    'no-trailing-spaces': 'warn',
    'comma-dangle': ['warn', 'never'],

    // ES compat — we use IIFEs with var
    'no-var': 'off',
    'prefer-const': 'off'
  };

  // ─── Config Generation ────────────────────────────────────

  /**
   * Generate .eslintrc.json content as an object.
   * @param {{ rules?: Object, globals?: Object, env?: Object, ignorePatterns?: Array }} [overrides]
   * @returns {Object}
   */
  function generateConfig(overrides) {
    overrides = overrides || {};

    var globals = Object.assign({}, BROWSER_GLOBALS, APP_GLOBALS);
    if (overrides.globals) Object.assign(globals, overrides.globals);

    var rules = Object.assign({}, RECOMMENDED_RULES);
    if (overrides.rules) Object.assign(rules, overrides.rules);

    return {
      'env': Object.assign({ 'browser': true, 'es2021': true }, overrides.env || {}),
      'globals': globals,
      'parserOptions': { 'ecmaVersion': 2021, 'sourceType': 'script' },
      'extends': ['eslint:recommended'],
      'rules': rules,
      'ignorePatterns': overrides.ignorePatterns || [
        'node_modules/', 'dist/', '.vercel/', '*.min.js', 'service-worker.js', 'sw.js'
      ]
    };
  }

  /**
   * Generate .eslintrc.json as a formatted JSON string.
   * @param {Object} [overrides]
   * @returns {string}
   */
  function generateConfigJSON(overrides) {
    return JSON.stringify(generateConfig(overrides), null, 2);
  }

  // ─── Quick Lint ───────────────────────────────────────────

  /**
   * Basic client-side lint check for common JS issues.
   * @param {string} code
   * @returns {Array<{ file?: string, line: number, column: number, severity: string, message: string, rule: string }>}
   */
  function quickLint(code) {
    if (!code) return [];
    var issues = [];
    var lines = code.split('\n');

    lines.forEach(function (line, index) {
      var ln = index + 1;

      if (/\beval\s*\(/.test(line)) {
        issues.push({ line: ln, column: line.indexOf('eval') + 1, severity: 'error', message: 'Avoid using eval()', rule: 'no-eval' });
      }
      if (/\bconsole\.(log|debug|info)\s*\(/.test(line)) {
        issues.push({ line: ln, column: line.indexOf('console') + 1, severity: 'warn', message: 'Unexpected console statement', rule: 'no-console' });
      }
      if (/\s+$/.test(line) && line.trim().length > 0) {
        issues.push({ line: ln, column: line.length, severity: 'warn', message: 'Trailing whitespace', rule: 'no-trailing-spaces' });
      }
      if (line.length > 120) {
        issues.push({ line: ln, column: 121, severity: 'warn', message: 'Line exceeds 120 characters', rule: 'max-len' });
      }
    });

    return issues;
  }

  // ─── Saved Config Persistence ─────────────────────────────

  function getSavedConfig() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch (_e) { return {}; }
  }

  function saveCustomConfig(config) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }

  // ─── Summary ──────────────────────────────────────────────

  function getSummary(issues) {
    var errors = 0, warnings = 0, info = 0;
    (issues || []).forEach(function (i) {
      if (i.severity === 'error') errors++;
      else if (i.severity === 'warn' || i.severity === 'warning') warnings++;
      else info++;
    });
    var total = errors + warnings + info;
    return { errors: errors, warnings: warnings, info: info, score: total === 0 ? 100 : Math.max(0, 100 - errors * 10 - warnings * 3 - info) };
  }

  // ─── Render Lint Report ───────────────────────────────────

  /**
   * Render lint results into a container element.
   * @param {HTMLElement} container
   * @param {Array<{ file?: string, line: number, column: number, severity: string, message: string, rule: string }>} issues
   */
  function renderLintReport(container, issues) {
    if (!container) return;
    issues = issues || [];

    var summary = getSummary(issues);
    var summaryColor = summary.errors > 0 ? '#ef4444' : summary.warnings > 0 ? '#f59e0b' : '#10b981';
    var summaryText = summary.errors === 0 && summary.warnings === 0
      ? 'No issues found — score: ' + summary.score + '/100'
      : summary.errors + ' error' + (summary.errors !== 1 ? 's' : '') + ', ' + summary.warnings + ' warning' + (summary.warnings !== 1 ? 's' : '') + ' — score: ' + summary.score + '/100';

    var html = '<div style="padding:12px 16px;border-radius:8px;background:' + summaryColor + '15;border:1px solid ' + summaryColor + ';margin-bottom:16px">' +
      '<span style="font-weight:600;color:' + summaryColor + '">' + summaryText + '</span></div>';

    if (issues.length === 0) { container.innerHTML = html; return; }

    // Group by file
    var byFile = {};
    issues.forEach(function (i) {
      var f = i.file || 'input';
      if (!byFile[f]) byFile[f] = [];
      byFile[f].push(i);
    });

    Object.keys(byFile).forEach(function (file) {
      html += '<div style="margin-bottom:12px">' +
        '<div style="font-weight:500;font-size:13px;color:#374151;padding:4px 0;border-bottom:1px solid #e5e7eb">' + _esc(file) + '</div>';

      byFile[file].forEach(function (issue) {
        var sevColor = issue.severity === 'error' ? '#ef4444' : '#f59e0b';
        var sevLabel = issue.severity === 'error' ? 'ERR' : 'WARN';
        html += '<div style="display:flex;gap:8px;padding:4px 8px;font-size:13px;font-family:monospace">' +
          '<span style="color:#9ca3af;min-width:48px">' + issue.line + ':' + (issue.column || 0) + '</span>' +
          '<span style="color:' + sevColor + ';min-width:36px;font-weight:600">' + sevLabel + '</span>' +
          '<span style="color:#374151;flex:1">' + _esc(issue.message) + '</span>' +
          '<span style="color:#9ca3af">' + _esc(issue.rule || '') + '</span>' +
          '</div>';
      });
      html += '</div>';
    });

    container.innerHTML = html;
  }

  /**
   * Render config preview as formatted JSON.
   * @param {HTMLElement} container
   * @param {Object} [overrides]
   */
  function renderConfigPreview(container, overrides) {
    if (!container) return;
    var json = generateConfigJSON(overrides);
    container.innerHTML = '<pre style="background:#1e293b;color:#e2e8f0;padding:16px;border-radius:8px;overflow-x:auto;font-size:13px;line-height:1.5"><code>' +
      _esc(json) + '</code></pre>';
  }

  function _esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ─── Export ───────────────────────────────────────────────
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.EslintConfig = {
    generateConfig: generateConfig,
    generateConfigJSON: generateConfigJSON,
    quickLint: quickLint,
    getSavedConfig: getSavedConfig,
    saveCustomConfig: saveCustomConfig,
    getSummary: getSummary,
    renderLintReport: renderLintReport,
    renderConfigPreview: renderConfigPreview,
    BROWSER_GLOBALS: BROWSER_GLOBALS,
    APP_GLOBALS: APP_GLOBALS,
    RECOMMENDED_RULES: RECOMMENDED_RULES,
    version: '1.0.0'
  };
})();
