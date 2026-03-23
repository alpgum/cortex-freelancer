/**
 * Cortex Connects ROI Tracker
 * Tracks Upwork connects spending vs outcomes for ROI analysis.
 * Exposes window.CortexConnectsTracker
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'cortex_connects_log';

  /* ── Helpers ─────────────────────────────────────────────── */

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (_) {
      return [];
    }
  }

  function save(entries) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  /* ── Core API ────────────────────────────────────────────── */

  function addEntry(entry) {
    const entries = load();
    const record = {
      id: entry.id || uid(),
      date: entry.date || new Date().toISOString(),
      jobTitle: entry.jobTitle || '',
      jobUrl: entry.jobUrl || '',
      connectsSpent: Number(entry.connectsSpent) || 0,
      result: entry.result || 'pending', // pending | interview | hired | rejected | no-reply
      earnedAmount: Number(entry.earnedAmount) || 0,
    };
    entries.push(record);
    save(entries);
    return record;
  }

  function updateResult(id, result, earnedAmount) {
    const entries = load();
    const entry = entries.find(function (e) { return e.id === id; });
    if (!entry) return null;
    entry.result = result;
    if (earnedAmount !== undefined) entry.earnedAmount = Number(earnedAmount) || 0;
    save(entries);
    return entry;
  }

  function getStats(days) {
    if (days === undefined) days = 30;
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    var entries = load().filter(function (e) {
      return new Date(e.date) >= cutoff;
    });

    var totalConnects = 0;
    var interviews = 0;
    var hired = 0;
    var earned = 0;
    var typeMap = {}; // jobTitle → {connects, earned}

    entries.forEach(function (e) {
      totalConnects += e.connectsSpent;
      if (e.result === 'interview' || e.result === 'hired') interviews++;
      if (e.result === 'hired') { hired++; earned += e.earnedAmount; }

      var key = e.jobTitle || 'Unknown';
      if (!typeMap[key]) typeMap[key] = { connects: 0, earned: 0 };
      typeMap[key].connects += e.connectsSpent;
      typeMap[key].earned += e.earnedAmount;
    });

    var roiPerConnect = totalConnects > 0 ? (earned / totalConnects) : 0;

    // Best / worst by ROI per connect
    var bestJobType = null;
    var worstJobType = null;
    var bestRoi = -Infinity;
    var worstRoi = Infinity;
    Object.keys(typeMap).forEach(function (t) {
      var r = typeMap[t].connects > 0 ? typeMap[t].earned / typeMap[t].connects : 0;
      if (r > bestRoi) { bestRoi = r; bestJobType = t; }
      if (r < worstRoi) { worstRoi = r; worstJobType = t; }
    });

    return {
      days: days,
      totalEntries: entries.length,
      totalConnects: totalConnects,
      interviews: interviews,
      hired: hired,
      earned: earned,
      roiPerConnect: Math.round(roiPerConnect * 100) / 100,
      bestJobType: bestJobType,
      worstJobType: worstJobType,
    };
  }

  /* ── Styles ──────────────────────────────────────────────── */

  var CSS = '\
.ctx-connects{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#e4e4e7;background:#18181b;border-radius:12px;padding:24px;max-width:720px;margin:0 auto}\
.ctx-connects *{box-sizing:border-box}\
.ctx-connects h2{margin:0 0 20px;font-size:22px;font-weight:700;letter-spacing:-.3px}\
.ctx-connects .stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:24px}\
.ctx-connects .stat-card{background:#27272a;border-radius:10px;padding:16px;text-align:center}\
.ctx-connects .stat-card .val{font-size:26px;font-weight:700;color:#a78bfa}\
.ctx-connects .stat-card .lbl{font-size:11px;text-transform:uppercase;color:#71717a;margin-top:4px;letter-spacing:.5px}\
.ctx-connects .form-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}\
.ctx-connects input,.ctx-connects select{background:#27272a;border:1px solid #3f3f46;color:#e4e4e7;border-radius:8px;padding:8px 12px;font-size:13px;outline:none}\
.ctx-connects input:focus,.ctx-connects select:focus{border-color:#7c3aed}\
.ctx-connects input::placeholder{color:#52525b}\
.ctx-connects button{background:#7c3aed;color:#fff;border:none;border-radius:8px;padding:8px 18px;font-size:13px;font-weight:600;cursor:pointer;transition:background .15s}\
.ctx-connects button:hover{background:#6d28d9}\
.ctx-connects .history{margin-top:20px}\
.ctx-connects .history h3{font-size:14px;color:#a1a1aa;margin:0 0 10px}\
.ctx-connects .h-item{display:flex;justify-content:space-between;align-items:center;background:#27272a;border-radius:8px;padding:10px 14px;margin-bottom:6px;font-size:13px}\
.ctx-connects .h-item .title{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-right:12px}\
.ctx-connects .h-item .badge{font-size:11px;padding:2px 8px;border-radius:6px;font-weight:600}\
.ctx-connects .badge-pending{background:#3f3f46;color:#a1a1aa}\
.ctx-connects .badge-interview{background:#1e3a5f;color:#38bdf8}\
.ctx-connects .badge-hired{background:#14532d;color:#4ade80}\
.ctx-connects .badge-rejected{background:#4c1d1d;color:#f87171}\
.ctx-connects .badge-no-reply{background:#3f3f46;color:#71717a}\
.ctx-connects .insights{margin-top:20px;background:#27272a;border-radius:10px;padding:16px;font-size:13px;color:#a1a1aa;line-height:1.6}\
.ctx-connects .insights strong{color:#e4e4e7}\
.ctx-connects .h-actions select{font-size:11px;padding:4px 6px}\
';

  /* ── Render ──────────────────────────────────────────────── */

  function renderConnectsTracker(container) {
    if (typeof container === 'string') container = document.querySelector(container);
    if (!container) return;

    // Inject styles once
    if (!document.getElementById('ctx-connects-style')) {
      var style = document.createElement('style');
      style.id = 'ctx-connects-style';
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    function render() {
      var stats = getStats(30);
      var entries = load().sort(function (a, b) { return new Date(b.date) - new Date(a.date); });

      container.innerHTML = '';
      var root = document.createElement('div');
      root.className = 'ctx-connects';

      // Header
      root.innerHTML = '<h2>💎 Connects ROI</h2>';

      // Stat cards
      var grid = document.createElement('div');
      grid.className = 'stat-grid';
      var cards = [
        { val: stats.totalConnects, lbl: 'Connects Spent' },
        { val: stats.interviews, lbl: 'Interviews' },
        { val: stats.hired, lbl: 'Hired' },
        { val: '$' + stats.earned.toLocaleString(), lbl: 'Earned' },
        { val: '$' + stats.roiPerConnect.toFixed(2), lbl: 'ROI / Connect' },
        { val: stats.totalEntries, lbl: 'Applications' },
      ];
      cards.forEach(function (c) {
        var card = document.createElement('div');
        card.className = 'stat-card';
        card.innerHTML = '<div class="val">' + c.val + '</div><div class="lbl">' + c.lbl + '</div>';
        grid.appendChild(card);
      });
      root.appendChild(grid);

      // Add entry form
      var form = document.createElement('div');
      form.className = 'form-row';
      form.innerHTML = '\
<input type="text" placeholder="Job title" id="ctx-jt" style="flex:2;min-width:160px">\
<input type="url" placeholder="Job URL" id="ctx-ju" style="flex:2;min-width:140px">\
<input type="number" placeholder="Connects" id="ctx-cs" style="width:90px" min="0">\
<select id="ctx-rs"><option value="pending">Pending</option><option value="interview">Interview</option><option value="hired">Hired</option><option value="rejected">Rejected</option><option value="no-reply">No Reply</option></select>\
<input type="number" placeholder="Earned $" id="ctx-ea" style="width:100px" min="0" step="0.01">\
<button id="ctx-add">+ Add</button>';
      root.appendChild(form);

      // History
      var hist = document.createElement('div');
      hist.className = 'history';
      hist.innerHTML = '<h3>Recent Applications (' + entries.length + ')</h3>';
      entries.slice(0, 20).forEach(function (e) {
        var item = document.createElement('div');
        item.className = 'h-item';
        var dateStr = new Date(e.date).toLocaleDateString();
        item.innerHTML = '\
<span class="title" title="' + (e.jobTitle || '').replace(/"/g, '&quot;') + '">' + (e.jobTitle || 'Untitled') + '</span>\
<span style="color:#71717a;margin-right:8px;font-size:11px">' + e.connectsSpent + '⚡ · ' + dateStr + '</span>\
<span class="badge badge-' + e.result + '">' + e.result + '</span>\
<span class="h-actions" style="margin-left:8px">\
<select data-id="' + e.id + '" class="ctx-update">\
<option value="">Update…</option>\
<option value="interview">Interview</option>\
<option value="hired">Hired</option>\
<option value="rejected">Rejected</option>\
<option value="no-reply">No Reply</option>\
</select></span>';
        hist.appendChild(item);
      });
      root.appendChild(hist);

      // Insights
      if (stats.totalEntries > 0) {
        var ins = document.createElement('div');
        ins.className = 'insights';
        var lines = [];
        if (stats.totalConnects > 0) {
          var interviewRate = ((stats.interviews / stats.totalEntries) * 100).toFixed(1);
          lines.push('📊 Interview rate: <strong>' + interviewRate + '%</strong> (' + stats.interviews + '/' + stats.totalEntries + ')');
        }
        if (stats.hired > 0) {
          var hireRate = ((stats.hired / stats.totalEntries) * 100).toFixed(1);
          lines.push('🏆 Hire rate: <strong>' + hireRate + '%</strong>');
        }
        if (stats.bestJobType) {
          lines.push('✅ Best ROI: <strong>' + stats.bestJobType + '</strong>');
        }
        if (stats.worstJobType && stats.worstJobType !== stats.bestJobType) {
          lines.push('⚠️ Worst ROI: <strong>' + stats.worstJobType + '</strong>');
        }
        if (stats.roiPerConnect > 0) {
          lines.push('💰 Each connect returns <strong>$' + stats.roiPerConnect.toFixed(2) + '</strong> on average');
        }
        if (lines.length === 0) {
          lines.push('💡 Start logging applications to see insights here.');
        }
        ins.innerHTML = lines.join('<br>');
        root.appendChild(ins);
      }

      container.appendChild(root);

      // Bind events
      document.getElementById('ctx-add').addEventListener('click', function () {
        var jt = document.getElementById('ctx-jt').value.trim();
        var cs = document.getElementById('ctx-cs').value;
        if (!jt || !cs) return;
        addEntry({
          jobTitle: jt,
          jobUrl: document.getElementById('ctx-ju').value.trim(),
          connectsSpent: cs,
          result: document.getElementById('ctx-rs').value,
          earnedAmount: document.getElementById('ctx-ea').value || 0,
        });
        render();
      });

      root.querySelectorAll('.ctx-update').forEach(function (sel) {
        sel.addEventListener('change', function () {
          if (!this.value) return;
          var earned = this.value === 'hired' ? prompt('Earned amount ($):', '0') : undefined;
          updateResult(this.dataset.id, this.value, earned);
          render();
        });
      });
    }

    render();
  }

  /* ── Export ───────────────────────────────────────────────── */

  window.CortexConnectsTracker = {
    addEntry: addEntry,
    updateResult: updateResult,
    getStats: getStats,
    renderConnectsTracker: renderConnectsTracker,
  };
})();
