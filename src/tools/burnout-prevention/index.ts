#!/usr/bin/env node
/**
 * Burnout Prevention System with Work-Life Balance Monitoring
 *
 * Proactive burnout detection and prevention for freelancers.
 * Tracks work patterns, calculates risk scores, and delivers
 * actionable recommendations before burnout hits.
 *
 * CFX-070 Implementation
 */

import fs from 'fs';
import path from 'path';
import { Command } from 'commander';

// ─── Types ───────────────────────────────────────────────────────────

export interface WorkSession {
  id: string;
  date: string;            // YYYY-MM-DD
  startTime: string;       // HH:mm
  endTime: string;         // HH:mm
  durationMinutes: number;
  clientId?: string;
  projectId?: string;
  tags?: string[];
  notes?: string;
}

export interface DailyLog {
  date: string;
  sessions: WorkSession[];
  totalMinutes: number;
  isWeekend: boolean;
  hasLateNight: boolean;   // work past 22:00
  hasEarlyMorning: boolean; // work before 06:00
}

export interface ClientLoad {
  clientId: string;
  clientName: string;
  activeProjects: number;
  weeklyHours: number;
  lastDelivery?: string;
}

export interface RecoveryPeriod {
  startDate: string;
  endDate: string;
  durationDays: number;
  afterClientId?: string;
  quality: 'full' | 'partial' | 'none'; // full = no work, partial = light, none = jumped right in
}

export interface BurnoutRiskScore {
  overall: number;          // 0-100
  components: {
    workHours: number;      // 0-25
    consistency: number;    // 0-20 (consecutive days, no breaks)
    timeOfDay: number;      // 0-15 (late nights, early mornings)
    weekendWork: number;    // 0-15 (working on weekends)
    clientOverload: number; // 0-15 (too many concurrent clients)
    recoveryDeficit: number;// 0-10 (insufficient breaks between projects)
  };
  trend: 'improving' | 'stable' | 'worsening';
  alerts: BurnoutAlert[];
  recommendations: string[];
}

export interface BurnoutAlert {
  level: 'info' | 'warning' | 'critical';
  signal: string;
  message: string;
  actionable: string;
  timestamp: string;
}

export interface WellnessCheckIn {
  id: string;
  date: string;
  energyLevel: number;     // 1-5
  stressLevel: number;     // 1-5
  sleepQuality: number;    // 1-5
  motivation: number;      // 1-5
  physicalHealth: number;  // 1-5
  notes?: string;
}

export interface BurnoutPattern {
  patternType: string;
  description: string;
  occurrences: number;
  lastOccurrence: string;
  avgRiskScoreDuring: number;
}

export interface WorkLifeBalanceReport {
  period: string;
  totalWorkDays: number;
  totalOffDays: number;
  avgDailyHours: number;
  weekendWorkDays: number;
  lateNightCount: number;
  longestStreak: number;   // consecutive work days
  currentStreak: number;
  overtimePercentage: number;
  balanceScore: number;    // 0-100 (higher = better balance)
  burnoutRisk: BurnoutRiskScore;
}

export interface BurnoutPreventionData {
  sessions: WorkSession[];
  dailyLogs: DailyLog[];
  clients: ClientLoad[];
  recoveryPeriods: RecoveryPeriod[];
  checkIns: WellnessCheckIn[];
  patterns: BurnoutPattern[];
  config: BurnoutConfig;
  lastUpdated: string;
}

export interface BurnoutConfig {
  maxDailyHours: number;          // default 8
  maxWeeklyHours: number;         // default 40
  lateNightThreshold: string;     // default "22:00"
  earlyMorningThreshold: string;  // default "06:00"
  maxConsecutiveDays: number;     // default 5
  maxConcurrentClients: number;   // default 3
  minRecoveryDays: number;        // default 2 (between projects)
  overtimeThresholdPercent: number; // default 20
  criticalRiskThreshold: number;  // default 70
  warningRiskThreshold: number;   // default 45
}

// ─── Constants ───────────────────────────────────────────────────────

const DEFAULT_CONFIG: BurnoutConfig = {
  maxDailyHours: 8,
  maxWeeklyHours: 40,
  lateNightThreshold: '22:00',
  earlyMorningThreshold: '06:00',
  maxConsecutiveDays: 5,
  maxConcurrentClients: 3,
  minRecoveryDays: 2,
  overtimeThresholdPercent: 20,
  criticalRiskThreshold: 70,
  warningRiskThreshold: 45,
};

const DATA_DIR = path.join(process.env.HOME || '~', '.cortex-freelancer');
const DATA_FILE = path.join(DATA_DIR, 'burnout-prevention.json');

// ─── Data Layer ──────────────────────────────────────────────────────

export class BurnoutDataStore {
  private dataPath: string;

  constructor(dataPath?: string) {
    this.dataPath = dataPath || DATA_FILE;
  }

  load(): BurnoutPreventionData {
    try {
      if (fs.existsSync(this.dataPath)) {
        const raw = fs.readFileSync(this.dataPath, 'utf-8');
        return JSON.parse(raw);
      }
    } catch {
      // Corrupted file — start fresh
    }
    return this.createEmpty();
  }

  save(data: BurnoutPreventionData): void {
    const dir = path.dirname(this.dataPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    data.lastUpdated = new Date().toISOString();
    fs.writeFileSync(this.dataPath, JSON.stringify(data, null, 2));
  }

  private createEmpty(): BurnoutPreventionData {
    return {
      sessions: [],
      dailyLogs: [],
      clients: [],
      recoveryPeriods: [],
      checkIns: [],
      patterns: [],
      config: { ...DEFAULT_CONFIG },
      lastUpdated: new Date().toISOString(),
    };
  }
}

// ─── Work Hours Tracker ──────────────────────────────────────────────

export class WorkHoursTracker {
  constructor(private data: BurnoutPreventionData) {}

  logSession(session: Omit<WorkSession, 'id' | 'durationMinutes'>): WorkSession {
    const start = this.parseTime(session.startTime);
    const end = this.parseTime(session.endTime);
    let durationMinutes = (end - start) / (1000 * 60);
    if (durationMinutes < 0) durationMinutes += 24 * 60; // overnight

    const full: WorkSession = {
      ...session,
      id: `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      durationMinutes: Math.round(durationMinutes),
    };

    this.data.sessions.push(full);
    this.updateDailyLog(full);
    return full;
  }

  getSessionsForDate(date: string): WorkSession[] {
    return this.data.sessions.filter(s => s.date === date);
  }

  getSessionsForRange(startDate: string, endDate: string): WorkSession[] {
    return this.data.sessions.filter(s => s.date >= startDate && s.date <= endDate);
  }

  getDailyHours(date: string): number {
    const sessions = this.getSessionsForDate(date);
    return sessions.reduce((sum, s) => sum + s.durationMinutes, 0) / 60;
  }

  getWeeklyHours(weekEndDate: string): number {
    const end = new Date(weekEndDate);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    const startStr = this.formatDate(start);
    const endStr = this.formatDate(end);
    const sessions = this.getSessionsForRange(startStr, endStr);
    return sessions.reduce((sum, s) => sum + s.durationMinutes, 0) / 60;
  }

  detectOvertime(date: string): { isOvertime: boolean; excess: number; message: string } {
    const hours = this.getDailyHours(date);
    const max = this.data.config.maxDailyHours;
    if (hours > max) {
      const excess = Math.round((hours - max) * 10) / 10;
      return {
        isOvertime: true,
        excess,
        message: `You worked ${hours.toFixed(1)}h today — ${excess}h over your ${max}h limit. Time to shut the laptop.`,
      };
    }
    return { isOvertime: false, excess: 0, message: '' };
  }

  getConsecutiveWorkDays(asOfDate?: string): number {
    const refDate = asOfDate ? new Date(asOfDate) : new Date();
    let streak = 0;
    const cursor = new Date(refDate);

    while (true) {
      const dateStr = this.formatDate(cursor);
      const hours = this.getDailyHours(dateStr);
      if (hours > 0) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }

  private updateDailyLog(session: WorkSession): void {
    let log = this.data.dailyLogs.find(d => d.date === session.date);
    if (!log) {
      const dayOfWeek = new Date(session.date).getDay();
      log = {
        date: session.date,
        sessions: [],
        totalMinutes: 0,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        hasLateNight: false,
        hasEarlyMorning: false,
      };
      this.data.dailyLogs.push(log);
    }

    log.sessions.push(session);
    log.totalMinutes = this.data.sessions
      .filter(s => s.date === session.date)
      .reduce((sum, s) => sum + s.durationMinutes, 0);

    const endHour = parseInt(session.endTime.split(':')[0], 10);
    const startHour = parseInt(session.startTime.split(':')[0], 10);
    const lateThreshold = parseInt(this.data.config.lateNightThreshold.split(':')[0], 10);
    const earlyThreshold = parseInt(this.data.config.earlyMorningThreshold.split(':')[0], 10);

    if (endHour >= lateThreshold || endHour < 4) log.hasLateNight = true;
    if (startHour < earlyThreshold) log.hasEarlyMorning = true;
  }

  private parseTime(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return new Date(2000, 0, 1, h, m).getTime();
  }

  formatDate(d: Date): string {
    return d.toISOString().split('T')[0];
  }
}

// ─── Burnout Risk Calculator ─────────────────────────────────────────

export class BurnoutRiskCalculator {
  private tracker: WorkHoursTracker;
  private config: BurnoutConfig;

  constructor(private data: BurnoutPreventionData) {
    this.tracker = new WorkHoursTracker(data);
    this.config = data.config;
  }

  calculate(asOfDate?: string): BurnoutRiskScore {
    const date = asOfDate || new Date().toISOString().split('T')[0];
    const components = {
      workHours: this.scoreWorkHours(date),
      consistency: this.scoreConsistency(date),
      timeOfDay: this.scoreTimeOfDay(date),
      weekendWork: this.scoreWeekendWork(date),
      clientOverload: this.scoreClientOverload(),
      recoveryDeficit: this.scoreRecoveryDeficit(),
    };

    const overall = Math.min(100, Math.round(
      components.workHours +
      components.consistency +
      components.timeOfDay +
      components.weekendWork +
      components.clientOverload +
      components.recoveryDeficit
    ));

    const trend = this.calculateTrend(date);
    const alerts = this.generateAlerts(components, overall, date);
    const recommendations = this.generateRecommendations(components, overall, date);

    return { overall, components, trend, alerts, recommendations };
  }

  // Work hours component: 0-25 points
  private scoreWorkHours(date: string): number {
    const weeklyHours = this.tracker.getWeeklyHours(date);
    const maxWeekly = this.config.maxWeeklyHours;
    const overtimeRatio = weeklyHours / maxWeekly;

    if (overtimeRatio <= 0.8) return 0;
    if (overtimeRatio <= 1.0) return Math.round((overtimeRatio - 0.8) / 0.2 * 10);
    if (overtimeRatio <= 1.3) return Math.round(10 + (overtimeRatio - 1.0) / 0.3 * 10);
    return 25; // > 130% of max
  }

  // Consistency/streak component: 0-20 points
  private scoreConsistency(date: string): number {
    const streak = this.tracker.getConsecutiveWorkDays(date);
    const maxStreak = this.config.maxConsecutiveDays;

    if (streak <= maxStreak) return 0;
    const overDays = streak - maxStreak;
    return Math.min(20, overDays * 5);
  }

  // Time-of-day component: 0-15 points
  private scoreTimeOfDay(date: string): number {
    const end = new Date(date);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);

    const logs = this.data.dailyLogs.filter(
      l => l.date >= start.toISOString().split('T')[0] && l.date <= date
    );

    const lateNights = logs.filter(l => l.hasLateNight).length;
    const earlyMornings = logs.filter(l => l.hasEarlyMorning).length;
    const unhealthyDays = lateNights + earlyMornings;

    if (unhealthyDays <= 1) return 0;
    if (unhealthyDays <= 3) return 5;
    if (unhealthyDays <= 5) return 10;
    return 15;
  }

  // Weekend work component: 0-15 points
  private scoreWeekendWork(date: string): number {
    const end = new Date(date);
    const start = new Date(end);
    start.setDate(start.getDate() - 27); // last 4 weeks

    const logs = this.data.dailyLogs.filter(
      l => l.date >= start.toISOString().split('T')[0] && l.date <= date && l.isWeekend
    );

    const weekendWorkDays = logs.filter(l => l.totalMinutes > 0).length;
    // 8 possible weekend days in 4 weeks
    if (weekendWorkDays <= 1) return 0;
    if (weekendWorkDays <= 3) return 5;
    if (weekendWorkDays <= 5) return 10;
    return 15;
  }

  // Client overload component: 0-15 points
  private scoreClientOverload(): number {
    const activeClients = this.data.clients.filter(c => c.activeProjects > 0);
    const max = this.config.maxConcurrentClients;

    if (activeClients.length <= max) return 0;
    const over = activeClients.length - max;
    return Math.min(15, over * 5);
  }

  // Recovery deficit component: 0-10 points
  private scoreRecoveryDeficit(): number {
    if (this.data.recoveryPeriods.length === 0) return 0;

    const recent = this.data.recoveryPeriods.slice(-3);
    const avgDays = recent.reduce((sum, r) => sum + r.durationDays, 0) / recent.length;
    const minRequired = this.config.minRecoveryDays;

    if (avgDays >= minRequired) return 0;
    if (avgDays >= minRequired * 0.5) return 5;
    return 10;
  }

  private calculateTrend(date: string): 'improving' | 'stable' | 'worsening' {
    // Compare current week vs previous week hours
    const thisWeek = this.tracker.getWeeklyHours(date);
    const lastWeekDate = new Date(date);
    lastWeekDate.setDate(lastWeekDate.getDate() - 7);
    const lastWeek = this.tracker.getWeeklyHours(lastWeekDate.toISOString().split('T')[0]);

    if (lastWeek === 0) return 'stable';
    const change = (thisWeek - lastWeek) / lastWeek;
    if (change > 0.1) return 'worsening';
    if (change < -0.1) return 'improving';
    return 'stable';
  }

  private generateAlerts(
    components: BurnoutRiskScore['components'],
    overall: number,
    date: string
  ): BurnoutAlert[] {
    const alerts: BurnoutAlert[] = [];
    const now = new Date().toISOString();
    const streak = this.tracker.getConsecutiveWorkDays(date);

    if (overall >= this.config.criticalRiskThreshold) {
      alerts.push({
        level: 'critical',
        signal: 'high-burnout-risk',
        message: `🚨 Burnout risk is at ${overall}/100 — this is critical territory.`,
        actionable: 'Take at least one full day off in the next 48 hours. Reschedule non-urgent deliverables.',
        timestamp: now,
      });
    } else if (overall >= this.config.warningRiskThreshold) {
      alerts.push({
        level: 'warning',
        signal: 'elevated-burnout-risk',
        message: `⚠️ Burnout risk is at ${overall}/100 — elevated and climbing.`,
        actionable: 'Reduce workload this week and protect at least one weekend day.',
        timestamp: now,
      });
    }

    if (streak >= 6) {
      alerts.push({
        level: streak >= 8 ? 'critical' : 'warning',
        signal: 'consecutive-days',
        message: `You've worked ${streak} consecutive days.${streak >= 7 ? ' Your productivity typically drops 30% after 7+ day streaks.' : ''}`,
        actionable: streak >= 7
          ? `Take tomorrow off — you've earned it and your work quality will thank you.`
          : `Consider taking tomorrow off to recharge.`,
        timestamp: now,
      });
    }

    if (components.timeOfDay >= 10) {
      alerts.push({
        level: 'warning',
        signal: 'unhealthy-hours',
        message: 'Multiple late nights or early mornings this week — your sleep is taking a hit.',
        actionable: 'Set a hard stop at 9 PM tonight. Sleep compounds — one good night helps more than one extra work hour.',
        timestamp: now,
      });
    }

    if (components.clientOverload >= 10) {
      const active = this.data.clients.filter(c => c.activeProjects > 0).length;
      alerts.push({
        level: 'warning',
        signal: 'client-overload',
        message: `You're juggling ${active} clients simultaneously — context-switching is eating your energy.`,
        actionable: 'Consider pausing intake or wrapping up one client before adding more.',
        timestamp: now,
      });
    }

    if (components.weekendWork >= 10) {
      alerts.push({
        level: 'warning',
        signal: 'weekend-erosion',
        message: "You've been working most weekends lately. Recovery time is disappearing.",
        actionable: 'Block next weekend as sacred — no work, no exceptions. Your future self will be more productive Monday.',
        timestamp: now,
      });
    }

    return alerts;
  }

  private generateRecommendations(
    components: BurnoutRiskScore['components'],
    overall: number,
    date: string
  ): string[] {
    const recs: string[] = [];
    const streak = this.tracker.getConsecutiveWorkDays(date);
    const weeklyHours = this.tracker.getWeeklyHours(date);

    if (overall < 20) {
      recs.push('✅ Great balance! Keep maintaining these healthy work patterns.');
      return recs;
    }

    if (components.workHours >= 15) {
      const excess = Math.round(weeklyHours - this.config.maxWeeklyHours);
      recs.push(
        `Cut ${excess > 0 ? excess : 5}+ hours from next week. Identify your lowest-value tasks and defer or delegate them.`
      );
    }

    if (streak > this.config.maxConsecutiveDays) {
      recs.push(
        `You've worked ${streak} consecutive days. Consider taking tomorrow off — your productivity typically drops 30% after 7+ day streaks.`
      );
    }

    if (components.timeOfDay >= 5) {
      recs.push(
        'Set a firm shutdown ritual: close laptop at your chosen time, write tomorrow\'s top 3 priorities, and walk away.'
      );
    }

    if (components.weekendWork >= 5) {
      recs.push(
        'Protect at least one full weekend day. Use "buffer days" (Fri/Mon) for overflow instead of weekends.'
      );
    }

    if (components.clientOverload >= 5) {
      recs.push(
        'Consider "client batching" — dedicate full days to single clients instead of context-switching hourly.'
      );
    }

    if (components.recoveryDeficit >= 5) {
      recs.push(
        'Build 2-3 recovery days between project endings and new starts. Use them for admin, learning, or actual rest.'
      );
    }

    // Pattern-based recommendations
    const patterns = this.data.patterns;
    const recentBurnoutPattern = patterns.find(p => p.patternType === 'sprint-crash');
    if (recentBurnoutPattern) {
      recs.push(
        `Historical pattern detected: you tend to sprint hard then crash. Break big deadlines into weekly milestones to avoid the boom-bust cycle.`
      );
    }

    return recs;
  }
}

// ─── Work-Life Balance Analyzer ──────────────────────────────────────

export class WorkLifeBalanceAnalyzer {
  private tracker: WorkHoursTracker;
  private riskCalc: BurnoutRiskCalculator;

  constructor(private data: BurnoutPreventionData) {
    this.tracker = new WorkHoursTracker(data);
    this.riskCalc = new BurnoutRiskCalculator(data);
  }

  generateReport(periodDays: number = 30, asOfDate?: string): WorkLifeBalanceReport {
    const endDate = asOfDate || new Date().toISOString().split('T')[0];
    const end = new Date(endDate);
    const start = new Date(end);
    start.setDate(start.getDate() - periodDays + 1);
    const startStr = start.toISOString().split('T')[0];

    const logs = this.data.dailyLogs.filter(l => l.date >= startStr && l.date <= endDate);
    const workDayLogs = logs.filter(l => l.totalMinutes > 0);

    const totalWorkDays = workDayLogs.length;
    const totalOffDays = periodDays - totalWorkDays;
    const totalMinutes = workDayLogs.reduce((sum, l) => sum + l.totalMinutes, 0);
    const avgDailyHours = totalWorkDays > 0 ? (totalMinutes / totalWorkDays / 60) : 0;
    const weekendWorkDays = workDayLogs.filter(l => l.isWeekend).length;
    const lateNightCount = workDayLogs.filter(l => l.hasLateNight).length;
    const longestStreak = this.findLongestStreak(logs);
    const currentStreak = this.tracker.getConsecutiveWorkDays(endDate);

    const maxHoursInPeriod = this.data.config.maxDailyHours * (periodDays * 5 / 7); // ~weekdays
    const overtimePercentage = maxHoursInPeriod > 0
      ? Math.max(0, Math.round(((totalMinutes / 60) - maxHoursInPeriod) / maxHoursInPeriod * 100))
      : 0;

    const balanceScore = this.calculateBalanceScore({
      totalWorkDays, totalOffDays, avgDailyHours, weekendWorkDays,
      lateNightCount, longestStreak, currentStreak, periodDays,
    });

    const burnoutRisk = this.riskCalc.calculate(endDate);

    return {
      period: `${startStr} to ${endDate}`,
      totalWorkDays,
      totalOffDays,
      avgDailyHours: Math.round(avgDailyHours * 10) / 10,
      weekendWorkDays,
      lateNightCount,
      longestStreak,
      currentStreak,
      overtimePercentage,
      balanceScore,
      burnoutRisk,
    };
  }

  private calculateBalanceScore(stats: {
    totalWorkDays: number; totalOffDays: number; avgDailyHours: number;
    weekendWorkDays: number; lateNightCount: number; longestStreak: number;
    currentStreak: number; periodDays: number;
  }): number {
    let score = 100;

    // Penalize excessive daily hours
    if (stats.avgDailyHours > 10) score -= 25;
    else if (stats.avgDailyHours > 8) score -= 15;
    else if (stats.avgDailyHours > 6) score -= 0; // healthy range

    // Penalize too few off days (expect ~8 off days per 30)
    const expectedOff = Math.round(stats.periodDays * 2 / 7);
    if (stats.totalOffDays < expectedOff * 0.5) score -= 20;
    else if (stats.totalOffDays < expectedOff * 0.75) score -= 10;

    // Penalize weekend work
    score -= Math.min(20, stats.weekendWorkDays * 4);

    // Penalize late nights
    score -= Math.min(15, stats.lateNightCount * 3);

    // Penalize long streaks
    if (stats.longestStreak > 7) score -= 15;
    else if (stats.longestStreak > 5) score -= 5;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private findLongestStreak(logs: DailyLog[]): number {
    if (logs.length === 0) return 0;
    const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
    let longest = 0;
    let current = 0;

    // Fill in gaps for proper counting
    const startDate = new Date(sorted[0].date);
    const endDate = new Date(sorted[sorted.length - 1].date);
    const workDates = new Set(sorted.filter(l => l.totalMinutes > 0).map(l => l.date));

    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      const dateStr = cursor.toISOString().split('T')[0];
      if (workDates.has(dateStr)) {
        current++;
        longest = Math.max(longest, current);
      } else {
        current = 0;
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return longest;
  }
}

// ─── Wellness Check-In System ────────────────────────────────────────

export class WellnessCheckInSystem {
  constructor(private data: BurnoutPreventionData) {}

  recordCheckIn(checkIn: Omit<WellnessCheckIn, 'id'>): WellnessCheckIn {
    const full: WellnessCheckIn = {
      ...checkIn,
      id: `wc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };
    this.data.checkIns.push(full);
    return full;
  }

  getRecentCheckIns(count: number = 7): WellnessCheckIn[] {
    return this.data.checkIns.slice(-count);
  }

  getAverageWellness(days: number = 7): {
    energy: number; stress: number; sleep: number;
    motivation: number; physical: number; overall: number;
  } | null {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    const recent = this.data.checkIns.filter(c => c.date >= cutoffStr);
    if (recent.length === 0) return null;

    const avg = (arr: number[]) => Math.round(arr.reduce((s, v) => s + v, 0) / arr.length * 10) / 10;

    const energy = avg(recent.map(c => c.energyLevel));
    const stress = avg(recent.map(c => c.stressLevel));
    const sleep = avg(recent.map(c => c.sleepQuality));
    const motivation = avg(recent.map(c => c.motivation));
    const physical = avg(recent.map(c => c.physicalHealth));
    // Stress is inverted (high stress = bad)
    const overall = Math.round((energy + (6 - stress) + sleep + motivation + physical) / 5 * 10) / 10;

    return { energy, stress, sleep, motivation, physical, overall };
  }

  generateWeeklyPrompt(): string {
    const wellness = this.getAverageWellness(7);
    const prompts = [
      '📋 Weekly Wellness Check-In',
      '',
      'Rate each from 1 (low) to 5 (high):',
      '  Energy level:    ___',
      '  Stress level:    ___',
      '  Sleep quality:   ___',
      '  Motivation:      ___',
      '  Physical health: ___',
      '',
    ];

    if (wellness) {
      prompts.push('Last week\'s averages:');
      prompts.push(`  Energy: ${wellness.energy}/5 | Stress: ${wellness.stress}/5 | Sleep: ${wellness.sleep}/5`);
      prompts.push(`  Motivation: ${wellness.motivation}/5 | Physical: ${wellness.physical}/5`);
      prompts.push(`  Overall wellness: ${wellness.overall}/5`);
      prompts.push('');

      if (wellness.stress >= 4) {
        prompts.push('⚠️ Your stress has been high. What\'s the #1 stressor you can address this week?');
      }
      if (wellness.energy <= 2) {
        prompts.push('💤 Energy is low. Are you getting enough sleep? Consider a power nap or earlier bedtime.');
      }
      if (wellness.motivation <= 2) {
        prompts.push('🎯 Motivation dip detected. Sometimes working on a fun side task for 30 min can reignite drive.');
      }
    }

    return prompts.join('\n');
  }

  detectStressSignals(): BurnoutAlert[] {
    const alerts: BurnoutAlert[] = [];
    const now = new Date().toISOString();
    const recent = this.getRecentCheckIns(5);

    if (recent.length < 3) return alerts;

    // Declining energy trend
    const energies = recent.map(c => c.energyLevel);
    if (energies.length >= 3 && this.isTrendingDown(energies)) {
      alerts.push({
        level: 'warning',
        signal: 'declining-energy',
        message: 'Your energy levels have been dropping steadily.',
        actionable: 'Prioritize sleep and consider lighter workdays this week.',
        timestamp: now,
      });
    }

    // Rising stress trend
    const stresses = recent.map(c => c.stressLevel);
    if (stresses.length >= 3 && this.isTrendingUp(stresses)) {
      alerts.push({
        level: 'warning',
        signal: 'rising-stress',
        message: 'Stress has been trending upward over recent check-ins.',
        actionable: 'Identify your top stressor and take one concrete action to reduce it today.',
        timestamp: now,
      });
    }

    // Consistently low motivation
    const avgMotivation = recent.reduce((s, c) => s + c.motivation, 0) / recent.length;
    if (avgMotivation <= 2) {
      alerts.push({
        level: 'warning',
        signal: 'low-motivation',
        message: 'Motivation has been consistently low — this could signal early burnout.',
        actionable: 'Consider whether you need a project change, a break, or a conversation with a mentor/friend.',
        timestamp: now,
      });
    }

    return alerts;
  }

  private isTrendingDown(values: number[]): boolean {
    if (values.length < 3) return false;
    let downs = 0;
    for (let i = 1; i < values.length; i++) {
      if (values[i] < values[i - 1]) downs++;
    }
    return downs >= Math.ceil(values.length * 0.6);
  }

  private isTrendingUp(values: number[]): boolean {
    if (values.length < 3) return false;
    let ups = 0;
    for (let i = 1; i < values.length; i++) {
      if (values[i] > values[i - 1]) ups++;
    }
    return ups >= Math.ceil(values.length * 0.6);
  }
}

// ─── Pattern Recognition ─────────────────────────────────────────────

export class BurnoutPatternRecognizer {
  constructor(private data: BurnoutPreventionData) {}

  analyze(): BurnoutPattern[] {
    const patterns: BurnoutPattern[] = [];

    const sprintCrash = this.detectSprintCrashPattern();
    if (sprintCrash) patterns.push(sprintCrash);

    const weekendCreep = this.detectWeekendCreepPattern();
    if (weekendCreep) patterns.push(weekendCreep);

    const nightOwl = this.detectNightOwlPattern();
    if (nightOwl) patterns.push(nightOwl);

    const overcommit = this.detectOvercommitPattern();
    if (overcommit) patterns.push(overcommit);

    this.data.patterns = patterns;
    return patterns;
  }

  // Sprint-crash: periods of very high hours followed by very low hours or off days
  private detectSprintCrashPattern(): BurnoutPattern | null {
    const logs = this.data.dailyLogs.sort((a, b) => a.date.localeCompare(b.date));
    if (logs.length < 14) return null;

    let sprintCrashes = 0;
    let lastOccurrence = '';
    const maxDaily = this.data.config.maxDailyHours * 60;

    for (let i = 7; i < logs.length; i++) {
      const week1 = logs.slice(i - 7, i);
      const avgMinutesWeek1 = week1.reduce((s, l) => s + l.totalMinutes, 0) / 7;
      const week2Slice = logs.slice(i, Math.min(i + 7, logs.length));
      if (week2Slice.length < 3) continue;
      const avgMinutesWeek2 = week2Slice.reduce((s, l) => s + l.totalMinutes, 0) / week2Slice.length;

      // Sprint: >120% of max; Crash: <50% of sprint
      if (avgMinutesWeek1 > maxDaily * 1.2 && avgMinutesWeek2 < avgMinutesWeek1 * 0.5) {
        sprintCrashes++;
        lastOccurrence = logs[i].date;
      }
    }

    if (sprintCrashes === 0) return null;

    return {
      patternType: 'sprint-crash',
      description: 'You tend to sprint intensely then crash hard — a boom-bust work cycle.',
      occurrences: sprintCrashes,
      lastOccurrence,
      avgRiskScoreDuring: 65,
    };
  }

  // Weekend creep: increasing weekend work over time
  private detectWeekendCreepPattern(): BurnoutPattern | null {
    const weekendLogs = this.data.dailyLogs.filter(l => l.isWeekend && l.totalMinutes > 0);
    if (weekendLogs.length < 4) return null;

    const sorted = weekendLogs.sort((a, b) => a.date.localeCompare(b.date));
    const recent = sorted.slice(-4);
    const older = sorted.slice(0, Math.min(4, sorted.length - 4));

    if (older.length === 0) return null;

    const recentAvg = recent.reduce((s, l) => s + l.totalMinutes, 0) / recent.length;
    const olderAvg = older.reduce((s, l) => s + l.totalMinutes, 0) / older.length;

    if (recentAvg > olderAvg * 1.3) {
      return {
        patternType: 'weekend-creep',
        description: 'Weekend work hours are increasing — work is encroaching on your rest time.',
        occurrences: recent.length,
        lastOccurrence: recent[recent.length - 1].date,
        avgRiskScoreDuring: 50,
      };
    }

    return null;
  }

  // Night owl: frequent late-night sessions
  private detectNightOwlPattern(): BurnoutPattern | null {
    const lateNights = this.data.dailyLogs.filter(l => l.hasLateNight);
    if (lateNights.length < 5) return null;

    const sorted = lateNights.sort((a, b) => a.date.localeCompare(b.date));
    return {
      patternType: 'night-owl',
      description: 'Frequent late-night work sessions detected — this disrupts sleep and recovery.',
      occurrences: lateNights.length,
      lastOccurrence: sorted[sorted.length - 1].date,
      avgRiskScoreDuring: 45,
    };
  }

  // Overcommit: taking on too many clients at once
  private detectOvercommitPattern(): BurnoutPattern | null {
    const active = this.data.clients.filter(c => c.activeProjects > 0);
    if (active.length <= this.data.config.maxConcurrentClients) return null;

    return {
      patternType: 'overcommit',
      description: `You have ${active.length} active clients — more than your ${this.data.config.maxConcurrentClients}-client sweet spot.`,
      occurrences: 1,
      lastOccurrence: new Date().toISOString().split('T')[0],
      avgRiskScoreDuring: 55,
    };
  }
}

// ─── Recovery Tracker ────────────────────────────────────────────────

export class RecoveryTracker {
  constructor(private data: BurnoutPreventionData) {}

  logRecoveryPeriod(period: RecoveryPeriod): void {
    this.data.recoveryPeriods.push(period);
  }

  getAverageRecoveryDays(): number {
    if (this.data.recoveryPeriods.length === 0) return 0;
    return Math.round(
      this.data.recoveryPeriods.reduce((s, r) => s + r.durationDays, 0) /
      this.data.recoveryPeriods.length * 10
    ) / 10;
  }

  getRecoveryQuality(): { full: number; partial: number; none: number } {
    const periods = this.data.recoveryPeriods;
    return {
      full: periods.filter(r => r.quality === 'full').length,
      partial: periods.filter(r => r.quality === 'partial').length,
      none: periods.filter(r => r.quality === 'none').length,
    };
  }

  suggestRecovery(): string {
    const avg = this.getAverageRecoveryDays();
    const min = this.data.config.minRecoveryDays;

    if (avg < min) {
      return `Your average recovery between projects is ${avg} days — below the recommended ${min}. Try scheduling buffer days after project completions.`;
    }
    return `Your recovery time averages ${avg} days between projects — solid! Keep protecting that transition time.`;
  }
}

// ─── Workload Distribution Analyzer ──────────────────────────────────

export class WorkloadAnalyzer {
  constructor(private data: BurnoutPreventionData) {}

  analyzeDistribution(): {
    totalClients: number;
    activeClients: number;
    hoursPerClient: { clientId: string; clientName: string; hours: number; percentage: number }[];
    isBalanced: boolean;
    recommendation: string;
  } {
    const active = this.data.clients.filter(c => c.activeProjects > 0);
    const totalHours = active.reduce((s, c) => s + c.weeklyHours, 0);

    const hoursPerClient = active.map(c => ({
      clientId: c.clientId,
      clientName: c.clientName,
      hours: c.weeklyHours,
      percentage: totalHours > 0 ? Math.round(c.weeklyHours / totalHours * 100) : 0,
    }));

    // Check if any client takes >60% of time (risky dependency)
    const maxDependency = Math.max(...hoursPerClient.map(c => c.percentage), 0);
    const isBalanced = maxDependency <= 60 && active.length <= this.data.config.maxConcurrentClients;

    let recommendation = '';
    if (maxDependency > 60) {
      const topClient = hoursPerClient.find(c => c.percentage === maxDependency);
      recommendation = `${topClient?.clientName || 'One client'} takes ${maxDependency}% of your time — risky single-client dependency. Diversify.`;
    } else if (active.length > this.data.config.maxConcurrentClients) {
      recommendation = `You're managing ${active.length} clients. Consider finishing ${active.length - this.data.config.maxConcurrentClients} project(s) before taking more.`;
    } else {
      recommendation = 'Workload distribution looks healthy.';
    }

    return {
      totalClients: this.data.clients.length,
      activeClients: active.length,
      hoursPerClient,
      isBalanced,
      recommendation,
    };
  }
}

// ─── Boundary Manager ────────────────────────────────────────────────

export class BoundaryManager {
  constructor(private data: BurnoutPreventionData) {}

  getPersonalizedBoundaries(): string[] {
    const boundaries: string[] = [];
    const config = this.data.config;

    boundaries.push(`⏰ Daily limit: ${config.maxDailyHours}h — respect the shutdown time`);
    boundaries.push(`📅 Weekly limit: ${config.maxWeeklyHours}h — leave buffer for unexpected work`);
    boundaries.push(`🌙 No work after ${config.lateNightThreshold} — your brain needs downtime`);
    boundaries.push(`☀️ No work before ${config.earlyMorningThreshold} — mornings are for you`);
    boundaries.push(`🔄 Max ${config.maxConsecutiveDays} consecutive work days — then take a break`);
    boundaries.push(`👥 Max ${config.maxConcurrentClients} active clients — quality over quantity`);
    boundaries.push(`🏖️ At least ${config.minRecoveryDays} days between projects — transition buffer`);

    // Add dynamic boundaries based on current state
    const tracker = new WorkHoursTracker(this.data);
    const today = new Date().toISOString().split('T')[0];
    const streak = tracker.getConsecutiveWorkDays(today);
    const todayHours = tracker.getDailyHours(today);

    if (streak >= config.maxConsecutiveDays) {
      boundaries.push(`\n🚨 ACTIVE: You're on day ${streak} of consecutive work. Take a day off!`);
    }

    if (todayHours >= config.maxDailyHours * 0.8) {
      const remaining = Math.round((config.maxDailyHours - todayHours) * 60);
      if (remaining > 0) {
        boundaries.push(`\n⏳ TODAY: ${remaining} minutes left in your daily budget.`);
      } else {
        boundaries.push(`\n🛑 TODAY: You've exceeded your daily limit. Stop working.`);
      }
    }

    return boundaries;
  }

  updateConfig(updates: Partial<BurnoutConfig>): BurnoutConfig {
    Object.assign(this.data.config, updates);
    return this.data.config;
  }
}

// ─── CLI Integration ─────────────────────────────────────────────────

export function createCLI(): Command {
  const program = new Command();
  const store = new BurnoutDataStore();

  program
    .name('burnout-prevention')
    .description('Burnout Prevention System — protect your energy, sustain your career')
    .version('1.0.0');

  // Log a work session
  program
    .command('log')
    .description('Log a work session')
    .requiredOption('-d, --date <date>', 'Date (YYYY-MM-DD)')
    .requiredOption('-s, --start <time>', 'Start time (HH:mm)')
    .requiredOption('-e, --end <time>', 'End time (HH:mm)')
    .option('-c, --client <id>', 'Client ID')
    .option('-p, --project <id>', 'Project ID')
    .option('-n, --notes <text>', 'Notes')
    .action((opts) => {
      const data = store.load();
      const tracker = new WorkHoursTracker(data);
      const session = tracker.logSession({
        date: opts.date,
        startTime: opts.start,
        endTime: opts.end,
        clientId: opts.client,
        projectId: opts.project,
        notes: opts.notes,
      });
      store.save(data);

      const overtime = tracker.detectOvertime(opts.date);
      console.log(`✅ Logged: ${session.durationMinutes} min on ${opts.date}`);
      if (overtime.isOvertime) {
        console.log(`\n⚠️  ${overtime.message}`);
      }

      const streak = tracker.getConsecutiveWorkDays(opts.date);
      if (streak >= 5) {
        console.log(`\n📊 Current streak: ${streak} consecutive days`);
      }
    });

  // Check burnout risk
  program
    .command('risk')
    .description('Calculate current burnout risk score')
    .option('-d, --date <date>', 'As of date (YYYY-MM-DD)')
    .action((opts) => {
      const data = store.load();
      const calc = new BurnoutRiskCalculator(data);
      const risk = calc.calculate(opts.date);

      const bar = (val: number, max: number) => {
        const filled = Math.round(val / max * 20);
        return '█'.repeat(filled) + '░'.repeat(20 - filled);
      };

      console.log('\n🔥 BURNOUT RISK ASSESSMENT\n');
      console.log(`  Overall: ${risk.overall}/100 ${bar(risk.overall, 100)}`);
      console.log(`  Trend: ${risk.trend === 'improving' ? '📈 Improving' : risk.trend === 'worsening' ? '📉 Worsening' : '➡️ Stable'}`);
      console.log('\n  Components:');
      console.log(`    Work Hours:      ${risk.components.workHours}/25  ${bar(risk.components.workHours, 25)}`);
      console.log(`    Consistency:     ${risk.components.consistency}/20  ${bar(risk.components.consistency, 20)}`);
      console.log(`    Time of Day:     ${risk.components.timeOfDay}/15  ${bar(risk.components.timeOfDay, 15)}`);
      console.log(`    Weekend Work:    ${risk.components.weekendWork}/15  ${bar(risk.components.weekendWork, 15)}`);
      console.log(`    Client Overload: ${risk.components.clientOverload}/15  ${bar(risk.components.clientOverload, 15)}`);
      console.log(`    Recovery:        ${risk.components.recoveryDeficit}/10  ${bar(risk.components.recoveryDeficit, 10)}`);

      if (risk.alerts.length > 0) {
        console.log('\n  Alerts:');
        risk.alerts.forEach(a => {
          const icon = a.level === 'critical' ? '🚨' : a.level === 'warning' ? '⚠️' : 'ℹ️';
          console.log(`    ${icon} ${a.message}`);
          console.log(`       → ${a.actionable}`);
        });
      }

      if (risk.recommendations.length > 0) {
        console.log('\n  Recommendations:');
        risk.recommendations.forEach(r => console.log(`    • ${r}`));
      }
    });

  // Work-life balance report
  program
    .command('balance')
    .description('Generate work-life balance report')
    .option('-p, --period <days>', 'Period in days', '30')
    .option('-d, --date <date>', 'As of date')
    .action((opts) => {
      const data = store.load();
      const analyzer = new WorkLifeBalanceAnalyzer(data);
      const report = analyzer.generateReport(parseInt(opts.period), opts.date);

      console.log('\n⚖️  WORK-LIFE BALANCE REPORT\n');
      console.log(`  Period: ${report.period}`);
      console.log(`  Work days: ${report.totalWorkDays} | Off days: ${report.totalOffDays}`);
      console.log(`  Avg daily hours: ${report.avgDailyHours}h`);
      console.log(`  Weekend work days: ${report.weekendWorkDays}`);
      console.log(`  Late nights: ${report.lateNightCount}`);
      console.log(`  Longest streak: ${report.longestStreak} days`);
      console.log(`  Current streak: ${report.currentStreak} days`);
      console.log(`  Overtime: ${report.overtimePercentage}%`);
      console.log(`  Balance score: ${report.balanceScore}/100`);
      console.log(`  Burnout risk: ${report.burnoutRisk.overall}/100`);
    });

  // Wellness check-in
  program
    .command('checkin')
    .description('Record a wellness check-in')
    .requiredOption('--energy <n>', 'Energy level (1-5)')
    .requiredOption('--stress <n>', 'Stress level (1-5)')
    .requiredOption('--sleep <n>', 'Sleep quality (1-5)')
    .requiredOption('--motivation <n>', 'Motivation (1-5)')
    .requiredOption('--physical <n>', 'Physical health (1-5)')
    .option('-n, --notes <text>', 'Notes')
    .action((opts) => {
      const data = store.load();
      const wellness = new WellnessCheckInSystem(data);
      const checkIn = wellness.recordCheckIn({
        date: new Date().toISOString().split('T')[0],
        energyLevel: parseInt(opts.energy),
        stressLevel: parseInt(opts.stress),
        sleepQuality: parseInt(opts.sleep),
        motivation: parseInt(opts.motivation),
        physicalHealth: parseInt(opts.physical),
        notes: opts.notes,
      });
      store.save(data);

      console.log(`✅ Check-in recorded (${checkIn.id})`);

      const avg = wellness.getAverageWellness(7);
      if (avg) {
        console.log(`\n📊 7-day wellness: ${avg.overall}/5`);
      }

      const stressAlerts = wellness.detectStressSignals();
      stressAlerts.forEach(a => {
        console.log(`\n⚠️  ${a.message}`);
        console.log(`   → ${a.actionable}`);
      });
    });

  // Weekly wellness prompt
  program
    .command('weekly')
    .description('Show weekly wellness check-in prompt')
    .action(() => {
      const data = store.load();
      const wellness = new WellnessCheckInSystem(data);
      console.log(wellness.generateWeeklyPrompt());
    });

  // Boundaries
  program
    .command('boundaries')
    .description('Show your personalized work boundaries')
    .action(() => {
      const data = store.load();
      const boundary = new BoundaryManager(data);
      console.log('\n🛡️  YOUR WORK BOUNDARIES\n');
      boundary.getPersonalizedBoundaries().forEach(b => console.log(`  ${b}`));
    });

  // Patterns
  program
    .command('patterns')
    .description('Analyze historical burnout patterns')
    .action(() => {
      const data = store.load();
      const recognizer = new BurnoutPatternRecognizer(data);
      const patterns = recognizer.analyze();
      store.save(data);

      if (patterns.length === 0) {
        console.log('\n✅ No concerning patterns detected. Keep it up!');
        return;
      }

      console.log('\n🔍 DETECTED PATTERNS\n');
      patterns.forEach(p => {
        console.log(`  📌 ${p.patternType}`);
        console.log(`     ${p.description}`);
        console.log(`     Occurrences: ${p.occurrences} | Last: ${p.lastOccurrence}`);
        console.log(`     Risk during pattern: ~${p.avgRiskScoreDuring}/100`);
        console.log();
      });
    });

  // Workload
  program
    .command('workload')
    .description('Analyze workload distribution across clients')
    .action(() => {
      const data = store.load();
      const analyzer = new WorkloadAnalyzer(data);
      const dist = analyzer.analyzeDistribution();

      console.log('\n📊 WORKLOAD DISTRIBUTION\n');
      console.log(`  Total clients: ${dist.totalClients} | Active: ${dist.activeClients}`);
      console.log(`  Balanced: ${dist.isBalanced ? '✅ Yes' : '⚠️ No'}`);

      if (dist.hoursPerClient.length > 0) {
        console.log('\n  Hours per client:');
        dist.hoursPerClient.forEach(c => {
          console.log(`    ${c.clientName}: ${c.hours}h/week (${c.percentage}%)`);
        });
      }

      console.log(`\n  💡 ${dist.recommendation}`);
    });

  // Add client
  program
    .command('client')
    .description('Add or update a client')
    .requiredOption('-i, --id <id>', 'Client ID')
    .requiredOption('-n, --name <name>', 'Client name')
    .option('-p, --projects <n>', 'Active projects', '1')
    .option('-h, --hours <n>', 'Weekly hours', '10')
    .action((opts) => {
      const data = store.load();
      const existing = data.clients.findIndex(c => c.clientId === opts.id);
      const client: ClientLoad = {
        clientId: opts.id,
        clientName: opts.name,
        activeProjects: parseInt(opts.projects),
        weeklyHours: parseInt(opts.hours),
      };

      if (existing >= 0) {
        data.clients[existing] = client;
        console.log(`✅ Updated client: ${opts.name}`);
      } else {
        data.clients.push(client);
        console.log(`✅ Added client: ${opts.name}`);
      }
      store.save(data);
    });

  // Recovery
  program
    .command('recovery')
    .description('Log a recovery period between projects')
    .requiredOption('-s, --start <date>', 'Start date')
    .requiredOption('-e, --end <date>', 'End date')
    .option('-q, --quality <level>', 'Recovery quality: full|partial|none', 'full')
    .option('-c, --client <id>', 'After which client')
    .action((opts) => {
      const data = store.load();
      const tracker = new RecoveryTracker(data);
      const startD = new Date(opts.start);
      const endD = new Date(opts.end);
      const days = Math.round((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24));

      tracker.logRecoveryPeriod({
        startDate: opts.start,
        endDate: opts.end,
        durationDays: days,
        afterClientId: opts.client,
        quality: opts.quality as 'full' | 'partial' | 'none',
      });
      store.save(data);

      console.log(`✅ Recovery period logged: ${days} days (${opts.quality})`);
      console.log(`\n💡 ${tracker.suggestRecovery()}`);
    });

  // Config
  program
    .command('config')
    .description('View or update burnout prevention config')
    .option('--max-daily <hours>', 'Max daily hours')
    .option('--max-weekly <hours>', 'Max weekly hours')
    .option('--max-streak <days>', 'Max consecutive work days')
    .option('--max-clients <n>', 'Max concurrent clients')
    .option('--late-night <time>', 'Late night threshold (HH:mm)')
    .option('--early-morning <time>', 'Early morning threshold (HH:mm)')
    .action((opts) => {
      const data = store.load();
      const boundary = new BoundaryManager(data);
      const updates: Partial<BurnoutConfig> = {};

      if (opts.maxDaily) updates.maxDailyHours = parseInt(opts.maxDaily);
      if (opts.maxWeekly) updates.maxWeeklyHours = parseInt(opts.maxWeekly);
      if (opts.maxStreak) updates.maxConsecutiveDays = parseInt(opts.maxStreak);
      if (opts.maxClients) updates.maxConcurrentClients = parseInt(opts.maxClients);
      if (opts.lateNight) updates.lateNightThreshold = opts.lateNight;
      if (opts.earlyMorning) updates.earlyMorningThreshold = opts.earlyMorning;

      if (Object.keys(updates).length > 0) {
        const config = boundary.updateConfig(updates);
        store.save(data);
        console.log('✅ Config updated');
        console.log(JSON.stringify(config, null, 2));
      } else {
        console.log('📋 Current config:');
        console.log(JSON.stringify(data.config, null, 2));
      }
    });

  // Dashboard — quick summary
  program
    .command('dashboard')
    .description('Quick wellness dashboard')
    .action(() => {
      const data = store.load();
      const today = new Date().toISOString().split('T')[0];
      const tracker = new WorkHoursTracker(data);
      const riskCalc = new BurnoutRiskCalculator(data);
      const wellness = new WellnessCheckInSystem(data);
      const workload = new WorkloadAnalyzer(data);

      const risk = riskCalc.calculate(today);
      const avg = wellness.getAverageWellness(7);
      const dist = workload.analyzeDistribution();
      const streak = tracker.getConsecutiveWorkDays(today);
      const todayHours = tracker.getDailyHours(today);
      const weeklyHours = tracker.getWeeklyHours(today);

      const riskEmoji = risk.overall >= 70 ? '🔴' : risk.overall >= 45 ? '🟡' : '🟢';

      console.log('\n╔══════════════════════════════════════════╗');
      console.log('║      🧘 BURNOUT PREVENTION DASHBOARD     ║');
      console.log('╚══════════════════════════════════════════╝\n');
      console.log(`  ${riskEmoji} Burnout Risk: ${risk.overall}/100 (${risk.trend})`);
      console.log(`  ⏱️  Today: ${todayHours.toFixed(1)}h | Week: ${weeklyHours.toFixed(1)}h`);
      console.log(`  📅 Streak: ${streak} consecutive days`);
      console.log(`  👥 Active clients: ${dist.activeClients}`);

      if (avg) {
        console.log(`  💚 Wellness: ${avg.overall}/5`);
      }

      if (risk.alerts.length > 0) {
        console.log('\n  ⚡ Alerts:');
        risk.alerts.slice(0, 3).forEach(a => {
          const icon = a.level === 'critical' ? '🚨' : '⚠️';
          console.log(`    ${icon} ${a.message}`);
        });
      }

      if (risk.recommendations.length > 0) {
        console.log('\n  💡 Top recommendation:');
        console.log(`    ${risk.recommendations[0]}`);
      }
    });

  return program;
}

// ─── Exports ─────────────────────────────────────────────────────────

export {
  DEFAULT_CONFIG,
  DATA_DIR,
  DATA_FILE,
};

// ─── Main ────────────────────────────────────────────────────────────

if (require.main === module) {
  const program = createCLI();
  program.parse(process.argv);
}
