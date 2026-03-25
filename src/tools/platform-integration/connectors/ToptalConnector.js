/**
 * Toptal Platform Connector
 * Handles screening preparation and talent matching for Toptal-style platforms
 */

const PlatformConnector = require('./PlatformConnector');
const cheerio = require('cheerio');

class ToptalConnector extends PlatformConnector {
    constructor(config = {}) {
        super(config);
        this.platformName = 'toptal';
        this.baseUrl = 'https://www.toptal.com';
        
        // Toptal-specific configuration
        this.config = {
            ...this.config,
            skillsUrl: 'https://www.toptal.com/top-3-percent',
            screeningUrl: 'https://www.toptal.com/talent',
            blogUrl: 'https://www.toptal.com/blog',
            ...config
        };

        // Toptal screening criteria
        this.screeningCriteria = {
            skills: {
                technical: {
                    weight: 0.4,
                    categories: [
                        'programming_languages',
                        'frameworks',
                        'databases',
                        'tools',
                        'methodologies'
                    ]
                },
                communication: {
                    weight: 0.3,
                    areas: ['english_proficiency', 'client_interaction', 'documentation']
                },
                experience: {
                    weight: 0.3,
                    factors: ['years', 'project_complexity', 'leadership', 'domain_expertise']
                }
            },
            passingScore: 80 // Minimum score to pass screening
        };
    }

    /**
     * Search for talent opportunities and screening information
     * Note: Toptal doesn't have traditional job listings like other platforms
     * Instead, we analyze requirements and provide screening preparation
     * @param {Object} criteria - Search criteria
     * @returns {Promise<Object[]>} Screening opportunities and requirements
     */
    async searchJobs(criteria) {
        try {
            // Analyze market demand for skills
            const marketDemand = await this.analyzeSkillDemand(criteria.skills || []);
            
            // Get screening requirements
            const screeningReqs = await this.getScreeningRequirements(criteria.skills || []);
            
            // Generate preparation opportunities
            const opportunities = this.generateScreeningOpportunities(marketDemand, screeningReqs, criteria);
            
            return opportunities;
            
        } catch (error) {
            throw new Error(`Toptal analysis failed: ${error.message}`);
        }
    }

    /**
     * Analyze skill demand in the top-tier freelance market
     * @param {string[]} skills - Skills to analyze
     * @returns {Promise<Object>} Market demand analysis
     */
    async analyzeSkillDemand(skills) {
        try {
            // Scrape Toptal skills pages for demand indicators
            const demandData = {};
            
            for (const skill of skills) {
                try {
                    const skillDemand = await this.getSkillDemandData(skill);
                    demandData[skill] = skillDemand;
                } catch (error) {
                    console.warn(`Failed to analyze demand for ${skill}:`, error.message);
                    demandData[skill] = this.getDefaultDemandData(skill);
                }
                
                // Rate limit between requests
                await this.delay(1000);
            }
            
            return {
                skills: demandData,
                overallDemand: this.calculateOverallDemand(demandData),
                marketTrends: this.analyzeMarketTrends(demandData),
                competitionLevel: this.estimateCompetitionLevel(demandData)
            };
            
        } catch (error) {
            throw new Error(`Failed to analyze skill demand: ${error.message}`);
        }
    }

    /**
     * Get screening requirements for specific skills
     * @param {string[]} skills - Skills to get requirements for
     * @returns {Promise<Object>} Screening requirements
     */
    async getScreeningRequirements(skills) {
        try {
            const requirements = {
                technical: await this.getTechnicalRequirements(skills),
                portfolio: await this.getPortfolioRequirements(skills),
                interview: await this.getInterviewRequirements(skills),
                test: await this.getTestRequirements(skills)
            };
            
            return requirements;
            
        } catch (error) {
            throw new Error(`Failed to get screening requirements: ${error.message}`);
        }
    }

    /**
     * Generate screening preparation opportunities
     * @param {Object} marketDemand - Market demand analysis
     * @param {Object} screeningReqs - Screening requirements
     * @param {Object} criteria - Original criteria
     * @returns {Object[]} Screening opportunities
     */
    generateScreeningOpportunities(marketDemand, screeningReqs, criteria) {
        const opportunities = [];
        
        Object.entries(marketDemand.skills).forEach(([skill, demand]) => {
            const opportunity = this.normalizeJob({
                id: `toptal_screening_${skill}_${Date.now()}`,
                title: `Toptal Screening Preparation: ${skill}`,
                description: this.generateOpportunityDescription(skill, demand, screeningReqs),
                skills: [skill, ...this.getRelatedSkills(skill)],
                budget: this.estimateEarningPotential(skill, demand),
                platform: this.platformName,
                isScreeningPrep: true,
                demandLevel: demand.level,
                competitionLevel: demand.competition,
                preparationSteps: this.generatePreparationSteps(skill, screeningReqs),
                requiredSkills: screeningReqs.technical[skill] || [],
                portfolioRequirements: screeningReqs.portfolio[skill] || [],
                interviewTopics: screeningReqs.interview[skill] || [],
                testAreas: screeningReqs.test[skill] || [],
                passingProbability: this.estimatePassingProbability(skill, criteria),
                timeToPrep: this.estimatePreparationTime(skill, demand),
                postedAt: new Date(),
                url: `${this.baseUrl}/talent/apply`
            });
            
            opportunities.push(opportunity);
        });
        
        // Add general preparation opportunity
        opportunities.push(this.generateGeneralPrepOpportunity(marketDemand, screeningReqs));
        
        return opportunities.sort((a, b) => 
            (b.demandLevel * b.passingProbability) - (a.demandLevel * a.passingProbability)
        );
    }

    /**
     * Get skill demand data for a specific skill
     * @param {string} skill - Skill to analyze
     * @returns {Promise<Object>} Skill demand data
     */
    async getSkillDemandData(skill) {
        try {
            // Try to get data from Toptal's skills pages
            const skillUrl = `${this.config.skillsUrl}/${skill.toLowerCase().replace(/[^a-z0-9]/g, '-')}-developers`;
            
            try {
                const response = await this.makeRequest(skillUrl);
                return this.parseSkillDemandPage(response, skill);
            } catch (error) {
                // Fallback to blog analysis
                return await this.analyzeSkillFromBlog(skill);
            }
            
        } catch (error) {
            return this.getDefaultDemandData(skill);
        }
    }

    /**
     * Parse skill demand from Toptal skill page
     * @param {string} html - Page HTML
     * @param {string} skill - Skill name
     * @returns {Object} Demand data
     */
    parseSkillDemandPage(html, skill) {
        const $ = cheerio.load(html);
        
        return {
            level: this.extractDemandLevel($),
            competition: this.extractCompetitionLevel($),
            averageRate: this.extractAverageRate($),
            requirements: this.extractSkillRequirements($),
            trends: this.extractTrendData($),
            relatedSkills: this.extractRelatedSkills($)
        };
    }

    /**
     * Analyze skill demand from Toptal blog posts
     * @param {string} skill - Skill to analyze
     * @returns {Promise<Object>} Demand data from blog analysis
     */
    async analyzeSkillFromBlog(skill) {
        try {
            const blogSearchUrl = `${this.config.blogUrl}/search?q=${encodeURIComponent(skill)}`;
            const response = await this.makeRequest(blogSearchUrl);
            
            const $ = cheerio.load(response);
            const mentionCount = $('.search-result').length;
            const recentMentions = this.countRecentMentions($, skill);
            
            return {
                level: this.calculateDemandFromMentions(mentionCount, recentMentions),
                competition: this.estimateCompetitionFromBlog(mentionCount),
                averageRate: this.getDefaultRateForSkill(skill),
                requirements: this.getDefaultRequirements(skill),
                trends: { direction: 'stable', confidence: 'low' },
                relatedSkills: this.getRelatedSkills(skill)
            };
            
        } catch (error) {
            return this.getDefaultDemandData(skill);
        }
    }

    /**
     * Get default demand data for a skill
     * @param {string} skill - Skill name
     * @returns {Object} Default demand data
     */
    getDefaultDemandData(skill) {
        const skillMapping = {
            'javascript': { level: 9, competition: 8, rate: 150 },
            'react': { level: 9, competition: 9, rate: 160 },
            'node.js': { level: 8, competition: 7, rate: 140 },
            'python': { level: 8, competition: 7, rate: 135 },
            'java': { level: 7, competition: 6, rate: 130 },
            'php': { level: 6, competition: 8, rate: 100 },
            'go': { level: 8, competition: 5, rate: 150 },
            'rust': { level: 7, competition: 3, rate: 160 },
            'swift': { level: 6, competition: 5, rate: 140 },
            'kotlin': { level: 6, competition: 4, rate: 135 }
        };
        
        const defaults = skillMapping[skill.toLowerCase()] || { level: 5, competition: 5, rate: 120 };
        
        return {
            level: defaults.level,
            competition: defaults.competition,
            averageRate: defaults.rate,
            requirements: this.getDefaultRequirements(skill),
            trends: { direction: 'stable', confidence: 'low' },
            relatedSkills: this.getRelatedSkills(skill)
        };
    }

    /**
     * Get technical requirements for skills
     * @param {string[]} skills - Skills to get requirements for
     * @returns {Promise<Object>} Technical requirements
     */
    async getTechnicalRequirements(skills) {
        const requirements = {};
        
        skills.forEach(skill => {
            requirements[skill] = this.getTechnicalRequirementsForSkill(skill);
        });
        
        return requirements;
    }

    /**
     * Get portfolio requirements for skills
     * @param {string[]} skills - Skills to get requirements for
     * @returns {Promise<Object>} Portfolio requirements
     */
    async getPortfolioRequirements(skills) {
        const requirements = {};
        
        skills.forEach(skill => {
            requirements[skill] = this.getPortfolioRequirementsForSkill(skill);
        });
        
        return requirements;
    }

    /**
     * Get interview requirements for skills
     * @param {string[]} skills - Skills to get requirements for
     * @returns {Promise<Object>} Interview requirements
     */
    async getInterviewRequirements(skills) {
        const requirements = {};
        
        skills.forEach(skill => {
            requirements[skill] = this.getInterviewRequirementsForSkill(skill);
        });
        
        return requirements;
    }

    /**
     * Get test requirements for skills
     * @param {string[]} skills - Skills to get requirements for
     * @returns {Promise<Object>} Test requirements
     */
    async getTestRequirements(skills) {
        const requirements = {};
        
        skills.forEach(skill => {
            requirements[skill] = this.getTestRequirementsForSkill(skill);
        });
        
        return requirements;
    }

    // Helper methods
    getTechnicalRequirementsForSkill(skill) {
        const techReqs = {
            'javascript': [
                'ES6+ features and syntax',
                'Asynchronous programming (Promises, async/await)',
                'DOM manipulation and event handling',
                'Module systems (ES6, CommonJS)',
                'Testing frameworks (Jest, Mocha)',
                'Build tools (Webpack, Vite)',
                'Package managers (npm, yarn)'
            ],
            'react': [
                'Component lifecycle and hooks',
                'State management (useState, useReducer, Context)',
                'Props and prop validation',
                'JSX syntax and best practices',
                'Performance optimization techniques',
                'Testing React components',
                'React Router for navigation'
            ],
            'node.js': [
                'Express.js framework',
                'RESTful API design',
                'Database integration (MongoDB, PostgreSQL)',
                'Authentication and authorization',
                'Middleware patterns',
                'Error handling and logging',
                'Performance monitoring'
            ]
        };
        
        return techReqs[skill.toLowerCase()] || [
            'Core language/framework concepts',
            'Best practices and design patterns',
            'Testing and debugging',
            'Performance optimization',
            'Security considerations'
        ];
    }

    getPortfolioRequirementsForSkill(skill) {
        return [
            '3-5 high-quality projects demonstrating skill mastery',
            'Clean, well-documented code available on GitHub',
            'Live demos or deployed applications',
            'Detailed project descriptions explaining challenges and solutions',
            'Evidence of best practices and design patterns',
            'Performance optimizations and testing coverage'
        ];
    }

    getInterviewRequirementsForSkill(skill) {
        return [
            'Technical problem-solving scenarios',
            'Code architecture and design discussions',
            'Best practices and pattern recognition',
            'Performance optimization strategies',
            'Experience with real-world projects',
            'Communication of technical concepts',
            'Handling of edge cases and error scenarios'
        ];
    }

    getTestRequirementsForSkill(skill) {
        return [
            'Live coding exercises',
            'Algorithm and data structure problems',
            'System design challenges',
            'Code review and refactoring tasks',
            'Debugging exercises',
            'Performance optimization problems'
        ];
    }

    generateOpportunityDescription(skill, demand, requirements) {
        return `Prepare for Toptal screening in ${skill}. Market demand: ${demand.level}/10, Competition: ${demand.competition}/10. 
        
Requirements include:
- Technical mastery: ${requirements.technical[skill]?.slice(0, 3).join(', ')} and more
- Portfolio: ${requirements.portfolio[skill]?.slice(0, 2).join(', ')}
- Interview preparation for system design and problem-solving
- Live coding test preparation

Average hourly rate for accepted talent: $${demand.averageRate}+/hour`;
    }

    estimateEarningPotential(skill, demand) {
        const baseRate = demand.averageRate || 120;
        return {
            min: Math.round(baseRate * 0.8),
            max: Math.round(baseRate * 1.5),
            currency: 'USD',
            type: 'hourly'
        };
    }

    generatePreparationSteps(skill, requirements) {
        return [
            `Master ${skill} fundamentals and advanced concepts`,
            'Build 3-5 portfolio projects demonstrating expertise',
            'Practice live coding and algorithm problems',
            'Study system design patterns',
            'Improve English communication skills',
            'Practice explaining technical concepts clearly',
            'Review common interview questions',
            'Get code reviews from senior developers'
        ];
    }

    estimatePassingProbability(skill, criteria) {
        // Base probability
        let probability = 0.15; // Toptal has ~15% acceptance rate
        
        // Adjust based on criteria
        if (criteria.experience && criteria.experience > 3) {
            probability += 0.1;
        }
        
        if (criteria.skills && criteria.skills.length > 3) {
            probability += 0.05;
        }
        
        if (criteria.portfolio && criteria.portfolio.length > 2) {
            probability += 0.05;
        }
        
        return Math.min(0.4, probability); // Cap at 40%
    }

    estimatePreparationTime(skill, demand) {
        const baseTime = 8; // 8 weeks base preparation
        const competitionFactor = demand.competition / 10;
        const demandFactor = (10 - demand.level) / 10;
        
        return Math.round(baseTime * (1 + competitionFactor + demandFactor));
    }

    generateGeneralPrepOpportunity(marketDemand, requirements) {
        return this.normalizeJob({
            id: `toptal_general_prep_${Date.now()}`,
            title: 'Toptal General Screening Preparation Program',
            description: `Comprehensive preparation program for Toptal screening process. 
            
This program covers:
- Technical skill assessment and improvement
- Portfolio development and optimization
- Interview preparation and practice
- Live coding test preparation
- English communication skills improvement
- Client interaction best practices

Success rate improvement: 2-3x higher chance of acceptance with proper preparation.`,
            skills: ['screening', 'interview', 'portfolio', 'communication'],
            budget: { min: 0, max: 0, currency: 'USD', type: 'free' },
            platform: this.platformName,
            isScreeningPrep: true,
            isGeneralPrep: true,
            demandLevel: 10,
            competitionLevel: 9,
            preparationSteps: [
                'Complete skill assessment',
                'Identify areas for improvement',
                'Build targeted portfolio projects',
                'Practice technical interviews',
                'Improve English proficiency',
                'Practice live coding',
                'Study system design',
                'Mock interviews with feedback'
            ],
            timeToPrep: 12,
            postedAt: new Date(),
            url: `${this.baseUrl}/talent`
        });
    }

    getRelatedSkills(skill) {
        const relatedMap = {
            'javascript': ['typescript', 'react', 'node.js', 'vue.js', 'angular'],
            'react': ['javascript', 'redux', 'next.js', 'typescript', 'jest'],
            'node.js': ['javascript', 'express', 'mongodb', 'postgresql', 'redis'],
            'python': ['django', 'flask', 'pandas', 'numpy', 'machine learning'],
            'java': ['spring', 'hibernate', 'maven', 'gradle', 'junit']
        };
        
        return relatedMap[skill.toLowerCase()] || [];
    }

    getDefaultRequirements(skill) {
        return [
            `Expert-level ${skill} knowledge`,
            '3+ years of professional experience',
            'Strong problem-solving skills',
            'Excellent English communication',
            'Portfolio of high-quality projects'
        ];
    }

    // Analysis helper methods
    extractDemandLevel($) {
        // Look for demand indicators in the page
        const indicators = ['high demand', 'growing demand', 'top skill'];
        const pageText = $.text().toLowerCase();
        
        let demandLevel = 5; // default
        indicators.forEach(indicator => {
            if (pageText.includes(indicator)) {
                demandLevel += 2;
            }
        });
        
        return Math.min(10, demandLevel);
    }

    extractCompetitionLevel($) {
        // Estimate competition based on page content
        return 7; // Default medium-high competition
    }

    extractAverageRate($) {
        const rateMatch = $.text().match(/\$(\d+).*hour/i);
        return rateMatch ? parseInt(rateMatch[1]) : 120;
    }

    extractSkillRequirements($) {
        const requirements = [];
        $('li, .requirement').each((i, el) => {
            const req = $(el).text().trim();
            if (req && req.length > 10 && req.length < 100) {
                requirements.push(req);
            }
        });
        return requirements.slice(0, 10); // Top 10 requirements
    }

    calculateOverallDemand(demandData) {
        const levels = Object.values(demandData).map(d => d.level);
        return levels.reduce((a, b) => a + b, 0) / levels.length;
    }

    analyzeMarketTrends(demandData) {
        // Simplified trend analysis
        return {
            direction: 'growing',
            confidence: 'medium',
            projectedGrowth: '15-25% annually'
        };
    }

    estimateCompetitionLevel(demandData) {
        const competitions = Object.values(demandData).map(d => d.competition);
        return competitions.reduce((a, b) => a + b, 0) / competitions.length;
    }

    // Toptal doesn't have traditional job listings, so these are adapted
    async getJob(jobId) {
        throw new Error('Toptal does not have traditional job listings. Use screening preparation opportunities instead.');
    }

    async analyzeJob(url) {
        if (url.includes('toptal.com')) {
            // Analyze Toptal pages for requirements and opportunities
            const response = await this.makeRequest(url);
            return this.parseToptalPage(response, url);
        }
        
        throw new Error('URL does not appear to be a Toptal page');
    }

    parseToptalPage(html, url) {
        const $ = cheerio.load(html);
        
        return {
            id: this.generateJobId({ url }),
            title: $('h1').first().text().trim() || 'Toptal Opportunity',
            description: $('.content, .description').first().text().trim(),
            url: url,
            platform: this.platformName,
            isAnalysis: true,
            analysisType: 'page_analysis',
            postedAt: new Date()
        };
    }

    getJobCategories() {
        return [
            { id: 'software', name: 'Software Development' },
            { id: 'design', name: 'Design' },
            { id: 'finance', name: 'Finance' },
            { id: 'project', name: 'Project Management' },
            { id: 'product', name: 'Product Management' }
        ];
    }

    getSkillKeywords() {
        return [
            'javascript', 'react', 'node.js', 'python', 'java', 'go', 'rust',
            'typescript', 'angular', 'vue.js', 'next.js', 'express',
            'django', 'flask', 'spring boot', 'postgresql', 'mongodb',
            'aws', 'azure', 'gcp', 'docker', 'kubernetes',
            'machine learning', 'ai', 'data science', 'blockchain'
        ];
    }
}

module.exports = ToptalConnector;