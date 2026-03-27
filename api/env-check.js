/**
 * Production Environment Validator
 *
 * GET /api/env-check — Returns system health + integration status
 * Requires ADMIN_TOKEN for full details, public shows basic health only.
 */

const { cors } = require('./middleware/cors');
const { withErrorHandler, sendError } = require('./middleware/error-handler');

// ── Integration checks ─────────────────────────────────────────────────

async function checkFirebase() {
  try {
    const { getFirestore } = require('./lib/firestore');
    const db = getFirestore();
    if (!db) return { status: 'not_configured', message: 'FIREBASE_SERVICE_ACCOUNT_KEY not set' };

    // Test read
    await db.collection('_health').doc('ping').set({ ts: Date.now() });
    return { status: 'healthy', message: 'Connected' };
  } catch (err) {
    return { status: 'error', message: err.message };
  }
}

async function checkStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    return { status: 'mock_mode', message: 'STRIPE_SECRET_KEY not set — running in mock mode' };
  }
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const balance = await stripe.balance.retrieve();
    return {
      status: 'healthy',
      message: 'Connected',
      mode: process.env.STRIPE_SECRET_KEY.startsWith('sk_live_') ? 'live' : 'test',
    };
  } catch (err) {
    return { status: 'error', message: err.message };
  }
}

async function checkAnthropic() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { status: 'not_configured', message: 'ANTHROPIC_API_KEY not set' };
  }
  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic();
    // Minimal test — just verify the key works
    await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: 5,
      messages: [{ role: 'user', content: 'Hi' }],
    });
    return { status: 'healthy', message: 'Connected' };
  } catch (err) {
    if (err.status === 401) return { status: 'error', message: 'Invalid API key' };
    if (err.status === 429) return { status: 'rate_limited', message: 'Rate limited but key valid' };
    return { status: 'error', message: err.message };
  }
}

function checkGmail() {
  const gmail = require('./lib/gmail');
  const config = gmail.getConfig();
  if (!config) return { status: 'not_configured', message: 'GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set' };
  return { status: 'configured', message: 'OAuth ready' };
}

function checkUpworkOAuth() {
  const upwork = require('./lib/upwork-oauth');
  const config = upwork.getConfig();
  if (!config) return { status: 'not_configured', message: 'UPWORK_CLIENT_ID or UPWORK_CLIENT_SECRET not set' };
  return { status: 'configured', message: 'OAuth ready' };
}

function checkEmail() {
  if (!process.env.RESEND_API_KEY) {
    return { status: 'not_configured', message: 'RESEND_API_KEY not set' };
  }
  return { status: 'configured', message: 'Resend ready' };
}

// ── Required env vars check ─────────────────────────────────────────────

function checkRequiredEnv() {
  const required = {
    ANTHROPIC_API_KEY: 'AI features',
    STRIPE_SECRET_KEY: 'Payments',
    STRIPE_WEBHOOK_SECRET: 'Payment webhooks',
    ADMIN_TOKEN: 'Admin endpoints',
  };

  const recommended = {
    FIREBASE_SERVICE_ACCOUNT_KEY: 'User data persistence',
    RESEND_API_KEY: 'Transactional emails',
    SLACK_WEBHOOK_URL: 'Alert notifications',
    GOOGLE_CLIENT_ID: 'Gmail integration',
    GOOGLE_CLIENT_SECRET: 'Gmail integration',
    UPWORK_CLIENT_ID: 'Upwork API integration',
    UPWORK_CLIENT_SECRET: 'Upwork API integration',
    GA_MEASUREMENT_ID: 'Analytics',
    SENTRY_DSN: 'Error tracking',
  };

  const missing = [];
  const warnings = [];

  for (const [key, purpose] of Object.entries(required)) {
    if (!process.env[key]) missing.push({ key, purpose, severity: 'required' });
  }

  for (const [key, purpose] of Object.entries(recommended)) {
    if (!process.env[key]) warnings.push({ key, purpose, severity: 'recommended' });
  }

  return { missing, warnings };
}

// ── Handler ─────────────────────────────────────────────────────────────

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
  }

  const isAdmin = req.headers['x-admin-token'] === process.env.ADMIN_TOKEN ||
                  req.query.token === process.env.ADMIN_TOKEN;

  // Public health check (no secrets exposed)
  if (!isAdmin) {
    return res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
    });
  }

  // Full admin health check
  const [firebase, stripeCheck, anthropic] = await Promise.all([
    checkFirebase(),
    checkStripe(),
    checkAnthropic(),
  ]);

  const gmail = checkGmail();
  const upwork = checkUpworkOAuth();
  const email = checkEmail();
  const envCheck = checkRequiredEnv();

  const integrations = { firebase, stripe: stripeCheck, anthropic, gmail, upwork, email };

  // Overall status
  const healthyCount = Object.values(integrations).filter(i => i.status === 'healthy' || i.status === 'configured').length;
  const errorCount = Object.values(integrations).filter(i => i.status === 'error').length;

  const overallStatus = errorCount > 0 ? 'degraded' :
                        envCheck.missing.length > 0 ? 'incomplete' : 'healthy';

  res.json({
    status: overallStatus,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    node: process.version,
    platform: process.env.PLATFORM || 'local',
    environment: process.env.NODE_ENV || 'development',
    integrations,
    env: envCheck,
    summary: {
      total: Object.keys(integrations).length,
      healthy: healthyCount,
      errors: errorCount,
      missingRequired: envCheck.missing.length,
      missingRecommended: envCheck.warnings.length,
    },
  });
});
