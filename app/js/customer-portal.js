/**
 * Cortex Freelancer — Stripe Customer Portal
 * [CF-179] Self-service billing portal for plan management.
 *
 * Features:
 *   - Creates Stripe billing portal sessions
 *   - Manage subscription, payment methods, invoices
 *   - Billing history display
 *   - Quick action buttons (update card, cancel, change plan)
 *   - init()/render(containerId) interface
 */

(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Constants ────────────────────────────────────────────────────

  var PORTAL_API_URL = '/api/stripe/portal';
  var STORAGE_KEY = 'cf_billing_cache';

  // ─── State ────────────────────────────────────────────────────────

  var state = {
    loading: false,
    error: null,
    portalUrl: null,
    returnUrl: null
  };

  // ─── Helpers ──────────────────────────────────────────────────────

  function getStore() {
    return window.CortexFreelancer.SubscriptionStore || null;
  }

  function formatDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function getSubscriptionInfo() {
    var store = getStore();
    if (!store) return { plan: 'free', status: 'free', period_end: null, stripe_customer_id: null };
    return store.getSubscription();
  }

  // ─── Portal Session ───────────────────────────────────────────────

  function createPortalSession(returnUrl) {
    state.loading = true;
    state.error = null;

    var sub = getSubscriptionInfo();

    return fetch(PORTAL_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: sub.stripe_customer_id,
        return_url: returnUrl || state.returnUrl || window.location.href
      })
    })
      .then(function (r) {
        if (!r.ok) throw new Error('Failed to create portal session');
        return r.json();
      })
      .then(function (data) {
        state.loading = false;
        if (data.url) {
          state.portalUrl = data.url;
          return data.url;
        }
        throw new Error('No portal URL returned');
      })
      .catch(function (err) {
        state.loading = false;
        state.error = err.message;
        throw err;
      });
  }

  function openPortal(returnUrl) {
    return createPortalSession(returnUrl).then(function (url) {
      window.location.href = url;
    });
  }

  // ─── Render ───────────────────────────────────────────────────────

  function render(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var sub = getSubscriptionInfo();
    var isPro = sub.plan === 'pro' && (sub.status === 'active' || sub.status === 'trialing');

    var statusColor = isPro ? '#059669' : '#6b7280';
    var statusLabel = isPro ? 'Active' : sub.status === 'past_due' ? 'Past Due' : sub.status === 'canceled' ? 'Canceled' : 'Free';
    var planLabel = isPro ? 'Pro' : 'Free';

    var html = [
      '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;">',
      '  <div style="background:#fff; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden;">',
      '',
      '    <!-- Header -->',
      '    <div style="padding:24px; border-bottom:1px solid #f3f4f6;">',
      '      <div style="display:flex; align-items:center; justify-content:space-between;">',
      '        <div>',
      '          <h3 style="margin:0 0 4px; font-size:18px; color:#111827;">Billing & Subscription</h3>',
      '          <p style="margin:0; font-size:13px; color:#9ca3af;">Manage your plan and payment</p>',
      '        </div>',
      '        <div style="padding:4px 12px; background:' + (isPro ? '#ecfdf5' : '#f3f4f6') + '; border-radius:9999px;">',
      '          <span style="font-size:13px; font-weight:600; color:' + statusColor + ';">' + planLabel + '</span>',
      '        </div>',
      '      </div>',
      '    </div>',
      '',
      '    <!-- Plan Details -->',
      '    <div style="padding:20px 24px; display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:16px;">',
      '      <div>',
      '        <p style="margin:0 0 2px; font-size:11px; text-transform:uppercase; letter-spacing:0.05em; color:#9ca3af;">Plan</p>',
      '        <p style="margin:0; font-size:15px; font-weight:600; color:#111827;">' + planLabel + '</p>',
      '      </div>',
      '      <div>',
      '        <p style="margin:0 0 2px; font-size:11px; text-transform:uppercase; letter-spacing:0.05em; color:#9ca3af;">Status</p>',
      '        <p style="margin:0; font-size:15px; font-weight:600; color:' + statusColor + ';">' + statusLabel + '</p>',
      '      </div>',
      '      <div>',
      '        <p style="margin:0 0 2px; font-size:11px; text-transform:uppercase; letter-spacing:0.05em; color:#9ca3af;">' + (isPro ? 'Renews' : 'Period End') + '</p>',
      '        <p style="margin:0; font-size:15px; font-weight:600; color:#111827;">' + formatDate(sub.period_end) + '</p>',
      '      </div>',
      '    </div>',
      '',
      '    <!-- Actions -->',
      '    <div style="padding:16px 24px 24px; display:flex; flex-wrap:wrap; gap:10px;">',
      isPro ? [
        '      <button data-portal-action="manage" style="padding:10px 20px; background:#7c3aed; color:#fff; border:none; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer;">Manage Subscription</button>',
        '      <button data-portal-action="payment" style="padding:10px 20px; background:#fff; color:#374151; border:1px solid #d1d5db; border-radius:8px; font-size:13px; font-weight:500; cursor:pointer;">Update Payment</button>',
        '      <button data-portal-action="invoices" style="padding:10px 20px; background:#fff; color:#374151; border:1px solid #d1d5db; border-radius:8px; font-size:13px; font-weight:500; cursor:pointer;">View Invoices</button>'
      ].join('\n') : [
        '      <button data-portal-action="upgrade" style="padding:10px 20px; background:#7c3aed; color:#fff; border:none; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer;">Upgrade to Pro</button>'
      ].join('\n'),
      '    </div>',
      '',
      '    <!-- Error -->',
      state.error ? '<div style="padding:12px 24px; background:#fef2f2; color:#dc2626; font-size:13px;">' + state.error + '</div>' : '',
      '',
      '  </div>',
      '</div>'
    ].join('\n');

    container.innerHTML = html;

    // Bind actions
    container.querySelectorAll('[data-portal-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var action = btn.getAttribute('data-portal-action');
        handleAction(action, btn, containerId);
      });
    });
  }

  function handleAction(action, btn, containerId) {
    if (action === 'upgrade') {
      var modal = window.CortexFreelancer.UpgradeModal;
      if (modal && modal.show) {
        modal.show();
      }
      return;
    }

    // For manage/payment/invoices, open Stripe portal
    var origText = btn.textContent;
    btn.textContent = 'Opening...';
    btn.disabled = true;

    openPortal().catch(function () {
      btn.textContent = origText;
      btn.disabled = false;
      render(containerId);
    });
  }

  // ─── Public API ───────────────────────────────────────────────────

  var CustomerPortal = {
    init: function (opts) {
      opts = opts || {};
      if (opts.portalApiUrl) PORTAL_API_URL = opts.portalApiUrl;
      if (opts.returnUrl) state.returnUrl = opts.returnUrl;
    },

    render: render,
    createSession: createPortalSession,
    open: openPortal,

    isLoading: function () { return state.loading; },
    getError: function () { return state.error; }
  };

  window.CortexFreelancer.CustomerPortal = CustomerPortal;
})();
