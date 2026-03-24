const path = require('path');
const config = require('../config');
const { createAnalytics } = require('../analytics');

const analytics = createAnalytics({
  dataDir: path.join(__dirname, '..', 'data', 'analytics'),
  appVersion: process.env.GIT_SHA || process.env.RENDER_GIT_COMMIT || process.env.RAILWAY_GIT_COMMIT_SHA || null,
  transportAllowlist: ['ws', 'sse', 'http', 'chunked', 'socketio', 'webrtc', 'unknown', 'other']
});

module.exports = async function analyticsHandler(req, res) {
  // Public endpoint: only accepts event payload, no PII. Rate limit is already applied to /api.
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'content-type');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = req.body || {};

    // Enforce local-only default for now: only allow same-origin unless explicitly enabled
    const origin = req.headers.origin;
    if (origin && !origin.includes(req.headers.host) && !config.isDev()) {
      // best-effort: don’t leak analytics to cross-origin embeds
      return res.status(403).json({ error: 'Forbidden' });
    }

    const event = analytics.track(payload);
    return res.status(200).json({ ok: true, event: { ts: event.ts, type: event.type, name: event.name } });
  } catch (e) {
    return res.status(200).json({ ok: false });
  }
};
