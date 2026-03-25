"use strict";
/**
 * Contract Auto-Generation
 *
 * Generates contracts from proposals using templates.
 * Integrates with the existing contract-template-system (CFX-060).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContractGenerator = void 0;
const uuid_1 = require("uuid");
const CONTRACT_TEMPLATES = {
    fixed: {
        id: 'fixed-price',
        name: 'Fixed-Price Project Agreement',
        projectType: 'fixed',
        sections: [
            {
                title: 'Project Scope',
                content: 'This agreement covers the delivery of {{projectName}} as described in proposal {{proposalId}}.\n\nScope: {{scope}}',
                variables: ['projectName', 'proposalId', 'scope'],
            },
            {
                title: 'Deliverables',
                content: 'The Freelancer agrees to deliver the following:\n{{deliverablesList}}',
                variables: ['deliverablesList'],
            },
            {
                title: 'Timeline',
                content: 'Work begins on {{startDate}} and is expected to complete by {{endDate}}.\nEstimated effort: {{estimatedHours}} hours.',
                variables: ['startDate', 'endDate', 'estimatedHours'],
            },
            {
                title: 'Payment Terms',
                content: 'Total project value: {{currency}} {{totalValue}}\n\nPayment Schedule:\n{{paymentSchedule}}',
                variables: ['currency', 'totalValue', 'paymentSchedule'],
            },
            {
                title: 'Revisions',
                content: 'This agreement includes {{revisionRounds}} rounds of revisions. Additional revisions will be billed at the agreed hourly rate.',
                variables: ['revisionRounds'],
            },
            {
                title: 'Intellectual Property',
                content: 'Upon full payment, all intellectual property rights transfer to the Client. The Freelancer retains the right to showcase the work in their portfolio.',
                variables: [],
            },
            {
                title: 'Termination',
                content: 'Either party may terminate this agreement with 14 days written notice. Work completed up to termination date will be billed proportionally.',
                variables: [],
            },
        ],
    },
    hourly: {
        id: 'hourly',
        name: 'Hourly Rate Agreement',
        projectType: 'hourly',
        sections: [
            {
                title: 'Project Scope',
                content: 'This agreement covers ongoing work on {{projectName}} as described in proposal {{proposalId}}.\n\nScope: {{scope}}',
                variables: ['projectName', 'proposalId', 'scope'],
            },
            {
                title: 'Rate & Billing',
                content: 'Hourly rate: {{currency}} {{hourlyRate}}\nEstimated total hours: {{estimatedHours}}\nEstimated total: {{currency}} {{totalValue}}\n\nBilling occurs {{billingFrequency}} with net-15 payment terms.',
                variables: ['currency', 'hourlyRate', 'estimatedHours', 'totalValue', 'billingFrequency'],
            },
            {
                title: 'Timeline',
                content: 'Engagement begins {{startDate}} with an estimated end date of {{endDate}}.',
                variables: ['startDate', 'endDate'],
            },
            {
                title: 'Intellectual Property',
                content: 'All work product becomes Client property upon payment for the hours in which it was created.',
                variables: [],
            },
            {
                title: 'Termination',
                content: 'Either party may terminate with 7 days written notice. Outstanding hours will be invoiced at termination.',
                variables: [],
            },
        ],
    },
    retainer: {
        id: 'retainer',
        name: 'Monthly Retainer Agreement',
        projectType: 'retainer',
        sections: [
            {
                title: 'Retainer Scope',
                content: 'This retainer agreement covers {{projectName}} as described in proposal {{proposalId}}.\n\nScope: {{scope}}',
                variables: ['projectName', 'proposalId', 'scope'],
            },
            {
                title: 'Retainer Terms',
                content: 'Monthly retainer: {{currency}} {{monthlyRate}}\nIncluded hours: {{includedHours}} per month\nOverage rate: {{currency}} {{overageRate}}/hour\n\nRetainer period: {{startDate}} to {{endDate}}',
                variables: ['currency', 'monthlyRate', 'includedHours', 'overageRate', 'startDate', 'endDate'],
            },
            {
                title: 'Unused Hours',
                content: 'Unused hours do not roll over to the following month unless agreed in writing.',
                variables: [],
            },
            {
                title: 'Intellectual Property',
                content: 'All work product becomes Client property upon payment of the respective monthly retainer.',
                variables: [],
            },
            {
                title: 'Termination',
                content: 'Either party may terminate with 30 days written notice. The current month retainer is non-refundable.',
                variables: [],
            },
        ],
    },
};
// ─── Contract Generator ────────────────────────────────────────────────
class ContractGenerator {
    /**
     * Generate a contract from a proposal.
     */
    generateFromProposal(proposal) {
        const template = CONTRACT_TEMPLATES[proposal.projectType];
        if (!template) {
            throw new Error(`No contract template for project type: ${proposal.projectType}`);
        }
        const terms = this.buildContractTerms(proposal);
        const now = new Date().toISOString();
        return {
            id: (0, uuid_1.v4)(),
            templateType: proposal.projectType,
            status: 'draft',
            generatedAt: now,
            terms,
        };
    }
    /**
     * Build contract terms from proposal data.
     */
    buildContractTerms(proposal) {
        const paymentSchedule = this.buildPaymentSchedule(proposal);
        return {
            scope: proposal.scope,
            deliverables: proposal.deliverables.map(d => d.name),
            paymentSchedule,
            startDate: proposal.startDate,
            endDate: proposal.endDate,
            revisionRounds: proposal.revisionRounds ?? 2,
            terminationClause: 'Either party may terminate with 14 days written notice.',
            ipOwnership: 'Transfer to client upon full payment.',
        };
    }
    /**
     * Build payment schedule based on proposal structure.
     */
    buildPaymentSchedule(proposal) {
        const items = [];
        const totalValue = proposal.totalValue;
        switch (proposal.paymentStructure) {
            case 'upfront':
                items.push({
                    description: 'Full payment upfront',
                    amount: totalValue,
                    percentage: 100,
                    dueCondition: 'Upon contract signing',
                    status: 'pending',
                });
                break;
            case 'completion':
                items.push({
                    description: 'Full payment on completion',
                    amount: totalValue,
                    percentage: 100,
                    dueCondition: 'Upon project sign-off',
                    status: 'pending',
                });
                break;
            case 'split':
                items.push({
                    description: 'Deposit (50%)',
                    amount: Math.round(totalValue * 0.5 * 100) / 100,
                    percentage: 50,
                    dueCondition: 'Upon contract signing',
                    status: 'pending',
                }, {
                    description: 'Final payment (50%)',
                    amount: Math.round(totalValue * 0.5 * 100) / 100,
                    percentage: 50,
                    dueCondition: 'Upon project sign-off',
                    status: 'pending',
                });
                break;
            case 'milestone':
            default:
                items.push(...this.buildMilestonePayments(proposal));
                break;
        }
        return items;
    }
    /**
     * Build milestone-based payment schedule.
     */
    buildMilestonePayments(proposal) {
        const deliverables = proposal.deliverables;
        if (deliverables.length === 0) {
            // Default: 30/40/30 split
            return [
                {
                    description: 'Project deposit',
                    amount: Math.round(proposal.totalValue * 0.3 * 100) / 100,
                    percentage: 30,
                    dueCondition: 'Upon contract signing',
                    status: 'pending',
                },
                {
                    description: 'Mid-project payment',
                    amount: Math.round(proposal.totalValue * 0.4 * 100) / 100,
                    percentage: 40,
                    dueCondition: 'Upon mid-project milestone completion',
                    status: 'pending',
                },
                {
                    description: 'Final payment',
                    amount: Math.round(proposal.totalValue * 0.3 * 100) / 100,
                    percentage: 30,
                    dueCondition: 'Upon project sign-off',
                    status: 'pending',
                },
            ];
        }
        const totalHours = deliverables.reduce((sum, d) => sum + d.estimatedHours, 0) || 1;
        return deliverables.map((deliverable, index) => {
            const percentage = Math.round((deliverable.estimatedHours / totalHours) * 100);
            const amount = Math.round((deliverable.estimatedHours / totalHours) * proposal.totalValue * 100) / 100;
            return {
                milestoneId: `milestone_${index + 1}`,
                description: `Payment for: ${deliverable.name}`,
                amount,
                percentage,
                dueCondition: `Upon completion of ${deliverable.name}`,
                status: 'pending',
            };
        });
    }
    /**
     * Render contract to markdown.
     */
    renderToMarkdown(contract, proposal) {
        const template = CONTRACT_TEMPLATES[contract.templateType];
        if (!template)
            return this.renderGenericContract(contract, proposal);
        const vars = this.buildVariableMap(contract, proposal);
        const lines = [];
        lines.push(`# ${template.name}`);
        lines.push('');
        lines.push(`**Contract ID:** ${contract.id}`);
        lines.push(`**Generated:** ${contract.generatedAt}`);
        lines.push(`**Status:** ${contract.status}`);
        lines.push('');
        lines.push('---');
        lines.push('');
        for (const section of template.sections) {
            lines.push(`## ${section.title}`);
            lines.push('');
            let content = section.content;
            for (const [key, value] of Object.entries(vars)) {
                content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
            }
            lines.push(content);
            lines.push('');
        }
        lines.push('---');
        lines.push('');
        lines.push('**Client Signature:** _________________________ Date: _________');
        lines.push('');
        lines.push('**Freelancer Signature:** _________________________ Date: _________');
        return lines.join('\n');
    }
    buildVariableMap(contract, proposal) {
        const deliverablesList = contract.terms.deliverables
            .map((d, i) => `${i + 1}. ${d}`)
            .join('\n');
        const paymentSchedule = contract.terms.paymentSchedule
            .map((p, i) => `${i + 1}. ${p.description}: ${proposal.currency || 'USD'} ${p.amount} (${p.percentage}%) — ${p.dueCondition}`)
            .join('\n');
        return {
            projectName: proposal.projectName,
            proposalId: proposal.proposalId,
            scope: contract.terms.scope,
            deliverablesList,
            startDate: contract.terms.startDate,
            endDate: contract.terms.endDate,
            estimatedHours: String(proposal.estimatedHours),
            currency: proposal.currency || 'USD',
            totalValue: String(proposal.totalValue),
            paymentSchedule,
            revisionRounds: String(contract.terms.revisionRounds),
            hourlyRate: String(Math.round(proposal.totalValue / (proposal.estimatedHours || 1))),
            billingFrequency: 'bi-weekly',
            monthlyRate: String(Math.round(proposal.totalValue / 12)),
            includedHours: String(Math.round((proposal.estimatedHours || 160) / 12)),
            overageRate: String(Math.round((proposal.totalValue / (proposal.estimatedHours || 1)) * 1.25)),
        };
    }
    renderGenericContract(contract, proposal) {
        return [
            `# Project Agreement — ${proposal.projectName}`,
            '',
            `**Contract ID:** ${contract.id}`,
            `**Client:** ${proposal.clientName}`,
            `**Date:** ${contract.generatedAt}`,
            '',
            `## Scope`,
            contract.terms.scope,
            '',
            `## Deliverables`,
            ...contract.terms.deliverables.map((d, i) => `${i + 1}. ${d}`),
            '',
            `## Timeline`,
            `Start: ${contract.terms.startDate}`,
            `End: ${contract.terms.endDate}`,
            '',
            `## Payment`,
            `Total: ${proposal.currency || 'USD'} ${proposal.totalValue}`,
            ...contract.terms.paymentSchedule.map((p, i) => `${i + 1}. ${p.description}: ${p.amount}`),
        ].join('\n');
    }
    /**
     * Get available template types.
     */
    getTemplateTypes() {
        return Object.keys(CONTRACT_TEMPLATES);
    }
}
exports.ContractGenerator = ContractGenerator;
//# sourceMappingURL=contract-generator.js.map