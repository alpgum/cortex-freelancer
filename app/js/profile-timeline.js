/**
 * Cortex Freelancer — Profile Strength Timeline
 * [UW-011] Track profile score improvements over time
 *
 * Stores analysis snapshots in localStorage and renders
 * a visual progress timeline with SVG chart, change log,
 * and milestone badges.
 *
 * Exposed as window.CortexProfileTimeline
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'cortex_profile_snapshots';
  const MAX_SNAPSHOTS = 30;

  // ─── Helpers ──────────────────────────────────────────────────────

  function todayStr() {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  }

  function loadSnapshots() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function persistSnapshots(snapshots) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots));
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function gradeFor(score) {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  }

  // ─── 1) saveSnapshot ─────────────────────────────────────────────

  function saveSnapshot(profileData, scoringResult) {
    if (!scoringResult || typeof scoringResult.score !== 'number') return null;

    const date = todayStr();
    const entry = {
      date,
      score: Math.round(scoringResult.score),
      grade: scoringResult.grade || gradeFor(scoringResult.score),
      rate: profileData?.rate || profileData?.hourlyRate || null,
      skillCount: profileData?.skills?.length || 0,
      jssScore: profileData?.jssScore || profileData?.jobSuccessScore || null,
      completeness: scoringResult.completeness || null,
      earnings: profileData?.earnings || profileData?.totalEarnings || null
    };

    const snapshots = loadSnapshots();

    // Same day → update existing
    const existingIdx = snapshots.findIndex(s => s.date === date);
    if (existingIdx !== -1) {
      snapshots[existingIdx] = entry;
    } else {
      snapshots.push(entry);
    }

    // Sort chronologically, keep last 30
    snapshots.sort((a, b) => a.date.localeCompare(b.date));
    const trimmed = snapshots.slice(-MAX_SNAPSHOTS);

    persistSnapshots(trimmed);
    return entry;
  }

  // ─── 2) getTimeline ───────────────────────────────────────────────

  function getTimeline() {
    const snapshots = loadSnapshots();
    snapshots.sort((a, b) => a.date.localeCompare(b.date));

    return snapshots.map((snap, i) => {
      const prev = i > 0 ? snapshots[i - 1] : null;
      const delta = prev ? {
        score: snap.score - prev.score,
        rate: (snap.rate != null && prev.rate != null) ? snap.rate - prev.rate : null,
        skillCount: snap.skillCount - prev.skillCount,
        jssScore: (snap.jssScore != null && prev.jssScore != null) ? snap.jssScore - prev.jssScore : null,
        completeness: (snap.completeness != null && prev.completeness != null) ? snap.completeness - prev.completeness : null,
        earnings: (snap.earnings != null && prev.earnings != null) ? snap.earnings - prev.earnings : null
      } : null;

      return { ...snap, delta };
    });
  }

  // ─── 3) renderProfileTimeline ─────────────────────────────────────

  function renderProfileTimeline(container) {
    if (typeof container === 'string') {
      container = document.querySelector(container);
    }
    if (!container) return;

    const timeline = getTimeline();
    container.innerHTML = '';

    // Inject scoped styles
    const style = document.createElement('style');
    style.textContent = `
      .cpt-wrap {
        background: #1a1a2e;
        border: 1px solid #2d2d44;
        border-radius: 16px;
        padding: 24px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #e0e0e0;
        max-width: 640px;
      }
      .cpt-header {
        font-size: 20px;
        font-weight: 700;
        margin-bottom: 16px;
        color: #fff;
      }
      .cpt-summary {
        background: #16213e;
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 16px;
        font-size: 15px;
        line-height: 1.6;
      }
      .cpt-summary .cpt-big {
        font-size: 22px;
        font-weight: 700;
        color: #00d4aa;
      }
      .cpt-summary .cpt-delta-pos { color: #00d4aa; }
      .cpt-summary .cpt-delta-neg { color: #ff6b6b; }
      .cpt-chart-wrap {
        background: #16213e;
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 16px;
      }
      .cpt-chart-wrap svg {
        width: 100%;
        display: block;
      }
      .cpt-milestones {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 16px;
      }
      .cpt-badge {
        background: #2d2d44;
        border-radius: 20px;
        padding: 6px 14px;
        font-size: 13px;
        font-weight: 600;
        white-space: nowrap;
      }
      .cpt-badge.earned { background: #1a3a2a; color: #00d4aa; border: 1px solid #00d4aa44; }
      .cpt-badge.locked { opacity: 0.4; }
      .cpt-changelog {
        background: #16213e;
        border-radius: 12px;
        padding: 16px;
      }
      .cpt-changelog h3 {
        font-size: 14px;
        font-weight: 600;
        margin: 0 0 10px 0;
        color: #aaa;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .cpt-log-entry {
        padding: 6px 0;
        font-size: 14px;
        border-bottom: 1px solid #2d2d4433;
        display: flex;
        justify-content: space-between;
      }
      .cpt-log-entry:last-child { border-bottom: none; }
      .cpt-log-date { color: #888; min-width: 70px; }
      .cpt-log-detail { flex: 1; margin-left: 12px; }
      .cpt-empty {
        text-align: center;
        padding: 32px 16px;
        color: #888;
        font-size: 15px;
        line-height: 1.6;
      }
      .cpt-empty-icon { font-size: 40px; margin-bottom: 8px; }
    `;
    container.appendChild(style);

    const wrap = document.createElement('div');
    wrap.className = 'cpt-wrap';
    container.appendChild(wrap);

    // Header
    const header = document.createElement('div');
    header.className = 'cpt-header';
    header.textContent = '📈 Your Progress';
    wrap.appendChild(header);

    // Empty / single state
    if (timeline.length === 0) {
      wrap.innerHTML += `
        <div class="cpt-empty">
          <div class="cpt-empty-icon">📊</div>
          <div>No snapshots yet.<br>Analyze your profile to start tracking progress!</div>
        </div>`;
      return;
    }

    if (timeline.length === 1) {
      const s = timeline[0];
      wrap.innerHTML += `
        <div class="cpt-summary">
          <div>Current score: <span class="cpt-big">${s.score}</span> (${s.grade})</div>
          <div style="margin-top:8px;color:#888;">
            Come back after making changes to see your progress!
          </div>
        </div>`;
      renderMilestones(wrap, s.score);
      return;
    }

    // Multi-snapshot
    const first = timeline[0];
    const last = timeline[timeline.length - 1];
    const totalDelta = last.score - first.score;
    const deltaClass = totalDelta >= 0 ? 'cpt-delta-pos' : 'cpt-delta-neg';
    const deltaSign = totalDelta >= 0 ? '+' : '';

    // Summary
    const summary = document.createElement('div');
    summary.className = 'cpt-summary';
    summary.innerHTML = `
      <div>Score went from <span class="cpt-big">${first.score}</span> → <span class="cpt-big">${last.score}</span>
        <span class="${deltaClass}">(${deltaSign}${totalDelta} points)</span>
      </div>
      <div style="margin-top:4px;color:#888;">
        ${timeline.length} snapshots over ${daysBetween(first.date, last.date)} days
      </div>`;
    wrap.appendChild(summary);

    // SVG Chart
    renderChart(wrap, timeline);

    // Milestones
    renderMilestones(wrap, last.score);

    // Change log
    renderChangelog(wrap, timeline);
  }

  // ─── Chart (SVG polyline) ─────────────────────────────────────────

  function renderChart(parent, timeline) {
    const chartWrap = document.createElement('div');
    chartWrap.className = 'cpt-chart-wrap';
    parent.appendChild(chartWrap);

    const W = 580, H = 160, PAD = 30;
    const scores = timeline.map(t => t.score);
    const minS = Math.max(0, Math.min(...scores) - 5);
    const maxS = Math.min(100, Math.max(...scores) + 5);
    const range = maxS - minS || 1;
    const n = timeline.length;

    function x(i) { return PAD + (i / Math.max(n - 1, 1)) * (W - 2 * PAD); }
    function y(s) { return PAD + (1 - (s - minS) / range) * (H - 2 * PAD); }

    const points = timeline.map((t, i) => `${x(i).toFixed(1)},${y(t.score).toFixed(1)}`).join(' ');

    // Gradient area
    const areaPoints = points + ` ${x(n - 1).toFixed(1)},${(H - PAD).toFixed(1)} ${PAD.toFixed(1)},${(H - PAD).toFixed(1)}`;

    // Axis labels
    let labels = '';
    // Y-axis: min, mid, max
    [minS, Math.round((minS + maxS) / 2), maxS].forEach(val => {
      labels += `<text x="${PAD - 6}" y="${y(val) + 4}" fill="#666" font-size="11" text-anchor="end">${val}</text>`;
    });
    // X-axis: first and last date
    labels += `<text x="${x(0)}" y="${H - 6}" fill="#666" font-size="11" text-anchor="start">${formatDate(timeline[0].date)}</text>`;
    if (n > 1) {
      labels += `<text x="${x(n - 1)}" y="${H - 6}" fill="#666" font-size="11" text-anchor="end">${formatDate(timeline[n - 1].date)}</text>`;
    }

    // Dots
    let dots = '';
    timeline.forEach((t, i) => {
      dots += `<circle cx="${x(i).toFixed(1)}" cy="${y(t.score).toFixed(1)}" r="4" fill="#00d4aa" stroke="#1a1a2e" stroke-width="2"/>`;
    });

    chartWrap.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="cpt-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#00d4aa" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="#00d4aa" stop-opacity="0.02"/>
          </linearGradient>
        </defs>
        <!-- grid lines -->
        <line x1="${PAD}" y1="${PAD}" x2="${PAD}" y2="${H - PAD}" stroke="#2d2d44" stroke-width="1"/>
        <line x1="${PAD}" y1="${H - PAD}" x2="${W - PAD}" y2="${H - PAD}" stroke="#2d2d44" stroke-width="1"/>
        <!-- area fill -->
        <polygon points="${areaPoints}" fill="url(#cpt-grad)"/>
        <!-- line -->
        <polyline points="${points}" fill="none" stroke="#00d4aa" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        ${dots}
        ${labels}
      </svg>`;
  }

  // ─── Milestones ───────────────────────────────────────────────────

  function renderMilestones(parent, currentScore) {
    const milestones = [
      { threshold: 70, label: '🎯 Hit 70!' },
      { threshold: 80, label: '⭐ Hit 80!' },
      { threshold: 90, label: '🏆 Hit 90!' }
    ];

    const div = document.createElement('div');
    div.className = 'cpt-milestones';

    milestones.forEach(m => {
      const earned = currentScore >= m.threshold;
      div.innerHTML += `<span class="cpt-badge ${earned ? 'earned' : 'locked'}">${m.label}</span>`;
    });

    parent.appendChild(div);
  }

  // ─── Change Log ───────────────────────────────────────────────────

  function renderChangelog(parent, timeline) {
    // Only show entries that have a delta
    const entries = timeline.filter(t => t.delta && t.delta.score !== 0);
    if (entries.length === 0) return;

    const div = document.createElement('div');
    div.className = 'cpt-changelog';
    div.innerHTML = '<h3>Change Log</h3>';

    // Show most recent first, limit to 10
    const recent = entries.slice(-10).reverse();
    recent.forEach(t => {
      const sign = t.delta.score >= 0 ? '+' : '';
      const cls = t.delta.score >= 0 ? 'cpt-delta-pos' : 'cpt-delta-neg';
      const details = buildChangeDetails(t);

      div.innerHTML += `
        <div class="cpt-log-entry">
          <span class="cpt-log-date">${formatDate(t.date)}</span>
          <span class="cpt-log-detail">
            ${details}
            <span class="${cls}">(${sign}${t.delta.score} pts)</span>
          </span>
        </div>`;
    });

    parent.appendChild(div);
  }

  function buildChangeDetails(snap) {
    if (!snap.delta) return 'Score updated';
    const parts = [];
    if (snap.delta.skillCount > 0) parts.push(`+${snap.delta.skillCount} skill${snap.delta.skillCount > 1 ? 's' : ''}`);
    if (snap.delta.skillCount < 0) parts.push(`${snap.delta.skillCount} skill${Math.abs(snap.delta.skillCount) > 1 ? 's' : ''}`);
    if (snap.delta.rate != null && snap.delta.rate !== 0) {
      parts.push(`Rate ${snap.delta.rate > 0 ? '↑' : '↓'} $${Math.abs(snap.delta.rate)}`);
    }
    if (snap.delta.completeness != null && snap.delta.completeness !== 0) {
      parts.push(`Completeness ${snap.delta.completeness > 0 ? '↑' : '↓'} ${Math.abs(snap.delta.completeness)}%`);
    }
    return parts.length > 0 ? parts.join(', ') + ' ' : 'Profile updated ';
  }

  // ─── Utils ────────────────────────────────────────────────────────

  function daysBetween(a, b) {
    const da = new Date(a + 'T00:00:00');
    const db = new Date(b + 'T00:00:00');
    return Math.round(Math.abs(db - da) / 86400000);
  }

  // ─── 4) Auto-save hook ────────────────────────────────────────────
  // Monkey-patch the scoring engine if it exists, so that after
  // scoreProfile() completes we automatically save a snapshot.

  function hookAutoSave() {
    // Try to hook into CortexScoring if available
    if (window.CortexScoring && typeof window.CortexScoring.scoreProfile === 'function') {
      const original = window.CortexScoring.scoreProfile;
      window.CortexScoring.scoreProfile = function (profileData, ...args) {
        const result = original.call(this, profileData, ...args);
        // Handle both sync and Promise results
        if (result && typeof result.then === 'function') {
          result.then(r => { saveSnapshot(profileData, r); return r; });
        } else {
          saveSnapshot(profileData, result);
        }
        return result;
      };
    }

    // Also hook via custom event for flexibility
    document.addEventListener('cortex:scoring-complete', (e) => {
      if (e.detail && e.detail.profileData && e.detail.result) {
        saveSnapshot(e.detail.profileData, e.detail.result);
      }
    });
  }

  // Hook on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hookAutoSave);
  } else {
    hookAutoSave();
  }

  // ─── Public API ───────────────────────────────────────────────────

  window.CortexProfileTimeline = {
    saveSnapshot,
    getTimeline,
    renderProfileTimeline,
    clearSnapshots: () => { localStorage.removeItem(STORAGE_KEY); },
    exportData: () => JSON.stringify(loadSnapshots(), null, 2)
  };

})();
