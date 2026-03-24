/**
 * [CF-020] Smart Job Filter — Hide Low-Quality Posts Automatically
 * Auto-hides jobs below quality threshold with configurable sensitivity.
 * Integrates with JobQualityScore for scoring logic.
 * Exposed as window.CortexFreelancer.SmartJobFilter
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_smart_filter_config';

  var SENSITIVITY_PRESETS = {
    relaxed: { threshold: 3, label: 'Relaxed', description: 'Only hide very low quality posts', color: '#00d4aa' },
    moderate: { threshold: 5, label: 'Moderate', description: 'Hide below-average posts', color: '#6c5ce7' },
    strict: { threshold: 7, label: 'Strict', description: 'Only show good and excellent posts', color: '#fdcb6e' },
    elite: { threshold: 8.5, label: 'Elite', description: 'Only show top-tier opportunities', color: '#e74c3c' }
  };

  var SCORING_WEIGHTS = {
    budgetRatio: 0.25,
    clientHistory: 0.25,
    descriptionClarity: 0.25,
    competition: 0.25
  };

  // ─── Built-in scoring (standalone, mirrors JobQualityScore) ─────────
  function quickScore(job) {
    var scores = {};

    // Budget/rate
    var rate;
    if (job.budgetType === 'hourly') {
      rate = (job.budgetMin + job.budgetMax) / 2;
    } else {
      var avg = (job.budgetMin + job.budgetMax) / 2;
      var estHours = avg < 200 ? 5 : avg < 1000 ? 20 : avg < 5000 ? 60 : 120;
      rate = avg / estHours;
    }
    scores.budgetRatio = Math.min(10, Math.max(1, 1 + (rate / 100) * 9));

    // Client history
    var cs = 0;
    if (job.clientSpent >= 100000) cs += 3; else if (job.clientSpent >= 10000) cs += 2; else if (job.clientSpent >= 1000) cs += 1; else cs += 0.3;
    if (job.clientHires >= 20) cs += 2.5; else if (job.clientHires >= 5) cs += 1.5; else if (job.clientHires >= 1) cs += 0.8;
    if (job.clientRating >= 4.5) cs += 3; else if (job.clientRating >= 4.0) cs += 2; else if (job.clientRating > 0) cs += 1;
    cs += job.paymentVerified ? 1.5 : 0;
    scores.clientHistory = Math.min(10, Math.max(1, cs));

    // Description clarity
    var desc = job.description || '';
    var dc = 0;
    if (desc.length >= 200) dc += 2; else if (desc.length >= 50) dc += 1; else dc += 0.3;
    if (/deliverable|requirement|milestone/i.test(desc)) dc += 1;
    if ((job.skills || []).length >= 3) dc += 2; else if ((job.skills || []).length >= 1) dc += 1;
    if (!/!!+|URGENT|asap|cheapest/i.test(desc)) dc += 1.5; else dc += 0;
    var sentences = desc.split(/[.!?]+/).filter(function (s) { return s.trim().length > 10; });
    if (sentences.length >= 3) dc += 1.5; else if (sentences.length >= 1) dc += 0.8;
    scores.descriptionClarity = Math.min(10, Math.max(1, dc));

    // Competition
    var p = job.proposals || 0;
    if (p <= 5) scores.competition = 10;
    else if (p <= 10) scores.competition = 8;
    else if (p <= 20) scores.competition = 6;
    else if (p <= 40) scores.competition = 4;
    else scores.competition = 2;

    var overall = scores.budgetRatio * SCORING_WEIGHTS.budgetRatio +
      scores.clientHistory * SCORING_WEIGHTS.clientHistory +
      scores.descriptionClarity * SCORING_WEIGHTS.descriptionClarity +
      scores.competition * SCORING_WEIGHTS.competition;

    return { overall: Math.round(overall * 10) / 10, breakdown: scores };
  }

  // ─── Mock Jobs ──────────────────────────────────────────────────────
  var MOCK_JOBS = [
    { id: 's001', title: 'Full-Stack SaaS Platform Development', budgetType: 'hourly', budgetMin: 60, budgetMax: 90, clientSpent: 350000, clientHires: 58, clientRating: 5.0, paymentVerified: true, proposals: 8, description: 'We are building a B2B SaaS platform and need an experienced full-stack developer. Tech stack: React, Python/Django, AWS. Requirements include REST API design, database optimization, and CI/CD pipeline setup. Regular code reviews and documentation expected.', skills: ['React', 'Python', 'Django', 'AWS'] },
    { id: 's002', title: 'Fix CSS Bug on Homepage', budgetType: 'fixed', budgetMin: 10, budgetMax: 30, clientSpent: 0, clientHires: 0, clientRating: 0, paymentVerified: false, proposals: 55, description: 'fix css quick', skills: [] },
    { id: 's003', title: 'ML Recommendation Engine', budgetType: 'fixed', budgetMin: 8000, budgetMax: 15000, clientSpent: 200000, clientHires: 42, clientRating: 4.9, paymentVerified: true, proposals: 5, description: 'Build a complete ML pipeline for product recommendations. Includes data preprocessing, model training with PyTorch, FastAPI endpoint, and AWS SageMaker deployment. Comprehensive testing and documentation required. 2-week post-deployment support included.', skills: ['Python', 'PyTorch', 'FastAPI', 'AWS', 'ML'] },
    { id: 's004', title: 'WordPress Event Registration Plugin', budgetType: 'fixed', budgetMin: 200, budgetMax: 500, clientSpent: 5000, clientHires: 4, clientRating: 4.2, paymentVerified: true, proposals: 28, description: 'Custom WordPress plugin for event registration with Stripe payment integration, email confirmations, and admin dashboard. Two-week timeline.', skills: ['WordPress', 'PHP', 'JavaScript', 'Stripe'] },
    { id: 's005', title: 'URGENT!! Need website ASAP cheapest!!!', budgetType: 'fixed', budgetMin: 50, budgetMax: 100, clientSpent: 100, clientHires: 0, clientRating: 0, paymentVerified: false, proposals: 68, description: 'URGENT need full ecommerce website ASAP lowest price wins!!!', skills: ['Web Development'] },
    { id: 's006', title: 'DevOps CI/CD Pipeline Automation', budgetType: 'hourly', budgetMin: 70, budgetMax: 110, clientSpent: 95000, clientHires: 22, clientRating: 4.6, paymentVerified: true, proposals: 7, description: 'Setup CI/CD pipeline using GitHub Actions for monorepo with 3 microservices on AWS ECS. Requirements: automated testing, blue-green deployments, Terraform IaC, CloudWatch monitoring with PagerDuty integration. Security best practices required.', skills: ['GitHub Actions', 'Docker', 'AWS', 'Terraform'] },
    { id: 's007', title: 'Copy Paste Data Entry', budgetType: 'fixed', budgetMin: 20, budgetMax: 50, clientSpent: 50, clientHires: 1, clientRating: 3.0, paymentVerified: false, proposals: 72, description: 'copy products from site to spreadsheet 200 items', skills: ['Data Entry'] },
    { id: 's008', title: 'Flutter Fitness App Development', budgetType: 'fixed', budgetMin: 5000, budgetMax: 10000, clientSpent: 150000, clientHires: 25, clientRating: 4.8, paymentVerified: true, proposals: 18, description: 'Cross-platform fitness tracking app with Flutter. Features: workout logging, progress charts, social sharing, push notifications, Apple Health and Google Fit integration. Figma designs provided. 6-8 week delivery with weekly updates.', skills: ['Flutter', 'Dart', 'Firebase', 'REST API'] },
    { id: 's009', title: 'React Native Chat App', budgetType: 'hourly', budgetMin: 45, budgetMax: 70, clientSpent: 28000, clientHires: 12, clientRating: 4.5, paymentVerified: true, proposals: 14, description: 'Build a real-time chat application using React Native with Firebase backend. Features include group chats, media sharing, push notifications, and end-to-end encryption. Must support both iOS and Android.', skills: ['React Native', 'Firebase', 'JavaScript'] },
    { id: 's010', title: 'Simple Logo - $5', budgetType: 'fixed', budgetMin: 5, budgetMax: 5, clientSpent: 0, clientHires: 0, clientRating: 0, paymentVerified: false, proposals: 82, description: 'need a logo fast', skills: [] }
  ];

  // ─── State ──────────────────────────────────────────────────────────
  var state = {
    sensitivity: 'moderate',
    customThreshold: 5,
    autoHideEnabled: true,
    showHidden: false,
    hiddenReasons: {},
    scoredJobs: [],
    container: null
  };

  // ─── Config Persistence ─────────────────────────────────────────────
  function loadConfig() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var cfg = JSON.parse(raw);
        state.sensitivity = cfg.sensitivity || 'moderate';
        state.customThreshold = cfg.customThreshold || 5;
        state.autoHideEnabled = cfg.autoHideEnabled !== false;
      }
    } catch (e) { /* noop */ }
  }

  function saveConfig() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        sensitivity: state.sensitivity,
        customThreshold: state.customThreshold,
        autoHideEnabled: state.autoHideEnabled
      }));
    } catch (e) { /* noop */ }
  }

  // ─── Filter Logic ───────────────────────────────────────────────────
  function getThreshold() {
    if (SENSITIVITY_PRESETS[state.sensitivity]) {
      return SENSITIVITY_PRESETS[state.sensitivity].threshold;
    }
    return state.customThreshold;
  }

  function filterJobs(jobs) {
    var threshold = getThreshold();
    var visible = [];
    var hidden = [];

    jobs.forEach(function (item) {
      if (!state.autoHideEnabled || item.score.overall >= threshold) {
        visible.push(item);
      } else {
        var reasons = [];
        if (item.score.breakdown.budgetRatio < 4) reasons.push('Low budget');
        if (item.score.breakdown.clientHistory < 4) reasons.push('Weak client history');
        if (item.score.breakdown.descriptionClarity < 4) reasons.push('Unclear description');
        if (item.score.breakdown.competition > 6) reasons.push('High competition');
        item.hideReasons = reasons.length > 0 ? reasons : ['Below threshold'];
        hidden.push(item);
      }
    });

    return { visible: visible, hidden: hidden };
  }

  // ─── Helpers ────────────────────────────────────────────────────────
  function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function scoreColor(val) {
    if (val >= 8) return '#00d4aa';
    if (val >= 6) return '#6c5ce7';
    if (val >= 4) return '#fdcb6e';
    return '#e74c3c';
  }

  function scoreLabel(val) {
    if (val >= 8) return 'Excellent';
    if (val >= 6) return 'Good';
    if (val >= 4) return 'Fair';
    return 'Poor';
  }

  // ─── Render ─────────────────────────────────────────────────────────
  function render(containerId) {
    var container = typeof containerId === 'string'
      ? document.getElementById(containerId) || document.querySelector(containerId)
      : containerId;
    if (!container) return;
    state.container = container;

    state.scoredJobs = MOCK_JOBS.map(function (job) {
      return { job: job, score: quickScore(job) };
    }).sort(function (a, b) { return b.score.overall - a.score.overall; });

    var filtered = filterJobs(state.scoredJobs);
    var threshold = getThreshold();
    var preset = SENSITIVITY_PRESETS[state.sensitivity] || SENSITIVITY_PRESETS.moderate;

    container.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.style.cssText = 'font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#1a1a2e;color:#e0e0e0;border-radius:12px;padding:24px;max-width:960px;';

    var html = '<h2 style="margin:0 0 20px;color:#00d4aa;font-size:22px;">Smart Job Filter</h2>';

    // Config panel
    html += '<div style="background:#16213e;border-radius:10px;padding:16px;margin-bottom:20px;border:1px solid #2d2d44;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;">' +
        '<div style="display:flex;align-items:center;gap:12px;">' +
          '<label style="font-size:14px;font-weight:500;">Auto-Hide</label>' +
          '<button id="cf-sf-toggle" style="width:48px;height:26px;border-radius:13px;border:none;background:' + (state.autoHideEnabled ? '#00d4aa' : '#444') + ';cursor:pointer;position:relative;transition:background 0.2s;">' +
            '<span style="width:20px;height:20px;border-radius:50%;background:#fff;position:absolute;top:3px;' + (state.autoHideEnabled ? 'right:3px' : 'left:3px') + ';transition:all 0.2s;"></span>' +
          '</button>' +
        '</div>' +
        '<div style="font-size:13px;color:#888;">Threshold: <strong style="color:' + preset.color + ';">' + threshold.toFixed(1) + '/10</strong> · Showing <strong style="color:#00d4aa;">' + filtered.visible.length + '</strong> of ' + state.scoredJobs.length + ' jobs</div>' +
      '</div>';

    // Sensitivity selector
    html += '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">';
    Object.keys(SENSITIVITY_PRESETS).forEach(function (key) {
      var p = SENSITIVITY_PRESETS[key];
      var active = state.sensitivity === key;
      html += '<button class="cf-sf-preset" data-preset="' + key + '" style="padding:8px 16px;border-radius:8px;border:1px solid ' + (active ? p.color : '#333') + ';background:' + (active ? p.color + '20' : '#0f3460') + ';color:' + (active ? p.color : '#888') + ';font-size:13px;cursor:pointer;">' +
        '<div style="font-weight:600;">' + p.label + '</div>' +
        '<div style="font-size:11px;margin-top:2px;opacity:0.8;">' + p.description + '</div>' +
      '</button>';
    });
    html += '</div>';

    // Custom threshold slider
    html += '<div style="display:flex;align-items:center;gap:12px;">' +
      '<span style="font-size:12px;color:#888;">Custom:</span>' +
      '<input id="cf-sf-threshold" type="range" min="1" max="10" step="0.5" value="' + threshold + '" style="flex:1;accent-color:#00d4aa;">' +
      '<span id="cf-sf-threshold-val" style="font-size:13px;color:#ccc;min-width:40px;">' + threshold.toFixed(1) + '</span>' +
      '</div>';

    html += '</div>';

    // Stats bar
    var excellent = filtered.visible.filter(function (i) { return i.score.overall >= 8; }).length;
    var good = filtered.visible.filter(function (i) { return i.score.overall >= 6 && i.score.overall < 8; }).length;
    var fair = filtered.visible.filter(function (i) { return i.score.overall >= 4 && i.score.overall < 6; }).length;
    html += '<div style="display:flex;gap:12px;margin-bottom:20px;">' +
      '<div style="flex:1;background:#16213e;border-radius:8px;padding:12px;text-align:center;border:1px solid #2d2d44;">' +
        '<div style="font-size:24px;font-weight:700;color:#00d4aa;">' + excellent + '</div><div style="font-size:11px;color:#888;">Excellent</div></div>' +
      '<div style="flex:1;background:#16213e;border-radius:8px;padding:12px;text-align:center;border:1px solid #2d2d44;">' +
        '<div style="font-size:24px;font-weight:700;color:#6c5ce7;">' + good + '</div><div style="font-size:11px;color:#888;">Good</div></div>' +
      '<div style="flex:1;background:#16213e;border-radius:8px;padding:12px;text-align:center;border:1px solid #2d2d44;">' +
        '<div style="font-size:24px;font-weight:700;color:#fdcb6e;">' + fair + '</div><div style="font-size:11px;color:#888;">Fair</div></div>' +
      '<div style="flex:1;background:#16213e;border-radius:8px;padding:12px;text-align:center;border:1px solid #2d2d44;">' +
        '<div style="font-size:24px;font-weight:700;color:#e74c3c;">' + filtered.hidden.length + '</div><div style="font-size:11px;color:#888;">Hidden</div></div>' +
      '</div>';

    // Visible jobs
    filtered.visible.forEach(function (item) {
      html += renderJobCard(item, false);
    });

    // Hidden jobs toggle
    if (filtered.hidden.length > 0) {
      html += '<div style="margin-top:16px;">' +
        '<button id="cf-sf-show-hidden" style="width:100%;padding:12px;border-radius:8px;border:1px dashed #444;background:transparent;color:#888;font-size:13px;cursor:pointer;">' +
        (state.showHidden ? 'Hide' : 'Show') + ' ' + filtered.hidden.length + ' filtered job' + (filtered.hidden.length !== 1 ? 's' : '') +
        '</button></div>';

      if (state.showHidden) {
        html += '<div style="margin-top:12px;opacity:0.6;">';
        filtered.hidden.forEach(function (item) {
          html += renderJobCard(item, true);
        });
        html += '</div>';
      }
    }

    wrap.innerHTML = html;
    container.appendChild(wrap);
    bindEvents(wrap);
  }

  function renderJobCard(item, isHidden) {
    var s = item.score;
    var j = item.job;
    var c = scoreColor(s.overall);
    var budget = j.budgetType === 'hourly'
      ? '$' + j.budgetMin + '-$' + j.budgetMax + '/hr'
      : '$' + j.budgetMin.toLocaleString() + '-$' + j.budgetMax.toLocaleString();

    var html = '<div style="background:#16213e;border-radius:10px;padding:14px;margin-bottom:8px;border:1px solid ' + (isHidden ? '#2a1a1a' : '#2d2d44') + ';' + (isHidden ? 'border-left:3px solid #e74c3c;' : '') + '">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">' +
        '<div style="flex:1;min-width:200px;">' +
          '<div style="font-size:14px;font-weight:500;' + (isHidden ? 'text-decoration:line-through;color:#666;' : 'color:#e0e0e0;') + '">' + escapeHtml(j.title) + '</div>' +
          '<div style="font-size:12px;color:#777;margin-top:3px;">' + budget + ' · ' + j.proposals + ' proposals · ' + (j.paymentVerified ? 'Verified' : 'Unverified') + '</div>' +
          (isHidden && item.hideReasons ? '<div style="font-size:11px;color:#e74c3c;margin-top:3px;">Hidden: ' + item.hideReasons.join(', ') + '</div>' : '') +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:8px;">' +
          '<div style="width:50px;height:4px;background:#0f3460;border-radius:2px;overflow:hidden;"><div style="height:100%;width:' + (s.overall * 10) + '%;background:' + c + ';"></div></div>' +
          '<span style="font-size:16px;font-weight:700;color:' + c + ';min-width:30px;text-align:right;">' + s.overall.toFixed(1) + '</span>' +
        '</div>' +
      '</div>' +
    '</div>';
    return html;
  }

  function bindEvents(wrap) {
    // Toggle auto-hide
    wrap.querySelector('#cf-sf-toggle').addEventListener('click', function () {
      state.autoHideEnabled = !state.autoHideEnabled;
      saveConfig();
      render(state.container);
    });

    // Presets
    var presetBtns = wrap.querySelectorAll('.cf-sf-preset');
    for (var i = 0; i < presetBtns.length; i++) {
      presetBtns[i].addEventListener('click', function () {
        state.sensitivity = this.getAttribute('data-preset');
        saveConfig();
        render(state.container);
      });
    }

    // Custom slider
    var slider = wrap.querySelector('#cf-sf-threshold');
    var sliderVal = wrap.querySelector('#cf-sf-threshold-val');
    slider.addEventListener('input', function () {
      sliderVal.textContent = parseFloat(this.value).toFixed(1);
    });
    slider.addEventListener('change', function () {
      state.customThreshold = parseFloat(this.value);
      state.sensitivity = 'custom';
      saveConfig();
      render(state.container);
    });

    // Show hidden
    var showBtn = wrap.querySelector('#cf-sf-show-hidden');
    if (showBtn) {
      showBtn.addEventListener('click', function () {
        state.showHidden = !state.showHidden;
        render(state.container);
      });
    }
  }

  // ─── Public API ─────────────────────────────────────────────────────
  function init() {
    loadConfig();
  }

  function destroy() {
    if (state.container) state.container.innerHTML = '';
    state.container = null;
  }

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.SmartJobFilter = {
    init: init,
    render: render,
    destroy: destroy,
    filterJobs: function (jobs) {
      var scored = jobs.map(function (job) { return { job: job, score: quickScore(job) }; });
      return filterJobs(scored);
    },
    setSensitivity: function (preset) {
      state.sensitivity = preset;
      saveConfig();
    },
    setThreshold: function (val) {
      state.customThreshold = val;
      state.sensitivity = 'custom';
      saveConfig();
    },
    getConfig: function () {
      return { sensitivity: state.sensitivity, threshold: getThreshold(), autoHideEnabled: state.autoHideEnabled };
    }
  };
})();
