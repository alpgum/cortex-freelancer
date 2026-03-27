/**
 * Upwork OAuth2 — Proposals (best-effort)
 *
 * GET  /api/upwork-proposals?uid=...&status=all
 * POST /api/upwork-proposals  { uid, jobId, coverLetter, rate?, estimatedDuration? }
 *
 * Notes:
 * - Proposal APIs may not be enabled for every Upwork app/account.
 * - If Upwork returns 403/404, treat as "not available".
 */

const { cors } = require('./middleware/cors');
const { rateLimit } = require('./middleware/rate-limit');
const { withErrorHandler, sendError } = require('./middleware/error-handler');
const { getFirestore } = require('./lib/firestore');
const upwork = require('./lib/upwork-oauth');

async function loadTokens(firestore, uid) {
  const doc = await firestore.collection('upwork_tokens').doc(uid).get();
  if (!doc.exists) return null;

  const tokens = await upwork.getValidToken(doc.data());
  if (tokens.access_token !== doc.data().access_token) {
    await firestore.collection('upwork_tokens').doc(uid).set(tokens, { merge: true });
  }
  return tokens;
}

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;
  if (rateLimit(req, res)) return;

  const firestore = getFirestore();
  if (!firestore) return sendError(res, 503, 'Firestore not configured', 'FIRESTORE_NOT_CONFIGURED', 'config_error');

  if (req.method === 'GET') {
    const { uid, status } = req.query || {};
    if (!uid) return sendError(res, 400, 'uid required', 'MISSING_UID', 'validation_error');

    try {
      const tokens = await loadTokens(firestore, uid);
      if (!tokens) return sendError(res, 401, 'Upwork not connected', 'UPWORK_NOT_CONNECTED', 'auth_error');

      const params = {};
      if (status && status !== 'all') params.status = status;

      const data = await upwork.apiGetJson(tokens.access_token, '/hr/v2/proposals', params);
      return res.json({ success: true, data });
    } catch (err) {
      if (err?.code === 'REFRESH_REVOKED' || err?.code === 'NO_REFRESH_TOKEN') {
        try { await firestore.collection('upwork_tokens').doc(uid).delete(); } catch {}
        return sendError(res, 401, 'Upwork connection revoked. Please reconnect.', 'UPWORK_REVOKED', 'auth_error');
      }
      if (err?.status === 403 || err?.status === 404) {
        return sendError(res, 501, 'Upwork proposal APIs not available for this app/account.', 'UPWORK_PROPOSALS_UNAVAILABLE', 'not_supported');
      }
      if (err?.code === 'RATE_LIMIT' || err?.status === 429) {
        return sendError(res, 429, 'Upwork rate limited. Try again later.', 'UPWORK_RATE_LIMIT', 'rate_limit');
      }
      console.error('[upwork-proposals] GET error:', err.message);
      return sendError(res, 502, 'Upwork API error', 'UPWORK_API_ERROR', 'service_error');
    }
  }

  if (req.method === 'POST') {
    const { uid, jobId, coverLetter, rate, estimatedDuration } = req.body || {};
    if (!uid) return sendError(res, 400, 'uid required', 'MISSING_UID', 'validation_error');
    if (!jobId) return sendError(res, 400, 'jobId required', 'MISSING_JOB_ID', 'validation_error');
    if (!coverLetter || String(coverLetter).trim().length < 10) {
      return sendError(res, 400, 'coverLetter required (min 10 chars)', 'MISSING_COVER_LETTER', 'validation_error');
    }

    try {
      const tokens = await loadTokens(firestore, uid);
      if (!tokens) return sendError(res, 401, 'Upwork not connected', 'UPWORK_NOT_CONNECTED', 'auth_error');

      const payload = {
        job_id: jobId,
        cover_letter: String(coverLetter).trim(),
      };
      if (rate != null && rate !== '') payload.rate = rate;
      if (estimatedDuration != null && estimatedDuration !== '') payload.estimated_duration = estimatedDuration;

      const endpoint = '/hr/v2/proposals.json';
      const data = await upwork.apiRequest(tokens.access_token, endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      return res.json({ success: true, data });
    } catch (err) {
      if (err?.code === 'REFRESH_REVOKED' || err?.code === 'NO_REFRESH_TOKEN') {
        try { await firestore.collection('upwork_tokens').doc(uid).delete(); } catch {}
        return sendError(res, 401, 'Upwork connection revoked. Please reconnect.', 'UPWORK_REVOKED', 'auth_error');
      }
      if (err?.status === 403 || err?.status === 404) {
        return sendError(res, 501, 'Upwork proposal submission not available for this app/account.', 'UPWORK_PROPOSALS_UNAVAILABLE', 'not_supported');
      }
      if (err?.code === 'RATE_LIMIT' || err?.status === 429) {
        return sendError(res, 429, 'Upwork rate limited. Try again later.', 'UPWORK_RATE_LIMIT', 'rate_limit');
      }
      console.error('[upwork-proposals] POST error:', err.message);
      return sendError(res, 502, 'Upwork API error', 'UPWORK_API_ERROR', 'service_error');
    }
  }

  return sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
});
