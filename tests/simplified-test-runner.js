/**
 * Simplified Test Runner for Cortex Freelancer
 * Tests core functionality without external dependencies
 */

const fs = require('fs');
const path = require('path');

class SimplifiedTestRunner {
    constructor() {
        this.testResults = {
            passed: 0,
            failed: 0,
            total: 0,
            details: []
        };
    }

    async runAllTests() {
        console.log('🧪 Cortex Freelancer - Simplified Test Suite');
        console.log('═'.repeat(50));
        
        try {
            // Test file structure and core components
            await this.testProjectStructure();
            await this.testCoreModules();
            await this.testConfiguration();
            await this.testSecurity();
            await this.testAnalytics();
            
            this.generateReport();
            return this.testResults;
            
        } catch (error) {
            console.error('❌ Test suite failed:', error);
            return this.testResults;
        }
    }

    async testProjectStructure() {
        console.log('\n📁 Testing Project Structure...');
        
        const requiredFiles = [
            'package.json',
            'server.js',
            'vercel.json',
            'app/demo.html',
            'app/js/demo-workflow.js',
            'api/auth/firebase-auth.js',
            'api/integrations/upwork-api.js',
            'api/integrations/gmail-service.js',
            'api/payments/stripe-service.js',
            'api/ai-core/freelancer-memory.js',
            'api/advanced-ai/predictive-analytics.js',
            'api/security/security-manager.js',
            'api/analytics/advanced-analytics.js',
            'api/database/data-migration.js',
            'config/firebase-config.js',
            'deployment/deploy.js'
        ];

        for (const file of requiredFiles) {
            await this.runTest(`File exists: ${file}`, () => {
                const filePath = path.join(__dirname, '..', file);
                if (!fs.existsSync(filePath)) {
                    throw new Error(`Required file missing: ${file}`);
                }
                
                const stats = fs.statSync(filePath);
                if (stats.size === 0) {
                    throw new Error(`File is empty: ${file}`);
                }
                
                console.log(`  ✅ ${file} (${stats.size} bytes)`);
            });
        }
    }

    async testCoreModules() {
        console.log('\n🔧 Testing Core Modules...');
        
        // Test Firebase Auth Service
        await this.runTest('Firebase Auth Service', () => {
            const FirebaseAuthService = require('../api/auth/firebase-auth');
            const authService = new FirebaseAuthService();
            
            if (!authService.auth || !authService.db) {
                throw new Error('Firebase not properly initialized');
            }
        });

        // Test Security Manager
        await this.runTest('Security Manager', () => {
            const SecurityManager = require('../api/security/security-manager');
            const security = new SecurityManager();
            
            // Test encryption/decryption
            const testData = 'sensitive test data';
            const encrypted = security.encrypt(testData);
            const decrypted = security.decrypt(encrypted);
            
            if (decrypted !== testData) {
                throw new Error('Encryption/decryption failed');
            }
            
            // Test input sanitization
            const maliciousInput = '<script>alert("xss")</script>Hello World';
            const sanitized = security.sanitizeInput(maliciousInput);
            
            if (sanitized.includes('<script>')) {
                throw new Error('XSS sanitization failed');
            }
        });

        // Test Analytics Engine
        await this.runTest('Analytics Engine', () => {
            const AdvancedAnalyticsEngine = require('../api/analytics/advanced-analytics');
            const analytics = new AdvancedAnalyticsEngine();
            
            if (!analytics.db || !analytics.realTimeMetrics) {
                throw new Error('Analytics engine not properly initialized');
            }
        });

        // Test Predictive Analytics
        await this.runTest('Predictive Analytics', async () => {
            const PredictiveAnalyticsEngine = require('../api/advanced-ai/predictive-analytics');
            const predictive = new PredictiveAnalyticsEngine();
            
            // Test compatibility scoring
            const mockJobData = {
                title: 'React Developer',
                skills: ['React', 'JavaScript'],
                budget: 45,
                budgetType: 'hourly'
            };
            
            const mockUserContext = {
                successRate: 75,
                totalApplications: 20,
                successfulSkills: ['React', 'JavaScript']
            };
            
            const mockMarketData = {
                skillDemand: 'high',
                competitionLevel: 'medium'
            };
            
            const compatibility = await predictive.analyzeJobCompatibility(
                mockJobData, 
                mockUserContext, 
                mockMarketData
            );
            
            if (!compatibility.score || compatibility.score < 0 || compatibility.score > 100) {
                throw new Error('Invalid compatibility score');
            }
        });
    }

    async testConfiguration() {
        console.log('\n⚙️ Testing Configuration...');
        
        await this.runTest('Package.json Structure', () => {
            const packageJson = JSON.parse(fs.readFileSync(
                path.join(__dirname, '..', 'package.json'), 
                'utf8'
            ));
            
            const requiredFields = ['name', 'version', 'description', 'main', 'scripts', 'dependencies'];
            for (const field of requiredFields) {
                if (!packageJson[field]) {
                    throw new Error(`Missing package.json field: ${field}`);
                }
            }
            
            const requiredDependencies = [
                '@anthropic-ai/sdk',
                'express',
                'firebase-admin',
                'stripe'
            ];
            
            for (const dep of requiredDependencies) {
                if (!packageJson.dependencies[dep]) {
                    throw new Error(`Missing dependency: ${dep}`);
                }
            }
        });

        await this.runTest('Vercel Configuration', () => {
            const vercelConfig = JSON.parse(fs.readFileSync(
                path.join(__dirname, '..', 'vercel.json'), 
                'utf8'
            ));
            
            if (!vercelConfig.builds || !vercelConfig.routes) {
                throw new Error('Invalid Vercel configuration');
            }
            
            if (!vercelConfig.env) {
                throw new Error('Environment variables not configured');
            }
        });

        await this.runTest('Environment Variables Structure', () => {
            const requiredEnvVars = [
                'ANTHROPIC_API_KEY',
                'FIREBASE_API_KEY',
                'STRIPE_SECRET_KEY',
                'UPWORK_CONSUMER_KEY',
                'GMAIL_CLIENT_ID'
            ];
            
            // Check if .env.example or similar exists
            const envFiles = ['.env.example', '.env.template'];
            let foundEnvFile = false;
            
            for (const envFile of envFiles) {
                const envPath = path.join(__dirname, '..', envFile);
                if (fs.existsSync(envPath)) {
                    foundEnvFile = true;
                    const envContent = fs.readFileSync(envPath, 'utf8');
                    
                    for (const envVar of requiredEnvVars) {
                        if (!envContent.includes(envVar)) {
                            throw new Error(`Missing environment variable template: ${envVar}`);
                        }
                    }
                    break;
                }
            }
            
            if (!foundEnvFile) {
                console.log('  ⚠️  No .env template found (acceptable for production)');
            }
        });
    }

    async testSecurity() {
        console.log('\n🔒 Testing Security Features...');
        
        await this.runTest('Security Schemas', () => {
            const SecurityManager = require('../api/security/security-manager');
            
            if (!SecurityManager.schemas) {
                throw new Error('Security validation schemas not defined');
            }
            
            const requiredSchemas = ['userRegistration', 'jobApplication', 'emailTemplate'];
            for (const schema of requiredSchemas) {
                if (!SecurityManager.schemas[schema]) {
                    throw new Error(`Missing security schema: ${schema}`);
                }
            }
        });

        await this.runTest('Rate Limiting Configuration', () => {
            const SecurityManager = require('../api/security/security-manager');
            const security = new SecurityManager();
            
            // Test that rate limiting methods exist
            if (typeof security.createRateLimiter !== 'function') {
                throw new Error('Rate limiting not properly configured');
            }
        });

        await this.runTest('Data Encryption', () => {
            const SecurityManager = require('../api/security/security-manager');
            const security = new SecurityManager();
            
            const testCases = [
                'simple string',
                'complex data with symbols!@#$%',
                '{"json": "object", "number": 123}',
                'unicode: 你好世界 🌍'
            ];
            
            for (const testData of testCases) {
                const encrypted = security.encrypt(testData);
                const decrypted = security.decrypt(encrypted);
                
                if (decrypted !== testData) {
                    throw new Error(`Encryption failed for: ${testData}`);
                }
            }
        });
    }

    async testAnalytics() {
        console.log('\n📊 Testing Analytics System...');
        
        await this.runTest('Analytics Event Processing', () => {
            const AdvancedAnalyticsEngine = require('../api/analytics/advanced-analytics');
            const analytics = new AdvancedAnalyticsEngine();
            
            // Test event tracking
            const mockEvent = analytics.trackEvent('test-user', 'test_event', {
                sessionId: 'test-session',
                data: { test: true }
            });
            
            if (!mockEvent) {
                throw new Error('Event tracking failed');
            }
        });

        await this.runTest('Real-time Metrics', () => {
            const AdvancedAnalyticsEngine = require('../api/analytics/advanced-analytics');
            const analytics = new AdvancedAnalyticsEngine();
            
            if (!analytics.realTimeMetrics || typeof analytics.getRealTimeSnapshot !== 'function') {
                throw new Error('Real-time metrics not properly configured');
            }
        });

        await this.runTest('Time Range Filtering', () => {
            const AdvancedAnalyticsEngine = require('../api/analytics/advanced-analytics');
            const analytics = new AdvancedAnalyticsEngine();
            
            const timeRanges = ['1h', '24h', '7d', '30d', '90d'];
            for (const range of timeRanges) {
                const filter = analytics.getTimeFilter(range);
                
                if (!filter.start || !filter.end || filter.start >= filter.end) {
                    throw new Error(`Invalid time filter for range: ${range}`);
                }
            }
        });
    }

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

    generateReport() {
        console.log('\n📊 TEST RESULTS');
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
        
        console.log('\n🎯 ASSESSMENT:');
        const successRate = (this.testResults.passed / this.testResults.total) * 100;
        
        if (successRate === 100) {
            console.log('  🏆 EXCELLENT: All tests passed - production ready!');
        } else if (successRate >= 90) {
            console.log('  ✅ GOOD: Most tests passed - minor issues to address');
        } else if (successRate >= 75) {
            console.log('  ⚠️  WARNING: Several issues detected - review required');
        } else {
            console.log('  ❌ CRITICAL: Major issues detected - deployment not recommended');
        }
        
        return this.testResults;
    }
}

// CLI execution
if (require.main === module) {
    const testRunner = new SimplifiedTestRunner();
    
    testRunner.runAllTests()
        .then((results) => {
            const exitCode = results.failed > 0 ? 1 : 0;
            process.exit(exitCode);
        })
        .catch(error => {
            console.error('Test runner execution failed:', error);
            process.exit(1);
        });
}

module.exports = SimplifiedTestRunner;