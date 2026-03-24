/**
 * [CF-074] Response Time Optimizer
 * Tracks best response times, suggests optimal hours to check for new jobs
 * based on hiring patterns and historical data.
 * Exposed as window.CortexFreelancer.ResponseTimeOptimizer
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var STORAGE_KEY = 'cortex_response_time_data';

  /* ══════════════════════════════════════════════
   * HIRING PATTERN DATA (typical freelance platforms)
   * ══════════════════════════════════════════════ */
  var HIRING_PATTERNS = {
    // Hour-of-day activity index (0-23, UTC). 1.0 = average, >1 = above.
    hourlyActivity: [
      0.3, 0.2, 0.15, 0.1, 0.1, 0.15, // 00-05: very low
      0.4, 0.7, 1.1, 1.5, 1.6, 1.5,    // 06-11: morning ramp
      1.3, 1.4, 1.6, 1.7, 1.5, 1.3,    // 12-17: afternoon peak
      1.1, 0.9, 0.7, 0.6, 0.5, 0.4,    // 18-23: evening decline
    ],
    // Day-of-week multiplier (0=Sun, 6=Sat)
    dailyActivity: [0.4, 1.3, 1.4, 1.3, 1.2, 1.0, 0.4],
    // Response time impact on hire probability (minutes → probability multiplier)
    responseImpact: [
      { within: 5, multiplier: 2.5, label: 'Lightning fast' },
      { within: 15, multiplier: 2.0, label: 'Very responsive' },
      { within: 30, multiplier: 1.7, label: 'Quick' },
      { within: 60, multiplier: 1.3, label: 'Good' },
      { within: 120, multiplier: 1.0, label: 'Average' },
      { within: 360, multiplier: 0.7, label: 'Slow' },
      { within: 1440, multiplier: 0.4, label: 'Very slow' },
      { within: Infinity, multiplier: 0.2, label: 'Too late' },
    ],
    // Category-specific peak hours (UTC)
    categoryPeaks: {
      'Web Development': { peakHours: [9, 10, 14, 15, 16], timezone: 'US business hours' },
      'Mobile Development': { peakHours: [9, 10, 14, 15, 16], timezone: 'US business hours' },
      'UI/UX Design': { peakHours: [10, 11, 14, 15], timezone: 'US/EU overlap' },
      'Data Science': { peakHours: [9, 10, 11, 14, 15], timezone: 'US business hours' },
      'Copywriting': { peakHours: [8, 9, 10, 13, 14], timezone: 'Early US/EU' },
      'Marketing': { peakHours: [9, 10, 11, 14, 15], timezone: 'US business hours' },
      'Virtual Assistant': { peakHours: [7, 8, 9, 13, 14], timezone: 'Early morning' },
      'Translation': { peakHours: [8, 9, 10, 11, 14, 15], timezone: 'EU business hours' },
    },
  };

  /* ══════════════════════════════════════════════
   * STORAGE HELPERS
   * ══════════════════════════════════════════════ */
  function loadData() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { responses: [], checks: [] };
    } catch (_) { return { responses: [], checks: [] }; }
  }

  function saveData(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (_) {}
  }

  /* ══════════════════════════════════════════════
   * TRACK RESPONSE
   * ══════════════════════════════════════════════ */
  function trackResponse(entry) {
    // entry: { jobPostedAt, respondedAt, category, hired, proposalQuality }
    var data = loadData();
    var posted = new Date(entry.jobPostedAt);
    var responded = new Date(entry.respondedAt);
    var responseMinutes = Math.max(0, (responded - posted) / 60000);

    data.responses.push({
      timestamp: responded.toISOString(),
      jobPostedAt: posted.toISOString(),
      responseMinutes: Math.round(responseMinutes),
      hourOfDay: responded.getHours(),
      dayOfWeek: responded.getDay(),
      category: entry.category || 'General',
      hired: !!entry.hired,
      proposalQuality: entry.proposalQuality || 'standard',
    });

    // Keep last 500 entries
    if (data.responses.length > 500) data.responses = data.responses.slice(-500);
    saveData(data);
    return data.responses[data.responses.length - 1];
  }

  /* ══════════════════════════════════════════════
   * TRACK CHECK-IN (when user checks for new jobs)
   * ══════════════════════════════════════════════ */
  function trackCheckIn() {
    var data = loadData();
    var now = new Date();
    data.checks.push({
      timestamp: now.toISOString(),
      hourOfDay: now.getHours(),
      dayOfWeek: now.getDay(),
    });
    if (data.checks.length > 200) data.checks = data.checks.slice(-200);
    saveData(data);
  }

  /* ══════════════════════════════════════════════
   * ANALYZE RESPONSE PATTERNS
   * ══════════════════════════════════════════════ */
  function analyzePatterns(category) {
    var data = loadData();
    var responses = data.responses;
    if (category) responses = responses.filter(function (r) { return r.category === category; });

    if (!responses.length) {
      return {
        hasData: false,
        avgResponseMinutes: 0,
        bestResponseMinutes: 0,
        hireRate: 0,
        totalResponses: 0,
        hourlyPerformance: [],
        dailyPerformance: [],
        speedTiers: [],
      };
    }

    // Average and best response times
    var times = responses.map(function (r) { return r.responseMinutes; });
    var avgTime = Math.round(times.reduce(function (s, t) { return s + t; }, 0) / times.length);
    var bestTime = Math.min.apply(null, times);

    // Hire rate
    var hired = responses.filter(function (r) { return r.hired; });
    var hireRate = Math.round((hired.length / responses.length) * 100);

    // Performance by hour
    var hourBuckets = [];
    for (var h = 0; h < 24; h++) {
      var hourResponses = responses.filter(function (r) { return r.hourOfDay === h; });
      var hourHired = hourResponses.filter(function (r) { return r.hired; });
      hourBuckets.push({
        hour: h,
        count: hourResponses.length,
        hireRate: hourResponses.length ? Math.round((hourHired.length / hourResponses.length) * 100) : 0,
        avgResponseMin: hourResponses.length ? Math.round(hourResponses.reduce(function (s, r) { return s + r.responseMinutes; }, 0) / hourResponses.length) : 0,
      });
    }

    // Performance by day
    var dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var dayBuckets = [];
    for (var d = 0; d < 7; d++) {
      var dayResponses = responses.filter(function (r) { return r.dayOfWeek === d; });
      var dayHired = dayResponses.filter(function (r) { return r.hired; });
      dayBuckets.push({
        day: d,
        dayName: dayNames[d],
        count: dayResponses.length,
        hireRate: dayResponses.length ? Math.round((dayHired.length / dayResponses.length) * 100) : 0,
      });
    }

    // Speed tier analysis
    var speedTiers = HIRING_PATTERNS.responseImpact.map(function (tier) {
      var inTier = responses.filter(function (r) { return r.responseMinutes <= tier.within && (tier === HIRING_PATTERNS.responseImpact[0] || r.responseMinutes > (HIRING_PATTERNS.responseImpact[HIRING_PATTERNS.responseImpact.indexOf(tier) - 1] || { within: 0 }).within); });
      var tierHired = inTier.filter(function (r) { return r.hired; });
      return {
        label: tier.label,
        withinMinutes: tier.within,
        count: inTier.length,
        hireRate: inTier.length ? Math.round((tierHired.length / inTier.length) * 100) : 0,
        expectedMultiplier: tier.multiplier,
      };
    }).filter(function (t) { return t.count > 0; });

    return {
      hasData: true,
      avgResponseMinutes: avgTime,
      bestResponseMinutes: bestTime,
      hireRate: hireRate,
      totalResponses: responses.length,
      hiredCount: hired.length,
      hourlyPerformance: hourBuckets,
      dailyPerformance: dayBuckets,
      speedTiers: speedTiers,
    };
  }

  /* ══════════════════════════════════════════════
   * GENERATE OPTIMAL SCHEDULE
   * ══════════════════════════════════════════════ */
  function generateSchedule(category, userTimezoneOffset) {
    // userTimezoneOffset in hours from UTC (e.g., +3 for Istanbul)
    var offset = userTimezoneOffset || 0;
    var catPeaks = HIRING_PATTERNS.categoryPeaks[category];
    var scores = [];

    for (var h = 0; h < 24; h++) {
      var utcHour = ((h - offset) % 24 + 24) % 24;
      var baseScore = HIRING_PATTERNS.hourlyActivity[utcHour] || 0.5;

      // Boost for category peaks
      if (catPeaks && catPeaks.peakHours.indexOf(utcHour) !== -1) {
        baseScore *= 1.3;
      }

      scores.push({ localHour: h, utcHour: utcHour, score: Math.round(baseScore * 100) / 100 });
    }

    // Sort by score descending
    var ranked = scores.slice().sort(function (a, b) { return b.score - a.score; });

    // Top check-in windows (cluster top hours into windows)
    var windows = [];
    var used = {};
    ranked.forEach(function (s) {
      if (windows.length >= 4) return;
      if (used[s.localHour] || used[s.localHour - 1] || used[s.localHour + 1]) return;
      used[s.localHour] = true;
      var endHour = (s.localHour + 1) % 24;
      windows.push({
        startHour: s.localHour,
        endHour: endHour,
        label: formatHour(s.localHour) + '–' + formatHour(endHour),
        score: s.score,
        priority: windows.length === 0 ? 'critical' : windows.length < 2 ? 'high' : 'medium',
      });
    });

    // Best days
    var bestDays = HIRING_PATTERNS.dailyActivity
      .map(function (mult, i) { return { day: i, dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i], multiplier: mult }; })
      .sort(function (a, b) { return b.multiplier - a.multiplier; })
      .slice(0, 3);

    return {
      checkInWindows: windows,
      bestDays: bestDays,
      hourlyScores: scores,
      category: category || 'General',
      timezoneOffset: offset,
      recommendations: [
        'Check for new jobs during your top windows — first 30 minutes after posting gets 2.5× more hires',
        windows.length > 0 ? 'Your #1 window is ' + windows[0].label + ' — set an alarm!' : '',
        'Weekdays (especially ' + bestDays[0].dayName + '-' + bestDays[1].dayName + ') have the most new postings',
        'Respond within 15 minutes to be in the top 10% of applicants',
        'Avoid bulk-applying late at night — quality drops and clients notice',
      ].filter(Boolean),
    };
  }

  function formatHour(h) {
    var ampm = h >= 12 ? 'PM' : 'AM';
    var hour12 = h % 12 || 12;
    return hour12 + ':00 ' + ampm;
  }

  /* ══════════════════════════════════════════════
   * RESPONSE SCORE (how good is a given response time)
   * ══════════════════════════════════════════════ */
  function scoreResponseTime(minutes) {
    for (var i = 0; i < HIRING_PATTERNS.responseImpact.length; i++) {
      var tier = HIRING_PATTERNS.responseImpact[i];
      if (minutes <= tier.within) {
        return {
          minutes: minutes,
          tier: tier.label,
          multiplier: tier.multiplier,
          percentile: Math.max(5, Math.round(100 - (minutes / 1440) * 100)),
          advice: minutes <= 5
            ? 'Incredible speed! You\'re in the top 1% of responders.'
            : minutes <= 15
              ? 'Excellent! Clients love quick responses like this.'
              : minutes <= 60
                ? 'Good timing. Try to shave a few more minutes for an edge.'
                : minutes <= 360
                  ? 'Average. Many competitors respond faster — aim for under 1 hour.'
                  : 'Too slow. By this time, top candidates are already shortlisted.',
        };
      }
    }
    return { minutes: minutes, tier: 'Too late', multiplier: 0.2, percentile: 1, advice: 'Job likely filled already.' };
  }

  /* ══════════════════════════════════════════════
   * RENDER UI
   * ══════════════════════════════════════════════ */
  function render(container, options) {
    if (!container) return;
    options = options || {};

    var category = options.category || 'Web Development';
    var tzOffset = options.timezoneOffset || -(new Date().getTimezoneOffset() / 60);
    var patterns = analyzePatterns(category);
    var schedule = generateSchedule(category, tzOffset);

    var html = '<div class="rto-root" style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#e0e0e0;max-width:720px;">';

    // Schedule Card
    html += '<div style="background:#12121f;border:1px solid #2d2d44;border-radius:12px;padding:20px;margin-bottom:16px;">';
    html += '<h3 style="margin:0 0 16px;color:#7c83ff;font-size:16px;">⏰ Optimal Check-In Schedule</h3>';

    // Windows
    html += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;">';
    schedule.checkInWindows.forEach(function (w, i) {
      var bg = i === 0 ? '#00d4aa' : i === 1 ? '#7c83ff' : '#3d3d5c';
      var fg = i < 2 ? '#0d0d1a' : '#e0e0e0';
      html += '<div style="background:' + bg + ';color:' + fg + ';border-radius:10px;padding:12px 16px;text-align:center;min-width:120px;">';
      html += '<div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;opacity:0.8;">' + (i === 0 ? '🔥 Best' : '#' + (i + 1)) + '</div>';
      html += '<div style="font-size:18px;font-weight:700;margin-top:4px;">' + w.label + '</div>';
      html += '<div style="font-size:11px;margin-top:2px;opacity:0.7;">Score: ' + w.score + '</div>';
      html += '</div>';
    });
    html += '</div>';

    // Best days
    html += '<div style="font-size:13px;color:#9ca3af;margin-bottom:12px;">📅 Best days: <strong style="color:#e0e0e0;">' + schedule.bestDays.map(function (d) { return d.dayName; }).join(', ') + '</strong></div>';

    // Hourly heatmap
    html += '<div style="margin-top:12px;">';
    html += '<div style="font-size:12px;color:#888;margin-bottom:6px;">24-Hour Activity Heatmap</div>';
    html += '<div style="display:flex;gap:2px;flex-wrap:wrap;">';
    schedule.hourlyScores.forEach(function (s) {
      var intensity = Math.min(255, Math.round(s.score * 150));
      var bg = 'rgb(' + Math.round(intensity * 0.3) + ',' + Math.round(intensity * 0.8) + ',' + Math.round(intensity * 0.65) + ')';
      html += '<div title="' + formatHour(s.localHour) + ' — Score: ' + s.score + '" style="width:28px;height:24px;background:' + bg + ';border-radius:3px;font-size:9px;display:flex;align-items:center;justify-content:center;color:' + (intensity > 100 ? '#0d0d1a' : '#888') + ';">' + s.localHour + '</div>';
    });
    html += '</div></div>';
    html += '</div>';

    // Your Performance Card (if data exists)
    if (patterns.hasData) {
      html += '<div style="background:#12121f;border:1px solid #2d2d44;border-radius:12px;padding:20px;margin-bottom:16px;">';
      html += '<h3 style="margin:0 0 16px;color:#7c83ff;font-size:16px;">📊 Your Response Performance</h3>';

      html += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;">';
      var stats = [
        { label: 'Avg Response', value: patterns.avgResponseMinutes + ' min', color: patterns.avgResponseMinutes <= 30 ? '#00d4aa' : patterns.avgResponseMinutes <= 60 ? '#fbbf24' : '#ef4444' },
        { label: 'Best Time', value: patterns.bestResponseMinutes + ' min', color: '#00d4aa' },
        { label: 'Hire Rate', value: patterns.hireRate + '%', color: patterns.hireRate >= 20 ? '#00d4aa' : '#fbbf24' },
        { label: 'Total Proposals', value: '' + patterns.totalResponses, color: '#7c83ff' },
      ];
      stats.forEach(function (s) {
        html += '<div style="flex:1;min-width:100px;background:#1a1a2e;border-radius:8px;padding:10px;text-align:center;">';
        html += '<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;">' + s.label + '</div>';
        html += '<div style="font-size:20px;font-weight:700;color:' + s.color + ';margin-top:4px;">' + s.value + '</div>';
        html += '</div>';
      });
      html += '</div>';

      // Speed tier breakdown
      if (patterns.speedTiers.length) {
        html += '<div style="font-size:12px;color:#888;margin-bottom:8px;">Response Speed → Hire Rate</div>';
        patterns.speedTiers.forEach(function (t) {
          var barWidth = Math.max(5, Math.min(100, t.hireRate * 2));
          html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">';
          html += '<span style="font-size:12px;min-width:100px;color:#9ca3af;">' + t.label + ' (' + t.count + ')</span>';
          html += '<div style="flex:1;height:8px;background:#1f2937;border-radius:4px;overflow:hidden;">';
          html += '<div style="width:' + barWidth + '%;height:100%;background:linear-gradient(90deg,#6366f1,#00d4aa);border-radius:4px;"></div>';
          html += '</div>';
          html += '<span style="font-size:12px;color:#e0e0e0;min-width:40px;text-align:right;">' + t.hireRate + '%</span>';
          html += '</div>';
        });
      }
      html += '</div>';
    }

    // Recommendations
    html += '<div style="background:#12121f;border:1px solid #2d2d44;border-radius:12px;padding:20px;margin-bottom:16px;">';
    html += '<h3 style="margin:0 0 12px;color:#7c83ff;font-size:16px;">💡 Recommendations</h3>';
    html += '<ul style="margin:0;padding-left:18px;">';
    schedule.recommendations.forEach(function (r) {
      html += '<li style="font-size:13px;color:#d1d5db;margin-bottom:8px;line-height:1.5;">' + esc(r) + '</li>';
    });
    html += '</ul></div>';

    html += '</div>';
    container.innerHTML = html;

    return { patterns: patterns, schedule: schedule };
  }

  function esc(str) {
    if (!str) return '';
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  /* ══════════════════════════════════════════════
   * PUBLIC API
   * ══════════════════════════════════════════════ */
  window.CortexFreelancer.ResponseTimeOptimizer = {
    trackResponse: trackResponse,
    trackCheckIn: trackCheckIn,
    analyzePatterns: analyzePatterns,
    generateSchedule: generateSchedule,
    scoreResponseTime: scoreResponseTime,
    render: render,
    hiringPatterns: HIRING_PATTERNS,
    version: '1.0.0',
  };

})();
