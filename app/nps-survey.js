/* ===== NPS SURVEY — Net Promoter Score ===== */
/* [243] NPS 0-10 survey shown on day 7 */

(function() {
  'use strict';

  var FIRST_VISIT_KEY = 'cortex_first_visit';
  var NPS_KEY = 'cortex_nps_completed';
  var TRIGGER_DAYS = 7;

  function init() {
    // Record first visit
    if (!localStorage.getItem(FIRST_VISIT_KEY)) {
      localStorage.setItem(FIRST_VISIT_KEY, new Date().toISOString());
      return;
    }

    // Already completed
    if (localStorage.getItem(NPS_KEY) === 'true') return;

    // Check if 7 days have passed
    var firstVisit = new Date(localStorage.getItem(FIRST_VISIT_KEY));
    var daysSince = Math.floor((Date.now() - firstVisit.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince < TRIGGER_DAYS) return;

    // Show after short delay
    setTimeout(showNPS, 3000);
  }

  function showNPS() {
    if (document.getElementById('cortex-nps-overlay')) return;

    var overlay = document.createElement('div');
    overlay.id = 'cortex-nps-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';

    var modal = document.createElement('div');
    modal.style.cssText = 'background:#111;border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:2rem;max-width:440px;width:90%;text-align:center;color:#f0f0f0;font-family:-apple-system,BlinkMacSystemFont,sans-serif';

    // Build score buttons
    var scoresHTML = '<div style="display:flex;gap:4px;justify-content:center;margin-bottom:.5rem;flex-wrap:wrap">';
    for (var i = 0; i <= 10; i++) {
      var bg = i <= 6 ? '#ff4444' : i <= 8 ? '#ff8844' : '#00ff88';
      scoresHTML += '<button class="nps-score" data-score="' + i + '" style="width:34px;height:34px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:#1a1a1a;color:#f0f0f0;font-weight:700;font-size:.85rem;cursor:pointer;transition:all .15s;font-family:inherit" data-color="' + bg + '">' + i + '</button>';
    }
    scoresHTML += '</div>';

    modal.innerHTML =
      '<h3 style="font-size:1.1rem;font-weight:800;margin-bottom:.5rem">Quick question!</h3>' +
      '<p style="color:#999;font-size:.85rem;margin-bottom:1.5rem">How likely are you to recommend Cortex to a fellow freelancer?</p>' +
      scoresHTML +
      '<div style="display:flex;justify-content:space-between;font-size:.7rem;color:#666;margin-bottom:1.5rem"><span>Not likely</span><span>Very likely</span></div>' +
      '<textarea id="nps-comment" placeholder="What could we improve? (optional)" style="width:100%;background:#1a1a1a;border:1px solid rgba(255,255,255,.1);border-radius:8px;color:#f0f0f0;padding:.75rem;font-size:.85rem;font-family:inherit;resize:vertical;min-height:50px;margin-bottom:1rem"></textarea>' +
      '<div style="display:flex;gap:.5rem">' +
        '<button id="nps-dismiss" style="flex:1;background:transparent;border:1px solid rgba(255,255,255,.1);color:#999;padding:.6rem;border-radius:8px;cursor:pointer;font-family:inherit">Maybe Later</button>' +
        '<button id="nps-submit" style="flex:1;background:#ff8844;border:none;color:#000;padding:.6rem;border-radius:8px;cursor:pointer;font-weight:700;font-family:inherit" disabled>Submit</button>' +
      '</div>';

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    var selectedScore = -1;
    var scoreButtons = modal.querySelectorAll('.nps-score');
    var submitBtn = modal.querySelector('#nps-submit');

    for (var j = 0; j < scoreButtons.length; j++) {
      scoreButtons[j].addEventListener('click', function() {
        selectedScore = parseInt(this.getAttribute('data-score'), 10);
        for (var k = 0; k < scoreButtons.length; k++) {
          scoreButtons[k].style.background = '#1a1a1a';
          scoreButtons[k].style.color = '#f0f0f0';
          scoreButtons[k].style.transform = 'scale(1)';
        }
        this.style.background = this.getAttribute('data-color');
        this.style.color = '#000';
        this.style.transform = 'scale(1.15)';
        submitBtn.disabled = false;
      });
    }

    submitBtn.addEventListener('click', function() {
      if (selectedScore < 0) return;
      var comment = modal.querySelector('#nps-comment').value.trim();

      fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: selectedScore, comment: comment, type: 'nps' })
      }).catch(function() {});

      if (typeof window.gtag === 'function') {
        window.gtag('event', 'nps_submitted', { score: selectedScore });
      }

      localStorage.setItem(NPS_KEY, 'true');
      overlay.remove();
    });

    modal.querySelector('#nps-dismiss').addEventListener('click', function() {
      overlay.remove();
    });

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) overlay.remove();
    });
  }

  // Init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.CortexNPS = { show: showNPS };
})();
