/**
 * Productivity Dashboard Test Suite
 * Comprehensive tests for CFX-069
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  DataStore,
  ScoringEngine,
  RevenueTracker,
  VelocityTracker,
  FocusRatioAnalyzer,
  ClientProfitabilityRanker,
  BenchmarkEngine,
  RecommendationsEngine,
  TrendGenerator,
  ProductivityDashboard,
  dateRange,
  formatDate,
  filterEntriesByRange,
  dayOfWeekName,
  timeOfDayBucket,
  TimeEntry,
  Project,
  Client,
  Goal,
  Period,
  ProductivityScore,
} from '../index';

// ── Helpers ────────────────────────────────────────────────────────────

function tmpDir(): string {
  const dir = path.join(os.tmpdir(), `pd-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanup(dir: string): void {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function makeEntry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: `te-${Math.random().toString(36).slice(2)}`,
    date: '2026-03-25',
    startTime: '09:00',
    endTime: '12:00',
    durationMinutes: 180,
    projectId: 'proj-1',
    clientId: 'client-1',
    taskType: 'focus',
    description: 'Test entry',
    tags: [],
    completed: true,
    ...overrides,
  };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-1',
    name: 'Test Project',
    clientId: 'client-1',
    budgetHours: 100,
    ratePerHour: 100,
    startDate: '2026-01-01',
    status: 'active',
    tasks: [],
    ...overrides,
  };
}

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 'client-1',
    name: 'Test Client',
    ratePerHour: 100,
    projects: ['proj-1'],
    totalRevenue: 0,
    totalHours: 0,
    ...overrides,
  };
}

// ── DataStore ──────────────────────────────────────────────────────────

describe('DataStore', () => {
  let dir: string;
  let store: DataStore;

  beforeEach(() => {
    dir = tmpDir();
    store = new DataStore(dir);
  });

  afterEach(() => cleanup(dir));

  test('creates data directory on construction', () => {
    expect(fs.existsSync(dir)).toBe(true);
  });

  test('returns empty arrays for missing files', () => {
    expect(store.getTimeEntries()).toEqual([]);
    expect(store.getProjects()).toEqual([]);
    expect(store.getClients()).toEqual([]);
    expect(store.getGoals()).toEqual([]);
    expect(store.getScoreHistory()).toEqual([]);
  });

  test('saves and loads time entries', () => {
    const entry = makeEntry();
    store.addTimeEntry(entry);
    const entries = store.getTimeEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe(entry.id);
  });

  test('saves and loads projects', () => {
    const project = makeProject();
    store.addProject(project);
    expect(store.getProjects()).toHaveLength(1);
  });

  test('saves and loads clients', () => {
    const client = makeClient();
    store.addClient(client);
    expect(store.getClients()).toHaveLength(1);
  });

  test('saves and loads goals', () => {
    store.addGoal({ id: 'g1', name: 'Test', metric: 'focus_ratio', target: 60, period: 'weekly', createdAt: '2026-01-01' });
    expect(store.getGoals()).toHaveLength(1);
  });

  test('appends scores to history', () => {
    const score: ProductivityScore = {
      score: 75,
      period: 'weekly',
      date: '2026-03-25',
      breakdown: { focusTimeScore: 20, taskCompletionScore: 20, revenueEfficiencyScore: 18, consistencyScore: 17 },
    };
    store.appendScore(score);
    store.appendScore({ ...score, score: 80 });
    expect(store.getScoreHistory()).toHaveLength(2);
  });

  test('handles corrupt JSON gracefully', () => {
    fs.writeFileSync(path.join(dir, 'time-entries.json'), 'NOT JSON!!!');
    expect(store.getTimeEntries()).toEqual([]);
  });
});

// ── Utilities ──────────────────────────────────────────────────────────

describe('Utility functions', () => {
  test('formatDate returns YYYY-MM-DD', () => {
    const d = new Date('2026-03-25T12:00:00Z');
    expect(formatDate(d)).toBe('2026-03-25');
  });

  test('dateRange daily returns same day', () => {
    const range = dateRange('daily', '2026-03-25');
    expect(range.start).toBe('2026-03-25');
    expect(range.end).toBe('2026-03-25');
  });

  test('dateRange weekly starts from Monday', () => {
    // 2026-03-25 is a Wednesday
    const range = dateRange('weekly', '2026-03-25');
    expect(range.start).toBe('2026-03-23'); // Monday
    expect(range.end).toBe('2026-03-25');
  });

  test('dateRange monthly starts from 1st', () => {
    const range = dateRange('monthly', '2026-03-25');
    expect(range.start).toBe('2026-03-01');
    expect(range.end).toBe('2026-03-25');
  });

  test('filterEntriesByRange filters correctly', () => {
    const entries = [
      makeEntry({ date: '2026-03-20' }),
      makeEntry({ date: '2026-03-25' }),
      makeEntry({ date: '2026-03-30' }),
    ];
    const filtered = filterEntriesByRange(entries, '2026-03-22', '2026-03-27');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].date).toBe('2026-03-25');
  });

  test('dayOfWeekName returns correct day', () => {
    expect(dayOfWeekName('2026-03-23')).toBe('Monday');
    expect(dayOfWeekName('2026-03-25')).toBe('Wednesday');
    expect(dayOfWeekName('2026-03-29')).toBe('Sunday');
  });

  test('timeOfDayBucket categorizes correctly', () => {
    expect(timeOfDayBucket('08:00')).toBe('morning');
    expect(timeOfDayBucket('11:59')).toBe('morning');
    expect(timeOfDayBucket('12:00')).toBe('afternoon');
    expect(timeOfDayBucket('16:59')).toBe('afternoon');
    expect(timeOfDayBucket('17:00')).toBe('evening');
    expect(timeOfDayBucket('23:00')).toBe('evening');
  });
});

// ── ScoringEngine ──────────────────────────────────────────────────────

describe('ScoringEngine', () => {
  const engine = new ScoringEngine();

  test('returns 0 score for no entries', () => {
    const result = engine.calculate([], [], [], 'daily', '2026-03-25');
    // No entries → 0 focus, 25 task (no tasks), 0 revenue, 0 consistency
    expect(result.score).toBe(25);
    expect(result.breakdown.focusTimeScore).toBe(0);
    expect(result.breakdown.taskCompletionScore).toBe(25);
  });

  test('calculates focus time score correctly', () => {
    const entries = [
      makeEntry({ durationMinutes: 180, taskType: 'focus' }),
      makeEntry({ durationMinutes: 60, taskType: 'admin' }),
      makeEntry({ durationMinutes: 60, taskType: 'meeting' }),
    ];
    // focus = 180/300 = 60% → 25/25
    const result = engine.calculate(entries, [], [], 'daily', '2026-03-25');
    expect(result.breakdown.focusTimeScore).toBe(25);
  });

  test('caps focus score at 25', () => {
    const entries = [makeEntry({ durationMinutes: 480, taskType: 'focus' })];
    const result = engine.calculate(entries, [], [], 'daily', '2026-03-25');
    expect(result.breakdown.focusTimeScore).toBeLessThanOrEqual(25);
  });

  test('calculates task completion score', () => {
    const projects = [makeProject({
      tasks: [
        { id: 't1', title: 'Done', estimatedMinutes: 60, status: 'done', completedAt: '2026-03-25', createdAt: '2026-03-20' },
        { id: 't2', title: 'Todo', estimatedMinutes: 60, status: 'todo', createdAt: '2026-03-20' },
      ],
    })];
    const result = engine.calculate([], projects, [], 'weekly', '2026-03-25');
    // 1/2 tasks done → 12.5
    expect(result.breakdown.taskCompletionScore).toBe(12.5);
  });

  test('calculates revenue efficiency score', () => {
    const entries = [makeEntry({ durationMinutes: 60, taskType: 'focus' })];
    const projects = [makeProject({ ratePerHour: 100 })]; // 1hr * $100 = $100/hr → 25/25
    const result = engine.calculate(entries, projects, [], 'daily', '2026-03-25');
    expect(result.breakdown.revenueEfficiencyScore).toBe(25);
  });

  test('calculates consistency score for daily', () => {
    const entries = [makeEntry()];
    const result = engine.calculate(entries, [], [], 'daily', '2026-03-25');
    expect(result.breakdown.consistencyScore).toBe(25); // has entries → 25
  });

  test('score is between 0 and 100', () => {
    const entries = [
      makeEntry({ durationMinutes: 480, taskType: 'focus' }),
    ];
    const projects = [makeProject({ ratePerHour: 200 })];
    const result = engine.calculate(entries, projects, [], 'daily', '2026-03-25');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

// ── RevenueTracker ─────────────────────────────────────────────────────

describe('RevenueTracker', () => {
  const tracker = new RevenueTracker();

  test('calculates revenue per hour', () => {
    const entries = [
      makeEntry({ durationMinutes: 120, taskType: 'focus', projectId: 'proj-1' }),
    ];
    const projects = [makeProject({ ratePerHour: 100 })];
    const clients = [makeClient()];
    const result = tracker.calculate(entries, projects, clients);

    expect(result.revenuePerHour).toBe(100);
    expect(result.totalRevenue).toBe(200); // 2 hours * $100
    expect(result.totalBillableHours).toBe(2);
  });

  test('ignores non-focus entries', () => {
    const entries = [
      makeEntry({ durationMinutes: 60, taskType: 'admin' }),
      makeEntry({ durationMinutes: 60, taskType: 'meeting' }),
    ];
    const result = tracker.calculate(entries, [makeProject()], [makeClient()]);
    expect(result.totalRevenue).toBe(0);
    expect(result.totalBillableHours).toBe(0);
  });

  test('groups by project and client', () => {
    const entries = [
      makeEntry({ durationMinutes: 60, projectId: 'proj-1', clientId: 'client-1' }),
      makeEntry({ durationMinutes: 120, projectId: 'proj-2', clientId: 'client-2' }),
    ];
    const projects = [
      makeProject({ id: 'proj-1', clientId: 'client-1', ratePerHour: 100 }),
      makeProject({ id: 'proj-2', clientId: 'client-2', ratePerHour: 50 }),
    ];
    const clients = [
      makeClient({ id: 'client-1', name: 'Client A' }),
      makeClient({ id: 'client-2', name: 'Client B' }),
    ];
    const result = tracker.calculate(entries, projects, clients);

    expect(result.byProject).toHaveLength(2);
    expect(result.byClient).toHaveLength(2);
    // sorted by revenue desc: proj-1 = $100, proj-2 = $100
    expect(result.totalRevenue).toBe(200);
  });

  test('handles unknown project gracefully', () => {
    const entries = [makeEntry({ projectId: 'unknown' })];
    const result = tracker.calculate(entries, [], []);
    expect(result.totalRevenue).toBe(0);
  });
});

// ── VelocityTracker ────────────────────────────────────────────────────

describe('VelocityTracker', () => {
  const tracker = new VelocityTracker();

  test('calculates completion rate', () => {
    const projects = [makeProject({
      tasks: [
        { id: 't1', title: 'Done', estimatedMinutes: 60, actualMinutes: 50, status: 'done', completedAt: '2026-03-25', createdAt: '2026-03-20' },
        { id: 't2', title: 'Todo', estimatedMinutes: 60, status: 'todo', createdAt: '2026-03-20' },
      ],
    })];
    const result = tracker.calculate(projects, { start: '2026-03-20', end: '2026-03-25' });
    expect(result.completionRate).toBe(0.5);
  });

  test('calculates estimation accuracy', () => {
    const projects = [makeProject({
      tasks: [
        { id: 't1', title: 'T1', estimatedMinutes: 60, actualMinutes: 90, status: 'done', completedAt: '2026-03-25', createdAt: '2026-03-20' },
        { id: 't2', title: 'T2', estimatedMinutes: 100, actualMinutes: 120, status: 'done', completedAt: '2026-03-25', createdAt: '2026-03-20' },
      ],
    })];
    const result = tracker.calculate(projects, { start: '2026-03-20', end: '2026-03-25' });
    // accuracy = (90/60 + 120/100) / 2 = (1.5 + 1.2) / 2 = 1.35
    expect(result.estimationAccuracy).toBeCloseTo(1.35, 1);
  });

  test('detects improving trend', () => {
    const projects = [makeProject({
      tasks: [
        { id: 't1', title: 'T1', estimatedMinutes: 60, status: 'done', completedAt: '2026-03-24', createdAt: '2026-03-20' },
        { id: 't2', title: 'T2', estimatedMinutes: 60, status: 'done', completedAt: '2026-03-25', createdAt: '2026-03-20' },
        { id: 't3', title: 'T3', estimatedMinutes: 60, status: 'done', completedAt: '2026-03-25', createdAt: '2026-03-20' },
        { id: 't4', title: 'T4', estimatedMinutes: 60, status: 'done', completedAt: '2026-03-25', createdAt: '2026-03-20' },
      ],
    })];
    const result = tracker.calculate(projects, { start: '2026-03-20', end: '2026-03-25' });
    expect(result.trend).toBe('improving');
  });

  test('returns 1 for estimation accuracy when no estimates', () => {
    const result = tracker.calculate([], { start: '2026-03-20', end: '2026-03-25' });
    expect(result.estimationAccuracy).toBe(1);
  });
});

// ── FocusRatioAnalyzer ─────────────────────────────────────────────────

describe('FocusRatioAnalyzer', () => {
  const analyzer = new FocusRatioAnalyzer();

  test('calculates focus ratio correctly', () => {
    const entries = [
      makeEntry({ durationMinutes: 180, taskType: 'focus' }),
      makeEntry({ durationMinutes: 60, taskType: 'admin' }),
      makeEntry({ durationMinutes: 30, taskType: 'meeting' }),
      makeEntry({ durationMinutes: 30, taskType: 'break' }),
    ];
    const result = analyzer.calculate(entries);
    expect(result.focusMinutes).toBe(180);
    expect(result.adminMinutes).toBe(60);
    expect(result.meetingMinutes).toBe(30);
    expect(result.breakMinutes).toBe(30);
    expect(result.totalMinutes).toBe(300);
    expect(result.focusPercentage).toBe(60);
    expect(result.ratio).toBe(3); // 180/60
  });

  test('handles zero admin (infinite ratio)', () => {
    const entries = [makeEntry({ durationMinutes: 120, taskType: 'focus' })];
    const result = analyzer.calculate(entries);
    expect(result.ratio).toBe(Infinity);
  });

  test('handles no entries', () => {
    const result = analyzer.calculate([]);
    expect(result.totalMinutes).toBe(0);
    expect(result.focusPercentage).toBe(0);
    expect(result.ratio).toBe(0);
  });
});

// ── ClientProfitabilityRanker ──────────────────────────────────────────

describe('ClientProfitabilityRanker', () => {
  const ranker = new ClientProfitabilityRanker();

  test('ranks clients by profitability', () => {
    const entries = [
      makeEntry({ durationMinutes: 120, taskType: 'focus', projectId: 'proj-1', clientId: 'client-1' }),
      makeEntry({ durationMinutes: 60, taskType: 'focus', projectId: 'proj-2', clientId: 'client-2' }),
      makeEntry({ durationMinutes: 60, taskType: 'admin', projectId: 'proj-2', clientId: 'client-2' }),
    ];
    const projects = [
      makeProject({ id: 'proj-1', clientId: 'client-1', ratePerHour: 120 }),
      makeProject({ id: 'proj-2', clientId: 'client-2', ratePerHour: 80 }),
    ];
    const clients = [
      makeClient({ id: 'client-1', name: 'High Payer' }),
      makeClient({ id: 'client-2', name: 'Low Payer' }),
    ];

    const result = ranker.calculate(entries, projects, clients);
    expect(result).toHaveLength(2);
    expect(result[0].clientName).toBe('High Payer');
    expect(result[0].rank).toBe(1);
    expect(result[1].rank).toBe(2);
  });

  test('accounts for overhead hours in effective rate', () => {
    const entries = [
      makeEntry({ durationMinutes: 60, taskType: 'focus', projectId: 'proj-1' }),
      makeEntry({ durationMinutes: 60, taskType: 'meeting', projectId: 'proj-1' }),
    ];
    const projects = [makeProject({ ratePerHour: 100 })];
    const clients = [makeClient()];

    const result = ranker.calculate(entries, projects, clients);
    expect(result).toHaveLength(1);
    // Revenue = 1hr * $100 = $100, Total hours = 2hr, Effective rate = $50/hr
    expect(result[0].effectiveRate).toBe(50);
    expect(result[0].overheadHours).toBe(1);
  });
});

// ── BenchmarkEngine ────────────────────────────────────────────────────

describe('BenchmarkEngine', () => {
  const engine = new BenchmarkEngine();

  test('creates benchmarks for all metrics', () => {
    const score: ProductivityScore = {
      score: 70, period: 'weekly', date: '2026-03-25',
      breakdown: { focusTimeScore: 18, taskCompletionScore: 18, revenueEfficiencyScore: 17, consistencyScore: 17 },
    };
    const revenue = { revenuePerHour: 90, totalRevenue: 900, totalBillableHours: 10, byProject: [], byClient: [] };
    const velocity = { completionRate: 0.7, averageTaskMinutes: 60, tasksCompletedPerDay: 3, estimationAccuracy: 1.1, trend: 'stable' as const };
    const focus = { focusMinutes: 300, adminMinutes: 120, meetingMinutes: 60, learningMinutes: 0, breakMinutes: 0, totalMinutes: 480, focusPercentage: 62.5, adminPercentage: 25, ratio: 2.5 };

    const result = engine.compare(score, revenue, velocity, focus, [], []);
    expect(result.length).toBeGreaterThanOrEqual(4);
  });

  test('marks benchmarks as above when exceeding goal', () => {
    const score: ProductivityScore = {
      score: 95, period: 'weekly', date: '2026-03-25',
      breakdown: { focusTimeScore: 25, taskCompletionScore: 25, revenueEfficiencyScore: 22, consistencyScore: 23 },
    };
    const goals: Goal[] = [{ id: 'g1', name: 'Score', metric: 'productivity_score', target: 80, period: 'weekly', createdAt: '2026-01-01' }];
    const result = engine.compare(
      score,
      { revenuePerHour: 120, totalRevenue: 0, totalBillableHours: 0, byProject: [], byClient: [] },
      { completionRate: 0.9, averageTaskMinutes: 0, tasksCompletedPerDay: 0, estimationAccuracy: 1, trend: 'stable' },
      { focusMinutes: 0, adminMinutes: 0, meetingMinutes: 0, learningMinutes: 0, breakMinutes: 0, totalMinutes: 0, focusPercentage: 70, adminPercentage: 0, ratio: 0 },
      [], goals,
    );

    const scoreBenchmark = result.find(b => b.metric === 'Productivity Score');
    expect(scoreBenchmark?.status).toBe('above');
  });

  test('marks benchmarks as below when under 80% of goal', () => {
    const score: ProductivityScore = {
      score: 40, period: 'weekly', date: '2026-03-25',
      breakdown: { focusTimeScore: 10, taskCompletionScore: 10, revenueEfficiencyScore: 10, consistencyScore: 10 },
    };
    const goals: Goal[] = [{ id: 'g1', name: 'Score', metric: 'productivity_score', target: 80, period: 'weekly', createdAt: '2026-01-01' }];
    const result = engine.compare(
      score,
      { revenuePerHour: 50, totalRevenue: 0, totalBillableHours: 0, byProject: [], byClient: [] },
      { completionRate: 0.3, averageTaskMinutes: 0, tasksCompletedPerDay: 0, estimationAccuracy: 1, trend: 'stable' },
      { focusMinutes: 0, adminMinutes: 0, meetingMinutes: 0, learningMinutes: 0, breakMinutes: 0, totalMinutes: 0, focusPercentage: 30, adminPercentage: 0, ratio: 0 },
      [], goals,
    );
    const scoreBenchmark = result.find(b => b.metric === 'Productivity Score');
    expect(scoreBenchmark?.status).toBe('below');
  });
});

// ── RecommendationsEngine ──────────────────────────────────────────────

describe('RecommendationsEngine', () => {
  const engine = new RecommendationsEngine();

  test('generates low-focus recommendation', () => {
    const entries = [
      makeEntry({ durationMinutes: 60, taskType: 'focus' }),
      makeEntry({ durationMinutes: 120, taskType: 'admin' }),
      makeEntry({ durationMinutes: 60, taskType: 'meeting' }),
    ];
    const focus = { focusMinutes: 60, adminMinutes: 120, meetingMinutes: 60, learningMinutes: 0, breakMinutes: 0, totalMinutes: 240, focusPercentage: 25, adminPercentage: 50, ratio: 0.5 };
    const score: ProductivityScore = { score: 40, period: 'weekly', date: '2026-03-25', breakdown: { focusTimeScore: 10, taskCompletionScore: 10, revenueEfficiencyScore: 10, consistencyScore: 10 } };

    const recs = engine.generate(entries, [], [], score,
      { revenuePerHour: 50, totalRevenue: 0, totalBillableHours: 0, byProject: [], byClient: [] },
      { completionRate: 0.5, averageTaskMinutes: 60, tasksCompletedPerDay: 2, estimationAccuracy: 1, trend: 'stable' },
      focus, [], [],
    );

    const focusRec = recs.find(r => r.type === 'focus-improvement');
    expect(focusRec).toBeDefined();
    expect(focusRec!.title).toContain('below 50%');
  });

  test('generates revenue optimization recommendation for rate gap', () => {
    const revenue = {
      revenuePerHour: 75, totalRevenue: 750, totalBillableHours: 10,
      byProject: [],
      byClient: [
        { clientId: 'c1', clientName: 'Big Corp', revenuePerHour: 150, totalRevenue: 600, totalHours: 4 },
        { clientId: 'c2', clientName: 'SmallBiz', revenuePerHour: 25, totalRevenue: 150, totalHours: 6 },
      ],
    };
    const recs = engine.generate([], [], [], 
      { score: 60, period: 'weekly', date: '2026-03-25', breakdown: { focusTimeScore: 15, taskCompletionScore: 15, revenueEfficiencyScore: 15, consistencyScore: 15 } },
      revenue,
      { completionRate: 0.5, averageTaskMinutes: 60, tasksCompletedPerDay: 2, estimationAccuracy: 1, trend: 'stable' },
      { focusMinutes: 300, adminMinutes: 60, meetingMinutes: 0, learningMinutes: 0, breakMinutes: 0, totalMinutes: 360, focusPercentage: 83, adminPercentage: 17, ratio: 5 },
      [], [],
    );

    const revRec = recs.find(r => r.type === 'revenue-optimization');
    expect(revRec).toBeDefined();
    expect(revRec!.title).toContain('SmallBiz');
  });

  test('generates estimation accuracy recommendation', () => {
    const recs = engine.generate([], [], [],
      { score: 60, period: 'weekly', date: '2026-03-25', breakdown: { focusTimeScore: 15, taskCompletionScore: 15, revenueEfficiencyScore: 15, consistencyScore: 15 } },
      { revenuePerHour: 100, totalRevenue: 0, totalBillableHours: 0, byProject: [], byClient: [] },
      { completionRate: 0.5, averageTaskMinutes: 60, tasksCompletedPerDay: 2, estimationAccuracy: 1.5, trend: 'stable' },
      { focusMinutes: 300, adminMinutes: 60, meetingMinutes: 0, learningMinutes: 0, breakMinutes: 0, totalMinutes: 360, focusPercentage: 83, adminPercentage: 17, ratio: 5 },
      [], [],
    );

    const estRec = recs.find(r => r.type === 'task-planning');
    expect(estRec).toBeDefined();
    expect(estRec!.title).toContain('longer than estimated');
  });

  test('generates day-of-week pattern recommendation', () => {
    // Create entries where Tuesdays are admin-heavy
    const entries: TimeEntry[] = [];
    // Tuesday 2026-03-24 - mostly admin
    entries.push(makeEntry({ date: '2026-03-24', startTime: '09:00', durationMinutes: 60, taskType: 'admin' }));
    entries.push(makeEntry({ date: '2026-03-24', startTime: '10:00', durationMinutes: 60, taskType: 'admin' }));
    entries.push(makeEntry({ date: '2026-03-24', startTime: '13:00', durationMinutes: 30, taskType: 'focus' }));
    // Wednesday 2026-03-25 - mostly focus
    entries.push(makeEntry({ date: '2026-03-25', startTime: '09:00', durationMinutes: 120, taskType: 'focus' }));

    const recs = engine.generate(entries, [], [],
      { score: 60, period: 'weekly', date: '2026-03-25', breakdown: { focusTimeScore: 15, taskCompletionScore: 15, revenueEfficiencyScore: 15, consistencyScore: 15 } },
      { revenuePerHour: 100, totalRevenue: 0, totalBillableHours: 0, byProject: [], byClient: [] },
      { completionRate: 0.5, averageTaskMinutes: 60, tasksCompletedPerDay: 2, estimationAccuracy: 1, trend: 'stable' },
      { focusMinutes: 150, adminMinutes: 120, meetingMinutes: 0, learningMinutes: 0, breakMinutes: 0, totalMinutes: 270, focusPercentage: 55.6, adminPercentage: 44.4, ratio: 1.25 },
      [], [],
    );

    const dayRec = recs.find(r => r.type === 'time-optimization' && r.title.includes('Tuesday'));
    expect(dayRec).toBeDefined();
  });

  test('generates declining velocity recommendation', () => {
    const recs = engine.generate([], [], [],
      { score: 50, period: 'weekly', date: '2026-03-25', breakdown: { focusTimeScore: 12, taskCompletionScore: 12, revenueEfficiencyScore: 13, consistencyScore: 13 } },
      { revenuePerHour: 100, totalRevenue: 0, totalBillableHours: 0, byProject: [], byClient: [] },
      { completionRate: 0.3, averageTaskMinutes: 60, tasksCompletedPerDay: 1, estimationAccuracy: 1, trend: 'declining' },
      { focusMinutes: 300, adminMinutes: 60, meetingMinutes: 0, learningMinutes: 0, breakMinutes: 0, totalMinutes: 360, focusPercentage: 83, adminPercentage: 17, ratio: 5 },
      [], [],
    );

    const decRec = recs.find(r => r.type === 'workload-balance');
    expect(decRec).toBeDefined();
    expect(decRec!.title).toContain('declining');
  });

  test('recommendations are sorted by priority', () => {
    const entries = [
      makeEntry({ durationMinutes: 30, taskType: 'focus' }),
      makeEntry({ durationMinutes: 120, taskType: 'admin' }),
    ];
    const recs = engine.generate(entries, [], [],
      { score: 30, period: 'weekly', date: '2026-03-25', breakdown: { focusTimeScore: 8, taskCompletionScore: 8, revenueEfficiencyScore: 7, consistencyScore: 7 } },
      { revenuePerHour: 30, totalRevenue: 0, totalBillableHours: 0, byProject: [], byClient: [
        { clientId: 'c1', clientName: 'A', revenuePerHour: 200, totalRevenue: 400, totalHours: 2 },
        { clientId: 'c2', clientName: 'B', revenuePerHour: 20, totalRevenue: 120, totalHours: 6 },
      ] },
      { completionRate: 0.2, averageTaskMinutes: 60, tasksCompletedPerDay: 0.5, estimationAccuracy: 1.6, trend: 'declining' },
      { focusMinutes: 30, adminMinutes: 120, meetingMinutes: 0, learningMinutes: 0, breakMinutes: 0, totalMinutes: 150, focusPercentage: 20, adminPercentage: 80, ratio: 0.25 },
      [], [],
    );

    if (recs.length >= 2) {
      const priorities = recs.map(r => r.priority);
      const order = { high: 0, medium: 1, low: 2 };
      for (let i = 1; i < priorities.length; i++) {
        expect(order[priorities[i]]).toBeGreaterThanOrEqual(order[priorities[i - 1]]);
      }
    }
  });
});

// ── TrendGenerator ─────────────────────────────────────────────────────

describe('TrendGenerator', () => {
  const generator = new TrendGenerator();

  test('generates score trend from history', () => {
    const history: ProductivityScore[] = [
      { score: 60, period: 'weekly', date: '2026-03-14', breakdown: { focusTimeScore: 15, taskCompletionScore: 15, revenueEfficiencyScore: 15, consistencyScore: 15 } },
      { score: 70, period: 'weekly', date: '2026-03-21', breakdown: { focusTimeScore: 18, taskCompletionScore: 18, revenueEfficiencyScore: 17, consistencyScore: 17 } },
    ];
    const trend = generator.generateScoreTrend(history);
    expect(trend.labels).toEqual(['2026-03-14', '2026-03-21']);
    expect(trend.datasets).toHaveLength(5);
    expect(trend.datasets[0].data).toEqual([60, 70]);
  });

  test('generates revenue trend', () => {
    const entries = [
      makeEntry({ date: '2026-03-24', durationMinutes: 60, taskType: 'focus', projectId: 'proj-1' }),
      makeEntry({ date: '2026-03-25', durationMinutes: 120, taskType: 'focus', projectId: 'proj-1' }),
    ];
    const projects = [makeProject({ ratePerHour: 100 })];
    const trend = generator.generateRevenueTrend(entries, projects);
    expect(trend.labels).toHaveLength(2);
    expect(trend.datasets[0].label).toContain('Revenue');
  });

  test('generates focus trend', () => {
    const entries = [
      makeEntry({ date: '2026-03-24', durationMinutes: 120, taskType: 'focus' }),
      makeEntry({ date: '2026-03-24', durationMinutes: 30, taskType: 'admin' }),
      makeEntry({ date: '2026-03-25', durationMinutes: 60, taskType: 'focus' }),
    ];
    const trend = generator.generateFocusTrend(entries);
    expect(trend.labels).toEqual(['2026-03-24', '2026-03-25']);
    expect(trend.datasets).toHaveLength(3);
  });
});

// ── ProductivityDashboard (Integration) ────────────────────────────────

describe('ProductivityDashboard', () => {
  let dir: string;
  let dashboard: ProductivityDashboard;

  beforeEach(() => {
    dir = tmpDir();
    dashboard = new ProductivityDashboard(dir);
  });

  afterEach(() => cleanup(dir));

  test('generates empty dashboard without data', () => {
    const data = dashboard.generateDashboard('daily', '2026-03-25');
    expect(data.productivityScore.score).toBeDefined();
    expect(data.revenue.totalRevenue).toBe(0);
    expect(data.recommendations).toBeDefined();
  });

  test('logTime adds and persists entry', () => {
    const entry = dashboard.logTime({
      date: '2026-03-25',
      startTime: '09:00',
      endTime: '12:00',
      durationMinutes: 180,
      projectId: 'proj-1',
      clientId: 'client-1',
      taskType: 'focus',
      description: 'Test',
      tags: [],
      completed: true,
    });
    expect(entry.id).toBeDefined();
    expect(dashboard.getStore().getTimeEntries()).toHaveLength(1);
  });

  test('addProject adds project', () => {
    const project = dashboard.addProject({
      id: 'proj-1',
      name: 'Test',
      clientId: 'client-1',
      budgetHours: 40,
      ratePerHour: 100,
      startDate: '2026-01-01',
      status: 'active',
    });
    expect(project.tasks).toEqual([]);
    expect(dashboard.getStore().getProjects()).toHaveLength(1);
  });

  test('addClient adds client', () => {
    const client = dashboard.addClient({
      id: 'c1',
      name: 'Test Client',
      ratePerHour: 100,
      projects: [],
    });
    expect(client.totalRevenue).toBe(0);
    expect(dashboard.getStore().getClients()).toHaveLength(1);
  });

  test('addTask adds task to project', () => {
    dashboard.addProject({ id: 'proj-1', name: 'P', clientId: 'c1', budgetHours: 10, ratePerHour: 50, startDate: '2026-01-01', status: 'active' });
    const task = dashboard.addTask('proj-1', { title: 'Do stuff', estimatedMinutes: 60, status: 'todo' });
    expect(task).not.toBeNull();
    expect(task!.id).toBeDefined();
    expect(dashboard.getStore().getProjects()[0].tasks).toHaveLength(1);
  });

  test('addTask returns null for unknown project', () => {
    const task = dashboard.addTask('nonexistent', { title: 'X', estimatedMinutes: 30, status: 'todo' });
    expect(task).toBeNull();
  });

  test('completeTask marks task done', () => {
    dashboard.addProject({ id: 'proj-1', name: 'P', clientId: 'c1', budgetHours: 10, ratePerHour: 50, startDate: '2026-01-01', status: 'active' });
    const task = dashboard.addTask('proj-1', { title: 'Do stuff', estimatedMinutes: 60, status: 'todo' });
    const ok = dashboard.completeTask('proj-1', task!.id, 45);
    expect(ok).toBe(true);
    expect(dashboard.getStore().getProjects()[0].tasks[0].status).toBe('done');
    expect(dashboard.getStore().getProjects()[0].tasks[0].actualMinutes).toBe(45);
  });

  test('completeTask returns false for unknown project', () => {
    expect(dashboard.completeTask('nope', 'nope')).toBe(false);
  });

  test('completeTask returns false for unknown task', () => {
    dashboard.addProject({ id: 'proj-1', name: 'P', clientId: 'c1', budgetHours: 10, ratePerHour: 50, startDate: '2026-01-01', status: 'active' });
    expect(dashboard.completeTask('proj-1', 'nope')).toBe(false);
  });

  test('setGoal persists goal', () => {
    const goal = dashboard.setGoal({ name: 'Score Goal', metric: 'productivity_score', target: 80, period: 'weekly' });
    expect(goal.id).toBeDefined();
    expect(dashboard.getStore().getGoals()).toHaveLength(1);
  });

  test('full integration: seed data and generate dashboard', () => {
    // Seed manually
    const store = dashboard.getStore();
    store.saveClients([makeClient({ id: 'c1', name: 'ClientA' })]);
    store.saveProjects([makeProject({
      id: 'p1', clientId: 'c1', ratePerHour: 100,
      tasks: [
        { id: 't1', title: 'Task1', estimatedMinutes: 60, actualMinutes: 50, status: 'done', completedAt: '2026-03-25', createdAt: '2026-03-20' },
      ],
    })]);
    store.saveTimeEntries([
      makeEntry({ date: '2026-03-25', durationMinutes: 180, taskType: 'focus', projectId: 'p1', clientId: 'c1' }),
      makeEntry({ date: '2026-03-25', durationMinutes: 60, taskType: 'admin', projectId: 'p1', clientId: 'c1' }),
    ]);
    store.saveGoals([{ id: 'g1', name: 'Score', metric: 'productivity_score' as const, target: 80, period: 'weekly' as const, createdAt: '2026-01-01' }]);

    const data = dashboard.generateDashboard('daily', '2026-03-25');

    expect(data.productivityScore.score).toBeGreaterThan(0);
    expect(data.revenue.totalRevenue).toBeGreaterThan(0);
    expect(data.focusRatio.focusMinutes).toBe(180);
    expect(data.focusRatio.adminMinutes).toBe(60);
    expect(data.clientProfitability).toHaveLength(1);
    expect(data.benchmarks.length).toBeGreaterThanOrEqual(4);
    expect(data.trends).toBeDefined();

    // Score should be persisted
    expect(store.getScoreHistory().length).toBeGreaterThanOrEqual(1);
  });
});
