const path = require('path');
const config = require('../config');
const { createAnalytics } = require('../analytics');

const analytics = createAnalytics({
  dataDir: path.join(__dirname, '..', 'data', 'analytics'),
  appVersion: process.env.GIT_SHA || process.env.RENDER_GIT_COMMIT || process.env.RAILWAY_GIT_COMMIT_SHA || null,
  transportAllowlist: ['ws', 'sse', 'http', 'chunked', 'socketio', 'webrtc', 'unknown', 'other']
});

function isAuthorized(req) {
  const token = req.headers['x-admin-token'] || req.query.token;
  return token && config.admin && token === config.admin.token;
}

module.exports = async function adminAnalyticsHandler(req, res) {
  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const limitDays = Math.min(90, Math.max(1, Number(req.query.days || 14)));
  const mode = req.query.mode || 'summary';

  if (mode === 'summary') {
    return res.json(analytics.getSummary({ limitDays }));
  }

  if (mode === 'export') {
    const format = (req.query.format || 'json').toLowerCase();
    const events = analytics.exportEvents({ limitDays });

    if (format === 'csv') {
      const csv = analytics.exportCsv(events);
      res.set('Content-Type', 'text/csv; charset=utf-8');
      res.set('Content-Disposition', `attachment; filename="analytics-${limitDays}d.csv"`);
      return res.send(csv);
    }

    res.set('Content-Type', 'application/json; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="analytics-${limitDays}d.json"`);
    return res.send(JSON.stringify({ events }, null, 2));
  }

  return res.status(400).json({ error: 'Unknown mode' });
};
