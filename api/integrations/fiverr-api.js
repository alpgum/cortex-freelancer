/**
 * Fiverr API Integration for Cortex Freelancer
 * Alternative job platform integration for broader opportunity coverage
 */

const axios = require('axios');
const cheerio = require('cheerio');

class FiverrAPI {
    constructor() {
        this.baseURL = 'https://api.fiverr.com/v1';
        this.webURL = 'https://www.fiverr.com';
        this.apiKey = process.env.FIVERR_API_KEY;
        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: 30000,
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'User-Agent': 'CortexFreelancer/1.0'
            }
        });
    }

    /**
     * Search for gigs/jobs on Fiverr
     * Note: Fiverr works differently - buyers post requests, sellers offer gigs
     */
    async searchOpportunities(criteria = {}) {
        try {
            const {
                category = '',
                subcategory = '',
                skills = '',
                budget_min = null,
                budget_max = null,
                delivery_time = '',
                seller_level = '',
                sort = 'relevance'
            } = criteria;

            // Since Fiverr API is limited, we'll implement both API and web scraping approaches
            const [apiResults, buyerRequests] = await Promise.all([
                this.searchGigs(criteria),
                this.searchBuyerRequests(criteria)
            ]);

            return {
                success: true,
                opportunities: {
                    gigs: apiResults.gigs || [],
                    buyerRequests: buyerRequests || []
                },
                total: (apiResults.gigs?.length || 0) + (buyerRequests?.length || 0),
                source: 'fiverr'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                opportunities: { gigs: [], buyerRequests: [] }
            };
        }
    }

    /**
     * Search existing gigs for competitive analysis
     */
    async searchGigs(criteria) {
        try {
            const params = this.buildGigSearchParams(criteria);
            
            const response = await this.client.get('/search/gigs', { params });
            
            return {
                success: true,
                gigs: response.data.gigs?.map(gig => this.formatGig(gig)) || [],
                pagination: response.data.pagination
            };
        } catch (error) {
            console.error('Fiverr gig search failed:', error);
            return {
                success: false,
                gigs: [],
                error: error.message
            };
        }
    }

    /**
     * Search buyer requests (the actual job opportunities)
     */
    async searchBuyerRequests(criteria) {
        try {
            // Fiverr buyer requests are often behind authentication
            // This is a simplified implementation
            const requests = await this.fetchBuyerRequests(criteria);
            
            return requests.map(request => this.formatBuyerRequest(request));
        } catch (error) {
            console.error('Buyer requests search failed:', error);
            return [];
        }
    }

    /**
     * Web scraping approach for buyer requests (when API is limited)
     */
    async fetchBuyerRequests(criteria) {
        try {
            // Note: This would require proper authentication and respect for Fiverr's ToS
            const url = `${this.webURL}/requests`;
            
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; CortexBot/1.0)'
                }
            });

            const $ = cheerio.load(response.data);
            const requests = [];

            $('.request-card').each((index, element) => {
                const request = this.parseRequestCard($, element);
                if (request) {
                    requests.push(request);
                }
            });

            return requests;
        } catch (error) {
            console.error('Web scraping failed:', error);
            return [];
        }
    }

    /**
     * Parse individual buyer request from HTML
     */
    parseRequestCard($, element) {
        try {
            const $el = $(element);
            
            return {
                title: $el.find('.request-title').text().trim(),
                description: $el.find('.request-description').text().trim(),
                budget: this.parseBudget($el.find('.request-budget').text()),
                category: $el.find('.request-category').text().trim(),
                skills: this.parseSkills($el.find('.request-skills').text()),
                timePosted: $el.find('.request-time').text().trim(),
                proposals: this.parseProposalCount($el.find('.request-proposals').text()),
                deliveryTime: $el.find('.request-delivery').text().trim(),
                platform: 'fiverr',
                type: 'buyer_request'
            };
        } catch (error) {
            console.error('Error parsing request card:', error);
            return null;
        }
    }

    /**
     * Format gig data for consistency
     */
    formatGig(gig) {
        return {
            id: gig.id,
            title: gig.title,
            description: gig.description,
            seller: {
                username: gig.seller?.username,
                level: gig.seller?.level,
                rating: gig.seller?.rating,
                completedOrders: gig.seller?.completedOrders
            },
            pricing: {
                basic: gig.packages?.basic?.price || null,
                standard: gig.packages?.standard?.price || null,
                premium: gig.packages?.premium?.price || null
            },
            category: gig.category,
            subcategory: gig.subcategory,
            tags: gig.tags || [],
            deliveryTime: gig.deliveryTime,
            rating: gig.rating,
            reviewCount: gig.reviewCount,
            impressions: gig.impressions,
            clicks: gig.clicks,
            orders: gig.orders,
            platform: 'fiverr',
            type: 'gig',
            url: `${this.webURL}${gig.url}`
        };
    }

    /**
     * Format buyer request for consistency
     */
    formatBuyerRequest(request) {
        return {
            id: request.id || this.generateRequestId(request),
            title: request.title,
            description: request.description,
            budget: request.budget,
            budgetType: 'fixed', // Fiverr is typically fixed price
            category: request.category,
            subcategory: request.subcategory,
            skills: request.skills || [],
            posted: request.timePosted,
            deliveryTime: request.deliveryTime,
            proposals: request.proposals || 0,
            platform: 'fiverr',
            type: 'buyer_request',
            clientInfo: {
                isVerified: request.clientVerified || false,
                previousOrders: request.clientOrders || 0
            }
        };
    }

    /**
     * Get seller profile information
     */
    async getSellerProfile(username) {
        try {
            const response = await this.client.get(`/sellers/${username}`);
            
            return {
                success: true,
                profile: {
                    username: response.data.username,
                    displayName: response.data.displayName,
                    description: response.data.description,
                    level: response.data.level,
                    rating: response.data.rating,
                    reviewCount: response.data.reviewCount,
                    completedOrders: response.data.completedOrders,
                    responseTime: response.data.responseTime,
                    languages: response.data.languages,
                    skills: response.data.skills,
                    certification: response.data.certifications,
                    since: response.data.memberSince
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                profile: null
            };
        }
    }

    /**
     * Submit proposal to buyer request
     */
    async submitProposal(requestId, proposalData) {
        try {
            const {
                message,
                deliveryTime,
                price,
                attachments = []
            } = proposalData;

            const proposal = {
                request_id: requestId,
                message: message,
                delivery_time: deliveryTime,
                price: price,
                attachments: attachments
            };

            const response = await this.client.post('/proposals', proposal);

            return {
                success: true,
                proposalId: response.data.proposal_id,
                status: response.data.status,
                message: 'Proposal submitted successfully'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get market insights for competitive analysis
     */
    async getMarketInsights(category, subcategory = null) {
        try {
            const params = { category };
            if (subcategory) params.subcategory = subcategory;

            const response = await this.client.get('/insights/market', { params });

            return {
                success: true,
                insights: {
                    averagePrice: response.data.averagePrice,
                    topTags: response.data.topTags,
                    deliveryTime: response.data.averageDeliveryTime,
                    competitionLevel: response.data.competitionLevel,
                    demandLevel: response.data.demandLevel,
                    trends: response.data.trends
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                insights: null
            };
        }
    }

    /**
     * Analyze gig performance (for existing sellers)
     */
    async analyzeGigPerformance(gigId) {
        try {
            const response = await this.client.get(`/gigs/${gigId}/analytics`);

            return {
                success: true,
                analytics: {
                    impressions: response.data.impressions,
                    clicks: response.data.clicks,
                    clickThroughRate: response.data.ctr,
                    orders: response.data.orders,
                    conversionRate: response.data.conversionRate,
                    revenue: response.data.revenue,
                    averageRating: response.data.averageRating,
                    repeatCustomers: response.data.repeatCustomers
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                analytics: null
            };
        }
    }

    // Helper methods

    buildGigSearchParams(criteria) {
        const params = {};
        
        if (criteria.category) params.category = criteria.category;
        if (criteria.subcategory) params.subcategory = criteria.subcategory;
        if (criteria.skills) params.query = criteria.skills;
        if (criteria.budget_min) params.min_price = criteria.budget_min;
        if (criteria.budget_max) params.max_price = criteria.budget_max;
        if (criteria.delivery_time) params.delivery_time = criteria.delivery_time;
        if (criteria.seller_level) params.seller_level = criteria.seller_level;
        if (criteria.sort) params.sort_by = criteria.sort;

        return params;
    }

    parseBudget(budgetText) {
        if (!budgetText) return null;
        
        const match = budgetText.match(/\$(\d+)/);
        return match ? parseInt(match[1]) : null;
    }

    parseSkills(skillsText) {
        if (!skillsText) return [];
        
        return skillsText.split(',').map(skill => skill.trim()).filter(Boolean);
    }

    parseProposalCount(proposalsText) {
        if (!proposalsText) return 0;
        
        const match = proposalsText.match(/(\d+)/);
        return match ? parseInt(match[1]) : 0;
    }

    generateRequestId(request) {
        return `fiverr_req_${Date.now()}_${request.title.slice(0, 10).replace(/\s+/g, '_')}`;
    }

    /**
     * Get trending categories and opportunities
     */
    async getTrendingCategories() {
        try {
            const response = await this.client.get('/categories/trending');
            
            return {
                success: true,
                categories: response.data.categories.map(cat => ({
                    name: cat.name,
                    slug: cat.slug,
                    demandIncrease: cat.demandIncrease,
                    averagePrice: cat.averagePrice,
                    competition: cat.competition
                }))
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                categories: []
            };
        }
    }

    /**
     * Health check for Fiverr API connectivity
     */
    async healthCheck() {
        try {
            const response = await this.client.get('/ping');
            
            return {
                success: true,
                status: 'connected',
                apiVersion: response.data.version
            };
        } catch (error) {
            return {
                success: false,
                status: 'disconnected',
                error: error.message
            };
        }
    }

    /**
     * Get recommended gigs based on user profile
     */
    async getRecommendations(userSkills, userLevel = 'new') {
        try {
            const params = {
                skills: userSkills.join(','),
                seller_level: userLevel,
                limit: 20
            };

            const response = await this.client.get('/recommendations/gigs', { params });

            return {
                success: true,
                recommendations: response.data.gigs.map(gig => this.formatGig(gig))
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                recommendations: []
            };
        }
    }
}

module.exports = FiverrAPI;