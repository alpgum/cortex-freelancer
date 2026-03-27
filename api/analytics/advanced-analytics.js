/**
 * Advanced Analytics Engine for Cortex Freelancer
 * Real-time metrics, user behavior analysis, and business intelligence
 */

const { getFirestore } = require('firebase-admin/firestore');
const { Anthropic } = require('@anthropic-ai/sdk');

class AdvancedAnalyticsEngine {
    constructor() {
        this.db = getFirestore();
        this.anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY
        });
        this.realTimeMetrics = new Map();
        this.eventBuffer = [];
        this.batchSize = 100;
        this.batchInterval = 30000; // 30 seconds
        
        this.startBatchProcessor();
    }

    /**
     * Track user event with real-time processing
     */
    async trackEvent(userId, eventType, eventData = {}) {
        const event = {
            userId,
            eventType,
            eventData,
            timestamp: new Date(),
            sessionId: eventData.sessionId || this.generateSessionId(),
            userAgent: eventData.userAgent,
            ip: eventData.ip
        };

        // Add to buffer for batch processing
        this.eventBuffer.push(event);

        // Update real-time metrics
        this.updateRealTimeMetrics(event);

        // Process critical events immediately
        if (this.isCriticalEvent(eventType)) {
            await this.processCriticalEvent(event);
        }

        return {
            success: true,
            eventId: this.generateEventId(event)
        };
    }

    /**
     * Get real-time dashboard metrics
     */
    async getDashboardMetrics(timeRange = '24h') {
        try {
            const [
                userMetrics,
                businessMetrics,
                performanceMetrics,
                aiMetrics
            ] = await Promise.all([
                this.getUserMetrics(timeRange),
                this.getBusinessMetrics(timeRange), 
                this.getPerformanceMetrics(timeRange),
                this.getAIMetrics(timeRange)
            ]);

            return {
                success: true,
                timestamp: new Date(),
                timeRange,
                metrics: {
                    users: userMetrics,
                    business: businessMetrics,
                    performance: performanceMetrics,
                    ai: aiMetrics,
                    realTime: this.getRealTimeSnapshot()
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get user behavior analytics
     */
    async getUserMetrics(timeRange) {
        const timeFilter = this.getTimeFilter(timeRange);
        
        // Query user events from database
        const eventsSnapshot = await this.db
            .collection('analytics_events')
            .where('timestamp', '>=', timeFilter.start)
            .where('timestamp', '<=', timeFilter.end)
            .get();

        const events = eventsSnapshot.docs.map(doc => doc.data());
        
        return {
            totalUsers: this.countUniqueUsers(events),
            activeUsers: this.countActiveUsers(events),
            newUsers: this.countNewUsers(events),
            userRetention: this.calculateRetention(events),
            sessionDuration: this.calculateSessionDuration(events),
            bounceRate: this.calculateBounceRate(events),
            topUserActions: this.getTopUserActions(events),
            userJourney: this.analyzeUserJourney(events)
        };
    }

    /**
     * Get business performance metrics
     */
    async getBusinessMetrics(timeRange) {
        const timeFilter = this.getTimeFilter(timeRange);
        
        const [
            subscriptions,
            applications,
            revenue
        ] = await Promise.all([
            this.getSubscriptionMetrics(timeFilter),
            this.getApplicationMetrics(timeFilter),
            this.getRevenueMetrics(timeFilter)
        ]);

        return {
            subscriptions,
            applications,
            revenue,
            conversionFunnel: await this.getConversionFunnel(timeFilter),
            churnRate: await this.calculateChurnRate(timeFilter)
        };
    }

    /**
     * Get system performance metrics
     */
    async getPerformanceMetrics(timeRange) {
        const realTimeMetrics = this.realTimeMetrics;
        
        return {
            apiResponseTime: this.getAverageResponseTime(),
            errorRate: this.getErrorRate(),
            uptime: this.calculateUptime(),
            throughput: realTimeMetrics.get('throughput') || 0,
            concurrentUsers: realTimeMetrics.get('concurrentUsers') || 0,
            memoryUsage: process.memoryUsage(),
            systemHealth: await this.getSystemHealth()
        };
    }

    /**
     * Get AI service metrics
     */
    async getAIMetrics(timeRange) {
        const timeFilter = this.getTimeFilter(timeRange);
        
        const aiEvents = await this.db
            .collection('analytics_events')
            .where('eventType', '==', 'ai_request')
            .where('timestamp', '>=', timeFilter.start)
            .where('timestamp', '<=', timeFilter.end)
            .get();

        const events = aiEvents.docs.map(doc => doc.data());
        
        return {
            totalRequests: events.length,
            successRate: this.calculateAISuccessRate(events),
            averageResponseTime: this.calculateAIResponseTime(events),
            requestTypes: this.analyzeAIRequestTypes(events),
            userSatisfaction: this.calculateAISatisfaction(events),
            costMetrics: this.calculateAICosts(events),
            popularQueries: this.getPopularAIQueries(events)
        };
    }

    /**
     * Generate AI-powered insights from analytics data
     */
    async generateInsights(timeRange = '7d') {
        try {
            const metrics = await this.getDashboardMetrics(timeRange);
            
            if (!metrics.success) {
                throw new Error('Failed to fetch metrics for insights');
            }

            const prompt = this.buildInsightsPrompt(metrics.metrics);
            
            const response = await this.anthropic.messages.create({
                model: 'claude-3-sonnet-20240229',
                max_tokens: 1500,
                system: this.getInsightsSystemPrompt(),
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            });

            const insights = this.parseInsights(response.content[0].text);
            
            return {
                success: true,
                insights: insights,
                generatedAt: new Date(),
                basedOnPeriod: timeRange
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Real-time cohort analysis
     */
    async getCohortAnalysis(cohortType = 'weekly') {
        try {
            const cohorts = await this.buildCohorts(cohortType);
            const retentionMatrix = await this.calculateCohortRetention(cohorts);
            
            return {
                success: true,
                cohortType,
                cohorts: cohorts.length,
                retentionMatrix,
                insights: this.analyzeCohortTrends(retentionMatrix)
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * A/B test analysis
     */
    async analyzeABTest(testId) {
        try {
            const testData = await this.getABTestData(testId);
            const analysis = await this.performStatisticalAnalysis(testData);
            
            return {
                success: true,
                testId,
                analysis: {
                    sampleSize: testData.totalUsers,
                    conversionRates: analysis.conversionRates,
                    statisticalSignificance: analysis.significance,
                    confidence: analysis.confidence,
                    recommendation: analysis.recommendation
                },
                insights: this.generateABTestInsights(analysis)
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Predictive analytics for business metrics
     */
    async generatePredictions(metric, horizon = '30d') {
        try {
            const historicalData = await this.getHistoricalData(metric, '90d');
            const prediction = await this.predictMetric(historicalData, horizon);
            
            return {
                success: true,
                metric,
                horizon,
                prediction: {
                    value: prediction.value,
                    confidence: prediction.confidence,
                    trend: prediction.trend,
                    factors: prediction.factors
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Helper methods for analytics calculations
    
    updateRealTimeMetrics(event) {
        const key = `${event.eventType}_count`;
        const current = this.realTimeMetrics.get(key) || 0;
        this.realTimeMetrics.set(key, current + 1);
        
        // Update concurrent users
        if (event.eventType === 'session_start') {
            const concurrent = this.realTimeMetrics.get('concurrentUsers') || 0;
            this.realTimeMetrics.set('concurrentUsers', concurrent + 1);
        } else if (event.eventType === 'session_end') {
            const concurrent = this.realTimeMetrics.get('concurrentUsers') || 0;
            this.realTimeMetrics.set('concurrentUsers', Math.max(0, concurrent - 1));
        }
    }

    getTimeFilter(timeRange) {
        const end = new Date();
        const start = new Date();
        
        switch (timeRange) {
            case '1h':
                start.setHours(start.getHours() - 1);
                break;
            case '24h':
                start.setDate(start.getDate() - 1);
                break;
            case '7d':
                start.setDate(start.getDate() - 7);
                break;
            case '30d':
                start.setDate(start.getDate() - 30);
                break;
            case '90d':
                start.setDate(start.getDate() - 90);
                break;
            default:
                start.setDate(start.getDate() - 1);
        }
        
        return { start, end };
    }

    countUniqueUsers(events) {
        const uniqueUsers = new Set(events.map(event => event.userId));
        return uniqueUsers.size;
    }

    countActiveUsers(events) {
        const activeThreshold = 3; // 3 or more events = active
        const userEventCounts = {};
        
        events.forEach(event => {
            userEventCounts[event.userId] = (userEventCounts[event.userId] || 0) + 1;
        });
        
        return Object.values(userEventCounts).filter(count => count >= activeThreshold).length;
    }

    calculateRetention(events) {
        // Simplified retention calculation
        const userFirstSeen = {};
        const userLastSeen = {};
        
        events.forEach(event => {
            if (!userFirstSeen[event.userId] || event.timestamp < userFirstSeen[event.userId]) {
                userFirstSeen[event.userId] = event.timestamp;
            }
            if (!userLastSeen[event.userId] || event.timestamp > userLastSeen[event.userId]) {
                userLastSeen[event.userId] = event.timestamp;
            }
        });
        
        let retainedUsers = 0;
        const totalUsers = Object.keys(userFirstSeen).length;
        
        Object.keys(userFirstSeen).forEach(userId => {
            const daysDiff = (userLastSeen[userId] - userFirstSeen[userId]) / (1000 * 60 * 60 * 24);
            if (daysDiff >= 1) { // Retained if active for more than 1 day
                retainedUsers++;
            }
        });
        
        return totalUsers > 0 ? (retainedUsers / totalUsers) * 100 : 0;
    }

    buildInsightsPrompt(metrics) {
        return `
Analyze these Cortex Freelancer analytics metrics and provide actionable business insights:

USER METRICS:
- Total Users: ${metrics.users.totalUsers}
- Active Users: ${metrics.users.activeUsers} 
- User Retention: ${metrics.users.userRetention.toFixed(1)}%
- Bounce Rate: ${metrics.users.bounceRate.toFixed(1)}%

BUSINESS METRICS:
- Subscription Conversion: ${metrics.business.subscriptions?.conversionRate || 0}%
- Job Applications: ${metrics.business.applications?.total || 0}
- Revenue Growth: ${metrics.business.revenue?.growth || 0}%

AI METRICS:
- AI Success Rate: ${metrics.ai.successRate.toFixed(1)}%
- User Satisfaction: ${metrics.ai.userSatisfaction.toFixed(1)}%
- Popular Queries: ${metrics.ai.popularQueries.slice(0, 3).join(', ')}

PERFORMANCE:
- Response Time: ${metrics.performance.apiResponseTime}ms
- Error Rate: ${metrics.performance.errorRate.toFixed(2)}%
- Uptime: ${metrics.performance.uptime.toFixed(2)}%

Provide insights in this format:
KEY_FINDINGS: [3 most important discoveries]
OPPORTUNITIES: [3 growth opportunities] 
RISKS: [2 potential issues]
RECOMMENDATIONS: [4 specific action items]
        `;
    }

    getInsightsSystemPrompt() {
        return `You are a senior business analyst specializing in SaaS and AI-powered platforms. 

Analyze freelancer platform metrics with focus on:
- User acquisition and retention patterns
- Conversion funnel optimization opportunities
- AI feature adoption and satisfaction
- Revenue optimization strategies
- Operational efficiency improvements

Provide practical, data-driven insights that directly impact business growth and user satisfaction.`;
    }

    parseInsights(text) {
        const sections = {
            keyFindings: [],
            opportunities: [],
            risks: [],
            recommendations: []
        };
        
        const lines = text.split('\n');
        let currentSection = null;
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            if (trimmed.startsWith('KEY_FINDINGS:')) {
                currentSection = 'keyFindings';
            } else if (trimmed.startsWith('OPPORTUNITIES:')) {
                currentSection = 'opportunities';
            } else if (trimmed.startsWith('RISKS:')) {
                currentSection = 'risks';
            } else if (trimmed.startsWith('RECOMMENDATIONS:')) {
                currentSection = 'recommendations';
            } else if (trimmed.startsWith('-') && currentSection) {
                sections[currentSection].push(trimmed.substring(1).trim());
            }
        }
        
        return sections;
    }

    startBatchProcessor() {
        setInterval(() => {
            this.processBatch();
        }, this.batchInterval);
    }

    async processBatch() {
        if (this.eventBuffer.length === 0) return;
        
        const batch = this.eventBuffer.splice(0, this.batchSize);
        
        try {
            // Batch write to database
            const batchWrite = this.db.batch();
            
            batch.forEach(event => {
                const docRef = this.db.collection('analytics_events').doc();
                batchWrite.set(docRef, event);
            });
            
            await batchWrite.commit();
            console.log(`📊 Processed ${batch.length} analytics events`);
        } catch (error) {
            console.error('Analytics batch processing failed:', error);
            // Re-add failed events to buffer for retry
            this.eventBuffer.unshift(...batch);
        }
    }

    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateEventId(event) {
        return `${event.eventType}_${event.timestamp.getTime()}_${event.userId}`;
    }

    isCriticalEvent(eventType) {
        const criticalEvents = [
            'subscription_created',
            'payment_failed',
            'user_churned',
            'system_error',
            'security_alert'
        ];
        return criticalEvents.includes(eventType);
    }

    async processCriticalEvent(event) {
        console.log('🚨 Critical event detected:', event);
        
        // Could trigger alerts, notifications, or immediate actions
        switch (event.eventType) {
            case 'payment_failed':
                await this.handlePaymentFailure(event);
                break;
            case 'user_churned':
                await this.handleUserChurn(event);
                break;
            case 'security_alert':
                await this.handleSecurityAlert(event);
                break;
        }
    }

    getRealTimeSnapshot() {
        return Object.fromEntries(this.realTimeMetrics);
    }

    getAverageResponseTime() {
        return this.realTimeMetrics.get('avgResponseTime') || 200;
    }

    getErrorRate() {
        const errors = this.realTimeMetrics.get('error_count') || 0;
        const total = this.realTimeMetrics.get('request_count') || 1;
        return (errors / total) * 100;
    }

    calculateUptime() {
        // Simplified uptime calculation
        return 99.95; // Would be calculated from actual monitoring data
    }

    async getSystemHealth() {
        return {
            database: 'healthy',
            apis: 'healthy', 
            ai: 'healthy',
            payments: 'healthy'
        };
    }
}

module.exports = AdvancedAnalyticsEngine;