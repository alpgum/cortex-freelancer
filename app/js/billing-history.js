/**
 * Cortex Freelancer — Billing History
 * [CF-180] Shows past invoices, payment amounts, dates, and receipt download links from Stripe.
 *
 * Features:
 *   - Fetches invoice history from Stripe via API
 *   - Displays payment amounts, dates, status
 *   - Receipt download links
 *   - Pagination for large histories
 *   - Loading and empty states
 *   - init() / render() interface
 */

(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Constants ────────────────────────────────────────────────────

  var STORAGE_KEY = 'cf_billing_history';
  var API_ENDPOINT = '/api/billing-portal';
  var PAGE_SIZE = 10;

  var INVOICE_STATUS = {
    PAID: 'paid',
    OPEN: 'open',
    DRAFT: 'draft',
    VOID: 'void',
    UNCOLLECTIBLE: 'uncollectible'
  };

  var STATUS_LABELS = {
    paid: { label: 'Paid', className: 'cf-bh-status--paid' },
    open: { label: 'Open', className: 'cf-bh-status--open' },
    draft: { label: 'Draft', className: 'cf-bh-status--draft' },
    void: { label: 'Void', className: 'cf-bh-status--void' },
    uncollectible: { label: 'Failed', className: 'cf-bh-status--failed' }
  };

  // ─── State ────────────────────────────────────────────────────────

  var state = {
    invoices: [],
    loading: false,
    error: null,
    hasMore: false,
    startingAfter: null,
    containerId: 'cf-billing-history',
    initialized: false
  };

  // ─── Helpers ──────────────────────────────────────────────────────

  function getStore() {
    return window.CortexFreelancer.SubscriptionStore || null;
  }

  function getStripeConfig() {
    return window.CortexFreelancer.StripeConfig || null;
  }

  function formatDate(timestamp) {
    if (!timestamp) return '—';
    var d = typeof timestamp === 'number' ? new Date(timestamp * 1000) : new Date(timestamp);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function formatAmount(cents, currency) {
    var config = getStripeConfig();
    if (config && config.formatAmount) return config.formatAmount(cents, currency);
    var dollars = (cents / 100).toFixed(2);
    var symbols = { usd: '$', eur: '€', gbp: '£' };
    var sym = symbols[(currency || 'usd').toLowerCase()] || '$';
    return sym + dollars;
  }

  function esc(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function loadCached() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var data = JSON.parse(raw);
        if (data.timestamp && (Date.now() - data.timestamp) < 5 * 60 * 1000) {
          return data.invoices || [];
        }
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  function saveCache(invoices) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        invoices: invoices,
        timestamp: Date.now()
      }));
    } catch (e) { /* ignore */ }
  }

  // ─── API ──────────────────────────────────────────────────────────

  function fetchInvoices(startingAfter) {
    state.loading = true;
    state.error = null;
    renderUI();

    var url = API_ENDPOINT + '?action=invoices&limit=' + PAGE_SIZE;
    if (startingAfter) url += '&starting_after=' + startingAfter;

    return fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin'
    }).then(function (res) {
      if (!res.ok) throw new Error('Failed to fetch invoices');
      return res.json();
    }).then(function (data) {
      var newInvoices = (data.invoices || data.data || []).map(normalizeInvoice);
      state.invoices = startingAfter ? state.invoices.concat(newInvoices) : newInvoices;
      state.hasMore = data.has_more || false;
      state.startingAfter = newInvoices.length ? newInvoices[newInvoices.length - 1].id : null;
      state.loading = false;
      saveCache(state.invoices);
      renderUI();
      return state.invoices;
    }).catch(function (err) {
      state.loading = false;
      state.error = err.message || 'Failed to load billing history';
      // Try cached data on error
      var cached = loadCached();
      if (cached && cached.length) {
        state.invoices = cached;
        state.error = null;
      }
      renderUI();
    });
  }

  function normalizeInvoice(inv) {
    return {
      id: inv.id || '',
      number: inv.number || inv.id || '',
      date: inv.created || inv.date || null,
      amount: inv.amount_paid || inv.amount_due || inv.total || 0,
      currency: inv.currency || 'usd',
      status: inv.status || 'paid',
      description: inv.description || inv.lines_description || 'Cortex Freelancer Pro',
      receipt_url: inv.hosted_invoice_url || inv.receipt_url || inv.invoice_pdf || null,
      pdf_url: inv.invoice_pdf || null,
      period_start: inv.period_start || null,
      period_end: inv.period_end || null
    };
  }

  // ─── UI Rendering ─────────────────────────────────────────────────

  function renderUI() {
    var container = document.getElementById(state.containerId);
    if (!container) return;

    var html = '<div class="cf-billing-history">';
    html += '<div class="cf-bh-header">';
    html += '<h3 class="cf-bh-title">Billing History</h3>';
    html += '</div>';

    if (state.loading && !state.invoices.length) {
      html += renderLoading();
    } else if (state.error && !state.invoices.length) {
      html += renderError();
    } else if (!state.invoices.length) {
      html += renderEmpty();
    } else {
      html += renderTable();
      if (state.hasMore) {
        html += renderLoadMore();
      }
    }

    html += '</div>';
    container.innerHTML = html;
    bindEvents(container);
  }

  function renderLoading() {
    return '<div class="cf-bh-loading">' +
      '<div class="cf-bh-spinner"></div>' +
      '<p>Loading billing history…</p>' +
      '</div>';
  }

  function renderError() {
    return '<div class="cf-bh-error">' +
      '<p>⚠️ ' + esc(state.error) + '</p>' +
      '<button class="cf-bh-retry" data-action="retry">Try Again</button>' +
      '</div>';
  }

  function renderEmpty() {
    return '<div class="cf-bh-empty">' +
      '<p>No invoices yet.</p>' +
      '<p class="cf-bh-empty-hint">Your billing history will appear here after your first payment.</p>' +
      '</div>';
  }

  function renderTable() {
    var html = '<table class="cf-bh-table">';
    html += '<thead><tr>';
    html += '<th>Date</th>';
    html += '<th>Description</th>';
    html += '<th>Amount</th>';
    html += '<th>Status</th>';
    html += '<th>Receipt</th>';
    html += '</tr></thead>';
    html += '<tbody>';

    state.invoices.forEach(function (inv) {
      var statusInfo = STATUS_LABELS[inv.status] || { label: inv.status, className: '' };
      html += '<tr class="cf-bh-row">';
      html += '<td class="cf-bh-date">' + esc(formatDate(inv.date)) + '</td>';
      html += '<td class="cf-bh-desc">' + esc(inv.description);
      if (inv.number) html += '<span class="cf-bh-number">#' + esc(inv.number) + '</span>';
      html += '</td>';
      html += '<td class="cf-bh-amount">' + esc(formatAmount(inv.amount, inv.currency)) + '</td>';
      html += '<td><span class="cf-bh-status ' + statusInfo.className + '">' + esc(statusInfo.label) + '</span></td>';
      html += '<td class="cf-bh-actions">';
      if (inv.receipt_url) {
        html += '<a href="' + esc(inv.receipt_url) + '" target="_blank" rel="noopener" class="cf-bh-receipt-link">View</a>';
      }
      if (inv.pdf_url) {
        html += ' <a href="' + esc(inv.pdf_url) + '" target="_blank" rel="noopener" class="cf-bh-pdf-link" download>PDF</a>';
      }
      if (!inv.receipt_url && !inv.pdf_url) {
        html += '<span class="cf-bh-na">—</span>';
      }
      html += '</td>';
      html += '</tr>';
    });

    html += '</tbody></table>';
    if (state.loading) html += '<div class="cf-bh-loading-more">Loading more…</div>';
    return html;
  }

  function renderLoadMore() {
    return '<div class="cf-bh-load-more">' +
      '<button class="cf-bh-load-more-btn" data-action="load-more">Load More</button>' +
      '</div>';
  }

  function bindEvents(container) {
    var retryBtn = container.querySelector('[data-action="retry"]');
    if (retryBtn) {
      retryBtn.addEventListener('click', function () {
        state.invoices = [];
        state.startingAfter = null;
        fetchInvoices();
      });
    }

    var loadMoreBtn = container.querySelector('[data-action="load-more"]');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', function () {
        fetchInvoices(state.startingAfter);
      });
    }
  }

  // ─── Public API ───────────────────────────────────────────────────

  var BillingHistory = {
    INVOICE_STATUS: INVOICE_STATUS,

    init: function (opts) {
      opts = opts || {};
      if (opts.containerId) state.containerId = opts.containerId;
      if (opts.apiEndpoint) API_ENDPOINT = opts.apiEndpoint;
      state.initialized = true;

      // Try cached first, then fetch fresh
      var cached = loadCached();
      if (cached && cached.length) {
        state.invoices = cached;
        renderUI();
      }

      return fetchInvoices();
    },

    render: renderUI,

    refresh: function () {
      state.invoices = [];
      state.startingAfter = null;
      return fetchInvoices();
    },

    getInvoices: function () {
      return state.invoices.slice();
    },

    destroy: function () {
      state.invoices = [];
      state.loading = false;
      state.error = null;
      state.initialized = false;
      var container = document.getElementById(state.containerId);
      if (container) container.innerHTML = '';
    }
  };

  window.CortexFreelancer.BillingHistory = BillingHistory;
})();
