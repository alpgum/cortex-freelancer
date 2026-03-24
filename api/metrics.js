/**
 * CFX-020: Metrics API Endpoint
 * 
 * GET /api/metrics — Current metrics snapshot
 * GET /api/metrics?period=1h|6h|24h|7d|30d — Historical data
 * GET /api/metrics?view=slow — Top slow endpoints
 * GET /api/metrics?view=uptime — Origin uptime status
 * GET /api/metrics?view=alerts — Active alerts + history
 * GET /api/metrics?view=dashboard — Full dashboard payload
 * 
 * Protected by METRICS_API_KEY or internal network check.
 */

'use strict';

module.exports = function metricsHandler(req, res) {
  // Auth: require API key or localhost
  const apiKey = process.env.METRICS_API_KEY;
  const providedKey = req.headers['x-metrics-key'] || req.query.key;
  const isLocal = req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1';
  const isInternal = req.headers['x-forwarded-for']?.includes('127.0.0.1');

  if (apiKey && !isLocal && !isInternal && providedKey !== apiKey) {
    return res.status(401).json({ error: 'Unauthorized. Provide x-metrics-key header or key query param.' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Lazy-load to avoid circular deps in server.js
  let metrics, alertManager, uptimeChecker;
  try {
    metrics = require('../monitoring/metrics-collector');
  } catch { metrics = null; }
  try {
    alertManager = require('../monitoring/_alert-instance');
  } catch { alertManager = null; }
  try {
    uptimeChecker = require('../monitoring/_uptime-instance');
  } catch { uptimeChecker = null; }

  const view = req.query.view || 'current';
  const period = req.query.period || '1h';

  try {
    switch (view) {
      case 'current':
        return res.json(metrics ? metrics.getCurrentMetrics() : { error: 'Metrics not initialized' });

      case 'history':
        return res.json({
          period,
          data: metrics ? metrics.getHistory(period) : [],
        });

      case 'slow':
        return res.json({
          endpoints: metrics ? metrics.getSlowEndpoints(20) : [],
        });

      case 'uptime':
        return res.json(uptimeChecker ? {
          summary: uptimeChecker.getSummary(),
          origins: uptimeChecker.getStatus(),
        } : { error: 'Uptime checker not initialized' });

      case 'alerts':
        return res.json(alertManager ? {
          active: alertManager.getActiveAlerts(),
          history: alertManager.getHistory(50),
          thresholds: alertManager.getThresholds(),
        } : { error: 'Alert manager not initialized' });

      case 'dashboard': {
        // Full payload for the dashboard SPA
        const current = metrics ? metrics.getCurrentMetrics() : {};
        const history = metrics ? metrics.getHistory(period) : [];
        const slowEndpoints = metrics ? metrics.getSlowEndpoints(10) : [];
        const uptime = uptimeChecker ? uptimeChecker.getSummary() : {};
        const uptimeStatus = uptimeChecker ? uptimeChecker.getStatus() : {};
        const alerts = alertManager ? {
          active: alertManager.getActiveAlerts(),
          recent: alertManager.getHistory(10),
        } : {};

        return res.json({
          timestamp: new Date().toISOString(),
          period,
          current,
          history,
          slowEndpoints,
          uptime,
          uptimeStatus,
          alerts,
        });
      }

      default:
        return res.status(400).json({ error: `Unknown view: ${view}. Use: current, history, slow, uptime, alerts, dashboard` });
    }
  } catch (err) {
    console.error('[Metrics API] Error:', err);
    return res.status(500).json({ error: 'Internal metrics error', message: err.message });
  }
};
