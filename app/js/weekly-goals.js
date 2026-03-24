/**
 * [CF-158] Weekly Summary — Goal Tracking Integration
 * Shows progress toward weekly goals (proposals sent, interviews,
 * revenue) set in Action Plan with visual progress bars and streaks.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_weekly_goals';
  var CSS_ID = 'cf-wg-styles';
  var _container = null;
  var _injected = false;

  /* ── Helpers ── */

  function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function loadData() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { weeks: {}, defaults: null }; }
    catch (e) { return { weeks: {}, defaults: null }; }
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

  var GOAL_DEFS = [
    { key: 'proposalsSent', label: 'Proposals Sent', icon: '&#9993;', defaultTarget: 5 },
    { key: 'interviews', label: 'Interviews', icon: '&#9742;', defaultTarget: 3 },
    { key: 'revenue', label: 'Revenue ($)', icon: '&#36;', defaultTarget: 2000 },
    { key: 'hoursBilled', label: 'Hours Billed', icon: '&#9201;', defaultTarget: 30 },
    { key: 'clientsContacted', label: 'Clients Contacted', icon: '&#9993;', defaultTarget: 10 },
    { key: 'projectsDelivered', label: 'Projects Delivered', icon: '&#10003;', defaultTarget: 2 }
  ];

  function getDefaultGoals() {
    var goals = {};
    GOAL_DEFS.forEach(function (g) { goals[g.key] = { target: g.defaultTarget, current: 0 }; });
    return goals;
  }

  function computeStreak(data, goalKey) {
    var keys = Object.keys(data.weeks).sort().reverse();
    var streak = 0;
    for (var i = 0; i < keys.length; i++) {
      var week = data.weeks[keys[i]];
      if (!week || !week.goals || !week.goals[goalKey]) break;
      var g = week.goals[goalKey];
      if (g.current >= g.target) streak++;
      else break;
    }
    return streak;
  }

  function statusColor(pct) {
    if (pct >= 100) return '#22c55e';
    if (pct >= 60) return '#f59e0b';
    return '#ef4444';
  }

  function statusLabel(pct) {
    if (pct >= 100) return 'Complete';
    if (pct >= 60) return 'On Track';
    return 'Behind';
  }

  /* ── CSS ── */

  function injectCSS() {
    if (_injected) return;
    _injected = true;
    var s = document.createElement('style');
    s.id = CSS_ID;
    s.textContent = [
      '.wg-panel{background:var(--bg-primary,#0a0a0a);border:1px solid var(--border,#1e1e1e);border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:var(--text-primary,#e0e0e0);overflow:hidden}',
      '.wg-header{padding:16px 20px;border-bottom:1px solid var(--border,#1e1e1e);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px}',
      '.wg-title{font-size:16px;font-weight:700}',
      '.wg-controls{display:flex;gap:8px;align-items:center}',
      '.wg-week-select{background:var(--bg-secondary,#111);border:1px solid var(--border,#222);border-radius:6px;color:var(--text-primary,#e0e0e0);font-size:12px;padding:4px 8px;cursor:pointer}',
      '.wg-overall{padding:16px 20px;display:flex;align-items:center;gap:16px;border-bottom:1px solid var(--border,#1e1e1e)}',
      '.wg-overall-pct{font-size:32px;font-weight:800;min-width:80px;text-align:center}',
      '.wg-overall-bar{flex:1;height:8px;background:var(--bg-secondary,#222);border-radius:4px;overflow:hidden}',
      '.wg-overall-fill{height:100%;border-radius:4px;transition:width .3s}',
      '.wg-overall-label{font-size:12px;color:var(--text-muted,#888)}',
      '.wg-goals{padding:12px 20px}',
      '.wg-goal{background:var(--bg-secondary,#111);border:1px solid var(--border,#1e1e1e);border-radius:10px;padding:14px 16px;margin-bottom:10px}',
      '.wg-goal-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}',
      '.wg-goal-name{font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px}',
      '.wg-goal-status{font-size:11px;font-weight:600;padding:2px 8px;border-radius:10px}',
      '.wg-goal-bar{height:6px;background:var(--bg-primary,#1a1a1a);border-radius:3px;overflow:hidden;margin-bottom:8px}',
      '.wg-goal-fill{height:100%;border-radius:3px;transition:width .3s}',
      '.wg-goal-bottom{display:flex;align-items:center;justify-content:space-between;font-size:12px}',
      '.wg-goal-progress{color:var(--text-muted,#888)}',
      '.wg-goal-streak{color:#f59e0b;font-size:11px}',
      '.wg-goal-actions{display:flex;gap:4px}',
      '.wg-btn{border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;padding:4px 10px}',
      '.wg-btn-sm{background:var(--bg-primary,#1a1a1a);color:var(--text-primary,#e0e0e0);border:1px solid var(--border,#333)}',
      '.wg-btn-sm:hover{background:var(--border,#333)}',
      '.wg-btn-primary{background:#7c3aed;color:#fff;padding:8px 16px;margin-top:12px}',
      '.wg-btn-primary:hover{background:#6d28d9}',
      '.wg-edit{padding:16px 20px;border-top:1px solid var(--border,#1e1e1e)}',
      '.wg-edit-title{font-size:13px;font-weight:600;margin-bottom:10px;color:var(--text-secondary,#ccc)}',
      '.wg-edit-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px}',
      '.wg-edit-field label{display:block;font-size:11px;color:var(--text-muted,#888);margin-bottom:3px}',
      '.wg-edit-field input{width:100%;background:var(--bg-secondary,#111);border:1px solid var(--border,#222);border-radius:6px;color:var(--text-primary,#e0e0e0);font-size:13px;padding:5px 8px;box-sizing:border-box}',
      '@media(max-width:600px){.wg-edit-grid{grid-template-columns:1fr 1fr}.wg-overall{flex-wrap:wrap}}'
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

    renderWeek(el, data, currentWeek, weeks);
  }

  function renderWeek(el, data, weekKey, weeks) {
    if (!data.weeks[weekKey]) data.weeks[weekKey] = { goals: getDefaultGoals() };
    var weekData = data.weeks[weekKey];
    var goals = weekData.goals || getDefaultGoals();

    // Overall progress
    var totalPct = 0;
    var goalCount = GOAL_DEFS.length;
    GOAL_DEFS.forEach(function (def) {
      var g = goals[def.key] || { target: def.defaultTarget, current: 0 };
      totalPct += Math.min(100, g.target > 0 ? (g.current / g.target) * 100 : 0);
    });
    var overallPct = Math.round(totalPct / goalCount);

    var h = '<div class="wg-panel">';

    // Header
    h += '<div class="wg-header"><span class="wg-title">Weekly Goals</span>';
    h += '<div class="wg-controls">';
    h += '<select class="wg-week-select" id="wg-week-sel">';
    for (var i = weeks.length - 1; i >= 0; i--) {
      h += '<option value="' + weeks[i] + '"' + (weeks[i] === weekKey ? ' selected' : '') + '>' + getWeekLabel(weeks[i]) + '</option>';
    }
    h += '</select></div></div>';

    // Overall progress
    h += '<div class="wg-overall">';
    h += '<div class="wg-overall-pct" style="color:' + statusColor(overallPct) + '">' + overallPct + '%</div>';
    h += '<div style="flex:1"><div class="wg-overall-label">' + statusLabel(overallPct) + ' — ' + getWeekLabel(weekKey) + '</div>';
    h += '<div class="wg-overall-bar"><div class="wg-overall-fill" style="width:' + Math.min(100, overallPct) + '%;background:' + statusColor(overallPct) + '"></div></div></div></div>';

    // Individual goals
    h += '<div class="wg-goals">';
    GOAL_DEFS.forEach(function (def) {
      var g = goals[def.key] || { target: def.defaultTarget, current: 0 };
      var pct = g.target > 0 ? Math.round((g.current / g.target) * 100) : 0;
      var streak = computeStreak(data, def.key);
      var color = statusColor(pct);

      h += '<div class="wg-goal">';
      h += '<div class="wg-goal-top"><span class="wg-goal-name"><span>' + def.icon + '</span> ' + esc(def.label) + '</span>';
      h += '<span class="wg-goal-status" style="background:' + color + '22;color:' + color + '">' + statusLabel(pct) + '</span></div>';
      h += '<div class="wg-goal-bar"><div class="wg-goal-fill" style="width:' + Math.min(100, pct) + '%;background:' + color + '"></div></div>';
      h += '<div class="wg-goal-bottom">';
      h += '<span class="wg-goal-progress">' + g.current + ' / ' + g.target + ' (' + pct + '%)</span>';
      if (streak > 0) h += '<span class="wg-goal-streak">&#128293; ' + streak + ' week streak</span>';
      h += '<div class="wg-goal-actions">';
      h += '<button class="wg-btn wg-btn-sm" data-goal="' + def.key + '" data-action="dec">-</button>';
      h += '<button class="wg-btn wg-btn-sm" data-goal="' + def.key + '" data-action="inc">+</button>';
      h += '</div></div></div>';
    });
    h += '</div>';

    // Edit targets
    h += '<div class="wg-edit"><div class="wg-edit-title">Set Targets</div><div class="wg-edit-grid">';
    GOAL_DEFS.forEach(function (def) {
      var g = goals[def.key] || { target: def.defaultTarget, current: 0 };
      h += '<div class="wg-edit-field"><label>' + esc(def.label) + ' Target</label>';
      h += '<input type="number" id="wg-target-' + def.key + '" value="' + g.target + '" min="0" step="any"></div>';
    });
    h += '</div><button class="wg-btn wg-btn-primary" id="wg-save-targets">Save Targets</button></div>';

    h += '</div>';
    el.innerHTML = h;

    // Events — increment/decrement
    el.querySelectorAll('[data-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-goal');
        var action = btn.getAttribute('data-action');
        var d = loadData();
        if (!d.weeks[weekKey]) d.weeks[weekKey] = { goals: getDefaultGoals() };
        var g = d.weeks[weekKey].goals[key];
        if (action === 'inc') g.current = (g.current || 0) + (key === 'revenue' ? 100 : 1);
        else g.current = Math.max(0, (g.current || 0) - (key === 'revenue' ? 100 : 1));
        saveData(d);
        renderWeek(el, d, weekKey, Object.keys(d.weeks).sort());
      });
    });

    // Save targets
    var saveBtn = el.querySelector('#wg-save-targets');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        var d = loadData();
        if (!d.weeks[weekKey]) d.weeks[weekKey] = { goals: getDefaultGoals() };
        GOAL_DEFS.forEach(function (def) {
          var input = document.getElementById('wg-target-' + def.key);
          if (input) d.weeks[weekKey].goals[def.key].target = parseFloat(input.value) || 0;
        });
        saveData(d);
        renderWeek(el, d, weekKey, Object.keys(d.weeks).sort());
      });
    }

    // Week selector
    var weekSel = el.querySelector('#wg-week-sel');
    if (weekSel) {
      weekSel.addEventListener('change', function () {
        var d = loadData();
        renderWeek(el, d, weekSel.value, Object.keys(d.weeks).sort());
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
  window.CortexFreelancer.WeeklyGoals = {
    init: init,
    render: render,
    destroy: destroy,
    getWeekKey: getWeekKey,
    computeStreak: computeStreak
  };
})();
