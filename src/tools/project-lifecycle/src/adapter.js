/**
 * Adapter interface for plugging Sprint-2 tools.
 *
 * The engine calls adapter methods at stage entry / automations.
 * Default adapter is offline-safe: it simulates outputs.
 */

function nowIso() {
  return new Date().toISOString();
}

function makeDefaultAdapter() {
  return {
    async crmUpsertLead({ project }) {
      return { ok: true, tool: 'crm', action: 'upsertLead', at: nowIso(), project };
    },

    async analyzeJob({ project }) {
      return { ok: true, tool: 'job-analyzer', action: 'analyze', at: nowIso(), summary: 'Simulated job analysis', project };
    },

    async calculateRate({ project }) {
      return { ok: true, tool: 'rate-calculator', action: 'calculate', at: nowIso(), rate: project.value ? Math.max(50, Math.round(project.value / 100)) : 75, project };
    },

    async generateProposal({ project }) {
      return { ok: true, tool: 'proposal-generator', action: 'generate', at: nowIso(), file: `proposals/${project.projectId || 'project'}.md`, project };
    },

    async sendClientMessage({ project, templateId, subject, body }) {
      return { ok: true, tool: 'client-communication', action: 'send', at: nowIso(), templateId, subject, body, project };
    },

    async generateContract({ project }) {
      return { ok: true, tool: 'contract-templates', action: 'generate', at: nowIso(), file: `contracts/${project.projectId || 'project'}-sow.md`, project };
    },

    async createMilestones({ project }) {
      return { ok: true, tool: 'milestone-manager', action: 'create', at: nowIso(), milestones: [{ id: 'm1', title: 'Milestone 1', due: null }], project };
    },

    async generateInvoice({ project }) {
      return { ok: true, tool: 'invoice-automation', action: 'generate', at: nowIso(), invoiceId: `INV-${Date.now()}`, project };
    },

    async checkOverdueMilestones({ project, state }) {
      // Offline stub: none overdue.
      return { ok: true, tool: 'milestone-manager', action: 'overdueCheck', at: nowIso(), overdue: [], projectId: project.projectId, stateVersion: state.version };
    },

    async checkOverdueInvoices({ project, state }) {
      return { ok: true, tool: 'invoice-automation', action: 'overdueCheck', at: nowIso(), overdue: [], projectId: project.projectId, stateVersion: state.version };
    }
  };
}

module.exports = {
  makeDefaultAdapter
};
