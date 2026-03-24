#!/usr/bin/env node
/**
 * ============================================================================
 * Cortex Freelancer — Environment Validation CLI
 * ============================================================================
 * Run this to check your environment before deploy:
 *   node config/validate-env.js
 *   node config/validate-env.js --platform railway
 *   node config/validate-env.js --strict
 *   node config/validate-env.js --report
 * ============================================================================
 */

'use strict';

const { validateConfig, generateConfigReport, ENV_SCHEMA, SENSITIVITY } = require('./env-schema');

const args = process.argv.slice(2);
const flags = {
  platform: null,
  strict: false,
  report: false,
  json: false,
  help: false,
};

// Parse CLI args
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--platform' && args[i + 1]) { flags.platform = args[++i]; }
  else if (args[i] === '--strict') { flags.strict = true; }
  else if (args[i] === '--report') { flags.report = true; }
  else if (args[i] === '--json') { flags.json = true; }
  else if (args[i] === '--help' || args[i] === '-h') { flags.help = true; }
}

if (flags.help) {
  console.log(`
Cortex Freelancer — Environment Validator

Usage: node config/validate-env.js [options]

Options:
  --platform <name>   Validate for specific platform (railway|render|docker|vercel|digitalocean)
  --strict            Fail on warnings too
  --report            Print full configuration report
  --json              Output as JSON
  -h, --help          Show this help
`);
  process.exit(0);
}

// Full report mode
if (flags.report) {
  console.log(generateConfigReport());
  process.exit(0);
}

// Validate
const result = validateConfig();

// Platform-specific checks
if (flags.platform) {
  const platform = flags.platform.toLowerCase();
  for (const [key, schema] of Object.entries(ENV_SCHEMA)) {
    if (!schema.platforms.includes('all') && !schema.platforms.includes(platform)) continue;
    // For the target platform, check if secrets that should be set are set
    if (schema.sensitivity === SENSITIVITY.SECRET && !process.env[key]) {
      result.warnings.push(`⚠️  ${key} not set — required for ${platform} deployment`);
    }
  }
}

// Output
if (flags.json) {
  console.log(JSON.stringify({
    valid: result.valid && (!flags.strict || result.warnings.length === 0),
    errors: result.errors,
    warnings: result.warnings,
    configuredVars: Object.keys(result.config).length,
    totalVars: Object.keys(ENV_SCHEMA).length,
  }, null, 2));
} else {
  if (result.errors.length > 0) {
    console.error('\n❌ Configuration Errors:');
    result.errors.forEach(e => console.error(`   ${e}`));
  }
  if (result.warnings.length > 0) {
    console.warn('\n⚠️  Configuration Warnings:');
    result.warnings.forEach(w => console.warn(`   ${w}`));
  }
  if (result.valid && result.warnings.length === 0) {
    console.log('\n✅ Configuration valid. All checks passed.');
  } else if (result.valid) {
    console.log(`\n✅ Configuration valid with ${result.warnings.length} warning(s).`);
  }

  console.log(`\n📊 ${Object.keys(result.config).length}/${Object.keys(ENV_SCHEMA).length} variables configured.\n`);
}

// Exit code
const exitFail = !result.valid || (flags.strict && result.warnings.length > 0);
process.exit(exitFail ? 1 : 0);
