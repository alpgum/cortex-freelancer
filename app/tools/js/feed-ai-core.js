/* ============================================
   CORTEX FREELANCER — Feed AI Core v1.0
   cf3-019 | feed-ai-core.js
   Intelligence analysis engine: activity aggregation,
   pattern recognition, insights, risk alerts
   ============================================ */

;(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FeedAICore = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  /* ======== Constants ======== */
  var STORAGE_KEY = 'cortex_activity_feed';
  var INSIGHTS_KEY = 'cortex_ai_insights';
  var PREFS_KEY = 'cortex_feed_prefs';
  var MAX_FEED_ITEMS = 500;

  /* ======== Helpers ======== */
  function getJSON(key, fb) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fb; }
    catch(e) { return fb; }
  }
  function setJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {}
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 6); }
  function todayStr() { return new Date().toISOString().split('T')[0]; }
  function dayOfWeek(d) { return new Date(d).getDay(); }
  function hourOfDay(ts) { return new Date(ts).getHours(); }

  function timeAgo(ts) {
    var diff = Date.now() - new Date(ts).getTime();
    var m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return m + 'm ago';
    var h = Math.floor(m / 60);
    if (h < 24) return h + 'h ago';
    var d = Math.floor(h / 24);
    if (d < 7) return d + 'd ago';
    return new Date(ts).toLocaleDateString();
  }

  function avg(arr) { return arr.length ? arr.reduce(function(a,b){return a+b;},0)/arr.length : 0; }
  function sum(arr) { return arr.reduce(function(a,b){return a+b;},0); }
  function clamp(v,lo,hi) { return Math.max(lo,Math.min(hi,v)); }

  /* ======== Data Sources ======== */
  function getTimeEntries() {
    try {
      var raw = localStorage.getItem('cortex_time_entries');
      return raw ? JSON.parse(raw) : [];
    } catch(e) { return []; }
  }

  function getClients() {
    try {
      var raw = localStorage.getItem('cortex_client_directory');
      if (!raw) return [];
      var data = JSON.parse(raw);
      return data.clients || [];
    } catch(e) { return []; }
  }

  function getProjects() {
    try {
      var raw = localStorage.getItem('cortex_projects');
      if (!raw) return [];
      return JSON.parse(raw) || [];
    } catch(e) { return []; }
  }

  function getMessages() {
    try {
      var raw = localStorage.getItem('cortex_comm_messages');
      if (!raw) return [];
      return JSON.parse(raw) || [];
    } catch(e) { return []; }
  }

  function getTimeline() {
    try {
      var raw = localStorage.getItem('cortex_project_milestones');
      if (!raw) return [];
      return JSON.parse(raw) || [];
    } catch(e) { return []; }
  }

  function getSettings() {
    try {
      if (typeof CortexSettings !== 'undefined') {
        return {
          currency: CortexSettings.get('user.currency') || 'USD',
          symbol: CortexSettings.getCurrencySymbol(CortexSettings.get('rates.defaultCurrency') || 'USD'),
          rate: parseFloat(CortexSettings.get('rates.defaultHourlyRate')) || 50,
          name: CortexSettings.get('user.displayName') || 'Freelancer'
        };
      }
    } catch(e) {}
    return { currency: 'USD', symbol: '$', rate: 50, name: 'Freelancer' };
  }

  /* ================================================================
     ACTIVITY AGGREGATION ENGINE
     Pulls from all data sources, normalizes into feed items
     ================================================================ */

  var ActivityAggregator = {
    /**
     * Collect all activities across the platform.
     * Returns sorted array of { id, type, category, title, body, ts, icon, color, source, meta }
     */
    collectAll: function(options) {
      options = options || {};
      var since = options.since || Date.now() - 30 * 86400000; // last 30 days
      var items = [];

      items = items.concat(this._fromTimeTracker(since));
      items = items.concat(this._fromClients(since));
      items = items.concat(this._fromProjects(since));
      items = items.concat(this._fromCommunications(since));
      items = items.concat(this._fromTimeline(since));

      // Sort newest first
      items.sort(function(a,b){ return b.ts - a.ts; });
      return items.slice(0, MAX_FEED_ITEMS);
    },

    _fromTimeTracker: function(since) {
      var entries = getTimeEntries();
      var items = [];
      entries.forEach(function(e) {
        var ts = e.startTs || new Date(e.date + 'T' + (e.startTime || '09:00')).getTime();
        if (ts < since) return;
        var hours = parseFloat(e.hours || e.duration || 0);
        items.push({
          id: 'time-' + (e.id || uid()),
          type: 'time_entry',
          category: 'work',
          title: 'Tracked ' + hours.toFixed(1) + 'h on ' + (e.project || 'Unassigned'),
          body: e.description || e.desc || '',
          ts: ts,
          icon: '⏱️',
          color: '#ff8844',
          source: 'time-tracker',
          meta: { project: e.project, client: e.client, hours: hours, billable: e.billable !== false, rate: e.rate }
        });
      });
      return items;
    },

    _fromClients: function(since) {
      var clients = getClients();
      var items = [];
      clients.forEach(function(c) {
        if (c.createdAt && new Date(c.createdAt).getTime() >= since) {
          items.push({
            id: 'client-add-' + (c.id || uid()),
            type: 'client_added',
            category: 'client',
            title: 'New client: ' + (c.name || c.company || 'Unknown'),
            body: c.company ? c.company + (c.industry ? ' · ' + c.industry : '') : '',
            ts: new Date(c.createdAt).getTime(),
            icon: '👤',
            color: '#4488ff',
            source: 'client-directory',
            meta: { clientId: c.id, status: c.status }
          });
        }
        // Check projects for invoiced/completed milestones
        (c.projects || []).forEach(function(p) {
          if (p.completedAt && new Date(p.completedAt).getTime() >= since) {
            items.push({
              id: 'project-done-' + (p.id || uid()),
              type: 'project_completed',
              category: 'milestone',
              title: 'Project completed: ' + (p.name || 'Untitled'),
              body: 'Client: ' + (c.name || c.company) + ' · ' + (p.amount ? '$' + p.amount : ''),
              ts: new Date(p.completedAt).getTime(),
              icon: '🎉',
              color: '#00ff88',
              source: 'client-directory',
              meta: { clientId: c.id, amount: p.amount }
            });
          }
        });
      });
      return items;
    },

    _fromProjects: function(since) {
      var projects = getProjects();
      var items = [];
      projects.forEach(function(p) {
        var ts = p.updatedAt || p.createdAt;
        if (!ts || new Date(ts).getTime() < since) return;
        items.push({
          id: 'proj-' + (p.id || uid()),
          type: 'project_update',
          category: 'project',
          title: (p.status === 'completed' ? 'Completed' : 'Updated') + ': ' + (p.name || 'Untitled'),
          body: p.client ? 'Client: ' + p.client : '',
          ts: new Date(ts).getTime(),
          icon: p.status === 'completed' ? '✅' : '📋',
          color: p.status === 'completed' ? '#00ff88' : '#aa66ff',
          source: 'project-tracker',
          meta: { projectId: p.id, status: p.status, budget: p.budget }
        });
      });
      return items;
    },

    _fromCommunications: function(since) {
      var messages = getMessages();
      var items = [];
      messages.forEach(function(m) {
        var ts = m.sentAt || m.date;
        if (!ts || new Date(ts).getTime() < since) return;
        items.push({
          id: 'comm-' + (m.id || uid()),
          type: 'communication',
          category: 'comm',
          title: (m.direction === 'sent' ? 'Sent to ' : 'Received from ') + (m.client || m.recipient || 'Unknown'),
          body: m.subject || (m.body || '').substring(0, 80),
          ts: new Date(ts).getTime(),
          icon: m.direction === 'sent' ? '📤' : '📥',
          color: '#ffc800',
          source: 'communication-hub',
          meta: { client: m.client, type: m.type, followUp: m.followUpDate }
        });
      });
      return items;
    },

    _fromTimeline: function(since) {
      var milestones = getTimeline();
      var items = [];
      milestones.forEach(function(ms) {
        var due = ms.dueDate || ms.date;
        if (!due) return;
        var ts = new Date(due).getTime();
        // Include upcoming (next 7 days) and recent past
        if (ts < since && ts < Date.now() - 7 * 86400000) return;
        var isPast = ts < Date.now();
        var isOverdue = isPast && ms.status !== 'completed' && ms.status !== 'done';
        items.push({
          id: 'mile-' + (ms.id || uid()),
          type: isOverdue ? 'deadline_overdue' : (isPast ? 'milestone_passed' : 'milestone_upcoming'),
          category: 'timeline',
          title: (isOverdue ? '⚠️ OVERDUE: ' : '') + (ms.name || ms.title || 'Milestone'),
          body: ms.project ? 'Project: ' + ms.project : '',
          ts: ts,
          icon: isOverdue ? '🚨' : (isPast ? '✅' : '📅'),
          color: isOverdue ? '#ff4444' : '#aa66ff',
          source: 'project-timeline',
          meta: { projectId: ms.projectId, status: ms.status, overdue: isOverdue }
        });
      });
      return items;
    }
  };

  /* ================================================================
     AI INSIGHTS ENGINE
     Pattern recognition, health scoring, recommendations
     ================================================================ */

  var InsightsEngine = {

    /**
     * Generate all insights. Returns array of insight objects.
     */
    generateAll: function() {
      var insights = [];
      insights = insights.concat(this.workPatterns());
      insights = insights.concat(this.clientHealth());
      insights = insights.concat(this.revenueOpportunities());
      insights = insights.concat(this.productivitySuggestions());
      insights = insights.concat(this.riskAlerts());

      // Score and sort by priority
      insights.sort(function(a,b) { return b.priority - a.priority; });

      // Cache insights
      setJSON(INSIGHTS_KEY, { generated: Date.now(), insights: insights });
      return insights;
    },

    /* ---- Work Patterns ---- */
    workPatterns: function() {
      var entries = getTimeEntries();
      if (entries.length < 5) return [];
      var insights = [];

      // Peak hours analysis
      var hourBuckets = {};
      entries.forEach(function(e) {
        var h = e.startTime ? parseInt(e.startTime.split(':')[0], 10) : hourOfDay(e.startTs || Date.now());
        hourBuckets[h] = (hourBuckets[h] || 0) + parseFloat(e.hours || e.duration || 0);
      });

      var peakHour = null, peakVal = 0;
      Object.keys(hourBuckets).forEach(function(h) {
        if (hourBuckets[h] > peakVal) { peakVal = hourBuckets[h]; peakHour = parseInt(h); }
      });

      if (peakHour !== null) {
        var period = peakHour < 12 ? 'morning' : (peakHour < 17 ? 'afternoon' : 'evening');
        insights.push({
          id: 'pattern-peak-hours',
          type: 'pattern',
          category: 'productivity',
          title: 'Peak Productivity: ' + period.charAt(0).toUpperCase() + period.slice(1),
          body: 'You log the most hours around ' + peakHour + ':00–' + (peakHour + 2) + ':00. Schedule deep work during this window for maximum output.',
          icon: '🧠',
          color: '#aa66ff',
          priority: 6,
          actionable: true,
          action: 'Block ' + peakHour + ':00–' + (peakHour + 2) + ':00 for focused work'
        });
      }

      // Day-of-week patterns
      var dayBuckets = [0,0,0,0,0,0,0];
      var dayCounts = [0,0,0,0,0,0,0];
      entries.forEach(function(e) {
        var d = dayOfWeek(e.date || new Date(e.startTs).toISOString().split('T')[0]);
        dayBuckets[d] += parseFloat(e.hours || e.duration || 0);
        dayCounts[d]++;
      });

      var bestDay = 0, bestAvg = 0;
      var dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      for (var i = 0; i < 7; i++) {
        var a = dayCounts[i] ? dayBuckets[i] / dayCounts[i] : 0;
        if (a > bestAvg) { bestAvg = a; bestDay = i; }
      }

      if (bestAvg > 0) {
        insights.push({
          id: 'pattern-best-day',
          type: 'pattern',
          category: 'productivity',
          title: dayNames[bestDay] + 's Are Your Power Day',
          body: 'You average ' + bestAvg.toFixed(1) + 'h on ' + dayNames[bestDay] + 's — your most productive day. Plan high-value tasks accordingly.',
          icon: '📈',
          color: '#00ff88',
          priority: 5,
          actionable: false
        });
      }

      // Billable ratio
      var totalH = 0, billableH = 0;
      entries.forEach(function(e) {
        var h = parseFloat(e.hours || e.duration || 0);
        totalH += h;
        if (e.billable !== false) billableH += h;
      });

      var ratio = totalH > 0 ? (billableH / totalH * 100) : 0;
      if (totalH > 10) {
        var level = ratio >= 70 ? 'healthy' : (ratio >= 50 ? 'moderate' : 'low');
        insights.push({
          id: 'pattern-billable-ratio',
          type: 'metric',
          category: 'revenue',
          title: 'Billable Ratio: ' + ratio.toFixed(0) + '%',
          body: level === 'low'
            ? 'Only ' + ratio.toFixed(0) + '% of your time is billable. Look for admin tasks to automate or delegate.'
            : (level === 'moderate'
              ? 'Your billable ratio is decent but could improve. Target 70%+ for optimal revenue.'
              : 'Excellent billable ratio! You\'re converting most of your time into revenue.'),
          icon: ratio >= 70 ? '✅' : (ratio >= 50 ? '⚡' : '⚠️'),
          color: ratio >= 70 ? '#00ff88' : (ratio >= 50 ? '#ffc800' : '#ff4444'),
          priority: ratio < 50 ? 8 : 4,
          actionable: ratio < 70,
          action: ratio < 70 ? 'Review non-billable tasks and automate repetitive ones' : null
        });
      }

      return insights;
    },

    /* ---- Client Relationship Health ---- */
    clientHealth: function() {
      var clients = getClients();
      if (!clients.length) return [];
      var insights = [];
      var messages = getMessages();
      var entries = getTimeEntries();
      var now = Date.now();

      clients.forEach(function(c) {
        if (c.status !== 'active') return;
        var name = c.name || c.company || 'Unknown';

        // Last communication check
        var lastComm = null;
        messages.forEach(function(m) {
          if ((m.client || '').toLowerCase() === name.toLowerCase()) {
            var t = new Date(m.sentAt || m.date).getTime();
            if (!lastComm || t > lastComm) lastComm = t;
          }
        });

        var daysSinceComm = lastComm ? Math.floor((now - lastComm) / 86400000) : 999;

        // Last work entry check
        var lastWork = null;
        entries.forEach(function(e) {
          if ((e.client || '').toLowerCase() === name.toLowerCase()) {
            var t = e.startTs || new Date(e.date).getTime();
            if (!lastWork || t > lastWork) lastWork = t;
          }
        });

        var daysSinceWork = lastWork ? Math.floor((now - lastWork) / 86400000) : 999;

        // Health score (0-100)
        var commScore = daysSinceComm <= 3 ? 100 : (daysSinceComm <= 7 ? 80 : (daysSinceComm <= 14 ? 50 : (daysSinceComm <= 30 ? 20 : 0)));
        var workScore = daysSinceWork <= 7 ? 100 : (daysSinceWork <= 14 ? 70 : (daysSinceWork <= 30 ? 40 : 10));
        var healthScore = Math.round(commScore * 0.5 + workScore * 0.5);

        if (healthScore < 50) {
          insights.push({
            id: 'client-health-' + (c.id || name),
            type: 'risk',
            category: 'client',
            title: '⚠️ ' + name + ' — Relationship Cooling',
            body: 'No communication for ' + daysSinceComm + ' days' + (daysSinceWork < 999 ? ', last work ' + daysSinceWork + ' days ago' : '') + '. Health score: ' + healthScore + '/100. Reach out to maintain the relationship.',
            icon: '❄️',
            color: '#ff4444',
            priority: 9,
            actionable: true,
            action: 'Send a check-in message to ' + name,
            meta: { clientId: c.id, healthScore: healthScore, daysSinceComm: daysSinceComm }
          });
        } else if (healthScore < 70) {
          insights.push({
            id: 'client-warm-' + (c.id || name),
            type: 'suggestion',
            category: 'client',
            title: name + ' — Follow Up Soon',
            body: 'Last contact ' + daysSinceComm + ' days ago. A quick update keeps the relationship warm.',
            icon: '💬',
            color: '#ffc800',
            priority: 5,
            actionable: true,
            action: 'Schedule follow-up with ' + name
          });
        }
      });

      return insights;
    },

    /* ---- Revenue Opportunities ---- */
    revenueOpportunities: function() {
      var entries = getTimeEntries();
      var clients = getClients();
      var settings = getSettings();
      var insights = [];

      // Underpriced projects
      var projectHours = {};
      var projectRates = {};
      entries.forEach(function(e) {
        var p = e.project || 'General';
        projectHours[p] = (projectHours[p] || 0) + parseFloat(e.hours || e.duration || 0);
        if (e.rate) projectRates[p] = parseFloat(e.rate);
      });

      Object.keys(projectHours).forEach(function(p) {
        var hours = projectHours[p];
        var rate = projectRates[p] || settings.rate;
        var effectiveRate = rate;

        // Check if fixed-price project is underpriced
        var proj = null;
        getProjects().forEach(function(pr) { if (pr.name === p) proj = pr; });
        if (proj && proj.budget && hours > 0) {
          effectiveRate = parseFloat(proj.budget) / hours;
          if (effectiveRate < settings.rate * 0.7) {
            insights.push({
              id: 'rev-underpriced-' + p,
              type: 'opportunity',
              category: 'revenue',
              title: '💰 ' + p + ' — Below Target Rate',
              body: 'Effective rate: ' + settings.symbol + effectiveRate.toFixed(0) + '/h vs your target ' + settings.symbol + settings.rate + '/h. ' + hours.toFixed(0) + 'h invested. Consider adjusting scope or raising rates for similar projects.',
              icon: '💰',
              color: '#ffc800',
              priority: 7,
              actionable: true,
              action: 'Review pricing for ' + p
            });
          }
        }
      });

      // Prospect conversion opportunities
      var prospects = clients.filter(function(c) { return c.status === 'prospect'; });
      if (prospects.length > 0) {
        var totalPotential = prospects.reduce(function(s, c) {
          return s + ((c.projects || []).reduce(function(ps, p) { return ps + (parseFloat(p.estimatedBudget || p.amount) || 0); }, 0));
        }, 0);

        insights.push({
          id: 'rev-prospects',
          type: 'opportunity',
          category: 'revenue',
          title: prospects.length + ' Prospect' + (prospects.length > 1 ? 's' : '') + ' in Pipeline',
          body: totalPotential > 0
            ? 'Potential revenue: ' + settings.symbol + totalPotential.toLocaleString() + '. Follow up to convert.'
            : 'Reach out with proposals to convert prospects into paying clients.',
          icon: '🎯',
          color: '#4488ff',
          priority: 6,
          actionable: true,
          action: 'Send proposals to active prospects'
        });
      }

      // Utilization analysis
      var thisWeekH = 0;
      var weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      var weekStartStr = weekStart.toISOString().split('T')[0];
      entries.forEach(function(e) {
        if ((e.date || '') >= weekStartStr) thisWeekH += parseFloat(e.hours || e.duration || 0);
      });

      var targetWeekly = 35; // reasonable freelancer target
      var utilization = (thisWeekH / targetWeekly * 100);
      if (utilization < 60 && new Date().getDay() >= 3) { // Wed+ and below 60%
        insights.push({
          id: 'rev-utilization',
          type: 'opportunity',
          category: 'revenue',
          title: 'Capacity Available This Week',
          body: 'Only ' + thisWeekH.toFixed(1) + 'h logged (' + utilization.toFixed(0) + '% utilization). You have bandwidth for additional projects.',
          icon: '📊',
          color: '#4488ff',
          priority: 4,
          actionable: true,
          action: 'Check job boards or reach out to prospects'
        });
      }

      return insights;
    },

    /* ---- Productivity Suggestions ---- */
    productivitySuggestions: function() {
      var entries = getTimeEntries();
      if (entries.length < 3) return [];
      var insights = [];

      // Session length analysis
      var sessions = entries.map(function(e) { return parseFloat(e.hours || e.duration || 0); }).filter(function(h) { return h > 0; });
      var avgSession = avg(sessions);

      if (avgSession > 4) {
        insights.push({
          id: 'prod-long-sessions',
          type: 'suggestion',
          category: 'productivity',
          title: 'Consider Shorter Work Sessions',
          body: 'Your average session is ' + avgSession.toFixed(1) + 'h. Research shows 90-minute focused blocks with breaks boost output. Try the Pomodoro technique.',
          icon: '🍅',
          color: '#aa66ff',
          priority: 4,
          actionable: true,
          action: 'Try 90-min focused blocks with 15-min breaks'
        });
      }

      // Context switching (many short entries across projects)
      var todayEntries = entries.filter(function(e) { return (e.date || '').substring(0,10) === todayStr(); });
      var todayProjects = {};
      todayEntries.forEach(function(e) { todayProjects[e.project || 'General'] = true; });
      if (Object.keys(todayProjects).length >= 4 && todayEntries.length >= 6) {
        insights.push({
          id: 'prod-context-switch',
          type: 'warning',
          category: 'productivity',
          title: 'Heavy Context Switching Today',
          body: 'You\'ve worked on ' + Object.keys(todayProjects).length + ' projects across ' + todayEntries.length + ' sessions today. Each switch costs ~23 minutes of refocus time. Try batching similar tasks.',
          icon: '🔄',
          color: '#ffc800',
          priority: 7,
          actionable: true,
          action: 'Batch remaining tasks by project'
        });
      }

      // Streak tracking
      var dates = {};
      entries.forEach(function(e) { if (e.date) dates[e.date] = true; });
      var streak = 0;
      var d = new Date();
      while (dates[d.toISOString().split('T')[0]]) {
        streak++;
        d.setDate(d.getDate() - 1);
      }
      if (streak >= 5) {
        insights.push({
          id: 'prod-streak',
          type: 'achievement',
          category: 'productivity',
          title: '🔥 ' + streak + '-Day Streak!',
          body: 'You\'ve tracked time ' + streak + ' days in a row. Consistency builds mastery. Keep it going!',
          icon: '🔥',
          color: '#ff8844',
          priority: 3,
          actionable: false
        });
      }

      return insights;
    },

    /* ---- Risk Alerts ---- */
    riskAlerts: function() {
      var insights = [];
      var milestones = getTimeline();
      var projects = getProjects();
      var now = Date.now();

      // Overdue milestones
      milestones.forEach(function(ms) {
        var due = ms.dueDate || ms.date;
        if (!due) return;
        var dueTs = new Date(due).getTime();
        if (dueTs < now && ms.status !== 'completed' && ms.status !== 'done') {
          var overdueDays = Math.floor((now - dueTs) / 86400000);
          insights.push({
            id: 'risk-overdue-' + (ms.id || ms.name),
            type: 'risk',
            category: 'deadline',
            title: '🚨 Overdue: ' + (ms.name || ms.title),
            body: overdueDays + ' days past deadline' + (ms.project ? ' on ' + ms.project : '') + '. This affects client trust and may trigger penalties.',
            icon: '🚨',
            color: '#ff4444',
            priority: 10,
            actionable: true,
            action: 'Address overdue milestone immediately'
          });
        } else if (dueTs > now && dueTs - now < 3 * 86400000) {
          // Due within 3 days
          var daysLeft = Math.ceil((dueTs - now) / 86400000);
          insights.push({
            id: 'risk-upcoming-' + (ms.id || ms.name),
            type: 'warning',
            category: 'deadline',
            title: '⏰ Due in ' + daysLeft + 'd: ' + (ms.name || ms.title),
            body: (ms.project ? ms.project + ' — ' : '') + 'Deadline approaching. Prioritize this to stay on track.',
            icon: '⏰',
            color: '#ffc800',
            priority: 8,
            actionable: true,
            action: 'Focus on completing ' + (ms.name || ms.title)
          });
        }
      });

      // Stale projects (no work in 14+ days)
      projects.forEach(function(p) {
        if (p.status === 'completed' || p.status === 'archived') return;
        var lastActivity = p.updatedAt || p.createdAt;
        if (!lastActivity) return;
        var days = Math.floor((now - new Date(lastActivity).getTime()) / 86400000);
        if (days >= 14) {
          insights.push({
            id: 'risk-stale-' + (p.id || p.name),
            type: 'risk',
            category: 'project',
            title: '😴 Stale Project: ' + (p.name || 'Untitled'),
            body: 'No activity for ' + days + ' days. Is this still active? Either resume work or archive it.',
            icon: '😴',
            color: '#ff8844',
            priority: 5,
            actionable: true,
            action: 'Resume or archive ' + (p.name || 'project')
          });
        }
      });

      return insights;
    },

    /**
     * Compute a single numeric health score for the freelance business (0-100)
     */
    businessHealthScore: function() {
      var scores = [];
      var entries = getTimeEntries();
      var clients = getClients();
      var milestones = getTimeline();

      // Billable ratio score
      var totalH = 0, billableH = 0;
      entries.forEach(function(e) {
        var h = parseFloat(e.hours || e.duration || 0);
        totalH += h;
        if (e.billable !== false) billableH += h;
      });
      if (totalH > 0) scores.push(clamp(billableH / totalH * 100, 0, 100));

      // Active client score
      var active = clients.filter(function(c) { return c.status === 'active'; }).length;
      scores.push(clamp(active * 25, 0, 100)); // 4+ active = 100

      // Overdue count
      var overdue = milestones.filter(function(ms) {
        return ms.dueDate && new Date(ms.dueDate).getTime() < Date.now() && ms.status !== 'completed' && ms.status !== 'done';
      }).length;
      scores.push(clamp(100 - overdue * 25, 0, 100));

      // Recent activity (entries in last 7 days)
      var weekAgo = Date.now() - 7 * 86400000;
      var recentEntries = entries.filter(function(e) {
        return (e.startTs || new Date(e.date).getTime()) > weekAgo;
      }).length;
      scores.push(clamp(recentEntries * 15, 0, 100));

      return scores.length ? Math.round(avg(scores)) : 50;
    }
  };

  /* ================================================================
     TREND ANALYSIS
     Week-over-week, month-over-month comparisons
     ================================================================ */

  var TrendAnalyzer = {
    weeklyComparison: function() {
      var entries = getTimeEntries();
      var now = new Date();
      var thisWeekStart = new Date(now); thisWeekStart.setDate(now.getDate() - now.getDay());
      var lastWeekStart = new Date(thisWeekStart); lastWeekStart.setDate(lastWeekStart.getDate() - 7);

      var thisWeek = 0, lastWeek = 0;
      var twStr = thisWeekStart.toISOString().split('T')[0];
      var lwStr = lastWeekStart.toISOString().split('T')[0];

      entries.forEach(function(e) {
        var d = e.date || '';
        var h = parseFloat(e.hours || e.duration || 0);
        if (d >= twStr) thisWeek += h;
        else if (d >= lwStr && d < twStr) lastWeek += h;
      });

      var change = lastWeek > 0 ? ((thisWeek - lastWeek) / lastWeek * 100) : 0;
      return { thisWeek: thisWeek, lastWeek: lastWeek, change: change, trend: change > 5 ? 'up' : (change < -5 ? 'down' : 'stable') };
    },

    revenueProjection: function() {
      var entries = getTimeEntries();
      var settings = getSettings();
      var now = new Date();
      var monthStart = now.toISOString().substring(0, 8) + '01';
      var monthHours = 0;

      entries.forEach(function(e) {
        if ((e.date || '') >= monthStart && e.billable !== false) {
          monthHours += parseFloat(e.hours || e.duration || 0);
        }
      });

      var dayOfMonth = now.getDate();
      var daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      var projected = dayOfMonth > 1 ? (monthHours / dayOfMonth * daysInMonth) : monthHours;
      var projectedRevenue = projected * settings.rate;

      return {
        currentHours: monthHours,
        projectedHours: projected,
        currentRevenue: monthHours * settings.rate,
        projectedRevenue: projectedRevenue,
        dayOfMonth: dayOfMonth,
        daysInMonth: daysInMonth,
        symbol: settings.symbol
      };
    },

    hoursByProject: function(days) {
      days = days || 30;
      var entries = getTimeEntries();
      var cutoff = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
      var result = {};

      entries.forEach(function(e) {
        if ((e.date || '') >= cutoff) {
          var p = e.project || 'General';
          result[p] = (result[p] || 0) + parseFloat(e.hours || e.duration || 0);
        }
      });

      return result;
    },

    dailyHoursChart: function(days) {
      days = days || 14;
      var entries = getTimeEntries();
      var result = [];
      for (var i = days - 1; i >= 0; i--) {
        var d = new Date(Date.now() - i * 86400000);
        var dateStr = d.toISOString().split('T')[0];
        var hours = 0;
        entries.forEach(function(e) {
          if ((e.date || '') === dateStr) hours += parseFloat(e.hours || e.duration || 0);
        });
        result.push({ date: dateStr, hours: hours, day: d.toLocaleDateString('en-US', { weekday: 'short' }) });
      }
      return result;
    }
  };

  /* ================================================================
     NOTIFICATION MANAGER
     Real-time alerts with priority and dedup
     ================================================================ */

  var NotificationManager = {
    _dismissed: getJSON('cortex_feed_dismissed', {}),

    isDismissed: function(id) { return !!this._dismissed[id]; },

    dismiss: function(id) {
      this._dismissed[id] = Date.now();
      setJSON('cortex_feed_dismissed', this._dismissed);
    },

    undismiss: function(id) {
      delete this._dismissed[id];
      setJSON('cortex_feed_dismissed', this._dismissed);
    },

    getActiveAlerts: function() {
      var self = this;
      var all = InsightsEngine.riskAlerts();
      return all.filter(function(a) { return !self.isDismissed(a.id); });
    },

    getAlertCount: function() {
      return this.getActiveAlerts().length;
    },

    clearOld: function() {
      var cutoff = Date.now() - 30 * 86400000;
      var d = this._dismissed;
      Object.keys(d).forEach(function(k) { if (d[k] < cutoff) delete d[k]; });
      setJSON('cortex_feed_dismissed', d);
    }
  };

  /* ================================================================
     PUBLIC API
     ================================================================ */

  return {
    // Activity feed
    getActivities: function(opts) { return ActivityAggregator.collectAll(opts); },

    // AI Insights
    getInsights: function() { return InsightsEngine.generateAll(); },
    getWorkPatterns: function() { return InsightsEngine.workPatterns(); },
    getClientHealth: function() { return InsightsEngine.clientHealth(); },
    getRevenueOpportunities: function() { return InsightsEngine.revenueOpportunities(); },
    getProductivitySuggestions: function() { return InsightsEngine.productivitySuggestions(); },
    getRiskAlerts: function() { return InsightsEngine.riskAlerts(); },
    getBusinessHealth: function() { return InsightsEngine.businessHealthScore(); },

    // Trends
    getWeeklyComparison: function() { return TrendAnalyzer.weeklyComparison(); },
    getRevenueProjection: function() { return TrendAnalyzer.revenueProjection(); },
    getHoursByProject: function(d) { return TrendAnalyzer.hoursByProject(d); },
    getDailyChart: function(d) { return TrendAnalyzer.dailyHoursChart(d); },

    // Notifications
    dismissAlert: function(id) { NotificationManager.dismiss(id); },
    undismissAlert: function(id) { NotificationManager.undismiss(id); },
    getActiveAlerts: function() { return NotificationManager.getActiveAlerts(); },
    getAlertCount: function() { return NotificationManager.getAlertCount(); },

    // Preferences
    getPrefs: function() { return getJSON(PREFS_KEY, { showInsights: true, showTimeline: true, feedDays: 30, compactMode: false }); },
    setPrefs: function(p) { setJSON(PREFS_KEY, p); },

    // Utils
    timeAgo: timeAgo,
    version: '1.0.0'
  };
});
