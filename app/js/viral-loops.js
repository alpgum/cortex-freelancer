/**
 * CF-252: In-app viral loops — invite friends for perks
 * Invite tracking, automated reward system, progress indicator, email invite sender stub.
 */
(function () {
  'use strict';

  var REQUIRED_INVITES = 3;
  var REWARD_MONTHS_FREE = 1;
  var STORAGE_KEY = 'cortex_viral_invites';

  function ViralLoops(userId) {
    this.userId = userId;
    this.invites = this._loadInvites();
  }

  /* ---------- persistence ---------- */

  ViralLoops.prototype._loadInvites = function () {
    try {
      var raw = localStorage.getItem(STORAGE_KEY + '_' + this.userId);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  };

  ViralLoops.prototype._saveInvites = function () {
    localStorage.setItem(STORAGE_KEY + '_' + this.userId, JSON.stringify(this.invites));
  };

  /* ---------- invite sender (stub) ---------- */

  ViralLoops.prototype.sendInvite = function (email) {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { success: false, error: 'Invalid email address' };
    }

    var existing = this.invites.find(function (inv) { return inv.email === email; });
    if (existing) {
      return { success: false, error: 'Invite already sent to this email' };
    }

    var invite = {
      id: 'inv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      email: email,
      sentAt: new Date().toISOString(),
      status: 'pending', // pending | accepted | expired
      referralCode: this._generateReferralCode()
    };

    this.invites.push(invite);
    this._saveInvites();

    // Stub: in production this would call an email API
    console.log('[ViralLoops] Invite email stub — would send to:', email, 'code:', invite.referralCode);

    return { success: true, invite: invite };
  };

  ViralLoops.prototype.sendBulkInvites = function (emails) {
    var self = this;
    return emails.map(function (email) { return self.sendInvite(email); });
  };

  /* ---------- invite tracking ---------- */

  ViralLoops.prototype.markAccepted = function (inviteId) {
    var invite = this.invites.find(function (inv) { return inv.id === inviteId; });
    if (!invite) return { success: false, error: 'Invite not found' };
    if (invite.status === 'accepted') return { success: false, error: 'Already accepted' };

    invite.status = 'accepted';
    invite.acceptedAt = new Date().toISOString();
    this._saveInvites();

    var reward = this._checkRewardEligibility();
    return { success: true, invite: invite, rewardUnlocked: reward.eligible };
  };

  ViralLoops.prototype.getInvites = function () {
    return this.invites.slice();
  };

  /* ---------- progress indicator ---------- */

  ViralLoops.prototype.getProgress = function () {
    var accepted = this.invites.filter(function (inv) { return inv.status === 'accepted'; }).length;
    var pending = this.invites.filter(function (inv) { return inv.status === 'pending'; }).length;
    var remaining = Math.max(0, REQUIRED_INVITES - accepted);

    return {
      totalSent: this.invites.length,
      accepted: accepted,
      pending: pending,
      remaining: remaining,
      percentComplete: Math.min(100, Math.round((accepted / REQUIRED_INVITES) * 100)),
      rewardUnlocked: accepted >= REQUIRED_INVITES,
      requiredInvites: REQUIRED_INVITES,
      rewardDescription: 'Invite ' + REQUIRED_INVITES + ' friends, get ' + REWARD_MONTHS_FREE + ' month Pro free'
    };
  };

  /* ---------- automated reward system ---------- */

  ViralLoops.prototype._checkRewardEligibility = function () {
    var progress = this.getProgress();
    if (!progress.rewardUnlocked) {
      return { eligible: false, reason: progress.remaining + ' more accepted invites needed' };
    }

    return {
      eligible: true,
      reward: {
        type: 'pro_subscription',
        months: REWARD_MONTHS_FREE,
        grantedAt: new Date().toISOString(),
        userId: this.userId
      }
    };
  };

  ViralLoops.prototype.claimReward = function () {
    var eligibility = this._checkRewardEligibility();
    if (!eligibility.eligible) {
      return { success: false, error: eligibility.reason };
    }

    // Stub: in production would call billing API
    console.log('[ViralLoops] Reward claimed for user:', this.userId);
    return { success: true, reward: eligibility.reward };
  };

  /* ---------- referral code ---------- */

  ViralLoops.prototype._generateReferralCode = function () {
    return 'CTX-' + this.userId.slice(0, 4).toUpperCase() + '-' + Math.random().toString(36).slice(2, 7).toUpperCase();
  };

  ViralLoops.prototype.getReferralLink = function () {
    var code = this._generateReferralCode();
    return {
      code: code,
      url: 'https://cortexfreelancer.com/join?ref=' + code
    };
  };

  /* ---------- UI render helper ---------- */

  ViralLoops.prototype.renderProgressBar = function () {
    var p = this.getProgress();
    return '<div class="viral-progress">' +
      '<p>' + p.rewardDescription + '</p>' +
      '<div class="progress-bar" style="width:100%;background:#e0e0e0;border-radius:8px;height:24px;">' +
        '<div style="width:' + p.percentComplete + '%;background:#4caf50;height:100%;border-radius:8px;transition:width .3s;"></div>' +
      '</div>' +
      '<p>' + p.accepted + ' / ' + p.requiredInvites + ' friends joined' +
        (p.rewardUnlocked ? ' — <strong>Reward unlocked!</strong>' : '') +
      '</p>' +
    '</div>';
  };

  // Export to namespace
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.ViralLoops = ViralLoops;
})();
