/**
 * Smart Tax Optimization Engine for Freelancers
 * 
 * Features:
 * - Deduction identification and maximization
 * - Quarterly estimated tax calculation
 * - Tax bracket optimization strategies
 * - Business structure recommendations
 * - Year-end tax planning suggestions
 */

class TaxOptimizer {
    constructor(database) {
        this.db = database;
        
        // 2024 Tax brackets (single filers)
        this.taxBrackets2024 = [
            { min: 0, max: 11600, rate: 0.10 },
            { min: 11600, max: 47150, rate: 0.12 },
            { min: 47150, max: 100525, rate: 0.22 },
            { min: 100525, max: 191675, rate: 0.24 },
            { min: 191675, max: 243725, rate: 0.32 },
            { min: 243725, max: 609350, rate: 0.35 },
            { min: 609350, max: Infinity, rate: 0.37 }
        ];

        // Self-employment tax rates
        this.selfEmploymentTax = {
            socialSecurity: 0.124, // 12.4%
            medicare: 0.029, // 2.9%
            additionalMedicare: 0.009, // 0.9% on income over $200K
            additionalMedicareThreshold: 200000
        };

        // Standard deductions for 2024
        this.standardDeductions2024 = {
            single: 14600,
            marriedFilingJointly: 29200,
            marriedFilingSeparately: 14600,
            headOfHousehold: 21900
        };

        // Common business deductions
        this.businessDeductions = {
            SOFTWARE: { category: 'software', percentage: 100 },
            HARDWARE: { category: 'hardware', percentage: 100 },
            OFFICE_SUPPLIES: { category: 'office', percentage: 100 },
            PROFESSIONAL_SERVICES: { category: 'professional_services', percentage: 100 },
            EDUCATION: { category: 'education', percentage: 100 },
            MARKETING: { category: 'marketing', percentage: 100 },
            TRAVEL: { category: 'travel', percentage: 100 },
            MEALS: { category: 'meals', percentage: 50 }, // Only 50% deductible
            INTERNET: { category: 'internet', percentage: 100 },
            PHONE: { category: 'phone', percentage: 30 }, // Typical business use %
            INSURANCE: { category: 'insurance', percentage: 100 }
        };
    }

    async optimize(options) {
        const {
            annualIncome,
            filingStatus = 'single',
            state = 'federal_only',
            currentYear = new Date().getFullYear(),
            businessStructure = 'sole_proprietorship'
        } = options;

        // Get all business expenses for the year
        const expenses = await this.getBusinessExpenses(currentYear);
        const totalDeductions = this.calculateTotalDeductions(expenses);

        // Calculate current tax liability
        const currentTax = this.calculateTaxLiability({
            income: annualIncome,
            deductions: totalDeductions,
            filingStatus,
            businessStructure
        });

        // Generate optimization strategies
        const strategies = await this.generateOptimizationStrategies({
            income: annualIncome,
            expenses,
            currentTax,
            filingStatus,
            businessStructure
        });

        // Business structure recommendations
        const structureAdvice = this.getBusinessStructureAdvice(annualIncome, currentTax);

        return {
            summary: {
                annualIncome,
                totalDeductions,
                taxableIncome: annualIncome - totalDeductions,
                estimatedTax: currentTax.total,
                effectiveTaxRate: (currentTax.total / annualIncome * 100).toFixed(2) + '%'
            },
            breakdown: currentTax,
            strategies,
            structureAdvice,
            nextSteps: this.getNextSteps(strategies)
        };
    }

    async getBusinessExpenses(year) {
        return await this.db.getExpenses({
            year,
            isBusinessExpense: true
        });
    }

    calculateTotalDeductions(expenses) {
        let total = 0;
        
        for (const expense of expenses) {
            const deductionInfo = this.businessDeductions[expense.category.toUpperCase()];
            if (deductionInfo) {
                total += expense.usdAmount * (deductionInfo.percentage / 100);
            }
        }

        return total;
    }

    calculateTaxLiability(options) {
        const { income, deductions, filingStatus, businessStructure } = options;
        
        // Calculate self-employment tax (for sole proprietors)
        const selfEmploymentTax = businessStructure === 'sole_proprietorship' 
            ? this.calculateSelfEmploymentTax(income)
            : 0;

        // Calculate income tax
        const standardDeduction = this.standardDeductions2024[filingStatus] || this.standardDeductions2024.single;
        const totalDeductions = Math.max(deductions, standardDeduction);
        const taxableIncome = Math.max(0, income - totalDeductions);
        
        const incomeTax = this.calculateIncomeTax(taxableIncome);

        return {
            grossIncome: income,
            businessDeductions: deductions,
            standardDeduction: standardDeduction,
            totalDeductions,
            taxableIncome,
            incomeTax,
            selfEmploymentTax,
            total: incomeTax + selfEmploymentTax
        };
    }

    calculateSelfEmploymentTax(income) {
        const netEarnings = income * 0.9235; // 92.35% of net profit
        
        let seTax = 0;
        
        // Social Security tax (up to wage base)
        const ssWageBase = 160200; // 2024 limit
        const ssIncome = Math.min(netEarnings, ssWageBase);
        seTax += ssIncome * this.selfEmploymentTax.socialSecurity;
        
        // Medicare tax
        seTax += netEarnings * this.selfEmploymentTax.medicare;
        
        // Additional Medicare tax (over $200K)
        if (netEarnings > this.selfEmploymentTax.additionalMedicareThreshold) {
            const additionalMedicareIncome = netEarnings - this.selfEmploymentTax.additionalMedicareThreshold;
            seTax += additionalMedicareIncome * this.selfEmploymentTax.additionalMedicare;
        }

        return seTax;
    }

    calculateIncomeTax(taxableIncome) {
        let tax = 0;
        let remainingIncome = taxableIncome;

        for (const bracket of this.taxBrackets2024) {
            if (remainingIncome <= 0) break;

            const taxableInThisBracket = Math.min(remainingIncome, bracket.max - bracket.min);
            tax += taxableInThisBracket * bracket.rate;
            remainingIncome -= taxableInThisBracket;
        }

        return tax;
    }

    async generateOptimizationStrategies(options) {
        const { income, expenses, currentTax } = options;
        const strategies = [];

        // Strategy 1: Maximize business deductions
        const deductionStrategy = await this.analyzeDeductionOpportunities(expenses);
        if (deductionStrategy.potentialSavings > 0) {
            strategies.push(deductionStrategy);
        }

        // Strategy 2: Retirement contributions
        const retirementStrategy = this.calculateRetirementStrategy(income, currentTax);
        if (retirementStrategy.recommendedContribution > 0) {
            strategies.push(retirementStrategy);
        }

        // Strategy 3: Equipment purchases for Section 179 deduction
        const equipmentStrategy = this.calculateEquipmentStrategy(income);
        if (equipmentStrategy.recommendedPurchase > 0) {
            strategies.push(equipmentStrategy);
        }

        // Strategy 4: Health Savings Account
        const hsaStrategy = this.calculateHSAStrategy(income);
        strategies.push(hsaStrategy);

        // Strategy 5: Quarterly payment optimization
        const quarterlyStrategy = this.calculateQuarterlyStrategy(currentTax);
        strategies.push(quarterlyStrategy);

        return strategies.sort((a, b) => b.potentialSavings - a.potentialSavings);
    }

    async analyzeDeductionOpportunities(expenses) {
        const expensesByCategory = this.groupExpensesByCategory(expenses);
        const opportunities = [];
        let totalPotentialSavings = 0;

        // Check for missing receipt documentation
        const undocumentedExpenses = expenses.filter(e => !e.receiptPath);
        if (undocumentedExpenses.length > 0) {
            const undocumentedAmount = undocumentedExpenses.reduce((sum, e) => sum + e.usdAmount, 0);
            opportunities.push({
                type: 'documentation',
                description: 'Obtain receipts for undocumented expenses',
                amount: undocumentedAmount,
                risk: 'high',
                action: 'Collect and upload receipts'
            });
        }

        // Check for potentially missed deductions
        const currentExpenses = Object.keys(expensesByCategory);
        const suggestedCategories = [
            'software', 'hardware', 'education', 'marketing', 'professional_services'
        ];

        for (const category of suggestedCategories) {
            if (!currentExpenses.includes(category)) {
                opportunities.push({
                    type: 'missing_category',
                    description: `Consider tracking ${category} expenses`,
                    estimatedAnnualAmount: this.getTypicalExpenseAmount(category),
                    taxSavings: this.getTypicalExpenseAmount(category) * 0.3,
                    action: `Review ${category} purchases and subscriptions`
                });
                totalPotentialSavings += this.getTypicalExpenseAmount(category) * 0.3;
            }
        }

        return {
            name: 'Maximize Business Deductions',
            type: 'deductions',
            potentialSavings: totalPotentialSavings,
            timeframe: 'immediate',
            difficulty: 'low',
            opportunities
        };
    }

    groupExpensesByCategory(expenses) {
        const grouped = {};
        for (const expense of expenses) {
            if (!grouped[expense.category]) {
                grouped[expense.category] = [];
            }
            grouped[expense.category].push(expense);
        }
        return grouped;
    }

    getTypicalExpenseAmount(category) {
        const typical = {
            software: 2000,
            hardware: 1500,
            education: 1000,
            marketing: 800,
            professional_services: 1200
        };
        return typical[category] || 500;
    }

    calculateRetirementStrategy(income, currentTax) {
        const maxSEPContribution = Math.min(income * 0.25, 69000); // 2024 limits
        const maxSimpleIRAContribution = 16000; // 2024 limit

        const currentTaxRate = currentTax.total / income;
        const sepSavings = maxSEPContribution * currentTaxRate;
        const simpleSavings = maxSimpleIRAContribution * currentTaxRate;

        return {
            name: 'Retirement Contributions',
            type: 'retirement',
            potentialSavings: Math.max(sepSavings, simpleSavings),
            timeframe: 'end_of_year',
            difficulty: 'medium',
            options: [
                {
                    type: 'SEP-IRA',
                    maxContribution: maxSEPContribution,
                    taxSavings: sepSavings,
                    description: 'Up to 25% of net self-employment earnings'
                },
                {
                    type: 'Simple IRA',
                    maxContribution: maxSimpleIRAContribution,
                    taxSavings: simpleSavings,
                    description: 'Fixed contribution limit regardless of income'
                }
            ],
            recommendedContribution: Math.min(maxSEPContribution, income * 0.15)
        };
    }

    calculateEquipmentStrategy(income) {
        const section179Limit = 1160000; // 2024 limit
        const recommendedPurchase = Math.min(section179Limit, income * 0.1);

        return {
            name: 'Equipment Purchases (Section 179)',
            type: 'equipment',
            potentialSavings: recommendedPurchase * 0.3,
            timeframe: 'end_of_year',
            difficulty: 'medium',
            recommendedPurchase,
            description: 'Deduct full cost of business equipment in year of purchase',
            suggestions: [
                'Computer/laptop upgrade',
                'Office furniture',
                'Professional software',
                'Camera/video equipment',
                'Business tools and equipment'
            ]
        };
    }

    calculateHSAStrategy(income) {
        const hsaLimit2024 = 4300; // Individual coverage
        const hsaFamilyLimit2024 = 8750; // Family coverage
        const currentTaxRate = 0.3; // Estimated combined rate

        return {
            name: 'Health Savings Account',
            type: 'hsa',
            potentialSavings: hsaLimit2024 * currentTaxRate,
            timeframe: 'ongoing',
            difficulty: 'low',
            contribution: hsaLimit2024,
            description: 'Triple tax advantage: deductible, tax-free growth, tax-free withdrawals for medical expenses',
            requirements: 'Must have High Deductible Health Plan (HDHP)'
        };
    }

    calculateQuarterlyStrategy(currentTax) {
        const annualTax = currentTax.total;
        const quarterlyPayment = annualTax / 4;
        const safeHarborAmount = currentTax.total * 1.1; // Pay 110% of current year to avoid penalties

        return {
            name: 'Quarterly Payment Optimization',
            type: 'quarterly',
            potentialSavings: annualTax * 0.05, // Avoid underpayment penalties
            timeframe: 'quarterly',
            difficulty: 'low',
            quarterlyPayment,
            safeHarborAmount: safeHarborAmount / 4,
            dueDates: this.getQuarterlyDueDates(),
            description: 'Avoid underpayment penalties with proper quarterly payments'
        };
    }

    getQuarterlyDueDates() {
        const currentYear = new Date().getFullYear();
        return [
            `Q1: April 15, ${currentYear}`,
            `Q2: June 17, ${currentYear}`,
            `Q3: September 16, ${currentYear}`,
            `Q4: January 15, ${currentYear + 1}`
        ];
    }

    getBusinessStructureAdvice(income, currentTax) {
        const advice = [];

        if (income > 50000) {
            const llcSavings = this.calculateLLCSavings(income, currentTax);
            advice.push({
                structure: 'LLC',
                threshold: 50000,
                pros: [
                    'Liability protection',
                    'Professional credibility',
                    'Easier business banking',
                    'Potential tax elections (S-Corp)'
                ],
                cons: [
                    'State filing fees',
                    'More paperwork',
                    'Annual state requirements'
                ],
                estimatedSavings: llcSavings
            });
        }

        if (income > 80000) {
            const sCorpSavings = this.calculateSCorpSavings(income, currentTax);
            advice.push({
                structure: 'S-Corporation Election',
                threshold: 80000,
                pros: [
                    'Self-employment tax savings',
                    'W-2 salary + distributions',
                    'Business expense deductions'
                ],
                cons: [
                    'Payroll requirements',
                    'More complex accounting',
                    'Reasonable salary requirements'
                ],
                estimatedSavings: sCorpSavings
            });
        }

        return advice;
    }

    calculateLLCSavings(income, currentTax) {
        // LLC itself doesn't save taxes, but enables S-Corp election
        return 0;
    }

    calculateSCorpSavings(income, currentTax) {
        // Reasonable salary requirement (typically 30-40% of income)
        const reasonableSalary = income * 0.35;
        const distributions = income - reasonableSalary;
        
        // S-Corp saves self-employment tax on distributions
        const seTaxSavings = distributions * 0.153; // 15.3% SE tax rate
        
        return seTaxSavings;
    }

    getNextSteps(strategies) {
        const steps = [];
        
        // Prioritize immediate actions
        const immediateStrategies = strategies.filter(s => s.timeframe === 'immediate');
        if (immediateStrategies.length > 0) {
            steps.push({
                priority: 'high',
                action: 'Review and implement immediate tax saving strategies',
                timeline: 'This week',
                strategies: immediateStrategies.map(s => s.name)
            });
        }

        // Year-end planning
        steps.push({
            priority: 'medium',
            action: 'Plan year-end tax moves',
            timeline: 'Before December 31',
            items: [
                'Equipment purchases',
                'Retirement contributions',
                'Expense documentation',
                'Income deferral opportunities'
            ]
        });

        // Business structure evaluation
        steps.push({
            priority: 'medium',
            action: 'Consider business structure changes',
            timeline: 'Next tax year',
            description: 'Evaluate LLC or S-Corp election for potential savings'
        });

        return steps;
    }

    async estimateQuarterly(quarter, projectedIncome) {
        const quarterMap = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 };
        const quarterNumber = quarterMap[quarter.toUpperCase()];
        
        if (!quarterNumber) {
            throw new Error('Invalid quarter. Use Q1, Q2, Q3, or Q4');
        }

        // Get YTD expenses through this quarter
        const currentYear = new Date().getFullYear();
        const quarterEndMonth = quarterNumber * 3;
        const ytdExpenses = await this.db.getExpenses({
            year: currentYear,
            endMonth: quarterEndMonth,
            isBusinessExpense: true
        });

        const ytdDeductions = this.calculateTotalDeductions(ytdExpenses);
        
        // Project annual deductions based on YTD
        const projectedAnnualDeductions = ytdDeductions * (12 / quarterEndMonth);

        // Calculate tax liability
        const taxLiability = this.calculateTaxLiability({
            income: projectedIncome,
            deductions: projectedAnnualDeductions,
            filingStatus: 'single',
            businessStructure: 'sole_proprietorship'
        });

        const quarterlyPayment = taxLiability.total / 4;
        const dueDate = this.getQuarterlyDueDate(quarter, currentYear);

        return {
            quarter,
            projectedAnnualIncome: projectedIncome,
            projectedAnnualDeductions,
            estimatedTaxLiability: taxLiability.total,
            quarterlyPayment,
            dueDate,
            breakdown: {
                incomeTax: taxLiability.incomeTax / 4,
                selfEmploymentTax: taxLiability.selfEmploymentTax / 4
            }
        };
    }

    getQuarterlyDueDate(quarter, year) {
        const dueDates = {
            Q1: `${year}-04-15`,
            Q2: `${year}-06-17`,
            Q3: `${year}-09-16`,
            Q4: `${year + 1}-01-15`
        };
        return dueDates[quarter.toUpperCase()];
    }

    async getDeductions(year) {
        const expenses = await this.getBusinessExpenses(year);
        const deductionsByCategory = {};
        let totalDeductions = 0;

        for (const expense of expenses) {
            const category = expense.category;
            if (!deductionsByCategory[category]) {
                deductionsByCategory[category] = {
                    count: 0,
                    totalAmount: 0,
                    deductibleAmount: 0,
                    expenses: []
                };
            }

            const deductionInfo = this.businessDeductions[category.toUpperCase()];
            const deductibleAmount = deductionInfo 
                ? expense.usdAmount * (deductionInfo.percentage / 100)
                : expense.usdAmount;

            deductionsByCategory[category].count++;
            deductionsByCategory[category].totalAmount += expense.usdAmount;
            deductionsByCategory[category].deductibleAmount += deductibleAmount;
            deductionsByCategory[category].expenses.push(expense);
            
            totalDeductions += deductibleAmount;
        }

        return {
            year,
            totalDeductions,
            categorizedDeductions: deductionsByCategory,
            summary: {
                totalExpenses: expenses.length,
                totalAmount: expenses.reduce((sum, e) => sum + e.usdAmount, 0),
                totalDeductibleAmount: totalDeductions
            }
        };
    }
}

module.exports = { TaxOptimizer };