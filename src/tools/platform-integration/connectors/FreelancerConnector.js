/**
 * Freelancer.com Platform Connector
 * Handles job scraping and project analysis for Freelancer.com
 */

const PlatformConnector = require('./PlatformConnector');
const cheerio = require('cheerio');

class FreelancerConnector extends PlatformConnector {
    constructor(config = {}) {
        super(config);
        this.platformName = 'freelancer';
        this.baseUrl = 'https://www.freelancer.com';
        
        // Freelancer-specific configuration
        this.config = {
            ...this.config,
            searchUrl: 'https://www.freelancer.com/search/projects',
            apiBaseUrl: 'https://www.freelancer.com/api',
            maxResultsPerPage: 50,
            ...config
        };
    }

    /**
     * Search for projects on Freelancer.com
     * @param {Object} criteria - Search criteria
     * @returns {Promise<Object[]>} Project listings
     */
    async searchJobs(criteria) {
        try {
            const searchParams = this.buildSearchParams(criteria);
            const searchUrl = `${this.config.searchUrl}?${searchParams}`;
            
            const response = await this.makeRequest(searchUrl, {
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                }
            });

            return this.parseSearchResults(response);
            
        } catch (error) {
            throw new Error(`Freelancer.com search failed: ${error.message}`);
        }
    }

    /**
     * Parse search results from Freelancer.com
     * @param {string} html - Search results HTML
     * @returns {Object[]} Parsed job listings
     */
    parseSearchResults(html) {
        const $ = cheerio.load(html);
        const jobs = [];

        // Freelancer.com uses different selectors for project cards
        $('.JobSearchCard, .project-item, [data-project-id]').each((index, element) => {
            const $card = $(element);
            
            const rawJob = {
                id: $card.attr('data-project-id') || this.extractProjectId($card),
                title: $card.find('.JobSearchCard-title a, .project-title a, h2 a').first().text().trim(),
                description: $card.find('.JobSearchCard-snippet, .project-description, .snippet').first().text().trim(),
                skills: this.extractSkillsFromCard($card),
                budget: this.extractBudgetFromCard($card),
                bids: this.extractBidCount($card),
                postedAt: this.extractPostedDate($card),
                isFixed: this.isFixedProject($card),
                isFeatured: $card.find('.featured-badge, .is-featured').length > 0,
                isUrgent: $card.find('.urgent-badge, .is-urgent').length > 0,
                url: this.buildProjectUrl($card),
                location: $card.find('.project-location, .client-location').text().trim(),
                client: this.extractClientFromCard($card)
            };

            const job = this.normalizeJob({
                ...rawJob,
                platform: this.platformName,
                competition: rawJob.bids
            });

            jobs.push(job);
        });

        return jobs;
    }

    /**
     * Get detailed project information
     * @param {string} projectId - Project ID
     * @returns {Promise<Object>} Detailed project information
     */
    async getJob(projectId) {
        try {
            const projectUrl = `${this.baseUrl}/projects/${projectId}`;
            return await this.analyzeJob(projectUrl);
        } catch (error) {
            throw new Error(`Failed to get Freelancer project ${projectId}: ${error.message}`);
        }
    }

    /**
     * Analyze a project from its URL
     * @param {string} url - Project URL
     * @returns {Promise<Object>} Project analysis
     */
    async analyzeJob(url) {
        try {
            const response = await this.makeRequest(url);
            return this.parseProjectPage(response, url);
            
        } catch (error) {
            throw new Error(`Failed to analyze Freelancer project: ${error.message}`);
        }
    }

    /**
     * Parse project page for detailed information
     * @param {string} html - Project page HTML
     * @param {string} url - Project URL
     * @returns {Object} Detailed project information
     */
    parseProjectPage(html, url) {
        const $ = cheerio.load(html);
        
        const rawJob = {
            id: this.extractProjectIdFromUrl(url),
            url: url,
            title: $('h1, .project-title').first().text().trim(),
            description: $('.project-description, .description-text').text().trim(),
            
            // Budget and bidding
            budget: this.extractBudgetFromPage($),
            bids: this.extractBidCountFromPage($),
            avgBid: this.extractAverageBid($),
            
            // Skills and tags
            skills: this.extractSkillsFromPage($),
            
            // Project metadata
            postedAt: this.extractProjectPostedDate($),
            isFixed: this.isFixedPriceProject($),
            isSealed: this.isSealedBidding($),
            isFeatured: $('.featured-project, .is-featured').length > 0,
            isUrgent: $('.urgent-project, .is-urgent').length > 0,
            
            // Client information
            client: this.extractClientFromPage($),
            
            // Project requirements
            location: this.extractProjectLocation($),
            timeline: this.extractProjectTimeline($),
            category: this.extractProjectCategory($),
            
            platform: this.platformName
        };

        return this.normalizeJob(rawJob);
    }

    /**
     * Build search parameters for Freelancer.com
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
                params.append('min_price', criteria.budget.min);
            }
            if (criteria.budget.max) {
                params.append('max_price', criteria.budget.max);
            }
        }
        
        if (criteria.location) {
            params.append('location', criteria.location);
        }
        
        if (criteria.category) {
            params.append('category', criteria.category);
        }
        
        // Default filters
        params.append('type', 'fixed,hourly'); // Both fixed and hourly projects
        params.append('sort_field', 'time'); // Sort by newest
        params.append('results', criteria.limit || this.config.maxResultsPerPage);
        
        return params.toString();
    }

    // Helper methods for extracting data from search cards
    extractProjectId($card) {
        // Try various methods to get project ID
        const href = $card.find('a').first().attr('href');
        if (href) {
            const match = href.match(/\/projects\/([^\/\?]+)/);
            if (match) return match[1];
        }
        
        return this.generateJobId({ 
            title: $card.find('.JobSearchCard-title, .project-title').text().trim() 
        });
    }

    extractSkillsFromCard($card) {
        const skills = [];
        
        $card.find('.JobSearchCard-skills .skill, .project-skills .skill, .skill-tag').each((i, el) => {
            const skill = $(el).text().trim();
            if (skill) {
                skills.push(skill.toLowerCase());
            }
        });
        
        return skills;
    }

    extractBudgetFromCard($card) {
        const budgetSelectors = [
            '.JobSearchCard-budget',
            '.project-budget',
            '.budget-amount',
            '.price'
        ];
        
        for (const selector of budgetSelectors) {
            const budgetText = $card.find(selector).text().trim();
            if (budgetText) {
                return this.parseBudgetText(budgetText);
            }
        }
        
        return null;
    }

    extractBidCount($card) {
        const bidSelectors = [
            '.JobSearchCard-bids',
            '.bid-count',
            '.bids-count'
        ];
        
        for (const selector of bidSelectors) {
            const bidText = $card.find(selector).text().trim();
            const match = bidText.match(/(\d+)/);
            if (match) {
                return parseInt(match[1]);
            }
        }
        
        return 0;
    }

    extractPostedDate($card) {
        const dateSelectors = [
            '.JobSearchCard-posted-date',
            '.posted-date',
            '.time-posted'
        ];
        
        for (const selector of dateSelectors) {
            const dateText = $card.find(selector).text().trim();
            if (dateText) {
                return this.parseRelativeDate(dateText);
            }
        }
        
        return new Date();
    }

    isFixedProject($card) {
        const typeText = $card.text().toLowerCase();
        return typeText.includes('fixed') && !typeText.includes('hourly');
    }

    buildProjectUrl($card) {
        const href = $card.find('a').first().attr('href');
        if (!href) return null;
        
        return href.startsWith('http') ? href : `${this.baseUrl}${href}`;
    }

    extractClientFromCard($card) {
        return {
            name: $card.find('.client-name').text().trim() || 'Anonymous',
            location: $card.find('.client-location').text().trim(),
            rating: this.parseRating($card.find('.client-rating').text()),
            reviewCount: this.parseReviewCount($card.find('.client-reviews').text()),
            isVerified: $card.find('.verified-badge').length > 0
        };
    }

    // Helper methods for extracting data from project pages
    extractProjectIdFromUrl(url) {
        const match = url.match(/\/projects\/([^\/\?]+)/);
        return match ? match[1] : this.generateJobId({ url });
    }

    extractBudgetFromPage($) {
        const budgetSelectors = [
            '.project-budget-amount',
            '.budget-amount',
            '.project-price'
        ];
        
        for (const selector of budgetSelectors) {
            const budgetText = $(selector).text().trim();
            if (budgetText) {
                return this.parseBudgetText(budgetText);
            }
        }
        
        return null;
    }

    extractBidCountFromPage($) {
        const bidText = $('.bids-count, .total-bids').text().trim();
        const match = bidText.match(/(\d+)/);
        return match ? parseInt(match[1]) : 0;
    }

    extractAverageBid($) {
        const avgText = $('.average-bid, .avg-bid').text().trim();
        return this.parseBudgetText(avgText);
    }

    extractSkillsFromPage($) {
        const skills = [];
        
        $('.project-skills .skill, .skills-list .skill').each((i, el) => {
            const skill = $(el).text().trim();
            if (skill) {
                skills.push(skill.toLowerCase());
            }
        });
        
        return skills;
    }

    extractProjectPostedDate($) {
        const dateText = $('.posted-date, .project-posted-time').text().trim();
        return this.parseRelativeDate(dateText);
    }

    isFixedPriceProject($) {
        return $('.project-type').text().toLowerCase().includes('fixed') ||
               $('.fixed-price').length > 0;
    }

    isSealedBidding($) {
        return $('.sealed-bidding, .sealed-project').length > 0;
    }

    extractClientFromPage($) {
        return {
            name: $('.employer-name, .client-name').text().trim(),
            location: $('.employer-location, .client-location').text().trim(),
            rating: this.parseRating($('.employer-rating, .client-rating').text()),
            reviewCount: this.parseReviewCount($('.employer-reviews, .client-reviews').text()),
            memberSince: this.parseDate($('.member-since').text().trim()),
            totalPosted: parseInt($('.total-posted').text().match(/(\d+)/)?.[1]) || 0,
            hireRate: parseFloat($('.hire-rate').text().match(/([\d.]+)%/)?.[1]) || 0,
            isVerified: $('.verified-employer, .verified-client').length > 0,
            paymentVerified: $('.payment-verified').length > 0
        };
    }

    extractProjectLocation($) {
        return $('.project-location, .location-preference').text().trim() || 'Remote';
    }

    extractProjectTimeline($) {
        return $('.project-timeline, .delivery-time').text().trim();
    }

    extractProjectCategory($) {
        return $('.project-category, .category-breadcrumb').text().trim();
    }

    // Utility methods
    parseBudgetText(budgetText) {
        if (!budgetText) return null;
        
        // Remove currency symbols and extra text
        const cleanText = budgetText.replace(/[^\d\-\.]/g, '');
        
        if (cleanText.includes('-')) {
            const [min, max] = cleanText.split('-').map(Number);
            return {
                min: min || 0,
                max: max || min || 0,
                type: 'range'
            };
        } else {
            const amount = parseFloat(cleanText) || 0;
            return {
                min: amount,
                max: amount,
                type: 'fixed'
            };
        }
    }

    parseRating(ratingText) {
        const match = ratingText.match(/([\d.]+)/);
        return match ? parseFloat(match[1]) : 0;
    }

    parseReviewCount(reviewText) {
        const match = reviewText.match(/(\d+)/);
        return match ? parseInt(match[1]) : 0;
    }

    parseRelativeDate(dateText) {
        if (!dateText) return new Date();
        
        const now = new Date();
        dateText = dateText.toLowerCase();
        
        if (dateText.includes('minute')) {
            const minutes = parseInt(dateText.match(/(\d+)/)?.[1]) || 1;
            return new Date(now.getTime() - (minutes * 60 * 1000));
        } else if (dateText.includes('hour')) {
            const hours = parseInt(dateText.match(/(\d+)/)?.[1]) || 1;
            return new Date(now.getTime() - (hours * 60 * 60 * 1000));
        } else if (dateText.includes('day')) {
            const days = parseInt(dateText.match(/(\d+)/)?.[1]) || 1;
            return new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
        } else if (dateText.includes('week')) {
            const weeks = parseInt(dateText.match(/(\d+)/)?.[1]) || 1;
            return new Date(now.getTime() - (weeks * 7 * 24 * 60 * 60 * 1000));
        } else if (dateText.includes('month')) {
            const months = parseInt(dateText.match(/(\d+)/)?.[1]) || 1;
            return new Date(now.getTime() - (months * 30 * 24 * 60 * 60 * 1000));
        }
        
        return now;
    }

    /**
     * Get Freelancer.com categories
     * @returns {Object[]} Available categories
     */
    getJobCategories() {
        return [
            { id: 'websites', name: 'Websites, IT & Software' },
            { id: 'mobile', name: 'Mobile Phones & Computing' },
            { id: 'design-multimedia', name: 'Design, Media & Architecture' },
            { id: 'writing', name: 'Writing & Content' },
            { id: 'data-entry', name: 'Data Entry & Admin' },
            { id: 'sales-marketing', name: 'Sales & Marketing' },
            { id: 'business', name: 'Business, Accounting, Human Resources & Legal' },
            { id: 'engineering', name: 'Engineering & Science' },
            { id: 'translation', name: 'Translation & Languages' },
            { id: 'local', name: 'Local Jobs & Services' }
        ];
    }

    /**
     * Get common Freelancer.com skill keywords
     * @returns {string[]} Skill keywords
     */
    getSkillKeywords() {
        return [
            'php', 'html', 'css', 'javascript', 'mysql', 'wordpress', 'website design',
            'graphic design', 'logo design', 'photoshop', 'illustrator',
            'data entry', 'excel', 'virtual assistant', 'customer service',
            'content writing', 'copywriting', 'article writing', 'blog writing',
            'seo', 'internet marketing', 'social media marketing', 'lead generation',
            'mobile app development', 'android', 'ios', 'react native', 'flutter',
            'python', 'java', 'c++', 'c#', 'node.js', 'react', 'angular', 'vue.js',
            'machine learning', 'artificial intelligence', 'data science',
            'video editing', 'animation', '3d modeling', 'after effects',
            'translation', 'proofreading', 'transcription'
        ];
    }
}

module.exports = FreelancerConnector;