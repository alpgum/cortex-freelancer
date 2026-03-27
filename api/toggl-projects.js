/**
 * Toggl projects list
 *
 * GET /api/toggl-projects?workspaceId=...
 */

const { cors } = require('./middleware/cors');
const { rateLimit } = require('./middleware/rate-limit');
const { withErrorHandler, sendError } = require('./middleware/error-handler');
const toggl = require('./lib/toggl');

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;
  if (rateLimit(req, res)) return;

  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
  }

  const { workspaceId } = req.query || {};

  try {
    const projects = await toggl.getProjects(workspaceId);
    return res.json({
      success: true,
      data: {
        mock: toggl.isMockMode(),
        workspaceId: workspaceId ? Number(workspaceId) : await toggl.getWorkspaceId(),
        projects,
      },
    });
  } catch (err) {
    if (err?.code === 'NO_API_TOKEN') {
      // Should not happen because getProjects() falls back to mock, but keep safe.
      return res.json({ success: true, data: { mock: true, projects: [] } });
    }
    console.error('[toggl-projects] Error:', err.message);
    return sendError(res, err.status || 502, 'Toggl API error', 'TOGGL_API_ERROR', 'service_error');
  }
});
