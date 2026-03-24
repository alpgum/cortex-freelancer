/**
 * ============================================================================
 * Cortex Freelancer — Environment Variable Schema & Validation
 * ============================================================================
 * Single source of truth for all configuration across platforms.
 * 
 * Usage:
 *   const { validateConfig, getConfig } = require('./config/env-schema');
 *   const config = getConfig(); // Validates + returns typed config
 * 
 * Categories:
 *   🔴 SECRET   — API keys, tokens, passwords (never log, never expose)
 *   🟡 PRIVATE  — Internal config (safe to log, not to expose publicly)
 *   🟢 PUBLIC   — Non-sensitive (safe to expose to client)
 * ============================================================================
 */

'use strict';

// ── Classification Constants ──
const SENSITIVITY = {
  SECRET: 'SECRET',   // API keys, tokens, passwords — never log
  PRIVATE: 'PRIVATE', // Internal config — safe to log in server logs
  PUBLIC: 'PUBLIC',   // Non-sensitive — can be exposed to clients
};

// ── Environment Variable Schema ──
const ENV_SCHEMA = {
  // ────────────────────────────────────────
  // Runtime
  // ────────────────────────────────────────
  NODE_ENV: {
    required: false,
    default: 'development',
    sensitivity: SENSITIVITY.PUBLIC,
    validate: (v) => ['development', 'staging', 'production', 'test'].includes(v),
    description: 'Application environment',
    platforms: ['all'],
  },
  PORT: {
    required: false,
    default: '3847',
    sensitivity: SENSITIVITY.PUBLIC,
    validate: (v) => !isNaN(parseInt(v, 10)) && parseInt(v, 10) > 0 && parseInt(v, 10) < 65536,
    description: 'Server listen port',
    platforms: ['all'],
  },
  PLATFORM: {
    required: false,
    default: 'local',
    sensitivity: SENSITIVITY.PUBLIC,
    validate: (v) => ['local', 'docker', 'railway', 'render', 'vercel', 'digitalocean'].includes(v),
    description: 'Hosting platform identifier',
    platforms: ['docker', 'railway', 'render', 'digitalocean'],
  },
  WS_TIMEOUT_PROFILE: {
    required: false,
    default: 'production',
    sensitivity: SENSITIVITY.PUBLIC,
    validate: (v) => ['development', 'production', 'aggressive'].includes(v),
    description: 'WebSocket timeout profile',
    platforms: ['all'],
  },
  DOMAIN: {
    required: false,
    default: 'localhost',
    sensitivity: SENSITIVITY.PUBLIC,
    validate: (v) => v.length > 0,
    description: 'Application domain',
    platforms: ['railway', 'render', 'digitalocean', 'docker'],
  },

  // ────────────────────────────────────────
  // Stripe (Payment Processing)
  // ────────────────────────────────────────
  STRIPE_SECRET_KEY: {
    required: false, // mock mode if absent
    sensitivity: SENSITIVITY.SECRET,
    validate: (v) => v.startsWith('sk_live_') || v.startsWith('sk_test_'),
    description: 'Stripe API secret key',
    platforms: ['railway', 'render', 'digitalocean', 'docker'],
    rotation: '90 days recommended',
  },
  STRIPE_WEBHOOK_SECRET: {
    required: false,
    sensitivity: SENSITIVITY.SECRET,
    validate: (v) => v.startsWith('whsec_'),
    description: 'Stripe webhook endpoint secret',
    platforms: ['railway', 'render', 'digitalocean', 'docker'],
  },
  STRIPE_PRICE_PRO_MONTHLY: {
    required: false,
    sensitivity: SENSITIVITY.PRIVATE,
    validate: (v) => v.startsWith('price_'),
    description: 'Stripe price ID for monthly pro plan',
    platforms: ['railway', 'render', 'digitalocean', 'docker'],
  },
  STRIPE_PRICE_PRO_ANNUAL: {
    required: false,
    sensitivity: SENSITIVITY.PRIVATE,
    validate: (v) => v.startsWith('price_'),
    description: 'Stripe price ID for annual pro plan',
    platforms: ['railway', 'render', 'digitalocean', 'docker'],
  },
  STRIPE_COUPON_LAUNCH50: {
    required: false,
    sensitivity: SENSITIVITY.PRIVATE,
    description: 'Stripe coupon ID for launch 50% off',
    platforms: ['railway', 'render'],
  },
  STRIPE_COUPON_ANNUAL10: {
    required: false,
    sensitivity: SENSITIVITY.PRIVATE,
    description: 'Stripe coupon ID for annual 10% off',
    platforms: ['railway', 'render'],
  },
  STRIPE_COUPON_FRIEND20: {
    required: false,
    sensitivity: SENSITIVITY.PRIVATE,
    description: 'Stripe coupon ID for friend 20% off',
    platforms: ['railway', 'render'],
  },

  // ────────────────────────────────────────
  // Firebase
  // ────────────────────────────────────────
  FIREBASE_API_KEY: {
    required: false,
    sensitivity: SENSITIVITY.PUBLIC, // Firebase API keys are public by design
    description: 'Firebase Web API key (public, restricted by domain)',
    platforms: ['railway', 'render', 'digitalocean', 'docker'],
  },
  FIREBASE_AUTH_DOMAIN: {
    required: false,
    sensitivity: SENSITIVITY.PUBLIC,
    description: 'Firebase Auth domain',
    platforms: ['railway', 'render', 'digitalocean', 'docker'],
  },
  FIREBASE_PROJECT_ID: {
    required: false,
    sensitivity: SENSITIVITY.PUBLIC,
    description: 'Firebase project ID',
    platforms: ['railway', 'render', 'digitalocean', 'docker'],
  },
  FIREBASE_STORAGE_BUCKET: {
    required: false,
    sensitivity: SENSITIVITY.PUBLIC,
    description: 'Firebase storage bucket',
    platforms: ['railway', 'render', 'digitalocean', 'docker'],
  },
  FIREBASE_MESSAGING_SENDER_ID: {
    required: false,
    sensitivity: SENSITIVITY.PUBLIC,
    description: 'Firebase Cloud Messaging sender ID',
    platforms: ['railway', 'render', 'digitalocean', 'docker'],
  },
  FIREBASE_APP_ID: {
    required: false,
    sensitivity: SENSITIVITY.PUBLIC,
    description: 'Firebase App ID',
    platforms: ['railway', 'render', 'digitalocean', 'docker'],
  },
  FIREBASE_SERVICE_ACCOUNT_KEY: {
    required: false,
    sensitivity: SENSITIVITY.SECRET,
    validate: (v) => {
      try { JSON.parse(v); return true; } catch { return false; }
    },
    description: 'Firebase service account JSON (for admin SDK)',
    platforms: ['railway', 'render', 'digitalocean', 'docker'],
    rotation: 'Rotate if compromised; use short-lived tokens in production',
  },

  // ────────────────────────────────────────
  // AI
  // ────────────────────────────────────────
  ANTHROPIC_API_KEY: {
    required: false,
    sensitivity: SENSITIVITY.SECRET,
    validate: (v) => v.startsWith('sk-ant-'),
    description: 'Anthropic Claude API key',
    platforms: ['railway', 'render', 'digitalocean', 'docker'],
    rotation: '90 days recommended',
  },
  ANTHROPIC_MODEL: {
    required: false,
    default: 'claude-sonnet-4-20250514',
    sensitivity: SENSITIVITY.PUBLIC,
    description: 'Anthropic model name',
    platforms: ['railway', 'render'],
  },
  ANTHROPIC_TIMEOUT_MS: {
    required: false,
    default: '120000',
    sensitivity: SENSITIVITY.PUBLIC,
    validate: (v) => !isNaN(parseInt(v, 10)) && parseInt(v, 10) > 0,
    description: 'Anthropic API timeout in milliseconds',
    platforms: ['railway', 'render'],
  },

  // ────────────────────────────────────────
  // Email
  // ────────────────────────────────────────
  RESEND_API_KEY: {
    required: false,
    sensitivity: SENSITIVITY.SECRET,
    validate: (v) => v.startsWith('re_'),
    description: 'Resend email API key',
    platforms: ['railway', 'render', 'digitalocean', 'docker'],
    rotation: '90 days recommended',
  },

  // ────────────────────────────────────────
  // Admin
  // ────────────────────────────────────────
  ADMIN_TOKEN: {
    required: false,
    sensitivity: SENSITIVITY.SECRET,
    validate: (v) => v.length >= 16,
    description: 'Admin API authentication token',
    platforms: ['railway', 'render', 'digitalocean', 'docker'],
    rotation: '30 days recommended',
  },
  ADMIN_EMAIL: {
    required: false,
    sensitivity: SENSITIVITY.PRIVATE,
    validate: (v) => v.includes('@'),
    description: 'Admin notification email',
    platforms: ['railway', 'render', 'digitalocean', 'docker'],
  },

  // ────────────────────────────────────────
  // Notifications
  // ────────────────────────────────────────
  SLACK_WEBHOOK_URL: {
    required: false,
    sensitivity: SENSITIVITY.SECRET,
    validate: (v) => v.startsWith('https://hooks.slack.com/'),
    description: 'Slack incoming webhook URL',
    platforms: ['railway', 'render', 'digitalocean', 'docker'],
  },

  // ────────────────────────────────────────
  // Monitoring
  // ────────────────────────────────────────
  SENTRY_DSN: {
    required: false,
    sensitivity: SENSITIVITY.PRIVATE,
    validate: (v) => v.startsWith('https://') && v.includes('@'),
    description: 'Sentry error tracking DSN',
    platforms: ['railway', 'render', 'digitalocean', 'docker'],
  },

  // ────────────────────────────────────────
  // Analytics
  // ────────────────────────────────────────
  GA_MEASUREMENT_ID: {
    required: false,
    sensitivity: SENSITIVITY.PUBLIC,
    validate: (v) => v.startsWith('G-'),
    description: 'Google Analytics 4 measurement ID',
    platforms: ['all'],
  },

  // ────────────────────────────────────────
  // Cron & Edge
  // ────────────────────────────────────────
  CRON_SECRET: {
    required: false,
    sensitivity: SENSITIVITY.SECRET,
    validate: (v) => v.length >= 16,
    description: 'Secret for authenticating cron job endpoints',
    platforms: ['railway', 'render', 'vercel', 'docker'],
  },
  EDGE_API_SECRET: {
    required: false,
    sensitivity: SENSITIVITY.SECRET,
    validate: (v) => v.length >= 16,
    description: 'Secret for edge function authentication',
    platforms: ['vercel'],
  },

  // ────────────────────────────────────────
  // OpenClaw Bridge
  // ────────────────────────────────────────
  OPENCLAW_BACKEND_URL: {
    required: false,
    sensitivity: SENSITIVITY.PRIVATE,
    validate: (v) => v.startsWith('http'),
    description: 'OpenClaw backend WebSocket URL',
    platforms: ['railway', 'render'],
  },
  OPENCLAW_SPAWN_TIMEOUT_MS: {
    required: false,
    default: '30000',
    sensitivity: SENSITIVITY.PUBLIC,
    validate: (v) => !isNaN(parseInt(v, 10)),
    description: 'OpenClaw spawn timeout in ms',
    platforms: ['railway', 'render'],
  },

  // ────────────────────────────────────────
  // Scraping / External Services
  // ────────────────────────────────────────
  SCRAPE_DO_API_KEY: {
    required: false,
    sensitivity: SENSITIVITY.SECRET,
    description: 'Scrape.do API key for web scraping',
    platforms: ['railway', 'render'],
    rotation: '90 days recommended',
  },
  UPWORK_PROXY_URL: {
    required: false,
    sensitivity: SENSITIVITY.PRIVATE,
    validate: (v) => v.startsWith('http'),
    description: 'Proxy URL for Upwork scraping',
    platforms: ['railway', 'render'],
  },

  // ────────────────────────────────────────
  // WebSocket Tuning (all optional, have code defaults)
  // ────────────────────────────────────────
  WS_PROCESSING_KEEPALIVE_MS: { required: false, sensitivity: SENSITIVITY.PUBLIC, description: 'WS processing keepalive interval', platforms: ['all'] },
  WS_HEALTH_PING_INTERVAL_MS: { required: false, sensitivity: SENSITIVITY.PUBLIC, description: 'WS health ping interval', platforms: ['all'] },
  WS_PONG_TIMEOUT_MS: { required: false, sensitivity: SENSITIVITY.PUBLIC, description: 'WS pong timeout', platforms: ['all'] },
  WS_MAX_MISSED_PONGS: { required: false, sensitivity: SENSITIVITY.PUBLIC, description: 'WS max missed pongs before disconnect', platforms: ['all'] },
  WS_STALE_CONNECTION_MS: { required: false, sensitivity: SENSITIVITY.PUBLIC, description: 'WS stale connection threshold', platforms: ['all'] },
  WS_HEALTH_LOG_INTERVAL_MS: { required: false, sensitivity: SENSITIVITY.PUBLIC, description: 'WS health log interval', platforms: ['all'] },
  WS_CLEANUP_INTERVAL_MS: { required: false, sensitivity: SENSITIVITY.PUBLIC, description: 'WS cleanup interval', platforms: ['all'] },
  WS_CONNECTION_TIMEOUT_MS: { required: false, sensitivity: SENSITIVITY.PUBLIC, description: 'WS connection timeout', platforms: ['all'] },
  WS_SESSION_TIMEOUT_MS: { required: false, sensitivity: SENSITIVITY.PUBLIC, description: 'WS session timeout', platforms: ['all'] },
  WS_LOG_LEVEL: { required: false, default: 'info', sensitivity: SENSITIVITY.PUBLIC, description: 'WS log level', platforms: ['all'] },

  // ────────────────────────────────────────
  // Platform-injected (read-only, set by hosting provider)
  // ────────────────────────────────────────
  RAILWAY_ENVIRONMENT: { required: false, sensitivity: SENSITIVITY.PUBLIC, description: 'Railway environment name (auto-injected)', platforms: ['railway'] },
  RENDER: { required: false, sensitivity: SENSITIVITY.PUBLIC, description: 'Render flag (auto-injected)', platforms: ['render'] },
  VERCEL: { required: false, sensitivity: SENSITIVITY.PUBLIC, description: 'Vercel flag (auto-injected)', platforms: ['vercel'] },
  VERCEL_REGION: { required: false, sensitivity: SENSITIVITY.PUBLIC, description: 'Vercel region (auto-injected)', platforms: ['vercel'] },

  // ── CFX-020: Monitoring ──
  METRICS_API_KEY: { required: false, sensitivity: SENSITIVITY.SECRET, description: 'API key for /api/metrics endpoint' },
  OPS_DASHBOARD_KEY: { required: false, sensitivity: SENSITIVITY.SECRET, description: 'Access key for /ops/dashboard' },
  ALERT_WEBHOOK_URL: { required: false, sensitivity: SENSITIVITY.SECRET, description: 'Slack/Discord webhook URL for alert notifications' },
  ALERT_EMAIL_WEBHOOK_URL: { required: false, sensitivity: SENSITIVITY.SECRET, description: 'Email webhook URL for alert notifications' },
  ALERT_COOLDOWN_MS: { required: false, sensitivity: SENSITIVITY.PRIVATE, description: 'Alert cooldown period in ms (default: 300000)', default: '300000' },
  ALERTS_ENABLED: { required: false, sensitivity: SENSITIVITY.PRIVATE, description: 'Enable/disable alerting (default: true)', default: 'true' },
  MONITORING_ORIGINS: { required: false, sensitivity: SENSITIVITY.PRIVATE, description: 'JSON array of origins for uptime monitoring' },
  UPTIME_CHECK_INTERVAL_MS: { required: false, sensitivity: SENSITIVITY.PRIVATE, description: 'Health check interval in ms (default: 60000)', default: '60000' },
  RAILWAY_HEALTH_URL: { required: false, sensitivity: SENSITIVITY.PRIVATE, description: 'Railway origin URL for health checks' },
  RENDER_HEALTH_URL: { required: false, sensitivity: SENSITIVITY.PRIVATE, description: 'Render origin URL for health checks' },
  DO_HEALTH_URL: { required: false, sensitivity: SENSITIVITY.PRIVATE, description: 'DigitalOcean origin URL for health checks' },
};

// ── Validation Engine ──

/**
 * Validate all environment variables against schema.
 * @param {Object} env - Environment object (defaults to process.env)
 * @returns {{ valid: boolean, errors: string[], warnings: string[], config: Object }}
 */
function validateConfig(env = process.env) {
  const errors = [];
  const warnings = [];
  const config = {};

  for (const [key, schema] of Object.entries(ENV_SCHEMA)) {
    const value = env[key];

    // Check required
    if (schema.required && !value) {
      errors.push(`❌ MISSING REQUIRED: ${key} — ${schema.description}`);
      continue;
    }

    // Apply default
    if (!value && schema.default !== undefined) {
      config[key] = schema.default;
      continue;
    }

    if (!value) {
      // Optional and not set — skip
      continue;
    }

    // Validate format
    if (schema.validate && !schema.validate(value)) {
      if (schema.required) {
        errors.push(`❌ INVALID: ${key} — failed validation (${schema.description})`);
      } else {
        warnings.push(`⚠️  INVALID FORMAT: ${key} — value doesn't match expected pattern`);
      }
    }

    // Check for common mistakes
    if (schema.sensitivity === SENSITIVITY.SECRET) {
      if (value.length < 8) {
        warnings.push(`⚠️  WEAK SECRET: ${key} — value seems too short`);
      }
    }

    config[key] = value;
  }

  // Check for unknown env vars that look like they belong to us
  const knownKeys = new Set(Object.keys(ENV_SCHEMA));
  for (const key of Object.keys(env)) {
    if (key.startsWith('CORTEX_') && !knownKeys.has(key)) {
      warnings.push(`⚠️  UNKNOWN: ${key} — not in schema (typo?)`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    config,
  };
}

/**
 * Get validated config. Throws on critical errors in production.
 * @param {Object} env - Environment object (defaults to process.env)
 * @returns {Object} Validated configuration object
 */
function getConfig(env = process.env) {
  const result = validateConfig(env);
  const isProd = (env.NODE_ENV || 'development') === 'production';

  // Log warnings
  if (result.warnings.length > 0) {
    console.warn('┌─ Config Warnings ─────────────────────────');
    result.warnings.forEach(w => console.warn(`│ ${w}`));
    console.warn('└───────────────────────────────────────────');
  }

  // In production, fail hard on errors
  if (!result.valid && isProd) {
    console.error('┌─ Config Errors (FATAL in production) ─────');
    result.errors.forEach(e => console.error(`│ ${e}`));
    console.error('└───────────────────────────────────────────');
    throw new Error(`Configuration validation failed: ${result.errors.length} error(s)`);
  }

  // In dev, just warn
  if (!result.valid) {
    console.warn('┌─ Config Errors (non-fatal in dev) ────────');
    result.errors.forEach(e => console.warn(`│ ${e}`));
    console.warn('└───────────────────────────────────────────');
  }

  return result.config;
}

/**
 * Get safe config for logging (masks secrets).
 * @param {Object} config - Config object from getConfig()
 * @returns {Object} Config with secrets masked
 */
function getSafeConfig(config) {
  const safe = {};
  for (const [key, value] of Object.entries(config)) {
    const schema = ENV_SCHEMA[key];
    if (!schema) {
      safe[key] = value;
      continue;
    }
    if (schema.sensitivity === SENSITIVITY.SECRET) {
      safe[key] = value ? `${value.substring(0, 6)}...${value.substring(value.length - 4)}` : '(not set)';
    } else {
      safe[key] = value;
    }
  }
  return safe;
}

/**
 * Generate a report of configuration status.
 * @param {Object} env - Environment object
 * @returns {string} Human-readable config report
 */
function generateConfigReport(env = process.env) {
  const result = validateConfig(env);
  const lines = ['═══ Cortex Freelancer Configuration Report ═══', ''];

  // Summary
  lines.push(`Status: ${result.valid ? '✅ VALID' : '❌ HAS ERRORS'}`);
  lines.push(`Errors: ${result.errors.length} | Warnings: ${result.warnings.length}`);
  lines.push(`Environment: ${env.NODE_ENV || 'development'}`);
  lines.push(`Platform: ${env.PLATFORM || env.RAILWAY_ENVIRONMENT ? 'railway' : env.RENDER ? 'render' : env.VERCEL ? 'vercel' : 'local'}`);
  lines.push('');

  // Variables by category
  const categories = {};
  for (const [key, schema] of Object.entries(ENV_SCHEMA)) {
    const cat = key.split('_')[0];
    if (!categories[cat]) categories[cat] = [];
    const value = env[key];
    const status = value ? '✅' : schema.required ? '❌' : '⬜';
    categories[cat].push(`  ${status} ${key} [${schema.sensitivity}]`);
  }

  for (const [cat, vars] of Object.entries(categories)) {
    lines.push(`── ${cat} ──`);
    lines.push(...vars);
    lines.push('');
  }

  if (result.errors.length > 0) {
    lines.push('── ERRORS ──');
    result.errors.forEach(e => lines.push(`  ${e}`));
    lines.push('');
  }

  if (result.warnings.length > 0) {
    lines.push('── WARNINGS ──');
    result.warnings.forEach(w => lines.push(`  ${w}`));
  }

  return lines.join('\n');
}

module.exports = {
  ENV_SCHEMA,
  SENSITIVITY,
  validateConfig,
  getConfig,
  getSafeConfig,
  generateConfigReport,
};
