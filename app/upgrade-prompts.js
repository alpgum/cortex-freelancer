/**
 * Cortex Freelancer — Contextual Upgrade Prompts
 * Shows dismissible upgrade prompts to free users:
 *   - After 3rd free tool use in a session
 *   - When accessing Pro-only features
 *   - On the tool hub page
 * Max 1 prompt per session. Dismissed prompts stay dismissed for the session.
 */
(function () {
  'use strict';

  var SESSION_KEY = 'cortex_upgrade_prompt_shown';
  var USAGE_KEY = 'cortex_session_tool_uses';

  // Don't run if already shown this session
  function alreadyShown() {
    try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch (e) { return false; }
  }

  function markShown() {
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (e) { /* ignore */ }
  }

  // Track session tool uses
  function getSessionUses() {
    try { return parseInt(sessionStorage.getItem(USAGE_KEY) || '0', 10); } catch (e) { return 0; }
  }

  function incrementSessionUses() {
    try { sessionStorage.setItem(USAGE_KEY, String(getSessionUses() + 1)); } catch (e) { /* ignore */ }
    return getSessionUses();
  }

  // Check if user is Pro (skip prompts for Pro users)
  function isPro() {
    if (window.cortexIsPro && window.cortexIsPro()) return true;
    try {
      var user = JSON.parse(localStorage.getItem('cortex_user'));
      return user && user.isPro;
    } catch (e) { return false; }
  }

  // ── Prompt UI ──
  function createPrompt(title, message, cta) {
    if (alreadyShown() || isPro()) return;
    markShown();

    var overlay = document.createElement('div');
    overlay.id = 'upgradePromptOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;animation:upFadeIn .3s ease';

    var card = document.createElement('div');
    card.style.cssText = 'background:#111;border:1px solid rgba(255,136,68,.2);border-radius:16px;padding:2rem;max-width:400px;width:90%;text-align:center;position:relative;box-shadow:0 20px 60px rgba(0,0,0,.5)';

    card.innerHTML =
      '<button onclick="this.closest(\'#upgradePromptOverlay\').remove()" style="position:absolute;top:.75rem;right:.75rem;background:none;border:none;color:#666;font-size:1.3rem;cursor:pointer;line-height:1">&times;</button>' +
      '<div style="font-size:2rem;margin-bottom:.75rem">&#9889;</div>' +
      '<h3 style="font-size:1.2rem;font-weight:800;margin-bottom:.5rem;color:#f0f0f0">' + title + '</h3>' +
      '<p style="color:#a0a0a0;font-size:.9rem;line-height:1.6;margin-bottom:1.5rem">' + message + '</p>' +
      '<a href="/pricing" style="display:block;background:linear-gradient(135deg,#ff8844,#ff6622);color:#000;padding:.8rem;border-radius:100px;font-weight:700;font-size:.95rem;text-decoration:none;transition:all .2s">' + (cta || 'Upgrade to Pro') + '</a>' +
      '<button onclick="this.closest(\'#upgradePromptOverlay\').remove()" style="display:block;width:100%;background:none;border:none;color:#666;font-size:.8rem;margin-top:.75rem;cursor:pointer">Maybe later</button>';

    overlay.appendChild(card);

    // Dismiss on backdrop click
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.remove();
    });

    document.body.appendChild(overlay);

    // Add animation keyframe
    if (!document.getElementById('upFadeInStyle')) {
      var style = document.createElement('style');
      style.id = 'upFadeInStyle';
      style.textContent = '@keyframes upFadeIn{from{opacity:0}to{opacity:1}}';
      document.head.appendChild(style);
    }
  }

  // ── Trigger: After 3rd free tool use ──
  window.cortexTrackToolUse = function () {
    if (isPro()) return;
    var uses = incrementSessionUses();
    if (uses === 3) {
      createPrompt(
        'You\'re on a roll!',
        'You\'ve used 3 free tools this session. Upgrade to Pro for unlimited access to all tools, PDF exports, and premium features.',
        'Unlock Unlimited Access'
      );
    }
  };

  // ── Trigger: Pro feature gate ──
  window.cortexShowProFeaturePrompt = function (featureName) {
    createPrompt(
      featureName + ' is a Pro feature',
      'Upgrade to unlock ' + featureName + ' and get unlimited access to all premium tools.',
      'Upgrade to Unlock'
    );
  };

  // ── Trigger: Tool hub page ──
  function checkToolHubPrompt() {
    if (isPro() || alreadyShown()) return;

    var path = window.location.pathname;
    var isToolHub = path === '/app/tools/' || path === '/app/tools' || path === '/app/tools/index.html';
    if (!isToolHub) return;

    // Only show after user has visited a few times
    var visitKey = 'cortex_toolhub_visits';
    var visits = 0;
    try { visits = parseInt(localStorage.getItem(visitKey) || '0', 10); } catch (e) { /* ignore */ }
    visits++;
    try { localStorage.setItem(visitKey, String(visits)); } catch (e) { /* ignore */ }

    if (visits >= 2) {
      setTimeout(function () {
        createPrompt(
          'Unlock all 15+ tools',
          'Free users get limited access. Go Pro to unlock unlimited uses of every tool, PDF exports, and all future tools.',
          'See Pro Plans'
        );
      }, 2000);
    }
  }

  // Init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkToolHubPrompt);
  } else {
    checkToolHubPrompt();
  }
})();
