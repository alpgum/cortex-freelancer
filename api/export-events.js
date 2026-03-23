const { cors } = require('./middleware/cors');
const { withErrorHandler, sendError } = require('./middleware/error-handler');
const { getFirestore } = require('./lib/firestore');

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'cortex-admin-2026';

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
  }

  // Auth check
  var token = req.query.token;
  if (token !== ADMIN_TOKEN) {
    return sendError(res, 403, 'Forbidden', 'FORBIDDEN', 'auth_error');
  }

  var db = getFirestore();
  if (!db) {
    return sendError(res, 503, 'Firestore unavailable', 'SERVICE_UNAVAILABLE', 'dependency_error');
  }

  var collection = req.query.collection || 'track_events';
  var allowedCollections = ['track_events', 'client_errors', 'payment_errors', 'processed_events'];
  if (allowedCollections.indexOf(collection) === -1) {
    return sendError(res, 400, 'Invalid collection. Allowed: ' + allowedCollections.join(', '), 'INVALID_COLLECTION', 'validation_error');
  }

  var limit = Math.min(parseInt(req.query.limit) || 500, 1000);
  var format = req.query.format || 'json';

  var query = db.collection(collection).orderBy('timestamp', 'desc').limit(limit);
  var snapshot = await query.get();

  var events = snapshot.docs.map(function(doc) {
    return Object.assign({ _id: doc.id }, doc.data());
  });

  if (format === 'csv') {
    if (events.length === 0) {
      res.setHeader('Content-Type', 'text/csv');
      res.send('No data');
      return;
    }
    var headers = Object.keys(events[0]);
    var csv = headers.join(',') + '\n' + events.map(function(row) {
      return headers.map(function(h) {
        var val = row[h] == null ? '' : String(row[h]);
        return '"' + val.replace(/"/g, '""') + '"';
      }).join(',');
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="' + collection + '-export.csv"');
    res.send(csv);
    return;
  }

  res.json({ success: true, collection: collection, count: events.length, events: events });
});
