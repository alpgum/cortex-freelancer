/**
 * Test Suite for CLIHandler
 */

const { CLIHandler } = require('../lib/cli-handler');
const { ExpenseTracker } = require('../lib/expense-tracker');
const { TaxOptimizer } = require('../lib/tax-optimizer');
const { ReportGenerator } = require('../lib/report-generator');
const { DatabaseManager } = require('../lib/database');
const fs = require('fs').promises;
const path = require('path');

describe('CLIHandler', () => {
    let cliHandler;
    let mockDb;
    let expenseTracker;
    let taxOptimizer;
    let reportGenerator;
    let testDataDir;

    beforeEach(async () => {
        // Setup test database
        testDataDir = path.join(__dirname, 'test-data-cli');
        await fs.mkdir(testDataDir, { recursive: true });
        
        mockDb = new DatabaseManager();
        mockDb.dataDir = testDataDir;
        await mockDb.initialize();
        
        expenseTracker = new ExpenseTracker(mockDb);
        taxOptimizer = new TaxOptimizer(mockDb);
        reportGenerator = new ReportGenerator(mockDb);
        
        cliHandler = new CLIHandler({
            expenseTracker,
            taxOptimizer,
            reportGenerator
        });
    });

    afterEach(async () => {
        // Cleanup test data
        try {
            await fs.rm(testDataDir, { recursive: true, force: true });
        } catch (error) {
            console.warn('Cleanup error:', error.message);
        }
    });

    describe('handle', () => {
        test('should show help when no arguments provided', async () => {
            const result = await cliHandler.handle([]);
            
            expect(result).toHaveProperty('title');
            expect(result).toHaveProperty('commands');
            expect(result.title).toMatch(/Tax & Expense Management Tool/);
        });

        test('should throw error for unknown command', async () => {
            await expect(cliHandler.handle(['unknown']))
                .rejects.toThrow('Unknown command: unknown');
        });

        test('should route to help command', async () => {
            const result = await cliHandler.handle(['help']);
            
            expect(result).toHaveProperty('title');
            expect(result).toHaveProperty('commands');
        });
    });

    describe('handleExpenseCommand', () => {
        test('should add expense with required parameters', async () => {
            const args = [
                'add',
                '--amount', '49.99',
                '--vendor', 'GitHub',
                '--category', 'software',
                '--description', 'Pro subscription'
            ];

            const result = await cliHandler.handleExpenseCommand(args);

            expect(result.success).toBe(true);
            expect(result.expense.amount).toBe(49.99);
            expect(result.expense.vendor).toBe('GitHub');
            expect(result.expense.category).toBe('software');
            expect(result.expense.description).toBe('Pro subscription');
        });

        test('should require amount and vendor for add', async () => {
            const args = ['add', '--vendor', 'GitHub'];

            await expect(cliHandler.handleExpenseCommand(args))
                .rejects.toThrow('Amount and vendor are required');
        });

        test('should handle boolean flags correctly', async () => {
            const args = [
                'add',
                '--amount', '25.00',
                '--vendor', 'Coffee Shop',
                '--business', 'false'
            ];

            const result = await cliHandler.handleExpenseCommand(args);

            expect(result.expense.isBusinessExpense).toBe(false);
        });

        test('should list expenses with filters', async () => {
            // First add some test expenses
            await cliHandler.handleExpenseCommand([
                'add',
                '--amount', '50',
                '--vendor', 'GitHub',
                '--category', 'software'
            ]);

            await cliHandler.handleExpenseCommand([
                'add',
                '--amount', '100',
                '--vendor', 'Apple',
                '--category', 'hardware'
            ]);

            // Then list with category filter
            const result = await cliHandler.handleExpenseCommand([
                'list',
                '--category', 'software'
            ]);

            expect(result.expenses).toHaveLength(1);
            expect(result.expenses[0].vendor).toBe('GitHub');
            expect(result.total).toBe(50);
        });

        test('should format expenses as table when requested', async () => {
            // Add test expense
            await cliHandler.handleExpenseCommand([
                'add',
                '--amount', '29.99',
                '--vendor', 'Adobe',
                '--category', 'software'
            ]);

            const result = await cliHandler.handleExpenseCommand([
                'list',
                '--format', 'table'
            ]);

            expect(result.format).toBe('table');
            expect(result.headers).toBeDefined();
            expect(result.rows).toBeDefined();
            expect(result.rows).toHaveLength(1);
        });

        test('should categorize expense', async () => {
            // First add an expense
            const addResult = await cliHandler.handleExpenseCommand([
                'add',
                '--amount', '75',
                '--vendor', 'Test Vendor',
                '--category', 'office'
            ]);

            // Then update its category
            const result = await cliHandler.handleExpenseCommand([
                'categorize',
                '--id', addResult.expense.id,
                '--category', 'marketing'
            ]);

            expect(result.success).toBe(true);
            expect(result.expense.category).toBe('marketing');
        });

        test('should throw error for unknown expense subcommand', async () => {
            await expect(cliHandler.handleExpenseCommand(['unknown']))
                .rejects.toThrow('Unknown expense subcommand: unknown');
        });
    });

    describe('handleOptimizeCommand', () => {
        test('should optimize tax strategy with income', async () => {
            const args = [
                '--income', '85000',
                '--filing', 'single',
                '--structure', 'sole_proprietorship'
            ];

            const result = await cliHandler.handleOptimizeCommand(args);

            expect(result).toHaveProperty('summary');
            expect(result).toHaveProperty('strategies');
            expect(result.summary.annualIncome).toBe(85000);
        });

        test('should require income parameter', async () => {
            const args = ['--filing', 'single'];

            await expect(cliHandler.handleOptimizeCommand(args))
                .rejects.toThrow('Annual income is required');
        });

        test('should use default values for optional parameters', async () => {
            const args = ['--income', '75000'];

            const result = await cliHandler.handleOptimizeCommand(args);

            // Should use defaults: single filing, current year, sole proprietorship
            expect(result.summary.annualIncome).toBe(75000);
        });
    });

    describe('handleEstimateCommand', () => {
        test('should calculate quarterly estimate', async () => {
            const args = [
                '--quarter', 'Q2',
                '--income', '80000'
            ];

            const result = await cliHandler.handleEstimateCommand(args);

            expect(result.quarter).toBe('Q2');
            expect(result.projectedAnnualIncome).toBe(80000);
            expect(result.quarterlyPayment).toBeGreaterThan(0);
            expect(result.dueDate).toMatch(/06-17/); // Q2 due date
        });

        test('should require quarter parameter', async () => {
            const args = ['--income', '70000'];

            await expect(cliHandler.handleEstimateCommand(args))
                .rejects.toThrow('Quarter is required');
        });

        test('should require income parameter', async () => {
            const args = ['--quarter', 'Q1'];

            await expect(cliHandler.handleEstimateCommand(args))
                .rejects.toThrow('Projected income is required');
        });
    });

    describe('handleDeductionsCommand', () => {
        beforeEach(async () => {
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
                    amount: 1000,
                    usdAmount: 1000,
                    vendor: 'Apple',
                    category: 'hardware',
                    isBusinessExpense: true,
                    date: '2024-02-10'
                }
            ];

            await mockDb.saveData('expenses', testExpenses);
        });

        test('should list deductions for current year by default', async () => {
            const result = await cliHandler.handleDeductionsCommand(['--list']);

            expect(result).toHaveProperty('year');
            expect(result).toHaveProperty('totalDeductions');
            expect(result).toHaveProperty('categorizedDeductions');
            expect(result.totalDeductions).toBe(1500); // 500 + 1000
        });

        test('should list deductions for specific year', async () => {
            const result = await cliHandler.handleDeductionsCommand([
                '--list',
                '--year', '2024'
            ]);

            expect(result.year).toBe(2024);
            expect(result.totalDeductions).toBe(1500);
        });
    });

    describe('handleReportCommand', () => {
        test('should generate P&L report by default', async () => {
            const result = await cliHandler.handleReportCommand([
                '--period', '2024'
            ]);

            expect(result).toHaveProperty('title');
            expect(result.title).toMatch(/Profit & Loss Statement/);
        });

        test('should generate specific report type', async () => {
            const result = await cliHandler.handleReportCommand([
                '--type', 'expense_breakdown',
                '--period', 'Q1-2024'
            ]);

            expect(result.title).toMatch(/Expense Breakdown/);
        });

        test('should use current year as default period', async () => {
            const result = await cliHandler.handleReportCommand([
                '--type', 'tax_summary'
            ]);

            expect(result).toHaveProperty('title');
            // Should work without throwing error
        });
    });

    describe('parseOptions', () => {
        test('should parse string options correctly', () => {
            const args = ['--vendor', 'GitHub', '--category', 'software'];
            const options = cliHandler.parseOptions(args);

            expect(options.vendor).toBe('GitHub');
            expect(options.category).toBe('software');
        });

        test('should parse numeric options correctly', () => {
            const args = ['--amount', '49.99', '--year', '2024'];
            const options = cliHandler.parseOptions(args);

            expect(options.amount).toBe(49.99);
            expect(options.year).toBe(2024);
        });

        test('should parse boolean options correctly', () => {
            const args = ['--business', 'true', '--trends', 'false', '--list'];
            const options = cliHandler.parseOptions(args);

            expect(options.business).toBe(true);
            expect(options.trends).toBe(false);
            expect(options.list).toBe(true); // Flag without value
        });

        test('should handle missing values as boolean flags', () => {
            const args = ['--list', '--verbose', '--amount', '50'];
            const options = cliHandler.parseOptions(args);

            expect(options.list).toBe(true);
            expect(options.verbose).toBe(true);
            expect(options.amount).toBe(50);
        });

        test('should handle empty args array', () => {
            const options = cliHandler.parseOptions([]);
            expect(options).toEqual({});
        });
    });

    describe('formatExpensesAsTable', () => {
        test('should format expenses as table', () => {
            const expenses = [
                {
                    date: '2024-01-15T00:00:00.000Z',
                    vendor: 'GitHub',
                    category: 'software',
                    usdAmount: 49.99,
                    isBusinessExpense: true
                },
                {
                    date: '2024-02-10T00:00:00.000Z',
                    vendor: 'Apple',
                    category: 'hardware',
                    usdAmount: 1200.00,
                    isBusinessExpense: false
                }
            ];

            const result = cliHandler.formatExpensesAsTable(expenses);

            expect(result.format).toBe('table');
            expect(result.headers).toEqual(['Date', 'Vendor', 'Category', 'Amount', 'Business']);
            expect(result.rows).toHaveLength(2);
            expect(result.rows[0]).toContain('GitHub');
            expect(result.rows[0]).toContain('$49.99');
            expect(result.rows[0]).toContain('Yes');
            expect(result.rows[1]).toContain('Apple');
            expect(result.rows[1]).toContain('$1200.00');
            expect(result.rows[1]).toContain('No');
            expect(result.total).toBe(1249.99);
        });

        test('should handle empty expenses array', () => {
            const result = cliHandler.formatExpensesAsTable([]);

            expect(result.message).toBe('No expenses found');
        });
    });

    describe('handleHelpCommand', () => {
        test('should return comprehensive help information', () => {
            const result = cliHandler.handleHelpCommand();

            expect(result).toHaveProperty('title');
            expect(result).toHaveProperty('description');
            expect(result).toHaveProperty('commands');
            expect(result).toHaveProperty('flags');
            expect(result).toHaveProperty('examples');

            expect(result.commands).toHaveProperty('Expense Management');
            expect(result.commands).toHaveProperty('Tax Optimization');
            expect(result.commands).toHaveProperty('Reports');

            expect(Array.isArray(result.examples)).toBe(true);
            expect(result.examples.length).toBeGreaterThan(0);
        });
    });

    describe('Integration Tests', () => {
        test('should handle complete workflow: add expenses, optimize, generate report', async () => {
            // Step 1: Add some expenses
            await cliHandler.handle([
                'expense', 'add',
                '--amount', '500',
                '--vendor', 'GitHub',
                '--category', 'software'
            ]);

            await cliHandler.handle([
                'expense', 'add',
                '--amount', '1200',
                '--vendor', 'Apple',
                '--category', 'hardware'
            ]);

            // Step 2: Optimize taxes
            const optimization = await cliHandler.handle([
                'optimize',
                '--income', '85000',
                '--filing', 'single'
            ]);

            expect(optimization.summary.totalDeductions).toBe(1700);

            // Step 3: Generate report
            const report = await cliHandler.handle([
                'report',
                '--type', 'expense_breakdown',
                '--period', '2024'
            ]);

            expect(report.breakdown).toBeDefined();
        });

        test('should handle quarterly tax estimation workflow', async () => {
            // Add expenses first
            await cliHandler.handle([
                'expense', 'add',
                '--amount', '300',
                '--vendor', 'Coursera',
                '--category', 'education'
            ]);

            // Estimate quarterly taxes
            const estimate = await cliHandler.handle([
                'estimate',
                '--quarter', 'Q3',
                '--income', '75000'
            ]);

            expect(estimate.quarter).toBe('Q3');
            expect(estimate.projectedAnnualDeductions).toBeGreaterThan(0);
            expect(estimate.quarterlyPayment).toBeGreaterThan(0);
        });
    });
});