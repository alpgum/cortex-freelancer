/**
 * Smart Alerts System
 * Intelligent job monitoring and notification system
 */

const EventEmitter = require('events');

class SmartAlerts extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            // Alert thresholds
            highMatchThreshold: 80,
            mediumMatchThreshold: 60,
            lowCompetitionThreshold: 10,
            highBudgetThreshold: 1000,
            urgentTimeThreshold: 24, // hours
            
            // Monitoring intervals (minutes)
            defaultInterval: 15,
            urgentInterval: 5,
            lowPriorityInterval: 60,
            
            // Rate limiting
            maxAlertsPerHour: 20,
            maxAlertsPerDay: 100,
            
            // Alert channels
            enableEmail: true,
            enablePush: true,
            enableWebhook: false,
            
            // Data retention
            alertHistoryDays: 30,
            
            ...config
        };

        this.monitors = new Map();
        this.alertHistory = [];
        this.rateLimitCounter = {
            hour: { count: 0, reset: Date.now() + 3600000 },
            day: { count: 0, reset: Date.now() + 86400000 }
        };
        
        this.isRunning = false;
        this.monitorInterval = null;
    }

    /**
     * Set up a new job monitor
     * @param {Object} criteria - Monitoring criteria
     * @param {Function} callback - Alert callback function
     * @returns {string} Monitor ID
     */
    async setupMonitor(criteria, callback) {
        const monitorId = this.generateMonitorId(criteria);
        
        const monitor = {
            id: monitorId,
            criteria: {
                skills: criteria.skills || [],
                budgetMin: criteria.budgetMin || 0,
                budgetMax: criteria.budgetMax || Infinity,
                platforms: criteria.platforms || ['upwork', 'freelancer', 'fiverr'],
                keywords: criteria.keywords || [],
                location: criteria.location || null,
                clientRating: criteria.clientRating || 0,
                matchThreshold: criteria.matchThreshold || this.config.mediumMatchThreshold,
                alertTypes: criteria.alertTypes || ['high_match', 'low_competition', 'high_budget'],
                ...criteria
            },
            callback: callback,
            lastChecked: new Date(),
            alertCount: 0,
            isActive: true,
            createdAt: new Date(),
            seenJobs: new Set() // Track jobs we've already alerted about
        };

        this.monitors.set(monitorId, monitor);
        
        // Start monitoring if not already running
        if (!this.isRunning) {
            this.startMonitoring();
        }

        console.log(`Monitor ${monitorId} created for: ${monitor.criteria.skills.join(', ')}`);
        
        return monitorId;
    }

    /**
     * Stop a monitor
     * @param {string} monitorId - Monitor ID to stop
     * @returns {boolean} Success status
     */
    async stopMonitor(monitorId) {
        if (this.monitors.has(monitorId)) {
            this.monitors.delete(monitorId);
            console.log(`Monitor ${monitorId} stopped`);
            
            // Stop monitoring if no active monitors
            if (this.monitors.size === 0) {
                this.stopMonitoring();
            }
            
            return true;
        }
        
        return false;
    }

    /**
     * Start the monitoring process
     */
    startMonitoring() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        
        // Set up monitoring interval
        this.monitorInterval = setInterval(() => {
            this.checkAllMonitors();
        }, this.config.defaultInterval * 60 * 1000); // Convert to milliseconds

        console.log('Smart alerts monitoring started');
        this.emit('monitoring_started');
    }

    /**
     * Stop the monitoring process
     */
    stopMonitoring() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }

        console.log('Smart alerts monitoring stopped');
        this.emit('monitoring_stopped');
    }

    /**
     * Check all active monitors
     */
    async checkAllMonitors() {
        const promises = [];
        
        for (const [monitorId, monitor] of this.monitors.entries()) {
            if (monitor.isActive) {
                promises.push(this.checkMonitor(monitor));
            }
        }

        try {
            await Promise.allSettled(promises);
        } catch (error) {
            console.error('Error checking monitors:', error);
        }

        // Clean up old alert history
        this.cleanupAlertHistory();
        this.resetRateLimitCounters();
    }

    /**
     * Check a specific monitor for new opportunities
     * @param {Object} monitor - Monitor configuration
     */
    async checkMonitor(monitor) {
        try {
            // Skip if we've hit rate limits
            if (!this.canSendAlert()) {
                return;
            }

            // Search for jobs matching criteria
            const jobs = await this.searchJobs(monitor.criteria);
            
            // Filter and score jobs
            const scoredJobs = await this.scoreJobs(jobs, monitor.criteria);
            
            // Check for alert conditions
            const alerts = this.identifyAlerts(scoredJobs, monitor);
            
            // Send alerts
            for (const alert of alerts) {
                await this.sendAlert(alert, monitor);
            }

            // Update monitor
            monitor.lastChecked = new Date();
            
        } catch (error) {
            console.error(`Error checking monitor ${monitor.id}:`, error);
        }
    }

    /**
     * Search for jobs based on criteria
     * @param {Object} criteria - Search criteria
     * @returns {Promise<Object[]>} Job listings
     */
    async searchJobs(criteria) {
        // This would integrate with the platform connectors
        // For now, return mock data for demonstration
        try {
            // Import platform integration components
            const { PlatformIntegration } = require('../index');
            const platformIntegration = new PlatformIntegration();
            
            return await platformIntegration.searchJobs(criteria);
        } catch (error) {
            console.warn('Platform integration not available, using mock data');
            return this.getMockJobs(criteria);
        }
    }

    /**
     * Score jobs for alerting purposes
     * @param {Object[]} jobs - Job listings
     * @param {Object} criteria - Monitor criteria
     * @returns {Promise<Object[]>} Scored jobs
     */
    async scoreJobs(jobs, criteria) {
        try {
            const { OpportunityScorer } = require('../scoring/OpportunityScorer');
            const scorer = new OpportunityScorer();
            
            return await scorer.scoreOpportunities(jobs, criteria);
        } catch (error) {
            console.warn('Opportunity scorer not available, using basic scoring');
            return jobs.map(job => ({
                ...job,
                opportunityScore: { totalScore: 60 } // Default score
            }));
        }
    }

    /**
     * Identify alert conditions from scored jobs
     * @param {Object[]} scoredJobs - Jobs with scores
     * @param {Object} monitor - Monitor configuration
     * @returns {Object[]} Alert objects
     */
    identifyAlerts(scoredJobs, monitor) {
        const alerts = [];
        
        for (const job of scoredJobs) {
            // Skip if we've already alerted about this job
            if (monitor.seenJobs.has(job.id)) {
                continue;
            }

            const alertTypes = this.checkAlertConditions(job, monitor.criteria);
            
            if (alertTypes.length > 0) {
                alerts.push({
                    type: 'job_alert',
                    job: job,
                    alertTypes: alertTypes,
                    priority: this.calculateAlertPriority(job, alertTypes),
                    message: this.generateAlertMessage(job, alertTypes),
                    timestamp: new Date(),
                    monitorId: monitor.id
                });

                // Mark job as seen
                monitor.seenJobs.add(job.id);
            }
        }

        return alerts;
    }

    /**
     * Check which alert conditions a job meets
     * @param {Object} job - Job with opportunity score
     * @param {Object} criteria - Monitor criteria
     * @returns {string[]} Array of alert type names
     */
    checkAlertConditions(job, criteria) {
        const alertTypes = [];
        const score = job.opportunityScore?.totalScore || 0;
        
        // High match alert
        if (criteria.alertTypes.includes('high_match') && 
            score >= criteria.matchThreshold) {
            alertTypes.push('high_match');
        }

        // Low competition alert
        if (criteria.alertTypes.includes('low_competition') && 
            job.competition !== undefined && 
            job.competition < this.config.lowCompetitionThreshold) {
            alertTypes.push('low_competition');
        }

        // High budget alert
        if (criteria.alertTypes.includes('high_budget') && 
            job.budget?.min >= this.config.highBudgetThreshold) {
            alertTypes.push('high_budget');
        }

        // Urgent job alert
        if (criteria.alertTypes.includes('urgent') && job.isUrgent) {
            alertTypes.push('urgent');
        }

        // Skill match alert
        if (criteria.alertTypes.includes('skill_match') && 
            this.hasSkillMatch(job.skills, criteria.skills)) {
            alertTypes.push('skill_match');
        }

        // Premium client alert
        if (criteria.alertTypes.includes('premium_client') && 
            this.isPremiumClient(job.client)) {
            alertTypes.push('premium_client');
        }

        // Price trend alert
        if (criteria.alertTypes.includes('price_trend') && 
            this.detectPriceTrend(job, criteria)) {
            alertTypes.push('price_trend');
        }

        return alertTypes;
    }

    /**
     * Calculate alert priority
     * @param {Object} job - Job listing
     * @param {string[]} alertTypes - Alert types triggered
     * @returns {string} Priority level
     */
    calculateAlertPriority(job, alertTypes) {
        let priority = 1;
        
        // Base priority from opportunity score
        const score = job.opportunityScore?.totalScore || 0;
        if (score >= 90) priority += 3;
        else if (score >= 80) priority += 2;
        else if (score >= 70) priority += 1;

        // Alert type bonuses
        if (alertTypes.includes('high_match')) priority += 2;
        if (alertTypes.includes('low_competition')) priority += 2;
        if (alertTypes.includes('high_budget')) priority += 1;
        if (alertTypes.includes('urgent')) priority += 1;

        // Competition factor
        if (job.competition < 5) priority += 2;
        else if (job.competition > 50) priority -= 1;

        // Recency bonus
        const hoursOld = (Date.now() - new Date(job.postedAt).getTime()) / (1000 * 60 * 60);
        if (hoursOld < 1) priority += 2;
        else if (hoursOld < 6) priority += 1;

        if (priority >= 8) return 'CRITICAL';
        if (priority >= 6) return 'HIGH';
        if (priority >= 4) return 'MEDIUM';
        return 'LOW';
    }

    /**
     * Generate alert message
     * @param {Object} job - Job listing
     * @param {string[]} alertTypes - Alert types
     * @returns {string} Alert message
     */
    generateAlertMessage(job, alertTypes) {
        const score = job.opportunityScore?.totalScore || 0;
        const budget = job.budget ? `$${job.budget.min}-${job.budget.max}` : 'Budget TBD';
        const competition = job.competition || 'Unknown';
        
        let message = `🚨 NEW OPPORTUNITY: ${job.title}\n\n`;
        message += `📊 Match Score: ${score}/100\n`;
        message += `💰 Budget: ${budget}\n`;
        message += `🥊 Competition: ${competition} bidders\n`;
        message += `🏢 Platform: ${job.platform}\n`;
        message += `⏰ Posted: ${this.formatTimeAgo(job.postedAt)}\n\n`;

        // Add skills
        if (job.skills && job.skills.length > 0) {
            message += `🎯 Skills: ${job.skills.slice(0, 5).join(', ')}\n`;
        }

        // Add alert reasons
        message += `🔔 Alert Triggers: ${alertTypes.map(type => type.replace('_', ' ')).join(', ')}\n\n`;

        // Add insights
        if (job.opportunityScore?.insights) {
            message += `💡 Insights:\n${job.opportunityScore.insights.slice(0, 3).join('\n')}\n\n`;
        }

        message += `🔗 View Job: ${job.url}`;

        return message;
    }

    /**
     * Send an alert
     * @param {Object} alert - Alert object
     * @param {Object} monitor - Monitor configuration
     */
    async sendAlert(alert, monitor) {
        try {
            // Rate limiting check
            if (!this.canSendAlert()) {
                console.log('Rate limit reached, skipping alert');
                return;
            }

            // Record alert in history
            this.recordAlert(alert);

            // Increment rate limit counters
            this.incrementRateLimitCounters();

            // Call the monitor's callback
            if (monitor.callback && typeof monitor.callback === 'function') {
                await monitor.callback(alert);
            }

            // Emit alert event
            this.emit('alert_sent', alert);

            // Send through configured channels
            await this.sendThroughChannels(alert);

            monitor.alertCount++;
            
            console.log(`Alert sent for job: ${alert.job.title} (${alert.priority})`);

        } catch (error) {
            console.error('Failed to send alert:', error);
            this.emit('alert_failed', { alert, error });
        }
    }

    /**
     * Send alert through configured channels
     * @param {Object} alert - Alert object
     */
    async sendThroughChannels(alert) {
        const promises = [];

        if (this.config.enableEmail) {
            promises.push(this.sendEmailAlert(alert));
        }

        if (this.config.enablePush) {
            promises.push(this.sendPushAlert(alert));
        }

        if (this.config.enableWebhook) {
            promises.push(this.sendWebhookAlert(alert));
        }

        await Promise.allSettled(promises);
    }

    // Helper methods
    generateMonitorId(criteria) {
        const skillsStr = criteria.skills?.join('-') || 'all';
        const timestamp = Date.now();
        return `monitor_${skillsStr}_${timestamp}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    hasSkillMatch(jobSkills, targetSkills) {
        if (!jobSkills || !targetSkills) return false;
        
        return targetSkills.some(targetSkill =>
            jobSkills.some(jobSkill => 
                jobSkill.toLowerCase().includes(targetSkill.toLowerCase()) ||
                targetSkill.toLowerCase().includes(jobSkill.toLowerCase())
            )
        );
    }

    isPremiumClient(client) {
        if (!client) return false;
        
        return (client.totalSpent > 10000) ||
               (client.rating > 4.5 && client.reviewCount > 50) ||
               (client.paymentVerified && client.isVerified);
    }

    detectPriceTrend(job, criteria) {
        // Simplified price trend detection
        // In a real implementation, you'd track historical pricing data
        return false;
    }

    formatTimeAgo(date) {
        const now = new Date();
        const diffMs = now - new Date(date);
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 60) {
            return `${diffMins} minutes ago`;
        } else if (diffHours < 24) {
            return `${diffHours} hours ago`;
        } else {
            return `${diffDays} days ago`;
        }
    }

    canSendAlert() {
        const now = Date.now();
        
        // Reset counters if needed
        if (now > this.rateLimitCounter.hour.reset) {
            this.rateLimitCounter.hour = { count: 0, reset: now + 3600000 };
        }
        
        if (now > this.rateLimitCounter.day.reset) {
            this.rateLimitCounter.day = { count: 0, reset: now + 86400000 };
        }

        return this.rateLimitCounter.hour.count < this.config.maxAlertsPerHour &&
               this.rateLimitCounter.day.count < this.config.maxAlertsPerDay;
    }

    incrementRateLimitCounters() {
        this.rateLimitCounter.hour.count++;
        this.rateLimitCounter.day.count++;
    }

    resetRateLimitCounters() {
        const now = Date.now();
        
        if (now > this.rateLimitCounter.hour.reset) {
            this.rateLimitCounter.hour.count = 0;
        }
        
        if (now > this.rateLimitCounter.day.reset) {
            this.rateLimitCounter.day.count = 0;
        }
    }

    recordAlert(alert) {
        this.alertHistory.push({
            id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: alert.timestamp,
            type: alert.type,
            priority: alert.priority,
            jobId: alert.job.id,
            jobTitle: alert.job.title,
            alertTypes: alert.alertTypes,
            monitorId: alert.monitorId
        });
    }

    cleanupAlertHistory() {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.config.alertHistoryDays);

        this.alertHistory = this.alertHistory.filter(alert => 
            new Date(alert.timestamp) > cutoffDate
        );
    }

    getMockJobs(criteria) {
        // Mock data for testing
        return [
            {
                id: 'mock_job_1',
                title: 'React Developer Needed',
                description: 'Build a React application with TypeScript',
                skills: ['react', 'javascript', 'typescript'],
                budget: { min: 1500, max: 2500, type: 'fixed' },
                competition: 8,
                isUrgent: false,
                postedAt: new Date(),
                platform: 'upwork',
                url: 'https://upwork.com/jobs/mock_job_1',
                client: {
                    rating: 4.8,
                    reviewCount: 25,
                    isVerified: true,
                    paymentVerified: true,
                    totalSpent: 15000
                }
            }
        ];
    }

    // Channel-specific alert methods (to be implemented based on requirements)
    async sendEmailAlert(alert) {
        console.log(`📧 Email alert: ${alert.job.title}`);
        // Implement email sending logic
    }

    async sendPushAlert(alert) {
        console.log(`📱 Push alert: ${alert.job.title}`);
        // Implement push notification logic
    }

    async sendWebhookAlert(alert) {
        console.log(`🔗 Webhook alert: ${alert.job.title}`);
        // Implement webhook sending logic
    }

    /**
     * Get monitoring statistics
     * @returns {Object} Statistics
     */
    getStats() {
        const activeMonitors = Array.from(this.monitors.values()).filter(m => m.isActive);
        
        return {
            activeMonitors: activeMonitors.length,
            totalMonitors: this.monitors.size,
            totalAlerts: this.alertHistory.length,
            alertsToday: this.alertHistory.filter(alert => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                return new Date(alert.timestamp) >= today;
            }).length,
            rateLimitStatus: {
                hourly: `${this.rateLimitCounter.hour.count}/${this.config.maxAlertsPerHour}`,
                daily: `${this.rateLimitCounter.day.count}/${this.config.maxAlertsPerDay}`
            },
            isRunning: this.isRunning,
            lastCheck: activeMonitors.length > 0 ? 
                Math.max(...activeMonitors.map(m => new Date(m.lastChecked).getTime())) : null
        };
    }

    /**
     * Get all monitors
     * @returns {Object[]} Array of monitor configurations
     */
    getMonitors() {
        return Array.from(this.monitors.values()).map(monitor => ({
            id: monitor.id,
            criteria: monitor.criteria,
            isActive: monitor.isActive,
            alertCount: monitor.alertCount,
            lastChecked: monitor.lastChecked,
            createdAt: monitor.createdAt,
            seenJobsCount: monitor.seenJobs.size
        }));
    }

    /**
     * Get alert history
     * @param {Object} options - Filter options
     * @returns {Object[]} Alert history
     */
    getAlertHistory(options = {}) {
        let history = [...this.alertHistory];

        if (options.monitorId) {
            history = history.filter(alert => alert.monitorId === options.monitorId);
        }

        if (options.priority) {
            history = history.filter(alert => alert.priority === options.priority);
        }

        if (options.limit) {
            history = history.slice(0, options.limit);
        }

        return history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }
}

module.exports = SmartAlerts;