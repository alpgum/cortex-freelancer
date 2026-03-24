/**
 * CFX-020: Singleton UptimeChecker instance
 * Configure origins via MONITORING_ORIGINS env var (JSON array)
 * or use defaults matching the load balancer architecture.
 */
'use strict';

const UptimeChecker = require('./uptime-checker');

// Default origins matching CFX-016 load balancer architecture
const DEFAULT_ORIGINS = [
  {
    name: 'railway',
    platform: 'railway',
    url: process.env.RAILWAY_HEALTH_URL || process.env.RAILWAY_PUBLIC_URL || 'https://cortexfreelancer.com',
  },
  {
    name: 'render',
    platform: 'render',
    url: process.env.RENDER_HEALTH_URL || 'https://cortex-freelancer.onrender.com',
  },
  {
    name: 'digitalocean',
    platform: 'digitalocean',
    url: process.env.DO_HEALTH_URL || 'https://do.cortexfreelancer.com',
  },
];

let origins;
try {
  origins = process.env.MONITORING_ORIGINS
    ? JSON.parse(process.env.MONITORING_ORIGINS)
    : DEFAULT_ORIGINS;
} catch {
  console.warn('[Uptime] Failed to parse MONITORING_ORIGINS, using defaults');
  origins = DEFAULT_ORIGINS;
}

const checker = new UptimeChecker({
  origins,
  checkIntervalMs: parseInt(process.env.UPTIME_CHECK_INTERVAL_MS) || 60_000,
  timeoutMs: parseInt(process.env.UPTIME_CHECK_TIMEOUT_MS) || 10_000,
});

// Auto-start if not in test mode
if (process.env.NODE_ENV !== 'test') {
  checker.start();
}

module.exports = checker;
