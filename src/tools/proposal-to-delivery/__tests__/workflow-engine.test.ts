import { ProposalToDeliveryEngine } from '../src/workflow-engine';
import { SAMPLE_PROPOSAL } from './fixtures';

import { WorkflowConfig } from '../src/types';

const CONFIG: WorkflowConfig = {
  autoGenerateContract: true,
  autoCreateMilestones: true,
  autoNotify: true,
  defaultCurrency: 'USD',
  defaultRevisionRounds: 2,
  qualityCheckRequired: true,
  notificationChannels: ['in_app'], 
  timeoutEscalation: true,
};

describe('ProposalToDeliveryEngine', () => {
  test('auto-progresses from proposal accepted to contract review and generates contract', async () => {
    const engine = new ProposalToDeliveryEngine(CONFIG);
    const wf = engine.createWorkflowFromProposal(SAMPLE_PROPOSAL);

    await engine.processDueAutomations(wf, 'test');

    expect(wf.currentStage).toBe('contract_review');
    expect(wf.contract).toBeDefined();
    expect(wf.contract?.status).toBe('sent');

    // some notifications should have been queued and flushed
    expect(wf.notifications.length).toBeGreaterThan(0);
  });

  test('after contract signed, auto-creates milestones and checklist and moves to in_progress', async () => {
    const engine = new ProposalToDeliveryEngine(CONFIG);
    const wf = engine.createWorkflowFromProposal(SAMPLE_PROPOSAL);

    await engine.processDueAutomations(wf, 'test');
    expect(wf.currentStage).toBe('contract_review');

    engine.markContractSigned(wf);
    engine.advanceStage(wf, 'contract_signed', 'test');
    await engine.processDueAutomations(wf, 'test');

    expect(wf.currentStage).toBe('in_progress');
    expect(wf.milestones.length).toBeGreaterThan(0);
    expect(wf.deliveryChecklist.length).toBeGreaterThan(0);
  });
});
