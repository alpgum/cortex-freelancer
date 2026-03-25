#!/usr/bin/env node
/**
 * Cortex Freelancer CLI Router
 * Main entry point for all Cortex CLI commands
 * 
 * Routes commands to appropriate modules:
 * - cortex time ... -> scripts/cortex-time (Python time tracker)
 * - cortex skill-gap ... -> src/tools/skill-gap-analyzer/cli.js
 * - cortex help -> Show global help
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Get script directory and project root
const scriptDir = __dirname;
const projectRoot = path.dirname(scriptDir);

/**
 * Display global Cortex CLI help
 */
function showGlobalHelp() {
  console.log('\n' + '='.repeat(50));
  console.log('🚀 CORTEX FREELANCER CLI');
  console.log('='.repeat(50));
  console.log('\nAI Business Manager for Freelancers\n');
  
  console.log('AVAILABLE COMMANDS:');
  console.log('  cortex time <args>        Time tracking and project management');
  console.log('  cortex skill-gap <cmd>    Skill assessment and learning paths');
  console.log('  cortex lifecycle <cmd>    Project lifecycle automation');
  console.log('  cortex scope-creep <cmd>  Scope creep detection + prevention');
  console.log('  cortex upsell <cmd>       Upsell opportunity scan + recommendations');
  console.log('  cortex help               Show this help message');
  
  console.log('\nTIME TRACKING:');
  console.log('  cortex time start [project] [task]    Start time tracking');
  console.log('  cortex time stop                      Stop current timer');
  console.log('  cortex time status                    Show current status');
  console.log('  cortex time report [period]           Generate reports');
  
  console.log('\nSKILL GAP ANALYZER:');
  console.log('  cortex skill-gap assess               Run skill assessment');
  console.log('  cortex skill-gap analyze              Show gaps with priorities');
  console.log('  cortex skill-gap learn                Generate learning path');
  console.log('  cortex skill-gap market               Show market demand data');
  console.log('  cortex skill-gap progress             Track learning progress');

  console.log('\nSCOPE CREEP:');
  console.log('  cortex scope-creep analyze            Detect scope creep risk + playbooks');
  console.log('  cortex scope-creep analyze --project "Name"   Filter by project name');

  console.log('\nUPSELL:');
  console.log('  cortex upsell scan                    Scan clients for upsell opportunities');
  console.log('  cortex upsell recommend --client <id> Get tailored offers + best timing');
  console.log('  cortex upsell log-outcome ...         Record whether an upsell was won/lost');

  console.log('\nEXAMPLES:');
  console.log('  cortex time start "Client Project" "Bug fixes"');
  console.log('  cortex skill-gap assess --interactive');
  console.log('  cortex skill-gap analyze --role fullstack-developer');
  console.log('  cortex lifecycle init --project "Acme Website" --client "Acme"');
  console.log('  cortex lifecycle status --project "Acme Website"');
  console.log('  cortex scope-creep analyze --format text');
  
  console.log('\nGET STARTED:');
  console.log('  1. Run skill assessment: cortex skill-gap assess');
  console.log('  2. Analyze gaps: cortex skill-gap analyze');
  console.log('  3. Start learning: cortex skill-gap learn');
  console.log('  4. Track time: cortex time start');
  
  console.log('\nFor detailed help on any command:');
  console.log('  cortex time --help');
  console.log('  cortex skill-gap help');
  console.log('  cortex scope-creep help');
  
  console.log('\nProject: https://github.com/cortex-freelancer');
  console.log('Docs: https://cortex-freelancer.com/docs\n');
}

/**
 * Route command to appropriate handler
 */
function routeCommand(args) {
  const command = args[0];
  const commandArgs = args.slice(1);
  
  switch (command) {
    case 'time':
      routeToTimeTracker(commandArgs);
      break;
      
    case 'skill-gap':
      routeToSkillGapAnalyzer(commandArgs);
      break;

    case 'lifecycle':
      routeToLifecycle(commandArgs);
      break;

    case 'scope-creep':
      routeToScopeCreep(commandArgs);
      break;

    case 'upsell':
      routeToUpsell(commandArgs);
      break;
      
    case 'help':
    case '--help':
    case '-h':
    case undefined:
      showGlobalHelp();
      break;
      
    default:
      console.error(`❌ Unknown command: ${command}`);
      console.log('Run "cortex help" for available commands.');
      process.exit(1);
  }
}

/**
 * Route to time tracker (Python script)
 */
function routeToTimeTracker(args) {
  const timeScriptPath = path.join(scriptDir, 'cortex-time');
  
  if (!fs.existsSync(timeScriptPath)) {
    console.error('❌ Time tracker not found at:', timeScriptPath);
    console.log('Please ensure cortex-time script exists.');
    process.exit(1);
  }
  
  // Execute Python time tracker
  const pythonProcess = spawn('python3', [timeScriptPath, ...args], {
    stdio: 'inherit',
    cwd: projectRoot
  });
  
  pythonProcess.on('error', (error) => {
    console.error('❌ Error running time tracker:', error.message);
    console.log('Please ensure Python 3 is installed.');
    process.exit(1);
  });
  
  pythonProcess.on('exit', (code) => {
    process.exit(code);
  });
}

/**
 * Route to skill gap analyzer (Node.js script)
 */
function routeToSkillGapAnalyzer(args) {
  const skillGapCliPath = path.join(projectRoot, 'src', 'tools', 'skill-gap-analyzer', 'cli.js');
  
  if (!fs.existsSync(skillGapCliPath)) {
    console.error('❌ Skill Gap Analyzer not found at:', skillGapCliPath);
    console.log('Please ensure the skill-gap-analyzer module exists.');
    process.exit(1);
  }
  
  // Execute skill gap analyzer CLI
  const nodeProcess = spawn('node', [skillGapCliPath, ...args], {
    stdio: 'inherit',
    cwd: projectRoot
  });
  
  nodeProcess.on('error', (error) => {
    console.error('❌ Error running skill gap analyzer:', error.message);
    console.log('Please ensure Node.js is installed.');
    process.exit(1);
  });
  
  nodeProcess.on('exit', (code) => {
    process.exit(code);
  });
}

/**
 * Route to lifecycle automation (Node.js script)
 */
function routeToLifecycle(args) {
  const lifecycleCliPath = path.join(projectRoot, 'src', 'tools', 'project-lifecycle', 'cli.js');

  if (!fs.existsSync(lifecycleCliPath)) {
    console.error('❌ Lifecycle module not found at:', lifecycleCliPath);
    console.log('Please ensure src/tools/project-lifecycle exists.');
    process.exit(1);
  }

  const nodeProcess = spawn('node', [lifecycleCliPath, ...args], {
    stdio: 'inherit',
    cwd: projectRoot
  });

  nodeProcess.on('error', (error) => {
    console.error('❌ Error running lifecycle module:', error.message);
    process.exit(1);
  });

  nodeProcess.on('exit', (code) => {
    process.exit(code);
  });
}

/**
 * Route to scope creep detection (Node.js script)
 */
function routeToScopeCreep(args) {
  const scopeCreepCliPath = path.join(projectRoot, 'src', 'tools', 'scope-creep-detection', 'cli.js');

  if (!fs.existsSync(scopeCreepCliPath)) {
    console.error('❌ Scope creep module not found at:', scopeCreepCliPath);
    console.log('Please ensure src/tools/scope-creep-detection exists.');
    process.exit(1);
  }

  const nodeProcess = spawn('node', [scopeCreepCliPath, ...args], {
    stdio: 'inherit',
    cwd: projectRoot
  });

  nodeProcess.on('error', (error) => {
    console.error('❌ Error running scope creep module:', error.message);
    process.exit(1);
  });

  nodeProcess.on('exit', (code) => {
    process.exit(code);
  });
}

/**
 * Route to upsell opportunities (Node.js script)
 */
function routeToUpsell(args) {
  const upsellCliPath = path.join(projectRoot, 'src', 'tools', 'upsell-opportunities', 'cli.js');

  if (!fs.existsSync(upsellCliPath)) {
    console.error('❌ Upsell module not found at:', upsellCliPath);
    console.log('Please ensure src/tools/upsell-opportunities exists.');
    process.exit(1);
  }

  const nodeProcess = spawn('node', [upsellCliPath, ...args], {
    stdio: 'inherit',
    cwd: projectRoot
  });

  nodeProcess.on('error', (error) => {
    console.error('❌ Error running upsell module:', error.message);
    process.exit(1);
  });

  nodeProcess.on('exit', (code) => {
    process.exit(code);
  });
}

/**
 * Main CLI entry point
 */
function main() {
  const args = process.argv.slice(2);
  
  // Handle no arguments
  if (args.length === 0) {
    showGlobalHelp();
    return;
  }
  
  // Route command
  routeCommand(args);
}

// Execute if called directly
if (require.main === module) {
  main();
}

module.exports = {
  main,
  showGlobalHelp,
  routeCommand
};