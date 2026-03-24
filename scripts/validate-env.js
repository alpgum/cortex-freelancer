#!/usr/bin/env node
/**
 * Cortex Freelancer — Environment Validation Script
 * ==================================================
 * Run before deployment or as part of CI/CD to verify all required
 * environment variables are properly configured.
 *
 * Usage:
 *   node scripts/validate-env.js                    # Basic validation
 *   node scripts/validate-env.js --strict            # Production-level checks
 *   node scripts/validate-env.js --platform railway  # Platform-specific checks
 *   node scripts/validate-env.js --dump              # Show all config (redacted)
 */

'use strict';

const path = require('path');
const fs = require('fs');

// Load config (which loads .env files)
const configPath = path.join(__dirname, '..', 'config.js');
if (!fs.existsSync(configPath)) {
  console.error('❌ config.js not found. Run from project root.');
  process.exit(1);
}

const config = require(configPath);
const { validate, printSummary } = config;

// Parse CLI args
const args = process.argv.slice(2);
const isStrict = args.includes('--strict');
const isDump = args.includes('--dump');
const platformIdx = args.indexOf('--platform');
const platform = platformIdx !== -1 ? args[platformIdx + 1] : null;

console.log('🔍 Cortex Freelancer — Environment Validation');
console.log('─'.repeat(50));

// Run validation
const options = {
  requireStripe: isStrict,
  requireFirebase: isStrict,
};

const result = validate(options);

// Platform-specific checks
const platformErrors = [];
const platformWarnings = [];

if (platform === 'railway' || config.isRailway) {
  if (!process.env.RAILWAY_ENVIRONMENT) {
    platformWarnings.push('RAILWAY_ENVIRONMENT not set (expected on Railway)');
  }
}

if (platform === 'render' || config.isRender) {
  if (config.port !== 10000) {
    platformWarnings.push('Render typically requires PORT=10000');
  }
}

if (platform === 'docker' || config.isDocker) {
  if (config.ssl.enabled && !config.ssl.certPath) {
    platformErrors.push('Docker with SSL requires SSL_CERT_PATH');
  }
}

// Print results
if (result.warnings.length > 0 || platformWarnings.length > 0) {
  console.log('\n⚠️  Warnings:');
  [...result.warnings, ...platformWarnings].forEach(w => console.log(`   • ${w}`));
}

if (result.errors.length > 0 || platformErrors.length > 0) {
  console.log('\n❌ Errors:');
  [...result.errors, ...platformErrors].forEach(e => console.log(`   • ${e}`));
}

const allErrors = [...result.errors, ...platformErrors];
const allWarnings = [...result.warnings, ...platformWarnings];

if (allErrors.length === 0) {
  console.log('\n✅ Environment validation passed!');
  if (allWarnings.length > 0) {
    console.log(`   (${allWarnings.length} warning${allWarnings.length > 1 ? 's' : ''} — review above)`);
  }
} else {
  console.log(`\n❌ Validation failed with ${allErrors.length} error(s)`);
  console.log('   → Fix the errors above before deploying');
}

// Dump config if requested
if (isDump) {
  printSummary();
}

console.log('');
process.exit(allErrors.length > 0 ? 1 : 0);
