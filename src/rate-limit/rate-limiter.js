/**
 * CFX-042: Client-side chat rate limiter
 *
 * Features:
 *  - 1s minimum interval between messages (after a small burst)
 *  - Allow short burst of N messages instantly (default 3)
 *  - Queue messages when throttled; automatically flush
 *  - Track & expose server-side quota headers for UI feedback
 *
 * This file is authored for browser usage (no build step required).
 */

(function () {
  'use strict';

  function now() { return Date.now(); }

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  /** Lightweight event emitter */
  function Emitter() { this._l = {}; }
  Emitter.prototype.on = function (evt, fn) {
    (this._l[evt] = this._l[evt] || []).push(fn);
  };
  Emitter.prototype.emit = function (evt, payload) {
    var arr = this._l[evt] || [];
    for (var i = 0; i < arr.length; i++) {
      try { arr[i](payload); } catch (_e) {}
    }
  };

  /**
   * @param {object} opts
   * @param {number} [opts.minIntervalMs=1000]
   * @param {number} [opts.burst=3]
   */
  function RateLimiter(opts) {
    opts = opts || {};
    this.minIntervalMs = clamp(opts.minIntervalMs || 1000, 200, 10_000);
    this.burst = clamp(opts.burst || 3, 0, 10);

    this._burstTokens = this.burst;
    this._lastSendAt = 0;
    this._cooldownUntil = 0;

    // server quota info
    this.serverRemaining = null;
    this.serverResetAtSec = null;
    this.serverRetryAfterSec = null;

    this._queue = [];
    this._flushing = false;
    this._em = new Emitter();

    // tick for countdown UI
    var self = this;
    this._timer = setInterval(function () {
      self._emitState();
      self.flush();
    }, 250);
    try { this._timer.unref && this._timer.unref(); } catch (_e) {}
  }

  RateLimiter.prototype.destroy = function () {
    try { clearInterval(this._timer); } catch (_e) {}
  };

  RateLimiter.prototype.on = function (evt, fn) { this._em.on(evt, fn); };

  RateLimiter.prototype.getState = function () {
    var t = now();
    var cooldownMs = Math.max(0, (this._cooldownUntil || 0) - t);
    var serverWaitMs = this.serverRetryAfterSec ? Math.max(0, (this.serverResetAtSec * 1000) - t) : 0;
    var waitMs = Math.max(cooldownMs, serverWaitMs);

    return {
      queued: this._queue.length,
      cooldownMs: cooldownMs,
      waitMs: waitMs,
      burstTokens: this._burstTokens,
      minIntervalMs: this.minIntervalMs,
      serverRemaining: this.serverRemaining,
      serverResetAtSec: this.serverResetAtSec,
      serverRetryAfterSec: this.serverRetryAfterSec,
    };
  };

  RateLimiter.prototype._emitState = function () {
    this._em.emit('change', this.getState());
  };

  RateLimiter.prototype._computeCooldown = function () {
    var t = now();
    // Allow burst messages without delay.
    if (this._burstTokens > 0) {
      this._burstTokens -= 1;
      this._lastSendAt = t;
      this._cooldownUntil = t; // no cooldown
      return;
    }

    var earliest = this._lastSendAt + this.minIntervalMs;
    this._lastSendAt = t;
    this._cooldownUntil = Math.max(this._cooldownUntil, earliest);
  };

  RateLimiter.prototype.canSendNow = function () {
    var st = this.getState();
    return st.waitMs <= 0;
  };

  /**
   * Enqueue a function that returns a Promise.
   * The function is only executed when limiter allows.
   */
  RateLimiter.prototype.enqueue = function (fn, meta) {
    this._queue.push({ fn: fn, meta: meta || null });
    this._emitState();
    this.flush();
  };

  /**
   * Update limiter state from a fetch Response.
   */
  RateLimiter.prototype.observeResponse = function (response) {
    try {
      if (!response || !response.headers) return;
      var rem = response.headers.get('X-RateLimit-Remaining');
      var reset = response.headers.get('X-RateLimit-Reset');
      var ra = response.headers.get('Retry-After');

      if (rem !== null) this.serverRemaining = parseInt(rem, 10);
      if (reset !== null) this.serverResetAtSec = parseInt(reset, 10);
      if (ra !== null) this.serverRetryAfterSec = parseInt(ra, 10);

      // If not rate limited, clear retryAfter hints
      if (response.status !== 429) this.serverRetryAfterSec = null;

      this._emitState();
    } catch (_e) {}
  };

  /**
   * Explicitly set a server rate-limit wait.
   */
  RateLimiter.prototype.setServerWait = function (retryAfterSec) {
    retryAfterSec = parseInt(retryAfterSec, 10);
    if (!Number.isFinite(retryAfterSec) || retryAfterSec <= 0) retryAfterSec = 1;
    var t = now();
    this.serverRetryAfterSec = retryAfterSec;
    this.serverResetAtSec = Math.ceil((t + retryAfterSec * 1000) / 1000);
    this._emitState();
  };

  /**
   * Attempt to flush one queued item if allowed.
   */
  RateLimiter.prototype.flush = function () {
    if (this._flushing) return;
    if (this._queue.length === 0) return;
    if (!this.canSendNow()) return;

    var item = this._queue.shift();
    if (!item || typeof item.fn !== 'function') return;

    this._flushing = true;
    this._computeCooldown();
    this._emitState();

    var self = this;
    Promise.resolve()
      .then(function () { return item.fn(item.meta); })
      .catch(function (_e) {
        // If the caller throws (e.g. rate limited), let UI show via setServerWait.
      })
      .finally(function () {
        self._flushing = false;
        self._emitState();
        // Continue draining
        setTimeout(function () { self.flush(); }, 0);
      });
  };

  // Export
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.ChatRateLimiter = RateLimiter;
})();
