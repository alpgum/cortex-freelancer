/**
 * Tests for SmartAlerts system
 */

const SmartAlerts = require('../alerts/SmartAlerts');
const EventEmitter = require('events');

// Mock the platform integration to avoid external dependencies
jest.mock('../index', () => ({
    PlatformIntegration: jest.fn().mockImplementation(() => ({
        searchJobs: jest.fn().mockResolvedValue([]),
    }))
}));

describe('SmartAlerts', () => {
    let smartAlerts;
    let mockCallback;

    beforeEach(() => {
        smartAlerts = new SmartAlerts({
            defaultInterval: 1, // 1 minute for testing
            maxAlertsPerHour: 10,
            maxAlertsPerDay: 50
        });
        mockCallback = jest.fn();
    });

    afterEach(() => {
        smartAlerts.stopMonitoring();
    });

    describe('constructor', () => {
        test('should initialize with default configuration', () => {
            const alerts = new SmartAlerts();
            expect(alerts.config).toHaveProperty('highMatchThreshold');
            expect(alerts.config).toHaveProperty('defaultInterval');
            expect(alerts.monitors).toBeInstanceOf(Map);
        });

        test('should merge custom configuration', () => {
            const customConfig = {
                highMatchThreshold: 90,
                maxAlertsPerHour: 50
            };
            
            const alerts = new SmartAlerts(customConfig);
            expect(alerts.config.highMatchThreshold).toBe(90);
            expect(alerts.config.maxAlertsPerHour).toBe(50);
        });

        test('should extend EventEmitter', () => {
            expect(smartAlerts).toBeInstanceOf(EventEmitter);
        });
    });

    describe('setupMonitor', () => {
        test('should create a new monitor', async () => {
            const criteria = {
                skills: ['react', 'javascript'],
                budgetMin: 1000,
                platforms: ['upwork'],
                alertTypes: ['high_match', 'low_competition']
            };

            const monitorId = await smartAlerts.setupMonitor(criteria, mockCallback);
            
            expect(typeof monitorId).toBe('string');
            expect(monitorId.length).toBeGreaterThan(0);
            expect(smartAlerts.monitors.has(monitorId)).toBe(true);
        });

        test('should store monitor with correct criteria', async () => {
            const criteria = {
                skills: ['python'],
                budgetMin: 500,
                matchThreshold: 75
            };

            const monitorId = await smartAlerts.setupMonitor(criteria, mockCallback);
            const monitor = smartAlerts.monitors.get(monitorId);
            
            expect(monitor.criteria.skills).toEqual(['python']);
            expect(monitor.criteria.budgetMin).toBe(500);
            expect(monitor.criteria.matchThreshold).toBe(75);
            expect(monitor.callback).toBe(mockCallback);
            expect(monitor.isActive).toBe(true);
        });

        test('should start monitoring when first monitor is added', async () => {
            expect(smartAlerts.isRunning).toBe(false);
            
            await smartAlerts.setupMonitor({ skills: ['test'] }, mockCallback);
            
            expect(smartAlerts.isRunning).toBe(true);
        });

        test('should generate unique monitor IDs', async () => {
            const criteria = { skills: ['test'] };
            
            const id1 = await smartAlerts.setupMonitor(criteria, mockCallback);
            const id2 = await smartAlerts.setupMonitor(criteria, mockCallback);
            
            expect(id1).not.toBe(id2);
        });
    });

    describe('stopMonitor', () => {
        test('should remove existing monitor', async () => {
            const monitorId = await smartAlerts.setupMonitor({ skills: ['test'] }, mockCallback);
            
            const stopped = await smartAlerts.stopMonitor(monitorId);
            
            expect(stopped).toBe(true);
            expect(smartAlerts.monitors.has(monitorId)).toBe(false);
        });

        test('should return false for non-existent monitor', async () => {
            const stopped = await smartAlerts.stopMonitor('non-existent-id');
            expect(stopped).toBe(false);
        });

        test('should stop monitoring when last monitor is removed', async () => {
            const monitorId = await smartAlerts.setupMonitor({ skills: ['test'] }, mockCallback);
            expect(smartAlerts.isRunning).toBe(true);
            
            await smartAlerts.stopMonitor(monitorId);
            
            expect(smartAlerts.isRunning).toBe(false);
        });

        test('should not stop monitoring if other monitors exist', async () => {
            const id1 = await smartAlerts.setupMonitor({ skills: ['test1'] }, mockCallback);
            const id2 = await smartAlerts.setupMonitor({ skills: ['test2'] }, mockCallback);
            
            await smartAlerts.stopMonitor(id1);
            
            expect(smartAlerts.isRunning).toBe(true);
            expect(smartAlerts.monitors.has(id2)).toBe(true);
        });
    });

    describe('monitoring lifecycle', () => {
        test('should start monitoring manually', () => {
            expect(smartAlerts.isRunning).toBe(false);
            
            smartAlerts.startMonitoring();
            
            expect(smartAlerts.isRunning).toBe(true);
            expect(smartAlerts.monitorInterval).toBeDefined();
        });

        test('should not start monitoring if already running', () => {
            smartAlerts.startMonitoring();
            const firstInterval = smartAlerts.monitorInterval;
            
            smartAlerts.startMonitoring();
            
            expect(smartAlerts.monitorInterval).toBe(firstInterval);
        });

        test('should stop monitoring manually', () => {
            smartAlerts.startMonitoring();
            expect(smartAlerts.isRunning).toBe(true);
            
            smartAlerts.stopMonitoring();
            
            expect(smartAlerts.isRunning).toBe(false);
            expect(smartAlerts.monitorInterval).toBeNull();
        });

        test('should emit monitoring events', () => {
            const startSpy = jest.fn();
            const stopSpy = jest.fn();
            
            smartAlerts.on('monitoring_started', startSpy);
            smartAlerts.on('monitoring_stopped', stopSpy);
            
            smartAlerts.startMonitoring();
            expect(startSpy).toHaveBeenCalled();
            
            smartAlerts.stopMonitoring();
            expect(stopSpy).toHaveBeenCalled();
        });
    });

    describe('checkAlertConditions', () => {
        let mockJob;

        beforeEach(() => {
            mockJob = {
                id: 'test-job-1',
                title: 'React Developer',
                skills: ['react', 'javascript'],
                budget: { min: 2000, max: 3000 },
                competition: 5,
                isUrgent: false,
                client: {
                    rating: 4.5,
                    totalSpent: 20000,
                    isVerified: true
                },
                opportunityScore: { totalScore: 85 }
            };
        });

        test('should detect high match alerts', () => {
            const criteria = {
                alertTypes: ['high_match'],
                matchThreshold: 80
            };

            const alertTypes = smartAlerts.checkAlertConditions(mockJob, criteria);
            expect(alertTypes).toContain('high_match');
        });

        test('should detect low competition alerts', () => {
            const criteria = {
                alertTypes: ['low_competition']
            };

            const alertTypes = smartAlerts.checkAlertConditions(mockJob, criteria);
            expect(alertTypes).toContain('low_competition');
        });

        test('should detect high budget alerts', () => {
            const criteria = {
                alertTypes: ['high_budget']
            };

            const alertTypes = smartAlerts.checkAlertConditions(mockJob, criteria);
            expect(alertTypes).toContain('high_budget');
        });

        test('should detect urgent job alerts', () => {
            mockJob.isUrgent = true;
            const criteria = {
                alertTypes: ['urgent']
            };

            const alertTypes = smartAlerts.checkAlertConditions(mockJob, criteria);
            expect(alertTypes).toContain('urgent');
        });

        test('should detect skill match alerts', () => {
            const criteria = {
                alertTypes: ['skill_match'],
                skills: ['react', 'vue']
            };

            const alertTypes = smartAlerts.checkAlertConditions(mockJob, criteria);
            expect(alertTypes).toContain('skill_match');
        });

        test('should detect premium client alerts', () => {
            const criteria = {
                alertTypes: ['premium_client']
            };

            const alertTypes = smartAlerts.checkAlertConditions(mockJob, criteria);
            expect(alertTypes).toContain('premium_client');
        });

        test('should return empty array when no conditions met', () => {
            mockJob.opportunityScore.totalScore = 30;
            mockJob.competition = 60;
            mockJob.budget.min = 100;
            
            const criteria = {
                alertTypes: ['high_match', 'low_competition', 'high_budget'],
                matchThreshold: 80
            };

            const alertTypes = smartAlerts.checkAlertConditions(mockJob, criteria);
            expect(alertTypes).toHaveLength(0);
        });
    });

    describe('calculateAlertPriority', () => {
        test('should return CRITICAL for high-scoring jobs with multiple alerts', () => {
            const job = {
                opportunityScore: { totalScore: 95 },
                competition: 3,
                postedAt: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
            };
            
            const alertTypes = ['high_match', 'low_competition'];
            const priority = smartAlerts.calculateAlertPriority(job, alertTypes);
            
            expect(priority).toBe('CRITICAL');
        });

        test('should return HIGH for good opportunities', () => {
            const job = {
                opportunityScore: { totalScore: 80 },
                competition: 8,
                postedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
            };
            
            const alertTypes = ['high_match'];
            const priority = smartAlerts.calculateAlertPriority(job, alertTypes);
            
            expect(priority).toBe('HIGH');
        });

        test('should return LOW for mediocre opportunities', () => {
            const job = {
                opportunityScore: { totalScore: 60 },
                competition: 30,
                postedAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
            };
            
            const alertTypes = ['skill_match'];
            const priority = smartAlerts.calculateAlertPriority(job, alertTypes);
            
            expect(priority).toBe('LOW');
        });
    });

    describe('generateAlertMessage', () => {
        test('should generate comprehensive alert message', () => {
            const job = {
                title: 'Senior React Developer',
                platform: 'upwork',
                budget: { min: 3000, max: 5000 },
                competition: 8,
                skills: ['react', 'typescript', 'node.js'],
                postedAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
                url: 'https://upwork.com/job/123',
                opportunityScore: {
                    totalScore: 88,
                    insights: ['High revenue potential', 'Low competition', 'Perfect skill match']
                }
            };
            
            const alertTypes = ['high_match', 'low_competition'];
            const message = smartAlerts.generateAlertMessage(job, alertTypes);
            
            expect(message).toContain(job.title);
            expect(message).toContain('88/100');
            expect(message).toContain('$3000-5000');
            expect(message).toContain('8 bidders');
            expect(message).toContain('upwork');
            expect(message).toContain('high match, low competition');
            expect(message).toContain('High revenue potential');
            expect(message).toContain(job.url);
        });

        test('should handle missing job data gracefully', () => {
            const incompleteJob = {
                title: 'Test Job',
                opportunityScore: { totalScore: 70 }
            };
            
            const message = smartAlerts.generateAlertMessage(incompleteJob, ['high_match']);
            
            expect(message).toContain('Test Job');
            expect(message).toContain('70/100');
            expect(message).toContain('Budget TBD');
        });
    });

    describe('rate limiting', () => {
        test('should allow alerts within rate limits', () => {
            expect(smartAlerts.canSendAlert()).toBe(true);
        });

        test('should prevent alerts when hourly limit exceeded', () => {
            // Simulate exceeding hourly limit
            smartAlerts.rateLimitCounter.hour.count = smartAlerts.config.maxAlertsPerHour;
            
            expect(smartAlerts.canSendAlert()).toBe(false);
        });

        test('should prevent alerts when daily limit exceeded', () => {
            // Simulate exceeding daily limit
            smartAlerts.rateLimitCounter.day.count = smartAlerts.config.maxAlertsPerDay;
            
            expect(smartAlerts.canSendAlert()).toBe(false);
        });

        test('should reset rate limit counters after time expires', () => {
            smartAlerts.rateLimitCounter.hour.count = smartAlerts.config.maxAlertsPerHour;
            smartAlerts.rateLimitCounter.hour.reset = Date.now() - 1000; // Expired
            
            smartAlerts.resetRateLimitCounters();
            
            expect(smartAlerts.rateLimitCounter.hour.count).toBe(0);
        });

        test('should increment rate limit counters when sending alerts', () => {
            const initialHourCount = smartAlerts.rateLimitCounter.hour.count;
            const initialDayCount = smartAlerts.rateLimitCounter.day.count;
            
            smartAlerts.incrementRateLimitCounters();
            
            expect(smartAlerts.rateLimitCounter.hour.count).toBe(initialHourCount + 1);
            expect(smartAlerts.rateLimitCounter.day.count).toBe(initialDayCount + 1);
        });
    });

    describe('alert history', () => {
        test('should record alerts in history', () => {
            const alert = {
                type: 'job_alert',
                job: { id: 'test-job', title: 'Test Job' },
                alertTypes: ['high_match'],
                priority: 'HIGH',
                timestamp: new Date(),
                monitorId: 'test-monitor'
            };
            
            smartAlerts.recordAlert(alert);
            
            expect(smartAlerts.alertHistory).toHaveLength(1);
            expect(smartAlerts.alertHistory[0]).toHaveProperty('id');
            expect(smartAlerts.alertHistory[0].jobTitle).toBe('Test Job');
        });

        test('should clean up old alert history', () => {
            // Add old alert
            const oldAlert = {
                timestamp: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000), // 35 days ago
                job: { id: 'old-job', title: 'Old Job' },
                alertTypes: ['test'],
                priority: 'LOW',
                monitorId: 'test'
            };
            
            smartAlerts.recordAlert(oldAlert);
            expect(smartAlerts.alertHistory).toHaveLength(1);
            
            smartAlerts.cleanupAlertHistory();
            
            expect(smartAlerts.alertHistory).toHaveLength(0);
        });

        test('should retrieve alert history with filters', () => {
            const alert1 = {
                timestamp: new Date(),
                job: { id: 'job1', title: 'Job 1' },
                alertTypes: ['high_match'],
                priority: 'HIGH',
                monitorId: 'monitor1'
            };
            
            const alert2 = {
                timestamp: new Date(),
                job: { id: 'job2', title: 'Job 2' },
                alertTypes: ['low_competition'],
                priority: 'LOW',
                monitorId: 'monitor2'
            };
            
            smartAlerts.recordAlert(alert1);
            smartAlerts.recordAlert(alert2);
            
            const allHistory = smartAlerts.getAlertHistory();
            expect(allHistory).toHaveLength(2);
            
            const highPriorityHistory = smartAlerts.getAlertHistory({ priority: 'HIGH' });
            expect(highPriorityHistory).toHaveLength(1);
            expect(highPriorityHistory[0].jobTitle).toBe('Job 1');
            
            const monitor1History = smartAlerts.getAlertHistory({ monitorId: 'monitor1' });
            expect(monitor1History).toHaveLength(1);
            expect(monitor1History[0].jobTitle).toBe('Job 1');
            
            const limitedHistory = smartAlerts.getAlertHistory({ limit: 1 });
            expect(limitedHistory).toHaveLength(1);
        });
    });

    describe('statistics and monitoring', () => {
        test('should provide monitoring statistics', async () => {
            await smartAlerts.setupMonitor({ skills: ['test'] }, mockCallback);
            smartAlerts.recordAlert({
                timestamp: new Date(),
                job: { id: 'test', title: 'Test' },
                alertTypes: ['test'],
                priority: 'LOW',
                monitorId: 'test'
            });
            
            const stats = smartAlerts.getStats();
            
            expect(stats).toHaveProperty('activeMonitors');
            expect(stats).toHaveProperty('totalMonitors');
            expect(stats).toHaveProperty('totalAlerts');
            expect(stats).toHaveProperty('alertsToday');
            expect(stats).toHaveProperty('rateLimitStatus');
            expect(stats).toHaveProperty('isRunning');
            
            expect(stats.activeMonitors).toBe(1);
            expect(stats.totalAlerts).toBe(1);
            expect(stats.isRunning).toBe(true);
        });

        test('should provide monitor information', async () => {
            const criteria = { skills: ['react'], budgetMin: 1000 };
            await smartAlerts.setupMonitor(criteria, mockCallback);
            
            const monitors = smartAlerts.getMonitors();
            
            expect(monitors).toHaveLength(1);
            expect(monitors[0]).toHaveProperty('id');
            expect(monitors[0]).toHaveProperty('criteria');
            expect(monitors[0]).toHaveProperty('isActive');
            expect(monitors[0]).toHaveProperty('alertCount');
            expect(monitors[0].criteria.skills).toEqual(['react']);
        });
    });

    describe('helper methods', () => {
        test('should check skill matches correctly', () => {
            const jobSkills = ['react', 'javascript', 'typescript'];
            const targetSkills = ['react', 'vue'];
            
            expect(smartAlerts.hasSkillMatch(jobSkills, targetSkills)).toBe(true);
            
            const noMatchSkills = ['python', 'django'];
            expect(smartAlerts.hasSkillMatch(jobSkills, noMatchSkills)).toBe(false);
        });

        test('should identify premium clients correctly', () => {
            const premiumClient = {
                totalSpent: 50000,
                rating: 4.8,
                reviewCount: 100,
                paymentVerified: true,
                isVerified: true
            };
            
            expect(smartAlerts.isPremiumClient(premiumClient)).toBe(true);
            
            const regularClient = {
                totalSpent: 1000,
                rating: 3.5,
                reviewCount: 5
            };
            
            expect(smartAlerts.isPremiumClient(regularClient)).toBe(false);
        });

        test('should format time ago correctly', () => {
            const now = new Date();
            
            const minutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
            expect(smartAlerts.formatTimeAgo(minutesAgo)).toContain('minutes ago');
            
            const hoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
            expect(smartAlerts.formatTimeAgo(hoursAgo)).toContain('hours ago');
            
            const daysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
            expect(smartAlerts.formatTimeAgo(daysAgo)).toContain('days ago');
        });

        test('should generate unique monitor IDs', () => {
            const criteria1 = { skills: ['react'] };
            const criteria2 = { skills: ['python'] };
            
            const id1 = smartAlerts.generateMonitorId(criteria1);
            const id2 = smartAlerts.generateMonitorId(criteria2);
            const id3 = smartAlerts.generateMonitorId(criteria1);
            
            expect(id1).not.toBe(id2);
            expect(id1).not.toBe(id3);
            expect(id2).not.toBe(id3);
            
            expect(id1).toContain('monitor_react');
            expect(id2).toContain('monitor_python');
        });
    });

    describe('error handling', () => {
        test('should handle callback errors gracefully', async () => {
            const errorCallback = jest.fn().mockRejectedValue(new Error('Callback failed'));
            
            const monitorId = await smartAlerts.setupMonitor({ skills: ['test'] }, errorCallback);
            const monitor = smartAlerts.monitors.get(monitorId);
            
            // Simulate sending an alert
            const alert = {
                type: 'job_alert',
                job: { id: 'test', title: 'Test' },
                alertTypes: ['test'],
                priority: 'LOW',
                timestamp: new Date(),
                monitorId
            };
            
            // Should not throw error
            await expect(smartAlerts.sendAlert(alert, monitor)).resolves.toBeUndefined();
        });

        test('should emit error events for failed alerts', (done) => {
            smartAlerts.on('alert_failed', (data) => {
                expect(data).toHaveProperty('alert');
                expect(data).toHaveProperty('error');
                done();
            });
            
            const errorCallback = jest.fn().mockRejectedValue(new Error('Test error'));
            
            smartAlerts.setupMonitor({ skills: ['test'] }, errorCallback).then(monitorId => {
                const monitor = smartAlerts.monitors.get(monitorId);
                const alert = {
                    type: 'job_alert',
                    job: { id: 'test', title: 'Test' },
                    alertTypes: ['test'],
                    priority: 'LOW',
                    timestamp: new Date(),
                    monitorId
                };
                
                smartAlerts.sendAlert(alert, monitor);
            });
        });
    });
});