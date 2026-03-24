/**
 * CF-252: In-app viral loops — invite friends for perks
 * 'Invite 3 friends, get 1 month Pro free' flow with tracking and automated reward logic.
 */
(function () {
  'use strict';

  var API_BASE = '/api/referrals';
  var INVITE_THRESHOLD = 3;
  var REWARD_MONTHS = 1;

  /**
   * Generate a unique referral link for the current user.
   * @param {string} userId
   * @returns {Promise<{ link: string, code: string }>}
   */
  async function generateReferralLink(userId) {
    if (!userId) throw new Error('userId is required');

    try {
      var res = await fetch(API_BASE + '/generate-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId })
      });
      if (res.ok) return res.json();
    } catch (_err) { /* fall through */ }

    // Fallback: client-generated code
    var code = 'CF-' + userId.slice(0, 6).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
    return {
      link: window.location.origin + '/signup?ref=' + code,
      code: code
    };
  }

  /**
   * Get the current referral status for a user.
   * @param {string} userId
   * @returns {Promise<{ invitesSent: number, signups: number, qualified: boolean, rewardApplied: boolean }>}
   */
  async function getReferralStatus(userId) {
    if (!userId) throw new Error('userId is required');

    try {
      var res = await fetch(API_BASE + '/status/' + encodeURIComponent(userId));
      if (res.ok) return res.json();
    } catch (_err) { /* fall through */ }

    return { invitesSent: 0, signups: 0, qualified: false, rewardApplied: false };
  }

  /**
   * Send invite emails to a list of addresses.
   * @param {object} params
   * @param {string} params.userId
   * @param {string[]} params.emails
   * @param {string} [params.message] - Optional personal message
   * @returns {Promise<{ sent: number, failed: string[] }>}
   */
  async function sendInvites(params) {
    var userId = params.userId;
    var emails = params.emails || [];
    var message = params.message || '';

    if (!userId) throw new Error('userId is required');

    var validEmails = emails.filter(function (e) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
    });

    if (validEmails.length === 0) {
      return { sent: 0, failed: emails };
    }

    try {
      var res = await fetch(API_BASE + '/send-invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId, emails: validEmails, message: message })
      });
      if (res.ok) return res.json();
    } catch (_err) { /* fall through */ }

    return { sent: 0, failed: validEmails };
  }

  /**
   * Check if user qualifies for reward and apply it.
   * @param {string} userId
   * @returns {Promise<{ qualified: boolean, rewardApplied: boolean, proExpiresAt: string|null }>}
   */
  async function checkAndApplyReward(userId) {
    if (!userId) throw new Error('userId is required');

    var status = await getReferralStatus(userId);

    if (status.signups >= INVITE_THRESHOLD && !status.rewardApplied) {
      try {
        var res = await fetch(API_BASE + '/apply-reward', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: userId, rewardMonths: REWARD_MONTHS })
        });
        if (res.ok) return res.json();
      } catch (_err) { /* fall through */ }
    }

    return {
      qualified: status.signups >= INVITE_THRESHOLD,
      rewardApplied: status.rewardApplied,
      proExpiresAt: null
    };
  }

  /**
   * Record that a referred user signed up.
   * @param {string} referralCode
   * @param {string} newUserId
   * @returns {Promise<{ recorded: boolean }>}
   */
  async function trackSignup(referralCode, newUserId) {
    if (!referralCode || !newUserId) throw new Error('referralCode and newUserId are required');

    try {
      var res = await fetch(API_BASE + '/track-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referralCode: referralCode, newUserId: newUserId })
      });
      if (res.ok) return res.json();
    } catch (_err) { /* fall through */ }

    return { recorded: false };
  }

  /**
   * Get progress data for the invite UI widget.
   * @param {string} userId
   * @returns {Promise<{ signups: number, threshold: number, remaining: number, progressPct: number, rewardLabel: string }>}
   */
  async function getInviteProgress(userId) {
    var status = await getReferralStatus(userId);
    var remaining = Math.max(0, INVITE_THRESHOLD - status.signups);
    var pct = Math.min(100, Math.round((status.signups / INVITE_THRESHOLD) * 100));

    return {
      signups: status.signups,
      threshold: INVITE_THRESHOLD,
      remaining: remaining,
      progressPct: pct,
      rewardLabel: REWARD_MONTHS + ' month Pro free'
    };
  }

  // Export to namespace
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.ViralInviteLoop = {
    generateReferralLink: generateReferralLink,
    getReferralStatus: getReferralStatus,
    sendInvites: sendInvites,
    checkAndApplyReward: checkAndApplyReward,
    trackSignup: trackSignup,
    getInviteProgress: getInviteProgress
  };
})();
