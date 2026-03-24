/**
 * [CF-155] Cash Flow Forecast Chart
 * Projects income for next 3 months based on historical data,
 * active/pending contracts, and seasonal trends.
 * Shows Chart.js line chart with actual vs projected income,
 * confidence intervals, and expense tracking.
 */
(function () {
  'use strict';

  var INCOME_KEY = 'cortex_income_entries';
  var EXPENSE_KEY = 'cortex_monthly_expenses';

  /* ── Helpers ── */

  function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function getEntries() {
    try { return JSON.parse(localStorage.getItem(INCOME_KEY)) || []; }
    catch (e) { return []; }
  }

  function getExpenses() {
    try { return JSON.parse(localStorage.getItem(EXPENSE_KEY)) || { rent: 0, utilities: 0, software: 0, other: 0 }; }
    catch (e) { return { rent: 0, utilities: 0, software: 0, other: 0 }; }
  }

  function saveExpenses(expenses) {
    try { localStorage.setItem(EXPENSE_KEY, JSON.stringify(expenses)); } catch (e) {}
  }

  function showToast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 2500);
  }

  function monthKey(date) {
    var d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    return y + '-' + m;
  }

  function monthLabel(key) {
    var parts = key.split('-');
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[parseInt(parts[1], 10) - 1] + ' ' + parts[0].slice(2);
  }

  function addMonths(date, n) {
    var d = new Date(date);
    d.setMonth(d.getMonth() + n);
    return d;
  }

  /* ── Forecasting Engine ── */

  function buildMonthlyTotals(entries) {
    var totals = {};
    entries.forEach(function (e) {
      if (!e.date || !e.amount) return;
      var key = e.date.substring(0, 7);
      totals[key] = (totals[key] || 0) + e.amount;
    });
    return totals;
  }

  function getPendingIncome(entries) {
    var pending = 0;
    entries.forEach(function (e) {
      if (e.status === 'pending') pending += e.amount;
    });
    return pending;
  }

  function computeForecast(entries) {
    var monthlyTotals = buildMonthlyTotals(entries);
    var sortedKeys = Object.keys(monthlyTotals).sort();

    var now = new Date();
    var currentMonthKey = monthKey(now);

    // Separate historical months (completed) from current month
    var historicalKeys = sortedKeys.filter(function (k) { return k < currentMonthKey; });
    var currentMonthIncome = monthlyTotals[currentMonthKey] || 0;

    // Calculate historical averages
    var historicalValues = historicalKeys.map(function (k) { return monthlyTotals[k]; });
    var totalHistorical = historicalValues.reduce(function (s, v) { return s + v; }, 0);
    var avgMonthly = historicalValues.length > 0 ? totalHistorical / historicalValues.length : 0;

    // Recent trend (last 3 months weighted average)
    var recentKeys = historicalKeys.slice(-3);
    var recentWeights = [1, 2, 3]; // More recent = heavier weight
    var recentWeightedSum = 0;
    var recentWeightTotal = 0;
    recentKeys.forEach(function (k, i) {
      var weight = recentWeights[recentKeys.length - 1 - (recentKeys.length - 1 - i)] || 1;
      recentWeightedSum += monthlyTotals[k] * weight;
      recentWeightTotal += weight;
    });
    var recentAvg = recentWeightTotal > 0 ? recentWeightedSum / recentWeightTotal : avgMonthly;

    // Pending income boost for current/next month
    var pendingIncome = getPendingIncome(entries);

    // Seasonal adjustment: check same month last year
    var forecastMonths = [];
    for (var i = 1; i <= 3; i++) {
      var forecastDate = addMonths(now, i);
      var fKey = monthKey(forecastDate);
      var lastYearKey = monthKey(addMonths(forecastDate, -12));

      // Base forecast: blend of recent trend and overall average (70/30)
      var baseForecast = recentAvg * 0.7 + avgMonthly * 0.3;

      // Seasonal adjustment
      var seasonalFactor = 1.0;
      if (monthlyTotals[lastYearKey] && avgMonthly > 0) {
        seasonalFactor = monthlyTotals[lastYearKey] / avgMonthly;
        // Clamp to prevent extreme seasonal swings
        seasonalFactor = Math.max(0.5, Math.min(1.8, seasonalFactor));
      }

      var projected = baseForecast * seasonalFactor;

      // Add portion of pending income to first forecast month
      if (i === 1) {
        projected += pendingIncome * 0.6;
      } else if (i === 2) {
        projected += pendingIncome * 0.3;
      }

      // Confidence interval widens for further months
      var stdDev = 0;
      if (historicalValues.length > 1) {
        var mean = avgMonthly;
        var sumSquares = historicalValues.reduce(function (s, v) { return s + Math.pow(v - mean, 2); }, 0);
        stdDev = Math.sqrt(sumSquares / historicalValues.length);
      }

      var confidenceMultiplier = 1 + (i - 1) * 0.3;
      var upper = projected + stdDev * confidenceMultiplier;
      var lower = Math.max(0, projected - stdDev * confidenceMultiplier);

      forecastMonths.push({
        key: fKey,
        label: monthLabel(fKey),
        projected: Math.round(projected),
        upper: Math.round(upper),
        lower: Math.round(lower),
        seasonal: monthlyTotals[lastYearKey] ? Math.round(monthlyTotals[lastYearKey]) : null
      });
    }

    // Build actual data (last 6 months + current)
    var actualMonths = [];
    for (var j = 6; j >= 0; j--) {
      var aDate = addMonths(now, -j);
      var aKey = monthKey(aDate);
      actualMonths.push({
        key: aKey,
        label: monthLabel(aKey),
        amount: monthlyTotals[aKey] || 0,
        isCurrent: aKey === currentMonthKey
      });
    }

    return {
      actual: actualMonths,
      forecast: forecastMonths,
      avgMonthly: Math.round(avgMonthly),
      recentAvg: Math.round(recentAvg),
      pendingIncome: Math.round(pendingIncome),
      totalMonths: historicalKeys.length
    };
  }

  /* ── Chart Rendering ── */

  var forecastChart = null;

  function renderForecastChart(forecast) {
    var canvas = document.getElementById('cashflow-forecast-chart');
    if (!canvas) return;

    if (forecastChart) {
      forecastChart.destroy();
      forecastChart = null;
    }

    // Combine actual + forecast labels/data
    var labels = [];
    var actualData = [];
    var projectedData = [];
    var upperData = [];
    var lowerData = [];

    forecast.actual.forEach(function (m) {
      labels.push(m.label);
      actualData.push(m.amount);
      projectedData.push(null);
      upperData.push(null);
      lowerData.push(null);
    });

    // Bridge point: last actual value is also first projected value
    var lastActualIdx = actualData.length - 1;
    projectedData[lastActualIdx] = actualData[lastActualIdx];
    upperData[lastActualIdx] = actualData[lastActualIdx];
    lowerData[lastActualIdx] = actualData[lastActualIdx];

    forecast.forecast.forEach(function (m) {
      labels.push(m.label);
      actualData.push(null);
      projectedData.push(m.projected);
      upperData.push(m.upper);
      lowerData.push(m.lower);
    });

    forecastChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Actual Income',
            data: actualData,
            borderColor: '#00ff88',
            backgroundColor: 'rgba(0,255,136,0.08)',
            fill: false,
            tension: 0.3,
            pointBackgroundColor: '#00ff88',
            pointRadius: 4,
            pointHoverRadius: 6,
            borderWidth: 2.5,
            spanGaps: false
          },
          {
            label: 'Projected Income',
            data: projectedData,
            borderColor: '#ff8844',
            backgroundColor: 'rgba(255,136,68,0.05)',
            fill: false,
            tension: 0.3,
            pointBackgroundColor: '#ff8844',
            pointRadius: 4,
            pointHoverRadius: 6,
            borderWidth: 2.5,
            borderDash: [8, 4],
            spanGaps: false
          },
          {
            label: 'Upper Bound',
            data: upperData,
            borderColor: 'transparent',
            backgroundColor: 'rgba(255,136,68,0.1)',
            fill: '+1',
            tension: 0.3,
            pointRadius: 0,
            borderWidth: 0,
            spanGaps: false
          },
          {
            label: 'Lower Bound',
            data: lowerData,
            borderColor: 'transparent',
            backgroundColor: 'rgba(255,136,68,0.1)',
            fill: false,
            tension: 0.3,
            pointRadius: 0,
            borderWidth: 0,
            spanGaps: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              boxWidth: 14,
              padding: 16,
              font: { size: 11 },
              filter: function (item) {
                return item.text !== 'Upper Bound' && item.text !== 'Lower Bound';
              }
            }
          },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                if (ctx.dataset.label === 'Upper Bound' || ctx.dataset.label === 'Lower Bound') return null;
                var val = ctx.parsed.y;
                if (val === null || val === undefined) return null;
                return ctx.dataset.label + ': $' + Number(val).toLocaleString();
              }
            },
            backgroundColor: 'rgba(17,17,24,.92)',
            titleFont: { weight: '600' },
            padding: 10,
            cornerRadius: 8,
            filter: function (item) {
              return item.raw !== null;
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: function (v) { return '$' + v.toLocaleString(); } },
            grid: { color: 'rgba(255,255,255,0.06)' }
          },
          x: { grid: { display: false } }
        },
        animation: { duration: 600, easing: 'easeOutQuart' }
      }
    });
  }

  /* ── Expense Tracking ── */

  function buildExpenseInputs() {
    var expenses = getExpenses();
    var fields = [
      { key: 'rent', label: 'Rent / Office', placeholder: '1500' },
      { key: 'utilities', label: 'Utilities / Internet', placeholder: '150' },
      { key: 'software', label: 'Software / Tools', placeholder: '200' },
      { key: 'other', label: 'Other Expenses', placeholder: '300' }
    ];

    var html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.75rem">';
    fields.forEach(function (f) {
      html += '<div style="display:flex;flex-direction:column;gap:.25rem">' +
        '<label style="font-size:.68rem;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.5px">' + f.label + '</label>' +
        '<input type="number" class="expense-input" data-expense="' + f.key + '" value="' + (expenses[f.key] || '') + '" placeholder="' + f.placeholder + '" min="0" step="0.01" style="background:var(--bg3);border:1px solid rgba(255,255,255,.08);border-radius:var(--radius-sm);padding:.5rem .7rem;color:var(--text);font-size:.85rem;font-family:inherit;outline:none;width:100%">' +
      '</div>';
    });
    html += '</div>';

    return html;
  }

  function getTotalExpenses() {
    var expenses = getExpenses();
    return Object.keys(expenses).reduce(function (sum, key) {
      return sum + (parseFloat(expenses[key]) || 0);
    }, 0);
  }

  /* ── Main UI ── */

  function buildForecastSection() {
    var entries = getEntries();
    var forecast = computeForecast(entries);
    var totalExpenses = getTotalExpenses();

    var section = document.createElement('div');
    section.id = 'cashflow-forecast-section';
    section.className = 'section';

    var hasData = entries.length > 0;
    var noDataMsg = '<div style="text-align:center;padding:2rem;color:var(--text3);font-size:.88rem">Add income entries to see your cash flow forecast.</div>';

    // Summary cards
    var summaryHTML = '';
    if (hasData) {
      var nextMonthProjected = forecast.forecast.length > 0 ? forecast.forecast[0].projected : 0;
      var threeMonthProjected = forecast.forecast.reduce(function (s, m) { return s + m.projected; }, 0);
      var nextMonthNet = nextMonthProjected - totalExpenses;
      var threeMonthNet = threeMonthProjected - (totalExpenses * 3);

      summaryHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.75rem;margin-bottom:1.25rem">' +
        '<div style="background:var(--bg3);border-radius:var(--radius-sm);padding:.75rem;text-align:center">' +
          '<div style="font-size:1.2rem;font-weight:800;color:var(--orange)">$' + nextMonthProjected.toLocaleString() + '</div>' +
          '<div style="font-size:.68rem;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-top:.15rem">Next Month</div>' +
        '</div>' +
        '<div style="background:var(--bg3);border-radius:var(--radius-sm);padding:.75rem;text-align:center">' +
          '<div style="font-size:1.2rem;font-weight:800;color:var(--orange)">$' + threeMonthProjected.toLocaleString() + '</div>' +
          '<div style="font-size:.68rem;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-top:.15rem">3-Month Total</div>' +
        '</div>' +
        '<div style="background:var(--bg3);border-radius:var(--radius-sm);padding:.75rem;text-align:center">' +
          '<div style="font-size:1.2rem;font-weight:800;color:' + (nextMonthNet >= 0 ? 'var(--green)' : 'var(--red)') + '">$' + nextMonthNet.toLocaleString() + '</div>' +
          '<div style="font-size:.68rem;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-top:.15rem">Next Month Net</div>' +
        '</div>' +
        '<div style="background:var(--bg3);border-radius:var(--radius-sm);padding:.75rem;text-align:center">' +
          '<div style="font-size:1.2rem;font-weight:800;color:' + (threeMonthNet >= 0 ? 'var(--green)' : 'var(--red)') + '">$' + threeMonthNet.toLocaleString() + '</div>' +
          '<div style="font-size:.68rem;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-top:.15rem">3-Month Net</div>' +
        '</div>' +
      '</div>';
    }

    // Forecast details table
    var detailsHTML = '';
    if (hasData && forecast.forecast.length > 0) {
      detailsHTML = '<div style="margin-top:1.25rem;border-top:1px solid rgba(255,255,255,.06);padding-top:1rem">' +
        '<div style="font-size:.72rem;font-weight:700;color:var(--orange);text-transform:uppercase;letter-spacing:1px;margin-bottom:.5rem">Monthly Breakdown</div>' +
        '<div style="display:flex;flex-direction:column;gap:.4rem">';

      forecast.forecast.forEach(function (m) {
        var netIncome = m.projected - totalExpenses;
        detailsHTML += '<div style="display:flex;align-items:center;justify-content:space-between;padding:.5rem .65rem;background:var(--bg3);border-radius:8px;font-size:.82rem">' +
          '<span style="font-weight:600;color:var(--text);min-width:70px">' + m.label + '</span>' +
          '<span style="color:var(--orange);font-weight:700">$' + m.projected.toLocaleString() + '</span>' +
          '<span style="color:var(--text3);font-size:.75rem">$' + m.lower.toLocaleString() + ' - $' + m.upper.toLocaleString() + '</span>' +
          '<span style="font-weight:700;color:' + (netIncome >= 0 ? 'var(--green)' : 'var(--red)') + '">Net: $' + netIncome.toLocaleString() + '</span>' +
        '</div>';
      });

      detailsHTML += '</div></div>';
    }

    // Metadata
    var metaHTML = '';
    if (hasData) {
      metaHTML = '<div style="margin-top:1rem;display:flex;gap:1rem;flex-wrap:wrap;font-size:.72rem;color:var(--text3)">' +
        '<span>Based on ' + forecast.totalMonths + ' months of data</span>' +
        '<span>Monthly avg: $' + forecast.avgMonthly.toLocaleString() + '</span>' +
        '<span>Recent trend: $' + forecast.recentAvg.toLocaleString() + '/mo</span>' +
        (forecast.pendingIncome > 0 ? '<span>Pending: $' + forecast.pendingIncome.toLocaleString() + '</span>' : '') +
      '</div>';
    }

    section.innerHTML = '<h3 style="font-size:.75rem;font-weight:700;color:var(--orange);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:1rem">Cash Flow Forecast</h3>' +
      summaryHTML +
      (hasData
        ? '<div style="position:relative;height:280px;margin-bottom:1rem"><canvas id="cashflow-forecast-chart"></canvas></div>'
        : noDataMsg) +
      '<div style="border-top:1px solid rgba(255,255,255,.06);padding-top:1rem;margin-top:1rem">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem;flex-wrap:wrap;gap:.5rem">' +
          '<span style="font-size:.72rem;font-weight:700;color:var(--orange);text-transform:uppercase;letter-spacing:1px">Monthly Fixed Expenses</span>' +
          '<span style="font-size:.82rem;font-weight:700;color:var(--text2)">Total: $' + getTotalExpenses().toLocaleString() + '/mo</span>' +
        '</div>' +
        buildExpenseInputs() +
        '<button id="btn-save-expenses" style="margin-top:.75rem;padding:.5rem 1rem;border-radius:100px;font-size:.82rem;font-weight:700;border:none;cursor:pointer;font-family:inherit;background:var(--bg3);color:var(--green);border:1px solid rgba(0,255,136,.2);transition:all .2s">Save Expenses</button>' +
      '</div>' +
      detailsHTML +
      metaHTML;

    return section;
  }

  /* ── Event Binding ── */

  function bindExpenseEvents() {
    var saveBtn = document.getElementById('btn-save-expenses');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        var inputs = document.querySelectorAll('.expense-input');
        var expenses = getExpenses();

        inputs.forEach(function (input) {
          var key = input.getAttribute('data-expense');
          expenses[key] = parseFloat(input.value) || 0;
        });

        saveExpenses(expenses);
        showToast('Expenses saved!');
        rebuildForecast();
        dataLayer.push({ event: 'tool_used', tool_name: 'cashflow-forecast', action: 'save_expenses' });
      });
    }
  }

  function rebuildForecast() {
    var existing = document.getElementById('cashflow-forecast-section');
    if (!existing) return;

    var parent = existing.parentNode;
    var next = existing.nextSibling;
    parent.removeChild(existing);

    var newSection = buildForecastSection();
    parent.insertBefore(newSection, next);

    var entries = getEntries();
    if (entries.length > 0) {
      var forecast = computeForecast(entries);
      renderForecastChart(forecast);
    }

    bindExpenseEvents();
  }

  /* ── Init ── */

  document.addEventListener('DOMContentLoaded', function () {
    // Insert forecast section after the monthly chart section
    var mainWrap = document.querySelector('.main-wrap');
    if (!mainWrap) return;

    // Find the monthly income trend section (first .section after stats-row)
    var sections = mainWrap.querySelectorAll('.section');
    var monthlySection = null;
    for (var i = 0; i < sections.length; i++) {
      var h3 = sections[i].querySelector('h3');
      if (h3 && h3.textContent.indexOf('Monthly Income') >= 0) {
        monthlySection = sections[i];
        break;
      }
    }

    var forecastSection = buildForecastSection();

    if (monthlySection && monthlySection.nextSibling) {
      mainWrap.insertBefore(forecastSection, monthlySection.nextSibling);
    } else {
      // Fallback: insert after stats row
      var statsRow = mainWrap.querySelector('.stats-row');
      if (statsRow && statsRow.nextSibling) {
        mainWrap.insertBefore(forecastSection, statsRow.nextSibling);
      } else {
        mainWrap.appendChild(forecastSection);
      }
    }

    // Render chart
    var entries = getEntries();
    if (entries.length > 0) {
      var forecast = computeForecast(entries);
      renderForecastChart(forecast);
    }

    bindExpenseEvents();

    // Listen for income changes (re-render on data updates)
    var origSetItem = localStorage.setItem;
    localStorage.setItem = function (key, value) {
      origSetItem.call(localStorage, key, value);
      if (key === INCOME_KEY) {
        setTimeout(rebuildForecast, 200);
      }
    };

    // Expose API
    window.CortexCashflowForecast = {
      compute: computeForecast,
      rebuild: rebuildForecast
    };

    dataLayer.push({ event: 'tool_used', tool_name: 'cashflow-forecast', action: 'init' });
  });
})();
