#!/usr/bin/env node
/**
 * Performance Analytics Dashboard
 * Sprint 2 Task 15 — Cortex Freelancer
 *
 * Unified dashboard aggregating data from all Cortex tools:
 * revenue, time, clients, projects, rates, productivity.
 * KPIs, trends, health scores, and actionable insights.
 */

const fs = require('fs');
const path = require('path');

// ─── Storage ────────────────────────────────────────────────────────────────

const BASE_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE || '.',
  '.cortex-freelancer'
);

function readJSON(file, fallback = []) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return typeof fallback === 'function' ? fallback() : fallback; }
}

// ─── Data Aggregator ────────────────────────────────────────────────────────

class DataAggregator {
  constructor() {
    // Pull data from all Cortex tools
    this.invoices = readJSON(path.join(BASE_DIR, 'invoices', 'invoices.json'));
    this.payments = readJSON(path.join(BASE_DIR, 'invoices', 'payments.json'));
    this.timeLogs = readJSON(path.join(BASE_DIR, 'time-tracking', 'entries.json'));
    this.projects = readJSON(path.join(BASE_DIR, 'milestones', 'projects.json'));
    this.milestones = readJSON(path.join(BASE_DIR, 'milestones', 'milestones.json'));
    this.testimonials = readJSON(path.join(BASE_DIR, 'testimonials', 'testimonials.json'));
    this.communications = readJSON(path.join(BASE_DIR, 'communications', 'messages.json'));
    this.contracts = readJSON(path.join(BASE_DIR, 'contracts', 'contracts.json'));
    this.proposals = readJSON(path.join(BASE_DIR, 'proposals', 'proposals.json'));
  }
}

// ─── Performance Dashboard ──────────────────────────────────────────────────

class PerformanceDashboard {
  constructor() {
    this.data = new DataAggregator();
    this.now = new Date();
  }

  // ── Revenue Analytics ───────────────────────────────────────────────────

  getRevenueAnalytics() {
    const inv = this.data.invoices;
    const pay = this.data.payments;

    // Monthly revenue (last 12 months)
    const monthly = {};
    for (let i = 0; i < 12; i++) {
      const d = new Date(this.now);
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthly[key] = { invoiced: 0, collected: 0 };
    }

    for (const i of inv) {
      const d = new Date(i.issueDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthly[key]) monthly[key].invoiced += i.total || 0;
    }
    for (const p of pay) {
      const d = new Date(p.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthly[key]) monthly[key].collected += p.amount || 0;
    }

    // Current month
    const thisMonth = `${this.now.getFullYear()}-${String(this.now.getMonth() + 1).padStart(2, '0')}`;
    const lastMonth = (() => {
      const d = new Date(this.now);
      d.setMonth(d.getMonth() - 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    })();

    const thisMonthRev = monthly[thisMonth]?.collected || 0;
    const lastMonthRev = monthly[lastMonth]?.collected || 0;
    const growthPct = lastMonthRev > 0
      ? (((thisMonthRev - lastMonthRev) / lastMonthRev) * 100).toFixed(1)
      : 'N/A';

    // Outstanding
    const outstanding = inv
      .filter(i => !['paid', 'cancelled'].includes(i.status))
      .reduce((s, i) => s + ((i.total || 0) - (i.paidAmount || 0)), 0);

    const overdue = inv
      .filter(i => !['paid', 'cancelled', 'draft'].includes(i.status) && new Date(i.dueDate) < this.now)
      .reduce((s, i) => s + ((i.total || 0) - (i.paidAmount || 0)), 0);

    // YTD
    const ytdStart = new Date(this.now.getFullYear(), 0, 1);
    const ytdRevenue = pay
      .filter(p => new Date(p.date) >= ytdStart)
      .reduce((s, p) => s + (p.amount || 0), 0);

    // Average invoice
    const paidInvoices = inv.filter(i => i.status === 'paid');
    const avgInvoice = paidInvoices.length > 0
      ? paidInvoices.reduce((s, i) => s + (i.total || 0), 0) / paidInvoices.length
      : 0;

    // Collection speed (avg days to get paid)
    const collectionDays = paidInvoices
      .filter(i => i.paidDate && i.issueDate)
      .map(i => (new Date(i.paidDate) - new Date(i.issueDate)) / 86400000);
    const avgCollectionDays = collectionDays.length > 0
      ? (collectionDays.reduce((s, d) => s + d, 0) / collectionDays.length).toFixed(0)
      : 'N/A';

    return {
      monthlyRevenue: Object.entries(monthly)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, data]) => ({
          month,
          invoiced: `$${data.invoiced.toFixed(0)}`,
          collected: `$${data.collected.toFixed(0)}`,
        })),
      currentMonth: {
        revenue: `$${thisMonthRev.toFixed(0)}`,
        growth: growthPct !== 'N/A' ? `${growthPct}%` : 'N/A',
        trend: growthPct === 'N/A' ? '—' : parseFloat(growthPct) > 0 ? '📈' : '📉',
      },
      outstanding: `$${outstanding.toFixed(0)}`,
      overdue: `$${overdue.toFixed(0)}`,
      ytdRevenue: `$${ytdRevenue.toFixed(0)}`,
      averageInvoice: `$${avgInvoice.toFixed(0)}`,
      avgCollectionDays,
      totalLifetime: `$${pay.reduce((s, p) => s + (p.amount || 0), 0).toFixed(0)}`,
    };
  }

  // ── Productivity Metrics ────────────────────────────────────────────────

  getProductivityMetrics() {
    const entries = this.data.timeLogs;
    const now = this.now;

    // This week's hours
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const thisWeekEntries = entries.filter(e => new Date(e.startTime || e.date) >= weekStart);
    const thisWeekHours = thisWeekEntries.reduce((s, e) => s + ((e.duration || e.hours || 0) / 3600000 || e.hours || 0), 0);

    // This month's hours
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthEntries = entries.filter(e => new Date(e.startTime || e.date) >= monthStart);
    const thisMonthHours = thisMonthEntries.reduce((s, e) => s + ((e.duration || e.hours || 0) / 3600000 || e.hours || 0), 0);

    // Billable vs non-billable
    const billable = entries.filter(e => e.billable !== false);
    const nonBillable = entries.filter(e => e.billable === false);
    const billableHours = billable.reduce((s, e) => s + ((e.duration || e.hours || 0) / 3600000 || e.hours || 0), 0);
    const nonBillableHours = nonBillable.reduce((s, e) => s + ((e.duration || e.hours || 0) / 3600000 || e.hours || 0), 0);
    const totalHours = billableHours + nonBillableHours;
    const utilizationRate = totalHours > 0 ? ((billableHours / totalHours) * 100).toFixed(0) : 'N/A';

    // Effective hourly rate
    const totalRevenue = this.data.payments.reduce((s, p) => s + (p.amount || 0), 0);
    const effectiveRate = billableHours > 0 ? (totalRevenue / billableHours).toFixed(0) : 'N/A';

    return {
      thisWeek: { hours: thisWeekHours.toFixed(1), entries: thisWeekEntries.length },
      thisMonth: { hours: thisMonthHours.toFixed(1), entries: thisMonthEntries.length },
      utilization: {
        billableHours: billableHours.toFixed(1),
        nonBillableHours: nonBillableHours.toFixed(1),
        rate: utilizationRate !== 'N/A' ? `${utilizationRate}%` : 'N/A',
        target: '75%',
        status: utilizationRate !== 'N/A'
          ? parseInt(utilizationRate) >= 75 ? '🟢' : parseInt(utilizationRate) >= 50 ? '🟡' : '🔴'
          : '⚪',
      },
      effectiveHourlyRate: effectiveRate !== 'N/A' ? `$${effectiveRate}/hr` : 'N/A',
      totalTrackedHours: totalHours.toFixed(0),
    };
  }

  // ── Client Health ───────────────────────────────────────────────────────

  getClientHealth() {
    const inv = this.data.invoices;
    const clients = {};

    for (const i of inv) {
      if (!clients[i.clientName]) {
        clients[i.clientName] = {
          name: i.clientName,
          totalInvoiced: 0,
          totalPaid: 0,
          invoiceCount: 0,
          avgPaymentDays: [],
          lastActivity: i.issueDate,
          overdue: 0,
        };
      }

      const c = clients[i.clientName];
      c.totalInvoiced += i.total || 0;
      c.totalPaid += i.paidAmount || 0;
      c.invoiceCount++;

      if (new Date(i.issueDate) > new Date(c.lastActivity)) {
        c.lastActivity = i.issueDate;
      }

      if (i.paidDate && i.issueDate) {
        c.avgPaymentDays.push((new Date(i.paidDate) - new Date(i.issueDate)) / 86400000);
      }

      if (!['paid', 'cancelled', 'draft'].includes(i.status) && new Date(i.dueDate) < this.now) {
        c.overdue++;
      }
    }

    return Object.values(clients).map(c => {
      const avgDays = c.avgPaymentDays.length > 0
        ? Math.round(c.avgPaymentDays.reduce((s, d) => s + d, 0) / c.avgPaymentDays.length)
        : null;

      const daysSinceActivity = Math.floor((this.now - new Date(c.lastActivity)) / 86400000);

      // Health score (0-100)
      let health = 100;
      if (c.overdue > 0) health -= 20 * c.overdue;
      if (avgDays && avgDays > 30) health -= 10;
      if (avgDays && avgDays > 60) health -= 20;
      if (daysSinceActivity > 90) health -= 15;
      health = Math.max(0, health);

      return {
        client: c.name,
        revenue: `$${c.totalPaid.toFixed(0)}`,
        invoices: c.invoiceCount,
        avgPaymentDays: avgDays ? `${avgDays} days` : 'N/A',
        overdueInvoices: c.overdue,
        daysSinceActivity,
        healthScore: health,
        healthIcon: health >= 80 ? '🟢' : health >= 50 ? '🟡' : '🔴',
        risk: health < 50 ? 'At risk — consider outreach' :
              daysSinceActivity > 60 ? 'Dormant — re-engage' : 'Healthy',
      };
    }).sort((a, b) => b.revenue.replace(/[^0-9]/g, '') - a.revenue.replace(/[^0-9]/g, ''));
  }

  // ── Project Status ──────────────────────────────────────────────────────

  getProjectStatus() {
    const projects = this.data.projects;
    const milestones = this.data.milestones;

    return projects
      .filter(p => p.status === 'active')
      .map(project => {
        const ms = milestones.filter(m => m.projectId === project.id);
        const completed = ms.filter(m => m.status === 'completed').length;
        const blocked = ms.filter(m => m.status === 'blocked').length;
        const overdue = ms.filter(m =>
          m.dueDate && new Date(m.dueDate) < this.now && m.status !== 'completed'
        ).length;
        const progress = ms.length > 0
          ? Math.round(ms.reduce((s, m) => s + (m.progress || 0), 0) / ms.length)
          : 0;

        return {
          name: project.name,
          client: project.clientName,
          progress: `${progress}%`,
          bar: this._bar(progress),
          milestones: `${completed}/${ms.length}`,
          blocked,
          overdue,
          health: overdue > 2 ? '🔴' : overdue > 0 || blocked > 0 ? '🟡' : '🟢',
        };
      });
  }

  // ── Reputation Score ────────────────────────────────────────────────────

  getReputationScore() {
    const t = this.data.testimonials;
    const rated = t.filter(x => x.overallRating);
    const avgRating = rated.length > 0
      ? rated.reduce((s, x) => s + x.overallRating, 0) / rated.length
      : 0;

    const sentiments = { positive: 0, neutral: 0, negative: 0 };
    for (const item of t) sentiments[item.sentiment || 'neutral']++;

    const positiveRate = t.length > 0
      ? ((sentiments.positive / t.length) * 100).toFixed(0)
      : 'N/A';

    return {
      totalTestimonials: t.length,
      averageRating: avgRating.toFixed(1),
      stars: avgRating > 0 ? '⭐'.repeat(Math.round(avgRating)) : 'N/A',
      sentimentBreakdown: sentiments,
      positiveRate: positiveRate !== 'N/A' ? `${positiveRate}%` : 'N/A',
      featured: t.filter(x => x.featured).length,
      npsEstimate: avgRating >= 4.5 ? 'Excellent' : avgRating >= 4 ? 'Good' : avgRating >= 3 ? 'Average' : 'Needs improvement',
    };
  }

  // ── Business Health Score ───────────────────────────────────────────────

  getBusinessHealthScore() {
    const scores = {};

    // Revenue health (0-25)
    const totalRev = this.data.payments.reduce((s, p) => s + (p.amount || 0), 0);
    const overdueAmount = this.data.invoices
      .filter(i => !['paid', 'cancelled', 'draft'].includes(i.status) && new Date(i.dueDate) < this.now)
      .reduce((s, i) => s + ((i.total || 0) - (i.paidAmount || 0)), 0);
    scores.revenue = Math.min(25, totalRev > 0 ? 25 - Math.min(15, (overdueAmount / totalRev) * 25) : 10);

    // Client health (0-25)
    const clients = this.getClientHealth();
    const healthyClients = clients.filter(c => c.healthScore >= 70).length;
    scores.clients = Math.min(25, clients.length > 0 ? (healthyClients / clients.length) * 25 : 15);

    // Productivity (0-25)
    const productivity = this.getProductivityMetrics();
    const util = parseInt(productivity.utilization.rate) || 0;
    scores.productivity = Math.min(25, (util / 100) * 25);

    // Reputation (0-25)
    const rep = this.getReputationScore();
    const rating = parseFloat(rep.averageRating) || 0;
    scores.reputation = Math.min(25, (rating / 5) * 25);

    const total = Math.round(scores.revenue + scores.clients + scores.productivity + scores.reputation);

    return {
      overallScore: total,
      maxScore: 100,
      grade: total >= 90 ? 'A+' : total >= 80 ? 'A' : total >= 70 ? 'B' :
             total >= 60 ? 'C' : total >= 50 ? 'D' : 'F',
      icon: total >= 80 ? '🟢' : total >= 60 ? '🟡' : '🔴',
      breakdown: {
        revenue: { score: Math.round(scores.revenue), max: 25, label: 'Revenue Health' },
        clients: { score: Math.round(scores.clients), max: 25, label: 'Client Relationships' },
        productivity: { score: Math.round(scores.productivity), max: 25, label: 'Productivity' },
        reputation: { score: Math.round(scores.reputation), max: 25, label: 'Reputation' },
      },
      insights: this._generateInsights(scores, total),
    };
  }

  // ── Action Items ────────────────────────────────────────────────────────

  getActionItems() {
    const actions = [];

    // Overdue invoices
    const overdueInvoices = this.data.invoices.filter(i =>
      !['paid', 'cancelled', 'draft'].includes(i.status) && new Date(i.dueDate) < this.now
    );
    if (overdueInvoices.length > 0) {
      actions.push({
        priority: 'high',
        icon: '🔴',
        category: 'revenue',
        action: `${overdueInvoices.length} overdue invoice(s) — send reminders`,
        details: overdueInvoices.slice(0, 3).map(i => `${i.invoiceNumber}: ${i.clientName}`),
      });
    }

    // Blocked milestones
    const blocked = this.data.milestones.filter(m => m.status === 'blocked');
    if (blocked.length > 0) {
      actions.push({
        priority: 'high',
        icon: '⛔',
        category: 'projects',
        action: `${blocked.length} blocked milestone(s) — resolve blockers`,
        details: blocked.map(m => m.title),
      });
    }

    // Draft invoices
    const drafts = this.data.invoices.filter(i => i.status === 'draft');
    if (drafts.length > 0) {
      actions.push({
        priority: 'medium',
        icon: '📝',
        category: 'revenue',
        action: `${drafts.length} draft invoice(s) — review and send`,
      });
    }

    // Overdue milestones
    const overdueMilestones = this.data.milestones.filter(m =>
      m.dueDate && new Date(m.dueDate) < this.now && m.status !== 'completed'
    );
    if (overdueMilestones.length > 0) {
      actions.push({
        priority: 'medium',
        icon: '⏰',
        category: 'projects',
        action: `${overdueMilestones.length} overdue milestone(s) — update timeline`,
      });
    }

    // Upcoming due dates (next 7 days)
    const weekFromNow = new Date(this.now);
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    const upcoming = this.data.milestones.filter(m =>
      m.dueDate && new Date(m.dueDate) >= this.now && new Date(m.dueDate) <= weekFromNow &&
      m.status !== 'completed'
    );
    if (upcoming.length > 0) {
      actions.push({
        priority: 'medium',
        icon: '📅',
        category: 'projects',
        action: `${upcoming.length} milestone(s) due this week`,
        details: upcoming.map(m => `${m.title} (${new Date(m.dueDate).toLocaleDateString()})`),
      });
    }

    // Low testimonial count
    if (this.data.testimonials.length < 5) {
      actions.push({
        priority: 'low',
        icon: '⭐',
        category: 'reputation',
        action: 'Collect more testimonials to boost credibility',
      });
    }

    return actions.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.priority] - order[b.priority];
    });
  }

  // ── Full Dashboard ──────────────────────────────────────────────────────

  getFullDashboard() {
    return {
      generatedAt: this.now.toISOString(),
      healthScore: this.getBusinessHealthScore(),
      revenue: this.getRevenueAnalytics(),
      productivity: this.getProductivityMetrics(),
      projects: this.getProjectStatus(),
      clients: this.getClientHealth(),
      reputation: this.getReputationScore(),
      actionItems: this.getActionItems(),
    };
  }

  // ── Summary (Quick View) ────────────────────────────────────────────────

  getSummary() {
    const health = this.getBusinessHealthScore();
    const rev = this.getRevenueAnalytics();
    const prod = this.getProductivityMetrics();
    const actions = this.getActionItems();

    const lines = [
      `⚡ Cortex Freelancer — Performance Dashboard`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      '',
      `${health.icon} Business Health: ${health.overallScore}/100 (${health.grade})`,
      `   Revenue: ${health.breakdown.revenue.score}/25 | Clients: ${health.breakdown.clients.score}/25`,
      `   Productivity: ${health.breakdown.productivity.score}/25 | Reputation: ${health.breakdown.reputation.score}/25`,
      '',
      `💰 Revenue`,
      `   This Month: ${rev.currentMonth.revenue} ${rev.currentMonth.trend}`,
      `   Outstanding: ${rev.outstanding} | Overdue: ${rev.overdue}`,
      `   YTD: ${rev.ytdRevenue} | Avg Invoice: ${rev.averageInvoice}`,
      '',
      `⏱️  Productivity`,
      `   This Week: ${prod.thisWeek.hours}h | This Month: ${prod.thisMonth.hours}h`,
      `   Utilization: ${prod.utilization.rate} ${prod.utilization.status}`,
      `   Effective Rate: ${prod.effectiveHourlyRate}`,
      '',
    ];

    if (actions.length > 0) {
      lines.push(`📋 Action Items (${actions.length})`);
      for (const a of actions.slice(0, 5)) {
        lines.push(`   ${a.icon} [${a.priority}] ${a.action}`);
      }
    }

    return lines.join('\n');
  }

  // ── Private Helpers ─────────────────────────────────────────────────────

  _bar(pct, width = 15) {
    const filled = Math.round((pct / 100) * width);
    return '█'.repeat(filled) + '░'.repeat(width - filled);
  }

  _generateInsights(scores, total) {
    const insights = [];

    if (scores.revenue < 15) {
      insights.push('💡 Revenue health needs attention — follow up on overdue invoices');
    }
    if (scores.clients < 15) {
      insights.push('💡 Some client relationships need nurturing — check overdue payments');
    }
    if (scores.productivity < 15) {
      insights.push('💡 Utilization rate is low — review time allocation');
    }
    if (scores.reputation < 15) {
      insights.push('💡 Collect more testimonials to improve your reputation score');
    }
    if (total >= 80) {
      insights.push('🎉 Great overall health! Keep up the momentum');
    }

    return insights;
  }
}

// ─── CLI ────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const dashboard = new PerformanceDashboard();

  const commands = {
    summary: () => {
      console.log(dashboard.getSummary());
    },

    full: () => {
      console.log(JSON.stringify(dashboard.getFullDashboard(), null, 2));
    },

    health: () => {
      console.log(JSON.stringify(dashboard.getBusinessHealthScore(), null, 2));
    },

    revenue: () => {
      console.log(JSON.stringify(dashboard.getRevenueAnalytics(), null, 2));
    },

    productivity: () => {
      console.log(JSON.stringify(dashboard.getProductivityMetrics(), null, 2));
    },

    clients: () => {
      console.log(JSON.stringify(dashboard.getClientHealth(), null, 2));
    },

    projects: () => {
      console.log(JSON.stringify(dashboard.getProjectStatus(), null, 2));
    },

    reputation: () => {
      console.log(JSON.stringify(dashboard.getReputationScore(), null, 2));
    },

    actions: () => {
      const items = dashboard.getActionItems();
      if (items.length === 0) {
        console.log('✅ No action items — everything looks good!');
      } else {
        console.log('📋 Action Items:\n');
        for (const a of items) {
          console.log(`${a.icon} [${a.priority.toUpperCase()}] ${a.action}`);
          if (a.details) {
            for (const d of a.details) console.log(`   → ${d}`);
          }
        }
      }
    },

    help: () => {
      console.log(`
Performance Dashboard — Cortex Freelancer

Commands:
  summary       Quick text overview (default)
  full          Complete JSON dashboard
  health        Business health score breakdown
  revenue       Revenue analytics & trends
  productivity  Time tracking & utilization
  clients       Client health & relationships
  projects      Active project status
  reputation    Testimonial & rating metrics
  actions       Prioritized action items
      `);
    },
  };

  (commands[cmd] || commands.summary)();
}

main();
