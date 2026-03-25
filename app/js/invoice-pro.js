/**
 * Invoice Pro Module — Cortex Freelancer
 *
 * Professional invoicing features:
 *  - Payment tracking & recording
 *  - Invoice template selection (Professional, Minimal, Bold)
 *  - Client billing history & analytics
 *  - Accounting export (CSV, JSON, QIF)
 *  - Tax calculation with multi-rate support
 *  - Email integration (send invoice, reminders, receipts)
 *  - Invoice status management
 *
 * Exposed on window.CortexFreelancer.InvoicePro
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Constants ──────────────────────────────────────────────────────

  var STORAGE_KEYS = {
    invoices: 'cortex_invoices',
    payments: 'cortex_invoice_payments',
    clients: 'cortex_invoice_clients',
    settings: 'cortex_invoice_pro_settings',
    template: 'cortex_invoice_template',
  };

  var INVOICE_STATUSES = {
    DRAFT: 'draft',
    SENT: 'sent',
    VIEWED: 'viewed',
    PARTIAL: 'partial',
    PAID: 'paid',
    OVERDUE: 'overdue',
    CANCELLED: 'cancelled',
  };

  var STATUS_COLORS = {
    draft: { bg: 'rgba(107,114,128,.15)', color: '#9ca3af', label: 'Draft' },
    sent: { bg: 'rgba(59,130,246,.15)', color: '#3b82f6', label: 'Sent' },
    viewed: { bg: 'rgba(168,85,247,.15)', color: '#a855f7', label: 'Viewed' },
    partial: { bg: 'rgba(245,158,11,.15)', color: '#f59e0b', label: 'Partial' },
    paid: { bg: 'rgba(34,197,94,.15)', color: '#22c55e', label: 'Paid' },
    overdue: { bg: 'rgba(239,68,68,.15)', color: '#ef4444', label: 'Overdue' },
    cancelled: { bg: 'rgba(107,114,128,.15)', color: '#6b7280', label: 'Cancelled' },
  };

  var PAYMENT_METHODS = [
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'credit_card', label: 'Credit Card' },
    { value: 'paypal', label: 'PayPal' },
    { value: 'stripe', label: 'Stripe' },
    { value: 'cash', label: 'Cash' },
    { value: 'check', label: 'Check' },
    { value: 'crypto', label: 'Cryptocurrency' },
    { value: 'wise', label: 'Wise' },
    { value: 'other', label: 'Other' },
  ];

  var TAX_PRESETS = {
    us_none: { label: 'US (No sales tax)', rate: 0 },
    us_average: { label: 'US Average', rate: 7.12 },
    uk_vat: { label: 'UK VAT', rate: 20 },
    eu_vat_standard: { label: 'EU VAT Standard', rate: 21 },
    eu_vat_reduced: { label: 'EU VAT Reduced', rate: 10 },
    tr_kdv: { label: 'Turkey KDV', rate: 20 },
    in_gst: { label: 'India GST', rate: 18 },
    br_iss: { label: 'Brazil ISS', rate: 5 },
    au_gst: { label: 'Australia GST', rate: 10 },
    ca_gst: { label: 'Canada GST', rate: 5 },
    ca_hst_on: { label: 'Canada HST (Ontario)', rate: 13 },
    jp_ct: { label: 'Japan CT', rate: 10 },
    custom: { label: 'Custom', rate: 0 },
  };

  var TEMPLATES = ['professional', 'minimal', 'bold'];

  // ─── Storage Helpers ────────────────────────────────────────────────

  function getStore(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : (fallback || []);
    } catch (e) { return fallback || []; }
  }

  function setStore(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) { /* quota */ }
  }

  // ─── Payment Tracker ───────────────────────────────────────────────

  var PaymentTracker = {
    getPayments: function () {
      return getStore(STORAGE_KEYS.payments, []);
    },

    getPaymentsForInvoice: function (invoiceNumber) {
      return this.getPayments().filter(function (p) {
        return p.invoiceNumber === invoiceNumber;
      });
    },

    recordPayment: function (data) {
      if (!data.invoiceNumber || !data.amount) {
        return { success: false, error: 'Invoice number and amount are required' };
      }

      var payment = {
        id: 'PAY-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
        invoiceNumber: data.invoiceNumber,
        amount: parseFloat(data.amount),
        method: data.method || 'bank_transfer',
        reference: data.reference || '',
        date: data.date || new Date().toISOString().slice(0, 10),
        notes: data.notes || '',
        currency: data.currency || 'USD',
        createdAt: new Date().toISOString(),
      };

      var payments = this.getPayments();
      payments.unshift(payment);
      setStore(STORAGE_KEYS.payments, payments);

      // Update invoice status
      this._updateInvoiceStatus(data.invoiceNumber);

      return { success: true, payment: payment };
    },

    deletePayment: function (paymentId) {
      var payments = this.getPayments();
      var idx = payments.findIndex(function (p) { return p.id === paymentId; });
      if (idx === -1) return { success: false, error: 'Payment not found' };

      var invoiceNumber = payments[idx].invoiceNumber;
      payments.splice(idx, 1);
      setStore(STORAGE_KEYS.payments, payments);

      this._updateInvoiceStatus(invoiceNumber);
      return { success: true };
    },

    getTotalPaid: function (invoiceNumber) {
      return this.getPaymentsForInvoice(invoiceNumber)
        .reduce(function (sum, p) { return sum + p.amount; }, 0);
    },

    getInvoiceBalance: function (invoiceNumber) {
      var invoices = getStore(STORAGE_KEYS.invoices, []);
      var inv = invoices.find(function (i) { return i.number === invoiceNumber; });
      if (!inv) return 0;

      var total = 0;
      if (inv.items) {
        inv.items.forEach(function (it) { total += it.amount || 0; });
      }
      var taxPct = parseFloat(inv.tax) || 0;
      total = total * (1 + taxPct / 100);

      return Math.max(0, total - this.getTotalPaid(invoiceNumber));
    },

    _updateInvoiceStatus: function (invoiceNumber) {
      var invoices = getStore(STORAGE_KEYS.invoices, []);
      var inv = invoices.find(function (i) { return i.number === invoiceNumber; });
      if (!inv) return;

      var total = 0;
      if (inv.items) inv.items.forEach(function (it) { total += it.amount || 0; });
      var taxPct = parseFloat(inv.tax) || 0;
      total = total * (1 + taxPct / 100);

      var paid = this.getTotalPaid(invoiceNumber);

      if (paid >= total - 0.01) {
        inv.status = INVOICE_STATUSES.PAID;
        inv.paidDate = new Date().toISOString();
      } else if (paid > 0) {
        inv.status = INVOICE_STATUSES.PARTIAL;
      }

      inv.paidAmount = paid;
      setStore(STORAGE_KEYS.invoices, invoices);
    },
  };

  // ─── Client Billing History ─────────────────────────────────────────

  var ClientHistory = {
    getClients: function () {
      var invoices = getStore(STORAGE_KEYS.invoices, []);
      var clients = {};

      invoices.forEach(function (inv) {
        var name = inv.clientName || 'Unknown';
        if (!clients[name]) {
          clients[name] = {
            name: name,
            email: inv.clientEmail || '',
            address: inv.clientAddress || '',
            invoices: [],
            totalInvoiced: 0,
            totalPaid: 0,
            firstInvoice: inv.date || inv.savedAt,
            lastInvoice: inv.date || inv.savedAt,
          };
        }

        var total = 0;
        if (inv.items) inv.items.forEach(function (it) { total += it.amount || 0; });
        var taxPct = parseFloat(inv.tax) || 0;
        total = total * (1 + taxPct / 100);

        var paid = PaymentTracker.getTotalPaid(inv.number);

        clients[name].invoices.push({
          number: inv.number,
          date: inv.date,
          due: inv.due,
          total: total,
          paid: paid,
          balance: Math.max(0, total - paid),
          status: inv.status || (paid >= total - 0.01 ? 'paid' : paid > 0 ? 'partial' : 'draft'),
          currency: inv.currency || 'USD',
        });

        clients[name].totalInvoiced += total;
        clients[name].totalPaid += paid;

        var invDate = inv.date || inv.savedAt;
        if (invDate < clients[name].firstInvoice) clients[name].firstInvoice = invDate;
        if (invDate > clients[name].lastInvoice) clients[name].lastInvoice = invDate;
      });

      return Object.values(clients).sort(function (a, b) {
        return b.totalInvoiced - a.totalInvoiced;
      });
    },

    getClientHistory: function (clientName) {
      var clients = this.getClients();
      return clients.find(function (c) {
        return c.name.toLowerCase() === clientName.toLowerCase();
      }) || null;
    },

    getOverdueInvoices: function () {
      var invoices = getStore(STORAGE_KEYS.invoices, []);
      var now = new Date();
      now.setHours(0, 0, 0, 0);

      return invoices.filter(function (inv) {
        if (inv.status === 'paid' || inv.status === 'cancelled') return false;
        var due = inv.due ? new Date(inv.due + 'T00:00:00') : null;
        if (!due) return false;

        var total = 0;
        if (inv.items) inv.items.forEach(function (it) { total += it.amount || 0; });
        var taxPct = parseFloat(inv.tax) || 0;
        total = total * (1 + taxPct / 100);
        var paid = PaymentTracker.getTotalPaid(inv.number);

        return due < now && paid < total - 0.01;
      }).map(function (inv) {
        var due = new Date(inv.due + 'T00:00:00');
        var daysOverdue = Math.floor((now - due) / 86400000);

        var total = 0;
        if (inv.items) inv.items.forEach(function (it) { total += it.amount || 0; });
        var taxPct = parseFloat(inv.tax) || 0;
        total = total * (1 + taxPct / 100);
        var paid = PaymentTracker.getTotalPaid(inv.number);

        return {
          number: inv.number,
          clientName: inv.clientName,
          clientEmail: inv.clientEmail,
          total: total,
          paid: paid,
          balance: total - paid,
          daysOverdue: daysOverdue,
          currency: inv.currency || 'USD',
          urgency: daysOverdue > 60 ? 'critical' : daysOverdue > 30 ? 'high' : 'medium',
        };
      }).sort(function (a, b) { return b.daysOverdue - a.daysOverdue; });
    },

    getDashboardStats: function () {
      var invoices = getStore(STORAGE_KEYS.invoices, []);
      var payments = PaymentTracker.getPayments();
      var now = new Date();
      var thisMonth = now.getMonth();
      var thisYear = now.getFullYear();

      var totalInvoiced = 0;
      var totalPaid = 0;
      var monthInvoiced = 0;
      var monthPaid = 0;
      var outstanding = 0;
      var overdueAmount = 0;
      var invoiceCount = invoices.length;
      var paidCount = 0;

      invoices.forEach(function (inv) {
        var total = 0;
        if (inv.items) inv.items.forEach(function (it) { total += it.amount || 0; });
        var taxPct = parseFloat(inv.tax) || 0;
        total = total * (1 + taxPct / 100);
        var paid = PaymentTracker.getTotalPaid(inv.number);

        totalInvoiced += total;
        totalPaid += paid;

        if (paid >= total - 0.01) paidCount++;

        var invDate = inv.date ? new Date(inv.date + 'T00:00:00') : null;
        if (invDate && invDate.getMonth() === thisMonth && invDate.getFullYear() === thisYear) {
          monthInvoiced += total;
        }

        var balance = total - paid;
        if (balance > 0.01) {
          outstanding += balance;
          var due = inv.due ? new Date(inv.due + 'T00:00:00') : null;
          if (due && due < now) overdueAmount += balance;
        }
      });

      payments.forEach(function (p) {
        var pDate = new Date(p.date);
        if (pDate.getMonth() === thisMonth && pDate.getFullYear() === thisYear) {
          monthPaid += p.amount;
        }
      });

      return {
        totalInvoiced: totalInvoiced,
        totalPaid: totalPaid,
        monthInvoiced: monthInvoiced,
        monthPaid: monthPaid,
        outstanding: outstanding,
        overdueAmount: overdueAmount,
        invoiceCount: invoiceCount,
        paidCount: paidCount,
        collectionRate: totalInvoiced > 0 ? (totalPaid / totalInvoiced * 100).toFixed(1) : '0',
        avgInvoice: invoiceCount > 0 ? totalInvoiced / invoiceCount : 0,
      };
    },
  };

  // ─── Tax Calculator ─────────────────────────────────────────────────

  var TaxCalculator = {
    presets: TAX_PRESETS,

    calculate: function (subtotal, options) {
      options = options || {};
      var taxes = [];
      var totalTax = 0;

      // Support multiple tax rates
      var rates = options.rates || [{ name: 'Tax', rate: parseFloat(options.rate || 0) }];

      rates.forEach(function (taxDef) {
        var rate = parseFloat(taxDef.rate) || 0;
        if (rate <= 0) return;

        var taxable = subtotal;
        if (options.discount) {
          if (options.discountType === 'percent') {
            taxable -= subtotal * (parseFloat(options.discount) / 100);
          } else {
            taxable -= parseFloat(options.discount);
          }
        }

        // Some jurisdictions apply tax on tax (compound)
        if (taxDef.compound && totalTax > 0) {
          taxable += totalTax;
        }

        var amount = taxable * (rate / 100);
        totalTax += amount;

        taxes.push({
          name: taxDef.name || 'Tax',
          rate: rate,
          amount: amount,
          compound: !!taxDef.compound,
        });
      });

      return {
        subtotal: subtotal,
        taxes: taxes,
        totalTax: totalTax,
        total: subtotal - (options.discountAmount || 0) + totalTax,
      };
    },

    // Withholding tax calculation (common for freelancers in some countries)
    calculateWithholding: function (grossAmount, withholdingRate) {
      var rate = parseFloat(withholdingRate) || 0;
      var withheld = grossAmount * (rate / 100);
      return {
        gross: grossAmount,
        withholdingRate: rate,
        withheld: withheld,
        net: grossAmount - withheld,
      };
    },
  };

  // ─── Accounting Export ──────────────────────────────────────────────

  var AccountingExport = {
    toCSV: function (options) {
      options = options || {};
      var invoices = getStore(STORAGE_KEYS.invoices, []);
      var payments = PaymentTracker.getPayments();

      if (options.startDate) {
        invoices = invoices.filter(function (inv) {
          return (inv.date || inv.savedAt) >= options.startDate;
        });
      }
      if (options.endDate) {
        invoices = invoices.filter(function (inv) {
          return (inv.date || inv.savedAt) <= options.endDate;
        });
      }

      var rows = ['Invoice #,Date,Due Date,Client,Client Email,Currency,Subtotal,Tax %,Tax Amount,Total,Paid,Balance,Status'];

      invoices.forEach(function (inv) {
        var total = 0;
        if (inv.items) inv.items.forEach(function (it) { total += it.amount || 0; });
        var taxPct = parseFloat(inv.tax) || 0;
        var taxAmt = total * (taxPct / 100);
        var grandTotal = total + taxAmt;
        var paid = PaymentTracker.getTotalPaid(inv.number);
        var balance = Math.max(0, grandTotal - paid);
        var status = paid >= grandTotal - 0.01 ? 'paid' : paid > 0 ? 'partial' : (inv.status || 'draft');

        rows.push([
          csvEsc(inv.number),
          csvEsc(inv.date),
          csvEsc(inv.due),
          csvEsc(inv.clientName),
          csvEsc(inv.clientEmail),
          csvEsc(inv.currency || 'USD'),
          total.toFixed(2),
          taxPct.toFixed(2),
          taxAmt.toFixed(2),
          grandTotal.toFixed(2),
          paid.toFixed(2),
          balance.toFixed(2),
          csvEsc(status),
        ].join(','));
      });

      if (options.includePayments) {
        rows.push('');
        rows.push('--- PAYMENTS ---');
        rows.push('Payment ID,Invoice #,Date,Amount,Method,Reference,Notes');
        payments.forEach(function (p) {
          rows.push([
            csvEsc(p.id), csvEsc(p.invoiceNumber), csvEsc(p.date),
            p.amount.toFixed(2), csvEsc(p.method), csvEsc(p.reference), csvEsc(p.notes),
          ].join(','));
        });
      }

      return rows.join('\n');
    },

    toJSON: function (options) {
      options = options || {};
      var invoices = getStore(STORAGE_KEYS.invoices, []);
      var payments = PaymentTracker.getPayments();

      var enriched = invoices.map(function (inv) {
        var total = 0;
        if (inv.items) inv.items.forEach(function (it) { total += it.amount || 0; });
        var taxPct = parseFloat(inv.tax) || 0;
        var taxAmt = total * (taxPct / 100);
        var grandTotal = total + taxAmt;
        var paid = PaymentTracker.getTotalPaid(inv.number);
        var invPayments = PaymentTracker.getPaymentsForInvoice(inv.number);

        return {
          invoiceNumber: inv.number,
          date: inv.date,
          dueDate: inv.due,
          client: { name: inv.clientName, email: inv.clientEmail, address: inv.clientAddress },
          freelancer: { name: inv.yourName, email: inv.yourEmail, address: inv.yourAddress },
          currency: inv.currency || 'USD',
          items: inv.items,
          subtotal: total,
          taxRate: taxPct,
          taxAmount: taxAmt,
          total: grandTotal,
          paid: paid,
          balance: Math.max(0, grandTotal - paid),
          status: paid >= grandTotal - 0.01 ? 'paid' : paid > 0 ? 'partial' : (inv.status || 'draft'),
          payments: invPayments,
          paymentTerms: inv.paymentTerms,
          notes: inv.notes,
          createdAt: inv.savedAt,
        };
      });

      return JSON.stringify({
        exportDate: new Date().toISOString(),
        invoiceCount: enriched.length,
        invoices: enriched,
      }, null, 2);
    },

    // QuickBooks Interchange Format
    toQIF: function () {
      var invoices = getStore(STORAGE_KEYS.invoices, []);
      var lines = ['!Type:Invoice'];

      invoices.forEach(function (inv) {
        var total = 0;
        if (inv.items) inv.items.forEach(function (it) { total += it.amount || 0; });
        var taxPct = parseFloat(inv.tax) || 0;
        total = total * (1 + taxPct / 100);

        lines.push('D' + (inv.date || ''));
        lines.push('T' + total.toFixed(2));
        lines.push('N' + (inv.number || ''));
        lines.push('P' + (inv.clientName || ''));
        lines.push('M' + (inv.notes || ''));
        lines.push('LAccounts Receivable');
        lines.push('^');
      });

      return lines.join('\n');
    },

    download: function (content, filename, mimeType) {
      var blob = new Blob([content], { type: mimeType || 'text/plain' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
  };

  function csvEsc(val) {
    var str = val == null ? '' : String(val);
    if (str.indexOf(',') !== -1 || str.indexOf('"') !== -1 || str.indexOf('\n') !== -1) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  // ─── Email Integration ──────────────────────────────────────────────

  var EmailService = {
    sendInvoice: function (invoiceNumber) {
      var invoices = getStore(STORAGE_KEYS.invoices, []);
      var inv = invoices.find(function (i) { return i.number === invoiceNumber; });
      if (!inv) return Promise.reject(new Error('Invoice not found'));

      var payload = {
        type: 'invoice',
        invoice: this._mapInvoice(inv),
      };

      return fetch('/api/send-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(function (res) { return res.json(); })
        .then(function (data) {
          if (data.success) {
            // Mark invoice as sent
            inv.status = INVOICE_STATUSES.SENT;
            inv.sentDate = new Date().toISOString();
            setStore(STORAGE_KEYS.invoices, invoices);
          }
          return data;
        });
    },

    sendReminder: function (invoiceNumber, level) {
      var invoices = getStore(STORAGE_KEYS.invoices, []);
      var inv = invoices.find(function (i) { return i.number === invoiceNumber; });
      if (!inv) return Promise.reject(new Error('Invoice not found'));

      var due = inv.due ? new Date(inv.due + 'T00:00:00') : new Date();
      var daysOverdue = Math.max(0, Math.floor((new Date() - due) / 86400000));

      var mapped = this._mapInvoice(inv);
      mapped.daysOverdue = daysOverdue;
      mapped.paidAmount = PaymentTracker.getTotalPaid(invoiceNumber);

      return fetch('/api/send-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'reminder',
          invoice: mapped,
          reminderLevel: level || 1,
        }),
      }).then(function (res) { return res.json(); })
        .then(function (data) {
          if (data.success) {
            inv.reminders = inv.reminders || [];
            inv.reminders.push({ date: new Date().toISOString(), level: level || 1 });
            setStore(STORAGE_KEYS.invoices, invoices);
          }
          return data;
        });
    },

    sendReceipt: function (invoiceNumber, payment) {
      var invoices = getStore(STORAGE_KEYS.invoices, []);
      var inv = invoices.find(function (i) { return i.number === invoiceNumber; });
      if (!inv) return Promise.reject(new Error('Invoice not found'));

      return fetch('/api/send-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'receipt',
          invoice: this._mapInvoice(inv),
          payment: payment,
        }),
      }).then(function (res) { return res.json(); });
    },

    _mapInvoice: function (inv) {
      var total = 0;
      if (inv.items) inv.items.forEach(function (it) { total += it.amount || 0; });
      var taxPct = parseFloat(inv.tax) || 0;
      var taxAmount = total * (taxPct / 100);
      total = total + taxAmount;

      return {
        invoiceNumber: inv.number,
        fromName: inv.yourName,
        fromEmail: inv.yourEmail,
        fromAddress: inv.yourAddress,
        clientName: inv.clientName,
        clientEmail: inv.clientEmail,
        clientAddress: inv.clientAddress,
        currency: inv.currency || 'USD',
        items: (inv.items || []).map(function (it) {
          return { description: it.desc, quantity: it.qty, rate: it.rate, amount: it.amount };
        }),
        total: total,
        taxRate: taxPct,
        taxAmount: taxAmount,
        issueDate: inv.date,
        dueDate: inv.due,
        paymentTerms: inv.paymentTerms,
        notes: inv.notes,
        logo: inv.logo,
        bankDetails: {
          bankName: inv.bankName,
          accountHolder: inv.bankHolder,
          iban: inv.bankIban,
          swift: inv.bankSwift,
        },
      };
    },
  };

  // ─── Template Manager ───────────────────────────────────────────────

  var TemplateManager = {
    templates: TEMPLATES,

    getCurrent: function () {
      return localStorage.getItem(STORAGE_KEYS.template) || 'professional';
    },

    setCurrent: function (templateId) {
      if (TEMPLATES.indexOf(templateId) === -1) return false;
      localStorage.setItem(STORAGE_KEYS.template, templateId);
      return true;
    },

    generateServerPDF: function (invoiceNumber) {
      var invoices = getStore(STORAGE_KEYS.invoices, []);
      var inv = invoices.find(function (i) { return i.number === invoiceNumber; });
      if (!inv) return Promise.reject(new Error('Invoice not found'));

      var mapped = EmailService._mapInvoice(inv);
      mapped.logo = inv.logo;

      return fetch('/api/generate-invoice-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice: mapped,
          template: this.getCurrent(),
          format: 'pdf',
        }),
      }).then(function (res) {
        if (res.headers.get('content-type') === 'application/pdf') {
          return res.blob().then(function (blob) {
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = (inv.number || 'invoice') + '.pdf';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            return { success: true, format: 'pdf' };
          });
        }
        return res.json();
      });
    },
  };

  // ─── UI Renderers ──────────────────────────────────────────────────

  function renderStatusBadge(status) {
    var s = STATUS_COLORS[status] || STATUS_COLORS.draft;
    return '<span style="display:inline-block;padding:3px 10px;border-radius:100px;font-size:.7rem;font-weight:700;letter-spacing:.5px;text-transform:uppercase;background:' + s.bg + ';color:' + s.color + '">' + s.label + '</span>';
  }

  function renderPaymentModal(invoiceNumber, currency) {
    var sym = { USD: '$', EUR: '\u20ac', GBP: '\u00a3', TRY: '\u20ba' }[currency] || '$';
    var balance = PaymentTracker.getInvoiceBalance(invoiceNumber);

    var methodOpts = PAYMENT_METHODS.map(function (m) {
      return '<option value="' + m.value + '">' + m.label + '</option>';
    }).join('');

    return '<div id="payment-modal" style="position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(8px);z-index:500;display:flex;align-items:center;justify-content:center;padding:1rem">' +
      '<div style="background:var(--bg2,#111118);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:2rem;max-width:480px;width:100%">' +
      '<h3 style="font-size:1.1rem;font-weight:800;color:var(--text,#f0f0f0);margin-bottom:1.5rem">Record Payment</h3>' +
      '<div style="font-size:.85rem;color:var(--text2,#b0b0b0);margin-bottom:1rem">Invoice: <strong style="color:var(--text,#f0f0f0)">' + invoiceNumber + '</strong> &mdash; Balance: <strong style="color:var(--green,#00ff88)">' + sym + balance.toFixed(2) + '</strong></div>' +

      '<div style="margin-bottom:.75rem"><label style="display:block;font-size:.7rem;font-weight:600;color:var(--text3,#666);text-transform:uppercase;letter-spacing:.5px;margin-bottom:.3rem">Amount *</label>' +
      '<input id="pay-amount" type="number" step="0.01" min="0.01" max="' + balance.toFixed(2) + '" value="' + balance.toFixed(2) + '" style="width:100%;background:var(--bg3,#1a1a22);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:.65rem .9rem;color:var(--text,#f0f0f0);font-size:.9rem;font-family:inherit;outline:none"></div>' +

      '<div style="margin-bottom:.75rem"><label style="display:block;font-size:.7rem;font-weight:600;color:var(--text3,#666);text-transform:uppercase;letter-spacing:.5px;margin-bottom:.3rem">Method</label>' +
      '<select id="pay-method" style="width:100%;background:var(--bg3,#1a1a22);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:.65rem .9rem;color:var(--text,#f0f0f0);font-size:.9rem;font-family:inherit;outline:none;appearance:none">' + methodOpts + '</select></div>' +

      '<div style="margin-bottom:.75rem"><label style="display:block;font-size:.7rem;font-weight:600;color:var(--text3,#666);text-transform:uppercase;letter-spacing:.5px;margin-bottom:.3rem">Date</label>' +
      '<input id="pay-date" type="date" value="' + new Date().toISOString().slice(0, 10) + '" style="width:100%;background:var(--bg3,#1a1a22);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:.65rem .9rem;color:var(--text,#f0f0f0);font-size:.9rem;font-family:inherit;outline:none"></div>' +

      '<div style="margin-bottom:1.25rem"><label style="display:block;font-size:.7rem;font-weight:600;color:var(--text3,#666);text-transform:uppercase;letter-spacing:.5px;margin-bottom:.3rem">Reference (optional)</label>' +
      '<input id="pay-reference" type="text" placeholder="Transaction ID, check #, etc." style="width:100%;background:var(--bg3,#1a1a22);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:.65rem .9rem;color:var(--text,#f0f0f0);font-size:.9rem;font-family:inherit;outline:none"></div>' +

      '<div style="display:flex;gap:.75rem">' +
      '<button onclick="CortexFreelancer.InvoicePro.submitPayment(\'' + invoiceNumber + '\')" style="flex:1;background:var(--green,#00ff88);color:#000;border:none;border-radius:100px;padding:.75rem;font-weight:700;font-size:.85rem;cursor:pointer;font-family:inherit">Record Payment</button>' +
      '<button onclick="document.getElementById(\'payment-modal\').remove()" style="flex:1;background:var(--bg3,#1a1a22);color:var(--text,#f0f0f0);border:1px solid rgba(255,255,255,.1);border-radius:100px;padding:.75rem;font-weight:700;font-size:.85rem;cursor:pointer;font-family:inherit">Cancel</button>' +
      '</div></div></div>';
  }

  function renderExportModal() {
    return '<div id="export-modal" style="position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(8px);z-index:500;display:flex;align-items:center;justify-content:center;padding:1rem">' +
      '<div style="background:var(--bg2,#111118);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:2rem;max-width:500px;width:100%">' +
      '<h3 style="font-size:1.1rem;font-weight:800;color:var(--text,#f0f0f0);margin-bottom:1.5rem">Export Invoices</h3>' +
      '<p style="font-size:.85rem;color:var(--text2,#b0b0b0);margin-bottom:1.25rem">Export your invoice data for accounting software or records.</p>' +

      '<div style="margin-bottom:1rem"><label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;font-size:.85rem;color:var(--text,#f0f0f0);margin-bottom:.5rem"><input type="checkbox" id="export-include-payments" checked style="accent-color:var(--orange,#ff8844)"> Include payment records</label></div>' +

      '<div style="display:flex;flex-direction:column;gap:.75rem;margin-bottom:1.25rem">' +
      '<button onclick="CortexFreelancer.InvoicePro.exportCSV()" style="display:flex;align-items:center;gap:.75rem;background:var(--bg3,#1a1a22);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:1rem;cursor:pointer;font-family:inherit;text-align:left;transition:border-color .2s" onmouseover="this.style.borderColor=\'var(--orange,#ff8844)\'" onmouseout="this.style.borderColor=\'rgba(255,255,255,.08)\'">' +
      '<span style="font-size:1.5rem">&#128196;</span><div><div style="font-weight:700;font-size:.9rem;color:var(--text,#f0f0f0)">CSV Export</div><div style="font-size:.75rem;color:var(--text3,#666)">Compatible with Excel, Google Sheets, QuickBooks</div></div></button>' +

      '<button onclick="CortexFreelancer.InvoicePro.exportJSON()" style="display:flex;align-items:center;gap:.75rem;background:var(--bg3,#1a1a22);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:1rem;cursor:pointer;font-family:inherit;text-align:left;transition:border-color .2s" onmouseover="this.style.borderColor=\'var(--orange,#ff8844)\'" onmouseout="this.style.borderColor=\'rgba(255,255,255,.08)\'">' +
      '<span style="font-size:1.5rem">&#128187;</span><div><div style="font-weight:700;font-size:.9rem;color:var(--text,#f0f0f0)">JSON Export</div><div style="font-size:.75rem;color:var(--text3,#666)">Full data export for developers & custom integrations</div></div></button>' +

      '<button onclick="CortexFreelancer.InvoicePro.exportQIF()" style="display:flex;align-items:center;gap:.75rem;background:var(--bg3,#1a1a22);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:1rem;cursor:pointer;font-family:inherit;text-align:left;transition:border-color .2s" onmouseover="this.style.borderColor=\'var(--orange,#ff8844)\'" onmouseout="this.style.borderColor=\'rgba(255,255,255,.08)\'">' +
      '<span style="font-size:1.5rem">&#128200;</span><div><div style="font-weight:700;font-size:.9rem;color:var(--text,#f0f0f0)">QIF Export</div><div style="font-size:.75rem;color:var(--text3,#666)">QuickBooks Interchange Format</div></div></button>' +
      '</div>' +

      '<button onclick="document.getElementById(\'export-modal\').remove()" style="width:100%;background:var(--bg3,#1a1a22);color:var(--text2,#b0b0b0);border:1px solid rgba(255,255,255,.1);border-radius:100px;padding:.7rem;font-weight:600;font-size:.85rem;cursor:pointer;font-family:inherit">Close</button>' +
      '</div></div>';
  }

  function renderTemplateSelector() {
    var current = TemplateManager.getCurrent();
    var templates = [
      { id: 'professional', name: 'Professional', desc: 'Clean, corporate look with orange accents', preview: 'linear-gradient(135deg,#fff 60%,#f9fafb 100%)' },
      { id: 'minimal', name: 'Minimal', desc: 'Ultra-clean with bold typography', preview: 'linear-gradient(135deg,#fff 60%,#f3f4f6 100%)' },
      { id: 'bold', name: 'Bold Dark', desc: 'Dark theme with vibrant orange highlights', preview: 'linear-gradient(135deg,#111827 60%,#1f2937 100%)' },
    ];

    return '<div id="template-modal" style="position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(8px);z-index:500;display:flex;align-items:center;justify-content:center;padding:1rem">' +
      '<div style="background:var(--bg2,#111118);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:2rem;max-width:560px;width:100%">' +
      '<h3 style="font-size:1.1rem;font-weight:800;color:var(--text,#f0f0f0);margin-bottom:1.5rem">Choose Template</h3>' +
      '<div style="display:flex;flex-direction:column;gap:.75rem;margin-bottom:1.25rem">' +
      templates.map(function (t) {
        var isActive = t.id === current;
        return '<button onclick="CortexFreelancer.InvoicePro.selectTemplate(\'' + t.id + '\')" style="display:flex;align-items:center;gap:1rem;background:var(--bg3,#1a1a22);border:2px solid ' + (isActive ? 'var(--orange,#ff8844)' : 'rgba(255,255,255,.08)') + ';border-radius:12px;padding:1rem;cursor:pointer;font-family:inherit;text-align:left;transition:border-color .2s" onmouseover="this.style.borderColor=\'var(--orange,#ff8844)\'" onmouseout="this.style.borderColor=\'' + (isActive ? 'var(--orange,#ff8844)' : 'rgba(255,255,255,.08)') + '\'">' +
          '<div style="width:60px;height:80px;border-radius:6px;background:' + t.preview + ';border:1px solid rgba(255,255,255,.1);flex-shrink:0"></div>' +
          '<div><div style="font-weight:700;font-size:.9rem;color:var(--text,#f0f0f0);display:flex;align-items:center;gap:.5rem">' + t.name + (isActive ? ' <span style="font-size:.65rem;background:var(--orange,#ff8844);color:#000;padding:2px 8px;border-radius:100px;font-weight:800">ACTIVE</span>' : '') + '</div><div style="font-size:.75rem;color:var(--text3,#666);margin-top:.25rem">' + t.desc + '</div></div></button>';
      }).join('') +
      '</div>' +
      '<button onclick="document.getElementById(\'template-modal\').remove()" style="width:100%;background:var(--bg3,#1a1a22);color:var(--text2,#b0b0b0);border:1px solid rgba(255,255,255,.1);border-radius:100px;padding:.7rem;font-weight:600;font-size:.85rem;cursor:pointer;font-family:inherit">Close</button>' +
      '</div></div>';
  }

  // ─── Public API ─────────────────────────────────────────────────────

  var InvoicePro = {
    // Constants
    STATUSES: INVOICE_STATUSES,
    STATUS_COLORS: STATUS_COLORS,
    PAYMENT_METHODS: PAYMENT_METHODS,
    TAX_PRESETS: TAX_PRESETS,
    TEMPLATES: TEMPLATES,

    // Modules
    PaymentTracker: PaymentTracker,
    ClientHistory: ClientHistory,
    TaxCalculator: TaxCalculator,
    AccountingExport: AccountingExport,
    EmailService: EmailService,
    TemplateManager: TemplateManager,

    // UI
    renderStatusBadge: renderStatusBadge,

    // Quick actions
    showPaymentModal: function (invoiceNumber, currency) {
      var existing = document.getElementById('payment-modal');
      if (existing) existing.remove();
      document.body.insertAdjacentHTML('beforeend', renderPaymentModal(invoiceNumber, currency || 'USD'));
    },

    submitPayment: function (invoiceNumber) {
      var amount = parseFloat(document.getElementById('pay-amount').value);
      var method = document.getElementById('pay-method').value;
      var date = document.getElementById('pay-date').value;
      var reference = document.getElementById('pay-reference').value;

      if (!amount || amount <= 0) {
        alert('Please enter a valid amount');
        return;
      }

      var result = PaymentTracker.recordPayment({
        invoiceNumber: invoiceNumber,
        amount: amount,
        method: method,
        date: date,
        reference: reference,
      });

      if (result.success) {
        document.getElementById('payment-modal').remove();
        if (typeof showToast === 'function') showToast('Payment of ' + amount.toFixed(2) + ' recorded!');
        if (typeof renderDrafts === 'function') renderDrafts();
      }
    },

    showExportModal: function () {
      var existing = document.getElementById('export-modal');
      if (existing) existing.remove();
      document.body.insertAdjacentHTML('beforeend', renderExportModal());
    },

    exportCSV: function () {
      var includePayments = document.getElementById('export-include-payments');
      var csv = AccountingExport.toCSV({ includePayments: includePayments ? includePayments.checked : true });
      AccountingExport.download(csv, 'cortex-invoices-' + new Date().toISOString().slice(0, 10) + '.csv', 'text/csv');
      if (typeof showToast === 'function') showToast('CSV exported!');
    },

    exportJSON: function () {
      var json = AccountingExport.toJSON();
      AccountingExport.download(json, 'cortex-invoices-' + new Date().toISOString().slice(0, 10) + '.json', 'application/json');
      if (typeof showToast === 'function') showToast('JSON exported!');
    },

    exportQIF: function () {
      var qif = AccountingExport.toQIF();
      AccountingExport.download(qif, 'cortex-invoices-' + new Date().toISOString().slice(0, 10) + '.qif', 'application/qif');
      if (typeof showToast === 'function') showToast('QIF exported!');
    },

    showTemplateSelector: function () {
      var existing = document.getElementById('template-modal');
      if (existing) existing.remove();
      document.body.insertAdjacentHTML('beforeend', renderTemplateSelector());
    },

    selectTemplate: function (templateId) {
      TemplateManager.setCurrent(templateId);
      document.getElementById('template-modal').remove();
      if (typeof showToast === 'function') showToast('Template set to ' + templateId);
    },

    sendInvoiceEmail: function (invoiceNumber) {
      EmailService.sendInvoice(invoiceNumber).then(function (result) {
        if (result.success) {
          if (typeof showToast === 'function') showToast('Invoice sent to ' + result.to);
          if (typeof renderDrafts === 'function') renderDrafts();
        } else {
          alert('Failed to send: ' + (result.error && result.error.message || 'Unknown error'));
        }
      }).catch(function (err) {
        alert('Error: ' + err.message);
      });
    },

    sendReminderEmail: function (invoiceNumber, level) {
      EmailService.sendReminder(invoiceNumber, level).then(function (result) {
        if (result.success) {
          if (typeof showToast === 'function') showToast('Reminder sent!');
        } else {
          alert('Failed to send reminder');
        }
      }).catch(function (err) {
        alert('Error: ' + err.message);
      });
    },

    applyTaxPreset: function (presetKey) {
      var preset = TAX_PRESETS[presetKey];
      if (!preset) return;
      var taxInput = document.getElementById('inv-tax');
      if (taxInput) {
        taxInput.value = preset.rate;
        if (typeof updatePreview === 'function') updatePreview();
      }
    },
  };

  window.CortexFreelancer.InvoicePro = InvoicePro;
})();
