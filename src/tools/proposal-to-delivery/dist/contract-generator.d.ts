/**
 * Contract Auto-Generation
 *
 * Generates contracts from proposals using templates.
 * Integrates with the existing contract-template-system (CFX-060).
 */
import { ContractInfo, ProposalInput } from './types';
export interface ContractTemplate {
    id: string;
    name: string;
    projectType: 'fixed' | 'hourly' | 'retainer';
    sections: ContractSection[];
}
interface ContractSection {
    title: string;
    content: string;
    variables: string[];
}
export declare class ContractGenerator {
    /**
     * Generate a contract from a proposal.
     */
    generateFromProposal(proposal: ProposalInput): ContractInfo;
    /**
     * Build contract terms from proposal data.
     */
    private buildContractTerms;
    /**
     * Build payment schedule based on proposal structure.
     */
    private buildPaymentSchedule;
    /**
     * Build milestone-based payment schedule.
     */
    private buildMilestonePayments;
    /**
     * Render contract to markdown.
     */
    renderToMarkdown(contract: ContractInfo, proposal: ProposalInput): string;
    private buildVariableMap;
    private renderGenericContract;
    /**
     * Get available template types.
     */
    getTemplateTypes(): string[];
}
export {};
//# sourceMappingURL=contract-generator.d.ts.map