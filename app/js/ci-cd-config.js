/**
 * CF-268: CI/CD Pipeline Configuration (Enhanced)
 * Generate GitHub Actions workflow YAML + render pipeline status preview.
 * Stages: lint, test, build, deploy-preview, deploy-prod.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_cicd_v2';

  var PIPELINE_STAGES = ['lint', 'test', 'build', 'deploy-preview', 'deploy-prod'];

  var STAGE_META = {
    'lint':            { label: 'Lint',             icon: '\uD83D\uDD0D', order: 1 },
    'test':            { label: 'Tests',            icon: '\uD83E\uDDEA', order: 2 },
    'build':           { label: 'Build',            icon: '\uD83D\uDCE6', order: 3 },
    'deploy-preview':  { label: 'Preview Deploy',   icon: '\uD83D\uDC41\uFE0F', order: 4 },
    'deploy-prod':     { label: 'Production Deploy', icon: '\uD83D\uDE80', order: 5 }
  };

  // ─── Config Persistence ───────────────────────────────────

  function getDefaultConfig() {
    return {
      repo: '',
      branch: 'main',
      nodeVersion: '20',
      autoDeployPreview: true,
      autoDeployProd: false,
      requiredChecks: ['lint', 'test', 'build'],
      notifications: { onFailure: true, onSuccess: false },
      env: {
        vercelToken: 'VERCEL_TOKEN',
        vercelOrgId: 'VERCEL_ORG_ID',
        vercelProjectId: 'VERCEL_PROJECT_ID'
      }
    };
  }

  /**
   * Get saved pipeline config.
   * @returns {Object}
   */
  function getConfig() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || getDefaultConfig();
    } catch (_e) {
      return getDefaultConfig();
    }
  }

  /**
   * Save pipeline config.
   * @param {Object} config
   */
  function saveConfig(config) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }

  // ─── Workflow Generation ──────────────────────────────────

  /**
   * Generate a complete GitHub Actions CI/CD workflow YAML string.
   * @param {Object} [config]
   * @returns {string}
   */
  function generateWorkflow(config) {
    config = config || getConfig();
    var nv = config.nodeVersion || '20';
    var branch = config.branch || 'main';

    var y = '';
    y += 'name: CI/CD Pipeline\n\n';
    y += 'on:\n';
    y += '  push:\n';
    y += '    branches: [' + branch + ']\n';
    y += '  pull_request:\n';
    y += '    branches: [' + branch + ']\n\n';

    y += 'concurrency:\n';
    y += '  group: ${{ github.workflow }}-${{ github.ref }}\n';
    y += '  cancel-in-progress: true\n\n';

    y += 'jobs:\n';

    // Lint
    y += '  lint:\n';
    y += '    name: Lint\n';
    y += '    runs-on: ubuntu-latest\n';
    y += '    steps:\n';
    y += '      - uses: actions/checkout@v4\n';
    y += '      - uses: actions/setup-node@v4\n';
    y += '        with:\n';
    y += '          node-version: ' + nv + '\n';
    y += '          cache: npm\n';
    y += '      - run: npm ci\n';
    y += '      - run: npm run lint\n\n';

    // Test
    y += '  test:\n';
    y += '    name: Tests\n';
    y += '    runs-on: ubuntu-latest\n';
    y += '    needs: lint\n';
    y += '    steps:\n';
    y += '      - uses: actions/checkout@v4\n';
    y += '      - uses: actions/setup-node@v4\n';
    y += '        with:\n';
    y += '          node-version: ' + nv + '\n';
    y += '          cache: npm\n';
    y += '      - run: npm ci\n';
    y += '      - run: npm test\n\n';

    // Build
    y += '  build:\n';
    y += '    name: Build\n';
    y += '    runs-on: ubuntu-latest\n';
    y += '    needs: test\n';
    y += '    steps:\n';
    y += '      - uses: actions/checkout@v4\n';
    y += '      - uses: actions/setup-node@v4\n';
    y += '        with:\n';
    y += '          node-version: ' + nv + '\n';
    y += '          cache: npm\n';
    y += '      - run: npm ci\n';
    y += '      - run: npm run build\n';
    y += '      - uses: actions/upload-artifact@v4\n';
    y += '        with:\n';
    y += '          name: build-output\n';
    y += '          path: dist/\n';
    y += '          retention-days: 7\n\n';

    // Deploy Preview
    if (config.autoDeployPreview) {
      y += '  deploy-preview:\n';
      y += '    name: Preview Deploy\n';
      y += '    runs-on: ubuntu-latest\n';
      y += '    needs: build\n';
      y += '    if: github.event_name == \'pull_request\'\n';
      y += '    steps:\n';
      y += '      - uses: actions/checkout@v4\n';
      y += '      - uses: amondnet/vercel-action@v25\n';
      y += '        with:\n';
      y += '          vercel-token: ${{ secrets.' + (config.env.vercelToken || 'VERCEL_TOKEN') + ' }}\n';
      y += '          vercel-org-id: ${{ secrets.' + (config.env.vercelOrgId || 'VERCEL_ORG_ID') + ' }}\n';
      y += '          vercel-project-id: ${{ secrets.' + (config.env.vercelProjectId || 'VERCEL_PROJECT_ID') + ' }}\n\n';
    }

    // Deploy Prod
    y += '  deploy-prod:\n';
    y += '    name: Production Deploy\n';
    y += '    runs-on: ubuntu-latest\n';
    y += '    needs: build\n';
    y += '    if: github.ref == \'refs/heads/' + branch + '\' && github.event_name == \'push\'\n';
    y += '    environment: production\n';
    y += '    steps:\n';
    y += '      - uses: actions/checkout@v4\n';
    y += '      - uses: amondnet/vercel-action@v25\n';
    y += '        with:\n';
    y += '          vercel-token: ${{ secrets.' + (config.env.vercelToken || 'VERCEL_TOKEN') + ' }}\n';
    y += '          vercel-org-id: ${{ secrets.' + (config.env.vercelOrgId || 'VERCEL_ORG_ID') + ' }}\n';
    y += '          vercel-project-id: ${{ secrets.' + (config.env.vercelProjectId || 'VERCEL_PROJECT_ID') + ' }}\n';
    y += '          vercel-args: --prod\n';

    return y;
  }

  // ─── Pipeline Status ──────────────────────────────────────

  /**
   * Compute pipeline status from stage results.
   * @param {{ stages: Array<{ name: string, status: string, duration?: number }> }} run
   * @returns {{ overall: string, progress: number, failed: string|null }}
   */
  function getPipelineStatus(run) {
    if (!run || !run.stages) return { overall: 'unknown', progress: 0, failed: null };

    var completed = 0;
    var failedStage = null;

    run.stages.forEach(function (s) {
      if (s.status === 'success') completed++;
      if (s.status === 'failure' && !failedStage) failedStage = s.name;
    });

    return {
      overall: failedStage ? 'failure' : completed === run.stages.length ? 'success' : 'running',
      progress: Math.round((completed / run.stages.length) * 100),
      failed: failedStage
    };
  }

  // ─── Render ───────────────────────────────────────────────

  /**
   * Render pipeline status visualization.
   * @param {HTMLElement} container
   * @param {{ stages: Array }} run
   */
  function renderPipelineStatus(container, run) {
    if (!container) return;

    var status = getPipelineStatus(run);
    var statusColors = { success: '#10b981', failure: '#ef4444', running: '#3b82f6', unknown: '#9ca3af' };
    var overallColor = statusColors[status.overall] || statusColors.unknown;

    var html = '<div style="margin-bottom:16px">' +
      '<div style="font-weight:600;color:' + overallColor + ';margin-bottom:8px">' +
      'Pipeline: ' + status.overall.charAt(0).toUpperCase() + status.overall.slice(1) +
      ' (' + status.progress + '%)' +
      (status.failed ? ' &mdash; failed at ' + (STAGE_META[status.failed] || {}).label : '') +
      '</div>';

    // Progress bar
    html += '<div style="display:flex;gap:3px;margin-bottom:16px">';
    (run && run.stages || []).forEach(function (s) {
      var c = s.status === 'success' ? '#10b981'
        : s.status === 'failure' ? '#ef4444'
        : s.status === 'running' ? '#3b82f6' : '#e5e7eb';
      html += '<div style="flex:1;height:6px;border-radius:3px;background:' + c + '"></div>';
    });
    html += '</div>';

    // Stage list
    (run && run.stages || []).forEach(function (s) {
      var meta = STAGE_META[s.name] || { label: s.name, icon: '' };
      var icon = s.status === 'success' ? '\u2705'
        : s.status === 'failure' ? '\u274C'
        : s.status === 'running' ? '\u23F3' : '\u2B1C';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f3f4f6">' +
        '<span>' + icon + ' ' + meta.label + '</span>' +
        '<div style="display:flex;gap:8px;align-items:center">' +
        (s.duration ? '<span style="color:#9ca3af;font-size:13px">' + s.duration + 's</span>' : '') +
        '<span style="font-size:12px;color:#9ca3af;text-transform:uppercase">' + s.status + '</span>' +
        '</div></div>';
    });

    html += '</div>';
    container.innerHTML = html;
  }

  /**
   * Render workflow YAML preview in a container.
   * @param {HTMLElement} container
   * @param {Object} [config]
   */
  function renderWorkflowPreview(container, config) {
    if (!container) return;
    var yaml = generateWorkflow(config);
    container.innerHTML = '<pre style="background:#1e293b;color:#e2e8f0;padding:16px;border-radius:8px;overflow-x:auto;font-size:13px;line-height:1.5"><code>' +
      yaml.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') +
      '</code></pre>';
  }

  // ─── Export ───────────────────────────────────────────────
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.CiCdConfig = {
    PIPELINE_STAGES: PIPELINE_STAGES,
    STAGE_META: STAGE_META,
    getConfig: getConfig,
    saveConfig: saveConfig,
    generateWorkflow: generateWorkflow,
    getPipelineStatus: getPipelineStatus,
    renderPipelineStatus: renderPipelineStatus,
    renderWorkflowPreview: renderWorkflowPreview,
    version: '1.0.0'
  };
})();
