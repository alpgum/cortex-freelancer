"use strict";
/**
 * Delivery Checklist
 *
 * Generates and evaluates delivery readiness checklist items.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeliveryChecklistService = void 0;
const uuid_1 = require("uuid");
class DeliveryChecklistService {
    createDefaultChecklist(config = {}) {
        const includeAccessibility = config.includeAccessibility ?? true;
        const includeSecurity = config.includeSecurity ?? true;
        const includePerformance = config.includePerformance ?? true;
        const items = [
            // Code quality
            { category: 'code_quality', description: 'Linting passes / no critical warnings', status: 'pending', required: true },
            { category: 'testing', description: 'Automated tests pass', status: 'pending', required: true },
            { category: 'documentation', description: 'README / handover docs updated', status: 'pending', required: true },
            // Client requirements
            { category: 'client_requirements', description: 'All proposal deliverables included', status: 'pending', required: true },
            { category: 'client_requirements', description: 'Acceptance criteria met', status: 'pending', required: true },
            // Packaging
            { category: 'packaging', description: 'Deliverables packaged in client-ready format', status: 'pending', required: true },
            { category: 'handover', description: 'Access credentials & handover instructions prepared', status: 'pending', required: true },
            // Optional checks
            ...(includeSecurity
                ? [{ category: 'security', description: 'No secrets committed; security review complete', status: 'pending', required: true }]
                : [{ category: 'security', description: 'Security review skipped (not applicable)', status: 'skipped', required: false }]),
            ...(includePerformance
                ? [{ category: 'performance', description: 'Performance checks completed (if applicable)', status: 'pending', required: false }]
                : []),
            ...(includeAccessibility
                ? [{ category: 'accessibility', description: 'Accessibility checks completed (if applicable)', status: 'pending', required: false }]
                : []),
        ];
        return items.map(item => ({ ...item, id: (0, uuid_1.v4)() }));
    }
    /**
     * Mark an item status.
     */
    updateItem(checklist, itemId, status, checkedBy = 'system', notes) {
        return checklist.map(item => {
            if (item.id !== itemId)
                return item;
            return {
                ...item,
                status,
                checkedAt: new Date().toISOString(),
                checkedBy,
                notes,
            };
        });
    }
    /**
     * Evaluate readiness for delivery.
     */
    isReady(checklist) {
        const missing = checklist.filter(item => item.required && item.status !== 'passed' && item.status !== 'skipped');
        return { ready: missing.length === 0, missing };
    }
    /**
     * Run quality checks automatically (simple heuristics / placeholders).
     * Real integrations can override this behavior.
     */
    runAutoChecks(workflow, checkedBy = 'system') {
        let checklist = workflow.deliveryChecklist;
        let passed = 0;
        let failed = 0;
        let skipped = 0;
        // Placeholder logic: pass all required checks if we have milestones completed.
        const allMilestonesComplete = workflow.milestones.length > 0 && workflow.milestones.every(m => m.status === 'completed');
        checklist = checklist.map(item => {
            if (item.status !== 'pending') {
                if (item.status === 'passed')
                    passed++;
                if (item.status === 'failed')
                    failed++;
                if (item.status === 'skipped')
                    skipped++;
                return item;
            }
            const shouldPass = allMilestonesComplete || item.required === false;
            const newStatus = shouldPass ? 'passed' : 'failed';
            if (newStatus === 'passed')
                passed++;
            else
                failed++;
            return {
                ...item,
                status: newStatus,
                checkedAt: new Date().toISOString(),
                checkedBy,
                notes: shouldPass ? 'Auto-check passed' : 'Auto-check failed: milestones incomplete',
            };
        });
        workflow.deliveryChecklist = checklist;
        workflow.updatedAt = new Date().toISOString();
        return { checklist, passed, failed, skipped };
    }
    groupByCategory(checklist) {
        const grouped = {};
        for (const item of checklist) {
            if (!grouped[item.category])
                grouped[item.category] = [];
            grouped[item.category].push(item);
        }
        return grouped;
    }
}
exports.DeliveryChecklistService = DeliveryChecklistService;
//# sourceMappingURL=delivery-checklist.js.map