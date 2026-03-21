/* ===== FEEDBACK MODAL — 1-5 Star Rating ===== */
/* [242] Show feedback modal after 5th tool use */

(function() {
  'use strict';

  var USAGE_KEY = 'cortex_tool_use_count';
  var FEEDBACK_KEY = 'cortex_feedback_given';
  var TRIGGER_COUNT = 5;

  function getUsageCount() {
    return parseInt(localStorage.getItem(USAGE_KEY) || '0', 10);
  }

  function incrementUsage() {
    var count = getUsageCount() + 1;
    localStorage.setItem(USAGE_KEY, String(count));
    return count;
  }

  function hasFeedback() {
    return localStorage.getItem(FEEDBACK_KEY) === 'true';
  }

  function showFeedbackModal() {
    if (hasFeedback()) return;
    if (document.getElementById('cortex-feedback-modal')) return;

    var overlay = document.createElement('div');
    overlay.id = 'cortex-feedback-modal';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';

    var modal = document.createElement('div');
    modal.style.cssText = 'background:#111;border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:2rem;max-width:380px;width:90%;text-align:center;color:#f0f0f0;font-family:-apple-system,BlinkMacSystemFont,sans-serif';

    modal.innerHTML =
      '<h3 style="font-size:1.2rem;font-weight:800;margin-bottom:.5rem">How are you liking Cortex?</h3>' +
      '<p style="color:#999;font-size:.85rem;margin-bottom:1.5rem">Tap a star to rate your experience</p>' +
      '<div id="feedback-stars" style="display:flex;gap:.5rem;justify-content:center;margin-bottom:1.5rem;font-size:2rem;cursor:pointer">' +
        '<span data-star="1">&#9734;</span>' +
        '<span data-star="2">&#9734;</span>' +
        '<span data-star="3">&#9734;</span>' +
        '<span data-star="4">&#9734;</span>' +
        '<span data-star="5">&#9734;</span>' +
      '</div>' +
      '<textarea id="feedback-text" placeholder="Any feedback? (optional)" style="width:100%;background:#1a1a1a;border:1px solid rgba(255,255,255,.1);border-radius:8px;color:#f0f0f0;padding:.75rem;font-size:.85rem;font-family:inherit;resize:vertical;min-height:60px;margin-bottom:1rem"></textarea>' +
      '<div style="display:flex;gap:.5rem">' +
        '<button id="feedback-skip" style="flex:1;background:transparent;border:1px solid rgba(255,255,255,.1);color:#999;padding:.6rem;border-radius:8px;cursor:pointer;font-family:inherit">Skip</button>' +
        '<button id="feedback-submit" style="flex:1;background:#ff8844;border:none;color:#000;padding:.6rem;border-radius:8px;cursor:pointer;font-weight:700;font-family:inherit" disabled>Submit</button>' +
      '</div>';

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    var selectedRating = 0;
    var stars = modal.querySelectorAll('#feedback-stars span');
    var submitBtn = modal.querySelector('#feedback-submit');

    function updateStars(rating) {
      for (var i = 0; i < stars.length; i++) {
        stars[i].innerHTML = i < rating ? '&#9733;' : '&#9734;';
        stars[i].style.color = i < rating ? '#ff8844' : '#666';
      }
    }

    for (var i = 0; i < stars.length; i++) {
      stars[i].addEventListener('click', function() {
        selectedRating = parseInt(this.getAttribute('data-star'), 10);
        updateStars(selectedRating);
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
      });
    }

    submitBtn.addEventListener('click', function() {
      if (!selectedRating) return;
      var text = modal.querySelector('#feedback-text').value.trim();

      // Send to API
      fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: selectedRating, text: text, type: 'star_rating' })
      }).catch(function() {});

      // Track in GA4
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'feedback_submitted', { rating: selectedRating });
      }

      localStorage.setItem(FEEDBACK_KEY, 'true');
      overlay.remove();
    });

    modal.querySelector('#feedback-skip').addEventListener('click', function() {
      localStorage.setItem(FEEDBACK_KEY, 'true');
      overlay.remove();
    });

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) overlay.remove();
    });
  }

  // ── PUBLIC API ──

  window.CortexFeedback = {
    recordToolUse: function() {
      var count = incrementUsage();
      if (count === TRIGGER_COUNT && !hasFeedback()) {
        showFeedbackModal();
      }
    },
    showModal: showFeedbackModal
  };

})();
