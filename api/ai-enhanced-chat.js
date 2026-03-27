/**
 * AI-Enhanced Chat Endpoint for Cortex Freelancer
 * Integrates FreelancerMemory for context-aware responses
 */

const { Anthropic } = require('@anthropic-ai/sdk');
const FreelancerMemory = require('./ai-core/freelancer-memory');
const jobsData = require('../data/mock/jobs-database.json');

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

class FreelancerAIAssistant {
    constructor(firebase) {
        this.memory = new FreelancerMemory(firebase);
    }

    async handleChat(userId, message, context = {}) {
        // Get user context and learning data
        const userContext = await this.memory.getUserContext(userId);
        const suggestions = await this.memory.suggestNextAction(userId, message);
        
        // Determine if this is a freelancer-specific query
        const queryType = this.classifyQuery(message);
        
        let response;
        switch (queryType) {
            case 'job_analysis':
                response = await this.handleJobAnalysisML(userId, message, userContext);
                break;
            case 'proposal_help':
                response = await this.handleProposalHelpML(userId, message, userContext);
                break;
            case 'rate_advice':
                response = await this.handleRateAdviceML(userId, message, userContext);
                break;
            case 'client_risk':
                response = await this.handleClientRisk(userId, message, userContext);
                break;
            case 'client_research':
                response = await this.handleClientResearch(userId, message, userContext);
                break;
            case 'success_patterns':
                response = await this.handleSuccessPatterns(userId, message, userContext);
                break;
            case 'predictive':
                response = await this.handlePredictiveInsights(userId, message, userContext);
                break;
            case 'workflow_guidance':
                response = await this.handleWorkflowGuidance(userId, message, userContext, suggestions);
                break;
            default:
                response = await this.handleGeneralQuery(userId, message, userContext);
        }

        // Learn from this interaction
        await this.memory.learnUserPattern(userId, 'chat_interaction', {
            queryType,
            message: message.substring(0, 100), // Store first 100 chars
            responseType: response.type,
            userPhase: userContext.currentPhase
        });

        return response;
    }

    classifyQuery(message) {
        const text = message.toLowerCase();

        if (text.includes('job') && (text.includes('analyze') || text.includes('fit') || text.includes('match') || text.includes('score'))) {
            return 'job_analysis';
        }
        if (text.includes('proposal') || text.includes('application') || text.includes('cover letter')) {
            return 'proposal_help';
        }
        if (text.includes('rate') || text.includes('price') || text.includes('charge') || text.includes('pricing')) {
            return 'rate_advice';
        }
        if (text.includes('client') && (text.includes('risk') || text.includes('assess') || text.includes('safe'))) {
            return 'client_risk';
        }
        if (text.includes('client') && (text.includes('research') || text.includes('background'))) {
            return 'client_research';
        }
        if (text.includes('pattern') || text.includes('success') || text.includes('what works') || text.includes('insights')) {
            return 'success_patterns';
        }
        if (text.includes('predict') || text.includes('forecast') || text.includes('revenue') || text.includes('trajectory')) {
            return 'predictive';
        }
        if (text.includes('what should') || text.includes('next step') || text.includes('recommend')) {
            return 'workflow_guidance';
        }

        return 'general';
    }

    // ─── PHASE-2: ML-Powered Handlers ────────────────────────────────

    async handleJobAnalysisML(userId, message, userContext) {
        // Use mock job for demo, real integration would parse from message/context
        const mockJob = jobsData.jobs[0];
        const mlAnalysis = await this.memory.analyzeJobML(userId, mockJob);

        const { mlScore, riskAssessment, prediction, combined } = mlAnalysis;

        let msg = `**ML Job Analysis**\n\n`;
        msg += `**Match Score: ${mlScore.score}/100** (${mlScore.grade})\n`;
        msg += `**Success Probability: ${prediction.probability}%** (${prediction.verdict.label})\n`;
        msg += `**Risk Level: ${riskAssessment.level}** (${riskAssessment.risk}/100)\n`;
        msg += `**Verdict: ${combined.verdict.label}**\n\n`;

        // Key features
        msg += `**Scoring Breakdown:**\n`;
        msg += `• Skills: ${mlScore.features.skillMatch.detail}\n`;
        msg += `• Budget: ${mlScore.features.budgetFit.detail}\n`;
        msg += `• Client: ${mlScore.features.clientQuality.detail}\n`;
        msg += `• Scope: ${mlScore.features.scopeClarity.detail}\n`;
        msg += `• Competition: ${mlScore.features.competitionLevel.detail}\n`;

        // Red flags
        if (mlScore.redFlags.length > 0) {
            msg += `\n**Red Flags:**\n`;
            msg += mlScore.redFlags.map(f => `• ${f.label} (severity: ${Math.round(f.severity * 100)}%)`).join('\n');
        }

        // Positive signals
        if (mlScore.positiveSignals.length > 0) {
            msg += `\n\n**Positive Signals:**\n`;
            msg += mlScore.positiveSignals.map(s => `• ${s.label}`).join('\n');
        }

        // Apply strategy
        msg += `\n\n**Apply Strategy:**\n`;
        msg += `• ${mlScore.applyStrategy.openingHook}\n`;
        msg += mlScore.applyStrategy.keyPoints.map(p => `• ${p}`).join('\n');
        msg += `\n• ${mlScore.applyStrategy.rateStrategy}`;
        msg += `\n• ${mlScore.applyStrategy.differentiator}`;

        return {
            type: 'job_analysis_ml',
            data: mlAnalysis,
            message: msg
        };
    }

    async handleProposalHelpML(userId, message, userContext) {
        const mockJob = jobsData.jobs[0];

        // Generate ML-optimized proposal
        const generated = await this.memory.generateOptimizedProposal(userId, mockJob);

        let msg = `**ML-Optimized Proposal Generated**\n\n`;
        msg += `**Client Type Detected:** ${generated.clientType}\n`;
        msg += `**Tone:** ${generated.tone}\n`;
        msg += `**Word Count:** ${generated.wordCount}\n`;
        msg += `**Quality Score:** ${generated.score.overall}/100 (${generated.score.grade})\n\n`;

        // Section scores
        msg += `**Section Scores:**\n`;
        for (const [section, data] of Object.entries(generated.score.sections)) {
            msg += `• ${section}: ${data.score}/100\n`;
        }

        msg += `\n---\n\n${generated.text}\n\n---\n\n`;
        msg += `Want me to optimize an existing proposal? Just paste it and say "optimize my proposal".`;

        return {
            type: 'proposal_help_ml',
            data: generated,
            message: msg
        };
    }

    async handleRateAdviceML(userId, message, userContext) {
        const insights = await this.memory.getPredictiveInsights(userId);
        const pricing = insights.pricingRecommendation;

        let msg = `**ML Rate Optimization**\n\n`;
        msg += `**Current Rate:** $${pricing.currentRate}/hr\n`;
        msg += `**Recommended:** $${pricing.recommended}/hr\n`;
        msg += `**Optimal Range:** $${pricing.range.min} - $${pricing.range.max}/hr\n`;
        msg += `**Experience Multiplier:** ${pricing.experienceMultiplier}x\n\n`;

        if (pricing.marketPosition.percentile !== null) {
            msg += `**Market Position:** ${pricing.marketPosition.percentile}th percentile`;
            const vsMedian = pricing.marketPosition.vsMedian;
            msg += vsMedian > 0 ? ` (${vsMedian}% above median)\n` : vsMedian < 0 ? ` (${Math.abs(vsMedian)}% below median)\n` : ' (at median)\n';
        }

        msg += `\n**Strategy:**\n`;
        msg += `${pricing.strategy.action}\n`;
        msg += pricing.strategy.steps.map(s => `• ${s}`).join('\n');

        // Price point analysis
        if (pricing.pricePoints) {
            msg += `\n\n**Win Rate by Rate:**\n`;
            msg += pricing.pricePoints.map(p => `• $${p.rate}/hr: ${p.winRate}% win rate (${p.sampleSize} proposals)`).join('\n');
        }

        return {
            type: 'rate_advice_ml',
            data: pricing,
            message: msg
        };
    }

    async handleClientRisk(userId, message, userContext) {
        const mockJob = jobsData.jobs[0];
        const riskAssessment = await this.memory.assessClientRisk(userId, mockJob, {
            totalSpent: mockJob.clientTotalSpent || 10000,
            avgRating: mockJob.clientRating || 4.5,
            hireRate: mockJob.clientHireRate || 60,
            disputeRate: 0.02,
            paymentVerified: true,
            clientHires: mockJob.clientHires || 10
        });

        let msg = `**Client Risk Assessment**\n\n`;
        msg += `**Overall Risk: ${riskAssessment.overallRisk}/100** (${riskAssessment.riskLevel.label})\n\n`;

        // Risk dimensions
        msg += `**Risk Dimensions:**\n`;
        for (const [dim, assessment] of Object.entries(riskAssessment.dimensions)) {
            msg += `• **${dim}:** ${assessment.risk}/100 — ${assessment.detail}\n`;
        }

        // Deal breakers
        if (riskAssessment.dealBreakers.length > 0) {
            msg += `\n**DEAL BREAKERS:**\n`;
            msg += riskAssessment.dealBreakers.map(db => `• ${db.signal}`).join('\n');
        }

        // Walk-away triggers
        if (riskAssessment.walkAwayTriggers.length > 0) {
            msg += `\n\n**Walk-Away Triggers:**\n`;
            msg += riskAssessment.walkAwayTriggers.map(t => `• ${t.trigger}\n  Action: ${t.action}`).join('\n');
        }

        // Mitigations
        if (riskAssessment.mitigations.length > 0) {
            msg += `\n\n**Mitigation Strategies:**\n`;
            for (const m of riskAssessment.mitigations) {
                msg += `\n**${m.dimension}** (${m.priority} priority):\n`;
                msg += m.actions.map(a => `• ${a}`).join('\n');
            }
        }

        // Contract recommendations
        msg += `\n\n**Contract Recommendations:**\n`;
        msg += riskAssessment.contractRecommendations.map(r => `• **${r.clause}** (${r.priority}): ${r.reason}`).join('\n');

        msg += `\n\n${riskAssessment.summary}`;

        return {
            type: 'client_risk',
            data: riskAssessment,
            message: msg
        };
    }

    async handleSuccessPatterns(userId, message, userContext) {
        const patterns = await this.memory.getSuccessPatterns(userId);

        if (!patterns.ready) {
            return {
                type: 'success_patterns',
                data: patterns,
                message: `**Success Pattern Analysis**\n\n${patterns.message}\n\n` +
                    (patterns.earlyInsights.length > 0 ? `**Early Insights:**\n${patterns.earlyInsights.join('\n')}` : '')
            };
        }

        let msg = `**Success Pattern Analysis**\n\n`;
        msg += `**${patterns.totalProjects} projects analyzed | ${patterns.successRate}% success rate**\n\n`;

        // Winning profile
        const wp = patterns.patterns.winningProfile;
        if (wp) {
            msg += `**Your Winning Profile:**\n`;
            msg += `• Sweet spot budget: $${Math.round(wp.budgetRange.min)} - $${Math.round(wp.budgetRange.max)}\n`;
            msg += `• Top skills: ${wp.topSkills.slice(0, 5).join(', ')}\n`;
            if (wp.topClientTypes.length > 0) msg += `• Best client types: ${wp.topClientTypes.join(', ')}\n`;
            msg += `• Avg project value: $${Math.round(wp.avgBudget)}\n`;
        }

        // Clusters
        const clusters = patterns.patterns.clusters;
        if (clusters.length > 0) {
            msg += `\n**Project Clusters (by win rate):**\n`;
            msg += clusters.slice(0, 5).map(c =>
                `• ${c.label}: ${c.winRate}% win rate (${c.count} projects, avg $${c.avgBudget})`
            ).join('\n');
        }

        // Trends
        const trends = patterns.patterns.trends;
        if (trends) {
            msg += `\n\n**Performance Trends:**\n`;
            msg += `• Success rate: ${trends.successRateTrend.early}% → ${trends.successRateTrend.recent}% (${trends.successRateTrend.direction})\n`;
            msg += `• Rate: $${trends.rateTrend.early}/hr → $${trends.rateTrend.recent}/hr (${trends.rateTrend.direction})\n`;
            msg += `• Momentum: ${trends.momentum}\n`;
            msg += `• Rolling success (last 5): ${trends.rollingSuccessRate}%`;
        }

        // Insights
        if (patterns.insights.length > 0) {
            msg += `\n\n**Key Insights:**\n`;
            msg += patterns.insights.map(i => `• [${i.type}] ${i.text}`).join('\n');
        }

        // Recommendations
        if (patterns.recommendations.length > 0) {
            msg += `\n\n**Recommendations:**\n`;
            msg += patterns.recommendations.map(r => `• **[${r.priority}]** ${r.text}\n  ${r.detail}`).join('\n');
        }

        return {
            type: 'success_patterns',
            data: patterns,
            message: msg
        };
    }

    async handlePredictiveInsights(userId, message, userContext) {
        const insights = await this.memory.getPredictiveInsights(userId);

        let msg = `**Predictive Analytics Dashboard**\n\n`;

        // Revenue forecast
        const forecast = insights.revenueForecast;
        if (forecast.ready) {
            msg += `**Revenue Forecast:**\n`;
            msg += `• Avg monthly: $${forecast.historical.avgMonthly.toLocaleString()}\n`;
            msg += `• Trend: ${forecast.trend.direction} (${forecast.trend.monthlyGrowth}% monthly growth)\n`;
            msg += `• Annual projection: $${forecast.annualProjection.toLocaleString()}\n\n`;

            msg += `**Next ${forecast.forecasts.length} Months:**\n`;
            msg += forecast.forecasts.map(f =>
                `• ${f.period}: $${f.predicted.toLocaleString()} (range: $${f.low.toLocaleString()}-$${f.high.toLocaleString()}, ${f.confidence}% confidence)`
            ).join('\n');

            if (forecast.milestones.length > 0) {
                msg += `\n\n**Revenue Milestones:**\n`;
                msg += forecast.milestones.filter(m => m.achievable).map(m =>
                    `• ${m.target}: ~${m.estimatedMonths} months`
                ).join('\n');
            }
        } else {
            msg += `**Revenue Forecast:** ${forecast.message}\n`;
        }

        // Career trajectory
        const career = insights.careerTrajectory;
        msg += `\n\n**Career Trajectory:**\n`;
        msg += `• Current level: ${career.currentLevel}\n`;
        if (career.nextMilestone) {
            msg += `• Next milestone: ${career.nextMilestone.milestone} (~${career.nextMilestone.estimatedMonths} months)\n`;
        }
        if (career.trajectory.length > 0) {
            msg += `\n**Upcoming Milestones:**\n`;
            msg += career.trajectory.slice(0, 5).map(t =>
                `• ${t.milestone}: ~${t.estimatedMonths}mo (${t.confidence} confidence)`
            ).join('\n');
        }

        // Pricing recommendation
        const pricing = insights.pricingRecommendation;
        msg += `\n\n**Pricing Intelligence:**\n`;
        msg += `• Current: $${pricing.currentRate}/hr → Recommended: $${pricing.recommended}/hr\n`;
        msg += `• ${pricing.strategy.action}`;

        return {
            type: 'predictive',
            data: insights,
            message: msg
        };
    }

    // ─── Legacy Handlers (maintained for backward compatibility) ─────

    async handleJobAnalysis(userId, message, userContext) {
        return this.handleJobAnalysisML(userId, message, userContext);
    }

    async handleProposalHelp(userId, message, userContext) {
        return this.handleProposalHelpML(userId, message, userContext);
    }

    async handleRateAdvice(userId, message, userContext) {
        return this.handleRateAdviceML(userId, message, userContext);
    }

    async handleClientResearch(userId, message, userContext) {
        const research = this.generateClientResearch();
        
        return {
            type: 'client_research',
            data: { research },
            message: `**Client Research Complete 🔍**\n\n` +
                     `**Company:** ${research.company}\n` +
                     `**Industry:** ${research.industry}\n` +
                     `**Project History:** ${research.projectHistory}\n` +
                     `**Key Insights:** ${research.insights}\n` +
                     `**Personalization Tips:** ${research.tips}`
        };
    }

    async handleWorkflowGuidance(userId, message, userContext, suggestions) {
        const guidance = {
            phase: userContext.currentPhase,
            suggestions: suggestions.slice(0, 3), // Top 3 suggestions
            nextSteps: this.generateNextSteps(userContext)
        };
        
        return {
            type: 'workflow_guidance',
            data: { guidance },
            message: `**Workflow Guidance for ${userContext.currentPhase.replace('_', ' ')} phase 🎯**\n\n` +
                     `**Priority Actions:**\n` +
                     suggestions.slice(0, 3).map(s => 
                         `• **${s.action.replace('_', ' ')}** (${s.priority} priority)\n` +
                         `  ${s.reason} - Est. ${s.estimatedTime}`
                     ).join('\n\n') +
                     `\n\n**Next Steps:**\n` +
                     guidance.nextSteps.map(step => `• ${step}`).join('\n')
        };
    }

    async handleGeneralQuery(userId, message, userContext) {
        // Use Anthropic for general queries with freelancer context
        const systemPrompt = this.buildFreelancerSystemPrompt(userContext);
        
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1000,
            system: systemPrompt,
            messages: [{
                role: 'user',
                content: message
            }]
        });
        
        return {
            type: 'general',
            data: { claudeResponse: response },
            message: response.content[0].text
        };
    }

    buildFreelancerSystemPrompt(userContext) {
        return `You are Cortex, an AI assistant specialized in helping freelancers succeed. 

User Context:
- Current Phase: ${userContext.currentPhase}
- Hourly Rate: $${userContext.preferences.hourlyRate || 'not set'}/hour  
- Skills: ${userContext.preferences.skills.join(', ') || 'not specified'}
- Success Rate: ${Math.round(userContext.successMetrics.proposalWinRate * 100)}% proposal win rate

Always provide practical, actionable advice specific to freelancing. Focus on:
- Business development and client acquisition
- Project management and delivery excellence  
- Rate optimization and negotiation
- Skill development and market positioning
- Financial management and tax efficiency

Be concise but comprehensive. Include specific next steps when possible.`;
    }

    generateProposalTemplates(userId, userContext) {
        return [
            {
                name: 'Technical Project Template',
                preview: 'Hi [Client Name], I\'ve reviewed your project requirements and I\'m excited about the opportunity...',
                fullTemplate: `Hi [Client Name],

I've reviewed your project requirements for [PROJECT_NAME] and I'm excited about the opportunity to help you achieve your goals.

**Why I'm the right fit:**
• ${userContext.preferences.skills.slice(0, 3).join(' years of experience\n• ')} years of experience
• Track record of ${Math.round(userContext.successMetrics.proposalWinRate * 100)}% successful project completion
• Experience with similar ${userContext.preferences.clientTypes.join(', ')} projects

**My Approach:**
1. Initial consultation to understand your specific requirements
2. Detailed project timeline with milestones
3. Regular communication and progress updates
4. Testing and optimization before delivery

**Investment:** $${userContext.preferences.hourlyRate}/hour

I'd love to discuss your project in detail. When would be a good time for a brief call?

Best regards,
[Your Name]`
            },
            {
                name: 'Quick Turnaround Template', 
                preview: 'I can help you get this done quickly and efficiently...',
                fullTemplate: `Hello!

I can help you get this done quickly and efficiently. Here's what I bring to the table:

✅ **Immediate availability** - can start within 24 hours
✅ **Fast delivery** - most projects completed 20% ahead of schedule  
✅ **Quality assurance** - thorough testing and revision process
✅ **Ongoing support** - 30 days post-delivery support included

**Timeline:** [ESTIMATED_DURATION]
**Investment:** [BUDGET_RANGE]

Ready to get started? Let's discuss the details.

[Your Name]`
            }
        ];
    }

    analyzeMarketRates(userContext) {
        const currentRate = userContext.preferences.hourlyRate || 30;
        const skills = userContext.preferences.skills;
        
        // Mock market analysis
        const baseRate = 35;
        const skillPremium = skills.length * 5;
        const experiencePremium = userContext.successMetrics.proposalWinRate * 20;
        
        const suggestedRate = Math.round(baseRate + skillPremium + experiencePremium);
        
        return {
            marketRange: { min: 25, max: 80 },
            suggestedRate,
            currentRate,
            rationale: `Based on your skill set (${skills.join(', ')}) and ${Math.round(userContext.successMetrics.proposalWinRate * 100)}% success rate`,
            strategy: suggestedRate > currentRate ? 
                'Consider gradually increasing your rate on new projects' :
                'Your current rate is competitive for your experience level'
        };
    }

    generateClientResearch() {
        // Mock client research data
        return {
            company: 'TechStart Solutions',
            industry: 'SaaS/Technology',
            projectHistory: '15+ completed projects, average budget $2,500',
            insights: 'Values quick communication and milestone-based delivery',
            tips: 'Mention experience with similar tech stack and emphasize reliability'
        };
    }

    generateNextSteps(userContext) {
        const steps = [];
        
        switch (userContext.currentPhase) {
            case 'job-hunting':
                steps.push('Search for 3-5 relevant job postings today');
                steps.push('Send 2-3 personalized proposals');
                steps.push('Follow up on pending proposals from last week');
                break;
            case 'project-active':
                steps.push('Update project timeline with current progress');
                steps.push('Send client update with completed milestones');
                steps.push('Plan next phase deliverables');
                break;
            case 'business-development':
                steps.push('Update portfolio with recent project');
                steps.push('Reach out to 3 past clients for testimonials');
                steps.push('Research emerging trends in your industry');
                break;
        }
        
        return steps;
    }
}

module.exports = FreelancerAIAssistant;