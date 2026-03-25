#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import {
  ProposalInput,
  WorkflowStage,
  WorkflowConfig,
} from './types';
import { FileWorkflowStore } from './store';
import { ProposalToDeliveryEngine } from './workflow-engine';

const DEFAULT_CONFIG: WorkflowConfig = {
  autoGenerateContract: true,
  autoCreateMilestones: true,
  autoNotify: true,
  defaultCurrency: 'USD',
  defaultRevisionRounds: 2,
  qualityCheckRequired: true,
  notificationChannels: ['in_app'],
  timeoutEscalation: true,
};

function readJson<T>(file: string): T {
  const raw = fs.readFileSync(file, 'utf-8');
  return JSON.parse(raw) as T;
}

function printWorkflowSummary(w: any): void {
  console.log(`\n📦 Workflow: ${w.projectName}`);
  console.log(`🆔 ID: ${w.id}`);
  console.log(`👤 Client: ${w.clientName} (${w.clientId})`);
  console.log(`📍 Stage: ${w.currentStage}`);
  console.log(`💰 Value: ${w.metadata.currency} ${w.metadata.totalValue}`);
  console.log(`🗓  Est: ${w.timeline.estimatedStartDate} → ${w.timeline.estimatedEndDate} (${w.timeline.estimatedTotalHours}h)`);
  if (w.timeline.varianceAnalysis) {
    console.log(`📈 On Track: ${w.timeline.varianceAnalysis.isOnTrack}`);
    console.log(`   Effort variance (h): ${w.timeline.varianceAnalysis.effortVariance}`);
    console.log(`   Schedule variance (h): ${w.timeline.varianceAnalysis.scheduleVariance}`);
    console.log(`   Projected completion: ${w.timeline.varianceAnalysis.projectedCompletionDate}`);
  }

  if (w.contract) {
    console.log(`📜 Contract: ${w.contract.status}${w.contract.filePath ? ` (${w.contract.filePath})` : ''}`);
  }

  console.log(`🎯 Milestones: ${w.milestones.length} (completed: ${w.milestones.filter((m:any)=>m.status==='completed').length})`);
  console.log(`✅ Checklist: ${w.deliveryChecklist.filter((c:any)=>c.status==='passed').length}/${w.deliveryChecklist.length} passed`);
  console.log(`🤖 Automations pending: ${w.automation.pendingActions.length}`);
  console.log(`🕒 Updated: ${w.updatedAt}`);
}

export async function main(argv: string[] = process.argv): Promise<void> {
  const program = new Command();
  program
    .name('p2d')
    .description('Proposal → Contract → Delivery workflow automation')
    .version('1.0.0');

  program
    .command('create')
    .description('Create a workflow from an accepted proposal JSON')
    .requiredOption('-p, --proposal <file>', 'Proposal JSON file')
    .option('--no-automation', 'Disable automations')
    .action(async (opts) => {
      const store = new FileWorkflowStore();
      const proposal = readJson<ProposalInput>(opts.proposal);

      const engine = new ProposalToDeliveryEngine(DEFAULT_CONFIG);
      const workflow = engine.createWorkflowFromProposal(proposal);
      workflow.automation.enabled = !!opts.automation;

      if (workflow.automation.enabled) {
        await engine.processDueAutomations(workflow);
      }

      store.upsert(workflow);
      printWorkflowSummary(workflow);
    });

  program
    .command('list')
    .description('List workflows')
    .action(() => {
      const store = new FileWorkflowStore();
      const workflows = store.getAll();

      if (workflows.length === 0) {
        console.log('No workflows found.');
        return;
      }

      for (const w of workflows) {
        console.log(`${w.id}  ${w.currentStage}  ${w.projectName}  (${w.clientName})`);
      }
    });

  program
    .command('show')
    .description('Show workflow status')
    .argument('<id>', 'Workflow ID')
    .action((id) => {
      const store = new FileWorkflowStore();
      const w = store.get(id);
      if (!w) {
        console.error(`Workflow not found: ${id}`);
        process.exit(1);
      }
      printWorkflowSummary(w);
    });

  program
    .command('advance')
    .description('Advance a workflow to the next stage')
    .argument('<id>', 'Workflow ID')
    .argument('<stage>', 'Target stage')
    .option('-n, --notes <notes>', 'Transition notes')
    .action(async (id, stage, opts) => {
      const store = new FileWorkflowStore();
      const w = store.get(id);
      if (!w) {
        console.error(`Workflow not found: ${id}`);
        process.exit(1);
      }

      const engine = new ProposalToDeliveryEngine(DEFAULT_CONFIG);
      engine.advanceStage(w, stage as WorkflowStage, 'cli', opts.notes);
      await engine.processDueAutomations(w, 'cli');
      store.upsert(w);
      printWorkflowSummary(w);
    });

  program
    .command('rollback')
    .description('Rollback workflow to previous stage')
    .argument('<id>', 'Workflow ID')
    .option('-n, --notes <notes>', 'Rollback notes')
    .action(async (id, opts) => {
      const store = new FileWorkflowStore();
      const w = store.get(id);
      if (!w) {
        console.error(`Workflow not found: ${id}`);
        process.exit(1);
      }

      const engine = new ProposalToDeliveryEngine(DEFAULT_CONFIG);
      engine.rollback(w, 'cli', opts.notes);
      await engine.processDueAutomations(w, 'cli');
      store.upsert(w);
      printWorkflowSummary(w);
    });

  program
    .command('process')
    .description('Process due automations')
    .argument('[id]', 'Workflow ID (optional)')
    .action(async (id) => {
      const store = new FileWorkflowStore();
      const engine = new ProposalToDeliveryEngine(DEFAULT_CONFIG);

      if (id) {
        const w = store.get(id);
        if (!w) {
          console.error(`Workflow not found: ${id}`);
          process.exit(1);
        }
        await engine.processDueAutomations(w, 'cli');
        store.upsert(w);
        console.log(`Processed automations for ${id}`);
        return;
      }

      const workflows = store.getAll();
      for (const w of workflows) {
        await engine.processDueAutomations(w, 'cli');
        store.upsert(w);
      }
      console.log(`Processed automations for ${workflows.length} workflows`);
    });

  program
    .command('sign-contract')
    .description('Mark the contract as signed for a workflow')
    .argument('<id>', 'Workflow ID')
    .action((id) => {
      const store = new FileWorkflowStore();
      const w = store.get(id);
      if (!w) {
        console.error(`Workflow not found: ${id}`);
        process.exit(1);
      }

      const engine = new ProposalToDeliveryEngine(DEFAULT_CONFIG);
      engine.markContractSigned(w);
      store.upsert(w);
      console.log('✅ Contract marked as signed.');
      printWorkflowSummary(w);
    });

  program
    .command('quality-check')
    .description('Run automated quality checks')
    .argument('<id>', 'Workflow ID')
    .action(async (id) => {
      const store = new FileWorkflowStore();
      const w = store.get(id);
      if (!w) {
        console.error(`Workflow not found: ${id}`);
        process.exit(1);
      }

      const engine = new ProposalToDeliveryEngine(DEFAULT_CONFIG);
      const result = engine.runQualityChecks(w, 'cli');
      store.upsert(w);
      console.log('✅ Quality check complete.');
      console.log(result);
    });

  program
    .command('package')
    .description('Create delivery package manifest')
    .argument('<id>', 'Workflow ID')
    .action(async (id) => {
      const store = new FileWorkflowStore();
      const w = store.get(id);
      if (!w) {
        console.error(`Workflow not found: ${id}`);
        process.exit(1);
      }

      const engine = new ProposalToDeliveryEngine(DEFAULT_CONFIG);
      const res = engine.createDeliveryPackage(w);
      store.upsert(w);
      console.log(`✅ Package created: ${res.manifestPath}`);
    });

  await program.parseAsync(argv);
}

if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  main();
}
