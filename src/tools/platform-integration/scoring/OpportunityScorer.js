/**
 * Opportunity Scoring Engine
 * Evaluates and ranks job opportunities based on multiple factors
 */

class OpportunityScorer {
    constructor(config = {}) {
        this.config = {
            // Scoring weights
            winProbabilityWeight: 0.25,
            revenuePotentialWeight: 0.25,
            timeInvestmentWeight: 0.20,
            riskFactorsWeight: 0.15,
            strategicValueWeight: 0.10,
            competitionWeight: 0.05,

            // Win probability factors
            competitionThresholds: {
                low: 5,      // < 5 competitors = high win probability
                medium: 15,  // 5-15 competitors = medium win probability
                high: 30     // > 30 competitors = low win probability
            },

            // Revenue calculation parameters
            baseHourlyRate: 50,
            hourlyRateMultipliers: {
                'javascript': 1.2,
                'react': 1.3,
                'node.js': 1.2,
                'python': 1.1,
                'machine learning': 1.8,
                'blockchain': 2.0,
                'devops': 1.4,
                'ai': 1.7
            },

            // Risk assessment parameters
            riskFactors: {
                newClient: 0.3,
                lowBudget: 0.4,
                vagueRequirements: 0.5,
                urgentDeadline: 0.3,
                noPaymentVerification: 0.6,
                previousBadReviews: 0.8
            },

            // Time investment estimates (hours)
            projectTypeHours: {
                'website': { min: 40, max: 200 },
                'mobile app': { min: 100, max: 500 },
                'api': { min: 20, max: 100 },
                'design': { min: 10, max: 50 },
                'content': { min: 5, max: 30 }
            },

            ...config
        };
    }

    /**
     * Score a job opportunity
     * @param {Object} job - Job listing
     * @param {Object} profile - Freelancer profile (optional)
     * @returns {Promise<Object>} Opportunity score and breakdown
     */
    async scoreOpportunity(job, profile = null) {
        try {
            const scores = {
                winProbability: this.calculateWinProbability(job, profile),
                revenuePotential: this.calculateRevenuePotential(job, profile),
                timeInvestment: this.calculateTimeInvestment(job),
                riskFactors: this.calculateRiskFactors(job),
                strategicValue: this.calculateStrategicValue(job, profile),
                competition: this.calculateCompetitionScore(job)
            };

            // Calculate weighted total score
            const totalScore = this.calculateWeightedScore(scores);

            // Generate insights and recommendations
            const insights = this.generateInsights(scores, job, profile);

            return {
                totalScore: Math.round(totalScore),
                breakdown: scores,
                insights,
                recommendation: this.generateRecommendation(totalScore, scores),
                estimatedROI: this.calculateROI(scores),
                riskLevel: this.getRiskLevel(scores.riskFactors),
                competitionLevel: this.getCompetitionLevel(job.competition || 0),
                calculatedAt: new Date()
            };

        } catch (error) {
            console.error('Opportunity scoring failed:', error);
            return this.getDefaultScore();
        }
    }

    /**
     * Calculate win probability based on competition and profile match
     * @param {Object} job - Job listing
     * @param {Object} profile - Freelancer profile
     * @returns {number} Win probability score (0-100)
     */
    calculateWinProbability(job, profile) {
        let baseScore = 50; // Start with 50% base probability

        // Competition factor
        const competition = job.competition || 0;
        if (competition < this.config.competitionThresholds.low) {
            baseScore += 30; // High chance with low competition
        } else if (competition < this.config.competitionThresholds.medium) {
            baseScore += 10; // Medium chance
        } else if (competition > this.config.competitionThresholds.high) {
            baseScore -= 20; // Low chance with high competition
        }

        // Profile match bonus (if profile provided)
        if (profile && job.matchScore) {
            const matchBonus = (job.matchScore - 50) * 0.4; // Convert match score to bonus
            baseScore += matchBonus;
        }

        // Client history factor
        if (job.client) {
            if (job.client.hireRate > 80) {
                baseScore += 10; // Client hires frequently
            } else if (job.client.hireRate < 20) {
                baseScore -= 15; // Client rarely hires
            }

            if (job.client.rating > 4.5) {
                baseScore += 5; // High-rated client
            } else if (job.client.rating < 3.5) {
                baseScore -= 10; // Low-rated client
            }
        }

        // Urgency bonus (less time for competitors to apply)
        if (job.isUrgent) {
            baseScore += 5;
        }

        // Platform-specific adjustments
        if (job.platform === 'upwork') {
            baseScore -= 5; // Generally more competitive
        } else if (job.platform === 'toptal') {
            baseScore -= 20; // Highly selective
        }

        return Math.max(5, Math.min(95, baseScore));
    }

    /**
     * Calculate revenue potential
     * @param {Object} job - Job listing
     * @param {Object} profile - Freelancer profile
     * @returns {number} Revenue potential score (0-100)
     */
    calculateRevenuePotential(job, profile) {
        if (!job.budget || (!job.budget.min && !job.budget.max)) {
            return 30; // Low score for undefined budget
        }

        const budget = job.budget.min || job.budget.max || 0;
        let revenueScore = 0;

        // Base revenue calculation
        if (job.budget.type === 'hourly') {
            const estimatedHours = this.estimateProjectHours(job);
            const totalRevenue = budget * estimatedHours;
            revenueScore = this.normalizeRevenue(totalRevenue);
        } else {
            revenueScore = this.normalizeRevenue(budget);
        }

        // Skill premium bonus
        if (job.skills && profile) {
            const premiumSkills = job.skills.filter(skill => 
                this.config.hourlyRateMultipliers[skill.toLowerCase()]
            );
            
            if (premiumSkills.length > 0) {
                const avgMultiplier = premiumSkills.reduce((sum, skill) => 
                    sum + this.config.hourlyRateMultipliers[skill.toLowerCase()], 0
                ) / premiumSkills.length;
                
                revenueScore *= avgMultiplier;
            }
        }

        // Long-term potential
        if (job.isLongTerm || (job.description && job.description.includes('ongoing'))) {
            revenueScore *= 1.3; // 30% bonus for recurring work
        }

        // Enterprise client bonus
        if (job.client && job.client.totalSpent > 50000) {
            revenueScore *= 1.2; // 20% bonus for high-spending clients
        }

        return Math.min(100, revenueScore);
    }

    /**
     * Calculate time investment score
     * @param {Object} job - Job listing
     * @returns {number} Time investment efficiency score (0-100)
     */
    calculateTimeInvestment(job) {
        const estimatedHours = this.estimateProjectHours(job);
        const budget = job.budget ? (job.budget.min || job.budget.max || 0) : 0;

        if (estimatedHours === 0 || budget === 0) {
            return 50; // Neutral score if can't estimate
        }

        // Calculate hourly rate
        const effectiveHourlyRate = job.budget.type === 'hourly' ? budget : budget / estimatedHours;
        
        // Score based on rate efficiency
        const rateScore = this.normalizeHourlyRate(effectiveHourlyRate);

        // Complexity factor
        let complexityScore = 70; // Base complexity score

        if (job.description) {
            const description = job.description.toLowerCase();
            
            // Simple projects get higher time efficiency
            if (description.includes('simple') || description.includes('basic')) {
                complexityScore += 20;
            } 
            // Complex projects get lower time efficiency
            else if (description.includes('complex') || description.includes('advanced') || 
                     description.includes('enterprise')) {
                complexityScore -= 20;
            }

            // Well-defined projects are more time efficient
            if (description.includes('detailed requirements') || description.includes('spec') ||
                description.includes('wireframes')) {
                complexityScore += 10;
            }
        }

        // Timeline pressure factor
        if (job.timeline) {
            const requiredDays = this.parseTimelineToDays(job.timeline);
            const estimatedDays = Math.ceil(estimatedHours / 8);
            
            if (requiredDays < estimatedDays * 0.8) {
                complexityScore -= 15; // Tight timeline reduces efficiency
            } else if (requiredDays > estimatedDays * 1.5) {
                complexityScore += 10; // Comfortable timeline
            }
        }

        return Math.max(10, Math.min(100, (rateScore + complexityScore) / 2));
    }

    /**
     * Calculate risk factors
     * @param {Object} job - Job listing
     * @returns {number} Risk score (0-100, where 100 is lowest risk)
     */
    calculateRiskFactors(job) {
        let riskScore = 100; // Start with lowest risk
        const risks = [];

        // Client-related risks
        if (job.client) {
            if (!job.client.isVerified) {
                riskScore -= 15;
                risks.push('Unverified client');
            }

            if (!job.client.paymentVerified) {
                riskScore -= 20;
                risks.push('Payment not verified');
            }

            if (job.client.rating && job.client.rating < 3.5) {
                riskScore -= 25;
                risks.push('Low client rating');
            }

            if (job.client.reviewCount < 3) {
                riskScore -= 10;
                risks.push('New client with few reviews');
            }

            if (job.client.hireRate && job.client.hireRate < 30) {
                riskScore -= 15;
                risks.push('Low hire rate');
            }
        } else {
            riskScore -= 20;
            risks.push('No client information available');
        }

        // Project-related risks
        if (job.budget && job.budget.min < 100) {
            riskScore -= 15;
            risks.push('Very low budget');
        }

        if (job.isUrgent) {
            riskScore -= 10;
            risks.push('Urgent timeline');
        }

        // Description quality risks
        if (job.description) {
            const description = job.description.toLowerCase();
            const descLength = job.description.length;

            if (descLength < 100) {
                riskScore -= 15;
                risks.push('Very short description');
            }

            if (description.includes('asap') || description.includes('urgent') || 
                description.includes('rush')) {
                riskScore -= 10;
                risks.push('Rush job indicators');
            }

            if (description.includes('cheap') || description.includes('budget')) {
                riskScore -= 10;
                risks.push('Budget-focused language');
            }

            // Positive indicators
            if (description.includes('detailed') || description.includes('specification') ||
                description.includes('requirements')) {
                riskScore += 5;
            }
        } else {
            riskScore -= 20;
            risks.push('No project description');
        }

        // Competition risk
        if (job.competition > 50) {
            riskScore -= 10;
            risks.push('Very high competition');
        }

        // Platform-specific risks
        if (job.platform === 'freelancer' && job.budget && job.budget.min < 50) {
            riskScore -= 10;
            risks.push('Low-quality platform posting');
        }

        return {
            score: Math.max(0, Math.min(100, riskScore)),
            risks: risks
        };
    }

    /**
     * Calculate strategic value of opportunity
     * @param {Object} job - Job listing
     * @param {Object} profile - Freelancer profile
     * @returns {number} Strategic value score (0-100)
     */
    calculateStrategicValue(job, profile) {
        let strategicScore = 50; // Base strategic value

        // Skill development opportunity
        if (job.skills && profile && profile.targetSkills) {
            const skillOverlap = job.skills.filter(skill => 
                profile.targetSkills.includes(skill.toLowerCase())
            );
            
            if (skillOverlap.length > 0) {
                strategicScore += 20 * (skillOverlap.length / job.skills.length);
            }
        }

        // Portfolio building value
        if (job.category) {
            const portfolioValue = this.getPortfolioValue(job.category, profile);
            strategicScore += portfolioValue;
        }

        // Client relationship building
        if (job.client && job.client.totalSpent > 10000) {
            strategicScore += 15; // Good long-term client potential
        }

        // Industry/domain strategic value
        if (job.description) {
            const description = job.description.toLowerCase();
            const strategicKeywords = [
                'startup', 'enterprise', 'saas', 'fintech', 'healthcare',
                'ai', 'machine learning', 'blockchain', 'crypto'
            ];

            const keywordMatches = strategicKeywords.filter(keyword => 
                description.includes(keyword)
            );

            if (keywordMatches.length > 0) {
                strategicScore += 10 * keywordMatches.length;
            }
        }

        // Reference/testimonial potential
        if (job.client && job.client.rating > 4.5 && job.client.reviewCount > 20) {
            strategicScore += 10; // Good reference potential
        }

        // Innovation and learning opportunity
        if (this.isInnovativeProject(job)) {
            strategicScore += 15;
        }

        return Math.max(0, Math.min(100, strategicScore));
    }

    /**
     * Calculate competition score
     * @param {Object} job - Job listing
     * @returns {number} Competition advantage score (0-100)
     */
    calculateCompetitionScore(job) {
        const competition = job.competition || 0;
        
        if (competition === 0) return 100; // No competition
        if (competition < 5) return 90;    // Very low competition
        if (competition < 10) return 75;   // Low competition
        if (competition < 20) return 60;   // Medium competition
        if (competition < 50) return 40;   // High competition
        return 20; // Very high competition
    }

    /**
     * Calculate weighted total score
     * @param {Object} scores - Individual scores
     * @returns {number} Weighted total score (0-100)
     */
    calculateWeightedScore(scores) {
        const riskScore = typeof scores.riskFactors === 'object' ? 
            scores.riskFactors.score : scores.riskFactors;

        return (
            scores.winProbability * this.config.winProbabilityWeight +
            scores.revenuePotential * this.config.revenuePotentialWeight +
            scores.timeInvestment * this.config.timeInvestmentWeight +
            riskScore * this.config.riskFactorsWeight +
            scores.strategicValue * this.config.strategicValueWeight +
            scores.competition * this.config.competitionWeight
        );
    }

    // Helper methods
    estimateProjectHours(job) {
        if (!job.description && !job.category) {
            return 40; // Default estimate
        }

        let estimatedHours = 40; // Base estimate

        // Category-based estimation
        if (job.category) {
            const categoryLower = job.category.toLowerCase();
            for (const [type, hours] of Object.entries(this.config.projectTypeHours)) {
                if (categoryLower.includes(type)) {
                    estimatedHours = (hours.min + hours.max) / 2;
                    break;
                }
            }
        }

        // Description-based adjustment
        if (job.description) {
            const description = job.description.toLowerCase();
            const wordCount = job.description.split(' ').length;

            // Adjust based on description length and complexity indicators
            if (wordCount > 500 || description.includes('complex') || description.includes('enterprise')) {
                estimatedHours *= 1.5;
            } else if (wordCount < 100 || description.includes('simple') || description.includes('basic')) {
                estimatedHours *= 0.7;
            }

            // Feature counting
            const features = (description.match(/feature|function|module|component/g) || []).length;
            if (features > 5) {
                estimatedHours += features * 5;
            }
        }

        // Timeline constraint
        if (job.timeline) {
            const timelineDays = this.parseTimelineToDays(job.timeline);
            if (timelineDays > 0) {
                const maxHours = timelineDays * 8; // Assume 8 hours per day
                estimatedHours = Math.min(estimatedHours, maxHours);
            }
        }

        return Math.max(5, Math.min(500, estimatedHours)); // Cap between 5-500 hours
    }

    normalizeRevenue(revenue) {
        // Normalize revenue to 0-100 scale
        if (revenue < 100) return 20;
        if (revenue < 500) return 40;
        if (revenue < 1000) return 60;
        if (revenue < 5000) return 80;
        if (revenue < 10000) return 90;
        return 100; // High value projects
    }

    normalizeHourlyRate(rate) {
        // Normalize hourly rate to 0-100 scale based on market rates
        const baseRate = this.config.baseHourlyRate;
        
        if (rate < baseRate * 0.5) return 20;  // Very low rate
        if (rate < baseRate * 0.8) return 40;  // Below market
        if (rate < baseRate * 1.2) return 70;  // Market rate
        if (rate < baseRate * 1.5) return 85;  // Above market
        return 95; // Premium rate
    }

    parseTimelineToDays(timeline) {
        if (!timeline) return 0;
        
        if (typeof timeline === 'number') return timeline;
        
        const timelineStr = timeline.toString().toLowerCase();
        
        if (timelineStr.includes('day')) {
            const match = timelineStr.match(/(\d+)\s*days?/);
            return match ? parseInt(match[1]) : 0;
        } else if (timelineStr.includes('week')) {
            const match = timelineStr.match(/(\d+)\s*weeks?/);
            return match ? parseInt(match[1]) * 7 : 0;
        } else if (timelineStr.includes('month')) {
            const match = timelineStr.match(/(\d+)\s*months?/);
            return match ? parseInt(match[1]) * 30 : 0;
        }
        
        return 0;
    }

    getPortfolioValue(category, profile) {
        if (!profile || !profile.portfolio) return 0;
        
        const portfolioCategories = profile.portfolio.map(item => item.category || '').filter(Boolean);
        
        // Higher value if this category is missing from portfolio
        if (!portfolioCategories.includes(category)) {
            return 15; // Portfolio gap bonus
        }
        
        // Lower value if already well-represented
        const categoryCount = portfolioCategories.filter(cat => cat === category).length;
        return Math.max(0, 10 - categoryCount * 2);
    }

    isInnovativeProject(job) {
        if (!job.description) return false;
        
        const innovationKeywords = [
            'new technology', 'cutting edge', 'innovative', 'startup',
            'ai', 'machine learning', 'blockchain', 'vr', 'ar',
            'iot', 'quantum', 'research', 'prototype'
        ];
        
        const description = job.description.toLowerCase();
        return innovationKeywords.some(keyword => description.includes(keyword));
    }

    generateInsights(scores, job, profile) {
        const insights = [];
        const riskScore = typeof scores.riskFactors === 'object' ? 
            scores.riskFactors.score : scores.riskFactors;

        // Win probability insights
        if (scores.winProbability > 80) {
            insights.push('🎯 High win probability - strong match for your profile');
        } else if (scores.winProbability < 40) {
            insights.push('⚠️ Low win probability - very competitive or poor match');
        }

        // Revenue insights
        if (scores.revenuePotential > 80) {
            insights.push('💰 High revenue potential - excellent earning opportunity');
        } else if (scores.revenuePotential < 40) {
            insights.push('💸 Low revenue potential - consider if worth the effort');
        }

        // Time efficiency insights
        if (scores.timeInvestment > 80) {
            insights.push('⚡ Excellent time efficiency - quick turnaround possible');
        } else if (scores.timeInvestment < 40) {
            insights.push('🕒 Time intensive - may require significant investment');
        }

        // Risk insights
        if (riskScore < 40) {
            insights.push('🚨 High risk factors - proceed with caution');
        } else if (riskScore > 80) {
            insights.push('✅ Low risk - reliable opportunity');
        }

        // Strategic insights
        if (scores.strategicValue > 80) {
            insights.push('🚀 High strategic value - great for career growth');
        }

        // Competition insights
        if (scores.competition > 80) {
            insights.push('🏃‍♂️ Low competition - act quickly');
        } else if (scores.competition < 30) {
            insights.push('🥊 High competition - strong proposal needed');
        }

        return insights;
    }

    generateRecommendation(totalScore, scores) {
        if (totalScore >= 80) {
            return 'HIGHLY RECOMMENDED - Excellent opportunity across all factors';
        } else if (totalScore >= 70) {
            return 'RECOMMENDED - Good opportunity with strong potential';
        } else if (totalScore >= 60) {
            return 'CONSIDER - Decent opportunity, evaluate based on your current workload';
        } else if (totalScore >= 50) {
            return 'CAUTION - Mixed opportunity, proceed only if it fills a specific need';
        } else {
            return 'NOT RECOMMENDED - Too many negative factors';
        }
    }

    calculateROI(scores) {
        const riskScore = typeof scores.riskFactors === 'object' ? 
            scores.riskFactors.score : scores.riskFactors;

        // Simple ROI calculation: (Revenue Potential * Win Probability) / (100 - Risk Score)
        const successPotential = (scores.revenuePotential * scores.winProbability) / 100;
        const riskAdjustment = Math.max(10, riskScore) / 100; // Prevent division by zero
        
        return Math.round((successPotential / (2 - riskAdjustment)) * 100) / 100;
    }

    getRiskLevel(riskScore) {
        const score = typeof riskScore === 'object' ? riskScore.score : riskScore;
        
        if (score >= 80) return 'LOW';
        if (score >= 60) return 'MEDIUM';
        if (score >= 40) return 'HIGH';
        return 'VERY HIGH';
    }

    getCompetitionLevel(competition) {
        if (competition < 5) return 'LOW';
        if (competition < 15) return 'MEDIUM';
        if (competition < 30) return 'HIGH';
        return 'VERY HIGH';
    }

    getDefaultScore() {
        return {
            totalScore: 50,
            breakdown: {
                winProbability: 50,
                revenuePotential: 50,
                timeInvestment: 50,
                riskFactors: { score: 50, risks: ['Unable to assess risks'] },
                strategicValue: 50,
                competition: 50
            },
            insights: ['Unable to fully analyze opportunity'],
            recommendation: 'INSUFFICIENT DATA - Manual review required',
            estimatedROI: 1.0,
            riskLevel: 'UNKNOWN',
            competitionLevel: 'UNKNOWN',
            calculatedAt: new Date()
        };
    }

    /**
     * Batch score multiple opportunities
     * @param {Object[]} jobs - Array of job listings
     * @param {Object} profile - Freelancer profile
     * @returns {Promise<Object[]>} Array of scored opportunities
     */
    async scoreOpportunities(jobs, profile = null) {
        const scoredJobs = [];
        
        for (const job of jobs) {
            try {
                const score = await this.scoreOpportunity(job, profile);
                scoredJobs.push({
                    ...job,
                    opportunityScore: score
                });
            } catch (error) {
                console.error(`Failed to score job ${job.id}:`, error);
                scoredJobs.push({
                    ...job,
                    opportunityScore: this.getDefaultScore()
                });
            }
        }
        
        // Sort by total score (highest first)
        return scoredJobs.sort((a, b) => 
            b.opportunityScore.totalScore - a.opportunityScore.totalScore
        );
    }
}

module.exports = OpportunityScorer;