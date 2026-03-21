/**
 * Cortex Freelancer — Onboarding Wizard v2
 * 3 screens: (1) Main skill dropdown, (2) Biggest challenge (pick one),
 * (3) Personalized toolkit with auto-open of best tool. Under 30 seconds.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_onboarding';
  var state = { skill: null, challenge: null };

  // ========== TOOL RECOMMENDATIONS MAP ==========
  var TOOL_MAP = {
    pricing:   { name: 'Rate Calculator',   desc: 'Find your ideal hourly rate',        href: '/app/tools/rate-calculator',  icon: '&#128176;', bg: 'linear-gradient(135deg,#ff8844,#ff6622)' },
    scope:     { name: 'Scope Analyzer',     desc: 'Break down project briefs instantly', href: '/app/tools/scope-analyzer',   icon: '&#128203;', bg: 'linear-gradient(135deg,#00ff88,#00cc6a)' },
    clients:   { name: 'Job Scanner',        desc: 'Find matching jobs faster',          href: '/app/tools/job-scanner',      icon: '&#128269;', bg: 'linear-gradient(135deg,#4488ff,#2266dd)' },
    invoicing: { name: 'Invoice Generator',  desc: 'Create professional invoices',       href: '/app/tools/invoice',          icon: '&#128452;', bg: 'linear-gradient(135deg,#4488ff,#2266dd)' },
    proposals: { name: 'Proposal Builder',   desc: 'Write winning proposals faster',     href: '/app/tools/proposal',         icon: '&#128221;', bg: 'linear-gradient(135deg,#aa66ff,#8844dd)' },
    contracts: { name: 'Contract Review',    desc: 'Analyze freelance contracts with AI', href: '/app/tools/contract-review', icon: '&#128220;', bg: 'linear-gradient(135deg,#ffcc00,#ddaa00)' },
    taxes:     { name: 'Tax Estimator',      desc: 'Estimate quarterly tax obligations', href: '/app/tools/tax-estimator',    icon: '&#128178;', bg: 'linear-gradient(135deg,#00cc88,#009966)' },
    payments:  { name: 'Payment Checker',    desc: 'Track and follow up on payments',    href: '/app/tools/payment-checker',  icon: '&#128179;', bg: 'linear-gradient(135deg,#ff8844,#ee6622)' },
    portfolio: { name: 'Portfolio Review',   desc: 'Get feedback on your portfolio',     href: '/app/tools/portfolio-review', icon: '&#127912;', bg: 'linear-gradient(135deg,#ee66aa,#cc4488)' },
    redflags:  { name: 'Client Red Flags',   desc: 'Detect warning signs in job posts',  href: '/app/tools/client-red-flags', icon: '&#128680;', bg: 'linear-gradient(135deg,#ff4466,#cc3355)' },
    email:     { name: 'Email Writer',       desc: 'Draft professional client emails',   href: '/app/tools/email-writer',     icon: '&#9993;',   bg: 'linear-gradient(135deg,#4488ff,#2266dd)' }
  };

  // Challenge -> primary tool + extras
  var CHALLENGE_TOOLS = {
    pricing:   ['pricing', 'scope', 'invoicing'],
    clients:   ['clients', 'proposals', 'redflags'],
    proposals: ['proposals', 'scope', 'email'],
    invoicing: ['invoicing', 'payments', 'pricing'],
    scope:     ['scope', 'contracts', 'pricing'],
    contracts: ['contracts', 'redflags', 'scope']
  };

  // Skill-based bonus tools (added if not already present)
  var SKILL_EXTRAS = {
    developer:           ['scope', 'pricing', 'contracts'],
    designer:            ['portfolio', 'pricing', 'scope'],
    writer:              ['proposals', 'pricing', 'email'],
    marketer:            ['proposals', 'scope', 'clients'],
    consultant:          ['contracts', 'pricing', 'proposals'],
    video:               ['portfolio', 'pricing', 'invoicing'],
    'virtual-assistant': ['invoicing', 'email', 'pricing'],
    other:               ['pricing', 'scope', 'invoicing']
  };

  // ========== STEP NAVIGATION ==========
  window.goToStep = function (num) {
    // If going to step 3, build the toolkit first
    if (num === 3) {
      buildToolkit();
    }

    document.querySelectorAll('.step').forEach(function (el) { el.classList.remove('active'); });
    document.getElementById('step' + num).classList.add('active');

    for (var i = 1; i <= 3; i++) {
      var prog = document.getElementById('prog' + i);
      prog.classList.remove('active', 'done');
      if (i < num) prog.classList.add('done');
      else if (i === num) prog.classList.add('active');
    }
  };

  // ========== STEP 1: SKILL DROPDOWN ==========
  var skillSelect = document.getElementById('skillSelect');
  skillSelect.addEventListener('change', function () {
    state.skill = skillSelect.value;
    document.getElementById('btn1').disabled = !state.skill;
  });

  // ========== STEP 2: CHALLENGE (single select) ==========
  var challengeGrid = document.getElementById('challengeGrid');
  challengeGrid.addEventListener('click', function (e) {
    var card = e.target.closest('.challenge-card');
    if (!card) return;
    challengeGrid.querySelectorAll('.challenge-card').forEach(function (c) { c.classList.remove('selected'); });
    card.classList.add('selected');
    state.challenge = card.dataset.value;
    document.getElementById('btn2').disabled = false;
  });

  // ========== STEP 3: BUILD TOOLKIT ==========
  function buildToolkit() {
    // Save to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      skill: state.skill,
      challenge: state.challenge,
      completedAt: new Date().toISOString()
    }));

    var seen = {};
    var recs = [];

    // Primary challenge tools
    var challengeKeys = CHALLENGE_TOOLS[state.challenge] || CHALLENGE_TOOLS.pricing;
    challengeKeys.forEach(function (key) {
      var tool = TOOL_MAP[key];
      if (tool && !seen[tool.href]) {
        seen[tool.href] = true;
        recs.push(tool);
      }
    });

    // Skill-based extras
    var skillExtras = SKILL_EXTRAS[state.skill] || SKILL_EXTRAS.other;
    skillExtras.forEach(function (key) {
      var tool = TOOL_MAP[key];
      if (tool && !seen[tool.href]) {
        seen[tool.href] = true;
        recs.push(tool);
      }
    });

    // Limit to 5
    recs = recs.slice(0, 5);

    // Render
    var recGrid = document.getElementById('recGrid');
    recGrid.innerHTML = recs.map(function (r, i) {
      var isPrimary = i === 0;
      return '<a class="rec-item' + (isPrimary ? ' primary' : '') + '" href="' + r.href + (isPrimary ? '?sample=1' : '') + '">' +
        '<div class="rec-icon" style="background:' + r.bg + ';color:#000">' + r.icon + '</div>' +
        '<div class="rec-info"><div class="rec-name">' + r.name + (isPrimary ? '<span class="rec-badge">Best match</span>' : '') + '</div><div class="rec-desc">' + r.desc + '</div></div>' +
        '<div class="rec-arrow">&#8594;</div>' +
      '</a>';
    }).join('');

    // Update the "Get Started" button to go to the top recommendation
    var btnFinish = document.getElementById('btnFinish');
    if (recs[0]) {
      btnFinish.href = recs[0].href + '?sample=1';
    }

    // Auto-open notice
    var notice = document.getElementById('autoOpenNotice');
    if (recs[0]) {
      notice.textContent = 'Opening ' + recs[0].name + ' in 5 seconds...';
      var countdown = 5;
      var timer = setInterval(function () {
        countdown--;
        if (countdown <= 0) {
          clearInterval(timer);
          window.location.href = recs[0].href + '?sample=1';
        } else {
          notice.textContent = 'Opening ' + recs[0].name + ' in ' + countdown + ' seconds...';
        }
      }, 1000);

      // Cancel auto-open if user interacts
      recGrid.addEventListener('click', function () { clearInterval(timer); notice.textContent = ''; });
      btnFinish.addEventListener('click', function () { clearInterval(timer); });
    }

    // Analytics
    if (window.dataLayer) {
      window.dataLayer.push({
        event: 'onboarding_complete',
        onboarding_skill: state.skill,
        onboarding_challenge: state.challenge
      });
    }
  }

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
        window.location.href = '/app/tools/';
      }
    } catch (e) { /* ignore */ }
  })();
})();
