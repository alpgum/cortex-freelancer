/**
 * CortexResponseTimer — [UW-017]
 * Analyze job posting patterns and recommend optimal application timing.
 * All client-side. Exposed as window.CortexResponseTimer.
 */
(function () {
  'use strict';

  /* ── Static best-practice data (Upwork research) ── */
  const BEST_PRACTICES = {
    avgProposals: { min: 15, max: 30 },
    highVisibilityThreshold: 5,           // first N proposals get most attention
    goldenWindowHours: 2,                 // apply within this many hours
    interviewRateMultiplier: 4,           // 4× higher interview rate if within golden window
    peakPostingDays: ['Monday', 'Tuesday', 'Wednesday'],
    peakPostingHoursEST: { start: 9, end: 11 },
    weekendProposalReduction: 0.4,        // 40% fewer proposals on weekends
  };

  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  /* ── Timezone helpers ── */
  function getTimezoneList() {
    const common = [
      'UTC',
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'Europe/London',
      'Europe/Berlin',
      'Europe/Istanbul',
      'Asia/Kolkata',
      'Asia/Shanghai',
      'Asia/Tokyo',
      'Australia/Sydney',
      'Pacific/Auckland',
    ];
    return common;
  }

  function guessUserTimezone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch (_) {
      return 'UTC';
    }
  }

  function convertUTCHourToTZ(utcHour, tz) {
    const d = new Date(Date.UTC(2026, 0, 5, utcHour, 0, 0)); // a known Monday
    const str = d.toLocaleString('en-US', { timeZone: tz, hour: 'numeric', hour12: false });
    return parseInt(str, 10) % 24;
  }

  function convertUTCDayHourToTZ(utcDay, utcHour, tz) {
    // utcDay 0=Sun
    const base = new Date(Date.UTC(2026, 0, 4 + utcDay, utcHour, 0, 0)); // Jan 4 2026 = Sunday
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
      hour: 'numeric',
      hour12: false,
    }).formatToParts(base);
    let day, hour;
    for (const p of parts) {
      if (p.type === 'weekday') day = DAY_SHORT.indexOf(p.value);
      if (p.type === 'hour') hour = parseInt(p.value, 10) % 24;
    }
    return { day: day ?? utcDay, hour: hour ?? utcHour };
  }

  /* ── Analysis engine ── */

  function analyzePostingPatterns(jobsData) {
    // jobsData: array of { postedAt: ISO string | timestamp, ... }
    // Returns UTC-based grid [day][hour] = count
    const grid = Array.from({ length: 7 }, () => new Array(24).fill(0));
    let total = 0;

    for (const job of jobsData) {
      if (!job.postedAt) continue;
      const d = new Date(job.postedAt);
      if (isNaN(d.getTime())) continue;
      grid[d.getUTCDay()][d.getUTCHours()]++;
      total++;
    }

    return { grid, total };
  }

  function convertGridToTZ(utcGrid, tz) {
    const converted = Array.from({ length: 7 }, () => new Array(24).fill(0));
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        if (utcGrid[day][hour] === 0) continue;
        const { day: td, hour: th } = convertUTCDayHourToTZ(day, hour, tz);
        converted[td][th] += utcGrid[day][hour];
      }
    }
    return converted;
  }

  function findGoldenHours(grid, topN = 3) {
    // Find slots with high posting freq but low expected competition
    // Heuristic: weekend + off-peak hours with decent posting volume
    const slots = [];
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        if (grid[day][hour] === 0) continue;
        const isWeekend = day === 0 || day === 6;
        const isOffPeak = hour < 8 || hour > 20;
        // Score: posting volume (want high) × competition discount
        const competitionMultiplier = isWeekend ? 0.6 : 1.0;
        const peakPenalty = isOffPeak ? 0.7 : 1.0;
        const score = grid[day][hour] / (competitionMultiplier * peakPenalty);
        slots.push({ day, hour, count: grid[day][hour], score, isWeekend, isOffPeak });
      }
    }
    slots.sort((a, b) => b.score - a.score);
    return slots.slice(0, topN);
  }

  function getStaticGoldenHours(tz) {
    // When no job data, use static best-practice slots
    // Peak: Mon-Wed 9-11 AM EST, but golden = weekends & off-peak
    const slots = [];
    // Best opportunity windows (low competition)
    const opportunities = [
      { day: 0, hour: 10, label: 'Sunday morning — 40% fewer proposals' },
      { day: 6, hour: 9, label: 'Saturday morning — low competition' },
      { day: 2, hour: 7, label: 'Early Tuesday — before the rush' },
    ];
    for (const opp of opportunities) {
      const { day, hour } = convertUTCDayHourToTZ(opp.day, hour_EST_to_UTC(opp.hour), tz);
      slots.push({ ...opp, day, hour });
    }
    return slots;
  }

  function hour_EST_to_UTC(estHour) {
    // EST = UTC-5
    return (estHour + 5) % 24;
  }

  function buildStaticGrid() {
    // Build a plausible grid from best-practice data
    const grid = Array.from({ length: 7 }, () => new Array(24).fill(0));
    // Peak: Mon(1), Tue(2), Wed(3), 9-11 AM EST = 14-16 UTC
    for (let day = 1; day <= 3; day++) {
      for (let h = 14; h <= 16; h++) grid[day][h] = 8;
      // Surrounding hours
      for (let h = 12; h <= 18; h++) {
        if (grid[day][h] === 0) grid[day][h] = 5;
      }
      // Off-peak
      for (let h = 8; h < 12; h++) grid[day][h] = 2;
      for (let h = 19; h <= 22; h++) grid[day][h] = 2;
    }
    // Thu-Fri moderate
    for (let day = 4; day <= 5; day++) {
      for (let h = 13; h <= 17; h++) grid[day][h] = 4;
      for (let h = 9; h <= 12; h++) grid[day][h] = 2;
      for (let h = 18; h <= 20; h++) grid[day][h] = 2;
    }
    // Weekend low
    for (const day of [0, 6]) {
      for (let h = 14; h <= 18; h++) grid[day][h] = 2;
      for (let h = 10; h <= 13; h++) grid[day][h] = 1;
    }
    return grid;
  }

  /* ── Styles ── */
  function injectStyles(container) {
    if (container.querySelector('.crt-styles')) return;
    const style = document.createElement('style');
    style.className = 'crt-styles';
    style.textContent = `
      .crt-container {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: #1a1a2e;
        color: #e0e0e0;
        border-radius: 12px;
        padding: 24px;
        max-width: 900px;
      }
      .crt-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 20px;
        flex-wrap: wrap;
        gap: 12px;
      }
      .crt-title {
        font-size: 20px;
        font-weight: 700;
        color: #fff;
      }
      .crt-tz-select {
        background: #16213e;
        color: #e0e0e0;
        border: 1px solid #0f3460;
        border-radius: 6px;
        padding: 6px 10px;
        font-size: 13px;
        cursor: pointer;
      }
      .crt-tz-select:focus { outline: 2px solid #e94560; }
      .crt-section {
        margin-bottom: 24px;
      }
      .crt-section-title {
        font-size: 15px;
        font-weight: 600;
        color: #e94560;
        margin-bottom: 10px;
      }

      /* Heatmap */
      .crt-heatmap {
        display: grid;
        grid-template-columns: 48px repeat(24, 1fr);
        gap: 2px;
        font-size: 10px;
        overflow-x: auto;
      }
      .crt-hm-label {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        padding-right: 6px;
        font-weight: 500;
        color: #aaa;
        white-space: nowrap;
      }
      .crt-hm-hour-label {
        text-align: center;
        color: #888;
        font-size: 9px;
        padding-bottom: 2px;
      }
      .crt-hm-cell {
        aspect-ratio: 1;
        min-width: 16px;
        border-radius: 3px;
        position: relative;
        cursor: default;
        transition: transform 0.1s;
      }
      .crt-hm-cell:hover {
        transform: scale(1.3);
        z-index: 2;
      }
      .crt-hm-cell[data-golden="true"] {
        outline: 2px solid #ffd700;
        outline-offset: 1px;
        z-index: 1;
      }
      .crt-hm-cell .crt-tooltip {
        display: none;
        position: absolute;
        bottom: 110%;
        left: 50%;
        transform: translateX(-50%);
        background: #16213e;
        color: #fff;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        white-space: nowrap;
        z-index: 10;
        pointer-events: none;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      }
      .crt-hm-cell:hover .crt-tooltip { display: block; }

      /* Golden hours */
      .crt-golden {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      .crt-golden-card {
        background: linear-gradient(135deg, #16213e, #0f3460);
        border: 1px solid #ffd700;
        border-radius: 8px;
        padding: 12px 16px;
        flex: 1;
        min-width: 180px;
      }
      .crt-golden-card .crt-gc-time {
        font-size: 18px;
        font-weight: 700;
        color: #ffd700;
      }
      .crt-golden-card .crt-gc-day {
        font-size: 13px;
        color: #ccc;
        margin-top: 2px;
      }
      .crt-golden-card .crt-gc-reason {
        font-size: 11px;
        color: #999;
        margin-top: 6px;
      }

      /* Tips */
      .crt-tips {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      .crt-tips li {
        background: #16213e;
        border-left: 3px solid #e94560;
        padding: 10px 14px;
        margin-bottom: 8px;
        border-radius: 0 6px 6px 0;
        font-size: 13px;
        line-height: 1.5;
      }
      .crt-tips li strong {
        color: #fff;
      }

      /* Stats bar */
      .crt-stats {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
        margin-bottom: 20px;
      }
      .crt-stat {
        background: #16213e;
        border-radius: 8px;
        padding: 12px 16px;
        flex: 1;
        min-width: 120px;
        text-align: center;
      }
      .crt-stat-value {
        font-size: 22px;
        font-weight: 700;
        color: #e94560;
      }
      .crt-stat-label {
        font-size: 11px;
        color: #888;
        margin-top: 4px;
      }

      /* Legend */
      .crt-legend {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 8px;
        font-size: 11px;
        color: #888;
      }
      .crt-legend-bar {
        display: flex;
        height: 10px;
        border-radius: 3px;
        overflow: hidden;
      }
      .crt-legend-bar span {
        width: 24px;
        height: 100%;
      }
    `;
    container.appendChild(style);
  }

  /* ── Color scale ── */
  function heatColor(value, max) {
    if (max === 0) return 'rgba(255,255,255,0.03)';
    const t = value / max;
    if (t === 0) return 'rgba(255,255,255,0.03)';
    // Dark blue → cyan → yellow → red
    const r = Math.round(t < 0.5 ? 0 : (t - 0.5) * 2 * 233 + 20);
    const g = Math.round(t < 0.5 ? t * 2 * 180 : (1 - (t - 0.5) * 2) * 180);
    const b = Math.round(t < 0.5 ? 120 + t * 2 * 60 : 60 * (1 - (t - 0.5) * 2));
    const a = 0.4 + t * 0.6;
    return `rgba(${r},${g},${b},${a})`;
  }

  /* ── Render ── */
  function renderResponseTimer(jobsData, container) {
    if (typeof container === 'string') {
      container = document.querySelector(container);
    }
    if (!container) {
      console.error('[CortexResponseTimer] Container not found');
      return;
    }

    injectStyles(container);

    const hasData = Array.isArray(jobsData) && jobsData.length > 0;
    const { grid: utcGrid, total } = hasData
      ? analyzePostingPatterns(jobsData)
      : { grid: buildStaticGrid(), total: 0 };

    let currentTZ = guessUserTimezone();
    let grid = convertGridToTZ(utcGrid, currentTZ);

    const root = document.createElement('div');
    root.className = 'crt-container';
    container.innerHTML = '';
    container.appendChild(root);

    function render() {
      grid = convertGridToTZ(utcGrid, currentTZ);
      const goldenSlots = findGoldenHours(grid);
      const maxVal = Math.max(1, ...grid.flat());
      const goldenSet = new Set(goldenSlots.map(s => `${s.day}-${s.hour}`));

      // Day distribution
      const dayTotals = grid.map(row => row.reduce((a, b) => a + b, 0));
      const peakDay = DAY_SHORT[dayTotals.indexOf(Math.max(...dayTotals))];

      root.innerHTML = '';

      // Header
      const header = document.createElement('div');
      header.className = 'crt-header';
      header.innerHTML = `
        <span class="crt-title">⏰ Best Times to Apply</span>
      `;
      const tzSelect = document.createElement('select');
      tzSelect.className = 'crt-tz-select';
      for (const tz of getTimezoneList()) {
        const opt = document.createElement('option');
        opt.value = tz;
        opt.textContent = tz.replace(/_/g, ' ');
        if (tz === currentTZ) opt.selected = true;
        tzSelect.appendChild(opt);
      }
      tzSelect.addEventListener('change', () => {
        currentTZ = tzSelect.value;
        render();
      });
      header.appendChild(tzSelect);
      root.appendChild(header);

      // Stats
      const statsDiv = document.createElement('div');
      statsDiv.className = 'crt-stats';
      const statsItems = [
        { value: hasData ? total : '—', label: 'Jobs Analyzed' },
        { value: hasData ? peakDay : 'Mon–Wed', label: 'Peak Day' },
        { value: '< 2h', label: 'Golden Window' },
        { value: '4×', label: 'Interview Boost' },
      ];
      for (const s of statsItems) {
        const d = document.createElement('div');
        d.className = 'crt-stat';
        d.innerHTML = `<div class="crt-stat-value">${s.value}</div><div class="crt-stat-label">${s.label}</div>`;
        statsDiv.appendChild(d);
      }
      root.appendChild(statsDiv);

      // Heatmap
      const hmSection = document.createElement('div');
      hmSection.className = 'crt-section';
      hmSection.innerHTML = `<div class="crt-section-title">📊 Posting Frequency Heatmap</div>`;
      const hmGrid = document.createElement('div');
      hmGrid.className = 'crt-heatmap';

      // Hour labels row
      const corner = document.createElement('div');
      corner.className = 'crt-hm-label';
      hmGrid.appendChild(corner);
      for (let h = 0; h < 24; h++) {
        const lbl = document.createElement('div');
        lbl.className = 'crt-hm-hour-label';
        lbl.textContent = h.toString().padStart(2, '0');
        hmGrid.appendChild(lbl);
      }

      // Rows
      for (let day = 0; day < 7; day++) {
        const label = document.createElement('div');
        label.className = 'crt-hm-label';
        label.textContent = DAY_SHORT[day];
        hmGrid.appendChild(label);
        for (let hour = 0; hour < 24; hour++) {
          const cell = document.createElement('div');
          cell.className = 'crt-hm-cell';
          cell.style.background = heatColor(grid[day][hour], maxVal);
          if (goldenSet.has(`${day}-${hour}`)) {
            cell.setAttribute('data-golden', 'true');
          }
          const tip = document.createElement('span');
          tip.className = 'crt-tooltip';
          tip.textContent = `${DAYS[day]} ${hour}:00 — ${grid[day][hour]} job${grid[day][hour] !== 1 ? 's' : ''}`;
          cell.appendChild(tip);
          hmGrid.appendChild(cell);
        }
      }

      hmSection.appendChild(hmGrid);

      // Legend
      const legend = document.createElement('div');
      legend.className = 'crt-legend';
      legend.innerHTML = '<span>Less</span>';
      const bar = document.createElement('div');
      bar.className = 'crt-legend-bar';
      for (let i = 0; i <= 5; i++) {
        const s = document.createElement('span');
        s.style.background = heatColor((i / 5) * maxVal, maxVal);
        bar.appendChild(s);
      }
      legend.appendChild(bar);
      legend.innerHTML += '<span>More</span>&nbsp;&nbsp;';
      legend.innerHTML += '<span style="display:inline-block;width:12px;height:12px;outline:2px solid #ffd700;border-radius:2px;margin-right:4px;"></span><span>Golden Hour</span>';
      hmSection.appendChild(legend);
      root.appendChild(hmSection);

      // Golden Hours
      const goldenSection = document.createElement('div');
      goldenSection.className = 'crt-section';
      goldenSection.innerHTML = `<div class="crt-section-title">🌟 Golden Hours — Low Competition, High Opportunity</div>`;
      const goldenCards = document.createElement('div');
      goldenCards.className = 'crt-golden';
      for (const slot of goldenSlots) {
        const card = document.createElement('div');
        card.className = 'crt-golden-card';
        const reason = slot.isWeekend
          ? '40% fewer proposals on weekends'
          : slot.isOffPeak
            ? 'Off-peak: less competition'
            : 'High volume, act fast';
        card.innerHTML = `
          <div class="crt-gc-time">${slot.hour.toString().padStart(2, '0')}:00</div>
          <div class="crt-gc-day">${DAYS[slot.day]}</div>
          <div class="crt-gc-reason">${reason} · ${slot.count} job${slot.count !== 1 ? 's' : ''} posted</div>
        `;
        goldenCards.appendChild(card);
      }
      goldenSection.appendChild(goldenCards);
      root.appendChild(goldenSection);

      // Tips
      const tipsSection = document.createElement('div');
      tipsSection.className = 'crt-section';
      tipsSection.innerHTML = `<div class="crt-section-title">💡 Your Advantage</div>`;
      const tipsList = document.createElement('ul');
      tipsList.className = 'crt-tips';
      const tips = [
        '<strong>Be in the first 5 applicants</strong> — apply within 2 hours of posting for 4× higher interview rates',
        '<strong>Weekend jobs have 40% fewer proposals</strong> — less competition means more visibility for your bid',
        '<strong>Set up notifications</strong> for new jobs in your niche — speed is your biggest competitive advantage',
        `<strong>Peak posting hours:</strong> Mon–Wed, 9–11 AM EST — high volume but also high competition`,
        '<strong>Fresh job window:</strong> Average jobs get 15–30 proposals. The first 5 have the highest visibility with clients',
      ];
      for (const tip of tips) {
        const li = document.createElement('li');
        li.innerHTML = tip;
        tipsList.appendChild(li);
      }
      tipsSection.appendChild(tipsList);
      root.appendChild(tipsSection);

      // No-data notice
      if (!hasData) {
        const notice = document.createElement('div');
        notice.style.cssText = 'text-align:center;color:#666;font-size:12px;margin-top:16px;padding:10px;border:1px dashed #333;border-radius:8px;';
        notice.innerHTML = '📡 Showing best-practice estimates. Heatmap will use real data once job matches are loaded.';
        root.appendChild(notice);
      }
    }

    render();

    return { setTimezone: (tz) => { currentTZ = tz; render(); } };
  }

  /* ── Public API ── */
  window.CortexResponseTimer = {
    render: renderResponseTimer,
    analyze: analyzePostingPatterns,
    BEST_PRACTICES,
  };
})();
