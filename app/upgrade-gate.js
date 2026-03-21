/* ===== CORTEX FREELANCER — UPGRADE GATE ===== */
// Shows a compelling visual demo when a free user has exhausted daily tool uses.
// Usage: showUpgradeGate('Rate Analyzer')

(function () {
  'use strict';

  var BACKDROP_ID = 'upgrade-gate-backdrop';

  /**
   * Show the upgrade gate overlay with visual Pro demo.
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
        '<div class="upgrade-gate-icon">\u26A1</div>' +
        '<h2>You\u2019re on a roll!</h2>' +
        '<span class="upgrade-gate-tool">' + _esc(toolName) + '</span>' +
        '<p>You\u2019ve hit your free limit \u2014 but your best work shouldn\u2019t wait.</p>' +

        // Visual Pro feature demos
        '<div class="upgrade-gate-demos">' +
          '<div class="upgrade-gate-demo">' +
            '<div class="demo-preview">' +
              '<div class="demo-header"><span class="demo-dot red"></span><span class="demo-dot yellow"></span><span class="demo-dot green"></span></div>' +
              '<div class="demo-content">' +
                '<div class="demo-label">\uD83D\uDD0D Job Scanner</div>' +
                '<div class="demo-item"><span class="demo-match">95%</span> React Developer — $85/hr</div>' +
                '<div class="demo-item"><span class="demo-match">88%</span> Full-Stack App — $4,200</div>' +
                '<div class="demo-item"><span class="demo-match">82%</span> UI/UX Redesign — $3,500</div>' +
              '</div>' +
            '</div>' +
            '<div class="demo-caption">AI finds jobs that match your skills</div>' +
          '</div>' +
          '<div class="upgrade-gate-demo">' +
            '<div class="demo-preview">' +
              '<div class="demo-header"><span class="demo-dot red"></span><span class="demo-dot yellow"></span><span class="demo-dot green"></span></div>' +
              '<div class="demo-content">' +
                '<div class="demo-label">\u270D\uFE0F Auto-Proposal</div>' +
                '<div class="demo-text">Dear Sarah,</div>' +
                '<div class="demo-text">I noticed your project needs a React developer with API experience. In my last 3 projects...</div>' +
                '<div class="demo-cursor"></div>' +
              '</div>' +
            '</div>' +
            '<div class="demo-caption">Personalized proposals in 60 seconds</div>' +
          '</div>' +
        '</div>' +

        '<div class="upgrade-gate-price">' +
          '<span class="amount">$29</span>' +
          '<span class="period">/mo</span>' +
          '<span class="upgrade-gate-price-note">Less than one freelance hour</span>' +
        '</div>' +
        '<button class="upgrade-gate-cta">Unlock Pro \u2192</button>' +
        '<div class="upgrade-gate-footer">7-day money-back guarantee \u00b7 Cancel anytime</div>' +
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

    // CTA handler — navigate to pricing
    backdrop.querySelector('.upgrade-gate-cta').addEventListener('click', function () {
      window.location.href = '/pricing';
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
