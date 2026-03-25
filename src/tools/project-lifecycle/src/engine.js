const { defaultWorkflowDefinition } = require('./workflow');

function createInitialState({ workflow = defaultWorkflowDefinition(), project }) {
  const stage = workflow.initialStage;
  const tasks = (workflow.tasksByStage[stage] || []).map((t) => ({
    ...t,
    status: 'todo',
    completedAt: null
  }));

  return {
    version: 1,
    workflowId: workflow.id,
    workflowVersion: workflow.version,
    project,
    stage,
    history: [{ at: new Date().toISOString(), type: 'init', stage }],
    tasksByStage: {
      [stage]: tasks
    },
    toolRuns: []
  };
}

function ensureStageTasks(state, workflow, stage) {
  if (!state.tasksByStage) state.tasksByStage = {};
  if (state.tasksByStage[stage]) return;
  state.tasksByStage[stage] = (workflow.tasksByStage[stage] || []).map((t) => ({
    ...t,
    status: 'todo',
    completedAt: null
  }));
}

function stageRequiredTasksDone(state, stage) {
  const tasks = (state.tasksByStage && state.tasksByStage[stage]) || [];
  return tasks
    .filter((t) => t.required)
    .every((t) => t.status === 'done');
}

function blockersForStage(state, stage) {
  const tasks = (state.tasksByStage && state.tasksByStage[stage]) || [];
  return tasks
    .filter((t) => t.required && t.status !== 'done')
    .map((t) => ({ id: t.id, title: t.title }));
}

function nextBestActions(state, workflow) {
  const stage = state.stage;
  ensureStageTasks(state, workflow, stage);

  const blockers = blockersForStage(state, stage);
  const actions = [];

  // Prioritize required tasks first.
  for (const b of blockers) {
    actions.push({
      kind: 'complete_task',
      stage,
      taskId: b.id,
      title: `Complete: ${b.title}`
    });
  }

  // If no blockers, suggest advancing.
  if (actions.length === 0) {
    const nextStages = workflow.transitions[stage] || [];
    if (nextStages.length > 0) {
      actions.push({
        kind: 'advance_stage',
        from: stage,
        to: nextStages[0],
        title: `Advance to: ${nextStages[0]}`
      });
    } else {
      actions.push({ kind: 'done', title: 'Lifecycle complete' });
    }
  }

  return actions;
}

async function runStageEntryAutomations({ state, workflow, adapter }) {
  const stage = state.stage;
  const project = state.project;

  const runs = [];

  // Minimal, safe mappings. These are best-effort: failures become recommendations.
  try {
    if (stage === 'lead') {
      runs.push(await adapter.crmUpsertLead({ project }));
    }
    if (stage === 'qualification') {
      runs.push(await adapter.analyzeJob({ project }));
      runs.push(await adapter.calculateRate({ project }));
    }
    if (stage === 'proposal') {
      runs.push(await adapter.generateProposal({ project }));
    }
    if (stage === 'contract') {
      runs.push(await adapter.generateContract({ project }));
    }
    if (stage === 'kickoff') {
      runs.push(await adapter.sendClientMessage({
        project,
        templateId: 'kickoff',
        subject: `Kickoff: ${project.projectName}`,
        body: 'Simulated kickoff email. Replace with real template + client comm tool.'
      }));
      runs.push(await adapter.createMilestones({ project }));
    }
    if (stage === 'invoicing') {
      runs.push(await adapter.generateInvoice({ project }));
    }
  } catch (e) {
    runs.push({ ok: false, error: String(e && e.message ? e.message : e), stage, at: new Date().toISOString() });
  }

  state.toolRuns.push(...runs);
  state.history.push({ at: new Date().toISOString(), type: 'stage_entry_automations', stage, count: runs.length });

  return runs;
}

function completeTask({ state, workflow, taskId, stage = state.stage }) {
  ensureStageTasks(state, workflow, stage);
  const tasks = state.tasksByStage[stage];
  const t = tasks.find((x) => x.id === taskId);
  if (!t) {
    const err = new Error(`Unknown taskId: ${taskId} (stage: ${stage})`);
    err.code = 'UNKNOWN_TASK';
    throw err;
  }
  if (t.status !== 'done') {
    t.status = 'done';
    t.completedAt = new Date().toISOString();
    state.history.push({ at: new Date().toISOString(), type: 'task_done', stage, taskId });
    state.version += 1;
  }
  return t;
}

function advanceStage({ state, workflow, toStage = null, force = false }) {
  const from = state.stage;
  const allowed = workflow.transitions[from] || [];
  const target = toStage || allowed[0];

  if (!target) {
    const err = new Error(`No next stage from: ${from}`);
    err.code = 'NO_NEXT_STAGE';
    throw err;
  }

  if (!force) {
    if (!allowed.includes(target)) {
      const err = new Error(`Invalid transition: ${from} -> ${target}`);
      err.code = 'INVALID_TRANSITION';
      throw err;
    }
    if (!stageRequiredTasksDone(state, from)) {
      const err = new Error(`Cannot advance. Required tasks incomplete in stage: ${from}`);
      err.code = 'BLOCKED';
      err.blockers = blockersForStage(state, from);
      throw err;
    }
  }

  state.stage = target;
  ensureStageTasks(state, workflow, target);
  state.history.push({ at: new Date().toISOString(), type: 'stage_advance', from, to: target, forced: !!force });
  state.version += 1;

  return { from, to: target };
}

async function runScheduledAutomations({ state, adapter }) {
  const project = state.project;
  const runs = [];

  // Always safe checks.
  runs.push(await adapter.checkOverdueMilestones({ project, state }));
  runs.push(await adapter.checkOverdueInvoices({ project, state }));

  state.toolRuns.push(...runs);
  state.history.push({ at: new Date().toISOString(), type: 'scheduled_automations', count: runs.length });
  state.version += 1;

  return runs;
}

module.exports = {
  createInitialState,
  blockersForStage,
  nextBestActions,
  runStageEntryAutomations,
  completeTask,
  advanceStage,
  runScheduledAutomations
};
