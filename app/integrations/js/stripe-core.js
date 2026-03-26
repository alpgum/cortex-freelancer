/**
 * Stripe Payment Integration Core Engine
 * Cortex Freelancer - Phase 3 (cf3-025)
 * 
 * Full payment processing, invoicing, subscriptions, and client payment history.
 * Integrates with: Client Directory, Invoice System, Communication Hub, AI Analytics
 */

'use strict';

const StripePayments = (() => {
  // ── Config ──────────────────────────────────────────────
  const STORAGE_KEYS = {
    config: 'cortex_stripe_config',
    invoices: 'cortex_stripe_invoices',
    payments: 'cortex_stripe_payments',
    subscriptions: 'cortex_stripe_subscriptions',
    notifications: 'cortex_stripe_notifications',
    taxRates: 'cortex_stripe_tax_rates',
    paymentLinks: 'cortex_stripe_payment_links'
  };

  const DEFAULT_CONFIG = {
    stripePublishableKey: '',
    stripeSecretKey: '',
    webhookSecret: '',
    currency: 'USD',
    taxEnabled: true,
    defaultTaxRate: 0,
    autoReminders: true,
    reminderDays: [7, 3, 1, 0],
    lateFeeEnabled: false,
    lateFeePercent: 1.5,
    paymentMethods: ['card'],
    invoicePrefix: 'INV',
    invoiceNumberStart: 1001,
    companyName: '',
    companyEmail: '',
    companyAddress: '',
    connectedAccountId: '',
    testMode: true,
    notifications: {
      paymentReceived: true,
      invoiceOverdue: true,
      subscriptionRenewed: true,
      paymentFailed: true
    }
  };

  const PAYMENT_STATUSES = {
    PENDING: 'pending',
    PROCESSING: 'processing',
    PAID: 'paid',
    OVERDUE: 'overdue',
    REFUNDED: 'refunded',
    CANCELLED: 'cancelled',
    FAILED: 'failed'
  };

  const SUBSCRIPTION_STATUSES = {
    ACTIVE: 'active',
    PAUSED: 'paused',
    CANCELLED: 'cancelled',
    PAST_DUE: 'past_due',
    TRIALING: 'trialing'
  };

  // ── Storage Helpers ─────────────────────────────────────
  function load(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch { return null; }
  }

  function save(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch { return false; }
  }

  function genId(prefix = 'pay') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function formatCurrency(amount, currency) {
    const cur = currency || getConfig().currency || 'USD';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(amount);
  }

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function daysBetween(d1, d2) {
    return Math.ceil((new Date(d2) - new Date(d1)) / (1000 * 60 * 60 * 24));
  }

  // ── Config Management ───────────────────────────────────
  function getConfig() {
    return { ...DEFAULT_CONFIG, ...(load(STORAGE_KEYS.config) || {}) };
  }

  function saveConfig(updates) {
    const config = { ...getConfig(), ...updates };
    save(STORAGE_KEYS.config, config);
    return config;
  }

  function isConfigured() {
    const c = getConfig();
    return !!(c.stripePublishableKey && c.stripeSecretKey);
  }

  function getConnectionStatus() {
    const c = getConfig();
    if (!c.stripePublishableKey) return 'disconnected';
    if (c.testMode) return 'testing';
    return 'connected';
  }

  // ── Invoice Management ──────────────────────────────────
  function getInvoices() {
    return load(STORAGE_KEYS.invoices) || [];
  }

  function getInvoice(id) {
    return getInvoices().find(inv => inv.id === id);
  }

  function generateInvoiceNumber() {
    const config = getConfig();
    const invoices = getInvoices();
    const maxNum = invoices.reduce((max, inv) => {
      const num = parseInt(inv.invoiceNumber.replace(config.invoicePrefix + '-', ''));
      return isNaN(num) ? max : Math.max(max, num);
    }, config.invoiceNumberStart - 1);
    return `${config.invoicePrefix}-${String(maxNum + 1).padStart(4, '0')}`;
  }

  function createInvoice(data) {
    const config = getConfig();
    const invoices = getInvoices();

    const subtotal = (data.items || []).reduce((sum, item) => sum + (item.quantity * item.rate), 0);
    const taxAmount = config.taxEnabled ? subtotal * ((data.taxRate || config.defaultTaxRate) / 100) : 0;
    const total = subtotal + taxAmount;

    const invoice = {
      id: genId('inv'),
      invoiceNumber: data.invoiceNumber || generateInvoiceNumber(),
      clientId: data.clientId || '',
      clientName: data.clientName || '',
      clientEmail: data.clientEmail || '',
      projectId: data.projectId || '',
      projectName: data.projectName || '',
      items: data.items || [],
      subtotal,
      taxRate: data.taxRate || config.defaultTaxRate,
      taxAmount,
      total,
      currency: data.currency || config.currency,
      status: PAYMENT_STATUSES.PENDING,
      issueDate: data.issueDate || new Date().toISOString().split('T')[0],
      dueDate: data.dueDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      notes: data.notes || '',
      paymentLink: '',
      stripeInvoiceId: '',
      paidAmount: 0,
      paidDate: null,
      reminders: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Generate payment link
    invoice.paymentLink = generatePaymentLink(invoice);

    invoices.push(invoice);
    save(STORAGE_KEYS.invoices, invoices);

    addNotification('invoice', `Invoice ${invoice.invoiceNumber} created for ${invoice.clientName}`, invoice.id);
    syncToClientDirectory(invoice.clientId, 'invoice_created', invoice);

    return invoice;
  }

  function updateInvoice(id, updates) {
    const invoices = getInvoices();
    const idx = invoices.findIndex(inv => inv.id === id);
    if (idx === -1) return null;

    const config = getConfig();
    if (updates.items) {
      updates.subtotal = updates.items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
      const rate = updates.taxRate ?? invoices[idx].taxRate;
      updates.taxAmount = config.taxEnabled ? updates.subtotal * (rate / 100) : 0;
      updates.total = updates.subtotal + updates.taxAmount;
    }

    invoices[idx] = { ...invoices[idx], ...updates, updatedAt: new Date().toISOString() };
    save(STORAGE_KEYS.invoices, invoices);
    return invoices[idx];
  }

  function deleteInvoice(id) {
    const invoices = getInvoices().filter(inv => inv.id !== id);
    save(STORAGE_KEYS.invoices, invoices);
  }

  function markInvoicePaid(id, paymentData = {}) {
    const invoice = getInvoice(id);
    if (!invoice) return null;

    const payment = recordPayment({
      invoiceId: id,
      clientId: invoice.clientId,
      clientName: invoice.clientName,
      amount: paymentData.amount || invoice.total,
      method: paymentData.method || 'stripe',
      reference: paymentData.reference || '',
      note: `Payment for ${invoice.invoiceNumber}`
    });

    const updated = updateInvoice(id, {
      status: PAYMENT_STATUSES.PAID,
      paidAmount: invoice.total,
      paidDate: new Date().toISOString()
    });

    addNotification('success', `Payment received: ${formatCurrency(invoice.total)} for ${invoice.invoiceNumber}`, id);
    syncToClientDirectory(invoice.clientId, 'payment_received', { invoice: updated, payment });

    return { invoice: updated, payment };
  }

  function getOverdueInvoices() {
    const today = new Date().toISOString().split('T')[0];
    return getInvoices().filter(inv =>
      inv.status === PAYMENT_STATUSES.PENDING && inv.dueDate < today
    );
  }

  function sendReminder(invoiceId) {
    const invoice = getInvoice(invoiceId);
    if (!invoice) return false;

    const reminder = {
      sentAt: new Date().toISOString(),
      type: 'payment_reminder',
      method: 'email'
    };

    const reminders = [...(invoice.reminders || []), reminder];
    updateInvoice(invoiceId, { reminders });

    addNotification('warning', `Payment reminder sent for ${invoice.invoiceNumber} to ${invoice.clientName}`, invoiceId);

    // Integration: Communication Hub
    triggerCommHubReminder(invoice);

    return true;
  }

  // ── Payment Processing ──────────────────────────────────
  function getPayments() {
    return load(STORAGE_KEYS.payments) || [];
  }

  function recordPayment(data) {
    const payments = getPayments();

    const payment = {
      id: genId('pmt'),
      invoiceId: data.invoiceId || '',
      clientId: data.clientId || '',
      clientName: data.clientName || '',
      amount: data.amount || 0,
      currency: data.currency || getConfig().currency,
      method: data.method || 'stripe',
      status: PAYMENT_STATUSES.PAID,
      reference: data.reference || genId('ref'),
      stripePaymentIntentId: data.stripePaymentIntentId || '',
      note: data.note || '',
      fee: data.amount * 0.029 + 0.30, // Stripe standard fee
      netAmount: data.amount - (data.amount * 0.029 + 0.30),
      processedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    payments.push(payment);
    save(STORAGE_KEYS.payments, payments);

    return payment;
  }

  function processRefund(paymentId, amount = null) {
    const payments = getPayments();
    const idx = payments.findIndex(p => p.id === paymentId);
    if (idx === -1) return null;

    const refundAmount = amount || payments[idx].amount;
    const refund = {
      id: genId('ref'),
      paymentId,
      amount: refundAmount,
      status: 'processed',
      processedAt: new Date().toISOString()
    };

    payments[idx].status = amount && amount < payments[idx].amount ? 'partial_refund' : PAYMENT_STATUSES.REFUNDED;
    payments[idx].refund = refund;
    save(STORAGE_KEYS.payments, payments);

    addNotification('error', `Refund processed: ${formatCurrency(refundAmount)} for ${payments[idx].clientName}`, paymentId);

    // Update associated invoice if exists
    if (payments[idx].invoiceId) {
      const invoice = getInvoice(payments[idx].invoiceId);
      if (invoice) {
        updateInvoice(payments[idx].invoiceId, {
          status: PAYMENT_STATUSES.REFUNDED,
          paidAmount: Math.max(0, invoice.paidAmount - refundAmount)
        });
      }
    }

    return { payment: payments[idx], refund };
  }

  function getPaymentsByClient(clientId) {
    return getPayments().filter(p => p.clientId === clientId);
  }

  function getPaymentsByDateRange(startDate, endDate) {
    return getPayments().filter(p => p.processedAt >= startDate && p.processedAt <= endDate);
  }

  // ── Subscription Billing ────────────────────────────────
  function getSubscriptions() {
    return load(STORAGE_KEYS.subscriptions) || [];
  }

  function getSubscription(id) {
    return getSubscriptions().find(s => s.id === id);
  }

  function createSubscription(data) {
    const subscriptions = getSubscriptions();

    const sub = {
      id: genId('sub'),
      clientId: data.clientId || '',
      clientName: data.clientName || '',
      clientEmail: data.clientEmail || '',
      planName: data.planName || 'Retainer',
      amount: data.amount || 0,
      currency: data.currency || getConfig().currency,
      interval: data.interval || 'monthly', // monthly, quarterly, yearly
      status: SUBSCRIPTION_STATUSES.ACTIVE,
      startDate: data.startDate || new Date().toISOString().split('T')[0],
      currentPeriodStart: data.startDate || new Date().toISOString().split('T')[0],
      currentPeriodEnd: calcNextBillingDate(data.startDate || new Date().toISOString().split('T')[0], data.interval || 'monthly'),
      nextBillingDate: calcNextBillingDate(data.startDate || new Date().toISOString().split('T')[0], data.interval || 'monthly'),
      cancelAt: null,
      stripeSubscriptionId: '',
      invoiceHistory: [],
      totalBilled: 0,
      totalPaid: 0,
      description: data.description || '',
      autoInvoice: data.autoInvoice !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    subscriptions.push(sub);
    save(STORAGE_KEYS.subscriptions, subscriptions);

    addNotification('info', `Subscription created: ${sub.planName} for ${sub.clientName} (${formatCurrency(sub.amount)}/${sub.interval})`, sub.id);

    return sub;
  }

  function updateSubscription(id, updates) {
    const subs = getSubscriptions();
    const idx = subs.findIndex(s => s.id === id);
    if (idx === -1) return null;

    subs[idx] = { ...subs[idx], ...updates, updatedAt: new Date().toISOString() };
    save(STORAGE_KEYS.subscriptions, subs);
    return subs[idx];
  }

  function cancelSubscription(id, cancelImmediately = false) {
    const sub = getSubscription(id);
    if (!sub) return null;

    const updates = cancelImmediately
      ? { status: SUBSCRIPTION_STATUSES.CANCELLED }
      : { cancelAt: sub.currentPeriodEnd, status: SUBSCRIPTION_STATUSES.ACTIVE };

    const updated = updateSubscription(id, updates);
    addNotification('warning', `Subscription ${cancelImmediately ? 'cancelled' : 'set to cancel'}: ${sub.planName} for ${sub.clientName}`, id);
    return updated;
  }

  function pauseSubscription(id) {
    return updateSubscription(id, { status: SUBSCRIPTION_STATUSES.PAUSED });
  }

  function resumeSubscription(id) {
    return updateSubscription(id, { status: SUBSCRIPTION_STATUSES.ACTIVE });
  }

  function processSubscriptionBilling() {
    const today = new Date().toISOString().split('T')[0];
    const subs = getSubscriptions();
    const results = [];

    subs.forEach(sub => {
      if (sub.status !== SUBSCRIPTION_STATUSES.ACTIVE) return;
      if (sub.nextBillingDate > today) return;

      // Check if should cancel
      if (sub.cancelAt && sub.cancelAt <= today) {
        updateSubscription(sub.id, { status: SUBSCRIPTION_STATUSES.CANCELLED });
        return;
      }

      // Generate invoice for this period
      if (sub.autoInvoice) {
        const invoice = createInvoice({
          clientId: sub.clientId,
          clientName: sub.clientName,
          clientEmail: sub.clientEmail,
          projectName: sub.planName,
          items: [{
            description: `${sub.planName} - ${sub.interval} billing`,
            quantity: 1,
            rate: sub.amount
          }],
          dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
          notes: `Subscription billing for ${sub.planName}`
        });

        // Update subscription dates
        const nextPeriodStart = sub.nextBillingDate;
        const nextBillingDate = calcNextBillingDate(nextPeriodStart, sub.interval);

        updateSubscription(sub.id, {
          currentPeriodStart: nextPeriodStart,
          currentPeriodEnd: nextBillingDate,
          nextBillingDate,
          totalBilled: sub.totalBilled + sub.amount,
          invoiceHistory: [...sub.invoiceHistory, invoice.id]
        });

        results.push({ subscription: sub, invoice });
      }
    });

    return results;
  }

  function calcNextBillingDate(fromDate, interval) {
    const d = new Date(fromDate);
    switch (interval) {
      case 'weekly': d.setDate(d.getDate() + 7); break;
      case 'monthly': d.setMonth(d.getMonth() + 1); break;
      case 'quarterly': d.setMonth(d.getMonth() + 3); break;
      case 'yearly': d.setFullYear(d.getFullYear() + 1); break;
      default: d.setMonth(d.getMonth() + 1);
    }
    return d.toISOString().split('T')[0];
  }

  // ── Payment Links ───────────────────────────────────────
  function generatePaymentLink(invoice) {
    const config = getConfig();
    // In production, this would create a Stripe Payment Link via API
    // For MVP, generate a trackable link format
    const linkId = genId('pl');
    const links = load(STORAGE_KEYS.paymentLinks) || [];
    links.push({
      id: linkId,
      invoiceId: invoice.id,
      amount: invoice.total,
      currency: invoice.currency,
      clientEmail: invoice.clientEmail,
      expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
      createdAt: new Date().toISOString(),
      used: false
    });
    save(STORAGE_KEYS.paymentLinks, links);

    const mode = config.testMode ? 'test' : 'live';
    return `https://pay.cortexfreelancer.com/${mode}/${linkId}`;
  }

  // ── Tax Calculation ─────────────────────────────────────
  function getTaxRates() {
    return load(STORAGE_KEYS.taxRates) || [
      { id: 'default', name: 'Standard', rate: 0, description: 'No tax', default: true },
      { id: 'vat_20', name: 'VAT 20%', rate: 20, description: 'EU standard VAT' },
      { id: 'vat_10', name: 'VAT 10%', rate: 10, description: 'Reduced VAT' },
      { id: 'gst_18', name: 'GST 18%', rate: 18, description: 'India GST' },
      { id: 'sales_8', name: 'Sales Tax 8.5%', rate: 8.5, description: 'US average sales tax' }
    ];
  }

  function saveTaxRate(taxRate) {
    const rates = getTaxRates();
    const idx = rates.findIndex(r => r.id === taxRate.id);
    if (idx >= 0) {
      rates[idx] = { ...rates[idx], ...taxRate };
    } else {
      rates.push({ ...taxRate, id: taxRate.id || genId('tax') });
    }
    save(STORAGE_KEYS.taxRates, rates);
    return rates;
  }

  function calculateTax(amount, taxRateId) {
    const rates = getTaxRates();
    const rate = rates.find(r => r.id === taxRateId) || rates.find(r => r.default);
    const taxAmount = amount * ((rate?.rate || 0) / 100);
    return { rate: rate?.rate || 0, taxAmount, total: amount + taxAmount, rateName: rate?.name || 'None' };
  }

  // ── Notifications ───────────────────────────────────────
  function getNotifications() {
    return load(STORAGE_KEYS.notifications) || [];
  }

  function addNotification(type, message, relatedId = '') {
    const notifs = getNotifications();
    notifs.unshift({
      id: genId('notif'),
      type, // success, warning, error, info, invoice
      message,
      relatedId,
      read: false,
      createdAt: new Date().toISOString()
    });

    // Keep last 100
    if (notifs.length > 100) notifs.splice(100);
    save(STORAGE_KEYS.notifications, notifs);

    // Trigger UI update
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('stripe-notification', { detail: { type, message } }));
    }

    return notifs[0];
  }

  function markNotificationRead(id) {
    const notifs = getNotifications();
    const idx = notifs.findIndex(n => n.id === id);
    if (idx >= 0) {
      notifs[idx].read = true;
      save(STORAGE_KEYS.notifications, notifs);
    }
  }

  function markAllNotificationsRead() {
    const notifs = getNotifications().map(n => ({ ...n, read: true }));
    save(STORAGE_KEYS.notifications, notifs);
  }

  function getUnreadCount() {
    return getNotifications().filter(n => !n.read).length;
  }

  // ── Integration: Client Directory ───────────────────────
  function syncToClientDirectory(clientId, eventType, data) {
    if (!clientId) return;
    try {
      const clients = JSON.parse(localStorage.getItem('cortex_clients') || '[]');
      const idx = clients.findIndex(c => c.id === clientId);
      if (idx === -1) return;

      if (!clients[idx].paymentHistory) clients[idx].paymentHistory = [];
      clients[idx].paymentHistory.push({
        type: eventType,
        amount: data.invoice?.total || data.payment?.amount || 0,
        date: new Date().toISOString(),
        reference: data.invoice?.invoiceNumber || data.payment?.reference || ''
      });

      // Update lifetime value
      const payments = getPaymentsByClient(clientId);
      clients[idx].lifetimeValue = payments.reduce((sum, p) => sum + (p.status === PAYMENT_STATUSES.PAID ? p.amount : 0), 0);
      clients[idx].lastPaymentDate = payments.length ? payments[payments.length - 1].processedAt : null;

      localStorage.setItem('cortex_clients', JSON.stringify(clients));
    } catch (e) {
      console.warn('Client directory sync failed:', e);
    }
  }

  // ── Integration: Communication Hub ──────────────────────
  function triggerCommHubReminder(invoice) {
    try {
      const templates = JSON.parse(localStorage.getItem('cortex_comm_templates') || '[]');
      const events = JSON.parse(localStorage.getItem('cortex_comm_events') || '[]');
      events.push({
        id: genId('comm'),
        type: 'payment_reminder',
        clientId: invoice.clientId,
        clientName: invoice.clientName,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.total,
        dueDate: invoice.dueDate,
        status: 'queued',
        createdAt: new Date().toISOString()
      });
      localStorage.setItem('cortex_comm_events', JSON.stringify(events));
    } catch (e) {
      console.warn('CommHub integration failed:', e);
    }
  }

  // ── Analytics & Reporting ───────────────────────────────
  function getRevenueStats(period = 'month') {
    const payments = getPayments().filter(p => p.status === PAYMENT_STATUSES.PAID);
    const now = new Date();
    let startDate;

    switch (period) {
      case 'week': startDate = new Date(now - 7 * 86400000); break;
      case 'month': startDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
      case 'quarter': startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1); break;
      case 'year': startDate = new Date(now.getFullYear(), 0, 1); break;
      default: startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const periodPayments = payments.filter(p => new Date(p.processedAt) >= startDate);
    const totalRevenue = periodPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalFees = periodPayments.reduce((sum, p) => sum + (p.fee || 0), 0);
    const netRevenue = totalRevenue - totalFees;

    // Previous period comparison
    const periodLength = now - startDate;
    const prevStart = new Date(startDate - periodLength);
    const prevPayments = payments.filter(p => {
      const d = new Date(p.processedAt);
      return d >= prevStart && d < startDate;
    });
    const prevRevenue = prevPayments.reduce((sum, p) => sum + p.amount, 0);
    const growth = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalFees,
      netRevenue,
      transactionCount: periodPayments.length,
      avgTransactionValue: periodPayments.length ? totalRevenue / periodPayments.length : 0,
      growth: Math.round(growth * 10) / 10,
      period,
      periodPayments
    };
  }

  function getMonthlyRevenue(months = 6) {
    const payments = getPayments().filter(p => p.status === PAYMENT_STATUSES.PAID);
    const data = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const monthPayments = payments.filter(p => {
        const d = new Date(p.processedAt);
        return d >= start && d <= end;
      });

      data.push({
        month: start.toLocaleDateString('en-US', { month: 'short' }),
        year: start.getFullYear(),
        revenue: monthPayments.reduce((sum, p) => sum + p.amount, 0),
        count: monthPayments.length,
        fees: monthPayments.reduce((sum, p) => sum + (p.fee || 0), 0)
      });
    }

    return data;
  }

  function getClientRevenue() {
    const payments = getPayments().filter(p => p.status === PAYMENT_STATUSES.PAID);
    const byClient = {};

    payments.forEach(p => {
      if (!byClient[p.clientId]) {
        byClient[p.clientId] = { clientId: p.clientId, clientName: p.clientName, total: 0, count: 0, lastPayment: null };
      }
      byClient[p.clientId].total += p.amount;
      byClient[p.clientId].count++;
      byClient[p.clientId].lastPayment = p.processedAt;
    });

    return Object.values(byClient).sort((a, b) => b.total - a.total);
  }

  function getOutstandingAmount() {
    return getInvoices()
      .filter(inv => inv.status === PAYMENT_STATUSES.PENDING || inv.status === PAYMENT_STATUSES.OVERDUE)
      .reduce((sum, inv) => sum + (inv.total - inv.paidAmount), 0);
  }

  function getMRR() {
    return getSubscriptions()
      .filter(s => s.status === SUBSCRIPTION_STATUSES.ACTIVE)
      .reduce((sum, s) => {
        switch (s.interval) {
          case 'weekly': return sum + s.amount * 4.33;
          case 'monthly': return sum + s.amount;
          case 'quarterly': return sum + s.amount / 3;
          case 'yearly': return sum + s.amount / 12;
          default: return sum + s.amount;
        }
      }, 0);
  }

  // ── Integration: AI Analytics (cf3-020) ─────────────────
  function syncToAnalytics() {
    try {
      const analyticsData = {
        revenue: getRevenueStats('month'),
        mrr: getMRR(),
        outstanding: getOutstandingAmount(),
        overdueCount: getOverdueInvoices().length,
        activeSubscriptions: getSubscriptions().filter(s => s.status === SUBSCRIPTION_STATUSES.ACTIVE).length,
        monthlyRevenue: getMonthlyRevenue(12),
        topClients: getClientRevenue().slice(0, 10),
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem('cortex_payment_analytics', JSON.stringify(analyticsData));
    } catch (e) {
      console.warn('Analytics sync failed:', e);
    }
  }

  // ── Overdue Check & Auto-Processing ─────────────────────
  function processOverdueInvoices() {
    const today = new Date().toISOString().split('T')[0];
    const invoices = getInvoices();
    const config = getConfig();
    let updated = 0;

    invoices.forEach(inv => {
      if (inv.status === PAYMENT_STATUSES.PENDING && inv.dueDate < today) {
        inv.status = PAYMENT_STATUSES.OVERDUE;
        inv.updatedAt = new Date().toISOString();
        updated++;

        // Apply late fee if enabled
        if (config.lateFeeEnabled) {
          const dayslate = daysBetween(inv.dueDate, today);
          inv.lateFee = inv.total * (config.lateFeePercent / 100) * Math.ceil(dayslate / 30);
        }

        addNotification('error', `Invoice ${inv.invoiceNumber} is overdue (${inv.clientName})`, inv.id);
      }
    });

    if (updated > 0) {
      save(STORAGE_KEYS.invoices, invoices);
    }

    return updated;
  }

  function processAutoReminders() {
    const config = getConfig();
    if (!config.autoReminders) return [];

    const today = new Date();
    const invoices = getInvoices().filter(inv =>
      inv.status === PAYMENT_STATUSES.PENDING || inv.status === PAYMENT_STATUSES.OVERDUE
    );
    const sent = [];

    invoices.forEach(inv => {
      const dueDate = new Date(inv.dueDate);
      const daysUntilDue = Math.ceil((dueDate - today) / 86400000);

      config.reminderDays.forEach(dayBefore => {
        if (Math.abs(daysUntilDue - dayBefore) < 1) {
          const alreadySent = inv.reminders?.some(r => {
            const sentDate = new Date(r.sentAt).toISOString().split('T')[0];
            return sentDate === today.toISOString().split('T')[0];
          });

          if (!alreadySent) {
            sendReminder(inv.id);
            sent.push(inv);
          }
        }
      });
    });

    return sent;
  }

  // ── Stripe API Simulation (for MVP/demo) ────────────────
  // In production, these would hit actual Stripe APIs
  const StripeAPI = {
    async createPaymentIntent(amount, currency, metadata = {}) {
      // Simulated Stripe Payment Intent creation
      return {
        id: `pi_${genId('sim')}`,
        amount: Math.round(amount * 100),
        currency: currency.toLowerCase(),
        status: 'requires_payment_method',
        client_secret: `pi_${genId('sim')}_secret_${genId('s')}`,
        metadata,
        created: Math.floor(Date.now() / 1000)
      };
    },

    async createCustomer(email, name, metadata = {}) {
      return {
        id: `cus_${genId('sim')}`,
        email,
        name,
        metadata,
        created: Math.floor(Date.now() / 1000)
      };
    },

    async createInvoice(customerId, items, metadata = {}) {
      return {
        id: `in_${genId('sim')}`,
        customer: customerId,
        status: 'open',
        amount_due: items.reduce((sum, i) => sum + i.amount, 0),
        hosted_invoice_url: `https://invoice.stripe.com/i/${genId('sim')}`,
        metadata,
        created: Math.floor(Date.now() / 1000)
      };
    },

    async createSubscription(customerId, priceId, metadata = {}) {
      return {
        id: `sub_${genId('sim')}`,
        customer: customerId,
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
        metadata,
        created: Math.floor(Date.now() / 1000)
      };
    },

    async processWebhook(payload, signature) {
      // Webhook verification simulation
      return { type: payload.type, data: payload.data };
    }
  };

  // ── Demo Data Generation ────────────────────────────────
  function generateDemoData() {
    const clients = [
      { id: 'c1', name: 'TechStart Inc.', email: 'billing@techstart.io' },
      { id: 'c2', name: 'GreenLeaf Design', email: 'pay@greenleaf.co' },
      { id: 'c3', name: 'Nova Digital', email: 'finance@novadigital.com' },
      { id: 'c4', name: 'Blue Horizon Ltd', email: 'accounts@bluehorizon.io' },
      { id: 'c5', name: 'Pixel Perfect', email: 'pay@pixelperfect.studio' }
    ];

    const projects = ['Website Redesign', 'Mobile App', 'Brand Identity', 'SEO Campaign', 'UI/UX Audit', 'API Integration'];

    // Generate invoices
    for (let i = 0; i < 12; i++) {
      const client = clients[i % clients.length];
      const project = projects[i % projects.length];
      const amount = [1500, 2500, 3200, 4800, 750, 6000, 1200, 3500, 900, 5500, 2000, 4200][i];
      const daysAgo = Math.floor(Math.random() * 90);
      const issueDate = new Date(Date.now() - daysAgo * 86400000).toISOString().split('T')[0];
      const dueDate = new Date(Date.now() - (daysAgo - 30) * 86400000).toISOString().split('T')[0];

      const invoice = createInvoice({
        clientId: client.id,
        clientName: client.name,
        clientEmail: client.email,
        projectName: project,
        items: [
          { description: `${project} - Development`, quantity: Math.ceil(amount / 150), rate: 150 },
          { description: 'Project management', quantity: 2, rate: (amount - Math.ceil(amount / 150) * 150) / 2 || 75 }
        ],
        issueDate,
        dueDate,
        taxRate: i % 3 === 0 ? 20 : 0
      });

      // Mark some as paid
      if (i < 8) {
        markInvoicePaid(invoice.id, { method: 'stripe', reference: `ch_${genId('demo')}` });
      }
    }

    // Generate subscriptions
    const subPlans = [
      { client: clients[0], plan: 'Retainer - Development', amount: 3000, interval: 'monthly' },
      { client: clients[1], plan: 'Design Support', amount: 1500, interval: 'monthly' },
      { client: clients[3], plan: 'Annual Maintenance', amount: 12000, interval: 'yearly' }
    ];

    subPlans.forEach(sp => {
      createSubscription({
        clientId: sp.client.id,
        clientName: sp.client.name,
        clientEmail: sp.client.email,
        planName: sp.plan,
        amount: sp.amount,
        interval: sp.interval,
        startDate: new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0]
      });
    });

    // Config for demo
    saveConfig({
      stripePublishableKey: 'pk_test_demo_51xxxxxxxxxxxxxx',
      stripeSecretKey: 'sk_test_demo_51xxxxxxxxxxxxxx',
      companyName: 'Cortex Freelancer',
      companyEmail: 'billing@cortexfreelancer.com',
      testMode: true,
      currency: 'USD',
      defaultTaxRate: 0
    });

    // Sync analytics
    syncToAnalytics();

    return { invoices: getInvoices().length, payments: getPayments().length, subscriptions: getSubscriptions().length };
  }

  // ── Public API ──────────────────────────────────────────
  return {
    // Config
    getConfig, saveConfig, isConfigured, getConnectionStatus,

    // Invoices
    getInvoices, getInvoice, createInvoice, updateInvoice, deleteInvoice,
    markInvoicePaid, getOverdueInvoices, sendReminder, generateInvoiceNumber,

    // Payments
    getPayments, recordPayment, processRefund,
    getPaymentsByClient, getPaymentsByDateRange,

    // Subscriptions
    getSubscriptions, getSubscription, createSubscription,
    updateSubscription, cancelSubscription, pauseSubscription,
    resumeSubscription, processSubscriptionBilling,

    // Tax
    getTaxRates, saveTaxRate, calculateTax,

    // Payment Links
    generatePaymentLink,

    // Notifications
    getNotifications, addNotification, markNotificationRead,
    markAllNotificationsRead, getUnreadCount,

    // Analytics
    getRevenueStats, getMonthlyRevenue, getClientRevenue,
    getOutstandingAmount, getMRR, syncToAnalytics,

    // Processing
    processOverdueInvoices, processAutoReminders,

    // Stripe API (simulation)
    StripeAPI,

    // Utilities
    formatCurrency, formatDate,

    // Demo
    generateDemoData,

    // Constants
    PAYMENT_STATUSES, SUBSCRIPTION_STATUSES
  };
})();

// Auto-init: check overdue and sync analytics on load
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    StripePayments.processOverdueInvoices();
    StripePayments.syncToAnalytics();
  });
}
