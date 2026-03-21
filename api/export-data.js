const fs = require('fs');
const path = require('path');
const { cors } = require('./_middleware/cors');
const { rateLimit } = require('./_middleware/rate-limit');
const { sanitize } = require('./_middleware/sanitize');
const { withErrorHandler, sendError } = require('./_middleware/error-handler');

const DATA_DIR = path.join(__dirname, '..', 'data');

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;
  if (rateLimit(req, res)) return;
  sanitize(req);

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
  }

  const { email } = req.body || {};

  if (!email || typeof email !== 'string') {
    return sendError(res, 400, 'Email is required', 'INVALID_INPUT', 'validation_error');
  }

  const sanitizedEmail = email.toLowerCase().trim().slice(0, 254);

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedEmail)) {
    return sendError(res, 400, 'Invalid email format', 'INVALID_INPUT', 'validation_error');
  }

  // Collect all user data from local stores
  const exportData = {
    exportDate: new Date().toISOString(),
    email: sanitizedEmail,
    profile: null,
    subscriptions: null,
    feedback: [],
    toolUsage: []
  };

  // Profile data
  try {
    const profilePath = path.join(DATA_DIR, 'profile.json');
    const profiles = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
    if (Array.isArray(profiles)) {
      exportData.profile = profiles.find(p => p.email === sanitizedEmail) || null;
    } else if (profiles && profiles.email === sanitizedEmail) {
      exportData.profile = profiles;
    }
  } catch (e) { /* file may not exist */ }

  // Customer / subscription data
  try {
    const customersPath = path.join(DATA_DIR, 'customers.json');
    const customers = JSON.parse(fs.readFileSync(customersPath, 'utf8'));
    if (Array.isArray(customers)) {
      exportData.subscriptions = customers.filter(c => c.email === sanitizedEmail);
    }
  } catch (e) { /* file may not exist */ }

  // Feedback data
  try {
    const feedbackPath = path.join(DATA_DIR, 'feedback.json');
    const feedback = JSON.parse(fs.readFileSync(feedbackPath, 'utf8'));
    if (Array.isArray(feedback)) {
      exportData.feedback = feedback.filter(f => f.email === sanitizedEmail);
    }
  } catch (e) { /* file may not exist */ }

  res.json({
    success: true,
    data: exportData
  });
});
