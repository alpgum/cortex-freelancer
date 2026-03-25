/**
 * Tests for Revenue Forecasting with Trend Analysis and Goal Tracking
 * CFX-066 — Cortex Freelancer
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Use a temp directory for tests to avoid touching real data
const TEST_DATA_DIR = path.join(os.tmpdir(), `cortex-revenue-test-${Date.now()}`);

// Patch DATA_DIR before requiring the module
const mod = require('../src/tools/revenue-forecasting');
const { _internal } = mod;

// Override data directory for isolation
const origDataDir = _internal.DATA_DIR;

function setTestDir() {
    // We need to monkey-patch the functions to use test dir
    // Since DATA_DIR is a const, we'll override loadJSON/saveJSON behavior via direct file manipulation
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

function cleanTestDir() {
    try {
        fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    } catch {}
}

// Helper to write test data directly
function writeTestData(filename, data) {
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
    fs.writeFileSync(path.join(TEST_DATA_DIR, filename), JSON.stringify(data, null, 2));
}

function readTestData(filename) {
    try {
        return JSON.parse(fs.readFileSync(path.join(TEST_DATA_DIR, filename), 'utf8'));
    } catch {
        return null;
    }
}

// Since the module uses a hardcoded DATA_DIR, we'll test internal functions directly
// and use the actual functions with the real DATA_DIR for integration tests (cleaned up after)

// ═══════════════════════════════════════════════════════════════════════════
// Unit Tests — Internal Utilities
// ═══════════════════════════════════════════════════════════════════════════

describe('Internal Utilities', () => {
    test('mean calculates correctly', () => {
        expect(_internal.mean([1, 2, 3, 4, 5])).toBe(3);
        expect(_internal.mean([])).toBe(0);
        expect(_internal.mean([10])).toBe(10);
    });

    test('stddev calculates correctly', () => {
        expect(_internal.stddev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 2);
        expect(_internal.stddev([])).toBe(0);
        expect(_internal.stddev([5])).toBe(0);
    });

    test('linearRegression fits a perfect line', () => {
        const result = _internal.linearRegression([0, 1, 2, 3], [2, 4, 6, 8]);
        expect(result.slope).toBeCloseTo(2, 5);
        expect(result.intercept).toBeCloseTo(2, 5);
        expect(result.r2).toBeCloseTo(1, 5);
    });

    test('linearRegression handles flat data', () => {
        const result = _internal.linearRegression([0, 1, 2], [5, 5, 5]);
        expect(result.slope).toBeCloseTo(0, 5);
        expect(result.intercept).toBeCloseTo(5, 5);
    });

    test('linearRegression handles noisy data', () => {
        const result = _internal.linearRegression([0, 1, 2, 3, 4], [1, 3, 2, 5, 4]);
        expect(result.slope).toBeGreaterThan(0);
        expect(result.r2).toBeGreaterThan(0);
        expect(result.r2).toBeLessThan(1);
    });

    test('monthKey formats correctly', () => {
        expect(_internal.monthKey('2025-01-15')).toBe('2025-01');
        expect(_internal.monthKey('2025-12-01')).toBe('2025-12');
        expect(_internal.monthKey(new Date(2025, 0, 1))).toBe('2025-01');
    });

    test('quarterKey formats correctly', () => {
        expect(_internal.quarterKey('2025-01-15')).toBe('2025-Q1');
        expect(_internal.quarterKey('2025-04-01')).toBe('2025-Q2');
        expect(_internal.quarterKey('2025-07-01')).toBe('2025-Q3');
        expect(_internal.quarterKey('2025-12-31')).toBe('2025-Q4');
    });

    test('yearKey formats correctly', () => {
        expect(_internal.yearKey('2025-06-15')).toBe('2025');
    });

    test('parseMonthKey returns correct date', () => {
        const d = _internal.parseMonthKey('2025-03');
        expect(d.getFullYear()).toBe(2025);
        expect(d.getMonth()).toBe(2); // 0-indexed
    });

    test('addMonths works correctly', () => {
        const d = new Date(2025, 0, 15); // Jan 15
        const result = _internal.addMonths(d, 3);
        expect(result.getMonth()).toBe(3); // April
        expect(result.getFullYear()).toBe(2025);
    });

    test('addMonths handles year rollover', () => {
        const d = new Date(2025, 11, 1); // Dec
        const result = _internal.addMonths(d, 2);
        expect(result.getMonth()).toBe(1); // Feb
        expect(result.getFullYear()).toBe(2026);
    });

    test('getPeriodRange monthly', () => {
        const { start, end } = _internal.getPeriodRange('monthly', '2025-03-01', new Date(2025, 2, 15));
        expect(start.getMonth()).toBe(2);
        expect(start.getDate()).toBe(1);
        expect(end.getMonth()).toBe(2);
        expect(end.getDate()).toBe(31);
    });

    test('getPeriodRange quarterly', () => {
        const { start, end } = _internal.getPeriodRange('quarterly', '2025-01-01', new Date(2025, 4, 15));
        expect(start.getMonth()).toBe(3); // Q2 starts April
        expect(end.getMonth()).toBe(5);   // ends June
    });

    test('getPeriodRange yearly', () => {
        const { start, end } = _internal.getPeriodRange('yearly', '2025-01-01', new Date(2025, 6, 15));
        expect(start.getMonth()).toBe(0);
        expect(start.getDate()).toBe(1);
        expect(end.getMonth()).toBe(11);
        expect(end.getDate()).toBe(31);
    });
});

describe('aggregateByMonth', () => {
    test('groups records by month', () => {
        const records = [
            { date: '2025-01-05', amount: 1000, client: 'A' },
            { date: '2025-01-20', amount: 500, client: 'B' },
            { date: '2025-02-10', amount: 2000, client: 'A' }
        ];
        const result = _internal.aggregateByMonth(records);
        expect(result['2025-01'].total).toBe(1500);
        expect(result['2025-01'].count).toBe(2);
        expect(result['2025-01'].clients).toContain('A');
        expect(result['2025-01'].clients).toContain('B');
        expect(result['2025-02'].total).toBe(2000);
    });
});

describe('aggregateByClient', () => {
    test('groups records by client', () => {
        const records = [
            { client: 'Acme', amount: 1000 },
            { client: 'Acme', amount: 2000 },
            { client: 'Beta', amount: 500 }
        ];
        const result = _internal.aggregateByClient(records);
        expect(result['Acme'].total).toBe(3000);
        expect(result['Acme'].count).toBe(2);
        expect(result['Beta'].total).toBe(500);
    });
});

describe('computeSeasonalFactors', () => {
    test('returns factors close to 1 with uniform data', () => {
        const keys = ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06'];
        const values = [1000, 1000, 1000, 1000, 1000, 1000];
        const factors = _internal.computeSeasonalFactors(keys, values);
        for (let i = 0; i < 6; i++) {
            expect(factors[i]).toBeCloseTo(1, 5);
        }
    });

    test('detects seasonality', () => {
        // Jan and Jul double, rest normal
        const keys = ['2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06',
                       '2024-07', '2024-08', '2024-09', '2024-10', '2024-11', '2024-12'];
        const values = [2000, 1000, 1000, 1000, 1000, 1000, 2000, 1000, 1000, 1000, 1000, 1000];
        const factors = _internal.computeSeasonalFactors(keys, values);
        expect(factors[0]).toBeGreaterThan(1.5); // Jan
        expect(factors[6]).toBeGreaterThan(1.5); // Jul
        expect(factors[1]).toBeLessThan(1);      // Feb
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// Integration Tests — Uses real DATA_DIR (cleaned before/after)
// ═══════════════════════════════════════════════════════════════════════════

describe('Integration Tests', () => {
    const dataDir = path.join(os.homedir(), '.cortex-freelancer', 'revenue');

    // Backup existing data
    let backups = {};
    const filesToBackup = ['income.json', 'goals.json', 'pipeline.json', 'expenses.json'];

    beforeAll(() => {
        for (const f of filesToBackup) {
            const fp = path.join(dataDir, f);
            try {
                backups[f] = fs.readFileSync(fp, 'utf8');
            } catch {}
        }
    });

    afterAll(() => {
        // Restore backups
        for (const f of filesToBackup) {
            const fp = path.join(dataDir, f);
            if (backups[f]) {
                fs.writeFileSync(fp, backups[f]);
            } else {
                try { fs.unlinkSync(fp); } catch {}
            }
        }
    });

    beforeEach(() => {
        // Clean slate for each test
        for (const f of filesToBackup) {
            const fp = path.join(dataDir, f);
            try { fs.unlinkSync(fp); } catch {}
        }
    });

    // Helper: seed income data
    function seedIncome(entries) {
        for (const e of entries) {
            mod.recordIncome(e);
        }
    }

    function seedMonthlyIncome(monthsBack = 12, baseAmount = 5000, clientCount = 3) {
        const now = new Date();
        const entries = [];
        for (let i = monthsBack; i >= 1; i--) {
            const d = _internal.addMonths(now, -i);
            for (let c = 0; c < clientCount; c++) {
                const variation = 1 + (Math.sin(d.getMonth() * 0.5) * 0.2); // seasonal
                entries.push({
                    amount: Math.round(baseAmount / clientCount * variation * 100) / 100,
                    date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-15`,
                    client: `Client${String.fromCharCode(65 + c)}`,
                    category: 'consulting'
                });
            }
        }
        seedIncome(entries);
        return entries;
    }

    // ─── recordIncome ───────────────────────────────────────────────────

    describe('recordIncome', () => {
        test('records and persists income', () => {
            const result = mod.recordIncome({
                amount: 5000,
                date: '2025-03-15',
                client: 'Acme Corp',
                category: 'consulting'
            });
            expect(result.id).toMatch(/^inc_/);
            expect(result.amount).toBe(5000);
            expect(result.client).toBe('Acme Corp');

            const records = mod.getIncomeRecords();
            expect(records).toHaveLength(1);
            expect(records[0].amount).toBe(5000);
        });

        test('requires amount and date', () => {
            expect(() => mod.recordIncome({ amount: 100 })).toThrow();
            expect(() => mod.recordIncome({ date: '2025-01-01' })).toThrow();
        });

        test('defaults client to Unknown', () => {
            const result = mod.recordIncome({ amount: 100, date: '2025-01-01' });
            expect(result.client).toBe('Unknown');
        });
    });

    // ─── forecastRevenue ────────────────────────────────────────────────

    describe('forecastRevenue', () => {
        test('returns insufficient_data with < 3 months', () => {
            seedIncome([
                { amount: 1000, date: '2025-01-15', client: 'A' },
                { amount: 1000, date: '2025-02-15', client: 'A' }
            ]);
            const result = mod.forecastRevenue();
            expect(result.confidence).toBe('insufficient_data');
        });

        test('produces forecasts with enough data', () => {
            seedMonthlyIncome(6, 6000, 2);
            const result = mod.forecastRevenue({ months: 3 });
            expect(result.forecasts).toHaveLength(3);
            expect(result.forecasts[0].predicted).toBeGreaterThan(0);
            expect(result.forecasts[0].month).toBeDefined();
            expect(result.method).toBe('seasonal');
        });

        test('linear method works', () => {
            seedMonthlyIncome(6, 6000, 2);
            const result = mod.forecastRevenue({ months: 3, method: 'linear' });
            expect(result.method).toBe('linear');
            expect(result.forecasts).toHaveLength(3);
        });

        test('weighted method works', () => {
            seedMonthlyIncome(6, 6000, 2);
            const result = mod.forecastRevenue({ months: 3, method: 'weighted' });
            expect(result.method).toBe('weighted');
            expect(result.forecasts).toHaveLength(3);
        });

        test('trend data is included', () => {
            seedMonthlyIncome(6, 6000, 2);
            const result = mod.forecastRevenue();
            expect(result.trend).toBeDefined();
            expect(result.trend.slope).toBeDefined();
            expect(result.trend.r2).toBeDefined();
            expect(result.historicalAvg).toBeGreaterThan(0);
        });
    });

    // ─── setGoal / trackProgress ────────────────────────────────────────

    describe('Goal Setting & Tracking', () => {
        test('setGoal creates a goal', () => {
            const goal = mod.setGoal({
                target: 10000,
                period: 'monthly',
                label: 'March target'
            });
            expect(goal.id).toMatch(/^goal_/);
            expect(goal.target).toBe(10000);
            expect(goal.period).toBe('monthly');
            expect(goal.active).toBe(true);
        });

        test('setGoal requires target and period', () => {
            expect(() => mod.setGoal({ target: 5000 })).toThrow();
            expect(() => mod.setGoal({ period: 'monthly' })).toThrow();
        });

        test('trackProgress calculates correctly', () => {
            mod.setGoal({ target: 10000, period: 'monthly' });
            mod.recordIncome({
                amount: 3000,
                date: new Date().toISOString().slice(0, 10),
                client: 'A'
            });
            mod.recordIncome({
                amount: 2000,
                date: new Date().toISOString().slice(0, 10),
                client: 'B'
            });

            const progress = mod.trackProgress();
            expect(progress).toHaveLength(1);
            expect(progress[0].progress.earned).toBe(5000);
            expect(progress[0].progress.percentage).toBe(50);
            expect(progress[0].progress.remaining).toBe(5000);
        });

        test('trackProgress reports milestones', () => {
            mod.setGoal({ target: 1000, period: 'monthly', milestones: [25, 50, 75, 100] });
            mod.recordIncome({
                amount: 600,
                date: new Date().toISOString().slice(0, 10),
                client: 'X'
            });

            const progress = mod.trackProgress();
            expect(progress[0].progress.milestonesReached).toContain(25);
            expect(progress[0].progress.milestonesReached).toContain(50);
            expect(progress[0].progress.milestonesReached).not.toContain(75);
            expect(progress[0].progress.nextMilestone).toBe(75);
        });

        test('quarterly goal works', () => {
            mod.setGoal({ target: 30000, period: 'quarterly' });
            const progress = mod.trackProgress();
            expect(progress).toHaveLength(1);
            expect(progress[0].goal.period).toBe('quarterly');
        });
    });

    // ─── analyzeTrends ──────────────────────────────────────────────────

    describe('analyzeTrends', () => {
        test('returns insufficient_data with < 2 months', () => {
            seedIncome([{ amount: 1000, date: '2025-01-15', client: 'A' }]);
            const result = mod.analyzeTrends();
            expect(result.direction).toBe('insufficient_data');
        });

        test('detects growth', () => {
            // Seed growing income
            const now = new Date();
            for (let i = 6; i >= 1; i--) {
                const d = _internal.addMonths(now, -i);
                mod.recordIncome({
                    amount: 1000 * (7 - i), // 1000, 2000, ..., 6000
                    date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-15`,
                    client: 'GrowthClient'
                });
            }
            const result = mod.analyzeTrends({ months: 6 });
            expect(['strong_growth', 'moderate_growth']).toContain(result.direction);
            expect(result.monthlyGrowthRate).toBeGreaterThan(0);
        });

        test('includes volatility and client concentration', () => {
            seedMonthlyIncome(6, 6000, 3);
            const result = mod.analyzeTrends();
            expect(result.volatility).toBeDefined();
            expect(result.clientConcentration).toBeDefined();
            expect(result.clientConcentration.clientCount).toBe(3);
        });

        test('includes seasonal patterns', () => {
            seedMonthlyIncome(12, 6000, 2);
            const result = mod.analyzeTrends({ months: 12 });
            expect(result.seasonalPatterns).toBeDefined();
        });
    });

    // ─── Pipeline ───────────────────────────────────────────────────────

    describe('Pipeline', () => {
        test('addPipelineOpportunity creates entry', () => {
            const opp = mod.addPipelineOpportunity({
                name: 'Big Project',
                value: 50000,
                probability: 60,
                client: 'MegaCorp',
                stage: 'proposal'
            });
            expect(opp.id).toMatch(/^opp_/);
            expect(opp.value).toBe(50000);
            expect(opp.probability).toBe(60);
        });

        test('addPipelineOpportunity clamps probability', () => {
            const opp = mod.addPipelineOpportunity({
                name: 'Sure Thing',
                value: 1000,
                probability: 150
            });
            expect(opp.probability).toBe(100);
        });

        test('addPipelineOpportunity requires fields', () => {
            expect(() => mod.addPipelineOpportunity({ name: 'X' })).toThrow();
        });

        test('calculatePipelineValue computes weighted values', () => {
            mod.addPipelineOpportunity({ name: 'A', value: 10000, probability: 80, stage: 'proposal' });
            mod.addPipelineOpportunity({ name: 'B', value: 5000, probability: 40, stage: 'lead' });
            mod.addPipelineOpportunity({ name: 'C', value: 20000, probability: 20, stage: 'lead' });

            const result = mod.calculatePipelineValue();
            expect(result.totalValue).toBe(35000);
            expect(result.weightedValue).toBe(10000 * 0.8 + 5000 * 0.4 + 20000 * 0.2); // 14000
            expect(result.opportunityCount).toBe(3);
            expect(result.byStage.proposal.count).toBe(1);
            expect(result.byStage.lead.count).toBe(2);
        });

        test('excludes won/lost from active pipeline', () => {
            mod.addPipelineOpportunity({ name: 'Won', value: 10000, probability: 100, stage: 'won' });
            mod.addPipelineOpportunity({ name: 'Lost', value: 5000, probability: 0, stage: 'lost' });
            mod.addPipelineOpportunity({ name: 'Active', value: 8000, probability: 50, stage: 'negotiation' });

            const result = mod.calculatePipelineValue();
            expect(result.opportunityCount).toBe(1);
            expect(result.totalValue).toBe(8000);
        });
    });

    // ─── modelScenario ──────────────────────────────────────────────────

    describe('Scenario Modeling', () => {
        beforeEach(() => {
            seedMonthlyIncome(6, 6000, 2);
        });

        test('rate_change scenario', () => {
            const result = mod.modelScenario({
                type: 'rate_change',
                params: { percentChange: 20 }
            });
            expect(result.description).toContain('20%');
            expect(result.scenario.monthly).toBeGreaterThan(result.baseline.monthly);
            expect(result.impact.percentChange).toBeCloseTo(20, 0);
        });

        test('rate decrease scenario', () => {
            const result = mod.modelScenario({
                type: 'rate_change',
                params: { percentChange: -10 }
            });
            expect(result.scenario.monthly).toBeLessThan(result.baseline.monthly);
            expect(result.impact.percentChange).toBeCloseTo(-10, 0);
        });

        test('client_loss scenario', () => {
            const result = mod.modelScenario({
                type: 'client_loss',
                params: { client: 'ClientA' }
            });
            expect(result.scenario.monthly).toBeLessThan(result.baseline.monthly);
            expect(result.description).toContain('ClientA');
        });

        test('client_loss with unknown client throws', () => {
            expect(() => mod.modelScenario({
                type: 'client_loss',
                params: { client: 'NonexistentCorp' }
            })).toThrow('not found');
        });

        test('new_client scenario', () => {
            const result = mod.modelScenario({
                type: 'new_client',
                params: { monthlyValue: 3000 }
            });
            expect(result.scenario.monthly).toBeCloseTo(result.baseline.monthly + 3000, 2);
        });

        test('hours_change scenario', () => {
            const result = mod.modelScenario({
                type: 'hours_change',
                params: { percentChange: -25 }
            });
            expect(result.scenario.monthly).toBeLessThan(result.baseline.monthly);
        });

        test('custom scenario', () => {
            const result = mod.modelScenario({
                type: 'custom',
                params: { monthlyRevenue: 15000, description: 'Agency model' }
            });
            expect(result.scenario.monthly).toBe(15000);
            expect(result.description).toBe('Agency model');
        });

        test('unknown scenario type throws', () => {
            expect(() => mod.modelScenario({ type: 'alien_invasion' })).toThrow();
        });

        test('missing scenario type throws', () => {
            expect(() => mod.modelScenario({})).toThrow();
        });
    });

    // ─── Cash Flow ──────────────────────────────────────────────────────

    describe('Cash Flow Forecasting', () => {
        test('produces projections', () => {
            seedMonthlyIncome(6, 6000, 2);
            const result = mod.forecastCashFlow({ months: 3 });
            expect(result.projections).toHaveLength(3);
            expect(result.projections[0].projectedIncome).toBeDefined();
            expect(result.projections[0].projectedExpenses).toBeDefined();
            expect(result.projections[0].netCashFlow).toBeDefined();
            expect(result.projections[0].runningBalance).toBeDefined();
        });

        test('includes recurring expenses', () => {
            seedMonthlyIncome(6, 6000, 2);
            mod.recordExpense({
                amount: 500,
                description: 'Coworking',
                recurring: true,
                frequency: 'monthly'
            });
            const result = mod.forecastCashFlow({ months: 3 });
            expect(result.assumptions.recurringMonthlyExpenses).toBe(500);
            // Expenses should be at least $500/month
            expect(result.projections[0].projectedExpenses).toBeGreaterThanOrEqual(500);
        });

        test('summary totals are consistent', () => {
            seedMonthlyIncome(6, 6000, 2);
            const result = mod.forecastCashFlow({ months: 3 });
            const totalIncome = result.projections.reduce((s, p) => s + p.projectedIncome, 0);
            expect(result.summary.totalProjectedIncome).toBeCloseTo(totalIncome, 0);
        });
    });

    // ─── recordExpense ──────────────────────────────────────────────────

    describe('recordExpense', () => {
        test('records expense', () => {
            const exp = mod.recordExpense({
                amount: 200,
                description: 'Software subscription',
                recurring: true,
                frequency: 'monthly'
            });
            expect(exp.id).toMatch(/^exp_/);
            expect(exp.amount).toBe(200);
            expect(exp.recurring).toBe(true);
        });

        test('requires amount and description', () => {
            expect(() => mod.recordExpense({ amount: 100 })).toThrow();
            expect(() => mod.recordExpense({ description: 'X' })).toThrow();
        });
    });

    // ─── assessDiversification ──────────────────────────────────────────

    describe('Revenue Diversification', () => {
        test('single client = critical risk', () => {
            seedIncome([
                { amount: 5000, date: '2025-01-15', client: 'OnlyClient' },
                { amount: 5000, date: '2025-02-15', client: 'OnlyClient' }
            ]);
            const result = mod.assessDiversification();
            expect(result.herfindahlIndex).toBe(10000);
            expect(result.riskLevel).toBe('critical');
            expect(result.clientCount).toBe(1);
            expect(result.topClientRisk.share).toBe(100);
        });

        test('equal split across many clients = low risk', () => {
            const clients = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
            const entries = clients.map(c => ({
                amount: 1000, date: '2025-01-15', client: c
            }));
            seedIncome(entries);
            const result = mod.assessDiversification();
            expect(result.riskLevel).toBe('low');
            expect(result.clientCount).toBe(10);
            expect(result.herfindahlIndex).toBe(1000); // 10 * 10^2
        });

        test('concentrated distribution = high risk', () => {
            seedIncome([
                { amount: 8000, date: '2025-01-15', client: 'BigCo' },
                { amount: 1000, date: '2025-01-15', client: 'SmallA' },
                { amount: 1000, date: '2025-01-15', client: 'SmallB' }
            ]);
            const result = mod.assessDiversification();
            expect(result.riskLevel).toBe('critical'); // BigCo has 80%
            expect(result.topClientRisk.warning).toContain('CRITICAL');
        });

        test('no data returns no_data', () => {
            const result = mod.assessDiversification();
            expect(result.riskLevel).toBe('no_data');
        });

        test('accepts custom records array', () => {
            const records = [
                { client: 'X', amount: 500 },
                { client: 'Y', amount: 500 }
            ];
            const result = mod.assessDiversification(records);
            expect(result.clientCount).toBe(2);
            expect(result.riskLevel).not.toBe('no_data');
        });
    });

    // ─── generateReport ─────────────────────────────────────────────────

    describe('Monthly Reporting', () => {
        test('generates report for current month', () => {
            seedMonthlyIncome(6, 6000, 3);
            mod.setGoal({ target: 10000, period: 'monthly' });

            const report = mod.generateReport();
            expect(report.period).toBeDefined();
            expect(report.income).toBeDefined();
            expect(report.income.yearToDate).toBeGreaterThanOrEqual(0);
            expect(report.goals).toBeDefined();
            expect(report.diversification).toBeDefined();
            expect(report.pipeline).toBeDefined();
        });

        test('generates report for specific month', () => {
            seedMonthlyIncome(12, 6000, 2);
            const now = new Date();
            const threeMonthsAgo = _internal.addMonths(now, -3);
            const mk = _internal.monthKey(threeMonthsAgo);

            const report = mod.generateReport({ month: mk });
            expect(report.period.month).toBe(mk);
            expect(report.income.total).toBeGreaterThan(0);
        });

        test('includes prior month comparison', () => {
            seedMonthlyIncome(6, 6000, 2);
            const report = mod.generateReport();
            expect(report.income.comparison.priorMonth).toBeDefined();
        });

        test('can disable comparison', () => {
            seedMonthlyIncome(6, 6000, 2);
            const report = mod.generateReport({ compareWithPrior: false });
            expect(report.income.comparison).toEqual({});
        });
    });

    // ─── CLI Handler ────────────────────────────────────────────────────

    describe('CLI Handler', () => {
        beforeEach(() => {
            seedMonthlyIncome(6, 6000, 2);
        });

        test('help command', () => {
            const result = mod.handleCLI(['help']);
            expect(result.commands).toBeDefined();
            expect(result.commands.forecast).toBeDefined();
        });

        test('forecast command', () => {
            const result = mod.handleCLI(['forecast', '--months', '3']);
            expect(result.forecasts).toHaveLength(3);
        });

        test('goal set command', () => {
            const result = mod.handleCLI(['goal', 'set', '--target', '10000', '--period', 'monthly']);
            expect(result.target).toBe(10000);
        });

        test('goal progress command', () => {
            mod.setGoal({ target: 10000, period: 'monthly' });
            const result = mod.handleCLI(['goal', 'progress']);
            expect(Array.isArray(result)).toBe(true);
        });

        test('report command', () => {
            const result = mod.handleCLI(['report']);
            expect(result.period).toBeDefined();
        });

        test('trends command', () => {
            const result = mod.handleCLI(['trends']);
            expect(result.direction).toBeDefined();
        });

        test('pipeline command', () => {
            const result = mod.handleCLI(['pipeline']);
            expect(result.totalValue).toBeDefined();
        });

        test('pipeline add command', () => {
            const result = mod.handleCLI([
                'pipeline', 'add',
                '--name', 'TestOpp',
                '--value', '5000',
                '--probability', '70',
                '--client', 'TestCo'
            ]);
            expect(result.name).toBe('TestOpp');
        });

        test('scenario command', () => {
            const result = mod.handleCLI([
                'scenario', 'rate_change',
                '--change', '15'
            ]);
            expect(result.scenario).toBeDefined();
        });

        test('diversification command', () => {
            const result = mod.handleCLI(['diversification']);
            expect(result.riskLevel).toBeDefined();
        });

        test('cashflow command', () => {
            const result = mod.handleCLI(['cashflow', '--months', '3']);
            expect(result.projections).toHaveLength(3);
        });

        test('record income command', () => {
            const result = mod.handleCLI([
                'record', 'income',
                '--amount', '2500',
                '--date', '2025-03-20',
                '--client', 'TestClient'
            ]);
            expect(result.amount).toBe(2500);
        });

        test('record expense command', () => {
            const result = mod.handleCLI([
                'record', 'expense',
                '--amount', '100',
                '--desc', 'Domain renewal'
            ]);
            expect(result.amount).toBe(100);
        });

        test('unknown command shows help', () => {
            const result = mod.handleCLI(['unknown']);
            expect(result.commands).toBeDefined();
        });
    });
});
