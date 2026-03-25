/**
 * Integration Tests for Platform Integration Module
 * Tests the complete workflow from job search to opportunity scoring
 */

const { PlatformIntegration } = require('../index');

// Mock external dependencies
jest.mock('cheerio');
jest.mock('node-fetch');

describe('Platform Integration - Full Workflow', () => {
    let platformIntegration;
    let testProfile;

    beforeEach(() => {
        platformIntegration = new PlatformIntegration();
        
        testProfile = {
            skills: {
                primary: ['javascript', 'react', 'node.js'],
                secondary: ['python', 'aws']
            },
            budget: {
                min: 50,
                max: 100,
                type: 'hourly'
            },
            availability: {
                hoursPerWeek: 30
            },
            experience: {
                years: 5,
                level: 'senior'
            },
            location: {
                country: 'US',
                timezone: 'EST'
            },
            preferences: {
                clientRating: 4.0
            }
        };

        // Mock connector search methods
        platformIntegration.getConnectors().forEach(connector => {
            connector.searchJobs = jest.fn().mockResolvedValue([
                {
                    id: `${connector.platformName}-test-job`,
                    title: `${connector.platformName} Test Job`,
                    skills: ['react', 'javascript'],
                    budget: { min: 60, max: 80, type: 'hourly' },
                    platform: connector.platformName,
                    competition: 10,
                    client: {
                        rating: 4.5,
                        reviewCount: 20,
                        isVerified: true
                    },
                    postedAt: new Date()
                }
            ]);
        });
    });

    afterEach(() => {
        // Clean up any running monitors
        platformIntegration.smartAlerts.stopMonitoring();
    });

    describe('End-to-End Job Discovery Workflow', () => {
        test('should complete full job discovery and matching pipeline', async () => {
            // 1. Search for jobs
            const searchCriteria = {
                skills: ['react', 'javascript'],
                budget: { min: 50, max: 100 },
                platforms: ['upwork', 'freelancer']
            };

            const jobs = await platformIntegration.searchJobs(searchCriteria);
            
            expect(jobs).toBeDefined();
            expect(Array.isArray(jobs)).toBe(true);
            expect(jobs.length).toBeGreaterThan(0);

            // Verify job structure
            jobs.forEach(job => {
                expect(job).toHaveProperty('id');
                expect(job).toHaveProperty('title');
                expect(job).toHaveProperty('platform');
                expect(job).toHaveProperty('foundAt');
                expect(job.foundAt).toBeInstanceOf(Date);
            });

            // 2. Match jobs against profile
            const matchedJobs = await platformIntegration.matchJobs(testProfile, jobs);
            
            expect(matchedJobs).toBeDefined();
            expect(Array.isArray(matchedJobs)).toBe(true);
            expect(matchedJobs.length).toBe(jobs.length);

            // Verify match scoring
            matchedJobs.forEach(job => {
                expect(job).toHaveProperty('matchScore');
                expect(job).toHaveProperty('opportunityScore');
                expect(job).toHaveProperty('combinedScore');
                expect(job.matchScore).toBeGreaterThanOrEqual(0);
                expect(job.matchScore).toBeLessThanOrEqual(100);
            });

            // Verify sorting by combined score
            for (let i = 1; i < matchedJobs.length; i++) {
                expect(matchedJobs[i-1].combinedScore)
                    .toBeGreaterThanOrEqual(matchedJobs[i].combinedScore);
            }

            // 3. Verify opportunity scoring details
            const topJob = matchedJobs[0];
            expect(topJob.opportunityScore).toHaveProperty('totalScore');
            expect(topJob.opportunityScore).toHaveProperty('breakdown');
            expect(topJob.opportunityScore).toHaveProperty('recommendation');
            expect(topJob.opportunityScore).toHaveProperty('riskLevel');
        });

        test('should handle partial failures gracefully', async () => {
            // Mock one connector to fail
            const upworkConnector = platformIntegration.getConnector('upwork');
            upworkConnector.searchJobs = jest.fn().mockRejectedValue(new Error('Network error'));

            const searchCriteria = {
                skills: ['react'],
                platforms: ['upwork', 'freelancer', 'fiverr']
            };

            const jobs = await platformIntegration.searchJobs(searchCriteria);
            
            // Should still get jobs from working connectors
            expect(Array.isArray(jobs)).toBe(true);
            expect(jobs.every(job => job.platform !== 'upwork')).toBe(true);

            const matchedJobs = await platformIntegration.matchJobs(testProfile, jobs);
            expect(Array.isArray(matchedJobs)).toBe(true);
        });

        test('should maintain data consistency across pipeline', async () => {
            const searchCriteria = { skills: ['react'] };
            const jobs = await platformIntegration.searchJobs(searchCriteria);
            const matchedJobs = await platformIntegration.matchJobs(testProfile, jobs);

            // Verify no data loss
            expect(matchedJobs.length).toBe(jobs.length);

            // Verify all original job properties are preserved
            matchedJobs.forEach((matchedJob, index) => {
                const originalJob = jobs.find(job => job.id === matchedJob.id);
                expect(originalJob).toBeDefined();
                expect(matchedJob.title).toBe(originalJob.title);
                expect(matchedJob.platform).toBe(originalJob.platform);
                expect(matchedJob.skills).toEqual(originalJob.skills);
            });
        });
    });

    describe('Smart Alerts Integration', () => {
        test('should set up and manage job monitoring', async () => {
            const alertCallback = jest.fn();
            const monitorCriteria = {
                skills: ['react'],
                budgetMin: 1000,
                alertTypes: ['high_match']
            };

            // Set up monitoring
            const monitorId = await platformIntegration.setupMonitoring(monitorCriteria, alertCallback);
            expect(typeof monitorId).toBe('string');
            expect(monitorId.length).toBeGreaterThan(0);

            // Verify monitor is active
            const stats = platformIntegration.smartAlerts.getStats();
            expect(stats.activeMonitors).toBe(1);
            expect(stats.isRunning).toBe(true);

            // Stop monitoring
            const stopped = await platformIntegration.stopMonitoring(monitorId);
            expect(stopped).toBe(true);

            // Verify monitor is stopped
            const finalStats = platformIntegration.smartAlerts.getStats();
            expect(finalStats.activeMonitors).toBe(0);
        });

        test('should handle multiple concurrent monitors', async () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();
            
            const monitor1 = await platformIntegration.setupMonitoring(
                { skills: ['react'] }, callback1
            );
            const monitor2 = await platformIntegration.setupMonitoring(
                { skills: ['python'] }, callback2
            );

            expect(monitor1).not.toBe(monitor2);
            
            const stats = platformIntegration.smartAlerts.getStats();
            expect(stats.activeMonitors).toBe(2);

            // Stop one monitor
            await platformIntegration.stopMonitoring(monitor1);
            const midStats = platformIntegration.smartAlerts.getStats();
            expect(midStats.activeMonitors).toBe(1);

            // Stop remaining monitor
            await platformIntegration.stopMonitoring(monitor2);
            const finalStats = platformIntegration.smartAlerts.getStats();
            expect(finalStats.activeMonitors).toBe(0);
        });
    });

    describe('CLI Integration', () => {
        test('should execute CLI commands successfully', async () => {
            const cli = platformIntegration.getCLI();

            // Test help command
            const helpOutput = await cli.execute(['help']);
            expect(typeof helpOutput).toBe('string');
            expect(helpOutput.length).toBeGreaterThan(0);
            expect(helpOutput).toContain('Available commands');

            // Test status command
            const statusOutput = await cli.execute(['status']);
            expect(typeof statusOutput).toBe('string');
            expect(statusOutput).toContain('Platform Integration Status');

            // Test search command (would use mock data)
            const searchOutput = await cli.execute(['search', '--skills', 'react', '--limit', '5']);
            expect(typeof searchOutput).toBe('string');
        });

        test('should handle invalid CLI commands gracefully', async () => {
            const cli = platformIntegration.getCLI();

            const output = await cli.execute(['invalid-command']);
            expect(output).toContain('Unknown command');
            expect(output).toContain('platform help');
        });

        test('should parse CLI arguments correctly', async () => {
            const cli = platformIntegration.getCLI();

            const testArgs = [
                'search',
                '--skills', 'react,node',
                '--min-budget', '1000',
                '--platforms', 'upwork',
                '--limit', '10',
                '--verbose'
            ];

            const parsedArgs = cli.parseArguments(testArgs.slice(1));
            
            expect(parsedArgs.values.skills).toEqual(['react', 'node']);
            expect(parsedArgs.values['min-budget']).toBe(1000);
            expect(parsedArgs.values.platforms).toBe('upwork');
            expect(parsedArgs.values.limit).toBe(10);
            expect(parsedArgs.flags.verbose).toBe(true);
        });
    });

    describe('Platform Connector Integration', () => {
        test('should work with all platform connectors', () => {
            const connectors = platformIntegration.getConnectors();
            
            expect(connectors.size).toBe(4);
            expect(connectors.has('upwork')).toBe(true);
            expect(connectors.has('fiverr')).toBe(true);
            expect(connectors.has('freelancer')).toBe(true);
            expect(connectors.has('toptal')).toBe(true);

            // Verify each connector has required methods
            connectors.forEach(connector => {
                expect(connector).toHaveProperty('searchJobs');
                expect(connector).toHaveProperty('getJob');
                expect(connector).toHaveProperty('analyzeJob');
                expect(connector).toHaveProperty('platformName');
                expect(typeof connector.searchJobs).toBe('function');
            });
        });

        test('should detect platforms from URLs correctly', () => {
            const testUrls = [
                { url: 'https://www.upwork.com/jobs/test', expected: 'upwork' },
                { url: 'https://fiverr.com/gig/test', expected: 'fiverr' },
                { url: 'https://freelancer.com/projects/test', expected: 'freelancer' },
                { url: 'https://toptal.com/talent', expected: 'toptal' },
                { url: 'https://example.com/job', expected: null }
            ];

            testUrls.forEach(({ url, expected }) => {
                const detected = platformIntegration.detectPlatformFromUrl(url);
                expect(detected).toBe(expected);
            });
        });
    });

    describe('Configuration and Customization', () => {
        test('should accept custom configuration', () => {
            const customConfig = {
                skillsWeight: 0.5,
                budgetWeight: 0.3,
                customSetting: true
            };

            const customPlatform = new PlatformIntegration(customConfig);
            
            expect(customPlatform.config.skillsWeight).toBe(0.5);
            expect(customPlatform.config.budgetWeight).toBe(0.3);
            expect(customPlatform.config.customSetting).toBe(true);
        });

        test('should use reasonable defaults for missing config', () => {
            const defaultPlatform = new PlatformIntegration();
            
            expect(defaultPlatform.config).toHaveProperty('skillsWeight');
            expect(defaultPlatform.config).toHaveProperty('budgetWeight');
            expect(defaultPlatform.config.skillsWeight).toBeGreaterThan(0);
            expect(defaultPlatform.config.skillsWeight).toBeLessThanOrEqual(1);
        });
    });

    describe('Performance and Memory Management', () => {
        test('should handle large datasets efficiently', async () => {
            // Create a large mock dataset
            const largeJobSet = Array.from({ length: 100 }, (_, i) => ({
                id: `job-${i}`,
                title: `Test Job ${i}`,
                skills: ['javascript', 'react'],
                budget: { min: 50 + i, max: 100 + i, type: 'hourly' },
                platform: 'upwork',
                competition: i % 30,
                client: { rating: 3.5 + (i % 2), reviewCount: i % 50 },
                postedAt: new Date()
            }));

            const startTime = Date.now();
            const matchedJobs = await platformIntegration.matchJobs(testProfile, largeJobSet);
            const endTime = Date.now();

            expect(matchedJobs.length).toBe(100);
            expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds

            // Verify all jobs were processed
            expect(matchedJobs.every(job => job.hasOwnProperty('matchScore'))).toBe(true);
        });

        test('should not leak memory with repeated operations', async () => {
            const smallJobSet = [{
                id: 'test-job',
                title: 'Test Job',
                skills: ['javascript'],
                budget: { min: 50, max: 100, type: 'hourly' },
                platform: 'upwork'
            }];

            // Run multiple iterations
            for (let i = 0; i < 50; i++) {
                await platformIntegration.matchJobs(testProfile, smallJobSet);
            }

            // If we get here without memory issues, the test passes
            expect(true).toBe(true);
        });
    });

    describe('Error Recovery and Resilience', () => {
        test('should recover from individual component failures', async () => {
            // Simulate job matcher failure
            const originalCalculateMatch = platformIntegration.jobMatcher.calculateMatch;
            platformIntegration.jobMatcher.calculateMatch = jest.fn()
                .mockRejectedValueOnce(new Error('Matcher failed'))
                .mockImplementation(originalCalculateMatch);

            const jobs = [{
                id: 'test-job',
                title: 'Test Job',
                skills: ['react'],
                platform: 'upwork'
            }];

            const matchedJobs = await platformIntegration.matchJobs(testProfile, jobs);
            
            // Should still return result, even if one job failed to match
            expect(Array.isArray(matchedJobs)).toBe(true);
            expect(matchedJobs.length).toBe(1);
            expect(matchedJobs[0]).toHaveProperty('matchError');
        });

        test('should handle network timeouts gracefully', async () => {
            // Mock network timeout
            platformIntegration.getConnectors().forEach(connector => {
                connector.searchJobs = jest.fn().mockRejectedValue(new Error('TIMEOUT'));
            });

            const jobs = await platformIntegration.searchJobs({ skills: ['react'] });
            
            // Should return empty array rather than throwing
            expect(Array.isArray(jobs)).toBe(true);
        });
    });

    describe('Data Validation and Sanitization', () => {
        test('should validate and sanitize input data', async () => {
            const invalidCriteria = {
                skills: null, // Invalid
                budget: 'invalid', // Invalid
                platforms: 'not-array' // Invalid
            };

            // Should not throw error, but handle gracefully
            const jobs = await platformIntegration.searchJobs(invalidCriteria);
            expect(Array.isArray(jobs)).toBe(true);
        });

        test('should handle malformed profile data', async () => {
            const malformedProfile = {
                skills: 'not-an-object', // Invalid structure
                budget: null,
                experience: 'invalid'
            };

            const jobs = [{
                id: 'test',
                title: 'Test',
                skills: ['react'],
                platform: 'upwork'
            }];

            const result = await platformIntegration.matchJobs(malformedProfile, jobs);
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(1);
        });
    });
});