/**
 * [CF-167] Tool Usage Analytics Tracking
 * Track which tools users use most, time spent per tool, feature adoption.
 * Exposed on window.CortexFreelancer.ToolAnalytics
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_tool_analytics';
  var SESSION_KEY = 'cortex_tool_analytics_session';
  var HEARTBEAT_MS = 15000; // 15-second heartbeat for time tracking
  var heartbeatId = null;
  var currentTool = null;
  var sessionStart = null;

  // ── Storage ──

  function loadAnalytics() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || getDefaultAnalytics(); }
    catch (e) { return getDefaultAnalytics(); }
  }

  function saveAnalytics(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
    catch (e) {}
  }

  function getDefaultAnalytics() {
    return {
      tools: {},
      sessions: [],
      features: {},
      firstSeen: Date.now(),
      totalSessions: 0,
      totalTimeMs: 0
    };
  }

  function escHtml(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  // ── Tool detection ──

  function detectCurrentTool() {
    var bodyAttr = document.body.getAttribute('data-tool-name');
    if (bodyAttr) return bodyAttr;

    var toolEl = document.querySelector('[data-tool-id]');
    if (toolEl) return toolEl.getAttribute('data-tool-id');

    var path = window.location.pathname;
    var match = path.match(/\/tools?\/([a-z0-9-]+)/i);
    if (match) return match[1];

    return null;
  }

  // ── Tracking ──

  function trackToolVisit(toolId) {
    if (!toolId) return;
    var data = loadAnalytics();

    if (!data.tools[toolId]) {
      data.tools[toolId] = {
        visits: 0,
        totalTimeMs: 0,
        lastVisit: null,
        firstVisit: Date.now(),
        actions: {},
        avgSessionMs: 0
      };
    }

    data.tools[toolId].visits++;
    data.tools[toolId].lastVisit = Date.now();
    data.totalSessions++;

    saveAnalytics(data);
  }

  function trackTime(toolId, durationMs) {
    if (!toolId || !durationMs || durationMs < 0) return;
    var data = loadAnalytics();

    if (data.tools[toolId]) {
      data.tools[toolId].totalTimeMs += durationMs;
      data.tools[toolId].avgSessionMs = Math.round(
        data.tools[toolId].totalTimeMs / data.tools[toolId].visits
      );
    }

    data.totalTimeMs += durationMs;
    saveAnalytics(data);
  }

  function trackAction(toolId, actionName) {
    if (!toolId || !actionName) return;
    var data = loadAnalytics();

    if (data.tools[toolId]) {
      if (!data.tools[toolId].actions[actionName]) {
        data.tools[toolId].actions[actionName] = 0;
      }
      data.tools[toolId].actions[actionName]++;
    }

    saveAnalytics(data);
  }

  function trackFeature(featureName) {
    if (!featureName) return;
    var data = loadAnalytics();

    if (!data.features[featureName]) {
      data.features[featureName] = { count: 0, firstUsed: Date.now(), lastUsed: null };
    }
    data.features[featureName].count++;
    data.features[featureName].lastUsed = Date.now();

    saveAnalytics(data);
  }

  // ── Session management ──

  function startSession(toolId) {
    if (currentTool === toolId) return; // already tracking
    if (currentTool) endSession(); // end previous

    currentTool = toolId;
    sessionStart = Date.now();
    trackToolVisit(toolId);

    // Heartbeat for time tracking
    if (heartbeatId) clearInterval(heartbeatId);
    heartbeatId = setInterval(function () {
      if (currentTool && sessionStart) {
        // Persist partial time on each heartbeat
        try {
          localStorage.setItem(SESSION_KEY, JSON.stringify({
            tool: currentTool,
            start: sessionStart,
            lastHeartbeat: Date.now()
          }));
        } catch (e) {}
      }
    }, HEARTBEAT_MS);
  }

  function endSession() {
    if (!currentTool || !sessionStart) return;
    var duration = Date.now() - sessionStart;

    // Cap at 2 hours (user probably left tab open)
    if (duration > 7200000) duration = 7200000;

    trackTime(currentTool, duration);

    // Record session
    var data = loadAnalytics();
    data.sessions.push({
      tool: currentTool,
      start: sessionStart,
      duration: duration,
      date: new Date(sessionStart).toISOString().split('T')[0]
    });
    // Keep last 200 sessions
    if (data.sessions.length > 200) data.sessions = data.sessions.slice(-200);
    saveAnalytics(data);

    if (heartbeatId) clearInterval(heartbeatId);
    localStorage.removeItem(SESSION_KEY);
    currentTool = null;
    sessionStart = null;
  }

  function recoverSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      var session = JSON.parse(raw);
      if (session.tool && session.start && session.lastHeartbeat) {
        var duration = session.lastHeartbeat - session.start;
        if (duration > 0 && duration < 7200000) {
          trackTime(session.tool, duration);
        }
      }
      localStorage.removeItem(SESSION_KEY);
    } catch (e) {}
  }

  // ── Analytics computation ──

  function getInsights() {
    var data = loadAnalytics();
    var tools = data.tools;
    var toolKeys = Object.keys(tools);

    // Sort by visits
    var byVisits = toolKeys.slice().sort(function (a, b) {
      return tools[b].visits - tools[a].visits;
    });

    // Sort by time
    var byTime = toolKeys.slice().sort(function (a, b) {
      return tools[b].totalTimeMs - tools[a].totalTimeMs;
    });

    // Usage over last 7 days
    var weekAgo = Date.now() - 7 * 86400000;
    var recentSessions = data.sessions.filter(function (s) {
      return s.start >= weekAgo;
    });

    // Daily breakdown
    var dailyMap = {};
    recentSessions.forEach(function (s) {
      var day = s.date || new Date(s.start).toISOString().split('T')[0];
      if (!dailyMap[day]) dailyMap[day] = { sessions: 0, timeMs: 0 };
      dailyMap[day].sessions++;
      dailyMap[day].timeMs += s.duration;
    });

    // Feature adoption rate
    var featureKeys = Object.keys(data.features);
    var adoptedFeatures = featureKeys.filter(function (f) {
      return data.features[f].count >= 3;
    });

    return {
      totalTools: toolKeys.length,
      totalSessions: data.totalSessions,
      totalTimeMs: data.totalTimeMs,
      topByVisits: byVisits.slice(0, 10),
      topByTime: byTime.slice(0, 10),
      recentSessions: recentSessions.length,
      dailyBreakdown: dailyMap,
      featureAdoption: Math.round((adoptedFeatures.length / Math.max(featureKeys.length, 1)) * 100),
      tools: tools,
      features: data.features,
      daysSinceStart: Math.ceil((Date.now() - data.firstSeen) / 86400000)
    };
  }

  // ── Formatting helpers ──

  function fmtDuration(ms) {
    if (ms < 60000) return Math.round(ms / 1000) + 's';
    if (ms < 3600000) return Math.round(ms / 60000) + 'm';
    var h = Math.floor(ms / 3600000);
    var m = Math.round((ms % 3600000) / 60000);
    return h + 'h ' + m + 'm';
  }

  function fmtToolName(id) {
    return (id || '').replace(/[-_]/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  // ── Styles ──

  var styles = '\
    .ta-wrap{font-family:Inter,-apple-system,sans-serif;color:var(--text,#e0e0e0);max-width:900px;margin:0 auto;padding:1.5rem 1rem}\
    .ta-wrap h2{margin:0 0 .3rem;font-size:1.4rem;color:var(--text-bright,#fff)}\
    .ta-subtitle{color:var(--text-dim,#888);font-size:.85rem;margin-bottom:1.5rem}\
    .ta-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.75rem;margin-bottom:1.5rem}\
    .ta-stat{background:var(--bg-card,#111);border:1px solid var(--border,#222);border-radius:var(--radius,12px);padding:1rem;text-align:center}\
    .ta-stat-num{font-size:1.8rem;font-weight:800;color:var(--orange,#ff8844)}\
    .ta-stat-label{font-size:.72rem;color:var(--text-dim,#888);margin-top:.2rem}\
    .ta-card{background:var(--bg-card,#111);border:1px solid var(--border,#222);border-radius:var(--radius,12px);padding:1.2rem;margin-bottom:1rem}\
    .ta-card h3{margin:0 0 .85rem;font-size:.95rem;color:var(--text-bright,#fff)}\
    .ta-bar-row{display:flex;align-items:center;gap:.6rem;margin-bottom:.5rem;font-size:.82rem}\
    .ta-bar-label{min-width:120px;color:var(--text,#e0e0e0);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\
    .ta-bar-track{flex:1;height:8px;background:var(--border,#222);border-radius:4px;overflow:hidden}\
    .ta-bar-fill{height:100%;border-radius:4px;transition:width .5s}\
    .ta-bar-value{min-width:50px;text-align:right;font-size:.75rem;color:var(--text-dim,#888);font-weight:600}\
    .ta-grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem}\
    .ta-feature-list{list-style:none;padding:0;margin:0}\
    .ta-feature-item{display:flex;justify-content:space-between;padding:.4rem 0;border-bottom:1px solid var(--border,#222);font-size:.82rem}\
    .ta-feature-item:last-child{border-bottom:none}\
    .ta-feature-count{color:var(--orange,#ff8844);font-weight:600}\
    .ta-daily{display:flex;align-items:flex-end;gap:4px;height:80px;margin-top:.5rem}\
    .ta-daily-bar{flex:1;background:var(--orange,#ff8844);border-radius:3px 3px 0 0;min-width:8px;transition:height .3s;position:relative}\
    .ta-daily-label{text-align:center;font-size:.6rem;color:var(--text-dim,#888);margin-top:.3rem}\
    .ta-btn{background:var(--orange,#ff8844);color:#000;border:none;padding:.45rem .85rem;border-radius:var(--radius-sm,8px);cursor:pointer;font-size:.8rem;font-weight:600}\
    .ta-btn:hover{opacity:.85}\
    .ta-btn-outline{background:transparent;border:1px solid var(--border,#222);color:var(--text,#e0e0e0)}\
    .ta-btn-outline:hover{border-color:var(--orange,#ff8844);color:var(--orange,#ff8844)}\
    .ta-empty{text-align:center;padding:2rem;color:var(--text-dim,#888)}\
    @media(max-width:650px){.ta-stats{grid-template-columns:1fr 1fr}.ta-grid{grid-template-columns:1fr}.ta-bar-label{min-width:80px}}\
  ';

  // ── Render ──

  function render(containerId) {
    if (!document.getElementById('ta-styles')) {
      var s = document.createElement('style');
      s.id = 'ta-styles';
      s.textContent = styles;
      document.head.appendChild(s);
    }

    var container = document.getElementById(containerId);
    if (!container) return;

    var insights = getInsights();

    var html = '<div class="ta-wrap">';
    html += '<h2>Tool Usage Analytics</h2>';
    html += '<p class="ta-subtitle">Track your tool usage patterns, time spent, and feature adoption.</p>';

    // Overview stats
    html += '<div class="ta-stats">';
    html += '<div class="ta-stat"><div class="ta-stat-num">' + insights.totalTools + '</div><div class="ta-stat-label">Tools Used</div></div>';
    html += '<div class="ta-stat"><div class="ta-stat-num">' + insights.totalSessions + '</div><div class="ta-stat-label">Total Sessions</div></div>';
    html += '<div class="ta-stat"><div class="ta-stat-num">' + fmtDuration(insights.totalTimeMs) + '</div><div class="ta-stat-label">Total Time</div></div>';
    html += '<div class="ta-stat"><div class="ta-stat-num">' + insights.recentSessions + '</div><div class="ta-stat-label">Sessions (7d)</div></div>';
    html += '<div class="ta-stat"><div class="ta-stat-num">' + insights.featureAdoption + '%</div><div class="ta-stat-label">Feature Adoption</div></div>';
    html += '</div>';

    if (!insights.totalTools) {
      html += '<div class="ta-empty"><p>No analytics data yet.</p><p style="font-size:.8rem">Start using tools and your usage will be tracked automatically.</p></div>';
    } else {
      html += '<div class="ta-grid">';

      // Top tools by visits
      html += '<div class="ta-card"><h3>Most Used Tools</h3>';
      var maxVisits = insights.topByVisits.length ? insights.tools[insights.topByVisits[0]].visits : 1;
      insights.topByVisits.forEach(function (toolId) {
        var t = insights.tools[toolId];
        var pct = Math.round((t.visits / maxVisits) * 100);
        html += '<div class="ta-bar-row"><div class="ta-bar-label">' + escHtml(fmtToolName(toolId)) + '</div>';
        html += '<div class="ta-bar-track"><div class="ta-bar-fill" style="width:' + pct + '%;background:var(--orange,#ff8844)"></div></div>';
        html += '<div class="ta-bar-value">' + t.visits + ' visits</div></div>';
      });
      html += '</div>';

      // Top tools by time
      html += '<div class="ta-card"><h3>Most Time Spent</h3>';
      var maxTime = insights.topByTime.length ? insights.tools[insights.topByTime[0]].totalTimeMs : 1;
      insights.topByTime.forEach(function (toolId) {
        var t = insights.tools[toolId];
        var pct = Math.round((t.totalTimeMs / maxTime) * 100);
        html += '<div class="ta-bar-row"><div class="ta-bar-label">' + escHtml(fmtToolName(toolId)) + '</div>';
        html += '<div class="ta-bar-track"><div class="ta-bar-fill" style="width:' + pct + '%;background:var(--blue,#4488ff)"></div></div>';
        html += '<div class="ta-bar-value">' + fmtDuration(t.totalTimeMs) + '</div></div>';
      });
      html += '</div>';

      html += '</div>'; // grid

      // Daily activity chart
      var days = Object.keys(insights.dailyBreakdown).sort();
      if (days.length) {
        html += '<div class="ta-card"><h3>Last 7 Days Activity</h3>';
        var maxDaily = 1;
        days.forEach(function (d) {
          if (insights.dailyBreakdown[d].sessions > maxDaily) maxDaily = insights.dailyBreakdown[d].sessions;
        });
        html += '<div class="ta-daily">';
        // Fill in all 7 days
        for (var i = 6; i >= 0; i--) {
          var d = new Date(Date.now() - i * 86400000);
          var key = d.toISOString().split('T')[0];
          var dayData = insights.dailyBreakdown[key] || { sessions: 0 };
          var height = Math.max(dayData.sessions / maxDaily * 100, dayData.sessions > 0 ? 8 : 2);
          var dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
          html += '<div style="flex:1;text-align:center"><div class="ta-daily-bar" style="height:' + height + '%" title="' + dayData.sessions + ' sessions"></div>';
          html += '<div class="ta-daily-label">' + dayLabel + '</div></div>';
        }
        html += '</div></div>';
      }

      // Feature adoption
      var featureKeys = Object.keys(insights.features);
      if (featureKeys.length) {
        html += '<div class="ta-card"><h3>Feature Adoption</h3>';
        html += '<ul class="ta-feature-list">';
        featureKeys.sort(function (a, b) {
          return insights.features[b].count - insights.features[a].count;
        }).slice(0, 15).forEach(function (f) {
          html += '<li class="ta-feature-item"><span>' + escHtml(fmtToolName(f)) + '</span>';
          html += '<span class="ta-feature-count">' + insights.features[f].count + 'x</span></li>';
        });
        html += '</ul></div>';
      }
    }

    // Actions
    html += '<div style="display:flex;gap:.5rem;justify-content:flex-end;flex-wrap:wrap;margin-top:.5rem">';
    html += '<button class="ta-btn ta-btn-outline" id="ta-export">Export Data</button>';
    html += '<button class="ta-btn ta-btn-outline" id="ta-reset" style="color:var(--red,#ff4444);border-color:var(--red,#ff4444)">Reset Analytics</button>';
    html += '</div>';

    html += '</div>';
    container.innerHTML = html;

    // Events
    container.addEventListener('click', function (e) {
      if (e.target.id === 'ta-export') {
        var data = loadAnalytics();
        var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'cortex-tool-analytics-' + new Date().toISOString().split('T')[0] + '.json';
        a.click();
        URL.revokeObjectURL(url);
      }

      if (e.target.id === 'ta-reset') {
        if (confirm('Reset all analytics data? This cannot be undone.')) {
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(SESSION_KEY);
          render(containerId);
        }
      }
    });
  }

  // ── Auto-init ──

  function autoInit() {
    recoverSession();
    var toolId = detectCurrentTool();
    if (toolId) startSession(toolId);

    // End session on page unload
    window.addEventListener('beforeunload', endSession);

    // Handle visibility changes
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        endSession();
      } else {
        var toolId = detectCurrentTool();
        if (toolId) startSession(toolId);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }

  // ── Public API ──

  var ToolAnalytics = {
    init: autoInit,
    render: render,
    trackAction: trackAction,
    trackFeature: trackFeature,
    startSession: startSession,
    endSession: endSession,
    getInsights: getInsights,
    getRawData: loadAnalytics
  };

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.ToolAnalytics = ToolAnalytics;
})();
