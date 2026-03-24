/**
 * CF-263: Rate Limiting for API Endpoints
 * Sliding window rate limiter with IP-based tracking, rate limit headers, and 429 handling.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_rate_limits';
  var GENERAL_LIMIT = 60;   // requests per minute
  var AI_LIMIT = 10;        // requests per minute for AI endpoints
  var WINDOW_MS = 60 * 1000; // 1 minute sliding window

  var AI_PATHS = ['/api/ai/', '/api/analyze', '/api/generate', '/api/chat'];

  /**
   * Get rate limit state from localStorage.
   * @returns {object}
   */
  function getState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (_e) {
      return {};
    }
  }

  /**
   * Save rate limit state.
   * @param {object} state
   */
  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  /**
   * Determine if a path is an AI endpoint.
   * @param {string} path
   * @returns {boolean}
   */
  function isAIEndpoint(path) {
    return AI_PATHS.some(function (prefix) {
      return path.indexOf(prefix) === 0;
    });
  }

  /**
   * Get the limit for a given path.
   * @param {string} path
   * @returns {number}
   */
  function getLimitForPath(path) {
    return isAIEndpoint(path) ? AI_LIMIT : GENERAL_LIMIT;
  }

  /**
   * Clean expired entries from the sliding window.
   * @param {number[]} timestamps
   * @param {number} now
   * @returns {number[]}
   */
  function cleanWindow(timestamps, now) {
    var cutoff = now - WINDOW_MS;
    return timestamps.filter(function (ts) { return ts > cutoff; });
  }

  /**
   * Record a request and check if it's within limits.
   * @param {string} path - API endpoint path
   * @param {string} [clientId] - Client/IP identifier
   * @returns {{ allowed: boolean, remaining: number, limit: number, retryAfter: number|null, headers: object }}
   */
  function checkLimit(path, clientId) {
    var id = clientId || 'default';
    var bucket = isAIEndpoint(path) ? 'ai' : 'general';
    var key = id + ':' + bucket;
    var limit = getLimitForPath(path);
    var now = Date.now();

    var state = getState();
    var timestamps = state[key] || [];
    timestamps = cleanWindow(timestamps, now);

    var remaining = Math.max(0, limit - timestamps.length);
    var resetAt = timestamps.length > 0 ? timestamps[0] + WINDOW_MS : now + WINDOW_MS;

    var headers = {
      'X-RateLimit-Limit': String(limit),
      'X-RateLimit-Remaining': String(remaining),
      'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000))
    };

    if (timestamps.length >= limit) {
      var retryAfter = Math.ceil((timestamps[0] + WINDOW_MS - now) / 1000);
      headers['Retry-After'] = String(retryAfter);
      state[key] = timestamps;
      saveState(state);

      return {
        allowed: false,
        remaining: 0,
        limit: limit,
        retryAfter: retryAfter,
        headers: headers
      };
    }

    timestamps.push(now);
    state[key] = timestamps;
    saveState(state);

    return {
      allowed: true,
      remaining: remaining - 1,
      limit: limit,
      retryAfter: null,
      headers: headers
    };
  }

  /**
   * Wrap a fetch call with client-side rate limiting.
   * @param {string} url
   * @param {object} [opts] - Fetch options
   * @param {string} [clientId]
   * @returns {Promise<Response>}
   */
  async function limitedFetch(url, opts, clientId) {
    var path;
    try {
      path = new URL(url, window.location.origin).pathname;
    } catch (_e) {
      path = url;
    }

    var result = checkLimit(path, clientId);

    if (!result.allowed) {
      return new Response(JSON.stringify({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Try again in ' + result.retryAfter + ' seconds.',
        retryAfter: result.retryAfter
      }), {
        status: 429,
        headers: Object.assign({ 'Content-Type': 'application/json' }, result.headers)
      });
    }

    var response = await fetch(url, opts);

    // Check server-side rate limit headers
    var serverRemaining = response.headers.get('X-RateLimit-Remaining');
    if (serverRemaining !== null && parseInt(serverRemaining, 10) <= 0) {
      var retryHeader = response.headers.get('Retry-After');
      if (retryHeader) {
        return new Response(JSON.stringify({
          error: 'Too Many Requests',
          message: 'Server rate limit reached. Try again in ' + retryHeader + ' seconds.',
          retryAfter: parseInt(retryHeader, 10)
        }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'Retry-After': retryHeader }
        });
      }
    }

    return response;
  }

  /**
   * Handle a 429 response with retry logic.
   * @param {Response} response
   * @param {function} retryFn - Function to call on retry
   * @returns {Promise<Response>}
   */
  async function handle429(response, retryFn) {
    if (response.status !== 429) return response;

    var retryAfter = response.headers.get('Retry-After');
    var waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 5000;
    waitMs = Math.min(waitMs, 60000); // Cap at 60 seconds

    await new Promise(function (resolve) { setTimeout(resolve, waitMs); });

    if (typeof retryFn === 'function') return retryFn();
    return response;
  }

  /**
   * Get current rate limit status for a client.
   * @param {string} [clientId]
   * @returns {{ general: { used: number, limit: number, remaining: number }, ai: { used: number, limit: number, remaining: number } }}
   */
  function getStatus(clientId) {
    var id = clientId || 'default';
    var now = Date.now();
    var state = getState();

    var generalTs = cleanWindow(state[id + ':general'] || [], now);
    var aiTs = cleanWindow(state[id + ':ai'] || [], now);

    return {
      general: {
        used: generalTs.length,
        limit: GENERAL_LIMIT,
        remaining: Math.max(0, GENERAL_LIMIT - generalTs.length)
      },
      ai: {
        used: aiTs.length,
        limit: AI_LIMIT,
        remaining: Math.max(0, AI_LIMIT - aiTs.length)
      }
    };
  }

  /**
   * Reset rate limits for a client.
   * @param {string} [clientId]
   */
  function reset(clientId) {
    var id = clientId || 'default';
    var state = getState();
    delete state[id + ':general'];
    delete state[id + ':ai'];
    saveState(state);
  }

  // Export to namespace
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.RateLimiter = {
    checkLimit: checkLimit,
    limitedFetch: limitedFetch,
    handle429: handle429,
    getStatus: getStatus,
    reset: reset,
    isAIEndpoint: isAIEndpoint,
    getLimitForPath: getLimitForPath
  };
})();
