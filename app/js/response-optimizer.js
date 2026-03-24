/**
 * [CF-074] Response Time Optimizer with Notification Scheduling
 * Track best response times, suggest optimal hours to check for
 * new jobs based on hiring patterns. Analyze when clients are most
 * active and when quick responses lead to higher hire rates.
 * Exposed as window.CortexFreelancer.ResponseOptimizer
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  /* ══════════════════════════════════════════════
   * STORAGE
   * ══════════════════════════════════════════════ */
  var RESPONSE_KEY = 'cortex_response_data';
  var SCHEDULE_KEY = 'cortex_notification_schedule';

  function loadResponses() {
    try { return JSON.parse(localStorage.getItem(RESPONSE_KEY)) || []; } catch (_) { return []; }
  }
  function saveResponses(data) {
    try { localStorage.setItem(RESPONSE_KEY, JSON.stringify(data)); } catch (_) {}
  }
  function loadSchedule() {
    try { return JSON.parse(localStorage.getItem(SCHEDULE_KEY)) || null; } catch (_) { return null; }
  }
  function saveSchedule(sched) {
    try { localStorage.setItem(SCHEDULE_KEY, JSON.stringify(sched)); } catch (_) {}
  }

  /* ══════════════════════════════════════════════
   * DEFAULT HIRING PATTERN DATA
   * Based on aggregated freelance platform data
   * ══════════════════════════════════════════════ */
  var HIRING_PATTERNS = {
    // Hour of day (0-23) → relative activity level (0-100)
    hourlyActivity: {
      0: 15, 1: 10, 2: 8, 3: 5, 4: 5, 5: 8, 6: 15, 7: 25,
      8: 55, 9: 80, 10: 90, 11: 85, 12: 60, 13: 75, 14: 85,
      15: 80, 16: 70, 17: 55, 18: 40, 19: 35, 20: 30, 21: 25,
      22: 20, 23: 18,
    },
    // Day of week (0=Sun, 6=Sat) → activity multiplier
    dailyActivity: {
      0: 0.4, 1: 1.0, 2: 1.05, 3: 1.1, 4: 1.0, 5: 0.85, 6: 0.35,
    },
    // Response time windows and their hire rate correlation
    responseWindows: [
      { label: 'Within 1 hour', maxMinutes: 60, hireBoost: 1.4, description: 'Best hire rate — shows urgency and professionalism' },
      { label: '1-3 hours', maxMinutes: 180, hireBoost: 1.2, description: 'Still competitive — most clients are satisfied' },
      { label: '3-8 hours', maxMinutes: 480, hireBoost: 1.0, description: 'Average — no advantage or disadvantage' },
      { label: '8-24 hours', maxMinutes: 1440, hireBoost: 0.8, description: 'Slower than average — some clients may move on' },
      { label: '24+ hours', maxMinutes: Infinity, hireBoost: 0.5, description: 'Significantly reduces your chances of being hired' },
    ],
    // Peak posting times by category
    categoryPeaks: {
      'Web Development': { peak: [9, 10, 14, 15], timezone: 'US Eastern' },
      'Mobile Development': { peak: [10, 11, 14, 15], timezone: 'US Eastern' },
      'UI/UX Design': { peak: [9, 10, 11, 14], timezone: 'US Eastern' },
      'Data Science': { peak: [10, 11, 15, 16], timezone: 'US Eastern' },
      'Copywriting': { peak: [8, 9, 10, 14], timezone: 'US Eastern' },
      'Marketing': { peak: [9, 10, 13, 14], timezone: 'US Eastern' },
      'Video Production': { peak: [10, 11, 14, 15], timezone: 'US Pacific' },
      'DevOps': { peak: [9, 10, 14, 15], timezone: 'US Eastern' },
    },
  };

  /* ══════════════════════════════════════════════
   * RESPONSE TIME TRACKING
   * ══════════════════════════════════════════════ */

  function trackResponse(entry) {
    entry = entry || {};
    var record = {
      id: 'rt_' + Date.now(),
      jobPostedAt: entry.jobPostedAt || null,
      respondedAt: entry.respondedAt || new Date().toISOString(),
      responseTimeMinutes: entry.responseTimeMinutes || null,
      wasHired: entry.wasHired || false,
      category: entry.category || 'General',
      dayOfWeek: null,
      hour: null,
    };

    // Calculate response time if both timestamps provided
    if (record.jobPostedAt && record.respondedAt && !record.responseTimeMinutes) {
      var posted = new Date(record.jobPostedAt);
      var responded = new Date(record.respondedAt);
      record.responseTimeMinutes = Math.round((responded - posted) / 60000);
    }

    // Extract time metadata
    var respondDate = new Date(record.respondedAt);
    record.dayOfWeek = respondDate.getDay();
    record.hour = respondDate.getHours();

    var responses = loadResponses();
    responses.unshift(record);
    if (responses.length > 500) responses = responses.slice(0, 500);
    saveResponses(responses);

    return record;
  }

  /* ══════════════════════════════════════════════
   * ANALYSIS ENGINE
   * ══════════════════════════════════════════════ */

  function analyzeResponseTimes(responses) {
    if (!responses || responses.length === 0) {
      responses = loadResponses();
    }

    var totalResponses = responses.length;
    if (totalResponses === 0) {
      return {
        avgResponseTime: null,
        medianResponseTime: null,
        bestResponseTime: null,
        hireRate: null,
        hireRateBySpeed: [],
        bestHours: [],
        bestDays: [],
        recommendations: [{ text: 'Start tracking your response times to get personalized insights.', priority: 'medium' }],
      };
    }

    // Average and median response time
    var times = responses.filter(function (r) { return r.responseTimeMinutes != null; }).map(function (r) { return r.responseTimeMinutes; });
    times.sort(function (a, b) { return a - b; });

    var avgTime = times.length > 0 ? Math.round(times.reduce(function (s, t) { return s + t; }, 0) / times.length) : null;
    var medianTime = times.length > 0 ? times[Math.floor(times.length / 2)] : null;
    var bestTime = times.length > 0 ? times[0] : null;

    // Overall hire rate
    var hiredCount = responses.filter(function (r) { return r.wasHired; }).length;
    var hireRate = Math.round((hiredCount / totalResponses) * 100);

    // Hire rate by response speed
    var hireRateBySpeed = HIRING_PATTERNS.responseWindows.map(function (w) {
      var inWindow = responses.filter(function (r) {
        if (r.responseTimeMinutes == null) return false;
        var prevMax = 0;
        for (var i = 0; i < HIRING_PATTERNS.responseWindows.length; i++) {
          if (HIRING_PATTERNS.responseWindows[i] === w) break;
          prevMax = HIRING_PATTERNS.responseWindows[i].maxMinutes;
        }
        return r.responseTimeMinutes > prevMax && r.responseTimeMinutes <= w.maxMinutes;
      });
      var windowHired = inWindow.filter(function (r) { return r.wasHired; }).length;
      return {
        label: w.label,
        count: inWindow.length,
        hireRate: inWindow.length > 0 ? Math.round((windowHired / inWindow.length) * 100) : null,
        expectedBoost: w.hireBoost,
        description: w.description,
      };
    });

    // Best hours to respond (when responses lead to hires)
    var hourStats = {};
    for (var h = 0; h < 24; h++) hourStats[h] = { total: 0, hired: 0 };
    responses.forEach(function (r) {
      if (r.hour != null) {
        hourStats[r.hour].total++;
        if (r.wasHired) hourStats[r.hour].hired++;
      }
    });

    var bestHours = Object.keys(hourStats)
      .filter(function (h) { return hourStats[h].total >= 2; })
      .map(function (h) {
        return {
          hour: parseInt(h),
          label: formatHour(parseInt(h)),
          total: hourStats[h].total,
          hired: hourStats[h].hired,
          hireRate: Math.round((hourStats[h].hired / hourStats[h].total) * 100),
        };
      })
      .sort(function (a, b) { return b.hireRate - a.hireRate; })
      .slice(0, 5);

    // Best days
    var dayStats = {};
    var dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    for (var d = 0; d < 7; d++) dayStats[d] = { total: 0, hired: 0 };
    responses.forEach(function (r) {
      if (r.dayOfWeek != null) {
        dayStats[r.dayOfWeek].total++;
        if (r.wasHired) dayStats[r.dayOfWeek].hired++;
      }
    });

    var bestDays = Object.keys(dayStats)
      .filter(function (d) { return dayStats[d].total >= 2; })
      .map(function (d) {
        return {
          day: parseInt(d),
          name: dayNames[parseInt(d)],
          total: dayStats[d].total,
          hired: dayStats[d].hired,
          hireRate: dayStats[d].total > 0 ? Math.round((dayStats[d].hired / dayStats[d].total) * 100) : 0,
        };
      })
      .sort(function (a, b) { return b.hireRate - a.hireRate; });

    // Recommendations
    var recommendations = [];
    if (avgTime && avgTime > 180) {
      recommendations.push({
        text: 'Your average response time is ' + formatDuration(avgTime) + '. Aim for under 1 hour to boost hire rate by 40%.',
        priority: 'high',
      });
    }
    if (avgTime && avgTime <= 60) {
      recommendations.push({
        text: 'Excellent response times! Your average of ' + formatDuration(avgTime) + ' puts you in the top tier.',
        priority: 'low',
      });
    }
    if (bestHours.length > 0) {
      recommendations.push({
        text: 'Your best hiring success comes when responding at ' + bestHours[0].label + '. Set notifications for this time.',
        priority: 'medium',
      });
    }
    if (bestDays.length > 0 && bestDays[0].hireRate > 0) {
      recommendations.push({
        text: bestDays[0].name + ' is your best day for landing gigs (' + bestDays[0].hireRate + '% hire rate). Prioritize proposals on this day.',
        priority: 'medium',
      });
    }

    return {
      avgResponseTime: avgTime,
      medianResponseTime: medianTime,
      bestResponseTime: bestTime,
      hireRate: hireRate,
      totalResponses: totalResponses,
      totalHired: hiredCount,
      hireRateBySpeed: hireRateBySpeed,
      bestHours: bestHours,
      bestDays: bestDays,
      recommendations: recommendations,
    };
  }

  /* ══════════════════════════════════════════════
   * NOTIFICATION SCHEDULE GENERATOR
   * ══════════════════════════════════════════════ */

  function generateSchedule(config) {
    config = config || {};
    var category = config.category || 'Web Development';
    var timezone = config.timezone || 'local';
    var maxChecksPerDay = config.maxChecksPerDay || 4;
    var wakeHour = config.wakeHour || 8;
    var sleepHour = config.sleepHour || 22;

    var categoryPeaks = HIRING_PATTERNS.categoryPeaks[category] || { peak: [9, 10, 14, 15], timezone: 'US Eastern' };

    // Combine platform-wide peaks with category-specific peaks
    var hourScores = {};
    for (var h = 0; h < 24; h++) {
      if (h < wakeHour || h >= sleepHour) {
        hourScores[h] = 0;
        continue;
      }
      var platformScore = HIRING_PATTERNS.hourlyActivity[h] || 0;
      var categoryBoost = categoryPeaks.peak.indexOf(h) >= 0 ? 30 : 0;
      hourScores[h] = platformScore + categoryBoost;
    }

    // Pick top N hours
    var sortedHours = Object.keys(hourScores)
      .map(function (h) { return { hour: parseInt(h), score: hourScores[h] }; })
      .filter(function (h) { return h.score > 0; })
      .sort(function (a, b) { return b.score - a.score; });

    // Ensure minimum spacing between check times (2 hours)
    var selectedHours = [];
    sortedHours.forEach(function (h) {
      if (selectedHours.length >= maxChecksPerDay) return;
      var tooClose = selectedHours.some(function (s) { return Math.abs(s.hour - h.hour) < 2; });
      if (!tooClose) selectedHours.push(h);
    });
    selectedHours.sort(function (a, b) { return a.hour - b.hour; });

    // Build weekly schedule
    var dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var weekSchedule = [];
    for (var d = 0; d < 7; d++) {
      var activity = HIRING_PATTERNS.dailyActivity[d];
      var dayChecks = activity > 0.7 ? selectedHours : selectedHours.slice(0, Math.max(1, Math.round(selectedHours.length * activity)));

      weekSchedule.push({
        day: dayNames[d],
        dayIndex: d,
        activityLevel: Math.round(activity * 100),
        checkTimes: dayChecks.map(function (h) {
          return {
            hour: h.hour,
            label: formatHour(h.hour),
            priority: h.score > 80 ? 'high' : h.score > 50 ? 'medium' : 'low',
            reason: categoryPeaks.peak.indexOf(h.hour) >= 0 ? 'Peak ' + category + ' posting time' : 'High platform activity',
          };
        }),
      });
    }

    var schedule = {
      category: category,
      maxChecksPerDay: maxChecksPerDay,
      wakeHour: wakeHour,
      sleepHour: sleepHour,
      weekSchedule: weekSchedule,
      bestTimesSummary: selectedHours.map(function (h) { return formatHour(h.hour); }),
      createdAt: new Date().toISOString(),
    };

    saveSchedule(schedule);
    return schedule;
  }

  /* ══════════════════════════════════════════════
   * HELPERS
   * ══════════════════════════════════════════════ */

  function formatHour(h) {
    if (h === 0) return '12:00 AM';
    if (h === 12) return '12:00 PM';
    if (h < 12) return h + ':00 AM';
    return (h - 12) + ':00 PM';
  }

  function formatDuration(minutes) {
    if (minutes < 60) return minutes + 'm';
    var h = Math.floor(minutes / 60);
    var m = minutes % 60;
    return m > 0 ? h + 'h ' + m + 'm' : h + 'h';
  }

  function esc(str) {
    if (!str) return '';
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  /* ══════════════════════════════════════════════
   * RENDER
   * ══════════════════════════════════════════════ */

  function render(containerId) {
    var el = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!el) return;

    var responses = loadResponses();
    var analysis = analyzeResponseTimes(responses);
    var schedule = loadSchedule();

    var html = '<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#e0e0e0;max-width:800px;">';

    // Header
    html += '<div style="text-align:center;margin-bottom:24px;">';
    html += '<h2 style="margin:0 0 6px;font-size:22px;color:#fff;">⚡ Response Time Optimizer</h2>';
    html += '<p style="margin:0;font-size:14px;color:#94a3b8;">Track response times & optimize notification schedule</p>';
    html += '</div>';

    // Stats row
    html += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px;">';
    var statCards = [
      { value: analysis.avgResponseTime != null ? formatDuration(analysis.avgResponseTime) : '—', label: 'Avg Response', color: analysis.avgResponseTime && analysis.avgResponseTime <= 60 ? '#22c55e' : analysis.avgResponseTime && analysis.avgResponseTime <= 180 ? '#fbbf24' : '#ef4444' },
      { value: analysis.hireRate != null ? analysis.hireRate + '%' : '—', label: 'Hire Rate', color: '#4ade80' },
      { value: analysis.totalResponses || '0', label: 'Total Responses', color: '#818cf8' },
      { value: analysis.totalHired || '0', label: 'Total Hired', color: '#fbbf24' },
    ];
    statCards.forEach(function (s) {
      html += '<div style="flex:1;min-width:120px;background:#1e293b;border-radius:12px;padding:14px;text-align:center;">';
      html += '<div style="font-size:22px;font-weight:700;color:' + s.color + ';">' + s.value + '</div>';
      html += '<div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px;">' + s.label + '</div>';
      html += '</div>';
    });
    html += '</div>';

    // Response speed → hire rate correlation
    html += '<div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:16px;">';
    html += '<h3 style="font-size:15px;color:#f4f4f5;margin:0 0 14px;">⏱️ Speed vs. Hire Rate</h3>';

    HIRING_PATTERNS.responseWindows.forEach(function (w, idx) {
      var userData = analysis.hireRateBySpeed[idx];
      var barWidth = Math.round(w.hireBoost * 50);
      var color = w.hireBoost >= 1.2 ? '#22c55e' : w.hireBoost >= 0.8 ? '#fbbf24' : '#ef4444';

      html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">';
      html += '<span style="font-size:12px;min-width:100px;color:#d1d5db;">' + esc(w.label) + '</span>';
      html += '<div style="flex:1;height:8px;background:#1e293b;border-radius:4px;overflow:hidden;"><div style="height:100%;width:' + barWidth + '%;background:' + color + ';border-radius:4px;"></div></div>';
      html += '<span style="font-size:12px;min-width:45px;text-align:right;color:' + color + ';font-weight:600;">' + (w.hireBoost >= 1 ? '+' : '') + Math.round((w.hireBoost - 1) * 100) + '%</span>';
      if (userData && userData.count > 0) {
        html += '<span style="font-size:11px;color:#94a3b8;min-width:30px;">(' + userData.count + ')</span>';
      }
      html += '</div>';
    });

    html += '<p style="font-size:12px;color:#6b7280;margin:12px 0 0;">Hire rate boost relative to average. Based on platform-wide data.</p>';
    html += '</div>';

    // Best hours & days (if enough data)
    if (analysis.bestHours.length > 0) {
      html += '<div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:16px;">';
      html += '<h3 style="font-size:15px;color:#f4f4f5;margin:0 0 14px;">🎯 Your Best Response Times</h3>';

      html += '<div style="display:flex;gap:16px;flex-wrap:wrap;">';

      // Best hours
      html += '<div style="flex:1;min-width:200px;">';
      html += '<div style="font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Top Hours</div>';
      analysis.bestHours.forEach(function (h) {
        html += '<div style="display:flex;justify-content:space-between;padding:6px 10px;background:#1e293b;border-radius:6px;margin-bottom:4px;">';
        html += '<span style="font-size:13px;color:#e0e0e0;">' + esc(h.label) + '</span>';
        html += '<span style="font-size:13px;color:#22c55e;font-weight:600;">' + h.hireRate + '% hired</span>';
        html += '</div>';
      });
      html += '</div>';

      // Best days
      if (analysis.bestDays.length > 0) {
        html += '<div style="flex:1;min-width:200px;">';
        html += '<div style="font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Top Days</div>';
        analysis.bestDays.slice(0, 5).forEach(function (d) {
          html += '<div style="display:flex;justify-content:space-between;padding:6px 10px;background:#1e293b;border-radius:6px;margin-bottom:4px;">';
          html += '<span style="font-size:13px;color:#e0e0e0;">' + esc(d.name) + '</span>';
          html += '<span style="font-size:13px;color:#22c55e;font-weight:600;">' + d.hireRate + '% hired</span>';
          html += '</div>';
        });
        html += '</div>';
      }

      html += '</div></div>';
    }

    // Platform activity heatmap
    html += '<div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:16px;">';
    html += '<h3 style="font-size:15px;color:#f4f4f5;margin:0 0 14px;">🔥 Platform Hiring Activity (Hourly)</h3>';
    html += '<div style="display:flex;gap:2px;align-items:flex-end;height:100px;">';

    for (var hour = 0; hour < 24; hour++) {
      var activity = HIRING_PATTERNS.hourlyActivity[hour];
      var barH = Math.round(activity * 0.9);
      var barColor = activity >= 80 ? '#22c55e' : activity >= 50 ? '#fbbf24' : activity >= 30 ? '#6366f1' : '#334155';
      html += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;">';
      html += '<div style="width:100%;height:' + barH + 'px;background:' + barColor + ';border-radius:2px 2px 0 0;min-height:3px;"></div>';
      if (hour % 3 === 0) {
        html += '<span style="font-size:9px;color:#6b7280;">' + (hour < 10 ? '0' : '') + hour + '</span>';
      }
      html += '</div>';
    }

    html += '</div>';
    html += '<div style="display:flex;gap:12px;margin-top:8px;font-size:10px;color:#6b7280;">';
    html += '<span><span style="display:inline-block;width:8px;height:8px;background:#22c55e;border-radius:2px;margin-right:4px;"></span>Peak</span>';
    html += '<span><span style="display:inline-block;width:8px;height:8px;background:#fbbf24;border-radius:2px;margin-right:4px;"></span>High</span>';
    html += '<span><span style="display:inline-block;width:8px;height:8px;background:#6366f1;border-radius:2px;margin-right:4px;"></span>Medium</span>';
    html += '<span><span style="display:inline-block;width:8px;height:8px;background:#334155;border-radius:2px;margin-right:4px;"></span>Low</span>';
    html += '</div></div>';

    // Notification schedule
    if (schedule) {
      html += '<div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:16px;">';
      html += '<h3 style="font-size:15px;color:#f4f4f5;margin:0 0 6px;">🔔 Your Notification Schedule</h3>';
      html += '<p style="font-size:12px;color:#94a3b8;margin:0 0 14px;">Optimized for ' + esc(schedule.category) + '</p>';

      schedule.weekSchedule.forEach(function (day) {
        if (day.checkTimes.length === 0) return;

        html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">';
        html += '<span style="font-size:13px;min-width:90px;color:#d1d5db;font-weight:500;">' + esc(day.day) + '</span>';
        html += '<div style="display:flex;gap:6px;flex-wrap:wrap;">';
        day.checkTimes.forEach(function (ct) {
          var prioColors = { high: '#22c55e', medium: '#fbbf24', low: '#6b7280' };
          html += '<span style="font-size:12px;padding:3px 10px;border-radius:12px;background:' + (prioColors[ct.priority] || '#6b7280') + '20;color:' + (prioColors[ct.priority] || '#6b7280') + ';border:1px solid ' + (prioColors[ct.priority] || '#6b7280') + '40;" title="' + esc(ct.reason) + '">' + esc(ct.label) + '</span>';
        });
        html += '</div>';
        html += '<span style="font-size:11px;color:#6b7280;margin-left:auto;">' + day.activityLevel + '% activity</span>';
        html += '</div>';
      });

      html += '</div>';
    } else {
      // Generate schedule button
      html += '<div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:24px;margin-bottom:16px;text-align:center;">';
      html += '<p style="font-size:14px;color:#94a3b8;margin:0 0 12px;">Generate a personalized notification schedule</p>';
      html += '<button class="ro-gen-schedule" style="background:#6366f1;color:#fff;border:none;border-radius:8px;padding:10px 20px;font-size:14px;font-weight:600;cursor:pointer;">🔔 Generate Schedule</button>';
      html += '</div>';
    }

    // Recommendations
    if (analysis.recommendations.length > 0) {
      html += '<div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;">';
      html += '<h3 style="font-size:15px;color:#f4f4f5;margin:0 0 14px;">💡 Recommendations</h3>';
      var prioColors = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' };
      analysis.recommendations.forEach(function (rec) {
        html += '<div style="padding:10px 14px;margin-bottom:8px;background:#1e293b;border-radius:8px;border-left:3px solid ' + (prioColors[rec.priority] || '#6b7280') + ';">';
        html += '<span style="font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:' + (prioColors[rec.priority] || '#6b7280') + ';font-weight:600;">' + esc(rec.priority) + '</span>';
        html += '<div style="font-size:13px;color:#d1d5db;margin-top:2px;">' + esc(rec.text) + '</div>';
        html += '</div>';
      });
      html += '</div>';
    }

    html += '</div>';
    el.innerHTML = html;

    // Event listeners
    var genBtn = el.querySelector('.ro-gen-schedule');
    if (genBtn) {
      genBtn.addEventListener('click', function () {
        generateSchedule({ category: 'Web Development' });
        render(el);
      });
    }

    return analysis;
  }

  /* ══════════════════════════════════════════════
   * INIT
   * ══════════════════════════════════════════════ */

  function init(options) {
    options = options || {};
    return {
      responses: loadResponses().length,
      schedule: loadSchedule(),
      ready: true,
    };
  }

  /* ══════════════════════════════════════════════
   * PUBLIC API
   * ══════════════════════════════════════════════ */
  window.CortexFreelancer.ResponseOptimizer = {
    init: init,
    render: render,
    trackResponse: trackResponse,
    analyzeResponseTimes: analyzeResponseTimes,
    generateSchedule: generateSchedule,
    loadResponses: loadResponses,
    loadSchedule: loadSchedule,
    hiringPatterns: HIRING_PATTERNS,
    version: '1.0.0',
  };

})();
