/**
 * [UX-011] Cortex Freelancer — Burnout Detector
 * Client-side burnout risk assessment + UI renderer.
 * Exposed as window.CortexBurnoutDetector.
 */
(function () {
  'use strict';

  // ── Helpers ─────────────────────────────────────────────────────────

  function clamp(n, a, b) {
    n = Number(n);
    if (isNaN(n)) n = 0;
    return Math.max(a, Math.min(b, n));
  }

  function toNum(x, fallback) {
    var n = Number(x);
    return isNaN(n) ? (fallback == null ? 0 : fallback) : n;
  }

  function parseRate(hourlyRate) {
    if (typeof hourlyRate === 'number') return hourlyRate;
    if (!hourlyRate) return 0;
    var m = String(hourlyRate).match(/([\d,.]+)/);
    return m ? parseFloat(m[1].replace(/,/g, '')) : 0;
  }

  function parseDateAny(v) {
    if (!v) return null;
    var d = v instanceof Date ? v : new Date(v);
    if (isNaN(d.getTime())) return null;
    return d;
  }

  function weeksBetween(a, b) {
    var ms = (b.getTime() - a.getTime());
    return Math.max(1, ms / (7 * 24 * 60 * 60 * 1000));
  }

  function monthKey(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function addMonths(d, delta) {
    return new Date(d.getFullYear(), d.getMonth() + delta, 1);
  }

  function monthsDiff(a, b) {
    return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  }

  function fmtMoney(n) {
    if (n == null || isNaN(n)) return '—';
    return '$' + Math.round(n).toLocaleString('en-US');
  }

  function roundTo(n, step) {
    step = step || 1;
    return Math.round(n / step) * step;
  }

  function ceilTo(n, step) {
    step = step || 1;
    return Math.ceil(n / step) * step;
  }

  function safeText(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Attempt to build date intervals for work items.
  // Supports a variety of shapes (best-effort):
  // { startDate, endDate } | { startedAt, completedAt } | { date } | { endDate }.
  function toIntervals(workHistory) {
    var out = [];
    (workHistory || []).forEach(function (w) {
      if (!w) return;
      var start = parseDateAny(w.startDate || w.startedAt || w.start || w.beginDate);
      var end = parseDateAny(w.endDate || w.completedAt || w.endedAt || w.end || w.date);

      // If only end is present, assume ~30 days of work ending at end.
      if (!start && end) start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
      // If only start is present, assume it continues until now.
      if (start && !end) end = new Date();

      if (!start || !end) return;
      if (end < start) {
        var tmp = start; start = end; end = tmp;
      }

      // Hours estimation (optional)
      var hours = toNum(w.hours || w.totalHours || w.billedHours || w.hoursBilled, null);
      if ((hours == null || hours <= 0) && (w.type === 'hourly' || w.type === 'Hourly')) {
        var earned = toNum(w.earnings || w.amount || w.totalEarned || w.earnedAmount, 0);
        var rate = parseRate(w.hourlyRate);
        if (rate > 0 && earned > 0) hours = earned / rate;
      }

      out.push({ start: start, end: end, raw: w, hours: hours });
    });
    return out;
  }

  function countActiveProjects(intervals, now) {
    now = now || new Date();
    var recentGraceMs = 14 * 24 * 60 * 60 * 1000; // treat recently-ended as active
    return intervals.filter(function (iv) {
      return iv.start <= now && iv.end.getTime() >= (now.getTime() - recentGraceMs);
    }).length;
  }

  function maxConcurrency(intervals, windowDays) {
    if (!intervals.length) return 0;
    var now = new Date();
    var startWindow = new Date(now.getTime() - (windowDays || 120) * 24 * 60 * 60 * 1000);

    // sweep-line events within window
    var events = [];
    intervals.forEach(function (iv) {
      var s = iv.start < startWindow ? startWindow : iv.start;
      var e = iv.end;
      if (e < startWindow) return;
      events.push({ t: s.getTime(), delta: +1 });
      // add a tiny epsilon so end date counts as active up to that point
      events.push({ t: e.getTime() + 1, delta: -1 });
    });
    events.sort(function (a, b) { return a.t - b.t; });

    var cur = 0;
    var max = 0;
    events.forEach(function (ev) {
      cur += ev.delta;
      if (cur > max) max = cur;
    });
    return max;
  }

  function workedMonthSet(intervals) {
    var set = new Set();
    intervals.forEach(function (iv) {
      var s = new Date(iv.start.getFullYear(), iv.start.getMonth(), 1);
      var e = new Date(iv.end.getFullYear(), iv.end.getMonth(), 1);
      var m = monthsDiff(s, e);
      for (var i = 0; i <= m; i++) {
        set.add(monthKey(addMonths(s, i)));
      }
    });
    return set;
  }

  function consecutiveMonthsWorkedEndingNow(workedSet, now) {
    if (!workedSet || workedSet.size === 0) return 0;
    now = now || new Date();
    var count = 0;
    for (var i = 0; i < 60; i++) {
      var k = monthKey(addMonths(new Date(now.getFullYear(), now.getMonth(), 1), -i));
      if (!workedSet.has(k)) break;
      count++;
    }
    return count;
  }

  function monthlyHours(intervals, monthsBack) {
    var now = new Date();
    var map = {}; // key -> hours
    intervals.forEach(function (iv) {
      if (!iv.hours || iv.hours <= 0) return;
      // Assign hours to the end month (best-effort)
      var k = monthKey(new Date(iv.end.getFullYear(), iv.end.getMonth(), 1));
      map[k] = (map[k] || 0) + iv.hours;
    });

    var series = [];
    for (var i = monthsBack - 1; i >= 0; i--) {
      var d = addMonths(new Date(now.getFullYear(), now.getMonth(), 1), -i);
      var key = monthKey(d);
      series.push({ key: key, label: d.toLocaleString('en-US', { month: 'short' }), hours: map[key] || 0 });
    }
    return series;
  }

  // ── Core: Burnout Assessment ────────────────────────────────────────

  function assessBurnout(profileData) {
    var p = profileData || {};
    var totalHours = toNum(p.totalHours, 0);
    var totalJobs = toNum(p.totalJobs, 0);
    var hourlyRate = parseRate(p.hourlyRate);

    var now = new Date();
    var memberSince = parseDateAny(p.memberSince);
    var weeksActive = memberSince ? weeksBetween(memberSince, now) : 52;
    weeksActive = Math.max(1, weeksActive);

    var hoursPerWeek = totalHours > 0 ? (totalHours / weeksActive) : 0;

    var intervals = toIntervals(p.workHistory || []);
    var activeNow = countActiveProjects(intervals, now);
    var peakConcurrency = maxConcurrency(intervals, 120);

    // ── Factor 1: Weekly hours ──
    var weeklyFactor = { name: 'Weekly hours', status: 'ok', detail: '', suggestion: '' };
    if (hoursPerWeek <= 0) {
      weeklyFactor.detail = 'Not enough hours data to estimate weekly workload.';
      weeklyFactor.suggestion = 'Track your weekly billable hours for 4 weeks.';
    } else if (hoursPerWeek > 50) {
      weeklyFactor.status = 'danger';
      weeklyFactor.detail = 'Estimated ' + hoursPerWeek.toFixed(1) + ' hrs/week based on lifetime hours.';
      weeklyFactor.suggestion = 'Bring weekly hours down to ~25–30 for 4 weeks (hard cap + calendar blocks).';
    } else if (hoursPerWeek > 40) {
      weeklyFactor.status = 'warning';
      weeklyFactor.detail = 'Estimated ' + hoursPerWeek.toFixed(1) + ' hrs/week. This is sustained overtime.';
      weeklyFactor.suggestion = 'Aim for 30–35 hrs/week average and protect one full day off.';
    } else {
      weeklyFactor.detail = 'Estimated ' + hoursPerWeek.toFixed(1) + ' hrs/week.';
      weeklyFactor.suggestion = 'Keep a weekly cap and avoid creeping overtime.';
    }

    // ── Factor 2: Concurrent projects ──
    var projFactor = { name: 'Concurrent projects', status: 'ok', detail: '', suggestion: '' };
    if (!intervals.length) {
      projFactor.detail = 'No dated work history detected to estimate concurrent projects.';
      projFactor.suggestion = 'Add start/end dates to work history entries for better analysis.';
    } else {
      var label = activeNow + ' active (recent) project' + (activeNow === 1 ? '' : 's');
      projFactor.detail = label + ' · Peak concurrency (last 4 months): ' + peakConcurrency;
      if (activeNow >= 5 || peakConcurrency >= 6) {
        projFactor.status = 'danger';
        projFactor.suggestion = 'Reduce to 1–2 concurrent projects. Pause new work until you close loops.';
      } else if (activeNow >= 3 || peakConcurrency >= 4) {
        projFactor.status = 'warning';
        projFactor.suggestion = 'Keep concurrency at 2–3 max. Batch communication windows to reduce context switching.';
      } else {
        projFactor.suggestion = 'Maintain 1–2 concurrent projects for deep work.';
      }
    }

    // ── Factor 3: Rate vs effort ──
    var rateFactor = { name: 'Rate vs effort', status: 'ok', detail: '', suggestion: '' };
    if (!hourlyRate) {
      rateFactor.detail = 'No hourly rate detected.';
      rateFactor.suggestion = 'Set a baseline hourly rate so we can estimate sustainability.';
    } else {
      var lowRateDanger = hourlyRate < 12;
      var lowRateWarn = hourlyRate < 20;
      var highHours = hoursPerWeek > 40;
      var veryHighHours = hoursPerWeek > 50;

      rateFactor.detail = 'Rate: ' + fmtMoney(hourlyRate) + '/hr' + (hoursPerWeek ? (' · Load: ' + hoursPerWeek.toFixed(1) + ' hrs/week') : '');

      if ((lowRateDanger && highHours) || (lowRateWarn && veryHighHours)) {
        rateFactor.status = 'danger';
        rateFactor.suggestion = 'Raise rate and reduce hours. Under-pricing forces unhealthy volume.';
      } else if ((lowRateWarn && highHours) || lowRateDanger) {
        rateFactor.status = 'warning';
        rateFactor.suggestion = 'Consider a rate increase so you can work fewer hours for the same income.';
      } else {
        rateFactor.suggestion = 'Keep rate aligned to skill level and raise gradually to protect your time.';
      }
    }

    // ── Factor 4: Breaks / recovery ──
    var breaksFactor = { name: 'Breaks & recovery', status: 'ok', detail: '', suggestion: '' };
    var workedSet = workedMonthSet(intervals);
    var streak = consecutiveMonthsWorkedEndingNow(workedSet, now);
    if (!intervals.length) {
      breaksFactor.detail = 'No dated work history detected to evaluate breaks.';
      breaksFactor.suggestion = 'Log project start/end months to identify recovery gaps.';
    } else {
      breaksFactor.detail = 'Consecutive worked months (ending now): ' + streak;
      if (streak >= 10) {
        breaksFactor.status = 'danger';
        breaksFactor.suggestion = 'Plan a full week off in the next 4–6 weeks and a recovery week every ~3 months.';
      } else if (streak >= 6) {
        breaksFactor.status = 'warning';
        breaksFactor.suggestion = 'Schedule intentional downtime: 3–5 days off per quarter and regular no-work weekends.';
      } else {
        breaksFactor.suggestion = 'Keep regular breaks so streaks don’t silently grow.';
      }
    }

    // ── Factor 5: Trend (hours increasing) ──
    var trendFactor = { name: 'Workload trend', status: 'ok', detail: '', suggestion: '' };
    var trendSeries = monthlyHours(intervals, 4);
    var trendHasSignal = trendSeries.some(function (m) { return m.hours > 0; });
    if (!trendHasSignal) {
      trendFactor.detail = 'Not enough per-project hours data to detect a monthly trend.';
      trendFactor.suggestion = 'If possible, store billed hours per job to track your load trend.';
    } else {
      var m0 = trendSeries[3].hours; // most recent month
      var m1 = trendSeries[2].hours;
      var m2 = trendSeries[1].hours;
      var m3 = trendSeries[0].hours;
      var recent2 = m0 + m1;
      var prev2 = m2 + m3;
      var ratio = prev2 > 0 ? recent2 / prev2 : 1;

      trendFactor.detail = 'Last 4 months (hrs): ' + trendSeries.map(function (m) { return m.label + ' ' + Math.round(m.hours); }).join(' · ');

      if (ratio >= 1.6 || (m1 > 0 && m0 > m1 * 1.4)) {
        trendFactor.status = 'danger';
        trendFactor.suggestion = 'Your load is accelerating. Freeze new commitments and renegotiate deadlines.';
      } else if (ratio >= 1.3 || (m1 > 0 && m0 > m1 * 1.2)) {
        trendFactor.status = 'warning';
        trendFactor.suggestion = 'Workload is trending up. Add buffer weeks and tighten scope on active projects.';
      } else {
        trendFactor.suggestion = 'Trend looks stable. Keep monitoring month-to-month.';
      }
    }

    // ── Score synthesis ──
    var points = 0;
    function add(status, warnPts, dangerPts) {
      if (status === 'danger') points += dangerPts;
      else if (status === 'warning') points += warnPts;
    }

    add(weeklyFactor.status, 20, 30);
    add(projFactor.status, 10, 20);
    add(rateFactor.status, 15, 25);
    add(breaksFactor.status, 15, 25);
    add(trendFactor.status, 10, 20);

    // Normalize to 0–100 (max possible points = 120)
    var riskScore = clamp(Math.round((points / 120) * 100), 0, 100);

    var burnoutRisk = 'low';
    if (riskScore >= 75) burnoutRisk = 'critical';
    else if (riskScore >= 55) burnoutRisk = 'high';
    else if (riskScore >= 30) burnoutRisk = 'moderate';

    // ── Sustainable workload recommendation ──
    var sustainableHours = (burnoutRisk === 'critical') ? 20
      : (burnoutRisk === 'high') ? 25
      : (burnoutRisk === 'moderate') ? 30
      : 35;

    // Projects per month heuristic based on risk
    var projectsPerMonth = (burnoutRisk === 'critical') ? 1
      : (burnoutRisk === 'high') ? 2
      : (burnoutRisk === 'moderate') ? 3
      : 4;

    var suggestedRate = null;
    if (hourlyRate > 0 && hoursPerWeek > 0) {
      var currentWeeklyRevenue = hoursPerWeek * hourlyRate;
      suggestedRate = ceilTo(currentWeeklyRevenue / sustainableHours, 5);
      // Ensure we don't suggest going down unless you are massively overworked
      suggestedRate = Math.max(suggestedRate, hourlyRate);
    } else if (hourlyRate > 0) {
      suggestedRate = hourlyRate;
    }

    var sustainableWorkload = {
      hoursPerWeek: sustainableHours,
      projectsPerMonth: projectsPerMonth,
      suggestedRate: suggestedRate,
    };

    // ── Recommendations ──
    var recs = [];

    if (weeklyFactor.status !== 'ok') {
      recs.push('Set a hard cap of ' + sustainableHours + ' hrs/week for the next 4 weeks (track daily).');
    }

    if (projFactor.status !== 'ok') {
      recs.push('Limit concurrent projects to ' + Math.min(3, projectsPerMonth + 1) + ' and finish one before starting another.');
    }

    if (hourlyRate > 0 && hoursPerWeek > sustainableHours + 2) {
      var reduceBy = Math.max(0, Math.round(hoursPerWeek - sustainableHours));
      if (reduceBy > 0) {
        if (suggestedRate && suggestedRate > hourlyRate + 1) {
          recs.push('Raise rate to ' + fmtMoney(suggestedRate) + '/hr to reduce weekly hours by ~' + reduceBy + ' while keeping income similar.');
        } else {
          recs.push('Reduce weekly hours by ~' + reduceBy + ' (scope cuts, longer timelines, fewer meetings).');
        }
      }
    }

    if (breaksFactor.status !== 'ok') {
      recs.push('Take 1 week off every 3 months (schedule it now so it actually happens).');
    } else {
      recs.push('Protect recovery: at least 1 no-work day per week and one low-commitment weekend per month.');
    }

    if (trendFactor.status !== 'ok') {
      recs.push('Freeze new commitments for 2 weeks and renegotiate delivery dates where needed.');
    }

    // If we have very little data, add a meta recommendation
    if (!totalHours || !p.memberSince) {
      recs.push('Improve your inputs (memberSince, totalHours, and work history dates) for a more accurate assessment.');
    }

    // De-duplicate recs
    var seen = new Set();
    recs = recs.filter(function (r) {
      var k = r.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    return {
      burnoutRisk: burnoutRisk,
      riskScore: riskScore,
      factors: [weeklyFactor, projFactor, rateFactor, breaksFactor, trendFactor],
      recommendations: recs,
      sustainableWorkload: sustainableWorkload,
      meta: {
        hoursPerWeekEstimate: hoursPerWeek,
        weeksActiveEstimate: weeksActive,
        activeProjectsEstimate: activeNow,
        peakConcurrencyEstimate: peakConcurrency,
        totalJobs: totalJobs,
      }
    };
  }

  // ── UI Rendering ────────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById('cortex-burnout-detector-css')) return;
    var s = document.createElement('style');
    s.id = 'cortex-burnout-detector-css';
    s.textContent = [
      '.cbd-root{font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;background:#0b1220;color:#e5e7eb;border:1px solid #1f2a44;border-radius:14px;padding:22px;max-width:920px}',
      '.cbd-root *{box-sizing:border-box}',
      '.cbd-header{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:18px}',
      '.cbd-title{margin:0;font-size:20px;font-weight:800;letter-spacing:.2px;color:#f8fafc}',
      '.cbd-sub{margin:2px 0 0;font-size:13px;color:#94a3b8}',
      '.cbd-badge{display:inline-flex;align-items:center;gap:8px;padding:8px 10px;border-radius:999px;border:1px solid #2b3a5c;background:#0f172a;color:#cbd5e1;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.8px}',
      '.cbd-grid{display:grid;grid-template-columns:340px 1fr;gap:16px}',
      '@media (max-width:900px){.cbd-grid{grid-template-columns:1fr}}',
      '.cbd-card{background:#0f172a;border:1px solid #1f2a44;border-radius:12px;padding:14px}',
      '.cbd-card-title{font-size:13px;font-weight:800;color:#cbd5e1;text-transform:uppercase;letter-spacing:.8px;margin:0 0 10px}',

      /* Gauge */
      '.cbd-gaugeWrap{display:flex;align-items:center;justify-content:center;padding:10px 0 6px}',
      '.cbd-gauge{position:relative;width:260px;height:130px;overflow:hidden}',
      '.cbd-gauge:before{content:"";position:absolute;left:0;top:0;width:100%;height:200%;border-radius:50%;background:conic-gradient(from 180deg,#22c55e 0deg,#84cc16 35deg,#f59e0b 95deg,#ef4444 160deg,#ef4444 180deg)}',
      '.cbd-gauge:after{content:"";position:absolute;left:14px;top:14px;width:calc(100% - 28px);height:calc(200% - 28px);border-radius:50%;background:#0f172a}',
      '.cbd-needle{position:absolute;left:50%;bottom:0;width:2px;height:112px;background:#e5e7eb;transform-origin:bottom;transform:translateX(-50%) rotate(var(--deg));box-shadow:0 0 12px rgba(226,232,240,.35)}',
      '.cbd-needleDot{position:absolute;left:50%;bottom:0;width:14px;height:14px;border-radius:999px;background:#e5e7eb;transform:translate(-50%,50%);box-shadow:0 0 12px rgba(226,232,240,.25)}',
      '.cbd-gaugeMeta{text-align:center;margin-top:8px}',
      '.cbd-score{font-size:30px;font-weight:900;color:#f8fafc;line-height:1}',
      '.cbd-scoreSub{font-size:12px;color:#94a3b8;margin-top:2px}',
      '.cbd-meterLegend{display:flex;justify-content:space-between;font-size:11px;color:#64748b;margin-top:10px}',

      /* Factors */
      '.cbd-factors{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}',
      '@media (max-width:700px){.cbd-factors{grid-template-columns:1fr}}',
      '.cbd-factor{border-radius:12px;padding:12px;border:1px solid #1f2a44;background:#0b1220}',
      '.cbd-factorHead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px}',
      '.cbd-factorName{font-weight:800;color:#e2e8f0;font-size:13px}',
      '.cbd-pill{font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.8px;padding:3px 8px;border-radius:999px;border:1px solid transparent}',
      '.cbd-pill.ok{background:rgba(34,197,94,.12);color:#86efac;border-color:rgba(34,197,94,.25)}',
      '.cbd-pill.warning{background:rgba(245,158,11,.12);color:#fcd34d;border-color:rgba(245,158,11,.25)}',
      '.cbd-pill.danger{background:rgba(239,68,68,.12);color:#fca5a5;border-color:rgba(239,68,68,.25)}',
      '.cbd-factorDetail{font-size:12px;color:#94a3b8;line-height:1.45}',
      '.cbd-factorSug{margin-top:6px;font-size:12px;color:#cbd5e1;line-height:1.45}',

      /* Action plan */
      '.cbd-checklist{display:flex;flex-direction:column;gap:10px;margin-top:8px}',
      '.cbd-check{display:flex;align-items:flex-start;gap:10px;padding:10px;border-radius:10px;border:1px solid #1f2a44;background:#0b1220}',
      '.cbd-check input{margin-top:2px;accent-color:#6366f1}',
      '.cbd-check label{font-size:13px;color:#e2e8f0;line-height:1.45;cursor:pointer}',

      /* Sustainable */
      '.cbd-susGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}',
      '@media (max-width:700px){.cbd-susGrid{grid-template-columns:1fr}}',
      '.cbd-mini{background:#0b1220;border:1px solid #1f2a44;border-radius:12px;padding:12px}',
      '.cbd-miniLabel{font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.8px;font-weight:800}',
      '.cbd-miniVal{font-size:18px;color:#f8fafc;font-weight:900;margin-top:4px}',
      '.cbd-miniSub{font-size:12px;color:#64748b;margin-top:2px}',

      '.cbd-empty{padding:26px;text-align:center;color:#94a3b8}',
      '.cbd-empty strong{color:#e2e8f0}',
    ].join('\n');
    document.head.appendChild(s);
  }

  function riskColor(risk) {
    return {
      low: '#22c55e',
      moderate: '#f59e0b',
      high: '#ef4444',
      critical: '#ef4444'
    }[risk] || '#94a3b8';
  }

  function riskLabel(risk) {
    return {
      low: 'Low',
      moderate: 'Moderate',
      high: 'High',
      critical: 'Critical'
    }[risk] || '—';
  }

  function renderBurnoutDetector(profileData, container) {
    injectStyles();
    var el = (typeof container === 'string') ? document.querySelector(container) : container;
    if (!el) {
      console.error('[CortexBurnoutDetector] Container not found:', container);
      return;
    }

    var p = profileData || {};
    var hasAny = (toNum(p.totalHours, 0) > 0) || (Array.isArray(p.workHistory) && p.workHistory.length > 0) || p.memberSince;

    if (!hasAny) {
      el.innerHTML = '<div class="cbd-root"><div class="cbd-empty">' +
        '<div style="font-size:22px;margin-bottom:6px">🔥</div>' +
        '<div><strong>Burnout Risk Assessment</strong></div>' +
        '<div style="margin-top:6px">Add at least <strong>memberSince</strong>, <strong>totalHours</strong>, or <strong>workHistory</strong> to generate your risk score.</div>' +
      '</div></div>';
      return;
    }

    var a = assessBurnout(profileData);
    var deg = (-90 + (a.riskScore / 100) * 180).toFixed(1) + 'deg';

    var badgeStyle = 'border-color:' + riskColor(a.burnoutRisk) + ';color:' + riskColor(a.burnoutRisk) + ';';

    var factorsHtml = a.factors.map(function (f) {
      return '<div class="cbd-factor">' +
        '<div class="cbd-factorHead">' +
          '<div class="cbd-factorName">' + safeText(f.name) + '</div>' +
          '<div class="cbd-pill ' + safeText(f.status) + '">' + safeText(f.status) + '</div>' +
        '</div>' +
        '<div class="cbd-factorDetail">' + safeText(f.detail) + '</div>' +
        '<div class="cbd-factorSug"><strong>Suggestion:</strong> ' + safeText(f.suggestion) + '</div>' +
      '</div>';
    }).join('');

    var sw = a.sustainableWorkload || {};
    var suggestedRateStr = (sw.suggestedRate != null) ? (fmtMoney(sw.suggestedRate) + '/hr') : '—';

    var checklist = (a.recommendations || []).map(function (r, i) {
      var id = 'cbd-check-' + i + '-' + Math.random().toString(16).slice(2);
      return '<div class="cbd-check">' +
        '<input type="checkbox" id="' + id + '">' +
        '<label for="' + id + '">' + safeText(r) + '</label>' +
      '</div>';
    }).join('');

    el.innerHTML = '' +
      '<div class="cbd-root">' +
        '<div class="cbd-header">' +
          '<div>' +
            '<h2 class="cbd-title">🔥 Burnout Risk Assessment</h2>' +
            '<div class="cbd-sub">A quick, client-side check based on workload, concurrency, breaks, and trends.</div>' +
          '</div>' +
          '<div class="cbd-badge" style="' + badgeStyle + '">' +
            '<span>' + safeText(riskLabel(a.burnoutRisk)) + ' risk</span>' +
            '<span style="opacity:.85">·</span>' +
            '<span>' + a.riskScore + '/100</span>' +
          '</div>' +
        '</div>' +

        '<div class="cbd-grid">' +
          '<div class="cbd-card">' +
            '<div class="cbd-card-title">Risk meter</div>' +
            '<div class="cbd-gaugeWrap">' +
              '<div class="cbd-gauge">' +
                '<div class="cbd-needle" style="--deg:' + deg + '"></div>' +
                '<div class="cbd-needleDot"></div>' +
              '</div>' +
            '</div>' +
            '<div class="cbd-gaugeMeta">' +
              '<div class="cbd-score">' + a.riskScore + '</div>' +
              '<div class="cbd-scoreSub">' + safeText(riskLabel(a.burnoutRisk)) + ' burnout risk</div>' +
              '<div class="cbd-meterLegend"><span>0</span><span>50</span><span>100</span></div>' +
            '</div>' +
          '</div>' +

          '<div class="cbd-card">' +
            '<div class="cbd-card-title">Factor breakdown</div>' +
            '<div class="cbd-factors">' + factorsHtml + '</div>' +
          '</div>' +
        '</div>' +

        '<div style="height:14px"></div>' +

        '<div class="cbd-grid">' +
          '<div class="cbd-card">' +
            '<div class="cbd-card-title">Sustainable workload</div>' +
            '<div class="cbd-susGrid">' +
              '<div class="cbd-mini">' +
                '<div class="cbd-miniLabel">Hours / week</div>' +
                '<div class="cbd-miniVal">' + safeText(sw.hoursPerWeek) + '</div>' +
                '<div class="cbd-miniSub">Target cap (next 4 weeks)</div>' +
              '</div>' +
              '<div class="cbd-mini">' +
                '<div class="cbd-miniLabel">Projects / month</div>' +
                '<div class="cbd-miniVal">' + safeText(sw.projectsPerMonth) + '</div>' +
                '<div class="cbd-miniSub">Fewer handoffs, less context switching</div>' +
              '</div>' +
              '<div class="cbd-mini">' +
                '<div class="cbd-miniLabel">Suggested rate</div>' +
                '<div class="cbd-miniVal">' + safeText(suggestedRateStr) + '</div>' +
                '<div class="cbd-miniSub">Maintain income with less volume</div>' +
              '</div>' +
            '</div>' +
          '</div>' +

          '<div class="cbd-card">' +
            '<div class="cbd-card-title">Action plan</div>' +
            '<div class="cbd-checklist">' + checklist + '</div>' +
          '</div>' +
        '</div>' +

      '</div>';
  }

  // ── Public API ──────────────────────────────────────────────────────

  window.CortexBurnoutDetector = {
    assessBurnout: assessBurnout,
    renderBurnoutDetector: renderBurnoutDetector,
  };

})();
