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

function setupRoutes(app) {
  // POST /api/waitlist — add a signup
  app.post('/api/waitlist', (req, res) => {
    const { email, country, name } = req.body;

    if (!email || !country) {
      return res.status(400).json({ error: 'Email and country are required.' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format.' });
    }

    const waitlist = readWaitlist();
    const normalizedEmail = email.toLowerCase().trim();

    if (waitlist.some(entry => entry.email === normalizedEmail)) {
      return res.status(409).json({ error: 'This email is already on the waitlist.' });
    }

    const entry = {
      id: waitlist.length + 1,
      email: normalizedEmail,
      country,
      name: name ? name.trim() : null,
      timestamp: new Date().toISOString()
    };

    waitlist.push(entry);
    writeWaitlist(waitlist);

    res.json({
      success: true,
      message: "You're on the list!",
      position: entry.id
    });
  });

  // GET /api/waitlist/count — public count
  app.get('/api/waitlist/count', (_req, res) => {
    const waitlist = readWaitlist();
    res.json({ count: waitlist.length });
  });

  // GET /api/waitlist/admin — protected full list
  app.get('/api/waitlist/admin', (req, res) => {
    if (req.query.token !== ADMIN_TOKEN) {
      return res.status(401).json({ error: 'Invalid admin token.' });
    }
    const waitlist = readWaitlist();

    const byCountry = {};
    waitlist.forEach(e => {
      byCountry[e.country] = (byCountry[e.country] || 0) + 1;
    });

    res.json({
      total: waitlist.length,
      byCountry,
      signups: waitlist
    });
  });
}

module.exports = { setupRoutes };
