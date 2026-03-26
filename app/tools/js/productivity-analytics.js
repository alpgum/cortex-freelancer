/* ============================================
   CORTEX FREELANCER — Productivity Analytics Engine
   cf3-004 | productivity-analytics.js
   Peak hours, daily averages, project profitability,
   weekly trends, and actionable suggestions
   ============================================ */

;(function(global) {
  'use strict';

  // ── Helpers ────────────────────────────────────────────────
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function $(sel) { return document.querySelector(sel); }

  function formatHours(h) { return parseFloat(h || 0).toFixed(1); }
  function formatCurrency(amount, symbol) {
    symbol = symbol || '$';
    return symbol + parseFloat(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function getHourLabel(h) {
    if (h === 0) return '12am';
    if (h < 12) return h + 'am';
    if (h === 12) return '12pm';
    return (h - 12) + 'pm';
  }

  function getWeekNumber(dateStr) {
    var d = new Date(dateStr);
    var start = new Date(d.getFullYear(), 0, 1);
    var diff = d - start;
    return Math.ceil((diff / 86400000 + start.getDay() + 1) / 7);
  }

  // ── Data Access ────────────────────────────────────────────
  function getEntries() {
    if (typeof CortexTimeEngine !== 'undefined') {
      return CortexTimeEngine.getEntries();
    }
    return [];
  }

  function getRate() {
    if (typeof CortexTimeEngine !== 'undefined') {
      return CortexTimeEngine.getRate();
    }
    return 0;
  }

  function getSettings() {
    if (typeof CortexSettings !== 'undefined') {
      return {
        currencySymbol: CortexSettings.getCurrencySymbol(
          CortexSettings.get('rates.defaultCurrency') ||
          CortexSettings.get('user.currency') || 'USD'
        ),
        rate: CortexSettings.get('rates.defaultHourlyRate') || 0
      };
    }
    return { currencySymbol: '$', rate: 0 };
  }

  // ── Core Analytics ─────────────────────────────────────────

  /**
   * Analyze which hours of the day have the most tracked time.
   * Returns an array of 24 buckets (0-23) with total hours in each.
   */
  function analyzePeakHours() {
    var entries = getEntries();
    var buckets = new Array(24);
    for (var i = 0; i < 24; i++) buckets[i] = 0;

    entries.forEach(function(e) {
      if (!e.startTime || !e.hours) return;
      var startH = parseInt(e.startTime.split(':')[0], 10);
      var startM = parseInt(e.startTime.split(':')[1], 10) || 0;
      var remaining = e.hours;

      // Distribute hours across the clock starting from startTime
      var h = startH;
      // First partial hour
      var firstPartial = (60 - startM) / 60;
      var allocated = Math.min(remaining, firstPartial);
      buckets[h] += allocated;
      remaining -= allocated;
      h = (h + 1) % 24;

      // Full hours
      while (remaining > 0) {
        allocated = Math.min(remaining, 1);
        buckets[h] += allocated;
        remaining -= allocated;
        h = (h + 1) % 24;
      }
    });

    return buckets;
  }

  /**
   * Find the top N most productive hour ranges.
   */
  function getPeakProductiveRanges(topN) {
    topN = topN || 3;
    var buckets = analyzePeakHours();
    var ranges = [];

    // Find contiguous productive blocks (>0.5h total)
    var i = 0;
    while (i < 24) {
      if (buckets[i] > 0.5) {
        var start = i;
        var total = 0;
        while (i < 24 && buckets[i] > 0.3) {
          total += buckets[i];
          i++;
        }
        ranges.push({ startHour: start, endHour: i, totalHours: total });
      } else {
        i++;
      }
    }

    ranges.sort(function(a, b) { return b.totalHours - a.totalHours; });
    return ranges.slice(0, topN);
  }

  /**
   * Calculate average daily billable hours over the last N days.
   */
  function getAverageDailyHours(days) {
    days = days || 30;
    var entries = getEntries();
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    var cutoffStr = cutoff.toISOString().split('T')[0];

    var dayMap = {};
    var daysWithWork = 0;

    entries.forEach(function(e) {
      if (e.date < cutoffStr) return;
      if (!dayMap[e.date]) {
        dayMap[e.date] = { total: 0, billable: 0 };
        daysWithWork++;
      }
      dayMap[e.date].total += (e.hours || 0);
      if (e.billable !== false) {
        dayMap[e.date].billable += (e.hours || 0);
      }
    });

    var totalH = 0;
    var totalBillable = 0;
    var dailyHours = [];
    Object.keys(dayMap).sort().forEach(function(date) {
      totalH += dayMap[date].total;
      totalBillable += dayMap[date].billable;
      dailyHours.push({ date: date, hours: dayMap[date].total, billable: dayMap[date].billable });
    });

    return {
      avgTotal: daysWithWork > 0 ? totalH / daysWithWork : 0,
      avgBillable: daysWithWork > 0 ? totalBillable / daysWithWork : 0,
      daysWorked: daysWithWork,
      totalDays: days,
      dailyBreakdown: dailyHours
    };
  }

  /**
   * Compute project profitability — effective hourly rate per project.
   * Compares actual hours invested vs billable amount.
   */
  function getProjectProfitability() {
    var entries = getEntries();
    var rate = getRate();
    var projects = {};

    entries.forEach(function(e) {
      var proj = e.project || 'Untitled';
      if (!projects[proj]) {
        projects[proj] = {
          name: proj,
          client: e.client || '',
          totalHours: 0,
          billableHours: 0,
          entries: 0,
          firstDate: e.date,
          lastDate: e.date
        };
      }
      projects[proj].totalHours += (e.hours || 0);
      if (e.billable !== false) {
        projects[proj].billableHours += (e.hours || 0);
      }
      projects[proj].entries++;
      if (!e.client) { /* keep existing */ }
      else if (!projects[proj].client) projects[proj].client = e.client;
      if (e.date < projects[proj].firstDate) projects[proj].firstDate = e.date;
      if (e.date > projects[proj].lastDate) projects[proj].lastDate = e.date;
    });

    // Calculate effective rate and rank
    var result = Object.keys(projects).map(function(key) {
      var p = projects[key];
      p.billableAmount = p.billableHours * rate;
      p.effectiveRate = p.totalHours > 0 ? p.billableAmount / p.totalHours : 0;
      p.billableRatio = p.totalHours > 0 ? (p.billableHours / p.totalHours) * 100 : 0;
      return p;
    });

    result.sort(function(a, b) { return b.effectiveRate - a.effectiveRate; });
    return result;
  }

  /**
   * Weekly trends — hours per week for the last N weeks.
   */
  function getWeeklyTrends(weeks) {
    weeks = weeks || 8;
    var entries = getEntries();
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (weeks * 7));
    var cutoffStr = cutoff.toISOString().split('T')[0];

    var weekMap = {};

    entries.forEach(function(e) {
      if (e.date < cutoffStr) return;
      var d = new Date(e.date + 'T12:00:00');
      // Get Monday of that week
      var day = d.getDay();
      var monday = new Date(d);
      monday.setDate(d.getDate() - ((day + 6) % 7));
      var weekKey = monday.toISOString().split('T')[0];

      if (!weekMap[weekKey]) {
        weekMap[weekKey] = { weekStart: weekKey, totalHours: 0, billableHours: 0, days: {}, entries: 0 };
      }
      weekMap[weekKey].totalHours += (e.hours || 0);
      if (e.billable !== false) weekMap[weekKey].billableHours += (e.hours || 0);
      weekMap[weekKey].days[e.date] = true;
      weekMap[weekKey].entries++;
    });

    var result = Object.keys(weekMap).sort().map(function(key) {
      var w = weekMap[key];
      w.daysWorked = Object.keys(w.days).length;
      w.avgPerDay = w.daysWorked > 0 ? w.totalHours / w.daysWorked : 0;
      delete w.days;
      return w;
    });

    // Pad to requested weeks if needed
    return result.slice(-weeks);
  }

  /**
   * Generate actionable suggestions based on analytics data.
   */
  function generateSuggestions() {
    var suggestions = [];
    var entries = getEntries();
    if (entries.length < 3) {
      suggestions.push({
        type: 'info',
        icon: '📊',
        text: 'Track more time entries to unlock productivity insights.'
      });
      return suggestions;
    }

    var rate = getRate();
    var sym = getSettings().currencySymbol;

    // 1. Peak productive hours
    var peaks = getPeakProductiveRanges(1);
    if (peaks.length > 0) {
      var peak = peaks[0];
      suggestions.push({
        type: 'insight',
        icon: '⚡',
        text: 'You\'re most productive <strong>' + getHourLabel(peak.startHour) + '–' + getHourLabel(peak.endHour) + '</strong>. ' +
              'Try to protect this time block for deep work.'
      });
    }

    // 2. Project profitability comparison
    var projects = getProjectProfitability();
    if (projects.length >= 2 && rate > 0) {
      var best = projects[0];
      var worst = projects[projects.length - 1];
      if (best.effectiveRate > worst.effectiveRate * 1.2) {
        var diffPct = Math.round(((best.effectiveRate - worst.effectiveRate) / worst.effectiveRate) * 100);
        suggestions.push({
          type: 'warning',
          icon: '💡',
          text: '<strong>' + esc(worst.name) + '</strong> has ' + diffPct + '% lower effective rate than <strong>' + esc(best.name) + '</strong>. ' +
                'Consider adjusting scope or rates.'
        });
      }
    }

    // 3. Average daily hours
    var dailyAvg = getAverageDailyHours(30);
    if (dailyAvg.daysWorked >= 5) {
      if (dailyAvg.avgBillable < 4) {
        suggestions.push({
          type: 'warning',
          icon: '📉',
          text: 'Average billable hours: <strong>' + formatHours(dailyAvg.avgBillable) + 'h/day</strong>. ' +
                'Aim for 5-6h of focused billable work.'
        });
      } else if (dailyAvg.avgBillable >= 7) {
        suggestions.push({
          type: 'insight',
          icon: '🔥',
          text: 'Averaging <strong>' + formatHours(dailyAvg.avgBillable) + 'h/day</strong> billable — strong output! Watch for burnout.'
        });
      } else {
        suggestions.push({
          type: 'success',
          icon: '✓',
          text: 'Solid pace at <strong>' + formatHours(dailyAvg.avgBillable) + 'h/day</strong> billable (30-day avg).'
        });
      }
    }

    // 4. Weekly trend direction
    var trends = getWeeklyTrends(4);
    if (trends.length >= 3) {
      var recent = trends[trends.length - 1];
      var prev = trends[trends.length - 2];
      if (recent.totalHours > prev.totalHours * 1.15) {
        suggestions.push({
          type: 'success',
          icon: '📈',
          text: 'Hours are trending up — <strong>' + formatHours(recent.totalHours) + 'h</strong> this week vs ' + formatHours(prev.totalHours) + 'h last week.'
        });
      } else if (recent.totalHours < prev.totalHours * 0.85) {
        suggestions.push({
          type: 'warning',
          icon: '📉',
          text: 'Hours dropped to <strong>' + formatHours(recent.totalHours) + 'h</strong> from ' + formatHours(prev.totalHours) + 'h last week.'
        });
      }
    }

    // 5. Non-billable ratio
    if (dailyAvg.daysWorked >= 5 && dailyAvg.avgTotal > 0) {
      var nonBillableRatio = ((dailyAvg.avgTotal - dailyAvg.avgBillable) / dailyAvg.avgTotal) * 100;
      if (nonBillableRatio > 30) {
        suggestions.push({
          type: 'warning',
          icon: '⏳',
          text: '<strong>' + Math.round(nonBillableRatio) + '%</strong> of your time is non-billable. Review admin tasks for efficiency gains.'
        });
      }
    }

    return suggestions;
  }

  // ── Dashboard Widget Renderer ──────────────────────────────

  function renderProductivityWidget() {
    var container = $('#productivity-analytics');
    if (!container) return;

    var entries = getEntries();
    if (entries.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><p>Track time to see productivity analytics</p></div>';
      return;
    }

    var rate = getRate();
    var sym = getSettings().currencySymbol;
    var html = '';

    // -- Peak Hours Heatmap --
    var buckets = analyzePeakHours();
    var maxBucket = Math.max.apply(null, buckets);
    if (maxBucket > 0) {
      html += '<div class="pa-section">';
      html += '<h3 class="pa-section-title">Peak Productive Hours</h3>';
      html += '<div class="pa-heatmap">';
      for (var h = 6; h <= 22; h++) {
        var intensity = maxBucket > 0 ? buckets[h] / maxBucket : 0;
        var cls = intensity > 0.7 ? 'high' : intensity > 0.3 ? 'mid' : intensity > 0 ? 'low' : 'none';
        html += '<div class="pa-heat-cell ' + cls + '" title="' + getHourLabel(h) + ': ' + formatHours(buckets[h]) + 'h">';
        html += '<span class="pa-heat-label">' + getHourLabel(h) + '</span>';
        html += '</div>';
      }
      html += '</div>';
      html += '</div>';
    }

    // -- Daily Average Metrics --
    var daily = getAverageDailyHours(30);
    if (daily.daysWorked > 0) {
      html += '<div class="pa-section">';
      html += '<h3 class="pa-section-title">30-Day Averages</h3>';
      html += '<div class="pa-metrics">';
      html += '<div class="pa-metric"><div class="pa-metric-val">' + formatHours(daily.avgBillable) + 'h</div><div class="pa-metric-label">Avg Billable/Day</div></div>';
      html += '<div class="pa-metric"><div class="pa-metric-val">' + formatHours(daily.avgTotal) + 'h</div><div class="pa-metric-label">Avg Total/Day</div></div>';
      html += '<div class="pa-metric"><div class="pa-metric-val">' + daily.daysWorked + '</div><div class="pa-metric-label">Days Worked</div></div>';
      if (rate > 0) {
        html += '<div class="pa-metric"><div class="pa-metric-val">' + formatCurrency(daily.avgBillable * rate, sym) + '</div><div class="pa-metric-label">Avg Daily Earnings</div></div>';
      }
      html += '</div>';
      html += '</div>';
    }

    // -- Weekly Trends Chart --
    var trends = getWeeklyTrends(8);
    if (trends.length > 1) {
      var maxW = Math.max.apply(null, trends.map(function(w) { return w.totalHours; }).concat([1]));
      html += '<div class="pa-section">';
      html += '<h3 class="pa-section-title">Weekly Trends</h3>';
      html += '<div class="pa-weekly-chart">';
      trends.forEach(function(w) {
        var pct = Math.max((w.totalHours / maxW) * 100, 3);
        var weekLabel = new Date(w.weekStart + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        html += '<div class="pa-week-col">';
        html += '<span class="pa-week-val">' + formatHours(w.totalHours) + '</span>';
        html += '<div class="pa-week-bar" style="height:' + pct + '%"></div>';
        html += '<span class="pa-week-label">' + weekLabel + '</span>';
        html += '</div>';
      });
      html += '</div>';
      html += '</div>';
    }

    // -- Project Profitability --
    var projects = getProjectProfitability();
    if (projects.length > 0 && rate > 0) {
      html += '<div class="pa-section">';
      html += '<h3 class="pa-section-title">Project Profitability</h3>';
      html += '<div class="pa-project-list">';
      projects.slice(0, 6).forEach(function(p) {
        var rateClass = p.effectiveRate >= rate ? 'good' : p.effectiveRate >= rate * 0.7 ? 'ok' : 'low';
        html += '<div class="pa-project-row">';
        html += '<div class="pa-project-info">';
        html += '<span class="pa-project-name">' + esc(p.name) + '</span>';
        if (p.client) html += '<span class="pa-project-client">' + esc(p.client) + '</span>';
        html += '</div>';
        html += '<div class="pa-project-stats">';
        html += '<span class="pa-project-hours">' + formatHours(p.totalHours) + 'h</span>';
        html += '<span class="pa-project-rate ' + rateClass + '">' + formatCurrency(p.effectiveRate, sym) + '/h</span>';
        html += '</div>';
        html += '</div>';
      });
      html += '</div>';
      html += '</div>';
    }

    // -- Suggestions --
    var suggestions = generateSuggestions();
    if (suggestions.length > 0) {
      html += '<div class="pa-section">';
      html += '<h3 class="pa-section-title">Insights</h3>';
      html += '<div class="pa-suggestions">';
      suggestions.forEach(function(s) {
        html += '<div class="pa-suggestion ' + s.type + '">';
        html += '<span class="pa-suggestion-icon">' + s.icon + '</span>';
        html += '<span class="pa-suggestion-text">' + s.text + '</span>';
        html += '</div>';
      });
      html += '</div>';
      html += '</div>';
    }

    container.innerHTML = html;
  }

  // ── Public API ─────────────────────────────────────────────
  var ProductivityAnalytics = {
    // Core analysis
    analyzePeakHours: analyzePeakHours,
    getPeakProductiveRanges: getPeakProductiveRanges,
    getAverageDailyHours: getAverageDailyHours,
    getProjectProfitability: getProjectProfitability,
    getWeeklyTrends: getWeeklyTrends,
    generateSuggestions: generateSuggestions,

    // Rendering
    renderProductivityWidget: renderProductivityWidget
  };

  global.ProductivityAnalytics = ProductivityAnalytics;

})(typeof window !== 'undefined' ? window : globalThis);
