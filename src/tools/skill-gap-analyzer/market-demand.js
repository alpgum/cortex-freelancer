#!/usr/bin/env node
/**
 * Market Demand Analyzer
 * CFX-067: Skill Gap Analysis with Personalized Learning Path Recommendations
 *
 * Trending skills detection for freelancer markets
 * Skill pricing impact analysis (how skills affect rates)
 * Competitive advantage scoring for skill combinations
 * Future-proofing recommendations
 */

const fs = require('fs');
const path = require('path');

// ─── Storage helpers ────────────────────────────────────────────────────────

const DATA_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE || '.',
  '.cortex-freelancer',
  'skill-gap-analyzer'
);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJSON(file, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJSON(file, data) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

const PATHS = {
  marketData: () => path.join(DATA_DIR, 'market-data.json'),
  trends: () => path.join(DATA_DIR, 'skill-trends.json'),
  pricing: () => path.join(DATA_DIR, 'skill-pricing.json'),
  competitiveAdvantage: () => path.join(DATA_DIR, 'competitive-advantage.json'),
};

// ─── Market Data and Trends ────────────────────────────────────────────────

/**
 * Default market data with current trends and demand
 */
const DEFAULT_MARKET_DATA = {
  lastUpdated: new Date().toISOString(),
  skills: {
    // Technical Skills
    javascript: {
      demand: 9.2,
      growth: 0.15, // 15% YoY growth
      avgRate: 75, // USD per hour
      jobCount: 45000,
      remoteFriendly: 9,
      platform: {
        upwork: { demand: 9, avgRate: 65 },
        freelancer: { demand: 8, avgRate: 55 },
        toptal: { demand: 9, avgRate: 95 },
        fiverr: { demand: 7, avgRate: 35 }
      },
      trending: true,
      futureProof: 8
    },
    react: {
      demand: 9.5,
      growth: 0.25,
      avgRate: 85,
      jobCount: 35000,
      remoteFriendly: 9,
      platform: {
        upwork: { demand: 9, avgRate: 75 },
        freelancer: { demand: 8, avgRate: 65 },
        toptal: { demand: 10, avgRate: 110 },
        fiverr: { demand: 6, avgRate: 45 }
      },
      trending: true,
      futureProof: 9
    },
    python: {
      demand: 8.8,
      growth: 0.20,
      avgRate: 80,
      jobCount: 40000,
      remoteFriendly: 9,
      platform: {
        upwork: { demand: 9, avgRate: 70 },
        freelancer: { demand: 8, avgRate: 60 },
        toptal: { demand: 9, avgRate: 105 },
        fiverr: { demand: 5, avgRate: 40 }
      },
      trending: true,
      futureProof: 9
    },
    nodejs: {
      demand: 8.5,
      growth: 0.18,
      avgRate: 78,
      jobCount: 28000,
      remoteFriendly: 9,
      platform: {
        upwork: { demand: 8, avgRate: 68 },
        freelancer: { demand: 7, avgRate: 58 },
        toptal: { demand: 9, avgRate: 100 },
        fiverr: { demand: 5, avgRate: 38 }
      },
      trending: true,
      futureProof: 8
    },
    aws: {
      demand: 8.0,
      growth: 0.30,
      avgRate: 95,
      jobCount: 22000,
      remoteFriendly: 8,
      platform: {
        upwork: { demand: 8, avgRate: 85 },
        freelancer: { demand: 7, avgRate: 75 },
        toptal: { demand: 9, avgRate: 125 },
        fiverr: { demand: 4, avgRate: 55 }
      },
      trending: true,
      futureProof: 9
    },
    docker: {
      demand: 7.5,
      growth: 0.22,
      avgRate: 85,
      jobCount: 15000,
      remoteFriendly: 9,
      platform: {
        upwork: { demand: 7, avgRate: 75 },
        freelancer: { demand: 6, avgRate: 65 },
        toptal: { demand: 8, avgRate: 110 },
        fiverr: { demand: 3, avgRate: 45 }
      },
      trending: true,
      futureProof: 8
    },
    ai_ml: {
      demand: 9.8,
      growth: 0.45,
      avgRate: 125,
      jobCount: 18000,
      remoteFriendly: 9,
      platform: {
        upwork: { demand: 9, avgRate: 110 },
        freelancer: { demand: 8, avgRate: 95 },
        toptal: { demand: 10, avgRate: 150 },
        fiverr: { demand: 6, avgRate: 75 }
      },
      trending: true,
      futureProof: 10
    },
    blockchain: {
      demand: 6.5,
      growth: -0.10, // Declining after hype
      avgRate: 100,
      jobCount: 8000,
      remoteFriendly: 9,
      platform: {
        upwork: { demand: 6, avgRate: 90 },
        freelancer: { demand: 5, avgRate: 80 },
        toptal: { demand: 7, avgRate: 130 },
        fiverr: { demand: 4, avgRate: 60 }
      },
      trending: false,
      futureProof: 5
    },
    
    // Soft Skills
    communication: {
      demand: 10.0,
      growth: 0.05,
      avgRate: 0, // Multiplier skill
      jobCount: 0,
      remoteFriendly: 10,
      platform: {},
      trending: true,
      futureProof: 10,
      rateMultiplier: 1.15 // 15% rate increase
    },
    project_management: {
      demand: 8.8,
      growth: 0.12,
      avgRate: 65,
      jobCount: 25000,
      remoteFriendly: 9,
      platform: {
        upwork: { demand: 9, avgRate: 55 },
        freelancer: { demand: 8, avgRate: 45 },
        toptal: { demand: 8, avgRate: 85 },
        fiverr: { demand: 6, avgRate: 25 }
      },
      trending: true,
      futureProof: 9,
      rateMultiplier: 1.10
    },
    time_management: {
      demand: 9.0,
      growth: 0.08,
      avgRate: 0,
      jobCount: 0,
      remoteFriendly: 10,
      platform: {},
      trending: true,
      futureProof: 10,
      rateMultiplier: 1.08
    },
    leadership: {
      demand: 7.5,
      growth: 0.10,
      avgRate: 0,
      jobCount: 0,
      remoteFriendly: 8,
      platform: {},
      trending: true,
      futureProof: 9,
      rateMultiplier: 1.20
    },
    
    // Business Skills
    marketing: {
      demand: 8.5,
      growth: 0.15,
      avgRate: 60,
      jobCount: 35000,
      remoteFriendly: 9,
      platform: {
        upwork: { demand: 8, avgRate: 50 },
        freelancer: { demand: 7, avgRate: 40 },
        toptal: { demand: 8, avgRate: 85 },
        fiverr: { demand: 8, avgRate: 25 }
      },
      trending: true,
      futureProof: 8
    },
    sales: {
      demand: 8.0,
      growth: 0.10,
      avgRate: 55,
      jobCount: 20000,
      remoteFriendly: 8,
      platform: {
        upwork: { demand: 7, avgRate: 45 },
        freelancer: { demand: 6, avgRate: 35 },
        toptal: { demand: 8, avgRate: 75 },
        fiverr: { demand: 5, avgRate: 20 }
      },
      trending: true,
      futureProof: 8
    },
    branding: {
      demand: 7.8,
      growth: 0.12,
      avgRate: 70,
      jobCount: 15000,
      remoteFriendly: 9,
      platform: {
        upwork: { demand: 7, avgRate: 60 },
        freelancer: { demand: 6, avgRate: 50 },
        toptal: { demand: 8, avgRate: 95 },
        fiverr: { demand: 8, avgRate: 35 }
      },
      trending: true,
      futureProof: 7
    },
    
    // Domain Skills
    fintech: {
      demand: 8.2,
      growth: 0.20,
      avgRate: 90,
      jobCount: 12000,
      remoteFriendly: 8,
      platform: {
        upwork: { demand: 8, avgRate: 80 },
        freelancer: { demand: 7, avgRate: 70 },
        toptal: { demand: 9, avgRate: 115 },
        fiverr: { demand: 4, avgRate: 50 }
      },
      trending: true,
      futureProof: 8
    },
    healthcare: {
      demand: 7.5,
      growth: 0.25,
      avgRate: 85,
      jobCount: 8000,
      remoteFriendly: 6,
      platform: {
        upwork: { demand: 7, avgRate: 75 },
        freelancer: { demand: 6, avgRate: 65 },
        toptal: { demand: 8, avgRate: 105 },
        fiverr: { demand: 3, avgRate: 45 }
      },
      trending: true,
      futureProof: 9
    },
    ecommerce: {
      demand: 8.0,
      growth: 0.18,
      avgRate: 65,
      jobCount: 20000,
      remoteFriendly: 9,
      platform: {
        upwork: { demand: 8, avgRate: 55 },
        freelancer: { demand: 7, avgRate: 45 },
        toptal: { demand: 7, avgRate: 85 },
        fiverr: { demand: 7, avgRate: 30 }
      },
      trending: true,
      futureProof: 8
    },
    saas: {
      demand: 9.0,
      growth: 0.30,
      avgRate: 95,
      jobCount: 15000,
      remoteFriendly: 9,
      platform: {
        upwork: { demand: 8, avgRate: 85 },
        freelancer: { demand: 7, avgRate: 75 },
        toptal: { demand: 9, avgRate: 120 },
        fiverr: { demand: 5, avgRate: 55 }
      },
      trending: true,
      futureProof: 9
    }
  },
  
  // Skill combinations that provide competitive advantage
  skillCombinations: {
    'react+nodejs': { multiplier: 1.25, demand: 9.5 },
    'python+ai_ml': { multiplier: 1.40, demand: 9.8 },
    'aws+docker': { multiplier: 1.30, demand: 8.5 },
    'javascript+communication': { multiplier: 1.20, demand: 9.0 },
    'marketing+sales': { multiplier: 1.15, demand: 8.2 },
    'fintech+blockchain': { multiplier: 1.35, demand: 7.5 },
    'saas+project_management': { multiplier: 1.25, demand: 8.8 },
    'ai_ml+healthcare': { multiplier: 1.45, demand: 8.5 },
    'ecommerce+marketing': { multiplier: 1.20, demand: 8.3 },
    'leadership+communication': { multiplier: 1.30, demand: 8.0 }
  }
};

// ─── Market Analysis Functions ─────────────────────────────────────────────

/**
 * Initialize market data if not present
 */
function initializeMarketData() {
  const marketPath = PATHS.marketData();
  if (!fs.existsSync(marketPath)) {
    writeJSON(marketPath, DEFAULT_MARKET_DATA);
  }
}

/**
 * Get current market data
 * @returns {Object} Market data
 */
function getMarketData() {
  initializeMarketData();
  return readJSON(PATHS.marketData(), DEFAULT_MARKET_DATA);
}

/**
 * Analyze trending skills in the market
 * @param {Object} options - Analysis options
 * @returns {Object} Trending skills analysis
 */
function analyzeTrendingSkills(options = {}) {
  const { 
    category = 'all', 
    timeframe = '1year', 
    platform = 'all',
    minDemand = 6 
  } = options;
  
  const marketData = getMarketData();
  const skills = marketData.skills;
  
  // Filter and rank skills by trends
  const trendingSkills = Object.entries(skills)
    .filter(([skillKey, data]) => {
      return data.demand >= minDemand && 
             data.trending && 
             data.growth > 0;
    })
    .map(([skillKey, data]) => ({
      skill: skillKey,
      demand: data.demand,
      growth: data.growth,
      avgRate: data.avgRate,
      jobCount: data.jobCount,
      futureProof: data.futureProof,
      trendScore: calculateTrendScore(data)
    }))
    .sort((a, b) => b.trendScore - a.trendScore);

  const decliningSkills = Object.entries(skills)
    .filter(([skillKey, data]) => data.growth < 0)
    .map(([skillKey, data]) => ({
      skill: skillKey,
      demand: data.demand,
      growth: data.growth,
      riskScore: calculateRiskScore(data)
    }))
    .sort((a, b) => b.riskScore - a.riskScore);

  return {
    trending: trendingSkills.slice(0, 10),
    declining: decliningSkills.slice(0, 5),
    emergingSkills: identifyEmergingSkills(trendingSkills),
    analysis: generateTrendAnalysis(trendingSkills, decliningSkills),
    recommendations: generateTrendRecommendations(trendingSkills)
  };
}

/**
 * Calculate trend score for a skill
 * @param {Object} skillData - Skill market data
 * @returns {number} Trend score
 */
function calculateTrendScore(skillData) {
  const demandWeight = 0.3;
  const growthWeight = 0.4;
  const futureProofWeight = 0.2;
  const jobCountWeight = 0.1;

  // Normalize job count (log scale)
  const normalizedJobCount = Math.log10(skillData.jobCount || 1000) / 5;

  return (
    skillData.demand * demandWeight +
    (skillData.growth * 100) * growthWeight +
    skillData.futureProof * futureProofWeight +
    normalizedJobCount * jobCountWeight
  );
}

/**
 * Calculate risk score for declining skills
 * @param {Object} skillData - Skill market data
 * @returns {number} Risk score
 */
function calculateRiskScore(skillData) {
  const declineRate = Math.abs(skillData.growth);
  const lowDemand = (10 - skillData.demand) / 10;
  const lowFutureProof = (10 - skillData.futureProof) / 10;

  return (declineRate * 40) + (lowDemand * 30) + (lowFutureProof * 30);
}

/**
 * Identify emerging skills from trending data
 * @param {Array} trendingSkills - List of trending skills
 * @returns {Array} Emerging skills
 */
function identifyEmergingSkills(trendingSkills) {
  return trendingSkills
    .filter(skill => skill.growth > 0.25 && skill.demand > 8)
    .slice(0, 5);
}

/**
 * Analyze skill pricing impact
 * @param {Array} userSkills - User's current skills
 * @returns {Object} Pricing analysis
 */
function analyzeSkillPricing(userSkills) {
  const marketData = getMarketData();
  const skills = marketData.skills;
  
  let totalMarketValue = 0;
  let rateMultiplier = 1.0;
  const skillPricing = [];
  
  userSkills.forEach(skillKey => {
    const skillData = skills[skillKey];
    if (skillData) {
      skillPricing.push({
        skill: skillKey,
        baseRate: skillData.avgRate || 0,
        demand: skillData.demand,
        marketValue: calculateMarketValue(skillData),
        platformRates: skillData.platform || {}
      });
      
      totalMarketValue += skillData.avgRate || 0;
      if (skillData.rateMultiplier) {
        rateMultiplier *= skillData.rateMultiplier;
      }
    }
  });
  
  const recommendedRate = calculateRecommendedRate(skillPricing, rateMultiplier);
  const competitivePosition = assessCompetitivePosition(userSkills, skills);
  
  return {
    skillPricing,
    totalMarketValue,
    rateMultiplier,
    recommendedRate,
    competitivePosition,
    pricingStrategy: generatePricingStrategy(skillPricing, competitivePosition),
    platformRecommendations: analyzeOptimalPlatforms(skillPricing)
  };
}

/**
 * Calculate market value for a skill
 * @param {Object} skillData - Skill market data
 * @returns {number} Market value score
 */
function calculateMarketValue(skillData) {
  const rateWeight = 0.4;
  const demandWeight = 0.3;
  const growthWeight = 0.2;
  const jobCountWeight = 0.1;

  const normalizedRate = (skillData.avgRate || 0) / 150; // Normalize to 150 max
  const normalizedJobCount = Math.log10(skillData.jobCount || 1000) / 5;

  return (
    normalizedRate * rateWeight +
    skillData.demand * demandWeight +
    (skillData.growth + 1) * growthWeight + // Offset negative growth
    normalizedJobCount * jobCountWeight
  ) * 100;
}

/**
 * Calculate recommended hourly rate
 * @param {Array} skillPricing - Skill pricing data
 * @param {number} rateMultiplier - Combined rate multiplier
 * @returns {Object} Rate recommendations
 */
function calculateRecommendedRate(skillPricing, rateMultiplier) {
  if (skillPricing.length === 0) return { min: 25, mid: 50, max: 75 };
  
  const baseRates = skillPricing
    .filter(s => s.baseRate > 0)
    .map(s => s.baseRate);
  
  if (baseRates.length === 0) return { min: 25, mid: 50, max: 75 };
  
  const avgBaseRate = baseRates.reduce((sum, rate) => sum + rate, 0) / baseRates.length;
  const maxRate = Math.max(...baseRates);
  
  const adjustedRate = avgBaseRate * rateMultiplier;
  
  return {
    min: Math.round(adjustedRate * 0.8),
    mid: Math.round(adjustedRate),
    max: Math.round(Math.min(adjustedRate * 1.3, maxRate * 1.1)),
    currency: 'USD',
    basis: 'hourly',
    confidence: calculateRateConfidence(skillPricing.length, rateMultiplier)
  };
}

/**
 * Calculate confidence score for rate recommendation
 * @param {number} skillCount - Number of skills
 * @param {number} rateMultiplier - Rate multiplier
 * @returns {number} Confidence score (0-100)
 */
function calculateRateConfidence(skillCount, rateMultiplier) {
  const skillCountFactor = Math.min(skillCount / 5, 1); // Max confidence at 5+ skills
  const multiplierFactor = Math.min(rateMultiplier - 1, 0.5) / 0.5; // Max bonus at 1.5x multiplier
  
  return Math.round((0.6 + skillCountFactor * 0.3 + multiplierFactor * 0.1) * 100);
}

/**
 * Assess competitive position based on skill portfolio
 * @param {Array} userSkills - User's skills
 * @param {Object} allSkills - All market skills
 * @returns {Object} Competitive position
 */
function assessCompetitivePosition(userSkills, allSkills) {
  const userSkillData = userSkills
    .map(skill => allSkills[skill])
    .filter(Boolean);
  
  const avgDemand = userSkillData.reduce((sum, s) => sum + s.demand, 0) / userSkillData.length;
  const avgGrowth = userSkillData.reduce((sum, s) => sum + s.growth, 0) / userSkillData.length;
  const avgFutureProof = userSkillData.reduce((sum, s) => sum + s.futureProof, 0) / userSkillData.length;
  
  let position = 'average';
  if (avgDemand > 8.5 && avgGrowth > 0.15) position = 'strong';
  if (avgDemand > 9.0 && avgGrowth > 0.25) position = 'excellent';
  if (avgDemand < 6.5 || avgGrowth < 0) position = 'weak';
  
  return {
    position,
    avgDemand: Math.round(avgDemand * 10) / 10,
    avgGrowth: Math.round(avgGrowth * 100),
    avgFutureProof: Math.round(avgFutureProof * 10) / 10,
    skillCount: userSkills.length,
    recommendations: generatePositionRecommendations(position, avgDemand, avgGrowth)
  };
}

/**
 * Generate pricing strategy recommendations
 * @param {Array} skillPricing - Skill pricing data
 * @param {Object} competitivePosition - Competitive position
 * @returns {Array} Pricing strategies
 */
function generatePricingStrategy(skillPricing, competitivePosition) {
  const strategies = [];
  
  if (competitivePosition.position === 'excellent') {
    strategies.push({
      strategy: 'Premium Pricing',
      description: 'Charge top market rates due to excellent skill portfolio',
      multiplier: 1.2,
      riskLevel: 'low'
    });
  }
  
  if (competitivePosition.position === 'strong') {
    strategies.push({
      strategy: 'Value-Based Pricing',
      description: 'Price based on value delivered, above average market rates',
      multiplier: 1.1,
      riskLevel: 'low'
    });
  }
  
  if (competitivePosition.skillCount >= 5) {
    strategies.push({
      strategy: 'Full-Stack Premium',
      description: 'Charge premium for comprehensive skill coverage',
      multiplier: 1.15,
      riskLevel: 'medium'
    });
  }
  
  const hasHighGrowthSkills = skillPricing.some(s => 
    s.skill in DEFAULT_MARKET_DATA.skills && 
    DEFAULT_MARKET_DATA.skills[s.skill].growth > 0.2
  );
  
  if (hasHighGrowthSkills) {
    strategies.push({
      strategy: 'Early Adopter Premium',
      description: 'Leverage cutting-edge skills for higher rates',
      multiplier: 1.25,
      riskLevel: 'medium'
    });
  }
  
  return strategies;
}

/**
 * Analyze optimal platforms for skill monetization
 * @param {Array} skillPricing - Skill pricing data
 * @returns {Array} Platform recommendations
 */
function analyzeOptimalPlatforms(skillPricing) {
  const platforms = ['upwork', 'freelancer', 'toptal', 'fiverr'];
  const platformScores = {};
  
  platforms.forEach(platform => {
    let totalRate = 0;
    let skillCount = 0;
    
    skillPricing.forEach(skill => {
      if (skill.platformRates[platform]) {
        totalRate += skill.platformRates[platform].avgRate;
        skillCount++;
      }
    });
    
    if (skillCount > 0) {
      platformScores[platform] = {
        avgRate: Math.round(totalRate / skillCount),
        skillCoverage: (skillCount / skillPricing.length) * 100,
        score: calculatePlatformScore(totalRate / skillCount, skillCount / skillPricing.length)
      };
    }
  });
  
  return Object.entries(platformScores)
    .sort((a, b) => b[1].score - a[1].score)
    .map(([platform, data]) => ({
      platform,
      ...data,
      recommendation: generatePlatformRecommendation(platform, data)
    }));
}

/**
 * Calculate platform score
 * @param {number} avgRate - Average rate on platform
 * @param {number} coverage - Skill coverage percentage
 * @returns {number} Platform score
 */
function calculatePlatformScore(avgRate, coverage) {
  const rateWeight = 0.6;
  const coverageWeight = 0.4;
  
  const normalizedRate = Math.min(avgRate / 100, 1); // Normalize to 100 max
  
  return (normalizedRate * rateWeight + coverage * coverageWeight) * 100;
}

/**
 * Analyze competitive advantage of skill combinations
 * @param {Array} userSkills - User's current skills
 * @returns {Object} Competitive advantage analysis
 */
function analyzeCompetitiveAdvantage(userSkills) {
  const marketData = getMarketData();
  const skillCombinations = marketData.skillCombinations;
  
  const userCombinations = [];
  const potentialCombinations = [];
  
  // Find existing combinations in user's skills
  for (const [combo, data] of Object.entries(skillCombinations)) {
    const comboSkills = combo.split('+');
    const hasAllSkills = comboSkills.every(skill => userSkills.includes(skill));
    
    if (hasAllSkills) {
      userCombinations.push({
        combination: combo,
        skills: comboSkills,
        multiplier: data.multiplier,
        demand: data.demand,
        advantage: calculateAdvantageScore(data.multiplier, data.demand)
      });
    } else {
      const missingSkills = comboSkills.filter(skill => !userSkills.includes(skill));
      if (missingSkills.length === 1) { // Only one skill missing
        potentialCombinations.push({
          combination: combo,
          missingSkill: missingSkills[0],
          multiplier: data.multiplier,
          demand: data.demand,
          potentialAdvantage: calculateAdvantageScore(data.multiplier, data.demand)
        });
      }
    }
  }
  
  return {
    currentAdvantages: userCombinations.sort((a, b) => b.advantage - a.advantage),
    potentialAdvantages: potentialCombinations.sort((a, b) => b.potentialAdvantage - a.potentialAdvantage),
    advantageScore: calculateOverallAdvantageScore(userCombinations),
    recommendations: generateAdvantageRecommendations(userCombinations, potentialCombinations),
    uniquePositioning: analyzeUniquePositioning(userSkills, marketData.skills)
  };
}

/**
 * Calculate advantage score for a skill combination
 * @param {number} multiplier - Rate multiplier
 * @param {number} demand - Market demand
 * @returns {number} Advantage score
 */
function calculateAdvantageScore(multiplier, demand) {
  const multiplierWeight = 0.6;
  const demandWeight = 0.4;
  
  return ((multiplier - 1) * 100 * multiplierWeight) + (demand * 10 * demandWeight);
}

/**
 * Calculate overall competitive advantage score
 * @param {Array} userCombinations - User's skill combinations
 * @returns {number} Overall advantage score
 */
function calculateOverallAdvantageScore(userCombinations) {
  if (userCombinations.length === 0) return 0;
  
  const totalAdvantage = userCombinations.reduce((sum, combo) => sum + combo.advantage, 0);
  return Math.round(totalAdvantage / userCombinations.length);
}

/**
 * Analyze unique positioning in the market
 * @param {Array} userSkills - User's skills
 * @param {Object} allSkills - All market skills
 * @returns {Object} Unique positioning analysis
 */
function analyzeUniquePositioning(userSkills, allSkills) {
  const techSkills = userSkills.filter(skill => 
    ['javascript', 'python', 'react', 'nodejs', 'aws', 'docker', 'ai_ml', 'blockchain'].includes(skill)
  );
  
  const softSkills = userSkills.filter(skill => 
    ['communication', 'project_management', 'leadership', 'time_management'].includes(skill)
  );
  
  const businessSkills = userSkills.filter(skill => 
    ['marketing', 'sales', 'branding', 'pricing'].includes(skill)
  );
  
  const domainSkills = userSkills.filter(skill => 
    ['fintech', 'healthcare', 'ecommerce', 'saas'].includes(skill)
  );
  
  let positioning = 'generalist';
  let uniqueness = 50; // Base score
  
  if (techSkills.length >= 3) {
    positioning = 'technical_specialist';
    uniqueness += 20;
  }
  
  if (businessSkills.length >= 2 && techSkills.length >= 2) {
    positioning = 'technopreneur';
    uniqueness += 30;
  }
  
  if (domainSkills.length >= 1 && techSkills.length >= 2) {
    positioning = 'domain_expert';
    uniqueness += 25;
  }
  
  if (softSkills.length >= 2 && (techSkills.length >= 2 || businessSkills.length >= 2)) {
    positioning = 'consultant';
    uniqueness += 35;
  }
  
  return {
    positioning,
    uniqueness: Math.min(uniqueness, 100),
    breakdown: {
      technical: techSkills.length,
      soft: softSkills.length,
      business: businessSkills.length,
      domain: domainSkills.length
    },
    recommendations: generatePositioningRecommendations(positioning, uniqueness)
  };
}

/**
 * Generate future-proofing recommendations
 * @param {Array} userSkills - User's current skills
 * @returns {Object} Future-proofing analysis
 */
function generateFutureProofingRecommendations(userSkills) {
  const marketData = getMarketData();
  const skills = marketData.skills;
  
  const userSkillData = userSkills
    .map(skill => ({ skill, ...skills[skill] }))
    .filter(s => s.demand);
  
  const avgFutureProof = userSkillData.reduce((sum, s) => sum + s.futureProof, 0) / userSkillData.length;
  const riskSkills = userSkillData.filter(s => s.futureProof < 6 || s.growth < 0);
  const futureProofSkills = userSkillData.filter(s => s.futureProof >= 8 && s.growth > 0.1);
  
  const emergingSkillsToLearn = Object.entries(skills)
    .filter(([skillKey, data]) => 
      !userSkills.includes(skillKey) &&
      data.futureProof >= 9 &&
      data.growth > 0.2 &&
      data.demand >= 8
    )
    .sort((a, b) => b[1].futureProof - a[1].futureProof)
    .slice(0, 5)
    .map(([skillKey, data]) => ({
      skill: skillKey,
      futureProof: data.futureProof,
      growth: data.growth,
      demand: data.demand,
      urgency: calculateLearningUrgency(data)
    }));
  
  return {
    overallFutureProofScore: Math.round(avgFutureProof * 10) / 10,
    riskLevel: calculateRiskLevel(avgFutureProof, riskSkills.length),
    riskSkills,
    futureProofSkills,
    emergingSkillsToLearn,
    recommendations: generateFutureProofingStrategies(avgFutureProof, riskSkills, emergingSkillsToLearn),
    timeline: generateFutureProofingTimeline(emergingSkillsToLearn)
  };
}

/**
 * Calculate learning urgency for an emerging skill
 * @param {Object} skillData - Skill market data
 * @returns {number} Urgency score
 */
function calculateLearningUrgency(skillData) {
  const growthWeight = 0.4;
  const demandWeight = 0.3;
  const futureProofWeight = 0.3;
  
  return Math.round(
    (skillData.growth * 100 * growthWeight) +
    (skillData.demand * demandWeight) +
    (skillData.futureProof * futureProofWeight)
  );
}

/**
 * Calculate risk level based on future-proofing metrics
 * @param {number} avgFutureProof - Average future-proof score
 * @param {number} riskSkillCount - Number of at-risk skills
 * @returns {string} Risk level
 */
function calculateRiskLevel(avgFutureProof, riskSkillCount) {
  if (avgFutureProof >= 8 && riskSkillCount === 0) return 'low';
  if (avgFutureProof >= 7 && riskSkillCount <= 1) return 'medium';
  if (avgFutureProof >= 6 && riskSkillCount <= 2) return 'high';
  return 'critical';
}

// ─── Helper Functions ──────────────────────────────────────────────────────

function generateTrendAnalysis(trending, declining) {
  let analysis = `Market Analysis:\n`;
  analysis += `• ${trending.length} skills showing strong growth\n`;
  analysis += `• ${declining.length} skills declining\n`;
  
  if (trending.length > 0) {
    analysis += `\nTop Growing Skills:\n`;
    trending.slice(0, 3).forEach((skill, i) => {
      analysis += `${i + 1}. ${skill.skill}: ${(skill.growth * 100).toFixed(0)}% growth, $${skill.avgRate}/hr\n`;
    });
  }
  
  if (declining.length > 0) {
    analysis += `\nDeclining Skills (avoid investing time):\n`;
    declining.forEach(skill => {
      analysis += `• ${skill.skill}: ${(skill.growth * 100).toFixed(0)}% decline\n`;
    });
  }
  
  return analysis;
}

function generateTrendRecommendations(trending) {
  const recommendations = [];
  
  if (trending.length > 0) {
    recommendations.push({
      type: 'invest',
      skill: trending[0].skill,
      reason: `Highest trend score (${trending[0].trendScore.toFixed(1)}), strong growth and demand`
    });
    
    const highGrowthSkills = trending.filter(s => s.growth > 0.25);
    if (highGrowthSkills.length > 0) {
      recommendations.push({
        type: 'fast_track',
        skills: highGrowthSkills.slice(0, 3).map(s => s.skill),
        reason: 'Extremely high growth rates, early adoption advantage'
      });
    }
  }
  
  return recommendations;
}

function generatePositionRecommendations(position, avgDemand, avgGrowth) {
  const recommendations = [];
  
  if (position === 'weak') {
    recommendations.push('Focus on high-demand skills immediately');
    recommendations.push('Consider pivoting to growing markets');
  } else if (position === 'average') {
    recommendations.push('Add 1-2 high-growth skills to strengthen position');
    recommendations.push('Develop skill combinations for competitive advantage');
  } else if (position === 'strong') {
    recommendations.push('Maintain current skills while exploring premium niches');
    recommendations.push('Consider thought leadership and personal branding');
  } else {
    recommendations.push('Perfect position - focus on premium pricing and selective clients');
    recommendations.push('Share expertise through content and speaking');
  }
  
  return recommendations;
}

function generatePlatformRecommendation(platform, data) {
  if (data.score > 80) return 'Excellent fit - prioritize this platform';
  if (data.score > 60) return 'Good fit - include in strategy';
  if (data.score > 40) return 'Limited fit - consider for specific skills';
  return 'Poor fit - avoid or use sparingly';
}

function generateAdvantageRecommendations(current, potential) {
  const recommendations = [];
  
  if (current.length === 0) {
    recommendations.push({
      type: 'develop_combinations',
      priority: 'high',
      message: 'No skill combinations detected. Focus on building complementary skills.'
    });
  }
  
  if (potential.length > 0) {
    const topPotential = potential[0];
    recommendations.push({
      type: 'learn_skill',
      skill: topPotential.missingSkill,
      priority: 'high',
      message: `Learning ${topPotential.missingSkill} would create valuable combination: ${topPotential.combination}`
    });
  }
  
  if (current.length >= 2) {
    recommendations.push({
      type: 'leverage_advantage',
      priority: 'medium',
      message: 'Strong skill combinations detected. Highlight these in proposals and marketing.'
    });
  }
  
  return recommendations;
}

function generatePositioningRecommendations(positioning, uniqueness) {
  const recommendations = [];
  
  if (uniqueness < 60) {
    recommendations.push('Develop more specialized skills to differentiate yourself');
  }
  
  if (positioning === 'generalist') {
    recommendations.push('Consider specializing in a specific domain or skill combination');
  } else if (positioning === 'consultant') {
    recommendations.push('Leverage communication skills for premium consulting rates');
    recommendations.push('Build thought leadership through content creation');
  }
  
  return recommendations;
}

function generateFutureProofingStrategies(avgScore, riskSkills, emergingSkills) {
  const strategies = [];
  
  if (avgScore < 7) {
    strategies.push('Urgent: Portfolio needs future-proofing');
    strategies.push('Phase out at-risk skills over 6-12 months');
  }
  
  if (riskSkills.length > 0) {
    strategies.push(`Replace ${riskSkills[0].skill} with emerging alternatives`);
  }
  
  if (emergingSkills.length > 0) {
    strategies.push(`Prioritize learning ${emergingSkills[0].skill} for future advantage`);
  }
  
  return strategies;
}

function generateFutureProofingTimeline(emergingSkills) {
  return emergingSkills.slice(0, 3).map((skill, index) => ({
    quarter: `Q${index + 1}`,
    skill: skill.skill,
    urgency: skill.urgency,
    rationale: `${skill.growth * 100}% growth, ${skill.demand}/10 demand`
  }));
}

// ─── Module Exports ─────────────────────────────────────────────────────────

module.exports = {
  initializeMarketData,
  getMarketData,
  analyzeTrendingSkills,
  analyzeSkillPricing,
  analyzeCompetitiveAdvantage,
  generateFutureProofingRecommendations,
  calculateTrendScore,
  calculateMarketValue,
  calculateRecommendedRate,
  assessCompetitivePosition,
  analyzeOptimalPlatforms,
  
  // Constants
  DEFAULT_MARKET_DATA,
  PATHS
};

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  
  switch (command) {
    case 'trends':
      console.log(JSON.stringify(analyzeTrendingSkills(), null, 2));
      break;
    case 'market':
      initializeMarketData();
      console.log('Market data initialized');
      break;
    case 'pricing':
      const skills = args.slice(1);
      if (skills.length === 0) {
        console.log('Please provide skills: node market-demand.js pricing javascript react python');
        break;
      }
      console.log(JSON.stringify(analyzeSkillPricing(skills), null, 2));
      break;
    default:
      console.log('Available commands:');
      console.log('  trends     - Show trending skills');
      console.log('  market     - Initialize market data');
      console.log('  pricing <skills...> - Analyze pricing for skills');
  }
}