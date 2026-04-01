const { cors } = require('./middleware/cors');

/**
 * CF-265: Sentry Relay Endpoint
 * Receives error payloads from the frontend custom Sentry wrapper
 * and forwards them to Sentry's ingest API using the server-side DSN.
 *
 * POST /api/sentry-relay — { message, stack, level, tags, breadcrumbs, ... }
 */
module.exports = async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    // Silently accept — don't break clients when DSN not configured
    res.status(202).json({ status: 'accepted', forwarded: false });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    // Parse DSN: https://<key>@<host>/<project_id>
    const dsnUrl = new URL(dsn);
    const publicKey = dsnUrl.username;
    const projectId = dsnUrl.pathname.replace('/', '');
    const sentryHost = dsnUrl.hostname;

    const envelope = buildEnvelope(body, publicKey, projectId);
    const ingestUrl = `https://${sentryHost}/api/${projectId}/envelope/?sentry_key=${publicKey}&sentry_version=7`;

    const response = await fetch(ingestUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-sentry-envelope' },
      body: envelope,
    });

    if (response.ok) {
      res.status(202).json({ status: 'forwarded' });
    } else {
      const text = await response.text().catch(() => '');
      console.error('[sentry-relay] Sentry rejected:', response.status, text);
      res.status(202).json({ status: 'accepted', forwarded: false });
    }
  } catch (err) {
    console.error('[sentry-relay] Error:', err.message);
    // Always return 202 — error reporting should never fail the client
    res.status(202).json({ status: 'accepted', forwarded: false });
  }
};

/**
 * Build a Sentry envelope from the client payload.
 */
function buildEnvelope(payload, publicKey, projectId) {
  const header = JSON.stringify({
    event_id: generateEventId(),
    dsn: `https://${publicKey}@o0.ingest.sentry.io/${projectId}`,
    sdk: { name: 'cortex-freelancer-relay', version: '1.0.0' },
    sent_at: new Date().toISOString(),
  });

  const itemHeader = JSON.stringify({ type: 'event' });

  const event = JSON.stringify({
    event_id: generateEventId(),
    timestamp: payload.timestamp || new Date().toISOString(),
    platform: 'javascript',
    level: payload.level || 'error',
    logger: 'cortex-freelancer',
    server_name: payload.url || '',
    environment: payload.environment || 'production',
    release: payload.release || '',
    message: payload.message
      ? { formatted: payload.message }
      : undefined,
    exception: payload.stack
      ? {
          values: [
            {
              type: payload.errorName || 'Error',
              value: payload.message || 'Unknown error',
              stacktrace: { frames: parseStack(payload.stack) },
            },
          ],
        }
      : undefined,
    tags: payload.tags || {},
    extra: payload.extra || {},
    user: payload.user || (payload.userId ? { id: payload.userId } : undefined),
    breadcrumbs: payload.breadcrumbs
      ? { values: payload.breadcrumbs }
      : undefined,
    request: {
      url: payload.url || '',
      headers: { 'User-Agent': payload.userAgent || '' },
    },
  });

  return [header, itemHeader, event].join('\n');
}

/**
 * Parse a JS stack trace string into Sentry frame objects.
 */
function parseStack(stack) {
  if (!stack) return [];
  return stack
    .split('\n')
    .filter((line) => line.includes('at ') || line.includes('@'))
    .slice(0, 20)
    .map((line) => {
      const match = line.match(/at\s+(.+?)\s+\((.+):(\d+):(\d+)\)/) ||
                    line.match(/at\s+(.+):(\d+):(\d+)/) ||
                    line.match(/(.+)@(.+):(\d+):(\d+)/);
      if (match && match.length >= 4) {
        return {
          function: match[1] || '?',
          filename: match[2] || '?',
          lineno: parseInt(match[3]) || 0,
          colno: parseInt(match[4]) || 0,
        };
      }
      return { function: line.trim(), filename: '?', lineno: 0, colno: 0 };
    })
    .reverse(); // Sentry expects innermost frame first
}

function generateEventId() {
  return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
