/**
 * Cortex Freelancer — Referral Credit System
 * [CF-188] Generates unique referral codes, tracks conversions,
 * awards 1 free month to referrer when referred user subscribes to Pro.
 *
 * Features:
 *   - Generate/retrieve unique referral code per user
 *   - Shareable referral link with copy-to-clipboard
 *   - Track clicks, signups, and conversions
 *   - Award 1 free month credit per successful referral
 *   - Referral dashboard UI (stats + history)
 *   - Wired to api/referral.js backend
 *   - init() / render(containerId) interface
 */

(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Constants ────────────────────────────────────────────────────

  var API_URL = '/api/referral';
  var STORAGE_KEY = 'cf_referral';
  var REFERRAL_PARAM = 'ref';
  var BASE_URL = window.location.origin;

  // ─── State ────────────────────────────────────────────────────────

  var state = {
    initialized: false,
    code: null,
    referrals: 0,
    clicks: 0,
    monthsEarned: 0,
    loading: false,
    error: null,
    userEmail: null
  };

  // ─── Helpers ──────────────────────────────────────────────────────

  function getStore() {
    return window.CortexFreelancer.SubscriptionStore || null;
  }

  function loadCache() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch (e) { return {}; }
  }

  function saveCache(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
    catch (e) { /* quota */ }
  }

  function getUserEmail() {
    var store = getStore();
    if (store && typeof store.getUserEmail === 'function') return store.getUserEmail();
    // Fallback: check Firebase auth
    if (window.firebase && window.firebase.auth) {
      var user = window.firebase.auth().currentUser;
      if (user) return user.email;
    }
    return state.userEmail;
  }

  function getReferralLink(code) {
    return BASE_URL + '/?ref=' + encodeURIComponent(code);
  }

  // ─── API Calls ────────────────────────────────────────────────────

  function fetchReferralCode() {
    var email = getUserEmail();
    if (!email) return Promise.reject(new Error('User email not available'));

    state.loading = true;
    state.error = null;

    return fetch(API_URL + '?email=' + encodeURIComponent(email))
      .then(function (r) {
        if (!r.ok) throw new Error('Failed to fetch referral code');
        return r.json();
      })
      .then(function (data) {
        state.loading = false;
        state.code = data.code;
        state.referrals = data.referrals || 0;
        state.clicks = data.clicks || 0;
        state.monthsEarned = data.months_earned || 0;

        saveCache({
          code: state.code,
          referrals: state.referrals,
          clicks: state.clicks,
          monthsEarned: state.monthsEarned,
          fetchedAt: Date.now()
        });

        return data;
      })
      .catch(function (err) {
        state.loading = false;
        state.error = err.message;
        // Fallback to cache
        var cache = loadCache();
        if (cache.code) {
          state.code = cache.code;
          state.referrals = cache.referrals || 0;
          state.clicks = cache.clicks || 0;
          state.monthsEarned = cache.monthsEarned || 0;
        }
        throw err;
      });
  }

  function trackClick(code) {
    return fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'click', code: code })
    }).catch(function () { /* best effort */ });
  }

  function trackSignup(code, email) {
    return fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'signup', code: code, email: email })
    }).catch(function () { /* best effort */ });
  }

  function trackConversion(code, email) {
    return fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'convert', code: code, email: email })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.months_earned !== undefined) {
          state.monthsEarned = data.months_earned;
          state.referrals = data.referrals || state.referrals + 1;
        }
        return data;
      })
      .catch(function (err) {
        console.error('[ReferralCredits] Conversion tracking error:', err);
      });
  }

  // ─── Referral Detection ──────────────────────────────────────────

  function detectIncomingReferral() {
    var params = new URLSearchParams(window.location.search);
    var refCode = params.get(REFERRAL_PARAM);

    if (refCode) {
      // Store the referral code for later conversion tracking
      try {
        sessionStorage.setItem('cf_referred_by', refCode);
      } catch (e) { /* noop */ }

      // Track the click
      trackClick(refCode);

      // Clean URL without reload
      if (window.history && window.history.replaceState) {
        params.delete(REFERRAL_PARAM);
        var clean = params.toString();
        var newUrl = window.location.pathname + (clean ? '?' + clean : '') + window.location.hash;
        window.history.replaceState(null, '', newUrl);
      }

      return refCode;
    }

    return null;
  }

  // ─── Copy to Clipboard ───────────────────────────────────────────

  function copyReferralLink() {
    if (!state.code) return Promise.reject(new Error('No referral code'));

    var link = getReferralLink(state.code);

    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(link).then(function () {
        return link;
      });
    }

    // Fallback
    return new Promise(function (resolve) {
      var ta = document.createElement('textarea');
      ta.value = link;
      ta.style.cssText = 'position:fixed;left:-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      resolve(link);
    });
  }

  // ─── Dashboard UI ────────────────────────────────────────────────

  function render(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:600px;margin:0 auto;';

    // Header
    wrapper.innerHTML = '<h2 style="font-size:22px;margin:0 0 4px;color:#1a1a1a">Referral Program</h2>' +
      '<p style="margin:0 0 24px;color:#666;font-size:14px">Invite friends, earn free months of Pro.</p>';

    if (state.loading) {
      wrapper.innerHTML += '<p style="color:#999;text-align:center;padding:32px 0">Loading referral data…</p>';
      container.appendChild(wrapper);
      return;
    }

    if (!state.code) {
      wrapper.innerHTML += '<p style="color:#999;text-align:center;padding:32px 0">Sign in to access your referral link.</p>';
      container.appendChild(wrapper);
      return;
    }

    // Referral link card
    var linkCard = document.createElement('div');
    linkCard.style.cssText = 'background:#F5F5FF;border:1px solid #E8E8FF;border-radius:12px;padding:20px;margin-bottom:24px;';

    var link = getReferralLink(state.code);
    linkCard.innerHTML = [
      '<label style="display:block;font-size:12px;font-weight:600;color:#666;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px">Your Referral Link</label>',
      '<div style="display:flex;gap:8px;align-items:center">',
      '<input type="text" readonly value="' + link + '" style="flex:1;padding:10px 12px;border:1px solid #ddd;border-radius:8px;font-size:13px;background:#fff;color:#333" />',
      '<button id="cf-copy-referral" style="padding:10px 16px;background:#6C5CE7;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;white-space:nowrap">Copy Link</button>',
      '</div>',
      '<p style="margin:8px 0 0;font-size:12px;color:#888">Code: <strong>' + state.code + '</strong></p>'
    ].join('');
    wrapper.appendChild(linkCard);

    // Stats grid
    var stats = document.createElement('div');
    stats.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px;';

    var statItems = [
      { label: 'Link Clicks', value: state.clicks, icon: '👆' },
      { label: 'Conversions', value: state.referrals, icon: '🎉' },
      { label: 'Free Months Earned', value: state.monthsEarned, icon: '🎁' }
    ];

    statItems.forEach(function (s) {
      var card = document.createElement('div');
      card.style.cssText = 'background:#fff;border:1px solid #eee;border-radius:10px;padding:16px;text-align:center;';
      card.innerHTML = '<div style="font-size:24px;margin-bottom:4px">' + s.icon + '</div>' +
        '<div style="font-size:28px;font-weight:700;color:#1a1a1a">' + s.value + '</div>' +
        '<div style="font-size:12px;color:#888;margin-top:2px">' + s.label + '</div>';
      stats.appendChild(card);
    });
    wrapper.appendChild(stats);

    // How it works
    var howItWorks = document.createElement('div');
    howItWorks.style.cssText = 'background:#FAFAFA;border-radius:12px;padding:20px;';
    howItWorks.innerHTML = [
      '<h3 style="margin:0 0 12px;font-size:16px;color:#333">How it works</h3>',
      '<ol style="margin:0;padding-left:20px;color:#555;font-size:14px;line-height:1.8">',
      '<li>Share your unique referral link with friends</li>',
      '<li>They sign up and subscribe to Pro</li>',
      '<li>You get <strong>1 free month</strong> of Pro for each conversion</li>',
      '</ol>'
    ].join('');
    wrapper.appendChild(howItWorks);

    container.appendChild(wrapper);

    // Bind copy button
    var copyBtn = document.getElementById('cf-copy-referral');
    if (copyBtn) {
      copyBtn.onclick = function () {
        copyReferralLink().then(function () {
          copyBtn.textContent = '✓ Copied!';
          setTimeout(function () { copyBtn.textContent = 'Copy Link'; }, 2000);
        });
      };
    }
  }

  // ─── Public API ───────────────────────────────────────────────────

  function init(opts) {
    if (state.initialized) return;
    state.initialized = true;

    if (opts && opts.email) state.userEmail = opts.email;

    // Detect incoming referral from URL
    detectIncomingReferral();

    // Fetch referral code for logged-in user
    if (getUserEmail()) {
      fetchReferralCode().catch(function (err) {
        console.warn('[ReferralCredits] Could not load referral data:', err.message);
      });
    }

    // Listen for subscription conversions (to trigger referral credit)
    window.addEventListener('cf:webhook', function (e) {
      var event = e.detail;
      if (event && event.type === 'customer.subscription.created') {
        var refCode = null;
        try { refCode = sessionStorage.getItem('cf_referred_by'); } catch (err) { /* noop */ }
        if (refCode) {
          var email = getUserEmail();
          trackConversion(refCode, email);
          try { sessionStorage.removeItem('cf_referred_by'); } catch (err) { /* noop */ }
        }
      }
    });

    console.log('[ReferralCredits] Initialized');
  }

  // ─── Export ───────────────────────────────────────────────────────

  window.CortexFreelancer.ReferralCredits = {
    init: init,
    render: render,
    fetchReferralCode: fetchReferralCode,
    copyReferralLink: copyReferralLink,
    trackConversion: trackConversion,
    detectIncomingReferral: detectIncomingReferral,
    getCode: function () { return state.code; },
    getStats: function () {
      return {
        code: state.code,
        referrals: state.referrals,
        clicks: state.clicks,
        monthsEarned: state.monthsEarned
      };
    }
  };

})();
