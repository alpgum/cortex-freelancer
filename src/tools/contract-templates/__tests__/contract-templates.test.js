/**
 * Contract Template System Test Suite
 *
 * Tests all core functionality:
 * - Contract generation from templates
 * - Risk assessment and scoring
 * - Contract comparison and diff
 * - Clause management
 * - CLI interface
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const ContractTemplateSystem = require('../index.js');

describe('ContractTemplateSystem', () => {
    let system;
    let tempDir;
    // let testContractPath;

    beforeAll(() => {
        // Create temporary directory for tests
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'contract-test-'));
        system = new ContractTemplateSystem();

        // Override directories to use temp directory
        system.templatesDir = path.join(tempDir, 'templates');
        system.clausesDir = path.join(tempDir, 'clauses');
        system.outputDir = path.join(tempDir, 'generated');

        // Create test directories
        [system.templatesDir, system.clausesDir, system.outputDir].forEach(dir => {
            fs.mkdirSync(dir, { recursive: true });
        });
    });

    afterAll(() => {
        // Clean up temporary directory
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    describe('Contract Generation', () => {
        test('should generate fixed-price contract with basic options', async() => {
            const options = {
                client: 'Test Client',
                freelancer: 'Test Freelancer',
                project: 'Website Development',
                value: '5000',
                currency: 'USD'
            };

            const result = await system.generateContract('fixed-price', options);

            expect(result).toHaveProperty('type', 'fixed-price');
            expect(result).toHaveProperty('filename');
            expect(result).toHaveProperty('path');
            expect(result).toHaveProperty('content');
            expect(result.content).toContain('Test Client');
            expect(result.content).toContain('Test Freelancer');
            expect(result.content).toContain('Website Development');
            expect(result.content).toContain('USD 5000');

            // Verify file was created
            expect(fs.existsSync(result.path)).toBe(true);

            // testContractPath = result.path; // Save for later tests
        });

        test('should generate hourly contract', async() => {
            const result = await system.generateContract('hourly', {
                client: 'Hourly Client',
                value: '100'
            });

            expect(result.type).toBe('hourly');
            expect(result.content).toContain('Hourly Client');
            expect(result.content).toContain('100/hour');
        });

        test('should generate NDA', async() => {
            const result = await system.generateContract('nda', {
                client: 'Confidential Corp'
            });

            expect(result.type).toBe('nda');
            expect(result.content).toContain('Non-Disclosure Agreement');
            expect(result.content).toContain('Confidential Corp');
        });

        test('should throw error for invalid contract type', async() => {
            await expect(system.generateContract('invalid-type'))
                .rejects.toThrow('Invalid contract type');
        });

        test('should include custom clauses when specified', async() => {
            // First add some test clauses
            await system.addClause('payment', 'test-net15', {
                title: 'Test Net 15',
                content: 'Payment due in 15 days with 5% penalty',
                riskLevel: 'low'
            });

            const result = await system.generateContract('fixed-price', {
                client: 'Clause Client',
                clauses: ['test-net15']
            });

            expect(result.content).toContain('Test Net 15');
            expect(result.content).toContain('Payment due in 15 days');
        });
    });

    describe('Contract Analysis', () => {
        test('should analyze contract and provide fairness score', async() => {
            // Create a test contract file
            const testContract = `
# Test Contract

## Payment Terms
Payment is due within 30 days of invoice. Late payments subject to 2% monthly interest.

## Intellectual Property
All intellectual property transfers to client upon full payment.

## Termination
Either party may terminate with 14 days notice.

## Liability
Freelancer liability is limited to the contract value.
            `;

            const contractPath = path.join(tempDir, 'test-analysis.md');
            fs.writeFileSync(contractPath, testContract);

            const analysis = await system.analyzeContract(contractPath);

            expect(analysis).toHaveProperty('fairnessScore');
            expect(analysis.fairnessScore).toBeGreaterThanOrEqual(0);
            expect(analysis.fairnessScore).toBeLessThanOrEqual(100);
            expect(analysis).toHaveProperty('riskFactors');
            expect(analysis).toHaveProperty('missingClauses');
            expect(analysis).toHaveProperty('suggestions');
            expect(Array.isArray(analysis.riskFactors)).toBe(true);
        });

        test('should identify missing payment terms', async() => {
            const contractWithoutPayment = `
# Incomplete Contract
Just a basic contract without any billing information.
            `;

            const contractPath = path.join(tempDir, 'no-payment.md');
            fs.writeFileSync(contractPath, contractWithoutPayment);

            const analysis = await system.analyzeContract(contractPath);

            expect(analysis.riskFactors.some(risk =>
                risk.type === 'missing-payment-terms'
            )).toBe(true);
            expect(analysis.fairnessScore).toBeLessThan(50);
        });

        test('should identify missing IP clause', async() => {
            const contractWithoutIP = `
# Contract Without IP Clause
Payment terms: Net 30 days.
Termination: 14 days notice.
            `;

            const contractPath = path.join(tempDir, 'no-ip.md');
            fs.writeFileSync(contractPath, contractWithoutIP);

            const analysis = await system.analyzeContract(contractPath);

            expect(analysis.riskFactors.some(risk =>
                risk.type === 'missing-ip-clause'
            )).toBe(true);
        });

        test('should throw error for non-existent file', async() => {
            await expect(system.analyzeContract('/non/existent/file.txt'))
                .rejects.toThrow('Contract file not found');
        });
    });

    describe('Contract Comparison', () => {
        test('should compare two contract versions', async() => {
            const contract1 = `# Contract Version 1
Payment: Net 30
Scope: Website development`;

            const contract2 = `# Contract Version 2
Payment: Net 15
Scope: Website development and maintenance`;

            const path1 = path.join(tempDir, 'contract-v1.md');
            const path2 = path.join(tempDir, 'contract-v2.md');

            fs.writeFileSync(path1, contract1);
            fs.writeFileSync(path2, contract2);

            const comparison = await system.compareContracts(path1, path2);

            expect(comparison).toHaveProperty('changes');
            expect(comparison).toHaveProperty('summary');
            expect(comparison.changes.length).toBeGreaterThan(0);
            expect(comparison.summary.totalChanges).toBeGreaterThan(0);
        });

        test('should handle identical contracts', async() => {
            const contract = `# Identical Contract
Same content`;

            const path1 = path.join(tempDir, 'same1.md');
            const path2 = path.join(tempDir, 'same2.md');

            fs.writeFileSync(path1, contract);
            fs.writeFileSync(path2, contract);

            const comparison = await system.compareContracts(path1, path2);

            expect(comparison.changes.length).toBe(0);
            expect(comparison.summary.totalChanges).toBe(0);
        });
    });

    describe('Clause Management', () => {
        test('should list available clauses', async() => {
            const clauses = await system.listClauses();

            expect(typeof clauses).toBe('object');
            expect(Object.keys(clauses).length).toBeGreaterThan(0);

            // Should include all clause categories
            const expectedCategories = ['payment', 'ip-ownership', 'termination', 'liability'];
            expectedCategories.forEach(category => {
                expect(clauses).toHaveProperty(category);
            });
        });

        test('should list clauses for specific category', async() => {
            const paymentClauses = await system.listClauses('payment');

            expect(typeof paymentClauses).toBe('object');
            Object.values(paymentClauses).forEach(clause => {
                expect(clause).toHaveProperty('title');
                expect(clause).toHaveProperty('content');
                expect(clause).toHaveProperty('riskLevel');
            });
        });

        test('should add new clause', async() => {
            const clauseData = {
                title: 'Custom Payment Terms',
                content: 'Payment due immediately upon completion',
                riskLevel: 'high'
            };

            const addedClause = await system.addClause('payment', 'custom-immediate', clauseData);

            expect(addedClause).toHaveProperty('id', 'custom-immediate');
            expect(addedClause).toHaveProperty('title', clauseData.title);
            expect(addedClause).toHaveProperty('addedAt');

            // Verify it's in the list
            const clauses = await system.listClauses('payment');
            expect(clauses).toHaveProperty('custom-immediate');
        });

        test('should throw error for invalid clause category', async() => {
            await expect(system.addClause('invalid-category', 'test', {}))
                .rejects.toThrow('Invalid clause category');
        });
    });

    describe('Risk Assessment Summary', () => {
        test('should provide risk summary for multiple contracts', async() => {
            // Create multiple test contracts
            const contracts = [
                { name: 'risky1.md', content: 'Basic contract without much protection' },
                { name: 'risky2.md', content: 'Another basic contract' },
                { name: 'good.md', content: `
Payment: Net 15 with penalties
IP: Transfers on full payment
Termination: 14 days notice
Liability: Limited to contract value
                ` }
            ];

            const contractPaths = contracts.map(contract => {
                const contractPath = path.join(tempDir, contract.name);
                fs.writeFileSync(contractPath, contract.content);
                return contractPath;
            });

            const summary = await system.getRiskSummary(contractPaths);

            expect(summary).toHaveProperty('totalContracts', 3);
            expect(summary).toHaveProperty('averageFairnessScore');
            expect(summary).toHaveProperty('commonRisks');
            expect(summary).toHaveProperty('recommendations');
            expect(typeof summary.averageFairnessScore).toBe('number');
        });
    });

    describe('Variable Substitution', () => {
        test('should substitute template variables correctly', async() => {
            const template = 'Client: {{CLIENT_NAME}}, Project: {{PROJECT_DESCRIPTION}}, Value: ${CURRENCY} {{PROJECT_VALUE}}';
            const variables = {
                client: 'Acme Corp',
                project: 'E-commerce site',
                currency: 'EUR',
                value: '10000'
            };

            const result = system._substituteVariables(template, variables);

            expect(result).toContain('Client: Acme Corp');
            expect(result).toContain('Project: E-commerce site');
            expect(result).toContain('Value: EUR 10000');
        });

        test('should use default placeholders for missing variables', async() => {
            const template = 'Client: {{CLIENT_NAME}}, Freelancer: {{FREELANCER_NAME}}';
            const variables = { client: 'Test Client' };

            const result = system._substituteVariables(template, variables);

            expect(result).toContain('Client: Test Client');
            expect(result).toContain('Freelancer: [FREELANCER NAME]');
        });
    });

    describe('Risk Analysis Components', () => {
        test('should analyze payment terms correctly', async() => {
            const contentWithGoodPayment = 'Payment due in 15 days with late fees and 50% upfront required';
            const contentWithBadPayment = 'Payment when client feels like it';

            const goodAnalysis = system._analyzePaymentTerms(contentWithGoodPayment);
            const badAnalysis = system._analyzePaymentTerms(contentWithBadPayment);

            expect(goodAnalysis.score).toBeGreaterThan(badAnalysis.score);
            expect(badAnalysis.risks.length).toBeGreaterThan(goodAnalysis.risks.length);
        });

        test('should analyze IP ownership correctly', async() => {
            const contentWithIP = 'Intellectual property transfers to client upon full payment received';
            const contentWithoutIP = 'Just a regular service agreement';

            const goodAnalysis = system._analyzeIPOwnership(contentWithIP);
            const badAnalysis = system._analyzeIPOwnership(contentWithoutIP);

            expect(goodAnalysis.score).toBeGreaterThan(badAnalysis.score);
            expect(badAnalysis.risks.some(r => r.type === 'missing-ip-clause')).toBe(true);
        });

        test('should analyze termination clauses correctly', async() => {
            const contentWithTermination = 'Either party may terminate with 14 days notice';
            const contentWithoutTermination = 'Work continues forever';

            const goodAnalysis = system._analyzeTermination(contentWithTermination);
            const badAnalysis = system._analyzeTermination(contentWithoutTermination);

            expect(goodAnalysis.score).toBeGreaterThan(badAnalysis.score);
        });
    });
});

describe('CLI Interface', () => {
    const cliScript = path.join(__dirname, '../index.js');

    test('should show help when run without arguments', (done) => {
        exec(`node ${cliScript}`, (error, stdout, _stderr) => {
            expect(error).toBeTruthy(); // Should exit with code 1
            expect(stdout).toContain('Contract Template System');
            expect(stdout).toContain('Usage:');
            expect(stdout).toContain('Commands:');
            done();
        });
    });

    test('should handle generate command', (done) => {
        exec(`node ${cliScript} generate --type fixed-price --client "CLI Test" --value "1000"`,
             { timeout: 10000 }, (error, stdout, stderr) => {
                 if (error) {
                     console.error('CLI Error:', error.message);
                     console.error('Stderr:', stderr);
                     console.log('Stdout:', stdout);
                 }
                 expect(error).toBeFalsy();
                 expect(stdout).toContain('Contract generated:');
                 expect(stdout).toContain('fixed-price');
                 done();
             });
    });

    test('should handle invalid command gracefully', (done) => {
        exec(`node ${cliScript} invalid-command`, (error, stdout, stderr) => {
            expect(error).toBeTruthy();
            expect(stderr).toContain('Unknown command');
            done();
        });
    });
});

describe('Template Content Generation', () => {
    let system;

    beforeEach(() => {
        system = new ContractTemplateSystem();
    });

    test('should generate fixed-price template content', () => {
        const content = system._getFixedPriceTemplate();

        expect(content).toContain('Fixed-Price Project Contract');
        expect(content).toContain('{{CLIENT_NAME}}');
        expect(content).toContain('{{PROJECT_DESCRIPTION}}');
        expect(content).toContain('Payment Terms');
        expect(content).toContain('Intellectual Property');
        expect(content).toContain('Liability');
    });

    test('should generate hourly template content', () => {
        const content = system._getHourlyTemplate();

        expect(content).toContain('Hourly Service Agreement');
        expect(content).toContain('/hour');
        expect(content).toContain('Time Tracking');
    });

    test('should generate NDA template content', () => {
        const content = system._getNDATemplate();

        expect(content).toContain('Non-Disclosure Agreement');
        expect(content).toContain('Confidential Information');
        expect(content).toContain('Obligations');
    });
});

describe('Default Clause Generation', () => {
    let system;

    beforeEach(() => {
        system = new ContractTemplateSystem();
    });

    test('should generate payment clauses', () => {
        const clauses = system._getPaymentClauses();

        expect(clauses).toHaveProperty('net-30');
        expect(clauses).toHaveProperty('net-15');
        expect(clauses).toHaveProperty('milestone-based');
        expect(clauses).toHaveProperty('upfront-50');

        Object.values(clauses).forEach(clause => {
            expect(clause).toHaveProperty('title');
            expect(clause).toHaveProperty('content');
            expect(clause).toHaveProperty('riskLevel');
        });
    });

    test('should generate IP ownership clauses', () => {
        const clauses = system._getIPClauses();

        expect(clauses).toHaveProperty('work-for-hire');
        expect(clauses).toHaveProperty('ip-transfer-on-payment');

        Object.values(clauses).forEach(clause => {
            expect(clause.content.toLowerCase()).toContain('intellectual property');
        });
    });

    test('should generate termination clauses', () => {
        const clauses = system._getTerminationClauses();

        expect(clauses).toHaveProperty('termination-14-days');
        expect(clauses).toHaveProperty('termination-for-cause');
    });

    test('should generate liability clauses', () => {
        const clauses = system._getLiabilityClauses();

        expect(clauses).toHaveProperty('liability-cap-contract');
        expect(clauses).toHaveProperty('mutual-liability-cap');

        Object.values(clauses).forEach(clause => {
            expect(clause.content.toLowerCase()).toContain('liability');
        });
    });
});

describe('Integration Tests', () => {
    let system;
    let tempDir;

    beforeAll(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'contract-integration-'));
        system = new ContractTemplateSystem();

        // Override directories
        system.templatesDir = path.join(tempDir, 'templates');
        system.clausesDir = path.join(tempDir, 'clauses');
        system.outputDir = path.join(tempDir, 'generated');

        [system.templatesDir, system.clausesDir, system.outputDir].forEach(dir => {
            fs.mkdirSync(dir, { recursive: true });
        });
    });

    afterAll(() => {
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('should handle full contract workflow', async() => {
        // Step 1: Generate a contract
        const contractOptions = {
            client: 'Integration Test Client',
            freelancer: 'Test Freelancer',
            project: 'Full Stack Application',
            value: '15000',
            currency: 'USD'
        };

        const contract = await system.generateContract('fixed-price', contractOptions);
        expect(fs.existsSync(contract.path)).toBe(true);

        // Step 2: Analyze the generated contract
        const analysis = await system.analyzeContract(contract.path);
        expect(analysis.fairnessScore).toBeGreaterThanOrEqual(0);

        // Step 3: Create a modified version
        const modifiedContent = contract.content.replace('Net 30 days', 'Net 15 days');
        const modifiedPath = path.join(tempDir, 'modified-contract.md');
        fs.writeFileSync(modifiedPath, modifiedContent);

        // Step 4: Compare versions
        const comparison = await system.compareContracts(contract.path, modifiedPath);
        expect(comparison.changes.length).toBeGreaterThan(0);

        // Step 5: Add custom clauses
        await system.addClause('payment', 'integration-test', {
            title: 'Integration Test Clause',
            content: 'Special terms for integration testing',
            riskLevel: 'low'
        });

        const clauses = await system.listClauses('payment');
        expect(clauses).toHaveProperty('integration-test');

        // Step 6: Generate summary
        const summary = await system.getRiskSummary([contract.path, modifiedPath]);
        expect(summary.totalContracts).toBe(2);
    });
});

describe('Error Handling', () => {
    let system;

    beforeEach(() => {
        system = new ContractTemplateSystem();
    });

    test('should handle missing template files gracefully', async() => {
        // This should work because it creates default templates
        const result = await system.generateContract('fixed-price', { client: 'Test' });
        expect(result).toHaveProperty('content');
    });

    test('should handle file system errors', async() => {
        await expect(system.analyzeContract('/invalid/path/file.txt'))
            .rejects.toThrow();
    });

    test('should validate contract types', async() => {
        await expect(system.generateContract('non-existent-type'))
            .rejects.toThrow('Invalid contract type');
    });

    test('should validate clause categories', async() => {
        await expect(system.addClause('invalid-category', 'test', {}))
            .rejects.toThrow('Invalid clause category');
    });
});