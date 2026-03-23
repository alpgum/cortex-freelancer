/**
 * Cortex Freelancer — Non-Intrusive Email Capture [524]
 *
 * For non-logged-in users: after 2+ tool uses, shows a small
 * dismissible banner suggesting account creation.
 * Not a modal, not blocking. Tracks dismissal in localStorage.
 */
(function () {
  'use strict';

  var DISMISSED_KEY = 'cortex_email_capture_dismissed';
  var MIN_USES = 2;

  function isLoggedIn() {
    try {
      return !!JSON.parse(localStorage.getItem('cortex_firebase_user'));
    } catch (e) {
      return false;
    }
  }

  function isDismissed() {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  }

  function getTotalUses() {
    if (window.cortexToolUsage && typeof window.cortexToolUsage.totalUses === 'function') {
      return window.cortexToolUsage.totalUses();
    }
    // Fallback: read storage directly
    try {
      var usage = JSON.parse(localStorage.getItem('cortex_tool_usage')) || {};
      var total = 0;
      var keys = Object.keys(usage);
      for (var i = 0; i < keys.length; i++) {
        total += (usage[keys[i]].count || 0);
      }
      return total;
    } catch (e) {
      return 0;
    }
  }

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1');
    var el = document.getElementById('email-capture-banner');
    if (el) {
      el.style.transition = 'opacity .3s ease, transform .3s ease';
      el.style.opacity = '0';
      el.style.transform = 'translateX(-50%) translateY(20px)';
      setTimeout(function () { el.remove(); }, 300);
    }

    // Analytics
    if (window.dataLayer) {
      window.dataLayer.push({ event: 'email_capture_dismissed' });
    }
  }

  function injectCSS() {
    if (document.getElementById('ec-banner-style')) return;
    var link = document.createElement('link');
    link.id = 'ec-banner-style';
    link.rel = 'stylesheet';
    link.href = '/app/_includes/email-capture.css';
    document.head.appendChild(link);
  }

  function showBanner() {
    if (document.getElementById('email-capture-banner')) return;
    injectCSS();

    var banner = document.createElement('div');
    banner.id = 'email-capture-banner';
    banner.setAttribute('role', 'complementary');
    banner.setAttribute('aria-label', 'Account creation suggestion');

    banner.innerHTML =
      '<div class="ec-text">' +
        '<div class="ec-title">Save your data across devices</div>' +
        '<div class="ec-subtitle">Create a free account to keep your results and pick up where you left off.</div>' +
      '</div>' +
      '<a class="ec-cta" href="/app/signup.html">Create Free Account</a>' +
      '<button class="ec-dismiss" aria-label="Dismiss">&times;</button>';

    document.body.appendChild(banner);

    banner.querySelector('.ec-dismiss').addEventListener('click', dismiss);

    // Analytics
    if (window.dataLayer) {
      window.dataLayer.push({
        event: 'email_capture_shown',
        tool_uses: getTotalUses()
      });
    }
  }

  function init() {
    // Skip for logged-in users or already dismissed
    if (isLoggedIn() || isDismissed()) return;

    // Check usage threshold
    if (getTotalUses() >= MIN_USES) {
      showBanner();
      return;
    }

    // Listen for future tool uses that cross the threshold
    if (window.dataLayer) {
      var origPush = window.dataLayer.push;
      window.dataLayer.push = function () {
        var result = origPush.apply(window.dataLayer, arguments);
        if (!isLoggedIn() && !isDismissed() && getTotalUses() >= MIN_USES) {
          showBanner();
        }
        return result;
      };
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
