/**
 * CF-268: CI/CD Pipeline Manager (GitHub Actions)
 * Client-side dashboard for monitoring CI/CD pipeline status and deployments.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_cicd_config';
  var PIPELINE_STAGES = ['lint', 'test', 'build', 'deploy-preview', 'deploy-prod'];

  var STAGE_LABELS = {
    'lint': 'Lint',
    'test': 'Tests',
    'build': 'Build',
    'deploy-preview': 'Preview Deploy',
    'deploy-prod': 'Production Deploy'
  };

  /**
   * Get pipeline config.
   * @returns {Object}
   */
  function getConfig() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || getDefaultConfig();
    } catch (_e) {
      return getDefaultConfig();
    }
  }

  function getDefaultConfig() {
    return {
      repo: '',
      branch: 'main',
      autoDeployPreview: true,
      autoDeployProd: false,
      requiredChecks: ['lint', 'test', 'build'],
      notifications: { onFailure: true, onSuccess: false }
    };
  }

  /**
   * Save pipeline config.
   * @param {Object} config
   */
  function saveConfig(config) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }

  /**
   * Generate GitHub Actions workflow YAML.
   * @param {Object} [config]
   * @returns {string}
   */
  function generateWorkflow(config) {
    config = config || getConfig();

    var yaml = 'name: CI/CD Pipeline\n\n';
    yaml += 'on:\n';
    yaml += '  push:\n';
    yaml += '    branches: [main]\n';
    yaml += '  pull_request:\n';
    yaml += '    branches: [main]\n\n';
    yaml += 'jobs:\n';

    // Lint
    yaml += '  lint:\n';
    yaml += '    runs-on: ubuntu-latest\n';
    yaml += '    steps:\n';
    yaml += '      - uses: actions/checkout@v4\n';
    yaml += '      - uses: actions/setup-node@v4\n';
    yaml += '        with:\n';
    yaml += '          node-version: 20\n';
    yaml += '          cache: npm\n';
    yaml += '      - run: npm ci\n';
    yaml += '      - run: npm run lint\n\n';

    // Test
    yaml += '  test:\n';
    yaml += '    runs-on: ubuntu-latest\n';
    yaml += '    needs: lint\n';
    yaml += '    steps:\n';
    yaml += '      - uses: actions/checkout@v4\n';
    yaml += '      - uses: actions/setup-node@v4\n';
    yaml += '        with:\n';
    yaml += '          node-version: 20\n';
    yaml += '          cache: npm\n';
    yaml += '      - run: npm ci\n';
    yaml += '      - run: npm test\n\n';

    // Build
    yaml += '  build:\n';
    yaml += '    runs-on: ubuntu-latest\n';
    yaml += '    needs: test\n';
    yaml += '    steps:\n';
    yaml += '      - uses: actions/checkout@v4\n';
    yaml += '      - uses: actions/setup-node@v4\n';
    yaml += '        with:\n';
    yaml += '          node-version: 20\n';
    yaml += '          cache: npm\n';
    yaml += '      - run: npm ci\n';
    yaml += '      - run: npm run build\n\n';

    // Deploy preview on PR
    if (config.autoDeployPreview) {
      yaml += '  deploy-preview:\n';
      yaml += '    runs-on: ubuntu-latest\n';
      yaml += '    needs: build\n';
      yaml += '    if: github.event_name == \'pull_request\'\n';
      yaml += '    steps:\n';
      yaml += '      - uses: actions/checkout@v4\n';
      yaml += '      - uses: amondnet/vercel-action@v25\n';
      yaml += '        with:\n';
      yaml += '          vercel-token: ${{ secrets.VERCEL_TOKEN }}\n';
      yaml += '          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}\n';
      yaml += '          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}\n\n';
    }

    // Deploy prod on merge
    yaml += '  deploy-prod:\n';
    yaml += '    runs-on: ubuntu-latest\n';
    yaml += '    needs: build\n';
    yaml += '    if: github.ref == \'refs/heads/main\' && github.event_name == \'push\'\n';
    yaml += '    steps:\n';
    yaml += '      - uses: actions/checkout@v4\n';
    yaml += '      - uses: amondnet/vercel-action@v25\n';
    yaml += '        with:\n';
    yaml += '          vercel-token: ${{ secrets.VERCEL_TOKEN }}\n';
    yaml += '          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}\n';
    yaml += '          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}\n';
    yaml += '          vercel-args: --prod\n';

    return yaml;
  }

  /**
   * Parse a pipeline run status (mock for dashboard display).
   * @param {{ stages: Array<{ name: string, status: string, duration?: number }> }} run
   * @returns {{ overall: string, progress: number }}
   */
  function getPipelineStatus(run) {
    if (!run || !run.stages) return { overall: 'unknown', progress: 0 };

    var completed = 0;
    var failed = false;

    run.stages.forEach(function (s) {
      if (s.status === 'success') completed++;
      if (s.status === 'failure') failed = true;
    });

    return {
      overall: failed ? 'failure' : completed === run.stages.length ? 'success' : 'running',
      progress: Math.round((completed / run.stages.length) * 100)
    };
  }

  /**
   * Render pipeline status.
   * @param {HTMLElement} container
   * @param {{ stages: Array }} run
   */
  function render(container, run) {
    if (!container) return;

    var status = getPipelineStatus(run);
    var statusColors = { success: '#10b981', failure: '#ef4444', running: '#3b82f6', unknown: '#9ca3af' };
    var html = '<div style="margin-bottom:16px;font-weight:600;color:' + statusColors[status.overall] + '">' +
      'Pipeline: ' + status.overall.charAt(0).toUpperCase() + status.overall.slice(1) +
      ' (' + status.progress + '%)</div>';

    html += '<div style="display:flex;gap:4px;margin-bottom:16px">';
    (run && run.stages || []).forEach(function (s) {
      var color = s.status === 'success' ? '#10b981'
        : s.status === 'failure' ? '#ef4444'
        : s.status === 'running' ? '#3b82f6' : '#e5e7eb';
      html += '<div style="flex:1;height:6px;border-radius:3px;background:' + color + '"></div>';
    });
    html += '</div>';

    (run && run.stages || []).forEach(function (s) {
      var icon = s.status === 'success' ? '\u2705'
        : s.status === 'failure' ? '\u274C'
        : s.status === 'running' ? '\u23F3' : '\u2B1C';
      html += '<div style="display:flex;justify-content:space-between;padding:8px;border-bottom:1px solid #f3f4f6">' +
        '<span>' + icon + ' ' + (STAGE_LABELS[s.name] || s.name) + '</span>' +
        (s.duration ? '<span style="color:#9ca3af;font-size:13px">' + s.duration + 's</span>' : '') +
        '</div>';
    });

    container.innerHTML = html;
  }

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.CiCdPipeline = {
    PIPELINE_STAGES: PIPELINE_STAGES,
    getConfig: getConfig,
    saveConfig: saveConfig,
    generateWorkflow: generateWorkflow,
    getPipelineStatus: getPipelineStatus,
    render: render
  };
})();
