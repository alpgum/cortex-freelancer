#!/usr/bin/env node
/**
 * Competitive Analysis & Market Positioning Tool for Freelancers
 *
 * Track competitors, analyze market positioning, find service gaps,
 * compare rates, generate SWOT analyses, and detect emerging trends.
 *
 * Storage: ~/.cortex-freelancer/competitive-intel/
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// ─── Storage ────────────────────────────────────────────────────────────────

let dataDir = path.join(os.homedir(), '.cortex-freelancer', 'competitive-intel');

const STORES = {
    competitors: 'competitors.json',
    winLoss: 'win-loss.json',
    trends: 'trends.json',
    profile: 'my-profile.json',
};

function getDataDir() {
    return dataDir;
}

function setDataDir(dir) {
    dataDir = dir;
}

function ensureDataDir() {
    const dir = getDataDir();
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function loadStore(name) {
    ensureDataDir();
    const filePath = path.join(getDataDir(), STORES[name] || name);
    if (!fs.existsSync(filePath)) return name === 'competitors' || name === 'winLoss' || name === 'trends' ? [] : {};
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
        return name === 'competitors' || name === 'winLoss' || name === 'trends' ? [] : {};
    }
}

function saveStore(name, data) {
    ensureDataDir();
    const filePath = path.join(getDataDir(), STORES[name] || name);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateId() {
    return crypto.randomBytes(6).toString('hex');
}

function timestamp() {
    return new Date().toISOString();
}

function mean(arr) {
    if (!arr.length) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function median(arr) {
    if (!arr.length) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

// ─── 1. Competitor Profiling ────────────────────────────────────────────────

/**
 * Add or update a competitor profile.
 *
 * @param {Object} data
 * @param {string} data.name            - Competitor name / alias (required)
 * @param {string[]} [data.services]    - Services they offer
 * @param {Object} [data.rates]         - { hourly, project_min, project_max, retainer }
 * @param {string} [data.positioning]   - e.g. "premium specialist", "budget generalist"
 * @param {string[]} [data.strengths]
 * @param {string[]} [data.weaknesses]
 * @param {string} [data.website]
 * @param {string[]} [data.platforms]   - e.g. ["upwork", "toptal"]
 * @param {number} [data.qualityScore]  - 1-10 subjective quality rating
 * @param {number} [data.priceScore]    - 1-10 (1 = cheapest, 10 = most expensive)
 * @param {number} [data.specialistScore] - 1-10 (1 = generalist, 10 = deep specialist)
 * @param {string} [data.notes]
 * @returns {Object} The saved competitor record
 */
function addCompetitor(data) {
    if (!data || !data.name) throw new Error('Competitor name is required');

    const competitors = loadStore('competitors');

    // Upsert by name (case-insensitive)
    const idx = competitors.findIndex(c => c.name.toLowerCase() === data.name.toLowerCase());

    const record = {
        id: idx >= 0 ? competitors[idx].id : generateId(),
        name: data.name,
        services: data.services || (idx >= 0 ? competitors[idx].services : []),
        rates: data.rates || (idx >= 0 ? competitors[idx].rates : {}),
        positioning: data.positioning || (idx >= 0 ? competitors[idx].positioning : ''),
        strengths: data.strengths || (idx >= 0 ? competitors[idx].strengths : []),
        weaknesses: data.weaknesses || (idx >= 0 ? competitors[idx].weaknesses : []),
        website: data.website || (idx >= 0 ? competitors[idx].website : ''),
        platforms: data.platforms || (idx >= 0 ? competitors[idx].platforms : []),
        qualityScore: clamp(data.qualityScore ?? (idx >= 0 ? competitors[idx].qualityScore : 5), 1, 10),
        priceScore: clamp(data.priceScore ?? (idx >= 0 ? competitors[idx].priceScore : 5), 1, 10),
        specialistScore: clamp(data.specialistScore ?? (idx >= 0 ? competitors[idx].specialistScore : 5), 1, 10),
        notes: data.notes || (idx >= 0 ? competitors[idx].notes : ''),
        updatedAt: timestamp(),
        createdAt: idx >= 0 ? competitors[idx].createdAt : timestamp(),
    };

    if (idx >= 0) {
        competitors[idx] = record;
    } else {
        competitors.push(record);
    }

    saveStore('competitors', competitors);
    return record;
}

/**
 * Remove a competitor by name or id.
 */
function removeCompetitor(nameOrId) {
    const competitors = loadStore('competitors');
    const idx = competitors.findIndex(
        c => c.id === nameOrId || c.name.toLowerCase() === nameOrId.toLowerCase()
    );
    if (idx < 0) throw new Error(`Competitor "${nameOrId}" not found`);
    const removed = competitors.splice(idx, 1)[0];
    saveStore('competitors', competitors);
    return removed;
}

/**
 * List all competitors, optionally filtered.
 */
function listCompetitors(filter = {}) {
    let competitors = loadStore('competitors');
    if (filter.service) {
        const svc = filter.service.toLowerCase();
        competitors = competitors.filter(c =>
            c.services.some(s => s.toLowerCase().includes(svc))
        );
    }
    if (filter.platform) {
        const plat = filter.platform.toLowerCase();
        competitors = competitors.filter(c =>
            c.platforms.some(p => p.toLowerCase().includes(plat))
        );
    }
    return competitors;
}

// ─── 2. Market Position Map ─────────────────────────────────────────────────

/**
 * Save / update your own freelancer profile for comparison.
 */
function setMyProfile(data) {
    if (!data || !data.name) throw new Error('Profile name is required');
    const profile = {
        ...loadStore('profile'),
        ...data,
        updatedAt: timestamp(),
    };
    saveStore('profile', profile);
    return profile;
}

function getMyProfile() {
    return loadStore('profile');
}

/**
 * Generate a text-based 2D position map.
 *
 * Default axes: X = priceScore (cheap → expensive), Y = qualityScore (low → high)
 * You can override with xAxis / yAxis = 'priceScore' | 'qualityScore' | 'specialistScore'
 *
 * Returns { map: string, legend: Object[] }
 */
function analyzePosition(options = {}) {
    const xAxis = options.xAxis || 'priceScore';
    const yAxis = options.yAxis || 'qualityScore';
    const competitors = loadStore('competitors');
    const profile = loadStore('profile');

    const axisLabels = {
        priceScore: { low: 'Budget', high: 'Premium' },
        qualityScore: { low: 'Lower Quality', high: 'Higher Quality' },
        specialistScore: { low: 'Generalist', high: 'Specialist' },
    };

    const WIDTH = 40;
    const HEIGHT = 20;
    const grid = Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(' '));

    // Build entries
    const entries = [];
    competitors.forEach((c, i) => {
        entries.push({
            label: String.fromCharCode(65 + (i % 26)), // A-Z
            name: c.name,
            x: c[xAxis] ?? 5,
            y: c[yAxis] ?? 5,
            isMe: false,
        });
    });

    if (profile.name) {
        entries.push({
            label: '★',
            name: profile.name + ' (you)',
            x: profile[xAxis] ?? 5,
            y: profile[yAxis] ?? 5,
            isMe: true,
        });
    }

    // Place on grid (1-10 → grid coords)
    entries.forEach(e => {
        const gx = Math.round(((e.x - 1) / 9) * (WIDTH - 1));
        const gy = HEIGHT - 1 - Math.round(((e.y - 1) / 9) * (HEIGHT - 1));
        grid[clamp(gy, 0, HEIGHT - 1)][clamp(gx, 0, WIDTH - 1)] = e.label;
    });

    // Render
    const xLabel = axisLabels[xAxis] || { low: xAxis + ' low', high: xAxis + ' high' };
    const yLabel = axisLabels[yAxis] || { low: yAxis + ' low', high: yAxis + ' high' };

    let map = `  ${yLabel.high}\n`;
    for (let row = 0; row < HEIGHT; row++) {
        const prefix = row === Math.floor(HEIGHT / 2) ? '  │' : '  │';
        map += prefix + grid[row].join('') + '│\n';
    }
    map += `  ${yLabel.low}\n`;
    map += `  ${'─'.repeat(WIDTH + 2)}\n`;
    map += `  ${xLabel.low}${' '.repeat(WIDTH - xLabel.low.length - xLabel.high.length)}${xLabel.high}\n`;

    const legend = entries.map(e => ({
        label: e.label,
        name: e.name,
        [xAxis]: e.x,
        [yAxis]: e.y,
    }));

    // Quadrant analysis
    const quadrants = {
        premiumHigh: entries.filter(e => e.x > 5 && e.y > 5).map(e => e.name),
        premiumLow: entries.filter(e => e.x > 5 && e.y <= 5).map(e => e.name),
        budgetHigh: entries.filter(e => e.x <= 5 && e.y > 5).map(e => e.name),
        budgetLow: entries.filter(e => e.x <= 5 && e.y <= 5).map(e => e.name),
    };

    return { map, legend, quadrants };
}

// ─── 3. Differentiation Analysis ────────────────────────────────────────────

/**
 * Identify unique selling points and suggest positioning strategies.
 */
function analyzeDifferentiation() {
    const competitors = loadStore('competitors');
    const profile = loadStore('profile');

    if (!profile.name) {
        return { error: 'Set your profile first with setMyProfile()' };
    }

    const myServices = new Set((profile.services || []).map(s => s.toLowerCase()));
    const myStrengths = new Set((profile.strengths || []).map(s => s.toLowerCase()));

    // Competitor service frequency
    const serviceFreq = {};
    const strengthFreq = {};
    competitors.forEach(c => {
        (c.services || []).forEach(s => {
            const key = s.toLowerCase();
            serviceFreq[key] = (serviceFreq[key] || 0) + 1;
        });
        (c.strengths || []).forEach(s => {
            const key = s.toLowerCase();
            strengthFreq[key] = (strengthFreq[key] || 0) + 1;
        });
    });

    // Unique services (you offer, few/no competitors do)
    const uniqueServices = [...myServices].filter(s => !serviceFreq[s] || serviceFreq[s] <= 1);

    // Unique strengths
    const uniqueStrengths = [...myStrengths].filter(s => !strengthFreq[s]);

    // Over-served services (many competitors, including you)
    const crowdedServices = [...myServices].filter(s => (serviceFreq[s] || 0) >= Math.ceil(competitors.length * 0.5));

    // Positioning suggestions
    const suggestions = [];

    if (uniqueServices.length > 0) {
        suggestions.push({
            type: 'unique_service',
            message: `Lead with your unique services: ${uniqueServices.join(', ')}. Few competitors offer these.`,
            priority: 'high',
        });
    }

    if (crowdedServices.length > 0 && uniqueServices.length > 0) {
        suggestions.push({
            type: 'differentiate_crowded',
            message: `Services like ${crowdedServices.join(', ')} are crowded. Bundle them with your unique offerings to stand out.`,
            priority: 'medium',
        });
    }

    const avgCompetitorPrice = mean(competitors.map(c => c.priceScore).filter(Boolean));
    const myPrice = profile.priceScore || 5;

    if (myPrice > avgCompetitorPrice + 1.5) {
        suggestions.push({
            type: 'premium_positioning',
            message: 'You are positioned above average pricing. Emphasize quality, results, and premium experience to justify rates.',
            priority: 'high',
        });
    } else if (myPrice < avgCompetitorPrice - 1.5) {
        suggestions.push({
            type: 'value_positioning',
            message: 'You are priced below market average. Consider raising rates or marketing as best-value option.',
            priority: 'medium',
        });
    }

    if ((profile.specialistScore || 5) >= 7) {
        suggestions.push({
            type: 'specialist_authority',
            message: 'Leverage your specialist positioning — publish case studies, contribute to industry content, and target niche clients.',
            priority: 'medium',
        });
    }

    return {
        uniqueServices,
        uniqueStrengths,
        crowdedServices,
        suggestions,
        competitorCount: competitors.length,
    };
}

// ─── 4. Service Gap Finder ──────────────────────────────────────────────────

/**
 * Find services competitors are NOT offering that represent opportunities.
 */
function findGaps() {
    const competitors = loadStore('competitors');
    const profile = loadStore('profile');

    // Collect all services across competitors
    const allCompetitorServices = {};
    competitors.forEach(c => {
        (c.services || []).forEach(s => {
            const key = s.toLowerCase();
            allCompetitorServices[key] = (allCompetitorServices[key] || 0) + 1;
        });
    });

    const myServices = new Set((profile.services || []).map(s => s.toLowerCase()));

    // Services you offer that no competitor does
    const exclusiveToYou = [...myServices].filter(s => !allCompetitorServices[s]);

    // Services only 1 competitor offers (low competition)
    const lowCompetition = Object.entries(allCompetitorServices)
        .filter(([, count]) => count === 1)
        .map(([svc]) => svc);

    // Services most competitors offer but you don't
    const threshold = Math.max(2, Math.ceil(competitors.length * 0.4));
    const youAreMissing = Object.entries(allCompetitorServices)
        .filter(([svc, count]) => count >= threshold && !myServices.has(svc))
        .sort((a, b) => b[1] - a[1])
        .map(([svc, count]) => ({ service: svc, competitorsOffering: count }));

    // Services no one offers yet (from known trends)
    const trendData = loadStore('trends');
    const trendServices = trendData
        .filter(t => t.type === 'service')
        .map(t => t.name.toLowerCase());
    const emergingGaps = trendServices.filter(
        ts => !allCompetitorServices[ts] && !myServices.has(ts)
    );

    // Gap opportunities scored
    const opportunities = [];

    exclusiveToYou.forEach(s => {
        opportunities.push({
            service: s,
            type: 'exclusive',
            competitorCoverage: 0,
            opportunity: 'high',
            action: 'Double down — you\'re the only one offering this.',
        });
    });

    lowCompetition.filter(s => !myServices.has(s)).forEach(s => {
        opportunities.push({
            service: s,
            type: 'low_competition',
            competitorCoverage: 1,
            opportunity: 'medium',
            action: 'Consider adding — only one competitor offers this.',
        });
    });

    emergingGaps.forEach(s => {
        opportunities.push({
            service: s,
            type: 'emerging',
            competitorCoverage: 0,
            opportunity: 'high',
            action: 'First-mover advantage — trending service no one offers yet.',
        });
    });

    return {
        exclusiveToYou,
        lowCompetition,
        youAreMissing,
        emergingGaps,
        opportunities,
    };
}

// ─── 5. Pricing Intelligence ────────────────────────────────────────────────

/**
 * Compare your rates against competitor benchmarks.
 */
function compareRates() {
    const competitors = loadStore('competitors');
    const profile = loadStore('profile');

    const myRates = profile.rates || {};
    const rateTypes = ['hourly', 'project_min', 'project_max', 'retainer'];

    const benchmarks = {};

    rateTypes.forEach(type => {
        const competitorRates = competitors
            .map(c => (c.rates || {})[type])
            .filter(r => r != null && r > 0);

        if (competitorRates.length === 0) {
            benchmarks[type] = null;
            return;
        }

        const sorted = [...competitorRates].sort((a, b) => a - b);
        const avg = mean(competitorRates);
        const med = median(competitorRates);
        const myRate = myRates[type];

        let position = 'unknown';
        let recommendation = '';

        if (myRate != null) {
            const percentile = sorted.filter(r => r < myRate).length / sorted.length * 100;

            if (percentile >= 75) {
                position = 'premium';
                recommendation = 'You are in the top tier. Ensure your value proposition justifies premium pricing.';
            } else if (percentile >= 50) {
                position = 'above_average';
                recommendation = 'Slightly above average — good position if quality matches.';
            } else if (percentile >= 25) {
                position = 'below_average';
                recommendation = 'Below average — consider raising rates if your quality/experience supports it.';
            } else {
                position = 'budget';
                recommendation = 'You are priced low. Risk of being perceived as lower quality. Consider strategic rate increase.';
            }
        }

        benchmarks[type] = {
            myRate: myRate || null,
            marketMin: sorted[0],
            marketMax: sorted[sorted.length - 1],
            marketAvg: Math.round(avg * 100) / 100,
            marketMedian: med,
            sampleSize: competitorRates.length,
            position,
            recommendation,
        };
    });

    // Price-to-quality ratio
    const priceQualityRatios = competitors
        .filter(c => c.priceScore && c.qualityScore)
        .map(c => ({
            name: c.name,
            ratio: Math.round((c.qualityScore / c.priceScore) * 100) / 100,
            priceScore: c.priceScore,
            qualityScore: c.qualityScore,
        }))
        .sort((a, b) => b.ratio - a.ratio);

    let myRatio = null;
    if (profile.priceScore && profile.qualityScore) {
        myRatio = Math.round((profile.qualityScore / profile.priceScore) * 100) / 100;
    }

    return {
        benchmarks,
        priceQualityRatios,
        myPriceQualityRatio: myRatio,
        summary: generatePricingSummary(benchmarks, myRatio, priceQualityRatios),
    };
}

function generatePricingSummary(benchmarks, myRatio, ratios) {
    const lines = [];

    Object.entries(benchmarks).forEach(([type, data]) => {
        if (!data) return;
        if (data.myRate != null) {
            lines.push(
                `${type}: $${data.myRate} (market: $${data.marketMin}-$${data.marketMax}, avg $${data.marketAvg}) → ${data.position}`
            );
        }
    });

    if (myRatio != null && ratios.length > 0) {
        const avgRatio = mean(ratios.map(r => r.ratio));
        if (myRatio > avgRatio) {
            lines.push('Your quality-to-price ratio is above market average — good value positioning.');
        } else {
            lines.push('Your quality-to-price ratio is below market average — consider improving perceived quality or adjusting price.');
        }
    }

    return lines.join('\n');
}

// ─── 6. Win/Loss Analysis ───────────────────────────────────────────────────

/**
 * Track a proposal win or loss.
 *
 * @param {Object} data
 * @param {string} data.projectName
 * @param {'won'|'lost'} data.outcome
 * @param {string} [data.competitor]     - Who you won/lost against
 * @param {number} [data.proposedRate]
 * @param {number} [data.competitorRate]
 * @param {string} [data.reason]         - Why you won/lost
 * @param {string[]} [data.services]     - Services involved
 * @param {string} [data.clientType]     - e.g. "startup", "enterprise"
 * @param {string} [data.platform]       - e.g. "upwork", "direct"
 */
function trackWinLoss(data) {
    if (!data || !data.projectName || !data.outcome) {
        throw new Error('projectName and outcome (won/lost) are required');
    }
    if (!['won', 'lost'].includes(data.outcome)) {
        throw new Error('outcome must be "won" or "lost"');
    }

    const records = loadStore('winLoss');

    const record = {
        id: generateId(),
        projectName: data.projectName,
        outcome: data.outcome,
        competitor: data.competitor || null,
        proposedRate: data.proposedRate || null,
        competitorRate: data.competitorRate || null,
        reason: data.reason || '',
        services: data.services || [],
        clientType: data.clientType || '',
        platform: data.platform || '',
        date: data.date || timestamp(),
    };

    records.push(record);
    saveStore('winLoss', records);
    return record;
}

/**
 * Analyze win/loss patterns.
 */
function analyzeWinLoss() {
    const records = loadStore('winLoss');

    if (records.length === 0) {
        return { totalRecords: 0, message: 'No win/loss records yet.' };
    }

    const wins = records.filter(r => r.outcome === 'won');
    const losses = records.filter(r => r.outcome === 'lost');
    const winRate = Math.round((wins.length / records.length) * 100);

    // Win rate by competitor
    const byCompetitor = {};
    records.filter(r => r.competitor).forEach(r => {
        const key = r.competitor.toLowerCase();
        if (!byCompetitor[key]) byCompetitor[key] = { wins: 0, losses: 0 };
        byCompetitor[key][r.outcome === 'won' ? 'wins' : 'losses']++;
    });

    const competitorStats = Object.entries(byCompetitor).map(([name, stats]) => ({
        competitor: name,
        wins: stats.wins,
        losses: stats.losses,
        winRate: Math.round((stats.wins / (stats.wins + stats.losses)) * 100),
    }));

    // Win rate by service
    const byService = {};
    records.forEach(r => {
        (r.services || []).forEach(s => {
            const key = s.toLowerCase();
            if (!byService[key]) byService[key] = { wins: 0, losses: 0 };
            byService[key][r.outcome === 'won' ? 'wins' : 'losses']++;
        });
    });

    const serviceStats = Object.entries(byService).map(([service, stats]) => ({
        service,
        wins: stats.wins,
        losses: stats.losses,
        winRate: Math.round((stats.wins / (stats.wins + stats.losses)) * 100),
    }));

    // Loss reasons
    const lossReasons = {};
    losses.filter(r => r.reason).forEach(r => {
        const key = r.reason.toLowerCase();
        lossReasons[key] = (lossReasons[key] || 0) + 1;
    });

    const topLossReasons = Object.entries(lossReasons)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([reason, count]) => ({ reason, count }));

    // Rate analysis
    const rateWins = wins.filter(r => r.proposedRate);
    const rateLosses = losses.filter(r => r.proposedRate);

    return {
        totalRecords: records.length,
        wins: wins.length,
        losses: losses.length,
        winRate,
        competitorStats,
        serviceStats,
        topLossReasons,
        avgWinningRate: rateWins.length ? Math.round(mean(rateWins.map(r => r.proposedRate))) : null,
        avgLosingRate: rateLosses.length ? Math.round(mean(rateLosses.map(r => r.proposedRate))) : null,
    };
}

// ─── 7. Trend Detection ────────────────────────────────────────────────────

/**
 * Add a market trend observation.
 *
 * @param {Object} data
 * @param {string} data.name          - Skill/service/tool name
 * @param {'skill'|'service'|'tool'|'methodology'} data.type
 * @param {string} [data.description]
 * @param {number} [data.adoptionCount] - How many competitors have adopted
 * @param {'emerging'|'growing'|'mature'|'declining'} [data.stage]
 * @param {string[]} [data.adoptedBy]  - Competitor names
 */
function addTrend(data) {
    if (!data || !data.name || !data.type) {
        throw new Error('Trend name and type are required');
    }

    const trends = loadStore('trends');

    const idx = trends.findIndex(t => t.name.toLowerCase() === data.name.toLowerCase());

    const record = {
        id: idx >= 0 ? trends[idx].id : generateId(),
        name: data.name,
        type: data.type,
        description: data.description || (idx >= 0 ? trends[idx].description : ''),
        adoptionCount: data.adoptionCount ?? (idx >= 0 ? trends[idx].adoptionCount : 0),
        stage: data.stage || (idx >= 0 ? trends[idx].stage : 'emerging'),
        adoptedBy: data.adoptedBy || (idx >= 0 ? trends[idx].adoptedBy : []),
        updatedAt: timestamp(),
        createdAt: idx >= 0 ? trends[idx].createdAt : timestamp(),
    };

    if (idx >= 0) {
        trends[idx] = record;
    } else {
        trends.push(record);
    }

    saveStore('trends', trends);
    return record;
}

/**
 * Detect trends by analyzing competitor data + explicit trend entries.
 */
function detectTrends() {
    const competitors = loadStore('competitors');
    const trends = loadStore('trends');
    const profile = loadStore('profile');

    // Auto-detect trends from competitor services
    const serviceFreq = {};
    competitors.forEach(c => {
        (c.services || []).forEach(s => {
            const key = s.toLowerCase();
            if (!serviceFreq[key]) serviceFreq[key] = { count: 0, names: [] };
            serviceFreq[key].count++;
            serviceFreq[key].names.push(c.name);
        });
    });

    // Services adopted by multiple competitors = potential trends
    const autoDetected = Object.entries(serviceFreq)
        .filter(([, data]) => data.count >= 2)
        .sort((a, b) => b[1].count - a[1].count)
        .map(([service, data]) => ({
            name: service,
            type: 'service',
            adoptionCount: data.count,
            adoptedBy: data.names,
            stage: data.count >= Math.ceil(competitors.length * 0.6) ? 'mature' : 'growing',
            autoDetected: true,
        }));

    const myServices = new Set((profile.services || []).map(s => s.toLowerCase()));

    // Categorize: trends you're on vs. behind on
    const youHave = [];
    const youNeed = [];

    [...autoDetected, ...trends].forEach(t => {
        const target = myServices.has(t.name.toLowerCase()) ? youHave : youNeed;
        // Avoid duplicates
        if (!target.find(x => x.name.toLowerCase() === t.name.toLowerCase())) {
            target.push(t);
        }
    });

    // Urgency scoring
    const urgent = youNeed
        .filter(t => (t.adoptionCount || 0) >= 2 || t.stage === 'growing')
        .sort((a, b) => (b.adoptionCount || 0) - (a.adoptionCount || 0));

    return {
        allTrends: [...autoDetected, ...trends.filter(t => !autoDetected.find(a => a.name.toLowerCase() === t.name.toLowerCase()))],
        youHave,
        youNeed,
        urgent,
        recommendation: urgent.length > 0
            ? `Consider adopting: ${urgent.slice(0, 3).map(t => t.name).join(', ')}`
            : 'You are up to date with market trends.',
    };
}

// ─── 8. SWOT Generator ─────────────────────────────────────────────────────

/**
 * Generate a SWOT analysis based on your profile vs competitor data.
 */
function generateSWOT() {
    const competitors = loadStore('competitors');
    const profile = loadStore('profile');
    const winLossData = analyzeWinLoss();
    const gapData = findGaps();
    const trendData = detectTrends();
    const diffData = analyzeDifferentiation();
    const rateData = compareRates();

    const strengths = [];
    const weaknesses = [];
    const opportunities = [];
    const threats = [];

    // ── Strengths ──
    if (profile.strengths) {
        strengths.push(...profile.strengths.map(s => `Core strength: ${s}`));
    }

    if (diffData.uniqueServices && diffData.uniqueServices.length > 0) {
        strengths.push(`Unique services: ${diffData.uniqueServices.join(', ')}`);
    }

    if (diffData.uniqueStrengths && diffData.uniqueStrengths.length > 0) {
        strengths.push(`Unique strengths vs competitors: ${diffData.uniqueStrengths.join(', ')}`);
    }

    if (winLossData.winRate > 60) {
        strengths.push(`Strong win rate: ${winLossData.winRate}%`);
    }

    if (rateData.myPriceQualityRatio && rateData.priceQualityRatios.length > 0) {
        const avgRatio = mean(rateData.priceQualityRatios.map(r => r.ratio));
        if (rateData.myPriceQualityRatio > avgRatio) {
            strengths.push('Better quality-to-price ratio than market average');
        }
    }

    if ((profile.specialistScore || 5) >= 7) {
        strengths.push('Deep specialist positioning — niche authority');
    }

    // ── Weaknesses ──
    if (profile.weaknesses) {
        weaknesses.push(...profile.weaknesses.map(w => `Known weakness: ${w}`));
    }

    if (gapData.youAreMissing && gapData.youAreMissing.length > 0) {
        weaknesses.push(
            `Missing popular services: ${gapData.youAreMissing.slice(0, 3).map(s => s.service).join(', ')}`
        );
    }

    if (winLossData.winRate > 0 && winLossData.winRate < 40) {
        weaknesses.push(`Low win rate: ${winLossData.winRate}%`);
    }

    if (winLossData.topLossReasons && winLossData.topLossReasons.length > 0) {
        weaknesses.push(`Top loss reason: ${winLossData.topLossReasons[0].reason}`);
    }

    if (diffData.crowdedServices && diffData.crowdedServices.length > 0 && (!diffData.uniqueServices || diffData.uniqueServices.length === 0)) {
        weaknesses.push('All your services are in crowded markets — hard to differentiate');
    }

    // ── Opportunities ──
    if (gapData.opportunities) {
        gapData.opportunities.filter(o => o.opportunity === 'high').forEach(o => {
            opportunities.push(`${o.type}: ${o.service} — ${o.action}`);
        });
    }

    if (trendData.urgent && trendData.urgent.length > 0) {
        opportunities.push(
            `Emerging trends to adopt: ${trendData.urgent.slice(0, 3).map(t => t.name).join(', ')}`
        );
    }

    const weakCompetitors = competitors.filter(c => (c.qualityScore || 5) < 4);
    if (weakCompetitors.length > 0) {
        opportunities.push(
            `Weak competitors to outperform: ${weakCompetitors.map(c => c.name).join(', ')}`
        );
    }

    if (rateData.benchmarks.hourly && rateData.benchmarks.hourly.position === 'below_average') {
        opportunities.push('Room to increase rates — currently below market average');
    }

    // ── Threats ──
    const strongCompetitors = competitors.filter(c => (c.qualityScore || 5) >= 8 && (c.priceScore || 5) <= 6);
    if (strongCompetitors.length > 0) {
        threats.push(
            `High-quality, competitive-priced rivals: ${strongCompetitors.map(c => c.name).join(', ')}`
        );
    }

    if (diffData.crowdedServices && diffData.crowdedServices.length >= 3) {
        threats.push('Market saturation in your core services');
    }

    if (trendData.youNeed && trendData.youNeed.length >= 3) {
        threats.push('Falling behind on multiple market trends');
    }

    if (winLossData.competitorStats) {
        const dominantCompetitors = winLossData.competitorStats.filter(c => c.winRate < 30 && (c.wins + c.losses) >= 3);
        dominantCompetitors.forEach(c => {
            threats.push(`Losing consistently to ${c.competitor} (${c.winRate}% win rate)`);
        });
    }

    // Ensure at least something in each quadrant
    if (strengths.length === 0) strengths.push('Add profile data and competitors to generate insights');
    if (weaknesses.length === 0) weaknesses.push('No weaknesses detected — add more data for accuracy');
    if (opportunities.length === 0) opportunities.push('Add trends and competitor data to discover opportunities');
    if (threats.length === 0) threats.push('No major threats detected — continue monitoring');

    return {
        strengths,
        weaknesses,
        opportunities,
        threats,
        generatedAt: timestamp(),
        dataQuality: {
            competitorCount: competitors.length,
            winLossRecords: winLossData.totalRecords,
            trendCount: trendData.allTrends.length,
            hasProfile: !!profile.name,
        },
    };
}

// ─── CLI Handler ────────────────────────────────────────────────────────────

function handleCLI(args) {
    const subcommand = args[0];
    const rest = args.slice(1);

    switch (subcommand) {
        case 'add': {
            const name = rest.join(' ') || null;
            if (!name) return { error: 'Usage: cortex compete add <competitor name>' };
            const record = addCompetitor({ name });
            return { message: `Added competitor: ${record.name}`, record };
        }

        case 'remove': {
            const name = rest.join(' ');
            if (!name) return { error: 'Usage: cortex compete remove <name>' };
            const removed = removeCompetitor(name);
            return { message: `Removed competitor: ${removed.name}` };
        }

        case 'list':
            return { competitors: listCompetitors() };

        case 'profile': {
            if (rest.length === 0) return { profile: getMyProfile() };
            // cortex compete profile set <json>
            if (rest[0] === 'set' && rest[1]) {
                try {
                    const data = JSON.parse(rest.slice(1).join(' '));
                    return { profile: setMyProfile(data) };
                } catch {
                    return { error: 'Invalid JSON for profile' };
                }
            }
            return { profile: getMyProfile() };
        }

        case 'analyze':
        case 'position':
            return analyzePosition();

        case 'differentiate':
            return analyzeDifferentiation();

        case 'gaps':
            return findGaps();

        case 'rates':
            return compareRates();

        case 'swot':
            return generateSWOT();

        case 'win':
        case 'loss': {
            const projectName = rest.join(' ');
            if (!projectName) return { error: `Usage: cortex compete ${subcommand} <project name>` };
            return trackWinLoss({ projectName, outcome: subcommand === 'win' ? 'won' : 'lost' });
        }

        case 'winloss':
            return analyzeWinLoss();

        case 'trends':
            return detectTrends();

        case 'help':
        default:
            return {
                commands: {
                    'add <name>': 'Add a competitor',
                    'remove <name>': 'Remove a competitor',
                    'list': 'List all competitors',
                    'profile': 'Show your profile',
                    'profile set <json>': 'Set your profile',
                    'analyze': 'Market position map',
                    'differentiate': 'Differentiation analysis',
                    'gaps': 'Find service gaps',
                    'rates': 'Pricing intelligence',
                    'swot': 'Generate SWOT analysis',
                    'win <project>': 'Record a proposal win',
                    'loss <project>': 'Record a proposal loss',
                    'winloss': 'Analyze win/loss patterns',
                    'trends': 'Detect market trends',
                },
            };
    }
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
    // Competitor management
    addCompetitor,
    removeCompetitor,
    listCompetitors,

    // Profile
    setMyProfile,
    getMyProfile,

    // Analysis
    analyzePosition,
    analyzeDifferentiation,
    findGaps,
    compareRates,
    generateSWOT,

    // Win/Loss
    trackWinLoss,
    analyzeWinLoss,

    // Trends
    addTrend,
    detectTrends,

    // CLI
    handleCLI,

    // For testing
    _internals: {
        getDataDir,
        setDataDir,
        loadStore,
        saveStore,
        ensureDataDir,
        mean,
        median,
    },
};

// ─── CLI Entry Point ────────────────────────────────────────────────────────

if (require.main === module) {
    const args = process.argv.slice(2);
    const result = handleCLI(args);
    console.log(JSON.stringify(result, null, 2));
}
