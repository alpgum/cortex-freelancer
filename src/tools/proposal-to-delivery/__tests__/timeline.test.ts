import { TimelineService } from '../src/timeline';
import { ProposalToDeliveryEngine } from '../src/workflow-engine';
import { SAMPLE_PROPOSAL } from './fixtures';
import { WorkflowConfig } from '../src/types';

const CONFIG: WorkflowConfig = {
  autoGenerateContract: true,
  autoCreateMilestones: true,
  autoNotify: false,
  defaultCurrency: 'USD',
  defaultRevisionRounds: 2,
  qualityCheckRequired: true,
  notificationChannels: ['in_app'],
  timeoutEscalation: true,
};

describe('TimelineService', () => {
  test('computes variance without crashing', async () => {
    const engine = new ProposalToDeliveryEngine(CONFIG);
    const wf = engine.createWorkflowFromProposal(SAMPLE_PROPOSAL);
    await engine.processDueAutomations(wf, 'test');

    const timeline = new TimelineService();
    const analysis = timeline.computeVariance(wf);
    expect(analysis.projectedCompletionDate).toBeTruthy();
    expect(typeof analysis.isOnTrack).toBe('boolean');
  });
});
