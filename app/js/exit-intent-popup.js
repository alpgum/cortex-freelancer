/**
 * CF-228: Exit-Intent Popup with Lead Magnet
 * Shows popup on mouse-leave offering a free Freelancer Rate Guide.
 * Captures email and stores in waitlist. Throttled to once per session.
 *
 * @namespace window.CortexFreelancer.ExitIntentPopup
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var STYLE_ID = 'cortex-exit-intent-styles';
  var OVERLAY_ID = 'cortex-exit-intent-overlay';
  var SESSION_KEY = 'cf_exit_popup_shown';
  var WAITLIST_KEY = 'cf_waitlist_emails';

  var state = {
    shown: false,
    initialized: false,
    onSubmit: null
  };

  // ─── Helpers ───────────────────────────────────────────

  function esc(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function alreadyShownThisSession() {
    try {
      return sessionStorage.getItem(SESSION_KEY) === '1';
    } catch (e) {
      return state.shown;
    }
  }

  function markShown() {
    state.shown = true;
    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch (e) { /* noop */ }
  }

  function getWaitlist() {
    try {
      return JSON.parse(localStorage.getItem(WAITLIST_KEY) || '[]');
    } catch (e) {
      return [];
    }
  }

  function addToWaitlist(email) {
    var list = getWaitlist();
    var entry = { email: email, source: 'exit_intent', timestamp: new Date().toISOString() };
    list.push(entry);
    try {
      localStorage.setItem(WAITLIST_KEY, JSON.stringify(list));
    } catch (e) { /* noop */ }
    return entry;
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // ─── Styles ────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      '#' + OVERLAY_ID + ' {',
      '  position: fixed; top: 0; left: 0; width: 100%; height: 100%;',
      '  background: rgba(0,0,0,0.6); z-index: 10000;',
      '  display: flex; align-items: center; justify-content: center;',
      '  opacity: 0; transition: opacity 0.3s ease;',
      '}',
      '#' + OVERLAY_ID + '.visible { opacity: 1; }',
      '.cf-exit-popup {',
      '  background: #fff; border-radius: 12px; padding: 40px;',
      '  max-width: 480px; width: 90%; text-align: center;',
      '  box-shadow: 0 20px 60px rgba(0,0,0,0.3);',
      '  transform: translateY(20px); transition: transform 0.3s ease;',
      '  position: relative;',
      '}',
      '#' + OVERLAY_ID + '.visible .cf-exit-popup { transform: translateY(0); }',
      '.cf-exit-popup-close {',
      '  position: absolute; top: 12px; right: 16px;',
      '  background: none; border: none; font-size: 24px;',
      '  cursor: pointer; color: #999; line-height: 1;',
      '}',
      '.cf-exit-popup-close:hover { color: #333; }',
      '.cf-exit-popup h2 {',
      '  margin: 0 0 8px; font-size: 24px; color: #1a1a2e;',
      '}',
      '.cf-exit-popup p {',
      '  margin: 0 0 24px; color: #666; font-size: 15px; line-height: 1.5;',
      '}',
      '.cf-exit-popup-form { display: flex; gap: 8px; }',
      '.cf-exit-popup-form input {',
      '  flex: 1; padding: 12px 16px; border: 2px solid #e0e0e0;',
      '  border-radius: 8px; font-size: 15px; outline: none;',
      '}',
      '.cf-exit-popup-form input:focus { border-color: #6c63ff; }',
      '.cf-exit-popup-form button {',
      '  padding: 12px 24px; background: #6c63ff; color: #fff;',
      '  border: none; border-radius: 8px; font-size: 15px;',
      '  font-weight: 600; cursor: pointer; white-space: nowrap;',
      '}',
      '.cf-exit-popup-form button:hover { background: #5a52d5; }',
      '.cf-exit-popup-error {',
      '  color: #e74c3c; font-size: 13px; margin-top: 8px;',
      '}',
      '.cf-exit-popup-success {',
      '  color: #27ae60; font-size: 15px; margin-top: 8px;',
      '}',
      '@media (max-width: 500px) {',
      '  .cf-exit-popup-form { flex-direction: column; }',
      '  .cf-exit-popup { padding: 28px 20px; }',
      '}'
    ].join('\n');
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ─── Render ────────────────────────────────────────────

  function showPopup() {
    if (state.shown || alreadyShownThisSession()) return;
    markShown();
    injectStyles();

    var overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.innerHTML = [
      '<div class="cf-exit-popup">',
      '  <button class="cf-exit-popup-close" aria-label="Close">&times;</button>',
      '  <h2>Wait — before you go!</h2>',
      '  <p>Get our <strong>Free Freelancer Rate Guide</strong> and learn how top freelancers price their services to earn 2-3x more.</p>',
      '  <div class="cf-exit-popup-form">',
      '    <input type="email" placeholder="Enter your email" aria-label="Email address" />',
      '    <button type="button">Get Free Guide</button>',
      '  </div>',
      '  <div class="cf-exit-popup-msg"></div>',
      '</div>'
    ].join('\n');

    document.body.appendChild(overlay);
    requestAnimationFrame(function () {
      overlay.classList.add('visible');
    });

    // Close handlers
    overlay.querySelector('.cf-exit-popup-close').addEventListener('click', closePopup);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closePopup();
    });

    // Submit
    var btn = overlay.querySelector('.cf-exit-popup-form button');
    var input = overlay.querySelector('.cf-exit-popup-form input');
    var msgEl = overlay.querySelector('.cf-exit-popup-msg');

    btn.addEventListener('click', function () {
      var email = (input.value || '').trim();
      if (!isValidEmail(email)) {
        msgEl.className = 'cf-exit-popup-msg cf-exit-popup-error';
        msgEl.textContent = 'Please enter a valid email address.';
        return;
      }
      var entry = addToWaitlist(email);
      if (typeof state.onSubmit === 'function') {
        state.onSubmit(entry);
      }
      msgEl.className = 'cf-exit-popup-msg cf-exit-popup-success';
      msgEl.textContent = 'Check your inbox — the guide is on its way!';
      btn.disabled = true;
      input.disabled = true;
      setTimeout(closePopup, 2500);
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') btn.click();
    });
  }

  function closePopup() {
    var overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;
    overlay.classList.remove('visible');
    setTimeout(function () {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 300);
  }

  // ─── Mouse-leave listener ─────────────────────────────

  function onMouseOut(e) {
    if (e.clientY <= 0 && !state.shown && !alreadyShownThisSession()) {
      showPopup();
    }
  }

  // ─── Public API ────────────────────────────────────────

  function init(options) {
    if (state.initialized) return;
    state.initialized = true;
    options = options || {};
    state.onSubmit = options.onSubmit || null;
    document.addEventListener('mouseout', onMouseOut);
  }

  function destroy() {
    document.removeEventListener('mouseout', onMouseOut);
    closePopup();
    state.initialized = false;
    state.shown = false;
  }

  window.CortexFreelancer.ExitIntentPopup = {
    init: init,
    destroy: destroy,
    show: showPopup,
    close: closePopup,
    getWaitlist: getWaitlist
  };
})();
