import { WorkflowStateMachine } from '../src/state-machine';
import { Workflow } from '../src/types';

function makeWorkflow(stage: any): Workflow {
  const now = new Date().toISOString();
  return {
    id: 'wf',
    proposalId: 'P',
    projectName: 'Test',
    clientId: 'C',
    clientName: 'Client',
    currentStage: stage,
    stageHistory: [],
    milestones: [],
    deliveryChecklist: [],
    notifications: [],
    automation: { enabled: true, pendingActions: [], completedActions: [] },
    timeline: {
      estimatedStartDate: '2026-01-01',
      estimatedEndDate: '2026-01-10',
      estimatedTotalHours: 10,
      actualTotalHours: 0,
      stageTimings: [],
    },
    metadata: {
      projectType: 'fixed',
      totalValue: 100,
      currency: 'USD',
      tags: [],
      notes: [],
      customFields: {},
    },
    createdAt: now,
    updatedAt: now,
  };
}

describe('WorkflowStateMachine', () => {
  test('disallows invalid transitions', () => {
    const sm = new WorkflowStateMachine();
    const wf = makeWorkflow('proposal_accepted');
    expect(() => sm.transition(wf, 'client_delivery' as any)).toThrow(/not allowed/i);
  });

  test('supports rollback when defined', () => {
    const sm = new WorkflowStateMachine();
    const wf = makeWorkflow('contract_review');
    wf.contract = {
      id: 'c',
      templateType: 'fixed',
      status: 'sent',
      generatedAt: new Date().toISOString(),
      terms: {
        scope: 'x',
        deliverables: [],
        paymentSchedule: [],
        startDate: '2026-01-01',
        endDate: '2026-01-02',
        revisionRounds: 1,
        terminationClause: 't',
        ipOwnership: 'ip',
      },
    };

    const t = sm.rollback(wf, 'tester');
    expect(t.to).toBe('contract_generation');
    expect(wf.currentStage).toBe('contract_generation');
  });
});
