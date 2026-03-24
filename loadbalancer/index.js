/**
 * CFX-046: Backup Instances — Integration Entrypoint
 * 
 * Wires together the health monitor, failover dispatcher, session store,
 * and health endpoints into a running system.
 * 
 * Usage:
 *   const { initFailover } = require('./loadbalancer');
 *   const { dispatcher, sessionStore } = await initFailover(app);
 */

const { FailoverDispatcher, mountAdminRoutes } = require('./failover-dispatcher');
const { RedisSessionStore, instanceAffinityMiddleware } = require('./session-store');
const { mountHealthEndpoints } = require('./health-endpoint-v2');
const config = require('./instance-config.json');

/**
 * Initialize the full failover system.
 * 
 * @param {import('express').Application} app - Express app to mount endpoints on
 * @param {object} overrides - Override config values
 * @returns {{ dispatcher: FailoverDispatcher, sessionStore: RedisSessionStore }}
 */
async function initFailover(app, overrides = {}) {
  // 1. Mount health endpoints
  mountHealthEndpoints(app);

  // 2. Set up session store
  const sessionStore = new RedisSessionStore({
    ...config.sessionStore,
    ...overrides.sessionStore,
  });
  await sessionStore.connect();

  // 3. Set up instance affinity middleware
  const instanceId = process.env.INSTANCE_ID || config.instances[0].id;
  app.use(instanceAffinityMiddleware(instanceId));

  // 4. Create and start failover dispatcher
  const dispatcher = new FailoverDispatcher({
    instances: overrides.instances || config.instances,
    monitorConfig: { ...config.monitor, ...overrides.monitor },
    sessionStore,
    recoveryStabilityMs: overrides.recoveryStabilityMs || config.failover.recoveryStabilityMs,

    onStateChange: (event) => {
      console.log(`[CFX-046] State change: ${event.from} → ${event.to}`);
    },

    onAlert: (alert) => {
      console.log(`[CFX-046][ALERT][${alert.level}] ${alert.message}`);
      // TODO: Integrate with Slack/PagerDuty/email via config.failover.alertChannels
    },
  });

  // 5. Mount admin routes
  mountAdminRoutes(app, dispatcher);

  // 6. Start monitoring
  dispatcher.start();

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[CFX-046] Shutting down failover system...');
    dispatcher.stop();
    await sessionStore.close();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return { dispatcher, sessionStore };
}

module.exports = { initFailover };
