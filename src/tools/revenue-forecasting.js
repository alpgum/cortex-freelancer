#!/usr/bin/env node
/**
 * Revenue Forecasting with Trend Analysis and Goal Tracking
 * 
 * Comprehensive revenue forecasting, goal tracking, trend analysis,
 * pipeline valuation, scenario modeling, and cash flow projection
 * for freelance professionals.
 * 
 * CFX-066 — Cortex Freelancer
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// ─── Storage ────────────────────────────────────────────────────────────────

const DATA_DIR = path.join(os.homedir(), '.cortex-freelancer', 'revenue');

function ensureDataDir() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadJSON(filename, fallback = null) {
    const fp = path.join(DATA_DIR, filename);
    try {
        return JSON.parse(fs.readFileSync(fp, 'utf8'));
    } catch {
        return fallback;
    }
}

function saveJSON(filename, data) {
    ensureDataDir();
    const fp = path.join(DATA_DIR, filename);
    fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf8');
}

// ─── Helper Utilities ───────────────────────────────────────────────────────

function monthKey(date) {
    const d = date instanceof Date ? date : new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function quarterKey(date) {
    const d = date instanceof Date ? date : new Date(date);
    const q = Math.ceil((d.getMonth() + 1) / 3);
    return `${d.getFullYear()}-Q${q}`;
}

function yearKey(date) {
    const d = date instanceof Date ? date : new Date(date);
    return `${d.getFullYear()}`;
}

function parseMonthKey(key) {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1);
}

function addMonths(date, n) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + n);
    return d;
}

function monthsBetween(a, b) {
    return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

function mean(arr) {
    if (!arr.length) return 0;
    return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stddev(arr) {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}

function linearRegression(xs, ys) {
    const n = xs.length;
    if (n < 2) return { slope: 0, intercept: mean(ys), r2: 0 };
    const mx = mean(xs);
    const my = mean(ys);
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
        num += (xs[i] - mx) * (ys[i] - my);
        den += (xs[i] - mx) ** 2;
    }
    const slope = den === 0 ? 0 : num / den;
    const intercept = my - slope * mx;
    // R²
    const predicted = xs.map(x => slope * x + intercept);
    const ssTot = ys.reduce((s, y) => s + (y - my) ** 2, 0);
    const ssRes = ys.reduce((s, y, i) => s + (y - predicted[i]) ** 2, 0);
    const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
    return { slope, intercept, r2 };
}

// ─── Income Records ─────────────────────────────────────────────────────────

function getIncomeRecords() {
    return loadJSON('income.json', []);
}

function saveIncomeRecords(records) {
    saveJSON('income.json', records);
}

/**
 * Record an income entry.
 * @param {{ amount: number, date: string, client?: string, category?: string, description?: string, invoiceId?: string }} entry
 */
function recordIncome(entry) {
    if (!entry.amount || !entry.date) throw new Error('amount and date are required');
    const records = getIncomeRecords();
    const record = {
        id: `inc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        amount: Number(entry.amount),
        date: entry.date,
        client: entry.client || 'Unknown',
        category: entry.category || 'general',
        description: entry.description || '',
        invoiceId: entry.invoiceId || null,
        createdAt: new Date().toISOString()
    };
    records.push(record);
    saveIncomeRecords(records);
    return record;
}

// ─── Monthly Aggregation ────────────────────────────────────────────────────

function aggregateByMonth(records) {
    const byMonth = {};
    for (const r of records) {
        const mk = monthKey(r.date);
        if (!byMonth[mk]) byMonth[mk] = { total: 0, count: 0, clients: new Set() };
        byMonth[mk].total += r.amount;
        byMonth[mk].count++;
        byMonth[mk].clients.add(r.client);
    }
    // serialize sets
    for (const k of Object.keys(byMonth)) {
        byMonth[k].clients = [...byMonth[k].clients];
    }
    return byMonth;
}

function aggregateByClient(records) {
    const byClient = {};
    for (const r of records) {
        if (!byClient[r.client]) byClient[r.client] = { total: 0, count: 0 };
        byClient[r.client].total += r.amount;
        byClient[r.client].count++;
    }
    return byClient;
}

// ─── 1. Revenue Forecasting ────────────────────────────────────────────────

/**
 * Forecast future revenue using historical data, trend, and seasonal adjustment.
 * @param {{ months?: number, method?: 'linear'|'weighted'|'seasonal' }} options
 * @returns {{ forecasts: Array, method: string, confidence: string }}
 */
function forecastRevenue(options = {}) {
    const { months = 6, method = 'seasonal' } = options;
    const records = getIncomeRecords();
    const byMonth = aggregateByMonth(records);
    const keys = Object.keys(byMonth).sort();

    if (keys.length < 3) {
        return {
            forecasts: [],
            method,
            confidence: 'insufficient_data',
            message: 'Need at least 3 months of income data for forecasting'
        };
    }

    const values = keys.map(k => byMonth[k].total);
    const indices = keys.map((_, i) => i);

    // Linear trend component
    const { slope, intercept, r2 } = linearRegression(indices, values);

    // Seasonal indices (month-of-year ratios) — needs ≥12 months ideally
    const seasonalFactors = computeSeasonalFactors(keys, values);

    const lastDate = parseMonthKey(keys[keys.length - 1]);
    const forecasts = [];

    for (let i = 1; i <= months; i++) {
        const futureIdx = indices.length - 1 + i;
        const futureDate = addMonths(lastDate, i);
        const mk = monthKey(futureDate);
        const monthNum = futureDate.getMonth(); // 0-11

        let predicted;
        if (method === 'linear') {
            predicted = slope * futureIdx + intercept;
        } else if (method === 'weighted') {
            // Weighted moving average — recent months matter more
            const weights = values.map((_, j) => j + 1);
            const wSum = weights.reduce((a, b) => a + b, 0);
            predicted = values.reduce((s, v, j) => s + v * weights[j], 0) / wSum;
            // apply trend
            predicted += slope * i;
        } else {
            // seasonal: trend + seasonal adjustment
            const trendValue = slope * futureIdx + intercept;
            const sf = seasonalFactors[monthNum] || 1;
            predicted = trendValue * sf;
        }

        predicted = Math.max(0, Math.round(predicted * 100) / 100);

        forecasts.push({
            month: mk,
            predicted,
            trend: Math.round((slope * futureIdx + intercept) * 100) / 100,
            seasonalFactor: seasonalFactors[futureDate.getMonth()] || 1,
            confidence: r2 > 0.7 ? 'high' : r2 > 0.4 ? 'medium' : 'low'
        });
    }

    return {
        forecasts,
        method,
        trend: { slope: Math.round(slope * 100) / 100, r2: Math.round(r2 * 1000) / 1000 },
        historicalAvg: Math.round(mean(values) * 100) / 100,
        confidence: r2 > 0.7 ? 'high' : r2 > 0.4 ? 'medium' : 'low'
    };
}

function computeSeasonalFactors(keys, values) {
    const overallMean = mean(values);
    if (overallMean === 0) return Array(12).fill(1);

    const byMonthNum = {};
    for (let i = 0; i < keys.length; i++) {
        const m = parseMonthKey(keys[i]).getMonth();
        if (!byMonthNum[m]) byMonthNum[m] = [];
        byMonthNum[m].push(values[i]);
    }

    const factors = [];
    for (let m = 0; m < 12; m++) {
        if (byMonthNum[m] && byMonthNum[m].length > 0) {
            factors[m] = mean(byMonthNum[m]) / overallMean;
        } else {
            factors[m] = 1;
        }
    }
    return factors;
}

// ─── 2. Goal Setting & Tracking ─────────────────────────────────────────────

function getGoals() {
    return loadJSON('goals.json', []);
}

function saveGoals(goals) {
    saveJSON('goals.json', goals);
}

/**
 * Set a revenue goal.
 * @param {{ target: number, period: 'monthly'|'quarterly'|'yearly', startDate?: string, label?: string, milestones?: number[] }} goalData
 */
function setGoal(goalData) {
    if (!goalData.target || !goalData.period) throw new Error('target and period are required');
    const goals = getGoals();
    const goal = {
        id: `goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        target: Number(goalData.target),
        period: goalData.period,
        startDate: goalData.startDate || new Date().toISOString().slice(0, 10),
        label: goalData.label || `${goalData.period} revenue goal`,
        milestones: goalData.milestones || [25, 50, 75, 100],
        createdAt: new Date().toISOString(),
        active: true
    };
    goals.push(goal);
    saveGoals(goals);
    return goal;
}

/**
 * Track progress against active goals.
 * @param {{ date?: string }} options
 * @returns {Array<{ goal: object, progress: object }>}
 */
function trackProgress(options = {}) {
    const now = options.date ? new Date(options.date) : new Date();
    const goals = getGoals().filter(g => g.active);
    const records = getIncomeRecords();

    return goals.map(goal => {
        const { start, end } = getPeriodRange(goal.period, goal.startDate, now);
        const periodRecords = records.filter(r => {
            const d = new Date(r.date);
            return d >= start && d <= end;
        });
        const earned = periodRecords.reduce((s, r) => s + r.amount, 0);
        const pct = goal.target > 0 ? Math.round((earned / goal.target) * 10000) / 100 : 0;

        // time progress
        const totalDays = (end - start) / (1000 * 60 * 60 * 24);
        const elapsedDays = Math.max(0, (now - start) / (1000 * 60 * 60 * 24));
        const timePct = totalDays > 0 ? Math.round((elapsedDays / totalDays) * 10000) / 100 : 0;

        // milestones reached
        const milestonesReached = (goal.milestones || []).filter(m => pct >= m);
        const nextMilestone = (goal.milestones || []).find(m => pct < m) || null;

        // pace
        const onPace = timePct > 0 ? pct >= timePct : true;
        const projectedTotal = elapsedDays > 0 ? (earned / elapsedDays) * totalDays : 0;

        return {
            goal: { id: goal.id, label: goal.label, target: goal.target, period: goal.period },
            progress: {
                earned: Math.round(earned * 100) / 100,
                percentage: pct,
                remaining: Math.round((goal.target - earned) * 100) / 100,
                timeElapsed: timePct,
                onPace,
                projectedTotal: Math.round(projectedTotal * 100) / 100,
                milestonesReached,
                nextMilestone,
                periodStart: start.toISOString().slice(0, 10),
                periodEnd: end.toISOString().slice(0, 10)
            }
        };
    });
}

function getPeriodRange(period, startDate, refDate) {
    const ref = refDate instanceof Date ? refDate : new Date(refDate);
    let start, end;

    if (period === 'monthly') {
        start = new Date(ref.getFullYear(), ref.getMonth(), 1);
        end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (period === 'quarterly') {
        const q = Math.floor(ref.getMonth() / 3);
        start = new Date(ref.getFullYear(), q * 3, 1);
        end = new Date(ref.getFullYear(), q * 3 + 3, 0, 23, 59, 59, 999);
    } else {
        // yearly
        start = new Date(ref.getFullYear(), 0, 1);
        end = new Date(ref.getFullYear(), 11, 31, 23, 59, 59, 999);
    }
    return { start, end };
}

// ─── 3. Trend Analysis ──────────────────────────────────────────────────────

/**
 * Analyze income trends over time.
 * @param {{ months?: number }} options
 * @returns {{ direction: string, monthlyGrowth: number, seasonalPatterns: object, clientConcentration: object, volatility: number }}
 */
function analyzeTrends(options = {}) {
    const { months = 12 } = options;
    const records = getIncomeRecords();
    const byMonth = aggregateByMonth(records);
    const keys = Object.keys(byMonth).sort();

    // last N months
    const recentKeys = keys.slice(-months);
    const values = recentKeys.map(k => byMonth[k].total);

    if (values.length < 2) {
        return { direction: 'insufficient_data', message: 'Need at least 2 months of data' };
    }

    const indices = values.map((_, i) => i);
    const { slope, r2 } = linearRegression(indices, values);
    const avgRevenue = mean(values);

    // direction
    const growthPct = avgRevenue > 0 ? (slope / avgRevenue) * 100 : 0;
    let direction;
    if (growthPct > 5) direction = 'strong_growth';
    else if (growthPct > 1) direction = 'moderate_growth';
    else if (growthPct > -1) direction = 'stable';
    else if (growthPct > -5) direction = 'moderate_decline';
    else direction = 'strong_decline';

    // month-over-month changes
    const momChanges = [];
    for (let i = 1; i < values.length; i++) {
        const prev = values[i - 1];
        momChanges.push(prev > 0 ? ((values[i] - prev) / prev) * 100 : 0);
    }

    // seasonal patterns
    const seasonalFactors = computeSeasonalFactors(recentKeys, values);
    const seasonalPatterns = {};
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let m = 0; m < 12; m++) {
        if (seasonalFactors[m] !== 1 || recentKeys.some(k => parseMonthKey(k).getMonth() === m)) {
            seasonalPatterns[monthNames[m]] = Math.round(seasonalFactors[m] * 1000) / 1000;
        }
    }

    // client concentration
    const recentRecords = records.filter(r => {
        const mk = monthKey(r.date);
        return recentKeys.includes(mk);
    });
    const clientConcentration = assessDiversification(recentRecords);

    // volatility (coefficient of variation)
    const vol = avgRevenue > 0 ? (stddev(values) / avgRevenue) * 100 : 0;

    return {
        direction,
        monthlyGrowthRate: Math.round(growthPct * 100) / 100,
        trendStrength: Math.round(r2 * 1000) / 1000,
        averageRevenue: Math.round(avgRevenue * 100) / 100,
        volatility: Math.round(vol * 100) / 100,
        momChanges: momChanges.map(c => Math.round(c * 100) / 100),
        seasonalPatterns,
        clientConcentration,
        periodsAnalyzed: values.length
    };
}

// ─── 4. Pipeline Value Calculator ───────────────────────────────────────────

function getPipeline() {
    return loadJSON('pipeline.json', []);
}

function savePipeline(pipeline) {
    saveJSON('pipeline.json', pipeline);
}

/**
 * Add or update a pipeline opportunity.
 * @param {{ name: string, value: number, probability: number, client?: string, expectedCloseDate?: string, stage?: string }} opp
 */
function addPipelineOpportunity(opp) {
    if (!opp.name || opp.value == null || opp.probability == null) {
        throw new Error('name, value, and probability are required');
    }
    const pipeline = getPipeline();
    const entry = {
        id: `opp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: opp.name,
        value: Number(opp.value),
        probability: Math.min(100, Math.max(0, Number(opp.probability))),
        client: opp.client || 'Unknown',
        expectedCloseDate: opp.expectedCloseDate || null,
        stage: opp.stage || 'proposal',
        createdAt: new Date().toISOString()
    };
    pipeline.push(entry);
    savePipeline(pipeline);
    return entry;
}

/**
 * Calculate weighted pipeline value.
 * @returns {{ totalValue: number, weightedValue: number, opportunities: Array, byStage: object }}
 */
function calculatePipelineValue() {
    const pipeline = getPipeline();
    const active = pipeline.filter(o => o.stage !== 'lost' && o.stage !== 'won');

    const totalValue = active.reduce((s, o) => s + o.value, 0);
    const weightedValue = active.reduce((s, o) => s + o.value * (o.probability / 100), 0);

    // by stage
    const byStage = {};
    for (const o of active) {
        if (!byStage[o.stage]) byStage[o.stage] = { count: 0, totalValue: 0, weightedValue: 0 };
        byStage[o.stage].count++;
        byStage[o.stage].totalValue += o.value;
        byStage[o.stage].weightedValue += o.value * (o.probability / 100);
    }
    // round
    for (const k of Object.keys(byStage)) {
        byStage[k].totalValue = Math.round(byStage[k].totalValue * 100) / 100;
        byStage[k].weightedValue = Math.round(byStage[k].weightedValue * 100) / 100;
    }

    return {
        totalValue: Math.round(totalValue * 100) / 100,
        weightedValue: Math.round(weightedValue * 100) / 100,
        opportunityCount: active.length,
        averageProbability: active.length > 0 ? Math.round(mean(active.map(o => o.probability)) * 100) / 100 : 0,
        byStage,
        opportunities: active.map(o => ({
            ...o,
            weightedValue: Math.round(o.value * (o.probability / 100) * 100) / 100
        }))
    };
}

// ─── 5. Scenario Modeling ───────────────────────────────────────────────────

/**
 * Model "what-if" revenue scenarios.
 * @param {{ type: 'rate_change'|'client_loss'|'new_client'|'hours_change'|'custom', params: object }} scenario
 * @returns {{ baseline: object, scenario: object, impact: object }}
 */
function modelScenario(scenario) {
    if (!scenario || !scenario.type) throw new Error('scenario type is required');

    const records = getIncomeRecords();
    const byMonth = aggregateByMonth(records);
    const keys = Object.keys(byMonth).sort();
    const recentKeys = keys.slice(-6);
    const recentValues = recentKeys.map(k => byMonth[k].total);
    const baselineMonthly = mean(recentValues);
    const baselineAnnual = baselineMonthly * 12;

    const byClient = aggregateByClient(records);

    let scenarioMonthly, scenarioAnnual, description;

    switch (scenario.type) {
        case 'rate_change': {
            const changePct = scenario.params?.percentChange || 0;
            scenarioMonthly = baselineMonthly * (1 + changePct / 100);
            scenarioAnnual = scenarioMonthly * 12;
            description = `Rate ${changePct >= 0 ? 'increase' : 'decrease'} of ${Math.abs(changePct)}%`;
            break;
        }
        case 'client_loss': {
            const clientName = scenario.params?.client;
            if (!clientName || !byClient[clientName]) {
                throw new Error(`Client "${clientName}" not found. Available: ${Object.keys(byClient).join(', ')}`);
            }
            const clientMonths = keys.length || 1;
            const clientMonthlyAvg = byClient[clientName].total / clientMonths;
            scenarioMonthly = baselineMonthly - clientMonthlyAvg;
            scenarioAnnual = scenarioMonthly * 12;
            description = `Loss of client "${clientName}" (~$${Math.round(clientMonthlyAvg)}/mo)`;
            break;
        }
        case 'new_client': {
            const monthlyValue = scenario.params?.monthlyValue || 0;
            scenarioMonthly = baselineMonthly + monthlyValue;
            scenarioAnnual = scenarioMonthly * 12;
            description = `New client adding $${monthlyValue}/month`;
            break;
        }
        case 'hours_change': {
            const changePct = scenario.params?.percentChange || 0;
            scenarioMonthly = baselineMonthly * (1 + changePct / 100);
            scenarioAnnual = scenarioMonthly * 12;
            description = `Hours ${changePct >= 0 ? 'increase' : 'decrease'} of ${Math.abs(changePct)}%`;
            break;
        }
        case 'custom': {
            scenarioMonthly = scenario.params?.monthlyRevenue || baselineMonthly;
            scenarioAnnual = scenarioMonthly * 12;
            description = scenario.params?.description || 'Custom scenario';
            break;
        }
        default:
            throw new Error(`Unknown scenario type: ${scenario.type}`);
    }

    scenarioMonthly = Math.round(scenarioMonthly * 100) / 100;
    scenarioAnnual = Math.round(scenarioAnnual * 100) / 100;

    const monthlyDiff = Math.round((scenarioMonthly - baselineMonthly) * 100) / 100;
    const annualDiff = Math.round((scenarioAnnual - baselineAnnual) * 100) / 100;
    const changePct = baselineMonthly > 0
        ? Math.round(((scenarioMonthly - baselineMonthly) / baselineMonthly) * 10000) / 100
        : 0;

    return {
        description,
        baseline: {
            monthly: Math.round(baselineMonthly * 100) / 100,
            annual: Math.round(baselineAnnual * 100) / 100
        },
        scenario: {
            monthly: scenarioMonthly,
            annual: scenarioAnnual
        },
        impact: {
            monthlyDiff,
            annualDiff,
            percentChange: changePct
        }
    };
}

// ─── 6. Cash Flow Forecasting ───────────────────────────────────────────────

function getExpenses() {
    return loadJSON('expenses.json', []);
}

/**
 * Record a recurring or one-time expense.
 * @param {{ amount: number, description: string, date?: string, recurring?: boolean, frequency?: 'monthly'|'quarterly'|'yearly', category?: string }} entry
 */
function recordExpense(entry) {
    if (!entry.amount || !entry.description) throw new Error('amount and description required');
    const expenses = getExpenses();
    const record = {
        id: `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        amount: Number(entry.amount),
        description: entry.description,
        date: entry.date || new Date().toISOString().slice(0, 10),
        recurring: entry.recurring || false,
        frequency: entry.frequency || null,
        category: entry.category || 'general',
        createdAt: new Date().toISOString()
    };
    expenses.push(record);
    saveJSON('expenses.json', expenses);
    return record;
}

/**
 * Project cash flow for upcoming months.
 * @param {{ months?: number, paymentDelayDays?: number }} options
 * @returns {{ projections: Array, summary: object }}
 */
function forecastCashFlow(options = {}) {
    const { months = 6, paymentDelayDays = 30 } = options;
    const records = getIncomeRecords();
    const expenses = getExpenses();
    const forecast = forecastRevenue({ months });
    const byMonth = aggregateByMonth(records);
    const keys = Object.keys(byMonth).sort();

    // recurring monthly expenses
    const recurringMonthly = expenses
        .filter(e => e.recurring && e.frequency === 'monthly')
        .reduce((s, e) => s + e.amount, 0);

    const recurringQuarterly = expenses
        .filter(e => e.recurring && e.frequency === 'quarterly')
        .reduce((s, e) => s + e.amount, 0);

    const recurringYearly = expenses
        .filter(e => e.recurring && e.frequency === 'yearly')
        .reduce((s, e) => s + e.amount, 0);

    // historical average expenses (non-recurring)
    const oneTimeExpenses = expenses.filter(e => !e.recurring);
    const monthsWithExpenses = new Set(oneTimeExpenses.map(e => monthKey(e.date))).size || 1;
    const avgOneTimeMonthly = oneTimeExpenses.reduce((s, e) => s + e.amount, 0) / monthsWithExpenses;

    const projections = [];
    const now = new Date();
    let runningBalance = 0;

    for (let i = 0; i < months; i++) {
        const futureDate = addMonths(now, i + 1);
        const mk = monthKey(futureDate);
        const monthNum = futureDate.getMonth();

        // projected income (from forecast, delayed by payment terms)
        const forecastEntry = forecast.forecasts[i];
        const projectedIncome = forecastEntry ? forecastEntry.predicted : 0;

        // delay: income billed this month arrives ~paymentDelayDays later
        const delayedIncome = i === 0 ? projectedIncome * 0.5 : projectedIncome; // first month partial

        // expenses
        const qMonth = monthNum % 3;
        const isQuarterEnd = qMonth === 2;
        const isYearEnd = monthNum === 11;
        let totalExpenses = recurringMonthly + avgOneTimeMonthly;
        if (isQuarterEnd) totalExpenses += recurringQuarterly;
        if (isYearEnd) totalExpenses += recurringYearly;

        const netCashFlow = delayedIncome - totalExpenses;
        runningBalance += netCashFlow;

        projections.push({
            month: mk,
            projectedIncome: Math.round(delayedIncome * 100) / 100,
            projectedExpenses: Math.round(totalExpenses * 100) / 100,
            netCashFlow: Math.round(netCashFlow * 100) / 100,
            runningBalance: Math.round(runningBalance * 100) / 100
        });
    }

    return {
        projections,
        assumptions: {
            paymentDelayDays,
            recurringMonthlyExpenses: Math.round(recurringMonthly * 100) / 100,
            avgOneTimeExpenses: Math.round(avgOneTimeMonthly * 100) / 100
        },
        summary: {
            totalProjectedIncome: Math.round(projections.reduce((s, p) => s + p.projectedIncome, 0) * 100) / 100,
            totalProjectedExpenses: Math.round(projections.reduce((s, p) => s + p.projectedExpenses, 0) * 100) / 100,
            netCashFlow: Math.round(projections.reduce((s, p) => s + p.netCashFlow, 0) * 100) / 100,
            lowestBalance: Math.round(Math.min(...projections.map(p => p.runningBalance)) * 100) / 100
        }
    };
}

// ─── 7. Revenue Diversification Score ───────────────────────────────────────

/**
 * Assess revenue diversification and client dependency risk.
 * @param {Array} [incomeRecords] - optional, defaults to all income records
 * @returns {{ herfindahlIndex: number, diversificationScore: number, riskLevel: string, clientShares: Array, topClientRisk: object }}
 */
function assessDiversification(incomeRecords) {
    const records = incomeRecords || getIncomeRecords();
    if (records.length === 0) {
        return {
            herfindahlIndex: 0,
            diversificationScore: 0,
            riskLevel: 'no_data',
            clientShares: [],
            topClientRisk: null
        };
    }

    const byClient = aggregateByClient(records);
    const totalRevenue = Object.values(byClient).reduce((s, c) => s + c.total, 0);

    if (totalRevenue === 0) {
        return {
            herfindahlIndex: 0,
            diversificationScore: 0,
            riskLevel: 'no_data',
            clientShares: [],
            topClientRisk: null
        };
    }

    const shares = Object.entries(byClient)
        .map(([client, data]) => ({
            client,
            revenue: Math.round(data.total * 100) / 100,
            share: Math.round((data.total / totalRevenue) * 10000) / 100,
            invoiceCount: data.count
        }))
        .sort((a, b) => b.revenue - a.revenue);

    // Herfindahl-Hirschman Index (HHI): sum of squared market shares
    // Ranges: 0-10000. <1500 = diversified, 1500-2500 = moderate, >2500 = concentrated
    const hhi = shares.reduce((s, c) => s + (c.share) ** 2, 0);

    // Normalize to 0-100 score where 100 = perfectly diversified
    const maxHHI = 10000; // single client
    const minHHI = shares.length > 0 ? 10000 / shares.length : 10000;
    const diversificationScore = maxHHI === minHHI ? 0 :
        Math.round(((maxHHI - hhi) / (maxHHI - minHHI)) * 10000) / 100;

    let riskLevel;
    if (hhi > 5000) riskLevel = 'critical';
    else if (hhi > 2500) riskLevel = 'high';
    else if (hhi > 1500) riskLevel = 'moderate';
    else riskLevel = 'low';

    const topClient = shares[0];
    const topClientRisk = topClient ? {
        client: topClient.client,
        share: topClient.share,
        monthlyAvg: Math.round((topClient.revenue / Math.max(1, Object.keys(aggregateByMonth(records)).length)) * 100) / 100,
        warning: topClient.share > 50 ? 'CRITICAL: Over 50% revenue from single client' :
            topClient.share > 30 ? 'WARNING: Over 30% revenue from single client' : null
    } : null;

    return {
        herfindahlIndex: Math.round(hhi * 100) / 100,
        diversificationScore: Math.max(0, Math.min(100, diversificationScore)),
        riskLevel,
        clientCount: shares.length,
        clientShares: shares,
        topClientRisk
    };
}

// ─── 8. Monthly Reporting ───────────────────────────────────────────────────

/**
 * Generate a revenue report for a given month.
 * @param {{ month?: string, compareWithPrior?: boolean }} options  month in YYYY-MM format
 * @returns {{ period: object, income: object, goals: Array, trends: object, pipeline: object, diversification: object }}
 */
function generateReport(options = {}) {
    const now = new Date();
    const targetMonth = options.month || monthKey(now);
    const compareWithPrior = options.compareWithPrior !== false;

    const records = getIncomeRecords();
    const byMonth = aggregateByMonth(records);

    // Current month data
    const current = byMonth[targetMonth] || { total: 0, count: 0, clients: [] };

    // Prior month
    const priorDate = addMonths(parseMonthKey(targetMonth), -1);
    const priorMK = monthKey(priorDate);
    const prior = byMonth[priorMK] || { total: 0, count: 0, clients: [] };

    // Same month last year
    const lastYearDate = addMonths(parseMonthKey(targetMonth), -12);
    const lastYearMK = monthKey(lastYearDate);
    const lastYear = byMonth[lastYearMK] || null;

    // Year-to-date
    const year = targetMonth.split('-')[0];
    const ytdKeys = Object.keys(byMonth).filter(k => k.startsWith(year) && k <= targetMonth).sort();
    const ytdTotal = ytdKeys.reduce((s, k) => s + byMonth[k].total, 0);

    // Goal progress
    const goalProgress = trackProgress({ date: parseMonthKey(targetMonth).toISOString() });

    // Build report
    const report = {
        period: {
            month: targetMonth,
            generatedAt: new Date().toISOString()
        },
        income: {
            total: Math.round(current.total * 100) / 100,
            invoiceCount: current.count,
            clients: current.clients,
            yearToDate: Math.round(ytdTotal * 100) / 100,
            comparison: {}
        },
        goals: goalProgress,
        diversification: assessDiversification(),
        pipeline: calculatePipelineValue()
    };

    if (compareWithPrior) {
        const momChange = prior.total > 0
            ? Math.round(((current.total - prior.total) / prior.total) * 10000) / 100
            : null;
        report.income.comparison.priorMonth = {
            month: priorMK,
            total: Math.round(prior.total * 100) / 100,
            change: momChange !== null ? `${momChange >= 0 ? '+' : ''}${momChange}%` : 'N/A'
        };

        if (lastYear) {
            const yoyChange = lastYear.total > 0
                ? Math.round(((current.total - lastYear.total) / lastYear.total) * 10000) / 100
                : null;
            report.income.comparison.lastYear = {
                month: lastYearMK,
                total: Math.round(lastYear.total * 100) / 100,
                change: yoyChange !== null ? `${yoyChange >= 0 ? '+' : ''}${yoyChange}%` : 'N/A'
            };
        }
    }

    // Trend summary
    const trends = analyzeTrends({ months: 6 });
    if (trends.direction !== 'insufficient_data') {
        report.trends = {
            direction: trends.direction,
            monthlyGrowthRate: trends.monthlyGrowthRate,
            volatility: trends.volatility
        };
    }

    return report;
}

// ─── CLI Handler ────────────────────────────────────────────────────────────

function handleCLI(args) {
    const subcommand = args[0];
    const flags = parseFlags(args.slice(1));

    switch (subcommand) {
        case 'forecast':
            return forecastRevenue({
                months: flags.months ? parseInt(flags.months) : 6,
                method: flags.method || 'seasonal'
            });

        case 'goal': {
            const action = args[1] || 'list';
            if (action === 'set') {
                return setGoal({
                    target: parseFloat(flags.target),
                    period: flags.period || 'monthly',
                    label: flags.label,
                    startDate: flags.start
                });
            }
            if (action === 'progress' || action === 'track') {
                return trackProgress();
            }
            // list
            return getGoals();
        }

        case 'report':
            return generateReport({
                month: flags.month,
                compareWithPrior: flags['no-compare'] ? false : true
            });

        case 'scenario': {
            const type = flags.type || args[1];
            if (!type) return { error: 'Scenario type required: rate_change, client_loss, new_client, hours_change, custom' };
            const params = {};
            if (flags.change) params.percentChange = parseFloat(flags.change);
            if (flags.client) params.client = flags.client;
            if (flags.value) params.monthlyValue = parseFloat(flags.value);
            if (flags.revenue) params.monthlyRevenue = parseFloat(flags.revenue);
            if (flags.description) params.description = flags.description;
            return modelScenario({ type, params });
        }

        case 'trends':
            return analyzeTrends({ months: flags.months ? parseInt(flags.months) : 12 });

        case 'pipeline': {
            const action = args[1];
            if (action === 'add') {
                return addPipelineOpportunity({
                    name: flags.name,
                    value: parseFloat(flags.value),
                    probability: parseFloat(flags.probability || flags.prob),
                    client: flags.client,
                    expectedCloseDate: flags.close,
                    stage: flags.stage
                });
            }
            return calculatePipelineValue();
        }

        case 'diversification':
            return assessDiversification();

        case 'cashflow':
            return forecastCashFlow({
                months: flags.months ? parseInt(flags.months) : 6,
                paymentDelayDays: flags.delay ? parseInt(flags.delay) : 30
            });

        case 'record': {
            const recordType = args[1];
            if (recordType === 'income') {
                return recordIncome({
                    amount: parseFloat(flags.amount),
                    date: flags.date || new Date().toISOString().slice(0, 10),
                    client: flags.client,
                    category: flags.category,
                    description: flags.description || flags.desc
                });
            }
            if (recordType === 'expense') {
                return recordExpense({
                    amount: parseFloat(flags.amount),
                    description: flags.description || flags.desc,
                    date: flags.date,
                    recurring: flags.recurring === 'true' || flags.recurring === true,
                    frequency: flags.frequency || flags.freq,
                    category: flags.category
                });
            }
            return { error: 'Usage: cortex revenue record income|expense --amount X ...' };
        }

        case 'help':
        default:
            return {
                commands: {
                    'forecast': 'Forecast revenue (--months N, --method linear|weighted|seasonal)',
                    'goal set': 'Set a revenue goal (--target N --period monthly|quarterly|yearly)',
                    'goal progress': 'Track progress against active goals',
                    'report': 'Generate monthly revenue report (--month YYYY-MM)',
                    'scenario': 'Model what-if scenarios (--type rate_change|client_loss|new_client|hours_change)',
                    'trends': 'Analyze income trends (--months N)',
                    'pipeline': 'View weighted pipeline value',
                    'pipeline add': 'Add pipeline opportunity (--name X --value N --probability N)',
                    'diversification': 'Assess revenue concentration risk',
                    'cashflow': 'Forecast cash flow (--months N --delay N)',
                    'record income': 'Record income (--amount N --date YYYY-MM-DD --client X)',
                    'record expense': 'Record expense (--amount N --desc X --recurring true --freq monthly)'
                }
            };
    }
}

function parseFlags(args) {
    const flags = {};
    for (let i = 0; i < args.length; i++) {
        if (args[i].startsWith('--')) {
            const key = args[i].slice(2);
            const next = args[i + 1];
            if (next && !next.startsWith('--')) {
                flags[key] = next;
                i++;
            } else {
                flags[key] = true;
            }
        }
    }
    return flags;
}

// ─── CLI Entry Point ────────────────────────────────────────────────────────

if (require.main === module) {
    const args = process.argv.slice(2);
    try {
        const result = handleCLI(args);
        console.log(JSON.stringify(result, null, 2));
    } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
    }
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
    // Core functions
    forecastRevenue,
    setGoal,
    trackProgress,
    analyzeTrends,
    modelScenario,
    calculatePipelineValue,
    assessDiversification,
    generateReport,
    
    // Cash flow
    forecastCashFlow,
    
    // Data entry
    recordIncome,
    recordExpense,
    addPipelineOpportunity,
    
    // Pipeline
    getPipeline,
    
    // Data access
    getIncomeRecords,
    getGoals,
    
    // CLI
    handleCLI,

    // Internals (for testing)
    _internal: {
        DATA_DIR,
        loadJSON,
        saveJSON,
        aggregateByMonth,
        aggregateByClient,
        linearRegression,
        computeSeasonalFactors,
        mean,
        stddev,
        monthKey,
        quarterKey,
        yearKey,
        parseMonthKey,
        addMonths,
        getPeriodRange
    }
};
