/**
 * Profile Loader — Cortex Freelancer
 * On dashboard load: check for profile, redirect to onboarding if missing.
 * Adds re-analyze button and last-analyzed indicator.
 */
(function () {
  'use strict';

  var PROFILE_KEY = 'cortexProfile';

  function hasProfile() {
    try {
      return !!localStorage.getItem(PROFILE_KEY);
    } catch (e) {
      return false;
    }
  }

  function init() {
    // If no profile, redirect to onboarding
    if (!hasProfile()) {
      // Allow ?skip-profile-check for dev/testing
      if (window.location.search.indexOf('skip-profile-check') === -1) {
        window.location.href = '/app/onboarding.html';
        return;
      }
    }

    // Inject profile status bar into dashboard
    injectProfileBar();
  }

  function injectProfileBar() {
    if (!window.CortexFreelancer || !window.CortexFreelancer.getProfile) return;

    var profile = window.CortexFreelancer.getProfile();
    if (!profile) return;

    var date = profile._parsedAt ? new Date(profile._parsedAt) : null;
    var dateStr = date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown';
    var isDemo = profile._demo;

    // Create profile status element
    var bar = document.createElement('div');
    bar.className = 'profile-status-bar';
    bar.innerHTML =
      '<div class="profile-status-inner">' +
        '<div class="profile-status-left">' +
          '<span class="profile-status-dot' + (isDemo ? ' demo' : '') + '"></span>' +
          '<span class="profile-status-name">' + (profile.name || 'Freelancer') + '</span>' +
          (profile.title ? '<span class="profile-status-title">' + profile.title.substring(0, 40) + '</span>' : '') +
          (isDemo ? '<span class="profile-status-demo">Demo</span>' : '') +
        '</div>' +
        '<div class="profile-status-right">' +
          '<span class="profile-status-date">Analyzed: ' + dateStr + '</span>' +
          '<button class="profile-status-btn" onclick="window.location.href=\'/app/onboarding.html?reanalyze=1\'">Re-analyze</button>' +
        '</div>' +
      '</div>';

    // Insert after greeting or at top of main
    var greeting = document.querySelector('.dash-greeting');
    if (greeting && greeting.parentNode) {
      greeting.parentNode.insertBefore(bar, greeting.nextSibling);
    } else {
      var main = document.querySelector('main') || document.querySelector('.dashboard-main');
      if (main) main.insertBefore(bar, main.firstChild);
    }

    // Inject styles
    var style = document.createElement('style');
    style.textContent =
      '.profile-status-bar{padding:.5rem 1.5rem;margin-bottom:.5rem}' +
      '.profile-status-inner{display:flex;align-items:center;justify-content:space-between;gap:1rem;background:var(--bg2,#111118);border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:.6rem 1rem;font-size:.8rem}' +
      '.profile-status-left{display:flex;align-items:center;gap:.5rem;min-width:0}' +
      '.profile-status-dot{width:8px;height:8px;border-radius:50%;background:var(--green,#00ff88);flex-shrink:0}' +
      '.profile-status-dot.demo{background:var(--yellow,#ffcc00)}' +
      '.profile-status-name{font-weight:700;color:var(--text,#f0f0f0);white-space:nowrap}' +
      '.profile-status-title{color:var(--text3,#666);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.profile-status-demo{background:rgba(255,204,0,.12);color:var(--yellow,#ffcc00);font-size:.65rem;font-weight:700;padding:.1rem .5rem;border-radius:100px}' +
      '.profile-status-right{display:flex;align-items:center;gap:.75rem;flex-shrink:0}' +
      '.profile-status-date{color:var(--text3,#666);white-space:nowrap}' +
      '.profile-status-btn{background:var(--bg3,#1a1a24);border:1px solid rgba(255,255,255,.1);color:var(--text2,#b0b0b0);padding:.3rem .75rem;border-radius:100px;font-size:.75rem;font-weight:600;cursor:pointer;font-family:inherit;transition:all .2s}' +
      '.profile-status-btn:hover{border-color:var(--orange,#ff8844);color:var(--orange,#ff8844)}' +
      '@media(max-width:640px){.profile-status-inner{flex-direction:column;align-items:flex-start;gap:.5rem}.profile-status-title{display:none}}';
    document.head.appendChild(style);
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
