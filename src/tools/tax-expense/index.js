#!/usr/bin/env node
/**
 * Tax Optimization and Expense Tracking Tool for Freelancers
 * 
 * Comprehensive tax planning, expense management, and financial reporting
 * for freelance professionals.
 */

const { ExpenseTracker } = require('./lib/expense-tracker');
const { TaxOptimizer } = require('./lib/tax-optimizer');
const { ReportGenerator } = require('./lib/report-generator');
const { CLIHandler } = require('./lib/cli-handler');
const { DatabaseManager } = require('./lib/database');

class TaxExpenseManager {
    constructor() {
        this.db = new DatabaseManager();
        this.expenseTracker = new ExpenseTracker(this.db);
        this.taxOptimizer = new TaxOptimizer(this.db);
        this.reportGenerator = new ReportGenerator(this.db);
        this.cliHandler = new CLIHandler({
            expenseTracker: this.expenseTracker,
            taxOptimizer: this.taxOptimizer,
            reportGenerator: this.reportGenerator
        });
    }

    async initialize() {
        await this.db.initialize();
        return this;
    }

    // Main CLI entry point
    async handleCommand(args) {
        return await this.cliHandler.handle(args);
    }

    // Programmatic API
    async addExpense(expenseData) {
        return await this.expenseTracker.addExpense(expenseData);
    }

    async categorizeExpense(expenseId, category) {
        return await this.expenseTracker.categorizeExpense(expenseId, category);
    }

    async calculateTaxOptimization(options) {
        return await this.taxOptimizer.optimize(options);
    }

    async generateReport(reportType, period, options = {}) {
        return await this.reportGenerator.generate(reportType, period, options);
    }

    async getExpenses(filter = {}) {
        return await this.expenseTracker.getExpenses(filter);
    }

    async getTaxDeductions(year) {
        return await this.taxOptimizer.getDeductions(year);
    }

    async estimateQuarterlyTax(quarter, income) {
        return await this.taxOptimizer.estimateQuarterly(quarter, income);
    }
}

// CLI Entry Point
if (require.main === module) {
    const args = process.argv.slice(2);
    
    (async () => {
        try {
            const manager = await new TaxExpenseManager().initialize();
            const result = await manager.handleCommand(args);
            
            if (result) {
                console.log(JSON.stringify(result, null, 2));
            }
        } catch (error) {
            console.error('Error:', error.message);
            if (process.env.NODE_ENV === 'development') {
                console.error(error.stack);
            }
            process.exit(1);
        }
    })();
}

module.exports = { TaxExpenseManager };