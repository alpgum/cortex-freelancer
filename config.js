/**
 * Cortex Freelancer — Centralized Configuration Module
 * =====================================================
 * All environment variable access goes through this module.
 * Provides typed, validated, documented access with sensible defaults.
 *
 * Usage:
 *   const config = require('./config');
 *   config.anthropic.apiKey  // string (validated on startup)
 *   config.ws.maxConnections // number (coerced from env)
 */

'use strict';

// ── Dotenv loading with fallback chain ──────────────────────────────────────
// Priority: process.env (already set) > .env.local > .env
const path = require('path');
const fs = require('fs');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    // Don't override existing process.env values
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

// Load in reverse priority (lowest first, so higher priority files "win")
loadEnvFile(path.join(__dirname, '.env'));
loadEnvFile(path.join(__dirname, '.env.local'));

// ── Helper functions ────────────────────────────────────────────────────────

function str(key, fallback) {
  const val = process.env[key];
  if (val !== undefined && val !== '') return val;
  if (fallback !== undefined) return fallback;
  return undefined;
}

function int(key, fallback) {
  const val = process.env[key];
  if (val !== undefined && val !== '') {
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed)) return parsed;
  }
  return fallback;
}

function float(key, fallback) {
  const val = process.env[key];
  if (val !== undefined && val !== '') {
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) return parsed;
  }
  return fallback;
}

function bool(key, fallback = false) {
  const val = process.env[key];
  if (val === undefined || val === '') return fallback;
  return ['true', '1', 'yes', 'on'].includes(val.toLowerCase());
}

function json(key, fallback) {
  const val = process.env[key];
  if (val === undefined || val === '') return fallback;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

function oneOf(key, allowed, fallback) {
  const val = str(key, fallback);
  if (val && !allowed.includes(val)) {
    console.warn(`⚠ ${key}="${val}" is not one of [${allowed.join(', ')}], using "${fallback}"`);
    return fallback;
  }
  return val;
}

// ── Configuration object ────────────────────────────────────────────────────

const config = {
  // Runtime
  env: oneOf('NODE_ENV', ['development', 'staging', 'production'], 'development'),
  port: int('PORT', 3847),
  platform: oneOf('PLATFORM', ['local', 'railway', 'render', 'digitalocean', 'docker'], 'local'),
  domain: str('DOMAIN', 'localhost'),

  isDev: () => config.env === 'development',
  isProd: () => config.env === 'production',
  isStaging: () => config.env === 'staging',

  // Platform detection (auto-detect from env vars if PLATFORM not set)
  isRailway: bool('RAILWAY_ENVIRONMENT') || str('PLATFORM') === 'railway',
  isRender: bool('RENDER') || str('PLATFORM') === 'render',
  isDocker: bool('DOCKER') || str('PLATFORM') === 'docker',
  isVercel: bool('VERCEL'),

  // Anthropic AI (supports OpenRouter fallback)
  anthropic: {
    apiKey: str('ANTHROPIC_API_KEY') || str('OPENROUTER_API_KEY'),
    model: str('ANTHROPIC_MODEL', !str('ANTHROPIC_API_KEY') && str('OPENROUTER_API_KEY') ? 'anthropic/claude-sonnet-4-20250514' : 'claude-sonnet-4-20250514'),
    timeoutMs: int('ANTHROPIC_TIMEOUT_MS', 120000),
    baseURL: !str('ANTHROPIC_API_KEY') && str('OPENROUTER_API_KEY') ? 'https://openrouter.ai/api' : undefined,
    useOpenRouter: !str('ANTHROPIC_API_KEY') && !!str('OPENROUTER_API_KEY'),
  },

  // Stripe
  stripe: {
    secretKey: str('STRIPE_SECRET_KEY'),
    webhookSecret: str('STRIPE_WEBHOOK_SECRET'),
    priceProMonthly: str('STRIPE_PRICE_PRO_MONTHLY'),
    priceProAnnual: str('STRIPE_PRICE_PRO_ANNUAL'),
    couponLaunch: str('STRIPE_COUPON_LAUNCH50'),
    couponAnnual: str('STRIPE_COUPON_ANNUAL10'),
    couponFriend: str('STRIPE_COUPON_FRIEND20'),
    isMockMode: !str('STRIPE_SECRET_KEY'),
  },

  // Firebase
  firebase: {
    apiKey: str('FIREBASE_API_KEY'),
    authDomain: str('FIREBASE_AUTH_DOMAIN'),
    projectId: str('FIREBASE_PROJECT_ID'),
    storageBucket: str('FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: str('FIREBASE_MESSAGING_SENDER_ID'),
    appId: str('FIREBASE_APP_ID'),
    serviceAccountKey: str('FIREBASE_SERVICE_ACCOUNT_KEY'),
  },

  // Email
  email: {
    resendApiKey: str('RESEND_API_KEY'),
  },

  // Admin
  admin: {
    token: str('ADMIN_TOKEN'),
    email: str('ADMIN_EMAIL'),
  },

  // Notifications
  notifications: {
    slackWebhookUrl: str('SLACK_WEBHOOK_URL'),
  },

  // Monitoring
  monitoring: {
    sentryDsn: str('SENTRY_DSN'),
    gaMeasurementId: str('GA_MEASUREMENT_ID'),
  },

  // Cron
  cron: {
    secret: str('CRON_SECRET'),
  },

  // External services
  services: {
    upworkProxyUrl: str('UPWORK_PROXY_URL'),
    scrapeDoApiKey: str('SCRAPE_DO_API_KEY'),
    edgeApiSecret: str('EDGE_API_SECRET'),
  },

  // OpenClaw bridge (local mode)
  openclaw: {
    backendUrl: str('OPENCLAW_BACKEND_URL'),
    spawnTimeoutMs: int('OPENCLAW_SPAWN_TIMEOUT_MS', 30000),
  },

  // WebSocket
  ws: {
    timeoutProfile: oneOf('WS_TIMEOUT_PROFILE', ['development', 'production', 'aggressive'], 'production'),
    logLevel: oneOf('WS_LOG_LEVEL', ['debug', 'info', 'warn', 'error'], 'info'),
    processingKeepaliveMs: int('WS_PROCESSING_KEEPALIVE_MS', 5000),
    healthPingIntervalMs: int('WS_HEALTH_PING_INTERVAL_MS', 30000),
    pongTimeoutMs: int('WS_PONG_TIMEOUT_MS', 10000),
    maxMissedPongs: int('WS_MAX_MISSED_PONGS', 3),
    staleConnectionMs: int('WS_STALE_CONNECTION_MS', 300000),
    healthLogIntervalMs: int('WS_HEALTH_LOG_INTERVAL_MS', 60000),
    cleanupIntervalMs: int('WS_CLEANUP_INTERVAL_MS', 60000),
    connectionTimeoutMs: int('WS_CONNECTION_TIMEOUT_MS', 30000),
    sessionTimeoutMs: int('WS_SESSION_TIMEOUT_MS', 1800000),
    maxConnections: int('WS_MAX_CONNECTIONS', 100),
  },

  // SSL/TLS
  ssl: {
    enabled: bool('SSL_ENABLED', false),
    certPath: str('SSL_CERT_PATH'),
    keyPath: str('SSL_KEY_PATH'),
    caPath: str('SSL_CA_PATH'),
  },

  // CDN
  cdn: {
    url: str('CDN_URL'),
    enabled: bool('CDN_ENABLED', false),
  },

  // Load balancer
  lb: {
    trustProxy: bool('TRUST_PROXY', false),
    healthPath: str('LB_HEALTH_PATH', '/api/health'),
  },
};

// ── Validation ──────────────────────────────────────────────────────────────

/**
 * Validates all required environment variables are present.
 * Call this at server startup to fail fast.
 * @param {object} [options]
 * @param {boolean} [options.requireStripe=false] - Fail if Stripe keys missing
 * @param {boolean} [options.requireFirebase=false] - Fail if Firebase config missing
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function validate(options = {}) {
  const errors = [];
  const warnings = [];

  // Beta mode: treat missing services as warnings, not errors
  // Set BETA_MODE=true to allow graceful degradation in production
  const isBetaMode = bool('BETA_MODE', false) || bool('FREE_MODE', false);

  // AI key: required for AI features, but warn-only in beta mode
  if (!config.anthropic.apiKey) {
    if (isBetaMode) {
      warnings.push('ANTHROPIC_API_KEY or OPENROUTER_API_KEY not set — AI features disabled');
    } else {
      errors.push('ANTHROPIC_API_KEY or OPENROUTER_API_KEY is required');
    }
  }
  if (!config.admin.token) {
    warnings.push('ADMIN_TOKEN not set — admin endpoints will use default token (INSECURE)');
  }

  // Stripe (required in production non-beta, optional otherwise)
  if (!isBetaMode && (options.requireStripe || config.isProd())) {
    if (!config.stripe.secretKey) errors.push('STRIPE_SECRET_KEY is required for payments');
    if (!config.stripe.webhookSecret) errors.push('STRIPE_WEBHOOK_SECRET is required for webhooks');
  } else if (!config.stripe.secretKey) {
    warnings.push('STRIPE_SECRET_KEY not set — running in mock payment mode');
  }

  // Firebase (warn if missing, error only in strict prod mode)
  if (!isBetaMode && (options.requireFirebase || config.isProd())) {
    if (!config.firebase.projectId) errors.push('FIREBASE_PROJECT_ID is required');
  } else if (!config.firebase.projectId) {
    warnings.push('FIREBASE_PROJECT_ID not set — Firestore features disabled');
  }

  // SSL validation
  if (config.ssl.enabled) {
    if (!config.ssl.certPath) errors.push('SSL_CERT_PATH required when SSL_ENABLED=true');
    if (!config.ssl.keyPath) errors.push('SSL_KEY_PATH required when SSL_ENABLED=true');
    if (config.ssl.certPath && !fs.existsSync(config.ssl.certPath)) {
      errors.push(`SSL certificate not found at ${config.ssl.certPath}`);
    }
    if (config.ssl.keyPath && !fs.existsSync(config.ssl.keyPath)) {
      errors.push(`SSL key not found at ${config.ssl.keyPath}`);
    }
  }

  // WebSocket sanity checks
  if (config.ws.pongTimeoutMs >= config.ws.healthPingIntervalMs) {
    warnings.push('WS_PONG_TIMEOUT_MS should be less than WS_HEALTH_PING_INTERVAL_MS');
  }
  if (config.ws.maxConnections < 1) {
    errors.push('WS_MAX_CONNECTIONS must be >= 1');
  }
  if (config.ws.sessionTimeoutMs < 60000) {
    warnings.push('WS_SESSION_TIMEOUT_MS is very low (< 1 minute)');
  }

  // Port range
  if (config.port < 1 || config.port > 65535) {
    errors.push(`PORT=${config.port} is out of valid range (1-65535)`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validates config and exits process if critical errors found.
 * Call at the very start of server.js.
 */
function validateOrDie(options = {}) {
  const result = validate(options);

  if (result.warnings.length > 0) {
    console.warn('\n⚠️  Configuration warnings:');
    result.warnings.forEach(w => console.warn(`   • ${w}`));
  }

  if (!result.valid) {
    console.error('\n❌ Configuration errors (server cannot start):');
    result.errors.forEach(e => console.error(`   • ${e}`));
    console.error('\n   → Copy .env.example to .env.local and fill in required values');
    console.error('   → See docs/SECRET_ROTATION.md for secret management\n');
    process.exit(1);
  }

  if (result.warnings.length > 0 || result.errors.length > 0) {
    console.log(''); // blank line after warnings
  }
}

/**
 * Print current config summary (redacting secrets).
 */
function printSummary() {
  const redact = (val) => val ? `${val.slice(0, 6)}...${val.slice(-4)}` : '(not set)';

  console.log('\n📋 Configuration:');
  console.log(`   Environment:  ${config.env}`);
  console.log(`   Platform:     ${config.platform}`);
  console.log(`   Port:         ${config.port}`);
  console.log(`   Domain:       ${config.domain}`);
  console.log(`   Anthropic:    ${redact(config.anthropic.apiKey)} (model: ${config.anthropic.model})`);
  console.log(`   Stripe:       ${config.stripe.isMockMode ? 'MOCK MODE' : redact(config.stripe.secretKey)}`);
  console.log(`   WS Profile:   ${config.ws.timeoutProfile} (max ${config.ws.maxConnections} connections)`);
  console.log(`   SSL:          ${config.ssl.enabled ? 'ENABLED' : 'disabled'}`);
  console.log(`   CDN:          ${config.cdn.enabled ? config.cdn.url : 'disabled'}`);
  console.log('');
}

// ── Schema-based validation (for CLI tools and drift detection) ─────────────

let envSchema;
try {
  envSchema = require('./config/env-schema');
} catch {
  envSchema = null; // Optional — works without it
}

/**
 * Get a copy of config with secrets masked (safe for logging/APIs).
 * @returns {Object} Sanitized config snapshot
 */
function getSafeSnapshot() {
  const redact = (val) => val ? `${val.slice(0, 6)}...${val.slice(-4)}` : '(not set)';
  return {
    env: config.env,
    platform: config.platform,
    port: config.port,
    domain: config.domain,
    anthropic: { model: config.anthropic.model, timeoutMs: config.anthropic.timeoutMs, apiKey: redact(config.anthropic.apiKey) },
    stripe: { isMockMode: config.stripe.isMockMode, secretKey: redact(config.stripe.secretKey) },
    ws: { timeoutProfile: config.ws.timeoutProfile, maxConnections: config.ws.maxConnections },
    ssl: { enabled: config.ssl.enabled },
    cdn: { enabled: config.cdn.enabled, url: config.cdn.url },
  };
}

// ── Exports ─────────────────────────────────────────────────────────────────

module.exports = config;
module.exports.validate = validate;
module.exports.validateOrDie = validateOrDie;
module.exports.printSummary = printSummary;
module.exports.getSafeSnapshot = getSafeSnapshot;
module.exports.schema = envSchema;
module.exports.helpers = { str, int, float, bool, json, oneOf };
