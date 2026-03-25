/**
 * Cortex Freelancer - Contract Template System Exports
 * 
 * This file provides the main export interface for the contract template system
 * to integrate with the broader Cortex Freelancer application.
 */

const ContractTemplateSystem = require('./index.js');
const { ContractManager, createManager, createSystem } = require('./module.js');

/**
 * Main export interface for Cortex Freelancer integration
 */
class CortexContractSystem {
    constructor() {
        this.system = new ContractTemplateSystem();
        this.manager = new ContractManager();
    }

    /**
     * Quick contract generation for the Cortex dashboard
     */
    async generateQuickContract(type, clientData, projectData) {
        return await this.manager.createContract(type, clientData, projectData);
    }

    /**
     * Risk assessment for contract review
     */
    async assessContractRisk(filePath) {
        return await this.manager.assessRisk(filePath);
    }

    /**
     * Get recommendations for contract setup
     */
    async getContractRecommendations(projectType, clientTier, budget) {
        return await this.manager.getRecommendations(projectType, clientTier, budget);
    }

    /**
     * Portfolio analysis for dashboard metrics
     */
    async analyzeContractPortfolio(contractPaths) {
        return await this.manager.analyzePortfolio(contractPaths);
    }

    /**
     * Get available templates for UI selection
     */
    getTemplateOptions() {
        return this.manager.getAvailableTemplates();
    }

    /**
     * Get clause library for contract customization
     */
    async getClauseOptions() {
        return await this.manager.getClauseLibrary();
    }

    /**
     * Generate contract with CRM integration
     */
    async generateFromCRM(crmData) {
        const { client, project, settings } = crmData;
        
        // Determine best contract type
        const recommendations = await this.getContractRecommendations(
            project.type,
            client.tier || 'new',
            project.budget
        );
        
        const contractType = recommendations.contractType;
        
        // Build contract options
        const contractOptions = {
            client: client.name || client.company,
            freelancer: settings.freelancerName || 'Cortex Freelancer User',
            project: project.title,
            value: project.budget,
            currency: project.currency || 'USD',
            paymentTerms: recommendations.paymentTerms,
            jurisdiction: settings.jurisdiction,
            clauses: recommendations.clauses
        };
        
        const contract = await this.system.generateContract(contractType, contractOptions);
        
        // Add risk assessment
        const riskAssessment = await this.system.analyzeContract(contract.path);
        
        return {
            contract,
            riskAssessment,
            recommendations,
            crmIntegration: {
                clientId: client.id,
                projectId: project.id,
                generatedAt: new Date().toISOString()
            }
        };
    }

    /**
     * CLI access for development and testing
     */
    getCLI() {
        return this.system;
    }
}

// Export both individual components and the unified system
module.exports = {
    // Unified system for Cortex integration
    CortexContractSystem,
    
    // Individual components for flexible usage
    ContractTemplateSystem,
    ContractManager,
    
    // Factory functions
    createContractSystem: () => new CortexContractSystem(),
    createManager,
    createSystem,
    
    // Direct access to core functionality
    generateContract: async (type, options) => {
        const system = new ContractTemplateSystem();
        return await system.generateContract(type, options);
    },
    
    analyzeContract: async (filePath) => {
        const system = new ContractTemplateSystem();
        return await system.analyzeContract(filePath);
    },
    
    compareContracts: async (file1, file2) => {
        const system = new ContractTemplateSystem();
        return await system.compareContracts(file1, file2);
    }
};

// Make the unified system the default export
module.exports.default = CortexContractSystem;