// Cortex Freelancer — Cancel Subscription Exit Survey
// Shows a "Why are you leaving?" modal before redirecting to Stripe billing portal.
// Saves response to localStorage for analytics.

(function () {
  'use strict';

  var SURVEY_KEY = 'cortex_cancel_survey';

  var reasons = [
    'Too expensive',
    'Not using it enough',
    'Missing features I need',
    'Found a better alternative',
    'Technical issues',
    'Just testing / temporary',
    'My freelance situation changed',
    'Other'
  ];

  function createModal() {
    var overlay = document.createElement('div');
    overlay.id = 'cancel-survey-overlay';
    overlay.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(6px);z-index:9000;align-items:center;justify-content:center';

    var reasonsHTML = reasons.map(function (r, i) {
      return '<label style="display:flex;align-items:center;gap:.6rem;padding:.65rem .75rem;border-radius:8px;cursor:pointer;transition:background .15s;font-size:.9rem;color:#a0a0a0"' +
        ' onmouseover="this.style.background=\'rgba(255,255,255,.05)\'"' +
        ' onmouseout="this.style.background=\'transparent\'"' +
        ' onfocus="this.style.background=\'rgba(255,255,255,.05)\'"' +
        ' onblur="this.style.background=\'transparent\'">' +
        '<input type="radio" name="cancel-reason" value="' + r + '" style="accent-color:#ff8844;width:16px;height:16px">' +
        r + '</label>';
    }).join('');

    overlay.innerHTML =
      '<div style="background:#111;border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:2rem;max-width:460px;width:90%;position:relative">' +
        '<button onclick="closeCancelSurvey()" style="position:absolute;top:1rem;right:1rem;background:none;border:none;color:#666;font-size:1.3rem;cursor:pointer">&times;</button>' +
        '<h3 style="font-size:1.2rem;font-weight:800;margin-bottom:.25rem;color:#f0f0f0">Before you go...</h3>' +
        '<p style="color:#a0a0a0;font-size:.9rem;margin-bottom:1.25rem;line-height:1.5">We\'d love to know why you\'re leaving so we can improve.</p>' +
        '<div id="cancel-reasons" style="display:flex;flex-direction:column;gap:.15rem;margin-bottom:1rem">' + reasonsHTML + '</div>' +
        '<textarea id="cancel-feedback" placeholder="Anything else you\'d like to share? (optional)" style="width:100%;background:#1a1a1a;border:1px solid rgba(255,255,255,.1);padding:.7rem;border-radius:10px;font-size:.85rem;color:#f0f0f0;resize:none;height:70px;outline:none;font-family:inherit;margin-bottom:1rem"></textarea>' +
        '<button id="cancel-confirm-btn" onclick="submitCancelSurvey()" style="width:100%;background:linear-gradient(135deg,#ff4466,#cc2244);color:#fff;padding:.8rem;border-radius:100px;font-weight:700;font-size:.9rem;border:none;cursor:pointer;transition:all .2s;font-family:inherit;opacity:.5;pointer-events:none">Continue to Cancel</button>' +
        '<p style="text-align:center;margin-top:.75rem"><a href="#" onclick="closeCancelSurvey();return false" style="color:#666;font-size:.8rem;text-decoration:underline">Never mind, I\'ll stay</a></p>' +
      '</div>';

    document.body.appendChild(overlay);

    // Enable button when a reason is selected
    overlay.addEventListener('change', function () {
      var btn = document.getElementById('cancel-confirm-btn');
      if (btn) {
        btn.style.opacity = '1';
        btn.style.pointerEvents = 'auto';
      }
    });

    // Close on backdrop click
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeCancelSurvey();
    });
  }

  window.openCancelSurvey = function () {
    var overlay = document.getElementById('cancel-survey-overlay');
    if (!overlay) {
      createModal();
      overlay = document.getElementById('cancel-survey-overlay');
    }
    overlay.style.display = 'flex';
  };

  window.closeCancelSurvey = function () {
    var overlay = document.getElementById('cancel-survey-overlay');
    if (overlay) overlay.style.display = 'none';
  };

  window.submitCancelSurvey = function () {
    var selected = document.querySelector('input[name="cancel-reason"]:checked');
    if (!selected) return;

    var feedback = (document.getElementById('cancel-feedback') || {}).value || '';

    var surveyData = {
      reason: selected.value,
      feedback: feedback.trim(),
      ts: new Date().toISOString()
    };

    // Save to localStorage
    try {
      var existing = JSON.parse(localStorage.getItem(SURVEY_KEY) || '[]');
      existing.push(surveyData);
      localStorage.setItem(SURVEY_KEY, JSON.stringify(existing));
    } catch (e) {
      localStorage.setItem(SURVEY_KEY, JSON.stringify([surveyData]));
    }

    // Push to dataLayer if available
    if (typeof dataLayer !== 'undefined') {
      dataLayer.push({
        event: 'cancel_survey_submitted',
        cancel_reason: surveyData.reason
      });
    }

    closeCancelSurvey();

    // Redirect to Stripe billing portal
    var email;
    try { email = JSON.parse(localStorage.getItem('cortex_user')).email; } catch (e) {}
    if (!email) email = prompt('Enter the email you used to subscribe:');
    if (!email) return;

    fetch('/api/billing-portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.url) window.location.href = data.url;
        else throw new Error(data.error || 'Failed');
      })
      .catch(function (err) {
        alert(err.message || 'Could not open billing portal. Please contact support.');
      });
  };
})();
