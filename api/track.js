const { cors } = require('./_middleware/cors');
const { sanitize } = require('./_middleware/sanitize');
const { getFirestore } = require('./_lib/firestore');

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  sanitize(req);

  const { uid, event, properties } = req.body;

  if (!uid || !event) {
    return res.status(400).json({ error: 'uid and event are required.' });
  }

  if (typeof uid !== 'string' || typeof event !== 'string') {
    return res.status(400).json({ error: 'uid and event must be strings.' });
  }

  if (properties && typeof properties !== 'object') {
    return res.status(400).json({ error: 'properties must be an object.' });
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
    return res.status(503).json({ error: 'Tracking service unavailable.' });
  }

  try {
    const ref = await firestore.collection('events').add(doc);
    console.log(`[track] ${event} by ${uid} → events/${ref.id}`);
    res.json({ success: true, id: ref.id });
  } catch (err) {
    console.error('[track] Firestore write failed:', err.message);
    res.status(500).json({ error: 'Failed to store event.' });
  }
};
