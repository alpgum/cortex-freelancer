module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, email, category, message } = req.body || {};

    if (!name || !email || !category || !message) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    // Rate limit: max 500 char message
    if (message.length > 5000) {
      return res.status(400).json({ error: 'Message too long (max 5000 characters)' });
    }

    const validCategories = ['bug', 'feature', 'billing', 'account', 'general'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    // Log the support request (in production, this would save to a database or send an email)
    console.log('[SUPPORT]', {
      name,
      email,
      category,
      message: message.substring(0, 200),
      timestamp: new Date().toISOString()
    });

    // Try to save to Firestore if available
    try {
      const admin = require('./_lib/firebase-admin');
      if (admin && admin.firestore) {
        const db = admin.firestore();
        await db.collection('support_tickets').add({
          name,
          email,
          category,
          message,
          status: 'open',
          createdAt: new Date().toISOString()
        });
      }
    } catch (dbErr) {
      // Firestore not configured — just log
      console.log('[SUPPORT] Firestore not available, logged to console only');
    }

    return res.status(200).json({ success: true, message: 'Support ticket created' });
  } catch (err) {
    console.error('[SUPPORT ERROR]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
