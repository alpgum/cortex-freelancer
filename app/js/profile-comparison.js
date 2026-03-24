/**
 * [CF-011] Profile Comparison Tool
 * Compare user profile against top 10 profiles in their niche.
 * Side-by-side comparison with actionable improvement items.
 * Exposed as window.CortexFreelancer.ProfileComparison
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_profile_comparison';

  var CATEGORIES = [
    'Web Development', 'Mobile Development', 'UI/UX Design',
    'Data Science', 'DevOps', 'Copywriting', 'Video Editing',
    'Graphic Design', 'SEO', 'Virtual Assistant'
  ];

  // Mock top profiles per category
  var TOP_PROFILES = {
    'Web Development': [
      { name: 'Alex M.', rate: 85, rating: 4.97, jobSuccess: 99, earnings: 450000, hours: 8200, skills: ['React', 'Node.js', 'TypeScript', 'AWS', 'PostgreSQL'], portfolio: 12, certifications: 4, overview: 820 },
      { name: 'Sarah K.', rate: 95, rating: 4.95, jobSuccess: 98, earnings: 380000, hours: 6500, skills: ['Vue.js', 'Python', 'Django', 'Docker', 'Redis'], portfolio: 10, certifications: 3, overview: 650 },
      { name: 'James L.', rate: 110, rating: 4.98, jobSuccess: 100, earnings: 520000, hours: 9100, skills: ['React', 'Go', 'Kubernetes', 'GraphQL', 'MongoDB'], portfolio: 15, certifications: 5, overview: 900 },
      { name: 'Maria R.', rate: 75, rating: 4.93, jobSuccess: 97, earnings: 290000, hours: 5800, skills: ['Angular', 'Java', 'Spring', 'MySQL', 'Jenkins'], portfolio: 8, certifications: 3, overview: 580 },
      { name: 'David C.', rate: 90, rating: 4.96, jobSuccess: 99, earnings: 410000, hours: 7400, skills: ['React', 'Ruby on Rails', 'PostgreSQL', 'Heroku', 'Stripe'], portfolio: 11, certifications: 2, overview: 720 },
      { name: 'Emily T.', rate: 80, rating: 4.94, jobSuccess: 98, earnings: 340000, hours: 6200, skills: ['Next.js', 'TypeScript', 'Tailwind', 'Prisma', 'Vercel'], portfolio: 9, certifications: 3, overview: 680 },
      { name: 'Chris W.', rate: 100, rating: 4.99, jobSuccess: 100, earnings: 490000, hours: 8800, skills: ['React', 'AWS', 'Terraform', 'Node.js', 'DynamoDB'], portfolio: 14, certifications: 6, overview: 850 },
      { name: 'Nina P.', rate: 70, rating: 4.91, jobSuccess: 96, earnings: 250000, hours: 5200, skills: ['WordPress', 'PHP', 'JavaScript', 'MySQL', 'WooCommerce'], portfolio: 7, certifications: 2, overview: 520 },
      { name: 'Ryan F.', rate: 88, rating: 4.95, jobSuccess: 98, earnings: 370000, hours: 6800, skills: ['Svelte', 'Rust', 'WebAssembly', 'PostgreSQL', 'Cloudflare'], portfolio: 10, certifications: 3, overview: 700 },
      { name: 'Lisa H.', rate: 92, rating: 4.96, jobSuccess: 99, earnings: 400000, hours: 7100, skills: ['React', 'Python', 'FastAPI', 'Docker', 'AWS'], portfolio: 11, certifications: 4, overview: 750 }
    ],
    'Mobile Development': [
      { name: 'Tom B.', rate: 90, rating: 4.96, jobSuccess: 99, earnings: 400000, hours: 7500, skills: ['Swift', 'Kotlin', 'React Native', 'Firebase', 'CI/CD'], portfolio: 10, certifications: 3, overview: 700 },
      { name: 'Ana S.', rate: 85, rating: 4.94, jobSuccess: 98, earnings: 350000, hours: 6300, skills: ['Flutter', 'Dart', 'Swift', 'Firebase', 'REST APIs'], portfolio: 9, certifications: 2, overview: 650 },
      { name: 'Mike D.', rate: 100, rating: 4.97, jobSuccess: 99, earnings: 480000, hours: 8500, skills: ['iOS', 'Android', 'SwiftUI', 'Jetpack Compose', 'GraphQL'], portfolio: 13, certifications: 4, overview: 800 },
      { name: 'Jenny L.', rate: 78, rating: 4.92, jobSuccess: 97, earnings: 280000, hours: 5400, skills: ['React Native', 'JavaScript', 'Redux', 'Node.js', 'MongoDB'], portfolio: 7, certifications: 2, overview: 580 },
      { name: 'Carlos M.', rate: 95, rating: 4.95, jobSuccess: 98, earnings: 420000, hours: 7800, skills: ['Kotlin', 'Swift', 'Compose', 'SwiftUI', 'AWS'], portfolio: 11, certifications: 3, overview: 720 },
      { name: 'Priya K.', rate: 82, rating: 4.93, jobSuccess: 97, earnings: 310000, hours: 5900, skills: ['Flutter', 'Firebase', 'Dart', 'REST', 'SQLite'], portfolio: 8, certifications: 2, overview: 600 },
      { name: 'Josh R.', rate: 105, rating: 4.98, jobSuccess: 100, earnings: 510000, hours: 9000, skills: ['iOS', 'Android', 'ARKit', 'ML Kit', 'Kotlin'], portfolio: 14, certifications: 5, overview: 850 },
      { name: 'Sara V.', rate: 88, rating: 4.94, jobSuccess: 98, earnings: 360000, hours: 6600, skills: ['React Native', 'TypeScript', 'Expo', 'Firebase', 'Stripe'], portfolio: 9, certifications: 3, overview: 670 },
      { name: 'Kevin Z.', rate: 92, rating: 4.95, jobSuccess: 99, earnings: 390000, hours: 7100, skills: ['Flutter', 'Kotlin', 'Swift', 'Supabase', 'CI/CD'], portfolio: 10, certifications: 3, overview: 710 },
      { name: 'Olivia N.', rate: 80, rating: 4.93, jobSuccess: 97, earnings: 300000, hours: 5700, skills: ['React Native', 'Expo', 'TypeScript', 'Node.js', 'PostgreSQL'], portfolio: 8, certifications: 2, overview: 620 }
    ]
  };

  // Generate default top profiles for categories not explicitly defined
  function getTopProfiles(category) {
    if (TOP_PROFILES[category]) return TOP_PROFILES[category];
    var names = ['Alex M.', 'Sarah K.', 'James L.', 'Maria R.', 'David C.', 'Emily T.', 'Chris W.', 'Nina P.', 'Ryan F.', 'Lisa H.'];
    return names.map(function (name, i) {
      return {
        name: name, rate: 70 + i * 5, rating: 4.90 + i * 0.01,
        jobSuccess: 95 + Math.min(i, 4), earnings: 200000 + i * 30000,
        hours: 4000 + i * 500, skills: ['Skill A', 'Skill B', 'Skill C', 'Skill D', 'Skill E'],
        portfolio: 5 + i, certifications: 1 + Math.floor(i / 3), overview: 400 + i * 50
      };
    });
  }

  // Default user profile (mock)
  var DEFAULT_USER = {
    name: 'You',
    rate: 45,
    rating: 4.70,
    jobSuccess: 89,
    earnings: 28000,
    hours: 620,
    skills: ['JavaScript', 'React', 'CSS'],
    portfolio: 2,
    certifications: 0,
    overview: 180
  };

  var state = {
    container: null,
    category: 'Web Development',
    userProfile: null
  };

  // ─── Styles ──────────────────────────────────────────────────────────

  var STYLES = '\
    .pc-root { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #1a1a2e; color: #e0e0e0; border-radius: 12px; padding: 24px; max-width: 960px; }\
    .pc-title { font-size: 20px; font-weight: 700; margin-bottom: 16px; color: #fff; }\
    .pc-category-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }\
    .pc-cat-btn { padding: 6px 14px; border-radius: 20px; border: 1px solid #2d2d44; background: transparent; color: #aaa; cursor: pointer; font-size: 13px; transition: all 0.2s; }\
    .pc-cat-btn:hover { border-color: #00d4aa; color: #00d4aa; }\
    .pc-cat-btn.active { background: #00d4aa; color: #1a1a2e; border-color: #00d4aa; font-weight: 600; }\
    .pc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }\
    .pc-card { background: #16213e; border-radius: 10px; padding: 16px; border: 1px solid #2d2d44; }\
    .pc-card-title { font-size: 14px; font-weight: 600; margin-bottom: 12px; color: #fff; }\
    .pc-metric { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #2d2d44; font-size: 13px; }\
    .pc-metric:last-child { border-bottom: none; }\
    .pc-metric-label { color: #888; }\
    .pc-metric-value { font-weight: 600; }\
    .pc-bar-wrap { width: 100%; background: #2d2d44; border-radius: 4px; height: 6px; margin-top: 4px; }\
    .pc-bar { height: 6px; border-radius: 4px; transition: width 0.5s ease; }\
    .pc-you { color: #ff6b6b; }\
    .pc-top { color: #00d4aa; }\
    .pc-comparison-table { width: 100%; border-collapse: collapse; font-size: 13px; }\
    .pc-comparison-table th { text-align: left; padding: 10px 12px; background: #16213e; color: #888; font-weight: 500; border-bottom: 1px solid #2d2d44; }\
    .pc-comparison-table td { padding: 10px 12px; border-bottom: 1px solid #1e1e36; }\
    .pc-comparison-table tr:hover td { background: #16213e; }\
    .pc-rank { display: inline-flex; width: 24px; height: 24px; align-items: center; justify-content: center; border-radius: 50%; background: #2d2d44; font-size: 11px; font-weight: 700; color: #888; }\
    .pc-rank.top3 { background: #00d4aa22; color: #00d4aa; }\
    .pc-highlight { background: #ff6b6b15; }\
    .pc-highlight td { color: #ff6b6b; font-weight: 600; }\
    .pc-actions { margin-top: 20px; }\
    .pc-actions-title { font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #fff; }\
    .pc-action-item { display: flex; gap: 12px; padding: 12px; background: #16213e; border-radius: 8px; margin-bottom: 8px; border-left: 3px solid #ff6b6b; }\
    .pc-action-item.ok { border-left-color: #00d4aa; }\
    .pc-action-icon { font-size: 18px; flex-shrink: 0; }\
    .pc-action-text { font-size: 13px; line-height: 1.5; }\
    .pc-action-text strong { color: #fff; }\
  ';

  // ─── Core Logic ──────────────────────────────────────────────────────

  function computeAverages(profiles) {
    var avg = { rate: 0, rating: 0, jobSuccess: 0, earnings: 0, hours: 0, portfolio: 0, certifications: 0, overview: 0, skillCount: 0 };
    var n = profiles.length;
    profiles.forEach(function (p) {
      avg.rate += p.rate;
      avg.rating += p.rating;
      avg.jobSuccess += p.jobSuccess;
      avg.earnings += p.earnings;
      avg.hours += p.hours;
      avg.portfolio += p.portfolio;
      avg.certifications += p.certifications;
      avg.overview += p.overview;
      avg.skillCount += p.skills.length;
    });
    Object.keys(avg).forEach(function (k) { avg[k] = avg[k] / n; });
    return avg;
  }

  function generateActions(user, avg) {
    var actions = [];

    if (user.rate < avg.rate * 0.7) {
      actions.push({ type: 'warn', text: '<strong>Hourly rate is significantly below average.</strong> Top freelancers in this niche charge $' + Math.round(avg.rate) + '/hr on average. Consider raising your rate to at least $' + Math.round(avg.rate * 0.8) + '/hr.' });
    } else if (user.rate >= avg.rate) {
      actions.push({ type: 'ok', text: '<strong>Rate is competitive.</strong> You\'re at or above the niche average of $' + Math.round(avg.rate) + '/hr.' });
    }

    if (user.portfolio < avg.portfolio * 0.5) {
      actions.push({ type: 'warn', text: '<strong>Portfolio is thin.</strong> Top profiles have ~' + Math.round(avg.portfolio) + ' portfolio items. Add ' + Math.max(1, Math.round(avg.portfolio) - user.portfolio) + ' more case studies.' });
    }

    if (user.certifications < 1) {
      actions.push({ type: 'warn', text: '<strong>No certifications.</strong> Top profiles average ' + avg.certifications.toFixed(1) + ' certifications. Consider earning relevant platform or industry certs.' });
    }

    if (user.overview < 300) {
      actions.push({ type: 'warn', text: '<strong>Profile overview is too short.</strong> Your overview is ' + user.overview + ' chars vs the top average of ' + Math.round(avg.overview) + '. Expand with specific results and expertise areas.' });
    } else if (user.overview >= avg.overview * 0.8) {
      actions.push({ type: 'ok', text: '<strong>Profile overview length is solid.</strong> At ' + user.overview + ' characters, you\'re in line with top profiles.' });
    }

    if (user.skills.length < avg.skillCount * 0.6) {
      actions.push({ type: 'warn', text: '<strong>Add more skills.</strong> Top profiles list ~' + Math.round(avg.skillCount) + ' skills. You have ' + user.skills.length + '. Add complementary technologies.' });
    }

    if (user.jobSuccess < 90) {
      actions.push({ type: 'warn', text: '<strong>Job success score needs attention.</strong> Top profiles maintain ' + Math.round(avg.jobSuccess) + '%+ success. Focus on completing contracts cleanly and avoiding early terminations.' });
    } else {
      actions.push({ type: 'ok', text: '<strong>Job success score is healthy</strong> at ' + user.jobSuccess + '%.' });
    }

    return actions;
  }

  function percentile(userVal, profiles, key) {
    var sorted = profiles.map(function (p) { return p[key]; }).sort(function (a, b) { return a - b; });
    var below = sorted.filter(function (v) { return v <= userVal; }).length;
    return Math.round((below / sorted.length) * 100);
  }

  // ─── Render ──────────────────────────────────────────────────────────

  function render(containerId) {
    var container = typeof containerId === 'string'
      ? document.getElementById(containerId) || document.querySelector(containerId)
      : containerId;
    if (!container) return;
    state.container = container;

    var user = state.userProfile || DEFAULT_USER;
    var topProfiles = getTopProfiles(state.category);
    var avg = computeAverages(topProfiles);
    var actions = generateActions(user, avg);

    var style = document.createElement('style');
    style.textContent = STYLES;

    var html = '<div class="pc-root">';
    html += '<div class="pc-title">Profile Comparison: You vs Top 10</div>';

    // Category selector
    html += '<div class="pc-category-row">';
    CATEGORIES.forEach(function (cat) {
      html += '<button class="pc-cat-btn' + (cat === state.category ? ' active' : '') + '" data-cat="' + cat + '">' + cat + '</button>';
    });
    html += '</div>';

    // Summary cards
    html += '<div class="pc-grid">';

    // Your stats card
    html += '<div class="pc-card">';
    html += '<div class="pc-card-title pc-you">Your Profile</div>';
    html += renderMetric('Hourly Rate', '$' + user.rate + '/hr', user.rate, avg.rate);
    html += renderMetric('Job Success', user.jobSuccess + '%', user.jobSuccess, avg.jobSuccess);
    html += renderMetric('Rating', user.rating.toFixed(2) + '/5', user.rating, 5);
    html += renderMetric('Total Earnings', formatCurrency(user.earnings), user.earnings, avg.earnings);
    html += renderMetric('Hours Worked', user.hours.toLocaleString(), user.hours, avg.hours);
    html += renderMetric('Portfolio Items', user.portfolio, user.portfolio, avg.portfolio);
    html += renderMetric('Certifications', user.certifications, user.certifications, avg.certifications);
    html += '</div>';

    // Top 10 average card
    html += '<div class="pc-card">';
    html += '<div class="pc-card-title pc-top">Top 10 Average</div>';
    html += renderMetric('Hourly Rate', '$' + Math.round(avg.rate) + '/hr', avg.rate, avg.rate);
    html += renderMetric('Job Success', Math.round(avg.jobSuccess) + '%', avg.jobSuccess, avg.jobSuccess);
    html += renderMetric('Rating', avg.rating.toFixed(2) + '/5', avg.rating, 5);
    html += renderMetric('Total Earnings', formatCurrency(Math.round(avg.earnings)), avg.earnings, avg.earnings);
    html += renderMetric('Hours Worked', Math.round(avg.hours).toLocaleString(), avg.hours, avg.hours);
    html += renderMetric('Portfolio Items', Math.round(avg.portfolio), avg.portfolio, avg.portfolio);
    html += renderMetric('Certifications', Math.round(avg.certifications), avg.certifications, avg.certifications);
    html += '</div>';
    html += '</div>';

    // Leaderboard table
    html += '<div class="pc-card" style="margin-bottom:16px">';
    html += '<div class="pc-card-title">Niche Leaderboard</div>';
    html += '<table class="pc-comparison-table">';
    html += '<tr><th>#</th><th>Name</th><th>Rate</th><th>Rating</th><th>Success</th><th>Earnings</th><th>Hours</th></tr>';

    // Insert user into ranking by earnings
    var allProfiles = topProfiles.concat([{
      name: user.name, rate: user.rate, rating: user.rating, jobSuccess: user.jobSuccess,
      earnings: user.earnings, hours: user.hours, skills: user.skills,
      portfolio: user.portfolio, certifications: user.certifications, overview: user.overview,
      isUser: true
    }]);
    allProfiles.sort(function (a, b) { return b.earnings - a.earnings; });

    allProfiles.forEach(function (p, idx) {
      var rank = idx + 1;
      var isUser = p.isUser || false;
      var rankClass = rank <= 3 ? ' top3' : '';
      html += '<tr class="' + (isUser ? 'pc-highlight' : '') + '">';
      html += '<td><span class="pc-rank' + rankClass + '">' + rank + '</span></td>';
      html += '<td>' + p.name + '</td>';
      html += '<td>$' + p.rate + '/hr</td>';
      html += '<td>' + p.rating.toFixed(2) + '</td>';
      html += '<td>' + p.jobSuccess + '%</td>';
      html += '<td>' + formatCurrency(p.earnings) + '</td>';
      html += '<td>' + p.hours.toLocaleString() + '</td>';
      html += '</tr>';
    });
    html += '</table></div>';

    // Action items
    html += '<div class="pc-actions">';
    html += '<div class="pc-actions-title">Action Items</div>';
    actions.forEach(function (a) {
      var icon = a.type === 'ok' ? '&#10003;' : '&#9888;';
      html += '<div class="pc-action-item ' + a.type + '">';
      html += '<div class="pc-action-icon">' + icon + '</div>';
      html += '<div class="pc-action-text">' + a.text + '</div>';
      html += '</div>';
    });
    html += '</div>';

    html += '</div>';

    container.innerHTML = '';
    container.appendChild(style);
    var div = document.createElement('div');
    div.innerHTML = html;
    container.appendChild(div);

    // Bind category buttons
    container.querySelectorAll('.pc-cat-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.category = btn.getAttribute('data-cat');
        render(containerId);
      });
    });
  }

  function renderMetric(label, displayValue, actual, baseline) {
    var pct = baseline > 0 ? Math.min(100, Math.round((actual / baseline) * 100)) : 0;
    var color = pct >= 90 ? '#00d4aa' : pct >= 60 ? '#fdcb6e' : '#ff6b6b';
    return '<div class="pc-metric">' +
      '<span class="pc-metric-label">' + label + '</span>' +
      '<span class="pc-metric-value">' + displayValue + '</span>' +
      '</div>' +
      '<div class="pc-bar-wrap"><div class="pc-bar" style="width:' + pct + '%;background:' + color + '"></div></div>';
  }

  function formatCurrency(val) {
    if (val >= 1000000) return '$' + (val / 1000000).toFixed(1) + 'M';
    if (val >= 1000) return '$' + (val / 1000).toFixed(val >= 100000 ? 0 : 1) + 'k';
    return '$' + val;
  }

  // ─── Public API ──────────────────────────────────────────────────────

  function init(userProfile) {
    state.userProfile = userProfile || DEFAULT_USER;
    state.category = 'Web Development';
  }

  function destroy() {
    if (state.container) {
      state.container.innerHTML = '';
      state.container = null;
    }
  }

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.ProfileComparison = {
    init: init,
    render: render,
    destroy: destroy,
    setCategory: function (cat) { state.category = cat; },
    setUserProfile: function (profile) { state.userProfile = profile; }
  };
})();
