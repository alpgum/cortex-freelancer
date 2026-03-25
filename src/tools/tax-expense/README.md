# Tax Optimization & Expense Tracking Module

Comprehensive tax planning, expense management, and financial reporting for freelance professionals.

## Features

### 🧾 Expense Tracker
- **Smart Categorization**: Auto-categorize expenses using ML-powered pattern recognition
- **Receipt Management**: OCR data extraction and secure receipt storage
- **Multi-Currency Support**: Real-time currency conversion with historical rates
- **Recurring Detection**: Automatically identify and track recurring expenses
- **Business Classification**: AI-powered business vs personal expense classification

### 🎯 Tax Optimization Engine
- **Deduction Maximization**: Identify and optimize all available business deductions
- **Quarterly Estimates**: Accurate estimated tax calculations with safe harbor provisions
- **Tax Bracket Analysis**: Optimize income timing across tax brackets
- **Business Structure Advice**: LLC vs S-Corp recommendations with savings projections
- **Year-End Planning**: Strategic tax planning suggestions

### 📊 Financial Reports
- **P&L Statements**: Monthly, quarterly, and annual profit & loss reports
- **Tax Summaries**: Comprehensive tax preparation reports
- **Expense Analytics**: Category breakdowns with trend analysis
- **Savings Opportunities**: Actionable tax optimization recommendations

### 🏠 Smart Features
- **Home Office Calculator**: Both simplified and actual expense methods
- **Mileage Tracking**: IRS-compliant business travel deduction tracking
- **Equipment Depreciation**: Section 179 and traditional depreciation schedules
- **Tax Calendar**: Automated deadline reminders and quarterly payment schedules

## Installation

The module is part of the Cortex Freelancer project. No separate installation required.

```bash
# Navigate to the project root
cd ~/.openclaw/workspace/projects/cortex-freelancer

# The module is available at
node src/tools/tax-expense/index.js
```

## CLI Usage

### Expense Management

```bash
# Add a new expense
tax expense add --amount 49.99 --vendor "GitHub" --category software --description "Pro subscription"

# List expenses with filters
tax expense list --year 2024 --category software
tax expense list --vendor "GitHub" --format table

# Update expense category
tax expense categorize --id exp_abc123 --category marketing

# Import from CSV/JSON
tax expense import --file expenses.csv --format csv
```

### Tax Optimization

```bash
# Optimize tax strategy
tax optimize --income 120000 --filing single --structure sole_proprietorship

# Calculate quarterly estimated taxes
tax estimate --quarter Q2 --income 30000

# List available deductions
tax deductions --list --year 2024
```

### Reports

```bash
# Generate P&L report
tax report --type pnl --period Q1-2024 --format json

# Tax summary for the year
tax report --type tax_summary --period 2024

# Expense breakdown by category
tax report --type expense_breakdown --period 03-2024 --format csv

# Annual tax preparation report
tax report --type tax_prep --period 2024

# Identify savings opportunities
tax report --type savings_opportunities --period 2024 --min-savings 500
```

## API Usage

### Programmatic Interface

```javascript
const { TaxExpenseManager } = require('./src/tools/tax-expense');

async function example() {
    // Initialize the manager
    const manager = await new TaxExpenseManager().initialize();

    // Add an expense
    const expense = await manager.addExpense({
        amount: 49.99,
        vendor: 'GitHub',
        category: 'software',
        description: 'Pro subscription',
        receiptPath: './receipts/github-receipt.pdf'
    });

    // Get tax optimization suggestions
    const optimization = await manager.calculateTaxOptimization({
        annualIncome: 85000,
        filingStatus: 'single'
    });

    // Generate a report
    const report = await manager.generateReport('pnl', 'Q1-2024', {
        format: 'json',
        includeProjections: true
    });

    console.log('P&L Report:', report);
}
```

### Expense Categories

The system automatically categorizes expenses into these business categories:

- **Software**: SaaS subscriptions, development tools, productivity apps
- **Hardware**: Computers, monitors, cameras, office equipment
- **Office**: Rent, coworking, furniture, supplies
- **Travel**: Flights, hotels, gas, mileage, parking
- **Education**: Courses, books, conferences, certifications
- **Marketing**: Ads, social media, promotional materials
- **Professional Services**: Legal, accounting, consulting
- **Utilities**: Internet, phone, electricity (business portion)
- **Insurance**: Business liability, E&O, health (if self-employed)

### Deduction Rules

The system applies IRS deduction rules automatically:

| Category | Deductible % | Notes |
|----------|--------------|--------|
| Software | 100% | Business use required |
| Hardware | 100% | Section 179 or depreciation |
| Office Supplies | 100% | Business use only |
| Travel | 100% | Business purpose required |
| Meals | 50% | Business meals only |
| Home Office | Variable | Simplified or actual method |
| Vehicle | Variable | Business miles only |

## Home Office Deduction

### Simplified Method
- $5 per square foot up to 300 sq ft
- Maximum deduction: $1,500
- No depreciation recapture

### Actual Method
- Percentage of total home expenses
- Higher potential deduction
- Requires detailed record keeping

```javascript
// Calculate home office deduction
const homeOfficeDeduction = await manager.expenseTracker.calculateHomeOfficeDeduction({
    totalHomeSquareFootage: 2000,
    officeSquareFootage: 200,
    annualHomeExpenses: 15000,
    method: 'actual' // or 'simplified'
});

console.log('Annual Deduction:', homeOfficeDeduction.deduction);
```

## Equipment Depreciation

Track business equipment for tax purposes:

```javascript
// Track equipment purchase
const equipment = await manager.expenseTracker.trackDepreciation({
    name: 'MacBook Pro',
    purchaseDate: '2024-01-15',
    cost: 2500,
    businessUsePercentage: 100,
    usefulLifeYears: 5
});

console.log('Annual Depreciation:', equipment.annualDepreciation);
```

## Tax Strategies

### Retirement Contributions

The system recommends retirement contributions based on income and tax situation:

- **SEP-IRA**: Up to 25% of net self-employment earnings
- **Solo 401(k)**: Higher contribution limits
- **Traditional vs Roth**: Tax-deferred vs tax-free growth

### Business Structure Optimization

Recommendations based on income thresholds:

| Income Level | Recommendation | Potential Savings |
|--------------|----------------|-------------------|
| < $50K | Sole Proprietorship | Baseline |
| $50K - $80K | Consider LLC | Liability protection |
| > $80K | S-Corp Election | SE tax savings |

### Year-End Tax Planning

Strategic moves to optimize taxes before year-end:

1. **Equipment Purchases**: Section 179 deduction
2. **Retirement Contributions**: Deadline extensions
3. **Income Deferral**: Invoice timing strategies
4. **Expense Acceleration**: Prepay business expenses

## Data Storage

The system uses a file-based database for simplicity and portability:

```
~/.cortex-freelancer/tax-expense/
├── expenses.json          # All expense records
├── equipment.json         # Equipment depreciation schedules
├── recurring.json         # Recurring expense patterns
├── home-office.json       # Home office deduction data
└── settings.json          # User preferences and settings
```

### Data Export/Import

```bash
# Export all data
tax data export --file backup-2024.json

# Import from backup
tax data import --file backup-2024.json

# Database maintenance
tax data vacuum  # Clean up and optimize
tax data stats   # Storage statistics
```

## Testing

Run the comprehensive test suite:

```bash
# Run all tests
npm test

# Run specific test suites
npm test -- --testNamePattern="ExpenseTracker"
npm test -- --testNamePattern="TaxOptimizer"
npm test -- --testNamePattern="CLIHandler"

# Test coverage
npm run test:coverage
```

Test coverage includes:
- ✅ Expense tracking and categorization
- ✅ Tax calculations across all brackets
- ✅ CLI command parsing and validation
- ✅ Database operations and data integrity
- ✅ Report generation and formatting
- ✅ Integration workflows

## Security & Privacy

- **Local Storage**: All data remains on your machine
- **No External APIs**: Core functionality works offline
- **Receipt Security**: Secure file storage with access controls
- **Data Encryption**: Sensitive data encrypted at rest
- **Audit Trail**: Complete change history for tax compliance

## Tax Compliance

The system follows IRS guidelines and best practices:

- **Record Keeping**: 7-year retention recommendations
- **Receipt Requirements**: Digital receipts accepted by IRS
- **Audit Defense**: Detailed documentation for all deductions
- **Professional Review**: Reports suitable for CPA review

## Support

For issues or feature requests:

1. Check the test files for usage examples
2. Review the CLI help: `tax help`
3. Examine the generated reports for data format
4. Consult IRS publications for tax law updates

## Legal Disclaimer

This tool provides tax guidance based on general IRS rules. Always consult with a qualified tax professional for your specific situation. The authors are not responsible for tax compliance or audit outcomes.

## Changelog

### v1.0.0 (CFX-062)
- ✅ Complete expense tracking system
- ✅ Tax optimization engine
- ✅ Comprehensive reporting
- ✅ CLI interface with all commands
- ✅ Full test coverage
- ✅ Home office and depreciation calculators
- ✅ Multi-currency support
- ✅ Recurring expense detection