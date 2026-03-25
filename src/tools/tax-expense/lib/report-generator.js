/**
 * Financial Report Generator for Tax and Expense Analysis
 * 
 * Features:
 * - Monthly P&L statements
 * - Quarterly tax summaries
 * - Annual tax preparation reports
 * - Expense category breakdowns with trends
 * - Tax savings opportunity reports
 */

class ReportGenerator {
    constructor(database) {
        this.db = database;
    }

    async generate(reportType, period, options = {}) {
        const reportTypes = {
            'pnl': this.generateProfitLoss.bind(this),
            'tax_summary': this.generateTaxSummary.bind(this),
            'expense_breakdown': this.generateExpenseBreakdown.bind(this),
            'tax_prep': this.generateTaxPrep.bind(this),
            'savings_opportunities': this.generateSavingsOpportunities.bind(this),
            'quarterly': this.generateQuarterlyReport.bind(this),
            'annual': this.generateAnnualReport.bind(this),
            'trends': this.generateTrendsReport.bind(this)
        };

        const generator = reportTypes[reportType];
        if (!generator) {
            throw new Error(`Unsupported report type: ${reportType}`);
        }

        return await generator(period, options);
    }

    async generateProfitLoss(period, options = {}) {
        const { year, month, quarter } = this.parsePeriod(period);
        const { includeProjections = false, format = 'json' } = options;

        // Get revenue data (from project/client tracking)
        const revenue = await this.getRevenueData(year, month, quarter);
        
        // Get expense data
        const expenses = await this.getExpenseData(year, month, quarter);

        // Calculate P&L metrics
        const grossRevenue = revenue.total;
        const totalExpenses = expenses.total;
        const netIncome = grossRevenue - totalExpenses;
        const profitMargin = grossRevenue > 0 ? (netIncome / grossRevenue) * 100 : 0;

        const report = {
            title: `Profit & Loss Statement - ${this.formatPeriodTitle(period)}`,
            generated: new Date().toISOString(),
            period: { year, month, quarter },
            summary: {
                grossRevenue,
                totalExpenses,
                netIncome,
                profitMargin: parseFloat(profitMargin.toFixed(2))
            },
            revenue: {
                total: revenue.total,
                breakdown: revenue.breakdown,
                growth: revenue.growth
            },
            expenses: {
                total: expenses.total,
                breakdown: expenses.breakdown,
                trends: expenses.trends
            },
            metrics: {
                revenuePerDay: grossRevenue / this.getDaysInPeriod(year, month, quarter),
                expenseRatio: grossRevenue > 0 ? (totalExpenses / grossRevenue) * 100 : 0,
                averageProjectValue: revenue.averageProjectValue || 0
            }
        };

        if (includeProjections) {
            report.projections = await this.generateProjections(report);
        }

        return this.formatReport(report, format);
    }

    async generateTaxSummary(period, options = {}) {
        const { year, quarter } = this.parsePeriod(period);
        const { filingStatus = 'single', businessStructure = 'sole_proprietorship' } = options;

        // Get business income and expenses
        const income = await this.getBusinessIncome(year, quarter);
        const expenses = await this.getBusinessExpenses(year, quarter);
        
        // Calculate deductions by category
        const deductions = this.calculateDeductionsByCategory(expenses);
        const totalDeductions = Object.values(deductions).reduce((sum, cat) => sum + cat.deductibleAmount, 0);

        // Calculate estimated taxes
        const taxCalculator = new (require('./tax-optimizer')).TaxOptimizer(this.db);
        const taxLiability = taxCalculator.calculateTaxLiability({
            income: income.total,
            deductions: totalDeductions,
            filingStatus,
            businessStructure
        });

        return {
            title: `Tax Summary - ${this.formatPeriodTitle(period)}`,
            generated: new Date().toISOString(),
            period: { year, quarter },
            income: {
                total: income.total,
                breakdown: income.breakdown
            },
            deductions: {
                total: totalDeductions,
                categories: deductions
            },
            taxLiability: {
                taxableIncome: taxLiability.taxableIncome,
                incomeTax: taxLiability.incomeTax,
                selfEmploymentTax: taxLiability.selfEmploymentTax,
                totalTax: taxLiability.total,
                effectiveRate: (taxLiability.total / income.total * 100).toFixed(2) + '%'
            },
            quarterlyPayments: this.calculateQuarterlyPayments(taxLiability.total),
            recommendations: await this.getTaxRecommendations(income.total, totalDeductions)
        };
    }

    async generateExpenseBreakdown(period, options = {}) {
        const { year, month, quarter } = this.parsePeriod(period);
        const { groupBy = 'category', includeTrends = true } = options;

        const expenses = await this.db.getExpenses({
            year,
            month,
            quarter,
            isBusinessExpense: true
        });

        const breakdown = this.groupExpenses(expenses, groupBy);
        let trends = {};

        if (includeTrends) {
            trends = await this.calculateExpenseTrends(breakdown, year, month, quarter);
        }

        return {
            title: `Expense Breakdown - ${this.formatPeriodTitle(period)}`,
            generated: new Date().toISOString(),
            period: { year, month, quarter },
            summary: {
                totalExpenses: expenses.length,
                totalAmount: expenses.reduce((sum, e) => sum + e.usdAmount, 0),
                averageExpense: expenses.length > 0 ? expenses.reduce((sum, e) => sum + e.usdAmount, 0) / expenses.length : 0
            },
            breakdown,
            trends,
            insights: this.generateExpenseInsights(breakdown, trends)
        };
    }

    async generateTaxPrep(period, options = {}) {
        const { year } = this.parsePeriod(period);
        
        // Get all data needed for tax preparation
        const income = await this.getBusinessIncome(year);
        const expenses = await this.getBusinessExpenses(year);
        const equipment = await this.db.getEquipment(year);
        const homeOffice = await this.db.getHomeOfficeData(year);
        
        // Organize by tax form sections
        const scheduleC = this.generateScheduleC(income, expenses);
        const form4562 = this.generateForm4562(equipment); // Depreciation
        const form8829 = homeOffice ? this.generateForm8829(homeOffice) : null; // Home office

        return {
            title: `Tax Preparation Report - ${year}`,
            generated: new Date().toISOString(),
            taxYear: year,
            scheduleC,
            form4562,
            form8829,
            documentation: {
                requiredDocuments: this.getRequiredDocuments(expenses),
                missingDocuments: this.getMissingDocuments(expenses),
                auditDefense: this.getAuditDefenseStrategy(expenses)
            },
            estimatedRefund: await this.calculateEstimatedRefund(year),
            recommendations: this.getTaxPrepRecommendations()
        };
    }

    async generateSavingsOpportunities(period, options = {}) {
        const { year } = this.parsePeriod(period);
        const { minSavings = 100 } = options;

        const opportunities = [];

        // Analyze expense patterns for optimization
        const expenseOpportunities = await this.analyzeExpenseOptimization(year);
        opportunities.push(...expenseOpportunities);

        // Check for missed deductions
        const deductionOpportunities = await this.analyzeMissedDeductions(year);
        opportunities.push(...deductionOpportunities);

        // Business structure optimization
        const income = await this.getBusinessIncome(year);
        if (income.total > 50000) {
            const structureOpportunities = this.analyzeBusinessStructure(income.total);
            opportunities.push(...structureOpportunities);
        }

        // Retirement planning opportunities
        const retirementOpportunities = this.analyzeRetirementOpportunities(income.total);
        opportunities.push(...retirementOpportunities);

        // Filter by minimum savings threshold
        const filteredOpportunities = opportunities.filter(op => op.estimatedSavings >= minSavings);

        return {
            title: `Tax Savings Opportunities - ${year}`,
            generated: new Date().toISOString(),
            year,
            totalPotentialSavings: filteredOpportunities.reduce((sum, op) => sum + op.estimatedSavings, 0),
            opportunities: filteredOpportunities.sort((a, b) => b.estimatedSavings - a.estimatedSavings),
            actionPlan: this.createActionPlan(filteredOpportunities)
        };
    }

    async generateQuarterlyReport(period, options = {}) {
        const { year, quarter } = this.parsePeriod(period);
        
        // Combine multiple report types for comprehensive quarterly view
        const pnl = await this.generateProfitLoss(period, options);
        const taxSummary = await this.generateTaxSummary(period, options);
        const expenseBreakdown = await this.generateExpenseBreakdown(period, { ...options, includeTrends: true });

        return {
            title: `Quarterly Business Report - Q${quarter} ${year}`,
            generated: new Date().toISOString(),
            period: { year, quarter },
            executiveSummary: {
                revenue: pnl.revenue.total,
                expenses: pnl.expenses.total,
                netIncome: pnl.summary.netIncome,
                estimatedTax: taxSummary.taxLiability.totalTax,
                profitMargin: pnl.summary.profitMargin
            },
            profitLoss: pnl,
            taxSummary,
            expenseAnalysis: expenseBreakdown,
            quarterlyComparison: await this.generateQuarterlyComparison(year, quarter),
            nextQuarterProjections: await this.generateNextQuarterProjections(year, quarter)
        };
    }

    async generateAnnualReport(period, options = {}) {
        const { year } = this.parsePeriod(period);
        
        const annualPnL = await this.generateProfitLoss(period, options);
        const taxPrep = await this.generateTaxPrep(period, options);
        const savingsOpportunities = await this.generateSavingsOpportunities(period, options);
        
        // Generate quarterly breakdown
        const quarterlyBreakdown = {};
        for (let q = 1; q <= 4; q++) {
            quarterlyBreakdown[`Q${q}`] = await this.generateQuarterlyReport(`Q${q}-${year}`, options);
        }

        return {
            title: `Annual Business Report - ${year}`,
            generated: new Date().toISOString(),
            year,
            executiveSummary: {
                totalRevenue: annualPnL.revenue.total,
                totalExpenses: annualPnL.expenses.total,
                netIncome: annualPnL.summary.netIncome,
                totalTaxLiability: taxPrep.estimatedRefund.totalTax,
                effectiveTaxRate: ((taxPrep.estimatedRefund.totalTax / annualPnL.revenue.total) * 100).toFixed(2) + '%'
            },
            annualProfitLoss: annualPnL,
            taxPreparation: taxPrep,
            savingsOpportunities,
            quarterlyBreakdown,
            yearOverYearComparison: await this.generateYearOverYearComparison(year),
            nextYearPlan: await this.generateNextYearPlan(year)
        };
    }

    // Helper methods

    parsePeriod(period) {
        // Convert to string and handle different formats
        const periodStr = String(period);
        const parts = periodStr.split('-');
        let year, month, quarter;

        if (parts.length === 1) {
            // Just year: "2024"
            year = parseInt(parts[0]);
        } else if (parts[0].startsWith('Q')) {
            // Quarter: "Q1-2024"
            quarter = parseInt(parts[0].substring(1));
            year = parseInt(parts[1]);
        } else if (parts.length === 2) {
            // Month: "03-2024" or "March-2024"
            month = isNaN(parts[0]) ? this.monthNameToNumber(parts[0]) : parseInt(parts[0]);
            year = parseInt(parts[1]);
        }

        return { year, month, quarter };
    }

    monthNameToNumber(monthName) {
        const months = {
            'january': 1, 'february': 2, 'march': 3, 'april': 4,
            'may': 5, 'june': 6, 'july': 7, 'august': 8,
            'september': 9, 'october': 10, 'november': 11, 'december': 12
        };
        return months[monthName.toLowerCase()] || null;
    }

    formatPeriodTitle(period) {
        const { year, month, quarter } = this.parsePeriod(period);
        
        if (quarter) return `Q${quarter} ${year}`;
        if (month) return `${this.getMonthName(month)} ${year}`;
        return year.toString();
    }

    getMonthName(monthNumber) {
        const names = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        return names[monthNumber - 1];
    }

    async getRevenueData(year, month, quarter) {
        // In a real implementation, this would query project/invoice data
        // For now, return mock data structure
        return {
            total: 15000,
            breakdown: {
                'Project A': 8000,
                'Project B': 4500,
                'Retainer Client': 2500
            },
            growth: 15.5, // % growth from previous period
            averageProjectValue: 5000
        };
    }

    async getExpenseData(year, month, quarter) {
        const expenses = await this.db.getExpenses({
            year,
            month,
            quarter,
            isBusinessExpense: true
        });

        const breakdown = this.groupExpenses(expenses, 'category');
        const total = expenses.reduce((sum, e) => sum + e.usdAmount, 0);

        return {
            total,
            breakdown,
            trends: await this.calculateExpenseTrends(breakdown, year, month, quarter)
        };
    }

    async getBusinessIncome(year, quarter = null) {
        // This would integrate with project tracking / invoicing system
        // Mock implementation
        return {
            total: quarter ? 20000 : 80000,
            breakdown: {
                'Client Projects': quarter ? 15000 : 60000,
                'Retainers': quarter ? 3000 : 12000,
                'Other Income': quarter ? 2000 : 8000
            }
        };
    }

    async getBusinessExpenses(year, quarter = null) {
        return await this.db.getExpenses({
            year,
            quarter,
            isBusinessExpense: true
        });
    }

    groupExpenses(expenses, groupBy) {
        const grouped = {};
        
        for (const expense of expenses) {
            const key = groupBy === 'category' ? expense.category : 
                       groupBy === 'vendor' ? expense.vendor :
                       groupBy === 'month' ? new Date(expense.date).getMonth() + 1 :
                       'other';
            
            if (!grouped[key]) {
                grouped[key] = {
                    count: 0,
                    total: 0,
                    expenses: []
                };
            }
            
            grouped[key].count++;
            grouped[key].total += expense.usdAmount;
            grouped[key].expenses.push(expense);
        }
        
        return grouped;
    }

    calculateDeductionsByCategory(expenses) {
        const deductions = {};
        const businessDeductions = {
            SOFTWARE: { category: 'software', percentage: 100 },
            HARDWARE: { category: 'hardware', percentage: 100 },
            OFFICE: { category: 'office', percentage: 100 },
            PROFESSIONAL_SERVICES: { category: 'professional_services', percentage: 100 },
            EDUCATION: { category: 'education', percentage: 100 },
            MARKETING: { category: 'marketing', percentage: 100 },
            TRAVEL: { category: 'travel', percentage: 100 },
            MEALS: { category: 'meals', percentage: 50 },
            INTERNET: { category: 'internet', percentage: 100 },
            PHONE: { category: 'phone', percentage: 30 }
        };

        for (const expense of expenses) {
            const category = expense.category;
            const deductionInfo = businessDeductions[category.toUpperCase()];
            
            if (!deductions[category]) {
                deductions[category] = {
                    totalAmount: 0,
                    deductibleAmount: 0,
                    count: 0,
                    deductionPercentage: deductionInfo?.percentage || 100
                };
            }
            
            const deductibleAmount = deductionInfo 
                ? expense.usdAmount * (deductionInfo.percentage / 100)
                : expense.usdAmount;
            
            deductions[category].totalAmount += expense.usdAmount;
            deductions[category].deductibleAmount += deductibleAmount;
            deductions[category].count++;
        }
        
        return deductions;
    }

    formatReport(report, format) {
        if (format === 'csv') {
            return this.convertToCSV(report);
        } else if (format === 'text') {
            return this.convertToText(report);
        }
        return report; // Default JSON format
    }

    convertToCSV(report) {
        // Simplified CSV conversion for expense breakdowns
        if (report.breakdown) {
            let csv = 'Category,Count,Total Amount\n';
            for (const [category, data] of Object.entries(report.breakdown)) {
                csv += `${category},${data.count},${data.total}\n`;
            }
            return csv;
        }
        return JSON.stringify(report);
    }

    convertToText(report) {
        // Simplified text format
        let text = `${report.title}\n`;
        text += `Generated: ${new Date(report.generated).toLocaleDateString()}\n\n`;
        
        if (report.summary) {
            text += 'SUMMARY:\n';
            for (const [key, value] of Object.entries(report.summary)) {
                text += `${key}: ${typeof value === 'number' ? '$' + value.toFixed(2) : value}\n`;
            }
        }
        
        return text;
    }

    getDaysInPeriod(year, month, quarter) {
        if (month) {
            return new Date(year, month, 0).getDate();
        } else if (quarter) {
            const quarterMonths = [3, 6, 9, 12];
            const endMonth = quarterMonths[quarter - 1];
            const startMonth = endMonth - 2;
            let days = 0;
            for (let m = startMonth; m <= endMonth; m++) {
                days += new Date(year, m, 0).getDate();
            }
            return days;
        } else {
            // Full year
            return (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 366 : 365;
        }
    }

    // Additional helper methods
    
    async generateTrendsReport(period, options = {}) {
        // Placeholder implementation
        return {
            title: `Trends Report - ${period}`,
            message: 'Trends analysis coming soon'
        };
    }

    async generateQuarterlyComparison(year, quarter) {
        // Placeholder implementation
        return {
            message: 'Quarterly comparison coming soon'
        };
    }

    async generateNextQuarterProjections(year, quarter) {
        // Placeholder implementation
        return {
            message: 'Next quarter projections coming soon'
        };
    }

    async generateYearOverYearComparison(year) {
        // Placeholder implementation
        return {
            message: 'Year-over-year comparison coming soon'
        };
    }

    async generateNextYearPlan(year) {
        // Placeholder implementation
        return {
            message: 'Next year plan coming soon'
        };
    }

    async calculateExpenseTrends(breakdown, year, month, quarter) {
        // Placeholder implementation
        return {
            message: 'Expense trends calculation coming soon'
        };
    }

    generateExpenseInsights(breakdown, trends) {
        // Placeholder implementation
        return [
            'Insight: Track software subscriptions for potential savings',
            'Insight: Consider bundling services to reduce costs'
        ];
    }

    async generateProjections(report) {
        // Placeholder implementation
        return {
            message: 'Financial projections coming soon'
        };
    }

    calculateQuarterlyPayments(totalTax) {
        return totalTax / 4;
    }

    async getTaxRecommendations(income, totalDeductions) {
        return [
            'Consider maximizing retirement contributions',
            'Review quarterly payment schedule',
            'Document all business expenses'
        ];
    }

    getRequiredDocuments(expenses) {
        return [
            'Business receipts and invoices',
            'Bank and credit card statements',
            'Mileage logs for vehicle expenses',
            'Home office documentation'
        ];
    }

    getMissingDocuments(expenses) {
        const undocumented = expenses.filter(e => !e.receiptPath);
        return undocumented.map(e => ({
            expense: `${e.vendor} - $${e.amount}`,
            date: e.date,
            category: e.category
        }));
    }

    getAuditDefenseStrategy(expenses) {
        return {
            documentation: 'Maintain organized records',
            substantiation: 'Keep receipts and business purpose notes',
            separation: 'Clearly separate business and personal expenses'
        };
    }

    async calculateEstimatedRefund(year) {
        return {
            message: 'Tax refund calculation coming soon'
        };
    }

    getTaxPrepRecommendations() {
        return [
            'Review all deductions for accuracy',
            'Consider professional tax preparation',
            'Plan estimated payments for next year'
        ];
    }
}

module.exports = { ReportGenerator };