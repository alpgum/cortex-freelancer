/**
 * CFX-046: Failover Dispatcher
 * 
 * Manages automatic failover between primary and backup OpenClaw instances.
 * Integrates with CFX-016 load balancer and the instance health monitor.
 * 
 * Responsibilities:
 * - Maintain ordered instance registry (primary → backups)
 * - Route requests to the active instance
 * - Handle failover transitions with session preservation
 * - Provide manual override controls
 * - Log all failover events for audit
 */

const { InstanceHealthMonitor, InstanceStatus } = require('./instance-health-monitor');

// ─── Failover State Machine ─────────────────────────────────────

const DispatcherState = {
  NORMAL: 'normal',           // Primary is healthy, routing normally
  FAILING_OVER: 'failing_over', // In transition between instances
  BACKUP_ACTIVE: 'backup_active', // Running on a backup instance
  RECOVERING: 'recovering',    // Primary coming back, evaluating stability
  DEGRADED: 'degraded',        // All instances degraded, best-effort routing
  ALL_DOWN: 'all_down',        // No healthy instances
};

class FailoverDispatcher {
  /**
   * @param {object} options
   * @param {Array<{id, url, priority, role}>} options.instances
   * @param {object} options.monitorConfig - Override health monitor defaults
   * @param {object} options.sessionStore - Session store adapter {get, set, migrate}
   * @param {function} options.onStateChange - Callback for state transitions
   * @param {function} options.onAlert - Callback for alerts (pager, Slack, etc.)
   * @param {number} options.recoveryStabilityMs - How long primary must be healthy before switching back (default 60s)
   */
  constructor(options = {}) {
    const {
      instances = [],
      monitorConfig = {},
      sessionStore = null,
      onStateChange = null,
      onAlert = null,
      recoveryStabilityMs = 60_000,
    } = options;

    this.instances = instances;
    this.sessionStore = sessionStore;
    this.onStateChange = onStateChange;
    this.onAlert = onAlert;
    this.recoveryStabilityMs = recoveryStabilityMs;

    this.state = DispatcherState.NORMAL;
    this.activeInstanceId = instances.find(i => i.role === 'primary')?.id || instances[0]?.id;
    this.failoverHistory = [];
    this.recoveryTimer = null;
    this.manualOverride = null; // If set, forces traffic to this instance ID

    // Initialize health monitor
    this.monitor = new InstanceHealthMonitor(instances, monitorConfig);
    this._bindMonitorEvents();
  }

  // ─── Public API ────────────────────────────────────────────────

  /**
   * Start the dispatcher and health monitoring.
   */
  start() {
    this.monitor.start();
    this._log('info', `Dispatcher started. Active instance: ${this.activeInstanceId}`);
  }

  /**
   * Stop the dispatcher.
   */
  stop() {
    this.monitor.stop();
    if (this.recoveryTimer) clearTimeout(this.recoveryTimer);
    this._log('info', 'Dispatcher stopped');
  }

  /**
   * Get the URL to route traffic to.
   * This is the core method the load balancer/proxy calls.
   */
  getRouteTarget() {
    // Manual override takes precedence
    if (this.manualOverride) {
      const inst = this.instances.find(i => i.id === this.manualOverride);
      if (inst) return { url: inst.url, instanceId: inst.id, override: true };
    }

    const active = this.monitor.getActiveInstance();
    if (active) {
      return { url: active.url, instanceId: active.id, override: false };
    }

    // No healthy instance — return primary as last resort with flag
    const primary = this.instances.find(i => i.role === 'primary');
    return {
      url: primary?.url || null,
      instanceId: primary?.id || null,
      override: false,
      degraded: true,
    };
  }

  /**
   * Force traffic to a specific instance (manual override).
   * Pass null to clear override.
   */
  setManualOverride(instanceId) {
    this.manualOverride = instanceId;
    if (instanceId) {
      this._log('warn', `Manual override set: routing to ${instanceId}`);
    } else {
      this._log('info', 'Manual override cleared, returning to automatic routing');
    }
  }

  /**
   * Get full dispatcher status for the admin dashboard.
   */
  getFullStatus() {
    return {
      state: this.state,
      activeInstanceId: this.activeInstanceId,
      manualOverride: this.manualOverride,
      routeTarget: this.getRouteTarget(),
      instances: this.monitor.getStatus(),
      failoverHistory: this.failoverHistory.slice(-20), // Last 20 events
      uptime: process.uptime(),
    };
  }

  // ─── Event Handling ────────────────────────────────────────────

  _bindMonitorEvents() {
    this.monitor.on('failover:trigger', (event) => this._handleFailover(event));
    this.monitor.on('instance:recovered', (event) => this._handleRecovery(event));
    this.monitor.on('instance:degraded', (event) => this._handleDegraded(event));
    this.monitor.on('instance:status-change', (event) => this._handleStatusChange(event));
    this.monitor.on('instance:dead', (event) => this._handleDead(event));
  }

  async _handleFailover(event) {
    const { failed, switchTo } = event;

    // Only act if the failed instance is currently active
    if (failed.id !== this.activeInstanceId) return;

    const prevState = this.state;
    this.state = DispatcherState.FAILING_OVER;
    this._emitStateChange(prevState, this.state);

    const failoverEvent = {
      timestamp: new Date().toISOString(),
      type: 'failover',
      from: failed.id,
      to: switchTo?.id || 'none',
      reason: `Instance ${failed.id} declared dead`,
    };
    this.failoverHistory.push(failoverEvent);

    if (!switchTo) {
      this.state = DispatcherState.ALL_DOWN;
      this._emitStateChange(DispatcherState.FAILING_OVER, this.state);
      this._alert('critical', `ALL INSTANCES DOWN. No healthy backup available.`, event);
      this._log('error', 'All instances are down!');
      return;
    }

    // Migrate sessions if session store is available
    if (this.sessionStore) {
      try {
        this._log('info', `Migrating sessions from ${failed.id} to ${switchTo.id}...`);
        await this.sessionStore.migrate(failed.id, switchTo.id);
        this._log('info', 'Session migration complete');
      } catch (err) {
        this._log('error', `Session migration failed: ${err.message}`);
        // Continue with failover even if migration fails — better degraded than down
      }
    }

    this.activeInstanceId = switchTo.id;
    this.state = DispatcherState.BACKUP_ACTIVE;
    this._emitStateChange(DispatcherState.FAILING_OVER, this.state);

    this._alert('warning', `Failover: ${failed.id} → ${switchTo.id}`, event);
    this._log('warn', `Failover complete: now routing to ${switchTo.id}`);
  }

  _handleRecovery(event) {
    const { id } = event;
    const instance = this.instances.find(i => i.id === id);
    if (!instance) return;

    // If the recovered instance is the primary and we're on backup, start recovery timer
    if (instance.role === 'primary' && this.state === DispatcherState.BACKUP_ACTIVE) {
      this._log('info', `Primary ${id} recovered. Waiting ${this.recoveryStabilityMs}ms for stability...`);
      this.state = DispatcherState.RECOVERING;

      if (this.recoveryTimer) clearTimeout(this.recoveryTimer);
      this.recoveryTimer = setTimeout(() => {
        this._switchBackToPrimary(id);
      }, this.recoveryStabilityMs);
    }
  }

  async _switchBackToPrimary(primaryId) {
    // Verify it's still healthy
    const status = this.monitor.getStatus();
    if (status[primaryId]?.status !== InstanceStatus.HEALTHY) {
      this._log('warn', `Primary ${primaryId} no longer healthy during recovery window. Staying on backup.`);
      this.state = DispatcherState.BACKUP_ACTIVE;
      return;
    }

    const prevActive = this.activeInstanceId;

    // Migrate sessions back
    if (this.sessionStore) {
      try {
        await this.sessionStore.migrate(prevActive, primaryId);
      } catch (err) {
        this._log('error', `Session migration back to primary failed: ${err.message}`);
      }
    }

    this.activeInstanceId = primaryId;
    this.state = DispatcherState.NORMAL;

    this.failoverHistory.push({
      timestamp: new Date().toISOString(),
      type: 'recovery',
      from: prevActive,
      to: primaryId,
      reason: `Primary ${primaryId} recovered and stable`,
    });

    this._alert('info', `Recovered: traffic restored to primary ${primaryId}`, { from: prevActive, to: primaryId });
    this._log('info', `Recovered: routing back to primary ${primaryId}`);
  }

  _handleDegraded(event) {
    if (this.state === DispatcherState.NORMAL) {
      this.state = DispatcherState.DEGRADED;
      this._alert('warning', `Instance ${event.id} is degraded`, event);
    }
  }

  _handleStatusChange(event) {
    this._log('info', `Instance ${event.id}: ${event.from} → ${event.to}`);
  }

  _handleDead(event) {
    this._log('error', `Instance ${event.id} declared DEAD after ${event.failures} failures: ${event.error}`);
  }

  // ─── Helpers ───────────────────────────────────────────────────

  _emitStateChange(from, to) {
    this._log('info', `Dispatcher state: ${from} → ${to}`);
    if (this.onStateChange) this.onStateChange({ from, to, timestamp: new Date().toISOString() });
  }

  _alert(level, message, data = {}) {
    if (this.onAlert) this.onAlert({ level, message, data, timestamp: new Date().toISOString() });
  }

  _log(level, message) {
    const ts = new Date().toISOString();
    const prefix = `[CFX-046][${level.toUpperCase()}][${ts}]`;
    if (level === 'error') console.error(`${prefix} ${message}`);
    else if (level === 'warn') console.warn(`${prefix} ${message}`);
    else console.log(`${prefix} ${message}`);
  }
}

// ─── Express Admin Routes ────────────────────────────────────────

/**
 * Mount failover admin API on an Express app.
 * 
 *   GET  /api/failover/status   - Full status
 *   POST /api/failover/override - Set manual override { instanceId: string | null }
 *   POST /api/failover/check    - Force immediate check { instanceId: string }
 */
function mountAdminRoutes(app, dispatcher) {
  app.get('/api/failover/status', (req, res) => {
    res.json(dispatcher.getFullStatus());
  });

  app.post('/api/failover/override', (req, res) => {
    const { instanceId } = req.body;
    dispatcher.setManualOverride(instanceId || null);
    res.json({ ok: true, override: instanceId || null });
  });

  app.post('/api/failover/check', async (req, res) => {
    const { instanceId } = req.body;
    if (!instanceId) return res.status(400).json({ error: 'instanceId required' });
    try {
      await dispatcher.monitor.checkNow(instanceId);
      res.json({ ok: true, status: dispatcher.monitor.getStatus()[instanceId] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

// ─── Exports ─────────────────────────────────────────────────────

module.exports = { FailoverDispatcher, DispatcherState, mountAdminRoutes };
