/**
 * Cortex Freelancer — Expense Tracker
 * Track business expenses by category, calculate profit margins,
 * monthly/quarterly summaries, and export for accountant.
 * Exposed on window.CortexExpenses
 */
(function () {
  'use strict';

  var KEYS = {
    expenses: 'cortex_expenses',
    revenue: 'cortex_expenses_revenue'
  };

  var CATEGORIES = ['software', 'hardware', 'office', 'travel', 'education'];
  var CAT_COLORS = {
    software: '#8888ff',
    hardware: '#ff8844',
    office: '#00ff88',
    travel: '#ffc800',
    education: '#cc66ff'
  };

  var charts = {};
  var currentPeriod = 'year';

  /* ───────── Storage helpers ───────── */

  function load(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); }
    catch (e) { return []; }
  }

  function save(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  /* ───────── Utilities ───────── */

  function fmt(n) {
    if (n == null || isNaN(n)) return '$0';
    if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'K';
    return '$' + Math.round(n).toLocaleString();
  }

  function fmtExact(n) {
    if (n == null || isNaN(n)) return '$0.00';
    return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function esc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function currentMonth() {
    return new Date().toISOString().slice(0, 7);
  }

  function monthLabel(ym) {
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var parts = ym.split('-');
    return months[parseInt(parts[1], 10) - 1] + ' ' + parts[0].slice(2);
  }

  function getDateMonth(dateStr) {
    return dateStr.slice(0, 7);
  }

  function getQuarter(dateStr) {
    var m = parseInt(dateStr.slice(5, 7), 10);
    return 'Q' + Math.ceil(m / 3);
  }

  function getYear(dateStr) {
    return dateStr.slice(0, 4);
  }

  /* ───────── Period filtering ───────── */

  function getPeriodRange() {
    var now = new Date();
    var y = now.getFullYear();
    var m = now.getMonth();
    switch (currentPeriod) {
      case 'month':
        return { start: new Date(y, m, 1).toISOString().slice(0, 10), label: monthLabel(currentMonth()) };
      case 'quarter':
        var qStart = Math.floor(m / 3) * 3;
        return { start: new Date(y, qStart, 1).toISOString().slice(0, 10), label: 'Q' + Math.ceil((m + 1) / 3) + ' ' + y };
      case 'year':
        return { start: y + '-01-01', label: String(y) };
      default:
        return { start: '1970-01-01', label: 'All Time' };
    }
  }

  function filterByPeriod(entries) {
    var range = getPeriodRange();
    return entries.filter(function (e) {
      return (e.date || e.month + '-01') >= range.start;
    });
  }

  function filterRevenueByPeriod(entries) {
    var range = getPeriodRange();
    return entries.filter(function (e) {
      return (e.month + '-01') >= range.start;
    });
  }

  /* ───────── Toast ───────── */

  function toast(msg) {
    var el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(function () { el.classList.remove('show'); }, 2400);
  }

  /* ───────── KPI Update ───────── */

  function updateKPIs() {
    var expenses = filterByPeriod(load(KEYS.expenses));
    var revenueEntries = filterRevenueByPeriod(load(KEYS.revenue));

    var totalExpenses = expenses.reduce(function (s, e) { return s + (e.amount || 0); }, 0);
    var totalRevenue = revenueEntries.reduce(function (s, e) { return s + (e.amount || 0); }, 0);
    var profit = totalRevenue - totalExpenses;
    var margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
    var deductible = expenses.filter(function (e) { return e.deductible; })
      .reduce(function (s, e) { return s + (e.amount || 0); }, 0);

    document.getElementById('kpi-expenses').textContent = fmt(totalExpenses);
    document.getElementById('kpi-expenses-sub').textContent = expenses.length + ' entries';
    document.getElementById('kpi-revenue').textContent = fmt(totalRevenue);
    document.getElementById('kpi-profit').textContent = fmt(profit);
    document.getElementById('kpi-profit').className = 'kpi-value ' + (profit >= 0 ? 'green' : 'red');
    document.getElementById('kpi-margin').textContent = Math.round(margin) + '%';
    document.getElementById('kpi-margin').className = 'kpi-value ' + (margin >= 0 ? 'blue' : 'red');
    document.getElementById('kpi-deductible').textContent = fmt(deductible);

    var range = getPeriodRange();
    document.getElementById('period-label').textContent = range.label;
  }

  /* ───────── Charts ───────── */

  function getMonthlyData() {
    var expenses = filterByPeriod(load(KEYS.expenses));
    var revenueEntries = filterRevenueByPeriod(load(KEYS.revenue));

    var expMap = {};
    var revMap = {};

    expenses.forEach(function (e) {
      var m = getDateMonth(e.date);
      expMap[m] = (expMap[m] || 0) + e.amount;
    });

    revenueEntries.forEach(function (e) {
      revMap[e.month] = (revMap[e.month] || 0) + e.amount;
    });

    var allMonths = Object.keys(Object.assign({}, expMap, revMap)).sort();
    return {
      labels: allMonths.map(monthLabel),
      expenses: allMonths.map(function (m) { return expMap[m] || 0; }),
      revenue: allMonths.map(function (m) { return revMap[m] || 0; })
    };
  }

  function getCategoryData() {
    var expenses = filterByPeriod(load(KEYS.expenses));
    var catMap = {};

    expenses.forEach(function (e) {
      catMap[e.category] = (catMap[e.category] || 0) + e.amount;
    });

    var cats = CATEGORIES.filter(function (c) { return catMap[c]; });
    return {
      labels: cats.map(function (c) { return c.charAt(0).toUpperCase() + c.slice(1); }),
      data: cats.map(function (c) { return catMap[c]; }),
      colors: cats.map(function (c) { return CAT_COLORS[c]; })
    };
  }

  function updateCharts() {
    var monthly = getMonthlyData();
    var category = getCategoryData();

    // Monthly chart
    if (charts.monthly) charts.monthly.destroy();
    var ctx1 = document.getElementById('chart-monthly');
    if (ctx1) {
      charts.monthly = new Chart(ctx1, {
        type: 'bar',
        data: {
          labels: monthly.labels,
          datasets: [
            {
              label: 'Revenue',
              data: monthly.revenue,
              backgroundColor: 'rgba(255,136,68,.6)',
              borderColor: '#ff8844',
              borderWidth: 1,
              borderRadius: 4
            },
            {
              label: 'Expenses',
              data: monthly.expenses,
              backgroundColor: 'rgba(255,68,68,.6)',
              borderColor: '#ff4444',
              borderWidth: 1,
              borderRadius: 4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: '#b0b0b0', font: { family: 'Inter', size: 11 } } }
          },
          scales: {
            x: { ticks: { color: '#666', font: { family: 'Inter', size: 10 } }, grid: { color: 'rgba(255,255,255,.04)' } },
            y: { ticks: { color: '#666', font: { family: 'Inter', size: 10 }, callback: function (v) { return '$' + v; } }, grid: { color: 'rgba(255,255,255,.04)' } }
          }
        }
      });
    }

    // Category chart
    if (charts.category) charts.category.destroy();
    var ctx2 = document.getElementById('chart-category');
    if (ctx2) {
      charts.category = new Chart(ctx2, {
        type: 'doughnut',
        data: {
          labels: category.labels,
          datasets: [{
            data: category.data,
            backgroundColor: category.colors,
            borderColor: '#111118',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: { color: '#b0b0b0', font: { family: 'Inter', size: 11 }, padding: 12 }
            }
          }
        }
      });
    }
  }

  /* ───────── Expense Log ───────── */

  function renderLog() {
    var allExpenses = load(KEYS.expenses);
    var filtered = filterByPeriod(allExpenses);
    var catFilter = document.getElementById('filter-category').value;
    if (catFilter !== 'all') {
      filtered = filtered.filter(function (e) { return e.category === catFilter; });
    }

    filtered.sort(function (a, b) { return b.date.localeCompare(a.date); });

    var container = document.getElementById('expense-log');
    if (!filtered.length) {
      container.innerHTML = '<div class="empty-msg">No expenses for this period.</div>';
      return;
    }

    var html = '<table class="log-table"><thead><tr>' +
      '<th>Date</th><th>Category</th><th>Amount</th><th>Note</th><th>Tax Ded.</th><th></th>' +
      '</tr></thead><tbody>';

    filtered.forEach(function (e) {
      html += '<tr>' +
        '<td>' + esc(e.date) + '</td>' +
        '<td><span class="cat-badge cat-' + esc(e.category) + '">' + esc(e.category) + '</span></td>' +
        '<td>' + fmtExact(e.amount) + '</td>' +
        '<td>' + esc(e.note || '—') + '</td>' +
        '<td class="' + (e.deductible ? 'tax-yes' : 'tax-no') + '">' + (e.deductible ? 'Yes' : 'No') + '</td>' +
        '<td><button class="delete-btn" onclick="CortexExpenses.deleteExpense(\'' + esc(e.id) + '\')" title="Delete">&#10005;</button></td>' +
        '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  }

  /* ───────── Actions ───────── */

  function addExpense() {
    var date = document.getElementById('exp-date').value;
    var category = document.getElementById('exp-category').value;
    var amount = parseFloat(document.getElementById('exp-amount').value);
    var note = document.getElementById('exp-note').value.trim();
    var deductible = document.getElementById('exp-deductible').checked;

    if (!date || !amount || amount <= 0) {
      toast('Please fill date and amount');
      return;
    }

    var expenses = load(KEYS.expenses);
    expenses.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      date: date,
      category: category,
      amount: amount,
      note: note,
      deductible: deductible
    });
    save(KEYS.expenses, expenses);

    document.getElementById('exp-amount').value = '';
    document.getElementById('exp-note').value = '';
    toast('Expense added');
    render();
  }

  function addRevenue() {
    var month = document.getElementById('rev-month').value;
    var amount = parseFloat(document.getElementById('rev-amount').value);

    if (!month || !amount || amount <= 0) {
      toast('Please fill month and amount');
      return;
    }

    var entries = load(KEYS.revenue);
    entries.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      month: month,
      amount: amount
    });
    save(KEYS.revenue, entries);

    document.getElementById('rev-amount').value = '';
    toast('Revenue logged');
    render();
  }

  function deleteExpense(id) {
    var expenses = load(KEYS.expenses);
    save(KEYS.expenses, expenses.filter(function (e) { return e.id !== id; }));
    toast('Expense deleted');
    render();
  }

  function clearAll() {
    if (!confirm('Delete all expenses and revenue data?')) return;
    localStorage.removeItem(KEYS.expenses);
    localStorage.removeItem(KEYS.revenue);
    toast('All data cleared');
    render();
  }

  /* ───────── Export ───────── */

  function exportCSV() {
    var expenses = filterByPeriod(load(KEYS.expenses));
    if (!expenses.length) { toast('No data to export'); return; }

    expenses.sort(function (a, b) { return a.date.localeCompare(b.date); });

    var rows = ['Date,Category,Amount,Note,Tax Deductible'];
    expenses.forEach(function (e) {
      rows.push([
        e.date,
        e.category,
        e.amount.toFixed(2),
        '"' + (e.note || '').replace(/"/g, '""') + '"',
        e.deductible ? 'Yes' : 'No'
      ].join(','));
    });

    // Summary rows
    var total = expenses.reduce(function (s, e) { return s + e.amount; }, 0);
    var deductible = expenses.filter(function (e) { return e.deductible; })
      .reduce(function (s, e) { return s + e.amount; }, 0);
    rows.push('');
    rows.push('Total,,' + total.toFixed(2) + ',,');
    rows.push('Tax Deductible,,' + deductible.toFixed(2) + ',,');

    var revenueEntries = filterRevenueByPeriod(load(KEYS.revenue));
    var totalRevenue = revenueEntries.reduce(function (s, e) { return s + e.amount; }, 0);
    rows.push('Total Revenue,,' + totalRevenue.toFixed(2) + ',,');
    rows.push('Net Profit,,' + (totalRevenue - total).toFixed(2) + ',,');
    rows.push('Profit Margin,,' + (totalRevenue > 0 ? ((totalRevenue - total) / totalRevenue * 100).toFixed(1) + '%' : 'N/A') + ',,');

    download('cortex-expenses.csv', rows.join('\n'), 'text/csv');
    toast('CSV exported');
  }

  function exportJSON() {
    var expenses = filterByPeriod(load(KEYS.expenses));
    if (!expenses.length) { toast('No data to export'); return; }

    var revenueEntries = filterRevenueByPeriod(load(KEYS.revenue));
    var total = expenses.reduce(function (s, e) { return s + e.amount; }, 0);
    var totalRevenue = revenueEntries.reduce(function (s, e) { return s + e.amount; }, 0);

    var data = {
      exported: new Date().toISOString(),
      period: getPeriodRange().label,
      summary: {
        totalExpenses: total,
        totalRevenue: totalRevenue,
        netProfit: totalRevenue - total,
        profitMargin: totalRevenue > 0 ? ((totalRevenue - total) / totalRevenue * 100).toFixed(1) + '%' : 'N/A'
      },
      expenses: expenses,
      revenue: revenueEntries
    };

    download('cortex-expenses.json', JSON.stringify(data, null, 2), 'application/json');
    toast('JSON exported');
  }

  function download(filename, content, type) {
    var blob = new Blob([content], { type: type });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /* ───────── Render ───────── */

  function render() {
    updateKPIs();
    updateCharts();
    renderLog();
  }

  /* ───────── Init ───────── */

  function init() {
    // Set default date
    document.getElementById('exp-date').value = todayStr();
    document.getElementById('rev-month').value = currentMonth();

    // Period tabs
    document.getElementById('period-tabs').addEventListener('click', function (e) {
      var btn = e.target.closest('.period-btn');
      if (!btn) return;
      document.querySelectorAll('.period-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      currentPeriod = btn.dataset.period;
      render();
    });

    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ───────── Public API ───────── */

  window.CortexExpenses = {
    addExpense: addExpense,
    addRevenue: addRevenue,
    deleteExpense: deleteExpense,
    clearAll: clearAll,
    exportCSV: exportCSV,
    exportJSON: exportJSON,
    render: render
  };
})();
