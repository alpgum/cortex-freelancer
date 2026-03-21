const { cors } = require('./_middleware/cors');
const { rateLimit } = require('./_middleware/rate-limit');
const { sanitize } = require('./_middleware/sanitize');
const { withErrorHandler, sendError } = require('./_middleware/error-handler');

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;
  if (rateLimit(req, res)) return;
  sanitize(req);

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
  }

  const { event, email, plan, amount, currency } = req.body || {};

  if (!event || !email) {
    return sendError(res, 400, 'Event and email are required.', 'MISSING_FIELDS', 'validation_error');
  }

  if (!SLACK_WEBHOOK_URL) {
    console.warn('SLACK_WEBHOOK_URL not configured — skipping notification');
    return res.json({ success: true, skipped: true });
  }

  var emoji = '💰';
  var title = 'New Payment';
  if (event === 'subscription_created') {
    emoji = '🎉';
    title = 'New Subscription';
  } else if (event === 'subscription_renewed') {
    emoji = '🔄';
    title = 'Subscription Renewed';
  } else if (event === 'subscription_cancelled') {
    emoji = '😢';
    title = 'Subscription Cancelled';
  } else if (event === 'lifetime_purchase') {
    emoji = '🚀';
    title = 'Lifetime Deal Purchase';
  }

  var amountStr = amount ? (' — ' + (currency || 'USD').toUpperCase() + ' ' + (amount / 100).toFixed(2)) : '';
  var planStr = plan ? (' (' + plan + ')') : '';

  var slackPayload = {
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: emoji + ' *' + title + '*\n' +
                '> *Email:* ' + email + '\n' +
                '> *Plan:* ' + (plan || 'N/A') + planStr + '\n' +
                (amount ? ('> *Amount:* ' + amountStr + '\n') : '') +
                '> *Time:* ' + new Date().toISOString()
        }
      }
    ]
  };

  try {
    var response = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackPayload)
    });

    if (!response.ok) {
      console.error('Slack webhook failed:', response.status);
      return res.json({ success: false, error: 'Slack notification failed' });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Slack notification error:', err.message);
    return res.json({ success: false, error: 'Failed to send notification' });
  }
});
