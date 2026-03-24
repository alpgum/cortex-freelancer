/**
 * ============================================================================
 * Cortex Freelancer — Startup Configuration Check
 * ============================================================================
 * Call this at the very start of server.js to validate config before anything
 * else runs. In production, invalid config = hard crash (fail fast).
 * 
 * Usage in server.js:
 *   require('./config/startup-check')();
 * ============================================================================
 */

'use strict';

const { validateConfig, getSafeConfig, SENSITIVITY, ENV_SCHEMA } = require('./env-schema');

module.exports = function startupCheck() {
  const isProd = process.env.NODE_ENV === 'production';
  const platform = process.env.PLATFORM || 'local';

  console.log('┌─ Cortex Config Check ─────────────────────');
  console.log(`│ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`│ Platform:    ${platform}`);
  console.log(`│ Port:        ${process.env.PORT || '3847'}`);

  const result = validateConfig();

  // Count by sensitivity
  const counts = { SECRET: 0, PRIVATE: 0, PUBLIC: 0 };
  for (const key of Object.keys(result.config)) {
    const schema = ENV_SCHEMA[key];
    if (schema) counts[schema.sensitivity]++;
  }

  console.log(`│ Configured:  🔴 ${counts.SECRET} secrets, 🟡 ${counts.PRIVATE} private, 🟢 ${counts.PUBLIC} public`);

  // Security warnings
  if (isProd) {
    // Check ADMIN_TOKEN isn't the default
    if (process.env.ADMIN_TOKEN === 'cortex-admin-2026') {
      result.warnings.push('🚨 ADMIN_TOKEN is using the default value! Change immediately.');
    }

    // Check Stripe is in live mode
    if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.startsWith('sk_test_')) {
      result.warnings.push('⚠️  STRIPE_SECRET_KEY is in test mode in production');
    }
  }

  if (result.warnings.length > 0) {
    console.log('│');
    result.warnings.forEach(w => console.log(`│ ${w}`));
  }

  if (result.errors.length > 0) {
    console.log('│');
    result.errors.forEach(e => console.log(`│ ${e}`));
  }

  console.log('└───────────────────────────────────────────');

  // In production, crash on errors
  if (!result.valid && isProd) {
    console.error('\n💀 FATAL: Configuration invalid. Server will not start.\n');
    process.exit(1);
  }

  // Log safe config in dev for debugging
  if (!isProd && process.env.WS_LOG_LEVEL === 'debug') {
    console.log('\n📋 Active config (secrets masked):');
    console.log(JSON.stringify(getSafeConfig(result.config), null, 2));
  }

  return result.config;
};
