/**
 * Test Suite for TaxOptimizer
 */

const { TaxOptimizer } = require('../lib/tax-optimizer');
const { DatabaseManager } = require('../lib/database');
const fs = require('fs').promises;
const path = require('path');

describe('TaxOptimizer', () => {
    let taxOptimizer;
    let mockDb;
    let testDataDir;

    beforeEach(async () => {
        // Setup test database
        testDataDir = path.join(__dirname, 'test-data-tax');
        await fs.mkdir(testDataDir, { recursive: true });
        
        mockDb = new DatabaseManager();
        mockDb.dataDir = testDataDir;
        await mockDb.initialize();
        
        taxOptimizer = new TaxOptimizer(mockDb);

        // Add some test expenses
        const testExpenses = [
            {
                id: 'exp_1',
                amount: 500,
                usdAmount: 500,
                vendor: 'GitHub',
                category: 'software',
                isBusinessExpense: true,
                date: '2024-01-15'
            },
            {
                id: 'exp_2',
                amount: 1200,
                usdAmount: 1200,
                vendor: 'Apple',
                category: 'hardware',
                isBusinessExpense: true,
                date: '2024-02-10'
            },
            {
                id: 'exp_3',
                amount: 300,
                usdAmount: 300,
                vendor: 'Coursera',
                category: 'education',
                isBusinessExpense: true,
                date: '2024-03-05'
            }
        ];

        await mockDb.saveData('expenses', testExpenses);
    });

    afterEach(async () => {
        // Cleanup test data
        try {
            await fs.rm(testDataDir, { recursive: true, force: true });
        } catch (error) {
            console.warn('Cleanup error:', error.message);
        }
    });

    describe('calculateTaxLiability', () => {
        test('should calculate basic tax liability correctly', () => {
            const options = {
                income: 80000,
                deductions: 15000,
                filingStatus: 'single',
                businessStructure: 'sole_proprietorship'
            };

            const result = taxOptimizer.calculateTaxLiability(options);

            expect(result.grossIncome).toBe(80000);
            expect(result.businessDeductions).toBe(15000);
            expect(result.totalDeductions).toBe(15000); // Higher than standard deduction
            expect(result.taxableIncome).toBe(65000); // 80000 - 15000
            expect(result.incomeTax).toBeGreaterThan(0);
            expect(result.selfEmploymentTax).toBeGreaterThan(0);
            expect(result.total).toBe(result.incomeTax + result.selfEmploymentTax);
        });

        test('should use standard deduction when higher', () => {
            const options = {
                income: 50000,
                deductions: 5000, // Lower than standard deduction
                filingStatus: 'single',
                businessStructure: 'sole_proprietorship'
            };

            const result = taxOptimizer.calculateTaxLiability(options);

            expect(result.totalDeductions).toBe(14600); // 2024 standard deduction for single
            expect(result.taxableIncome).toBe(35400); // 50000 - 14600
        });

        test('should handle married filing jointly status', () => {
            const singleOptions = {
                income: 80000,
                deductions: 10000,
                filingStatus: 'single',
                businessStructure: 'sole_proprietorship'
            };

            const marriedOptions = {
                ...singleOptions,
                filingStatus: 'marriedFilingJointly'
            };

            const singleResult = taxOptimizer.calculateTaxLiability(singleOptions);
            const marriedResult = taxOptimizer.calculateTaxLiability(marriedOptions);

            // Married filing jointly should have higher standard deduction
            expect(marriedResult.totalDeductions).toBeGreaterThan(singleResult.totalDeductions);
        });

        test('should not calculate self-employment tax for non-sole proprietors', () => {
            const options = {
                income: 80000,
                deductions: 15000,
                filingStatus: 'single',
                businessStructure: 'llc'
            };

            const result = taxOptimizer.calculateTaxLiability(options);

            expect(result.selfEmploymentTax).toBe(0);
        });
    });

    describe('calculateIncomeTax', () => {
        test('should calculate tax in first bracket correctly', () => {
            const tax = taxOptimizer.calculateIncomeTax(10000);
            expect(tax).toBe(1000); // 10% of $10,000
        });

        test('should calculate tax across multiple brackets', () => {
            const tax = taxOptimizer.calculateIncomeTax(50000);
            
            // First bracket: $11,600 at 10% = $1,160
            // Second bracket: $38,400 at 12% = $4,608
            // Total: $5,768
            expect(tax).toBeCloseTo(5768, 0);
        });

        test('should handle high income across many brackets', () => {
            const tax = taxOptimizer.calculateIncomeTax(200000);
            expect(tax).toBeGreaterThan(30000);
            expect(tax).toBeLessThan(60000);
        });
    });

    describe('calculateSelfEmploymentTax', () => {
        test('should calculate SE tax for moderate income', () => {
            const seTax = taxOptimizer.calculateSelfEmploymentTax(80000);
            
            // Net earnings: 80000 * 0.9235 = 73,880
            // Social Security: 73,880 * 12.4% = 9,161.12
            // Medicare: 73,880 * 2.9% = 2,142.52
            // Total: ~11,304
            expect(seTax).toBeCloseTo(11304, 0);
        });

        test('should cap Social Security tax at wage base', () => {
            const highIncome = 200000;
            const seTax = taxOptimizer.calculateSelfEmploymentTax(highIncome);
            
            const netEarnings = highIncome * 0.9235;
            const ssWageBase = 160200;
            
            // SS should be capped at wage base
            const expectedSSTax = ssWageBase * 0.124;
            const expectedMedicareTax = netEarnings * 0.029;
            const expectedTotal = expectedSSTax + expectedMedicareTax;
            
            expect(seTax).toBeCloseTo(expectedTotal, 0);
        });

        test('should include additional Medicare tax for high earners', () => {
            const highIncome = 250000;
            const seTax = taxOptimizer.calculateSelfEmploymentTax(highIncome);
            
            // Should include the 0.9% additional Medicare tax on amount over $200K
            expect(seTax).toBeGreaterThan(30000);
        });
    });

    describe('optimize', () => {
        test('should provide comprehensive optimization analysis', async () => {
            const options = {
                annualIncome: 100000,
                filingStatus: 'single',
                currentYear: 2024
            };

            const result = await taxOptimizer.optimize(options);

            expect(result).toHaveProperty('summary');
            expect(result).toHaveProperty('breakdown');
            expect(result).toHaveProperty('strategies');
            expect(result).toHaveProperty('structureAdvice');
            expect(result).toHaveProperty('nextSteps');

            expect(result.summary.annualIncome).toBe(100000);
            expect(result.summary.totalDeductions).toBeGreaterThan(0);
            expect(result.summary.effectiveTaxRate).toMatch(/%$/);
        });

        test('should calculate deductions from expenses correctly', async () => {
            const options = {
                annualIncome: 80000,
                currentYear: 2024
            };

            const result = await taxOptimizer.optimize(options);

            // Should find our test expenses (software: 500, hardware: 1200, education: 300)
            expect(result.summary.totalDeductions).toBe(2000);
        });

        test('should generate relevant strategies', async () => {
            const options = {
                annualIncome: 120000,
                currentYear: 2024
            };

            const result = await taxOptimizer.optimize(options);

            expect(Array.isArray(result.strategies)).toBe(true);
            expect(result.strategies.length).toBeGreaterThan(0);
            
            // Should prioritize by potential savings
            for (let i = 1; i < result.strategies.length; i++) {
                expect(result.strategies[i-1].potentialSavings).toBeGreaterThanOrEqual(
                    result.strategies[i].potentialSavings
                );
            }
        });

        test('should recommend business structure changes for high earners', async () => {
            const options = {
                annualIncome: 150000,
                currentYear: 2024
            };

            const result = await taxOptimizer.optimize(options);

            expect(Array.isArray(result.structureAdvice)).toBe(true);
            expect(result.structureAdvice.length).toBeGreaterThan(0);
            
            const sCorpAdvice = result.structureAdvice.find(advice => 
                advice.structure === 'S-Corporation Election'
            );
            expect(sCorpAdvice).toBeDefined();
        });
    });

    describe('estimateQuarterly', () => {
        test('should calculate quarterly tax payments', async () => {
            const result = await taxOptimizer.estimateQuarterly('Q1', 80000);

            expect(result).toHaveProperty('quarter');
            expect(result).toHaveProperty('projectedAnnualIncome');
            expect(result).toHaveProperty('projectedAnnualDeductions');
            expect(result).toHaveProperty('estimatedTaxLiability');
            expect(result).toHaveProperty('quarterlyPayment');
            expect(result).toHaveProperty('dueDate');

            expect(result.quarter).toBe('Q1');
            expect(result.projectedAnnualIncome).toBe(80000);
            expect(result.quarterlyPayment).toBeGreaterThan(0);
            expect(result.dueDate).toMatch(/\d{4}-04-15/); // Q1 due date format
        });

        test('should handle all quarters correctly', async () => {
            const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
            const expectedDates = ['04-15', '06-17', '09-16', '01-15'];

            for (let i = 0; i < quarters.length; i++) {
                const result = await taxOptimizer.estimateQuarterly(quarters[i], 60000);
                expect(result.dueDate).toMatch(new RegExp(expectedDates[i]));
            }
        });

        test('should throw error for invalid quarter', async () => {
            await expect(taxOptimizer.estimateQuarterly('Q5', 60000))
                .rejects.toThrow('Invalid quarter');
        });
    });

    describe('getDeductions', () => {
        test('should return categorized deductions', async () => {
            const result = await taxOptimizer.getDeductions(2024);

            expect(result).toHaveProperty('year');
            expect(result).toHaveProperty('totalDeductions');
            expect(result).toHaveProperty('categorizedDeductions');
            expect(result).toHaveProperty('summary');

            expect(result.year).toBe(2024);
            expect(result.totalDeductions).toBe(2000); // Sum of test expenses

            // Check categorized breakdown
            expect(result.categorizedDeductions.software).toBeDefined();
            expect(result.categorizedDeductions.software.deductibleAmount).toBe(500);
            expect(result.categorizedDeductions.hardware.deductibleAmount).toBe(1200);
            expect(result.categorizedDeductions.education.deductibleAmount).toBe(300);
        });

        test('should handle partial deductions correctly', async () => {
            // Add a meals expense (only 50% deductible)
            const mealsExpense = {
                id: 'exp_meals',
                amount: 100,
                usdAmount: 100,
                vendor: 'Restaurant',
                category: 'meals',
                isBusinessExpense: true,
                date: '2024-04-01'
            };

            const expenses = await mockDb.loadData('expenses');
            expenses.push(mealsExpense);
            await mockDb.saveData('expenses', expenses);

            const result = await taxOptimizer.getDeductions(2024);

            expect(result.categorizedDeductions.meals).toBeDefined();
            expect(result.categorizedDeductions.meals.totalAmount).toBe(100);
            expect(result.categorizedDeductions.meals.deductibleAmount).toBe(50); // 50% deductible
        });
    });

    describe('generateOptimizationStrategies', () => {
        test('should generate retirement strategy for high income', async () => {
            const options = {
                income: 120000,
                expenses: [],
                currentTax: { total: 30000 }
            };

            const strategies = await taxOptimizer.generateOptimizationStrategies(options);

            const retirementStrategy = strategies.find(s => s.type === 'retirement');
            expect(retirementStrategy).toBeDefined();
            expect(retirementStrategy.recommendedContribution).toBeGreaterThan(0);
            expect(retirementStrategy.potentialSavings).toBeGreaterThan(0);
        });

        test('should suggest equipment purchases for depreciation', async () => {
            const options = {
                income: 80000,
                expenses: [],
                currentTax: { total: 20000 }
            };

            const strategies = await taxOptimizer.generateOptimizationStrategies(options);

            const equipmentStrategy = strategies.find(s => s.type === 'equipment');
            expect(equipmentStrategy).toBeDefined();
            expect(equipmentStrategy.recommendedPurchase).toBeGreaterThan(0);
            expect(equipmentStrategy.suggestions).toContain('Computer/laptop upgrade');
        });

        test('should include HSA strategy', async () => {
            const options = {
                income: 100000,
                expenses: [],
                currentTax: { total: 25000 }
            };

            const strategies = await taxOptimizer.generateOptimizationStrategies(options);

            const hsaStrategy = strategies.find(s => s.type === 'hsa');
            expect(hsaStrategy).toBeDefined();
            expect(hsaStrategy.contribution).toBe(4300); // 2024 individual limit
        });
    });

    describe('getBusinessStructureAdvice', () => {
        test('should not recommend changes for low income', () => {
            const advice = taxOptimizer.getBusinessStructureAdvice(40000, { total: 8000 });
            expect(advice).toHaveLength(0);
        });

        test('should recommend LLC for moderate income', () => {
            const advice = taxOptimizer.getBusinessStructureAdvice(75000, { total: 18000 });
            
            const llcAdvice = advice.find(a => a.structure === 'LLC');
            expect(llcAdvice).toBeDefined();
            expect(llcAdvice.threshold).toBe(50000);
        });

        test('should recommend S-Corp for high income', () => {
            const advice = taxOptimizer.getBusinessStructureAdvice(120000, { total: 30000 });
            
            const sCorpAdvice = advice.find(a => a.structure === 'S-Corporation Election');
            expect(sCorpAdvice).toBeDefined();
            expect(sCorpAdvice.threshold).toBe(80000);
            expect(sCorpAdvice.estimatedSavings).toBeGreaterThan(0);
        });
    });

    describe('calculateSCorpSavings', () => {
        test('should calculate S-Corp savings correctly', () => {
            const income = 120000;
            const currentTax = { total: 30000 };
            
            const savings = taxOptimizer.calculateSCorpSavings(income, currentTax);
            
            // Reasonable salary: 35% of 120000 = 42000
            // Distributions: 120000 - 42000 = 78000
            // SE tax savings: 78000 * 15.3% = 11934
            expect(savings).toBeCloseTo(11934, 0);
        });
    });
});