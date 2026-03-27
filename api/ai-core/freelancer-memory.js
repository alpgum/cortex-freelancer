/**
 * Cortex Freelancer AI Memory System
 * Learns user patterns, preferences, and provides contextual assistance
 *
 * [PHASE-2] Enhanced with ML integration:
 * - MLJobScorer for intelligent job analysis
 * - ProposalOptimizer for proposal customization
 * - ClientRiskAssessor for risk evaluation
 * - SuccessPatternEngine for pattern learning
 * - PredictiveAnalytics for outcome forecasting
 */

const MLJobScorer = require('./ml-job-scorer');
const ProposalOptimizer = require('./proposal-optimizer');
const ClientRiskAssessor = require('./client-risk-assessor');
const SuccessPatternEngine = require('./success-pattern-engine');
const PredictiveAnalytics = require('./predictive-analytics');

class FreelancerMemory {
    constructor(firebase) {
        this.db = firebase.firestore();

        // Initialize AI engines
        this.mlScorer = new MLJobScorer();
        this.proposalOptimizer = new ProposalOptimizer();
        this.riskAssessor = new ClientRiskAssessor();
        this.patternEngine = new SuccessPatternEngine();
        this.predictiveAnalytics = new PredictiveAnalytics();
    }

    async learnUserPattern(userId, action, context) {
        const timestamp = Date.now();
        const pattern = {
            action,
            context,
            timestamp,
            success: context.outcome || null
        };

        // Store in user's learning collection
        await this.db.collection('user_patterns')
            .doc(userId)
            .collection('actions')
            .add(pattern);

        // Update aggregated preferences
        await this.updateUserPreferences(userId, pattern);
    }

    async getUserContext(userId) {
        const doc = await this.db.collection('user_context').doc(userId).get();
        
        if (!doc.exists) {
            // Initialize new user context
            const defaultContext = {
                currentPhase: 'job-hunting', // job-hunting, project-active, business-development
                preferences: {
                    hourlyRate: null,
                    clientTypes: [],
                    skills: [],
                    workloadCapacity: 'medium'
                },
                successMetrics: {
                    proposalWinRate: 0,
                    avgProjectValue: 0,
                    repeatClientRate: 0
                },
                lastActivity: timestamp,
                isOnboarded: false
            };
            
            await this.setUserContext(userId, defaultContext);
            return defaultContext;
        }
        
        return doc.data();
    }

    async setUserContext(userId, context) {
        await this.db.collection('user_context').doc(userId).set(context);
    }

    async updateUserPreferences(userId, pattern) {
        const context = await this.getUserContext(userId);
        
        // Learn from successful patterns
        if (pattern.success === 'positive') {
            // Update preferences based on successful actions
            if (pattern.action === 'proposal_sent' && pattern.context.jobType) {
                if (!context.preferences.clientTypes.includes(pattern.context.jobType)) {
                    context.preferences.clientTypes.push(pattern.context.jobType);
                }
            }
            
            if (pattern.action === 'project_completed' && pattern.context.rate) {
                // Update rate preference based on successful projects
                const currentRate = context.preferences.hourlyRate || 0;
                context.preferences.hourlyRate = Math.max(currentRate, pattern.context.rate);
            }
        }

        await this.setUserContext(userId, context);
    }

    async suggestNextAction(userId, currentActivity = null) {
        const context = await this.getUserContext(userId);
        const recentPatterns = await this.getRecentPatterns(userId, 10);
        
        const suggestions = [];

        // Phase-based suggestions
        switch (context.currentPhase) {
            case 'job-hunting':
                if (this.hasRecentActivity(recentPatterns, 'job_search') < 1) {
                    suggestions.push({
                        action: 'search_jobs',
                        priority: 'high',
                        reason: 'No recent job search activity',
                        estimatedTime: '15 minutes'
                    });
                }
                
                if (this.hasRecentActivity(recentPatterns, 'proposal_sent') < 2) {
                    suggestions.push({
                        action: 'send_proposals',
                        priority: 'medium',
                        reason: 'Maintain proposal momentum',
                        estimatedTime: '30 minutes'
                    });
                }
                break;

            case 'project-active':
                suggestions.push({
                    action: 'update_timeline',
                    priority: 'medium',
                    reason: 'Keep project tracking current',
                    estimatedTime: '5 minutes'
                });
                
                if (this.daysSinceLastContact(recentPatterns) > 3) {
                    suggestions.push({
                        action: 'client_checkin',
                        priority: 'high',
                        reason: 'Maintain client communication',
                        estimatedTime: '10 minutes'
                    });
                }
                break;

            case 'business-development':
                suggestions.push({
                    action: 'update_portfolio',
                    priority: 'medium',
                    reason: 'Showcase recent work',
                    estimatedTime: '20 minutes'
                });
                break;
        }

        // Add context-aware suggestions based on current activity
        if (currentActivity) {
            const contextualSuggestions = await this.getContextualSuggestions(userId, currentActivity, context);
            suggestions.push(...contextualSuggestions);
        }

        return suggestions.sort((a, b) => {
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
    }

    async getContextualSuggestions(userId, activity, context) {
        const suggestions = [];

        if (activity.includes('job')) {
            // User is looking at a job
            suggestions.push({
                action: 'analyze_job_fit',
                priority: 'high',
                reason: 'Evaluate job compatibility with your profile',
                estimatedTime: '2 minutes'
            });
            
            if (context.preferences.hourlyRate) {
                suggestions.push({
                    action: 'calculate_optimal_rate',
                    priority: 'medium',
                    reason: 'Suggest competitive bidding strategy',
                    estimatedTime: '1 minute'
                });
            }
        }

        if (activity.includes('proposal')) {
            suggestions.push({
                action: 'research_client',
                priority: 'high',
                reason: 'Personalize proposal with client background',
                estimatedTime: '5 minutes'
            });
        }

        return suggestions;
    }

    async getRecentPatterns(userId, limit = 10) {
        const snapshot = await this.db.collection('user_patterns')
            .doc(userId)
            .collection('actions')
            .orderBy('timestamp', 'desc')
            .limit(limit)
            .get();
            
        return snapshot.docs.map(doc => doc.data());
    }

    hasRecentActivity(patterns, actionType, dayLimit = 7) {
        const cutoff = Date.now() - (dayLimit * 24 * 60 * 60 * 1000);
        return patterns.filter(p => p.action === actionType && p.timestamp > cutoff).length;
    }

    daysSinceLastContact(patterns) {
        const contactActions = patterns.filter(p => 
            p.action.includes('client') || p.action.includes('communication')
        );
        
        if (contactActions.length === 0) return 999;
        
        const lastContact = Math.max(...contactActions.map(p => p.timestamp));
        return Math.floor((Date.now() - lastContact) / (24 * 60 * 60 * 1000));
    }

    async analyzeJobFit(userId, jobData) {
        const context = await this.getUserContext(userId);
        const patterns = await this.getRecentPatterns(userId, 50);
        
        let score = 0;
        const factors = [];

        // Rate compatibility
        if (jobData.budget && context.preferences.hourlyRate) {
            const rateMatch = jobData.budget >= context.preferences.hourlyRate * 0.8;
            score += rateMatch ? 25 : -10;
            factors.push({
                factor: 'Rate Compatibility',
                score: rateMatch ? 25 : -10,
                detail: `Job budget ${jobData.budget} vs your rate ${context.preferences.hourlyRate}`
            });
        }

        // Skill match
        if (jobData.skills && context.preferences.skills.length > 0) {
            const skillOverlap = jobData.skills.filter(skill => 
                context.preferences.skills.some(userSkill => 
                    userSkill.toLowerCase().includes(skill.toLowerCase())
                )
            ).length;
            
            const skillScore = (skillOverlap / jobData.skills.length) * 30;
            score += skillScore;
            factors.push({
                factor: 'Skill Match',
                score: skillScore,
                detail: `${skillOverlap}/${jobData.skills.length} skills match`
            });
        }

        // Client type preference
        if (jobData.clientType && context.preferences.clientTypes.includes(jobData.clientType)) {
            score += 20;
            factors.push({
                factor: 'Client Type Preference',
                score: 20,
                detail: 'Matches your preferred client types'
            });
        }

        // Success pattern analysis
        const similarSuccesses = patterns.filter(p => 
            p.success === 'positive' && 
            p.context.jobType === jobData.type
        ).length;
        
        const successBonus = Math.min(similarSuccesses * 5, 25);
        score += successBonus;
        factors.push({
            factor: 'Historical Success',
            score: successBonus,
            detail: `${similarSuccesses} similar successful projects`
        });

        return {
            score: Math.max(0, Math.min(100, score)),
            factors,
            recommendation: score > 70 ? 'strong' : score > 40 ? 'moderate' : 'weak',
            suggestedActions: this.getSuggestedActions(score, jobData, context)
        };
    }

    getSuggestedActions(score, jobData, context) {
        const actions = [];

        if (score > 70) {
            actions.push('Apply with standard proposal template');
            actions.push('Research client background for personalization');
        } else if (score > 40) {
            actions.push('Consider adjusting rate to be more competitive');
            actions.push('Emphasize relevant experience in proposal');
        } else {
            actions.push('Skip - low compatibility match');
            actions.push('Consider for skill development only');
        }

        return actions;
    }

    // ─── PHASE-2: ML-Enhanced Methods ───────────────────────────────

    /**
     * ML-powered job analysis with scoring, risk assessment, and apply strategy
     */
    async analyzeJobML(userId, jobData) {
        const context = await this.getUserContext(userId);
        const outcomes = await this.getOutcomeHistory(userId);

        const userProfile = {
            skills: context.preferences.skills,
            hourlyRate: context.preferences.hourlyRate,
            experience: context.successMetrics.completedProjects || 0,
            successMetrics: context.successMetrics
        };

        // ML Job Score
        const mlScore = this.mlScorer.scoreJob(jobData, userProfile,
            outcomes.length >= 5 ? { outcomes } : null
        );

        // Client Risk Assessment
        const riskAssessment = this.riskAssessor.quickAssess(jobData, jobData.clientHistory || {});

        // Success Prediction
        const prediction = this.predictiveAnalytics.predictProjectSuccess(
            jobData, userProfile, outcomes
        );

        // Record this analysis for learning
        await this.learnUserPattern(userId, 'job_analyzed', {
            jobId: jobData.id,
            mlScore: mlScore.score,
            riskLevel: riskAssessment.level,
            successProbability: prediction.probability
        });

        return {
            mlScore,
            riskAssessment,
            prediction,
            combined: {
                score: mlScore.score,
                risk: riskAssessment.risk,
                successProbability: prediction.probability,
                verdict: this.combinedVerdict(mlScore.score, riskAssessment.risk, prediction.probability),
                applyStrategy: mlScore.applyStrategy
            }
        };
    }

    /**
     * Optimize a proposal using ML patterns
     */
    async optimizeProposal(userId, proposalText, jobData) {
        const context = await this.getUserContext(userId);
        const winHistory = await this.getProposalHistory(userId);

        return this.proposalOptimizer.optimize({
            proposalText,
            job: jobData,
            userProfile: {
                skills: context.preferences.skills,
                hourlyRate: context.preferences.hourlyRate,
                successMetrics: context.successMetrics
            },
            winHistory: winHistory.length >= 3 ? { proposals: winHistory } : null
        });
    }

    /**
     * Generate an optimized proposal from scratch
     */
    async generateOptimizedProposal(userId, jobData) {
        const context = await this.getUserContext(userId);

        return this.proposalOptimizer.generateProposal(jobData, {
            skills: context.preferences.skills,
            hourlyRate: context.preferences.hourlyRate,
            experience: context.successMetrics.completedProjects || '5+',
            successMetrics: context.successMetrics
        });
    }

    /**
     * Full client risk assessment
     */
    async assessClientRisk(userId, jobData, clientHistory) {
        const communicationData = await this.getClientCommunicationData(userId, clientHistory.id);

        return this.riskAssessor.assess({
            job: jobData,
            clientHistory,
            communicationData
        });
    }

    /**
     * Get success pattern analysis for the user
     */
    async getSuccessPatterns(userId) {
        const outcomes = await this.getOutcomeHistory(userId);
        return this.patternEngine.analyze(outcomes);
    }

    /**
     * Get predictive analytics dashboard data
     */
    async getPredictiveInsights(userId) {
        const context = await this.getUserContext(userId);
        const outcomes = await this.getOutcomeHistory(userId);
        const revenue = await this.getRevenueHistory(userId);

        return {
            successPatterns: this.patternEngine.analyze(outcomes),
            revenueForecast: this.predictiveAnalytics.forecastRevenue(revenue),
            pricingRecommendation: this.predictiveAnalytics.recommendPricing(
                { ...context.preferences, successMetrics: context.successMetrics, totalEarnings: context.successMetrics.totalEarnings || 0 },
                null, // Market data — would come from real API
                outcomes
            ),
            careerTrajectory: this.predictiveAnalytics.projectCareerTrajectory(
                { ...context.preferences, successMetrics: context.successMetrics, totalEarnings: context.successMetrics.totalEarnings || 0 },
                outcomes,
                revenue
            )
        };
    }

    /**
     * Batch score jobs with ML and risk assessment
     */
    async batchAnalyzeJobs(userId, jobs) {
        const context = await this.getUserContext(userId);
        const outcomes = await this.getOutcomeHistory(userId);

        const userProfile = {
            skills: context.preferences.skills,
            hourlyRate: context.preferences.hourlyRate,
            successMetrics: context.successMetrics
        };

        return jobs.map(job => {
            const mlScore = this.mlScorer.scoreJob(job, userProfile,
                outcomes.length >= 5 ? { outcomes } : null
            );
            const risk = this.riskAssessor.quickAssess(job, job.clientHistory || {});

            return {
                job,
                score: mlScore.score,
                grade: mlScore.grade,
                risk: risk.risk,
                riskLevel: risk.level,
                recommendation: mlScore.recommendation,
                topConcern: risk.topConcern
            };
        }).sort((a, b) => b.score - a.score);
    }

    /**
     * Record project outcome for learning
     */
    async recordOutcome(userId, outcomeData) {
        await this.db.collection('user_outcomes')
            .doc(userId)
            .collection('projects')
            .add({
                ...outcomeData,
                recordedAt: Date.now()
            });
    }

    // ─── Data Access Helpers ────────────────────────────────────────

    async getOutcomeHistory(userId) {
        try {
            const snapshot = await this.db.collection('user_outcomes')
                .doc(userId)
                .collection('projects')
                .orderBy('recordedAt', 'desc')
                .limit(100)
                .get();
            return snapshot.docs.map(doc => doc.data());
        } catch (e) {
            return [];
        }
    }

    async getProposalHistory(userId) {
        try {
            const snapshot = await this.db.collection('user_patterns')
                .doc(userId)
                .collection('actions')
                .where('action', '==', 'proposal_sent')
                .orderBy('timestamp', 'desc')
                .limit(50)
                .get();
            return snapshot.docs.map(doc => doc.data());
        } catch (e) {
            return [];
        }
    }

    async getRevenueHistory(userId) {
        try {
            const snapshot = await this.db.collection('user_outcomes')
                .doc(userId)
                .collection('projects')
                .where('success', '==', true)
                .orderBy('recordedAt', 'desc')
                .limit(100)
                .get();
            return snapshot.docs.map(doc => ({
                date: doc.data().completedDate || new Date(doc.data().recordedAt).toISOString(),
                amount: doc.data().revenue || doc.data().budget || 0,
                source: doc.data().clientType || 'freelance'
            }));
        } catch (e) {
            return [];
        }
    }

    async getClientCommunicationData(userId, clientId) {
        // Would integrate with messaging data in production
        return null;
    }

    combinedVerdict(score, risk, probability) {
        const combined = (score * 0.4 + (100 - risk) * 0.3 + probability * 0.3);
        if (combined >= 75) return { action: 'STRONG_APPLY', label: 'Excellent opportunity — apply now' };
        if (combined >= 60) return { action: 'APPLY', label: 'Good fit — worth applying' };
        if (combined >= 45) return { action: 'CONSIDER', label: 'Moderate — apply if strategic' };
        if (combined >= 30) return { action: 'SKIP', label: 'Below threshold — better options likely exist' };
        return { action: 'AVOID', label: 'Poor fit — skip this one' };
    }
}

module.exports = FreelancerMemory;