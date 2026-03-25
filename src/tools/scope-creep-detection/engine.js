const {
  loadTimeEntries,
  loadP2DWorkflows,
  loadCommunications,
  loadMilestoneEvents,
  defaultProjectRoot,
} = require('./loaders');

const signals = require('./signals');
const { scoreScopeCreep } = require('./scoring');
const { recommendationsFor } = require('./recommendations');
const { toIso } = require('./utils');

function selectWorkflows(workflows, { workflowId = null, projectName = null } = {}) {
  let ws = workflows || [];
  if (workflowId) {
    ws = ws.filter(w => w && w.id === workflowId);
  } else if (projectName) {
    const needle = String(projectName).toLowerCase();
    ws = ws.filter(w => String(w.projectName || '').toLowerCase().includes(needle));
  }
  return ws;
}

function analyzeOne({ workflow, timeEntries, communications, milestoneEvents, weights }) {
  const projectName = workflow?.projectName || null;

  const extracted = [
    signals.timeOverrunSignal({ timeEntries, workflow, projectName }),
    signals.meetingOverheadSignal({ timeEntries, projectName }),
    signals.changeRequestsSignal({ workflow, communications }),
    signals.newDeliverablesSignal({ workflow, communications, milestoneEvents }),
    signals.revisionsSignal({ workflow, communications }),
    signals.unpaidWorkSignal({ timeEntries, projectName }),
    signals.timelineCompressionSignal({ workflow, communications }),
    signals.milestoneChurnSignal({ workflow, milestoneEvents }),
  ];

  const scored = scoreScopeCreep(extracted, weights);
  const recommendedActions = recommendationsFor({ workflow, scored });

  return {
    generatedAt: toIso(new Date()),
    workflow: {
      id: workflow?.id,
      proposalId: workflow?.proposalId,
      projectName: workflow?.projectName,
      clientId: workflow?.clientId,
      clientName: workflow?.clientName,
      currentStage: workflow?.currentStage,
    },
    riskScore: scored.riskScore,
    severity: scored.severity,
    drivers: scored.signals.slice(0, 3).map(s => ({
      id: s.id,
      label: s.label,
      score: s.score,
      weight: s.weight,
      contribution: Math.round((s.contribution || 0) * 10) / 10,
      summary: s.summary,
    })),
    signals: scored.signals,
    recommendedActions,
  };
}

/**
 * Analyze scope creep risk.
 *
 * By default loads:
 * - time tracking entries (repo/data/time_tracking/time_entries.json)
 * - p2d workflows (~/.cortex-freelancer/p2d/workflows.json)
 * - communications (~/.cortex-freelancer/communications/*.json)
 * - milestone events (~/.cortex-freelancer/scope-creep/milestone-events.json)
 */
function analyzeScopeCreep(opts = {}) {
  const {
    workflowId = null,
    projectName = null,
    projectRoot = defaultProjectRoot(),
    weights = null,
  } = opts;

  const time = loadTimeEntries({ projectRoot });
  const p2d = loadP2DWorkflows();
  const comms = loadCommunications();
  const mile = loadMilestoneEvents();

  const selected = selectWorkflows(p2d.workflows, { workflowId, projectName });

  const results = selected.map(w => analyzeOne({
    workflow: w,
    timeEntries: time.entries,
    communications: comms,
    milestoneEvents: mile.events,
    weights,
  }));

  return {
    generatedAt: toIso(new Date()),
    selection: { workflowId, projectName },
    sources: {
      timeEntriesFile: time.file,
      workflowsFile: p2d.file,
      communicationsBase: comms.base,
      milestoneEventsFile: mile.file,
    },
    results,
  };
}

module.exports = {
  analyzeScopeCreep,
  selectWorkflows,
  analyzeOne,
};
