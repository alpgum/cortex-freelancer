/**
 * [CF-015] Profile A/B Test Framework
 * Save multiple profile versions, track which gets more invites.
 * Exposed as window.CortexFreelancer.ProfileABTest
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_profile_ab_tests';

  // ─── Persistence ─────────────────────────────────────────────────────

  function loadTests() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveTests(tests) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tests));
  }

  // ─── State ───────────────────────────────────────────────────────────

  var state = {
    container: null,
    tests: [],
    activeView: 'list', // 'list' | 'create' | 'detail'
    selectedTestId: null,
    editForm: null
  };

  // ─── Styles ──────────────────────────────────────────────────────────

  var STYLES = '\
    .ab-root { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #1a1a2e; color: #e0e0e0; border-radius: 12px; padding: 24px; max-width: 860px; }\
    .ab-title { font-size: 20px; font-weight: 700; margin-bottom: 6px; color: #fff; }\
    .ab-subtitle { font-size: 13px; color: #888; margin-bottom: 20px; }\
    .ab-btn { padding: 8px 16px; border-radius: 6px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.2s; }\
    .ab-btn-primary { background: #00d4aa; color: #1a1a2e; }\
    .ab-btn-primary:hover { background: #00b894; }\
    .ab-btn-secondary { background: #2d2d44; color: #e0e0e0; }\
    .ab-btn-secondary:hover { background: #3d3d54; }\
    .ab-btn-danger { background: #ff6b6b22; color: #ff6b6b; border: 1px solid #ff6b6b44; }\
    .ab-btn-danger:hover { background: #ff6b6b33; }\
    .ab-btn-sm { padding: 4px 10px; font-size: 12px; }\
    .ab-card { background: #16213e; border-radius: 10px; padding: 16px; border: 1px solid #2d2d44; margin-bottom: 12px; }\
    .ab-test-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }\
    .ab-test-name { font-size: 16px; font-weight: 600; color: #fff; }\
    .ab-test-status { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; padding: 3px 10px; border-radius: 10px; font-weight: 600; }\
    .ab-status-running { color: #00d4aa; background: #00d4aa15; }\
    .ab-status-paused { color: #fdcb6e; background: #fdcb6e15; }\
    .ab-status-completed { color: #74b9ff; background: #74b9ff15; }\
    .ab-variants { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }\
    .ab-variant { background: #1a1a2e; border-radius: 8px; padding: 14px; border: 1px solid #2d2d44; position: relative; }\
    .ab-variant.winner { border-color: #00d4aa; }\
    .ab-variant-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }\
    .ab-variant-field { margin-bottom: 6px; }\
    .ab-variant-field-label { font-size: 11px; color: #888; }\
    .ab-variant-field-value { font-size: 13px; margin-top: 2px; }\
    .ab-stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px; }\
    .ab-stat { background: #1a1a2e; border-radius: 8px; padding: 10px; text-align: center; }\
    .ab-stat-value { font-size: 20px; font-weight: 700; color: #fff; }\
    .ab-stat-label { font-size: 11px; color: #888; margin-top: 2px; }\
    .ab-form { display: flex; flex-direction: column; gap: 14px; }\
    .ab-form-row { display: flex; flex-direction: column; gap: 4px; }\
    .ab-form-row label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; }\
    .ab-form-row input, .ab-form-row textarea, .ab-form-row select { background: #1a1a2e; border: 1px solid #2d2d44; border-radius: 6px; padding: 10px 12px; color: #e0e0e0; font-size: 14px; font-family: inherit; outline: none; resize: vertical; }\
    .ab-form-row input:focus, .ab-form-row textarea:focus { border-color: #00d4aa; }\
    .ab-form-variant { background: #16213e; border-radius: 8px; padding: 16px; border: 1px solid #2d2d44; }\
    .ab-form-variant-title { font-size: 14px; font-weight: 600; margin-bottom: 10px; }\
    .ab-progress-bar { height: 8px; background: #2d2d44; border-radius: 4px; overflow: hidden; margin-top: 6px; }\
    .ab-progress-fill { height: 100%; border-radius: 4px; transition: width 0.3s; }\
    .ab-badge { display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: #00d4aa22; color: #00d4aa; margin-left: 6px; }\
    .ab-empty { text-align: center; padding: 48px 20px; color: #888; }\
    .ab-empty-title { font-size: 16px; color: #aaa; margin-bottom: 8px; }\
    .ab-actions { display: flex; gap: 8px; flex-wrap: wrap; }\
    .ab-log-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 12px; }\
    .ab-log-table th { text-align: left; padding: 8px 10px; color: #888; font-weight: 500; border-bottom: 1px solid #2d2d44; }\
    .ab-log-table td { padding: 8px 10px; border-bottom: 1px solid #1e1e36; }\
  ';

  // ─── Mock Data Generator ─────────────────────────────────────────────

  function generateMockTests() {
    return [
      {
        id: 'test_001',
        name: 'Title Optimization',
        status: 'running',
        createdAt: '2026-02-15',
        variants: [
          {
            id: 'A',
            label: 'Variant A (Control)',
            title: 'Full-Stack Web Developer',
            overview: 'Experienced developer with 5+ years building web applications using React, Node.js, and PostgreSQL.',
            rate: 55,
            skills: ['React', 'Node.js', 'PostgreSQL', 'TypeScript']
          },
          {
            id: 'B',
            label: 'Variant B',
            title: 'Senior React & Node.js Engineer | E-commerce Specialist',
            overview: 'I help e-commerce brands build fast, scalable storefronts. 5+ years, 40+ projects, $2M+ in client revenue generated.',
            rate: 65,
            skills: ['React', 'Node.js', 'E-commerce', 'Shopify', 'TypeScript']
          }
        ],
        metrics: {
          A: { profileViews: 124, invites: 8, proposals: 22, hired: 3, daysActive: 18 },
          B: { profileViews: 156, invites: 14, proposals: 18, hired: 5, daysActive: 19 }
        },
        log: [
          { date: '2026-02-15', event: 'Test started', variant: '-' },
          { date: '2026-02-20', event: 'Switched to Variant B', variant: 'B' },
          { date: '2026-02-27', event: 'Switched to Variant A', variant: 'A' },
          { date: '2026-03-05', event: 'Switched to Variant B', variant: 'B' },
          { date: '2026-03-12', event: 'Switched to Variant A', variant: 'A' },
          { date: '2026-03-19', event: 'Switched to Variant B', variant: 'B' }
        ]
      },
      {
        id: 'test_002',
        name: 'Rate Testing',
        status: 'completed',
        createdAt: '2026-01-10',
        variants: [
          {
            id: 'A',
            label: 'Variant A ($45/hr)',
            title: 'Full-Stack Web Developer',
            overview: 'Standard overview text for rate comparison.',
            rate: 45,
            skills: ['React', 'Node.js']
          },
          {
            id: 'B',
            label: 'Variant B ($65/hr)',
            title: 'Full-Stack Web Developer',
            overview: 'Standard overview text for rate comparison.',
            rate: 65,
            skills: ['React', 'Node.js']
          }
        ],
        metrics: {
          A: { profileViews: 230, invites: 18, proposals: 35, hired: 6, daysActive: 30 },
          B: { profileViews: 198, invites: 12, proposals: 28, hired: 7, daysActive: 30 }
        },
        log: [
          { date: '2026-01-10', event: 'Test started', variant: '-' },
          { date: '2026-02-10', event: 'Test completed', variant: '-' }
        ]
      }
    ];
  }

  // ─── Utility ─────────────────────────────────────────────────────────

  function genId() {
    return 'test_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
  }

  function getWinner(test) {
    if (!test.metrics) return null;
    var variants = test.variants;
    var best = null;
    var bestScore = -1;
    variants.forEach(function (v) {
      var m = test.metrics[v.id];
      if (!m) return;
      var score = (m.invites || 0) * 3 + (m.hired || 0) * 10 + (m.profileViews || 0) * 0.1;
      if (score > bestScore) {
        bestScore = score;
        best = v.id;
      }
    });
    return best;
  }

  function calcConversion(m) {
    if (!m || !m.profileViews) return '0%';
    return ((m.invites / m.profileViews) * 100).toFixed(1) + '%';
  }

  // ─── Render Functions ────────────────────────────────────────────────

  function render(containerId) {
    var container = typeof containerId === 'string'
      ? document.getElementById(containerId) || document.querySelector(containerId)
      : containerId;
    if (!container) return;
    state.container = container;

    if (state.tests.length === 0) {
      state.tests = loadTests();
      if (state.tests.length === 0) {
        state.tests = generateMockTests();
        saveTests(state.tests);
      }
    }

    var style = document.createElement('style');
    style.textContent = STYLES;

    var html = '';
    if (state.activeView === 'list') {
      html = renderList();
    } else if (state.activeView === 'create') {
      html = renderCreateForm();
    } else if (state.activeView === 'detail') {
      html = renderDetail();
    }

    container.innerHTML = '';
    container.appendChild(style);
    var div = document.createElement('div');
    div.innerHTML = html;
    container.appendChild(div);

    bindEvents(container, containerId);
  }

  function renderList() {
    var html = '<div class="ab-root">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">';
    html += '<div><div class="ab-title">Profile A/B Tests</div>';
    html += '<div class="ab-subtitle">Test different profile versions to maximize invites</div></div>';
    html += '<button class="ab-btn ab-btn-primary" data-action="create">+ New Test</button>';
    html += '</div>';

    if (state.tests.length === 0) {
      html += '<div class="ab-empty">';
      html += '<div class="ab-empty-title">No A/B tests yet</div>';
      html += '<div>Create your first test to start optimizing your profile</div>';
      html += '</div>';
    } else {
      state.tests.forEach(function (test) {
        var winner = getWinner(test);
        html += '<div class="ab-card" style="cursor:pointer" data-action="view" data-id="' + test.id + '">';
        html += '<div class="ab-test-header">';
        html += '<div class="ab-test-name">' + escapeHtml(test.name) + '</div>';
        var statusClass = 'ab-status-' + test.status;
        html += '<div class="ab-test-status ' + statusClass + '">' + test.status + '</div>';
        html += '</div>';

        // Variant comparison mini-view
        html += '<div class="ab-variants">';
        test.variants.forEach(function (v) {
          var m = test.metrics ? test.metrics[v.id] : {};
          var isWinner = winner === v.id;
          html += '<div class="ab-variant' + (isWinner ? ' winner' : '') + '">';
          html += '<div class="ab-variant-label" style="color:' + (v.id === 'A' ? '#6c5ce7' : '#00d4aa') + '">' + escapeHtml(v.label);
          if (isWinner) html += '<span class="ab-badge">Leading</span>';
          html += '</div>';
          html += '<div class="ab-variant-field"><div class="ab-variant-field-label">Title</div><div class="ab-variant-field-value">' + escapeHtml(v.title) + '</div></div>';
          html += '<div class="ab-variant-field"><div class="ab-variant-field-label">Rate</div><div class="ab-variant-field-value">$' + v.rate + '/hr</div></div>';
          if (m) {
            html += '<div class="ab-variant-field"><div class="ab-variant-field-label">Invites / Views</div><div class="ab-variant-field-value">' + (m.invites || 0) + ' / ' + (m.profileViews || 0) + ' (' + calcConversion(m) + ')</div></div>';
          }
          html += '</div>';
        });
        html += '</div>';

        html += '</div>';
      });
    }

    html += '</div>';
    return html;
  }

  function renderDetail() {
    var test = state.tests.find(function (t) { return t.id === state.selectedTestId; });
    if (!test) { state.activeView = 'list'; return renderList(); }

    var winner = getWinner(test);
    var html = '<div class="ab-root">';

    // Header
    html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px">';
    html += '<div>';
    html += '<div style="font-size:13px;color:#888;cursor:pointer;margin-bottom:6px" data-action="back">&larr; Back to tests</div>';
    html += '<div class="ab-title">' + escapeHtml(test.name) + '</div>';
    html += '<div class="ab-subtitle">Created ' + test.createdAt + '</div>';
    html += '</div>';
    html += '<div class="ab-actions">';
    if (test.status === 'running') {
      html += '<button class="ab-btn ab-btn-secondary ab-btn-sm" data-action="pause" data-id="' + test.id + '">Pause</button>';
      html += '<button class="ab-btn ab-btn-primary ab-btn-sm" data-action="complete" data-id="' + test.id + '">Complete</button>';
    } else if (test.status === 'paused') {
      html += '<button class="ab-btn ab-btn-primary ab-btn-sm" data-action="resume" data-id="' + test.id + '">Resume</button>';
    }
    html += '<button class="ab-btn ab-btn-danger ab-btn-sm" data-action="delete" data-id="' + test.id + '">Delete</button>';
    html += '</div></div>';

    // Variants detail
    html += '<div class="ab-variants">';
    test.variants.forEach(function (v) {
      var m = test.metrics ? test.metrics[v.id] : {};
      var isWinner = winner === v.id;
      html += '<div class="ab-variant' + (isWinner ? ' winner' : '') + '">';
      html += '<div class="ab-variant-label" style="color:' + (v.id === 'A' ? '#6c5ce7' : '#00d4aa') + '">' + escapeHtml(v.label);
      if (isWinner) html += '<span class="ab-badge">Leading</span>';
      html += '</div>';
      html += '<div class="ab-variant-field"><div class="ab-variant-field-label">Title</div><div class="ab-variant-field-value">' + escapeHtml(v.title) + '</div></div>';
      html += '<div class="ab-variant-field"><div class="ab-variant-field-label">Rate</div><div class="ab-variant-field-value">$' + v.rate + '/hr</div></div>';
      html += '<div class="ab-variant-field"><div class="ab-variant-field-label">Overview</div><div class="ab-variant-field-value" style="font-size:12px;color:#aaa">' + escapeHtml(v.overview.substring(0, 120)) + (v.overview.length > 120 ? '...' : '') + '</div></div>';
      html += '<div class="ab-variant-field"><div class="ab-variant-field-label">Skills</div><div class="ab-variant-field-value">' + v.skills.join(', ') + '</div></div>';
      html += '</div>';
    });
    html += '</div>';

    // Metrics comparison
    html += '<div class="ab-card">';
    html += '<div style="font-size:15px;font-weight:600;margin-bottom:14px;color:#fff">Performance Metrics</div>';

    test.variants.forEach(function (v) {
      var m = test.metrics ? test.metrics[v.id] : {};
      var color = v.id === 'A' ? '#6c5ce7' : '#00d4aa';
      html += '<div style="margin-bottom:14px">';
      html += '<div style="font-size:13px;font-weight:600;color:' + color + ';margin-bottom:8px">' + escapeHtml(v.label) + '</div>';
      html += '<div class="ab-stats-row">';
      html += '<div class="ab-stat"><div class="ab-stat-value">' + (m.profileViews || 0) + '</div><div class="ab-stat-label">Views</div></div>';
      html += '<div class="ab-stat"><div class="ab-stat-value">' + (m.invites || 0) + '</div><div class="ab-stat-label">Invites</div></div>';
      html += '<div class="ab-stat"><div class="ab-stat-value">' + (m.hired || 0) + '</div><div class="ab-stat-label">Hired</div></div>';
      html += '<div class="ab-stat"><div class="ab-stat-value">' + calcConversion(m) + '</div><div class="ab-stat-label">Conv. Rate</div></div>';
      html += '</div>';

      // Conversion bar
      var convPct = m.profileViews ? ((m.invites / m.profileViews) * 100) : 0;
      html += '<div style="font-size:12px;color:#888;margin-bottom:4px">Invite conversion</div>';
      html += '<div class="ab-progress-bar"><div class="ab-progress-fill" style="width:' + Math.min(100, convPct * 5) + '%;background:' + color + '"></div></div>';
      html += '</div>';
    });
    html += '</div>';

    // Activity log
    if (test.log && test.log.length > 0) {
      html += '<div class="ab-card">';
      html += '<div style="font-size:15px;font-weight:600;margin-bottom:8px;color:#fff">Activity Log</div>';
      html += '<table class="ab-log-table">';
      html += '<tr><th>Date</th><th>Event</th><th>Variant</th></tr>';
      test.log.forEach(function (entry) {
        html += '<tr><td>' + entry.date + '</td><td>' + escapeHtml(entry.event) + '</td><td>' + entry.variant + '</td></tr>';
      });
      html += '</table></div>';
    }

    html += '</div>';
    return html;
  }

  function renderCreateForm() {
    var html = '<div class="ab-root">';
    html += '<div style="font-size:13px;color:#888;cursor:pointer;margin-bottom:6px" data-action="back">&larr; Back to tests</div>';
    html += '<div class="ab-title">Create New A/B Test</div>';
    html += '<div class="ab-subtitle">Define two profile variants to compare</div>';

    html += '<div class="ab-form">';
    html += '<div class="ab-form-row"><label>Test Name</label><input type="text" id="ab-name" placeholder="e.g., Title Optimization Q1"></div>';

    ['A', 'B'].forEach(function (v) {
      var prefix = v.toLowerCase();
      var color = v === 'A' ? '#6c5ce7' : '#00d4aa';
      html += '<div class="ab-form-variant">';
      html += '<div class="ab-form-variant-title" style="color:' + color + '">Variant ' + v + (v === 'A' ? ' (Control)' : '') + '</div>';
      html += '<div class="ab-form-row"><label>Profile Title</label><input type="text" id="ab-' + prefix + '-title" placeholder="Your profile title"></div>';
      html += '<div class="ab-form-row"><label>Overview Snippet</label><textarea id="ab-' + prefix + '-overview" rows="3" placeholder="First paragraph of your overview"></textarea></div>';
      html += '<div class="ab-form-row"><label>Hourly Rate ($)</label><input type="number" id="ab-' + prefix + '-rate" min="1" max="500" placeholder="50"></div>';
      html += '<div class="ab-form-row"><label>Skills (comma-separated)</label><input type="text" id="ab-' + prefix + '-skills" placeholder="React, Node.js, TypeScript"></div>';
      html += '</div>';
    });

    html += '<div style="display:flex;gap:8px">';
    html += '<button class="ab-btn ab-btn-primary" data-action="save">Create Test</button>';
    html += '<button class="ab-btn ab-btn-secondary" data-action="back">Cancel</button>';
    html += '</div>';
    html += '</div></div>';
    return html;
  }

  // ─── Event Binding ───────────────────────────────────────────────────

  function bindEvents(container, containerId) {
    container.querySelectorAll('[data-action]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        var action = el.getAttribute('data-action');
        var id = el.getAttribute('data-id');

        switch (action) {
          case 'create':
            state.activeView = 'create';
            render(containerId);
            break;
          case 'back':
            state.activeView = 'list';
            state.selectedTestId = null;
            render(containerId);
            break;
          case 'view':
            state.activeView = 'detail';
            state.selectedTestId = id;
            render(containerId);
            break;
          case 'save':
            createTest(container, containerId);
            break;
          case 'pause':
            updateStatus(id, 'paused', containerId);
            break;
          case 'resume':
            updateStatus(id, 'running', containerId);
            break;
          case 'complete':
            updateStatus(id, 'completed', containerId);
            break;
          case 'delete':
            deleteTest(id, containerId);
            break;
        }
      });
    });
  }

  function createTest(container, containerId) {
    var name = (container.querySelector('#ab-name') || {}).value || '';
    if (!name.trim()) return;

    function getVal(id) { return (container.querySelector('#' + id) || {}).value || ''; }

    var test = {
      id: genId(),
      name: name.trim(),
      status: 'running',
      createdAt: new Date().toISOString().split('T')[0],
      variants: [
        {
          id: 'A',
          label: 'Variant A (Control)',
          title: getVal('ab-a-title') || 'Untitled',
          overview: getVal('ab-a-overview') || '',
          rate: parseInt(getVal('ab-a-rate'), 10) || 50,
          skills: getVal('ab-a-skills').split(',').map(function (s) { return s.trim(); }).filter(Boolean)
        },
        {
          id: 'B',
          label: 'Variant B',
          title: getVal('ab-b-title') || 'Untitled',
          overview: getVal('ab-b-overview') || '',
          rate: parseInt(getVal('ab-b-rate'), 10) || 50,
          skills: getVal('ab-b-skills').split(',').map(function (s) { return s.trim(); }).filter(Boolean)
        }
      ],
      metrics: {
        A: { profileViews: 0, invites: 0, proposals: 0, hired: 0, daysActive: 0 },
        B: { profileViews: 0, invites: 0, proposals: 0, hired: 0, daysActive: 0 }
      },
      log: [{ date: new Date().toISOString().split('T')[0], event: 'Test created', variant: '-' }]
    };

    state.tests.push(test);
    saveTests(state.tests);
    state.activeView = 'detail';
    state.selectedTestId = test.id;
    render(containerId);
  }

  function updateStatus(id, status, containerId) {
    var test = state.tests.find(function (t) { return t.id === id; });
    if (!test) return;
    test.status = status;
    test.log.push({ date: new Date().toISOString().split('T')[0], event: 'Status changed to ' + status, variant: '-' });
    saveTests(state.tests);
    render(containerId);
  }

  function deleteTest(id, containerId) {
    state.tests = state.tests.filter(function (t) { return t.id !== id; });
    saveTests(state.tests);
    state.activeView = 'list';
    state.selectedTestId = null;
    render(containerId);
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // ─── Public API ──────────────────────────────────────────────────────

  function init(opts) {
    opts = opts || {};
    state.tests = opts.tests || loadTests();
    state.activeView = 'list';
    state.selectedTestId = null;
    if (state.tests.length === 0) {
      state.tests = generateMockTests();
      saveTests(state.tests);
    }
  }

  function destroy() {
    if (state.container) {
      state.container.innerHTML = '';
      state.container = null;
    }
  }

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.ProfileABTest = {
    init: init,
    render: render,
    destroy: destroy,
    getTests: function () { return state.tests.slice(); },
    recordMetric: function (testId, variantId, metric) {
      var test = state.tests.find(function (t) { return t.id === testId; });
      if (!test || !test.metrics[variantId]) return;
      if (test.metrics[variantId][metric] != null) {
        test.metrics[variantId][metric]++;
        saveTests(state.tests);
      }
    }
  };
})();
