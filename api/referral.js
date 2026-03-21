const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { cors } = require('./_middleware/cors');
const { rateLimit } = require('./_middleware/rate-limit');
const { sanitize } = require('./_middleware/sanitize');
const { withErrorHandler, sendError } = require('./_middleware/error-handler');

const REFERRALS_FILE = path.join(__dirname, '..', 'data', 'referrals.json');

function readReferrals() {
  try { return JSON.parse(fs.readFileSync(REFERRALS_FILE, 'utf8')); }
  catch { return []; }
}

function writeReferrals(data) {
  const dir = path.dirname(REFERRALS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(REFERRALS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function generateCode() {
  return 'REF-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;
  if (rateLimit(req, res)) return;
  sanitize(req);

  const referrals = readReferrals();

  // GET /api/referral?email=... — get or create referral code for user
  if (req.method === 'GET') {
    const email = (req.query.email || '').toLowerCase().trim();
    if (!email) return sendError(res, 400, 'Email is required.', 'MISSING_EMAIL', 'validation_error');

    let entry = referrals.find(r => r.email === email);
    if (!entry) {
      entry = {
        email,
        code: generateCode(),
        referrals: 0,
        clicks: 0,
        signups: [],
        created_at: new Date().toISOString()
      };
      referrals.push(entry);
      writeReferrals(referrals);
    }

    return res.json({
      code: entry.code,
      referrals: entry.referrals || 0,
      clicks: entry.clicks || 0,
      months_earned: entry.referrals || 0
    });
  }

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
  }

  const { action, code, email } = req.body || {};

  if (!action || !code) {
    return sendError(res, 400, 'Action and code are required.', 'MISSING_FIELDS', 'validation_error');
  }

  const entry = referrals.find(r => r.code === code);

  // Track link click
  if (action === 'click') {
    if (entry) {
      entry.clicks = (entry.clicks || 0) + 1;
      writeReferrals(referrals);
    }
    return res.json({ success: true });
  }

  // Track signup conversion
  if (action === 'signup') {
    if (!email) return sendError(res, 400, 'Email is required for signup tracking.', 'MISSING_EMAIL', 'validation_error');
    if (!entry) return sendError(res, 400, 'Invalid referral code.', 'INVALID_CODE', 'validation_error');

    // Prevent self-referral
    if (entry.email === email.toLowerCase().trim()) {
      return sendError(res, 400, 'Cannot refer yourself.', 'SELF_REFERRAL', 'validation_error');
    }

    // Prevent duplicate referral
    if (entry.signups && entry.signups.includes(email.toLowerCase().trim())) {
      return sendError(res, 400, 'This email has already been referred.', 'DUPLICATE_REFERRAL', 'validation_error');
    }

    entry.referrals = (entry.referrals || 0) + 1;
    if (!entry.signups) entry.signups = [];
    entry.signups.push(email.toLowerCase().trim());
    writeReferrals(referrals);

    return res.json({
      success: true,
      referrer_email: entry.email,
      reward: 'both_get_1_month_free'
    });
  }

  // Validate a referral code
  if (action === 'validate') {
    if (!entry) {
      return res.json({ valid: false });
    }
    return res.json({ valid: true, referrer: entry.email });
  }

  return sendError(res, 400, 'Invalid action.', 'INVALID_ACTION', 'validation_error');
});
