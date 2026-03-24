/**
 * CFX-046: Session Store Adapter
 * 
 * Provides session persistence across instances for seamless failover.
 * Sessions are stored in a shared Redis instance so that when traffic
 * moves from primary → backup, user state is preserved.
 * 
 * Supports:
 * - Redis-backed session storage
 * - In-memory fallback for development
 * - Session migration between instances
 */

// ─── Redis Session Store ─────────────────────────────────────────

class RedisSessionStore {
  /**
   * @param {object} options
   * @param {string} options.url - Redis connection URL
   * @param {string} options.prefix - Key prefix for sessions
   * @param {number} options.ttlSeconds - Session TTL
   */
  constructor(options = {}) {
    this.prefix = options.prefix || 'cfx:session:';
    this.ttlSeconds = options.ttlSeconds || 86400;
    this.url = options.url || 'redis://localhost:6379';
    this.client = null;
  }

  async connect() {
    // Lazy-require redis to avoid hard dependency
    try {
      const { createClient } = require('redis');
      this.client = createClient({ url: this.url });
      this.client.on('error', (err) => console.error('[SessionStore] Redis error:', err.message));
      await this.client.connect();
      console.log('[SessionStore] Connected to Redis');
    } catch (err) {
      console.warn('[SessionStore] Redis unavailable, falling back to in-memory store');
      this.client = null;
      this._fallback = new InMemorySessionStore();
    }
  }

  async get(sessionId) {
    if (!this.client) return this._fallback?.get(sessionId);
    const data = await this.client.get(this.prefix + sessionId);
    return data ? JSON.parse(data) : null;
  }

  async set(sessionId, data) {
    if (!this.client) return this._fallback?.set(sessionId, data);
    await this.client.setEx(
      this.prefix + sessionId,
      this.ttlSeconds,
      JSON.stringify(data)
    );
  }

  async delete(sessionId) {
    if (!this.client) return this._fallback?.delete(sessionId);
    await this.client.del(this.prefix + sessionId);
  }

  /**
   * Migrate sessions from one instance to another.
   * Since sessions are in shared Redis, "migration" is just
   * updating the instance affinity metadata.
   */
  async migrate(fromInstanceId, toInstanceId) {
    if (!this.client) {
      console.log('[SessionStore] In-memory store: migration is no-op (shared state)');
      return { migrated: 0 };
    }

    // Scan for sessions with affinity to the old instance
    const pattern = `${this.prefix}*`;
    let cursor = 0;
    let migrated = 0;

    do {
      const result = await this.client.scan(cursor, { MATCH: pattern, COUNT: 100 });
      cursor = result.cursor;

      for (const key of result.keys) {
        try {
          const raw = await this.client.get(key);
          if (!raw) continue;
          const session = JSON.parse(raw);

          if (session._instanceAffinity === fromInstanceId) {
            session._instanceAffinity = toInstanceId;
            session._migratedAt = new Date().toISOString();
            session._migratedFrom = fromInstanceId;
            await this.client.setEx(key, this.ttlSeconds, JSON.stringify(session));
            migrated++;
          }
        } catch (e) {
          console.error(`[SessionStore] Failed to migrate key ${key}:`, e.message);
        }
      }
    } while (cursor !== 0);

    console.log(`[SessionStore] Migrated ${migrated} sessions: ${fromInstanceId} → ${toInstanceId}`);
    return { migrated };
  }

  async close() {
    if (this.client) await this.client.quit();
  }
}

// ─── In-Memory Fallback ──────────────────────────────────────────

class InMemorySessionStore {
  constructor() {
    this.store = new Map();
  }

  async get(sessionId) {
    const entry = this.store.get(sessionId);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(sessionId);
      return null;
    }
    return entry.data;
  }

  async set(sessionId, data, ttlSeconds = 86400) {
    this.store.set(sessionId, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async delete(sessionId) {
    this.store.delete(sessionId);
  }

  async migrate(fromInstanceId, toInstanceId) {
    let migrated = 0;
    for (const [key, entry] of this.store) {
      if (entry.data._instanceAffinity === fromInstanceId) {
        entry.data._instanceAffinity = toInstanceId;
        entry.data._migratedAt = new Date().toISOString();
        migrated++;
      }
    }
    return { migrated };
  }

  async close() {
    this.store.clear();
  }
}

// ─── Express Session Middleware ──────────────────────────────────

/**
 * Express middleware that attaches instance affinity to sessions.
 * Use with express-session or any session middleware.
 */
function instanceAffinityMiddleware(instanceId) {
  return (req, res, next) => {
    if (req.session && !req.session._instanceAffinity) {
      req.session._instanceAffinity = instanceId;
    }
    next();
  };
}

module.exports = { RedisSessionStore, InMemorySessionStore, instanceAffinityMiddleware };
