/**
 * Command Line Interface Handler for Tax & Expense Tools
 * 
 * Handles parsing and routing of CLI commands for the tax-expense module
 */

class CLIHandler {
    constructor({ expenseTracker, taxOptimizer, reportGenerator }) {
        this.expenseTracker = expenseTracker;
        this.taxOptimizer = taxOptimizer;
        this.reportGenerator = reportGenerator;
        
        this.commands = {
            'expense': this.handleExpenseCommand.bind(this),
            'tax': this.handleTaxCommand.bind(this),
            'report': this.handleReportCommand.bind(this),
            'optimize': this.handleOptimizeCommand.bind(this),
            'deductions': this.handleDeductionsCommand.bind(this),
            'estimate': this.handleEstimateCommand.bind(this),
            'help': this.handleHelpCommand.bind(this)
        };
    }

    async handle(args) {
        if (args.length === 0) {
            return this.handleHelpCommand();
        }

        const command = args[0];
        const handler = this.commands[command];
        
        if (!handler) {
            throw new Error(`Unknown command: ${command}. Use 'help' to see available commands.`);
        }

        return await handler(args.slice(1));
    }

    async handleExpenseCommand(args) {
        const subcommand = args[0];
        
        switch (subcommand) {
            case 'add':
                return await this.addExpense(args.slice(1));
            case 'list':
                return await this.listExpenses(args.slice(1));
            case 'categorize':
                return await this.categorizeExpense(args.slice(1));
            case 'import':
                return await this.importExpenses(args.slice(1));
            default:
                throw new Error(`Unknown expense subcommand: ${subcommand}`);
        }
    }

    async handleTaxCommand(args) {
        const subcommand = args[0];
        
        switch (subcommand) {
            case 'optimize':
                return await this.handleOptimizeCommand(args.slice(1));
            case 'estimate':
                return await this.handleEstimateCommand(args.slice(1));
            case 'deductions':
                return await this.handleDeductionsCommand(args.slice(1));
            default:
                throw new Error(`Unknown tax subcommand: ${subcommand}`);
        }
    }

    async handleReportCommand(args) {
        const options = this.parseOptions(args);
        const reportType = options.type || 'pnl';
        const period = options.period || `${new Date().getFullYear()}`;
        
        const reportOptions = {
            format: options.format || 'json',
            includeProjections: options.projections,
            groupBy: options.groupBy,
            includeTrends: options.trends !== false
        };

        return await this.reportGenerator.generate(reportType, period, reportOptions);
    }

    async handleOptimizeCommand(args) {
        const options = this.parseOptions(args);
        
        const optimizationOptions = {
            annualIncome: parseFloat(options.income) || 0,
            filingStatus: options.filing || 'single',
            state: options.state || 'federal_only',
            currentYear: parseInt(options.year) || new Date().getFullYear(),
            businessStructure: options.structure || 'sole_proprietorship'
        };

        if (!optimizationOptions.annualIncome) {
            throw new Error('Annual income is required. Use --income flag.');
        }

        return await this.taxOptimizer.optimize(optimizationOptions);
    }

    async handleDeductionsCommand(args) {
        const options = this.parseOptions(args);
        const year = parseInt(options.year) || new Date().getFullYear();
        
        if (options.list) {
            return await this.taxOptimizer.getDeductions(year);
        }
        
        // Add a new deduction
        if (options.add) {
            throw new Error('Adding manual deductions not yet implemented');
        }
        
        return await this.taxOptimizer.getDeductions(year);
    }

    async handleEstimateCommand(args) {
        const options = this.parseOptions(args);
        
        if (options.quarter) {
            const quarter = options.quarter.toUpperCase();
            const income = parseFloat(options.income);
            
            if (!income) {
                throw new Error('Projected income is required. Use --income flag.');
            }
            
            return await this.taxOptimizer.estimateQuarterly(quarter, income);
        }
        
        throw new Error('Quarter is required. Use --quarter flag (Q1, Q2, Q3, Q4).');
    }

    async addExpense(args) {
        const options = this.parseOptions(args);
        
        const expenseData = {
            amount: parseFloat(options.amount),
            vendor: options.vendor,
            description: options.description || '',
            category: options.category,
            date: options.date,
            currency: options.currency || 'USD',
            receiptPath: options.receipt,
            isBusinessExpense: options.business !== false,
            tags: options.tags ? options.tags.split(',') : [],
            mileage: options.mileage ? parseFloat(options.mileage) : null,
            location: options.location
        };

        if (!expenseData.amount || !expenseData.vendor) {
            throw new Error('Amount and vendor are required');
        }

        return await this.expenseTracker.addExpense(expenseData);
    }

    async listExpenses(args) {
        const options = this.parseOptions(args);
        
        const filter = {};
        
        if (options.year) filter.year = parseInt(options.year);
        if (options.month) filter.month = parseInt(options.month);
        if (options.category) filter.category = options.category;
        if (options.vendor) filter.vendor = options.vendor;
        if (options.minAmount) filter.minAmount = parseFloat(options.minAmount);
        if (options.maxAmount) filter.maxAmount = parseFloat(options.maxAmount);
        if (options.business !== undefined) filter.isBusinessExpense = options.business;

        const expenses = await this.expenseTracker.getExpenses(filter);
        
        if (options.format === 'table') {
            return this.formatExpensesAsTable(expenses);
        }
        
        return { expenses, total: expenses.reduce((sum, e) => sum + e.usdAmount, 0) };
    }

    async categorizeExpense(args) {
        const options = this.parseOptions(args);
        
        if (!options.id || !options.category) {
            throw new Error('Expense ID and category are required');
        }
        
        return await this.expenseTracker.categorizeExpense(options.id, options.category);
    }

    async importExpenses(args) {
        const options = this.parseOptions(args);
        
        if (!options.file) {
            throw new Error('File path is required. Use --file flag.');
        }
        
        // Implementation would parse CSV/JSON files and batch import
        throw new Error('Expense import not yet implemented');
    }

    parseOptions(args) {
        const options = {};
        
        for (let i = 0; i < args.length; i += 2) {
            const key = args[i];
            const value = args[i + 1];
            
            if (!key || !key.startsWith('--')) {
                continue;
            }
            
            const optionName = key.substring(2);
            
            // Handle boolean flags
            if (value === undefined || value.startsWith('--')) {
                options[optionName] = true;
                i--; // Don't skip the next argument
                continue;
            }
            
            // Handle special value types
            if (value === 'true') {
                options[optionName] = true;
            } else if (value === 'false') {
                options[optionName] = false;
            } else if (!isNaN(value)) {
                options[optionName] = parseFloat(value);
            } else {
                options[optionName] = value;
            }
        }
        
        return options;
    }

    formatExpensesAsTable(expenses) {
        if (expenses.length === 0) {
            return { message: 'No expenses found' };
        }
        
        const headers = ['Date', 'Vendor', 'Category', 'Amount', 'Business'];
        const rows = expenses.map(e => [
            new Date(e.date).toLocaleDateString(),
            e.vendor,
            e.category,
            `$${e.usdAmount.toFixed(2)}`,
            e.isBusinessExpense ? 'Yes' : 'No'
        ]);
        
        return {
            format: 'table',
            headers,
            rows,
            total: expenses.reduce((sum, e) => sum + e.usdAmount, 0)
        };
    }

    handleHelpCommand() {
        return {
            title: 'Tax & Expense Management Tool',
            description: 'Comprehensive tax optimization and expense tracking for freelancers',
            commands: {
                'Expense Management': {
                    'tax expense add --amount 49.99 --vendor "GitHub" --category software': 'Add a new expense',
                    'tax expense list --year 2024 --category software': 'List expenses with filters',
                    'tax expense categorize --id exp_123 --category marketing': 'Update expense category'
                },
                'Tax Optimization': {
                    'tax optimize --income 120000 --filing single': 'Optimize tax strategy',
                    'tax deductions --list --year 2024': 'List available deductions',
                    'tax estimate --quarter Q2 --income 30000': 'Calculate quarterly payments'
                },
                'Reports': {
                    'tax report --type pnl --period Q1-2024': 'Generate P&L report',
                    'tax report --type tax_summary --period 2024': 'Generate tax summary',
                    'tax report --type expense_breakdown --period 03-2024': 'Expense breakdown by category'
                }
            },
            flags: {
                '--amount': 'Expense amount (required for add)',
                '--vendor': 'Vendor/merchant name (required for add)',
                '--category': 'Expense category (software, hardware, office, travel, etc.)',
                '--description': 'Expense description',
                '--date': 'Expense date (ISO format)',
                '--receipt': 'Path to receipt image/document',
                '--business': 'Mark as business expense (true/false)',
                '--income': 'Annual income for calculations',
                '--filing': 'Filing status (single, married_jointly, married_separately, head_of_household)',
                '--quarter': 'Tax quarter (Q1, Q2, Q3, Q4)',
                '--year': 'Tax year',
                '--type': 'Report type (pnl, tax_summary, expense_breakdown, tax_prep)',
                '--period': 'Time period (2024, Q1-2024, 03-2024)',
                '--format': 'Output format (json, csv, table, text)'
            },
            examples: [
                'tax expense add --amount 29.99 --vendor "Adobe" --category software --description "Creative Suite subscription"',
                'tax optimize --income 85000 --filing single --structure sole_proprietorship',
                'tax report --type quarterly --period Q3-2024 --format text'
            ]
        };
    }
}

module.exports = { CLIHandler };