/**
 * Tests for Market Demand Analyzer
 * CFX-067: Skill Gap Analysis Tests
 */

const fs = require('fs');
const marketDemand = require('../market-demand');

// Mock fs to avoid file system side effects in tests
jest.mock('fs');

describe('Market Demand Analyzer', () => {
  
  beforeEach(() => {
    // Reset mocks
    fs.existsSync.mockClear();
    fs.readFileSync.mockClear();
    fs.writeFileSync.mockClear();
    fs.mkdirSync.mockClear();
  });

  describe('Market Data Initialization', () => {
    test('should initialize market data with proper structure', () => {
      fs.existsSync.mockReturnValue(false);
      fs.writeFileSync.mockImplementation(() => {});
      fs.mkdirSync.mockImplementation(() => {});

      marketDemand.initializeMarketData();

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = fs.writeFileSync.mock.calls.find(call => 
        call[0].includes('market-data.json')
      );
      expect(writeCall).toBeDefined();

      const marketData = JSON.parse(writeCall[1]);
      expect(marketData).toHaveProperty('lastUpdated');
      expect(marketData).toHaveProperty('skills');
      expect(marketData).toHaveProperty('skillCombinations');

      // Test skill structure
      const jsSkill = marketData.skills.javascript;
      expect(jsSkill).toHaveProperty('demand');
      expect(jsSkill).toHaveProperty('growth');
      expect(jsSkill).toHaveProperty('avgRate');
      expect(jsSkill).toHaveProperty('jobCount');
      expect(jsSkill).toHaveProperty('remoteFriendly');
      expect(jsSkill).toHaveProperty('platform');
      expect(jsSkill).toHaveProperty('trending');
      expect(jsSkill).toHaveProperty('futureProof');

      // Test platform structure
      expect(jsSkill.platform).toHaveProperty('upwork');
      expect(jsSkill.platform).toHaveProperty('freelancer');
      expect(jsSkill.platform).toHaveProperty('toptal');
      expect(jsSkill.platform).toHaveProperty('fiverr');

      // Test skill combinations
      expect(marketData.skillCombinations).toHaveProperty('react+nodejs');
      expect(marketData.skillCombinations['react+nodejs']).toHaveProperty('multiplier');
      expect(marketData.skillCombinations['react+nodejs']).toHaveProperty('demand');
    });

    test('should have realistic market values', () => {
      const marketData = marketDemand.DEFAULT_MARKET_DATA;
      
      Object.values(marketData.skills).forEach(skill => {
        // Demand should be 1-10
        expect(skill.demand).toBeGreaterThanOrEqual(1);
        expect(skill.demand).toBeLessThanOrEqual(10);
        
        // Growth should be reasonable (-0.5 to 1.0)
        expect(skill.growth).toBeGreaterThanOrEqual(-0.5);
        expect(skill.growth).toBeLessThanOrEqual(1.0);
        
        // Average rate should be positive for paid skills
        if (skill.avgRate > 0) {
          expect(skill.avgRate).toBeGreaterThan(0);
          expect(skill.avgRate).toBeLessThan(300); // Sanity check
        }
        
        // Future proof score should be 1-10
        expect(skill.futureProof).toBeGreaterThanOrEqual(1);
        expect(skill.futureProof).toBeLessThanOrEqual(10);
      });
    });
  });

  describe('Trending Skills Analysis', () => {
    test('should identify trending skills correctly', () => {
      fs.existsSync.mockReturnValue(false);
      fs.writeFileSync.mockImplementation(() => {});
      fs.mkdirSync.mockImplementation(() => {});

      const trends = marketDemand.analyzeTrendingSkills();

      expect(trends).toHaveProperty('trending');
      expect(trends).toHaveProperty('declining');
      expect(trends).toHaveProperty('emergingSkills');
      expect(trends).toHaveProperty('analysis');
      expect(trends).toHaveProperty('recommendations');

      // Trending skills should be sorted by trend score
      const trendingSkills = trends.trending;
      expect(Array.isArray(trendingSkills)).toBe(true);
      
      for (let i = 0; i < trendingSkills.length - 1; i++) {
        expect(trendingSkills[i].trendScore).toBeGreaterThanOrEqual(
          trendingSkills[i + 1].trendScore
        );
      }

      // Each trending skill should have required properties
      trendingSkills.forEach(skill => {
        expect(skill).toHaveProperty('skill');
        expect(skill).toHaveProperty('demand');
        expect(skill).toHaveProperty('growth');
        expect(skill).toHaveProperty('trendScore');
        expect(skill.growth).toBeGreaterThan(0); // Trending = positive growth
        expect(skill.demand).toBeGreaterThanOrEqual(6); // Min demand threshold
      });

      // Declining skills should have negative growth
      trends.declining.forEach(skill => {
        expect(skill.growth).toBeLessThan(0);
        expect(skill).toHaveProperty('riskScore');
      });
    });

    test('should calculate trend scores correctly', () => {
      const highTrendSkill = {
        demand: 9,
        growth: 0.3,
        futureProof: 9,
        jobCount: 50000
      };

      const lowTrendSkill = {
        demand: 6,
        growth: 0.05,
        futureProof: 5,
        jobCount: 1000
      };

      const highScore = marketDemand.calculateTrendScore(highTrendSkill);
      const lowScore = marketDemand.calculateTrendScore(lowTrendSkill);

      expect(highScore).toBeGreaterThan(lowScore);
      expect(highScore).toBeGreaterThan(0);
      expect(lowScore).toBeGreaterThan(0);
    });
  });

  describe('Skill Pricing Analysis', () => {
    test('should analyze pricing for user skills', () => {
      fs.existsSync.mockReturnValue(false);
      fs.writeFileSync.mockImplementation(() => {});
      fs.mkdirSync.mockImplementation(() => {});

      const userSkills = ['javascript', 'react', 'python', 'communication'];
      const pricing = marketDemand.analyzeSkillPricing(userSkills);

      expect(pricing).toHaveProperty('skillPricing');
      expect(pricing).toHaveProperty('totalMarketValue');
      expect(pricing).toHaveProperty('rateMultiplier');
      expect(pricing).toHaveProperty('recommendedRate');
      expect(pricing).toHaveProperty('competitivePosition');
      expect(pricing).toHaveProperty('pricingStrategy');
      expect(pricing).toHaveProperty('platformRecommendations');

      // Check skill pricing array
      expect(Array.isArray(pricing.skillPricing)).toBe(true);
      expect(pricing.skillPricing.length).toBe(4); // Should match user skills

      pricing.skillPricing.forEach(skill => {
        expect(skill).toHaveProperty('skill');
        expect(skill).toHaveProperty('baseRate');
        expect(skill).toHaveProperty('demand');
        expect(skill).toHaveProperty('marketValue');
        expect(userSkills).toContain(skill.skill);
      });

      // Check recommended rate structure
      const rate = pricing.recommendedRate;
      expect(rate).toHaveProperty('min');
      expect(rate).toHaveProperty('mid');
      expect(rate).toHaveProperty('max');
      expect(rate).toHaveProperty('confidence');
      expect(rate.min).toBeLessThanOrEqual(rate.mid);
      expect(rate.mid).toBeLessThanOrEqual(rate.max);
      expect(rate.confidence).toBeGreaterThanOrEqual(0);
      expect(rate.confidence).toBeLessThanOrEqual(100);

      // Check competitive position
      const position = pricing.competitivePosition;
      expect(position).toHaveProperty('position');
      expect(position).toHaveProperty('avgDemand');
      expect(position).toHaveProperty('avgGrowth');
      expect(position).toHaveProperty('avgFutureProof');
      expect(['weak', 'average', 'strong', 'excellent']).toContain(position.position);
    });

    test('should calculate market value correctly', () => {
      const highValueSkill = {
        avgRate: 120,
        demand: 9,
        growth: 0.3,
        jobCount: 40000
      };

      const lowValueSkill = {
        avgRate: 30,
        demand: 5,
        growth: 0.05,
        jobCount: 2000
      };

      const highValue = marketDemand.calculateMarketValue(highValueSkill);
      const lowValue = marketDemand.calculateMarketValue(lowValueSkill);

      expect(highValue).toBeGreaterThan(lowValue);
      expect(highValue).toBeGreaterThan(0);
      expect(lowValue).toBeGreaterThan(0);
    });

    test('should recommend appropriate rates', () => {
      const mockSkillPricing = [
        { skill: 'javascript', baseRate: 75, demand: 9 },
        { skill: 'react', baseRate: 85, demand: 9 },
        { skill: 'communication', baseRate: 0, demand: 10 } // Multiplier skill
      ];

      const rateMultiplier = 1.15; // 15% bonus from communication
      const rates = marketDemand.calculateRecommendedRate(mockSkillPricing, rateMultiplier);

      expect(rates.mid).toBeGreaterThan(rates.min);
      expect(rates.max).toBeGreaterThan(rates.mid);
      
      // Should reflect the multiplier effect
      const expectedMid = Math.round((75 + 85) / 2 * 1.15); // Average of paid skills * multiplier
      expect(rates.mid).toBeCloseTo(expectedMid, -1); // Within 10
    });
  });

  describe('Competitive Advantage Analysis', () => {
    test('should identify skill combinations', () => {
      fs.existsSync.mockReturnValue(false);
      fs.writeFileSync.mockImplementation(() => {});
      fs.mkdirSync.mockImplementation(() => {});

      const userSkills = ['react', 'nodejs', 'python', 'ai_ml'];
      const advantage = marketDemand.analyzeCompetitiveAdvantage(userSkills);

      expect(advantage).toHaveProperty('currentAdvantages');
      expect(advantage).toHaveProperty('potentialAdvantages');
      expect(advantage).toHaveProperty('advantageScore');
      expect(advantage).toHaveProperty('recommendations');
      expect(advantage).toHaveProperty('uniquePositioning');

      // Should detect react+nodejs combination
      const currentCombos = advantage.currentAdvantages;
      const reactNodeCombo = currentCombos.find(combo => 
        combo.combination === 'react+nodejs'
      );
      expect(reactNodeCombo).toBeDefined();

      // Should detect python+ai_ml combination
      const pythonAiCombo = currentCombos.find(combo => 
        combo.combination === 'python+ai_ml'
      );
      expect(pythonAiCombo).toBeDefined();

      // Check advantage score calculation
      expect(advantage.advantageScore).toBeGreaterThanOrEqual(0);
      expect(advantage.advantageScore).toBeLessThanOrEqual(100);

      // Check unique positioning
      const positioning = advantage.uniquePositioning;
      expect(positioning).toHaveProperty('positioning');
      expect(positioning).toHaveProperty('uniqueness');
      expect(positioning).toHaveProperty('breakdown');
      expect(positioning.uniqueness).toBeGreaterThanOrEqual(0);
      expect(positioning.uniqueness).toBeLessThanOrEqual(100);
    });

    test('should suggest potential skill combinations', () => {
      fs.existsSync.mockReturnValue(false);
      fs.writeFileSync.mockImplementation(() => {});
      fs.mkdirSync.mockImplementation(() => {});

      // User has React but not Node.js
      const userSkills = ['react', 'javascript'];
      const advantage = marketDemand.analyzeCompetitiveAdvantage(userSkills);

      // Should suggest learning nodejs to get react+nodejs combo
      const potentialCombos = advantage.potentialAdvantages;
      const nodejsCombo = potentialCombos.find(combo => 
        combo.missingSkill === 'nodejs'
      );
      expect(nodejsCombo).toBeDefined();
      expect(nodejsCombo.combination).toBe('react+nodejs');
    });
  });

  describe('Future-Proofing Analysis', () => {
    test('should analyze future-proofing correctly', () => {
      fs.existsSync.mockReturnValue(false);
      fs.writeFileSync.mockImplementation(() => {});
      fs.mkdirSync.mockImplementation(() => {});

      const userSkills = ['javascript', 'react', 'blockchain']; // Mix of future-proof and risky
      const futureProof = marketDemand.generateFutureProofingRecommendations(userSkills);

      expect(futureProof).toHaveProperty('overallFutureProofScore');
      expect(futureProof).toHaveProperty('riskLevel');
      expect(futureProof).toHaveProperty('riskSkills');
      expect(futureProof).toHaveProperty('futureProofSkills');
      expect(futureProof).toHaveProperty('emergingSkillsToLearn');
      expect(futureProof).toHaveProperty('recommendations');
      expect(futureProof).toHaveProperty('timeline');

      // Overall score should be 1-10
      expect(futureProof.overallFutureProofScore).toBeGreaterThanOrEqual(1);
      expect(futureProof.overallFutureProofScore).toBeLessThanOrEqual(10);

      // Risk level should be valid
      expect(['low', 'medium', 'high', 'critical']).toContain(futureProof.riskLevel);

      // Blockchain should be identified as risky (declining growth)
      const riskSkills = futureProof.riskSkills;
      const blockchainRisk = riskSkills.find(skill => skill.skill === 'blockchain');
      expect(blockchainRisk).toBeDefined();

      // Should suggest high future-proof skills
      const emergingSkills = futureProof.emergingSkillsToLearn;
      expect(Array.isArray(emergingSkills)).toBe(true);
      emergingSkills.forEach(skill => {
        expect(skill.futureProof).toBeGreaterThanOrEqual(9);
        expect(skill.growth).toBeGreaterThan(0.2);
        expect(skill.demand).toBeGreaterThanOrEqual(8);
      });
    });

    test('should create learning timeline for emerging skills', () => {
      fs.existsSync.mockReturnValue(false);
      fs.writeFileSync.mockImplementation(() => {});
      fs.mkdirSync.mockImplementation(() => {});

      const userSkills = ['javascript']; // Limited skills
      const futureProof = marketDemand.generateFutureProofingRecommendations(userSkills);

      const timeline = futureProof.timeline;
      expect(Array.isArray(timeline)).toBe(true);
      expect(timeline.length).toBeLessThanOrEqual(3); // Max 3 quarters

      timeline.forEach((item, index) => {
        expect(item).toHaveProperty('quarter', `Q${index + 1}`);
        expect(item).toHaveProperty('skill');
        expect(item).toHaveProperty('urgency');
        expect(item).toHaveProperty('rationale');
      });
    });
  });

  describe('Platform Analysis', () => {
    test('should analyze optimal platforms for skills', () => {
      const mockSkillPricing = [
        {
          skill: 'javascript',
          platformRates: {
            upwork: { avgRate: 65, demand: 9 },
            toptal: { avgRate: 95, demand: 9 },
            fiverr: { avgRate: 35, demand: 7 }
          }
        },
        {
          skill: 'react',
          platformRates: {
            upwork: { avgRate: 75, demand: 9 },
            toptal: { avgRate: 110, demand: 10 },
            freelancer: { avgRate: 65, demand: 8 }
          }
        }
      ];

      const recommendations = marketDemand.analyzeOptimalPlatforms(mockSkillPricing);

      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);

      // Should be sorted by score (best first)
      for (let i = 0; i < recommendations.length - 1; i++) {
        expect(recommendations[i].score).toBeGreaterThanOrEqual(
          recommendations[i + 1].score
        );
      }

      recommendations.forEach(platform => {
        expect(platform).toHaveProperty('platform');
        expect(platform).toHaveProperty('avgRate');
        expect(platform).toHaveProperty('skillCoverage');
        expect(platform).toHaveProperty('score');
        expect(platform).toHaveProperty('recommendation');

        expect(platform.score).toBeGreaterThanOrEqual(0);
        expect(platform.score).toBeLessThanOrEqual(100);
        expect(platform.skillCoverage).toBeGreaterThanOrEqual(0);
        expect(platform.skillCoverage).toBeLessThanOrEqual(100);
      });

      // Toptal should score highest due to high rates
      expect(recommendations[0].platform).toBe('toptal');
    });
  });

  describe('Risk and Scoring Calculations', () => {
    test('should calculate risk scores for declining skills', () => {
      const highRiskSkill = {
        growth: -0.2,   // High decline
        demand: 4,      // Low demand
        futureProof: 3  // Low future-proof
      };

      const lowRiskSkill = {
        growth: -0.05,  // Slight decline
        demand: 8,      // High demand
        futureProof: 7  // Good future-proof
      };

      const highRisk = marketDemand.calculateRiskScore(highRiskSkill);
      const lowRisk = marketDemand.calculateRiskScore(lowRiskSkill);

      expect(highRisk).toBeGreaterThan(lowRisk);
      expect(highRisk).toBeGreaterThan(0);
      expect(lowRisk).toBeGreaterThanOrEqual(0);
    });

    test('should calculate platform scores correctly', () => {
      const highScore = marketDemand.calculatePlatformScore(100, 1.0); // High rate, full coverage
      const lowScore = marketDemand.calculatePlatformScore(25, 0.3);   // Low rate, partial coverage

      expect(highScore).toBeGreaterThan(lowScore);
      expect(highScore).toBeLessThanOrEqual(100);
      expect(lowScore).toBeGreaterThanOrEqual(0);
    });
  });
});