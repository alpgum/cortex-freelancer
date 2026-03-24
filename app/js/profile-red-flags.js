/**
 * [CF-014] Auto-detect Profile Red Flags
 * Flags issues: empty portfolio, no certifications, short overview,
 * low hours, missing photo, and more.
 * Exposed as window.CortexFreelancer.ProfileRedFlags
 */
(function () {
  'use strict';

  // ─── Red Flag Rules ──────────────────────────────────────────────────

  var RULES = [
    {
      id: 'missing_photo',
      label: 'Missing Profile Photo',
      severity: 'critical',
      category: 'Basics',
      check: function (p) { return !p.hasPhoto; },
      message: 'Profiles without a professional photo get up to 40% fewer invites. Upload a clear, professional headshot.',
      fix: 'Upload a high-quality headshot with good lighting and a neutral background.'
    },
    {
      id: 'short_overview',
      label: 'Overview Too Short',
      severity: 'critical',
      category: 'Content',
      check: function (p) { return (p.overviewLength || 0) < 200; },
      message: function (p) { return 'Your overview is only ' + (p.overviewLength || 0) + ' characters. Top freelancers write 500-1000+ characters covering their expertise, process, and results.'; },
      fix: 'Expand your overview to at least 500 characters. Include: your specialty, years of experience, notable results, and your working process.'
    },
    {
      id: 'no_portfolio',
      label: 'Empty Portfolio',
      severity: 'critical',
      category: 'Portfolio',
      check: function (p) { return (p.portfolioItems || 0) === 0; },
      message: 'You have no portfolio items. Clients heavily rely on portfolio samples to evaluate freelancers.',
      fix: 'Add at least 3-5 portfolio items showcasing your best work. Include descriptions of your role and the results achieved.'
    },
    {
      id: 'low_portfolio',
      label: 'Few Portfolio Items',
      severity: 'warning',
      category: 'Portfolio',
      check: function (p) { return (p.portfolioItems || 0) > 0 && (p.portfolioItems || 0) < 3; },
      message: function (p) { return 'You only have ' + p.portfolioItems + ' portfolio item(s). Aim for at least 5 to show breadth.'; },
      fix: 'Add more portfolio pieces. Include different types of projects to demonstrate versatility.'
    },
    {
      id: 'no_certifications',
      label: 'No Certifications',
      severity: 'warning',
      category: 'Credentials',
      check: function (p) { return (p.certifications || 0) === 0; },
      message: 'You have no certifications. Platform and industry certs boost credibility and search ranking.',
      fix: 'Earn relevant certifications. Start with Upwork skill tests, then consider industry certs (AWS, Google, HubSpot, etc.).'
    },
    {
      id: 'low_hours',
      label: 'Low Logged Hours',
      severity: 'warning',
      category: 'Experience',
      check: function (p) { return (p.totalHours || 0) < 100; },
      message: function (p) { return 'Only ' + (p.totalHours || 0) + ' hours logged. Clients prefer freelancers with substantial platform history.'; },
      fix: 'Take on hourly contracts and use the time tracker consistently. Even small projects add up over time.'
    },
    {
      id: 'no_employment_history',
      label: 'No Employment History',
      severity: 'info',
      category: 'Credentials',
      check: function (p) { return !p.hasEmploymentHistory; },
      message: 'No employment history listed. Adding past roles builds trust, especially for new freelancers.',
      fix: 'Add relevant past positions. Focus on roles that demonstrate skills relevant to your freelance specialty.'
    },
    {
      id: 'no_education',
      label: 'No Education Listed',
      severity: 'info',
      category: 'Credentials',
      check: function (p) { return !p.hasEducation; },
      message: 'No education listed on your profile. Degrees and courses add credibility.',
      fix: 'Add your educational background. Include relevant courses, bootcamps, or degrees.'
    },
    {
      id: 'few_skills',
      label: 'Too Few Skills',
      severity: 'warning',
      category: 'Content',
      check: function (p) { return (p.skillCount || 0) < 3; },
      message: function (p) { return 'Only ' + (p.skillCount || 0) + ' skill(s) listed. This limits your visibility in search results.'; },
      fix: 'Add 5-10 relevant skills. Include both primary skills and complementary technologies.'
    },
    {
      id: 'too_many_skills',
      label: 'Too Many Skills Listed',
      severity: 'info',
      category: 'Content',
      check: function (p) { return (p.skillCount || 0) > 15; },
      message: 'You have ' + 'many skills listed. Too many skills can dilute your positioning and make you look unfocused.',
      fix: 'Trim to your top 8-12 most relevant and marketable skills. Quality over quantity.'
    },
    {
      id: 'low_job_success',
      label: 'Low Job Success Score',
      severity: 'critical',
      category: 'Performance',
      check: function (p) { return p.jobSuccess != null && p.jobSuccess < 85; },
      message: function (p) { return 'Job success score is ' + p.jobSuccess + '%. Scores below 90% significantly reduce invite rates.'; },
      fix: 'Focus on completing contracts successfully. Communicate proactively with clients and avoid abandoning contracts.'
    },
    {
      id: 'no_title',
      label: 'Generic or Missing Title',
      severity: 'warning',
      category: 'Content',
      check: function (p) { return !p.title || p.title.length < 10; },
      message: 'Your profile title is too generic or short. A strong title improves search visibility.',
      fix: 'Write a specific, keyword-rich title. Example: "Senior React Developer | E-commerce & SaaS Specialist" instead of "Web Developer".'
    },
    {
      id: 'rate_too_low',
      label: 'Rate Suspiciously Low',
      severity: 'warning',
      category: 'Pricing',
      check: function (p) { return p.hourlyRate != null && p.hourlyRate < 10; },
      message: function (p) { return 'Your rate of $' + p.hourlyRate + '/hr is very low. Extremely low rates can signal inexperience to quality clients.'; },
      fix: 'Research market rates for your skills and region. Even entry-level freelancers should consider $15+/hr minimum.'
    },
    {
      id: 'no_availability',
      label: 'Availability Not Set',
      severity: 'info',
      category: 'Basics',
      check: function (p) { return !p.availabilitySet; },
      message: 'Your availability badge is not set. Clients filter by availability.',
      fix: 'Set your availability to show when you can take on new work (Full-time, Part-time, or As needed).'
    },
    {
      id: 'stale_profile',
      label: 'Profile Not Recently Updated',
      severity: 'info',
      category: 'Maintenance',
      check: function (p) {
        if (!p.lastUpdated) return true;
        var diff = Date.now() - new Date(p.lastUpdated).getTime();
        return diff > 90 * 24 * 60 * 60 * 1000; // 90 days
      },
      message: 'Your profile hasn\'t been updated in over 90 days. Stale profiles rank lower in search.',
      fix: 'Update your profile regularly: refresh your overview, add recent work, and update your skills list.'
    }
  ];

  // Default mock profile for demonstration
  var DEFAULT_PROFILE = {
    hasPhoto: true,
    overviewLength: 145,
    portfolioItems: 1,
    certifications: 0,
    totalHours: 42,
    hasEmploymentHistory: false,
    hasEducation: true,
    skillCount: 2,
    jobSuccess: 82,
    title: 'Developer',
    hourlyRate: 8,
    availabilitySet: false,
    lastUpdated: '2025-11-10'
  };

  var SEVERITY_CONFIG = {
    critical: { color: '#ff6b6b', bg: '#ff6b6b15', icon: '!', label: 'Critical', weight: 3 },
    warning: { color: '#fdcb6e', bg: '#fdcb6e15', icon: '!', label: 'Warning', weight: 2 },
    info: { color: '#74b9ff', bg: '#74b9ff15', icon: 'i', label: 'Info', weight: 1 }
  };

  var state = {
    container: null,
    profile: null,
    showFixes: {}
  };

  // ─── Styles ──────────────────────────────────────────────────────────

  var STYLES = '\
    .rf-root { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #1a1a2e; color: #e0e0e0; border-radius: 12px; padding: 24px; max-width: 800px; }\
    .rf-title { font-size: 20px; font-weight: 700; margin-bottom: 6px; color: #fff; }\
    .rf-subtitle { font-size: 13px; color: #888; margin-bottom: 20px; }\
    .rf-score-wrap { display: flex; align-items: center; gap: 24px; background: #16213e; border-radius: 10px; padding: 20px; margin-bottom: 20px; border: 1px solid #2d2d44; }\
    .rf-score-circle { position: relative; width: 100px; height: 100px; flex-shrink: 0; }\
    .rf-score-circle svg { transform: rotate(-90deg); }\
    .rf-score-text { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 28px; font-weight: 800; }\
    .rf-score-detail { flex: 1; }\
    .rf-score-breakdown { display: flex; gap: 16px; margin-top: 8px; }\
    .rf-score-badge { display: flex; align-items: center; gap: 6px; font-size: 13px; }\
    .rf-score-dot { width: 10px; height: 10px; border-radius: 50%; }\
    .rf-category { margin-bottom: 16px; }\
    .rf-category-title { font-size: 14px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid #2d2d44; }\
    .rf-flag { background: #16213e; border-radius: 8px; padding: 14px 16px; margin-bottom: 8px; border-left: 3px solid; cursor: pointer; transition: background 0.2s; }\
    .rf-flag:hover { background: #1a2540; }\
    .rf-flag-header { display: flex; align-items: center; justify-content: space-between; }\
    .rf-flag-left { display: flex; align-items: center; gap: 10px; }\
    .rf-flag-icon { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; color: #1a1a2e; }\
    .rf-flag-label { font-size: 14px; font-weight: 600; }\
    .rf-flag-severity { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; padding: 2px 8px; border-radius: 10px; font-weight: 600; }\
    .rf-flag-message { font-size: 13px; color: #aaa; margin-top: 8px; line-height: 1.5; }\
    .rf-flag-fix { margin-top: 10px; padding: 10px 12px; background: #1a1a2e; border-radius: 6px; font-size: 13px; line-height: 1.5; color: #00d4aa; border: 1px dashed #00d4aa33; }\
    .rf-flag-fix strong { color: #00d4aa; }\
    .rf-all-clear { text-align: center; padding: 40px; color: #00d4aa; font-size: 16px; }\
  ';

  // ─── Analysis ────────────────────────────────────────────────────────

  function analyze(profile) {
    var flags = [];
    RULES.forEach(function (rule) {
      if (rule.check(profile)) {
        var msg = typeof rule.message === 'function' ? rule.message(profile) : rule.message;
        flags.push({
          id: rule.id,
          label: rule.label,
          severity: rule.severity,
          category: rule.category,
          message: msg,
          fix: rule.fix
        });
      }
    });
    // Sort by severity weight
    flags.sort(function (a, b) {
      return SEVERITY_CONFIG[b.severity].weight - SEVERITY_CONFIG[a.severity].weight;
    });
    return flags;
  }

  function computeHealthScore(flags) {
    var total = 100;
    flags.forEach(function (f) {
      var w = SEVERITY_CONFIG[f.severity].weight;
      total -= w * 5;
    });
    return Math.max(0, total);
  }

  // ─── Render ──────────────────────────────────────────────────────────

  function render(containerId) {
    var container = typeof containerId === 'string'
      ? document.getElementById(containerId) || document.querySelector(containerId)
      : containerId;
    if (!container) return;
    state.container = container;

    var profile = state.profile || DEFAULT_PROFILE;
    var flags = analyze(profile);
    var score = computeHealthScore(flags);

    var critCount = flags.filter(function (f) { return f.severity === 'critical'; }).length;
    var warnCount = flags.filter(function (f) { return f.severity === 'warning'; }).length;
    var infoCount = flags.filter(function (f) { return f.severity === 'info'; }).length;

    var scoreColor = score >= 80 ? '#00d4aa' : score >= 60 ? '#fdcb6e' : '#ff6b6b';

    var style = document.createElement('style');
    style.textContent = STYLES;

    var html = '<div class="rf-root">';
    html += '<div class="rf-title">Profile Red Flags</div>';
    html += '<div class="rf-subtitle">Automated audit of your profile for issues that may hurt visibility and invite rates</div>';

    // Health score
    var circumference = 2 * Math.PI * 42;
    var dashOffset = circumference - (score / 100) * circumference;
    html += '<div class="rf-score-wrap">';
    html += '<div class="rf-score-circle">';
    html += '<svg width="100" height="100"><circle cx="50" cy="50" r="42" fill="none" stroke="#2d2d44" stroke-width="8"/>';
    html += '<circle cx="50" cy="50" r="42" fill="none" stroke="' + scoreColor + '" stroke-width="8" stroke-linecap="round" stroke-dasharray="' + circumference + '" stroke-dashoffset="' + dashOffset + '"/></svg>';
    html += '<div class="rf-score-text" style="color:' + scoreColor + '">' + score + '</div>';
    html += '</div>';
    html += '<div class="rf-score-detail">';
    html += '<div style="font-size:16px;font-weight:600;color:#fff">Profile Health Score</div>';
    html += '<div style="font-size:13px;color:#888;margin-top:4px">' + flags.length + ' issue' + (flags.length !== 1 ? 's' : '') + ' found across your profile</div>';
    html += '<div class="rf-score-breakdown">';
    html += '<div class="rf-score-badge"><div class="rf-score-dot" style="background:#ff6b6b"></div>' + critCount + ' critical</div>';
    html += '<div class="rf-score-badge"><div class="rf-score-dot" style="background:#fdcb6e"></div>' + warnCount + ' warnings</div>';
    html += '<div class="rf-score-badge"><div class="rf-score-dot" style="background:#74b9ff"></div>' + infoCount + ' info</div>';
    html += '</div></div></div>';

    if (flags.length === 0) {
      html += '<div class="rf-all-clear">&#10003; All clear! No red flags detected on your profile.</div>';
    } else {
      // Group by category
      var categories = {};
      flags.forEach(function (f) {
        if (!categories[f.category]) categories[f.category] = [];
        categories[f.category].push(f);
      });

      Object.keys(categories).forEach(function (cat) {
        html += '<div class="rf-category">';
        html += '<div class="rf-category-title">' + cat + '</div>';
        categories[cat].forEach(function (flag) {
          var sev = SEVERITY_CONFIG[flag.severity];
          var isOpen = state.showFixes[flag.id];
          html += '<div class="rf-flag" style="border-left-color:' + sev.color + '" data-flag="' + flag.id + '">';
          html += '<div class="rf-flag-header">';
          html += '<div class="rf-flag-left">';
          html += '<div class="rf-flag-icon" style="background:' + sev.color + '">' + sev.icon + '</div>';
          html += '<div class="rf-flag-label">' + flag.label + '</div>';
          html += '</div>';
          html += '<div class="rf-flag-severity" style="color:' + sev.color + ';background:' + sev.bg + '">' + sev.label + '</div>';
          html += '</div>';
          html += '<div class="rf-flag-message">' + flag.message + '</div>';
          if (isOpen) {
            html += '<div class="rf-flag-fix"><strong>How to fix:</strong> ' + flag.fix + '</div>';
          }
          html += '</div>';
        });
        html += '</div>';
      });
    }

    html += '</div>';

    container.innerHTML = '';
    container.appendChild(style);
    var div = document.createElement('div');
    div.innerHTML = html;
    container.appendChild(div);

    // Bind click to toggle fix
    container.querySelectorAll('.rf-flag').forEach(function (el) {
      el.addEventListener('click', function () {
        var id = el.getAttribute('data-flag');
        state.showFixes[id] = !state.showFixes[id];
        render(containerId);
      });
    });
  }

  // ─── Public API ──────────────────────────────────────────────────────

  function init(profile) {
    state.profile = profile || DEFAULT_PROFILE;
    state.showFixes = {};
  }

  function destroy() {
    if (state.container) {
      state.container.innerHTML = '';
      state.container = null;
    }
  }

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.ProfileRedFlags = {
    init: init,
    render: render,
    destroy: destroy,
    analyze: function (profile) { return analyze(profile || state.profile || DEFAULT_PROFILE); },
    getScore: function (profile) { return computeHealthScore(analyze(profile || state.profile || DEFAULT_PROFILE)); }
  };
})();
