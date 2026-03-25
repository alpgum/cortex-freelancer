const { analyzeOne } = require('../engine');

function te({ project, task, seconds, billable = true, tags = [], notes = '' }) {
  return {
    id: 'TIME-1',
    project,
    task,
    start_time: '2026-03-20T09:00:00.000Z',
    end_time: '2026-03-20T10:00:00.000Z',
    duration_seconds: seconds,
    entry_type: 'manual',
    tags,
    is_billable: billable,
    notes,
    created_at: '2026-03-20T10:00:00.000Z',
  };
}

describe('CFX-075 scope creep detection', () => {
  test('high risk: overruns + revisions + new deliverables + urgency + unpaid', () => {
    const workflow = {
      id: 'wf-1',
      projectName: 'Website Redesign',
      clientId: 'client-1',
      clientName: 'Acme',
      currentStage: 'revisions',
      createdAt: '2026-03-10T00:00:00.000Z',
      contract: { terms: { revisionRounds: 1, deliverables: ['Homepage', 'About page'], scope: 'Redesign website' } },
      stageHistory: [
        { id: 't1', from: 'client_review', to: 'revisions', timestamp: '2026-03-18T00:00:00.000Z', conditionsMet: [] },
        { id: 't2', from: 'client_review', to: 'revisions', timestamp: '2026-03-20T00:00:00.000Z', conditionsMet: [] },
        { id: 't3', from: 'client_review', to: 'revisions', timestamp: '2026-03-22T00:00:00.000Z', conditionsMet: [] },
      ],
      timeline: {
        estimatedStartDate: '2026-03-10',
        estimatedEndDate: '2026-03-24',
        estimatedTotalHours: 10,
        actualTotalHours: 18,
      },
      milestones: [],
    };

    const timeEntries = [
      te({ project: 'Website Redesign', task: 'Design work', seconds: 8 * 3600 }),
      te({ project: 'Website Redesign', task: 'Client call', seconds: 2 * 3600, tags: ['meeting'] }),
      te({ project: 'Website Redesign', task: 'Extra tweak (non-billable)', seconds: 1.5 * 3600, billable: false, notes: 'quick change request' }),
    ];

    const communications = {
      messages: [],
      responses: [
        { id: 'r1', clientId: 'client-1', respondedAt: '2026-03-19T00:00:00.000Z', notes: 'Can you also add a new landing page? ASAP by Friday.' },
        { id: 'r2', clientId: 'client-1', respondedAt: '2026-03-21T00:00:00.000Z', notes: 'Another quick revision: change the hero and add one more section.' },
      ]
    };

    const milestoneEvents = [
      { workflowId: 'wf-1', type: 'deliverable_added', timestamp: '2026-03-19T00:00:00.000Z', details: { deliverable: 'Landing page' } }
    ];

    const result = analyzeOne({ workflow, timeEntries, communications, milestoneEvents });

    expect(result.riskScore).toBeGreaterThanOrEqual(60);
    expect(result.severity).toBe('high');

    const driverIds = result.drivers.map(d => d.id);
    expect(driverIds).toContain('time_overrun');
    expect(driverIds).toContain('revisions');
  });

  test('low risk: within plan and no change signals', () => {
    const workflow = {
      id: 'wf-2',
      projectName: 'API Cleanup',
      clientId: 'client-2',
      clientName: 'Beta',
      currentStage: 'in_progress',
      createdAt: '2026-03-10T00:00:00.000Z',
      contract: { terms: { revisionRounds: 2, deliverables: ['Refactor endpoints'], scope: 'Cleanup' } },
      stageHistory: [],
      timeline: {
        estimatedStartDate: '2026-03-10',
        estimatedEndDate: '2026-04-10',
        estimatedTotalHours: 20,
        actualTotalHours: 9,
      },
      milestones: [],
    };

    const timeEntries = [
      te({ project: 'API Cleanup', task: 'Refactor', seconds: 9 * 3600 }),
    ];

    const communications = { messages: [], responses: [] };
    const milestoneEvents = [];

    const result = analyzeOne({ workflow, timeEntries, communications, milestoneEvents });

    expect(result.riskScore).toBeLessThan(30);
    expect(result.severity).toBe('low');
  });
});
