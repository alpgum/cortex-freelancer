/* ===== CORTEX FREELANCER — UPGRADE GATE ===== */
// Shows a blurred overlay when a free user has exhausted daily tool uses.
// Usage: showUpgradeGate('Rate Analyzer')

(function () {
  'use strict';

  var BACKDROP_ID = 'upgrade-gate-backdrop';

  /**
   * Show the upgrade gate overlay.
   * @param {string} toolName — Display name of the tool that triggered the gate
   */
  window.showUpgradeGate = function (toolName) {
    // Prevent duplicates
    if (document.getElementById(BACKDROP_ID)) {
      document.getElementById(BACKDROP_ID).classList.add('open');
      return;
    }

    var backdrop = document.createElement('div');
    backdrop.id = BACKDROP_ID;
    backdrop.className = 'upgrade-gate-backdrop';

    backdrop.innerHTML =
      '<div class="upgrade-gate">' +
        '<button class="upgrade-gate-close" aria-label="Close">&times;</button>' +
        '<div class="upgrade-gate-icon">🔒</div>' +
        '<h2>Daily Limit Reached</h2>' +
        '<span class="upgrade-gate-tool">' + _esc(toolName) + '</span>' +
        '<p>You\u2019ve used 3 free analyses today.<br>Upgrade to Pro for unlimited access.</p>' +
        '<div class="upgrade-gate-price">' +
          '<span class="amount">$29</span>' +
          '<span class="period">/mo</span>' +
        '</div>' +
        '<button class="upgrade-gate-cta">Upgrade to Pro \u2192</button>' +
        '<ul class="upgrade-gate-features">' +
          '<li>Unlimited tool analyses</li>' +
          '<li>Priority AI processing</li>' +
          '<li>Export to PDF &amp; CSV</li>' +
          '<li>Advanced market insights</li>' +
        '</ul>' +
        '<div class="upgrade-gate-footer">Cancel anytime \u00b7 14-day money-back guarantee</div>' +
      '</div>';

    document.body.appendChild(backdrop);

    // Open with next-frame delay for CSS transition
    requestAnimationFrame(function () {
      backdrop.classList.add('open');
    });

    // Close handlers
    backdrop.querySelector('.upgrade-gate-close').addEventListener('click', _close);
    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) _close();
    });

    // CTA handler — navigate to pricing (or hook into payment flow)
    backdrop.querySelector('.upgrade-gate-cta').addEventListener('click', function () {
      window.location.hash = '#pricing';
      _close();
    });
  };

  function _close() {
    var el = document.getElementById(BACKDROP_ID);
    if (!el) return;
    el.classList.remove('open');
    el.addEventListener('transitionend', function () {
      el.remove();
    }, { once: true });
  }

  function _esc(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

})();
