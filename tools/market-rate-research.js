// Cortex Freelancer - Market Rate Research Automation
// Sprint 2 - Task 11/50

class MarketRateResearch {
    constructor() {
        this.rateDatabase = new Map();
        this.researchSources = new Map();
        this.marketTrends = [];
        this.localRateData = new Map();
        this.initializeRateSources();
    }

    initializeRateSources() {
        // Market research data sources
        this.researchSources.set('upwork', {
            name: 'Upwork',
            type: 'platform',
            reliability: 8,
            lastUpdated: new Date(),
            categories: ['web_development', 'design', 'writing', 'marketing', 'consulting']
        });

        this.researchSources.set('freelancer', {
            name: 'Freelancer.com',
            type: 'platform', 
            reliability: 7,
            lastUpdated: new Date(),
            categories: ['development', 'design', 'data_entry', 'writing']
        });

        this.researchSources.set('fiverr', {
            name: 'Fiverr',
            type: 'platform',
            reliability: 6,
            lastUpdated: new Date(),
            categories: ['creative', 'digital_marketing', 'programming']
        });

        this.researchSources.set('glassdoor', {
            name: 'Glassdoor',
            type: 'employment',
            reliability: 9,
            lastUpdated: new Date(),
            categories: ['all_professional']
        });

        // Populate with sample rate data
        this.populateSampleRates();
    }

    populateSampleRates() {
        // Web Development rates by experience level
        this.rateDatabase.set('web_development', {
            skill: 'Web Development',
            category: 'development',
            rates: {
                entry: { min: 25, max: 45, median: 35, currency: 'USD' },
                mid: { min: 45, max: 85, median: 65, currency: 'USD' },
                senior: { min: 85, max: 150, median: 120, currency: 'USD' },
                expert: { min: 150, max: 250, median: 200, currency: 'USD' }
            },
            specializations: {
                'react': { premium: 15, demand: 'high' },
                'vue': { premium: 10, demand: 'medium' },
                'angular': { premium: 12, demand: 'medium' },
                'node_js': { premium: 18, demand: 'high' },
                'python': { premium: 20, demand: 'high' },
                'php': { premium: 5, demand: 'medium' }
            },
            marketData: {
                demandTrend: 'increasing',
                saturationLevel: 'medium',
                projectedGrowth: 8.5,
                topMarkets: ['United States', 'Canada', 'United Kingdom', 'Australia']
            }
        });

        this.rateDatabase.set('graphic_design', {
            skill: 'Graphic Design',
            category: 'design',
            rates: {
                entry: { min: 20, max: 35, median: 28, currency: 'USD' },
                mid: { min: 35, max: 60, median: 48, currency: 'USD' },
                senior: { min: 60, max: 100, median: 80, currency: 'USD' },
                expert: { min: 100, max: 180, median: 140, currency: 'USD' }
            },
            specializations: {
                'brand_identity': { premium: 25, demand: 'high' },
                'web_design': { premium: 15, demand: 'high' },
                'print_design': { premium: 8, demand: 'medium' },
                'motion_graphics': { premium: 30, demand: 'high' },
                'illustration': { premium: 20, demand: 'medium' }
            },
            marketData: {
                demandTrend: 'stable',
                saturationLevel: 'high',
                projectedGrowth: 3.2,
                topMarkets: ['United States', 'United Kingdom', 'Canada', 'Germany']
            }
        });

        this.rateDatabase.set('content_writing', {
            skill: 'Content Writing',
            category: 'writing',
            rates: {
                entry: { min: 15, max: 25, median: 20, currency: 'USD' },
                mid: { min: 25, max: 50, median: 38, currency: 'USD' },
                senior: { min: 50, max: 85, median: 68, currency: 'USD' },
                expert: { min: 85, max: 150, median: 115, currency: 'USD' }
            },
            specializations: {
                'seo_content': { premium: 20, demand: 'high' },
                'technical_writing': { premium: 35, demand: 'high' },
                'copywriting': { premium: 40, demand: 'high' },
                'blog_writing': { premium: 10, demand: 'medium' },
                'social_media': { premium: 15, demand: 'medium' }
            },
            marketData: {
                demandTrend: 'increasing',
                saturationLevel: 'high',
                projectedGrowth: 6.8,
                topMarkets: ['United States', 'United Kingdom', 'Canada', 'Australia']
            }
        });

        this.rateDatabase.set('digital_marketing', {
            skill: 'Digital Marketing',
            category: 'marketing',
            rates: {
                entry: { min: 25, max: 40, median: 32, currency: 'USD' },
                mid: { min: 40, max: 70, median: 55, currency: 'USD' },
                senior: { min: 70, max: 120, median: 95, currency: 'USD' },
                expert: { min: 120, max: 200, median: 160, currency: 'USD' }
            },
            specializations: {
                'ppc_advertising': { premium: 30, demand: 'high' },
                'seo': { premium: 25, demand: 'high' },
                'social_media_marketing': { premium: 15, demand: 'medium' },
                'email_marketing': { premium: 20, demand: 'medium' },
                'conversion_optimization': { premium: 35, demand: 'high' }
            },
            marketData: {
                demandTrend: 'rapidly_increasing',
                saturationLevel: 'medium',
                projectedGrowth: 12.3,
                topMarkets: ['United States', 'United Kingdom', 'Canada', 'Netherlands']
            }
        });
    }

    // Research current market rates for specific skill
    async researchSkillRates(skillName, location = 'global', experienceLevel = 'mid') {
        const skillData = this.rateDatabase.get(skillName.toLowerCase());
        
        if (!skillData) {
            return {
                error: `Skill "${skillName}" not found in rate database`,
                suggestions: this.suggestSimilarSkills(skillName)
            };
        }

        const rateData = skillData.rates[experienceLevel];
        const locationMultiplier = this.getLocationMultiplier(location);
        
        const adjustedRates = {
            min: Math.round(rateData.min * locationMultiplier),
            max: Math.round(rateData.max * locationMultiplier),
            median: Math.round(rateData.median * locationMultiplier),
            currency: rateData.currency
        };

        return {
            skill: skillData.skill,
            experienceLevel,
            location,
            rates: adjustedRates,
            specializations: skillData.specializations,
            marketInsights: this.generateMarketInsights(skillData, location),
            competitorAnalysis: this.analyzeCompetition(skillName, experienceLevel),
            pricingRecommendations: this.generatePricingRecommendations(adjustedRates, skillData),
            lastUpdated: new Date()
        };
    }

    getLocationMultiplier(location) {
        const locationMultipliers = {
            'global': 1.0,
            'united_states': 1.2,
            'canada': 1.1,
            'united_kingdom': 1.15,
            'australia': 1.1,
            'germany': 1.05,
            'france': 1.0,
            'netherlands': 1.1,
            'sweden': 1.15,
            'india': 0.3,
            'ukraine': 0.4,
            'philippines': 0.25,
            'mexico': 0.5,
            'brazil': 0.45,
            'eastern_europe': 0.6,
            'western_europe': 1.1,
            'north_america': 1.15,
            'asia_pacific': 0.7
        };

        return locationMultipliers[location.toLowerCase().replace(' ', '_')] || 1.0;
    }

    generateMarketInsights(skillData, location) {
        const insights = [];
        
        // Demand trend insights
        switch (skillData.marketData.demandTrend) {
            case 'rapidly_increasing':
                insights.push('🚀 Market demand is growing rapidly - excellent time to raise rates');
                break;
            case 'increasing':
                insights.push('📈 Market demand is steadily growing - good opportunity for rate increases');
                break;
            case 'stable':
                insights.push('📊 Market demand is stable - maintain competitive positioning');
                break;
            case 'declining':
                insights.push('📉 Market demand is declining - consider skill diversification');
                break;
        }

        // Saturation level insights
        switch (skillData.marketData.saturationLevel) {
            case 'low':
                insights.push('🎯 Low market saturation - premium pricing opportunities');
                break;
            case 'medium':
                insights.push('⚖️ Moderate market saturation - focus on specialization');
                break;
            case 'high':
                insights.push('🏆 High market saturation - differentiation is key');
                break;
        }

        // Location-specific insights
        if (location && location !== 'global') {
            const multiplier = this.getLocationMultiplier(location);
            if (multiplier > 1.1) {
                insights.push('🌍 High-value market location - premium rates justified');
            } else if (multiplier < 0.6) {
                insights.push('💡 Cost-competitive market - volume-based strategy recommended');
            }
        }

        // Growth projection insights
        if (skillData.marketData.projectedGrowth > 10) {
            insights.push('🚀 High growth projection - invest in skill development');
        } else if (skillData.marketData.projectedGrowth > 5) {
            insights.push('📈 Positive growth outlook - sustainable career path');
        }

        return insights;
    }

    analyzeCompetition(skillName, experienceLevel) {
        // Simulated competition analysis
        const baseCompetition = {
            'entry': { competitors: 'high', difficulty: 'low' },
            'mid': { competitors: 'medium', difficulty: 'medium' },
            'senior': { competitors: 'low', difficulty: 'high' },
            'expert': { competitors: 'very_low', difficulty: 'very_high' }
        };

        const competition = baseCompetition[experienceLevel];
        
        return {
            competitorDensity: competition.competitors,
            entryDifficulty: competition.difficulty,
            averageExperience: this.getAverageCompetitorExperience(experienceLevel),
            topCompetitorStrategies: this.getCompetitorStrategies(skillName),
            differentiationOpportunities: this.findDifferentiationOpportunities(skillName)
        };
    }

    getAverageCompetitorExperience(experienceLevel) {
        const experienceMap = {
            'entry': '1-2 years',
            'mid': '3-5 years', 
            'senior': '6-10 years',
            'expert': '10+ years'
        };
        
        return experienceMap[experienceLevel];
    }

    getCompetitorStrategies(skillName) {
        const strategies = {
            'web_development': ['Full-stack specialization', 'Industry expertise', 'Quick turnaround'],
            'graphic_design': ['Niche specialization', 'Package deals', 'Unlimited revisions'],
            'content_writing': ['SEO optimization', 'Industry expertise', 'Fast delivery'],
            'digital_marketing': ['Results guarantee', 'Data-driven approach', 'Full-service packages']
        };

        return strategies[skillName] || ['Competitive pricing', 'Quality focus', 'Client service'];
    }

    findDifferentiationOpportunities(skillName) {
        const opportunities = {
            'web_development': ['AI integration', 'Performance optimization', 'Accessibility focus'],
            'graphic_design': ['Sustainable design', 'AI-assisted workflow', 'Interactive design'],
            'content_writing': ['AI-powered optimization', 'Voice search optimization', 'Video content'],
            'digital_marketing': ['Privacy-first marketing', 'AI automation', 'Micro-influencer networks']
        };

        return opportunities[skillName] || ['Innovation focus', 'Premium service', 'Niche specialization'];
    }

    generatePricingRecommendations(rates, skillData) {
        const recommendations = [];

        // Base pricing recommendation
        const recommendedRate = Math.round(rates.median * 0.95); // Slightly below median for competitiveness
        recommendations.push(`💰 Recommended starting rate: $${recommendedRate}/hour`);

        // Premium pricing opportunities
        const highDemandSpecs = Object.entries(skillData.specializations)
            .filter(([_, data]) => data.demand === 'high')
            .sort((a, b) => b[1].premium - a[1].premium);

        if (highDemandSpecs.length > 0) {
            const topSpec = highDemandSpecs[0];
            const premiumRate = Math.round(recommendedRate * (1 + topSpec[1].premium / 100));
            recommendations.push(`🚀 With ${topSpec[0].replace('_', ' ')} specialization: $${premiumRate}/hour`);
        }

        // Package pricing
        const packageRate = Math.round(recommendedRate * 6.5); // ~20% discount for weekly package
        recommendations.push(`📦 Weekly package pricing: $${packageRate} (equivalent to $${Math.round(packageRate/8)}/hour)`);

        // Retainer recommendation
        const retainerRate = Math.round(recommendedRate * 0.85 * 20); // 15% discount for 20-hour monthly retainer
        recommendations.push(`🤝 Monthly retainer (20 hours): $${retainerRate}/month`);

        return recommendations;
    }

    // Competitive analysis for specific project
    analyzeProjectRates(projectDescription, budget = null, timeline = null) {
        const projectAnalysis = {
            projectType: this.classifyProject(projectDescription),
            complexityScore: this.assessComplexity(projectDescription),
            recommendedRate: null,
            budgetAnalysis: null,
            timelineImpact: null,
            riskFactors: []
        };

        // Determine project type and base rate
        const skillRates = this.rateDatabase.get(projectAnalysis.projectType);
        if (skillRates) {
            const experienceLevel = this.recommendExperienceLevel(projectAnalysis.complexityScore);
            projectAnalysis.recommendedRate = skillRates.rates[experienceLevel];
        }

        // Budget analysis
        if (budget) {
            projectAnalysis.budgetAnalysis = this.analyzeBudget(budget, projectAnalysis.recommendedRate, timeline);
        }

        // Timeline impact
        if (timeline) {
            projectAnalysis.timelineImpact = this.analyzeTimeline(timeline, projectAnalysis.complexityScore);
        }

        return projectAnalysis;
    }

    classifyProject(description) {
        const keywords = description.toLowerCase();
        
        if (keywords.includes('website') || keywords.includes('web app') || keywords.includes('development')) {
            return 'web_development';
        } else if (keywords.includes('design') || keywords.includes('logo') || keywords.includes('graphics')) {
            return 'graphic_design';
        } else if (keywords.includes('content') || keywords.includes('writing') || keywords.includes('blog')) {
            return 'content_writing';
        } else if (keywords.includes('marketing') || keywords.includes('seo') || keywords.includes('advertising')) {
            return 'digital_marketing';
        }
        
        return 'web_development'; // default
    }

    assessComplexity(description) {
        let score = 1; // base score
        
        const highComplexityKeywords = ['complex', 'advanced', 'enterprise', 'scalable', 'integration'];
        const mediumComplexityKeywords = ['custom', 'professional', 'responsive', 'interactive'];
        
        highComplexityKeywords.forEach(keyword => {
            if (description.toLowerCase().includes(keyword)) score += 0.5;
        });
        
        mediumComplexityKeywords.forEach(keyword => {
            if (description.toLowerCase().includes(keyword)) score += 0.2;
        });
        
        return Math.min(score, 3); // cap at 3
    }

    recommendExperienceLevel(complexityScore) {
        if (complexityScore >= 2.5) return 'expert';
        if (complexityScore >= 2.0) return 'senior';
        if (complexityScore >= 1.5) return 'mid';
        return 'entry';
    }

    analyzeBudget(budget, recommendedRate, timeline) {
        if (!recommendedRate) return null;
        
        const estimatedHours = timeline ? this.estimateProjectHours(timeline) : 40; // default 40 hours
        const recommendedTotal = recommendedRate.median * estimatedHours;
        
        const budgetRatio = budget / recommendedTotal;
        
        let analysis = '';
        if (budgetRatio >= 1.2) {
            analysis = 'Excellent budget - room for premium pricing';
        } else if (budgetRatio >= 0.9) {
            analysis = 'Good budget - aligns with market rates';
        } else if (budgetRatio >= 0.7) {
            analysis = 'Tight budget - consider scope reduction';
        } else {
            analysis = 'Low budget - high risk project';
        }
        
        return {
            budgetRatio,
            analysis,
            recommendedTotal,
            estimatedHours
        };
    }

    estimateProjectHours(timelineDescription) {
        const timeline = timelineDescription.toLowerCase();
        
        if (timeline.includes('week')) return 20;
        if (timeline.includes('month')) return 80;
        if (timeline.includes('rush') || timeline.includes('urgent')) return 15;
        if (timeline.includes('flexible')) return 60;
        
        return 40; // default
    }

    // Generate comprehensive rate report
    generateRateReport(skills = [], location = 'global') {
        const report = {
            generatedDate: new Date(),
            location,
            marketOverview: this.getMarketOverview(),
            skillAnalysis: [],
            recommendations: []
        };

        // Analyze each skill
        skills.forEach(skill => {
            try {
                const analysis = this.researchSkillRates(skill, location, 'mid');
                report.skillAnalysis.push(analysis);
            } catch (error) {
                report.skillAnalysis.push({
                    skill,
                    error: error.message
                });
            }
        });

        // Generate overall recommendations
        report.recommendations = this.generateOverallRecommendations(report.skillAnalysis);

        return report;
    }

    getMarketOverview() {
        return {
            trends: [
                'AI and automation skills in high demand',
                'Remote work driving global rate normalization', 
                'Specialization commanding premium rates',
                'Package pricing becoming more popular'
            ],
            topGrowthAreas: [
                'AI/ML integration',
                'Sustainability consulting',
                'Privacy compliance',
                'Accessibility implementation'
            ],
            rateFactors: [
                'Experience level and portfolio quality',
                'Geographic location and market conditions',
                'Specialization and niche expertise',
                'Client type and project complexity'
            ]
        };
    }

    generateOverallRecommendations(skillAnalysis) {
        const recommendations = [
            '📊 Research and track competitor pricing regularly',
            '🎯 Develop premium specializations in high-demand areas',
            '💼 Consider value-based pricing for strategic projects',
            '📈 Raise rates gradually (10-15% annually)',
            '🤝 Offer package deals to increase project value'
        ];

        // Add skill-specific recommendations
        const hasHighGrowthSkill = skillAnalysis.some(s => 
            s.marketInsights && s.marketInsights.some(i => i.includes('rapidly growing'))
        );
        
        if (hasHighGrowthSkill) {
            recommendations.push('🚀 Focus marketing on high-growth skill areas');
        }

        return recommendations;
    }

    suggestSimilarSkills(skillName) {
        const allSkills = Array.from(this.rateDatabase.keys());
        // Simple similarity based on common words
        return allSkills.filter(skill => 
            skill.includes(skillName.toLowerCase()) || 
            skillName.toLowerCase().includes(skill.split('_')[0])
        ).slice(0, 3);
    }

    // Integration with OpenClaw for rate research delivery
    async sendRateResearch(researchData, sessionKey = null) {
        const message = `📊 **Market Rate Research Complete**

**Skill:** ${researchData.skill}
**Experience Level:** ${researchData.experienceLevel}
**Location:** ${researchData.location}

**💰 Current Market Rates:**
- Range: $${researchData.rates.min}-${researchData.rates.max}/hour
- Median: $${researchData.rates.median}/hour

**🎯 Pricing Recommendations:**
${researchData.pricingRecommendations.map(rec => `• ${rec}`).join('\n')}

**📈 Market Insights:**
${researchData.marketInsights.map(insight => `• ${insight}`).join('\n')}

**🏆 Top Specializations:**
${Object.entries(researchData.specializations)
    .filter(([_, data]) => data.demand === 'high')
    .map(([spec, data]) => `• ${spec.replace('_', ' ')}: +${data.premium}% premium`)
    .join('\n')}

*Research updated: ${researchData.lastUpdated.toLocaleDateString()}*`;

        if (sessionKey) {
            console.log(`Sending rate research to session: ${sessionKey}`);
            return message;
        } else {
            console.log(message);
            return message;
        }
    }
}

module.exports = { MarketRateResearch };