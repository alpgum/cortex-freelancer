/**
 * Toggl: create a time entry
 *
 * POST /api/toggl-log-time
 * Body: { description, projectId, workspaceId, minutes, billable, start, tags }
 */

const { cors } = require('./middleware/cors');
const { rateLimit } = require('./middleware/rate-limit');
const { withErrorHandler, sendError } = require('./middleware/error-handler');
const toggl = require('./lib/toggl');

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;
  if (rateLimit(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
  }

  const body = req.body || {};
  const description = (body.description || '').trim();
  const projectId = body.projectId ?? body.project_id;
  const workspaceId = body.workspaceId ?? body.workspace_id;
  const minutes = body.minutes;
  const billable = body.billable;
  const start = body.start;
  const tags = body.tags;

  if (!description) {
    return sendError(res, 400, 'description required', 'MISSING_DESCRIPTION', 'validation_error');
  }

  try {
    const entry = await toggl.logTime({
      workspaceId,
      description,
      projectId,
      minutes,
      billable,
      start,
      tags,
    });

    return res.json({
      success: true,
      data: {
        mock: toggl.isMockMode(),
        entry,
      },
    });
  } catch (err) {
    if (err?.code === 'INVALID_MINUTES') {
      return sendError(res, 400, err.message, 'INVALID_MINUTES', 'validation_error');
    }
    console.error('[toggl-log-time] Error:', err.message);
    return sendError(res, err.status || 502, 'Toggl API error', 'TOGGL_API_ERROR', 'service_error');
  }
});
