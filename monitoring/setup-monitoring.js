/**
 * CFX-020: Monitoring Setup
 * 
 * Call this from server.js to wire up all monitoring components.
 * 
 * Usage in server.js:
 *   const { setupMonitoring } = require('./monitoring/setup-monitoring');
 *   setupMonitoring(app);
 */

'use strict';

const path = require('path');

function setupMonitoring(app) {
  console.log('Setting up monitoring (CFX-020)...');

  // 1. Metrics collector middleware (must be early in stack)
  const metrics = require('./metrics-collector');
  app.use(metrics.middleware());
  console.log('  ✓ Metrics collector middleware');

  // 2. Alert manager (starts evaluating on interval)
  const alertManager = require('./_alert-instance');
  
  // Evaluate alerts every 60 seconds
  const alertInterval = setInterval(() => {
    const currentMetrics = metrics.getCurrentMetrics();
    alertManager.evaluate(currentMetrics);
  }, 60_000);
  if (alertInterval.unref) alertInterval.unref();
  console.log('  ✓ Alert manager');

  // 3. Uptime checker (auto-starts via _uptime-instance.js)
  require('./_uptime-instance');
  console.log('  ✓ Uptime checker');

  // 4. Serve monitoring dashboard (protected)
  app.get('/ops/dashboard', (req, res) => {
    // Simple auth: require ops key or localhost
    const opsKey = process.env.OPS_DASHBOARD_KEY;
    const providedKey = req.query.key || req.headers['x-ops-key'];
    const isLocal = req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1';

    if (opsKey && !isLocal && providedKey !== opsKey) {
      return res.status(401).send('Unauthorized. Provide ?key= parameter.');
    }

    res.sendFile(path.join(__dirname, 'dashboard.html'));
  });
  console.log('  ✓ Dashboard at /ops/dashboard');

  // 5. Public status page
  app.get('/status', (req, res) => {
    res.sendFile(path.join(__dirname, 'status-page.html'));
  });
  console.log('  ✓ Public status at /status');

  // 6. Expose metrics helper on app for WebSocket integration
  app.locals.metrics = metrics;
  app.locals.alertManager = alertManager;

  console.log('Monitoring ready ✓');

  return { metrics, alertManager };
}

module.exports = { setupMonitoring };
