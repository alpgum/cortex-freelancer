#!/usr/bin/env node
/**
 * Contract Template System with Legal Automation and Risk Assessment
 *
 * Features:
 * - Pre-built contract templates (fixed-price, hourly, NDA, SOW, subcontractor)
 * - Modular legal clause library with smart matching
 * - Risk assessment engine with fairness scoring
 * - Smart contract generation with CRM integration
 * - Version control and diff comparison
 * - Legal clause suggestions and protective additions
 */

const fs = require('fs');
const path = require('path');
// const { spawn } = require('child_process'); // For future Python integration

class ContractTemplateSystem {
    constructor() {
        this.toolsDir = path.dirname(__filename);
        this.templatesDir = path.join(this.toolsDir, 'templates');
        this.clausesDir = path.join(this.toolsDir, 'clauses');
        this.outputDir = path.join(this.toolsDir, 'generated');

        // Ensure directories exist
        [this.templatesDir, this.clausesDir, this.outputDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });

        this.contractTypes = [
            'fixed-price',
            'hourly',
            'retainer',
            'nda',
            'sow',
            'subcontractor'
        ];

        this.clauseCategories = [
            'payment',
            'ip-ownership',
            'termination',
            'liability',
            'dispute-resolution',
            'non-compete'
        ];
    }

    /**
     * Generate a contract from template with specified parameters
     */
    async generateContract(type, options = {}) {
        if (!this.contractTypes.includes(type)) {
            throw new Error(`Invalid contract type: ${type}. Available types: ${this.contractTypes.join(', ')}`);
        }

        const templatePath = path.join(this.templatesDir, `${type}.md`);
        if (!fs.existsSync(templatePath)) {
            await this._createDefaultTemplate(type);
        }

        let template = fs.readFileSync(templatePath, 'utf8');

        // Apply variable substitution
        template = this._substituteVariables(template, options);

        // Add selected clauses
        if (options.clauses) {
            template = await this._addClauses(template, options.clauses);
        }

        // Generate output filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const clientName = options.client ? options.client.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase() : 'client';
        const filename = `${type}-${clientName}-${timestamp}.md`;
        const outputPath = path.join(this.outputDir, filename);

        // Write generated contract
        fs.writeFileSync(outputPath, template);

        return {
            type,
            filename,
            path: outputPath,
            content: template,
            generatedAt: new Date().toISOString(),
            options
        };
    }

    /**
     * Analyze an existing contract for risk factors and fairness
     */
    async analyzeContract(filePath, _options = {}) {
        if (!fs.existsSync(filePath)) {
            throw new Error(`Contract file not found: ${filePath}`);
        }

        const content = fs.readFileSync(filePath, 'utf8');
        const analysis = {
            file: filePath,
            analyzedAt: new Date().toISOString(),
            content,
            wordCount: content.split(/\s+/).length,
            fairnessScore: 0,
            riskFactors: [],
            missingClauses: [],
            suggestions: [],
            protectiveAdditions: []
        };

        // Analyze payment terms
        const paymentAnalysis = this._analyzePaymentTerms(content);
        analysis.fairnessScore += paymentAnalysis.score;
        analysis.riskFactors.push(...paymentAnalysis.risks);

        // Analyze IP ownership
        const ipAnalysis = this._analyzeIPOwnership(content);
        analysis.fairnessScore += ipAnalysis.score;
        analysis.riskFactors.push(...ipAnalysis.risks);

        // Analyze termination clauses
        const terminationAnalysis = this._analyzeTermination(content);
        analysis.fairnessScore += terminationAnalysis.score;
        analysis.riskFactors.push(...terminationAnalysis.risks);

        // Analyze liability limitations
        const liabilityAnalysis = this._analyzeLiability(content);
        analysis.fairnessScore += liabilityAnalysis.score;
        analysis.riskFactors.push(...liabilityAnalysis.risks);

        // Check for missing critical clauses
        analysis.missingClauses = this._checkMissingClauses(content);

        // Calculate final fairness score (0-100)
        analysis.fairnessScore = Math.min(100, Math.max(0, analysis.fairnessScore));

        // Generate suggestions based on analysis
        analysis.suggestions = this._generateSuggestions(analysis);
        analysis.protectiveAdditions = this._suggestProtectiveAdditions(analysis);

        return analysis;
    }

    /**
     * Compare two contract versions and show differences
     */
    async compareContracts(file1, file2, _options = {}) {
        if (!fs.existsSync(file1) || !fs.existsSync(file2)) {
            throw new Error('Both contract files must exist for comparison');
        }

        const content1 = fs.readFileSync(file1, 'utf8');
        const content2 = fs.readFileSync(file2, 'utf8');

        const comparison = {
            file1,
            file2,
            comparedAt: new Date().toISOString(),
            changes: [],
            wordCountDiff: content2.split(/\s+/).length - content1.split(/\s+/).length,
            summary: {}
        };

        // Simple diff analysis
        const lines1 = content1.split('\n');
        const lines2 = content2.split('\n');

        comparison.changes = this._generateDiff(lines1, lines2);
        comparison.summary = this._summarizeDifferences(comparison.changes);

        return comparison;
    }

    /**
     * List available contract clauses
     */
    async listClauses(category = null) {
        const clauses = {};

        for (const cat of this.clauseCategories) {
            if (category && category !== cat) { continue; }

            const clauseFile = path.join(this.clausesDir, `${cat}.json`);
            if (fs.existsSync(clauseFile)) {
                clauses[cat] = JSON.parse(fs.readFileSync(clauseFile, 'utf8'));
            } else {
                clauses[cat] = await this._createDefaultClauses(cat);
            }
        }

        return category ? clauses[category] : clauses;
    }

    /**
     * Add a new clause to a category
     */
    async addClause(category, clauseId, clauseData) {
        if (!this.clauseCategories.includes(category)) {
            throw new Error(`Invalid clause category: ${category}. Available categories: ${this.clauseCategories.join(', ')}`);
        }

        const clauseFile = path.join(this.clausesDir, `${category}.json`);
        let clauses = {};

        if (fs.existsSync(clauseFile)) {
            clauses = JSON.parse(fs.readFileSync(clauseFile, 'utf8'));
        }

        clauses[clauseId] = {
            ...clauseData,
            addedAt: new Date().toISOString(),
            id: clauseId,
            category
        };

        fs.writeFileSync(clauseFile, JSON.stringify(clauses, null, 2));

        return clauses[clauseId];
    }

    /**
     * Get risk assessment summary for multiple contracts
     */
    async getRiskSummary(contractPaths) {
        const summary = {
            totalContracts: contractPaths.length,
            averageFairnessScore: 0,
            commonRisks: {},
            recommendations: []
        };

        let totalScore = 0;
        const allRisks = [];

        for (const filePath of contractPaths) {
            try {
                const analysis = await this.analyzeContract(filePath);
                totalScore += analysis.fairnessScore;
                allRisks.push(...analysis.riskFactors);
            } catch (error) {
                console.warn(`Failed to analyze ${filePath}: ${error.message}`);
            }
        }

        summary.averageFairnessScore = Math.round(totalScore / contractPaths.length);

        // Count common risks
        allRisks.forEach(risk => {
            const key = risk.type || risk.message || 'unknown';
            summary.commonRisks[key] = (summary.commonRisks[key] || 0) + 1;
        });

        // Generate portfolio-level recommendations
        Object.entries(summary.commonRisks).forEach(([risk, count]) => {
            if (count >= Math.ceil(contractPaths.length * 0.3)) { // 30% threshold
                summary.recommendations.push({
                    priority: 'high',
                    type: 'pattern',
                    message: `${risk} appears in ${count}/${contractPaths.length} contracts - consider standardizing protection`,
                    affectedContracts: count
                });
            }
        });

        return summary;
    }

    // Private helper methods

    _substituteVariables(template, variables) {
        let result = template;

        // Common variable substitutions
        const substitutions = {
            'CLIENT_NAME': variables.client || '[CLIENT NAME]',
            'FREELANCER_NAME': variables.freelancer || '[FREELANCER NAME]',
            'PROJECT_DESCRIPTION': variables.project || '[PROJECT DESCRIPTION]',
            'PROJECT_VALUE': variables.value || '[PROJECT VALUE]',
            'PAYMENT_TERMS': variables.paymentTerms || 'Net 30 days',
            'START_DATE': variables.startDate || '[START DATE]',
            'END_DATE': variables.endDate || '[END DATE]',
            'CURRENCY': variables.currency || 'USD',
            'JURISDICTION': variables.jurisdiction || '[JURISDICTION]'
        };

        Object.entries(substitutions).forEach(([key, value]) => {
            const regex = new RegExp(`\\{\\{${key}\\}\\}|\\$\\{${key}\\}`, 'g');
            result = result.replace(regex, value);
        });

        return result;
    }

    async _addClauses(template, clauseIds) {
        let result = template;

        // Add clauses section if not present
        if (!result.includes('## Legal Clauses')) {
            result += '\n\n## Legal Clauses\n\n';
        }

        for (const clauseId of clauseIds) {
            // Find which category contains this clause
            for (const category of this.clauseCategories) {
                const clauses = await this.listClauses(category);
                if (clauses[clauseId]) {
                    result += `### ${clauses[clauseId].title}\n\n`;
                    result += `${clauses[clauseId].content}\n\n`;
                    break;
                }
            }
        }

        return result;
    }

    _analyzePaymentTerms(content) {
        const analysis = { score: 20, risks: [] };

        // Check for payment terms
        if (!/payment/i.test(content)) {
            analysis.risks.push({
                type: 'missing-payment-terms',
                severity: 'high',
                message: 'No payment terms specified'
            });
            analysis.score -= 15;
        }

        // Check for late payment penalties
        if (!/late.{0,20}(fee|penalty|interest)/i.test(content)) {
            analysis.risks.push({
                type: 'no-late-payment-penalty',
                severity: 'medium',
                message: 'No late payment penalties specified'
            });
            analysis.score -= 5;
        }

        // Check for upfront payment
        if (!/upfront|advance|deposit/i.test(content)) {
            analysis.risks.push({
                type: 'no-upfront-payment',
                severity: 'medium',
                message: 'No upfront payment required'
            });
            analysis.score -= 5;
        }

        return analysis;
    }

    _analyzeIPOwnership(content) {
        const analysis = { score: 20, risks: [] };

        // Check for IP ownership clause
        if (!/intellectual.property|copyright|ownership/i.test(content)) {
            analysis.risks.push({
                type: 'missing-ip-clause',
                severity: 'high',
                message: 'No intellectual property ownership clause'
            });
            analysis.score -= 15;
        }

        // Check if IP transfers only upon payment
        if (!/payment.{0,50}(transfer|ownership)|ownership.{0,50}payment/i.test(content)) {
            analysis.risks.push({
                type: 'ip-without-payment-protection',
                severity: 'medium',
                message: 'IP may transfer before full payment received'
            });
            analysis.score -= 8;
        }

        return analysis;
    }

    _analyzeTermination(content) {
        const analysis = { score: 20, risks: [] };

        // Check for termination clause
        if (!/terminat|cancel/i.test(content)) {
            analysis.risks.push({
                type: 'missing-termination-clause',
                severity: 'high',
                message: 'No termination clause specified'
            });
            analysis.score -= 15;
        }

        // Check for notice period
        if (!/notice.{0,20}(day|week)/i.test(content)) {
            analysis.risks.push({
                type: 'no-termination-notice',
                severity: 'medium',
                message: 'No termination notice period specified'
            });
            analysis.score -= 5;
        }

        return analysis;
    }

    _analyzeLiability(content) {
        const analysis = { score: 20, risks: [] };

        // Check for liability limitations
        if (!/liability.{0,50}limit/i.test(content)) {
            analysis.risks.push({
                type: 'unlimited-liability',
                severity: 'high',
                message: 'No liability limitations specified'
            });
            analysis.score -= 15;
        }

        return analysis;
    }

    _checkMissingClauses(content) {
        const required = [
            { clause: 'payment', pattern: /payment|fee|cost/i },
            { clause: 'scope', pattern: /scope|deliverable|work/i },
            { clause: 'timeline', pattern: /deadline|timeline|schedule/i },
            { clause: 'revision', pattern: /revision|change|modification/i }
        ];

        return required
            .filter(item => !item.pattern.test(content))
            .map(item => item.clause);
    }

    _generateSuggestions(analysis) {
        const suggestions = [];

        if (analysis.fairnessScore < 50) {
            suggestions.push({
                priority: 'critical',
                message: 'Contract heavily favors client - major revisions recommended'
            });
        }

        if (analysis.missingClauses.length > 2) {
            suggestions.push({
                priority: 'high',
                message: `Add missing critical clauses: ${analysis.missingClauses.join(', ')}`
            });
        }

        return suggestions;
    }

    _suggestProtectiveAdditions(analysis) {
        const additions = [];

        if (analysis.riskFactors.some(r => r.type === 'missing-payment-terms')) {
            additions.push({
                type: 'payment-protection',
                clause: 'payment-net30-with-penalty',
                reason: 'Protect against late payments'
            });
        }

        return additions;
    }

    _generateDiff(lines1, lines2) {
        const changes = [];
        const maxLen = Math.max(lines1.length, lines2.length);

        for (let i = 0; i < maxLen; i++) {
            const line1 = lines1[i] || '';
            const line2 = lines2[i] || '';

            if (line1 !== line2) {
                changes.push({
                    lineNumber: i + 1,
                    type: !line1 ? 'added' : !line2 ? 'removed' : 'modified',
                    before: line1,
                    after: line2
                });
            }
        }

        return changes;
    }

    _summarizeDifferences(changes) {
        return {
            totalChanges: changes.length,
            added: changes.filter(c => c.type === 'added').length,
            removed: changes.filter(c => c.type === 'removed').length,
            modified: changes.filter(c => c.type === 'modified').length
        };
    }

    async _createDefaultTemplate(type) {
        const templates = {
            'fixed-price': this._getFixedPriceTemplate(),
            'hourly': this._getHourlyTemplate(),
            'retainer': this._getRetainerTemplate(),
            'nda': this._getNDATemplate(),
            'sow': this._getSOWTemplate(),
            'subcontractor': this._getSubcontractorTemplate()
        };

        const templatePath = path.join(this.templatesDir, `${type}.md`);
        fs.writeFileSync(templatePath, templates[type] || '# Contract Template\n\n*Template not found*');
    }

    async _createDefaultClauses(category) {
        const clauseSets = {
            'payment': this._getPaymentClauses(),
            'ip-ownership': this._getIPClauses(),
            'termination': this._getTerminationClauses(),
            'liability': this._getLiabilityClauses(),
            'dispute-resolution': this._getDisputeClauses(),
            'non-compete': this._getNonCompeteClauses()
        };

        const clauses = clauseSets[category] || {};
        const clauseFile = path.join(this.clausesDir, `${category}.json`);
        fs.writeFileSync(clauseFile, JSON.stringify(clauses, null, 2));

        return clauses;
    }

    // Template content generators
    _getFixedPriceTemplate() {
        return `# Fixed-Price Project Contract

## Project Details
- **Client:** {{CLIENT_NAME}}
- **Freelancer:** {{FREELANCER_NAME}}
- **Project:** {{PROJECT_DESCRIPTION}}
- **Total Value:** {{CURRENCY}} {{PROJECT_VALUE}}
- **Start Date:** {{START_DATE}}
- **Completion Date:** {{END_DATE}}

## Payment Terms
- **Payment Schedule:** {{PAYMENT_TERMS}}
- **Late Payment:** 2% monthly interest on overdue amounts
- **Deposit Required:** 50% upfront payment before work begins

## Scope of Work
The freelancer will deliver the following:
- [Detailed scope items]
- [Specific deliverables]
- [Quality standards]

## Intellectual Property
All work product and intellectual property created under this agreement will transfer to the client upon full payment of all amounts due.

## Termination
Either party may terminate this agreement with 14 days written notice. Upon termination, client pays for all completed work.

## Liability
Freelancer's total liability is limited to the total amount paid under this contract.

## Governing Law
This contract is governed by the laws of {{JURISDICTION}}.

---
*Generated by Cortex Freelancer Contract System*
*Date: ${new Date().toISOString().split('T')[0]}*`;
    }

    _getHourlyTemplate() {
        return `# Hourly Service Agreement

## Service Details
- **Client:** {{CLIENT_NAME}}
- **Freelancer:** {{FREELANCER_NAME}}
- **Services:** {{PROJECT_DESCRIPTION}}
- **Hourly Rate:** {{CURRENCY}} {{PROJECT_VALUE}}/hour
- **Estimated Hours:** [ESTIMATED_HOURS]

## Payment Terms
- **Invoicing:** Weekly/Monthly invoices
- **Payment:** {{PAYMENT_TERMS}}
- **Time Tracking:** Detailed timesheets provided with each invoice

## Scope of Services
- [Service description]
- [Hourly rate applies to]
- [Additional charges for]

## Termination
Either party may terminate with 7 days notice. Client pays for all documented hours worked.

---
*Generated by Cortex Freelancer Contract System*`;
    }

    _getRetainerTemplate() {
        return `# Monthly Retainer Agreement

## Retainer Details
- **Client:** {{CLIENT_NAME}}
- **Freelancer:** {{FREELANCER_NAME}}
- **Monthly Retainer:** {{CURRENCY}} {{PROJECT_VALUE}}
- **Included Hours:** [INCLUDED_HOURS] hours per month
- **Overage Rate:** [OVERAGE_RATE] per additional hour

## Services Included
- [List of included services]
- [Response time commitments]
- [Availability requirements]

## Payment Terms
- Monthly payment due in advance
- Overage charges billed separately
- Auto-renewal unless 30 days notice given

---
*Generated by Cortex Freelancer Contract System*`;
    }

    _getNDATemplate() {
        return `# Non-Disclosure Agreement

## Parties
- **Disclosing Party:** {{CLIENT_NAME}}
- **Receiving Party:** {{FREELANCER_NAME}}

## Confidential Information
The receiving party agrees to keep confidential all non-public information shared by the disclosing party.

## Obligations
- Maintain confidentiality for 5 years
- Use information only for authorized purposes
- Return or destroy confidential information upon request

## Exceptions
This agreement does not cover information that is:
- Already publicly known
- Independently developed
- Required to be disclosed by law

---
*Generated by Cortex Freelancer Contract System*`;
    }

    _getSOWTemplate() {
        return `# Statement of Work

## Project Overview
- **Client:** {{CLIENT_NAME}}
- **Freelancer:** {{FREELANCER_NAME}}
- **Project:** {{PROJECT_DESCRIPTION}}

## Detailed Scope
### Phase 1: [Phase Name]
- [Deliverable 1]
- [Deliverable 2]
- **Timeline:** [Duration]
- **Payment:** [Amount]

### Phase 2: [Phase Name]
- [Deliverable 1]
- [Deliverable 2]
- **Timeline:** [Duration]
- **Payment:** [Amount]

## Change Management
All scope changes require written approval and may affect timeline and budget.

---
*Generated by Cortex Freelancer Contract System*`;
    }

    _getSubcontractorTemplate() {
        return `# Subcontractor Agreement

## Parties
- **Primary Contractor:** {{FREELANCER_NAME}}
- **Subcontractor:** [SUBCONTRACTOR_NAME]
- **Client:** {{CLIENT_NAME}}

## Subcontracted Work
- **Scope:** [Specific work to be subcontracted]
- **Payment:** [Payment terms]
- **Timeline:** [Completion requirements]

## Responsibilities
- Subcontractor maintains quality standards
- All client communication through primary contractor
- Subcontractor provides necessary deliverables on time

## Confidentiality
Subcontractor agrees to maintain confidentiality of all project information.

---
*Generated by Cortex Freelancer Contract System*`;
    }

    // Clause generators
    _getPaymentClauses() {
        return {
            'net-30': {
                title: 'Net 30 Payment Terms',
                content: 'Payment is due within 30 days of invoice date. Late payments subject to 2% monthly interest.',
                category: 'payment',
                riskLevel: 'medium'
            },
            'net-15': {
                title: 'Net 15 Payment Terms',
                content: 'Payment is due within 15 days of invoice date. Late payments subject to 2% monthly interest.',
                category: 'payment',
                riskLevel: 'low'
            },
            'milestone-based': {
                title: 'Milestone Payment Schedule',
                content: 'Payments tied to specific project milestones. Each milestone payment due within 7 days of completion.',
                category: 'payment',
                riskLevel: 'low'
            },
            'upfront-50': {
                title: '50% Upfront Payment',
                content: '50% payment required before work begins. Remaining balance due upon project completion.',
                category: 'payment',
                riskLevel: 'very-low'
            }
        };
    }

    _getIPClauses() {
        return {
            'work-for-hire': {
                title: 'Work for Hire',
                content: 'All work created is considered work for hire. Client owns all intellectual property rights upon payment.',
                category: 'ip-ownership',
                riskLevel: 'medium'
            },
            'ip-transfer-on-payment': {
                title: 'IP Transfer Upon Full Payment',
                content: 'Intellectual property rights transfer to client only upon receipt of full payment. Freelancer retains rights until then.',
                category: 'ip-ownership',
                riskLevel: 'low'
            }
        };
    }

    _getTerminationClauses() {
        return {
            'termination-14-days': {
                title: '14-Day Termination Notice',
                content: 'Either party may terminate with 14 days written notice. All completed work must be paid for.',
                category: 'termination',
                riskLevel: 'low'
            },
            'termination-for-cause': {
                title: 'Termination for Cause',
                content: 'Immediate termination allowed for material breach. Non-breaching party entitled to damages.',
                category: 'termination',
                riskLevel: 'medium'
            }
        };
    }

    _getLiabilityClauses() {
        return {
            'liability-cap-contract': {
                title: 'Liability Limited to Contract Value',
                content: 'Total liability limited to the total amount paid under this contract. No consequential damages.',
                category: 'liability',
                riskLevel: 'low'
            },
            'mutual-liability-cap': {
                title: 'Mutual Liability Limitation',
                content: 'Both parties limit liability to direct damages only, not exceeding contract value.',
                category: 'liability',
                riskLevel: 'low'
            }
        };
    }

    _getDisputeClauses() {
        return {
            'mediation-arbitration': {
                title: 'Mediation and Arbitration',
                content: 'Disputes resolved through mediation first, then binding arbitration if needed.',
                category: 'dispute-resolution',
                riskLevel: 'low'
            },
            'jurisdiction-clause': {
                title: 'Jurisdiction and Governing Law',
                content: 'Contract governed by laws of [JURISDICTION]. Disputes resolved in [JURISDICTION] courts.',
                category: 'dispute-resolution',
                riskLevel: 'medium'
            }
        };
    }

    _getNonCompeteClauses() {
        return {
            'non-compete-6-months': {
                title: '6-Month Non-Compete',
                content: 'Freelancer agrees not to work with direct competitors for 6 months after project completion.',
                category: 'non-compete',
                riskLevel: 'high'
            },
            'non-solicitation': {
                title: 'Non-Solicitation Clause',
                content: 'Freelancer agrees not to solicit client\'s employees or customers for 12 months.',
                category: 'non-compete',
                riskLevel: 'medium'
            }
        };
    }
}

// CLI interface
async function main() {
    if (require.main === module) {
        const args = process.argv.slice(2);

        if (args.length === 0) {
            console.log(`
Contract Template System - Legal Automation and Risk Assessment

Usage:
  node index.js <command> [options]

Commands:
  generate --type <type> [options]     Generate contract from template
  analyze --file <path>                Analyze contract for risks
  compare --v1 <path> --v2 <path>      Compare two contract versions
  clauses --list [--category <cat>]    List available clauses
  clauses --add <category> <id>        Add new clause
  summary --files <path1,path2,...>    Risk summary for multiple contracts

Contract Types:
  fixed-price, hourly, retainer, nda, sow, subcontractor

Clause Categories:
  payment, ip-ownership, termination, liability, dispute-resolution, non-compete

Options:
  --client <name>          Client name
  --freelancer <name>      Freelancer name  
  --project <description>  Project description
  --value <amount>         Project value
  --currency <code>        Currency (default: USD)
  --jurisdiction <place>   Legal jurisdiction
  --clauses <id1,id2>      Include specific clauses
  --output <path>          Output directory

Examples:
  # Generate fixed-price contract
  node index.js generate --type fixed-price --client "Acme Corp" --value "5000"
  
  # Analyze contract for risks
  node index.js analyze --file contract.txt
  
  # Compare two versions
  node index.js compare --v1 draft1.md --v2 draft2.md
  
  # List payment clauses
  node index.js clauses --list --category payment
            `);
            process.exit(1);
        }

        const system = new ContractTemplateSystem();
        const command = args[0];

        try {
            const options = parseArgs(args.slice(1));

            switch (command) {
                case 'generate': {
                    if (!options.type) {
                        throw new Error('Contract type required (--type <type>)');
                    }
                    const contract = await system.generateContract(options.type, options);
                    console.log(`✅ Contract generated: ${contract.filename}`);
                    console.log(`📍 Location: ${contract.path}`);
                    console.log('📊 Fairness score: Pending analysis');
                    if (options.verbose) {
                        console.log('\n📄 Content:\n');
                        console.log(contract.content);
                    }
                    break;
                }

                case 'analyze': {
                    if (!options.file) {
                        throw new Error('File path required (--file <path>)');
                    }
                    const analysis = await system.analyzeContract(options.file, options);
                    console.log(`📊 Fairness Score: ${analysis.fairnessScore}/100`);
                    console.log(`⚠️  Risk Factors: ${analysis.riskFactors.length}`);
                    console.log(`❌ Missing Clauses: ${analysis.missingClauses.length}`);

                    if (analysis.riskFactors.length > 0) {
                        console.log('\n🚨 Risk Factors:');
                        analysis.riskFactors.forEach((risk, i) => {
                            console.log(`${i + 1}. [${risk.severity}] ${risk.message}`);
                        });
                    }

                    if (analysis.suggestions.length > 0) {
                        console.log('\n💡 Suggestions:');
                        analysis.suggestions.forEach((suggestion, i) => {
                            console.log(`${i + 1}. [${suggestion.priority}] ${suggestion.message}`);
                        });
                    }
                    break;
                }

                case 'compare': {
                    if (!options.v1 || !options.v2) {
                        throw new Error('Both version files required (--v1 <path> --v2 <path>)');
                    }
                    const comparison = await system.compareContracts(options.v1, options.v2, options);
                    console.log(`📈 Changes: ${comparison.summary.totalChanges}`);
                    console.log(`➕ Added: ${comparison.summary.added} lines`);
                    console.log(`➖ Removed: ${comparison.summary.removed} lines`);
                    console.log(`🔄 Modified: ${comparison.summary.modified} lines`);
                    console.log(`📝 Word count change: ${comparison.wordCountDiff}`);

                    if (options.verbose && comparison.changes.length > 0) {
                        console.log('\n📋 Detailed Changes:');
                        comparison.changes.slice(0, 10).forEach((change, i) => {
                            console.log(`${i + 1}. Line ${change.lineNumber} [${change.type}]`);
                            if (change.before) { console.log(`   - ${change.before}`); }
                            if (change.after) { console.log(`   + ${change.after}`); }
                        });
                        if (comparison.changes.length > 10) {
                            console.log(`   ... and ${comparison.changes.length - 10} more changes`);
                        }
                    }
                    break;
                }

                case 'clauses': {
                    if (options.list) {
                        const clauses = await system.listClauses(options.category);
                        Object.entries(clauses).forEach(([category, clauseSet]) => {
                            console.log(`\n📂 ${category.toUpperCase()}:`);
                            Object.entries(clauseSet).forEach(([id, clause]) => {
                                console.log(`  • ${id}: ${clause.title}`);
                                if (options.verbose) {
                                    console.log(`    Risk: ${clause.riskLevel}`);
                                    console.log(`    Content: ${clause.content.substring(0, 100)}...`);
                                }
                            });
                        });
                    } else if (options.add) {
                        // Interactive clause addition would go here
                        console.log('Interactive clause addition not implemented in CLI mode');
                        console.log('Use the programmatic API for adding clauses');
                    }
                    break;
                }

                case 'summary': {
                    if (!options.files) {
                        throw new Error('File list required (--files <path1,path2,...>)');
                    }
                    const filePaths = options.files.split(',');
                    const summary = await system.getRiskSummary(filePaths);
                    console.log('📊 Portfolio Risk Summary');
                    console.log(`📄 Total contracts: ${summary.totalContracts}`);
                    console.log(`⭐ Average fairness: ${summary.averageFairnessScore}/100`);
                    console.log('⚠️  Common risks:');
                    Object.entries(summary.commonRisks).forEach(([risk, count]) => {
                        console.log(`   • ${risk}: ${count} contracts`);
                    });
                    break;
                }

                default:
                    throw new Error(`Unknown command: ${command}`);
            }
        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
            process.exit(1);
        }
    }
}

function parseArgs(args) {
    const options = {};

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg.startsWith('--')) {
            const key = arg.substring(2);
            const value = args[i + 1];

            if (value && !value.startsWith('--')) {
                options[key] = value;
                i++; // Skip the value in next iteration
            } else {
                options[key] = true; // Flag option
            }
        }
    }

    return options;
}

module.exports = ContractTemplateSystem;

if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exit(1);
    });
}