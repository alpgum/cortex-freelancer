/**
 * CFX-046: Instance Health Monitoring Module
 * 
 * Monitors OpenClaw/Cortex Freelancer instances for health,
 * detects failures, and triggers failover in the dispatcher.
 * 
 * Features:
 * - Periodic health checks with configurable intervals
 * - Exponential backoff on repeated failures
 * - Grace period before declaring instance dead
 * - Event emitter for failover triggers
 * - Integration with CFX-016 Cloudflare LB health data
 */

const EventEmitter = require('events');
const https = require('https');
const http = require('http');

// ─── Configuration ───────────────────────────────────────────────

const DEFAULT_CONFIG = {
  // How often to poll each instance (ms)
  checkIntervalMs: 10_000,

  // How long to wait for a health response before timeout (ms)
  timeoutMs: 5_000,

  // Consecutive failures before marking instance unhealthy
  failureThreshold: 3,

  // Consecutive successes before marking recovered instance healthy
  recoveryThreshold: 2,

  // Grace period after startup before health checks begin (ms)
  startupGraceMs: 15_000,

  // Max backoff between checks when instance is down (ms)
  maxBackoffMs: 60_000,

  // Expected health response body substring
  expectedBody: '"status":"ok"',

  // Health endpoint path
  healthPath: '/api/health',
};

// ─── Instance State ──────────────────────────────────────────────

const InstanceStatus = {
  UNKNOWN: 'unknown',
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  UNHEALTHY: 'unhealthy',
  DEAD: 'dead',        // Confirmed down after threshold
  RECOVERING: 'recovering',
};

// ─── Health Monitor ──────────────────────────────────────────────

class InstanceHealthMonitor extends EventEmitter {
  /**
   * @param {Array<{id: string, url: string, priority: number, role: 'primary'|'backup'}>} instances
   * @param {object} config - Override DEFAULT_CONFIG
   */
  constructor(instances, config = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.instances = new Map();
    this.timers = new Map();
    this.running = false;

    for (const inst of instances) {
      this.instances.set(inst.id, {
        ...inst,
        status: InstanceStatus.UNKNOWN,
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
        lastCheck: null,
        lastHealthy: null,
        lastError: null,
        responseTimeMs: null,
        healthData: null,
        currentBackoffMs: this.config.checkIntervalMs,
      });
    }
  }

  /**
   * Start monitoring all instances.
   */
  start() {
    if (this.running) return;
    this.running = true;

    const graceMs = this.config.startupGraceMs;
    this.emit('monitor:start', { instanceCount: this.instances.size, graceMs });

    setTimeout(() => {
      if (!this.running) return;
      for (const [id] of this.instances) {
        this._scheduleCheck(id, 0);
      }
    }, graceMs);
  }

  /**
   * Stop monitoring.
   */
  stop() {
    this.running = false;
    for (const [id, timer] of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.emit('monitor:stop');
  }

  /**
   * Get current state of all instances.
   */
  getStatus() {
    const result = {};
    for (const [id, state] of this.instances) {
      result[id] = {
        id: state.id,
        url: state.url,
        priority: state.priority,
        role: state.role,
        status: state.status,
        consecutiveFailures: state.consecutiveFailures,
        lastCheck: state.lastCheck,
        lastHealthy: state.lastHealthy,
        lastError: state.lastError,
        responseTimeMs: state.responseTimeMs,
      };
    }
    return result;
  }

  /**
   * Get the current active (healthiest, highest-priority) instance.
   */
  getActiveInstance() {
    const healthy = [];
    for (const [, state] of this.instances) {
      if (state.status === InstanceStatus.HEALTHY || state.status === InstanceStatus.DEGRADED) {
        healthy.push(state);
      }
    }
    if (healthy.length === 0) return null;
    // Sort by priority (lower = higher priority), then prefer HEALTHY over DEGRADED
    healthy.sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === InstanceStatus.HEALTHY ? -1 : 1;
      }
      return a.priority - b.priority;
    });
    return healthy[0];
  }

  /**
   * Force an immediate check on an instance.
   */
  async checkNow(instanceId) {
    return this._performCheck(instanceId);
  }

  // ─── Internal ────────────────────────────────────────────────

  _scheduleCheck(id, delayMs) {
    if (!this.running) return;
    if (this.timers.has(id)) {
      clearTimeout(this.timers.get(id));
    }
    const timer = setTimeout(() => this._performCheck(id), delayMs);
    this.timers.set(id, timer);
  }

  async _performCheck(id) {
    const state = this.instances.get(id);
    if (!state || !this.running) return;

    const startTime = Date.now();
    state.lastCheck = new Date().toISOString();

    try {
      const healthData = await this._fetchHealth(state.url + this.config.healthPath);
      const responseTimeMs = Date.now() - startTime;

      state.responseTimeMs = responseTimeMs;
      state.healthData = healthData;
      state.lastError = null;
      state.consecutiveFailures = 0;
      state.consecutiveSuccesses++;

      const prevStatus = state.status;

      if (healthData.status === 'ok') {
        if (state.status === InstanceStatus.DEAD || state.status === InstanceStatus.UNHEALTHY) {
          // Require recovery threshold before marking healthy again
          if (state.consecutiveSuccesses >= this.config.recoveryThreshold) {
            state.status = InstanceStatus.HEALTHY;
            state.lastHealthy = new Date().toISOString();
            this.emit('instance:recovered', { id, prevStatus, responseTimeMs });
          } else {
            state.status = InstanceStatus.RECOVERING;
          }
        } else {
          state.status = InstanceStatus.HEALTHY;
          state.lastHealthy = new Date().toISOString();
        }
      } else if (healthData.status === 'degraded') {
        state.status = InstanceStatus.DEGRADED;
        state.lastHealthy = new Date().toISOString();
        this.emit('instance:degraded', { id, healthData, responseTimeMs });
      }

      // Reset backoff on success
      state.currentBackoffMs = this.config.checkIntervalMs;

      if (prevStatus !== state.status) {
        this.emit('instance:status-change', { id, from: prevStatus, to: state.status });
      }

    } catch (error) {
      const responseTimeMs = Date.now() - startTime;
      state.responseTimeMs = responseTimeMs;
      state.lastError = error.message;
      state.consecutiveSuccesses = 0;
      state.consecutiveFailures++;

      const prevStatus = state.status;

      if (state.consecutiveFailures >= this.config.failureThreshold) {
        state.status = InstanceStatus.DEAD;
        if (prevStatus !== InstanceStatus.DEAD) {
          this.emit('instance:dead', { id, failures: state.consecutiveFailures, error: error.message });
          this._triggerFailover(id);
        }
      } else {
        state.status = InstanceStatus.UNHEALTHY;
        if (prevStatus === InstanceStatus.HEALTHY || prevStatus === InstanceStatus.UNKNOWN) {
          this.emit('instance:unhealthy', { id, failures: state.consecutiveFailures, error: error.message });
        }
      }

      // Exponential backoff for failed instances
      state.currentBackoffMs = Math.min(
        state.currentBackoffMs * 1.5,
        this.config.maxBackoffMs
      );

      if (prevStatus !== state.status) {
        this.emit('instance:status-change', { id, from: prevStatus, to: state.status });
      }
    }

    // Schedule next check
    this._scheduleCheck(id, state.currentBackoffMs);
  }

  _fetchHealth(url) {
    return new Promise((resolve, reject) => {
      const mod = url.startsWith('https') ? https : http;
      const req = mod.get(url, { timeout: this.config.timeoutMs }, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          if (res.statusCode === 503) {
            return reject(new Error(`HTTP 503: instance unhealthy`));
          }
          if (res.statusCode !== 200) {
            return reject(new Error(`HTTP ${res.statusCode}`));
          }
          try {
            const data = JSON.parse(body);
            if (this.config.expectedBody && !body.includes(this.config.expectedBody)) {
              return reject(new Error(`Unexpected body: missing ${this.config.expectedBody}`));
            }
            resolve(data);
          } catch (e) {
            reject(new Error(`Invalid JSON: ${e.message}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Timeout after ${this.config.timeoutMs}ms`));
      });
    });
  }

  _triggerFailover(failedId) {
    const failedState = this.instances.get(failedId);
    const active = this.getActiveInstance();

    this.emit('failover:trigger', {
      failed: {
        id: failedId,
        url: failedState.url,
        role: failedState.role,
        priority: failedState.priority,
      },
      switchTo: active ? {
        id: active.id,
        url: active.url,
        role: active.role,
        priority: active.priority,
      } : null,
      allInstances: this.getStatus(),
    });
  }
}

// ─── Exports ─────────────────────────────────────────────────────

module.exports = { InstanceHealthMonitor, InstanceStatus, DEFAULT_CONFIG };
