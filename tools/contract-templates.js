// Cortex Freelancer - Contract Templates & Negotiations
// Sprint 2 - Task 9/50

class ContractManager {
    constructor() {
        this.templates = new Map();
        this.negotiations = [];
        this.savedContracts = new Map();
        this.initializeTemplates();
    }

    initializeTemplates() {
        // Standard freelance contract template
        this.templates.set('standard_freelance', {
            name: 'Standard Freelance Agreement',
            category: 'general',
            sections: {
                header: `FREELANCE SERVICE AGREEMENT

This Freelance Service Agreement ("Agreement") is entered into on {{contract_date}} between:

**CLIENT:** {{client_name}}
{{client_address}}
{{client_email}}

**FREELANCER:** {{freelancer_name}}  
{{freelancer_address}}
{{freelancer_email}}

**PROJECT:** {{project_name}}`,

                scope: `## 1. SCOPE OF WORK

The Freelancer agrees to provide the following services:

{{scope_description}}

**Deliverables:**
{{deliverables_list}}

**Timeline:**
- Project Start Date: {{start_date}}
- Estimated Completion: {{end_date}}
- Key Milestones: {{milestones}}`,

                payment: `## 2. PAYMENT TERMS

**Total Project Value:** ${{total_amount}}
**Payment Structure:** {{payment_structure}}
**Hourly Rate:** ${{hourly_rate}}/hour (if applicable)

**Payment Schedule:**
{{payment_schedule}}

**Payment Method:** {{payment_method}}
**Late Payment:** {{late_payment_terms}}`,

                ownership: `## 3. INTELLECTUAL PROPERTY

**Work Product Ownership:** {{ownership_terms}}
**Client Materials:** Client retains ownership of all provided materials
**Third-Party Components:** {{third_party_terms}}
**Portfolio Usage:** {{portfolio_usage_rights}}`,

                confidentiality: `## 4. CONFIDENTIALITY

The Freelancer agrees to maintain confidentiality of all client information and will not disclose any proprietary or confidential information without written consent.

**Non-Disclosure Period:** {{nda_period}}
**Exceptions:** {{nda_exceptions}}`,

                termination: `## 5. TERMINATION

**Termination Notice:** {{termination_notice}}
**Payment for Completed Work:** {{termination_payment_terms}}
**Return of Materials:** {{material_return_terms}}`,

                legal: `## 6. LEGAL TERMS

**Governing Law:** {{governing_law}}
**Dispute Resolution:** {{dispute_resolution}}
**Limitation of Liability:** {{liability_limitation}}
**Independent Contractor Status:** The Freelancer is an independent contractor, not an employee.

**Signatures:**

Client: _________________________ Date: _________
{{client_name}}

Freelancer: _________________________ Date: _________
{{freelancer_name}}`
            }
        });

        // Web development specific contract
        this.templates.set('web_development', {
            name: 'Web Development Agreement',
            category: 'development',
            sections: {
                header: `WEB DEVELOPMENT AGREEMENT

This Web Development Agreement ("Agreement") is entered into on {{contract_date}} between:

**CLIENT:** {{client_name}}
**DEVELOPER:** {{freelancer_name}}

**PROJECT:** {{project_name}} - Web Development Services`,

                scope: `## 1. DEVELOPMENT SCOPE

**Website Type:** {{website_type}}
**Technology Stack:** {{tech_stack}}
**Key Features:**
{{feature_list}}

**Development Phases:**
{{development_phases}}

**Browser Compatibility:** {{browser_support}}
**Responsive Design:** {{responsive_requirements}}
**Performance Requirements:** {{performance_specs}}`,

                payment: `## 2. PAYMENT & PRICING

**Total Project Cost:** ${{total_amount}}
**Payment Structure:**
{{payment_breakdown}}

**Additional Services (Hourly):**
- Bug fixes after launch: ${{bug_fix_rate}}/hour
- Content updates: ${{content_rate}}/hour  
- Feature additions: ${{feature_rate}}/hour

**Hosting & Domain:** {{hosting_responsibility}}`,

                deliverables: `## 3. DELIVERABLES

**Technical Deliverables:**
- Fully functional website
- Source code repository
- Documentation
- {{additional_deliverables}}

**Content Requirements:**
- Client provides: {{client_content_responsibility}}
- Developer provides: {{developer_content_responsibility}}

**Testing:** {{testing_requirements}}`,

                maintenance: `## 4. POST-LAUNCH SUPPORT

**Warranty Period:** {{warranty_period}}
**Included Support:**
{{included_support}}

**Ongoing Maintenance:** {{maintenance_terms}}
**Security Updates:** {{security_update_responsibility}}`,

                hosting: `## 5. HOSTING & DEPLOYMENT

**Hosting Provider:** {{hosting_provider}}
**Deployment:** {{deployment_process}}
**Domain Management:** {{domain_responsibility}}
**SSL Certificate:** {{ssl_responsibility}}
**Backups:** {{backup_responsibility}}`,

                legal: `## 6. TECHNICAL STANDARDS

**Code Quality:** {{code_standards}}
**Documentation:** {{documentation_requirements}}
**Version Control:** {{version_control}}
**SEO Basics:** {{seo_requirements}}

## 7. LEGAL TERMS
[Standard legal terms as above]`
            }
        });

        // Retainer agreement template
        this.templates.set('retainer', {
            name: 'Monthly Retainer Agreement',
            category: 'ongoing',
            sections: {
                header: `MONTHLY RETAINER AGREEMENT

This Monthly Retainer Agreement ("Agreement") is entered into on {{contract_date}} between:

**CLIENT:** {{client_name}}
**FREELANCER:** {{freelancer_name}}

**SERVICES:** Ongoing {{service_type}} Services`,

                scope: `## 1. RETAINER SERVICES

**Monthly Commitment:** {{monthly_hours}} hours per month
**Service Categories:**
{{service_categories}}

**Priority Response Time:** {{response_time}}
**Included Services:**
{{included_services}}

**Excluded Services:**
{{excluded_services}}`,

                payment: `## 2. RETAINER TERMS

**Monthly Retainer Fee:** ${{monthly_fee}}
**Billing Date:** {{billing_date}} of each month
**Payment Terms:** {{payment_terms}}

**Hour Rollover:** {{hour_rollover_policy}}
**Additional Hours:** ${{additional_hour_rate}}/hour
**Emergency Rate:** ${{emergency_rate}}/hour ({{emergency_definition}})`,

                communication: `## 3. COMMUNICATION & AVAILABILITY

**Primary Contact Method:** {{contact_method}}
**Business Hours:** {{business_hours}}
**Response Time Guarantee:** {{response_guarantee}}

**Reporting:**
- Monthly summary report
- Time tracking details
- Recommendations for improvements`,

                termination: `## 4. RETAINER TERMINATION

**Termination Notice:** {{termination_notice}}
**Final Billing:** {{final_billing_terms}}
**Transition Period:** {{transition_period}}
**Unused Hours:** {{unused_hours_policy}}`,

                legal: `## 5. LEGAL TERMS
[Standard legal terms apply]`
            }
        });

        // Content creation contract
        this.templates.set('content_creation', {
            name: 'Content Creation Agreement',
            category: 'content',
            sections: {
                header: `CONTENT CREATION AGREEMENT

**CLIENT:** {{client_name}}
**CONTENT CREATOR:** {{freelancer_name}}
**PROJECT:** {{project_name}} - Content Creation Services`,

                scope: `## 1. CONTENT SCOPE

**Content Type:** {{content_type}}
**Quantity:** {{content_quantity}}
**Publishing Schedule:** {{publishing_schedule}}

**Content Categories:**
{{content_categories}}

**Target Audience:** {{target_audience}}
**Brand Guidelines:** {{brand_guidelines}}`,

                deliverables: `## 2. CONTENT DELIVERABLES

**Format Requirements:** {{content_format}}
**Word Count:** {{word_count_range}}
**SEO Requirements:** {{seo_requirements}}
**Image Requirements:** {{image_requirements}}

**Delivery Format:** {{delivery_format}}
**Revision Rounds:** {{revision_rounds}}`,

                approval: `## 3. APPROVAL PROCESS

**Review Timeline:** {{review_timeline}}
**Feedback Method:** {{feedback_method}}
**Approval Authority:** {{approval_authority}}
**Publication Rights:** {{publication_rights}}`,

                legal: `## 4. CONTENT RIGHTS

**Copyright Ownership:** {{copyright_terms}}
**Attribution Requirements:** {{attribution_terms}}
**Exclusivity:** {{exclusivity_terms}}
**Plagiarism Guarantee:** All content is original and plagiarism-free`
            }
        });
    }

    // Generate contract with client-specific terms
    generateContract(templateName, variables) {
        const template = this.templates.get(templateName);
        if (!template) {
            throw new Error(`Template ${templateName} not found`);
        }

        let contractText = '';
        
        Object.entries(template.sections).forEach(([sectionName, sectionText]) => {
            let processedSection = sectionText;
            
            // Replace all variables
            Object.entries(variables).forEach(([key, value]) => {
                const regex = new RegExp(`{{${key}}}`, 'g');
                processedSection = processedSection.replace(regex, value || `[${key}]`);
            });
            
            contractText += processedSection + '\n\n';
        });

        return {
            id: `contract_${Date.now()}`,
            templateName,
            contractText,
            variables,
            createdDate: new Date(),
            status: 'draft'
        };
    }

    // Negotiation tracking
    startNegotiation(clientId, contractId, initialTerms) {
        const negotiation = {
            id: `negotiation_${Date.now()}`,
            clientId,
            contractId,
            status: 'active',
            startDate: new Date(),
            terms: [
                {
                    version: 1,
                    proposedBy: 'freelancer',
                    date: new Date(),
                    terms: initialTerms,
                    notes: 'Initial proposal'
                }
            ],
            currentVersion: 1
        };

        this.negotiations.push(negotiation);
        return negotiation.id;
    }

    // Add counter-proposal to negotiation
    addCounterProposal(negotiationId, proposedBy, newTerms, notes = '') {
        const negotiation = this.negotiations.find(n => n.id === negotiationId);
        if (!negotiation) {
            throw new Error('Negotiation not found');
        }

        const newVersion = negotiation.currentVersion + 1;
        
        negotiation.terms.push({
            version: newVersion,
            proposedBy,
            date: new Date(),
            terms: newTerms,
            notes
        });

        negotiation.currentVersion = newVersion;
        return newVersion;
    }

    // Get contract suggestions based on project type
    getContractSuggestions(projectType, clientProfile) {
        const suggestions = {
            recommendations: [],
            clauses: [],
            riskFactors: []
        };

        // Project type recommendations
        switch (projectType) {
            case 'web_development':
                suggestions.recommendations.push('Use web development specific template');
                suggestions.clauses.push('Include browser compatibility requirements');
                suggestions.clauses.push('Define hosting and maintenance responsibilities');
                break;
            
            case 'content_creation':
                suggestions.recommendations.push('Use content creation template');
                suggestions.clauses.push('Specify SEO requirements and metrics');
                suggestions.clauses.push('Define content ownership and usage rights');
                break;
                
            case 'ongoing_support':
                suggestions.recommendations.push('Consider retainer agreement');
                suggestions.clauses.push('Define response time guarantees');
                suggestions.clauses.push('Specify hour rollover policies');
                break;
                
            default:
                suggestions.recommendations.push('Use standard freelance template');
        }

        // Client profile-based suggestions
        if (clientProfile) {
            if (clientProfile.company_size === 'enterprise') {
                suggestions.clauses.push('Include stronger liability limitations');
                suggestions.clauses.push('Add detailed compliance requirements');
            }
            
            if (clientProfile.payment_history === 'delayed') {
                suggestions.riskFactors.push('Consider shorter payment terms');
                suggestions.clauses.push('Add late payment penalties');
            }
            
            if (clientProfile.project_complexity === 'high') {
                suggestions.clauses.push('Include detailed milestone definitions');
                suggestions.clauses.push('Add change order procedures');
            }
        }

        return suggestions;
    }

    // Generate standard contract clauses
    getStandardClauses() {
        return {
            payment_structures: [
                'Fixed price: ${{amount}} upon completion',
                'Milestone-based: {{milestone_breakdown}}',
                'Hourly: ${{rate}}/hour, invoiced {{frequency}}',
                '50% upfront, 50% upon completion',
                'Net 30 payment terms'
            ],
            
            scope_protection: [
                'Additional features outside scope require separate agreement',
                'Change requests must be submitted in writing',
                'Scope changes may affect timeline and cost',
                'Minor revisions included, major changes billable'
            ],
            
            delivery_terms: [
                'Delivery subject to receipt of required materials',
                'Client feedback required within {{days}} days',
                'Final approval constitutes project acceptance',
                'Force majeure delays not counted against timeline'
            ],
            
            ownership_options: [
                'Work for hire: Client owns all work product',
                'License: Freelancer retains copyright, client gets usage rights',
                'Shared: Joint ownership of developed materials',
                'Portfolio: Freelancer may use work for portfolio/marketing'
            ],
            
            liability_limitations: [
                'Liability limited to project fee amount',
                'No liability for indirect or consequential damages',
                'Client responsible for backup and data security',
                'Errors corrected at no charge during warranty period'
            ]
        };
    }

    // Risk assessment for contract terms
    assessContractRisk(contractTerms) {
        const risks = [];
        
        // Payment risk assessment
        if (!contractTerms.upfront_payment || contractTerms.upfront_payment < 25) {
            risks.push({
                type: 'payment',
                level: 'medium',
                description: 'No upfront payment increases cash flow risk',
                mitigation: 'Consider requesting 25-50% upfront payment'
            });
        }
        
        if (contractTerms.payment_terms > 30) {
            risks.push({
                type: 'payment',
                level: 'high',
                description: 'Extended payment terms increase collection risk',
                mitigation: 'Negotiate shorter payment terms or add late fees'
            });
        }
        
        // Scope risk assessment
        if (!contractTerms.scope_change_process) {
            risks.push({
                type: 'scope',
                level: 'high',
                description: 'No scope change process defined',
                mitigation: 'Add detailed change order procedures'
            });
        }
        
        if (!contractTerms.revision_limits) {
            risks.push({
                type: 'scope',
                level: 'medium',
                description: 'Unlimited revisions may impact profitability',
                mitigation: 'Limit revisions to 2-3 rounds'
            });
        }
        
        // Liability risk assessment
        if (!contractTerms.liability_limitation) {
            risks.push({
                type: 'liability',
                level: 'high',
                description: 'No liability limitation clause',
                mitigation: 'Add liability cap equal to project value'
            });
        }
        
        return risks;
    }

    // Generate contract checklist
    generateContractChecklist() {
        return {
            essential_clauses: [
                { item: 'Project scope clearly defined', checked: false },
                { item: 'Deliverables list specified', checked: false },
                { item: 'Timeline and milestones set', checked: false },
                { item: 'Payment terms and schedule', checked: false },
                { item: 'Change order process defined', checked: false },
                { item: 'Intellectual property rights', checked: false },
                { item: 'Termination clauses', checked: false },
                { item: 'Liability limitations', checked: false }
            ],
            
            recommended_additions: [
                { item: 'Force majeure clause', checked: false },
                { item: 'Confidentiality agreement', checked: false },
                { item: 'Dispute resolution method', checked: false },
                { item: 'Governing law specified', checked: false },
                { item: 'Independent contractor clause', checked: false },
                { item: 'Portfolio usage rights', checked: false }
            ],
            
            client_verification: [
                { item: 'Client legal authority verified', checked: false },
                { item: 'Company information accurate', checked: false },
                { item: 'Contact details confirmed', checked: false },
                { item: 'Payment method verified', checked: false }
            ]
        };
    }

    // Save and version control contracts
    saveContract(contract) {
        const contractId = contract.id;
        
        if (this.savedContracts.has(contractId)) {
            const existing = this.savedContracts.get(contractId);
            existing.versions = existing.versions || [];
            existing.versions.push({
                ...contract,
                versionNumber: existing.versions.length + 1,
                savedDate: new Date()
            });
        } else {
            this.savedContracts.set(contractId, {
                ...contract,
                versions: []
            });
        }
        
        return contractId;
    }

    // Export contract to different formats
    exportContract(contractId, format = 'markdown') {
        const contract = this.savedContracts.get(contractId);
        if (!contract) {
            throw new Error('Contract not found');
        }
        
        switch (format) {
            case 'markdown':
                return this.exportToMarkdown(contract);
            case 'pdf':
                return this.exportToPDF(contract);
            case 'docx':
                return this.exportToDocx(contract);
            default:
                return contract.contractText;
        }
    }

    exportToMarkdown(contract) {
        return `# ${contract.variables?.project_name || 'Contract'}

**Generated:** ${contract.createdDate?.toLocaleDateString()}
**Template:** ${contract.templateName}

---

${contract.contractText}

---

*Generated by Cortex Freelancer Contract System*`;
    }

    // Integration with OpenClaw for contract delivery
    async sendContract(contractId, sessionKey = null) {
        const contract = this.savedContracts.get(contractId);
        if (!contract) {
            throw new Error('Contract not found');
        }

        const message = `📄 **Contract Generated**

**Project:** ${contract.variables?.project_name || 'Freelance Project'}
**Client:** ${contract.variables?.client_name || '[Client]'}
**Template:** ${contract.templateName}

**Contract Preview:**
\`\`\`
${contract.contractText.substring(0, 500)}...
\`\`\`

**Next Steps:**
1. Review contract terms
2. Customize if needed
3. Send to client for signature
4. Track negotiation progress

*Full contract available for download*`;

        if (sessionKey) {
            console.log(`Sending contract to session: ${sessionKey}`);
            return message;
        } else {
            console.log(message);
            return message;
        }
    }
}

module.exports = { ContractManager };