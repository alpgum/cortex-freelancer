/**
 * CF-216: Progressive Auth — Use Tools First, Prompt Signup Later
 * Track guest tool usage, allow 3 free uses, show signup prompt after
 * limit. Preserve guest data in localStorage, migrate on registration.
 *
 * @namespace window.CortexFreelancer.ProgressiveAuth
 */
(function () {
  'use strict';

  var STYLE_ID = 'cortex-progressive-auth-styles';
  var USAGE_KEY = 'cortex_guest_usage';
  var DATA_KEY = 'cortex_guest_data';
  var FREE_LIMIT = 3;

  var state = {
    usageCount: 0,
    promptVisible: false,
    guestData: {}
  };

  // ─── Helpers ───────────────────────────────────────────

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }

  function isLoggedIn() {
    var ns = window.CortexFreelancer || {};
    if (ns.Auth && typeof ns.Auth.getCurrentUser === 'function') {
      return !!ns.Auth.getCurrentUser();
    }
    try {
      return !!localStorage.getItem('cortex_user');
    } catch (e) {
      return false;
    }
  }

  function loadUsage() {
    try {
      return parseInt(localStorage.getItem(USAGE_KEY), 10) || 0;
    } catch (e) {
      return 0;
    }
  }

  function saveUsage(count) {
    try {
      localStorage.setItem(USAGE_KEY, count.toString());
    } catch (e) { /* ignore */ }
  }

  function loadGuestData() {
    try {
      return JSON.parse(localStorage.getItem(DATA_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }

  function saveGuestData(data) {
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify(data));
    } catch (e) { /* ignore */ }
  }

  // ─── CSS ───────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent =
      '.prog-auth-overlay {' +
        'position: fixed; inset: 0; z-index: 9999;' +
        'background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center;' +
        'backdrop-filter: blur(4px); animation: prog-fade-in 0.3s ease;' +
      '}' +
      '@keyframes prog-fade-in { from { opacity: 0; } to { opacity: 1; } }' +
      '.prog-auth-modal {' +
        'background: #1e1e2e; border-radius: 16px; padding: 32px;' +
        'max-width: 420px; width: 90%; text-align: center;' +
        'border: 1px solid #2d2d44; box-shadow: 0 20px 60px rgba(0,0,0,0.5);' +
        'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;' +
        'animation: prog-slide-up 0.3s ease;' +
      '}' +
      '@keyframes prog-slide-up { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }' +
      '.prog-auth-modal h2 { color: #e0e0e0; font-size: 22px; margin: 0 0 8px; }' +
      '.prog-auth-modal .prog-subtitle { color: #888; font-size: 14px; margin: 0 0 20px; }' +
      '.prog-auth-modal .prog-uses-badge {' +
        'display: inline-block; background: rgba(0,255,136,0.1); color: #00ff88;' +
        'padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600;' +
        'margin-bottom: 20px;' +
      '}' +
      '.prog-auth-benefits { text-align: left; margin: 0 0 20px; padding: 0; list-style: none; }' +
      '.prog-auth-benefits li {' +
        'padding: 6px 0; color: #b2bec3; font-size: 14px;' +
      '}' +
      '.prog-auth-benefits li::before {' +
        'content: "\\2713"; color: #00ff88; font-weight: 700; margin-right: 8px;' +
      '}' +
      '.prog-auth-cta {' +
        'width: 100%; padding: 14px; background: #00ff88; color: #0a0a0a;' +
        'border: none; border-radius: 8px; font-size: 16px; font-weight: 700;' +
        'cursor: pointer; font-family: inherit; transition: background 0.2s; margin-bottom: 10px;' +
      '}' +
      '.prog-auth-cta:hover { background: #00e67a; }' +
      '.prog-auth-dismiss {' +
        'background: none; border: none; color: #636e72; font-size: 13px;' +
        'cursor: pointer; font-family: inherit; padding: 8px;' +
      '}' +
      '.prog-auth-dismiss:hover { color: #b2bec3; }' +
      /* Usage indicator bar */
      '.prog-usage-bar {' +
        'position: fixed; bottom: 16px; right: 16px; z-index: 9998;' +
        'background: #1e1e2e; border: 1px solid #2d2d44; border-radius: 10px;' +
        'padding: 10px 16px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;' +
        'font-size: 13px; color: #b2bec3; box-shadow: 0 4px 16px rgba(0,0,0,0.3);' +
      '}' +
      '.prog-usage-bar .bar-track {' +
        'width: 120px; height: 4px; background: #2d2d44; border-radius: 2px; margin-top: 6px;' +
      '}' +
      '.prog-usage-bar .bar-fill {' +
        'height: 100%; background: #00ff88; border-radius: 2px; transition: width 0.3s;' +
      '}';
    document.head.appendChild(s);
  }

  // ─── Signup Prompt ─────────────────────────────────────

  function showSignupPrompt() {
    if (state.promptVisible) return;
    state.promptVisible = true;

    var overlay = document.createElement('div');
    overlay.className = 'prog-auth-overlay';
    overlay.id = 'prog-auth-overlay';
    overlay.innerHTML =
      '<div class="prog-auth-modal">' +
        '<h2>You\'re on a roll!</h2>' +
        '<p class="prog-subtitle">You\'ve used all ' + FREE_LIMIT + ' free tool uses.</p>' +
        '<div class="prog-uses-badge">' + state.usageCount + ' / ' + FREE_LIMIT + ' uses</div>' +
        '<ul class="prog-auth-benefits">' +
          '<li>Unlimited access to all tools</li>' +
          '<li>Save your results and history</li>' +
          '<li>AI-powered proposals and invoices</li>' +
          '<li>Your guest data will be preserved</li>' +
        '</ul>' +
        '<button class="prog-auth-cta" id="prog-signup-btn">Create Free Account</button>' +
        '<button class="prog-auth-dismiss" id="prog-dismiss-btn">Maybe later</button>' +
      '</div>';

    document.body.appendChild(overlay);

    overlay.querySelector('#prog-signup-btn').addEventListener('click', function () {
      dismissPrompt();
      var ns = window.CortexFreelancer || {};
      if (ns.SocialLoginUI && typeof ns.SocialLoginUI.init === 'function') {
        ns.SocialLoginUI.init();
      }
    });

    overlay.querySelector('#prog-dismiss-btn').addEventListener('click', dismissPrompt);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) dismissPrompt();
    });
  }

  function dismissPrompt() {
    state.promptVisible = false;
    var overlay = document.getElementById('prog-auth-overlay');
    if (overlay) overlay.remove();
  }

  // ─── Usage Indicator ───────────────────────────────────

  function updateUsageBar() {
    if (isLoggedIn()) {
      removeUsageBar();
      return;
    }
    var bar = document.getElementById('prog-usage-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'prog-usage-bar';
      bar.id = 'prog-usage-bar';
      document.body.appendChild(bar);
    }
    var remaining = Math.max(0, FREE_LIMIT - state.usageCount);
    var pct = Math.min(100, (state.usageCount / FREE_LIMIT) * 100);
    bar.innerHTML =
      remaining + ' free use' + (remaining !== 1 ? 's' : '') + ' remaining' +
      '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div>';
  }

  function removeUsageBar() {
    var bar = document.getElementById('prog-usage-bar');
    if (bar) bar.remove();
  }

  // ─── Public API ────────────────────────────────────────

  /**
   * Record a tool use. Returns true if allowed, false if limit reached.
   * @param {string} toolName
   * @param {*} [resultData] - Optional data to preserve for migration
   * @returns {boolean}
   */
  function recordToolUse(toolName, resultData) {
    if (isLoggedIn()) return true;

    state.usageCount++;
    saveUsage(state.usageCount);

    // Store guest data
    if (toolName) {
      if (!state.guestData.toolResults) state.guestData.toolResults = [];
      state.guestData.toolResults.push({
        tool: toolName,
        data: resultData || null,
        timestamp: Date.now()
      });
      saveGuestData(state.guestData);
    }

    updateUsageBar();

    if (state.usageCount >= FREE_LIMIT) {
      showSignupPrompt();
      return false;
    }
    return true;
  }

  /**
   * Check if the guest can use another tool.
   * @returns {boolean}
   */
  function canUseTool() {
    if (isLoggedIn()) return true;
    return state.usageCount < FREE_LIMIT;
  }

  /**
   * Get remaining free uses.
   * @returns {number}
   */
  function getRemainingUses() {
    if (isLoggedIn()) return Infinity;
    return Math.max(0, FREE_LIMIT - state.usageCount);
  }

  /**
   * Migrate guest data to the registered user's account.
   * Call this after successful registration/login.
   * @returns {Object} The guest data that was migrated
   */
  function migrateGuestData() {
    var data = loadGuestData();
    // Clear guest tracking
    try {
      localStorage.removeItem(USAGE_KEY);
      localStorage.removeItem(DATA_KEY);
    } catch (e) { /* ignore */ }
    state.usageCount = 0;
    state.guestData = {};
    removeUsageBar();
    dismissPrompt();
    return data;
  }

  /**
   * Reset guest usage (for testing).
   */
  function resetUsage() {
    state.usageCount = 0;
    state.guestData = {};
    try {
      localStorage.removeItem(USAGE_KEY);
      localStorage.removeItem(DATA_KEY);
    } catch (e) { /* ignore */ }
    updateUsageBar();
  }

  // ─── Init / Destroy ────────────────────────────────────

  function init() {
    injectStyles();
    state.usageCount = loadUsage();
    state.guestData = loadGuestData();
    if (!isLoggedIn()) {
      updateUsageBar();
    }
    console.log('[ProgressiveAuth] Module initialized (' + state.usageCount + '/' + FREE_LIMIT + ' uses)');
  }

  function destroy() {
    removeUsageBar();
    dismissPrompt();
  }

  // ─── Namespace Export ──────────────────────────────────

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.ProgressiveAuth = {
    init: init,
    destroy: destroy,
    recordToolUse: recordToolUse,
    canUseTool: canUseTool,
    getRemainingUses: getRemainingUses,
    migrateGuestData: migrateGuestData,
    resetUsage: resetUsage,
    showSignupPrompt: showSignupPrompt
  };
})();
