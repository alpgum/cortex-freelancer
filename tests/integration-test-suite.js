/**
 * Integration Test Suite for Cortex Freelancer
 * Comprehensive testing of all systems and integrations
 */

const axios = require('axios');
const { expect } = require('chai');

class IntegrationTestSuite {
    constructor() {
        this.baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000';
        this.testResults = {
            passed: 0,
            failed: 0,
            total: 0,
            details: []
        };
    }

    /**
     * Run complete integration test suite
     */
    async runAllTests() {
        console.log('🧪 Starting Cortex Freelancer Integration Tests');
        console.log(`📍 Testing against: ${this.baseUrl}`);
        
        try {
            // System health tests
            await this.testSystemHealth();
            
            // API endpoint tests
            await this.testAPIEndpoints();
            
            // Authentication flow tests
            await this.testAuthenticationFlow();
            
            // AI services tests
            await this.testAIServices();
            
            // Integration tests
            await this.testExternalIntegrations();
            
            // Security tests
            await this.testSecurityFeatures();
            
            // Performance tests
            await this.testPerformance();
            
            this.generateTestReport();
            
        } catch (error) {
            console.error('❌ Test suite failed:', error);
            this.testResults.failed++;
        }
        
        return this.testResults;
    }

    /**
     * Test system health and basic connectivity
     */
    async testSystemHealth() {
        console.log('\n🔍 Testing System Health...');
        
        const healthEndpoints = [
            '/api/health',
            '/api/auth/health', 
            '/api/payments/health',
            '/api/security/health'
        ];
        
        for (const endpoint of healthEndpoints) {
            await this.runTest(`Health Check: ${endpoint}`, async () => {
                const response = await axios.get(`${this.baseUrl}${endpoint}`);
                expect(response.status).to.equal(200);
                expect(response.data.success).to.be.true;
            });
        }
    }

    /**
     * Test API endpoints functionality
     */
    async testAPIEndpoints() {
        console.log('\n📡 Testing API Endpoints...');
        
        // Test public endpoints
        const publicEndpoints = [
            { path: '/', expectedStatus: 200 },
            { path: '/app/demo.html', expectedStatus: 200 },
            { path: '/api/health', expectedStatus: 200 }
        ];
        
        for (const endpoint of publicEndpoints) {
            await this.runTest(`Public Endpoint: ${endpoint.path}`, async () => {
                const response = await axios.get(`${this.baseUrl}${endpoint.path}`);
                expect(response.status).to.equal(endpoint.expectedStatus);
            });
        }
        
        // Test protected endpoints (should require auth)
        const protectedEndpoints = [
            '/api/user/profile',
            '/api/jobs/recommendations',
            '/api/chat'
        ];
        
        for (const endpoint of protectedEndpoints) {
            await this.runTest(`Protected Endpoint: ${endpoint}`, async () => {
                try {
                    const response = await axios.get(`${this.baseUrl}${endpoint}`);
                    expect(response.status).to.equal(401); // Should be unauthorized
                } catch (error) {
                    expect(error.response.status).to.equal(401);
                }
            });
        }
    }

    /**
     * Test authentication flow
     */
    async testAuthenticationFlow() {
        console.log('\n🔐 Testing Authentication Flow...');
        
        // Test registration validation
        await this.runTest('Registration Validation', async () => {
            try {
                await axios.post(`${this.baseUrl}/api/auth/register`, {
                    email: 'invalid-email',
                    password: '123', // Too short
                    displayName: ''   // Missing
                });
                throw new Error('Should have failed validation');
            } catch (error) {
                expect(error.response.status).to.equal(400);
                expect(error.response.data.error).to.include('Validation failed');
            }
        });
        
        // Test login rate limiting
        await this.runTest('Login Rate Limiting', async () => {
            const invalidLogin = {
                email: 'test@example.com',
                password: 'wrongpassword'
            };
            
            // Try to exceed rate limit (5 attempts in 15 minutes)
            for (let i = 0; i < 6; i++) {
                try {
                    await axios.post(`${this.baseUrl}/api/auth/login`, invalidLogin);
                } catch (error) {
                    if (i === 5) {
                        // 6th attempt should be rate limited
                        expect(error.response.status).to.equal(429);
                    }
                }
            }
        });
    }

    /**
     * Test AI services functionality
     */
    async testAIServices() {
        console.log('\n🧠 Testing AI Services...');
        
        // Test AI memory system initialization
        await this.runTest('AI Memory System', async () => {
            const FreelancerMemory = require('../api/ai-core/freelancer-memory');
            
            // Mock Firebase for testing
            const mockDb = {
                collection: () => ({
                    doc: () => ({
                        get: async () => ({ exists: false }),
                        set: async () => {},
                        update: async () => {}
                    })
                })
            };
            
            const memory = new FreelancerMemory(mockDb);
            const context = await memory.getUserContext('test-user');
            
            expect(context).to.have.property('currentPhase');
            expect(context).to.have.property('preferences');
            expect(context).to.have.property('successMetrics');
        });
        
        // Test predictive analytics
        await this.runTest('Predictive Analytics Engine', async () => {
            const PredictiveAnalyticsEngine = require('../api/advanced-ai/predictive-analytics');
            const engine = new PredictiveAnalyticsEngine();
            
            // Mock job data
            const mockJobData = {
                title: 'React Developer',
                skills: ['React', 'JavaScript', 'Node.js'],
                budget: 45,
                budgetType: 'hourly',
                clientInfo: { rating: 4.8 }
            };
            
            // Test compatibility analysis (should work without external dependencies)
            const userContext = {
                successRate: 75,
                totalApplications: 20,
                successfulSkills: ['React', 'JavaScript'],
                preferredBudgetRange: { min: 40, max: 60 }
            };
            
            const marketData = {
                skillDemand: 'high',
                competitionLevel: 'medium'
            };
            
            const compatibility = await engine.analyzeJobCompatibility(mockJobData, userContext, marketData);
            
            expect(compatibility).to.have.property('score');
            expect(compatibility).to.have.property('factors');
            expect(compatibility.score).to.be.a('number');
            expect(compatibility.score).to.be.at.least(0);
            expect(compatibility.score).to.be.at.most(100);
        });
    }

    /**
     * Test external integrations
     */
    async testExternalIntegrations() {
        console.log('\n🔗 Testing External Integrations...');
        
        // Test API classes initialization
        await this.runTest('Upwork API Initialization', async () => {
            const UpworkAPI = require('../api/integrations/upwork-api');
            const upworkApi = new UpworkAPI();
            
            expect(upworkApi).to.have.property('baseURL');
            expect(upworkApi).to.have.property('consumerKey');
            expect(upworkApi.baseURL).to.include('upwork.com');
        });
        
        await this.runTest('Gmail Service Initialization', async () => {
            const GmailService = require('../api/integrations/gmail-service');
            const gmailService = new GmailService();
            
            expect(gmailService).to.have.property('scopes');
            expect(gmailService.scopes).to.be.an('array');
            expect(gmailService.scopes.length).to.be.greaterThan(0);
        });
        
        await this.runTest('Stripe Service Initialization', async () => {
            const StripePaymentService = require('../api/payments/stripe-service');
            const stripeService = new StripePaymentService();
            
            expect(stripeService).to.have.property('plans');
            expect(stripeService.plans).to.have.property('free');
            expect(stripeService.plans).to.have.property('pro');
        });
    }

    /**
     * Test security features
     */
    async testSecurityFeatures() {
        console.log('\n🔒 Testing Security Features...');
        
        // Test rate limiting
        await this.runTest('API Rate Limiting', async () => {
            const SecurityManager = require('../api/security/security-manager');
            const security = new SecurityManager();
            
            // Test encryption/decryption
            const testData = 'sensitive information';
            const encrypted = security.encrypt(testData);
            const decrypted = security.decrypt(encrypted);
            
            expect(encrypted).to.have.property('encrypted');
            expect(encrypted).to.have.property('iv');
            expect(encrypted).to.have.property('authTag');
            expect(decrypted).to.equal(testData);
        });
        
        // Test input validation
        await this.runTest('Input Validation', async () => {
            const SecurityManager = require('../api/security/security-manager');
            
            const schema = SecurityManager.schemas.userRegistration;
            expect(schema).to.have.property('email');
            expect(schema).to.have.property('password');
            expect(schema.password.minLength).to.equal(8);
        });
        
        // Test XSS protection
        await this.runTest('XSS Protection', async () => {
            const SecurityManager = require('../api/security/security-manager');
            const security = new SecurityManager();
            
            const maliciousInput = '<script>alert("xss")</script>Hello';
            const sanitized = security.sanitizeInput(maliciousInput);
            
            expect(sanitized).to.not.include('<script>');
            expect(sanitized).to.not.include('alert');
            expect(sanitized).to.include('Hello');
        });
    }

    /**
     * Test performance benchmarks
     */
    async testPerformance() {
        console.log('\n⚡ Testing Performance...');
        
        // Test response time
        await this.runTest('API Response Time', async () => {
            const startTime = Date.now();
            const response = await axios.get(`${this.baseUrl}/api/health`);
            const endTime = Date.now();
            
            const responseTime = endTime - startTime;
            
            expect(response.status).to.equal(200);
            expect(responseTime).to.be.lessThan(1000); // Less than 1 second
        });
        
        // Test concurrent requests
        await this.runTest('Concurrent Request Handling', async () => {
            const promises = [];
            const concurrentRequests = 10;
            
            for (let i = 0; i < concurrentRequests; i++) {
                promises.push(axios.get(`${this.baseUrl}/api/health`));
            }
            
            const results = await Promise.all(promises);
            
            results.forEach(response => {
                expect(response.status).to.equal(200);
            });
        });
    }

    /**
     * Run individual test with error handling
     */
    async runTest(testName, testFunction) {
        this.testResults.total++;
        
        try {
            await testFunction();
            console.log(`  ✅ ${testName}`);
            this.testResults.passed++;
            this.testResults.details.push({
                name: testName,
                status: 'PASSED',
                error: null
            });
        } catch (error) {
            console.log(`  ❌ ${testName}: ${error.message}`);
            this.testResults.failed++;
            this.testResults.details.push({
                name: testName,
                status: 'FAILED',
                error: error.message
            });
        }
    }

    /**
     * Generate comprehensive test report
     */
    generateTestReport() {
        console.log('\n📊 TEST REPORT');
        console.log('═'.repeat(50));
        console.log(`Total Tests: ${this.testResults.total}`);
        console.log(`Passed: ${this.testResults.passed} ✅`);
        console.log(`Failed: ${this.testResults.failed} ❌`);
        console.log(`Success Rate: ${((this.testResults.passed / this.testResults.total) * 100).toFixed(1)}%`);
        
        if (this.testResults.failed > 0) {
            console.log('\n❌ FAILED TESTS:');
            this.testResults.details
                .filter(test => test.status === 'FAILED')
                .forEach(test => {
                    console.log(`  • ${test.name}: ${test.error}`);
                });
        }
        
        console.log('\n🎯 RECOMMENDATIONS:');
        if (this.testResults.failed === 0) {
            console.log('  ✅ All tests passed - system ready for production!');
        } else {
            console.log('  ⚠️  Address failed tests before production deployment');
            console.log('  🔧 Run individual tests to debug specific issues');
        }
        
        return this.testResults;
    }

    /**
     * Export test results to file
     */
    async exportTestResults() {
        const fs = require('fs').promises;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `test-results-${timestamp}.json`;
        
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                total: this.testResults.total,
                passed: this.testResults.passed,
                failed: this.testResults.failed,
                successRate: (this.testResults.passed / this.testResults.total) * 100
            },
            details: this.testResults.details
        };
        
        await fs.writeFile(filename, JSON.stringify(report, null, 2));
        console.log(`\n📄 Test results exported to: ${filename}`);
    }
}

// CLI execution
if (require.main === module) {
    const testSuite = new IntegrationTestSuite();
    
    testSuite.runAllTests()
        .then(async (results) => {
            await testSuite.exportTestResults();
            
            const exitCode = results.failed > 0 ? 1 : 0;
            process.exit(exitCode);
        })
        .catch(error => {
            console.error('Test suite execution failed:', error);
            process.exit(1);
        });
}

module.exports = IntegrationTestSuite;