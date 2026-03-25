/**
 * Platform Integration Module for Cortex Freelancer
 * Unified interface for freelance platform job discovery and matching
 */

const PlatformConnector = require('./connectors/PlatformConnector');
const UpworkConnector = require('./connectors/UpworkConnector');
const FiverrConnector = require('./connectors/FiverrConnector');
const FreelancerConnector = require('./connectors/FreelancerConnector');
const ToptalConnector = require('./connectors/ToptalConnector');

const JobMatcher = require('./matching/JobMatcher');
const OpportunityScorer = require('./scoring/OpportunityScorer');
const SmartAlerts = require('./alerts/SmartAlerts');
const PlatformCLI = require('./cli/PlatformCLI');

class PlatformIntegration {
    constructor(config = {}) {
        this.config = {
            // Default matching weights
            skillsWeight: 0.3,
            budgetWeight: 0.25,
            timelineWeight: 0.15,
            clientQualityWeight: 0.2,
            competitionWeight: 0.1,
            ...config
        };

        // Initialize connectors
        this.connectors = new Map();
        this.connectors.set('upwork', new UpworkConnector(config.upwork || {}));
        this.connectors.set('fiverr', new FiverrConnector(config.fiverr || {}));
        this.connectors.set('freelancer', new FreelancerConnector(config.freelancer || {}));
        this.connectors.set('toptal', new ToptalConnector(config.toptal || {}));

        // Initialize matching and scoring
        this.jobMatcher = new JobMatcher(this.config);
        this.opportunityScorer = new OpportunityScorer(this.config);
        this.smartAlerts = new SmartAlerts(this.config);
        this.cli = new PlatformCLI(this);
    }

    /**
     * Get all available platform connectors
     * @returns {Map} Map of platform name to connector instance
     */
    getConnectors() {
        return this.connectors;
    }

    /**
     * Get a specific platform connector
     * @param {string} platform - Platform name (upwork, fiverr, freelancer, toptal)
     * @returns {PlatformConnector} Platform connector instance
     */
    getConnector(platform) {
        return this.connectors.get(platform.toLowerCase());
    }

    /**
     * Search for jobs across multiple platforms
     * @param {Object} criteria - Search criteria
     * @param {string[]} criteria.skills - Required skills
     * @param {Object} criteria.budget - Budget range {min, max}
     * @param {string[]} criteria.platforms - Platforms to search (default: all)
     * @returns {Promise<Object[]>} Aggregated job listings
     */
    async searchJobs(criteria) {
        const platforms = criteria.platforms || Array.from(this.connectors.keys());
        const results = [];

        await Promise.allSettled(
            platforms.map(async (platform) => {
                try {
                    const connector = this.getConnector(platform);
                    if (connector) {
                        const jobs = await connector.searchJobs(criteria);
                        results.push(...jobs.map(job => ({
                            ...job,
                            platform,
                            foundAt: new Date()
                        })));
                    }
                } catch (error) {
                    console.warn(`Failed to search ${platform}:`, error.message);
                }
            })
        );

        return results;
    }

    /**
     * Match jobs against freelancer profile
     * @param {Object} profile - Freelancer profile
     * @param {Object[]} jobs - Job listings
     * @returns {Promise<Object[]>} Jobs with match scores
     */
    async matchJobs(profile, jobs) {
        const matchedJobs = [];

        for (const job of jobs) {
            try {
                const matchScore = await this.jobMatcher.calculateMatch(profile, job);
                const opportunityScore = await this.opportunityScorer.scoreOpportunity(job, profile);
                
                matchedJobs.push({
                    ...job,
                    matchScore,
                    opportunityScore,
                    combinedScore: (matchScore * 0.6) + (opportunityScore * 0.4)
                });
            } catch (error) {
                console.warn(`Failed to match job ${job.id}:`, error.message);
                matchedJobs.push({
                    ...job,
                    matchScore: 0,
                    opportunityScore: 0,
                    combinedScore: 0,
                    matchError: error.message
                });
            }
        }

        return matchedJobs.sort((a, b) => b.combinedScore - a.combinedScore);
    }

    /**
     * Analyze a specific job URL
     * @param {string} url - Job URL
     * @returns {Promise<Object>} Job analysis
     */
    async analyzeJob(url) {
        // Determine platform from URL
        const platform = this.detectPlatformFromUrl(url);
        if (!platform) {
            throw new Error('Unsupported platform URL');
        }

        const connector = this.getConnector(platform);
        if (!connector) {
            throw new Error(`No connector available for ${platform}`);
        }

        return await connector.analyzeJob(url);
    }

    /**
     * Set up job monitoring with alerts
     * @param {Object} criteria - Monitoring criteria
     * @param {Function} callback - Alert callback function
     * @returns {string} Monitor ID
     */
    async setupMonitoring(criteria, callback) {
        return await this.smartAlerts.setupMonitor(criteria, callback);
    }

    /**
     * Stop job monitoring
     * @param {string} monitorId - Monitor ID
     */
    async stopMonitoring(monitorId) {
        return await this.smartAlerts.stopMonitor(monitorId);
    }

    /**
     * Get CLI interface
     * @returns {PlatformCLI} CLI instance
     */
    getCLI() {
        return this.cli;
    }

    /**
     * Detect platform from job URL
     * @private
     * @param {string} url - Job URL
     * @returns {string|null} Platform name
     */
    detectPlatformFromUrl(url) {
        const urlMap = {
            'upwork.com': 'upwork',
            'fiverr.com': 'fiverr',
            'freelancer.com': 'freelancer',
            'toptal.com': 'toptal'
        };

        for (const [domain, platform] of Object.entries(urlMap)) {
            if (url.includes(domain)) {
                return platform;
            }
        }

        return null;
    }
}

module.exports = {
    PlatformIntegration,
    PlatformConnector,
    UpworkConnector,
    FiverrConnector,
    FreelancerConnector,
    ToptalConnector,
    JobMatcher,
    OpportunityScorer,
    SmartAlerts,
    PlatformCLI
};