#!/usr/bin/env node
/**
 * CFX-075 Scope Creep Detection CLI
 *
 * Examples:
 *   node cli.js analyze --format json
 *   node cli.js analyze --workflow <id> --format text
 *   node cli.js analyze --project "Website Redesign" --format text
 */

const { analyzeScopeCreep } = require('./engine');

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        out[key] = next;
        i++;
      } else {
        out[key] = true;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

function showHelp() {
  console.log(JSON.stringify({
    usage: 'cortex scope-creep <command> [options] (or: node cli.js <command> [options])',
    commands: {
      analyze: 'Analyze scope creep risk for all workflows or a selection',
    },
    options: {
      '--workflow <id>': 'Analyze a single p2d workflow id',
      '--project <name>': 'Filter workflows by project name match',
      '--format <json|text>': 'Output format (default: json)',
      '--pretty': 'Pretty-print JSON',
    }
  }, null, 2));
}

function printTextReport(analysis) {
  console.log('\n' + '='.repeat(72));
  console.log('CFX-075 — SCOPE CREEP RISK REPORT');
  console.log('='.repeat(72));
  console.log(`Generated: ${analysis.generatedAt}`);
  console.log(`Workflows analyzed: ${analysis.results.length}`);

  for (const r of analysis.results) {
    console.log('\n' + '-'.repeat(72));
    console.log(`Project: ${r.workflow.projectName || r.workflow.id}`);
    console.log(`Client:  ${r.workflow.clientName || r.workflow.clientId || 'unknown'}`);
    console.log(`Stage:   ${r.workflow.currentStage || 'unknown'}`);
    console.log(`Risk:    ${r.riskScore}/100 (${r.severity.toUpperCase()})`);

    console.log('\nTop drivers:');
    if (!r.drivers.length) console.log('  (none)');
    for (const d of r.drivers) {
      console.log(`  • ${d.label}: ${d.score}/100 (weight ${d.weight})`);
      console.log(`    - ${d.summary}`);
    }

    console.log(`\nPlaybook (${r.recommendedActions.tier.toUpperCase()}):`);
    r.recommendedActions.steps.slice(0, 6).forEach((s, idx) => {
      console.log(`  ${idx + 1}. ${s}`);
    });

    console.log('\nClient language templates (snippets):');
    const templates = r.recommendedActions.templates || {};
    const keys = Object.keys(templates);
    if (!keys.length) {
      console.log('  (none)');
    } else {
      for (const k of keys) {
        const txt = String(templates[k] || '');
        const snippet = txt.split('\n').slice(0, 4).join('\n');
        console.log(`\n  [${k}]\n${snippet}${txt.split('\n').length > 4 ? '\n  ...' : ''}`);
      }
    }
  }

  console.log('\n' + '='.repeat(72));
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const command = parsed._[0];

  if (!command || command === 'help' || parsed.help) {
    showHelp();
    return;
  }

  if (command !== 'analyze') {
    console.error(`Unknown command: ${command}`);
    showHelp();
    process.exit(1);
  }

  const analysis = analyzeScopeCreep({
    workflowId: parsed.workflow || null,
    projectName: parsed.project || null,
  });

  const format = (parsed.format || 'json').toLowerCase();
  if (format === 'text') {
    printTextReport(analysis);
  } else {
    console.log(JSON.stringify(analysis, null, parsed.pretty ? 2 : 0));
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('CLI error:', err.message);
    process.exit(1);
  });
}

module.exports = { main, parseArgs, printTextReport };
