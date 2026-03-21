/**
 * Cortex Freelancer — 3-Step Onboarding Wizard
 * Saves user selections to localStorage and recommends tools.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_onboarding';
  var state = { role: null, platforms: [], challenges: [] };

  // ========== TOOL RECOMMENDATIONS MAP ==========
  var TOOL_MAP = {
    pricing:   { name: 'Rate Calculator',     desc: 'Find your ideal hourly rate',          href: '/app/tools/rate-calculator',  icon: '&#128176;', bg: 'linear-gradient(135deg,#ff8844,#ff6622)' },
    scope:     { name: 'Scope Analyzer',       desc: 'Break down project briefs instantly',  href: '/app/tools/scope-analyzer',   icon: '&#128203;', bg: 'linear-gradient(135deg,#00ff88,#00cc6a)' },
    clients:   { name: 'Client Red Flags',     desc: 'Spot problematic clients early',       href: '/app/tools/client-red-flags', icon: '&#9888;&#65039;',  bg: 'linear-gradient(135deg,#ff4466,#cc3355)' },
    invoicing: { name: 'Invoice Generator',    desc: 'Create professional invoices',         href: '/app/tools/invoice',          icon: '&#128452;', bg: 'linear-gradient(135deg,#4488ff,#2266dd)' },
    proposals: { name: 'Proposal Builder',     desc: 'Write winning proposals faster',       href: '/app/tools/proposal',         icon: '&#128221;', bg: 'linear-gradient(135deg,#aa66ff,#8844dd)' },
    contracts: { name: 'Contract Review',      desc: 'Analyze freelance contracts',          href: '/app/tools/contract-review',  icon: '&#128220;', bg: 'linear-gradient(135deg,#ffcc00,#ddaa00)' },
    taxes:     { name: 'Tax Estimator',        desc: 'Estimate quarterly tax obligations',   href: '/app/tools/tax-estimator',    icon: '&#128178;', bg: 'linear-gradient(135deg,#00cc88,#009966)' },
    payments:  { name: 'Payment Checker',      desc: 'Track and follow up on payments',      href: '/app/tools/payment-checker',  icon: '&#128179;', bg: 'linear-gradient(135deg,#ff8844,#ee6622)' },
    portfolio: { name: 'Portfolio Review',     desc: 'Get feedback on your portfolio',       href: '/app/tools/portfolio-review', icon: '&#127912;', bg: 'linear-gradient(135deg,#ee66aa,#cc4488)' },
    redflags:  { name: 'Client Red Flags',     desc: 'Detect warning signs in job posts',    href: '/app/tools/client-red-flags', icon: '&#128680;', bg: 'linear-gradient(135deg,#ff4466,#cc3355)' }
  };

  // Role-based bonus recommendations
  var ROLE_TOOLS = {
    developer: ['scope', 'pricing', 'contracts'],
    designer:  ['portfolio', 'scope', 'pricing'],
    writer:    ['proposals', 'pricing', 'invoicing'],
    marketer:  ['scope', 'proposals', 'pricing'],
    consultant:['contracts', 'pricing', 'proposals'],
    other:     ['pricing', 'scope', 'invoicing']
  };

  // ========== STEP NAVIGATION ==========
  window.goToStep = function (num) {
    document.querySelectorAll('.step').forEach(function (el) { el.classList.remove('active'); });
    document.getElementById('step' + num).classList.add('active');

    // Update progress bar
    for (var i = 1; i <= 3; i++) {
      var prog = document.getElementById('prog' + i);
      prog.classList.remove('active', 'done');
      if (i < num) prog.classList.add('done');
      else if (i === num) prog.classList.add('active');
    }
  };

  // ========== STEP 1: ROLE (single select) ==========
  var roleGrid = document.getElementById('roleGrid');
  roleGrid.addEventListener('click', function (e) {
    var card = e.target.closest('.option-card');
    if (!card) return;
    roleGrid.querySelectorAll('.option-card').forEach(function (c) { c.classList.remove('selected'); });
    card.classList.add('selected');
    state.role = card.dataset.value;
    document.getElementById('btn1').disabled = false;
  });

  // ========== STEP 2: PLATFORMS (multi select) ==========
  var platformGrid = document.getElementById('platformGrid');
  platformGrid.addEventListener('click', function (e) {
    var card = e.target.closest('.option-card');
    if (!card) return;
    card.classList.toggle('selected');
    state.platforms = Array.from(platformGrid.querySelectorAll('.option-card.selected')).map(function (c) { return c.dataset.value; });
    document.getElementById('btn2').disabled = state.platforms.length === 0;
  });

  // ========== STEP 3: CHALLENGES (multi select chips) ==========
  var challengeGrid = document.getElementById('challengeGrid');
  challengeGrid.addEventListener('click', function (e) {
    var chip = e.target.closest('.challenge-chip');
    if (!chip) return;
    chip.classList.toggle('selected');
    state.challenges = Array.from(challengeGrid.querySelectorAll('.challenge-chip.selected')).map(function (c) { return c.dataset.value; });
    document.getElementById('btn3').disabled = state.challenges.length === 0;
  });

  // ========== FINISH ==========
  window.finishOnboarding = function () {
    // Save to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      role: state.role,
      platforms: state.platforms,
      challenges: state.challenges,
      completedAt: new Date().toISOString()
    }));

    // Build recommendations: challenges first, then role-based fallbacks
    var seen = {};
    var recs = [];

    // Challenge-based
    state.challenges.forEach(function (ch) {
      var tool = TOOL_MAP[ch];
      if (tool && !seen[tool.href]) {
        seen[tool.href] = true;
        recs.push(tool);
      }
    });

    // Role-based extras
    var roleExtras = ROLE_TOOLS[state.role] || ROLE_TOOLS.other;
    roleExtras.forEach(function (key) {
      var tool = TOOL_MAP[key];
      if (tool && !seen[tool.href]) {
        seen[tool.href] = true;
        recs.push(tool);
      }
    });

    // Limit to 5
    recs = recs.slice(0, 5);

    // Render recommendations
    var recGrid = document.getElementById('recGrid');
    recGrid.innerHTML = recs.map(function (r) {
      return '<a class="rec-item" href="' + r.href + '">' +
        '<div class="rec-icon" style="background:' + r.bg + ';color:#000">' + r.icon + '</div>' +
        '<div class="rec-info"><div class="rec-name">' + r.name + '</div><div class="rec-desc">' + r.desc + '</div></div>' +
        '<div class="rec-arrow">&#8594;</div>' +
      '</a>';
    }).join('');

    // Show results
    document.querySelectorAll('.step').forEach(function (el) { el.classList.remove('active'); });
    document.getElementById('stepResults').classList.add('active');
    document.querySelectorAll('.progress-step').forEach(function (p) { p.classList.add('done'); });

    // Quick-start actions
    var quickActions = [
      { icon: '&#128176;', label: 'Check your rate', desc: 'Are you undercharging?', href: '/app/tools/rate-calculator' },
      { icon: '&#128221;', label: 'Write a proposal', desc: 'Generate one in 60s', href: '/app/tools/proposal' },
      { icon: '&#128196;', label: 'Create an invoice', desc: 'Professional & branded', href: '/app/tools/invoice' },
      { icon: '&#128172;', label: 'Chat with AI', desc: 'Ask anything freelance', href: '/app/chat' }
    ];
    var qsGrid = document.getElementById('quickStartGrid');
    if (qsGrid) {
      qsGrid.innerHTML = quickActions.map(function (a) {
        return '<a class="qs-card" href="' + a.href + '">' +
          '<span class="qs-icon">' + a.icon + '</span>' +
          '<div class="qs-info"><div class="qs-label">' + a.label + '</div><div class="qs-desc">' + a.desc + '</div></div>' +
        '</a>';
      }).join('');
    }

    // Analytics
    if (window.dataLayer) {
      window.dataLayer.push({
        event: 'onboarding_complete',
        onboarding_role: state.role,
        onboarding_platforms: state.platforms.join(','),
        onboarding_challenges: state.challenges.join(',')
      });
    }
  };

  // ========== SKIP ==========
  window.skipOnboarding = function () {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ skipped: true, skippedAt: new Date().toISOString() }));
    window.location.href = '/app/tools/';
  };

  // ========== AUTO-REDIRECT IF ALREADY COMPLETED ==========
  (function () {
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved && (saved.completedAt || saved.skipped)) {
        // Already onboarded — redirect to tools
        window.location.href = '/app/tools/';
      }
    } catch (e) { /* ignore */ }
  })();
})();
