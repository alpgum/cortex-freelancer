const fs = require('fs');
const path = require('path');

const WAITLIST_FILE = path.join(__dirname, '..', 'data', 'waitlist.json');

function readWaitlist() {
  try {
    return JSON.parse(fs.readFileSync(WAITLIST_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeWaitlist(data) {
  const dir = path.dirname(WAITLIST_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(WAITLIST_FILE, JSON.stringify(data, null, 2), 'utf8');
}

const { corsMiddleware } = require('./_middleware/cors');

function setupDownloadRoutes(app) {
  app.use('/api/download', corsMiddleware);
  // POST /api/download/free-kit — email gate for free Business Dev Agent kit
  app.post('/api/download/free-kit', (req, res) => {
    const { email } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Valid email is required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const waitlist = readWaitlist();

    // Add to waitlist if not already there
    if (!waitlist.some(e => e.email === normalizedEmail)) {
      waitlist.push({
        id: waitlist.length + 1,
        email: normalizedEmail,
        country: 'UNKNOWN',
        name: null,
        timestamp: new Date().toISOString(),
        source: 'free-kit'
      });
      writeWaitlist(waitlist);
    }

    res.json({
      success: true,
      message: 'Free kit ready for download!',
      kit: {
        name: 'Cortex Business Dev Agent — Free Kit',
        contents: [
          'Business Development Agent SOUL.md',
          'Template: Cold Outreach Email',
          'Template: Project Proposal',
          'Template: Follow-Up Sequence'
        ],
        download_path: '/downloads/cortex-free-kit.zip',
        note: 'This is the free teaser kit. Upgrade to Pro for all 3 agents + 28 templates + 7 automation scripts.'
      }
    });
  });
}

module.exports = { setupDownloadRoutes };
