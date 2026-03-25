#!/usr/bin/env node
/**
 * Productivity Metrics Dashboard with Optimization Recommendations
 *
 * Comprehensive productivity tracking and analysis for freelancers.
 * Features: scoring, revenue/hour, velocity, focus ratio, client profitability,
 * benchmarking, AI-powered recommendations, trend visualization.
 *
 * CFX-069 Implementation
 */

import fs from 'fs';
import path from 'path';
import { Command } from 'commander';

// ── Types ──────────────────────────────────────────────────────────────

export interface TimeEntry {
  id: string;
  date: string;            // YYYY-MM-DD
  startTime: string;       // HH:mm
  endTime: string;         // HH:mm
  durationMinutes: number;
  projectId: string;
  clientId: string;
  taskType: TaskType;
  description: string;
  tags: string[];
  completed: boolean;
}

export type TaskType = 'focus' | 'admin' | 'meeting' | 'learning' | 'break';

export interface Project {
  id: string;
  name: string;
  clientId: string;
  budgetHours: number;
  ratePerHour: number;
  startDate: string;
  deadline?: string;
  status: 'active' | 'completed' | 'paused';
  tasks: Task[];
}

export interface Task {
  id: string;
  title: string;
  estimatedMinutes: number;
  actualMinutes?: number;
  status: 'todo' | 'in-progress' | 'done';
  completedAt?: string;
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  ratePerHour: number;
  projects: string[];       // project IDs
  totalRevenue: number;
  totalHours: number;
}

export interface Goal {
  id: string;
  name: string;
  metric: GoalMetric;
  target: number;
  period: Period;
  createdAt: string;
}

export type GoalMetric =
  | 'productivity_score'
  | 'revenue_per_hour'
  | 'focus_ratio'
  | 'task_completion_rate'
  | 'weekly_hours'
  | 'daily_tasks_completed';

export type Period = 'daily' | 'weekly' | 'monthly';

export interface ProductivityScore {
  score: number;            // 0-100
  period: Period;
  date: string;
  breakdown: ScoreBreakdown;
}

export interface ScoreBreakdown {
  focusTimeScore: number;        // 0-25
  taskCompletionScore: number;   // 0-25
  revenueEfficiencyScore: number;// 0-25
  consistencyScore: number;      // 0-25
}

export interface RevenueMetrics {
  revenuePerHour: number;
  totalRevenue: number;
  totalBillableHours: number;
  byProject: { projectId: string; projectName: string; revenuePerHour: number; totalRevenue: number; totalHours: number }[];
  byClient: { clientId: string; clientName: string; revenuePerHour: number; totalRevenue: number; totalHours: number }[];
}

export interface VelocityMetrics {
  completionRate: number;        // 0-1
  averageTaskMinutes: number;
  tasksCompletedPerDay: number;
  estimationAccuracy: number;    // ratio actual/estimated
  trend: 'improving' | 'declining' | 'stable';
}

export interface FocusRatio {
  focusMinutes: number;
  adminMinutes: number;
  meetingMinutes: number;
  learningMinutes: number;
  breakMinutes: number;
  totalMinutes: number;
  focusPercentage: number;
  adminPercentage: number;
  ratio: number;                 // focus / admin
}

export interface ClientProfitability {
  clientId: string;
  clientName: string;
  effectiveRate: number;
  totalRevenue: number;
  totalHours: number;
  overheadHours: number;         // admin/meeting hours for this client
  profitabilityScore: number;    // 0-100
  rank: number;
}

export interface Benchmark {
  metric: string;
  current: number;
  goal: number;
  average: number;               // personal historical average
  best: number;                  // personal best
  percentOfGoal: number;
  status: 'above' | 'on-track' | 'below';
}

export interface Recommendation {
  id: string;
  type: RecommendationType;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
  actionable: string;
  dataPoints: string[];
}

export type RecommendationType =
  | 'time-optimization'
  | 'client-management'
  | 'task-planning'
  | 'focus-improvement'
  | 'revenue-optimization'
  | 'workload-balance';

export interface TrendData {
  labels: string[];
  datasets: TrendDataset[];
}

export interface TrendDataset {
  label: string;
  data: number[];
  type: 'line' | 'bar' | 'area';
}

export interface DashboardData {
  generatedAt: string;
  period: Period;
  dateRange: { start: string; end: string };
  productivityScore: ProductivityScore;
  revenue: RevenueMetrics;
  velocity: VelocityMetrics;
  focusRatio: FocusRatio;
  clientProfitability: ClientProfitability[];
  benchmarks: Benchmark[];
  recommendations: Recommendation[];
  trends: { [key: string]: TrendData };
}

// ── Data Store ─────────────────────────────────────────────────────────

export class DataStore {
  private dataDir: string;

  constructor(dataDir?: string) {
    this.dataDir = dataDir || path.join(process.cwd(), 'data', 'productivity');
    this.ensureDir(this.dataDir);
  }

  getDataDir(): string { return this.dataDir; }

  // Time entries
  getTimeEntries(): TimeEntry[] { return this.load<TimeEntry[]>('time-entries.json', []); }
  saveTimeEntries(entries: TimeEntry[]): void { this.save('time-entries.json', entries); }
  addTimeEntry(entry: TimeEntry): void {
    const entries = this.getTimeEntries();
    entries.push(entry);
    this.saveTimeEntries(entries);
  }

  // Projects
  getProjects(): Project[] { return this.load<Project[]>('projects.json', []); }
  saveProjects(projects: Project[]): void { this.save('projects.json', projects); }
  addProject(project: Project): void {
    const projects = this.getProjects();
    projects.push(project);
    this.saveProjects(projects);
  }

  // Clients
  getClients(): Client[] { return this.load<Client[]>('clients.json', []); }
  saveClients(clients: Client[]): void { this.save('clients.json', clients); }
  addClient(client: Client): void {
    const clients = this.getClients();
    clients.push(client);
    this.saveClients(clients);
  }

  // Goals
  getGoals(): Goal[] { return this.load<Goal[]>('goals.json', []); }
  saveGoals(goals: Goal[]): void { this.save('goals.json', goals); }
  addGoal(goal: Goal): void {
    const goals = this.getGoals();
    goals.push(goal);
    this.saveGoals(goals);
  }

  // Historical scores (for trend tracking)
  getScoreHistory(): ProductivityScore[] { return this.load<ProductivityScore[]>('score-history.json', []); }
  saveScoreHistory(scores: ProductivityScore[]): void { this.save('score-history.json', scores); }
  appendScore(score: ProductivityScore): void {
    const history = this.getScoreHistory();
    history.push(score);
    this.saveScoreHistory(history);
  }

  private load<T>(filename: string, fallback: T): T {
    const filePath = path.join(this.dataDir, filename);
    if (!fs.existsSync(filePath)) return fallback;
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      return fallback;
    }
  }

  private save(filename: string, data: any): void {
    const filePath = path.join(this.dataDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

// ── Utilities ──────────────────────────────────────────────────────────

export function dateRange(period: Period, referenceDate?: string): { start: string; end: string } {
  const ref = referenceDate ? new Date(referenceDate + 'T00:00:00') : new Date();
  const end = formatDate(ref);

  switch (period) {
    case 'daily':
      return { start: end, end };
    case 'weekly': {
      const dayOfWeek = ref.getDay();
      const monday = new Date(ref);
      monday.setDate(ref.getDate() - ((dayOfWeek + 6) % 7));
      return { start: formatDate(monday), end };
    }
    case 'monthly': {
      const firstDay = new Date(ref.getFullYear(), ref.getMonth(), 1);
      return { start: formatDate(firstDay), end };
    }
  }
}

export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function filterEntriesByRange(entries: TimeEntry[], start: string, end: string): TimeEntry[] {
  return entries.filter(e => e.date >= start && e.date <= end);
}

function dayOfWeekName(dateStr: string): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date(dateStr + 'T00:00:00').getDay()];
}

function timeOfDayBucket(startTime: string): 'morning' | 'afternoon' | 'evening' {
  const hour = parseInt(startTime.split(':')[0], 10);
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

// ── Scoring Engine ─────────────────────────────────────────────────────

export class ScoringEngine {
  /**
   * Calculate productivity score for a period.
   * Score is 0-100 composed of four 25-point sub-scores.
   */
  calculate(
    entries: TimeEntry[],
    projects: Project[],
    goals: Goal[],
    period: Period,
    referenceDate?: string,
  ): ProductivityScore {
    const range = dateRange(period, referenceDate);
    const filtered = filterEntriesByRange(entries, range.start, range.end);

    const focusTimeScore = this.scoreFocusTime(filtered, period);
    const taskCompletionScore = this.scoreTaskCompletion(projects, range);
    const revenueEfficiencyScore = this.scoreRevenueEfficiency(filtered, projects);
    const consistencyScore = this.scoreConsistency(filtered, period, range);

    const total = focusTimeScore + taskCompletionScore + revenueEfficiencyScore + consistencyScore;

    return {
      score: Math.round(total),
      period,
      date: range.end,
      breakdown: {
        focusTimeScore: Math.round(focusTimeScore * 10) / 10,
        taskCompletionScore: Math.round(taskCompletionScore * 10) / 10,
        revenueEfficiencyScore: Math.round(revenueEfficiencyScore * 10) / 10,
        consistencyScore: Math.round(consistencyScore * 10) / 10,
      },
    };
  }

  private scoreFocusTime(entries: TimeEntry[], period: Period): number {
    const focusMinutes = entries.filter(e => e.taskType === 'focus').reduce((s, e) => s + e.durationMinutes, 0);
    const totalMinutes = entries.reduce((s, e) => s + e.durationMinutes, 0);
    if (totalMinutes === 0) return 0;

    const focusRatio = focusMinutes / totalMinutes;
    // Target: 60%+ focus → 25, scale linearly
    return Math.min(25, (focusRatio / 0.6) * 25);
  }

  private scoreTaskCompletion(projects: Project[], range: { start: string; end: string }): number {
    let completed = 0;
    let total = 0;
    for (const project of projects) {
      for (const task of project.tasks) {
        if (task.createdAt <= range.end) {
          total++;
          if (task.status === 'done' && task.completedAt && task.completedAt <= range.end) {
            completed++;
          }
        }
      }
    }
    if (total === 0) return 25; // no tasks = perfect (nothing overdue)
    const rate = completed / total;
    return Math.min(25, rate * 25);
  }

  private scoreRevenueEfficiency(entries: TimeEntry[], projects: Project[]): number {
    const projectMap = new Map(projects.map(p => [p.id, p]));
    let totalRevenue = 0;
    let totalHours = 0;
    for (const entry of entries) {
      if (entry.taskType === 'focus') {
        const project = projectMap.get(entry.projectId);
        if (project) {
          const hours = entry.durationMinutes / 60;
          totalRevenue += hours * project.ratePerHour;
          totalHours += hours;
        }
      }
    }
    if (totalHours === 0) return 0;
    const rph = totalRevenue / totalHours;
    // Target: $100/hr → 25, cap at 25
    return Math.min(25, (rph / 100) * 25);
  }

  private scoreConsistency(entries: TimeEntry[], period: Period, range: { start: string; end: string }): number {
    if (period === 'daily') {
      // For daily: did they log any work?
      return entries.length > 0 ? 25 : 0;
    }

    // For weekly/monthly: how many unique days had entries?
    const uniqueDays = new Set(entries.map(e => e.date)).size;
    const startDate = new Date(range.start + 'T00:00:00');
    const endDate = new Date(range.end + 'T00:00:00');
    const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    // Exclude weekends from expected days (assume 5-day work week)
    let workDays = 0;
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) workDays++;
    }
    if (workDays === 0) return 25;

    const consistencyRatio = uniqueDays / workDays;
    return Math.min(25, consistencyRatio * 25);
  }
}

// ── Revenue Tracker ────────────────────────────────────────────────────

export class RevenueTracker {
  calculate(entries: TimeEntry[], projects: Project[], clients: Client[]): RevenueMetrics {
    const projectMap = new Map(projects.map(p => [p.id, p]));
    const clientMap = new Map(clients.map(c => [c.id, c]));

    // Per-project aggregation
    const projectAgg: Map<string, { hours: number; revenue: number }> = new Map();
    const clientAgg: Map<string, { hours: number; revenue: number }> = new Map();

    for (const entry of entries) {
      if (entry.taskType !== 'focus') continue;
      const project = projectMap.get(entry.projectId);
      if (!project) continue;
      const hours = entry.durationMinutes / 60;
      const revenue = hours * project.ratePerHour;

      // Project
      const pa = projectAgg.get(project.id) || { hours: 0, revenue: 0 };
      pa.hours += hours;
      pa.revenue += revenue;
      projectAgg.set(project.id, pa);

      // Client
      const ca = clientAgg.get(project.clientId) || { hours: 0, revenue: 0 };
      ca.hours += hours;
      ca.revenue += revenue;
      clientAgg.set(project.clientId, ca);
    }

    const totalBillableHours = [...projectAgg.values()].reduce((s, v) => s + v.hours, 0);
    const totalRevenue = [...projectAgg.values()].reduce((s, v) => s + v.revenue, 0);

    return {
      revenuePerHour: totalBillableHours > 0 ? totalRevenue / totalBillableHours : 0,
      totalRevenue,
      totalBillableHours,
      byProject: [...projectAgg.entries()].map(([pid, agg]) => ({
        projectId: pid,
        projectName: projectMap.get(pid)?.name || pid,
        revenuePerHour: agg.hours > 0 ? agg.revenue / agg.hours : 0,
        totalRevenue: agg.revenue,
        totalHours: agg.hours,
      })).sort((a, b) => b.totalRevenue - a.totalRevenue),
      byClient: [...clientAgg.entries()].map(([cid, agg]) => ({
        clientId: cid,
        clientName: clientMap.get(cid)?.name || cid,
        revenuePerHour: agg.hours > 0 ? agg.revenue / agg.hours : 0,
        totalRevenue: agg.revenue,
        totalHours: agg.hours,
      })).sort((a, b) => b.totalRevenue - a.totalRevenue),
    };
  }
}

// ── Velocity Tracker ───────────────────────────────────────────────────

export class VelocityTracker {
  calculate(projects: Project[], range: { start: string; end: string }): VelocityMetrics {
    const allTasks = projects.flatMap(p => p.tasks);
    const rangedTasks = allTasks.filter(t => t.createdAt <= range.end);

    const completed = rangedTasks.filter(
      t => t.status === 'done' && t.completedAt && t.completedAt >= range.start && t.completedAt <= range.end
    );
    const total = rangedTasks.length;

    const completionRate = total > 0 ? completed.length / total : 0;

    const avgActual = completed.length > 0
      ? completed.reduce((s, t) => s + (t.actualMinutes || t.estimatedMinutes), 0) / completed.length
      : 0;

    // Estimation accuracy: mean(actual / estimated) — closer to 1 is better
    const withEstimates = completed.filter(t => t.estimatedMinutes > 0 && t.actualMinutes !== undefined);
    const estimationAccuracy = withEstimates.length > 0
      ? withEstimates.reduce((s, t) => s + (t.actualMinutes! / t.estimatedMinutes), 0) / withEstimates.length
      : 1;

    // Days in range
    const startD = new Date(range.start + 'T00:00:00');
    const endD = new Date(range.end + 'T00:00:00');
    const days = Math.max(1, Math.ceil((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    const tasksPerDay = completed.length / days;

    // Trend: compare first half vs second half completion
    const midDate = new Date(startD.getTime() + (endD.getTime() - startD.getTime()) / 2);
    const midStr = formatDate(midDate);
    const firstHalf = completed.filter(t => t.completedAt! < midStr).length;
    const secondHalf = completed.filter(t => t.completedAt! >= midStr).length;
    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (secondHalf > firstHalf * 1.2) trend = 'improving';
    else if (firstHalf > secondHalf * 1.2) trend = 'declining';

    return {
      completionRate,
      averageTaskMinutes: avgActual,
      tasksCompletedPerDay: tasksPerDay,
      estimationAccuracy,
      trend,
    };
  }
}

// ── Focus Ratio Analyzer ───────────────────────────────────────────────

export class FocusRatioAnalyzer {
  calculate(entries: TimeEntry[]): FocusRatio {
    const buckets: Record<TaskType, number> = { focus: 0, admin: 0, meeting: 0, learning: 0, break: 0 };
    for (const entry of entries) {
      buckets[entry.taskType] = (buckets[entry.taskType] || 0) + entry.durationMinutes;
    }
    const total = Object.values(buckets).reduce((s, v) => s + v, 0);

    return {
      focusMinutes: buckets.focus,
      adminMinutes: buckets.admin,
      meetingMinutes: buckets.meeting,
      learningMinutes: buckets.learning,
      breakMinutes: buckets.break,
      totalMinutes: total,
      focusPercentage: total > 0 ? (buckets.focus / total) * 100 : 0,
      adminPercentage: total > 0 ? (buckets.admin / total) * 100 : 0,
      ratio: buckets.admin > 0 ? buckets.focus / buckets.admin : buckets.focus > 0 ? Infinity : 0,
    };
  }
}

// ── Client Profitability Ranker ────────────────────────────────────────

export class ClientProfitabilityRanker {
  calculate(entries: TimeEntry[], projects: Project[], clients: Client[]): ClientProfitability[] {
    const projectMap = new Map(projects.map(p => [p.id, p]));
    const clientMap = new Map(clients.map(c => [c.id, c]));

    // Aggregate hours and revenue per client
    const agg: Map<string, { focusHours: number; overheadHours: number; revenue: number }> = new Map();

    for (const entry of entries) {
      const project = projectMap.get(entry.projectId);
      if (!project) continue;
      const clientId = project.clientId;
      const ca = agg.get(clientId) || { focusHours: 0, overheadHours: 0, revenue: 0 };
      const hours = entry.durationMinutes / 60;

      if (entry.taskType === 'focus') {
        ca.focusHours += hours;
        ca.revenue += hours * project.ratePerHour;
      } else {
        ca.overheadHours += hours;
      }
      agg.set(clientId, ca);
    }

    const results: ClientProfitability[] = [...agg.entries()].map(([clientId, data]) => {
      const totalHours = data.focusHours + data.overheadHours;
      const effectiveRate = totalHours > 0 ? data.revenue / totalHours : 0;
      // Score: effective rate relative to $100/hr target, capped at 100
      const profitabilityScore = Math.min(100, (effectiveRate / 100) * 100);

      return {
        clientId,
        clientName: clientMap.get(clientId)?.name || clientId,
        effectiveRate,
        totalRevenue: data.revenue,
        totalHours,
        overheadHours: data.overheadHours,
        profitabilityScore: Math.round(profitabilityScore),
        rank: 0,
      };
    }).sort((a, b) => b.profitabilityScore - a.profitabilityScore);

    results.forEach((r, i) => { r.rank = i + 1; });
    return results;
  }
}

// ── Benchmarking Engine ────────────────────────────────────────────────

export class BenchmarkEngine {
  compare(
    currentScore: ProductivityScore,
    revenue: RevenueMetrics,
    velocity: VelocityMetrics,
    focusRatio: FocusRatio,
    scoreHistory: ProductivityScore[],
    goals: Goal[],
  ): Benchmark[] {
    const benchmarks: Benchmark[] = [];
    const historicalScores = scoreHistory.map(s => s.score);
    const avg = historicalScores.length > 0 ? historicalScores.reduce((a, b) => a + b, 0) / historicalScores.length : currentScore.score;
    const best = historicalScores.length > 0 ? Math.max(...historicalScores) : currentScore.score;

    // Productivity score benchmark
    const scoreGoal = goals.find(g => g.metric === 'productivity_score');
    benchmarks.push(this.makeBenchmark('Productivity Score', currentScore.score, scoreGoal?.target || 80, avg, best));

    // Revenue per hour
    const rphGoal = goals.find(g => g.metric === 'revenue_per_hour');
    benchmarks.push(this.makeBenchmark('Revenue per Hour', revenue.revenuePerHour, rphGoal?.target || 100, revenue.revenuePerHour, revenue.revenuePerHour));

    // Focus ratio
    const focusGoal = goals.find(g => g.metric === 'focus_ratio');
    benchmarks.push(this.makeBenchmark('Focus Ratio %', focusRatio.focusPercentage, focusGoal?.target || 60, focusRatio.focusPercentage, focusRatio.focusPercentage));

    // Task completion rate
    const tcrGoal = goals.find(g => g.metric === 'task_completion_rate');
    benchmarks.push(this.makeBenchmark('Task Completion Rate', velocity.completionRate * 100, (tcrGoal?.target || 0.8) * 100, velocity.completionRate * 100, velocity.completionRate * 100));

    return benchmarks;
  }

  private makeBenchmark(metric: string, current: number, goal: number, average: number, best: number): Benchmark {
    const percentOfGoal = goal > 0 ? (current / goal) * 100 : 100;
    let status: 'above' | 'on-track' | 'below' = 'on-track';
    if (percentOfGoal >= 100) status = 'above';
    else if (percentOfGoal < 80) status = 'below';

    return {
      metric,
      current: Math.round(current * 100) / 100,
      goal: Math.round(goal * 100) / 100,
      average: Math.round(average * 100) / 100,
      best: Math.round(best * 100) / 100,
      percentOfGoal: Math.round(percentOfGoal * 100) / 100,
      status,
    };
  }
}

// ── Recommendations Engine ─────────────────────────────────────────────

export class RecommendationsEngine {
  generate(
    entries: TimeEntry[],
    projects: Project[],
    clients: Client[],
    score: ProductivityScore,
    revenue: RevenueMetrics,
    velocity: VelocityMetrics,
    focusRatio: FocusRatio,
    clientProfitability: ClientProfitability[],
    benchmarks: Benchmark[],
  ): Recommendation[] {
    const recs: Recommendation[] = [];
    let idCounter = 1;
    const nextId = () => `rec-${idCounter++}`;

    // ── Time-of-day / day-of-week patterns ──
    const dayProductivity = this.analyzeDayOfWeekProductivity(entries);
    const todProductivity = this.analyzeTimeOfDayProductivity(entries);

    for (const [day, data] of Object.entries(dayProductivity)) {
      if (data.focusRatio < 0.4 && data.totalMinutes > 60) {
        const pctLess = Math.round((1 - data.focusRatio / 0.6) * 100);
        recs.push({
          id: nextId(),
          type: 'time-optimization',
          priority: 'high',
          title: `${day}s are ${pctLess}% less productive`,
          description: `Your focus ratio on ${day}s is ${Math.round(data.focusRatio * 100)}%, well below your average. Consider scheduling admin tasks or meetings on ${day}s.`,
          impact: `Reclaim ~${Math.round(data.adminMinutes * 0.3)} minutes of focus time per ${day}`,
          actionable: `Move admin/meeting tasks to ${day} and protect focus blocks on other days.`,
          dataPoints: [`${day} focus ratio: ${Math.round(data.focusRatio * 100)}%`, `${day} admin minutes: ${data.adminMinutes}`],
        });
      }
    }

    for (const [tod, data] of Object.entries(todProductivity)) {
      if (data.focusRatio < 0.35 && data.totalMinutes > 60) {
        recs.push({
          id: nextId(),
          type: 'time-optimization',
          priority: 'medium',
          title: `${tod.charAt(0).toUpperCase() + tod.slice(1)}s are low-productivity blocks`,
          description: `Your ${tod} focus ratio is only ${Math.round(data.focusRatio * 100)}%. Consider using ${tod}s for admin work and protecting other time for deep focus.`,
          impact: `Optimize ${Math.round(data.totalMinutes / 60)} hours of ${tod} time`,
          actionable: `Schedule meetings and admin tasks during ${tod} blocks.`,
          dataPoints: [`${tod} focus ratio: ${Math.round(data.focusRatio * 100)}%`],
        });
      }
    }

    // ── Focus ratio recommendations ──
    if (focusRatio.focusPercentage < 50) {
      recs.push({
        id: nextId(),
        type: 'focus-improvement',
        priority: 'high',
        title: 'Focus time is below 50%',
        description: `Only ${Math.round(focusRatio.focusPercentage)}% of your time is focused work. Admin and meetings consume ${Math.round(focusRatio.adminPercentage)}%.`,
        impact: 'Increasing focus to 60% could boost productivity score by 10+ points',
        actionable: 'Batch admin tasks into 2 dedicated blocks per day. Decline non-essential meetings.',
        dataPoints: [`Focus: ${focusRatio.focusMinutes}min`, `Admin: ${focusRatio.adminMinutes}min`, `Meetings: ${focusRatio.meetingMinutes}min`],
      });
    }

    // ── Revenue optimization ──
    if (revenue.byClient.length > 0) {
      const lowestClient = revenue.byClient[revenue.byClient.length - 1];
      const highestClient = revenue.byClient[0];
      if (highestClient.revenuePerHour > lowestClient.revenuePerHour * 2 && lowestClient.totalHours > 5) {
        recs.push({
          id: nextId(),
          type: 'revenue-optimization',
          priority: 'high',
          title: `Client "${lowestClient.clientName}" pays ${Math.round(lowestClient.revenuePerHour)}$/hr — consider renegotiating`,
          description: `Your highest-paying client pays $${Math.round(highestClient.revenuePerHour)}/hr while "${lowestClient.clientName}" pays $${Math.round(lowestClient.revenuePerHour)}/hr. That's a ${Math.round(((highestClient.revenuePerHour / lowestClient.revenuePerHour) - 1) * 100)}% gap.`,
          impact: `Raising the rate by 20% would add $${Math.round(lowestClient.totalHours * lowestClient.revenuePerHour * 0.2)} in revenue`,
          actionable: 'Prepare a rate increase proposal highlighting the value you deliver to this client.',
          dataPoints: [`${lowestClient.clientName}: $${Math.round(lowestClient.revenuePerHour)}/hr`, `${highestClient.clientName}: $${Math.round(highestClient.revenuePerHour)}/hr`],
        });
      }
    }

    // ── Client profitability ──
    const unprofitable = clientProfitability.filter(cp => cp.profitabilityScore < 30);
    for (const cp of unprofitable) {
      recs.push({
        id: nextId(),
        type: 'client-management',
        priority: 'medium',
        title: `Low-profit client: "${cp.clientName}"`,
        description: `"${cp.clientName}" has a profitability score of ${cp.profitabilityScore}/100 with ${Math.round(cp.overheadHours)} hours of overhead (meetings/admin).`,
        impact: `Reducing overhead by 50% would increase effective rate from $${Math.round(cp.effectiveRate)} to ~$${Math.round(cp.totalRevenue / Math.max(1, cp.totalHours - cp.overheadHours * 0.5))}/hr`,
        actionable: 'Audit meeting frequency with this client. Replace status calls with async updates.',
        dataPoints: [`Effective rate: $${Math.round(cp.effectiveRate)}/hr`, `Overhead: ${Math.round(cp.overheadHours)}h`],
      });
    }

    // ── Estimation accuracy ──
    if (velocity.estimationAccuracy > 1.3) {
      recs.push({
        id: nextId(),
        type: 'task-planning',
        priority: 'medium',
        title: 'Tasks take 30%+ longer than estimated',
        description: `Your estimation accuracy ratio is ${velocity.estimationAccuracy.toFixed(2)} (1.0 = perfect). Tasks consistently take longer than planned.`,
        impact: 'Better estimates improve scheduling, client trust, and reduce deadline stress',
        actionable: 'Add a 30% buffer to estimates. Track which task types are most underestimated.',
        dataPoints: [`Estimation accuracy: ${velocity.estimationAccuracy.toFixed(2)}`],
      });
    } else if (velocity.estimationAccuracy < 0.7) {
      recs.push({
        id: nextId(),
        type: 'task-planning',
        priority: 'low',
        title: 'You consistently overestimate task duration',
        description: `Tasks finish ${Math.round((1 - velocity.estimationAccuracy) * 100)}% faster than estimated. You could take on more work or quote tighter timelines.`,
        impact: 'Tighter estimates allow fitting more billable work into each week',
        actionable: 'Reduce estimates by 20% and track how that affects your schedule.',
        dataPoints: [`Estimation accuracy: ${velocity.estimationAccuracy.toFixed(2)}`],
      });
    }

    // ── Workload balance ──
    if (velocity.trend === 'declining') {
      recs.push({
        id: nextId(),
        type: 'workload-balance',
        priority: 'high',
        title: 'Task completion is declining',
        description: 'Your task completion velocity is trending downward. This could indicate burnout, scope creep, or over-commitment.',
        impact: 'Addressing this early prevents cascading deadline misses',
        actionable: 'Review your active project load. Consider deferring lower-priority tasks or negotiating deadlines.',
        dataPoints: [`Trend: ${velocity.trend}`, `Tasks/day: ${velocity.tasksCompletedPerDay.toFixed(1)}`],
      });
    }

    // ── Goal-based benchmarks ──
    for (const benchmark of benchmarks) {
      if (benchmark.status === 'below') {
        recs.push({
          id: nextId(),
          type: 'focus-improvement',
          priority: 'medium',
          title: `"${benchmark.metric}" is below goal`,
          description: `Current: ${benchmark.current}, Goal: ${benchmark.goal} (${benchmark.percentOfGoal}% of target).`,
          impact: `Closing the gap would bring you to ${benchmark.goal}`,
          actionable: `Focus on improving ${benchmark.metric} — you're at ${benchmark.percentOfGoal}% of your target.`,
          dataPoints: [`Current: ${benchmark.current}`, `Goal: ${benchmark.goal}`, `Best: ${benchmark.best}`],
        });
      }
    }

    // Sort: high > medium > low
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    recs.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return recs;
  }

  private analyzeDayOfWeekProductivity(entries: TimeEntry[]): Record<string, { focusRatio: number; totalMinutes: number; adminMinutes: number }> {
    const dayBuckets: Record<string, { focus: number; total: number; admin: number }> = {};
    for (const entry of entries) {
      const day = dayOfWeekName(entry.date);
      if (!dayBuckets[day]) dayBuckets[day] = { focus: 0, total: 0, admin: 0 };
      dayBuckets[day].total += entry.durationMinutes;
      if (entry.taskType === 'focus') dayBuckets[day].focus += entry.durationMinutes;
      if (entry.taskType === 'admin') dayBuckets[day].admin += entry.durationMinutes;
    }
    const result: Record<string, { focusRatio: number; totalMinutes: number; adminMinutes: number }> = {};
    for (const [day, data] of Object.entries(dayBuckets)) {
      result[day] = {
        focusRatio: data.total > 0 ? data.focus / data.total : 0,
        totalMinutes: data.total,
        adminMinutes: data.admin,
      };
    }
    return result;
  }

  private analyzeTimeOfDayProductivity(entries: TimeEntry[]): Record<string, { focusRatio: number; totalMinutes: number }> {
    const todBuckets: Record<string, { focus: number; total: number }> = {};
    for (const entry of entries) {
      const tod = timeOfDayBucket(entry.startTime);
      if (!todBuckets[tod]) todBuckets[tod] = { focus: 0, total: 0 };
      todBuckets[tod].total += entry.durationMinutes;
      if (entry.taskType === 'focus') todBuckets[tod].focus += entry.durationMinutes;
    }
    const result: Record<string, { focusRatio: number; totalMinutes: number }> = {};
    for (const [tod, data] of Object.entries(todBuckets)) {
      result[tod] = {
        focusRatio: data.total > 0 ? data.focus / data.total : 0,
        totalMinutes: data.total,
      };
    }
    return result;
  }
}

// ── Trend Generator ────────────────────────────────────────────────────

export class TrendGenerator {
  generateScoreTrend(history: ProductivityScore[]): TrendData {
    const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
    return {
      labels: sorted.map(s => s.date),
      datasets: [
        { label: 'Productivity Score', data: sorted.map(s => s.score), type: 'line' },
        { label: 'Focus Time', data: sorted.map(s => s.breakdown.focusTimeScore), type: 'bar' },
        { label: 'Task Completion', data: sorted.map(s => s.breakdown.taskCompletionScore), type: 'bar' },
        { label: 'Revenue Efficiency', data: sorted.map(s => s.breakdown.revenueEfficiencyScore), type: 'bar' },
        { label: 'Consistency', data: sorted.map(s => s.breakdown.consistencyScore), type: 'bar' },
      ],
    };
  }

  generateRevenueTrend(entries: TimeEntry[], projects: Project[]): TrendData {
    const projectMap = new Map(projects.map(p => [p.id, p]));
    const dailyRevenue: Map<string, number> = new Map();
    const dailyHours: Map<string, number> = new Map();

    for (const entry of entries) {
      if (entry.taskType !== 'focus') continue;
      const project = projectMap.get(entry.projectId);
      if (!project) continue;
      const hours = entry.durationMinutes / 60;
      const revenue = hours * project.ratePerHour;
      dailyRevenue.set(entry.date, (dailyRevenue.get(entry.date) || 0) + revenue);
      dailyHours.set(entry.date, (dailyHours.get(entry.date) || 0) + hours);
    }

    const dates = [...dailyRevenue.keys()].sort();
    return {
      labels: dates,
      datasets: [
        { label: 'Daily Revenue ($)', data: dates.map(d => Math.round((dailyRevenue.get(d) || 0) * 100) / 100), type: 'bar' },
        { label: 'Revenue per Hour ($/hr)', data: dates.map(d => {
          const h = dailyHours.get(d) || 1;
          return Math.round(((dailyRevenue.get(d) || 0) / h) * 100) / 100;
        }), type: 'line' },
      ],
    };
  }

  generateFocusTrend(entries: TimeEntry[]): TrendData {
    const dailyFocus: Map<string, number> = new Map();
    const dailyTotal: Map<string, number> = new Map();

    for (const entry of entries) {
      dailyTotal.set(entry.date, (dailyTotal.get(entry.date) || 0) + entry.durationMinutes);
      if (entry.taskType === 'focus') {
        dailyFocus.set(entry.date, (dailyFocus.get(entry.date) || 0) + entry.durationMinutes);
      }
    }

    const dates = [...dailyTotal.keys()].sort();
    return {
      labels: dates,
      datasets: [
        { label: 'Focus Minutes', data: dates.map(d => dailyFocus.get(d) || 0), type: 'area' },
        { label: 'Total Minutes', data: dates.map(d => dailyTotal.get(d) || 0), type: 'area' },
        { label: 'Focus %', data: dates.map(d => {
          const total = dailyTotal.get(d) || 1;
          return Math.round(((dailyFocus.get(d) || 0) / total) * 100);
        }), type: 'line' },
      ],
    };
  }
}

// ── Dashboard Orchestrator ─────────────────────────────────────────────

export class ProductivityDashboard {
  private store: DataStore;
  private scoring: ScoringEngine;
  private revenueTracker: RevenueTracker;
  private velocityTracker: VelocityTracker;
  private focusAnalyzer: FocusRatioAnalyzer;
  private profitabilityRanker: ClientProfitabilityRanker;
  private benchmarkEngine: BenchmarkEngine;
  private recommendationsEngine: RecommendationsEngine;
  private trendGenerator: TrendGenerator;

  constructor(dataDir?: string) {
    this.store = new DataStore(dataDir);
    this.scoring = new ScoringEngine();
    this.revenueTracker = new RevenueTracker();
    this.velocityTracker = new VelocityTracker();
    this.focusAnalyzer = new FocusRatioAnalyzer();
    this.profitabilityRanker = new ClientProfitabilityRanker();
    this.benchmarkEngine = new BenchmarkEngine();
    this.recommendationsEngine = new RecommendationsEngine();
    this.trendGenerator = new TrendGenerator();
  }

  getStore(): DataStore { return this.store; }

  generateDashboard(period: Period, referenceDate?: string): DashboardData {
    const range = dateRange(period, referenceDate);
    const entries = filterEntriesByRange(this.store.getTimeEntries(), range.start, range.end);
    const projects = this.store.getProjects();
    const clients = this.store.getClients();
    const goals = this.store.getGoals();
    const scoreHistory = this.store.getScoreHistory();

    const productivityScore = this.scoring.calculate(entries, projects, goals, period, referenceDate);
    const revenue = this.revenueTracker.calculate(entries, projects, clients);
    const velocity = this.velocityTracker.calculate(projects, range);
    const focusRatio = this.focusAnalyzer.calculate(entries);
    const clientProfitability = this.profitabilityRanker.calculate(entries, projects, clients);
    const benchmarks = this.benchmarkEngine.compare(productivityScore, revenue, velocity, focusRatio, scoreHistory, goals);
    const recommendations = this.recommendationsEngine.generate(
      entries, projects, clients, productivityScore, revenue, velocity, focusRatio, clientProfitability, benchmarks
    );

    // Persist score
    this.store.appendScore(productivityScore);

    // Generate trends
    const allEntries = this.store.getTimeEntries();
    const trends = {
      score: this.trendGenerator.generateScoreTrend([...scoreHistory, productivityScore]),
      revenue: this.trendGenerator.generateRevenueTrend(allEntries, projects),
      focus: this.trendGenerator.generateFocusTrend(allEntries),
    };

    return {
      generatedAt: new Date().toISOString(),
      period,
      dateRange: range,
      productivityScore,
      revenue,
      velocity,
      focusRatio,
      clientProfitability,
      benchmarks,
      recommendations,
      trends,
    };
  }

  // ── Data entry helpers ──

  logTime(entry: Omit<TimeEntry, 'id'>): TimeEntry {
    const full: TimeEntry = { ...entry, id: `te-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
    this.store.addTimeEntry(full);
    return full;
  }

  addProject(project: Omit<Project, 'tasks'>): Project {
    const full: Project = { ...project, tasks: [] };
    this.store.addProject(full);
    return full;
  }

  addClient(client: Omit<Client, 'totalRevenue' | 'totalHours'>): Client {
    const full: Client = { ...client, totalRevenue: 0, totalHours: 0 };
    this.store.addClient(full);
    return full;
  }

  addTask(projectId: string, task: Omit<Task, 'id' | 'createdAt'>): Task | null {
    const projects = this.store.getProjects();
    const project = projects.find(p => p.id === projectId);
    if (!project) return null;

    const full: Task = {
      ...task,
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: formatDate(new Date()),
    };
    project.tasks.push(full);
    this.store.saveProjects(projects);
    return full;
  }

  completeTask(projectId: string, taskId: string, actualMinutes?: number): boolean {
    const projects = this.store.getProjects();
    const project = projects.find(p => p.id === projectId);
    if (!project) return false;
    const task = project.tasks.find(t => t.id === taskId);
    if (!task) return false;

    task.status = 'done';
    task.completedAt = formatDate(new Date());
    if (actualMinutes !== undefined) task.actualMinutes = actualMinutes;
    this.store.saveProjects(projects);
    return true;
  }

  setGoal(goal: Omit<Goal, 'id' | 'createdAt'>): Goal {
    const full: Goal = {
      ...goal,
      id: `goal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: formatDate(new Date()),
    };
    this.store.addGoal(full);
    return full;
  }
}

// ── CLI ────────────────────────────────────────────────────────────────

export class ProductivityDashboardCLI {
  private dashboard: ProductivityDashboard;

  constructor(dataDir?: string) {
    this.dashboard = new ProductivityDashboard(dataDir);
  }

  async run(): Promise<void> {
    const program = new Command();

    program
      .name('productivity-dashboard')
      .description('Productivity Metrics Dashboard with Optimization Recommendations')
      .version('1.0.0');

    // ── Dashboard view ──
    program
      .command('dashboard')
      .description('Generate productivity dashboard')
      .option('-p, --period <period>', 'Period: daily, weekly, monthly', 'weekly')
      .option('-d, --date <date>', 'Reference date (YYYY-MM-DD)')
      .option('-f, --format <format>', 'Output format: text, json', 'text')
      .action(async (options) => {
        const data = this.dashboard.generateDashboard(options.period as Period, options.date);
        if (options.format === 'json') {
          console.log(JSON.stringify(data, null, 2));
        } else {
          this.displayDashboard(data);
        }
      });

    // ── Log time ──
    program
      .command('log')
      .description('Log a time entry')
      .requiredOption('--date <date>', 'Date (YYYY-MM-DD)')
      .requiredOption('--start <time>', 'Start time (HH:mm)')
      .requiredOption('--end <time>', 'End time (HH:mm)')
      .requiredOption('--project <id>', 'Project ID')
      .requiredOption('--client <id>', 'Client ID')
      .requiredOption('--type <type>', 'Task type: focus, admin, meeting, learning, break')
      .option('--desc <description>', 'Description', '')
      .option('--tags <tags>', 'Comma-separated tags', '')
      .option('--completed', 'Mark as completed', false)
      .action(async (options) => {
        const startParts = options.start.split(':').map(Number);
        const endParts = options.end.split(':').map(Number);
        const startMinutes = startParts[0] * 60 + startParts[1];
        const endMinutes = endParts[0] * 60 + endParts[1];
        const duration = endMinutes - startMinutes;

        const entry = this.dashboard.logTime({
          date: options.date,
          startTime: options.start,
          endTime: options.end,
          durationMinutes: duration,
          projectId: options.project,
          clientId: options.client,
          taskType: options.type as TaskType,
          description: options.desc,
          tags: options.tags ? options.tags.split(',').map((t: string) => t.trim()) : [],
          completed: options.completed,
        });
        console.log(`✅ Time logged: ${entry.id} (${duration} minutes)`);
      });

    // ── Add project ──
    program
      .command('add-project')
      .description('Add a project')
      .requiredOption('--id <id>', 'Project ID')
      .requiredOption('--name <name>', 'Project name')
      .requiredOption('--client <id>', 'Client ID')
      .option('--budget <hours>', 'Budget hours', '0')
      .option('--rate <rate>', 'Hourly rate', '0')
      .option('--deadline <date>', 'Deadline (YYYY-MM-DD)')
      .action(async (options) => {
        const project = this.dashboard.addProject({
          id: options.id,
          name: options.name,
          clientId: options.client,
          budgetHours: parseFloat(options.budget),
          ratePerHour: parseFloat(options.rate),
          startDate: formatDate(new Date()),
          deadline: options.deadline,
          status: 'active',
        });
        console.log(`✅ Project added: ${project.name} (${project.id})`);
      });

    // ── Add client ──
    program
      .command('add-client')
      .description('Add a client')
      .requiredOption('--id <id>', 'Client ID')
      .requiredOption('--name <name>', 'Client name')
      .option('--rate <rate>', 'Default hourly rate', '0')
      .action(async (options) => {
        const client = this.dashboard.addClient({
          id: options.id,
          name: options.name,
          ratePerHour: parseFloat(options.rate),
          projects: [],
        });
        console.log(`✅ Client added: ${client.name} (${client.id})`);
      });

    // ── Add task ──
    program
      .command('add-task')
      .description('Add a task to a project')
      .requiredOption('--project <id>', 'Project ID')
      .requiredOption('--title <title>', 'Task title')
      .option('--estimate <minutes>', 'Estimated minutes', '60')
      .action(async (options) => {
        const task = this.dashboard.addTask(options.project, {
          title: options.title,
          estimatedMinutes: parseInt(options.estimate, 10),
          status: 'todo',
        });
        if (task) {
          console.log(`✅ Task added: ${task.title} (${task.id})`);
        } else {
          console.error('❌ Project not found');
          process.exit(1);
        }
      });

    // ── Complete task ──
    program
      .command('complete-task')
      .description('Mark a task as complete')
      .requiredOption('--project <id>', 'Project ID')
      .requiredOption('--task <id>', 'Task ID')
      .option('--actual <minutes>', 'Actual minutes spent')
      .action(async (options) => {
        const ok = this.dashboard.completeTask(
          options.project,
          options.task,
          options.actual ? parseInt(options.actual, 10) : undefined,
        );
        if (ok) {
          console.log('✅ Task completed');
        } else {
          console.error('❌ Project or task not found');
          process.exit(1);
        }
      });

    // ── Set goal ──
    program
      .command('set-goal')
      .description('Set a productivity goal')
      .requiredOption('--name <name>', 'Goal name')
      .requiredOption('--metric <metric>', 'Metric: productivity_score, revenue_per_hour, focus_ratio, task_completion_rate, weekly_hours, daily_tasks_completed')
      .requiredOption('--target <value>', 'Target value')
      .option('--period <period>', 'Period: daily, weekly, monthly', 'weekly')
      .action(async (options) => {
        const goal = this.dashboard.setGoal({
          name: options.name,
          metric: options.metric as GoalMetric,
          target: parseFloat(options.target),
          period: options.period as Period,
        });
        console.log(`✅ Goal set: ${goal.name} → ${goal.target} (${goal.period})`);
      });

    // ── Recommendations ──
    program
      .command('recommendations')
      .description('Get AI-powered optimization recommendations')
      .option('-p, --period <period>', 'Period: daily, weekly, monthly', 'weekly')
      .option('-d, --date <date>', 'Reference date (YYYY-MM-DD)')
      .option('-f, --format <format>', 'Output format: text, json', 'text')
      .action(async (options) => {
        const data = this.dashboard.generateDashboard(options.period as Period, options.date);
        if (options.format === 'json') {
          console.log(JSON.stringify(data.recommendations, null, 2));
        } else {
          this.displayRecommendations(data.recommendations);
        }
      });

    // ── Score ──
    program
      .command('score')
      .description('Show current productivity score')
      .option('-p, --period <period>', 'Period: daily, weekly, monthly', 'daily')
      .option('-d, --date <date>', 'Reference date (YYYY-MM-DD)')
      .action(async (options) => {
        const data = this.dashboard.generateDashboard(options.period as Period, options.date);
        this.displayScore(data.productivityScore);
      });

    // ── Trends ──
    program
      .command('trends')
      .description('Show trend data')
      .option('-t, --type <type>', 'Trend type: score, revenue, focus', 'score')
      .option('-f, --format <format>', 'Output format: text, json', 'json')
      .action(async (options) => {
        const data = this.dashboard.generateDashboard('monthly');
        const trendData = data.trends[options.type as keyof typeof data.trends];
        if (!trendData) {
          console.error(`Unknown trend type: ${options.type}`);
          process.exit(1);
        }
        console.log(JSON.stringify(trendData, null, 2));
      });

    // ── Sample data ──
    program
      .command('seed')
      .description('Seed sample data for testing')
      .action(async () => {
        this.seedSampleData();
        console.log('✅ Sample data seeded');
      });

    await program.parseAsync(process.argv);
  }

  private displayDashboard(data: DashboardData): void {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║            ⚡ PRODUCTIVITY DASHBOARD                        ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log(`  Period: ${data.period} | ${data.dateRange.start} → ${data.dateRange.end}\n`);

    this.displayScore(data.productivityScore);

    console.log('\n📊 Revenue');
    console.log(`  Revenue/Hour: $${data.revenue.revenuePerHour.toFixed(2)}`);
    console.log(`  Total Revenue: $${data.revenue.totalRevenue.toFixed(2)}`);
    console.log(`  Billable Hours: ${data.revenue.totalBillableHours.toFixed(1)}`);

    console.log('\n🎯 Velocity');
    console.log(`  Completion Rate: ${(data.velocity.completionRate * 100).toFixed(1)}%`);
    console.log(`  Tasks/Day: ${data.velocity.tasksCompletedPerDay.toFixed(1)}`);
    console.log(`  Estimation Accuracy: ${data.velocity.estimationAccuracy.toFixed(2)}x`);
    console.log(`  Trend: ${data.velocity.trend}`);

    console.log('\n🔍 Focus Ratio');
    console.log(`  Focus: ${data.focusRatio.focusMinutes}min (${data.focusRatio.focusPercentage.toFixed(1)}%)`);
    console.log(`  Admin: ${data.focusRatio.adminMinutes}min (${data.focusRatio.adminPercentage.toFixed(1)}%)`);
    console.log(`  Ratio: ${data.focusRatio.ratio === Infinity ? '∞' : data.focusRatio.ratio.toFixed(1)}:1`);

    if (data.clientProfitability.length > 0) {
      console.log('\n💰 Client Profitability');
      for (const cp of data.clientProfitability) {
        console.log(`  #${cp.rank} ${cp.clientName}: $${cp.effectiveRate.toFixed(0)}/hr (score: ${cp.profitabilityScore})`);
      }
    }

    if (data.benchmarks.length > 0) {
      console.log('\n📈 Benchmarks');
      for (const b of data.benchmarks) {
        const icon = b.status === 'above' ? '✅' : b.status === 'on-track' ? '🟡' : '🔴';
        console.log(`  ${icon} ${b.metric}: ${b.current} / ${b.goal} (${b.percentOfGoal}%)`);
      }
    }

    this.displayRecommendations(data.recommendations);
  }

  private displayScore(score: ProductivityScore): void {
    const bar = this.scoreBar(score.score);
    console.log(`\n🏆 Productivity Score: ${score.score}/100 ${bar}`);
    console.log(`  ├─ Focus Time:        ${score.breakdown.focusTimeScore}/25`);
    console.log(`  ├─ Task Completion:   ${score.breakdown.taskCompletionScore}/25`);
    console.log(`  ├─ Revenue Efficiency:${score.breakdown.revenueEfficiencyScore}/25`);
    console.log(`  └─ Consistency:       ${score.breakdown.consistencyScore}/25`);
  }

  private displayRecommendations(recs: Recommendation[]): void {
    if (recs.length === 0) {
      console.log('\n✨ No recommendations — you\'re crushing it!');
      return;
    }

    console.log('\n💡 Recommendations');
    for (const rec of recs) {
      const icon = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
      console.log(`\n  ${icon} [${rec.priority.toUpperCase()}] ${rec.title}`);
      console.log(`    ${rec.description}`);
      console.log(`    → ${rec.actionable}`);
      console.log(`    Impact: ${rec.impact}`);
    }
  }

  private scoreBar(score: number): string {
    const filled = Math.round(score / 5);
    const empty = 20 - filled;
    return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
  }

  private seedSampleData(): void {
    const store = this.dashboard.getStore();

    // Clients
    store.saveClients([
      { id: 'client-1', name: 'TechStartup Inc', ratePerHour: 120, projects: ['proj-1'], totalRevenue: 0, totalHours: 0 },
      { id: 'client-2', name: 'DesignAgency Co', ratePerHour: 85, projects: ['proj-2'], totalRevenue: 0, totalHours: 0 },
      { id: 'client-3', name: 'SmallBiz LLC', ratePerHour: 50, projects: ['proj-3'], totalRevenue: 0, totalHours: 0 },
    ]);

    // Projects
    store.saveProjects([
      {
        id: 'proj-1', name: 'SaaS Platform', clientId: 'client-1',
        budgetHours: 200, ratePerHour: 120, startDate: '2026-01-01', status: 'active',
        tasks: [
          { id: 'task-1', title: 'Auth system', estimatedMinutes: 480, actualMinutes: 520, status: 'done', completedAt: '2026-03-20', createdAt: '2026-03-01' },
          { id: 'task-2', title: 'Dashboard UI', estimatedMinutes: 360, actualMinutes: 300, status: 'done', completedAt: '2026-03-22', createdAt: '2026-03-05' },
          { id: 'task-3', title: 'API endpoints', estimatedMinutes: 240, status: 'in-progress', createdAt: '2026-03-10' },
          { id: 'task-4', title: 'Testing', estimatedMinutes: 180, status: 'todo', createdAt: '2026-03-15' },
        ],
      },
      {
        id: 'proj-2', name: 'Brand Redesign', clientId: 'client-2',
        budgetHours: 80, ratePerHour: 85, startDate: '2026-02-01', status: 'active',
        tasks: [
          { id: 'task-5', title: 'Logo concepts', estimatedMinutes: 120, actualMinutes: 180, status: 'done', completedAt: '2026-03-18', createdAt: '2026-03-01' },
          { id: 'task-6', title: 'Style guide', estimatedMinutes: 240, status: 'in-progress', createdAt: '2026-03-10' },
        ],
      },
      {
        id: 'proj-3', name: 'WordPress Site', clientId: 'client-3',
        budgetHours: 40, ratePerHour: 50, startDate: '2026-03-01', status: 'active',
        tasks: [
          { id: 'task-7', title: 'Setup & config', estimatedMinutes: 60, actualMinutes: 90, status: 'done', completedAt: '2026-03-19', createdAt: '2026-03-15' },
          { id: 'task-8', title: 'Content migration', estimatedMinutes: 180, status: 'todo', createdAt: '2026-03-18' },
        ],
      },
    ]);

    // Time entries across 2 weeks
    const entries: TimeEntry[] = [];
    const dates = [
      '2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13', '2026-03-14',
      '2026-03-17', '2026-03-18', '2026-03-19', '2026-03-20', '2026-03-21',
      '2026-03-24', '2026-03-25',
    ];

    let entryId = 1;
    for (const date of dates) {
      // Morning focus block (proj-1)
      entries.push({
        id: `te-${entryId++}`, date, startTime: '09:00', endTime: '12:00', durationMinutes: 180,
        projectId: 'proj-1', clientId: 'client-1', taskType: 'focus',
        description: 'SaaS development', tags: ['coding'], completed: true,
      });
      // Meeting
      entries.push({
        id: `te-${entryId++}`, date, startTime: '12:00', endTime: '12:30', durationMinutes: 30,
        projectId: 'proj-1', clientId: 'client-1', taskType: 'meeting',
        description: 'Client sync', tags: ['meeting'], completed: true,
      });
      // Afternoon focus (alternating projects)
      const afternoonProject = date.endsWith('1') || date.endsWith('3') ? 'proj-2' : 'proj-3';
      const afternoonClient = afternoonProject === 'proj-2' ? 'client-2' : 'client-3';
      entries.push({
        id: `te-${entryId++}`, date, startTime: '13:00', endTime: '15:00', durationMinutes: 120,
        projectId: afternoonProject, clientId: afternoonClient, taskType: 'focus',
        description: 'Afternoon work', tags: ['design'], completed: true,
      });
      // Admin block
      entries.push({
        id: `te-${entryId++}`, date, startTime: '15:00', endTime: '16:00', durationMinutes: 60,
        projectId: 'proj-1', clientId: 'client-1', taskType: 'admin',
        description: 'Invoicing & emails', tags: ['admin'], completed: true,
      });

      // Extra admin on Tuesdays to create a detectable pattern
      if (new Date(date + 'T00:00:00').getDay() === 2) {
        entries.push({
          id: `te-${entryId++}`, date, startTime: '16:00', endTime: '17:30', durationMinutes: 90,
          projectId: 'proj-3', clientId: 'client-3', taskType: 'admin',
          description: 'Extra admin tasks', tags: ['admin'], completed: true,
        });
      }
    }

    store.saveTimeEntries(entries);

    // Goals
    store.saveGoals([
      { id: 'goal-1', name: 'Weekly Score Target', metric: 'productivity_score', target: 80, period: 'weekly', createdAt: '2026-01-01' },
      { id: 'goal-2', name: 'Revenue Target', metric: 'revenue_per_hour', target: 100, period: 'weekly', createdAt: '2026-01-01' },
      { id: 'goal-3', name: 'Focus Target', metric: 'focus_ratio', target: 70, period: 'weekly', createdAt: '2026-01-01' },
    ]);

    // Score history
    store.saveScoreHistory([
      { score: 65, period: 'weekly', date: '2026-03-07', breakdown: { focusTimeScore: 18, taskCompletionScore: 15, revenueEfficiencyScore: 17, consistencyScore: 15 } },
      { score: 70, period: 'weekly', date: '2026-03-14', breakdown: { focusTimeScore: 20, taskCompletionScore: 16, revenueEfficiencyScore: 18, consistencyScore: 16 } },
    ]);
  }
}

// ── Exports ────────────────────────────────────────────────────────────

export {
  filterEntriesByRange,
  dayOfWeekName,
  timeOfDayBucket,
};

// CLI execution
if (require.main === module) {
  const cli = new ProductivityDashboardCLI();
  cli.run().catch(error => {
    console.error('CLI Error:', error);
    process.exit(1);
  });
}
