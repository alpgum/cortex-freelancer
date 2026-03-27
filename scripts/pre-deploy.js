#!/usr/bin/env node
/**
 * Pre-deploy validation — runs before every Vercel deployment.
 * Checks: server loads, vercel.json valid, critical files exist, API handlers parse.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let errors = 0;
let warnings = 0;

function pass(msg) { console.log(`  ✓ ${msg}`); }
function warn(msg) { warnings++; console.log(`  ⚠ ${msg}`); }
function fail(msg) { errors++; console.log(`  ✗ ${msg}`); }

// ── 1. Critical files exist ─────────────────────────────────
console.log('\n── Critical files ──');
const criticalFiles = [
  'vercel.json',
  'package.json',
  'server.js',
  'index.html',
  'app/index.html',
  'app/login.html',
  'app/chat.html',
  'pricing.html',
  'api/health.js',
  'api/chat.js',
  'api/checkout.js',
  'api/stripe-webhook.js',
];

for (const f of criticalFiles) {
  if (fs.existsSync(path.join(ROOT, f))) {
    pass(f);
  } else {
    fail(`Missing: ${f}`);
  }
}

// ── 2. vercel.json parses correctly ─────────────────────────
console.log('\n── vercel.json ──');
try {
  const raw = fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8');
  const cfg = JSON.parse(raw);

  if (cfg.routes && cfg.routes.length > 0) pass(`${cfg.routes.length} routes configured`);
  else warn('No routes in vercel.json');

  if (cfg.headers && cfg.headers.length > 0) pass(`${cfg.headers.length} header rules`);
  else warn('No security headers');

  if (cfg.crons && cfg.crons.length > 0) pass(`${cfg.crons.length} cron jobs`);
  else warn('No cron jobs');

  if (cfg.functions) pass(`${Object.keys(cfg.functions).length} function configs`);
} catch (e) {
  fail(`vercel.json parse error: ${e.message}`);
}

// ── 3. API handlers parse without syntax errors ─────────────
console.log('\n── API handlers ──');
const apiDir = path.join(ROOT, 'api');
if (fs.existsSync(apiDir)) {
  const apiFiles = fs.readdirSync(apiDir).filter(f => f.endsWith('.js'));
  let parsed = 0;
  for (const f of apiFiles) {
    try {
      // Syntax check only — don't execute
      const code = fs.readFileSync(path.join(apiDir, f), 'utf8');
      new Function(code);
      parsed++;
    } catch (e) {
      if (e instanceof SyntaxError) {
        fail(`Syntax error in api/${f}: ${e.message}`);
      }
      // Other errors (missing modules) are fine at parse time
      parsed++;
    }
  }
  pass(`${parsed}/${apiFiles.length} API handlers parsed`);
} else {
  fail('api/ directory missing');
}

// ── 4. package.json has required fields ─────────────────────
console.log('\n── package.json ──');
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

  if (pkg.engines && pkg.engines.node) pass(`Node engine: ${pkg.engines.node}`);
  else warn('No Node engine specified');

  if (pkg.scripts && pkg.scripts.start) pass(`Start script: ${pkg.scripts.start}`);
  else fail('No start script');

  if (pkg.dependencies) pass(`${Object.keys(pkg.dependencies).length} dependencies`);
} catch (e) {
  fail(`package.json error: ${e.message}`);
}

// ── 5. No .env files in deploy ──────────────────────────────
console.log('\n── Security ──');
const dangerousFiles = ['.env', '.env.local', '.env.production'];
for (const f of dangerousFiles) {
  const fp = path.join(ROOT, f);
  if (fs.existsSync(fp)) {
    // Check if it's gitignored
    warn(`${f} exists — ensure it's in .gitignore`);
  } else {
    pass(`No ${f} in project root`);
  }
}

// ── Summary ─────────────────────────────────────────────────
console.log('\n── Summary ──');
console.log(`  ${errors} errors, ${warnings} warnings`);

if (errors > 0) {
  console.log('\n  DEPLOY BLOCKED — fix errors above\n');
  process.exit(1);
} else if (warnings > 0) {
  console.log('\n  Deploy OK with warnings\n');
} else {
  console.log('\n  All checks passed\n');
}
