/**
 * Abuse prevention middleware.
 * Detects and blocks common abuse patterns beyond simple rate limiting.
 */

// In-memory tracking stores
const suspiciousIPs = new Map();    // IP -> { score, lastSeen }
const requestPatterns = new Map();  // IP -> { endpoints: Map, burstTimestamps: [] }

const CONFIG = {
  SCORE_THRESHOLD: 10,        // Block when score exceeds this
  SCORE_DECAY_MS: 5 * 60 * 1000, // Reset score after 5 minutes of inactivity
  BURST_WINDOW_MS: 2000,      // Time window to detect request bursts
  BURST_LIMIT: 8,             // Max requests within burst window
  PAYLOAD_MAX_SIZE: 50000,    // Max request body size in characters
  BLOCKED_USER_AGENTS: [
    /^$/,                      // Empty user agent
    /python-requests/i,        // Common scraping library (unless API usage intended)
    /scrapy/i,
    /wget\/\d/i
  ],
  SENSITIVE_ENDPOINTS: [
    '/api/delete-account',
    '/api/export-data',
    '/api/checkout',
    '/api/stripe'
  ]
};

// Cleanup stale entries every 10 minutes
setInterval(function cleanup() {
  const now = Date.now();
  for (const [ip, entry] of suspiciousIPs) {
    if (now - entry.lastSeen > CONFIG.SCORE_DECAY_MS) {
      suspiciousIPs.delete(ip);
      requestPatterns.delete(ip);
    }
  }
}, 10 * 60 * 1000).unref();

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown';
}

/**
 * Abuse prevention check.
 * Returns true if request is blocked (caller should return early).
 */
function abusePrevention(req, res) {
  const ip = getClientIp(req);
  const now = Date.now();
  const ua = req.headers['user-agent'] || '';
  const endpoint = req.url?.split('?')[0] || '';

  // Initialize tracking
  if (!suspiciousIPs.has(ip)) {
    suspiciousIPs.set(ip, { score: 0, lastSeen: now });
  }
  if (!requestPatterns.has(ip)) {
    requestPatterns.set(ip, { endpoints: new Map(), burstTimestamps: [] });
  }

  const ipData = suspiciousIPs.get(ip);
  const patterns = requestPatterns.get(ip);

  // Decay score if inactive
  if (now - ipData.lastSeen > CONFIG.SCORE_DECAY_MS) {
    ipData.score = 0;
  }
  ipData.lastSeen = now;

  // 1. Check if already blocked
  if (ipData.score >= CONFIG.SCORE_THRESHOLD) {
    res.status(403).json({
      success: false,
      error: {
        message: 'Access temporarily blocked due to suspicious activity. Please try again later.',
        code: 'ABUSE_BLOCKED',
        type: 'abuse_error'
      }
    });
    return true;
  }

  // 2. Suspicious user agent check
  for (const pattern of CONFIG.BLOCKED_USER_AGENTS) {
    if (pattern.test(ua)) {
      ipData.score += 3;
      break;
    }
  }

  // 3. Burst detection — too many requests in a short window
  patterns.burstTimestamps.push(now);
  patterns.burstTimestamps = patterns.burstTimestamps.filter(
    function (t) { return now - t < CONFIG.BURST_WINDOW_MS; }
  );
  if (patterns.burstTimestamps.length > CONFIG.BURST_LIMIT) {
    ipData.score += 2;
  }

  // 4. Oversized payload check
  if (req.body) {
    const bodySize = JSON.stringify(req.body).length;
    if (bodySize > CONFIG.PAYLOAD_MAX_SIZE) {
      ipData.score += 5;
      res.status(413).json({
        success: false,
        error: {
          message: 'Request payload too large.',
          code: 'PAYLOAD_TOO_LARGE',
          type: 'validation_error'
        }
      });
      return true;
    }
  }

  // 5. Sensitive endpoint hammering
  if (CONFIG.SENSITIVE_ENDPOINTS.some(function (e) { return endpoint.startsWith(e); })) {
    const count = patterns.endpoints.get(endpoint) || 0;
    patterns.endpoints.set(endpoint, count + 1);
    if (count > 3) {
      ipData.score += 3;
    }
  }

  // 6. Final threshold check after scoring
  if (ipData.score >= CONFIG.SCORE_THRESHOLD) {
    // [387] Log abuse incident to Firestore
    logAbuseIncident(ip, ua, ipData.score, 'threshold_exceeded');
    res.status(403).json({
      success: false,
      error: {
        message: 'Access temporarily blocked due to suspicious activity. Please try again later.',
        code: 'ABUSE_BLOCKED',
        type: 'abuse_error'
      }
    });
    return true;
  }

  return false;
}

// [387] Log abuse-prevention blocks to Firestore
function logAbuseIncident(ip, userAgent, score, reason) {
  try {
    const crypto = require('crypto');
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex').substring(0, 12);
    const incident = {
      timestamp: new Date().toISOString(),
      ipHash: ipHash,
      userAgent: (userAgent || '').substring(0, 200),
      score: score,
      reason: reason
    };
    try {
      const { getFirestore } = require('../_lib/firestore');
      const db = getFirestore();
      if (db) {
        db.collection('abuse_incidents').add(incident).catch(function() {});
      }
    } catch (e) {
      console.warn('[abuse-prevention] Incident:', JSON.stringify(incident));
    }
  } catch (e) {
    // Abuse logging should never break request flow
  }
}

/**
 * Express middleware version.
 */
function abusePreventionMiddleware(req, res, next) {
  if (abusePrevention(req, res)) return;
  next();
}

module.exports = { abusePrevention, abusePreventionMiddleware };
