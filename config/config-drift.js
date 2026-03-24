#!/usr/bin/env node
/**
 * ============================================================================
 * Cortex Freelancer — Configuration Drift Detection
 * ============================================================================
 * Compares env var definitions across all platform configs to detect drift.
 * 
 * Usage:
 *   node config/config-drift.js
 * 
 * Checks:
 *   - render.yaml vs docker/.env.example vs k8s/secrets.yaml.template
 *   - Missing vars in any platform config
 *   - Extra vars not in schema
 * ============================================================================
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { ENV_SCHEMA, SENSITIVITY } = require('./env-schema');

const ROOT = path.join(__dirname, '..');

// ── Extract vars from each platform config ──

function extractRenderVars() {
  try {
    const content = fs.readFileSync(path.join(ROOT, 'render.yaml'), 'utf8');
    const vars = [];
    const regex = /- key: (\w+)/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      vars.push(match[1]);
    }
    return vars;
  } catch { return null; }
}

function extractDockerEnvVars() {
  try {
    const content = fs.readFileSync(path.join(ROOT, 'docker', '.env.example'), 'utf8');
    const vars = [];
    for (const line of content.split('\n')) {
      const match = line.match(/^([A-Z_]+)=/);
      if (match) vars.push(match[1]);
    }
    return vars;
  } catch { return null; }
}

function extractK8sSecrets() {
  try {
    const content = fs.readFileSync(path.join(ROOT, 'docker', 'k8s', 'secrets.yaml.template'), 'utf8');
    const vars = [];
    // Parse YAML data section — match indented KEY: lines after 'data:'
    const dataSection = content.split(/^data:/m)[1];
    if (!dataSection) return vars;
    for (const line of dataSection.split('\n')) {
      const match = line.match(/^\s+([A-Z][A-Z_0-9]+)\s*:/);
      if (match) vars.push(match[1]);
    }
    return vars;
  } catch { return null; }
}

function extractDockerComposeVars() {
  try {
    const content = fs.readFileSync(path.join(ROOT, 'docker', 'docker-compose.yml'), 'utf8');
    const vars = [];
    const regex = /- ([A-Z_]+)=/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      vars.push(match[1]);
    }
    return vars;
  } catch { return null; }
}

// ── Run drift detection ──

const platformConfigs = {
  'render.yaml': extractRenderVars(),
  'docker/.env.example': extractDockerEnvVars(),
  'docker/k8s/secrets.yaml.template': extractK8sSecrets(),
  'docker/docker-compose.yml': extractDockerComposeVars(),
};

// Get all non-platform-injected schema vars (ones we control)
const schemaVars = Object.entries(ENV_SCHEMA)
  .filter(([_, s]) => !['RAILWAY_ENVIRONMENT', 'RENDER', 'VERCEL', 'VERCEL_REGION'].includes(_))
  .filter(([_, s]) => s.sensitivity === SENSITIVITY.SECRET || s.sensitivity === SENSITIVITY.PRIVATE)
  .map(([k]) => k);

const allSecrets = Object.entries(ENV_SCHEMA)
  .filter(([_, s]) => s.sensitivity === SENSITIVITY.SECRET)
  .map(([k]) => k);

console.log('═══ Configuration Drift Report ═══\n');

let driftFound = false;

for (const [configFile, vars] of Object.entries(platformConfigs)) {
  if (!vars) {
    console.log(`⬜ ${configFile} — not found (skipped)`);
    continue;
  }

  const varSet = new Set(vars);
  const missingSecrets = allSecrets.filter(v => !varSet.has(v));
  const extraVars = vars.filter(v => !ENV_SCHEMA[v]);

  console.log(`\n── ${configFile} (${vars.length} vars) ──`);

  if (missingSecrets.length > 0) {
    driftFound = true;
    console.log('  Missing secrets:');
    missingSecrets.forEach(v => console.log(`    ❌ ${v}`));
  }

  if (extraVars.length > 0) {
    console.log('  Extra vars (not in schema):');
    extraVars.forEach(v => console.log(`    ⚠️  ${v}`));
  }

  if (missingSecrets.length === 0 && extraVars.length === 0) {
    console.log('  ✅ In sync with schema');
  }
}

// Cross-platform comparison
console.log('\n── Cross-Platform Comparison ──');
const activePlatforms = Object.entries(platformConfigs).filter(([_, v]) => v !== null);
if (activePlatforms.length >= 2) {
  const allVars = new Set();
  activePlatforms.forEach(([_, vars]) => vars.forEach(v => allVars.add(v)));

  for (const varName of allVars) {
    const presentIn = activePlatforms.filter(([_, vars]) => vars.includes(varName)).map(([f]) => f);
    const missingFrom = activePlatforms.filter(([_, vars]) => !vars.includes(varName)).map(([f]) => f);

    if (missingFrom.length > 0 && presentIn.length > 0) {
      // Only report if it's a secret or important var
      if (ENV_SCHEMA[varName]?.sensitivity === SENSITIVITY.SECRET) {
        driftFound = true;
        console.log(`  ⚠️  ${varName}: in ${presentIn.join(', ')} but missing from ${missingFrom.join(', ')}`);
      }
    }
  }
}

console.log(`\n${driftFound ? '⚠️  Drift detected — review above' : '✅ No significant drift detected'}\n`);
process.exit(driftFound ? 1 : 0);
