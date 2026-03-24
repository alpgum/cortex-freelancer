/**
 * CF-257: Affiliate program infrastructure
 * Affiliate signup, unique tracking links, commission tracking (20% recurring), payout dashboard data.
 */
(function () {
  'use strict';

  var API_BASE = '/api/affiliates';
  var COMMISSION_RATE = 0.20;
  var COOKIE_DURATION_DAYS = 90;
  var MIN_PAYOUT = 50.00;

  /**
   * Sign up as an affiliate.
   * @param {object} params
   * @param {string} params.userId
   * @param {string} params.paypalEmail - Payout email
   * @param {string} [params.website] - Affiliate's website
   * @param {string} [params.promotionMethod] - How they plan to promote
   * @returns {Promise<{ success: boolean, affiliateId: string, trackingCode: string }>}
   */
  async function signup(params) {
    if (!params.userId || !params.paypalEmail) throw new Error('userId and paypalEmail are required');

    try {
      var res = await fetch(API_BASE + '/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: params.userId,
          paypalEmail: params.paypalEmail,
          website: params.website || '',
          promotionMethod: params.promotionMethod || ''
        })
      });
      if (res.ok) return res.json();
    } catch (_err) { /* fall through */ }

    return { success: false, affiliateId: '', trackingCode: '' };
  }

  /**
   * Generate a unique tracking link for an affiliate.
   * @param {string} affiliateId
   * @param {string} [landingPage] - Target page path
   * @returns {{ url: string, code: string, cookieDuration: number }}
   */
  function generateTrackingLink(affiliateId, landingPage) {
    if (!affiliateId) throw new Error('affiliateId is required');

    var page = landingPage || '/';
    var code = 'aff-' + affiliateId;
    var url = window.location.origin + page + (page.indexOf('?') >= 0 ? '&' : '?') + 'ref=' + code;

    return {
      url: url,
      code: code,
      cookieDuration: COOKIE_DURATION_DAYS
    };
  }

  /**
   * Track a click on an affiliate link. Sets a cookie and records the event.
   * @param {string} trackingCode
   * @returns {Promise<{ tracked: boolean }>}
   */
  async function trackClick(trackingCode) {
    if (!trackingCode) return { tracked: false };

    // Set affiliate cookie
    var expires = new Date(Date.now() + COOKIE_DURATION_DAYS * 86400000).toUTCString();
    document.cookie = 'cortex_aff=' + encodeURIComponent(trackingCode) + '; expires=' + expires + '; path=/; SameSite=Lax';

    try {
      var res = await fetch(API_BASE + '/track-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingCode: trackingCode, timestamp: new Date().toISOString() })
      });
      if (res.ok) return res.json();
    } catch (_err) { /* fall through */ }

    return { tracked: true };
  }

  /**
   * Record a conversion (signup or purchase) tied to an affiliate.
   * @param {object} params
   * @param {string} params.trackingCode
   * @param {string} params.eventType - 'signup' or 'purchase'
   * @param {number} [params.amount] - Purchase amount (for commission calc)
   * @returns {Promise<{ recorded: boolean, commission: number }>}
   */
  async function recordConversion(params) {
    if (!params.trackingCode || !params.eventType) throw new Error('trackingCode and eventType are required');

    var commission = params.eventType === 'purchase' && params.amount
      ? Math.round(params.amount * COMMISSION_RATE * 100) / 100
      : 0;

    try {
      var res = await fetch(API_BASE + '/conversions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackingCode: params.trackingCode,
          eventType: params.eventType,
          amount: params.amount || 0,
          commission: commission,
          timestamp: new Date().toISOString()
        })
      });
      if (res.ok) return res.json();
    } catch (_err) { /* fall through */ }

    return { recorded: false, commission: commission };
  }

  /**
   * Get the affiliate's tracking cookie from the current visitor.
   * @returns {string|null}
   */
  function getAffiliateCookie() {
    var match = document.cookie.match(/(?:^|;\s*)cortex_aff=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  /**
   * Get payout dashboard data for an affiliate.
   * @param {string} affiliateId
   * @returns {Promise<{ totalEarnings: number, pendingPayout: number, paidOut: number, clicks: number, conversions: number, conversionRate: number, commissionRate: number, minPayout: number, recentTransactions: Array }>}
   */
  async function getDashboardData(affiliateId) {
    if (!affiliateId) throw new Error('affiliateId is required');

    try {
      var res = await fetch(API_BASE + '/dashboard/' + encodeURIComponent(affiliateId));
      if (res.ok) return res.json();
    } catch (_err) { /* fall through */ }

    return {
      totalEarnings: 0,
      pendingPayout: 0,
      paidOut: 0,
      clicks: 0,
      conversions: 0,
      conversionRate: 0,
      commissionRate: COMMISSION_RATE,
      minPayout: MIN_PAYOUT,
      recentTransactions: []
    };
  }

  /**
   * Request a payout.
   * @param {string} affiliateId
   * @returns {Promise<{ success: boolean, amount: number, message: string }>}
   */
  async function requestPayout(affiliateId) {
    if (!affiliateId) throw new Error('affiliateId is required');

    try {
      var res = await fetch(API_BASE + '/request-payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ affiliateId: affiliateId })
      });
      if (res.ok) return res.json();
    } catch (_err) { /* fall through */ }

    return { success: false, amount: 0, message: 'Unable to process payout request' };
  }

  /**
   * Get affiliate program terms/config for display.
   * @returns {{ commissionRate: number, commissionLabel: string, cookieDuration: number, minPayout: number, payoutSchedule: string }}
   */
  function getProgramTerms() {
    return {
      commissionRate: COMMISSION_RATE,
      commissionLabel: (COMMISSION_RATE * 100) + '% recurring',
      cookieDuration: COOKIE_DURATION_DAYS,
      minPayout: MIN_PAYOUT,
      payoutSchedule: 'Monthly, net-30'
    };
  }

  // Export to namespace
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.AffiliateProgram = {
    signup: signup,
    generateTrackingLink: generateTrackingLink,
    trackClick: trackClick,
    recordConversion: recordConversion,
    getAffiliateCookie: getAffiliateCookie,
    getDashboardData: getDashboardData,
    requestPayout: requestPayout,
    getProgramTerms: getProgramTerms
  };
})();
