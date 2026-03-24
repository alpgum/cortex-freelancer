/**
 * CF-247: Product Hunt Launch Checklist & Assets — tagline generator,
 * description template, screenshot checklist, maker comment template,
 * first-day supporter tracker, launch countdown timer.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_ph_launch';

  /**
   * ProductHuntLaunch — launch preparation toolkit.
   * @constructor
   * @param {object} [options]
   * @param {string} [options.launchDate] - ISO date string for launch day
   */
  function ProductHuntLaunch(options) {
    options = options || {};
    this.launchDate = options.launchDate ? new Date(options.launchDate) : null;
    this._supporters = this._loadSupporters();
  }

  // --- Tagline Generator ---

  var TAGLINE_TEMPLATES = [
    'Your AI-powered Upwork assistant — win more clients, earn more money',
    'Stop guessing on Upwork. Start winning with AI.',
    'The freelancer toolkit that turns Upwork profiles into client magnets',
    'AI analyzes your Upwork profile and tells you exactly how to improve',
    'Upwork success on autopilot — proposals, pricing, and profile optimization',
    'From overlooked to overbooked: AI-powered Upwork growth',
    'The secret weapon top Upwork freelancers don\'t want you to know about',
    'Optimize your Upwork profile in 5 minutes with AI analysis'
  ];

  /**
   * Generate a random tagline or return all options.
   * @param {boolean} [all] - Return all taglines if true
   * @returns {string|string[]}
   */
  ProductHuntLaunch.prototype.generateTagline = function (all) {
    if (all) return TAGLINE_TEMPLATES.slice();
    return TAGLINE_TEMPLATES[Math.floor(Math.random() * TAGLINE_TEMPLATES.length)];
  };

  // --- Description Template ---

  /**
   * Get the Product Hunt description template.
   * @param {object} [vars] - Variables to fill in
   * @param {string} [vars.toolCount]
   * @param {string} [vars.userCount]
   * @returns {string}
   */
  ProductHuntLaunch.prototype.getDescriptionTemplate = function (vars) {
    vars = vars || {};
    var toolCount = vars.toolCount || '[X]';
    var userCount = vars.userCount || '[X]';

    return '## What is Cortex Freelancer?\n\n' +
      'Cortex Freelancer is an AI-powered toolkit that helps Upwork freelancers ' +
      'optimize their profiles, write winning proposals, and land more clients.\n\n' +
      '### Key Features\n' +
      '- **Profile Analyzer** — AI scores your profile and gives actionable tips\n' +
      '- **Proposal Generator** — Write compelling proposals in seconds\n' +
      '- **Rate Calculator** — Find your optimal hourly rate\n' +
      '- **' + toolCount + ' free tools** — No signup required to try\n\n' +
      '### Why we built this\n' +
      'As freelancers ourselves, we know the struggle of standing out on Upwork. ' +
      'We built the tool we wished we had when starting out.\n\n' +
      '### Traction\n' +
      '- ' + userCount + ' freelancers already using our tools\n' +
      '- Average profile score improvement: 23 points\n\n' +
      'Try it free today — no credit card required.';
  };

  // --- Screenshot Checklist ---

  var SCREENSHOT_CHECKLIST = [
    { id: 'hero', label: 'Hero screenshot — main dashboard or landing page (1270x760)', done: false },
    { id: 'profile-analyzer', label: 'Profile Analyzer tool in action with score visible', done: false },
    { id: 'proposal-gen', label: 'Proposal Generator showing before/after comparison', done: false },
    { id: 'rate-calc', label: 'Rate Calculator with market data visualization', done: false },
    { id: 'results', label: 'Results/testimonials — social proof of freelancer improvements', done: false }
  ];

  /**
   * Get screenshot checklist with completion state.
   * @returns {object[]}
   */
  ProductHuntLaunch.prototype.getScreenshotChecklist = function () {
    var saved = this._load();
    var screenshots = saved.screenshots || {};
    return SCREENSHOT_CHECKLIST.map(function (item) {
      return { id: item.id, label: item.label, done: !!screenshots[item.id] };
    });
  };

  /**
   * Mark a screenshot as done.
   * @param {string} id
   */
  ProductHuntLaunch.prototype.markScreenshotDone = function (id) {
    var saved = this._load();
    saved.screenshots = saved.screenshots || {};
    saved.screenshots[id] = true;
    this._save(saved);
  };

  // --- Maker Comment Template ---

  /**
   * Get maker comment template.
   * @param {object} [vars]
   * @param {string} [vars.makerName]
   * @returns {string}
   */
  ProductHuntLaunch.prototype.getMakerCommentTemplate = function (vars) {
    vars = vars || {};
    var name = vars.makerName || '[Your Name]';

    return 'Hey Product Hunt! \ud83d\udc4b\n\n' +
      'I\'m ' + name + ', the maker of Cortex Freelancer.\n\n' +
      'I built this because I spent years freelancing on Upwork and noticed that ' +
      'most freelancers struggle with the same problems: weak profiles, generic proposals, ' +
      'and undercharging for their work.\n\n' +
      'Cortex Freelancer uses AI to analyze your Upwork profile, generate tailored proposals, ' +
      'and help you find the right rate for your skills and market.\n\n' +
      '**What makes us different:**\n' +
      '- Free tools you can try without signing up\n' +
      '- AI trained specifically on Upwork success patterns\n' +
      '- Actionable advice, not just scores\n\n' +
      'I\'d love your feedback! What features would help you the most as a freelancer?\n\n' +
      'Happy to answer any questions \u2014 drop them below! \ud83d\ude80';
  };

  // --- First-Day Supporter Tracker ---

  /**
   * Add a supporter.
   * @param {object} supporter
   * @param {string} supporter.name
   * @param {string} [supporter.phUsername]
   * @param {string} [supporter.action] - 'upvote', 'comment', 'share'
   */
  ProductHuntLaunch.prototype.addSupporter = function (supporter) {
    if (!supporter || !supporter.name) return;
    this._supporters.push({
      name: supporter.name,
      phUsername: supporter.phUsername || '',
      action: supporter.action || 'upvote',
      addedAt: new Date().toISOString()
    });
    this._saveSupporters();
  };

  /**
   * Get all tracked supporters.
   * @returns {object[]}
   */
  ProductHuntLaunch.prototype.getSupporters = function () {
    return this._supporters.slice();
  };

  /**
   * Get supporter stats.
   * @returns {object}
   */
  ProductHuntLaunch.prototype.getSupporterStats = function () {
    var stats = { total: this._supporters.length, upvotes: 0, comments: 0, shares: 0 };
    this._supporters.forEach(function (s) {
      if (s.action === 'upvote') stats.upvotes++;
      else if (s.action === 'comment') stats.comments++;
      else if (s.action === 'share') stats.shares++;
    });
    return stats;
  };

  // --- Launch Countdown Timer ---

  /**
   * Get time remaining until launch.
   * @returns {object} { days, hours, minutes, seconds, launched }
   */
  ProductHuntLaunch.prototype.getCountdown = function () {
    if (!this.launchDate) return { days: 0, hours: 0, minutes: 0, seconds: 0, launched: true };

    var now = new Date();
    var diff = this.launchDate.getTime() - now.getTime();

    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, launched: true };

    return {
      days: Math.floor(diff / 86400000),
      hours: Math.floor((diff % 86400000) / 3600000),
      minutes: Math.floor((diff % 3600000) / 60000),
      seconds: Math.floor((diff % 60000) / 1000),
      launched: false
    };
  };

  /**
   * Render countdown timer HTML.
   * @returns {string}
   */
  ProductHuntLaunch.prototype.renderCountdown = function () {
    var c = this.getCountdown();
    if (c.launched) {
      return '<div class="ph-countdown ph-countdown--live">' +
        '<span class="ph-countdown__label">We are LIVE on Product Hunt!</span>' +
        '</div>';
    }
    return '<div class="ph-countdown">' +
      '<div class="ph-countdown__block"><span class="ph-countdown__num">' + c.days + '</span><span class="ph-countdown__unit">days</span></div>' +
      '<div class="ph-countdown__block"><span class="ph-countdown__num">' + c.hours + '</span><span class="ph-countdown__unit">hrs</span></div>' +
      '<div class="ph-countdown__block"><span class="ph-countdown__num">' + c.minutes + '</span><span class="ph-countdown__unit">min</span></div>' +
      '<div class="ph-countdown__block"><span class="ph-countdown__num">' + c.seconds + '</span><span class="ph-countdown__unit">sec</span></div>' +
      '</div>';
  };

  /**
   * Start a live countdown timer that updates every second.
   * @param {string|HTMLElement} target - Element ID or element
   * @returns {number} Interval ID (use clearInterval to stop)
   */
  ProductHuntLaunch.prototype.startLiveCountdown = function (target) {
    var el = typeof target === 'string' ? document.getElementById(target) : target;
    if (!el) return 0;
    var self = this;
    function tick() { el.innerHTML = self.renderCountdown(); }
    tick();
    return setInterval(tick, 1000);
  };

  // --- Persistence helpers ---

  ProductHuntLaunch.prototype._load = function () {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_e) { return {}; }
  };

  ProductHuntLaunch.prototype._save = function (data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (_e) {}
  };

  ProductHuntLaunch.prototype._loadSupporters = function () {
    var saved = this._load();
    return Array.isArray(saved.supporters) ? saved.supporters : [];
  };

  ProductHuntLaunch.prototype._saveSupporters = function () {
    var saved = this._load();
    saved.supporters = this._supporters;
    this._save(saved);
  };

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.ProductHuntLaunch = ProductHuntLaunch;
})();
