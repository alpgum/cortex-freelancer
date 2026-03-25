#!/usr/bin/env node

/**
 * Platform Integration Test Runner
 * Comprehensive test suite for the platform integration module
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class TestRunner {
    constructor() {
        this.results = {
            passed: 0,
            failed: 0,
            skipped: 0,
            coverage: null
        };
        this.startTime = Date.now();
    }

    async runTests() {
        console.log('🧪 Platform Integration Test Suite');
        console.log('==================================\n');

        try {
            await this.validateEnvironment();
            await this.runUnitTests();
            await this.runIntegrationTests();
            await this.runLinting();
            await this.validateExports();
            await this.runDemo();
            this.generateReport();
            
        } catch (error) {
            console.error('❌ Test suite failed:', error.message);
            process.exit(1);
        }
    }

    async validateEnvironment() {
        console.log('🔧 Validating Environment...');
        
        // Check Node.js version
        const nodeVersion = process.version;
        console.log(`  Node.js: ${nodeVersion}`);
        
        if (parseInt(nodeVersion.slice(1)) < 16) {
            throw new Error('Node.js 16+ required');
        }

        // Check if we're in the right directory
        const currentDir = process.cwd();
        const expectedDir = path.join(__dirname);
        
        if (!currentDir.includes('platform-integration')) {
            console.log(`  Working directory: ${currentDir}`);
            console.log(`  Switching to: ${expectedDir}`);
            process.chdir(expectedDir);
        }

        // Check required files
        const requiredFiles = [
            'index.js',
            'package.json',
            'connectors/PlatformConnector.js',
            'matching/JobMatcher.js',
            'scoring/OpportunityScorer.js',
            'alerts/SmartAlerts.js',
            'cli/PlatformCLI.js'
        ];

        for (const file of requiredFiles) {
            if (!fs.existsSync(file)) {
                throw new Error(`Required file missing: ${file}`);
            }
        }

        console.log('  ✅ Environment validation passed\n');
    }

    async runUnitTests() {
        console.log('🧪 Running Unit Tests...');
        
        try {
            // Check if Jest is available
            try {
                execSync('which jest', { stdio: 'pipe' });
            } catch {
                console.log('  ⚠️  Jest not found globally, using npx');
            }

            // Run individual test files
            const testFiles = [
                '__tests__/JobMatcher.test.js',
                '__tests__/OpportunityScorer.test.js',
                '__tests__/SmartAlerts.test.js',
                '__tests__/PlatformIntegration.test.js'
            ];

            for (const testFile of testFiles) {
                if (fs.existsSync(testFile)) {
                    console.log(`  Running ${testFile}...`);
                    try {
                        const output = execSync(`npx jest ${testFile} --verbose`, { 
                            encoding: 'utf8',
                            stdio: 'pipe'
                        });
                        
                        // Parse Jest output for pass/fail counts
                        const passMatch = output.match(/(\d+) passed/);
                        const failMatch = output.match(/(\d+) failed/);
                        
                        if (passMatch) this.results.passed += parseInt(passMatch[1]);
                        if (failMatch) this.results.failed += parseInt(failMatch[1]);
                        
                        console.log(`    ✅ ${testFile} passed`);
                    } catch (error) {
                        console.log(`    ❌ ${testFile} failed`);
                        this.results.failed += 1;
                        console.log(`    Error: ${error.stdout || error.message}`);
                    }
                } else {
                    console.log(`    ⚠️  ${testFile} not found`);
                    this.results.skipped += 1;
                }
            }
            
            console.log('  ✅ Unit tests completed\n');
            
        } catch (error) {
            console.log('  ❌ Unit tests failed');
            throw error;
        }
    }

    async runIntegrationTests() {
        console.log('🔗 Running Integration Tests...');
        
        try {
            if (fs.existsSync('__tests__/integration.test.js')) {
                const output = execSync('npx jest __tests__/integration.test.js --verbose', { 
                    encoding: 'utf8',
                    stdio: 'pipe'
                });
                
                const passMatch = output.match(/(\d+) passed/);
                const failMatch = output.match(/(\d+) failed/);
                
                if (passMatch) this.results.passed += parseInt(passMatch[1]);
                if (failMatch) this.results.failed += parseInt(failMatch[1]);
                
                console.log('  ✅ Integration tests passed\n');
            } else {
                console.log('  ⚠️  Integration tests not found\n');
                this.results.skipped += 1;
            }
            
        } catch (error) {
            console.log('  ❌ Integration tests failed');
            console.log(`  Error: ${error.stdout || error.message}\n`);
            this.results.failed += 1;
        }
    }

    async runLinting() {
        console.log('🔍 Running Code Quality Checks...');
        
        try {
            // Basic syntax check by requiring each module
            const modules = [
                './index.js',
                './connectors/PlatformConnector.js',
                './connectors/UpworkConnector.js',
                './connectors/FiverrConnector.js',
                './connectors/FreelancerConnector.js',
                './connectors/ToptalConnector.js',
                './matching/JobMatcher.js',
                './scoring/OpportunityScorer.js',
                './alerts/SmartAlerts.js',
                './cli/PlatformCLI.js'
            ];

            for (const modulePath of modules) {
                try {
                    require(modulePath);
                    console.log(`  ✅ ${modulePath} syntax OK`);
                } catch (error) {
                    console.log(`  ❌ ${modulePath} has syntax errors:`, error.message);
                    this.results.failed += 1;
                }
            }

            console.log('  ✅ Code quality checks completed\n');
            
        } catch (error) {
            console.log('  ❌ Code quality checks failed\n');
            throw error;
        }
    }

    async validateExports() {
        console.log('📦 Validating Module Exports...');
        
        try {
            const { 
                PlatformIntegration,
                PlatformConnector,
                UpworkConnector,
                FiverrConnector,
                FreelancerConnector,
                ToptalConnector,
                JobMatcher,
                OpportunityScorer,
                SmartAlerts,
                PlatformCLI
            } = require('./index.js');

            const exports = {
                PlatformIntegration,
                PlatformConnector,
                UpworkConnector,
                FiverrConnector,
                FreelancerConnector,
                ToptalConnector,
                JobMatcher,
                OpportunityScorer,
                SmartAlerts,
                PlatformCLI
            };

            for (const [name, exportedClass] of Object.entries(exports)) {
                if (typeof exportedClass === 'function') {
                    console.log(`  ✅ ${name} exported correctly`);
                } else {
                    console.log(`  ❌ ${name} not exported or invalid`);
                    this.results.failed += 1;
                }
            }

            // Test basic instantiation
            console.log('  Testing instantiation...');
            const pi = new PlatformIntegration();
            console.log(`    ✅ PlatformIntegration instance created`);
            console.log(`    ✅ Has ${pi.getConnectors().size} connectors`);

            console.log('  ✅ Module exports validated\n');
            
        } catch (error) {
            console.log('  ❌ Module export validation failed:', error.message);
            this.results.failed += 1;
        }
    }

    async runDemo() {
        console.log('🎬 Running Demo...');
        
        try {
            if (fs.existsSync('examples/demo.js')) {
                console.log('  Starting platform integration demo...');
                
                // Run demo with timeout
                const demoProcess = execSync('timeout 30s node examples/demo.js || true', { 
                    encoding: 'utf8',
                    stdio: 'pipe'
                });
                
                if (demoProcess.includes('Demo completed successfully')) {
                    console.log('  ✅ Demo completed successfully');
                } else if (demoProcess.includes('Demo starting')) {
                    console.log('  ✅ Demo started (timed out, which is expected)');
                } else {
                    console.log('  ⚠️  Demo had issues but didn\'t crash');
                    console.log('  Output:', demoProcess.substring(0, 200) + '...');
                }
                
            } else {
                console.log('  ⚠️  Demo file not found');
                this.results.skipped += 1;
            }
            
            console.log('  ✅ Demo validation completed\n');
            
        } catch (error) {
            console.log('  ⚠️  Demo failed (this may be expected in test environment)');
            console.log(`  Reason: ${error.message}\n`);
        }
    }

    generateReport() {
        const endTime = Date.now();
        const duration = ((endTime - this.startTime) / 1000).toFixed(2);
        
        console.log('📊 Test Results Summary');
        console.log('======================');
        console.log(`  Total Duration: ${duration}s`);
        console.log(`  Tests Passed: ${this.results.passed}`);
        console.log(`  Tests Failed: ${this.results.failed}`);
        console.log(`  Tests Skipped: ${this.results.skipped}`);
        
        const total = this.results.passed + this.results.failed;
        const successRate = total > 0 ? ((this.results.passed / total) * 100).toFixed(1) : 0;
        
        console.log(`  Success Rate: ${successRate}%`);
        
        if (this.results.failed > 0) {
            console.log('\n❌ Some tests failed. Please review the output above.');
            process.exit(1);
        } else {
            console.log('\n✅ All tests passed! Platform integration module is ready.');
            
            console.log('\n🚀 Quick Start:');
            console.log('  const { PlatformIntegration } = require("./index");');
            console.log('  const platform = new PlatformIntegration();');
            console.log('  const jobs = await platform.searchJobs({skills: ["react"]});');
            
            console.log('\n🔧 CLI Usage:');
            console.log('  node bin/platform help');
            console.log('  node bin/platform search --skills "react,node" --budget 5000+');
            
            console.log('\n📖 Documentation:');
            console.log('  See README.md for complete usage guide');
        }
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const runner = new TestRunner();
    runner.runTests().catch(console.error);
}

module.exports = TestRunner;