/* ===== COOKIE CONSENT — GDPR BANNER ===== */
(function() {
  'use strict';

  var CONSENT_KEY = 'cortex_cookie_consent';

  function getConsent() {
    return localStorage.getItem(CONSENT_KEY);
  }

  function setConsent(value) {
    localStorage.setItem(CONSENT_KEY, value);
  }

  // [259] Privacy compliance — Consent Mode v2
  function enableGA4() {
    window['ga-disable-G-XXXXXXXXXX'] = false;
    if (typeof gtag === 'function') {
      gtag('consent', 'update', {
        analytics_storage: 'granted',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied'
      });
    }
  }

  function disableGA4() {
    window['ga-disable-G-XXXXXXXXXX'] = true;
    if (typeof gtag === 'function') {
      gtag('consent', 'update', {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied'
      });
    }
  }

  function dismissBanner() {
    var banner = document.getElementById('cookie-consent-banner');
    if (banner) {
      banner.classList.remove('show');
      setTimeout(function() { banner.remove(); }, 400);
    }
  }

  function accept() {
    setConsent('accepted');
    // [259] Record consent timestamp for compliance
    localStorage.setItem('cortex_consent_timestamp', new Date().toISOString());
    enableGA4();
    dismissBanner();
  }

  function decline() {
    setConsent('declined');
    localStorage.setItem('cortex_consent_timestamp', new Date().toISOString());
    disableGA4();
    dismissBanner();
  }

  // [259] Expose for "manage cookies" links on privacy page
  window.CortexCookieConsent = {
    accept: accept,
    decline: decline,
    reset: function() {
      localStorage.removeItem(CONSENT_KEY);
      localStorage.removeItem('cortex_consent_timestamp');
      disableGA4();
      showBanner();
    },
    getStatus: function() { return getConsent(); }
  };

  // Check existing consent
  var consent = getConsent();
  if (consent === 'accepted') {
    enableGA4();
    return;
  }
  if (consent === 'declined') {
    disableGA4();
    return;
  }

  // No consent yet — disable GA4 by default and show banner
  disableGA4();

  function showBanner() {
    var banner = document.createElement('div');
    banner.id = 'cookie-consent-banner';
    banner.className = 'cookie-banner';
    banner.innerHTML =
      '<p>We use cookies to analyze site usage and improve your experience. ' +
      'See our <a href="/privacy">Privacy Policy</a>.</p>' +
      '<div class="cookie-btns">' +
        '<button class="cookie-btn cookie-btn-decline" id="cookie-decline">Decline</button>' +
        '<button class="cookie-btn cookie-btn-accept" id="cookie-accept">Accept</button>' +
      '</div>';
    document.body.appendChild(banner);

    // Trigger animation
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        banner.classList.add('show');
      });
    });

    document.getElementById('cookie-accept').addEventListener('click', accept);
    document.getElementById('cookie-decline').addEventListener('click', decline);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showBanner);
  } else {
    showBanner();
  }
})();
