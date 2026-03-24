/**
 * CFX-020: Uptime Checker
 * 
 * Multi-origin health checking with historical tracking.
 * Checks Railway, Render, DigitalOcean origins independently.
 * Used by both the dashboard and the alert manager.
 */

'use strict';

const https = require('https');
const http = require('http');

class UptimeChecker {
  constructor(options = {}) {
    this.origins = options.origins || [];
    this.checkIntervalMs = options.checkIntervalMs || 60_000; // 1 minute
    this.timeoutMs = options.timeoutMs || 10_000;
    this.maxHistory = options.maxHistory || 1440; // 24h at 1-min intervals

    // Per-origin state
    this._state = new Map();
    this._interval = null;

    // Initialize state for each origin
    for (const origin of this.origins) {
      this._state.set(origin.name, {
        name: origin.name,
        url: origin.url,
        platform: origin.platform,
        status: 'unknown',
        lastCheck: null,
        lastUp: null,
        lastDown: null,
        responseTimeMs: null,
        consecutiveFailures: 0,
        uptimePercent: 100,
        checks: [],      // ring buffer of recent check results
        totalChecks: 0,
        totalUp: 0,
      });
    }
  }

  // ── Start Periodic Checking ──
  start() {
    if (this._interval) return;
    // Run immediately, then on interval
    this._checkAll();
    this._interval = setInterval(() => this._checkAll(), this.checkIntervalMs);
    if (this._interval.unref) this._interval.unref();
    console.log(`[Uptime] Monitoring ${this.origins.length} origins every ${this.checkIntervalMs / 1000}s`);
  }

  stop() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }

  // ── Check All Origins ──
  async _checkAll() {
    const promises = this.origins.map(o => this._checkOrigin(o));
    await Promise.allSettled(promises);
  }

  // ── Check Single Origin ──
  async _checkOrigin(origin) {
    const state = this._state.get(origin.name);
    if (!state) return;

    const start = Date.now();
    let result;

    try {
      const response = await this._httpGet(origin.url + '/api/health');
      const elapsed = Date.now() - start;
      const body = JSON.parse(response.body);

      result = {
        timestamp: new Date().toISOString(),
        status: body.status === 'ok' ? 'up' : body.status === 'degraded' ? 'degraded' : 'down',
        responseTimeMs: elapsed,
        statusCode: response.statusCode,
        details: {
          platform: body.platform,
          uptime: body.uptime,
          memory: body.checks?.memory,
          eventLoop: body.checks?.eventLoop,
        },
      };
    } catch (err) {
      result = {
        timestamp: new Date().toISOString(),
        status: 'down',
        responseTimeMs: Date.now() - start,
        statusCode: err.statusCode || 0,
        error: err.message,
      };
    }

    // Update state
    state.lastCheck = result.timestamp;
    state.responseTimeMs = result.responseTimeMs;
    state.totalChecks++;

    if (result.status === 'up' || result.status === 'degraded') {
      state.status = result.status;
      state.lastUp = result.timestamp;
      state.consecutiveFailures = 0;
      state.totalUp++;
    } else {
      state.status = 'down';
      state.lastDown = result.timestamp;
      state.consecutiveFailures++;
    }

    // Update uptime percentage
    state.uptimePercent = state.totalChecks > 0
      ? Math.round((state.totalUp / state.totalChecks) * 10000) / 100
      : 0;

    // Add to history (ring buffer style)
    state.checks.push(result);
    if (state.checks.length > this.maxHistory) {
      state.checks = state.checks.slice(-this.maxHistory);
    }

    return result;
  }

  _httpGet(url) {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const transport = parsed.protocol === 'https:' ? https : http;

      const req = transport.get({
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        timeout: this.timeoutMs,
        headers: { 'User-Agent': 'CortexFreelancer-UptimeChecker/1.0' },
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ statusCode: res.statusCode, body });
          } else {
            const err = new Error(`HTTP ${res.statusCode}`);
            err.statusCode = res.statusCode;
            reject(err);
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  // ── Public API ──

  /** Get status for all origins */
  getStatus() {
    const results = {};
    for (const [name, state] of this._state) {
      results[name] = {
        name: state.name,
        platform: state.platform,
        url: state.url,
        status: state.status,
        lastCheck: state.lastCheck,
        lastUp: state.lastUp,
        lastDown: state.lastDown,
        responseTimeMs: state.responseTimeMs,
        uptimePercent: state.uptimePercent,
        consecutiveFailures: state.consecutiveFailures,
      };
    }
    return results;
  }

  /** Get detailed history for a specific origin */
  getOriginHistory(name, limit = 60) {
    const state = this._state.get(name);
    if (!state) return null;
    return state.checks.slice(-limit);
  }

  /** Get uptime summary across all origins */
  getSummary() {
    const origins = Array.from(this._state.values());
    const allUp = origins.every(o => o.status === 'up');
    const anyDown = origins.some(o => o.status === 'down');
    const anyDegraded = origins.some(o => o.status === 'degraded');

    return {
      overall: anyDown ? 'partial_outage' : anyDegraded ? 'degraded' : allUp ? 'operational' : 'unknown',
      origins: origins.map(o => ({
        name: o.name,
        status: o.status,
        uptimePercent: o.uptimePercent,
        responseTimeMs: o.responseTimeMs,
      })),
      checkedAt: new Date().toISOString(),
    };
  }

  /** Get a 24h uptime bar (for dashboard visualization) */
  getUptimeBar(name, hours = 24) {
    const state = this._state.get(name);
    if (!state) return [];

    const now = Date.now();
    const bars = [];

    for (let i = hours - 1; i >= 0; i--) {
      const hourStart = now - (i + 1) * 3600_000;
      const hourEnd = now - i * 3600_000;

      const checks = state.checks.filter(c => {
        const t = new Date(c.timestamp).getTime();
        return t >= hourStart && t < hourEnd;
      });

      if (checks.length === 0) {
        bars.push({ hour: new Date(hourStart).toISOString(), status: 'no_data' });
      } else {
        const upChecks = checks.filter(c => c.status === 'up' || c.status === 'degraded').length;
        const ratio = upChecks / checks.length;
        bars.push({
          hour: new Date(hourStart).toISOString(),
          status: ratio === 1 ? 'up' : ratio >= 0.5 ? 'degraded' : 'down',
          uptimeRatio: ratio,
          avgResponseMs: Math.round(checks.reduce((s, c) => s + c.responseTimeMs, 0) / checks.length),
        });
      }
    }

    return bars;
  }
}

module.exports = UptimeChecker;
