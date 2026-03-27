/**
 * Gmail Send/Read API
 *
 * POST /api/gmail-send  — Send email via user's Gmail
 * GET  /api/gmail-send   — List recent emails
 *
 * Requires Gmail OAuth tokens stored in Firestore.
 */

const { cors } = require('./middleware/cors');
const { rateLimit } = require('./middleware/rate-limit');
const { withErrorHandler, sendError } = require('./middleware/error-handler');
const { getFirestore } = require('./lib/firestore');
const gmail = require('./lib/gmail');

async function getUserTokens(uid) {
  const firestore = getFirestore();
  if (!firestore) return null;

  const doc = await firestore.collection('gmail_tokens').doc(uid).get();
  if (!doc.exists) return null;

  const tokens = doc.data();
  const valid = await gmail.getValidToken(tokens);

  // Persist refreshed token
  if (valid.access_token !== tokens.access_token) {
    await firestore.collection('gmail_tokens').doc(uid).set(valid, { merge: true });
  }

  return valid;
}

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;
  if (rateLimit(req, res)) return;

  // POST — Send email
  if (req.method === 'POST') {
    const { uid, to, subject, body, cc, bcc, replyTo, threadId, isHtml } = req.body || {};

    if (!uid) return sendError(res, 400, 'uid is required', 'MISSING_UID', 'validation_error');
    if (!to) return sendError(res, 400, 'to is required', 'MISSING_TO', 'validation_error');
    if (!subject) return sendError(res, 400, 'subject is required', 'MISSING_SUBJECT', 'validation_error');
    if (!body) return sendError(res, 400, 'body is required', 'MISSING_BODY', 'validation_error');

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return sendError(res, 400, 'Invalid recipient email', 'INVALID_EMAIL', 'validation_error');
    }

    const tokens = await getUserTokens(uid);
    if (!tokens) {
      return sendError(res, 401, 'Gmail not connected. Please authorize Gmail first.', 'GMAIL_NOT_CONNECTED', 'auth_error');
    }

    try {
      const result = await gmail.sendEmail(tokens.access_token, {
        to,
        subject,
        body,
        cc,
        bcc,
        replyTo,
        threadId,
        isHtml: isHtml !== false, // default true
      });

      // Track email sent
      const firestore = getFirestore();
      if (firestore) {
        await firestore.collection('email_log').add({
          uid,
          to,
          subject,
          messageId: result.id,
          threadId: result.threadId,
          sentAt: new Date().toISOString(),
          source: 'gmail_api',
        }).catch(() => {}); // Best effort logging
      }

      return res.json({
        success: true,
        messageId: result.id,
        threadId: result.threadId,
      });
    } catch (err) {
      console.error('[gmail-send] Send failed:', err.message);

      if (err.message.includes('401')) {
        return sendError(res, 401, 'Gmail authorization expired. Please reconnect.', 'TOKEN_EXPIRED', 'auth_error');
      }

      return sendError(res, 500, 'Failed to send email via Gmail', 'SEND_FAILED', 'server_error');
    }
  }

  // GET — List recent emails
  if (req.method === 'GET') {
    const { uid, query, maxResults, labelIds, pageToken } = req.query;

    if (!uid) return sendError(res, 400, 'uid is required', 'MISSING_UID', 'validation_error');

    const tokens = await getUserTokens(uid);
    if (!tokens) {
      return sendError(res, 401, 'Gmail not connected.', 'GMAIL_NOT_CONNECTED', 'auth_error');
    }

    try {
      const list = await gmail.listMessages(tokens.access_token, {
        query,
        maxResults: parseInt(maxResults) || 10,
        labelIds,
        pageToken,
      });

      // Fetch full message details for each
      const messages = [];
      if (list.messages) {
        const fetches = list.messages.slice(0, 10).map(async (msg) => {
          try {
            const full = await gmail.getMessage(tokens.access_token, msg.id);
            return gmail.parseMessage(full);
          } catch {
            return { id: msg.id, error: 'fetch_failed' };
          }
        });
        messages.push(...await Promise.all(fetches));
      }

      return res.json({
        success: true,
        messages,
        nextPageToken: list.nextPageToken || null,
        resultSizeEstimate: list.resultSizeEstimate || 0,
      });
    } catch (err) {
      console.error('[gmail-send] List failed:', err.message);
      return sendError(res, 500, 'Failed to fetch emails', 'LIST_FAILED', 'server_error');
    }
  }

  sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
});
