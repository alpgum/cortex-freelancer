/**
 * Contract Template System Module Export
 *
 * Clean module interface for integration with Cortex Freelancer
 */

const ContractTemplateSystem = require('./index.js');

// Create and export a singleton instance for the application
const contractSystem = new ContractTemplateSystem();

/**
 * High-level API for common contract operations
 */
class ContractManager {
    constructor() {
        this.system = contractSystem;
    }

    /**
     * Quick contract generation with sensible defaults
     */
    async createContract(type, clientData, projectData, options = {}) {
        const contractOptions = {
            client: clientData.name || clientData.company,
            freelancer: options.freelancer || 'Cortex Freelancer User',
            project: projectData.title || projectData.description,
            value: projectData.budget || projectData.value,
            currency: projectData.currency || options.currency || 'USD',
            paymentTerms: options.paymentTerms || 'Net 30 days',
            jurisdiction: options.jurisdiction || '[JURISDICTION]',
            startDate: projectData.startDate,
            endDate: projectData.endDate,
            clauses: options.clauses || []
        };

        return this.system.generateContract(type, contractOptions);
    }

    /**
     * Analyze contract and return simplified risk report
     */
    async assessRisk(contractPath) {
        const analysis = await this.system.analyzeContract(contractPath);

        return {
            score: analysis.fairnessScore,
            level: this._getRiskLevel(analysis.fairnessScore),
            risks: analysis.riskFactors,
            missing: analysis.missingClauses,
            recommendations: analysis.suggestions.slice(0, 3), // Top 3
            summary: this._generateRiskSummary(analysis)
        };
    }

    /**
     * Get contract recommendations based on project type and client data
     */
    async getRecommendations(projectType, clientTier, projectBudget) {
        const recommendations = {
            contractType: this._recommendContractType(projectType, projectBudget),
            clauses: [],
            paymentTerms: this._recommendPaymentTerms(clientTier, projectBudget),
            protections: []
        };

        // Recommend clauses based on project characteristics
        if (projectBudget > 10000) {
            recommendations.clauses.push('upfront-50', 'milestone-based');
            recommendations.protections.push('liability-cap-contract');
        }

        if (clientTier === 'new' || clientTier === 'unknown') {
            recommendations.clauses.push('net-15', 'ip-transfer-on-payment');
            recommendations.protections.push('termination-for-cause');
        }

        if (projectType === 'development' || projectType === 'design') {
            recommendations.clauses.push('work-for-hire');
        }

        return recommendations;
    }

    /**
     * Bulk contract analysis for portfolio management
     */
    async analyzePortfolio(contractPaths) {
        const summary = await this.system.getRiskSummary(contractPaths);

        return {
            totalContracts: summary.totalContracts,
            averageScore: summary.averageFairnessScore,
            riskLevel: this._getRiskLevel(summary.averageFairnessScore),
            commonIssues: Object.entries(summary.commonRisks)
                .map(([issue, count]) => ({ issue, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5),
            recommendations: summary.recommendations
        };
    }

    /**
     * Get contract templates with metadata
     */
    getAvailableTemplates() {
        return this.system.contractTypes.map(type => ({
            type,
            name: this._getTemplateName(type),
            description: this._getTemplateDescription(type),
            bestFor: this._getTemplateUseCase(type),
            riskLevel: this._getTemplateRiskLevel(type)
        }));
    }

    /**
     * Get clause library with categorization
     */
    async getClauseLibrary() {
        const clauses = await this.system.listClauses();

        return Object.entries(clauses).map(([category, clauseSet]) => ({
            category,
            displayName: this._getCategoryDisplayName(category),
            clauses: Object.entries(clauseSet).map(([id, clause]) => ({
                id,
                title: clause.title,
                description: `${clause.content.substring(0, 100)}...`,
                riskLevel: clause.riskLevel,
                recommended: this._isClauseRecommended(id)
            }))
        }));
    }

    // Private helper methods
    _getRiskLevel(score) {
        if (score >= 80) { return 'low'; }
        if (score >= 60) { return 'medium'; }
        if (score >= 40) { return 'high'; }
        return 'critical';
    }

    _generateRiskSummary(analysis) {
        const { fairnessScore, riskFactors, missingClauses } = analysis;

        let summary = `Contract fairness: ${fairnessScore}/100 (${this._getRiskLevel(fairnessScore)} risk). `;

        if (riskFactors.length > 0) {
            summary += `${riskFactors.length} risk factors identified. `;
        }

        if (missingClauses.length > 0) {
            summary += `Missing ${missingClauses.length} critical clauses. `;
        }

        if (fairnessScore < 60) {
            summary += 'Consider revising terms for better protection.';
        }

        return summary.trim();
    }

    _recommendContractType(projectType, budget) {
        if (budget && budget < 1000) { return 'hourly'; }
        if (projectType === 'consultation' || projectType === 'advice') { return 'hourly'; }
        if (projectType === 'ongoing' || projectType === 'maintenance') { return 'retainer'; }
        return 'fixed-price';
    }

    _recommendPaymentTerms(clientTier, budget) {
        if (clientTier === 'new' || budget < 5000) { return 'Net 15 days'; }
        if (clientTier === 'enterprise') { return 'Net 30 days'; }
        return 'Net 30 days';
    }

    _getTemplateName(type) {
        const names = {
            'fixed-price': 'Fixed-Price Project Contract',
            'hourly': 'Hourly Service Agreement',
            'retainer': 'Monthly Retainer Agreement',
            'nda': 'Non-Disclosure Agreement',
            'sow': 'Statement of Work',
            'subcontractor': 'Subcontractor Agreement'
        };
        return names[type] || type;
    }

    _getTemplateDescription(type) {
        const descriptions = {
            'fixed-price': 'Complete project for a set price with defined deliverables',
            'hourly': 'Time-based work with flexible scope and regular billing',
            'retainer': 'Ongoing monthly arrangement with included hours',
            'nda': 'Confidentiality protection for sensitive projects',
            'sow': 'Detailed project scope and requirements document',
            'subcontractor': 'Agreement for delegating work to third parties'
        };
        return descriptions[type] || 'Contract template';
    }

    _getTemplateUseCase(type) {
        const useCases = {
            'fixed-price': 'Websites, apps, defined scope projects',
            'hourly': 'Consulting, maintenance, flexible scope work',
            'retainer': 'Ongoing support, regular monthly work',
            'nda': 'Any project involving confidential information',
            'sow': 'Complex projects requiring detailed specifications',
            'subcontractor': 'When you need to hire other freelancers'
        };
        return useCases[type] || 'General use';
    }

    _getTemplateRiskLevel(type) {
        const riskLevels = {
            'fixed-price': 'medium',
            'hourly': 'low',
            'retainer': 'low',
            'nda': 'low',
            'sow': 'low',
            'subcontractor': 'medium'
        };
        return riskLevels[type] || 'medium';
    }

    _getCategoryDisplayName(category) {
        const displayNames = {
            'payment': 'Payment Terms',
            'ip-ownership': 'Intellectual Property',
            'termination': 'Contract Termination',
            'liability': 'Liability & Risk',
            'dispute-resolution': 'Dispute Resolution',
            'non-compete': 'Non-Compete & Restrictions'
        };
        return displayNames[category] || category;
    }

    _isClauseRecommended(clauseId) {
        const recommended = [
            'net-15', 'upfront-50', 'milestone-based',
            'ip-transfer-on-payment', 'termination-14-days',
            'liability-cap-contract'
        ];
        return recommended.includes(clauseId);
    }
}

// Export both the core system and the high-level manager
module.exports = {
    ContractTemplateSystem,
    ContractManager,
    // Convenience exports
    createManager: () => new ContractManager(),
    createSystem: () => new ContractTemplateSystem()
};