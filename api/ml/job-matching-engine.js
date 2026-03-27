/**
 * Machine Learning Job Matching Engine for Cortex Freelancer
 * Advanced algorithms for personalized job recommendations and success prediction
 */

const { Anthropic } = require('@anthropic-ai/sdk');

class JobMatchingEngine {
    constructor() {
        this.anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY
        });
        
        // Feature weights for matching algorithm
        this.featureWeights = {
            skillMatch: 0.35,
            experienceLevel: 0.25,
            budgetCompatibility: 0.20,
            timelineMatch: 0.10,
            clientQuality: 0.10
        };
        
        // Learning parameters
        this.learningRate = 0.01;
        this.regularization = 0.001;
        this.maxIterations = 1000;
        
        this.skillEmbeddings = new Map();
        this.userProfiles = new Map();
        this.jobHistory = new Map();
    }

    /**
     * Find best job matches for user with ML-powered ranking
     */
    async findMatches(userId, availableJobs, limit = 10) {
        try {
            const userProfile = await this.getUserProfile(userId);
            const rankedJobs = await this.rankJobs(userProfile, availableJobs);
            
            // Apply diversity and freshness factors
            const diversifiedJobs = this.diversifyResults(rankedJobs, userProfile);
            
            return {
                success: true,
                matches: diversifiedJobs.slice(0, limit),
                totalAnalyzed: availableJobs.length,
                algorithm: 'ml-enhanced-ranking',
                confidence: this.calculateOverallConfidence(diversifiedJobs.slice(0, limit))
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                matches: []
            };
        }
    }

    /**
     * Rank jobs using multi-factor ML algorithm
     */
    async rankJobs(userProfile, jobs) {
        const rankedJobs = [];
        
        for (const job of jobs) {
            const score = await this.calculateJobScore(userProfile, job);
            rankedJobs.push({
                ...job,
                matchScore: score.overall,
                confidence: score.confidence,
                factors: score.factors,
                recommendations: score.recommendations
            });
        }
        
        // Sort by match score (descending)
        return rankedJobs.sort((a, b) => b.matchScore - a.matchScore);
    }

    /**
     * Calculate comprehensive job match score
     */
    async calculateJobScore(userProfile, job) {
        const factors = {
            skillMatch: this.calculateSkillMatch(userProfile, job),
            experienceLevel: this.calculateExperienceMatch(userProfile, job),
            budgetCompatibility: this.calculateBudgetMatch(userProfile, job),
            timelineMatch: this.calculateTimelineMatch(userProfile, job),
            clientQuality: this.calculateClientQuality(job)
        };
        
        // Weighted sum of factors
        let overall = 0;
        for (const [factor, value] of Object.entries(factors)) {
            overall += value * this.featureWeights[factor];
        }
        
        // Apply user-specific adjustments
        overall = this.applyPersonalizedAdjustments(overall, userProfile, job);
        
        // Calculate confidence based on data completeness
        const confidence = this.calculateConfidence(userProfile, job, factors);
        
        return {
            overall: Math.min(100, Math.max(0, overall)),
            confidence,
            factors,
            recommendations: await this.generateRecommendations(userProfile, job, factors)
        };
    }

    /**
     * Advanced skill matching with semantic similarity
     */
    calculateSkillMatch(userProfile, job) {
        const userSkills = userProfile.skills || [];
        const jobSkills = job.skills || [];
        
        if (jobSkills.length === 0) return 50; // Neutral score for unclear requirements
        
        let totalScore = 0;
        let maxPossibleScore = 0;
        
        for (const jobSkill of jobSkills) {
            let bestMatch = 0;
            
            // Exact matches get full points
            if (userSkills.includes(jobSkill)) {
                bestMatch = 100;
            } else {
                // Check for semantic similarity
                bestMatch = this.calculateSemanticSimilarity(jobSkill, userSkills);
            }
            
            totalScore += bestMatch;
            maxPossibleScore += 100;
        }
        
        const baseScore = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;
        
        // Bonus for having more skills than required
        const skillRatio = userSkills.length / jobSkills.length;
        const bonusMultiplier = Math.min(1.2, 1 + (skillRatio - 1) * 0.1);
        
        return Math.min(100, baseScore * bonusMultiplier);
    }

    /**
     * Semantic similarity using simple heuristics (would use embeddings in production)
     */
    calculateSemanticSimilarity(targetSkill, userSkills) {
        const target = targetSkill.toLowerCase();
        let maxSimilarity = 0;
        
        for (const userSkill of userSkills) {
            const user = userSkill.toLowerCase();
            
            // Exact substring match
            if (target.includes(user) || user.includes(target)) {
                maxSimilarity = Math.max(maxSimilarity, 80);
            }
            
            // Technology family matching
            const similarity = this.getTechnologyFamilySimilarity(target, user);
            maxSimilarity = Math.max(maxSimilarity, similarity);
        }
        
        return maxSimilarity;
    }

    /**
     * Technology family similarity (React/Vue.js, Python/Django, etc.)
     */
    getTechnologyFamilySimilarity(skill1, skill2) {
        const techFamilies = {
            frontend: ['react', 'vue', 'angular', 'javascript', 'typescript', 'html', 'css'],
            backend: ['node.js', 'python', 'django', 'flask', 'java', 'spring', 'php', 'laravel'],
            mobile: ['react native', 'flutter', 'swift', 'kotlin', 'ionic'],
            database: ['mysql', 'postgresql', 'mongodb', 'redis', 'firebase'],
            cloud: ['aws', 'azure', 'gcp', 'docker', 'kubernetes']
        };
        
        for (const family of Object.values(techFamilies)) {
            const skill1InFamily = family.some(tech => skill1.includes(tech));
            const skill2InFamily = family.some(tech => skill2.includes(tech));
            
            if (skill1InFamily && skill2InFamily) {
                return 60; // Related technology
            }
        }
        
        return 0;
    }

    /**
     * Experience level matching
     */
    calculateExperienceMatch(userProfile, job) {
        const userLevel = this.normalizeExperienceLevel(userProfile.experienceLevel);
        const jobLevel = this.normalizeExperienceLevel(job.experienceLevel);
        
        if (userLevel === -1 || jobLevel === -1) return 50; // Unknown levels
        
        const difference = Math.abs(userLevel - jobLevel);
        
        if (difference === 0) return 100; // Perfect match
        if (difference === 1) return 75;  // Close match
        if (difference === 2) return 50;  // Acceptable
        return 25; // Poor match
    }

    /**
     * Normalize experience levels to numbers for comparison
     */
    normalizeExperienceLevel(level) {
        if (!level) return -1;
        
        const levelMap = {
            'entry': 1, 'junior': 1, 'beginner': 1,
            'intermediate': 2, 'mid-level': 2, 'experienced': 2,
            'senior': 3, 'expert': 3, 'lead': 3,
            'principal': 4, 'architect': 4, 'director': 4
        };
        
        const normalized = level.toLowerCase();
        return levelMap[normalized] || -1;
    }

    /**
     * Budget compatibility scoring
     */
    calculateBudgetMatch(userProfile, job) {
        const userMin = userProfile.minHourlyRate || 0;
        const userMax = userProfile.maxHourlyRate || 1000;
        const jobBudget = job.budget || 0;
        
        if (job.budgetType === 'fixed') {
            // Convert fixed to hourly estimate
            const estimatedHours = job.estimatedHours || 40;
            const hourlyEquivalent = jobBudget / estimatedHours;
            return this.scoreBudgetRange(hourlyEquivalent, userMin, userMax);
        } else {
            return this.scoreBudgetRange(jobBudget, userMin, userMax);
        }
    }

    scoreBudgetRange(budget, userMin, userMax) {
        if (budget >= userMin && budget <= userMax) return 100; // Perfect fit
        if (budget >= userMin * 0.8 && budget <= userMax * 1.2) return 80; // Close
        if (budget >= userMin * 0.6 && budget <= userMax * 1.5) return 60; // Acceptable
        if (budget < userMin * 0.5) return 20; // Too low
        if (budget > userMax * 2) return 30; // Too high (might be good opportunity)
        return 40; // Moderate mismatch
    }

    /**
     * Timeline compatibility
     */
    calculateTimelineMatch(userProfile, job) {
        const userAvailability = userProfile.availability || 'flexible';
        const jobUrgency = job.urgency || 'normal';
        
        const availabilityScore = {
            'immediate': { 'urgent': 100, 'normal': 80, 'flexible': 60 },
            'thisweek': { 'urgent': 90, 'normal': 100, 'flexible': 80 },
            'flexible': { 'urgent': 50, 'normal': 80, 'flexible': 100 }
        };
        
        return availabilityScore[userAvailability]?.[jobUrgency] || 70;
    }

    /**
     * Client quality assessment
     */
    calculateClientQuality(job) {
        const client = job.clientInfo || {};
        
        let score = 50; // Base score
        
        // Payment verification
        if (client.paymentVerified) score += 20;
        
        // Rating
        if (client.rating) {
            score += (client.rating - 3) * 10; // Scale 1-5 rating to points
        }
        
        // Total spent
        if (client.totalSpent) {
            if (client.totalSpent > 10000) score += 15;
            else if (client.totalSpent > 1000) score += 10;
            else if (client.totalSpent > 100) score += 5;
        }
        
        // Reviews
        if (client.reviewCount > 10) score += 10;
        else if (client.reviewCount > 5) score += 5;
        
        return Math.min(100, Math.max(0, score));
    }

    /**
     * Apply user-specific learning adjustments
     */
    applyPersonalizedAdjustments(baseScore, userProfile, job) {
        let adjustedScore = baseScore;
        
        // Historical performance adjustments
        const userHistory = this.jobHistory.get(userProfile.id) || {};
        
        // Similar project success rate
        const similarJobs = userHistory.completedJobs?.filter(completed => 
            this.areJobsSimilar(completed.job, job)
        ) || [];
        
        if (similarJobs.length > 0) {
            const successRate = similarJobs.reduce((sum, job) => 
                sum + (job.rating >= 4 ? 1 : 0), 0
            ) / similarJobs.length;
            
            // Adjust based on historical success
            adjustedScore *= (0.8 + successRate * 0.4); // 0.8 to 1.2 multiplier
        }
        
        // Recency bias - prefer newer opportunities in growing fields
        if (this.isGrowingField(job.category)) {
            adjustedScore *= 1.1;
        }
        
        return adjustedScore;
    }

    /**
     * Calculate confidence based on data completeness
     */
    calculateConfidence(userProfile, job, factors) {
        let dataPoints = 0;
        let totalPoints = 0;
        
        // User profile completeness
        if (userProfile.skills?.length > 0) dataPoints++;
        if (userProfile.experienceLevel) dataPoints++;
        if (userProfile.minHourlyRate) dataPoints++;
        totalPoints += 3;
        
        // Job completeness
        if (job.skills?.length > 0) dataPoints++;
        if (job.description?.length > 50) dataPoints++;
        if (job.budget > 0) dataPoints++;
        if (job.clientInfo?.rating) dataPoints++;
        totalPoints += 4;
        
        return Math.round((dataPoints / totalPoints) * 100);
    }

    /**
     * Generate personalized recommendations
     */
    async generateRecommendations(userProfile, job, factors) {
        const recommendations = [];
        
        if (factors.skillMatch < 70) {
            const missingSkills = this.identifyMissingSkills(userProfile, job);
            if (missingSkills.length > 0) {
                recommendations.push({
                    type: 'skill_gap',
                    message: `Consider learning: ${missingSkills.slice(0, 3).join(', ')}`,
                    priority: 'medium'
                });
            }
        }
        
        if (factors.budgetCompatibility < 50) {
            const suggestion = job.budget < userProfile.minHourlyRate 
                ? 'This job is below your rate. Consider if it offers good learning opportunities.'
                : 'This high-budget job might be competitive. Ensure your proposal stands out.';
                
            recommendations.push({
                type: 'budget_advice',
                message: suggestion,
                priority: 'high'
            });
        }
        
        if (factors.clientQuality < 60) {
            recommendations.push({
                type: 'client_warning',
                message: 'New client or limited history. Consider asking for milestone payments.',
                priority: 'medium'
            });
        }
        
        return recommendations;
    }

    /**
     * Diversify results to avoid filter bubble
     */
    diversifyResults(rankedJobs, userProfile) {
        const diversified = [];
        const categories = new Set();
        const clients = new Set();
        
        // First pass: include top matches while ensuring diversity
        for (const job of rankedJobs) {
            const category = job.category || 'general';
            const clientId = job.clientInfo?.id || 'unknown';
            
            // Always include very high matches
            if (job.matchScore > 85) {
                diversified.push(job);
                categories.add(category);
                clients.add(clientId);
                continue;
            }
            
            // For good matches, ensure diversity
            const categoryCount = [...diversified].filter(j => 
                (j.category || 'general') === category
            ).length;
            
            const clientCount = [...diversified].filter(j => 
                (j.clientInfo?.id || 'unknown') === clientId
            ).length;
            
            // Limit per category and client
            if (categoryCount < 3 && clientCount < 2) {
                diversified.push(job);
                categories.add(category);
                clients.add(clientId);
            }
        }
        
        // Second pass: fill remaining slots with best remaining matches
        const remaining = rankedJobs.filter(job => !diversified.includes(job));
        diversified.push(...remaining);
        
        return diversified;
    }

    /**
     * Learn from user feedback to improve matching
     */
    async updateFromFeedback(userId, jobId, feedback) {
        try {
            const userProfile = await this.getUserProfile(userId);
            const feedbackData = {
                userId,
                jobId,
                rating: feedback.rating,
                applied: feedback.applied,
                hired: feedback.hired,
                timestamp: new Date()
            };
            
            // Store feedback for learning
            await this.storeFeedback(feedbackData);
            
            // Update user preferences based on positive feedback
            if (feedback.rating > 3 || feedback.applied) {
                await this.updateUserPreferences(userId, feedback.jobData);
            }
            
            // Adjust feature weights based on success patterns
            await this.adjustFeatureWeights(userId, feedback);
            
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Utility methods

    async getUserProfile(userId) {
        // In production, this would fetch from database
        return this.userProfiles.get(userId) || {
            id: userId,
            skills: [],
            experienceLevel: 'intermediate',
            minHourlyRate: 25,
            maxHourlyRate: 100,
            availability: 'flexible'
        };
    }

    identifyMissingSkills(userProfile, job) {
        const userSkills = (userProfile.skills || []).map(s => s.toLowerCase());
        const jobSkills = (job.skills || []).map(s => s.toLowerCase());
        
        return jobSkills.filter(skill => 
            !userSkills.some(userSkill => 
                userSkill.includes(skill) || skill.includes(userSkill)
            )
        );
    }

    areJobsSimilar(job1, job2) {
        // Simple similarity check based on category and skills
        if (job1.category === job2.category) return true;
        
        const skills1 = new Set((job1.skills || []).map(s => s.toLowerCase()));
        const skills2 = new Set((job2.skills || []).map(s => s.toLowerCase()));
        
        const intersection = new Set([...skills1].filter(x => skills2.has(x)));
        const union = new Set([...skills1, ...skills2]);
        
        return union.size > 0 && intersection.size / union.size > 0.3;
    }

    isGrowingField(category) {
        const growingFields = [
            'ai', 'machine learning', 'blockchain', 'react', 'vue.js',
            'data science', 'mobile app', 'cloud', 'devops'
        ];
        
        return growingFields.some(field => 
            category?.toLowerCase().includes(field)
        );
    }

    calculateOverallConfidence(matches) {
        if (matches.length === 0) return 0;
        
        const avgConfidence = matches.reduce((sum, match) => 
            sum + (match.confidence || 50), 0
        ) / matches.length;
        
        return Math.round(avgConfidence);
    }

    async storeFeedback(feedbackData) {
        // Implementation would store to database
        console.log('Storing feedback:', feedbackData);
    }

    async updateUserPreferences(userId, jobData) {
        // Implementation would update user preferences based on positive feedback
        console.log('Updating user preferences for:', userId);
    }

    async adjustFeatureWeights(userId, feedback) {
        // Implementation would adjust ML model weights based on feedback
        console.log('Adjusting feature weights for user:', userId);
    }
}

module.exports = JobMatchingEngine;