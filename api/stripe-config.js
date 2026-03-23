const { cors } = require('./middleware/cors');
const { withErrorHandler, sendError } = require('./middleware/error-handler');
const { isStripeConfigured } = require('../config/stripe-prices');

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
  }

  res.json({ configured: isStripeConfigured() });
});
