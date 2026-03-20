const { cors } = require('./_middleware/cors');
const { sanitize } = require('./_middleware/sanitize');
const { getFirestore } = require('./_lib/firestore');
const { withErrorHandler, sendError } = require('./_middleware/error-handler');

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
  }

  sanitize(req);

  const { uid, event, properties } = req.body;

  if (!uid || !event) {
    return sendError(res, 400, 'uid and event are required.', 'MISSING_FIELDS', 'validation_error');
  }

  if (typeof uid !== 'string' || typeof event !== 'string') {
    return sendError(res, 400, 'uid and event must be strings.', 'INVALID_FIELDS', 'validation_error');
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

  const firestore = getFirestore();
  if (!firestore) {
    console.warn('[track] Firestore not available, event dropped:', event);
    return sendError(res, 503, 'Tracking service unavailable.', 'TRACKING_UNAVAILABLE', 'service_error');
  }

  const ref = await firestore.collection('events').add(doc);
  console.log(`[track] ${event} by ${uid} → events/${ref.id}`);
  res.json({ success: true, id: ref.id });
});
