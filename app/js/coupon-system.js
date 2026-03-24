/**
 * Cortex Freelancer — Coupon / Promo Code System
 * [CF-181] Validates and applies Stripe coupon codes at checkout.
 *
 * Features:
 *   - Input field with validation feedback
 *   - Calls api/apply-coupon.js for server-side validation
 *   - Discount preview with original vs discounted price
 *   - Debounced validation
 *   - Stores applied coupon for checkout flow
 *   - init() / render() interface
 */

(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Constants ────────────────────────────────────────────────────

  var API_ENDPOINT = '/api/apply-coupon';
  var STORAGE_KEY = 'cf_applied_coupon';
  var DEBOUNCE_MS = 500;

  var COUPON_STATE = {
    IDLE: 'idle',
    VALIDATING: 'validating',
    VALID: 'valid',
    INVALID: 'invalid',
    ERROR: 'error'
  };

  // ─── State ────────────────────────────────────────────────────────

  var state = {
    code: '',
    couponState: COUPON_STATE.IDLE,
    couponData: null,
    errorMessage: '',
    containerId: 'cf-coupon-input',
    debounceTimer: null,
    eventHandlers: {}
  };

  // ─── Helpers ──────────────────────────────────────────────────────

  function getStripeConfig() {
    return window.CortexFreelancer.StripeConfig || null;
  }

  function esc(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function emit(event, data) {
    var handlers = state.eventHandlers[event] || [];
    handlers.forEach(function (fn) {
      try { fn(data); } catch (e) { console.error('[CouponSystem] handler error:', e); }
    });
  }

  function saveCoupon(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* ignore */ }
  }

  function loadCoupon() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function clearCoupon() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) { /* ignore */ }
  }

  // ─── API ──────────────────────────────────────────────────────────

  function validateCoupon(code) {
    if (!code || !code.trim()) {
      state.couponState = COUPON_STATE.IDLE;
      state.couponData = null;
      state.errorMessage = '';
      clearCoupon();
      renderUI();
      emit('clear', null);
      return Promise.resolve(null);
    }

    state.couponState = COUPON_STATE.VALIDATING;
    state.code = code.trim().toUpperCase();
    renderUI();

    return fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ code: state.code })
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) {
          state.couponState = COUPON_STATE.INVALID;
          state.couponData = null;
          state.errorMessage = data.message || 'Invalid coupon code';
          clearCoupon();
          renderUI();
          emit('invalid', { code: state.code, message: state.errorMessage });
          return null;
        }
        state.couponState = COUPON_STATE.VALID;
        state.couponData = data;
        state.errorMessage = '';
        saveCoupon(data);
        renderUI();
        emit('applied', data);
        return data;
      });
    }).catch(function (err) {
      state.couponState = COUPON_STATE.ERROR;
      state.errorMessage = 'Could not validate coupon. Please try again.';
      renderUI();
      emit('error', err);
      return null;
    });
  }

  function debouncedValidate(code) {
    if (state.debounceTimer) clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(function () {
      validateCoupon(code);
    }, DEBOUNCE_MS);
  }

  // ─── Discount Preview ─────────────────────────────────────────────

  function getDiscountPreview(planId) {
    var config = getStripeConfig();
    if (!config || !state.couponData) return null;

    var price = config.getPrice(planId);
    if (!price) return null;

    var discount = state.couponData.discount || '';
    var match = discount.match(/(\d+)%/);
    if (!match) return null;

    var pct = parseInt(match[1], 10);
    var originalCents = price.amount;
    var discountCents = Math.round(originalCents * pct / 100);
    var finalCents = originalCents - discountCents;

    return {
      original: config.formatAmount(originalCents, price.currency),
      discount: config.formatAmount(discountCents, price.currency),
      final: config.formatAmount(finalCents, price.currency),
      percent: pct,
      description: discount
    };
  }

  // ─── UI Rendering ─────────────────────────────────────────────────

  function renderUI() {
    var container = document.getElementById(state.containerId);
    if (!container) return;

    var html = '<div class="cf-coupon">';
    html += '<div class="cf-coupon-input-row">';
    html += '<input type="text" class="cf-coupon-field" placeholder="Promo code" ';
    html += 'value="' + esc(state.code) + '" data-action="coupon-input" autocomplete="off" spellcheck="false">';
    html += '<button class="cf-coupon-apply" data-action="apply-coupon" ';
    if (state.couponState === COUPON_STATE.VALIDATING) html += 'disabled';
    html += '>';
    html += state.couponState === COUPON_STATE.VALIDATING ? 'Checking…' : 'Apply';
    html += '</button>';
    html += '</div>';

    // Feedback
    if (state.couponState === COUPON_STATE.VALID && state.couponData) {
      html += '<div class="cf-coupon-feedback cf-coupon-feedback--valid">';
      html += '<span class="cf-coupon-check">✓</span> ';
      html += '<strong>' + esc(state.couponData.code) + '</strong> — ' + esc(state.couponData.discount);
      html += ' <button class="cf-coupon-remove" data-action="remove-coupon">Remove</button>';
      html += '</div>';
    } else if (state.couponState === COUPON_STATE.INVALID) {
      html += '<div class="cf-coupon-feedback cf-coupon-feedback--invalid">';
      html += '<span class="cf-coupon-x">✗</span> ' + esc(state.errorMessage);
      html += '</div>';
    } else if (state.couponState === COUPON_STATE.ERROR) {
      html += '<div class="cf-coupon-feedback cf-coupon-feedback--error">';
      html += '⚠️ ' + esc(state.errorMessage);
      html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;
    bindEvents(container);
  }

  function bindEvents(container) {
    var input = container.querySelector('[data-action="coupon-input"]');
    if (input) {
      input.addEventListener('input', function () {
        state.code = input.value;
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          validateCoupon(input.value);
        }
      });
    }

    var applyBtn = container.querySelector('[data-action="apply-coupon"]');
    if (applyBtn) {
      applyBtn.addEventListener('click', function () {
        var field = container.querySelector('[data-action="coupon-input"]');
        validateCoupon(field ? field.value : state.code);
      });
    }

    var removeBtn = container.querySelector('[data-action="remove-coupon"]');
    if (removeBtn) {
      removeBtn.addEventListener('click', function () {
        state.code = '';
        state.couponState = COUPON_STATE.IDLE;
        state.couponData = null;
        clearCoupon();
        renderUI();
        emit('removed', null);
      });
    }
  }

  // ─── Public API ───────────────────────────────────────────────────

  var CouponSystem = {
    COUPON_STATE: COUPON_STATE,

    init: function (opts) {
      opts = opts || {};
      if (opts.containerId) state.containerId = opts.containerId;
      if (opts.apiEndpoint) API_ENDPOINT = opts.apiEndpoint;

      // Restore previously applied coupon
      var saved = loadCoupon();
      if (saved && saved.code) {
        state.code = saved.code;
        state.couponData = saved;
        state.couponState = COUPON_STATE.VALID;
      }

      renderUI();
    },

    validate: validateCoupon,
    render: renderUI,

    getAppliedCoupon: function () {
      return state.couponData;
    },

    getStripeCouponId: function () {
      return state.couponData ? state.couponData.stripe_coupon : null;
    },

    getDiscountPreview: getDiscountPreview,

    isApplied: function () {
      return state.couponState === COUPON_STATE.VALID && !!state.couponData;
    },

    clear: function () {
      state.code = '';
      state.couponState = COUPON_STATE.IDLE;
      state.couponData = null;
      state.errorMessage = '';
      clearCoupon();
      renderUI();
      emit('clear', null);
    },

    on: function (event, handler) {
      if (!state.eventHandlers[event]) state.eventHandlers[event] = [];
      state.eventHandlers[event].push(handler);
    },

    off: function (event, handler) {
      if (!state.eventHandlers[event]) return;
      state.eventHandlers[event] = state.eventHandlers[event].filter(function (h) {
        return h !== handler;
      });
    },

    destroy: function () {
      state.eventHandlers = {};
      state.couponData = null;
      state.couponState = COUPON_STATE.IDLE;
      var container = document.getElementById(state.containerId);
      if (container) container.innerHTML = '';
    }
  };

  window.CortexFreelancer.CouponSystem = CouponSystem;
})();
