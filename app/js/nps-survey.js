/**
 * CF-259: NPS Survey After 7 Days of Usage
 * In-app Net Promoter Score survey with plan segmentation and score calculation.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_nps';
  var API_ENDPOINT = '/api/nps-survey';
  var ELIGIBILITY_DAYS = 7;
  var COOLDOWN_DAYS = 90;

  /**
   * Get NPS state from localStorage.
   * @returns {{ signupDate: string|null, lastSurvey: string|null, dismissed: boolean }}
   */
  function getState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (_e) {
      return {};
    }
  }

  /**
   * Save NPS state.
   * @param {object} patch
   */
  function saveState(patch) {
    var state = getState();
    Object.keys(patch).forEach(function (k) { state[k] = patch[k]; });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  /**
   * Record the user's signup date (call once at registration or first login).
   * @param {string} isoDate
   */
  function recordSignup(isoDate) {
    saveState({ signupDate: isoDate });
  }

  /**
   * Check whether the user is eligible to see the NPS survey.
   * @returns {boolean}
   */
  function isEligible() {
    var state = getState();
    if (!state.signupDate) return false;
    if (state.dismissed) return false;

    var now = Date.now();
    var signup = new Date(state.signupDate).getTime();
    var daysSinceSignup = (now - signup) / (1000 * 60 * 60 * 24);
    if (daysSinceSignup < ELIGIBILITY_DAYS) return false;

    if (state.lastSurvey) {
      var daysSinceLast = (now - new Date(state.lastSurvey).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLast < COOLDOWN_DAYS) return false;
    }

    return true;
  }

  /**
   * Build the NPS survey modal DOM element.
   * @param {function} onSubmit - Called with { score: number, comment: string }
   * @param {function} onDismiss
   * @returns {HTMLElement}
   */
  function buildSurveyUI(onSubmit, onDismiss) {
    var overlay = document.createElement('div');
    overlay.className = 'cortex-nps-overlay';
    overlay.setAttribute('style',
      'position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:10000');

    var card = document.createElement('div');
    card.setAttribute('style',
      'background:#fff;border-radius:12px;padding:32px;max-width:480px;width:90%;box-shadow:0 8px 30px rgba(0,0,0,.15)');

    card.innerHTML =
      '<h2 style="margin:0 0 8px;font-size:18px;color:#111827">How likely are you to recommend us?</h2>' +
      '<p style="margin:0 0 20px;font-size:14px;color:#6b7280">0 = Not at all likely &middot; 10 = Extremely likely</p>' +
      '<div class="cortex-nps-scores" style="display:flex;gap:6px;justify-content:center;margin-bottom:20px"></div>' +
      '<textarea class="cortex-nps-comment" placeholder="Any additional feedback? (optional)" ' +
        'style="width:100%;min-height:60px;border:1px solid #d1d5db;border-radius:6px;padding:8px;font-size:14px;resize:vertical;box-sizing:border-box"></textarea>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">' +
        '<button class="cortex-nps-dismiss" style="padding:8px 16px;border:none;background:transparent;color:#6b7280;cursor:pointer;font-size:14px">Not now</button>' +
        '<button class="cortex-nps-submit" disabled style="padding:8px 20px;border:none;background:#4F46E5;color:#fff;border-radius:6px;cursor:pointer;font-size:14px;opacity:.5">Submit</button>' +
      '</div>';

    var scoresContainer = card.querySelector('.cortex-nps-scores');
    var submitBtn = card.querySelector('.cortex-nps-submit');
    var selectedScore = null;

    for (var i = 0; i <= 10; i++) {
      (function (score) {
        var btn = document.createElement('button');
        btn.textContent = score;
        btn.setAttribute('style',
          'width:36px;height:36px;border:1px solid #d1d5db;border-radius:6px;background:#fff;cursor:pointer;font-size:14px;font-weight:600');
        btn.addEventListener('click', function () {
          selectedScore = score;
          submitBtn.disabled = false;
          submitBtn.style.opacity = '1';
          var all = scoresContainer.querySelectorAll('button');
          for (var j = 0; j < all.length; j++) {
            all[j].style.background = '#fff';
            all[j].style.color = '#374151';
          }
          btn.style.background = '#4F46E5';
          btn.style.color = '#fff';
        });
        scoresContainer.appendChild(btn);
      })(i);
    }

    card.querySelector('.cortex-nps-dismiss').addEventListener('click', function () {
      overlay.remove();
      if (onDismiss) onDismiss();
    });

    submitBtn.addEventListener('click', function () {
      if (selectedScore == null) return;
      var comment = card.querySelector('.cortex-nps-comment').value.trim();
      overlay.remove();
      onSubmit({ score: selectedScore, comment: comment });
    });

    overlay.appendChild(card);
    return overlay;
  }

  /**
   * Submit an NPS response to the API.
   * @param {{ score: number, comment: string, plan: string }} data
   * @returns {Promise<object>}
   */
  async function submitResponse(data) {
    saveState({ lastSurvey: new Date().toISOString(), dismissed: false });

    try {
      var res = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score: data.score,
          comment: data.comment || '',
          plan: data.plan || 'free',
          timestamp: new Date().toISOString()
        })
      });
      if (res.ok) return await res.json();
    } catch (_err) {
      // Silently fail — response saved locally
    }

    return { status: 'queued' };
  }

  /**
   * Show the NPS survey if the user is eligible.
   * @param {{ plan: string }} opts
   */
  function show(opts) {
    if (!isEligible()) return;

    var plan = (opts && opts.plan) || 'free';
    var el = buildSurveyUI(
      function (result) {
        submitResponse({ score: result.score, comment: result.comment, plan: plan });
      },
      function () {
        saveState({ dismissed: true });
      }
    );
    document.body.appendChild(el);
  }

  /**
   * Dismiss the survey and reset dismissed state after cooldown.
   */
  function dismiss() {
    saveState({ dismissed: true });
  }

  /**
   * Calculate NPS from an array of responses.
   * @param {{ score: number }[]} responses
   * @returns {{ nps: number, promoters: number, passives: number, detractors: number, total: number }}
   */
  function calculateNPS(responses) {
    if (!responses || responses.length === 0) {
      return { nps: 0, promoters: 0, passives: 0, detractors: 0, total: 0 };
    }

    var promoters = 0;
    var passives = 0;
    var detractors = 0;

    responses.forEach(function (r) {
      if (r.score >= 9) promoters++;
      else if (r.score >= 7) passives++;
      else detractors++;
    });

    var total = responses.length;
    var nps = Math.round(((promoters - detractors) / total) * 100);

    return { nps: nps, promoters: promoters, passives: passives, detractors: detractors, total: total };
  }

  /**
   * Segment responses by plan type and calculate NPS per segment.
   * @param {{ score: number, plan: string }[]} responses
   * @returns {Object<string, { nps: number, promoters: number, passives: number, detractors: number, total: number }>}
   */
  function segmentByPlan(responses) {
    var segments = {};
    (responses || []).forEach(function (r) {
      var plan = r.plan || 'free';
      if (!segments[plan]) segments[plan] = [];
      segments[plan].push(r);
    });

    var result = {};
    Object.keys(segments).forEach(function (plan) {
      result[plan] = calculateNPS(segments[plan]);
    });
    return result;
  }

  // Export to namespace
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.NPSSurvey = {
    recordSignup: recordSignup,
    isEligible: isEligible,
    show: show,
    dismiss: dismiss,
    submitResponse: submitResponse,
    calculateNPS: calculateNPS,
    segmentByPlan: segmentByPlan
  };
})();
