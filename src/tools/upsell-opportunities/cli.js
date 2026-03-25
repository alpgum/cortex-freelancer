#!/usr/bin/env node
/* eslint-disable no-console */

const path = require('path');

const {
  defaultProjectRoot,
  loadClients,
  loadTimeTracking,
  loadMilestones,
  loadPayments,
  loadCompetitiveSignals,
  loadSkillGapSignals,
} = require('./loaders');

const { scanAll, buildOpportunity, aggregateSignalsForClient } = require('./engine');
const { loadOpportunities, saveOpportunities, appendOutcome } = require('./storage');
const { stableIdFromString, isoNow } = require('./utils');

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
Cortex Upsell Opportunities (CFX-078)

Usage:
  cortex upsell scan [--project-root <path>] [--min-score <n>]
  cortex upsell recommend --client <idOrName> [--project-root <path>]
  cortex upsell log-outcome --client <idOrName> --opportunity <oppId> --result <won|lost|deferred> [--notes <text>]

Notes:
  - Data is loaded from ~/.cortex-freelancer/* when available, with repo data/ fallbacks.
  - Opportunities are persisted to ~/.cortex-freelancer/upsell/opportunities.json
`);
}

function printOpportunityRow(o) {
  console.log(`${String(o.score).padStart(3, ' ')}  ${o.band.padEnd(6)}  ${o.clientName || o.clientId}  (${o.id})`);
}

function printRecommendation(o) {
  console.log(`\nClient: ${o.clientName || o.clientId}`);
  console.log(`Score:  ${o.score}/100 (${o.band})`);

  console.log('\nTop drivers:');
  for (const d of o.drivers.slice(0, 5)) {
    const sign = d.direction === 'down' ? '-' : '+';
    console.log(`  ${sign}${d.impactPoints}  ${d.title}`);
  }

  console.log('\nBest timing window:');
  console.log(`  ${o.timing.bestWindow.kind}`);
  console.log(`  ${o.timing.bestWindow.reason}`);
  console.log(`  Window: ${o.timing.bestWindow.window.start} -> ${o.timing.bestWindow.window.end}`);
  console.log(`  Channel: ${o.timing.channel} | Tone: ${o.timing.tone}`);

  console.log('\nSuggested message:');
  console.log(`  ${o.timing.suggestedMessage}`);

  console.log('\nOffers:');
  for (const off of o.offers) {
    console.log(`\n  - [${off.kind}] ${off.title}`);
    console.log(`    Pricing: ${off.pricingModel}`);
    console.log(`    Effort: ${off.effort} | Confidence: ${off.confidence}`);
    console.log(`    Why: ${off.why}`);
    console.log(`    Desc: ${off.description}`);
  }
  console.log('');
}

async function cmdScan({ projectRoot, args }) {
  const minScore = args['min-score'] ? Number(args['min-score']) : null;

  const { clients } = loadClients({ projectRoot });
  const { entries: timeEntries } = loadTimeTracking({ projectRoot });
  const { milestones } = loadMilestones();
  const { invoices } = loadPayments();
  const { gaps: skillGaps } = loadSkillGapSignals();
  const { insights: competitive } = loadCompetitiveSignals();

  const opportunities = scanAll({ clients, timeEntries, milestones, invoices, skillGaps, competitive, nowIso: isoNow() });

  const filtered = minScore === null
    ? opportunities
    : opportunities.filter(o => o.score >= minScore);

  const asMap = {};
  for (const o of opportunities) asMap[o.id] = o;

  const fp = saveOpportunities(asMap);

  console.log(`\n✅ Upsell scan complete: ${filtered.length} opportunities (saved ${opportunities.length})`);
  console.log(`   Saved: ${fp}`);
  console.log('\nSCORE  BAND    CLIENT (OPPORTUNITY_ID)');
  for (const o of filtered) printOpportunityRow(o);
  console.log('');
}

async function cmdRecommend({ projectRoot, args }) {
  const clientKey = args.client;
  if (!clientKey) {
    usage();
    process.exit(1);
  }

  // Try persisted opportunities first.
  const store = loadOpportunities();
  const saved = Object.values(store.opportunities || {});

  const norm = String(clientKey).toLowerCase();
  let opportunity = saved.find(o => String(o.clientId || '').toLowerCase() === norm || String(o.clientName || '').toLowerCase() === norm);

  if (!opportunity) {
    // Build ad-hoc recommendation from current signals.
    const { clients } = loadClients({ projectRoot });
    const client = clients.find(c => String(c.id || c.clientId || '').toLowerCase() === norm || String(c.name || c.clientName || '').toLowerCase() === norm);
    if (!client) {
      console.error(`❌ Client not found: ${clientKey}`);
      console.error('Tip: run `cortex upsell scan` first or ensure clients.json includes this client.');
      process.exit(1);
    }

    const { entries: timeEntries } = loadTimeTracking({ projectRoot });
    const { milestones } = loadMilestones();
    const { invoices } = loadPayments();
    const { gaps: skillGaps } = loadSkillGapSignals();
    const { insights: competitive } = loadCompetitiveSignals();

    const signals = aggregateSignalsForClient({ client, timeEntries, milestones, invoices, skillGaps, competitive });
    opportunity = buildOpportunity({ client, signals, nowIso: isoNow() });
  }

  printRecommendation(opportunity);
}

async function cmdLogOutcome({ args }) {
  const clientKey = args.client;
  const oppId = args.opportunity;
  const result = args.result;

  if (!clientKey || !oppId || !result) {
    usage();
    process.exit(1);
  }

  const normalizedResult = String(result).toLowerCase();
  if (!['won', 'lost', 'deferred'].includes(normalizedResult)) {
    console.error('❌ --result must be one of: won|lost|deferred');
    process.exit(1);
  }

  const { file, outcome } = appendOutcome({
    clientId: stableIdFromString(clientKey),
    clientKey,
    opportunityId: oppId,
    result: normalizedResult,
    notes: args.notes || null,
  });

  console.log(`✅ Outcome logged: ${outcome.result}`);
  console.log(`   Saved: ${file}`);
}

async function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const sub = args._[0];

  const projectRoot = args['project-root']
    ? path.resolve(process.cwd(), args['project-root'])
    : defaultProjectRoot();

  if (!sub || sub === 'help' || args.help) {
    usage();
    return;
  }

  switch (sub) {
    case 'scan':
      await cmdScan({ projectRoot, args });
      break;
    case 'recommend':
      await cmdRecommend({ projectRoot, args });
      break;
    case 'log-outcome':
      await cmdLogOutcome({ args });
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
