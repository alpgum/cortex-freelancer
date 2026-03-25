#!/usr/bin/env node
/* eslint-disable no-console */

const path = require('path');

const { makeStorage } = require('./src/storage');
const { defaultWorkflowDefinition } = require('./src/workflow');
const {
  createInitialState,
  blockersForStage,
  nextBestActions,
  runStageEntryAutomations,
  completeTask,
  advanceStage,
  runScheduledAutomations
} = require('./src/engine');
const { makeDefaultAdapter } = require('./src/adapter');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        args[key] = true;
      } else {
        args[key] = next;
        i += 1;
      }
    } else {
      args._.push(a);
    }
  }
  return args;
}

function usage() {
  console.log(`
Cortex Lifecycle Automation (CFX-071)

Usage:
  cortex lifecycle init --project <name> [--client <name>] [--job <text>] [--value <number>] [--currency <code>]
  cortex lifecycle status --project <name>
  cortex lifecycle advance --project <name> [--complete <taskId>] [--to <stage>] [--force]
  cortex lifecycle automations (--project <name> | --all)

Stages:
  lead | qualification | proposal | contract | kickoff | delivery | invoicing | payment_followups | closeout | referral_testimonial
`);
}

function formatStatus(state, workflow) {
  const blockers = blockersForStage(state, state.stage);
  const nba = nextBestActions(state, workflow);

  console.log(`\nProject: ${state.project.projectName} (${state.project.projectId})`);
  console.log(`Stage:   ${state.stage}`);
  console.log(`Version: ${state.version}`);

  console.log('\nBlockers:');
  if (blockers.length === 0) console.log('  (none)');
  for (const b of blockers) console.log(`  - ${b.id}: ${b.title}`);

  console.log('\nNext actions:');
  for (const a of nba) console.log(`  - [${a.kind}] ${a.title}`);

  console.log('');
}

async function cmdInit({ projectRoot, args }) {
  const projectName = args.project;
  if (!projectName) {
    usage();
    process.exit(1);
  }

  const storage = makeStorage(projectRoot);
  const projectId = storage.stableIdFromName(projectName);

  const workflow = defaultWorkflowDefinition();
  const state = createInitialState({
    workflow,
    project: {
      projectId,
      projectName,
      clientName: args.client || null,
      jobText: args.job || null,
      value: args.value ? Number(args.value) : null,
      currency: args.currency || null,
      createdAt: new Date().toISOString()
    }
  });

  const adapter = makeDefaultAdapter();
  await runStageEntryAutomations({ state, workflow, adapter });

  const fp = storage.save(projectId, state);
  console.log(`✅ Initialized lifecycle: ${projectId}`);
  console.log(`   Saved: ${fp}`);
}

async function cmdStatus({ projectRoot, args }) {
  const projectName = args.project;
  if (!projectName) {
    usage();
    process.exit(1);
  }

  const storage = makeStorage(projectRoot);
  const projectId = storage.stableIdFromName(projectName);
  const state = storage.load(projectId);
  if (!state) {
    console.error(`❌ No lifecycle found for project: ${projectName} (${projectId})`);
    console.error(`   Expected file in: ${storage.baseDir}`);
    process.exit(1);
  }

  const workflow = defaultWorkflowDefinition();
  formatStatus(state, workflow);
}

async function cmdAdvance({ projectRoot, args }) {
  const projectName = args.project;
  if (!projectName) {
    usage();
    process.exit(1);
  }

  const storage = makeStorage(projectRoot);
  const projectId = storage.stableIdFromName(projectName);
  const state = storage.load(projectId);
  if (!state) {
    console.error(`❌ No lifecycle found for project: ${projectName} (${projectId})`);
    process.exit(1);
  }

  const workflow = defaultWorkflowDefinition();
  const adapter = makeDefaultAdapter();

  try {
    if (args.complete) {
      const t = completeTask({ state, workflow, taskId: args.complete });
      console.log(`✅ Task completed: ${t.id}`);
    }

    if (args.to) {
      const result = advanceStage({
        state,
        workflow,
        toStage: args.to,
        force: !!args.force
      });
      console.log(`✅ Stage advanced: ${result.from} -> ${result.to}${args.force ? ' (forced)' : ''}`);
      await runStageEntryAutomations({ state, workflow, adapter });
    }

    if (!args.complete && !args.to) {
      // Default: attempt to advance to next stage.
      const result = advanceStage({ state, workflow, toStage: null, force: !!args.force });
      console.log(`✅ Stage advanced: ${result.from} -> ${result.to}${args.force ? ' (forced)' : ''}`);
      await runStageEntryAutomations({ state, workflow, adapter });
    }

    storage.save(projectId, state);
    formatStatus(state, workflow);
  } catch (e) {
    console.error(`❌ ${e.message || String(e)}`);
    if (e.code === 'BLOCKED' && e.blockers) {
      console.error('Blockers:');
      for (const b of e.blockers) console.error(`  - ${b.id}: ${b.title}`);
    }
    process.exit(1);
  }
}

async function cmdAutomations({ projectRoot, args }) {
  const storage = makeStorage(projectRoot);
  const workflow = defaultWorkflowDefinition();
  const adapter = makeDefaultAdapter();

  const ids = args.all
    ? storage.listProjectIds()
    : [storage.stableIdFromName(args.project || '')].filter(Boolean);

  if (!args.all && !args.project) {
    usage();
    process.exit(1);
  }

  for (const projectId of ids) {
    const state = storage.load(projectId);
    if (!state) {
      console.error(`⚠️  Skipping missing lifecycle: ${projectId}`);
      continue;
    }

    await runScheduledAutomations({ state, adapter });
    storage.save(projectId, state);

    console.log(`\n🛠  Automations run for: ${state.project.projectName} (${projectId})`);
    formatStatus(state, workflow);
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const sub = args._[0];

  const projectRoot = path.resolve(__dirname, '..', '..', '..');

  if (!sub || sub === 'help' || args.help) {
    usage();
    return;
  }

  switch (sub) {
    case 'init':
      await cmdInit({ projectRoot, args });
      break;
    case 'status':
      await cmdStatus({ projectRoot, args });
      break;
    case 'advance':
      await cmdAdvance({ projectRoot, args });
      break;
    case 'automations':
      await cmdAutomations({ projectRoot, args });
      break;
    default:
      usage();
      process.exit(1);
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { main };
