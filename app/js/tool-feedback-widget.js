/**
 * CF-168: Tool Feedback Widget
 * Thumbs up/down + comment widget for every tool page.
 */
(function () {
  'use strict';

  var API_ENDPOINT = '/api/feedback';

  /**
   * Submit feedback to the API.
   * @param {{ toolId: string, rating: "up"|"down", comment: string }} data
   * @returns {Promise<{ success: boolean }>}
   */
  async function submitFeedback(data) {
    if (!data || !data.toolId || !data.rating) {
      return { success: false, reason: 'missing_fields' };
    }

    try {
      var res = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId: data.toolId,
          rating: data.rating,
          comment: (data.comment || '').trim(),
          timestamp: new Date().toISOString(),
          page: window.location.pathname
        })
      });

      if (res.ok) return await res.json();
    } catch (_err) {
      // Silent failure
    }

    return { success: false };
  }

  /**
   * Create and mount the feedback widget into a container.
   * @param {HTMLElement} container
   * @param {{ toolId: string }} opts
   * @returns {{ destroy: function }}
   */
  function mount(container, opts) {
    if (!container || !opts || !opts.toolId) return { destroy: function () {} };

    var toolId = opts.toolId;
    var wrapper = document.createElement('div');
    wrapper.className = 'cortex-feedback-widget';
    wrapper.setAttribute('style',
      'border-top:1px solid #e5e7eb;padding:16px 0;margin-top:24px');

    wrapper.innerHTML =
      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">' +
        '<span style="font-size:14px;color:#374151;font-weight:500">Was this helpful?</span>' +
        '<button class="cortex-fb-up" title="Thumbs up" style="border:1px solid #d1d5db;background:#fff;border-radius:6px;padding:6px 12px;cursor:pointer;font-size:16px">\uD83D\uDC4D</button>' +
        '<button class="cortex-fb-down" title="Thumbs down" style="border:1px solid #d1d5db;background:#fff;border-radius:6px;padding:6px 12px;cursor:pointer;font-size:16px">\uD83D\uDC4E</button>' +
      '</div>' +
      '<div class="cortex-fb-comment-area" style="display:none">' +
        '<textarea class="cortex-fb-comment" placeholder="Tell us more (optional)..." style="width:100%;min-height:60px;border:1px solid #d1d5db;border-radius:6px;padding:8px;font-size:13px;resize:vertical;box-sizing:border-box;margin-bottom:8px"></textarea>' +
        '<button class="cortex-fb-send" style="padding:6px 16px;background:#4F46E5;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600">Send Feedback</button>' +
      '</div>' +
      '<div class="cortex-fb-thanks" style="display:none;color:#059669;font-size:14px;font-weight:500">Thanks for your feedback!</div>';

    var selectedRating = null;
    var upBtn = wrapper.querySelector('.cortex-fb-up');
    var downBtn = wrapper.querySelector('.cortex-fb-down');
    var commentArea = wrapper.querySelector('.cortex-fb-comment-area');
    var thanksMsg = wrapper.querySelector('.cortex-fb-thanks');

    function selectRating(rating) {
      selectedRating = rating;
      upBtn.style.background = rating === 'up' ? '#ecfdf5' : '#fff';
      upBtn.style.borderColor = rating === 'up' ? '#10b981' : '#d1d5db';
      downBtn.style.background = rating === 'down' ? '#fef2f2' : '#fff';
      downBtn.style.borderColor = rating === 'down' ? '#ef4444' : '#d1d5db';
      commentArea.style.display = 'block';
    }

    function showThanks() {
      commentArea.style.display = 'none';
      upBtn.disabled = true;
      downBtn.disabled = true;
      thanksMsg.style.display = 'block';
    }

    upBtn.addEventListener('click', function () { selectRating('up'); });
    downBtn.addEventListener('click', function () { selectRating('down'); });

    wrapper.querySelector('.cortex-fb-send').addEventListener('click', function () {
      if (!selectedRating) return;
      var comment = wrapper.querySelector('.cortex-fb-comment').value;
      submitFeedback({ toolId: toolId, rating: selectedRating, comment: comment });
      showThanks();
    });

    container.appendChild(wrapper);

    return {
      destroy: function () {
        wrapper.remove();
      }
    };
  }

  /**
   * Auto-mount widget to all elements with data-feedback-tool attribute.
   */
  function autoMount() {
    var targets = document.querySelectorAll('[data-feedback-tool]');
    for (var i = 0; i < targets.length; i++) {
      var el = targets[i];
      var toolId = el.getAttribute('data-feedback-tool');
      if (toolId && !el.querySelector('.cortex-feedback-widget')) {
        mount(el, { toolId: toolId });
      }
    }
  }

  // Export to namespace
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.ToolFeedbackWidget = {
    mount: mount,
    autoMount: autoMount,
    submitFeedback: submitFeedback
  };
})();
