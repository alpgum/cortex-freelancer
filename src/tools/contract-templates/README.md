# Contract Template System

**Legal Automation and Risk Assessment for Freelancers**

A comprehensive contract management system that helps freelancers create, analyze, and manage contracts with built-in risk assessment and legal automation.

## 🚀 Features

### 📋 Contract Templates Library
- **Fixed-price project contracts** - For defined scope projects
- **Hourly/retainer agreements** - For ongoing work relationships  
- **NDA/confidentiality agreements** - Protect sensitive information
- **Scope of work (SOW) documents** - Detailed project specifications
- **Subcontractor agreements** - When you need to delegate work

### ⚖️ Legal Clause Library
Modular clauses that can be mixed and matched:
- **Payment terms** (net-15, net-30, milestone-based)
- **IP ownership and licensing** (work-for-hire, transfer conditions)
- **Termination and cancellation** (notice periods, cause termination)
- **Liability limitations** (caps, mutual limitations)
- **Dispute resolution** (mediation, arbitration, jurisdiction)
- **Non-compete/non-solicitation** (time-limited protections)

### 🔍 Risk Assessment Engine
- **Fairness scoring** (0-100 scale)
- **Missing clause detection** 
- **One-sided term identification**
- **Protective addition suggestions**
- **Industry standard comparisons**

### 🤖 Smart Generation
- **CRM data auto-population**
- **Project type/size adjustments**
- **Currency and jurisdiction awareness**
- **Version tracking and diff comparison**

## 📦 Installation

```bash
cd src/tools/contract-templates
npm install
```

## 🛠️ Usage

### CLI Interface

```bash
# Generate a fixed-price contract
node index.js generate --type fixed-price --client "Acme Corp" --value "5000"

# Analyze a contract for risks
node index.js analyze --file contract.txt

# Compare two contract versions
node index.js compare --v1 draft1.md --v2 draft2.md

# List available clauses
node index.js clauses --list

# Add a custom clause
node index.js clauses --add payment custom-net7
```

### Programmatic API

```javascript
const ContractTemplateSystem = require('./index.js');
const system = new ContractTemplateSystem();

// Generate contract
const contract = await system.generateContract('fixed-price', {
    client: 'Acme Corporation',
    freelancer: 'John Doe',
    project: 'E-commerce Website Development',
    value: '15000',
    currency: 'USD',
    paymentTerms: 'Net 15 days',
    clauses: ['upfront-50', 'ip-transfer-on-payment']
});

// Analyze contract
const analysis = await system.analyzeContract('contract.md');
console.log(`Fairness Score: ${analysis.fairnessScore}/100`);
console.log(`Risk Factors: ${analysis.riskFactors.length}`);

// Compare versions
const comparison = await system.compareContracts('v1.md', 'v2.md');
console.log(`Changes: ${comparison.summary.totalChanges}`);
```

## 📊 Risk Assessment

The system evaluates contracts across multiple dimensions:

### Fairness Scoring (0-100)
- **0-40**: High risk, heavily favors client
- **41-70**: Moderate risk, some client bias
- **71-90**: Balanced, good protection
- **91-100**: Excellent protection

### Risk Categories
- **Payment Terms** - Late payment penalties, upfront requirements
- **IP Ownership** - Transfer conditions, payment protection
- **Termination** - Notice periods, cause requirements
- **Liability** - Limitation clauses, damage caps
- **Dispute Resolution** - Jurisdiction, arbitration clauses

### Missing Clause Detection
Automatically identifies critical missing elements:
- Payment terms and schedules
- Scope and deliverables
- Timeline and deadlines
- Revision and change procedures
- Intellectual property rights
- Termination conditions

## 📁 Template Variables

All templates support variable substitution:

| Variable | Description | Example |
|----------|-------------|---------|
| `{{CLIENT_NAME}}` | Client company/person name | "Acme Corporation" |
| `{{FREELANCER_NAME}}` | Your name or business name | "John Doe Consulting" |
| `{{PROJECT_DESCRIPTION}}` | Brief project overview | "E-commerce website development" |
| `{{PROJECT_VALUE}}` | Contract value/rate | "15000" or "100/hour" |
| `{{CURRENCY}}` | Currency code | "USD", "EUR", "GBP" |
| `{{PAYMENT_TERMS}}` | Payment schedule | "Net 30 days", "50% upfront" |
| `{{START_DATE}}` | Project start date | "2024-01-15" |
| `{{END_DATE}}` | Expected completion | "2024-03-15" |
| `{{JURISDICTION}}` | Legal jurisdiction | "California, USA" |

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run linting
npm run lint
```

### Test Coverage
The test suite covers:
- ✅ Contract generation with all template types
- ✅ Risk assessment and fairness scoring  
- ✅ Contract comparison and diff generation
- ✅ Clause management (list, add, categorize)
- ✅ Variable substitution
- ✅ CLI interface commands
- ✅ Error handling and validation
- ✅ Integration workflows

## 📖 Examples

### Generate Multiple Contract Types

```javascript
// Fixed-price website project
const websiteContract = await system.generateContract('fixed-price', {
    client: 'StartupXYZ',
    project: 'Company Website Redesign',
    value: '8500',
    currency: 'USD',
    clauses: ['upfront-50', 'ip-transfer-on-payment', 'liability-cap-contract']
});

// Hourly consultation agreement  
const consultingContract = await system.generateContract('hourly', {
    client: 'Enterprise Corp',
    project: 'Technical Architecture Consulting', 
    value: '150',
    currency: 'USD',
    clauses: ['net-15', 'termination-14-days']
});

// NDA for sensitive project
const ndaContract = await system.generateContract('nda', {
    client: 'Confidential Startup'
});
```

### Risk Assessment Workflow

```javascript
// Analyze existing contract
const analysis = await system.analyzeContract('existing-contract.md');

if (analysis.fairnessScore < 70) {
    console.log('⚠️ Contract needs improvement');
    
    // Show specific risks
    analysis.riskFactors.forEach(risk => {
        console.log(`🚨 ${risk.severity}: ${risk.message}`);
    });
    
    // Show protective additions
    analysis.protectiveAdditions.forEach(addition => {
        console.log(`💡 Consider adding: ${addition.clause}`);
    });
}
```

### Portfolio Risk Summary

```javascript
// Analyze multiple contracts
const contractPaths = [
    'client1-contract.md',
    'client2-contract.md', 
    'client3-contract.md'
];

const summary = await system.getRiskSummary(contractPaths);

console.log(`Portfolio Risk Assessment:`);
console.log(`Average Fairness: ${summary.averageFairnessScore}/100`);
console.log(`Common Issues:`);

Object.entries(summary.commonRisks).forEach(([risk, count]) => {
    console.log(`  • ${risk}: affects ${count} contracts`);
});
```

## 🔧 Custom Clauses

Add your own protective clauses:

```javascript
// Add custom payment clause
await system.addClause('payment', 'quick-pay-discount', {
    title: 'Early Payment Discount',
    content: '2% discount for payments received within 7 days. Standard rate applies to payments after 7 days.',
    riskLevel: 'very-low'
});

// Add custom IP clause
await system.addClause('ip-ownership', 'limited-license', {
    title: 'Limited Usage License',  
    content: 'Client receives limited license to use work product. Freelancer retains all ownership rights.',
    riskLevel: 'low'
});
```

## 📈 Integration with Cortex Freelancer

This module integrates seamlessly with the broader Cortex Freelancer system:

- **CRM Integration** - Auto-populate client data from CRM
- **Project Management** - Link contracts to active projects  
- **Invoice Generation** - Contract terms flow to billing
- **Client Portal** - Secure contract sharing and e-signatures
- **Analytics Dashboard** - Track contract performance metrics

## 🛡️ Legal Disclaimer

This system provides template contracts and risk assessments for educational and convenience purposes. **Always consult with a qualified attorney** before using any contract in your business. Laws vary by jurisdiction and business circumstances.

The risk assessments and fairness scores are algorithmic opinions, not legal advice. They should supplement, not replace, professional legal review.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-clause-type`
3. Add tests for new functionality
4. Ensure all tests pass: `npm test`
5. Submit a pull request

### Adding New Contract Types

To add a new contract template:

1. Add the type to `contractTypes` array in constructor
2. Create a `_get[Type]Template()` method
3. Add test coverage in `__tests__/`
4. Update documentation

### Adding New Clause Categories

1. Add category to `clauseCategories` array
2. Create `_get[Category]Clauses()` method  
3. Add analysis method `_analyze[Category]()`
4. Update tests and documentation

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

- 📧 Email: support@cortex-freelancer.com
- 💬 Discord: [Cortex Community](https://discord.gg/cortex)
- 🐛 Issues: [GitHub Issues](https://github.com/cortex-freelancer/issues)
- 📖 Docs: [Full Documentation](https://docs.cortex-freelancer.com/contracts)

---

**Built with ⚡ by the Cortex Freelancer Team**

*Empowering freelancers with legal automation and risk protection*