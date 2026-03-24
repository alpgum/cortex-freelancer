#!/usr/bin/env node
/**
 * CFX-010: Server-Side Resource Monitor
 * 
 * Polls the server's /ws/health endpoint and monitors system resources
 * during stress tests. Run this alongside the stress test.
 * 
 * Usage:
 *   node server-monitor.js [--url URL] [--interval SECONDS] [--duration SECONDS]
 */

const http = require('http');
const https = require('https');
const os = require('os');
const fs = require('fs');

const CONFIG = {
  healthUrl: process.env.HEALTH_URL || 'http://localhost:3847/ws/health',
  intervalMs: parseInt(process.env.INTERVAL || '5', 10) * 1000,
  durationMs: parseInt(process.env.DURATION || '120', 10) * 1000,
};

// Parse CLI args
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--url' && process.argv[i + 1]) CONFIG.healthUrl = process.argv[++i];
  if (process.argv[i] === '--interval' && process.argv[i + 1]) CONFIG.intervalMs = parseInt(process.argv[++i], 10) * 1000;
  if (process.argv[i] === '--duration' && process.argv[i + 1]) CONFIG.durationMs = parseInt(process.argv[++i], 10) * 1000;
}

const samples = [];
let startTime = Date.now();

function fetchHealth() {
  return new Promise((resolve, reject) => {
    const mod = CONFIG.healthUrl.startsWith('https') ? https : http;
    const req = mod.get(CONFIG.healthUrl, { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Invalid JSON: ' + data.slice(0, 100)));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function getLocalResources() {
  return {
    freeMem: Math.round(os.freemem() / 1024 / 1024),
    totalMem: Math.round(os.totalmem() / 1024 / 1024),
    memPct: Math.round((1 - os.freemem() / os.totalmem()) * 100),
    load: os.loadavg().map(l => Math.round(l * 100) / 100),
    cpus: os.cpus().length,
  };
}

async function poll() {
  const elapsed = Date.now() - startTime;
  const local = getLocalResources();
  let server = null;

  try {
    server = await fetchHealth();
  } catch (e) {
    console.log(`  [${Math.round(elapsed / 1000)}s] ❌ Health check failed: ${e.message}`);
    samples.push({ ts: Date.now(), elapsed, local, error: e.message });
    return;
  }

  const sample = {
    ts: Date.now(),
    elapsed,
    local,
    server: {
      connections: server.totalConnections,
      byState: server.byState,
      errors: server.errors?.total || 0,
      errorsByCode: server.errors?.byCode || {},
      resources: server.resources,
      openclawAvailable: server.openclawAvailable,
    },
  };
  samples.push(sample);

  // Print summary
  const states = server.byState ? Object.entries(server.byState).map(([k, v]) => `${k}=${v}`).join(' ') : 'none';
  const srvMem = server.resources ? `mem=${Math.round(server.resources.memUsageRatio * 100)}%` : '';
  const srvLoad = server.resources ? `load=${server.resources.loadAvg}` : '';
  
  console.log(`  [${Math.round(elapsed / 1000)}s] conns=${server.totalConnections} ${states} | ${srvMem} ${srvLoad} | local: mem=${local.memPct}% load=${local.load[0]}`);

  // Warn on concerning conditions
  if (server.resources?.isDegraded) {
    console.log(`  ⚠️  Server resources DEGRADED (mem=${Math.round(server.resources.memUsageRatio * 100)}% free=${server.resources.freeMem}MB)`);
  }
  if (server.resources?.isExhausted) {
    console.log(`  🚨 Server resources EXHAUSTED!`);
  }
  if (server.errors?.total > 0) {
    console.log(`  ⚠️  Server errors: ${server.errors.total} total — ${JSON.stringify(server.errors.byCode)}`);
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   CFX-010: Server Resource Monitor         ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log(`\nPolling: ${CONFIG.healthUrl} every ${CONFIG.intervalMs / 1000}s for ${CONFIG.durationMs / 1000}s`);

  startTime = Date.now();

  const timer = setInterval(poll, CONFIG.intervalMs);
  await poll(); // Initial poll

  // Run for duration
  await new Promise(r => setTimeout(r, CONFIG.durationMs));
  clearInterval(timer);

  // Final poll
  await poll();

  // Save results
  const reportPath = `${__dirname}/monitor-${Date.now()}.json`;
  fs.writeFileSync(reportPath, JSON.stringify({
    config: CONFIG,
    samples,
    summary: {
      totalSamples: samples.length,
      durationMs: Date.now() - startTime,
      maxConnections: Math.max(...samples.filter(s => s.server).map(s => s.server.connections), 0),
      maxErrors: Math.max(...samples.filter(s => s.server).map(s => s.server.errors), 0),
      peakMemPct: Math.max(...samples.map(s => s.local.memPct)),
      peakLoad: Math.max(...samples.map(s => s.local.load[0])),
    },
  }, null, 2));

  console.log(`\n  Monitor data saved: ${reportPath}`);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
