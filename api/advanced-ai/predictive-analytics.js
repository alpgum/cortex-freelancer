/**
 * Predictive Analytics Engine for Cortex Freelancer
 * Advanced AI features for success prediction and market intelligence
 */

const { Anthropic } = require('@anthropic-ai/sdk');
const FirebaseAuthService = require('../auth/firebase-auth');

class PredictiveAnalyticsEngine {
    constructor() {
        this.anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY
        });
        this.authService = new FirebaseAuthService();
    }

    /**
     * Predict job success probability using historical data and AI analysis
     */
    async predictJobSuccess(userId, jobData) {
        try {
            // Get user's historical data and patterns
            const userContext = await this.getUserSuccessPatterns(userId);
            const marketData = await this.getMarketIntelligence(jobData);
            
            // Analyze job compatibility with advanced scoring
            const compatibility = await this.analyzeJobCompatibility(jobData, userContext, marketData);
            
            // Use AI to predict success probability
            const aiPrediction = await this.getAIPrediction(jobData, userContext, compatibility);
            
            return {
                success: true,
                prediction: {
                    successProbability: compatibility.score,
                    confidenceLevel: aiPrediction.confidence,
                    factors: compatibility.factors,
                    recommendations: aiPrediction.recommendations,
                    riskFactors: aiPrediction.risks,
                    optimizationTips: aiPrediction.optimizations
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Analyze user's success patterns from historical data
     */
    async getUserSuccessPatterns(userId) {
        try {
            const db = this.authService.db;
            
            // Get user applications and their outcomes
            const applicationsSnapshot = await db
                .collection('job_applications')
                .where('userId', '==', userId)
                .orderBy('appliedAt', 'desc')
                .limit(50)
                .get();
            
            const applications = applicationsSnapshot.docs.map(doc => doc.data());
            
            // Analyze patterns
            const patterns = {
                totalApplications: applications.length,
                successfulApplications: applications.filter(app => app.status === 'hired').length,
                avgResponseTime: this.calculateAverageResponseTime(applications),
                preferredBudgetRange: this.analyzePreferredBudgets(applications),
                successfulSkills: this.analyzeSuccessfulSkills(applications),
                preferredClientTypes: this.analyzeClientTypes(applications),
                timeToHire: this.analyzeTimeToHire(applications),
                seasonalPatterns: this.analyzeSeasonalPatterns(applications)
            };
            
            patterns.successRate = patterns.totalApplications > 0 ? 
                (patterns.successfulApplications / patterns.totalApplications) * 100 : 0;
            
            return patterns;
        } catch (error) {
            console.error('Error analyzing user patterns:', error);
            return {
                totalApplications: 0,
                successRate: 0,
                avgResponseTime: 0,
                preferredBudgetRange: { min: 25, max: 75 },
                successfulSkills: [],
                preferredClientTypes: [],
                timeToHire: 0,
                seasonalPatterns: {}
            };
        }
    }

    /**
     * Get market intelligence for the job
     */
    async getMarketIntelligence(jobData) {
        try {
            const db = this.authService.db;
            
            // Get market data for skills and location
            const marketDoc = await db.collection('market_data').doc('skills').get();
            const marketData = marketDoc.exists ? marketDoc.data() : {};
            
            const intelligence = {
                skillDemand: this.analyzeSkillDemand(jobData.skills, marketData.popular_skills || []),
                budgetCompetitiveness: this.analyzeBudgetCompetitiveness(jobData, marketData.market_rates || {}),
                competitionLevel: await this.analyzeCompetitionLevel(jobData),
                marketTrends: this.analyzeMarketTrends(jobData.skills, marketData.popular_skills || []),
                locationPremium: this.analyzeLocationPremium(jobData.location, marketData.market_rates || {})
            };
            
            return intelligence;
        } catch (error) {
            console.error('Error getting market intelligence:', error);
            return {
                skillDemand: 'medium',
                budgetCompetitiveness: 'average',
                competitionLevel: 'medium',
                marketTrends: [],
                locationPremium: 1.0
            };
        }
    }

    /**
     * Analyze job compatibility with advanced ML-style scoring
     */
    async analyzeJobCompatibility(jobData, userContext, marketData) {
        let score = 0;
        const factors = [];
        const maxScore = 100;
        
        // Historical success rate impact (30% weight)
        const historyScore = (userContext.successRate / 100) * 30;
        score += historyScore;
        factors.push({
            factor: 'Historical Success Rate',
            impact: historyScore,
            description: `${userContext.successRate.toFixed(1)}% success rate from ${userContext.totalApplications} applications`
        });
        
        // Skill match analysis (25% weight)
        const skillMatch = this.calculateSkillMatch(jobData.skills, userContext.successfulSkills);
        const skillScore = skillMatch * 25;
        score += skillScore;
        factors.push({
            factor: 'Skill Match',
            impact: skillScore,
            description: `${(skillMatch * 100).toFixed(1)}% skill alignment with your successful projects`
        });
        
        // Budget compatibility (20% weight)
        const budgetMatch = this.calculateBudgetMatch(jobData, userContext.preferredBudgetRange);
        const budgetScore = budgetMatch * 20;
        score += budgetScore;
        factors.push({
            factor: 'Budget Compatibility',
            impact: budgetScore,
            description: `Budget ${budgetMatch > 0.8 ? 'strongly' : budgetMatch > 0.6 ? 'moderately' : 'weakly'} aligns with your range`
        });
        
        // Market conditions (15% weight)
        const marketScore = this.calculateMarketScore(marketData) * 15;
        score += marketScore;
        factors.push({
            factor: 'Market Conditions',
            impact: marketScore,
            description: `${marketData.skillDemand} demand for required skills`
        });
        
        // Competition level (10% weight)
        const competitionScore = this.calculateCompetitionScore(marketData.competitionLevel) * 10;
        score += competitionScore;
        factors.push({
            factor: 'Competition Level',
            impact: competitionScore,
            description: `${marketData.competitionLevel} competition expected`
        });
        
        return {
            score: Math.min(100, Math.max(0, score)),
            factors: factors,
            recommendation: this.getScoreRecommendation(score)
        };
    }

    /**
     * Get AI-powered prediction and recommendations
     */
    async getAIPrediction(jobData, userContext, compatibility) {
        try {
            const prompt = this.buildPredictionPrompt(jobData, userContext, compatibility);
            
            const response = await this.anthropic.messages.create({
                model: 'claude-3-sonnet-20240229',
                max_tokens: 1000,
                system: this.getPredictionSystemPrompt(),
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            });
            
            const aiAnalysis = this.parseAIResponse(response.content[0].text);
            
            return {
                confidence: aiAnalysis.confidence || 75,
                recommendations: aiAnalysis.recommendations || [],
                risks: aiAnalysis.risks || [],
                optimizations: aiAnalysis.optimizations || []
            };
        } catch (error) {
            console.error('AI prediction failed:', error);
            return {
                confidence: 50,
                recommendations: ['Apply with a well-crafted proposal'],
                risks: ['Standard competition risks'],
                optimizations: ['Highlight relevant experience']
            };
        }
    }

    /**
     * Build prompt for AI prediction
     */
    buildPredictionPrompt(jobData, userContext, compatibility) {
        return `
Analyze this freelance job opportunity for success prediction:

JOB DETAILS:
- Title: ${jobData.title}
- Budget: ${jobData.budget} (${jobData.budgetType})
- Skills: ${jobData.skills?.join(', ')}
- Client Rating: ${jobData.clientInfo?.rating}/5
- Proposals: ${jobData.proposals} other applicants

FREELANCER PROFILE:
- Success Rate: ${userContext.successRate}%
- Total Applications: ${userContext.totalApplications}
- Preferred Skills: ${userContext.successfulSkills.join(', ')}
- Avg Response Time: ${userContext.avgResponseTime} days

COMPATIBILITY ANALYSIS:
- Overall Score: ${compatibility.score.toFixed(1)}/100
- Key Factors: ${compatibility.factors.map(f => f.factor).join(', ')}

Provide analysis in this format:
CONFIDENCE: [0-100]
RECOMMENDATIONS: [3 specific actions]
RISKS: [2-3 potential issues]
OPTIMIZATIONS: [2-3 proposal improvements]
        `;
    }

    /**
     * System prompt for AI prediction
     */
    getPredictionSystemPrompt() {
        return `You are an expert freelance market analyst with access to thousands of successful project outcomes. 
        
Analyze job opportunities based on:
- Historical success patterns
- Market dynamics  
- Client behavior indicators
- Competition analysis
- Budget/skill alignment

Provide actionable insights that help freelancers make informed decisions and optimize their proposals for maximum success probability.`;
    }

    /**
     * Parse AI response into structured data
     */
    parseAIResponse(text) {
        try {
            const sections = {
                confidence: 75,
                recommendations: [],
                risks: [],
                optimizations: []
            };
            
            const lines = text.split('\n');
            let currentSection = null;
            
            for (const line of lines) {
                const trimmed = line.trim();
                
                if (trimmed.startsWith('CONFIDENCE:')) {
                    const match = trimmed.match(/(\d+)/);
                    sections.confidence = match ? parseInt(match[1]) : 75;
                } else if (trimmed.startsWith('RECOMMENDATIONS:')) {
                    currentSection = 'recommendations';
                } else if (trimmed.startsWith('RISKS:')) {
                    currentSection = 'risks';
                } else if (trimmed.startsWith('OPTIMIZATIONS:')) {
                    currentSection = 'optimizations';
                } else if (trimmed.startsWith('-') && currentSection) {
                    sections[currentSection].push(trimmed.substring(1).trim());
                }
            }
            
            return sections;
        } catch (error) {
            console.error('Error parsing AI response:', error);
            return {
                confidence: 50,
                recommendations: ['Submit a personalized proposal'],
                risks: ['Standard market competition'],
                optimizations: ['Emphasize relevant experience']
            };
        }
    }

    /**
     * Helper methods for analysis calculations
     */
    calculateSkillMatch(jobSkills, userSkills) {
        if (!jobSkills || !userSkills || userSkills.length === 0) return 0.5;
        
        const matches = jobSkills.filter(skill => 
            userSkills.some(userSkill => 
                userSkill.toLowerCase().includes(skill.toLowerCase()) ||
                skill.toLowerCase().includes(userSkill.toLowerCase())
            )
        );
        
        return matches.length / jobSkills.length;
    }

    calculateBudgetMatch(jobData, userBudgetRange) {
        if (!userBudgetRange || typeof userBudgetRange !== 'object') return 0.5;
        const jobBudget = jobData.budget;
        const { min, max } = userBudgetRange;
        
        if (jobBudget >= min && jobBudget <= max) return 1.0;
        if (jobBudget < min) return Math.max(0, jobBudget / min);
        if (jobBudget > max) return Math.max(0.7, max / jobBudget);
        
        return 0.5;
    }

    calculateMarketScore(marketData) {
        const demandScores = { high: 1.0, medium: 0.7, low: 0.4 };
        return demandScores[marketData.skillDemand] || 0.5;
    }

    calculateCompetitionScore(competitionLevel) {
        const competitionScores = { low: 1.0, medium: 0.6, high: 0.3 };
        return competitionScores[competitionLevel] || 0.5;
    }

    getScoreRecommendation(score) {
        if (score >= 80) return 'highly_recommended';
        if (score >= 60) return 'recommended';
        if (score >= 40) return 'consider';
        return 'skip';
    }

    // Additional helper methods for pattern analysis
    calculateAverageResponseTime(applications) {
        const responseTimes = applications
            .filter(app => app.clientResponseTime)
            .map(app => app.clientResponseTime);
        
        return responseTimes.length > 0 ? 
            responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length : 0;
    }

    analyzePreferredBudgets(applications) {
        const budgets = applications
            .filter(app => app.jobBudget)
            .map(app => app.jobBudget);
        
        if (budgets.length === 0) return { min: 25, max: 75 };
        
        budgets.sort((a, b) => a - b);
        return {
            min: budgets[Math.floor(budgets.length * 0.25)],
            max: budgets[Math.floor(budgets.length * 0.75)]
        };
    }

    analyzeSuccessfulSkills(applications) {
        const successfulApps = applications.filter(app => app.status === 'hired');
        const skillCounts = {};
        
        successfulApps.forEach(app => {
            if (app.jobSkills) {
                app.jobSkills.forEach(skill => {
                    skillCounts[skill] = (skillCounts[skill] || 0) + 1;
                });
            }
        });
        
        return Object.entries(skillCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([skill]) => skill);
    }

    analyzeClientTypes(applications) {
        const successfulApps = applications.filter(app => app.status === 'hired');
        const typeCounts = {};
        
        successfulApps.forEach(app => {
            if (app.clientType) {
                typeCounts[app.clientType] = (typeCounts[app.clientType] || 0) + 1;
            }
        });
        
        return Object.entries(typeCounts)
            .sort(([,a], [,b]) => b - a)
            .map(([type]) => type);
    }

    analyzeTimeToHire(applications) {
        const hiredApps = applications.filter(app => 
            app.status === 'hired' && app.hiredAt && app.appliedAt
        );
        
        if (hiredApps.length === 0) return 0;
        
        const times = hiredApps.map(app => 
            (new Date(app.hiredAt) - new Date(app.appliedAt)) / (1000 * 60 * 60 * 24)
        );
        
        return times.reduce((sum, time) => sum + time, 0) / times.length;
    }

    analyzeSeasonalPatterns(applications) {
        const monthlySuccess = {};
        
        applications.forEach(app => {
            const month = new Date(app.appliedAt).getMonth();
            if (!monthlySuccess[month]) {
                monthlySuccess[month] = { total: 0, successful: 0 };
            }
            monthlySuccess[month].total++;
            if (app.status === 'hired') {
                monthlySuccess[month].successful++;
            }
        });
        
        return monthlySuccess;
    }

    async analyzeCompetitionLevel(jobData) {
        // Simplified competition analysis
        const proposals = jobData.proposals || 0;
        
        if (proposals < 5) return 'low';
        if (proposals < 15) return 'medium';
        return 'high';
    }

    analyzeSkillDemand(jobSkills, marketSkills) {
        if (!jobSkills || !marketSkills) return 'medium';
        
        const avgDemand = jobSkills.reduce((sum, skill) => {
            const marketSkill = marketSkills.find(ms => 
                ms.name.toLowerCase() === skill.toLowerCase()
            );
            return sum + (marketSkill ? marketSkill.demand_score : 50);
        }, 0) / jobSkills.length;
        
        if (avgDemand >= 85) return 'high';
        if (avgDemand >= 65) return 'medium';
        return 'low';
    }

    analyzeBudgetCompetitiveness(jobData, marketRates) {
        // Simplified budget analysis
        return 'average'; // Would implement full logic in production
    }

    analyzeMarketTrends(skills, marketSkills) {
        return skills.map(skill => {
            const marketSkill = marketSkills.find(ms => 
                ms.name.toLowerCase() === skill.toLowerCase()
            );
            return {
                skill: skill,
                trend: marketSkill?.growth_trend || 'stable',
                demandScore: marketSkill?.demand_score || 50
            };
        });
    }

    analyzeLocationPremium(location, marketRates) {
        const regionRates = marketRates.regions || {};
        const region = regionRates[location];
        
        if (!region) return 1.0;
        
        // Calculate premium based on regional rates
        const globalAvg = Object.values(regionRates).reduce((sum, r) => sum + r.avg, 0) / Object.keys(regionRates).length;
        return region.avg / globalAvg;
    }
}

module.exports = PredictiveAnalyticsEngine;