/**
 * Toggl time entries (date range)
 *
 * GET /api/toggl-time-entries?start=2026-03-27&end=2026-03-27
 * - start/end can be ISO dates or full ISO timestamps.
 * - Defaults to today.
 */

const { cors } = require('./middleware/cors');
const { rateLimit } = require('./middleware/rate-limit');
const { withErrorHandler, sendError } = require('./middleware/error-handler');
const toggl = require('./lib/toggl');

function parseDateInput(v, fallback) {
  if (!v) return fallback;
  // Support YYYY-MM-DD by appending Z midnight
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return new Date(v + 'T00:00:00.000Z');
  }
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return fallback;
  return d;
}

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;
  if (rateLimit(req, res)) return;

  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
  }

  const { start, end } = req.query || {};

  const now = new Date();
  const startDate = parseDateInput(start, new Date(toggl.startOfDayISO(now)));
  const endDate = parseDateInput(end, new Date(toggl.endOfDayISO(now)));

  try {
    const entries = await toggl.getTimeEntries({ start: startDate, end: endDate });

    // Summaries (seconds)
    const totalSeconds = entries.reduce((sum, e) => sum + (Number(e.duration) || 0), 0);
    const billableSeconds = entries.reduce((sum, e) => sum + ((e.billable ? 1 : 0) * (Number(e.duration) || 0)), 0);

    return res.json({
      success: true,
      data: {
        mock: toggl.isMockMode(),
        range: { start: startDate.toISOString(), end: endDate.toISOString() },
        totals: {
          totalSeconds,
          billableSeconds,
        },
        entries,
      },
    });
  } catch (err) {
    console.error('[toggl-time-entries] Error:', err.message);
    return sendError(res, err.status || 502, 'Toggl API error', 'TOGGL_API_ERROR', 'service_error');
  }
});
