/**
 * Comprehensive tests for Competitive Analysis & Market Positioning Tool
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Use a temp directory for test data so we don't pollute real data
const TEST_DATA_DIR = path.join(os.tmpdir(), `cortex-compete-test-${Date.now()}`);

let mod;

beforeAll(() => {
    mod = require('../src/tools/competitive-analysis');
    mod._internals.setDataDir(TEST_DATA_DIR);
});

afterAll(() => {
    // Clean up test data
    if (fs.existsSync(TEST_DATA_DIR)) {
        fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    }
});

beforeEach(() => {
    // Clear data between tests
    if (fs.existsSync(TEST_DATA_DIR)) {
        fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
});

// ─── Competitor Management ──────────────────────────────────────────────────

describe('addCompetitor', () => {
    test('adds a basic competitor', () => {
        const result = mod.addCompetitor({ name: 'Alice Design' });
        expect(result.name).toBe('Alice Design');
        expect(result.id).toBeTruthy();
        expect(result.createdAt).toBeTruthy();
    });

    test('throws on missing name', () => {
        expect(() => mod.addCompetitor({})).toThrow('name is required');
        expect(() => mod.addCompetitor(null)).toThrow();
    });

    test('adds competitor with full data', () => {
        const data = {
            name: 'Bob Freelance',
            services: ['web design', 'branding'],
            rates: { hourly: 120, project_min: 2000, project_max: 15000 },
            positioning: 'premium specialist',
            strengths: ['fast delivery', 'great portfolio'],
            weaknesses: ['limited availability'],
            website: 'https://bob.dev',
            platforms: ['upwork', 'toptal'],
            qualityScore: 8,
            priceScore: 7,
            specialistScore: 9,
            notes: 'Strong competitor in web space',
        };
        const result = mod.addCompetitor(data);
        expect(result.services).toEqual(['web design', 'branding']);
        expect(result.rates.hourly).toBe(120);
        expect(result.qualityScore).toBe(8);
        expect(result.specialistScore).toBe(9);
    });

    test('upserts by name (case-insensitive)', () => {
        mod.addCompetitor({ name: 'Alice', services: ['design'] });
        const updated = mod.addCompetitor({ name: 'alice', services: ['design', 'dev'] });
        expect(updated.services).toEqual(['design', 'dev']);
        expect(mod.listCompetitors().length).toBe(1);
    });

    test('clamps scores to 1-10', () => {
        const result = mod.addCompetitor({ name: 'Extreme', qualityScore: 15, priceScore: -2 });
        expect(result.qualityScore).toBe(10);
        expect(result.priceScore).toBe(1);
    });
});

describe('removeCompetitor', () => {
    test('removes by name', () => {
        mod.addCompetitor({ name: 'ToRemove' });
        const removed = mod.removeCompetitor('ToRemove');
        expect(removed.name).toBe('ToRemove');
        expect(mod.listCompetitors().length).toBe(0);
    });

    test('removes by id', () => {
        const added = mod.addCompetitor({ name: 'ById' });
        mod.removeCompetitor(added.id);
        expect(mod.listCompetitors().length).toBe(0);
    });

    test('throws on not found', () => {
        expect(() => mod.removeCompetitor('NonExistent')).toThrow('not found');
    });
});

describe('listCompetitors', () => {
    test('returns empty array initially', () => {
        expect(mod.listCompetitors()).toEqual([]);
    });

    test('filters by service', () => {
        mod.addCompetitor({ name: 'A', services: ['web design', 'seo'] });
        mod.addCompetitor({ name: 'B', services: ['mobile dev'] });
        const filtered = mod.listCompetitors({ service: 'web' });
        expect(filtered.length).toBe(1);
        expect(filtered[0].name).toBe('A');
    });

    test('filters by platform', () => {
        mod.addCompetitor({ name: 'A', platforms: ['upwork'] });
        mod.addCompetitor({ name: 'B', platforms: ['fiverr'] });
        expect(mod.listCompetitors({ platform: 'upwork' }).length).toBe(1);
    });
});

// ─── Profile ────────────────────────────────────────────────────────────────

describe('Profile management', () => {
    test('setMyProfile saves and returns profile', () => {
        const profile = mod.setMyProfile({
            name: 'Me',
            services: ['consulting', 'dev'],
            rates: { hourly: 150 },
            qualityScore: 8,
            priceScore: 7,
            specialistScore: 6,
        });
        expect(profile.name).toBe('Me');
        expect(profile.rates.hourly).toBe(150);
    });

    test('setMyProfile throws without name', () => {
        expect(() => mod.setMyProfile({})).toThrow('name is required');
    });

    test('getMyProfile returns saved data', () => {
        mod.setMyProfile({ name: 'Tester' });
        const profile = mod.getMyProfile();
        expect(profile.name).toBe('Tester');
    });

    test('getMyProfile returns empty object when none set', () => {
        const profile = mod.getMyProfile();
        expect(profile).toEqual({});
    });
});

// ─── Market Position Map ────────────────────────────────────────────────────

describe('analyzePosition', () => {
    test('generates map with competitors', () => {
        mod.addCompetitor({ name: 'Cheap Joe', priceScore: 2, qualityScore: 3 });
        mod.addCompetitor({ name: 'Premium Pat', priceScore: 9, qualityScore: 9 });
        mod.setMyProfile({ name: 'Me', priceScore: 6, qualityScore: 7 });

        const result = mod.analyzePosition();
        expect(result.map).toBeTruthy();
        expect(result.map).toContain('★'); // Your position
        expect(result.map).toContain('A'); // First competitor
        expect(result.map).toContain('B'); // Second competitor
        expect(result.legend.length).toBe(3);
    });

    test('generates quadrant analysis', () => {
        mod.addCompetitor({ name: 'High-High', priceScore: 8, qualityScore: 8 });
        mod.addCompetitor({ name: 'Low-Low', priceScore: 3, qualityScore: 3 });

        const result = mod.analyzePosition();
        expect(result.quadrants).toBeTruthy();
        expect(result.quadrants.premiumHigh).toContain('High-High');
        expect(result.quadrants.budgetLow).toContain('Low-Low');
    });

    test('supports custom axes', () => {
        mod.addCompetitor({ name: 'Spec', specialistScore: 9, priceScore: 5 });
        const result = mod.analyzePosition({ xAxis: 'specialistScore', yAxis: 'priceScore' });
        expect(result.map).toBeTruthy();
        expect(result.legend[0].specialistScore).toBe(9);
    });

    test('works with no profile set', () => {
        mod.addCompetitor({ name: 'Solo', priceScore: 5, qualityScore: 5 });
        const result = mod.analyzePosition();
        expect(result.map).toBeTruthy();
        expect(result.map).not.toContain('★');
    });
});

// ─── Differentiation Analysis ───────────────────────────────────────────────

describe('analyzeDifferentiation', () => {
    test('returns error without profile', () => {
        const result = mod.analyzeDifferentiation();
        expect(result.error).toBeTruthy();
    });

    test('identifies unique services', () => {
        mod.setMyProfile({ name: 'Me', services: ['AI consulting', 'web dev', 'seo'] });
        mod.addCompetitor({ name: 'A', services: ['web dev', 'seo'] });
        mod.addCompetitor({ name: 'B', services: ['web dev', 'branding'] });

        const result = mod.analyzeDifferentiation();
        expect(result.uniqueServices).toContain('ai consulting');
        expect(result.competitorCount).toBe(2);
    });

    test('identifies crowded services', () => {
        mod.setMyProfile({ name: 'Me', services: ['web dev'] });
        mod.addCompetitor({ name: 'A', services: ['web dev'] });
        mod.addCompetitor({ name: 'B', services: ['web dev'] });

        const result = mod.analyzeDifferentiation();
        expect(result.crowdedServices).toContain('web dev');
    });

    test('identifies unique strengths', () => {
        mod.setMyProfile({ name: 'Me', strengths: ['AI expertise', 'fast turnaround'] });
        mod.addCompetitor({ name: 'A', strengths: ['fast turnaround'] });

        const result = mod.analyzeDifferentiation();
        expect(result.uniqueStrengths).toContain('ai expertise');
    });

    test('generates positioning suggestions', () => {
        mod.setMyProfile({ name: 'Me', services: ['unique thing'], priceScore: 9 });
        mod.addCompetitor({ name: 'A', services: ['common'], priceScore: 4 });
        mod.addCompetitor({ name: 'B', services: ['common'], priceScore: 5 });

        const result = mod.analyzeDifferentiation();
        expect(result.suggestions.length).toBeGreaterThan(0);
        const types = result.suggestions.map(s => s.type);
        expect(types).toContain('premium_positioning');
    });
});

// ─── Service Gap Finder ─────────────────────────────────────────────────────

describe('findGaps', () => {
    test('finds exclusive services', () => {
        mod.setMyProfile({ name: 'Me', services: ['AI consulting', 'web dev'] });
        mod.addCompetitor({ name: 'A', services: ['web dev', 'seo'] });
        mod.addCompetitor({ name: 'B', services: ['web dev', 'mobile'] });

        const result = mod.findGaps();
        expect(result.exclusiveToYou).toContain('ai consulting');
    });

    test('finds low-competition services', () => {
        mod.setMyProfile({ name: 'Me', services: ['web dev'] });
        mod.addCompetitor({ name: 'A', services: ['web dev', 'blockchain'] });
        mod.addCompetitor({ name: 'B', services: ['web dev', 'seo'] });

        const result = mod.findGaps();
        expect(result.lowCompetition).toContain('blockchain');
        expect(result.lowCompetition).toContain('seo');
    });

    test('finds services you are missing', () => {
        mod.setMyProfile({ name: 'Me', services: ['consulting'] });
        mod.addCompetitor({ name: 'A', services: ['web dev', 'seo'] });
        mod.addCompetitor({ name: 'B', services: ['web dev', 'seo'] });
        mod.addCompetitor({ name: 'C', services: ['web dev'] });

        const result = mod.findGaps();
        const missingNames = result.youAreMissing.map(m => m.service);
        expect(missingNames).toContain('web dev');
    });

    test('identifies emerging gap opportunities', () => {
        mod.setMyProfile({ name: 'Me', services: ['web dev'] });
        mod.addTrend({ name: 'AI agents', type: 'service', stage: 'emerging' });

        const result = mod.findGaps();
        expect(result.emergingGaps).toContain('ai agents');
    });

    test('generates scored opportunities', () => {
        mod.setMyProfile({ name: 'Me', services: ['unique-svc'] });
        mod.addCompetitor({ name: 'A', services: ['other'] });

        const result = mod.findGaps();
        expect(result.opportunities.length).toBeGreaterThan(0);
        expect(result.opportunities[0].type).toBe('exclusive');
    });
});

// ─── Pricing Intelligence ───────────────────────────────────────────────────

describe('compareRates', () => {
    test('compares hourly rates', () => {
        mod.setMyProfile({ name: 'Me', rates: { hourly: 150 } });
        mod.addCompetitor({ name: 'A', rates: { hourly: 100 } });
        mod.addCompetitor({ name: 'B', rates: { hourly: 120 } });
        mod.addCompetitor({ name: 'C', rates: { hourly: 200 } });

        const result = mod.compareRates();
        expect(result.benchmarks.hourly).toBeTruthy();
        expect(result.benchmarks.hourly.myRate).toBe(150);
        expect(result.benchmarks.hourly.marketMin).toBe(100);
        expect(result.benchmarks.hourly.marketMax).toBe(200);
        expect(result.benchmarks.hourly.position).toBeTruthy();
    });

    test('handles missing rate types', () => {
        mod.setMyProfile({ name: 'Me', rates: { hourly: 100 } });
        mod.addCompetitor({ name: 'A', rates: { hourly: 80 } });

        const result = mod.compareRates();
        expect(result.benchmarks.retainer).toBeNull();
    });

    test('calculates price-quality ratios', () => {
        mod.setMyProfile({ name: 'Me', priceScore: 5, qualityScore: 8 });
        mod.addCompetitor({ name: 'A', priceScore: 7, qualityScore: 6 });
        mod.addCompetitor({ name: 'B', priceScore: 3, qualityScore: 4 });

        const result = mod.compareRates();
        expect(result.myPriceQualityRatio).toBe(1.6);
        expect(result.priceQualityRatios.length).toBe(2);
    });

    test('generates summary', () => {
        mod.setMyProfile({ name: 'Me', rates: { hourly: 150 }, priceScore: 6, qualityScore: 8 });
        mod.addCompetitor({ name: 'A', rates: { hourly: 100 }, priceScore: 4, qualityScore: 5 });

        const result = mod.compareRates();
        expect(result.summary).toBeTruthy();
        expect(typeof result.summary).toBe('string');
    });
});

// ─── Win/Loss Analysis ──────────────────────────────────────────────────────

describe('trackWinLoss', () => {
    test('records a win', () => {
        const result = mod.trackWinLoss({
            projectName: 'Website Redesign',
            outcome: 'won',
            competitor: 'Alice',
            proposedRate: 5000,
        });
        expect(result.outcome).toBe('won');
        expect(result.id).toBeTruthy();
    });

    test('records a loss', () => {
        const result = mod.trackWinLoss({
            projectName: 'App Build',
            outcome: 'lost',
            reason: 'price too high',
        });
        expect(result.outcome).toBe('lost');
        expect(result.reason).toBe('price too high');
    });

    test('throws on missing fields', () => {
        expect(() => mod.trackWinLoss({})).toThrow('projectName and outcome');
        expect(() => mod.trackWinLoss({ projectName: 'X', outcome: 'maybe' })).toThrow('won" or "lost"');
    });
});

describe('analyzeWinLoss', () => {
    test('returns empty message when no records', () => {
        const result = mod.analyzeWinLoss();
        expect(result.totalRecords).toBe(0);
        expect(result.message).toBeTruthy();
    });

    test('calculates win rate', () => {
        mod.trackWinLoss({ projectName: 'P1', outcome: 'won' });
        mod.trackWinLoss({ projectName: 'P2', outcome: 'won' });
        mod.trackWinLoss({ projectName: 'P3', outcome: 'lost' });

        const result = mod.analyzeWinLoss();
        expect(result.winRate).toBe(67);
        expect(result.wins).toBe(2);
        expect(result.losses).toBe(1);
    });

    test('tracks per-competitor stats', () => {
        mod.trackWinLoss({ projectName: 'P1', outcome: 'won', competitor: 'Alice' });
        mod.trackWinLoss({ projectName: 'P2', outcome: 'lost', competitor: 'Alice' });
        mod.trackWinLoss({ projectName: 'P3', outcome: 'lost', competitor: 'Bob' });

        const result = mod.analyzeWinLoss();
        const aliceStats = result.competitorStats.find(c => c.competitor === 'alice');
        expect(aliceStats.wins).toBe(1);
        expect(aliceStats.losses).toBe(1);
        expect(aliceStats.winRate).toBe(50);
    });

    test('tracks per-service stats', () => {
        mod.trackWinLoss({ projectName: 'P1', outcome: 'won', services: ['web dev'] });
        mod.trackWinLoss({ projectName: 'P2', outcome: 'lost', services: ['web dev'] });
        mod.trackWinLoss({ projectName: 'P3', outcome: 'won', services: ['consulting'] });

        const result = mod.analyzeWinLoss();
        const webStats = result.serviceStats.find(s => s.service === 'web dev');
        expect(webStats.winRate).toBe(50);
    });

    test('identifies top loss reasons', () => {
        mod.trackWinLoss({ projectName: 'P1', outcome: 'lost', reason: 'price too high' });
        mod.trackWinLoss({ projectName: 'P2', outcome: 'lost', reason: 'price too high' });
        mod.trackWinLoss({ projectName: 'P3', outcome: 'lost', reason: 'slow response' });

        const result = mod.analyzeWinLoss();
        expect(result.topLossReasons[0].reason).toBe('price too high');
        expect(result.topLossReasons[0].count).toBe(2);
    });

    test('computes average winning/losing rates', () => {
        mod.trackWinLoss({ projectName: 'P1', outcome: 'won', proposedRate: 5000 });
        mod.trackWinLoss({ projectName: 'P2', outcome: 'won', proposedRate: 7000 });
        mod.trackWinLoss({ projectName: 'P3', outcome: 'lost', proposedRate: 10000 });

        const result = mod.analyzeWinLoss();
        expect(result.avgWinningRate).toBe(6000);
        expect(result.avgLosingRate).toBe(10000);
    });
});

// ─── Trend Detection ────────────────────────────────────────────────────────

describe('addTrend', () => {
    test('adds a trend', () => {
        const result = mod.addTrend({ name: 'AI Agents', type: 'service', stage: 'emerging' });
        expect(result.name).toBe('AI Agents');
        expect(result.stage).toBe('emerging');
    });

    test('throws on missing fields', () => {
        expect(() => mod.addTrend({})).toThrow('name and type');
    });

    test('upserts by name', () => {
        mod.addTrend({ name: 'AI', type: 'skill' });
        mod.addTrend({ name: 'ai', type: 'skill', stage: 'growing' });
        // Should only have 1 trend
        const trends = mod.detectTrends();
        const aiTrends = trends.allTrends.filter(t => t.name.toLowerCase() === 'ai');
        expect(aiTrends.length).toBe(1);
    });
});

describe('detectTrends', () => {
    test('auto-detects trends from competitor services', () => {
        mod.addCompetitor({ name: 'A', services: ['AI automation', 'web dev'] });
        mod.addCompetitor({ name: 'B', services: ['AI automation', 'mobile'] });
        mod.addCompetitor({ name: 'C', services: ['web dev'] });

        const result = mod.detectTrends();
        const aiTrend = result.allTrends.find(t => t.name === 'ai automation');
        expect(aiTrend).toBeTruthy();
        expect(aiTrend.adoptionCount).toBe(2);
    });

    test('identifies trends you need', () => {
        mod.setMyProfile({ name: 'Me', services: ['web dev'] });
        mod.addCompetitor({ name: 'A', services: ['AI tools', 'web dev'] });
        mod.addCompetitor({ name: 'B', services: ['AI tools'] });

        const result = mod.detectTrends();
        const needNames = result.youNeed.map(t => t.name);
        expect(needNames).toContain('ai tools');
    });

    test('identifies trends you already have', () => {
        mod.setMyProfile({ name: 'Me', services: ['web dev'] });
        mod.addCompetitor({ name: 'A', services: ['web dev'] });
        mod.addCompetitor({ name: 'B', services: ['web dev'] });

        const result = mod.detectTrends();
        const haveNames = result.youHave.map(t => t.name);
        expect(haveNames).toContain('web dev');
    });

    test('generates recommendation', () => {
        mod.setMyProfile({ name: 'Me', services: [] });
        mod.addCompetitor({ name: 'A', services: ['new thing'] });
        mod.addCompetitor({ name: 'B', services: ['new thing'] });

        const result = mod.detectTrends();
        expect(result.recommendation).toBeTruthy();
    });
});

// ─── SWOT Generator ─────────────────────────────────────────────────────────

describe('generateSWOT', () => {
    test('generates SWOT with minimal data', () => {
        const result = mod.generateSWOT();
        expect(result.strengths).toBeTruthy();
        expect(result.weaknesses).toBeTruthy();
        expect(result.opportunities).toBeTruthy();
        expect(result.threats).toBeTruthy();
        expect(result.generatedAt).toBeTruthy();
    });

    test('generates rich SWOT with full data', () => {
        mod.setMyProfile({
            name: 'Me',
            services: ['AI consulting', 'web dev', 'data viz'],
            strengths: ['deep ML expertise', 'fast delivery'],
            weaknesses: ['limited design skills'],
            rates: { hourly: 150 },
            qualityScore: 8,
            priceScore: 7,
            specialistScore: 8,
        });

        mod.addCompetitor({
            name: 'Alice',
            services: ['web dev', 'seo'],
            rates: { hourly: 100 },
            qualityScore: 6,
            priceScore: 4,
        });

        mod.addCompetitor({
            name: 'Bob',
            services: ['web dev', 'mobile'],
            rates: { hourly: 180 },
            qualityScore: 9,
            priceScore: 5,
            strengths: ['enterprise experience'],
        });

        mod.trackWinLoss({ projectName: 'P1', outcome: 'won', competitor: 'Alice' });
        mod.trackWinLoss({ projectName: 'P2', outcome: 'won' });
        mod.trackWinLoss({ projectName: 'P3', outcome: 'lost', reason: 'too expensive' });

        mod.addTrend({ name: 'LLM integration', type: 'service', stage: 'growing' });

        const result = mod.generateSWOT();
        expect(result.strengths.length).toBeGreaterThan(1);
        expect(result.dataQuality.competitorCount).toBe(2);
        expect(result.dataQuality.winLossRecords).toBe(3);
        expect(result.dataQuality.hasProfile).toBe(true);
    });

    test('includes data quality metrics', () => {
        const result = mod.generateSWOT();
        expect(result.dataQuality).toBeTruthy();
        expect(typeof result.dataQuality.competitorCount).toBe('number');
    });
});

// ─── CLI Handler ────────────────────────────────────────────────────────────

describe('handleCLI', () => {
    test('help command returns command list', () => {
        const result = mod.handleCLI(['help']);
        expect(result.commands).toBeTruthy();
        expect(result.commands['add <name>']).toBeTruthy();
    });

    test('add command creates competitor', () => {
        const result = mod.handleCLI(['add', 'New', 'Competitor']);
        expect(result.message).toContain('New Competitor');
    });

    test('add without name returns error', () => {
        const result = mod.handleCLI(['add']);
        expect(result.error).toBeTruthy();
    });

    test('list command returns competitors', () => {
        mod.addCompetitor({ name: 'Listed' });
        const result = mod.handleCLI(['list']);
        expect(result.competitors.length).toBe(1);
    });

    test('remove command removes competitor', () => {
        mod.addCompetitor({ name: 'Gone' });
        const result = mod.handleCLI(['remove', 'Gone']);
        expect(result.message).toContain('Gone');
    });

    test('analyze command returns position map', () => {
        mod.addCompetitor({ name: 'A', priceScore: 5, qualityScore: 5 });
        const result = mod.handleCLI(['analyze']);
        expect(result.map).toBeTruthy();
    });

    test('swot command generates analysis', () => {
        const result = mod.handleCLI(['swot']);
        expect(result.strengths).toBeTruthy();
    });

    test('gaps command finds service gaps', () => {
        mod.setMyProfile({ name: 'Me', services: ['web dev'] });
        const result = mod.handleCLI(['gaps']);
        expect(result).toBeTruthy();
    });

    test('rates command returns benchmarks', () => {
        mod.setMyProfile({ name: 'Me', rates: { hourly: 100 } });
        mod.addCompetitor({ name: 'A', rates: { hourly: 80 } });
        const result = mod.handleCLI(['rates']);
        expect(result.benchmarks).toBeTruthy();
    });

    test('win command records win', () => {
        const result = mod.handleCLI(['win', 'Big', 'Project']);
        expect(result.outcome).toBe('won');
        expect(result.projectName).toBe('Big Project');
    });

    test('loss command records loss', () => {
        const result = mod.handleCLI(['loss', 'Missed', 'Deal']);
        expect(result.outcome).toBe('lost');
    });

    test('winloss command returns analysis', () => {
        mod.trackWinLoss({ projectName: 'P1', outcome: 'won' });
        const result = mod.handleCLI(['winloss']);
        expect(result.totalRecords).toBe(1);
    });

    test('trends command returns trend data', () => {
        const result = mod.handleCLI(['trends']);
        expect(result.allTrends).toBeTruthy();
    });

    test('profile command shows profile', () => {
        mod.setMyProfile({ name: 'Test' });
        const result = mod.handleCLI(['profile']);
        expect(result.profile.name).toBe('Test');
    });

    test('profile set command updates profile', () => {
        const result = mod.handleCLI(['profile', 'set', '{"name":"CLI User","services":["dev"]}']);
        expect(result.profile.name).toBe('CLI User');
    });

    test('default command shows help', () => {
        const result = mod.handleCLI([]);
        expect(result.commands).toBeTruthy();
    });
});

// ─── Integration / Edge Cases ───────────────────────────────────────────────

describe('Integration tests', () => {
    test('full workflow: profile → competitors → analysis', () => {
        // Set up profile
        mod.setMyProfile({
            name: 'Freelancer Pro',
            services: ['web dev', 'AI consulting', 'devops'],
            rates: { hourly: 150, project_min: 3000 },
            strengths: ['AI expertise', 'fast shipping'],
            qualityScore: 8,
            priceScore: 7,
            specialistScore: 7,
        });

        // Add competitors
        mod.addCompetitor({
            name: 'Budget Bill',
            services: ['web dev', 'wordpress'],
            rates: { hourly: 50 },
            qualityScore: 4,
            priceScore: 2,
            specialistScore: 3,
        });

        mod.addCompetitor({
            name: 'Premium Pat',
            services: ['web dev', 'AI consulting', 'strategy'],
            rates: { hourly: 300 },
            qualityScore: 9,
            priceScore: 9,
            specialistScore: 8,
        });

        mod.addCompetitor({
            name: 'Average Andy',
            services: ['web dev', 'mobile', 'seo'],
            rates: { hourly: 120 },
            qualityScore: 6,
            priceScore: 5,
            specialistScore: 5,
        });

        // Track some wins/losses
        mod.trackWinLoss({ projectName: 'AI Dashboard', outcome: 'won', competitor: 'Average Andy', services: ['AI consulting'] });
        mod.trackWinLoss({ projectName: 'Enterprise Site', outcome: 'lost', competitor: 'Premium Pat', reason: 'less experience' });
        mod.trackWinLoss({ projectName: 'Startup MVP', outcome: 'won', services: ['web dev'] });

        // Add trend
        mod.addTrend({ name: 'LLM integration', type: 'service', stage: 'growing', adoptedBy: ['Premium Pat'] });

        // Run all analyses
        const position = mod.analyzePosition();
        expect(position.map).toContain('★');
        expect(position.legend.length).toBe(4); // 3 competitors + me

        const diff = mod.analyzeDifferentiation();
        expect(diff.uniqueServices).toContain('devops');
        expect(diff.competitorCount).toBe(3);

        const gaps = mod.findGaps();
        expect(gaps.exclusiveToYou).toContain('devops');

        const rates = mod.compareRates();
        expect(rates.benchmarks.hourly.myRate).toBe(150);
        expect(rates.benchmarks.hourly.marketAvg).toBeTruthy();

        const winloss = mod.analyzeWinLoss();
        expect(winloss.winRate).toBe(67);

        const trends = mod.detectTrends();
        expect(trends.allTrends.length).toBeGreaterThan(0);

        const swot = mod.generateSWOT();
        expect(swot.strengths.length).toBeGreaterThan(0);
        expect(swot.dataQuality.competitorCount).toBe(3);
    });

    test('handles corrupted JSON gracefully', () => {
        // Write bad JSON
        fs.writeFileSync(path.join(TEST_DATA_DIR, 'competitors.json'), '{bad json', 'utf-8');
        const result = mod.listCompetitors();
        expect(result).toEqual([]);
    });

    test('concurrent add operations maintain data integrity', () => {
        for (let i = 0; i < 10; i++) {
            mod.addCompetitor({ name: `Competitor ${i}`, services: [`service_${i}`] });
        }
        expect(mod.listCompetitors().length).toBe(10);
    });
});

// ─── Utility Functions ──────────────────────────────────────────────────────

describe('Utility functions', () => {
    test('mean calculates correctly', () => {
        expect(mod._internals.mean([1, 2, 3, 4, 5])).toBe(3);
        expect(mod._internals.mean([])).toBe(0);
    });

    test('median calculates correctly', () => {
        expect(mod._internals.median([1, 2, 3, 4, 5])).toBe(3);
        expect(mod._internals.median([1, 2, 3, 4])).toBe(2.5);
        expect(mod._internals.median([])).toBe(0);
    });
});
