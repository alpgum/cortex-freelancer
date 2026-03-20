const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'waitlist.json');
const ADMIN_TOKEN = 'cortex-admin-2026';

function readWaitlist() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeWaitlist(data) {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const { corsMiddleware } = require('./_middleware/cors');
const { sanitize } = require('./_middleware/sanitize');
const { sendError, expressErrorHandler } = require('./_middleware/error-handler');

function setupRoutes(app) {
  app.use('/api/waitlist', corsMiddleware);
  // POST /api/waitlist — add a signup
  app.post('/api/waitlist', (req, res) => {
    sanitize(req);
    const { email, country, name, source } = req.body;

    if (!email || !country) {
      return sendError(res, 400, 'Email and country are required.', 'MISSING_FIELDS', 'validation_error');
    }

    if (!isValidEmail(email)) {
      return sendError(res, 400, 'Invalid email format.', 'INVALID_EMAIL', 'validation_error');
    }

    const waitlist = readWaitlist();
    const normalizedEmail = email.toLowerCase().trim();

    if (waitlist.some(entry => entry.email === normalizedEmail)) {
      return sendError(res, 409, 'This email is already on the waitlist.', 'DUPLICATE_EMAIL', 'validation_error');
    }

    const entry = {
      id: waitlist.length + 1,
      email: normalizedEmail,
      country,
      name: name ? name.trim() : null,
      source: source ? source.trim() : null,
      timestamp: new Date().toISOString()
    };

    waitlist.push(entry);
    writeWaitlist(waitlist);

    res.json({
      success: true,
      message: "You're on the list!",
      position: entry.id,
      count: waitlist.length
    });
  });

  // GET /api/waitlist/count — public count
  app.get('/api/waitlist/count', (_req, res) => {
    const waitlist = readWaitlist();
    res.json({ success: true, count: waitlist.length });
  });

  // GET /api/waitlist/admin — protected full list
  app.get('/api/waitlist/admin', (req, res) => {
    if (req.query.token !== ADMIN_TOKEN) {
      return sendError(res, 401, 'Invalid admin token.', 'INVALID_TOKEN', 'auth_error');
    }
    const waitlist = readWaitlist();

    const byCountry = {};
    waitlist.forEach(e => {
      byCountry[e.country] = (byCountry[e.country] || 0) + 1;
    });

    res.json({
      success: true,
      total: waitlist.length,
      byCountry,
      signups: waitlist
    });
  });

  // Mount Express error handler after all waitlist routes
  app.use(expressErrorHandler);
}

module.exports = { setupRoutes };
