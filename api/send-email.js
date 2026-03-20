const { cors } = require('./_middleware/cors');
const { sanitize } = require('./_middleware/sanitize');
const { sendWelcomeEmail, sendProActivatedEmail } = require('./_services/email');

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  sanitize(req);

  const { type, email, name } = req.body;

  if (!type || !email) {
    return res.status(400).json({ error: 'type and email are required.' });
  }

  if (typeof type !== 'string' || typeof email !== 'string') {
    return res.status(400).json({ error: 'type and email must be strings.' });
  }

  const displayName = name || 'there';

  try {
    let result;

    if (type === 'welcome') {
      result = await sendWelcomeEmail(email, displayName);
    } else if (type === 'pro_activated') {
      result = await sendProActivatedEmail(email, displayName);
    } else {
      return res.status(400).json({ error: `Unknown email type: ${type}` });
    }

    if (!result) {
      return res.status(503).json({ error: 'Email service unavailable.' });
    }

    console.log(`[send-email] ${type} → ${email}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[send-email] Failed:', err.message);
    res.status(500).json({ error: 'Failed to send email.' });
  }
};
