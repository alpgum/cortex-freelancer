import { MilestoneIntegration } from '../src/milestone-integration';
import { ContractGenerator } from '../src/contract-generator';
import { SAMPLE_PROPOSAL } from './fixtures';

describe('MilestoneIntegration', () => {
  test('creates milestones from proposal deliverables', () => {
    const mg = new MilestoneIntegration();
    const cg = new ContractGenerator();
    const contract = cg.generateFromProposal(SAMPLE_PROPOSAL);

    const milestones = mg.createFromProposal(SAMPLE_PROPOSAL, contract.terms.paymentSchedule);
    expect(milestones.length).toBe(SAMPLE_PROPOSAL.deliverables.length);

    const progress = mg.getProgress(milestones);
    expect(progress.totalEstimatedHours).toBeGreaterThan(0);
    expect(progress.percentComplete).toBe(0);

    const next = mg.getNextMilestone(milestones);
    expect(next?.order).toBe(1);
  });
});
