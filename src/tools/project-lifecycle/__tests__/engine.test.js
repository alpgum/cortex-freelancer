const test = require('node:test');
const assert = require('node:assert/strict');

const { defaultWorkflowDefinition } = require('../src/workflow');
const {
  createInitialState,
  completeTask,
  advanceStage,
  nextBestActions
} = require('../src/engine');

function makeState() {
  const workflow = defaultWorkflowDefinition();
  const state = createInitialState({
    workflow,
    project: { projectId: 'acme', projectName: 'Acme', createdAt: new Date().toISOString() }
  });
  return { workflow, state };
}

test('cannot advance if required tasks incomplete', () => {
  const { workflow, state } = makeState();
  assert.equal(state.stage, 'lead');

  assert.throws(() => advanceStage({ state, workflow }), (e) => {
    assert.equal(e.code, 'BLOCKED');
    assert.ok(Array.isArray(e.blockers));
    return true;
  });
});

test('complete required task enables advancing', () => {
  const { workflow, state } = makeState();

  completeTask({ state, workflow, taskId: 'capture_lead' });
  const res = advanceStage({ state, workflow });

  assert.equal(res.from, 'lead');
  assert.equal(res.to, 'qualification');
  assert.equal(state.stage, 'qualification');
});

test('nextBestActions prioritizes blockers then advance', () => {
  const { workflow, state } = makeState();
  const a1 = nextBestActions(state, workflow);
  assert.equal(a1[0].kind, 'complete_task');

  completeTask({ state, workflow, taskId: 'capture_lead' });
  const a2 = nextBestActions(state, workflow);
  assert.equal(a2[0].kind, 'advance_stage');
});
