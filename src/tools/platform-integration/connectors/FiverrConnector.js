/**
 * Fiverr Platform Connector
 * Handles buyer request analysis and gig structure parsing for Fiverr
 */

const PlatformConnector = require('./PlatformConnector');
const cheerio = require('cheerio');

class FiverrConnector extends PlatformConnector {
    constructor(config = {}) {
        super(config);
        this.platformName = 'fiverr';
        this.baseUrl = 'https://www.fiverr.com';
        
        // Fiverr-specific configuration
        this.config = {
            ...this.config,
            buyerRequestsUrl: 'https://www.fiverr.com/users/buyer_requests',
            searchUrl: 'https://www.fiverr.com/search/gigs',
            maxResultsPerPage: 48,
            ...config
        };
    }

    /**
     * Search for buyer requests on Fiverr
     * Note: Fiverr doesn't have traditional job postings like Upwork,
     * but has buyer requests that freelancers can bid on
     * @param {Object} criteria - Search criteria
     * @returns {Promise<Object[]>} Buyer request listings
     */
    async searchJobs(criteria) {
        try {
            // Fiverr requires authentication to access buyer requests
            if (!this.isAuthenticated) {
                throw new Error('Authentication required to access Fiverr buyer requests');
            }

            return await this.searchBuyerRequests(criteria);
            
        } catch (error) {
            console.error('Fiverr search failed:', error);
            
            // Fallback to analyzing existing gigs for market insights
            try {
                return await this.analyzeMarketOpportunities(criteria);
            } catch (fallbackError) {
                throw new Error(`Fiverr search failed: ${error.message}`);
            }
        }
    }

    /**
     * Search buyer requests on Fiverr
     * @param {Object} criteria - Search criteria
     * @returns {Promise<Object[]>} Buyer requests
     */
    async searchBuyerRequests(criteria) {
        const requestsUrl = this.buildBuyerRequestsUrl(criteria);
        
        const response = await this.makeRequest(requestsUrl, {
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Cookie': this.getAuthCookies() // Requires authentication
            }
        });

        return this.parseBuyerRequests(response);
    }

    /**
     * Parse buyer requests from Fiverr HTML
     * @param {string} html - Buyer requests page HTML
     * @returns {Object[]} Parsed buyer requests
     */
    parseBuyerRequests(html) {
        const $ = cheerio.load(html);
        const requests = [];

        $('.request-card, .buyer-request').each((index, element) => {
            const $card = $(element);
            
            const rawRequest = {
                title: $card.find('.request-title, h3').first().text().trim(),
                description: $card.find('.request-description, .description').text().trim(),
                budget: this.extractBudgetFromCard($card),
                timeline: this.extractTimelineFromCard($card),
                category: $card.find('.category, .request-category').text().trim(),
                postedAt: this.extractPostedDate($card),
                isActive: $card.find('.active-indicator').length > 0,
                offers: this.extractOfferCount($card),
                url: this.buildRequestUrl($card)
            };

            const request = this.normalizeJob({
                ...rawRequest,
                id: this.generateRequestId(rawRequest),
                platform: this.platformName,
                skills: this.extractSkills(rawRequest.description),
                client: this.extractBuyerInfo($card),
                competition: rawRequest.offers
            });

            requests.push(request);
        });

        return requests;
    }

    /**
     * Analyze market opportunities by examining existing gigs
     * This helps identify gaps and opportunities even without buyer requests
     * @param {Object} criteria - Search criteria
     * @returns {Promise<Object[]>} Market opportunity analysis
     */
    async analyzeMarketOpportunities(criteria) {
        try {
            const searchUrl = this.buildGigSearchUrl(criteria);
            const response = await this.makeRequest(searchUrl);
            
            const gigs = this.parseGigResults(response);
            
            // Transform gig analysis into opportunity format
            return this.convertGigsToOpportunities(gigs, criteria);
            
        } catch (error) {
            throw new Error(`Failed to analyze Fiverr market opportunities: ${error.message}`);
        }
    }

    /**
     * Parse gig search results
     * @param {string} html - Search results HTML
     * @returns {Object[]} Parsed gigs
     */
    parseGigResults(html) {
        const $ = cheerio.load(html);
        const gigs = [];

        $('.gig-card, [data-gig-id]').each((index, element) => {
            const $gig = $(element);
            
            const gig = {
                id: $gig.attr('data-gig-id') || this.generateJobId({ title: $gig.find('a').first().attr('title') }),
                title: $gig.find('a').first().attr('title') || $gig.find('.gig-title').text().trim(),
                seller: {
                    name: $gig.find('.seller-name').text().trim(),
                    level: $gig.find('.level-desc').text().trim(),
                    rating: this.parseRating($gig.find('.gig-rating').text()),
                    reviewCount: this.parseReviewCount($gig.find('.total-rating').text())
                },
                price: this.parseGigPrice($gig),
                category: $gig.find('.category-breadcrumbs').text().trim(),
                tags: this.extractGigTags($gig),
                url: this.buildGigUrl($gig.find('a').first().attr('href')),
                imageUrl: $gig.find('img').first().attr('src')
            };
            
            gigs.push(gig);
        });

        return gigs;
    }

    /**
     * Convert gig analysis to opportunity format
     * @param {Object[]} gigs - Analyzed gigs
     * @param {Object} criteria - Original search criteria
     * @returns {Object[]} Opportunities
     */
    convertGigsToOpportunities(gigs, criteria) {
        const opportunities = [];
        
        // Analyze pricing gaps
        const pricingAnalysis = this.analyzePricingGaps(gigs);
        
        // Identify underserved niches
        const nicheAnalysis = this.identifyNiches(gigs, criteria);
        
        // Create opportunity objects
        pricingAnalysis.forEach(gap => {
            opportunities.push(this.normalizeJob({
                id: `fiverr_opportunity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                title: `Market Opportunity: ${gap.category}`,
                description: `Pricing gap identified in ${gap.category}. Average price: $${gap.avgPrice}, Suggested price: $${gap.suggestedPrice}`,
                budget: { min: gap.suggestedPrice * 0.8, max: gap.suggestedPrice * 1.2 },
                skills: gap.commonSkills,
                platform: this.platformName,
                isOpportunity: true,
                opportunityType: 'pricing_gap',
                marketData: gap,
                competition: gap.competitionLevel,
                postedAt: new Date()
            }));
        });

        return opportunities;
    }

    /**
     * Build buyer requests URL with search parameters
     * @param {Object} criteria - Search criteria
     * @returns {string} Buyer requests URL
     */
    buildBuyerRequestsUrl(criteria) {
        const params = new URLSearchParams();
        
        if (criteria.category) {
            params.append('category', criteria.category);
        }
        
        if (criteria.skills && criteria.skills.length > 0) {
            params.append('q', criteria.skills.join(' '));
        }
        
        if (criteria.budget && criteria.budget.min) {
            params.append('budget_min', criteria.budget.min);
            if (criteria.budget.max) {
                params.append('budget_max', criteria.budget.max);
            }
        }
        
        params.append('sort', 'newest');
        
        return `${this.config.buyerRequestsUrl}?${params.toString()}`;
    }

    /**
     * Build gig search URL
     * @param {Object} criteria - Search criteria
     * @returns {string} Search URL
     */
    buildGigSearchUrl(criteria) {
        const params = new URLSearchParams();
        
        if (criteria.skills && criteria.skills.length > 0) {
            params.append('query', criteria.skills.join(' '));
        }
        
        if (criteria.category) {
            params.append('category', criteria.category);
        }
        
        params.append('source', 'top-bar');
        params.append('search_in', 'everywhere');
        
        return `${this.config.searchUrl}?${params.toString()}`;
    }

    /**
     * Get detailed information about a buyer request
     * @param {string} requestId - Request ID
     * @returns {Promise<Object>} Detailed request information
     */
    async getJob(requestId) {
        // Fiverr buyer requests are typically shown in list format
        // Individual request details may require authentication
        throw new Error('Individual buyer request details require authentication and may not be publicly accessible');
    }

    /**
     * Analyze a Fiverr gig URL for competitive intelligence
     * @param {string} url - Gig URL
     * @returns {Promise<Object>} Gig analysis
     */
    async analyzeJob(url) {
        try {
            const response = await this.makeRequest(url);
            return this.parseGigPage(response, url);
            
        } catch (error) {
            throw new Error(`Failed to analyze Fiverr gig: ${error.message}`);
        }
    }

    /**
     * Parse individual gig page for detailed analysis
     * @param {string} html - Gig page HTML
     * @param {string} url - Gig URL
     * @returns {Object} Detailed gig analysis
     */
    parseGigPage(html, url) {
        const $ = cheerio.load(html);
        
        return this.normalizeJob({
            id: this.extractGigIdFromUrl(url),
            url: url,
            title: $('h1').first().text().trim(),
            description: $('.description-content, .gig-desc').text().trim(),
            
            // Seller information
            client: {
                name: $('.username').text().trim(),
                level: $('.seller-level').text().trim(),
                rating: this.parseRating($('.rating-score').text()),
                reviewCount: this.parseReviewCount($('.reviews-count').text()),
                responseTime: $('.response-time').text().trim(),
                location: $('.seller-location').text().trim()
            },
            
            // Pricing packages
            budget: this.parseGigPackages($),
            
            // Skills and tags
            skills: this.extractGigSkills($),
            tags: this.extractGigTags($),
            
            // Gig metadata
            category: $('.breadcrumb-container').text().trim(),
            gallery: this.extractGalleryImages($),
            faq: this.extractFAQ($),
            
            platform: this.platformName,
            isGigAnalysis: true
        });
    }

    // Helper methods
    extractBudgetFromCard($card) {
        const budgetText = $card.find('.budget, .price, .request-budget').text().trim();
        const match = budgetText.match(/\$?(\d+(?:\.\d{2})?)/);
        return match ? parseFloat(match[1]) : 0;
    }

    extractTimelineFromCard($card) {
        const timelineText = $card.find('.timeline, .delivery-time, .request-timeline').text().trim();
        return timelineText || null;
    }

    extractOfferCount($card) {
        const offerText = $card.find('.offer-count, .offers').text().trim();
        const match = offerText.match(/(\d+)/);
        return match ? parseInt(match[1]) : 0;
    }

    extractPostedDate($card) {
        const dateText = $card.find('.posted-date, .time-ago').text().trim();
        return this.parseRelativeDate(dateText);
    }

    extractBuyerInfo($card) {
        return {
            name: $card.find('.buyer-name').text().trim() || 'Anonymous',
            location: $card.find('.buyer-location').text().trim(),
            isVerified: $card.find('.verified-badge').length > 0
        };
    }

    generateRequestId(request) {
        return `fiverr_request_${this.simpleHash(request.title + request.description)}`;
    }

    buildRequestUrl($card) {
        const href = $card.find('a').first().attr('href');
        return href ? `${this.baseUrl}${href}` : null;
    }

    buildGigUrl(href) {
        if (!href) return null;
        return href.startsWith('http') ? href : `${this.baseUrl}${href}`;
    }

    extractGigIdFromUrl(url) {
        const match = url.match(/\/([^\/]+)$/);
        return match ? match[1] : this.generateJobId({ url });
    }

    parseGigPrice($gig) {
        const priceText = $gig.find('.price, .gig-price').text().trim();
        const match = priceText.match(/\$?(\d+(?:\.\d{2})?)/);
        return match ? parseFloat(match[1]) : 0;
    }

    parseRating(ratingText) {
        const match = ratingText.match(/([\d.]+)/);
        return match ? parseFloat(match[1]) : 0;
    }

    parseReviewCount(reviewText) {
        const match = reviewText.match(/\((\d+)\)|(\d+)\s+reviews?/i);
        return match ? parseInt(match[1] || match[2]) : 0;
    }

    extractGigTags($element) {
        const tags = [];
        $element.find('.tag, .gig-tag, .search-tag').each((i, el) => {
            const tag = $(el).text().trim();
            if (tag) tags.push(tag.toLowerCase());
        });
        return tags;
    }

    extractGigSkills($) {
        return this.extractGigTags($).concat(
            this.extractSkills($('.gig-desc, .description-content').text())
        );
    }

    parseGigPackages($) {
        const packages = [];
        $('.package, .package-item').each((i, el) => {
            const $pkg = $(el);
            packages.push({
                name: $pkg.find('.package-name').text().trim(),
                price: this.parseGigPrice($pkg),
                deliveryTime: $pkg.find('.delivery-time').text().trim(),
                features: $pkg.find('.feature').map((j, feat) => $(feat).text().trim()).get()
            });
        });
        
        return packages.length > 0 ? packages : null;
    }

    extractGalleryImages($) {
        return $('.gallery-item img, .gig-gallery img').map((i, img) => $(img).attr('src')).get();
    }

    extractFAQ($) {
        const faq = [];
        $('.faq-item').each((i, el) => {
            const $item = $(el);
            faq.push({
                question: $item.find('.question').text().trim(),
                answer: $item.find('.answer').text().trim()
            });
        });
        return faq;
    }

    parseRelativeDate(dateText) {
        if (!dateText) return new Date();
        
        const now = new Date();
        
        if (dateText.includes('hour')) {
            const hours = parseInt(dateText.match(/(\d+)/)?.[1]) || 1;
            return new Date(now.getTime() - (hours * 60 * 60 * 1000));
        } else if (dateText.includes('day')) {
            const days = parseInt(dateText.match(/(\d+)/)?.[1]) || 1;
            return new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
        } else if (dateText.includes('week')) {
            const weeks = parseInt(dateText.match(/(\d+)/)?.[1]) || 1;
            return new Date(now.getTime() - (weeks * 7 * 24 * 60 * 60 * 1000));
        }
        
        return now;
    }

    analyzePricingGaps(gigs) {
        // Group gigs by category and analyze pricing
        const categories = {};
        
        gigs.forEach(gig => {
            const category = gig.category || 'General';
            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category].push(gig);
        });
        
        const gaps = [];
        
        Object.entries(categories).forEach(([category, categoryGigs]) => {
            const prices = categoryGigs.map(g => g.price).filter(p => p > 0);
            if (prices.length === 0) return;
            
            const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
            const minPrice = Math.min(...prices);
            const maxPrice = Math.max(...prices);
            
            // Identify pricing gaps
            if (maxPrice / minPrice > 3) { // Significant price variation
                gaps.push({
                    category,
                    avgPrice: Math.round(avgPrice),
                    minPrice,
                    maxPrice,
                    suggestedPrice: Math.round(avgPrice * 0.8), // Competitive pricing
                    competitionLevel: categoryGigs.length,
                    commonSkills: this.extractCommonSkills(categoryGigs)
                });
            }
        });
        
        return gaps;
    }

    identifyNiches(gigs, criteria) {
        // Identify underserved niches based on competition and demand
        return [];
    }

    extractCommonSkills(gigs) {
        const skillCounts = {};
        
        gigs.forEach(gig => {
            if (gig.tags) {
                gig.tags.forEach(tag => {
                    skillCounts[tag] = (skillCounts[tag] || 0) + 1;
                });
            }
        });
        
        return Object.entries(skillCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([skill]) => skill);
    }

    getAuthCookies() {
        // This would need to be implemented with actual authentication
        return '';
    }

    /**
     * Get Fiverr categories
     * @returns {Object[]} Available categories
     */
    getJobCategories() {
        return [
            { id: 'programming-tech', name: 'Programming & Tech' },
            { id: 'graphics-design', name: 'Graphics & Design' },
            { id: 'digital-marketing', name: 'Digital Marketing' },
            { id: 'writing-translation', name: 'Writing & Translation' },
            { id: 'video-animation', name: 'Video & Animation' },
            { id: 'ai-services', name: 'AI Services' },
            { id: 'music-audio', name: 'Music & Audio' },
            { id: 'business', name: 'Business' },
            { id: 'lifestyle', name: 'Lifestyle' },
            { id: 'data', name: 'Data' },
            { id: 'photography', name: 'Photography' }
        ];
    }

    /**
     * Get common Fiverr skill keywords
     * @returns {string[]} Skill keywords
     */
    getSkillKeywords() {
        return [
            'logo design', 'website development', 'wordpress', 'shopify',
            'content writing', 'copywriting', 'seo', 'social media marketing',
            'video editing', 'animation', '3d modeling', 'voice over',
            'data entry', 'virtual assistant', 'lead generation',
            'mobile app development', 'ai chatbot', 'machine learning',
            'graphic design', 'illustration', 'ui/ux design', 'web design',
            'translation', 'transcription', 'proofreading',
            'music production', 'podcast editing', 'sound design'
        ];
    }
}

module.exports = FiverrConnector;