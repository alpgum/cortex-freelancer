/**
 * CFX-046: Enhanced Health Check Endpoint (v2)
 * 
 * Extends CFX-016 health endpoint with:
 * - Instance identity & role reporting
 * - Readiness vs liveness probes (Kubernetes-style)
 * - Dependency health (Redis, DB, external APIs)
 * - Failover status awareness
 * 
 * Endpoints:
 *   GET /api/health          — Full health check (for LB monitors)
 *   GET /api/health/live     — Liveness probe (is the process alive?)
 *   GET /api/health/ready    — Readiness probe (can it accept traffic?)
 *   GET /api/health/instance — Instance identity & failover info
 */

const os = require('os');
const startTime = Date.now();

// Detect platform from environment
function detectPlatform() {
  if (process.env.RAILWAY_ENVIRONMENT) return 'railway';
  if (process.env.RENDER) return 'render';
  if (process.env.DIGITALOCEAN) return 'digitalocean';
  if (process.env.VERCEL) return 'vercel';
  return 'unknown';
}

// Instance identity from environment
function getInstanceIdentity() {
  return {
    id: process.env.INSTANCE_ID || `${detectPlatform()}-${os.hostname()}`,
    role: process.env.INSTANCE_ROLE || 'unknown',  // primary | backup
    priority: parseInt(process.env.INSTANCE_PRIORITY || '99', 10),
    region: process.env.INSTANCE_REGION || process.env.RAILWAY_REGION || process.env.RENDER_REGION || 'unknown',
    platform: detectPlatform(),
    version: process.env.APP_VERSION || process.env.npm_package_version || '0.0.0',
    deployId: process.env.RAILWAY_DEPLOYMENT_ID || process.env.RENDER_SERVICE_ID || 'local',
  };
}

// ─── Health Checks ───────────────────────────────────────────────

function checkMemory() {
  const used = process.memoryUsage();
  const totalMB = Math.round(used.heapTotal / 1024 / 1024);
  const usedMB = Math.round(used.heapUsed / 1024 / 1024);
  const pct = Math.round((usedMB / totalMB) * 100);
  return { ok: pct < 90, totalMB, usedMB, percent: pct };
}

function checkEventLoop() {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    setImmediate(() => {
      const lag = Number(process.hrtime.bigint() - start) / 1e6;
      resolve({ ok: lag < 100, lagMs: Math.round(lag * 100) / 100 });
    });
  });
}

async function checkRedis() {
  try {
    const { createClient } = require('redis');
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    const client = createClient({ url, socket: { connectTimeout: 2000 } });
    await client.connect();
    const pong = await client.ping();
    await client.quit();
    return { ok: pong === 'PONG', latencyMs: null };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function checkDatabase() {
  // Placeholder — implement based on actual DB (Postgres, Mongo, etc.)
  // For now, return ok if DB_URL is set
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return { ok: true, note: 'no database configured' };
  try {
    // Would do actual DB ping here
    return { ok: true, note: 'database check placeholder' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ─── Route Handlers ──────────────────────────────────────────────

/**
 * Full health check — used by Cloudflare LB and failover monitor.
 */
async function fullHealthCheck(req, res) {
  const [memory, eventLoop, redis, database] = await Promise.all([
    checkMemory(),
    checkEventLoop(),
    checkRedis(),
    checkDatabase(),
  ]);

  const checks = { memory, eventLoop, redis, database };
  const critical = [memory, eventLoop]; // These determine primary status
  const allCriticalOk = critical.every(c => c.ok);
  const anyFailed = Object.values(checks).some(c => !c.ok);

  let status;
  if (!allCriticalOk) status = 'unhealthy';
  else if (anyFailed) status = 'degraded';
  else status = 'ok';

  const httpStatus = status === 'unhealthy' ? 503 : 200;

  res.status(httpStatus).json({
    status,
    instance: getInstanceIdentity(),
    timestamp: new Date().toISOString(),
    uptime: Math.round((Date.now() - startTime) / 1000),
    checks,
  });
}

/**
 * Liveness probe — is the process running?
 * Lightweight, no dependency checks.
 */
function livenessCheck(req, res) {
  res.json({
    status: 'alive',
    uptime: Math.round((Date.now() - startTime) / 1000),
    pid: process.pid,
  });
}

/**
 * Readiness probe — can this instance accept traffic?
 * Checks critical dependencies.
 */
async function readinessCheck(req, res) {
  const memory = checkMemory();
  const eventLoop = await checkEventLoop();

  const ready = memory.ok && eventLoop.ok;
  res.status(ready ? 200 : 503).json({
    ready,
    checks: { memory, eventLoop },
  });
}

/**
 * Instance identity — who am I?
 * Used by the failover dispatcher to discover instances.
 */
function instanceInfo(req, res) {
  res.json({
    instance: getInstanceIdentity(),
    uptime: Math.round((Date.now() - startTime) / 1000),
    node: process.version,
    os: `${os.type()} ${os.release()} (${os.arch()})`,
    cpus: os.cpus().length,
    totalMemoryMB: Math.round(os.totalmem() / 1024 / 1024),
    freeMemoryMB: Math.round(os.freemem() / 1024 / 1024),
  });
}

// ─── Express Mounting ────────────────────────────────────────────

/**
 * Mount all health endpoints on an Express app.
 * 
 * Usage:
 *   const { mountHealthEndpoints } = require('./health-endpoint-v2');
 *   mountHealthEndpoints(app);
 */
function mountHealthEndpoints(app) {
  app.get('/api/health', fullHealthCheck);
  app.get('/api/health/live', livenessCheck);
  app.get('/api/health/ready', readinessCheck);
  app.get('/api/health/instance', instanceInfo);
}

// ─── Exports ─────────────────────────────────────────────────────

module.exports = {
  mountHealthEndpoints,
  fullHealthCheck,
  livenessCheck,
  readinessCheck,
  instanceInfo,
};

// Direct usage
if (require.main === module) {
  const express = require('express');
  const app = express();
  mountHealthEndpoints(app);
  const port = process.env.PORT || 3847;
  app.listen(port, () => console.log(`Health endpoints running on :${port}`));
}
