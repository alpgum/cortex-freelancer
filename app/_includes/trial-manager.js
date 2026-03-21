/**
 * Cortex Freelancer — 7-Day Pro Trial Manager [488]
 * - Start trial: stores start date in localStorage
 * - Dashboard countdown banner
 * - Day 5 nudge
 * - Graceful downgrade after expiry
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_trial';
  var TRIAL_DAYS = 7;
  var NUDGE_DAY = 5;

  function getTrialData() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch (e) {
      return null;
    }
  }

  function saveTrialData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  /**
   * Start a trial. Called when user activates trial from pricing or dashboard.
   */
  function startTrial() {
    var existing = getTrialData();
    if (existing && existing.startedAt) return existing; // already started

    var data = {
      startedAt: new Date().toISOString(),
      expired: false,
      nudgeShown: false,
      convertedAt: null
    };
    saveTrialData(data);

    if (window.dataLayer) {
      window.dataLayer.push({ event: 'trial_started' });
    }

    return data;
  }

  /**
   * Get remaining days in trial. Returns -1 if no trial, 0 if expired.
   */
  function getDaysRemaining() {
    var data = getTrialData();
    if (!data || !data.startedAt) return -1;
    if (data.convertedAt) return -1; // converted to paid — no trial UI

    var start = new Date(data.startedAt);
    var now = new Date();
    var elapsed = Math.floor((now - start) / (1000 * 60 * 60 * 24));
    var remaining = TRIAL_DAYS - elapsed;
    return Math.max(0, remaining);
  }

  /**
   * Check if trial is active (has days remaining).
   */
  function isTrialActive() {
    return getDaysRemaining() > 0;
  }

  /**
   * Check if trial has expired.
   */
  function isTrialExpired() {
    var data = getTrialData();
    if (!data || !data.startedAt) return false;
    return getDaysRemaining() === 0;
  }

  /**
   * Update dashboard UI — called on dashboard page.
   */
  function updateDashboardUI() {
    var banner = document.getElementById('trialBanner');
    if (!banner) return;

    var data = getTrialData();
    if (!data || !data.startedAt || data.convertedAt) return;

    var daysLeft = getDaysRemaining();

    if (daysLeft > 0) {
      // Active trial
      banner.style.display = '';

      document.getElementById('trialDaysLeft').textContent = daysLeft;
      document.getElementById('trialTitle').textContent = 'Pro Trial Active';

      if (daysLeft <= 2) {
        document.getElementById('trialDesc').textContent = 'Your trial ends soon! Upgrade to keep unlimited access.';
        banner.querySelector('[style*="border"]').style.borderColor = 'rgba(255,68,102,.3)';
        document.getElementById('trialDaysLeft').style.color = '#ff4466';
        document.getElementById('trialUpgradeBtn').textContent = 'Upgrade Before It Ends';
      } else {
        document.getElementById('trialDesc').textContent = 'You have full access to all Pro features during your trial.';
      }

      // Day 5 nudge
      if (daysLeft <= (TRIAL_DAYS - NUDGE_DAY + 1) && !data.nudgeShown) {
        showTrialNudge(daysLeft);
        data.nudgeShown = true;
        saveTrialData(data);
      }

      // Update pro status card to reflect trial
      var proTitle = document.getElementById('proTitle');
      var proDesc = document.getElementById('proDesc');
      var proIcon = document.getElementById('proIcon');
      var proBtn = document.getElementById('proBtn');
      if (proTitle) proTitle.textContent = 'Pro Trial';
      if (proDesc) proDesc.textContent = daysLeft + ' day' + (daysLeft !== 1 ? 's' : '') + ' remaining in your free trial.';
      if (proIcon) {
        proIcon.innerHTML = '&#9733;';
        proIcon.style.background = 'linear-gradient(135deg,#aa66ff,#8844dd)';
      }
      if (proBtn) {
        proBtn.textContent = 'Upgrade';
        proBtn.href = '/pricing';
      }

    } else if (daysLeft === 0) {
      // Expired — graceful downgrade
      banner.style.display = '';
      document.getElementById('trialDaysLeft').textContent = '0';
      document.getElementById('trialDaysLeft').style.color = '#ff4466';
      document.getElementById('trialTitle').textContent = 'Trial Expired';
      document.getElementById('trialDesc').textContent = 'Your 7-day trial has ended. Upgrade to Pro to keep unlimited access.';
      document.getElementById('trialIcon').innerHTML = '&#128274;';
      document.getElementById('trialIcon').style.background = 'linear-gradient(135deg,#ff4466,#cc3355)';
      document.getElementById('trialUpgradeBtn').textContent = 'Upgrade to Pro';
      banner.querySelector('[style*="border"]').style.borderColor = 'rgba(255,68,102,.3)';

      // Mark as expired
      if (!data.expired) {
        data.expired = true;
        saveTrialData(data);
        if (window.dataLayer) {
          window.dataLayer.push({ event: 'trial_expired' });
        }
      }
    }
  }

  /**
   * Day 5 nudge — slide-in notification
   */
  function showTrialNudge(daysLeft) {
    if (document.getElementById('trial-nudge')) return;

    var nudge = document.createElement('div');
    nudge.id = 'trial-nudge';
    nudge.setAttribute('role', 'alert');
    nudge.style.cssText = 'position:fixed;top:5rem;right:1.5rem;z-index:100;background:var(--bg2,#111118);border:1px solid rgba(170,102,255,.25);border-radius:14px;padding:1.25rem;max-width:320px;box-shadow:0 8px 40px rgba(0,0,0,.5);animation:trialNudgeIn .4s ease;font-family:Inter,-apple-system,sans-serif';
    nudge.innerHTML =
      '<button onclick="this.parentElement.remove()" style="position:absolute;top:.5rem;right:.75rem;background:none;border:none;color:var(--text3);font-size:1.1rem;cursor:pointer" aria-label="Close">&times;</button>' +
      '<div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.5rem">' +
        '<span style="font-size:1.3rem">&#9200;</span>' +
        '<strong style="font-size:.95rem;color:var(--text,#f0f0f0)">Only ' + daysLeft + ' day' + (daysLeft !== 1 ? 's' : '') + ' left in your trial</strong>' +
      '</div>' +
      '<p style="color:var(--text2,#a0a0a0);font-size:.85rem;line-height:1.5;margin-bottom:.75rem">Upgrade now to keep unlimited access to all tools, PDF exports, and premium features.</p>' +
      '<a href="/pricing" style="display:inline-block;background:linear-gradient(135deg,#ff8844,#ff6622);color:#000;padding:.5rem 1.25rem;border-radius:100px;font-weight:700;font-size:.85rem;text-decoration:none;transition:transform .2s">Upgrade to Pro &rarr;</a>';

    if (!document.getElementById('trial-nudge-style')) {
      var style = document.createElement('style');
      style.id = 'trial-nudge-style';
      style.textContent = '@keyframes trialNudgeIn{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:translateX(0)}}';
      document.head.appendChild(style);
    }

    document.body.appendChild(nudge);

    // Auto-dismiss after 15 seconds
    setTimeout(function () {
      if (nudge.parentNode) {
        nudge.style.transition = 'opacity .3s,transform .3s';
        nudge.style.opacity = '0';
        nudge.style.transform = 'translateX(40px)';
        setTimeout(function () { nudge.remove(); }, 300);
      }
    }, 15000);
  }

  // Public API
  window.cortexTrial = {
    start: startTrial,
    getDaysRemaining: getDaysRemaining,
    isActive: isTrialActive,
    isExpired: isTrialExpired,
    getData: getTrialData
  };

  // Init on dashboard
  if (document.getElementById('trialBanner')) {
    updateDashboardUI();
  }
})();
