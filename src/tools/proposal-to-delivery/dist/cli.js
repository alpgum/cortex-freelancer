#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const commander_1 = require("commander");
const fs = __importStar(require("fs"));
const store_1 = require("./store");
const workflow_engine_1 = require("./workflow-engine");
const DEFAULT_CONFIG = {
    autoGenerateContract: true,
    autoCreateMilestones: true,
    autoNotify: true,
    defaultCurrency: 'USD',
    defaultRevisionRounds: 2,
    qualityCheckRequired: true,
    notificationChannels: ['in_app'],
    timeoutEscalation: true,
};
function readJson(file) {
    const raw = fs.readFileSync(file, 'utf-8');
    return JSON.parse(raw);
}
function printWorkflowSummary(w) {
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
    console.log(`🎯 Milestones: ${w.milestones.length} (completed: ${w.milestones.filter((m) => m.status === 'completed').length})`);
    console.log(`✅ Checklist: ${w.deliveryChecklist.filter((c) => c.status === 'passed').length}/${w.deliveryChecklist.length} passed`);
    console.log(`🤖 Automations pending: ${w.automation.pendingActions.length}`);
    console.log(`🕒 Updated: ${w.updatedAt}`);
}
async function main(argv = process.argv) {
    const program = new commander_1.Command();
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
        const store = new store_1.FileWorkflowStore();
        const proposal = readJson(opts.proposal);
        const engine = new workflow_engine_1.ProposalToDeliveryEngine(DEFAULT_CONFIG);
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
        const store = new store_1.FileWorkflowStore();
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
        const store = new store_1.FileWorkflowStore();
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
        const store = new store_1.FileWorkflowStore();
        const w = store.get(id);
        if (!w) {
            console.error(`Workflow not found: ${id}`);
            process.exit(1);
        }
        const engine = new workflow_engine_1.ProposalToDeliveryEngine(DEFAULT_CONFIG);
        engine.advanceStage(w, stage, 'cli', opts.notes);
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
        const store = new store_1.FileWorkflowStore();
        const w = store.get(id);
        if (!w) {
            console.error(`Workflow not found: ${id}`);
            process.exit(1);
        }
        const engine = new workflow_engine_1.ProposalToDeliveryEngine(DEFAULT_CONFIG);
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
        const store = new store_1.FileWorkflowStore();
        const engine = new workflow_engine_1.ProposalToDeliveryEngine(DEFAULT_CONFIG);
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
        const store = new store_1.FileWorkflowStore();
        const w = store.get(id);
        if (!w) {
            console.error(`Workflow not found: ${id}`);
            process.exit(1);
        }
        const engine = new workflow_engine_1.ProposalToDeliveryEngine(DEFAULT_CONFIG);
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
        const store = new store_1.FileWorkflowStore();
        const w = store.get(id);
        if (!w) {
            console.error(`Workflow not found: ${id}`);
            process.exit(1);
        }
        const engine = new workflow_engine_1.ProposalToDeliveryEngine(DEFAULT_CONFIG);
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
        const store = new store_1.FileWorkflowStore();
        const w = store.get(id);
        if (!w) {
            console.error(`Workflow not found: ${id}`);
            process.exit(1);
        }
        const engine = new workflow_engine_1.ProposalToDeliveryEngine(DEFAULT_CONFIG);
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
//# sourceMappingURL=cli.js.map