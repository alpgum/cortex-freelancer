const { cors } = require('./middleware/cors');
const { sanitize } = require('./middleware/sanitize');
const { getFirestore } = require('./lib/firestore');
const { withErrorHandler, sendError } = require('./middleware/error-handler');

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
  }

  sanitize(req);

  const { uid, event, properties, url, referrer, screen, tool, action } = req.body;

  if (!event) {
    return sendError(res, 400, 'event is required.', 'MISSING_FIELDS', 'validation_error');
  }

  if (typeof event !== 'string') {
    return sendError(res, 400, 'event must be a string.', 'INVALID_FIELDS', 'validation_error');
  }

  const firestore = getFirestore();
  if (!firestore) {
    console.warn('[track] Firestore not available, event dropped:', event);
    return sendError(res, 503, 'Tracking service unavailable.', 'TRACKING_UNAVAILABLE', 'service_error');
  }

  // Authenticated event tracking (existing behavior)
  if (uid) {
    if (typeof uid !== 'string') {
      return sendError(res, 400, 'uid must be a string.', 'INVALID_FIELDS', 'validation_error');
    }
    if (properties && typeof properties !== 'object') {
      return sendError(res, 400, 'properties must be an object.', 'INVALID_PROPERTIES', 'validation_error');
    }
    const doc = {
      uid,
      event,
      properties: properties || {},
      timestamp: new Date().toISOString()
    };
    const ref = await firestore.collection('events').add(doc);
    console.log(`[track] ${event} by ${uid} → events/${ref.id}`);
    return res.json({ success: true, id: ref.id });
  }

  // Privacy-friendly anonymous tracking — no cookies, no PII
  const clean = {
    event: String(event).slice(0, 100),
    url: url ? String(url).slice(0, 500) : null,
    referrer: referrer ? String(referrer).slice(0, 500) : null,
    screen: screen ? String(screen).slice(0, 20) : null,
    tool: tool ? String(tool).slice(0, 100) : null,
    action: action ? String(action).slice(0, 50) : null,
    date: new Date().toISOString().slice(0, 10),
    timestamp: new Date().toISOString()
  };

  // Remove null fields
  Object.keys(clean).forEach(function(k) { if (clean[k] === null) delete clean[k]; });

  await firestore.collection('analytics_events').add(clean);
  res.status(200).json({ ok: true });
});
