#!/usr/bin/env node
/**
 * Invoice Generation & Payment Tracking System
 * Sprint 2 Task 12 — Cortex Freelancer
 *
 * Professional invoice creation, payment tracking, recurring billing,
 * tax calculations, multi-currency support, and financial reporting.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ─── Storage ────────────────────────────────────────────────────────────────

const DATA_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE || '.',
  '.cortex-freelancer',
  'invoices'
);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJSON(file, fallback = []) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

function writeJSON(file, data) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

const PATHS = {
  invoices:    () => path.join(DATA_DIR, 'invoices.json'),
  payments:    () => path.join(DATA_DIR, 'payments.json'),
  templates:   () => path.join(DATA_DIR, 'templates.json'),
  settings:    () => path.join(DATA_DIR, 'settings.json'),
  recurring:   () => path.join(DATA_DIR, 'recurring.json'),
};

// ─── Default Settings ───────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  businessName: 'Freelancer',
  businessEmail: '',
  businessAddress: '',
  taxId: '',
  defaultCurrency: 'USD',
  defaultPaymentTerms: 30, // days
  lateFeePercent: 1.5,     // monthly
  taxRates: {
    standard: 0.20,  // 20% VAT
    reduced: 0.10,
    zero: 0,
  },
  invoicePrefix: 'INV',
  nextInvoiceNumber: 1001,
  bankDetails: {
    bankName: '',
    accountHolder: '',
    iban: '',
    swift: '',
  },
};

// ─── Currency Support ───────────────────────────────────────────────────────

const CURRENCY_SYMBOLS = {
  USD: '$', EUR: '€', GBP: '£', TRY: '₺', JPY: '¥',
  CAD: 'C$', AUD: 'A$', CHF: 'CHF', INR: '₹', BRL: 'R$',
};

function formatCurrency(amount, currency = 'USD') {
  const sym = CURRENCY_SYMBOLS[currency] || currency;
  return `${sym}${amount.toFixed(2)}`;
}

// ─── Invoice Engine ─────────────────────────────────────────────────────────

class InvoiceEngine {
  constructor() {
    this.settings = { ...DEFAULT_SETTINGS, ...readJSON(PATHS.settings(), {}) };
    this.invoices = readJSON(PATHS.invoices());
    this.payments = readJSON(PATHS.payments());
    this.templates = readJSON(PATHS.templates());
    this.recurring = readJSON(PATHS.recurring());
  }

  save() {
    writeJSON(PATHS.invoices(), this.invoices);
    writeJSON(PATHS.payments(), this.payments);
    writeJSON(PATHS.settings(), this.settings);
    writeJSON(PATHS.recurring(), this.recurring);
  }

  // ── Create Invoice ──────────────────────────────────────────────────────

  createInvoice({
    clientName, clientEmail, clientAddress = '',
    items = [], notes = '', currency, paymentTerms,
    taxRate = 'standard', discount = 0, discountType = 'percent',
    projectId = null, templateId = null,
  }) {
    const cur = currency || this.settings.defaultCurrency;
    const terms = paymentTerms || this.settings.defaultPaymentTerms;
    const taxVal = this.settings.taxRates[taxRate];
    const tax = taxVal !== undefined && taxVal !== null ? taxVal : (parseFloat(taxRate) || 0);

    // Calculate line items
    const lineItems = items.map(item => {
      const qty = item.quantity || 1;
      const rate = item.rate || 0;
      const lineTotal = qty * rate;
      return {
        description: item.description,
        quantity: qty,
        rate,
        unit: item.unit || 'unit',
        total: lineTotal,
      };
    });

    const subtotal = lineItems.reduce((s, i) => s + i.total, 0);

    // Apply discount
    let discountAmount = 0;
    if (discount > 0) {
      discountAmount = discountType === 'percent'
        ? subtotal * (discount / 100)
        : Math.min(discount, subtotal);
    }

    const taxableAmount = subtotal - discountAmount;
    const taxAmount = taxableAmount * tax;
    const total = taxableAmount + taxAmount;

    const invoiceNumber = `${this.settings.invoicePrefix}-${this.settings.nextInvoiceNumber}`;
    this.settings.nextInvoiceNumber++;

    const now = new Date();
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + terms);

    const invoice = {
      id: crypto.randomUUID(),
      invoiceNumber,
      status: 'draft',
      clientName,
      clientEmail,
      clientAddress,
      items: lineItems,
      subtotal,
      discount: discountAmount,
      discountType,
      discountValue: discount,
      taxRate: tax,
      taxRateName: taxRate,
      taxAmount,
      total,
      currency: cur,
      paymentTerms: terms,
      notes,
      projectId,
      templateId,
      issueDate: now.toISOString(),
      dueDate: dueDate.toISOString(),
      paidAmount: 0,
      paidDate: null,
      sentDate: null,
      reminders: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    this.invoices.push(invoice);
    this.save();

    return {
      success: true,
      invoice,
      summary: `Invoice ${invoiceNumber} created for ${clientName}: ${formatCurrency(total, cur)} (due ${dueDate.toLocaleDateString()})`,
    };
  }

  // ── Send Invoice ────────────────────────────────────────────────────────

  sendInvoice(invoiceId) {
    const inv = this.invoices.find(i => i.id === invoiceId || i.invoiceNumber === invoiceId);
    if (!inv) return { success: false, error: 'Invoice not found' };

    inv.status = 'sent';
    inv.sentDate = new Date().toISOString();
    inv.updatedAt = new Date().toISOString();
    this.save();

    return {
      success: true,
      message: `Invoice ${inv.invoiceNumber} marked as sent to ${inv.clientEmail || inv.clientName}`,
      invoice: inv,
      // Integration point: OpenClaw sessions_send for email/notification
      notification: {
        type: 'invoice_sent',
        to: inv.clientEmail,
        subject: `Invoice ${inv.invoiceNumber} from ${this.settings.businessName}`,
        body: this._generateEmailBody(inv),
      },
    };
  }

  // ── Record Payment ──────────────────────────────────────────────────────

  recordPayment(invoiceId, { amount, method = 'bank_transfer', reference = '', date = null }) {
    const inv = this.invoices.find(i => i.id === invoiceId || i.invoiceNumber === invoiceId);
    if (!inv) return { success: false, error: 'Invoice not found' };

    const paymentDate = date || new Date().toISOString();

    const payment = {
      id: crypto.randomUUID(),
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      clientName: inv.clientName,
      amount: parseFloat(amount),
      method,
      reference,
      currency: inv.currency,
      date: paymentDate,
      createdAt: new Date().toISOString(),
    };

    this.payments.push(payment);
    inv.paidAmount = (inv.paidAmount || 0) + payment.amount;

    if (inv.paidAmount >= inv.total) {
      inv.status = 'paid';
      inv.paidDate = paymentDate;
    } else if (inv.paidAmount > 0) {
      inv.status = 'partial';
    }

    inv.updatedAt = new Date().toISOString();
    this.save();

    const remaining = inv.total - inv.paidAmount;
    return {
      success: true,
      payment,
      invoiceStatus: inv.status,
      remaining: remaining > 0 ? remaining : 0,
      summary: inv.status === 'paid'
        ? `✅ Invoice ${inv.invoiceNumber} fully paid!`
        : `💰 Payment of ${formatCurrency(payment.amount, inv.currency)} recorded. Remaining: ${formatCurrency(remaining, inv.currency)}`,
    };
  }

  // ── Overdue Check & Reminders ───────────────────────────────────────────

  checkOverdue() {
    const now = new Date();
    const overdue = this.invoices.filter(inv => {
      if (['paid', 'cancelled', 'draft'].includes(inv.status)) return false;
      return new Date(inv.dueDate) < now;
    });

    return overdue.map(inv => {
      const daysOverdue = Math.floor((now - new Date(inv.dueDate)) / 86400000);
      const lateFee = inv.total * (this.settings.lateFeePercent / 100) * Math.ceil(daysOverdue / 30);
      const totalWithFees = inv.total + lateFee - inv.paidAmount;

      return {
        invoiceNumber: inv.invoiceNumber,
        clientName: inv.clientName,
        originalTotal: formatCurrency(inv.total, inv.currency),
        paidAmount: formatCurrency(inv.paidAmount, inv.currency),
        daysOverdue,
        lateFee: formatCurrency(lateFee, inv.currency),
        totalOwed: formatCurrency(totalWithFees, inv.currency),
        urgency: daysOverdue > 60 ? 'critical' : daysOverdue > 30 ? 'high' : 'medium',
        suggestedAction: daysOverdue > 60
          ? 'Consider collections or final notice'
          : daysOverdue > 30
            ? 'Send formal reminder with late fee notice'
            : 'Send friendly payment reminder',
      };
    }).sort((a, b) => b.daysOverdue - a.daysOverdue);
  }

  sendReminder(invoiceId) {
    const inv = this.invoices.find(i => i.id === invoiceId || i.invoiceNumber === invoiceId);
    if (!inv) return { success: false, error: 'Invoice not found' };

    const reminderCount = (inv.reminders || []).length + 1;
    const now = new Date();
    const daysOverdue = Math.max(0, Math.floor((now - new Date(inv.dueDate)) / 86400000));

    inv.reminders = inv.reminders || [];
    inv.reminders.push({
      number: reminderCount,
      date: now.toISOString(),
      daysOverdue,
    });
    inv.updatedAt = now.toISOString();
    this.save();

    const tone = reminderCount === 1 ? 'friendly' : reminderCount === 2 ? 'firm' : 'final';
    return {
      success: true,
      reminderNumber: reminderCount,
      tone,
      notification: {
        type: 'payment_reminder',
        to: inv.clientEmail,
        subject: `${tone === 'final' ? 'FINAL NOTICE: ' : ''}Payment reminder for Invoice ${inv.invoiceNumber}`,
        body: this._generateReminderBody(inv, tone, daysOverdue),
      },
    };
  }

  // ── Recurring Invoices ──────────────────────────────────────────────────

  createRecurring({
    clientName, clientEmail, clientAddress = '',
    items = [], frequency = 'monthly', startDate = null,
    currency, paymentTerms, taxRate = 'standard', notes = '',
  }) {
    const schedule = {
      id: crypto.randomUUID(),
      clientName,
      clientEmail,
      clientAddress,
      items,
      frequency, // weekly, biweekly, monthly, quarterly, annually
      currency: currency || this.settings.defaultCurrency,
      paymentTerms: paymentTerms || this.settings.defaultPaymentTerms,
      taxRate,
      notes,
      startDate: startDate || new Date().toISOString(),
      nextDue: startDate || new Date().toISOString(),
      active: true,
      generatedInvoices: [],
      createdAt: new Date().toISOString(),
    };

    this.recurring.push(schedule);
    this.save();

    return {
      success: true,
      schedule,
      summary: `Recurring ${frequency} invoice set up for ${clientName}`,
    };
  }

  processRecurring() {
    const now = new Date();
    const generated = [];

    for (const sched of this.recurring) {
      if (!sched.active) continue;
      if (new Date(sched.nextDue) > now) continue;

      const result = this.createInvoice({
        clientName: sched.clientName,
        clientEmail: sched.clientEmail,
        clientAddress: sched.clientAddress,
        items: sched.items,
        currency: sched.currency,
        paymentTerms: sched.paymentTerms,
        taxRate: sched.taxRate,
        notes: sched.notes,
      });

      if (result.success) {
        sched.generatedInvoices.push(result.invoice.invoiceNumber);
        sched.nextDue = this._getNextDate(sched.nextDue, sched.frequency).toISOString();
        generated.push(result.invoice);
      }
    }

    this.save();
    return {
      processed: generated.length,
      invoices: generated.map(i => ({
        invoiceNumber: i.invoiceNumber,
        client: i.clientName,
        total: formatCurrency(i.total, i.currency),
      })),
    };
  }

  // ── Financial Reports ───────────────────────────────────────────────────

  getFinancialReport({ period = 'month', year, month }) {
    const now = new Date();
    const y = year || now.getFullYear();
    const m = month || now.getMonth() + 1;

    let startDate, endDate, periodLabel;
    if (period === 'month') {
      startDate = new Date(y, m - 1, 1);
      endDate = new Date(y, m, 0, 23, 59, 59);
      periodLabel = `${y}-${String(m).padStart(2, '0')}`;
    } else if (period === 'quarter') {
      const q = Math.ceil(m / 3);
      startDate = new Date(y, (q - 1) * 3, 1);
      endDate = new Date(y, q * 3, 0, 23, 59, 59);
      periodLabel = `${y} Q${q}`;
    } else {
      startDate = new Date(y, 0, 1);
      endDate = new Date(y, 11, 31, 23, 59, 59);
      periodLabel = `${y}`;
    }

    const periodInvoices = this.invoices.filter(inv => {
      const d = new Date(inv.issueDate);
      return d >= startDate && d <= endDate;
    });

    const periodPayments = this.payments.filter(p => {
      const d = new Date(p.date);
      return d >= startDate && d <= endDate;
    });

    const totalInvoiced = periodInvoices.reduce((s, i) => s + i.total, 0);
    const totalCollected = periodPayments.reduce((s, p) => s + p.amount, 0);
    const totalTax = periodInvoices.reduce((s, i) => s + (i.taxAmount || 0), 0);
    const outstanding = periodInvoices
      .filter(i => !['paid', 'cancelled'].includes(i.status))
      .reduce((s, i) => s + (i.total - (i.paidAmount || 0)), 0);

    // Client breakdown
    const clientBreakdown = {};
    for (const inv of periodInvoices) {
      if (!clientBreakdown[inv.clientName]) {
        clientBreakdown[inv.clientName] = { invoiced: 0, paid: 0, count: 0 };
      }
      clientBreakdown[inv.clientName].invoiced += inv.total;
      clientBreakdown[inv.clientName].paid += inv.paidAmount || 0;
      clientBreakdown[inv.clientName].count++;
    }

    // Payment method breakdown
    const methodBreakdown = {};
    for (const p of periodPayments) {
      methodBreakdown[p.method] = (methodBreakdown[p.method] || 0) + p.amount;
    }

    const cur = this.settings.defaultCurrency;
    return {
      period: periodLabel,
      summary: {
        totalInvoiced: formatCurrency(totalInvoiced, cur),
        totalCollected: formatCurrency(totalCollected, cur),
        outstanding: formatCurrency(outstanding, cur),
        taxCollected: formatCurrency(totalTax, cur),
        collectionRate: totalInvoiced > 0
          ? `${((totalCollected / totalInvoiced) * 100).toFixed(1)}%`
          : 'N/A',
        invoiceCount: periodInvoices.length,
        averageInvoice: periodInvoices.length > 0
          ? formatCurrency(totalInvoiced / periodInvoices.length, cur)
          : formatCurrency(0, cur),
      },
      clientBreakdown: Object.entries(clientBreakdown)
        .map(([name, data]) => ({
          client: name,
          invoiced: formatCurrency(data.invoiced, cur),
          paid: formatCurrency(data.paid, cur),
          invoiceCount: data.count,
        }))
        .sort((a, b) => b.invoiced - a.invoiced),
      paymentMethods: Object.entries(methodBreakdown)
        .map(([method, amount]) => ({
          method,
          total: formatCurrency(amount, cur),
          percentage: `${((amount / totalCollected) * 100).toFixed(1)}%`,
        })),
      statusBreakdown: {
        draft: periodInvoices.filter(i => i.status === 'draft').length,
        sent: periodInvoices.filter(i => i.status === 'sent').length,
        partial: periodInvoices.filter(i => i.status === 'partial').length,
        paid: periodInvoices.filter(i => i.status === 'paid').length,
        overdue: periodInvoices.filter(i => {
          return ['sent', 'partial'].includes(i.status) && new Date(i.dueDate) < now;
        }).length,
        cancelled: periodInvoices.filter(i => i.status === 'cancelled').length,
      },
    };
  }

  // ── Cash Flow Forecast ──────────────────────────────────────────────────

  getCashFlowForecast(weeks = 8) {
    const now = new Date();
    const cur = this.settings.defaultCurrency;
    const forecast = [];

    for (let w = 0; w < weeks; w++) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() + w * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const expectedIn = this.invoices
        .filter(inv => {
          if (['paid', 'cancelled'].includes(inv.status)) return false;
          const due = new Date(inv.dueDate);
          return due >= weekStart && due < weekEnd;
        })
        .reduce((s, inv) => s + (inv.total - (inv.paidAmount || 0)), 0);

      const recurringDue = this.recurring
        .filter(r => {
          if (!r.active) return false;
          const next = new Date(r.nextDue);
          return next >= weekStart && next < weekEnd;
        })
        .reduce((s, r) => {
          const total = r.items.reduce((t, i) => t + (i.quantity || 1) * (i.rate || 0), 0);
          return s + total;
        }, 0);

      forecast.push({
        week: w + 1,
        startDate: weekStart.toISOString().split('T')[0],
        endDate: weekEnd.toISOString().split('T')[0],
        expectedIncome: formatCurrency(expectedIn, cur),
        recurringIncome: formatCurrency(recurringDue, cur),
        total: formatCurrency(expectedIn + recurringDue, cur),
      });
    }

    return {
      forecastWeeks: weeks,
      currency: cur,
      weeks: forecast,
      totalExpected: formatCurrency(
        forecast.reduce((s, w) => {
          const val = parseFloat(w.total.replace(/[^0-9.-]/g, ''));
          return s + val;
        }, 0),
        cur
      ),
    };
  }

  // ── Invoice Search & List ───────────────────────────────────────────────

  listInvoices({ status, client, limit = 20 } = {}) {
    let results = [...this.invoices];
    if (status) results = results.filter(i => i.status === status);
    if (client) results = results.filter(i =>
      i.clientName.toLowerCase().includes(client.toLowerCase())
    );

    return results
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit)
      .map(inv => ({
        invoiceNumber: inv.invoiceNumber,
        client: inv.clientName,
        total: formatCurrency(inv.total, inv.currency),
        paid: formatCurrency(inv.paidAmount || 0, inv.currency),
        status: inv.status,
        dueDate: new Date(inv.dueDate).toLocaleDateString(),
        isOverdue: ['sent', 'partial'].includes(inv.status) && new Date(inv.dueDate) < new Date(),
      }));
  }

  // ── Generate Invoice PDF-Ready Data ─────────────────────────────────────

  generateInvoiceDocument(invoiceId) {
    const inv = this.invoices.find(i => i.id === invoiceId || i.invoiceNumber === invoiceId);
    if (!inv) return { success: false, error: 'Invoice not found' };

    return {
      success: true,
      document: {
        header: {
          invoiceNumber: inv.invoiceNumber,
          issueDate: new Date(inv.issueDate).toLocaleDateString(),
          dueDate: new Date(inv.dueDate).toLocaleDateString(),
          status: inv.status.toUpperCase(),
        },
        from: {
          name: this.settings.businessName,
          email: this.settings.businessEmail,
          address: this.settings.businessAddress,
          taxId: this.settings.taxId,
        },
        to: {
          name: inv.clientName,
          email: inv.clientEmail,
          address: inv.clientAddress,
        },
        items: inv.items,
        totals: {
          subtotal: formatCurrency(inv.subtotal, inv.currency),
          discount: inv.discount > 0 ? `-${formatCurrency(inv.discount, inv.currency)}` : null,
          taxRate: `${(inv.taxRate * 100).toFixed(0)}%`,
          taxAmount: formatCurrency(inv.taxAmount, inv.currency),
          total: formatCurrency(inv.total, inv.currency),
          paid: formatCurrency(inv.paidAmount || 0, inv.currency),
          due: formatCurrency(inv.total - (inv.paidAmount || 0), inv.currency),
        },
        bankDetails: this.settings.bankDetails,
        notes: inv.notes,
        paymentTerms: `Net ${inv.paymentTerms} days`,
      },
    };
  }

  // ── Dashboard ───────────────────────────────────────────────────────────

  getDashboard() {
    const now = new Date();
    const cur = this.settings.defaultCurrency;
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    const monthInvoices = this.invoices.filter(i => {
      const d = new Date(i.issueDate);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    });

    const monthPayments = this.payments.filter(p => {
      const d = new Date(p.date);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    });

    const unpaid = this.invoices.filter(i => !['paid', 'cancelled', 'draft'].includes(i.status));
    const overdue = unpaid.filter(i => new Date(i.dueDate) < now);

    return {
      thisMonth: {
        invoiced: formatCurrency(monthInvoices.reduce((s, i) => s + i.total, 0), cur),
        collected: formatCurrency(monthPayments.reduce((s, p) => s + p.amount, 0), cur),
        invoiceCount: monthInvoices.length,
      },
      outstanding: {
        total: formatCurrency(unpaid.reduce((s, i) => s + (i.total - (i.paidAmount || 0)), 0), cur),
        count: unpaid.length,
      },
      overdue: {
        total: formatCurrency(overdue.reduce((s, i) => s + (i.total - (i.paidAmount || 0)), 0), cur),
        count: overdue.length,
        items: overdue.slice(0, 5).map(i => ({
          invoice: i.invoiceNumber,
          client: i.clientName,
          amount: formatCurrency(i.total - (i.paidAmount || 0), i.currency),
          daysOverdue: Math.floor((now - new Date(i.dueDate)) / 86400000),
        })),
      },
      activeRecurring: this.recurring.filter(r => r.active).length,
      totalAllTime: {
        invoiced: formatCurrency(this.invoices.reduce((s, i) => s + i.total, 0), cur),
        collected: formatCurrency(this.payments.reduce((s, p) => s + p.amount, 0), cur),
      },
    };
  }

  // ── Settings ────────────────────────────────────────────────────────────

  updateSettings(updates) {
    this.settings = { ...this.settings, ...updates };
    writeJSON(PATHS.settings(), this.settings);
    return { success: true, settings: this.settings };
  }

  // ── Private Helpers ─────────────────────────────────────────────────────

  _generateEmailBody(inv) {
    return [
      `Dear ${inv.clientName},`,
      '',
      `Please find below the details for Invoice ${inv.invoiceNumber}.`,
      '',
      `Amount Due: ${formatCurrency(inv.total, inv.currency)}`,
      `Due Date: ${new Date(inv.dueDate).toLocaleDateString()}`,
      `Payment Terms: Net ${inv.paymentTerms} days`,
      '',
      'Items:',
      ...inv.items.map(i =>
        `  - ${i.description}: ${i.quantity} × ${formatCurrency(i.rate, inv.currency)} = ${formatCurrency(i.total, inv.currency)}`
      ),
      '',
      inv.notes ? `Notes: ${inv.notes}` : '',
      '',
      `Thank you for your business!`,
      this.settings.businessName,
    ].filter(Boolean).join('\n');
  }

  _generateReminderBody(inv, tone, daysOverdue) {
    const remaining = inv.total - (inv.paidAmount || 0);
    const templates = {
      friendly: `Just a friendly reminder that Invoice ${inv.invoiceNumber} for ${formatCurrency(remaining, inv.currency)} was due ${daysOverdue} day(s) ago. We'd appreciate payment at your earliest convenience.`,
      firm: `This is a follow-up regarding Invoice ${inv.invoiceNumber} for ${formatCurrency(remaining, inv.currency)}, which is now ${daysOverdue} days overdue. Please arrange payment promptly to avoid late fees.`,
      final: `FINAL NOTICE: Invoice ${inv.invoiceNumber} for ${formatCurrency(remaining, inv.currency)} is ${daysOverdue} days overdue. Late fees may apply. Please remit payment immediately to avoid further action.`,
    };
    return templates[tone];
  }

  _getNextDate(fromDate, frequency) {
    const d = new Date(fromDate);
    switch (frequency) {
      case 'weekly': d.setDate(d.getDate() + 7); break;
      case 'biweekly': d.setDate(d.getDate() + 14); break;
      case 'monthly': d.setMonth(d.getMonth() + 1); break;
      case 'quarterly': d.setMonth(d.getMonth() + 3); break;
      case 'annually': d.setFullYear(d.getFullYear() + 1); break;
    }
    return d;
  }
}

// ─── CLI ────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const engine = new InvoiceEngine();

  const commands = {
    create: () => {
      const clientName = args[1] || 'Client';
      const items = [];
      // Parse --item "desc:qty:rate" flags
      for (let i = 2; i < args.length; i++) {
        if (args[i] === '--item' && args[i + 1]) {
          const [description, qty, rate] = args[++i].split(':');
          items.push({ description, quantity: parseFloat(qty) || 1, rate: parseFloat(rate) || 0 });
        }
      }
      if (items.length === 0) {
        items.push({ description: 'Professional Services', quantity: 1, rate: 100 });
      }
      console.log(JSON.stringify(engine.createInvoice({ clientName, items }), null, 2));
    },

    list: () => {
      const status = args.find((a, i) => args[i - 1] === '--status');
      const client = args.find((a, i) => args[i - 1] === '--client');
      console.log(JSON.stringify(engine.listInvoices({ status, client }), null, 2));
    },

    pay: () => {
      const invoiceId = args[1];
      const amount = parseFloat(args[2] || '0');
      const method = args.find((a, i) => args[i - 1] === '--method') || 'bank_transfer';
      console.log(JSON.stringify(engine.recordPayment(invoiceId, { amount, method }), null, 2));
    },

    send: () => {
      console.log(JSON.stringify(engine.sendInvoice(args[1]), null, 2));
    },

    overdue: () => {
      console.log(JSON.stringify(engine.checkOverdue(), null, 2));
    },

    remind: () => {
      console.log(JSON.stringify(engine.sendReminder(args[1]), null, 2));
    },

    recurring: () => {
      if (args[1] === 'process') {
        console.log(JSON.stringify(engine.processRecurring(), null, 2));
      } else {
        console.log(JSON.stringify(engine.recurring.filter(r => r.active), null, 2));
      }
    },

    report: () => {
      const period = args[1] || 'month';
      console.log(JSON.stringify(engine.getFinancialReport({ period }), null, 2));
    },

    forecast: () => {
      const weeks = parseInt(args[1]) || 8;
      console.log(JSON.stringify(engine.getCashFlowForecast(weeks), null, 2));
    },

    dashboard: () => {
      console.log(JSON.stringify(engine.getDashboard(), null, 2));
    },

    document: () => {
      console.log(JSON.stringify(engine.generateInvoiceDocument(args[1]), null, 2));
    },

    settings: () => {
      if (args[1] && args[2]) {
        const updates = {};
        updates[args[1]] = args[2];
        console.log(JSON.stringify(engine.updateSettings(updates), null, 2));
      } else {
        console.log(JSON.stringify(engine.settings, null, 2));
      }
    },

    help: () => {
      console.log(`
Invoice Generator & Payment Tracker — Cortex Freelancer

Commands:
  create <client> [--item "desc:qty:rate"]...   Create invoice
  list [--status draft|sent|paid] [--client x]  List invoices
  send <invoice-id>                             Mark invoice as sent
  pay <invoice-id> <amount> [--method x]        Record payment
  overdue                                       List overdue invoices
  remind <invoice-id>                           Send payment reminder
  recurring [process]                           List/process recurring
  report [month|quarter|year]                   Financial report
  forecast [weeks]                              Cash flow forecast
  dashboard                                     Quick overview
  document <invoice-id>                         Generate document data
  settings [key] [value]                        View/update settings
      `);
    },
  };

  (commands[cmd] || commands.help)();
}

main();
