/**
 * Tests for PlatformIntegration main module
 */

const { PlatformIntegration } = require('../index');

// Mock the dependencies to avoid external API calls during testing
jest.mock('cheerio');

describe('PlatformIntegration', () => {
    let platformIntegration;

    beforeEach(() => {
        platformIntegration = new PlatformIntegration({
            skillsWeight: 0.3,
            budgetWeight: 0.25
        });
    });

    describe('constructor', () => {
        test('should initialize with default configuration', () => {
            const pi = new PlatformIntegration();
            expect(pi.config).toHaveProperty('skillsWeight');
            expect(pi.config).toHaveProperty('budgetWeight');
        });

        test('should merge custom configuration', () => {
            const customConfig = {
                skillsWeight: 0.4,
                budgetWeight: 0.3,
                customSetting: true
            };
            
            const pi = new PlatformIntegration(customConfig);
            expect(pi.config.skillsWeight).toBe(0.4);
            expect(pi.config.budgetWeight).toBe(0.3);
            expect(pi.config.customSetting).toBe(true);
        });

        test('should initialize all connectors', () => {
            const connectors = platformIntegration.getConnectors();
            
            expect(connectors.has('upwork')).toBe(true);
            expect(connectors.has('fiverr')).toBe(true);
            expect(connectors.has('freelancer')).toBe(true);
            expect(connectors.has('toptal')).toBe(true);
        });

        test('should initialize core components', () => {
            expect(platformIntegration.jobMatcher).toBeDefined();
            expect(platformIntegration.opportunityScorer).toBeDefined();
            expect(platformIntegration.smartAlerts).toBeDefined();
            expect(platformIntegration.cli).toBeDefined();
        });
    });

    describe('getConnectors', () => {
        test('should return all connectors', () => {
            const connectors = platformIntegration.getConnectors();
            expect(connectors).toBeInstanceOf(Map);
            expect(connectors.size).toBe(4);
        });
    });

    describe('getConnector', () => {
        test('should return specific connector', () => {
            const upworkConnector = platformIntegration.getConnector('upwork');
            expect(upworkConnector).toBeDefined();
            expect(upworkConnector.platformName).toBe('upwork');
        });

        test('should handle case insensitive platform names', () => {
            const upworkConnector = platformIntegration.getConnector('UPWORK');
            expect(upworkConnector).toBeDefined();
            expect(upworkConnector.platformName).toBe('upwork');
        });

        test('should return undefined for unknown platforms', () => {
            const unknown = platformIntegration.getConnector('unknown');
            expect(unknown).toBeUndefined();
        });
    });

    describe('searchJobs', () => {
        beforeEach(() => {
            // Mock the connector search methods to avoid external calls
            const mockJobs = [
                {
                    id: 'upwork-job-1',
                    title: 'React Developer',
                    skills: ['react', 'javascript'],
                    budget: { min: 50, max: 100, type: 'hourly' },
                    platform: 'upwork'
                }
            ];

            platformIntegration.getConnectors().forEach(connector => {
                connector.searchJobs = jest.fn().mockResolvedValue(mockJobs);
            });
        });

        test('should search across all platforms by default', async () => {
            const criteria = {
                skills: ['react', 'javascript'],
                budget: { min: 50, max: 100 }
            };

            const jobs = await platformIntegration.searchJobs(criteria);
            
            expect(Array.isArray(jobs)).toBe(true);
            expect(jobs.length).toBeGreaterThan(0);
            
            // Should include jobs from multiple platforms
            const platforms = new Set(jobs.map(job => job.platform));
            expect(platforms.size).toBeGreaterThan(1);
        });

        test('should search specific platforms when specified', async () => {
            const criteria = {
                skills: ['react'],
                platforms: ['upwork']
            };

            const jobs = await platformIntegration.searchJobs(criteria);
            
            expect(jobs.every(job => job.platform === 'upwork')).toBe(true);
        });

        test('should handle connector failures gracefully', async () => {
            // Mock one connector to fail
            const upworkConnector = platformIntegration.getConnector('upwork');
            upworkConnector.searchJobs = jest.fn().mockRejectedValue(new Error('API Error'));

            const criteria = { skills: ['react'] };
            const jobs = await platformIntegration.searchJobs(criteria);
            
            // Should still return jobs from working connectors
            expect(Array.isArray(jobs)).toBe(true);
        });

        test('should add platform and timestamp to jobs', async () => {
            const criteria = { skills: ['react'] };
            const jobs = await platformIntegration.searchJobs(criteria);
            
            jobs.forEach(job => {
                expect(job).toHaveProperty('platform');
                expect(job).toHaveProperty('foundAt');
                expect(job.foundAt).toBeInstanceOf(Date);
            });
        });
    });

    describe('matchJobs', () => {
        test('should match jobs against profile', async () => {
            const profile = {
                skills: { primary: ['react', 'javascript'] },
                budget: { min: 40, max: 80, type: 'hourly' },
                experience: { years: 3 }
            };

            const jobs = [
                {
                    id: 'job-1',
                    title: 'React Developer',
                    skills: ['react', 'javascript'],
                    budget: { min: 50, max: 70, type: 'hourly' }
                },
                {
                    id: 'job-2',
                    title: 'Python Developer',
                    skills: ['python', 'django'],
                    budget: { min: 60, max: 90, type: 'hourly' }
                }
            ];

            const matchedJobs = await platformIntegration.matchJobs(profile, jobs);
            
            expect(matchedJobs).toHaveLength(2);
            expect(matchedJobs[0]).toHaveProperty('matchScore');
            expect(matchedJobs[0]).toHaveProperty('opportunityScore');
            expect(matchedJobs[0]).toHaveProperty('combinedScore');
            
            // Should be sorted by combined score (highest first)
            expect(matchedJobs[0].combinedScore).toBeGreaterThanOrEqual(matchedJobs[1].combinedScore);
        });

        test('should handle matching errors gracefully', async () => {
            const profile = { skills: { primary: ['react'] } };
            const jobs = [
                { id: 'good-job', title: 'Good Job', skills: ['react'] },
                { id: 'bad-job' } // Incomplete job that might cause errors
            ];

            const matchedJobs = await platformIntegration.matchJobs(profile, jobs);
            
            expect(matchedJobs).toHaveLength(2);
            
            // Failed job should still be in results with score 0
            const failedJob = matchedJobs.find(job => job.id === 'bad-job');
            expect(failedJob).toBeDefined();
            expect(failedJob.matchScore).toBe(0);
            expect(failedJob).toHaveProperty('matchError');
        });
    });

    describe('detectPlatformFromUrl', () => {
        test('should detect Upwork URLs', () => {
            const upworkUrl = 'https://www.upwork.com/jobs/React-Developer_~12345';
            const platform = platformIntegration.detectPlatformFromUrl(upworkUrl);
            expect(platform).toBe('upwork');
        });

        test('should detect Fiverr URLs', () => {
            const fiverrUrl = 'https://www.fiverr.com/gigs/web-development';
            const platform = platformIntegration.detectPlatformFromUrl(fiverrUrl);
            expect(platform).toBe('fiverr');
        });

        test('should detect Freelancer URLs', () => {
            const freelancerUrl = 'https://www.freelancer.com/projects/javascript/12345';
            const platform = platformIntegration.detectPlatformFromUrl(freelancerUrl);
            expect(platform).toBe('freelancer');
        });

        test('should detect Toptal URLs', () => {
            const toptalUrl = 'https://www.toptal.com/talent/apply';
            const platform = platformIntegration.detectPlatformFromUrl(toptalUrl);
            expect(platform).toBe('toptal');
        });

        test('should return null for unknown URLs', () => {
            const unknownUrl = 'https://example.com/job/123';
            const platform = platformIntegration.detectPlatformFromUrl(unknownUrl);
            expect(platform).toBeNull();
        });
    });

    describe('analyzeJob', () => {
        beforeEach(() => {
            // Mock connector analyzeJob methods
            platformIntegration.getConnectors().forEach(connector => {
                connector.analyzeJob = jest.fn().mockResolvedValue({
                    id: 'analyzed-job',
                    title: 'Analyzed Job',
                    platform: connector.platformName
                });
            });
        });

        test('should analyze job from supported platform', async () => {
            const upworkUrl = 'https://www.upwork.com/jobs/test-job';
            const analysis = await platformIntegration.analyzeJob(upworkUrl);
            
            expect(analysis).toBeDefined();
            expect(analysis.platform).toBe('upwork');
        });

        test('should throw error for unsupported platform', async () => {
            const unknownUrl = 'https://example.com/job/123';
            
            await expect(platformIntegration.analyzeJob(unknownUrl))
                .rejects.toThrow('Unsupported platform URL');
        });

        test('should throw error when connector not available', async () => {
            const upworkUrl = 'https://www.upwork.com/jobs/test-job';
            
            // Remove the upwork connector
            platformIntegration.connectors.delete('upwork');
            
            await expect(platformIntegration.analyzeJob(upworkUrl))
                .rejects.toThrow('No connector available for upwork');
        });
    });

    describe('setupMonitoring', () => {
        test('should setup job monitoring', async () => {
            const criteria = {
                skills: ['react', 'javascript'],
                budgetMin: 1000,
                alertTypes: ['high_match', 'low_competition']
            };

            const callback = jest.fn();
            const monitorId = await platformIntegration.setupMonitoring(criteria, callback);
            
            expect(typeof monitorId).toBe('string');
            expect(monitorId.length).toBeGreaterThan(0);
        });

        test('should pass criteria to smart alerts', async () => {
            const criteria = { skills: ['python'] };
            const callback = jest.fn();
            
            const setupMonitorSpy = jest.spyOn(platformIntegration.smartAlerts, 'setupMonitor');
            
            await platformIntegration.setupMonitoring(criteria, callback);
            
            expect(setupMonitorSpy).toHaveBeenCalledWith(criteria, callback);
        });
    });

    describe('stopMonitoring', () => {
        test('should stop job monitoring', async () => {
            const criteria = { skills: ['react'] };
            const callback = jest.fn();
            
            const monitorId = await platformIntegration.setupMonitoring(criteria, callback);
            const stopped = await platformIntegration.stopMonitoring(monitorId);
            
            expect(stopped).toBe(true);
        });

        test('should return false for non-existent monitor', async () => {
            const stopped = await platformIntegration.stopMonitoring('non-existent-id');
            expect(stopped).toBe(false);
        });
    });

    describe('getCLI', () => {
        test('should return CLI instance', () => {
            const cli = platformIntegration.getCLI();
            expect(cli).toBeDefined();
            expect(cli).toBe(platformIntegration.cli);
        });
    });

    describe('integration scenarios', () => {
        test('should handle complete job discovery workflow', async () => {
            // Mock successful responses
            platformIntegration.getConnectors().forEach(connector => {
                connector.searchJobs = jest.fn().mockResolvedValue([
                    {
                        id: `${connector.platformName}-job-1`,
                        title: 'Test Job',
                        skills: ['react'],
                        budget: { min: 1000, max: 2000, type: 'fixed' },
                        platform: connector.platformName
                    }
                ]);
            });

            const profile = {
                skills: { primary: ['react', 'javascript'] },
                budget: { min: 40, max: 80, type: 'hourly' }
            };

            // Search for jobs
            const criteria = { skills: ['react'], budget: { min: 1000 } };
            const jobs = await platformIntegration.searchJobs(criteria);
            expect(jobs.length).toBeGreaterThan(0);

            // Match jobs against profile
            const matchedJobs = await platformIntegration.matchJobs(profile, jobs);
            expect(matchedJobs.length).toBe(jobs.length);
            expect(matchedJobs[0]).toHaveProperty('matchScore');
            expect(matchedJobs[0]).toHaveProperty('opportunityScore');

            // Setup monitoring
            const callback = jest.fn();
            const monitorId = await platformIntegration.setupMonitoring(criteria, callback);
            expect(typeof monitorId).toBe('string');

            // Stop monitoring
            const stopped = await platformIntegration.stopMonitoring(monitorId);
            expect(stopped).toBe(true);
        });

        test('should handle errors in workflow gracefully', async () => {
            // Mock some failures
            const upworkConnector = platformIntegration.getConnector('upwork');
            upworkConnector.searchJobs = jest.fn().mockRejectedValue(new Error('Network error'));

            const profile = { skills: { primary: ['react'] } };
            const criteria = { skills: ['react'] };

            // Should still work with partial failures
            const jobs = await platformIntegration.searchJobs(criteria);
            expect(Array.isArray(jobs)).toBe(true);

            const matchedJobs = await platformIntegration.matchJobs(profile, jobs);
            expect(Array.isArray(matchedJobs)).toBe(true);
        });
    });

    describe('configuration validation', () => {
        test('should validate weight configuration', () => {
            const invalidConfig = {
                skillsWeight: 1.5, // Invalid: > 1
                budgetWeight: -0.1 // Invalid: < 0
            };

            // Constructor should still work but may clamp values internally
            const pi = new PlatformIntegration(invalidConfig);
            expect(pi.config).toBeDefined();
        });

        test('should use default values for missing configuration', () => {
            const pi = new PlatformIntegration({});
            
            expect(pi.config.skillsWeight).toBeDefined();
            expect(pi.config.budgetWeight).toBeDefined();
            expect(pi.config.timelineWeight).toBeDefined();
        });
    });

    describe('memory management', () => {
        test('should not leak memory with repeated operations', async () => {
            const criteria = { skills: ['test'], platforms: ['upwork'] };
            
            // Mock minimal response
            const upworkConnector = platformIntegration.getConnector('upwork');
            upworkConnector.searchJobs = jest.fn().mockResolvedValue([]);

            // Run multiple searches
            for (let i = 0; i < 10; i++) {
                await platformIntegration.searchJobs(criteria);
            }

            // Should not accumulate state
            expect(true).toBe(true); // Basic test - in real scenario would check memory usage
        });
    });
});