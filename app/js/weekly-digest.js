/**
 * [CF-068] Weekly Performance Digest with AI Insights
 * Generate weekly summary: proposals sent, response rate, earnings,
 * suggestions for improvement. All data from localStorage.
 *
 * Exposed on window.CortexFreelancer.WeeklyDigest
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  /* ── Constants ── */
  var STORAGE_KEY = 'cortex_weekly_digest';
  var ACTIVITY_KEY = 'cortex_weekly_activity';
  var EARNINGS_KEY = 'cortex_earnings_log';
  var PROPOSALS_KEY = 'cortex_applications'; // shared with auto-apply
  var GOALS_KEY = 'cortex_weekly_goals';
  var DAY_MS = 86400000;
  var WEEK_MS = 7 * DAY_MS;

  /* ── Storage Helpers ── */

  function loadJSON(key) {
    try { return JSON.parse(localStorage.getItem(key)) || null; } catch (e) { return null; }
  }

  function saveJSON(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) {}
  }

  /* ── Activity Logging ── */

  function logActivity(type, data) {
    var log = loadJSON(ACTIVITY_KEY) || [];
    log.push({
      type: type,
      data: data || {},
      timestamp: new Date().toISOString()
    });
    // Keep last 90 days
    var cutoff = new Date(Date.now() - 90 * DAY_MS).toISOString();
    log = log.filter(function (e) { return e.timestamp >= cutoff; });
    saveJSON(ACTIVITY_KEY, log);
  }

  function logProposalSent(jobTitle, rate) {
    logActivity('proposal_sent', { jobTitle: jobTitle, rate: rate });
  }

  function logProposalResponse(jobTitle, response) {
    logActivity('proposal_response', { jobTitle: jobTitle, response: response }); // 'interview', 'hired', 'rejected', 'no_response'
  }

  function logEarning(amount, source, description) {
    logActivity('earning', { amount: amount, source: source, description: description });
    // Also update earnings log
    var earnings = loadJSON(EARNINGS_KEY) || [];
    earnings.push({ amount: amount, source: source, description: description, date: new Date().toISOString() });
    saveJSON(EARNINGS_KEY, earnings);
  }

  function logProfileView() { logActivity('profile_view', {}); }
  function logInviteReceived(jobTitle) { logActivity('invite_received', { jobTitle: jobTitle }); }
  function logInterviewCompleted(jobTitle, outcome) { logActivity('interview', { jobTitle: jobTitle, outcome: outcome }); }

  /* ── Week Boundaries ── */

  function getWeekStart(date) {
    var d = new Date(date || Date.now());
    var day = d.getDay();
    var diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
    return new Date(d.getFullYear(), d.getMonth(), diff, 0, 0, 0, 0);
  }

  function getWeekEnd(weekStart) {
    return new Date(weekStart.getTime() + WEEK_MS - 1);
  }

  function weekLabel(weekStart) {
    var end = getWeekEnd(weekStart);
    var opts = { month: 'short', day: 'numeric' };
    return weekStart.toLocaleDateString('en-US', opts) + ' – ' + end.toLocaleDateString('en-US', opts);
  }

  /* ── Digest Generation ── */

  function generateDigest(weekOffset) {
    weekOffset = weekOffset || 0;
    var now = new Date();
    var weekStart = getWeekStart(now);
    weekStart.setDate(weekStart.getDate() - weekOffset * 7);
    var weekEnd = getWeekEnd(weekStart);

    var startISO = weekStart.toISOString();
    var endISO = weekEnd.toISOString();

    // Gather activity
    var allActivity = loadJSON(ACTIVITY_KEY) || [];
    var weekActivity = allActivity.filter(function (a) {
      return a.timestamp >= startISO && a.timestamp <= endISO;
    });

    // Also pull from shared proposals storage
    var proposals = loadJSON(PROPOSALS_KEY) || [];
    var weekProposals = proposals.filter(function (p) {
      return p.appliedAt >= startISO && p.appliedAt <= endISO;
    });

    // Previous week for comparison
    var prevStart = new Date(weekStart.getTime() - WEEK_MS);
    var prevEnd = new Date(weekEnd.getTime() - WEEK_MS);
    var prevActivity = allActivity.filter(function (a) {
      return a.timestamp >= prevStart.toISOString() && a.timestamp <= prevEnd.toISOString();
    });
    var prevProposals = proposals.filter(function (p) {
      return p.appliedAt >= prevStart.toISOString() && p.appliedAt <= prevEnd.toISOString();
    });

    // ── Metrics ──
    var metrics = computeMetrics(weekActivity, weekProposals);
    var prevMetrics = computeMetrics(prevActivity, prevProposals);

    // ── Daily Breakdown ──
    var dailyBreakdown = [];
    for (var d = 0; d < 7; d++) {
      var dayStart = new Date(weekStart.getTime() + d * DAY_MS);
      var dayEnd = new Date(dayStart.getTime() + DAY_MS - 1);
      var dayISO = dayStart.toISOString();
      var dayEndISO = dayEnd.toISOString();
      var dayActivity = weekActivity.filter(function (a) {
        return a.timestamp >= dayISO && a.timestamp <= dayEndISO;
      });
      var dayProposals = weekProposals.filter(function (p) {
        return p.appliedAt >= dayISO && p.appliedAt <= dayEndISO;
      });
      dailyBreakdown.push({
        date: dayStart,
        dayName: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][d],
        proposalsSent: countType(dayActivity, 'proposal_sent') + dayProposals.length,
        responses: countType(dayActivity, 'proposal_response'),
        earnings: sumField(dayActivity.filter(function (a) { return a.type === 'earning'; }), 'amount'),
        profileViews: countType(dayActivity, 'profile_view'),
        invites: countType(dayActivity, 'invite_received')
      });
    }

    // ── AI Insights ──
    var insights = generateInsights(metrics, prevMetrics, dailyBreakdown);

    // ── Goals Check ──
    var goals = loadJSON(GOALS_KEY) || {};
    var goalResults = checkGoals(goals, metrics);

    var digest = {
      weekLabel: weekLabel(weekStart),
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      weekOffset: weekOffset,
      metrics: metrics,
      previousMetrics: prevMetrics,
      changes: computeChanges(metrics, prevMetrics),
      dailyBreakdown: dailyBreakdown,
      insights: insights,
      goalResults: goalResults,
      generatedAt: new Date().toISOString()
    };

    // Save digest history
    saveDigest(digest);

    return digest;
  }

  function computeMetrics(activity, proposals) {
    var proposalsSent = countType(activity, 'proposal_sent') + proposals.length;
    var responses = activity.filter(function (a) { return a.type === 'proposal_response'; });
    var interviews = responses.filter(function (r) { return r.data.response === 'interview'; }).length +
      activity.filter(function (a) { return a.type === 'interview'; }).length;
    var hired = responses.filter(function (r) { return r.data.response === 'hired'; }).length;
    var rejected = responses.filter(function (r) { return r.data.response === 'rejected'; }).length;
    var noResponse = responses.filter(function (r) { return r.data.response === 'no_response'; }).length;

    var earningEntries = activity.filter(function (a) { return a.type === 'earning'; });
    var totalEarnings = earningEntries.reduce(function (s, a) { return s + (a.data.amount || 0); }, 0);

    var profileViews = countType(activity, 'profile_view');
    var invites = countType(activity, 'invite_received');

    var responseRate = proposalsSent > 0 ? Math.round(((responses.length - noResponse) / proposalsSent) * 10000) / 100 : 0;
    var winRate = proposalsSent > 0 ? Math.round((hired / proposalsSent) * 10000) / 100 : 0;
    var interviewRate = proposalsSent > 0 ? Math.round((interviews / proposalsSent) * 10000) / 100 : 0;

    return {
      proposalsSent: proposalsSent,
      responses: responses.length,
      responseRate: responseRate,
      interviews: interviews,
      interviewRate: interviewRate,
      hired: hired,
      winRate: winRate,
      rejected: rejected,
      noResponse: noResponse,
      totalEarnings: Math.round(totalEarnings * 100) / 100,
      earningEntries: earningEntries.length,
      profileViews: profileViews,
      invites: invites
    };
  }

  function computeChanges(curr, prev) {
    var changes = {};
    ['proposalsSent', 'responseRate', 'winRate', 'totalEarnings', 'interviews', 'profileViews', 'invites'].forEach(function (key) {
      var c = curr[key] || 0;
      var p = prev[key] || 0;
      var diff = c - p;
      var pct = p > 0 ? Math.round((diff / p) * 100) : (c > 0 ? 100 : 0);
      changes[key] = { current: c, previous: p, diff: diff, percentChange: pct, direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat' };
    });
    return changes;
  }

  function countType(activity, type) {
    return activity.filter(function (a) { return a.type === type; }).length;
  }

  function sumField(entries, field) {
    return entries.reduce(function (s, e) { return s + (e.data[field] || 0); }, 0);
  }

  /* ── AI Insights Engine ── */

  function generateInsights(metrics, prevMetrics, daily) {
    var insights = [];

    // Response rate analysis
    if (metrics.proposalsSent > 0) {
      if (metrics.responseRate < 10) {
        insights.push({
          type: 'warning', icon: '⚠️', title: 'Low Response Rate',
          message: 'Only ' + metrics.responseRate + '% response rate. Consider: refining proposals, targeting better-fit jobs, or adjusting your rate.',
          actionable: true
        });
      } else if (metrics.responseRate > 30) {
        insights.push({
          type: 'success', icon: '🎯', title: 'Great Response Rate',
          message: metrics.responseRate + '% response rate is excellent. Your proposals are resonating with clients.',
          actionable: false
        });
      }
    }

    // Proposal volume
    if (metrics.proposalsSent === 0) {
      insights.push({
        type: 'warning', icon: '📝', title: 'No Proposals This Week',
        message: 'You didn\'t send any proposals. Consistency is key — aim for at least 10-15 per week.',
        actionable: true
      });
    } else if (metrics.proposalsSent < 5 && prevMetrics.proposalsSent >= 10) {
      insights.push({
        type: 'info', icon: '📉', title: 'Proposal Volume Dropped',
        message: 'Down from ' + prevMetrics.proposalsSent + ' to ' + metrics.proposalsSent + ' proposals. Keep the pipeline flowing.',
        actionable: true
      });
    } else if (metrics.proposalsSent > prevMetrics.proposalsSent * 1.5 && prevMetrics.proposalsSent > 0) {
      insights.push({
        type: 'success', icon: '🚀', title: 'Great Hustle!',
        message: 'You sent ' + metrics.proposalsSent + ' proposals (up ' + Math.round(((metrics.proposalsSent - prevMetrics.proposalsSent) / prevMetrics.proposalsSent) * 100) + '% from last week). Momentum builds results.',
        actionable: false
      });
    }

    // Win rate
    if (metrics.hired > 0) {
      insights.push({
        type: 'success', icon: '🎉', title: 'New Client' + (metrics.hired > 1 ? 's' : '') + ' Won!',
        message: 'You landed ' + metrics.hired + ' new job' + (metrics.hired > 1 ? 's' : '') + ' this week. Win rate: ' + metrics.winRate + '%.',
        actionable: false
      });
    }

    // Earnings trend
    if (metrics.totalEarnings > 0 && prevMetrics.totalEarnings > 0) {
      var earningsDiff = metrics.totalEarnings - prevMetrics.totalEarnings;
      if (earningsDiff > 0) {
        insights.push({
          type: 'success', icon: '💰', title: 'Earnings Up',
          message: 'Earned $' + metrics.totalEarnings.toFixed(0) + ' this week (+$' + earningsDiff.toFixed(0) + ' vs last week).',
          actionable: false
        });
      } else if (earningsDiff < -prevMetrics.totalEarnings * 0.3) {
        insights.push({
          type: 'warning', icon: '💸', title: 'Earnings Dip',
          message: 'Earnings dropped to $' + metrics.totalEarnings.toFixed(0) + ' from $' + prevMetrics.totalEarnings.toFixed(0) + '. Check if any invoices are pending.',
          actionable: true
        });
      }
    }

    // Daily pattern analysis
    var activeDays = daily.filter(function (d) { return d.proposalsSent > 0; }).length;
    if (activeDays <= 2 && metrics.proposalsSent > 0) {
      insights.push({
        type: 'info', icon: '📅', title: 'Inconsistent Activity',
        message: 'You were only active ' + activeDays + ' days. Spreading proposals across 5+ days improves visibility.',
        actionable: true
      });
    }

    // Best performing day
    var bestDay = daily.reduce(function (best, d) {
      return d.proposalsSent > best.proposalsSent ? d : best;
    }, daily[0]);
    if (bestDay && bestDay.proposalsSent > 3) {
      insights.push({
        type: 'info', icon: '📊', title: 'Peak Day: ' + bestDay.dayName,
        message: bestDay.dayName + ' was your most active day with ' + bestDay.proposalsSent + ' proposals sent.',
        actionable: false
      });
    }

    // Profile views
    if (metrics.profileViews > 0 && metrics.invites === 0 && metrics.proposalsSent > 5) {
      insights.push({
        type: 'info', icon: '👀', title: 'Views Without Invites',
        message: metrics.profileViews + ' profile views but no invites. Optimize your profile headline, photo, and top skills.',
        actionable: true
      });
    }

    // Invites
    if (metrics.invites > 0) {
      insights.push({
        type: 'success', icon: '📬', title: 'Client Invites',
        message: 'You received ' + metrics.invites + ' invite' + (metrics.invites > 1 ? 's' : '') + '. Clients are finding you! Respond promptly for best results.',
        actionable: false
      });
    }

    // Sort: warnings first, then info, then success
    var typeOrder = { warning: 0, info: 1, success: 2 };
    insights.sort(function (a, b) { return (typeOrder[a.type] || 1) - (typeOrder[b.type] || 1); });

    return insights;
  }

  /* ── Goals ── */

  function setGoals(goals) {
    saveJSON(GOALS_KEY, goals);
  }

  function checkGoals(goals, metrics) {
    if (!goals || Object.keys(goals).length === 0) return [];
    var results = [];

    if (goals.proposalsPerWeek) {
      var pct = Math.min(100, Math.round((metrics.proposalsSent / goals.proposalsPerWeek) * 100));
      results.push({
        goal: 'Proposals/week',
        target: goals.proposalsPerWeek,
        actual: metrics.proposalsSent,
        progress: pct,
        met: pct >= 100,
        icon: '📝'
      });
    }

    if (goals.earningsPerWeek) {
      var epct = Math.min(100, Math.round((metrics.totalEarnings / goals.earningsPerWeek) * 100));
      results.push({
        goal: 'Weekly earnings',
        target: '$' + goals.earningsPerWeek,
        actual: '$' + metrics.totalEarnings.toFixed(0),
        progress: epct,
        met: epct >= 100,
        icon: '💰'
      });
    }

    if (goals.responseRate) {
      var rpct = Math.min(100, Math.round((metrics.responseRate / goals.responseRate) * 100));
      results.push({
        goal: 'Response rate',
        target: goals.responseRate + '%',
        actual: metrics.responseRate + '%',
        progress: rpct,
        met: rpct >= 100,
        icon: '🎯'
      });
    }

    if (goals.interviewsPerWeek) {
      var ipct = Math.min(100, Math.round((metrics.interviews / goals.interviewsPerWeek) * 100));
      results.push({
        goal: 'Interviews/week',
        target: goals.interviewsPerWeek,
        actual: metrics.interviews,
        progress: ipct,
        met: ipct >= 100,
        icon: '🗣️'
      });
    }

    return results;
  }

  /* ── Digest History ── */

  function saveDigest(digest) {
    var history = loadJSON(STORAGE_KEY) || [];
    // Dedup by weekStart
    history = history.filter(function (d) { return d.weekStart !== digest.weekStart; });
    history.unshift(digest);
    if (history.length > 12) history = history.slice(0, 12); // Keep 12 weeks
    saveJSON(STORAGE_KEY, history);
  }

  function getDigestHistory() {
    return loadJSON(STORAGE_KEY) || [];
  }

  /* ── Seed Demo Data ── */

  function seedDemoData() {
    var activity = loadJSON(ACTIVITY_KEY) || [];
    var now = Date.now();

    // Seed 3 weeks of data
    for (var w = 0; w < 3; w++) {
      var weekBase = now - w * WEEK_MS;
      var proposalCount = 8 + Math.floor(Math.random() * 15);

      for (var p = 0; p < proposalCount; p++) {
        var ts = new Date(weekBase - Math.random() * WEEK_MS).toISOString();
        activity.push({ type: 'proposal_sent', data: { jobTitle: 'Demo Job ' + (p + 1) }, timestamp: ts });

        // Some responses
        if (Math.random() > 0.5) {
          var responses = ['interview', 'hired', 'rejected', 'no_response'];
          var weights = [0.3, 0.15, 0.25, 0.3];
          var r = Math.random();
          var cum = 0;
          var resp = 'no_response';
          for (var ri = 0; ri < responses.length; ri++) {
            cum += weights[ri];
            if (r < cum) { resp = responses[ri]; break; }
          }
          activity.push({ type: 'proposal_response', data: { jobTitle: 'Demo Job ' + (p + 1), response: resp }, timestamp: new Date(new Date(ts).getTime() + DAY_MS * (1 + Math.random() * 3)).toISOString() });
        }
      }

      // Earnings
      var earningCount = 2 + Math.floor(Math.random() * 4);
      for (var e = 0; e < earningCount; e++) {
        activity.push({
          type: 'earning',
          data: { amount: 100 + Math.round(Math.random() * 900), source: 'upwork', description: 'Demo project payment' },
          timestamp: new Date(weekBase - Math.random() * WEEK_MS).toISOString()
        });
      }

      // Profile views
      var viewCount = Math.floor(Math.random() * 20);
      for (var v = 0; v < viewCount; v++) {
        activity.push({ type: 'profile_view', data: {}, timestamp: new Date(weekBase - Math.random() * WEEK_MS).toISOString() });
      }

      // Invites
      if (Math.random() > 0.4) {
        activity.push({ type: 'invite_received', data: { jobTitle: 'Client Invite ' + (w + 1) }, timestamp: new Date(weekBase - Math.random() * WEEK_MS).toISOString() });
      }
    }

    saveJSON(ACTIVITY_KEY, activity);

    // Set demo goals
    setGoals({ proposalsPerWeek: 15, earningsPerWeek: 2000, responseRate: 20, interviewsPerWeek: 3 });
  }

  /* ── Render ── */

  function render(containerId, options) {
    options = options || {};
    var container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!container) return;

    if (options.seedDemo) {
      var existing = loadJSON(ACTIVITY_KEY);
      if (!existing || existing.length === 0) seedDemoData();
    }

    var digest = generateDigest(options.weekOffset || 0);
    var html = '';

    html += '<div style="background:#1a1a2e;border:1px solid #2a2a4a;border-radius:16px;padding:24px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#e2e8f0;">';

    // Header
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">';
    html += '<div>';
    html += '<h2 style="margin:0;font-size:20px;font-weight:700;color:#f1f5f9;">📊 Weekly Performance Digest</h2>';
    html += '<p style="margin:4px 0 0;font-size:13px;color:#64748b;">' + escHtml(digest.weekLabel) + '</p>';
    html += '</div>';
    html += '</div>';

    // Key Metrics
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px;">';
    html += changeCard('📝 Proposals', digest.metrics.proposalsSent, digest.changes.proposalsSent);
    html += changeCard('🎯 Response Rate', digest.metrics.responseRate + '%', digest.changes.responseRate);
    html += changeCard('🗣️ Interviews', digest.metrics.interviews, digest.changes.interviews);
    html += changeCard('💰 Earnings', '$' + digest.metrics.totalEarnings.toFixed(0), digest.changes.totalEarnings);
    html += changeCard('🏆 Win Rate', digest.metrics.winRate + '%', digest.changes.winRate);
    html += changeCard('📬 Invites', digest.metrics.invites, digest.changes.invites);
    html += '</div>';

    // Daily Activity Chart
    html += '<div style="margin-bottom:20px;">';
    html += '<h3 style="font-size:15px;font-weight:600;color:#f1f5f9;margin:0 0 12px;">📅 Daily Activity</h3>';
    html += renderDailyChart(digest.dailyBreakdown);
    html += '</div>';

    // Goals Progress
    if (digest.goalResults.length > 0) {
      html += '<div style="margin-bottom:20px;">';
      html += '<h3 style="font-size:15px;font-weight:600;color:#f1f5f9;margin:0 0 12px;">🎯 Weekly Goals</h3>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;">';
      digest.goalResults.forEach(function (g) {
        var color = g.met ? '#4ade80' : g.progress >= 70 ? '#facc15' : '#f87171';
        html += '<div style="background:#16213e;border-radius:10px;padding:12px 16px;">';
        html += '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px;">';
        html += '<span style="color:#94a3b8;">' + g.icon + ' ' + escHtml(g.goal) + '</span>';
        html += '<span style="color:' + color + ';font-weight:600;">' + g.actual + ' / ' + g.target + '</span>';
        html += '</div>';
        html += '<div style="height:6px;background:#2a2a4a;border-radius:3px;overflow:hidden;">';
        html += '<div style="height:100%;width:' + g.progress + '%;background:' + color + ';border-radius:3px;transition:width 0.3s;"></div>';
        html += '</div>';
        html += '<div style="font-size:11px;color:#64748b;margin-top:4px;">' + g.progress + '% — ' + (g.met ? '✅ Goal met!' : 'Keep going') + '</div>';
        html += '</div>';
      });
      html += '</div></div>';
    }

    // AI Insights
    if (digest.insights.length > 0) {
      html += '<div>';
      html += '<h3 style="font-size:15px;font-weight:600;color:#f1f5f9;margin:0 0 12px;">💡 Insights & Recommendations</h3>';
      digest.insights.forEach(function (ins) {
        var bgColor = ins.type === 'warning' ? 'rgba(248,113,113,0.08)' : ins.type === 'success' ? 'rgba(74,222,128,0.08)' : 'rgba(99,102,241,0.08)';
        var borderColor = ins.type === 'warning' ? '#f87171' : ins.type === 'success' ? '#4ade80' : '#6366f1';
        html += '<div style="background:' + bgColor + ';border-left:3px solid ' + borderColor + ';border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:8px;">';
        html += '<div style="font-size:13px;font-weight:600;color:#f1f5f9;margin-bottom:4px;">' + ins.icon + ' ' + escHtml(ins.title) + '</div>';
        html += '<div style="font-size:12px;color:#94a3b8;line-height:1.5;">' + escHtml(ins.message) + '</div>';
        if (ins.actionable) {
          html += '<div style="margin-top:6px;font-size:11px;color:' + borderColor + ';font-weight:500;">→ Action recommended</div>';
        }
        html += '</div>';
      });
      html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;
  }

  function changeCard(label, value, change) {
    var arrow = '';
    var changeColor = '#64748b';
    if (change && change.direction === 'up') { arrow = '↑'; changeColor = '#4ade80'; }
    else if (change && change.direction === 'down') { arrow = '↓'; changeColor = '#f87171'; }

    var changeText = '';
    if (change && change.diff !== 0) {
      changeText = arrow + ' ' + (change.diff > 0 ? '+' : '') + (typeof change.current === 'number' && change.current % 1 !== 0 ? change.diff.toFixed(1) : change.diff);
    }

    return '<div style="background:#16213e;border-radius:10px;padding:14px;">' +
      '<div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">' + label + '</div>' +
      '<div style="font-size:24px;font-weight:700;color:#f1f5f9;margin:4px 0;">' + value + '</div>' +
      (changeText ? '<div style="font-size:11px;color:' + changeColor + ';">' + changeText + ' vs last week</div>' : '<div style="font-size:11px;color:#64748b;">—</div>') +
      '</div>';
  }

  function renderDailyChart(daily) {
    var maxProposals = Math.max.apply(null, daily.map(function (d) { return d.proposalsSent; })) || 1;
    var html = '<div style="display:flex;align-items:flex-end;gap:6px;height:100px;background:#16213e;border-radius:10px;padding:16px 20px 12px;">';

    daily.forEach(function (d) {
      var h = Math.max(4, (d.proposalsSent / maxProposals) * 70);
      var color = d.proposalsSent > 0 ? '#6366f1' : '#2a2a4a';
      html += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">';
      html += '<div style="font-size:10px;color:#94a3b8;">' + d.proposalsSent + '</div>';
      html += '<div style="width:100%;height:' + h + 'px;background:' + color + ';border-radius:4px 4px 0 0;transition:height 0.3s;"></div>';
      html += '<div style="font-size:10px;color:#64748b;">' + d.dayName + '</div>';
      html += '</div>';
    });

    html += '</div>';
    return html;
  }

  function escHtml(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  /* ── Init ── */

  function init(options) {
    options = options || {};
    if (options.seedDemo) seedDemoData();
    if (options.goals) setGoals(options.goals);
  }

  /* ── Public API ── */

  window.CortexFreelancer.WeeklyDigest = {
    init: init,
    render: render,
    generateDigest: generateDigest,
    getDigestHistory: getDigestHistory,
    logProposalSent: logProposalSent,
    logProposalResponse: logProposalResponse,
    logEarning: logEarning,
    logProfileView: logProfileView,
    logInviteReceived: logInviteReceived,
    logInterviewCompleted: logInterviewCompleted,
    logActivity: logActivity,
    setGoals: setGoals,
    seedDemoData: seedDemoData
  };

})();
