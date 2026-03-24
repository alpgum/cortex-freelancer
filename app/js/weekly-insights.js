/**
 * [CF-157] Weekly Summary — AI-generated Insights and Recommendations
 * Auto-generates weekly performance insights: what went well,
 * what to improve, and focus areas for next week.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_weekly_insights';
  var CSS_ID = 'cf-wi-styles';
  var _container = null;
  var _injected = false;

  /* ── Helpers ── */

  function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function loadData() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { weeks: {} }; }
    catch (e) { return { weeks: {} }; }
  }

  function saveData(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
  }

  function getWeekKey(date) {
    var d = date ? new Date(date) : new Date();
    var day = d.getDay();
    var diff = d.getDate() - day + (day === 0 ? -6 : 1);
    var monday = new Date(d.setDate(diff));
    return monday.getFullYear() + '-W' + String(Math.ceil((((monday - new Date(monday.getFullYear(), 0, 1)) / 86400000) + 1) / 7)).padStart(2, '0');
  }

  function getWeekLabel(key) {
    var parts = key.split('-W');
    return 'Week ' + parseInt(parts[1], 10) + ', ' + parts[0];
  }

  function getDefaultMetrics() {
    return { revenue: 0, hoursWorked: 0, proposalsSent: 0, clientsAcquired: 0, projectsCompleted: 0, invoicesSent: 0 };
  }

  /* ── Insight Engine ── */

  function generateInsights(weekKey, data) {
    var weeks = data.weeks;
    var current = weeks[weekKey];
    if (!current || !current.metrics) return { good: [], improve: [], focus: [] };

    var m = current.metrics;
    var keys = Object.keys(weeks).sort();
    var idx = keys.indexOf(weekKey);
    var prev = idx > 0 ? weeks[keys[idx - 1]] : null;
    var prevM = prev ? prev.metrics : null;

    var good = [];
    var improve = [];
    var focus = [];

    // Revenue analysis
    if (m.revenue > 0) {
      if (prevM && prevM.revenue > 0) {
        var revChange = ((m.revenue - prevM.revenue) / prevM.revenue) * 100;
        if (revChange > 10) good.push('Revenue increased by ' + revChange.toFixed(0) + '% compared to last week — great momentum!');
        else if (revChange < -10) improve.push('Revenue dropped by ' + Math.abs(revChange).toFixed(0) + '% from last week. Review pricing or volume.');
        else good.push('Revenue remained stable week-over-week.');
      } else {
        good.push('Earned $' + m.revenue.toLocaleString() + ' this week.');
      }
    } else {
      improve.push('No revenue recorded this week. Focus on closing pending deals.');
    }

    // Hours analysis
    if (m.hoursWorked > 40) improve.push('Worked ' + m.hoursWorked + ' hours — watch for burnout. Consider delegating or raising rates.');
    else if (m.hoursWorked >= 30) good.push('Solid ' + m.hoursWorked + '-hour work week with good balance.');
    else if (m.hoursWorked > 0 && m.hoursWorked < 20) focus.push('Only ' + m.hoursWorked + ' hours logged. If intentional, great. Otherwise, increase billable activity.');

    // Hourly rate
    if (m.hoursWorked > 0 && m.revenue > 0) {
      var rate = m.revenue / m.hoursWorked;
      if (rate > 100) good.push('Effective hourly rate of $' + rate.toFixed(0) + '/hr — excellent value capture.');
      else if (rate < 30) improve.push('Effective rate is $' + rate.toFixed(0) + '/hr. Look for higher-value projects or raise your rates.');
    }

    // Proposals
    if (m.proposalsSent >= 5) good.push('Sent ' + m.proposalsSent + ' proposals — strong pipeline activity.');
    else if (m.proposalsSent > 0) focus.push('Sent ' + m.proposalsSent + ' proposals. Aim for 5+ per week to maintain a healthy pipeline.');
    else improve.push('No proposals sent. Dedicate time to prospecting and outreach.');

    // Clients
    if (m.clientsAcquired > 0) good.push('Acquired ' + m.clientsAcquired + ' new client' + (m.clientsAcquired > 1 ? 's' : '') + ' this week!');

    // Projects
    if (m.projectsCompleted > 0) good.push('Completed ' + m.projectsCompleted + ' project' + (m.projectsCompleted > 1 ? 's' : '') + '. Consider requesting testimonials.');

    // Conversion
    if (prevM && prevM.proposalsSent > 0 && m.clientsAcquired > 0) {
      var convRate = (m.clientsAcquired / prevM.proposalsSent) * 100;
      if (convRate > 30) good.push('Strong conversion rate from proposals (' + convRate.toFixed(0) + '%).');
      else if (convRate < 10) focus.push('Low proposal conversion. Review your proposal quality and targeting.');
    }

    // Focus areas
    if (m.proposalsSent < 3) focus.push('Priority: increase outreach — set a target of 5 proposals next week.');
    if (m.revenue > 0 && m.invoicesSent === 0) focus.push('Remember to send invoices for completed work.');
    if (good.length === 0) focus.push('Focus on building momentum — even small wins count.');
    if (improve.length > 2) focus.push('Pick the top improvement area and dedicate focused time to it.');

    // Always add a motivational focus
    if (focus.length === 0) focus.push('Keep up the great work! Consider setting stretch goals for next week.');

    return { good: good, improve: improve, focus: focus };
  }

  /* ── CSS ── */

  function injectCSS() {
    if (_injected) return;
    _injected = true;
    var s = document.createElement('style');
    s.id = CSS_ID;
    s.textContent = [
      '.wi-panel{background:var(--bg-primary,#0a0a0a);border:1px solid var(--border,#1e1e1e);border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:var(--text-primary,#e0e0e0);overflow:hidden}',
      '.wi-header{padding:16px 20px;border-bottom:1px solid var(--border,#1e1e1e);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px}',
      '.wi-title{font-size:16px;font-weight:700}',
      '.wi-week-select{background:var(--bg-secondary,#111);border:1px solid var(--border,#222);border-radius:6px;color:var(--text-primary,#e0e0e0);font-size:12px;padding:4px 8px;cursor:pointer}',
      '.wi-form{padding:16px 20px;border-bottom:1px solid var(--border,#1e1e1e)}',
      '.wi-form-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px}',
      '.wi-field label{display:block;font-size:11px;color:var(--text-muted,#888);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}',
      '.wi-field input{width:100%;background:var(--bg-secondary,#111);border:1px solid var(--border,#222);border-radius:6px;color:var(--text-primary,#e0e0e0);font-size:13px;padding:6px 8px;box-sizing:border-box}',
      '.wi-btn{padding:8px 16px;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;margin-top:12px}',
      '.wi-btn-primary{background:#7c3aed;color:#fff}',
      '.wi-btn-primary:hover{background:#6d28d9}',
      '.wi-insights{padding:16px 20px}',
      '.wi-section{margin-bottom:16px}',
      '.wi-section-title{font-size:13px;font-weight:600;margin-bottom:8px;display:flex;align-items:center;gap:6px}',
      '.wi-item{background:var(--bg-secondary,#111);border:1px solid var(--border,#1e1e1e);border-radius:8px;padding:10px 14px;margin-bottom:6px;font-size:13px;line-height:1.5;border-left:3px solid}',
      '.wi-item-good{border-left-color:#22c55e}',
      '.wi-item-improve{border-left-color:#f59e0b}',
      '.wi-item-focus{border-left-color:#3b82f6}',
      '.wi-empty{padding:40px 20px;text-align:center;color:var(--text-muted,#555);font-size:13px}',
      '@media(max-width:600px){.wi-form-grid{grid-template-columns:1fr 1fr}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ── Render ── */

  function render(container) {
    injectCSS();
    var el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return;
    _container = el;

    var data = loadData();
    var currentWeek = getWeekKey();
    var weeks = Object.keys(data.weeks).sort();
    if (weeks.indexOf(currentWeek) < 0) weeks.push(currentWeek);
    var selectedWeek = currentWeek;

    renderWeek(el, data, selectedWeek, weeks);
  }

  function renderWeek(el, data, weekKey, weeks) {
    var weekData = data.weeks[weekKey] || { metrics: getDefaultMetrics() };
    var m = weekData.metrics || getDefaultMetrics();
    var insights = generateInsights(weekKey, data);

    var h = '<div class="wi-panel">';
    h += '<div class="wi-header"><span class="wi-title">Weekly Insights</span>';
    h += '<select class="wi-week-select" id="wi-week-sel">';
    for (var i = weeks.length - 1; i >= 0; i--) {
      h += '<option value="' + weeks[i] + '"' + (weeks[i] === weekKey ? ' selected' : '') + '>' + getWeekLabel(weeks[i]) + '</option>';
    }
    h += '</select></div>';

    // Input form
    h += '<div class="wi-form"><div class="wi-form-grid">';
    var fields = [
      { key: 'revenue', label: 'Revenue ($)', type: 'number' },
      { key: 'hoursWorked', label: 'Hours Worked', type: 'number' },
      { key: 'proposalsSent', label: 'Proposals Sent', type: 'number' },
      { key: 'clientsAcquired', label: 'New Clients', type: 'number' },
      { key: 'projectsCompleted', label: 'Projects Done', type: 'number' },
      { key: 'invoicesSent', label: 'Invoices Sent', type: 'number' }
    ];
    fields.forEach(function (f) {
      h += '<div class="wi-field"><label>' + f.label + '</label>';
      h += '<input type="' + f.type + '" id="wi-' + f.key + '" value="' + (m[f.key] || 0) + '" min="0" step="any"></div>';
    });
    h += '</div><button class="wi-btn wi-btn-primary" id="wi-save">Generate Insights</button></div>';

    // Insights
    h += '<div class="wi-insights">';
    if (insights.good.length || insights.improve.length || insights.focus.length) {
      if (insights.good.length) {
        h += '<div class="wi-section"><div class="wi-section-title"><span style="color:#22c55e">&#10003;</span> What Went Well</div>';
        insights.good.forEach(function (t) { h += '<div class="wi-item wi-item-good">' + esc(t) + '</div>'; });
        h += '</div>';
      }
      if (insights.improve.length) {
        h += '<div class="wi-section"><div class="wi-section-title"><span style="color:#f59e0b">&#9888;</span> Areas to Improve</div>';
        insights.improve.forEach(function (t) { h += '<div class="wi-item wi-item-improve">' + esc(t) + '</div>'; });
        h += '</div>';
      }
      if (insights.focus.length) {
        h += '<div class="wi-section"><div class="wi-section-title"><span style="color:#3b82f6">&#9733;</span> Focus Areas</div>';
        insights.focus.forEach(function (t) { h += '<div class="wi-item wi-item-focus">' + esc(t) + '</div>'; });
        h += '</div>';
      }
    } else {
      h += '<div class="wi-empty">Enter your weekly metrics and click "Generate Insights" to see recommendations.</div>';
    }
    h += '</div></div>';

    el.innerHTML = h;

    // Events
    var saveBtn = el.querySelector('#wi-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        var metrics = {};
        fields.forEach(function (f) {
          metrics[f.key] = parseFloat(document.getElementById('wi-' + f.key).value) || 0;
        });
        var d = loadData();
        d.weeks[weekKey] = d.weeks[weekKey] || {};
        d.weeks[weekKey].metrics = metrics;
        d.weeks[weekKey].generated = new Date().toISOString();
        saveData(d);
        renderWeek(el, d, weekKey, Object.keys(d.weeks).sort());
      });
    }

    var weekSel = el.querySelector('#wi-week-sel');
    if (weekSel) {
      weekSel.addEventListener('change', function () {
        var d = loadData();
        var allWeeks = Object.keys(d.weeks).sort();
        renderWeek(el, d, weekSel.value, allWeeks);
      });
    }
  }

  function init(containerId) {
    var data = loadData();
    if (containerId) render(containerId);
    return data;
  }

  function destroy() {
    if (_container) { _container.innerHTML = ''; _container = null; }
    var s = document.getElementById(CSS_ID);
    if (s) s.parentNode.removeChild(s);
    _injected = false;
  }

  /* ── Public API ── */
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.WeeklyInsights = {
    init: init,
    render: render,
    destroy: destroy,
    generateInsights: generateInsights,
    getWeekKey: getWeekKey
  };
})();
