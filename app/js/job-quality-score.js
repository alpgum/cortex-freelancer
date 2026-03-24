/**
 * [CF-019] Job Quality Scoring Algorithm
 * Scores jobs 1-10 based on: budget/hour ratio, client history,
 * description clarity, competition level.
 * Exposed as window.CortexFreelancer.JobQualityScore
 */
(function () {
  'use strict';

  // ─── Scoring Weights ────────────────────────────────────────────────
  var WEIGHTS = {
    budgetRatio: 0.25,
    clientHistory: 0.25,
    descriptionClarity: 0.25,
    competition: 0.25
  };

  // ─── Scoring Functions ──────────────────────────────────────────────

  /**
   * Budget/hour ratio score (0-10).
   * For hourly: compares rate to market average.
   * For fixed: estimates hourly rate from budget and scope keywords.
   */
  function scoreBudgetRatio(job) {
    var rate;
    if (job.budgetType === 'hourly') {
      rate = (job.budgetMin + job.budgetMax) / 2;
    } else {
      var avgBudget = (job.budgetMin + job.budgetMax) / 2;
      var estimatedHours = estimateHoursFromDescription(job.description || '', avgBudget);
      rate = estimatedHours > 0 ? avgBudget / estimatedHours : 0;
    }
    // Score: $0-15/hr = 1-3, $15-40 = 3-5, $40-70 = 5-7, $70-100 = 7-9, $100+ = 9-10
    if (rate <= 0) return 1;
    if (rate >= 100) return 10;
    return Math.min(10, Math.max(1, 1 + (rate / 100) * 9));
  }

  function estimateHoursFromDescription(desc, budget) {
    var lower = desc.toLowerCase();
    // Quick heuristics based on scope keywords
    if (/full.?stack|entire|complete platform|from scratch/i.test(lower)) return Math.max(80, budget / 30);
    if (/mvp|prototype|landing page/i.test(lower)) return Math.max(20, budget / 40);
    if (/fix|bug|update|small change|tweak/i.test(lower)) return Math.max(3, budget / 50);
    if (/redesign|migration|refactor/i.test(lower)) return Math.max(40, budget / 35);
    return Math.max(10, budget / 35);
  }

  /**
   * Client history score (0-10).
   * Factors: total spent, hires, rating, payment verified.
   */
  function scoreClientHistory(job) {
    var score = 0;
    // Spending tier (0-3)
    if (job.clientSpent >= 100000) score += 3;
    else if (job.clientSpent >= 50000) score += 2.5;
    else if (job.clientSpent >= 10000) score += 2;
    else if (job.clientSpent >= 1000) score += 1;
    else score += 0.3;

    // Hires (0-2.5)
    if (job.clientHires >= 20) score += 2.5;
    else if (job.clientHires >= 10) score += 2;
    else if (job.clientHires >= 5) score += 1.5;
    else if (job.clientHires >= 1) score += 0.8;
    else score += 0;

    // Rating (0-3)
    if (job.clientRating >= 4.8) score += 3;
    else if (job.clientRating >= 4.5) score += 2.5;
    else if (job.clientRating >= 4.0) score += 2;
    else if (job.clientRating > 0) score += 1;
    else score += 0;

    // Payment verified (0-1.5)
    score += job.paymentVerified ? 1.5 : 0;

    return Math.min(10, Math.max(1, score));
  }

  /**
   * Description clarity score (0-10).
   * Checks length, structure, specificity, and professionalism.
   */
  function scoreDescriptionClarity(job) {
    var desc = job.description || '';
    var score = 0;

    // Length (0-2): too short or too long is bad
    var len = desc.length;
    if (len >= 200 && len <= 2000) score += 2;
    else if (len >= 100 && len <= 3000) score += 1.5;
    else if (len >= 50) score += 1;
    else score += 0.3;

    // Has specific requirements/deliverables (0-2)
    var specifics = 0;
    if (/deliverable|requirement|milestone|deadline|scope/i.test(desc)) specifics++;
    if (/must have|should|need to|required|experience with/i.test(desc)) specifics++;
    if (/\d+\s*(page|screen|feature|endpoint|module)/i.test(desc)) specifics++;
    if (/api|database|authentication|deploy|test/i.test(desc)) specifics++;
    score += Math.min(2, specifics * 0.6);

    // Has clear skills listed (0-2)
    var skillCount = (job.skills || []).length;
    if (skillCount >= 3 && skillCount <= 8) score += 2;
    else if (skillCount >= 1) score += 1;
    else score += 0.3;

    // Professionalism indicators (0-2)
    var profTokens = 0;
    if (!/!!+|URGENT|asap|cheap|lowest price/i.test(desc)) profTokens++;
    if (/please|thank|look forward|team|collaboration/i.test(desc)) profTokens++;
    if (desc.split(/[.!?]/).length >= 3) profTokens++; // Multiple sentences
    score += Math.min(2, profTokens * 0.7);

    // Sentence structure (0-2)
    var sentences = desc.split(/[.!?]+/).filter(function (s) { return s.trim().length > 10; });
    if (sentences.length >= 5) score += 2;
    else if (sentences.length >= 3) score += 1.5;
    else if (sentences.length >= 1) score += 0.8;

    return Math.min(10, Math.max(1, score));
  }

  /**
   * Competition level score (0-10). Lower competition = higher score.
   */
  function scoreCompetition(job) {
    var proposals = job.proposals || 0;
    if (proposals <= 5) return 10;
    if (proposals <= 10) return 8;
    if (proposals <= 15) return 6.5;
    if (proposals <= 25) return 5;
    if (proposals <= 40) return 3;
    if (proposals <= 60) return 2;
    return 1;
  }

  /**
   * Calculate overall quality score for a job.
   * Returns { overall, breakdown, label, color }
   */
  function scoreJob(job, customWeights) {
    var w = customWeights || WEIGHTS;
    var breakdown = {
      budgetRatio: Math.round(scoreBudgetRatio(job) * 10) / 10,
      clientHistory: Math.round(scoreClientHistory(job) * 10) / 10,
      descriptionClarity: Math.round(scoreDescriptionClarity(job) * 10) / 10,
      competition: Math.round(scoreCompetition(job) * 10) / 10
    };

    var overall = (
      breakdown.budgetRatio * w.budgetRatio +
      breakdown.clientHistory * w.clientHistory +
      breakdown.descriptionClarity * w.descriptionClarity +
      breakdown.competition * w.competition
    );
    overall = Math.round(overall * 10) / 10;

    var label, color;
    if (overall >= 8) { label = 'Excellent'; color = '#00d4aa'; }
    else if (overall >= 6) { label = 'Good'; color = '#6c5ce7'; }
    else if (overall >= 4) { label = 'Fair'; color = '#fdcb6e'; }
    else { label = 'Poor'; color = '#e74c3c'; }

    return { overall: overall, breakdown: breakdown, label: label, color: color };
  }

  // ─── Mock Jobs ──────────────────────────────────────────────────────
  var MOCK_JOBS = [
    { id: 'q001', title: 'Full-Stack SaaS Platform Development', budgetType: 'hourly', budgetMin: 60, budgetMax: 90, clientSpent: 350000, clientHires: 58, clientRating: 5.0, paymentVerified: true, proposals: 8, description: 'We are looking for an experienced full-stack developer to join our team and build features for our B2B SaaS platform. The tech stack includes React for the frontend and Python/Django for the backend, deployed on AWS. You should have experience with REST API design, database optimization, and CI/CD pipelines. Deliverables include feature implementation, code reviews, and documentation.', skills: ['React', 'Python', 'Django', 'AWS', 'PostgreSQL'] },
    { id: 'q002', title: 'Fix CSS on Homepage', budgetType: 'fixed', budgetMin: 10, budgetMax: 30, clientSpent: 0, clientHires: 0, clientRating: 0, paymentVerified: false, proposals: 55, description: 'need someone fix css quick', skills: [] },
    { id: 'q003', title: 'Machine Learning Pipeline for E-commerce', budgetType: 'fixed', budgetMin: 8000, budgetMax: 15000, clientSpent: 200000, clientHires: 42, clientRating: 4.9, paymentVerified: true, proposals: 5, description: 'Build a complete ML pipeline for product recommendation engine. This includes data preprocessing with Pandas, model training with PyTorch, API endpoint with FastAPI, and deployment on AWS SageMaker. We need comprehensive testing, documentation, and a 2-week support period after deployment. Must have experience with similar e-commerce recommendation systems.', skills: ['Python', 'PyTorch', 'FastAPI', 'AWS', 'ML'] },
    { id: 'q004', title: 'WordPress Plugin Development', budgetType: 'fixed', budgetMin: 200, budgetMax: 500, clientSpent: 5000, clientHires: 4, clientRating: 4.2, paymentVerified: true, proposals: 28, description: 'We need a custom WordPress plugin for managing event registrations. Features include registration form, payment integration with Stripe, email confirmations, and admin dashboard. Timeline is 2 weeks.', skills: ['WordPress', 'PHP', 'JavaScript', 'Stripe'] },
    { id: 'q005', title: 'iOS/Android App — Fitness Tracker', budgetType: 'fixed', budgetMin: 5000, budgetMax: 10000, clientSpent: 150000, clientHires: 25, clientRating: 4.8, paymentVerified: true, proposals: 18, description: 'Develop a cross-platform fitness tracking application using Flutter. Features include workout logging, progress charts, social sharing, push notifications, and integration with Apple Health and Google Fit. We have Figma designs ready. Looking for a developer who can deliver within 6-8 weeks with regular updates.', skills: ['Flutter', 'Dart', 'Firebase', 'REST API'] },
    { id: 'q006', title: 'URGENT!! Need website ASAP cheapest price!!!', budgetType: 'fixed', budgetMin: 50, budgetMax: 100, clientSpent: 100, clientHires: 0, clientRating: 0, paymentVerified: false, proposals: 68, description: 'URGENT need full ecommerce website with payment shopping cart user accounts admin panel mobile responsive ASAP lowest price wins!!!', skills: ['Web Development'] },
    { id: 'q007', title: 'DevOps Infrastructure Automation', budgetType: 'hourly', budgetMin: 70, budgetMax: 110, clientSpent: 95000, clientHires: 22, clientRating: 4.6, paymentVerified: true, proposals: 7, description: 'Set up comprehensive CI/CD pipeline using GitHub Actions for our monorepo containing 3 microservices. Infrastructure includes AWS ECS, RDS, ElastiCache, and S3. Requirements: automated testing, blue-green deployments, infrastructure as code with Terraform, monitoring with CloudWatch and PagerDuty integration. Must follow security best practices.', skills: ['GitHub Actions', 'Docker', 'AWS', 'Terraform', 'Kubernetes'] },
    { id: 'q008', title: 'Data Entry — Copy Paste Products', budgetType: 'fixed', budgetMin: 20, budgetMax: 50, clientSpent: 50, clientHires: 1, clientRating: 3.0, paymentVerified: false, proposals: 72, description: 'copy product details from one website to another about 200 products', skills: ['Data Entry'] }
  ];

  // ─── State ──────────────────────────────────────────────────────────
  var state = {
    weights: Object.assign({}, WEIGHTS),
    scoredJobs: [],
    container: null
  };

  // ─── Render ─────────────────────────────────────────────────────────
  function render(containerId) {
    var container = typeof containerId === 'string'
      ? document.getElementById(containerId) || document.querySelector(containerId)
      : containerId;
    if (!container) return;
    state.container = container;

    state.scoredJobs = MOCK_JOBS.map(function (job) {
      return { job: job, score: scoreJob(job, state.weights) };
    }).sort(function (a, b) { return b.score.overall - a.score.overall; });

    container.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.style.cssText = 'font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#1a1a2e;color:#e0e0e0;border-radius:12px;padding:24px;max-width:960px;';

    var html = '<h2 style="margin:0 0 20px;color:#00d4aa;font-size:22px;">Job Quality Scoring</h2>';

    // Weight configuration
    html += '<div style="background:#16213e;border-radius:10px;padding:16px;margin-bottom:20px;border:1px solid #2d2d44;">' +
      '<h3 style="margin:0 0 12px;font-size:14px;color:#888;">Scoring Weights</h3>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;">';

    var weightLabels = { budgetRatio: 'Budget/Rate', clientHistory: 'Client History', descriptionClarity: 'Description Quality', competition: 'Competition Level' };
    Object.keys(WEIGHTS).forEach(function (key) {
      var pct = Math.round(state.weights[key] * 100);
      html += '<div>' +
        '<label style="font-size:12px;color:#888;display:flex;justify-content:space-between;margin-bottom:4px;"><span>' + weightLabels[key] + '</span><span id="cf-qs-val-' + key + '">' + pct + '%</span></label>' +
        '<input class="cf-qs-weight" data-key="' + key + '" type="range" min="0" max="100" value="' + pct + '" style="width:100%;accent-color:#00d4aa;">' +
        '</div>';
    });
    html += '</div></div>';

    // Scored jobs
    state.scoredJobs.forEach(function (item) {
      var s = item.score;
      var j = item.job;
      var barWidth = (s.overall / 10) * 100;

      html += '<div style="background:#16213e;border-radius:10px;padding:16px;margin-bottom:12px;border:1px solid #2d2d44;">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">' +
          '<div style="flex:1;min-width:250px;">' +
            '<h3 style="margin:0;font-size:15px;color:#e0e0e0;">' + escapeHtml(j.title) + '</h3>' +
            '<div style="font-size:12px;color:#888;margin-top:4px;">' +
              (j.budgetType === 'hourly' ? '$' + j.budgetMin + '-$' + j.budgetMax + '/hr' : '$' + j.budgetMin.toLocaleString() + '-$' + j.budgetMax.toLocaleString()) +
              ' · ' + j.proposals + ' proposals' +
              ' · Client: $' + (j.clientSpent / 1000).toFixed(0) + 'K spent' +
            '</div>' +
          '</div>' +
          '<div style="text-align:center;min-width:80px;">' +
            '<div style="font-size:28px;font-weight:700;color:' + s.color + ';">' + s.overall.toFixed(1) + '</div>' +
            '<div style="font-size:11px;color:' + s.color + ';font-weight:600;">' + s.label + '</div>' +
          '</div>' +
        '</div>' +
        // Overall bar
        '<div style="margin-top:12px;height:6px;background:#0f3460;border-radius:3px;overflow:hidden;">' +
          '<div style="height:100%;width:' + barWidth + '%;background:' + s.color + ';border-radius:3px;transition:width 0.3s;"></div>' +
        '</div>' +
        // Breakdown
        '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px;">';

      var labels = { budgetRatio: 'Budget/Rate', clientHistory: 'Client', descriptionClarity: 'Description', competition: 'Competition' };
      Object.keys(s.breakdown).forEach(function (key) {
        var val = s.breakdown[key];
        var bColor = val >= 7 ? '#00d4aa' : val >= 5 ? '#6c5ce7' : val >= 3 ? '#fdcb6e' : '#e74c3c';
        html += '<div style="text-align:center;">' +
          '<div style="font-size:11px;color:#666;margin-bottom:4px;">' + labels[key] + '</div>' +
          '<div style="font-size:16px;font-weight:600;color:' + bColor + ';">' + val.toFixed(1) + '</div>' +
          '<div style="height:3px;background:#0f3460;border-radius:2px;margin-top:4px;"><div style="height:100%;width:' + (val * 10) + '%;background:' + bColor + ';border-radius:2px;"></div></div>' +
          '</div>';
      });

      html += '</div></div>';
    });

    wrap.innerHTML = html;
    container.appendChild(wrap);
    bindEvents(wrap);
  }

  function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function bindEvents(wrap) {
    var sliders = wrap.querySelectorAll('.cf-qs-weight');
    for (var i = 0; i < sliders.length; i++) {
      sliders[i].addEventListener('input', function () {
        var key = this.getAttribute('data-key');
        var val = parseInt(this.value, 10);
        state.weights[key] = val / 100;
        var label = wrap.querySelector('#cf-qs-val-' + key);
        if (label) label.textContent = val + '%';
      });
      sliders[i].addEventListener('change', function () {
        // Normalize weights to sum to 1
        var total = 0;
        Object.keys(state.weights).forEach(function (k) { total += state.weights[k]; });
        if (total > 0) {
          Object.keys(state.weights).forEach(function (k) { state.weights[k] = state.weights[k] / total; });
        }
        render(state.container);
      });
    }
  }

  // ─── Public API ─────────────────────────────────────────────────────
  function init() {
    state.weights = Object.assign({}, WEIGHTS);
  }

  function destroy() {
    if (state.container) state.container.innerHTML = '';
    state.container = null;
  }

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.JobQualityScore = {
    init: init,
    render: render,
    destroy: destroy,
    scoreJob: scoreJob,
    setWeights: function (w) { state.weights = Object.assign({}, WEIGHTS, w); },
    getWeights: function () { return Object.assign({}, state.weights); }
  };
})();
