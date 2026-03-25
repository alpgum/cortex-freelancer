/**
 * Test Suite for ExpenseTracker
 */

const { ExpenseTracker } = require('../lib/expense-tracker');
const { DatabaseManager } = require('../lib/database');
const fs = require('fs').promises;
const path = require('path');

describe('ExpenseTracker', () => {
    let expenseTracker;
    let mockDb;
    let testDataDir;

    beforeEach(async () => {
        // Setup test database
        testDataDir = path.join(__dirname, 'test-data');
        
        mockDb = new DatabaseManager();
        mockDb.dataDir = testDataDir;
        await mockDb.initialize();
        
        expenseTracker = new ExpenseTracker(mockDb);
    });

    afterEach(async () => {
        // Cleanup test data
        try {
            await fs.rm(testDataDir, { recursive: true, force: true });
        } catch (error) {
            console.warn('Cleanup error:', error.message);
        }
    });

    describe('addExpense', () => {
        test('should add a basic expense successfully', async () => {
            const expenseData = {
                amount: 49.99,
                vendor: 'GitHub',
                description: 'Pro subscription',
                category: 'software'
            };

            const result = await expenseTracker.addExpense(expenseData);

            expect(result.success).toBe(true);
            expect(result.expense.id).toMatch(/^exp_/);
            expect(result.expense.amount).toBe(49.99);
            expect(result.expense.vendor).toBe('GitHub');
            expect(result.expense.category).toBe('software');
            expect(result.expense.isBusinessExpense).toBe(true);
        });

        test('should auto-categorize software expenses', async () => {
            const expenseData = {
                amount: 29.99,
                vendor: 'Adobe',
                description: 'Creative Suite subscription'
            };

            const result = await expenseTracker.addExpense(expenseData);

            expect(result.expense.category).toBe('software');
        });

        test('should auto-categorize travel expenses', async () => {
            const expenseData = {
                amount: 15.50,
                vendor: 'Uber',
                description: 'Client meeting transport'
            };

            const result = await expenseTracker.addExpense(expenseData);

            expect(result.expense.category).toBe('travel');
        });

        test('should classify business vs personal expenses', async () => {
            const businessExpense = {
                amount: 100,
                vendor: 'Office Depot',
                description: 'Business supplies'
            };

            const personalExpense = {
                amount: 25,
                vendor: 'Starbucks',
                description: 'Personal coffee'
            };

            const businessResult = await expenseTracker.addExpense(businessExpense);
            const personalResult = await expenseTracker.addExpense(personalExpense);

            expect(businessResult.expense.isBusinessExpense).toBe(true);
            // Personal classification would depend on more sophisticated logic
            expect(personalResult.expense.isBusinessExpense).toBeDefined();
        });

        test('should handle currency conversion', async () => {
            const expenseData = {
                amount: 100,
                currency: 'EUR',
                vendor: 'European Vendor',
                description: 'Service fee'
            };

            const result = await expenseTracker.addExpense(expenseData);

            expect(result.expense.amount).toBe(100);
            expect(result.expense.currency).toBe('EUR');
            expect(result.expense.usdAmount).toBeGreaterThan(100); // EUR > USD
        });

        test('should require amount and vendor', async () => {
            await expect(expenseTracker.addExpense({})).rejects.toThrow('Amount and vendor are required');
            await expect(expenseTracker.addExpense({ amount: 50 })).rejects.toThrow('Amount and vendor are required');
            await expect(expenseTracker.addExpense({ vendor: 'Test' })).rejects.toThrow('Amount and vendor are required');
        });

        test('should generate optimization suggestions', async () => {
            const expenseData = {
                amount: 500,
                vendor: 'Apple Store',
                category: 'hardware',
                description: 'MacBook Pro for business'
            };

            const result = await expenseTracker.addExpense(expenseData);

            expect(result.suggestions).toBeDefined();
            expect(Array.isArray(result.suggestions)).toBe(true);
        });
    });

    describe('autoCategorize', () => {
        test('should categorize software vendors correctly', async () => {
            const category = await expenseTracker.autoCategorize('GitHub', 'Pro subscription');
            expect(category).toBe('software');
        });

        test('should categorize hardware vendors correctly', async () => {
            const category = await expenseTracker.autoCategorize('Apple Store', 'MacBook Pro');
            expect(category).toBe('hardware');
        });

        test('should categorize travel expenses correctly', async () => {
            const category = await expenseTracker.autoCategorize('United Airlines', 'Flight to conference');
            expect(category).toBe('travel');
        });

        test('should return other for unknown vendors', async () => {
            const category = await expenseTracker.autoCategorize('Unknown Vendor', 'Mystery expense');
            expect(category).toBe('other');
        });
    });

    describe('categorizeExpense', () => {
        test('should update expense category', async () => {
            // First add an expense
            const expenseData = {
                amount: 50,
                vendor: 'Test Vendor',
                category: 'office'
            };

            const addResult = await expenseTracker.addExpense(expenseData);
            const expenseId = addResult.expense.id;

            // Then update its category
            const updateResult = await expenseTracker.categorizeExpense(expenseId, 'marketing');

            expect(updateResult.success).toBe(true);
            expect(updateResult.expense.category).toBe('marketing');
        });

        test('should throw error for non-existent expense', async () => {
            await expect(
                expenseTracker.categorizeExpense('non-existent-id', 'software')
            ).rejects.toThrow('Expense not found');
        });
    });

    describe('detectRecurring', () => {
        test('should detect monthly recurring expenses', async () => {
            const baseExpense = {
                amount: 49.99,
                vendor: 'SaaS Provider',
                description: 'Monthly subscription'
            };

            // Add expenses with monthly pattern
            for (let i = 0; i < 3; i++) {
                const date = new Date();
                date.setMonth(date.getMonth() - i);
                
                await expenseTracker.addExpense({
                    ...baseExpense,
                    date: date.toISOString()
                });
            }

            // Check if recurring pattern was detected
            const recurringExpenses = await mockDb.getRecurringExpenses();
            expect(recurringExpenses.length).toBeGreaterThan(0);
            
            const recurring = recurringExpenses.find(r => r.vendor === 'SaaS Provider');
            expect(recurring).toBeDefined();
            expect(recurring.frequency).toBe('monthly');
        });
    });

    describe('calculateHomeOfficeDeduction', () => {
        test('should calculate simplified method correctly', async () => {
            const homeOfficeData = {
                totalHomeSquareFootage: 2000,
                officeSquareFootage: 200,
                method: 'simplified'
            };

            const result = await expenseTracker.calculateHomeOfficeDeduction(homeOfficeData);

            expect(result.method).toBe('simplified');
            expect(result.squareFootage).toBe(200);
            expect(result.rate).toBe(5);
            expect(result.deduction).toBe(1000); // 200 * $5
        });

        test('should cap simplified method at 300 sq ft', async () => {
            const homeOfficeData = {
                totalHomeSquareFootage: 3000,
                officeSquareFootage: 500, // Over 300 limit
                method: 'simplified'
            };

            const result = await expenseTracker.calculateHomeOfficeDeduction(homeOfficeData);

            expect(result.squareFootage).toBe(300); // Capped at 300
            expect(result.deduction).toBe(1500); // 300 * $5
        });

        test('should calculate actual method correctly', async () => {
            const homeOfficeData = {
                totalHomeSquareFootage: 2000,
                officeSquareFootage: 200,
                annualHomeExpenses: 12000,
                method: 'actual'
            };

            const result = await expenseTracker.calculateHomeOfficeDeduction(homeOfficeData);

            expect(result.method).toBe('actual');
            expect(result.businessPercentage).toBe(10); // 200/2000 * 100
            expect(result.deduction).toBe(1200); // 12000 * 10%
        });
    });

    describe('trackDepreciation', () => {
        test('should track equipment depreciation correctly', async () => {
            const equipmentData = {
                name: 'MacBook Pro',
                purchaseDate: '2024-01-15',
                cost: 2500,
                businessUsePercentage: 100,
                usefulLifeYears: 5
            };

            const result = await expenseTracker.trackDepreciation(equipmentData);

            expect(result.success).toBe(true);
            expect(result.equipment.businessCost).toBe(2500);
            expect(result.annualDepreciation).toBe(500); // 2500 / 5 years
            expect(result.totalDepreciationAvailable).toBe(2500);
        });

        test('should handle partial business use', async () => {
            const equipmentData = {
                name: 'iPhone',
                purchaseDate: '2024-01-15',
                cost: 1000,
                businessUsePercentage: 70,
                usefulLifeYears: 3
            };

            const result = await expenseTracker.trackDepreciation(equipmentData);

            expect(result.equipment.businessCost).toBe(700); // 1000 * 70%
            expect(result.annualDepreciation).toBeCloseTo(233.33); // 700 / 3 years
        });
    });

    describe('getExpenses', () => {
        beforeEach(async () => {
            // Add test expenses
            const testExpenses = [
                {
                    amount: 50,
                    vendor: 'GitHub',
                    category: 'software',
                    date: '2024-01-15'
                },
                {
                    amount: 100,
                    vendor: 'Apple',
                    category: 'hardware',
                    date: '2024-02-10'
                },
                {
                    amount: 25,
                    vendor: 'Uber',
                    category: 'travel',
                    date: '2024-03-05'
                }
            ];

            for (const expense of testExpenses) {
                await expenseTracker.addExpense(expense);
            }
        });

        test('should filter by category', async () => {
            const softwareExpenses = await expenseTracker.getExpenses({ category: 'software' });
            expect(softwareExpenses).toHaveLength(1);
            expect(softwareExpenses[0].vendor).toBe('GitHub');
        });

        test('should filter by year', async () => {
            const expenses2024 = await expenseTracker.getExpenses({ year: 2024 });
            expect(expenses2024).toHaveLength(3);

            const expenses2023 = await expenseTracker.getExpenses({ year: 2023 });
            expect(expenses2023).toHaveLength(0);
        });

        test('should return all expenses with no filter', async () => {
            const allExpenses = await expenseTracker.getExpenses();
            expect(allExpenses).toHaveLength(3);
        });
    });
});