/**
 * CFX-016: Unified Health Check Endpoint
 * 
 * Deploy as /api/health on ALL platforms (Railway, Render, DigitalOcean, Vercel).
 * Returns structured health data for Cloudflare Load Balancer monitors.
 * 
 * Response format:
 * {
 *   "status": "ok" | "degraded" | "unhealthy",
 *   "platform": "railway" | "render" | "digitalocean" | "vercel",
 *   "timestamp": "2026-03-25T00:00:00.000Z",
 *   "uptime": 12345,
 *   "version": "1.0.0",
 *   "checks": { ... }
 * }
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

// Check memory usage
function checkMemory() {
  const used = process.memoryUsage();
  const totalMB = Math.round(used.heapTotal / 1024 / 1024);
  const usedMB = Math.round(used.heapUsed / 1024 / 1024);
  const pct = Math.round((usedMB / totalMB) * 100);
  return {
    ok: pct < 90,
    totalMB,
    usedMB,
    percent: pct
  };
}

// Check event loop lag
function checkEventLoop() {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    setImmediate(() => {
      const lag = Number(process.hrtime.bigint() - start) / 1e6; // ms
      resolve({
        ok: lag < 100, // >100ms event loop lag = unhealthy
        lagMs: Math.round(lag * 100) / 100
      });
    });
  });
}

// Check disk space (non-Vercel only)
function checkDisk() {
  try {
    const { execSync } = require('child_process');
    const df = execSync('df -h / | tail -1', { timeout: 2000 }).toString().trim();
    const parts = df.split(/\s+/);
    const usePct = parseInt(parts[4]);
    return {
      ok: usePct < 90,
      percent: usePct,
      available: parts[3]
    };
  } catch {
    return { ok: true, percent: null, note: 'disk check unavailable' };
  }
}

// Main health check handler
async function healthCheck(req, res) {
  const memory = checkMemory();
  const eventLoop = await checkEventLoop();
  const disk = detectPlatform() !== 'vercel' ? checkDisk() : { ok: true, note: 'serverless' };

  const checks = { memory, eventLoop, disk };
  const allOk = Object.values(checks).every(c => c.ok);
  const anyFailed = Object.values(checks).some(c => !c.ok);

  const status = allOk ? 'ok' : anyFailed ? 'degraded' : 'unhealthy';
  const httpStatus = status === 'unhealthy' ? 503 : 200;

  const response = {
    status,
    platform: detectPlatform(),
    timestamp: new Date().toISOString(),
    uptime: Math.round((Date.now() - startTime) / 1000),
    version: process.env.npm_package_version || process.env.APP_VERSION || '1.0.0',
    region: process.env.RAILWAY_REGION || process.env.RENDER_REGION || process.env.DO_REGION || 'unknown',
    node: process.version,
    checks
  };

  res.status(httpStatus).json(response);
}

// Express middleware export
module.exports = healthCheck;

// Vercel serverless export
module.exports.default = async (req, res) => {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  return healthCheck(req, res);
};

// Direct usage (for testing)
if (require.main === module) {
  const express = require('express');
  const app = express();
  app.get('/api/health', healthCheck);
  const port = process.env.PORT || 3847;
  app.listen(port, () => console.log(`Health check running on :${port}/api/health`));
}
