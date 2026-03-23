const fs = require('fs');
const path = require('path');
const { cors } = require('./middleware/cors');
const { rateLimit } = require('./middleware/rate-limit');
const { sanitize } = require('./middleware/sanitize');
const { withErrorHandler, sendError } = require('./middleware/error-handler');

const DATA_DIR = path.join(__dirname, '..', 'data');

/**
 * Remove user data from a JSON array file by email.
 * Returns the number of records removed.
 */
function removeFromFile(filePath, email) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return 0;

    const before = data.length;
    const filtered = data.filter(item => item.email !== email);
    if (filtered.length < before) {
      fs.writeFileSync(filePath, JSON.stringify(filtered, null, 2));
    }
    return before - filtered.length;
  } catch (e) {
    return 0;
  }
}

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;
  if (rateLimit(req, res)) return;
  sanitize(req);

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
  }

  const { email, confirmation } = req.body || {};

  if (!email || typeof email !== 'string') {
    return sendError(res, 400, 'Email is required', 'INVALID_INPUT', 'validation_error');
  }

  if (confirmation !== 'DELETE_MY_ACCOUNT') {
    return sendError(res, 400, 'Confirmation string "DELETE_MY_ACCOUNT" is required', 'INVALID_INPUT', 'validation_error');
  }

  const sanitizedEmail = email.toLowerCase().trim().slice(0, 254);

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedEmail)) {
    return sendError(res, 400, 'Invalid email format', 'INVALID_INPUT', 'validation_error');
  }

  // Remove user data from all local stores
  const results = {
    customers: removeFromFile(path.join(DATA_DIR, 'customers.json'), sanitizedEmail),
    feedback: removeFromFile(path.join(DATA_DIR, 'feedback.json'), sanitizedEmail),
    waitlist: removeFromFile(path.join(DATA_DIR, 'waitlist.json'), sanitizedEmail)
  };

  const totalRemoved = Object.values(results).reduce((sum, n) => sum + n, 0);

  // Log deletion for audit trail
  const auditEntry = {
    action: 'account_deletion',
    email: sanitizedEmail,
    recordsRemoved: results,
    timestamp: new Date().toISOString()
  };
  console.log('[GDPR] Account deletion:', JSON.stringify(auditEntry));

  res.json({
    success: true,
    data: {
      deleted: true,
      recordsRemoved: totalRemoved,
      message: 'Your account data has been deleted. Any remaining data in third-party services (Stripe, Firebase) will be removed within 90 days.'
    }
  });
});
