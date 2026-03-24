/**
 * CF-244: Referral Program — unique link generation, signup tracking, leaderboard.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_referral';
  var REFERRAL_PARAM = 'ref';
  var API_ENDPOINT = '/api/referral';

  /**
   * Generate a unique referral code from a user ID.
   * @param {string} userId
   * @returns {string}
   */
  function generateCode(userId) {
    if (!userId) return '';
    var hash = 0;
    for (var i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
    }
    var code = Math.abs(hash).toString(36).toUpperCase();
    while (code.length < 6) code = '0' + code;
    return 'CF-' + code;
  }

  /**
   * Build a shareable referral link.
   * @param {string} referralCode
   * @param {string} [campaign] - Optional campaign identifier
   * @returns {string}
   */
  function buildShareLink(referralCode, campaign) {
    var base = window.location.origin + '/';
    var params = REFERRAL_PARAM + '=' + encodeURIComponent(referralCode);
    if (campaign) params += '&utm_campaign=' + encodeURIComponent(campaign);
    return base + '?' + params;
  }

  /**
   * Capture referral code from the current URL if present.
   * Stores it for attribution when the visitor signs up.
   * @returns {string|null}
   */
  function captureReferral() {
    var params = new URLSearchParams(window.location.search);
    var code = params.get(REFERRAL_PARAM);
    if (!code) return null;

    try {
      var data = {
        code: code,
        capturedAt: new Date().toISOString(),
        landingPage: window.location.pathname
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_e) {
      // Storage unavailable
    }

    return code;
  }

  /**
   * Get stored referral data for attribution at signup.
   * @returns {object|null}
   */
  function getStoredReferral() {
    try {
      var data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (_e) {
      return null;
    }
  }

  /**
   * Track a successful referral signup via API.
   * @param {object} params
   * @param {string} params.referrerCode - Code of the person who referred
   * @param {string} params.newUserId - ID of the new signup
   * @returns {Promise<object>}
   */
  async function trackSignup(params) {
    var referral = getStoredReferral();
    var payload = {
      referrerCode: params.referrerCode || (referral && referral.code) || '',
      newUserId: params.newUserId,
      capturedAt: referral ? referral.capturedAt : new Date().toISOString(),
      landingPage: referral ? referral.landingPage : ''
    };

    try {
      var res = await fetch(API_ENDPOINT + '/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        clearStored();
        return await res.json();
      }
    } catch (_err) {
      // Fail silently — referral tracking is non-critical
    }

    return { success: false };
  }

  /**
   * Fetch the referral leaderboard.
   * @param {number} [limit=10]
   * @returns {Promise<object[]>}
   */
  async function getLeaderboard(limit) {
    limit = limit || 10;
    try {
      var res = await fetch(API_ENDPOINT + '/leaderboard?limit=' + limit);
      if (res.ok) return await res.json();
    } catch (_err) {
      // Fail silently
    }
    return [];
  }

  /**
   * Fetch referral stats for a specific user.
   * @param {string} userId
   * @returns {Promise<object>}
   */
  async function getUserStats(userId) {
    try {
      var res = await fetch(API_ENDPOINT + '/stats/' + encodeURIComponent(userId));
      if (res.ok) return await res.json();
    } catch (_err) {
      // Fail silently
    }
    return { referrals: 0, signups: 0, rewards: [] };
  }

  /**
   * Render referral share card HTML.
   * @param {string} referralCode
   * @returns {string}
   */
  function renderShareCard(referralCode) {
    var link = buildShareLink(referralCode, 'referral');
    return '<div class="referral-share">' +
      '<h3 class="referral-share__title">Share Cortex Freelancer</h3>' +
      '<p class="referral-share__desc">Invite fellow freelancers and earn rewards when they sign up.</p>' +
      '<div class="referral-share__link-box">' +
      '<input type="text" class="referral-share__input" value="' + link + '" readonly>' +
      '<button class="referral-share__copy btn btn--secondary" data-link="' + link + '">Copy Link</button>' +
      '</div>' +
      '<div class="referral-share__social">' +
      '<button class="referral-share__btn" data-platform="twitter" data-link="' + link + '">Twitter</button>' +
      '<button class="referral-share__btn" data-platform="linkedin" data-link="' + link + '">LinkedIn</button>' +
      '<button class="referral-share__btn" data-platform="email" data-link="' + link + '">Email</button>' +
      '</div>' +
      '</div>';
  }

  /**
   * Render leaderboard HTML.
   * @param {object[]} entries - Array of { name, referrals, rank }
   * @returns {string}
   */
  function renderLeaderboard(entries) {
    if (!entries.length) return '<p class="referral-leaderboard__empty">No referrals yet. Be the first!</p>';

    var rows = entries.map(function (entry, index) {
      var rank = index + 1;
      var badge = rank <= 3 ? ' referral-leaderboard__row--top' : '';
      return '<tr class="referral-leaderboard__row' + badge + '">' +
        '<td class="referral-leaderboard__rank">#' + rank + '</td>' +
        '<td class="referral-leaderboard__name">' + (entry.name || 'Anonymous') + '</td>' +
        '<td class="referral-leaderboard__count">' + (entry.referrals || 0) + ' referrals</td>' +
        '</tr>';
    });

    return '<table class="referral-leaderboard">' +
      '<thead><tr><th>Rank</th><th>Referrer</th><th>Signups</th></tr></thead>' +
      '<tbody>' + rows.join('') + '</tbody>' +
      '</table>';
  }

  /**
   * Copy referral link to clipboard.
   * @param {string} link
   * @returns {Promise<boolean>}
   */
  async function copyLink(link) {
    try {
      await navigator.clipboard.writeText(link);
      return true;
    } catch (_e) {
      // Fallback
      var input = document.createElement('input');
      input.value = link;
      document.body.appendChild(input);
      input.select();
      var success = document.execCommand('copy');
      document.body.removeChild(input);
      return success;
    }
  }

  /**
   * Clear stored referral data.
   */
  function clearStored() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_e) {
      // Ignore
    }
  }

  // Auto-capture on load
  captureReferral();

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.ReferralProgram = {
    generateCode: generateCode,
    buildShareLink: buildShareLink,
    captureReferral: captureReferral,
    getStoredReferral: getStoredReferral,
    trackSignup: trackSignup,
    getLeaderboard: getLeaderboard,
    getUserStats: getUserStats,
    renderShareCard: renderShareCard,
    renderLeaderboard: renderLeaderboard,
    copyLink: copyLink,
    clearStored: clearStored
  };
})();
