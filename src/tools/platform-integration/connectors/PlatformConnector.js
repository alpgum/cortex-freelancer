/**
 * Base Platform Connector Interface
 * Provides unified interface for all freelance platform integrations
 */

class PlatformConnector {
    constructor(config = {}) {
        this.config = {
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            timeout: 30000,
            retryAttempts: 3,
            retryDelay: 1000,
            ...config
        };
        
        this.platformName = 'base';
        this.baseUrl = '';
        this.isAuthenticated = false;
    }

    /**
     * Search for jobs on this platform
     * @param {Object} criteria - Search criteria
     * @param {string[]} criteria.skills - Required skills
     * @param {Object} criteria.budget - Budget range {min, max}
     * @param {string} criteria.location - Location preference
     * @param {string} criteria.duration - Project duration
     * @param {number} criteria.limit - Maximum results to return
     * @returns {Promise<Object[]>} Job listings
     */
    async searchJobs(criteria) {
        throw new Error('searchJobs must be implemented by platform connector');
    }

    /**
     * Get detailed job information
     * @param {string} jobId - Job ID
     * @returns {Promise<Object>} Detailed job information
     */
    async getJob(jobId) {
        throw new Error('getJob must be implemented by platform connector');
    }

    /**
     * Analyze a job from its URL
     * @param {string} url - Job URL
     * @returns {Promise<Object>} Job analysis
     */
    async analyzeJob(url) {
        throw new Error('analyzeJob must be implemented by platform connector');
    }

    /**
     * Get RSS feed URL for job notifications
     * @returns {string|null} RSS feed URL
     */
    getRSSFeedUrl() {
        return null; // Override in platform-specific connectors
    }

    /**
     * Parse job data from RSS feed
     * @param {string} rssContent - RSS XML content
     * @returns {Object[]} Parsed job listings
     */
    parseRSSJobs(rssContent) {
        throw new Error('parseRSSJobs must be implemented by platform connector');
    }

    /**
     * Authenticate with platform
     * @param {Object} credentials - Platform credentials
     * @returns {Promise<boolean>} Authentication success
     */
    async authenticate(credentials) {
        // Override in platform-specific connectors
        return false;
    }

    /**
     * Get platform-specific job categories
     * @returns {string[]} Available categories
     */
    getJobCategories() {
        return [];
    }

    /**
     * Get platform-specific skill keywords
     * @returns {string[]} Common skills on this platform
     */
    getSkillKeywords() {
        return [];
    }

    /**
     * Normalize job data to standard format
     * @param {Object} rawJob - Platform-specific job data
     * @returns {Object} Standardized job object
     */
    normalizeJob(rawJob) {
        return {
            id: rawJob.id || this.generateJobId(rawJob),
            title: rawJob.title || '',
            description: rawJob.description || '',
            skills: this.extractSkills(rawJob.skills || rawJob.description || ''),
            budget: this.normalizeBudget(rawJob.budget || rawJob.price),
            timeline: rawJob.timeline || rawJob.duration || null,
            client: this.normalizeClient(rawJob.client || {}),
            competition: rawJob.proposalCount || rawJob.applicants || 0,
            url: rawJob.url || rawJob.link || '',
            postedAt: this.parseDate(rawJob.postedAt || rawJob.created_at),
            platform: this.platformName,
            location: rawJob.location || 'Remote',
            category: rawJob.category || 'General',
            isFixed: rawJob.isFixed || false,
            isUrgent: rawJob.isUrgent || false,
            tags: rawJob.tags || [],
            rawData: rawJob // Keep original data for debugging
        };
    }

    /**
     * Extract skills from text or skill array
     * @protected
     * @param {string|Array} skillData - Skills data
     * @returns {string[]} Normalized skill array
     */
    extractSkills(skillData) {
        if (Array.isArray(skillData)) {
            return skillData.map(skill => skill.toLowerCase().trim());
        }

        if (typeof skillData === 'string') {
            // Extract common tech skills from description
            const skillPatterns = [
                /\b(javascript|js|node\.?js|react|angular|vue|python|java|php|ruby|go|rust|swift|kotlin)\b/gi,
                /\b(html|css|scss|sass|less|typescript|ts)\b/gi,
                /\b(mongodb|mysql|postgresql|redis|elasticsearch)\b/gi,
                /\b(aws|azure|gcp|docker|kubernetes|terraform)\b/gi,
                /\b(figma|sketch|photoshop|illustrator|indesign)\b/gi,
                /\b(wordpress|shopify|magento|drupal|joomla)\b/gi
            ];

            const skills = [];
            skillPatterns.forEach(pattern => {
                const matches = skillData.match(pattern) || [];
                skills.push(...matches.map(match => match.toLowerCase().trim()));
            });

            return [...new Set(skills)]; // Remove duplicates
        }

        return [];
    }

    /**
     * Normalize budget information
     * @protected
     * @param {*} budgetData - Budget data in various formats
     * @returns {Object} Normalized budget object
     */
    normalizeBudget(budgetData) {
        if (!budgetData) {
            return { min: 0, max: 0, currency: 'USD', type: 'fixed' };
        }

        if (typeof budgetData === 'number') {
            return {
                min: budgetData,
                max: budgetData,
                currency: 'USD',
                type: 'fixed'
            };
        }

        if (typeof budgetData === 'string') {
            // Parse budget strings like "$500-$1000", "$50/hr", etc.
            const budgetStr = budgetData.replace(/[^\d\-\.\/]/g, '');
            
            if (budgetStr.includes('-')) {
                const [min, max] = budgetStr.split('-').map(Number);
                return {
                    min: min || 0,
                    max: max || min || 0,
                    currency: 'USD',
                    type: 'range'
                };
            } else if (budgetStr.includes('/')) {
                const rate = parseFloat(budgetStr.split('/')[0]) || 0;
                return {
                    min: rate,
                    max: rate,
                    currency: 'USD',
                    type: 'hourly'
                };
            } else {
                const amount = parseFloat(budgetStr) || 0;
                return {
                    min: amount,
                    max: amount,
                    currency: 'USD',
                    type: 'fixed'
                };
            }
        }

        if (typeof budgetData === 'object') {
            return {
                min: budgetData.min || budgetData.minimum || 0,
                max: budgetData.max || budgetData.maximum || budgetData.min || 0,
                currency: budgetData.currency || 'USD',
                type: budgetData.type || 'fixed'
            };
        }

        return { min: 0, max: 0, currency: 'USD', type: 'fixed' };
    }

    /**
     * Normalize client information
     * @protected
     * @param {Object} clientData - Client data
     * @returns {Object} Normalized client object
     */
    normalizeClient(clientData) {
        return {
            name: clientData.name || 'Anonymous',
            rating: this.normalizeRating(clientData.rating || clientData.reviews),
            reviewCount: clientData.reviewCount || clientData.totalReviews || 0,
            hireRate: clientData.hireRate || 0,
            location: clientData.location || 'Unknown',
            memberSince: this.parseDate(clientData.memberSince || clientData.joinDate),
            totalSpent: clientData.totalSpent || 0,
            isVerified: clientData.isVerified || clientData.verified || false,
            paymentVerified: clientData.paymentVerified || false
        };
    }

    /**
     * Normalize rating to 0-5 scale
     * @protected
     * @param {*} rating - Rating data
     * @returns {number} Normalized rating
     */
    normalizeRating(rating) {
        if (!rating) return 0;
        
        if (typeof rating === 'number') {
            // Assume 5-star scale, normalize if needed
            return Math.min(5, Math.max(0, rating));
        }

        if (typeof rating === 'string') {
            const numRating = parseFloat(rating);
            return isNaN(numRating) ? 0 : Math.min(5, Math.max(0, numRating));
        }

        return 0;
    }

    /**
     * Parse date string to Date object
     * @protected
     * @param {*} dateData - Date data
     * @returns {Date|null} Parsed date
     */
    parseDate(dateData) {
        if (!dateData) return null;
        
        if (dateData instanceof Date) {
            return dateData;
        }

        if (typeof dateData === 'string' || typeof dateData === 'number') {
            const date = new Date(dateData);
            return isNaN(date.getTime()) ? null : date;
        }

        return null;
    }

    /**
     * Generate unique job ID if none provided
     * @protected
     * @param {Object} jobData - Job data
     * @returns {string} Generated job ID
     */
    generateJobId(jobData) {
        const title = jobData.title || '';
        const timestamp = Date.now();
        const hash = this.simpleHash(`${title}${timestamp}`);
        return `${this.platformName}_${hash}`;
    }

    /**
     * Simple hash function for generating IDs
     * @protected
     * @param {string} str - String to hash
     * @returns {string} Hash string
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * Make HTTP request with retry logic
     * @protected
     * @param {string} url - Request URL
     * @param {Object} options - Request options
     * @returns {Promise<Object>} Response data
     */
    async makeRequest(url, options = {}) {
        const { retryAttempts, retryDelay, timeout, userAgent } = this.config;
        
        const requestOptions = {
            method: 'GET',
            headers: {
                'User-Agent': userAgent,
                'Accept': 'application/json,text/html,application/xhtml+xml',
                'Accept-Language': 'en-US,en;q=0.9',
                ...options.headers
            },
            timeout,
            ...options
        };

        let lastError;
        
        for (let attempt = 1; attempt <= retryAttempts; attempt++) {
            try {
                // Use fetch or implement your preferred HTTP client
                const response = await fetch(url, requestOptions);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const contentType = response.headers.get('content-type') || '';
                
                if (contentType.includes('application/json')) {
                    return await response.json();
                } else {
                    return await response.text();
                }
                
            } catch (error) {
                lastError = error;
                
                if (attempt < retryAttempts) {
                    await this.delay(retryDelay * attempt);
                } else {
                    throw new Error(`Failed after ${retryAttempts} attempts: ${lastError.message}`);
                }
            }
        }
    }

    /**
     * Delay execution for specified milliseconds
     * @protected
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise<void>}
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = PlatformConnector;