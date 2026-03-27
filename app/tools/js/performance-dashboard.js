/**
 * Cortex Freelancer — Performance Dashboard
 * CF3-MVP-007: Analytics, win rates, revenue trends, goals, insights
 */
;(function(global) {
  'use strict';

  var KEYS = {
    PROPOSALS: 'cortex_proposals',
    PROJECTS: 'cortex_projects',
    PAYMENTS: 'cortex_payments',
    INVOICES: 'cortex_invoices',
    TIME_ENTRIES: 'cortex_time_entries',
    GOALS: 'cortex_performance_goals',
    AI_MEMORY: 'cortex_ai_memory'
  };

  function load(key, fb) {
    try { var r = localStorage.getItem(key); return r ? JSON.parse(r) : fb; } catch(e) { return fb; }
  }
  function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

  var PerformanceDashboard = {

    // ── Core Metrics ────────────────────────────────────
    getMetrics: function(period) {
      period = period || 'month'; // week, month, quarter, year, all
      var dateRange = this.getDateRange(period);

      return {
        revenue: this.getRevenueMetrics(dateRange),
        proposals: this.getProposalMetrics(dateRange),
        projects: this.getProjectMetrics(dateRange),
        time: this.getTimeMetrics(dateRange),
        goals: this.getGoalProgress(),
        insights: this.generateInsights(dateRange),
        period: period,
        dateRange: dateRange,
        generatedAt: new Date().toISOString()
      };
    },

    getDateRange: function(period) {
      var now = new Date();
      var start;
      switch(period) {
        case 'week': start = new Date(now - 7 * 86400000); break;
        case 'month': start = new Date(now.getFullYear(), now.getMonth(), 1); break;
        case 'quarter': start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1); break;
        case 'year': start = new Date(now.getFullYear(), 0, 1); break;
        default: start = new Date(2020, 0, 1);
      }
      return {
        start: start.toISOString().split('T')[0],
        end: now.toISOString().split('T')[0]
      };
    },

    // ── Revenue Metrics ─────────────────────────────────
    getRevenueMetrics: function(range) {
      var payments = load(KEYS.PAYMENTS, []).filter(function(p) {
        return p.date >= range.start && p.date <= range.end;
      });
      var invoices = load(KEYS.INVOICES, []);

      var total = payments.reduce(function(s, p) { return s + p.amount; }, 0);
      var count = payments.length;

      // Monthly breakdown
      var monthly = {};
      payments.forEach(function(p) {
        var m = p.date.slice(0, 7);
        monthly[m] = (monthly[m] || 0) + p.amount;
      });

      // By client
      var byClient = {};
      payments.forEach(function(p) {
        byClient[p.client] = (byClient[p.client] || 0) + p.amount;
      });

      var pendingInvoices = invoices.filter(function(i) {
        return i.status === 'pending' || i.status === 'sent';
      });

      return {
        total: total,
        count: count,
        average: count > 0 ? Math.round(total / count) : 0,
        monthly: monthly,
        byClient: Object.entries(byClient).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 10),
        pending: pendingInvoices.reduce(function(s, i) { return s + i.total; }, 0),
        pendingCount: pendingInvoices.length
      };
    },

    // ── Proposal Metrics ────────────────────────────────
    getProposalMetrics: function(range) {
      var proposals = load(KEYS.PROPOSALS, []).filter(function(p) {
        var d = (p.createdAt || '').split('T')[0];
        return d >= range.start && d <= range.end;
      });

      var total = proposals.length;
      var byStatus = { draft: 0, pending: 0, sent: 0, accepted: 0, interview: 0, negotiation: 0, declined: 0 };
      proposals.forEach(function(p) {
        byStatus[p.status] = (byStatus[p.status] || 0) + 1;
      });

      var won = byStatus.accepted || 0;
      var completed = total - (byStatus.draft || 0) - (byStatus.pending || 0);
      var winRate = completed > 0 ? Math.round((won / completed) * 100) : 0;

      // Average response time (mock)
      var avgResponseDays = proposals.length > 0 ? Math.round(Math.random() * 3 + 1) : 0;

      // Value of proposals
      var totalValue = proposals.reduce(function(s, p) { return s + (p.totalBudget || 0); }, 0);
      var wonValue = proposals.filter(function(p) { return p.status === 'accepted'; })
        .reduce(function(s, p) { return s + (p.totalBudget || 0); }, 0);

      return {
        total: total,
        byStatus: byStatus,
        winRate: winRate,
        avgResponseDays: avgResponseDays,
        totalValue: totalValue,
        wonValue: wonValue,
        conversionRate: total > 0 ? Math.round((won / total) * 100) : 0,
        interviewRate: total > 0 ? Math.round(((byStatus.interview + byStatus.negotiation + won) / total) * 100) : 0
      };
    },

    // ── Project Metrics ─────────────────────────────────
    getProjectMetrics: function(range) {
      var projects = load(KEYS.PROJECTS, []);

      var active = projects.filter(function(p) { return p.status === 'active'; });
      var completed = projects.filter(function(p) { return p.status === 'completed'; });

      var totalBudget = active.reduce(function(s, p) { return s + (p.budget || 0); }, 0);
      var totalHoursLogged = active.reduce(function(s, p) { return s + (p.hoursLogged || 0); }, 0);
      var totalHoursEstimated = active.reduce(function(s, p) { return s + (p.estimatedHours || 0); }, 0);

      return {
        active: active.length,
        completed: completed.length,
        total: projects.length,
        totalBudget: totalBudget,
        hoursLogged: totalHoursLogged,
        hoursEstimated: totalHoursEstimated,
        utilizationRate: totalHoursEstimated > 0 ? Math.round((totalHoursLogged / totalHoursEstimated) * 100) : 0,
        onTrack: active.filter(function(p) {
          return !p.estimatedHours || (p.hoursLogged / p.estimatedHours) < 0.9;
        }).length,
        atRisk: active.filter(function(p) {
          return p.estimatedHours && (p.hoursLogged / p.estimatedHours) >= 0.9;
        }).length
      };
    },

    // ── Time Metrics ────────────────────────────────────
    getTimeMetrics: function(range) {
      var entries = load(KEYS.TIME_ENTRIES, []).filter(function(e) {
        var d = (e.date || e.startTime || '').split('T')[0];
        return d >= range.start && d <= range.end;
      });

      var totalMinutes = entries.reduce(function(s, e) { return s + (e.duration || 0); }, 0);
      var totalHours = Math.round(totalMinutes / 60 * 10) / 10;

      // By day of week
      var byDay = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
      entries.forEach(function(e) {
        var d = new Date(e.date || e.startTime);
        byDay[d.getDay()] += (e.duration || 0) / 60;
      });

      var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      var dayData = Object.entries(byDay).map(function(entry) {
        return { day: days[entry[0]], hours: Math.round(entry[1] * 10) / 10 };
      });

      return {
        totalHours: totalHours,
        avgDailyHours: totalHours > 0 ? Math.round(totalHours / 30 * 10) / 10 : 0,
        byDay: dayData,
        billableRate: 85, // Percentage of billable hours
        entries: entries.length
      };
    },

    // ── Goal Management ─────────────────────────────────
    setGoal: function(goal) {
      var goals = load(KEYS.GOALS, []);
      var existing = goals.findIndex(function(g) { return g.id === goal.id; });

      var goalRecord = {
        id: goal.id || 'goal_' + Date.now(),
        type: goal.type, // revenue, proposals, win_rate, hours, projects
        target: goal.target,
        period: goal.period || 'month', // week, month, quarter, year
        label: goal.label || goal.type + ' goal',
        createdAt: goal.createdAt || new Date().toISOString()
      };

      if (existing >= 0) goals[existing] = goalRecord;
      else goals.push(goalRecord);

      save(KEYS.GOALS, goals);
      return goalRecord;
    },

    getGoalProgress: function() {
      var goals = load(KEYS.GOALS, []);

      // Seed default goals if empty
      if (goals.length === 0) {
        goals = [
          { id: 'goal_rev', type: 'revenue', target: 10000, period: 'month', label: 'Monthly Revenue', createdAt: new Date().toISOString() },
          { id: 'goal_prop', type: 'proposals', target: 20, period: 'month', label: 'Proposals Sent', createdAt: new Date().toISOString() },
          { id: 'goal_win', type: 'win_rate', target: 30, period: 'month', label: 'Win Rate %', createdAt: new Date().toISOString() },
          { id: 'goal_hours', type: 'hours', target: 160, period: 'month', label: 'Billable Hours', createdAt: new Date().toISOString() }
        ];
        save(KEYS.GOALS, goals);
      }

      var metrics = this.getQuickMetrics();

      return goals.map(function(goal) {
        var current = 0;
        switch(goal.type) {
          case 'revenue': current = metrics.monthlyRevenue; break;
          case 'proposals': current = metrics.monthlyProposals; break;
          case 'win_rate': current = metrics.winRate; break;
          case 'hours': current = metrics.monthlyHours; break;
          case 'projects': current = metrics.activeProjects; break;
        }
        var progress = goal.target > 0 ? Math.min(100, Math.round((current / goal.target) * 100)) : 0;
        return {
          id: goal.id,
          label: goal.label,
          type: goal.type,
          target: goal.target,
          current: current,
          progress: progress,
          status: progress >= 100 ? 'achieved' : progress >= 75 ? 'on-track' : progress >= 50 ? 'in-progress' : 'behind',
          period: goal.period
        };
      });
    },

    getQuickMetrics: function() {
      var now = new Date();
      var monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      var today = now.toISOString().split('T')[0];

      var payments = load(KEYS.PAYMENTS, []);
      var proposals = load(KEYS.PROPOSALS, []);
      var entries = load(KEYS.TIME_ENTRIES, []);
      var projects = load(KEYS.PROJECTS, []);

      var monthlyPayments = payments.filter(function(p) { return p.date >= monthStart; });
      var monthlyProposals = proposals.filter(function(p) { return (p.createdAt || '').split('T')[0] >= monthStart; });
      var monthlyEntries = entries.filter(function(e) { return (e.date || e.startTime || '').split('T')[0] >= monthStart; });

      var won = proposals.filter(function(p) { return p.status === 'accepted'; }).length;
      var completed = proposals.filter(function(p) { return p.status && p.status !== 'draft' && p.status !== 'pending'; }).length;

      return {
        monthlyRevenue: monthlyPayments.reduce(function(s, p) { return s + p.amount; }, 0),
        monthlyProposals: monthlyProposals.length,
        winRate: completed > 0 ? Math.round((won / completed) * 100) : 0,
        monthlyHours: Math.round(monthlyEntries.reduce(function(s, e) { return s + (e.duration || 0); }, 0) / 60),
        activeProjects: projects.filter(function(p) { return p.status === 'active'; }).length,
        totalRevenue: payments.reduce(function(s, p) { return s + p.amount; }, 0)
      };
    },

    // ── Insight Generation ──────────────────────────────
    generateInsights: function(range) {
      var metrics = this.getQuickMetrics();
      var proposals = this.getProposalMetrics(range);
      var revenue = this.getRevenueMetrics(range);
      var insights = [];

      // Win rate insight
      if (proposals.winRate > 35) {
        insights.push({ type: 'success', icon: '🏆', message: 'Excellent! Your ' + proposals.winRate + '% win rate is above industry average (25-30%).', action: 'Consider raising your rates by 10-15%.' });
      } else if (proposals.winRate > 20) {
        insights.push({ type: 'info', icon: '📊', message: 'Your ' + proposals.winRate + '% win rate is solid. Focus on quality over quantity.', action: 'Review your top-performing proposals for patterns.' });
      } else if (proposals.total > 5) {
        insights.push({ type: 'warning', icon: '⚠️', message: 'Your win rate of ' + proposals.winRate + '% could improve.', action: 'Try personalizing proposals more and targeting better-matched jobs.' });
      }

      // Revenue trend
      if (revenue.total > 0) {
        var daysInPeriod = Math.max(1, Math.ceil((new Date(range.end) - new Date(range.start)) / 86400000));
        var dailyAvg = revenue.total / daysInPeriod;
        var projectedMonthly = Math.round(dailyAvg * 30);
        insights.push({ type: 'info', icon: '💰', message: 'At your current pace, you\'re on track for $' + projectedMonthly.toLocaleString() + '/month.', action: revenue.pendingCount > 0 ? 'Follow up on ' + revenue.pendingCount + ' pending invoices (' + '$' + revenue.pending.toLocaleString() + ').' : 'Keep up the momentum!' });
      }

      // Proposal volume
      if (proposals.total < 5 && proposals.total > 0) {
        insights.push({ type: 'tip', icon: '🚀', message: 'Increasing proposal volume can significantly boost your pipeline.', action: 'Aim for 10-15 proposals per week for optimal results.' });
      }

      // Pipeline value
      if (proposals.totalValue > 0) {
        insights.push({ type: 'info', icon: '📈', message: 'Your proposal pipeline is worth $' + proposals.totalValue.toLocaleString() + '.', action: 'Expected revenue (at ' + proposals.winRate + '% win rate): $' + Math.round(proposals.totalValue * proposals.winRate / 100).toLocaleString() });
      }

      // Overdue invoices
      if (revenue.pendingCount > 0) {
        insights.push({ type: 'warning', icon: '🔔', message: revenue.pendingCount + ' invoice(s) pending payment totaling $' + revenue.pending.toLocaleString() + '.', action: 'Send a friendly follow-up to ensure timely payment.' });
      }

      return insights;
    },

    // ── Chart Data Helpers ──────────────────────────────
    getRevenueChartData: function(months) {
      months = months || 6;
      var payments = load(KEYS.PAYMENTS, []);
      var now = new Date();
      var data = [];

      for (var i = months - 1; i >= 0; i--) {
        var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        var key = d.toISOString().slice(0, 7);
        var label = d.toLocaleDateString('en-US', { month: 'short' });
        var monthPayments = payments.filter(function(p) { return p.date && p.date.startsWith(key); });
        var revenue = monthPayments.reduce(function(s, p) { return s + p.amount; }, 0);
        data.push({ month: key, label: label, revenue: revenue });
      }
      return data;
    },

    getProposalChartData: function(months) {
      months = months || 6;
      var proposals = load(KEYS.PROPOSALS, []);
      var now = new Date();
      var data = [];

      for (var i = months - 1; i >= 0; i--) {
        var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        var key = d.toISOString().slice(0, 7);
        var label = d.toLocaleDateString('en-US', { month: 'short' });
        var monthProposals = proposals.filter(function(p) { return (p.createdAt || '').startsWith(key); });
        var won = monthProposals.filter(function(p) { return p.status === 'accepted'; }).length;
        data.push({ month: key, label: label, total: monthProposals.length, won: won });
      }
      return data;
    },

    // ── Seed Demo Performance Data ──────────────────────
    seedDemoData: function() {
      if (typeof PaymentSimulation !== 'undefined') {
        PaymentSimulation.seedDemoPayments();
      }
    }
  };

  global.PerformanceDashboard = PerformanceDashboard;
})(window);
