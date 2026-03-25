const test = require('node:test');
const assert = require('node:assert/strict');

const { defaultWorkflowDefinition } = require('../src/workflow');
const { createInitialState, runStageEntryAutomations } = require('../src/engine');

// Adapter that records calls
function makeRecordingAdapter(log) {
  return {
    async crmUpsertLead({ project }) { log.push(['crmUpsertLead', project.projectId]); return { ok: true }; },
    async analyzeJob() { log.push(['analyzeJob']); return { ok: true }; },
    async calculateRate() { log.push(['calculateRate']); return { ok: true }; },
    async generateProposal() { log.push(['generateProposal']); return { ok: true }; },
    async sendClientMessage() { log.push(['sendClientMessage']); return { ok: true }; },
    async generateContract() { log.push(['generateContract']); return { ok: true }; },
    async createMilestones() { log.push(['createMilestones']); return { ok: true }; },
    async generateInvoice() { log.push(['generateInvoice']); return { ok: true }; },
    async checkOverdueMilestones() { return { ok: true }; },
    async checkOverdueInvoices() { return { ok: true }; }
  };
}

test('stage entry automations call expected adapter hooks', async () => {
  const workflow = defaultWorkflowDefinition();
  const state = createInitialState({
    workflow,
    project: { projectId: 'acme', projectName: 'Acme', createdAt: new Date().toISOString() }
  });

  const log = [];
  const adapter = makeRecordingAdapter(log);

  await runStageEntryAutomations({ state, workflow, adapter });
  assert.deepEqual(log, [['crmUpsertLead', 'acme']]);

  // Move stage and re-run
  state.stage = 'qualification';
  await runStageEntryAutomations({ state, workflow, adapter });
  assert.ok(log.some((x) => x[0] === 'analyzeJob'));
  assert.ok(log.some((x) => x[0] === 'calculateRate'));
});
