/**
 * CFX-042: Server-side chat message rate limiting (token buckets)
 *
 * Goals:
 *  - 10 messages/minute per key
 *  - 50 messages/hour per key
 *  - Key = sessionId when present, otherwise IP address fallback
 *  - Emit standard headers:
 *      X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After
 *
 * NOTE: This is intentionally in-memory. For multi-instance deployments,
 *       replace with Redis (shared store).
 */

'use strict';

function envInt(name, def) {
  const v = process.env[name];
  if (v === undefined || v === null || v === '') return def;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}

function getClientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown';
}

function getKey(req) {
  // Prefer explicit sessionId (body, header), fallback to IP.
  const sid = (
    req.body?.sessionId ||
    req.headers['x-session-id'] ||
    req.query?.sessionId
  );
  if (sid && typeof sid === 'string' && sid.trim()) return 'sid:' + sid.trim();
  return 'ip:' + getClientIp(req);
}

class TokenBucket {
  constructor({ capacity, refillTokens, refillMs }) {
    this.capacity = capacity;
    this.refillTokens = refillTokens;
    this.refillMs = refillMs;
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  refill(now) {
    const elapsed = Math.max(0, now - this.lastRefill);
    if (elapsed <= 0) return;
    const add = (elapsed / this.refillMs) * this.refillTokens;
    if (add > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + add);
      this.lastRefill = now;
    }
  }

  canConsume(n, now) {
    this.refill(now);
    return this.tokens >= n;
  }

  consume(n, now) {
    this.refill(now);
    if (this.tokens < n) return false;
    this.tokens -= n;
    return true;
  }

  /** milliseconds until at least `n` tokens available */
  msUntil(n, now) {
    this.refill(now);
    if (this.tokens >= n) return 0;
    const deficit = n - this.tokens;
    const ratePerMs = this.refillTokens / this.refillMs;
    if (ratePerMs <= 0) return Infinity;
    return Math.ceil(deficit / ratePerMs);
  }
}

const STORE = new Map();

function getOrCreateEntry(key, now, cfg) {
  let e = STORE.get(key);
  if (!e) {
    e = {
      minute: new TokenBucket({
        capacity: cfg.perMinute,
        refillTokens: cfg.perMinute,
        refillMs: 60_000,
      }),
      hour: new TokenBucket({
        capacity: cfg.perHour,
        refillTokens: cfg.perHour,
        refillMs: 3_600_000,
      }),
      lastSeen: now,
    };
    STORE.set(key, e);
  }
  e.lastSeen = now;
  return e;
}

function cleanupStore({ ttlMs = 6 * 60 * 60 * 1000 } = {}) {
  const now = Date.now();
  for (const [k, v] of STORE) {
    if (now - (v.lastSeen || 0) > ttlMs) STORE.delete(k);
  }
}
setInterval(() => cleanupStore(), 10 * 60 * 1000).unref();

/**
 * Check + consume 1 message token.
 * Returns { allowed, remaining, limit, resetAtSec, retryAfterSec, key }
 */
function checkAndConsume(req, { cost = 1 } = {}) {
  const cfg = {
    perMinute: envInt('CHAT_RATELIMIT_PER_MIN', 10),
    perHour: envInt('CHAT_RATELIMIT_PER_HOUR', 50),
  };

  const now = Date.now();
  const key = getKey(req);
  const entry = getOrCreateEntry(key, now, cfg);

  const canMinute = entry.minute.canConsume(cost, now);
  const canHour = entry.hour.canConsume(cost, now);

  if (!canMinute || !canHour) {
    const waitMinute = entry.minute.msUntil(cost, now);
    const waitHour = entry.hour.msUntil(cost, now);
    const waitMs = Math.max(waitMinute, waitHour);
    const retryAfterSec = Math.max(1, Math.ceil(waitMs / 1000));
    const resetAtSec = Math.ceil((now + waitMs) / 1000);

    return {
      allowed: false,
      remaining: 0,
      limit: Math.min(cfg.perMinute, cfg.perHour),
      resetAtSec,
      retryAfterSec,
      key,
      minuteRemaining: Math.floor(entry.minute.tokens),
      hourRemaining: Math.floor(entry.hour.tokens),
    };
  }

  entry.minute.consume(cost, now);
  entry.hour.consume(cost, now);

  const remaining = Math.max(0, Math.floor(Math.min(entry.minute.tokens, entry.hour.tokens)));
  // Reset is when you can next send if remaining is 0; otherwise set to next refill tick for visibility.
  const waitMs = remaining > 0 ? 0 : Math.max(entry.minute.msUntil(1, now), entry.hour.msUntil(1, now));
  const resetAtSec = Math.ceil((now + waitMs) / 1000);

  return {
    allowed: true,
    remaining,
    limit: Math.min(cfg.perMinute, cfg.perHour),
    resetAtSec,
    retryAfterSec: null,
    key,
    minuteRemaining: Math.floor(entry.minute.tokens),
    hourRemaining: Math.floor(entry.hour.tokens),
  };
}

function applyRateLimitHeaders(res, info) {
  try {
    res.setHeader('X-RateLimit-Limit', String(info.limit));
    res.setHeader('X-RateLimit-Remaining', String(info.remaining));
    res.setHeader('X-RateLimit-Reset', String(info.resetAtSec));
    // Expose debugging (optional)
    res.setHeader('X-RateLimit-Remaining-Minute', String(info.minuteRemaining));
    res.setHeader('X-RateLimit-Remaining-Hour', String(info.hourRemaining));
    if (info.retryAfterSec) res.setHeader('Retry-After', String(info.retryAfterSec));
  } catch (_e) {}
}

/**
 * Express-style middleware for chat endpoints.
 */
function chatRateLimitMiddleware(req, res, next) {
  const info = checkAndConsume(req);
  applyRateLimitHeaders(res, info);
  if (!info.allowed) {
    return res.status(429).json({
      error: 'Too many messages. Please wait before sending more.',
      code: 'RATE_LIMIT',
      retryAfter: info.retryAfterSec,
      resetAt: info.resetAtSec,
      remaining: info.remaining,
    });
  }
  next();
}

module.exports = {
  checkAndConsume,
  applyRateLimitHeaders,
  chatRateLimitMiddleware,
  _internal: { STORE, getKey, getClientIp, cleanupStore }
};
