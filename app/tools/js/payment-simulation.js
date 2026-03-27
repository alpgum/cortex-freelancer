/**
 * Cortex Freelancer — Payment Simulation & Revenue Tracking
 * CF3-MVP-006: Invoice PDF export, payment tracking, revenue forecasting
 */
;(function(global) {
  'use strict';

  var KEYS = {
    INVOICES: 'cortex_invoices',
    PAYMENTS: 'cortex_payments',
    REVENUE: 'cortex_revenue_data',
    PROPOSALS: 'cortex_proposals',
    PROJECTS: 'cortex_projects'
  };

  function load(key, fb) {
    try { var r = localStorage.getItem(key); return r ? JSON.parse(r) : fb; } catch(e) { return fb; }
  }
  function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
  function fmt(n) { return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  var PaymentSimulation = {

    // ── Invoice Management ──────────────────────────────
    createInvoice: function(data) {
      var invoices = load(KEYS.INVOICES, []);
      var invoice = {
        id: 'INV-' + String(invoices.length + 1001).padStart(4, '0'),
        clientName: data.clientName || 'Client',
        projectName: data.projectName || 'Project',
        items: data.items || [{ description: 'Development Services', hours: 40, rate: 75, amount: 3000 }],
        subtotal: 0,
        tax: data.tax || 0,
        taxRate: data.taxRate || 0,
        discount: data.discount || 0,
        total: 0,
        currency: data.currency || 'USD',
        status: 'pending', // pending, sent, paid, overdue, cancelled
        issueDate: data.issueDate || new Date().toISOString().split('T')[0],
        dueDate: data.dueDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        paidDate: null,
        paymentMethod: null,
        notes: data.notes || 'Thank you for your business!',
        terms: data.terms || 'Net 30',
        createdAt: new Date().toISOString()
      };

      // Calculate totals
      invoice.subtotal = invoice.items.reduce(function(s, item) {
        item.amount = item.hours * item.rate;
        return s + item.amount;
      }, 0);
      invoice.tax = invoice.subtotal * (invoice.taxRate / 100);
      invoice.total = invoice.subtotal + invoice.tax - invoice.discount;

      invoices.unshift(invoice);
      save(KEYS.INVOICES, invoices);
      return invoice;
    },

    getInvoices: function(filter) {
      var invoices = load(KEYS.INVOICES, []);
      if (filter && filter.status) {
        invoices = invoices.filter(function(i) { return i.status === filter.status; });
      }
      return invoices;
    },

    markPaid: function(invoiceId, method) {
      var invoices = load(KEYS.INVOICES, []);
      var inv = invoices.find(function(i) { return i.id === invoiceId; });
      if (inv) {
        inv.status = 'paid';
        inv.paidDate = new Date().toISOString().split('T')[0];
        inv.paymentMethod = method || 'bank_transfer';
        save(KEYS.INVOICES, invoices);

        // Record payment
        this.recordPayment({
          invoiceId: inv.id,
          amount: inv.total,
          client: inv.clientName,
          project: inv.projectName,
          method: inv.paymentMethod,
          date: inv.paidDate
        });
      }
      return inv;
    },

    // ── PDF Export ───────────────────────────────────────
    generateInvoicePDF: function(invoiceId) {
      var invoices = load(KEYS.INVOICES, []);
      var inv = invoices.find(function(i) { return i.id === invoiceId; });
      if (!inv) return null;

      // Generate printable HTML (for window.print() or html2pdf)
      var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice ' + inv.id + '</title><style>';
      html += 'body{font-family:Inter,-apple-system,sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#1a1a2e}';
      html += '.header{display:flex;justify-content:space-between;margin-bottom:40px}';
      html += '.logo{font-size:28px;font-weight:800;color:#ff8844}';
      html += '.invoice-num{font-size:14px;color:#666}';
      html += '.meta{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-bottom:40px}';
      html += '.meta-block h3{font-size:12px;text-transform:uppercase;color:#999;margin:0 0 8px}';
      html += '.meta-block p{margin:2px 0;font-size:14px}';
      html += 'table{width:100%;border-collapse:collapse;margin-bottom:30px}';
      html += 'th{background:#f8f8fc;padding:12px;text-align:left;font-size:12px;text-transform:uppercase;color:#666;border-bottom:2px solid #eee}';
      html += 'td{padding:12px;border-bottom:1px solid #f0f0f0;font-size:14px}';
      html += '.amount{text-align:right;font-weight:600}';
      html += '.totals{float:right;width:250px}';
      html += '.total-row{display:flex;justify-content:space-between;padding:8px 0;font-size:14px}';
      html += '.total-row.grand{border-top:2px solid #1a1a2e;font-size:18px;font-weight:700;padding-top:12px;margin-top:8px}';
      html += '.status{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600}';
      html += '.status.paid{background:#00ff8833;color:#00cc6a}.status.pending{background:#ffc80033;color:#cc9900}.status.overdue{background:#ff444433;color:#ff4444}';
      html += '.notes{margin-top:60px;padding-top:20px;border-top:1px solid #eee;font-size:13px;color:#666}';
      html += '@media print{body{padding:20px}}';
      html += '</style></head><body>';

      html += '<div class="header"><div><div class="logo">CORTEX</div><div style="font-size:12px;color:#666">Freelancer</div></div>';
      html += '<div style="text-align:right"><div class="invoice-num">Invoice ' + inv.id + '</div>';
      html += '<span class="status ' + inv.status + '">' + inv.status.toUpperCase() + '</span></div></div>';

      html += '<div class="meta"><div class="meta-block"><h3>Bill To</h3><p><strong>' + inv.clientName + '</strong></p><p>' + inv.projectName + '</p></div>';
      html += '<div class="meta-block" style="text-align:right"><h3>Invoice Details</h3>';
      html += '<p>Date: ' + inv.issueDate + '</p>';
      html += '<p>Due: ' + inv.dueDate + '</p>';
      html += '<p>Terms: ' + inv.terms + '</p></div></div>';

      html += '<table><thead><tr><th>Description</th><th>Hours</th><th>Rate</th><th class="amount">Amount</th></tr></thead><tbody>';
      inv.items.forEach(function(item) {
        html += '<tr><td>' + item.description + '</td><td>' + item.hours + '</td><td>' + fmt(item.rate) + '</td><td class="amount">' + fmt(item.amount) + '</td></tr>';
      });
      html += '</tbody></table>';

      html += '<div class="totals">';
      html += '<div class="total-row"><span>Subtotal</span><span>' + fmt(inv.subtotal) + '</span></div>';
      if (inv.taxRate > 0) html += '<div class="total-row"><span>Tax (' + inv.taxRate + '%)</span><span>' + fmt(inv.tax) + '</span></div>';
      if (inv.discount > 0) html += '<div class="total-row"><span>Discount</span><span>-' + fmt(inv.discount) + '</span></div>';
      html += '<div class="total-row grand"><span>Total</span><span>' + fmt(inv.total) + '</span></div>';
      html += '</div><div style="clear:both"></div>';

      html += '<div class="notes"><strong>Notes:</strong> ' + inv.notes + '</div>';
      html += '</body></html>';

      return html;
    },

    exportPDF: function(invoiceId) {
      var html = this.generateInvoicePDF(invoiceId);
      if (!html) return false;

      var win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
        setTimeout(function() { win.print(); }, 500);
      }
      return true;
    },

    // ── Payment Tracking ────────────────────────────────
    recordPayment: function(payment) {
      var payments = load(KEYS.PAYMENTS, []);
      payments.unshift({
        id: 'pay_' + Date.now(),
        invoiceId: payment.invoiceId,
        amount: payment.amount,
        client: payment.client,
        project: payment.project,
        method: payment.method || 'bank_transfer',
        date: payment.date || new Date().toISOString().split('T')[0],
        category: payment.category || 'project_payment',
        createdAt: new Date().toISOString()
      });
      save(KEYS.PAYMENTS, payments);
    },

    getPayments: function(dateRange) {
      var payments = load(KEYS.PAYMENTS, []);
      if (dateRange && dateRange.start) {
        payments = payments.filter(function(p) {
          return p.date >= dateRange.start && (!dateRange.end || p.date <= dateRange.end);
        });
      }
      return payments;
    },

    // ── Revenue Dashboard ───────────────────────────────
    getRevenueSummary: function() {
      var payments = load(KEYS.PAYMENTS, []);
      var invoices = load(KEYS.INVOICES, []);
      var proposals = load(KEYS.PROPOSALS, []);
      var now = new Date();
      var thisMonth = now.toISOString().slice(0, 7);
      var lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 7);

      var thisMonthPayments = payments.filter(function(p) { return p.date && p.date.startsWith(thisMonth); });
      var lastMonthPayments = payments.filter(function(p) { return p.date && p.date.startsWith(lastMonth); });

      var thisMonthRevenue = thisMonthPayments.reduce(function(s, p) { return s + p.amount; }, 0);
      var lastMonthRevenue = lastMonthPayments.reduce(function(s, p) { return s + p.amount; }, 0);
      var totalRevenue = payments.reduce(function(s, p) { return s + p.amount; }, 0);

      var pendingInvoices = invoices.filter(function(i) { return i.status === 'pending' || i.status === 'sent'; });
      var pendingAmount = pendingInvoices.reduce(function(s, i) { return s + i.total; }, 0);

      var overdueInvoices = invoices.filter(function(i) {
        return (i.status === 'pending' || i.status === 'sent') && i.dueDate < now.toISOString().split('T')[0];
      });
      var overdueAmount = overdueInvoices.reduce(function(s, i) { return s + i.total; }, 0);

      return {
        thisMonth: { revenue: thisMonthRevenue, payments: thisMonthPayments.length },
        lastMonth: { revenue: lastMonthRevenue, payments: lastMonthPayments.length },
        growth: lastMonthRevenue > 0 ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100) : 0,
        total: totalRevenue,
        pending: { amount: pendingAmount, count: pendingInvoices.length },
        overdue: { amount: overdueAmount, count: overdueInvoices.length },
        avgInvoice: invoices.length > 0 ? Math.round(totalRevenue / Math.max(1, payments.length)) : 0,
        topClients: this.getTopClients(payments)
      };
    },

    getTopClients: function(payments) {
      var clientTotals = {};
      payments.forEach(function(p) {
        var c = p.client || 'Unknown';
        clientTotals[c] = (clientTotals[c] || 0) + p.amount;
      });
      return Object.entries(clientTotals)
        .sort(function(a, b) { return b[1] - a[1]; })
        .slice(0, 5)
        .map(function(entry) { return { name: entry[0], revenue: entry[1] }; });
    },

    // ── Revenue Forecasting ─────────────────────────────
    getForecast: function(months) {
      months = months || 6;
      var payments = load(KEYS.PAYMENTS, []);
      var proposals = load(KEYS.PROPOSALS, []);

      // Monthly revenue for last 6 months
      var monthlyRevenue = {};
      var now = new Date();
      for (var i = 5; i >= 0; i--) {
        var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        var key = d.toISOString().slice(0, 7);
        monthlyRevenue[key] = 0;
      }
      payments.forEach(function(p) {
        var m = (p.date || '').slice(0, 7);
        if (monthlyRevenue[m] !== undefined) monthlyRevenue[m] += p.amount;
      });

      var values = Object.values(monthlyRevenue);
      var avgMonthly = values.length > 0 ? values.reduce(function(a, b) { return a + b; }, 0) / values.length : 0;

      // Factor in pending proposals
      var pendingProposals = proposals.filter(function(p) {
        return p.status === 'pending' || p.status === 'sent' || p.status === 'interview';
      });
      var pipelineValue = pendingProposals.reduce(function(s, p) { return s + (p.totalBudget || 0); }, 0);
      var expectedWinRate = 0.25; // Conservative 25% win rate

      var forecast = [];
      for (var m = 1; m <= months; m++) {
        var futureDate = new Date(now.getFullYear(), now.getMonth() + m, 1);
        var projected = avgMonthly;

        // Add pipeline contribution (decreasing over time)
        if (m <= 3) {
          projected += (pipelineValue * expectedWinRate) / 3;
        }

        // Growth trend (5% monthly)
        projected *= (1 + 0.05 * m / months);

        forecast.push({
          month: futureDate.toISOString().slice(0, 7),
          label: futureDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          projected: Math.round(projected),
          optimistic: Math.round(projected * 1.3),
          conservative: Math.round(projected * 0.7)
        });
      }

      return {
        monthlyAverage: Math.round(avgMonthly),
        pipelineValue: pipelineValue,
        expectedPipeline: Math.round(pipelineValue * expectedWinRate),
        forecast: forecast,
        annualProjected: Math.round(avgMonthly * 12 * 1.1)
      };
    },

    // ── Seed Demo Data ──────────────────────────────────
    seedDemoPayments: function() {
      var payments = load(KEYS.PAYMENTS, []);
      if (payments.length > 3) return;

      var now = new Date();
      var demoPayments = [];
      var clients = ['TechCorp', 'DesignHub', 'StartupXYZ', 'DataFlow', 'ShopNow Inc.'];
      var projects = ['Dashboard Build', 'Brand Redesign', 'API Integration', 'Mobile App', 'E-commerce Site'];

      for (var i = 0; i < 15; i++) {
        var d = new Date(now.getFullYear(), now.getMonth() - Math.floor(i / 3), Math.floor(Math.random() * 25) + 1);
        demoPayments.push({
          id: 'pay_demo_' + i,
          invoiceId: 'INV-' + String(1001 + i).padStart(4, '0'),
          amount: Math.round((Math.random() * 4000 + 1000) * 100) / 100,
          client: clients[i % clients.length],
          project: projects[i % projects.length],
          method: ['bank_transfer', 'paypal', 'stripe', 'wise'][Math.floor(Math.random() * 4)],
          date: d.toISOString().split('T')[0],
          category: 'project_payment',
          createdAt: d.toISOString()
        });
      }

      save(KEYS.PAYMENTS, demoPayments.concat(payments));

      // Also seed some invoices
      var invoices = load(KEYS.INVOICES, []);
      if (invoices.length < 3) {
        var demoInvoices = [
          { id: 'INV-1016', clientName: 'TechCorp', projectName: 'Dashboard Phase 2', items: [{ description: 'Development', hours: 40, rate: 85, amount: 3400 }], subtotal: 3400, tax: 0, taxRate: 0, discount: 0, total: 3400, currency: 'USD', status: 'pending', issueDate: now.toISOString().split('T')[0], dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0], terms: 'Net 30', notes: 'Thank you!', createdAt: now.toISOString() },
          { id: 'INV-1017', clientName: 'DataFlow', projectName: 'API Docs', items: [{ description: 'Technical Writing', hours: 20, rate: 70, amount: 1400 }], subtotal: 1400, tax: 0, taxRate: 0, discount: 0, total: 1400, currency: 'USD', status: 'sent', issueDate: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0], dueDate: new Date(Date.now() + 25 * 86400000).toISOString().split('T')[0], terms: 'Net 30', notes: 'Thank you!', createdAt: new Date(Date.now() - 5 * 86400000).toISOString() },
          { id: 'INV-1018', clientName: 'ShopNow Inc.', projectName: 'E-commerce Sprint 3', items: [{ description: 'Full-Stack Dev', hours: 60, rate: 90, amount: 5400 }], subtotal: 5400, tax: 0, taxRate: 0, discount: 0, total: 5400, currency: 'USD', status: 'overdue', issueDate: new Date(Date.now() - 40 * 86400000).toISOString().split('T')[0], dueDate: new Date(Date.now() - 10 * 86400000).toISOString().split('T')[0], terms: 'Net 30', notes: 'Overdue — please pay ASAP', createdAt: new Date(Date.now() - 40 * 86400000).toISOString() }
        ];
        save(KEYS.INVOICES, demoInvoices.concat(invoices));
      }
    }
  };

  global.PaymentSimulation = PaymentSimulation;
})(window);
