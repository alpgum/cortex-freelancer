/**
 * Upwork Platform Connector
 * Handles job scraping and RSS feed parsing for Upwork
 */

const PlatformConnector = require('./PlatformConnector');
const cheerio = require('cheerio');

class UpworkConnector extends PlatformConnector {
    constructor(config = {}) {
        super(config);
        this.platformName = 'upwork';
        this.baseUrl = 'https://www.upwork.com';
        
        // Upwork-specific configuration
        this.config = {
            ...this.config,
            searchUrl: 'https://www.upwork.com/nx/search/jobs',
            rssBaseUrl: 'https://www.upwork.com/ab/feed/jobs/rss',
            maxResultsPerPage: 50,
            ...config
        };
    }

    /**
     * Search for jobs on Upwork
     * @param {Object} criteria - Search criteria
     * @returns {Promise<Object[]>} Job listings
     */
    async searchJobs(criteria) {
        try {
            const searchParams = this.buildSearchParams(criteria);
            const searchUrl = `${this.config.searchUrl}?${searchParams}`;
            
            const response = await this.makeRequest(searchUrl, {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            return this.parseSearchResults(response);
            
        } catch (error) {
            console.error('Upwork search failed:', error);
            
            // Fallback to RSS feed if search API fails
            try {
                return await this.searchViaRSS(criteria);
            } catch (rssError) {
                throw new Error(`Both search methods failed: ${error.message}, RSS: ${rssError.message}`);
            }
        }
    }

    /**
     * Get RSS feed URL for specific search criteria
     * @param {Object} criteria - Search criteria
     * @returns {string} RSS feed URL
     */
    getRSSFeedUrl(criteria = {}) {
        const params = new URLSearchParams();
        
        if (criteria.skills && criteria.skills.length > 0) {
            params.append('q', criteria.skills.join(' '));
        }
        
        if (criteria.budget && criteria.budget.min) {
            params.append('budget', `${criteria.budget.min}-${criteria.budget.max || ''}`);
        }
        
        if (criteria.category) {
            params.append('category2', criteria.category);
        }
        
        // Default parameters
        params.append('sort', 'recency');
        params.append('paging', `0;${criteria.limit || 20}`);
        
        return `${this.config.rssBaseUrl}?${params.toString()}`;
    }

    /**
     * Search for jobs using RSS feed
     * @param {Object} criteria - Search criteria
     * @returns {Promise<Object[]>} Job listings
     */
    async searchViaRSS(criteria) {
        const rssUrl = this.getRSSFeedUrl(criteria);
        const rssContent = await this.makeRequest(rssUrl);
        return this.parseRSSJobs(rssContent);
    }

    /**
     * Parse RSS feed content to extract jobs
     * @param {string} rssContent - RSS XML content
     * @returns {Object[]} Parsed job listings
     */
    parseRSSJobs(rssContent) {
        try {
            const $ = cheerio.load(rssContent, { xmlMode: true });
            const jobs = [];

            $('item').each((index, element) => {
                const $item = $(element);
                
                const rawJob = {
                    title: $item.find('title').text().trim(),
                    description: $item.find('description').text().trim(),
                    url: $item.find('link').text().trim(),
                    postedAt: $item.find('pubDate').text().trim(),
                    category: $item.find('category').text().trim(),
                    guid: $item.find('guid').text().trim()
                };

                // Extract additional data from description
                const descriptionData = this.parseJobDescription(rawJob.description);
                
                const job = this.normalizeJob({
                    ...rawJob,
                    ...descriptionData,
                    id: this.extractJobIdFromUrl(rawJob.url),
                    platform: this.platformName
                });

                jobs.push(job);
            });

            return jobs;
            
        } catch (error) {
            throw new Error(`Failed to parse Upwork RSS feed: ${error.message}`);
        }
    }

    /**
     * Parse job description to extract structured data
     * @param {string} description - Job description HTML
     * @returns {Object} Extracted job data
     */
    parseJobDescription(description) {
        const $ = cheerio.load(description);
        const data = {};

        // Extract budget
        const budgetText = $.text().match(/Budget:\s*\$?([\d,.-]+(?:\s*-\s*\$?[\d,.-]+)?)/i);
        if (budgetText) {
            data.budget = budgetText[1].replace(/,/g, '');
        }

        // Extract hourly rate
        const hourlyText = $.text().match(/Hourly Range:\s*\$?([\d.-]+)\s*-\s*\$?([\d.-]+)/i);
        if (hourlyText) {
            data.budget = `${hourlyText[1]}-${hourlyText[2]}`;
            data.isHourly = true;
        }

        // Extract skills
        const skillsMatch = $.text().match(/Skills?:(.+?)(?:\n|Posted)/i);
        if (skillsMatch) {
            data.skills = skillsMatch[1]
                .split(',')
                .map(skill => skill.trim())
                .filter(skill => skill.length > 0);
        }

        // Extract country/location
        const countryMatch = $.text().match(/Country:\s*([^<\n]+)/i);
        if (countryMatch) {
            data.location = countryMatch[1].trim();
        }

        // Extract proposal count
        const proposalsMatch = $.text().match(/Proposals?:\s*(\d+)/i);
        if (proposalsMatch) {
            data.proposalCount = parseInt(proposalsMatch[1]);
        }

        // Detect if it's a fixed price project
        if ($.text().includes('Fixed-price') || $.text().includes('Budget:')) {
            data.isFixed = true;
        }

        return data;
    }

    /**
     * Extract job ID from Upwork URL
     * @param {string} url - Job URL
     * @returns {string} Job ID
     */
    extractJobIdFromUrl(url) {
        const match = url.match(/jobs\/[^\/]*~([a-f0-9]+)/i);
        return match ? match[1] : this.generateJobId({ url });
    }

    /**
     * Get detailed job information
     * @param {string} jobId - Job ID
     * @returns {Promise<Object>} Detailed job information
     */
    async getJob(jobId) {
        try {
            // Construct job URL from ID
            const jobUrl = `${this.baseUrl}/jobs/~${jobId}`;
            return await this.analyzeJob(jobUrl);
        } catch (error) {
            throw new Error(`Failed to get Upwork job ${jobId}: ${error.message}`);
        }
    }

    /**
     * Analyze a job from its URL
     * @param {string} url - Job URL
     * @returns {Promise<Object>} Job analysis
     */
    async analyzeJob(url) {
        try {
            const response = await this.makeRequest(url, {
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                }
            });

            return this.parseJobPage(response, url);
            
        } catch (error) {
            throw new Error(`Failed to analyze Upwork job: ${error.message}`);
        }
    }

    /**
     * Parse job page HTML to extract detailed information
     * @param {string} html - Job page HTML
     * @param {string} url - Job URL
     * @returns {Object} Detailed job information
     */
    parseJobPage(html, url) {
        const $ = cheerio.load(html);
        
        const rawJob = {
            id: this.extractJobIdFromUrl(url),
            url: url,
            title: $('h2[data-test="JobTitle"]').text().trim() || 
                   $('h1').first().text().trim(),
            description: $('[data-test="Description"]').text().trim() ||
                        $('[data-test="job-description"]').text().trim(),
            
            // Budget information
            budget: this.extractBudgetFromPage($),
            
            // Skills
            skills: this.extractSkillsFromPage($),
            
            // Client information
            client: this.extractClientFromPage($),
            
            // Job metadata
            postedAt: this.extractPostedDate($),
            proposalCount: this.extractProposalCount($),
            category: $('[data-test="job-category"]').text().trim(),
            
            // Job type
            isFixed: this.isFixedPriceJob($),
            isUrgent: this.isUrgentJob($),
            
            platform: this.platformName
        };

        return this.normalizeJob(rawJob);
    }

    /**
     * Build search parameters for Upwork API
     * @param {Object} criteria - Search criteria
     * @returns {string} URL search parameters
     */
    buildSearchParams(criteria) {
        const params = new URLSearchParams();
        
        if (criteria.skills && criteria.skills.length > 0) {
            params.append('q', criteria.skills.join(' '));
        }
        
        if (criteria.budget) {
            if (criteria.budget.min) {
                params.append('budget', `[${criteria.budget.min} TO ${criteria.budget.max || 'infinity'}]`);
            }
        }
        
        if (criteria.location) {
            params.append('client_location', criteria.location);
        }
        
        if (criteria.category) {
            params.append('category2_uid', criteria.category);
        }
        
        // Default parameters
        params.append('sort', 'recency');
        params.append('per_page', criteria.limit || this.config.maxResultsPerPage);
        params.append('contractor_tier', '2,3'); // Intermediate and expert
        
        return params.toString();
    }

    /**
     * Parse search results from Upwork API response
     * @param {Object} response - API response
     * @returns {Object[]} Parsed job listings
     */
    parseSearchResults(response) {
        const jobs = [];
        
        if (response.paging && response.paging.results) {
            response.paging.results.forEach(rawJob => {
                const job = this.normalizeJob({
                    id: rawJob.ciphertext || rawJob.id,
                    title: rawJob.title,
                    description: rawJob.description,
                    skills: rawJob.skills ? rawJob.skills.map(s => s.skill) : [],
                    budget: rawJob.budget || rawJob.hourly_pay_rate,
                    isFixed: rawJob.job_type === 'Fixed',
                    proposalCount: rawJob.proposals_count,
                    postedAt: rawJob.date_created,
                    client: {
                        rating: rawJob.client && rawJob.client.score,
                        totalSpent: rawJob.client && rawJob.client.total_spent,
                        reviewCount: rawJob.client && rawJob.client.reviews_count,
                        location: rawJob.client && rawJob.client.location,
                        isVerified: rawJob.client && rawJob.client.is_verified
                    },
                    url: `${this.baseUrl}/jobs/~${rawJob.ciphertext || rawJob.id}`,
                    platform: this.platformName
                });
                
                jobs.push(job);
            });
        }
        
        return jobs;
    }

    // Helper methods for parsing job page
    extractBudgetFromPage($) {
        // Look for budget in various locations
        const budgetSelectors = [
            '[data-test="budget"]',
            '[data-test="hourly-range"]',
            '.up-card-section:contains("Budget")',
            '.client-activity-items:contains("Budget")'
        ];
        
        for (const selector of budgetSelectors) {
            const budgetText = $(selector).text().trim();
            if (budgetText) {
                return budgetText.replace(/[^\d\-\.]/g, '');
            }
        }
        
        return null;
    }

    extractSkillsFromPage($) {
        const skills = [];
        
        // Look for skills in various locations
        $('[data-test="SkillsSection"] span, [data-test="skills"] span, .up-skill-badge').each((i, el) => {
            const skill = $(el).text().trim();
            if (skill) {
                skills.push(skill.toLowerCase());
            }
        });
        
        return skills;
    }

    extractClientFromPage($) {
        return {
            rating: parseFloat($('[data-test="client-rating"]').text()) || 0,
            reviewCount: parseInt($('[data-test="reviews-count"]').text()) || 0,
            location: $('[data-test="client-location"]').text().trim(),
            totalSpent: $('[data-test="client-spent"]').text().trim(),
            hireRate: parseFloat($('[data-test="hire-rate"]').text()) || 0,
            isVerified: $('[data-test="payment-verification-status"]').length > 0
        };
    }

    extractPostedDate($) {
        const dateText = $('[data-test="PostedOn"]').text().trim();
        return this.parseDate(dateText);
    }

    extractProposalCount($) {
        const proposalText = $('[data-test="proposal-count"]').text().trim();
        const match = proposalText.match(/(\d+)/);
        return match ? parseInt(match[1]) : 0;
    }

    isFixedPriceJob($) {
        return $('body').text().includes('Fixed-price') || 
               $('[data-test="job-type"]').text().includes('Fixed');
    }

    isUrgentJob($) {
        return $('[data-test="urgent-badge"]').length > 0 ||
               $('.up-badge-urgent').length > 0;
    }

    /**
     * Get Upwork job categories
     * @returns {Object[]} Available categories
     */
    getJobCategories() {
        return [
            { id: '531770282580668418', name: 'Web, Mobile & Software Dev' },
            { id: '531770282584862722', name: 'IT & Networking' },
            { id: '531770282580668417', name: 'Data Science & Analytics' },
            { id: '531770282580668416', name: 'Engineering & Architecture' },
            { id: '531770282580668419', name: 'Design & Creative' },
            { id: '531770282580668420', name: 'Writing & Translation' },
            { id: '531770282580668421', name: 'Sales & Marketing' },
            { id: '531770282580668422', name: 'Admin & Customer Support' },
            { id: '531770282580668423', name: 'Finance & Accounting' },
            { id: '531770282580668424', name: 'Legal' }
        ];
    }

    /**
     * Get common Upwork skill keywords
     * @returns {string[]} Skill keywords
     */
    getSkillKeywords() {
        return [
            'javascript', 'python', 'java', 'react', 'node.js', 'php', 'angular',
            'vue.js', 'typescript', 'html', 'css', 'wordpress', 'shopify',
            'ios', 'android', 'flutter', 'react native', 'unity', 'unreal',
            'figma', 'photoshop', 'illustrator', 'sketch', 'adobe xd',
            'copywriting', 'content writing', 'seo', 'social media marketing',
            'google ads', 'facebook ads', 'email marketing', 'lead generation',
            'data entry', 'virtual assistant', 'customer service',
            'accounting', 'bookkeeping', 'quickbooks', 'excel',
            'machine learning', 'artificial intelligence', 'data analysis'
        ];
    }
}

module.exports = UpworkConnector;