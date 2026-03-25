/**
 * Burnout Prevention System — Comprehensive Test Suite
 * CFX-070
 */

import fs from 'fs';
import path from 'path';
import {
  BurnoutDataStore,
  WorkHoursTracker,
  BurnoutRiskCalculator,
  WorkLifeBalanceAnalyzer,
  WellnessCheckInSystem,
  BurnoutPatternRecognizer,
  RecoveryTracker,
  WorkloadAnalyzer,
  BoundaryManager,
  BurnoutPreventionData,
  BurnoutConfig,
  WorkSession,
  ClientLoad,
  WellnessCheckIn,
  DEFAULT_CONFIG,
  createCLI,
} from '../index';

// ─── Helpers ─────────────────────────────────────────────────────────

const TEST_DATA_DIR = path.join(__dirname, '.test-data');
const TEST_DATA_FILE = path.join(TEST_DATA_DIR, 'test-burnout.json');

function createEmptyData(configOverrides?: Partial<BurnoutConfig>): BurnoutPreventionData {
  return {
    sessions: [],
    dailyLogs: [],
    clients: [],
    recoveryPeriods: [],
    checkIns: [],
    patterns: [],
    config: { ...DEFAULT_CONFIG, ...configOverrides },
    lastUpdated: new Date().toISOString(),
  };
}

function addWorkSession(
  data: BurnoutPreventionData,
  date: string,
  startTime: string,
  endTime: string,
  clientId?: string
): WorkSession {
  const tracker = new WorkHoursTracker(data);
  return tracker.logSession({ date, startTime, endTime, clientId });
}

/** Add sessions for a range of dates (Mon-Sun pattern) */
function addWeekOfWork(
  data: BurnoutPreventionData,
  startDate: string,
  dailyHours: number = 8,
  includeWeekend: boolean = false
): void {
  const start = new Date(startDate);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (isWeekend && !includeWeekend) continue;

    const dateStr = d.toISOString().split('T')[0];
    addWorkSession(data, dateStr, '09:00', `${9 + dailyHours}:00`);
  }
}

// ─── Cleanup ─────────────────────────────────────────────────────────

afterAll(() => {
  if (fs.existsSync(TEST_DATA_DIR)) {
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  }
});

// ─── DataStore Tests ─────────────────────────────────────────────────

describe('BurnoutDataStore', () => {
  const storePath = path.join(TEST_DATA_DIR, 'store-test.json');

  afterEach(() => {
    if (fs.existsSync(storePath)) fs.unlinkSync(storePath);
  });

  test('creates empty data when file does not exist', () => {
    const store = new BurnoutDataStore(storePath);
    const data = store.load();
    expect(data.sessions).toEqual([]);
    expect(data.config.maxDailyHours).toBe(8);
  });

  test('saves and loads data', () => {
    const store = new BurnoutDataStore(storePath);
    const data = store.load();
    data.sessions.push({
      id: 'test-1', date: '2026-03-20', startTime: '09:00',
      endTime: '17:00', durationMinutes: 480,
    });
    store.save(data);

    const loaded = store.load();
    expect(loaded.sessions).toHaveLength(1);
    expect(loaded.sessions[0].id).toBe('test-1');
  });

  test('handles corrupted file gracefully', () => {
    if (!fs.existsSync(TEST_DATA_DIR)) fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
    fs.writeFileSync(storePath, 'not-json!!!');
    const store = new BurnoutDataStore(storePath);
    const data = store.load();
    expect(data.sessions).toEqual([]);
  });
});

// ─── WorkHoursTracker Tests ──────────────────────────────────────────

describe('WorkHoursTracker', () => {
  test('logs a session and calculates duration', () => {
    const data = createEmptyData();
    const tracker = new WorkHoursTracker(data);
    const session = tracker.logSession({
      date: '2026-03-20',
      startTime: '09:00',
      endTime: '17:30',
    });

    expect(session.durationMinutes).toBe(510); // 8.5h
    expect(data.sessions).toHaveLength(1);
    expect(data.dailyLogs).toHaveLength(1);
  });

  test('handles overnight sessions', () => {
    const data = createEmptyData();
    const tracker = new WorkHoursTracker(data);
    const session = tracker.logSession({
      date: '2026-03-20',
      startTime: '23:00',
      endTime: '02:00',
    });

    expect(session.durationMinutes).toBe(180); // 3h
  });

  test('detects overtime', () => {
    const data = createEmptyData({ maxDailyHours: 8 });
    addWorkSession(data, '2026-03-20', '08:00', '18:00'); // 10h

    const tracker = new WorkHoursTracker(data);
    const overtime = tracker.detectOvertime('2026-03-20');
    expect(overtime.isOvertime).toBe(true);
    expect(overtime.excess).toBe(2);
    expect(overtime.message).toContain('10.0h today');
  });

  test('no overtime when under limit', () => {
    const data = createEmptyData({ maxDailyHours: 8 });
    addWorkSession(data, '2026-03-20', '09:00', '16:00'); // 7h

    const tracker = new WorkHoursTracker(data);
    const overtime = tracker.detectOvertime('2026-03-20');
    expect(overtime.isOvertime).toBe(false);
  });

  test('calculates consecutive work days', () => {
    const data = createEmptyData();
    addWorkSession(data, '2026-03-17', '09:00', '17:00');
    addWorkSession(data, '2026-03-18', '09:00', '17:00');
    addWorkSession(data, '2026-03-19', '09:00', '17:00');
    addWorkSession(data, '2026-03-20', '09:00', '17:00');

    const tracker = new WorkHoursTracker(data);
    expect(tracker.getConsecutiveWorkDays('2026-03-20')).toBe(4);
  });

  test('streak breaks on off day', () => {
    const data = createEmptyData();
    addWorkSession(data, '2026-03-17', '09:00', '17:00');
    // 2026-03-18 is off
    addWorkSession(data, '2026-03-19', '09:00', '17:00');
    addWorkSession(data, '2026-03-20', '09:00', '17:00');

    const tracker = new WorkHoursTracker(data);
    expect(tracker.getConsecutiveWorkDays('2026-03-20')).toBe(2);
  });

  test('weekly hours calculation', () => {
    const data = createEmptyData();
    // Mon-Fri, 8h each
    for (let i = 16; i <= 20; i++) {
      addWorkSession(data, `2026-03-${i}`, '09:00', '17:00');
    }

    const tracker = new WorkHoursTracker(data);
    expect(tracker.getWeeklyHours('2026-03-20')).toBe(40);
  });

  test('detects late night work', () => {
    const data = createEmptyData({ lateNightThreshold: '22:00' });
    addWorkSession(data, '2026-03-20', '20:00', '23:30');

    expect(data.dailyLogs[0].hasLateNight).toBe(true);
  });

  test('detects early morning work', () => {
    const data = createEmptyData({ earlyMorningThreshold: '06:00' });
    addWorkSession(data, '2026-03-20', '05:00', '08:00');

    expect(data.dailyLogs[0].hasEarlyMorning).toBe(true);
  });

  test('detects weekend work', () => {
    const data = createEmptyData();
    // 2026-03-21 is a Saturday
    addWorkSession(data, '2026-03-21', '10:00', '14:00');

    expect(data.dailyLogs[0].isWeekend).toBe(true);
  });

  test('multiple sessions same day accumulate', () => {
    const data = createEmptyData();
    addWorkSession(data, '2026-03-20', '09:00', '12:00');
    addWorkSession(data, '2026-03-20', '14:00', '18:00');

    const tracker = new WorkHoursTracker(data);
    expect(tracker.getDailyHours('2026-03-20')).toBe(7); // 3 + 4
    expect(data.dailyLogs).toHaveLength(1); // single daily log
    expect(data.dailyLogs[0].sessions).toHaveLength(2);
  });
});

// ─── BurnoutRiskCalculator Tests ─────────────────────────────────────

describe('BurnoutRiskCalculator', () => {
  test('low risk for healthy work pattern', () => {
    const data = createEmptyData();
    // Normal 5-day, 8h week
    addWeekOfWork(data, '2026-03-16', 8, false);

    const calc = new BurnoutRiskCalculator(data);
    const risk = calc.calculate('2026-03-20');

    expect(risk.overall).toBeLessThan(20);
    expect(risk.components.workHours).toBeLessThanOrEqual(10);
  });

  test('high work hours increase risk', () => {
    const data = createEmptyData({ maxWeeklyHours: 40 });
    // 5 days × 12h = 60h week (150%)
    addWeekOfWork(data, '2026-03-16', 12, false);

    const calc = new BurnoutRiskCalculator(data);
    const risk = calc.calculate('2026-03-20');

    expect(risk.components.workHours).toBeGreaterThanOrEqual(15);
  });

  test('consecutive days increase risk', () => {
    const data = createEmptyData({ maxConsecutiveDays: 5 });
    // 9 consecutive days
    for (let i = 12; i <= 20; i++) {
      addWorkSession(data, `2026-03-${i}`, '09:00', '17:00');
    }

    const calc = new BurnoutRiskCalculator(data);
    const risk = calc.calculate('2026-03-20');

    expect(risk.components.consistency).toBeGreaterThan(0);
  });

  test('late nights increase risk', () => {
    const data = createEmptyData({ lateNightThreshold: '22:00' });
    for (let i = 16; i <= 20; i++) {
      addWorkSession(data, `2026-03-${i}`, '20:00', '23:30');
    }

    const calc = new BurnoutRiskCalculator(data);
    const risk = calc.calculate('2026-03-20');

    expect(risk.components.timeOfDay).toBeGreaterThan(0);
  });

  test('weekend work increases risk', () => {
    const data = createEmptyData();
    // Work 4 weekends in a row
    const weekendDates = ['2026-02-28', '2026-03-01', '2026-03-07', '2026-03-08',
      '2026-03-14', '2026-03-15', '2026-03-21', '2026-03-22'];
    weekendDates.forEach(d => addWorkSession(data, d, '10:00', '16:00'));

    const calc = new BurnoutRiskCalculator(data);
    const risk = calc.calculate('2026-03-22');

    expect(risk.components.weekendWork).toBeGreaterThan(0);
  });

  test('client overload increases risk', () => {
    const data = createEmptyData({ maxConcurrentClients: 3 });
    for (let i = 1; i <= 5; i++) {
      data.clients.push({
        clientId: `c${i}`, clientName: `Client ${i}`,
        activeProjects: 1, weeklyHours: 8,
      });
    }

    const calc = new BurnoutRiskCalculator(data);
    const risk = calc.calculate('2026-03-20');

    expect(risk.components.clientOverload).toBe(10); // 2 over × 5
  });

  test('generates alerts for high risk', () => {
    const data = createEmptyData({ maxConsecutiveDays: 5, criticalRiskThreshold: 70 });
    // Create a very stressed week: long hours, consecutive days, late nights, weekend
    for (let i = 14; i <= 22; i++) {
      addWorkSession(data, `2026-03-${i}`, '08:00', '23:00'); // 15h/day for 9 days
    }
    for (let i = 1; i <= 5; i++) {
      data.clients.push({
        clientId: `c${i}`, clientName: `Client ${i}`,
        activeProjects: 1, weeklyHours: 10,
      });
    }

    const calc = new BurnoutRiskCalculator(data);
    const risk = calc.calculate('2026-03-22');

    expect(risk.overall).toBeGreaterThanOrEqual(50);
    expect(risk.alerts.length).toBeGreaterThan(0);
    expect(risk.recommendations.length).toBeGreaterThan(0);
  });

  test('generates consecutive day alert', () => {
    const data = createEmptyData({ maxConsecutiveDays: 5 });
    for (let i = 14; i <= 21; i++) {
      addWorkSession(data, `2026-03-${i}`, '09:00', '17:00');
    }

    const calc = new BurnoutRiskCalculator(data);
    const risk = calc.calculate('2026-03-21');

    const streakAlert = risk.alerts.find(a => a.signal === 'consecutive-days');
    expect(streakAlert).toBeDefined();
    expect(streakAlert!.message).toContain('8 consecutive days');
  });

  test('healthy pattern gets positive recommendation', () => {
    const data = createEmptyData();
    // Light work week
    addWorkSession(data, '2026-03-18', '10:00', '15:00');
    addWorkSession(data, '2026-03-19', '10:00', '15:00');

    const calc = new BurnoutRiskCalculator(data);
    const risk = calc.calculate('2026-03-19');

    expect(risk.overall).toBeLessThan(20);
    expect(risk.recommendations).toContain('✅ Great balance! Keep maintaining these healthy work patterns.');
  });

  test('trend detection — worsening', () => {
    const data = createEmptyData();
    // Last week: light
    addWorkSession(data, '2026-03-09', '09:00', '13:00');
    addWorkSession(data, '2026-03-10', '09:00', '13:00');
    // This week: heavy
    for (let i = 16; i <= 20; i++) {
      addWorkSession(data, `2026-03-${i}`, '08:00', '20:00');
    }

    const calc = new BurnoutRiskCalculator(data);
    const risk = calc.calculate('2026-03-20');

    expect(risk.trend).toBe('worsening');
  });

  test('trend detection — improving', () => {
    const data = createEmptyData();
    // Last week: heavy
    for (let i = 9; i <= 13; i++) {
      addWorkSession(data, `2026-03-${i < 10 ? '0' + i : i}`, '08:00', '20:00');
    }
    // This week: light
    addWorkSession(data, '2026-03-18', '10:00', '14:00');
    addWorkSession(data, '2026-03-19', '10:00', '14:00');

    const calc = new BurnoutRiskCalculator(data);
    const risk = calc.calculate('2026-03-19');

    expect(risk.trend).toBe('improving');
  });
});

// ─── WorkLifeBalanceAnalyzer Tests ───────────────────────────────────

describe('WorkLifeBalanceAnalyzer', () => {
  test('generates report for a balanced period', () => {
    const data = createEmptyData();
    // 2 normal work weeks
    addWeekOfWork(data, '2026-03-09', 8, false);
    addWeekOfWork(data, '2026-03-16', 8, false);

    const analyzer = new WorkLifeBalanceAnalyzer(data);
    const report = analyzer.generateReport(14, '2026-03-22');

    expect(report.totalWorkDays).toBe(10);
    expect(report.totalOffDays).toBe(4);
    expect(report.avgDailyHours).toBe(8);
    expect(report.weekendWorkDays).toBe(0);
    expect(report.balanceScore).toBeGreaterThan(60);
  });

  test('detects poor balance with weekend work', () => {
    const data = createEmptyData();
    addWeekOfWork(data, '2026-03-16', 10, true); // including weekends, 10h days

    const analyzer = new WorkLifeBalanceAnalyzer(data);
    const report = analyzer.generateReport(7, '2026-03-22');

    expect(report.weekendWorkDays).toBeGreaterThan(0);
    expect(report.avgDailyHours).toBe(10);
    expect(report.balanceScore).toBeLessThan(70);
  });

  test('longest streak calculation', () => {
    const data = createEmptyData();
    // 7 consecutive days
    for (let i = 16; i <= 22; i++) {
      addWorkSession(data, `2026-03-${i}`, '09:00', '17:00');
    }

    const analyzer = new WorkLifeBalanceAnalyzer(data);
    const report = analyzer.generateReport(7, '2026-03-22');

    expect(report.longestStreak).toBe(7);
    expect(report.currentStreak).toBe(7);
  });

  test('empty period returns zeros', () => {
    const data = createEmptyData();
    const analyzer = new WorkLifeBalanceAnalyzer(data);
    const report = analyzer.generateReport(7, '2026-03-22');

    expect(report.totalWorkDays).toBe(0);
    expect(report.avgDailyHours).toBe(0);
    expect(report.balanceScore).toBeGreaterThanOrEqual(80); // no work = decent balance
  });
});

// ─── WellnessCheckInSystem Tests ─────────────────────────────────────

describe('WellnessCheckInSystem', () => {
  test('records check-in', () => {
    const data = createEmptyData();
    const wellness = new WellnessCheckInSystem(data);

    const checkIn = wellness.recordCheckIn({
      date: '2026-03-20',
      energyLevel: 4,
      stressLevel: 2,
      sleepQuality: 4,
      motivation: 5,
      physicalHealth: 3,
    });

    expect(checkIn.id).toBeDefined();
    expect(data.checkIns).toHaveLength(1);
  });

  test('calculates average wellness', () => {
    const data = createEmptyData();
    const wellness = new WellnessCheckInSystem(data);

    wellness.recordCheckIn({
      date: '2026-03-19',
      energyLevel: 4, stressLevel: 2, sleepQuality: 4,
      motivation: 4, physicalHealth: 4,
    });
    wellness.recordCheckIn({
      date: '2026-03-20',
      energyLevel: 3, stressLevel: 3, sleepQuality: 3,
      motivation: 3, physicalHealth: 3,
    });

    const avg = wellness.getAverageWellness(7);
    expect(avg).not.toBeNull();
    expect(avg!.energy).toBe(3.5);
    expect(avg!.stress).toBe(2.5);
  });

  test('returns null when no check-ins', () => {
    const data = createEmptyData();
    const wellness = new WellnessCheckInSystem(data);
    expect(wellness.getAverageWellness(7)).toBeNull();
  });

  test('generates weekly prompt', () => {
    const data = createEmptyData();
    const wellness = new WellnessCheckInSystem(data);
    const prompt = wellness.generateWeeklyPrompt();

    expect(prompt).toContain('Weekly Wellness Check-In');
    expect(prompt).toContain('Energy level');
  });

  test('generates prompt with previous averages', () => {
    const data = createEmptyData();
    const wellness = new WellnessCheckInSystem(data);

    wellness.recordCheckIn({
      date: new Date().toISOString().split('T')[0],
      energyLevel: 4, stressLevel: 2, sleepQuality: 4,
      motivation: 4, physicalHealth: 4,
    });

    const prompt = wellness.generateWeeklyPrompt();
    expect(prompt).toContain('Last week\'s averages');
  });

  test('detects declining energy', () => {
    const data = createEmptyData();
    const wellness = new WellnessCheckInSystem(data);

    // Declining energy
    [5, 4, 3, 2, 1].forEach((energy, i) => {
      wellness.recordCheckIn({
        date: `2026-03-${16 + i}`,
        energyLevel: energy, stressLevel: 2, sleepQuality: 3,
        motivation: 3, physicalHealth: 3,
      });
    });

    const alerts = wellness.detectStressSignals();
    const energyAlert = alerts.find(a => a.signal === 'declining-energy');
    expect(energyAlert).toBeDefined();
  });

  test('detects rising stress', () => {
    const data = createEmptyData();
    const wellness = new WellnessCheckInSystem(data);

    [1, 2, 3, 4, 5].forEach((stress, i) => {
      wellness.recordCheckIn({
        date: `2026-03-${16 + i}`,
        energyLevel: 3, stressLevel: stress, sleepQuality: 3,
        motivation: 3, physicalHealth: 3,
      });
    });

    const alerts = wellness.detectStressSignals();
    const stressAlert = alerts.find(a => a.signal === 'rising-stress');
    expect(stressAlert).toBeDefined();
  });

  test('detects low motivation', () => {
    const data = createEmptyData();
    const wellness = new WellnessCheckInSystem(data);

    [1, 2, 1, 2, 1].forEach((motivation, i) => {
      wellness.recordCheckIn({
        date: `2026-03-${16 + i}`,
        energyLevel: 3, stressLevel: 2, sleepQuality: 3,
        motivation, physicalHealth: 3,
      });
    });

    const alerts = wellness.detectStressSignals();
    const motivationAlert = alerts.find(a => a.signal === 'low-motivation');
    expect(motivationAlert).toBeDefined();
  });
});

// ─── BurnoutPatternRecognizer Tests ──────────────────────────────────

describe('BurnoutPatternRecognizer', () => {
  test('detects night owl pattern', () => {
    const data = createEmptyData({ lateNightThreshold: '22:00' });
    // 5+ late nights
    for (let i = 16; i <= 22; i++) {
      addWorkSession(data, `2026-03-${i}`, '20:00', '23:00');
    }

    const recognizer = new BurnoutPatternRecognizer(data);
    const patterns = recognizer.analyze();

    const nightOwl = patterns.find(p => p.patternType === 'night-owl');
    expect(nightOwl).toBeDefined();
    expect(nightOwl!.occurrences).toBeGreaterThanOrEqual(5);
  });

  test('detects overcommit pattern', () => {
    const data = createEmptyData({ maxConcurrentClients: 3 });
    for (let i = 1; i <= 5; i++) {
      data.clients.push({
        clientId: `c${i}`, clientName: `Client ${i}`,
        activeProjects: 1, weeklyHours: 8,
      });
    }

    const recognizer = new BurnoutPatternRecognizer(data);
    const patterns = recognizer.analyze();

    const overcommit = patterns.find(p => p.patternType === 'overcommit');
    expect(overcommit).toBeDefined();
    expect(overcommit!.description).toContain('5 active clients');
  });

  test('no patterns for healthy work', () => {
    const data = createEmptyData();
    addWeekOfWork(data, '2026-03-16', 8, false);

    const recognizer = new BurnoutPatternRecognizer(data);
    const patterns = recognizer.analyze();

    // Should only potentially have patterns if data warrants it
    const concerning = patterns.filter(
      p => p.patternType !== 'night-owl' // won't trigger with 9-17 work
    );
    expect(concerning).toHaveLength(0);
  });
});

// ─── RecoveryTracker Tests ───────────────────────────────────────────

describe('RecoveryTracker', () => {
  test('logs recovery period', () => {
    const data = createEmptyData();
    const tracker = new RecoveryTracker(data);

    tracker.logRecoveryPeriod({
      startDate: '2026-03-15',
      endDate: '2026-03-17',
      durationDays: 2,
      quality: 'full',
    });

    expect(data.recoveryPeriods).toHaveLength(1);
  });

  test('calculates average recovery days', () => {
    const data = createEmptyData();
    const tracker = new RecoveryTracker(data);

    tracker.logRecoveryPeriod({ startDate: '2026-03-01', endDate: '2026-03-03', durationDays: 2, quality: 'full' });
    tracker.logRecoveryPeriod({ startDate: '2026-03-10', endDate: '2026-03-14', durationDays: 4, quality: 'full' });

    expect(tracker.getAverageRecoveryDays()).toBe(3);
  });

  test('tracks recovery quality', () => {
    const data = createEmptyData();
    const tracker = new RecoveryTracker(data);

    tracker.logRecoveryPeriod({ startDate: '2026-03-01', endDate: '2026-03-03', durationDays: 2, quality: 'full' });
    tracker.logRecoveryPeriod({ startDate: '2026-03-10', endDate: '2026-03-11', durationDays: 1, quality: 'partial' });
    tracker.logRecoveryPeriod({ startDate: '2026-03-15', endDate: '2026-03-15', durationDays: 0, quality: 'none' });

    const quality = tracker.getRecoveryQuality();
    expect(quality.full).toBe(1);
    expect(quality.partial).toBe(1);
    expect(quality.none).toBe(1);
  });

  test('suggests improvement when recovery is short', () => {
    const data = createEmptyData({ minRecoveryDays: 3 });
    const tracker = new RecoveryTracker(data);

    tracker.logRecoveryPeriod({ startDate: '2026-03-01', endDate: '2026-03-02', durationDays: 1, quality: 'full' });

    const suggestion = tracker.suggestRecovery();
    expect(suggestion).toContain('below the recommended');
  });

  test('affirms good recovery', () => {
    const data = createEmptyData({ minRecoveryDays: 2 });
    const tracker = new RecoveryTracker(data);

    tracker.logRecoveryPeriod({ startDate: '2026-03-01', endDate: '2026-03-04', durationDays: 3, quality: 'full' });

    const suggestion = tracker.suggestRecovery();
    expect(suggestion).toContain('solid');
  });
});

// ─── WorkloadAnalyzer Tests ──────────────────────────────────────────

describe('WorkloadAnalyzer', () => {
  test('detects balanced workload', () => {
    const data = createEmptyData({ maxConcurrentClients: 3 });
    data.clients = [
      { clientId: 'c1', clientName: 'Alpha', activeProjects: 1, weeklyHours: 15 },
      { clientId: 'c2', clientName: 'Beta', activeProjects: 1, weeklyHours: 15 },
    ];

    const analyzer = new WorkloadAnalyzer(data);
    const dist = analyzer.analyzeDistribution();

    expect(dist.isBalanced).toBe(true);
    expect(dist.activeClients).toBe(2);
    expect(dist.recommendation).toContain('healthy');
  });

  test('detects single-client dependency', () => {
    const data = createEmptyData({ maxConcurrentClients: 3 });
    data.clients = [
      { clientId: 'c1', clientName: 'Big Corp', activeProjects: 2, weeklyHours: 35 },
      { clientId: 'c2', clientName: 'Side Gig', activeProjects: 1, weeklyHours: 5 },
    ];

    const analyzer = new WorkloadAnalyzer(data);
    const dist = analyzer.analyzeDistribution();

    expect(dist.isBalanced).toBe(false);
    expect(dist.recommendation).toContain('Big Corp');
    expect(dist.recommendation).toContain('risky');
  });

  test('detects too many clients', () => {
    const data = createEmptyData({ maxConcurrentClients: 2 });
    for (let i = 1; i <= 4; i++) {
      data.clients.push({
        clientId: `c${i}`, clientName: `Client ${i}`,
        activeProjects: 1, weeklyHours: 10,
      });
    }

    const analyzer = new WorkloadAnalyzer(data);
    const dist = analyzer.analyzeDistribution();

    expect(dist.isBalanced).toBe(false);
    expect(dist.recommendation).toContain('4 clients');
  });

  test('handles no clients', () => {
    const data = createEmptyData();
    const analyzer = new WorkloadAnalyzer(data);
    const dist = analyzer.analyzeDistribution();

    expect(dist.activeClients).toBe(0);
    expect(dist.isBalanced).toBe(true);
  });
});

// ─── BoundaryManager Tests ───────────────────────────────────────────

describe('BoundaryManager', () => {
  test('returns personalized boundaries', () => {
    const data = createEmptyData({
      maxDailyHours: 7,
      maxWeeklyHours: 35,
      lateNightThreshold: '21:00',
    });

    const manager = new BoundaryManager(data);
    const boundaries = manager.getPersonalizedBoundaries();

    expect(boundaries.some(b => b.includes('7h'))).toBe(true);
    expect(boundaries.some(b => b.includes('35h'))).toBe(true);
    expect(boundaries.some(b => b.includes('21:00'))).toBe(true);
  });

  test('updates config', () => {
    const data = createEmptyData();
    const manager = new BoundaryManager(data);

    const updated = manager.updateConfig({ maxDailyHours: 6, maxWeeklyHours: 30 });
    expect(updated.maxDailyHours).toBe(6);
    expect(updated.maxWeeklyHours).toBe(30);
    expect(data.config.maxDailyHours).toBe(6);
  });

  test('adds active streak warning', () => {
    const data = createEmptyData({ maxConsecutiveDays: 5 });
    const today = new Date().toISOString().split('T')[0];

    // Add 6 consecutive days ending today
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      addWorkSession(data, d.toISOString().split('T')[0], '09:00', '17:00');
    }

    const manager = new BoundaryManager(data);
    const boundaries = manager.getPersonalizedBoundaries();

    const hasStreakWarning = boundaries.some(b => b.includes('ACTIVE') && b.includes('consecutive'));
    expect(hasStreakWarning).toBe(true);
  });
});

// ─── CLI Tests ───────────────────────────────────────────────────────

describe('CLI', () => {
  test('creates CLI program', () => {
    const program = createCLI();
    expect(program.name()).toBe('burnout-prevention');
    expect(program.commands.length).toBeGreaterThan(0);
  });

  test('has all expected commands', () => {
    const program = createCLI();
    const commandNames = program.commands.map(c => c.name());

    expect(commandNames).toContain('log');
    expect(commandNames).toContain('risk');
    expect(commandNames).toContain('balance');
    expect(commandNames).toContain('checkin');
    expect(commandNames).toContain('weekly');
    expect(commandNames).toContain('boundaries');
    expect(commandNames).toContain('patterns');
    expect(commandNames).toContain('workload');
    expect(commandNames).toContain('client');
    expect(commandNames).toContain('recovery');
    expect(commandNames).toContain('config');
    expect(commandNames).toContain('dashboard');
  });
});

// ─── Integration Tests ───────────────────────────────────────────────

describe('Integration: Full Burnout Scenario', () => {
  test('simulates escalating burnout over 3 weeks', () => {
    const data = createEmptyData({
      maxDailyHours: 8,
      maxWeeklyHours: 40,
      maxConsecutiveDays: 5,
      maxConcurrentClients: 3,
    });

    // Week 1: Normal
    addWeekOfWork(data, '2026-03-02', 8, false);

    // Week 2: Getting busier, some weekend work
    addWeekOfWork(data, '2026-03-09', 10, true);

    // Week 3: Overloaded, late nights, more clients
    for (let i = 16; i <= 22; i++) {
      addWorkSession(data, `2026-03-${i}`, '08:00', '23:00'); // 15h days
    }

    // Add clients
    for (let i = 1; i <= 5; i++) {
      data.clients.push({
        clientId: `c${i}`, clientName: `Client ${i}`,
        activeProjects: 1, weeklyHours: 8,
      });
    }

    // Calculate risk at end of week 3
    const calc = new BurnoutRiskCalculator(data);
    const risk = calc.calculate('2026-03-22');

    expect(risk.overall).toBeGreaterThanOrEqual(40);
    expect(risk.trend).toBe('worsening');
    expect(risk.alerts.length).toBeGreaterThan(0);

    // Check patterns
    const recognizer = new BurnoutPatternRecognizer(data);
    const patterns = recognizer.analyze();
    expect(patterns.length).toBeGreaterThan(0);

    // Generate balance report
    const analyzer = new WorkLifeBalanceAnalyzer(data);
    const report = analyzer.generateReport(21, '2026-03-22');
    expect(report.balanceScore).toBeLessThan(60);
    expect(report.lateNightCount).toBeGreaterThan(0);
    expect(report.weekendWorkDays).toBeGreaterThan(0);
  });

  test('recovery journey: risk decreases with better habits', () => {
    const data = createEmptyData();

    // Bad week (Mon-Sun, March 9-15) — 15h/day, 7 days
    for (let i = 9; i <= 15; i++) {
      addWorkSession(data, `2026-03-${i < 10 ? '0' + i : i}`, '07:00', '22:00');
    }

    const calcBefore = new BurnoutRiskCalculator(data);
    const riskBefore = calcBefore.calculate('2026-03-15');

    // Good week — much lighter hours, only 3 days, 7h each (March 16-22)
    addWorkSession(data, '2026-03-16', '10:00', '17:00');
    addWorkSession(data, '2026-03-17', '10:00', '17:00');
    addWorkSession(data, '2026-03-18', '10:00', '17:00');

    // Calculate as of end of good week — the "this week" window (Mar 16-22)
    // should be much lighter than "last week" (Mar 9-15)
    const calcAfter = new BurnoutRiskCalculator(data);
    const riskAfter = calcAfter.calculate('2026-03-22');

    // This week: 21h vs last week: 105h — clearly improving
    expect(riskAfter.trend).toBe('improving');
  });
});
