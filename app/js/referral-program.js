/**
 * CF-244: Referral Program — unique link generation, signup tracking, leaderboard.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_referral';
  var REFERRAL_PARAM = 'ref';
  var API_ENDPOINT = '/api/referral';

  /**
   * ReferralProgram class — generate unique referral codes per user,
   * track signups via referral, show referral count/leaderboard,
   * generate shareable links with copy button.
   * @param {object} [options]
   * @param {string} [options.baseURL]
   * @param {string} [options.apiEndpoint]
   */
  function ReferralProgram(options) {
    options = options || {};
    this.baseURL = options.baseURL || window.location.origin;
    this.apiEndpoint = options.apiEndpoint || API_ENDPOINT;
    this._referralCode = null;
    this._userId = null;
  }

  /**
   * Initialize — capture referral from URL if present.
   * @returns {ReferralProgram}
   */
  ReferralProgram.prototype.init = function () {
    this._captureReferral();
    return this;
  };

  /**
   * Generate a unique referral code from a user ID.
   * @param {string} userId
   * @returns {string}
   */
  ReferralProgram.prototype.generateCode = function (userId) {
    if (!userId) return '';
    var hash = 0;
    for (var i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
    }
    var code = Math.abs(hash).toString(36).toUpperCase();
    while (code.length < 6) code = '0' + code;
    return 'CF-' + code;
  };

  /**
   * Set the current user and their referral code.
   * @param {string} userId
   * @param {string} [referralCode] - Auto-generated if not provided
   * @returns {ReferralProgram}
   */
  ReferralProgram.prototype.setUser = function (userId, referralCode) {
    this._userId = userId;
    this._referralCode = referralCode || this.generateCode(userId);
    return this;
  };

  /**
   * Build a shareable referral link.
   * @param {string} [campaign] - Optional campaign identifier
   * @returns {string}
   */
  ReferralProgram.prototype.getReferralLink = function (campaign) {
    var code = this._referralCode;
    if (!code) return '';
    var params = REFERRAL_PARAM + '=' + encodeURIComponent(code);
    if (campaign) {
      params += '&utm_source=referral&utm_campaign=' + encodeURIComponent(campaign);
    }
    return this.baseURL + '/?' + params;
  };

  /**
   * Get share links for various platforms.
   * @returns {object|null}
   */
  ReferralProgram.prototype.getShareLinks = function () {
    var link = this.getReferralLink('share');
    if (!link) return null;

    var text = encodeURIComponent('Check out Cortex Freelancer — AI tools for Upwork freelancers!');
    var encodedLink = encodeURIComponent(link);

    return {
      url: link,
      twitter: 'https://twitter.com/intent/tweet?text=' + text + '&url=' + encodedLink,
      linkedin: 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodedLink,
      facebook: 'https://www.facebook.com/sharer/sharer.php?u=' + encodedLink,
      email: 'mailto:?subject=' + encodeURIComponent('Try Cortex Freelancer') + '&body=' + text + '%20' + encodedLink,
      whatsapp: 'https://wa.me/?text=' + text + '%20' + encodedLink
    };
  };

  /**
   * Capture referral code from the current URL if present.
   * Stores it for attribution when the visitor signs up.
   * @returns {string|null}
   */
  ReferralProgram.prototype._captureReferral = function () {
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
  };

  /**
   * Get stored referral data for attribution at signup.
   * @returns {object|null}
   */
  ReferralProgram.prototype.getStoredReferral = function () {
    try {
      var data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (_e) {
      return null;
    }
  };

  /**
   * Track a successful referral signup via API.
   * @param {object} params
   * @param {string} params.referrerCode - Code of the person who referred
   * @param {string} params.newUserId - ID of the new signup
   * @returns {Promise<object>}
   */
  ReferralProgram.prototype.trackSignup = function (params) {
    var referral = this.getStoredReferral();
    var payload = {
      referrerCode: params.referrerCode || (referral && referral.code) || '',
      newUserId: params.newUserId,
      capturedAt: referral ? referral.capturedAt : new Date().toISOString(),
      landingPage: referral ? referral.landingPage : ''
    };

    var self = this;
    return fetch(this.apiEndpoint + '/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(function (res) {
      if (res.ok) {
        self.clearStored();
        return res.json();
      }
      return { success: false };
    })
    .catch(function () {
      return { success: false };
    });
  };

  /**
   * Fetch the referral leaderboard.
   * @param {number} [limit=10]
   * @returns {Promise<object[]>}
   */
  ReferralProgram.prototype.getLeaderboard = function (limit) {
    limit = limit || 10;
    return fetch(this.apiEndpoint + '/leaderboard?limit=' + limit)
      .then(function (res) {
        if (res.ok) return res.json();
        return [];
      })
      .catch(function () {
        return [];
      });
  };

  /**
   * Fetch referral stats for a specific user.
   * @param {string} userId
   * @returns {Promise<object>}
   */
  ReferralProgram.prototype.getUserStats = function (userId) {
    return fetch(this.apiEndpoint + '/stats/' + encodeURIComponent(userId))
      .then(function (res) {
        if (res.ok) return res.json();
        return { referrals: 0, signups: 0, rewards: [] };
      })
      .catch(function () {
        return { referrals: 0, signups: 0, rewards: [] };
      });
  };

  /**
   * Render referral share card HTML with copy button.
   * @returns {string}
   */
  ReferralProgram.prototype.renderShareCard = function () {
    var link = this.getReferralLink('referral');
    if (!link) return '<p>Set up your referral code to start sharing.</p>';

    var links = this.getShareLinks();

    return '<div class="referral-share">' +
      '<h3 class="referral-share__title">Share Cortex Freelancer</h3>' +
      '<p class="referral-share__desc">Invite fellow freelancers and earn rewards when they sign up.</p>' +
      '<div class="referral-share__link-box">' +
        '<input type="text" class="referral-share__input" id="referral-link-input" value="' + link + '" readonly>' +
        '<button class="referral-share__copy btn btn--secondary" data-link="' + link + '" onclick="document.getElementById(\'referral-link-input\').select();document.execCommand(\'copy\');this.textContent=\'Copied!\';">Copy Link</button>' +
      '</div>' +
      '<div class="referral-share__social">' +
        '<a href="' + links.twitter + '" target="_blank" rel="noopener" class="referral-share__btn">Twitter</a>' +
        '<a href="' + links.linkedin + '" target="_blank" rel="noopener" class="referral-share__btn">LinkedIn</a>' +
        '<a href="' + links.facebook + '" target="_blank" rel="noopener" class="referral-share__btn">Facebook</a>' +
        '<a href="' + links.whatsapp + '" target="_blank" rel="noopener" class="referral-share__btn">WhatsApp</a>' +
        '<a href="' + links.email + '" class="referral-share__btn">Email</a>' +
      '</div>' +
      '</div>';
  };

  /**
   * Render leaderboard HTML.
   * @param {object[]} entries - Array of { name, referrals }
   * @returns {string}
   */
  ReferralProgram.prototype.renderLeaderboard = function (entries) {
    if (!entries || !entries.length) return '<p class="referral-leaderboard__empty">No referrals yet. Be the first!</p>';

    var rows = entries.map(function (entry, index) {
      var rank = index + 1;
      var badge = rank <= 3 ? ' referral-leaderboard__row--top' : '';
      return '<tr class="referral-leaderboard__row' + badge + '">' +
        '<td class="referral-leaderboard__rank">#' + rank + '</td>' +
        '<td class="referral-leaderboard__name">' + (entry.name || 'Anonymous') + '</td>' +
        '<td class="referral-leaderboard__count">' + (entry.referrals || 0) + ' referrals</td>' +
        '</tr>';
    });

    return '<div class="referral-leaderboard">' +
      '<h3>Top Referrers</h3>' +
      '<table>' +
        '<thead><tr><th>Rank</th><th>Referrer</th><th>Signups</th></tr></thead>' +
        '<tbody>' + rows.join('') + '</tbody>' +
      '</table>' +
      '</div>';
  };

  /**
   * Render full referral program page.
   * @param {object[]} [leaderboardEntries]
   * @returns {string}
   */
  ReferralProgram.prototype.renderPage = function (leaderboardEntries) {
    return '<div class="referral-program-page">' +
      '<h1>Referral Program</h1>' +
      '<p>Share Cortex Freelancer with other freelancers and earn rewards for every signup.</p>' +
      this.renderShareCard() +
      this.renderLeaderboard(leaderboardEntries || []) +
      '</div>';
  };

  /**
   * Copy referral link to clipboard.
   * @param {string} link
   * @returns {Promise<boolean>}
   */
  ReferralProgram.prototype.copyLink = function (link) {
    link = link || this.getReferralLink('referral');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(link).then(function () { return true; }).catch(function () {
        return _fallbackCopy(link);
      });
    }
    return Promise.resolve(_fallbackCopy(link));
  };

  function _fallbackCopy(text) {
    var input = document.createElement('input');
    input.value = text;
    document.body.appendChild(input);
    input.select();
    var success = document.execCommand('copy');
    document.body.removeChild(input);
    return success;
  }

  /**
   * Clear stored referral data.
   */
  ReferralProgram.prototype.clearStored = function () {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_e) {
      // Ignore
    }
  };

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.ReferralProgram = ReferralProgram;
})();
