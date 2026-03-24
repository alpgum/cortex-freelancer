/**
 * Cortex Freelancer — Subscription Pause/Resume
 * [CF-187] Lets users pause subscription for up to 3 months,
 * maintains data but restricts Pro features, shows paused state UI.
 *
 * Features:
 *   - Pause subscription for 1–3 months via API
 *   - Resume subscription early
 *   - Paused state banner with resume CTA
 *   - Feature restriction during pause (downgrades to Free)
 *   - Pause confirmation modal with duration picker
 *   - Preserves user data throughout pause
 *   - init() / destroy() interface
 */

(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Constants ────────────────────────────────────────────────────

  var PAUSE_API = '/api/subscription';
  var STORAGE_KEY = 'cf_subscription_pause';
  var BANNER_ID = 'cf-pause-banner';
  var MODAL_ID = 'cf-pause-modal';
  var MAX_PAUSE_MONTHS = 3;

  var PAUSE_STATUS = {
    ACTIVE: 'active',
    PAUSED: 'paused',
    RESUMING: 'resuming'
  };

  // ─── State ────────────────────────────────────────────────────────

  var state = {
    initialized: false,
    status: PAUSE_STATUS.ACTIVE,
    pausedAt: null,
    resumesAt: null,
    pauseMonths: 0,
    loading: false,
    unsubscribe: null
  };

  // ─── Helpers ──────────────────────────────────────────────────────

  function getStore() {
    return window.CortexFreelancer.SubscriptionStore || null;
  }

  function getFeatureGate() {
    return window.CortexFreelancer.FeatureGate || null;
  }

  function loadCache() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch (e) { return {}; }
  }

  function saveCache(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
    catch (e) { /* quota */ }
  }

  function clearCache() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* noop */ }
  }

  function formatDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  function daysUntil(dateStr) {
    var diff = new Date(dateStr).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / 86400000));
  }

  // ─── API Calls ────────────────────────────────────────────────────

  function pauseSubscription(months) {
    if (months < 1 || months > MAX_PAUSE_MONTHS) {
      return Promise.reject(new Error('Pause duration must be 1–' + MAX_PAUSE_MONTHS + ' months'));
    }

    state.loading = true;

    return fetch(PAUSE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'pause', months: months })
    })
      .then(function (r) {
        if (!r.ok) throw new Error('Pause request failed');
        return r.json();
      })
      .then(function (data) {
        state.loading = false;
        state.status = PAUSE_STATUS.PAUSED;
        state.pausedAt = data.paused_at || new Date().toISOString();
        state.resumesAt = data.resumes_at || computeResumeDate(months);
        state.pauseMonths = months;

        saveCache({
          status: state.status,
          pausedAt: state.pausedAt,
          resumesAt: state.resumesAt,
          pauseMonths: months
        });

        restrictFeatures();
        showPausedBanner();
        closeModal();

        window.dispatchEvent(new CustomEvent('cf:subscription-paused', {
          detail: { pausedAt: state.pausedAt, resumesAt: state.resumesAt }
        }));

        return data;
      })
      .catch(function (err) {
        state.loading = false;
        console.error('[SubscriptionPause] Pause error:', err);
        throw err;
      });
  }

  function resumeSubscription() {
    state.loading = true;

    return fetch(PAUSE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resume' })
    })
      .then(function (r) {
        if (!r.ok) throw new Error('Resume request failed');
        return r.json();
      })
      .then(function (data) {
        state.loading = false;
        state.status = PAUSE_STATUS.ACTIVE;
        state.pausedAt = null;
        state.resumesAt = null;
        state.pauseMonths = 0;

        clearCache();
        removePausedBanner();
        restoreFeatures();

        window.dispatchEvent(new CustomEvent('cf:subscription-resumed'));

        return data;
      })
      .catch(function (err) {
        state.loading = false;
        console.error('[SubscriptionPause] Resume error:', err);
        throw err;
      });
  }

  function computeResumeDate(months) {
    var d = new Date();
    d.setMonth(d.getMonth() + months);
    return d.toISOString();
  }

  // ─── Feature Restriction ─────────────────────────────────────────

  function restrictFeatures() {
    var gate = getFeatureGate();
    if (gate && typeof gate.setOverride === 'function') {
      gate.setOverride('paused', true);
    }
    // Dispatch event for other modules to pick up
    window.dispatchEvent(new CustomEvent('cf:features-restricted', {
      detail: { reason: 'subscription_paused' }
    }));
  }

  function restoreFeatures() {
    var gate = getFeatureGate();
    if (gate && typeof gate.clearOverride === 'function') {
      gate.clearOverride('paused');
    }
    window.dispatchEvent(new CustomEvent('cf:features-restored'));
  }

  // ─── Paused Banner ───────────────────────────────────────────────

  function showPausedBanner() {
    removePausedBanner();

    var el = document.createElement('div');
    el.id = BANNER_ID;
    el.setAttribute('role', 'status');

    el.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:9999',
      'padding:14px 20px', 'display:flex', 'align-items:center', 'gap:12px',
      'font-family:-apple-system,BlinkMacSystemFont,sans-serif', 'font-size:14px',
      'background:#E3F2FD', 'border-bottom:2px solid #2196F3',
      'color:#0D47A1', 'box-shadow:0 2px 8px rgba(0,0,0,0.08)'
    ].join(';');

    var icon = document.createElement('span');
    icon.textContent = '⏸️';
    icon.style.fontSize = '18px';
    el.appendChild(icon);

    var msg = document.createElement('span');
    msg.style.flex = '1';

    var days = state.resumesAt ? daysUntil(state.resumesAt) : 0;
    msg.innerHTML = '<strong>Subscription paused.</strong> ' +
      'Your data is safe. Pro features resume on ' + formatDate(state.resumesAt) +
      ' (' + days + ' days). ';
    el.appendChild(msg);

    var btn = document.createElement('button');
    btn.textContent = 'Resume Now';
    btn.style.cssText = [
      'background:#2196F3', 'color:#fff', 'border:none',
      'padding:8px 16px', 'border-radius:6px', 'cursor:pointer',
      'font-size:13px', 'font-weight:600', 'white-space:nowrap'
    ].join(';');
    btn.onclick = function () {
      btn.textContent = 'Resuming…';
      btn.disabled = true;
      resumeSubscription().catch(function () {
        btn.textContent = 'Resume Now';
        btn.disabled = false;
      });
    };
    el.appendChild(btn);

    document.body.insertBefore(el, document.body.firstChild);
  }

  function removePausedBanner() {
    var el = document.getElementById(BANNER_ID);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  // ─── Pause Confirmation Modal ────────────────────────────────────

  function showPauseModal() {
    closeModal();

    var overlay = document.createElement('div');
    overlay.id = MODAL_ID;
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:10001',
      'background:rgba(0,0,0,0.5)', 'display:flex',
      'align-items:center', 'justify-content:center',
      'font-family:-apple-system,BlinkMacSystemFont,sans-serif'
    ].join(';');

    var modal = document.createElement('div');
    modal.style.cssText = [
      'background:#fff', 'border-radius:12px', 'padding:32px',
      'max-width:440px', 'width:90%', 'box-shadow:0 16px 48px rgba(0,0,0,0.2)'
    ].join(';');

    modal.innerHTML = [
      '<h2 style="margin:0 0 8px;font-size:20px;color:#1a1a1a">Pause your subscription?</h2>',
      '<p style="margin:0 0 20px;color:#666;font-size:14px;line-height:1.5">',
      'Your data will be preserved. Pro features will be restricted until you resume. ',
      'You won\'t be charged during the pause.</p>',
      '<label style="display:block;margin-bottom:16px;font-size:14px;color:#333;font-weight:500">',
      'Pause duration',
      '<select id="cf-pause-duration" style="display:block;width:100%;margin-top:6px;padding:10px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;background:#fff">',
      '<option value="1">1 month</option>',
      '<option value="2">2 months</option>',
      '<option value="3">3 months</option>',
      '</select></label>',
      '<div style="display:flex;gap:12px;justify-content:flex-end">',
      '<button id="cf-pause-cancel" style="padding:10px 20px;border:1px solid #ddd;border-radius:8px;background:#fff;cursor:pointer;font-size:14px;color:#666">Cancel</button>',
      '<button id="cf-pause-confirm" style="padding:10px 20px;border:none;border-radius:8px;background:#2196F3;color:#fff;cursor:pointer;font-size:14px;font-weight:600">Pause Subscription</button>',
      '</div>'
    ].join('');

    overlay.appendChild(modal);
    overlay.onclick = function (e) { if (e.target === overlay) closeModal(); };

    document.body.appendChild(overlay);

    document.getElementById('cf-pause-cancel').onclick = closeModal;
    document.getElementById('cf-pause-confirm').onclick = function () {
      var select = document.getElementById('cf-pause-duration');
      var months = parseInt(select.value, 10);
      var btn = document.getElementById('cf-pause-confirm');
      btn.textContent = 'Pausing…';
      btn.disabled = true;
      pauseSubscription(months).catch(function () {
        btn.textContent = 'Pause Subscription';
        btn.disabled = false;
      });
    };
  }

  function closeModal() {
    var el = document.getElementById(MODAL_ID);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  // ─── Subscription Listener ───────────────────────────────────────

  function handleSubscriptionChange(sub) {
    if (!sub) return;

    if (sub.pause_collection || sub.status === 'paused') {
      state.status = PAUSE_STATUS.PAUSED;
      state.pausedAt = sub.paused_at || sub.pause_collection_behavior_date || new Date().toISOString();
      state.resumesAt = sub.resumes_at || sub.pause_collection_resumes_at || null;

      saveCache({
        status: state.status,
        pausedAt: state.pausedAt,
        resumesAt: state.resumesAt
      });

      restrictFeatures();
      showPausedBanner();
    } else if (state.status === PAUSE_STATUS.PAUSED) {
      // Subscription is no longer paused
      state.status = PAUSE_STATUS.ACTIVE;
      state.pausedAt = null;
      state.resumesAt = null;
      clearCache();
      removePausedBanner();
      restoreFeatures();
    }
  }

  // ─── Public API ───────────────────────────────────────────────────

  function init() {
    if (state.initialized) return;
    state.initialized = true;

    // Restore from cache
    var cache = loadCache();
    if (cache.status === PAUSE_STATUS.PAUSED) {
      state.status = cache.status;
      state.pausedAt = cache.pausedAt;
      state.resumesAt = cache.resumesAt;
      state.pauseMonths = cache.pauseMonths || 0;

      // Check if pause has expired
      if (state.resumesAt && new Date(state.resumesAt) <= new Date()) {
        clearCache();
        state.status = PAUSE_STATUS.ACTIVE;
      } else {
        restrictFeatures();
        showPausedBanner();
      }
    }

    // Listen to SubscriptionStore
    var store = getStore();
    if (store && typeof store.onStateChange === 'function') {
      state.unsubscribe = store.onStateChange(handleSubscriptionChange);
    }

    if (store && typeof store.getSubscription === 'function') {
      var sub = store.getSubscription();
      if (sub) handleSubscriptionChange(sub);
    }

    console.log('[SubscriptionPause] Initialized');
  }

  function destroy() {
    removePausedBanner();
    closeModal();
    if (state.unsubscribe) state.unsubscribe();
    state.initialized = false;
    state.status = PAUSE_STATUS.ACTIVE;
  }

  function isPaused() {
    return state.status === PAUSE_STATUS.PAUSED;
  }

  function getPauseInfo() {
    return {
      status: state.status,
      pausedAt: state.pausedAt,
      resumesAt: state.resumesAt,
      pauseMonths: state.pauseMonths,
      daysRemaining: state.resumesAt ? daysUntil(state.resumesAt) : 0
    };
  }

  // ─── Export ───────────────────────────────────────────────────────

  window.CortexFreelancer.SubscriptionPause = {
    init: init,
    destroy: destroy,
    showPauseModal: showPauseModal,
    pauseSubscription: pauseSubscription,
    resumeSubscription: resumeSubscription,
    isPaused: isPaused,
    getPauseInfo: getPauseInfo,
    MAX_PAUSE_MONTHS: MAX_PAUSE_MONTHS
  };

})();
