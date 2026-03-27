/**
 * Upwork API Integration for Cortex Freelancer
 * Handles job fetching, profile management, and application tracking
 */

const axios = require('axios');
const crypto = require('crypto');

class UpworkAPI {
    constructor() {
        this.baseURL = 'https://www.upwork.com/api';
        this.consumerKey = process.env.UPWORK_CONSUMER_KEY;
        this.consumerSecret = process.env.UPWORK_CONSUMER_SECRET;
        this.accessToken = process.env.UPWORK_ACCESS_TOKEN;
        this.accessSecret = process.env.UPWORK_ACCESS_SECRET;
        
        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: 30000
        });
    }

    /**
     * Generate OAuth 1.0a signature
     */
    generateSignature(method, url, params) {
        const baseString = this.createSignatureBaseString(method, url, params);
        const signingKey = `${this.consumerSecret}&${this.accessSecret || ''}`;
        
        return crypto
            .createHmac('sha1', signingKey)
            .update(baseString)
            .digest('base64');
    }

    /**
     * Create OAuth signature base string
     */
    createSignatureBaseString(method, url, params) {
        const sortedParams = Object.keys(params)
            .sort()
            .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
            .join('&');
            
        return `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
    }

    /**
     * Make authenticated request to Upwork API
     */
    async makeRequest(endpoint, params = {}, method = 'GET') {
        try {
            const url = `${this.baseURL}${endpoint}`;
            const timestamp = Math.floor(Date.now() / 1000);
            const nonce = crypto.randomBytes(16).toString('hex');
            
            const oauthParams = {
                oauth_consumer_key: this.consumerKey,
                oauth_token: this.accessToken,
                oauth_signature_method: 'HMAC-SHA1',
                oauth_timestamp: timestamp,
                oauth_nonce: nonce,
                oauth_version: '1.0',
                ...params
            };
            
            const signature = this.generateSignature(method, url, oauthParams);
            oauthParams.oauth_signature = signature;
            
            const authHeader = 'OAuth ' + Object.keys(oauthParams)
                .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
                .join(', ');
            
            const response = await this.client.request({
                method,
                url: endpoint,
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/json'
                },
                params: method === 'GET' ? params : {},
                data: method !== 'GET' ? params : {}
            });
            
            return response.data;
        } catch (error) {
            console.error('Upwork API request failed:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Search for jobs based on criteria
     */
    async searchJobs(criteria = {}) {
        try {
            const {
                skills = '',
                category = '',
                budgetMin = null,
                budgetMax = null,
                duration = '',
                sort = 'create_time desc',
                paging = '0;20'
            } = criteria;
            
            const params = {
                paging,
                sort
            };
            
            if (skills) params.skills = skills;
            if (category) params.category2 = category;
            if (budgetMin) params.budget = `[${budgetMin} TO ${budgetMax || '*'}]`;
            if (duration) params.duration = duration;
            
            const response = await this.makeRequest('/profiles/v1/search/jobs', params);
            
            return {
                success: true,
                jobs: response.jobs?.map(job => this.formatJob(job)) || [],
                totalJobs: response.paging?.total || 0
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                jobs: []
            };
        }
    }

    /**
     * Get job details by ID
     */
    async getJob(jobId) {
        try {
            const response = await this.makeRequest(`/profiles/v1/jobs/${jobId}`);
            
            return {
                success: true,
                job: this.formatJob(response.job)
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                job: null
            };
        }
    }

    /**
     * Format job data to standard structure
     */
    formatJob(upworkJob) {
        return {
            id: upworkJob.id,
            title: upworkJob.title,
            description: upworkJob.snippet || upworkJob.description,
            budget: upworkJob.budget,
            budgetType: upworkJob.job_type, // 'Fixed' or 'Hourly'
            duration: upworkJob.duration,
            skills: upworkJob.skills ? upworkJob.skills.split(',').map(s => s.trim()) : [],
            posted: upworkJob.date_created,
            clientInfo: {
                country: upworkJob.client?.country,
                rating: upworkJob.client?.feedback,
                totalSpent: upworkJob.client?.total_spent,
                hires: upworkJob.client?.total_hired,
                paymentVerified: upworkJob.client?.payment_verification_status === 'VERIFIED'
            },
            category: upworkJob.category2,
            subcategory: upworkJob.subcategory2,
            proposals: upworkJob.proposals || 0,
            platform: 'upwork',
            url: upworkJob.url,
            workload: upworkJob.workload,
            englishLevel: upworkJob.client?.english_level,
            timezone: upworkJob.client?.timezone
        };
    }

    /**
     * Get freelancer profile information
     */
    async getFreelancerProfile() {
        try {
            const response = await this.makeRequest('/profiles/v1/contractors/me');
            
            return {
                success: true,
                profile: {
                    id: response.profile.id,
                    firstName: response.profile.first_name,
                    lastName: response.profile.last_name,
                    title: response.profile.title,
                    overview: response.profile.overview,
                    hourlyRate: response.profile.rate,
                    skills: response.profile.skills,
                    categories: response.profile.categories,
                    totalEarnings: response.profile.earnings?.total,
                    jobsSuccess: response.profile.feedback?.score,
                    totalJobs: response.profile.feedback?.count
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
     * Submit proposal to a job
     */
    async submitProposal(jobId, proposalData) {
        try {
            const {
                coverLetter,
                rate,
                estimatedDuration,
                attachments = []
            } = proposalData;
            
            const params = {
                job_id: jobId,
                cover_letter: coverLetter,
                rate: rate,
                estimated_duration: estimatedDuration
            };
            
            if (attachments.length > 0) {
                params.attachments = attachments;
            }
            
            const response = await this.makeRequest('/hr/v2/proposals', params, 'POST');
            
            return {
                success: true,
                proposalId: response.proposal?.id,
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
     * Get submitted proposals
     */
    async getProposals(status = 'all') {
        try {
            const params = {};
            if (status !== 'all') {
                params.status = status; // 'active', 'archived', 'pending'
            }
            
            const response = await this.makeRequest('/hr/v2/proposals', params);
            
            return {
                success: true,
                proposals: response.proposals?.map(proposal => ({
                    id: proposal.id,
                    jobId: proposal.job?.id,
                    jobTitle: proposal.job?.title,
                    status: proposal.status,
                    submittedAt: proposal.created_date,
                    rate: proposal.rate,
                    coverLetter: proposal.cover_letter,
                    clientResponse: proposal.client_response
                })) || []
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                proposals: []
            };
        }
    }

    /**
     * Get earnings and contract information
     */
    async getEarnings(dateRange = 'all') {
        try {
            const params = {};
            if (dateRange !== 'all') {
                // Format: 'YYYY-MM-DD,YYYY-MM-DD'
                params.tqx = `out:json;outFileName:earnings_${dateRange}`;
            }
            
            const response = await this.makeRequest('/gds/finreports/v1/contractor/earnings', params);
            
            return {
                success: true,
                earnings: {
                    totalEarnings: response.table?.rows?.reduce((sum, row) => sum + (row.c[4]?.v || 0), 0) || 0,
                    contracts: response.table?.rows?.map(row => ({
                        contractTitle: row.c[0]?.v,
                        clientName: row.c[1]?.v,
                        startDate: row.c[2]?.v,
                        endDate: row.c[3]?.v,
                        totalEarned: row.c[4]?.v
                    })) || []
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                earnings: null
            };
        }
    }

    /**
     * Get job recommendations based on profile
     */
    async getJobRecommendations(limit = 20) {
        try {
            const profile = await this.getFreelancerProfile();
            if (!profile.success) {
                throw new Error('Could not fetch freelancer profile');
            }
            
            const skills = profile.profile.skills?.join(',') || '';
            const categories = profile.profile.categories?.[0] || '';
            
            return await this.searchJobs({
                skills,
                category: categories,
                sort: 'score desc',
                paging: `0;${limit}`
            });
        } catch (error) {
            return {
                success: false,
                error: error.message,
                jobs: []
            };
        }
    }

    /**
     * Health check for API connectivity
     */
    async healthCheck() {
        try {
            const response = await this.makeRequest('/profiles/v1/contractors/me');
            return {
                success: true,
                status: 'connected',
                profile: response.profile?.first_name || 'Unknown'
            };
        } catch (error) {
            return {
                success: false,
                status: 'disconnected',
                error: error.message
            };
        }
    }
}

module.exports = UpworkAPI;