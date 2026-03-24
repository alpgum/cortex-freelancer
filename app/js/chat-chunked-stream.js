/**
 * CFX-023: HTTP Chunked Transfer Client
 * 
 * Client-side implementation for consuming NDJSON streamed responses
 * over HTTP chunked transfer encoding. Works with any browser that
 * supports the Fetch API with ReadableStream (all modern browsers).
 *
 * Wire format: Newline-delimited JSON (NDJSON)
 * Each line is a JSON object: {"type":"chunk","data":"...","index":0}
 *
 * Fallback position: WebSocket → SSE → Chunked → Long Polling → HTTP
 *
 * Exposed on window.CortexFreelancer.ChunkedStream
 */
(function () {
  'use strict';

  var ENDPOINT = '/api/chat-chunked';
  var activeController = null;
  var connectionState = 'idle'; // idle | connecting | streaming | error
  var chunkedFailed = false;
  var consecutiveFailures = 0;
  var MAX_CONSECUTIVE_FAILURES = 3;

  // ─── Feature Detection ─────────────────────────────────────────────

  /**
   * Check if the browser supports streaming fetch responses.
   * Required: Fetch API + ReadableStream + TextDecoder
   */
  function isSupported() {
    return (
      typeof fetch === 'function' &&
      typeof ReadableStream === 'function' &&
      typeof TextDecoder === 'function' &&
      typeof AbortController === 'function'
    );
  }

  /**
   * Whether chunked streaming has been marked as failed
   * (after consecutive failures, we stop trying)
   */
  function hasFailed() {
    return chunkedFailed;
  }

  /**
   * Reset failure state (e.g., on network change or user retry)
   */
  function resetFailureState() {
    chunkedFailed = false;
    consecutiveFailures = 0;
  }

  // ─── NDJSON Parser ──────────────────────────────────────────────────

  /**
   * Creates an NDJSON line parser that handles partial lines across chunks.
   * Returns a function that accepts raw text and calls onLine for each
   * complete JSON object parsed.
   */
  function createNDJSONParser(onLine) {
    var buffer = '';

    return function processText(text) {
      buffer += text;
      var lines = buffer.split('\n');
      // Last element might be incomplete — keep it in buffer
      buffer = lines.pop() || '';

      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line) continue;
        try {
          var obj = JSON.parse(line);
          onLine(obj);
        } catch (e) {
          // Skip malformed JSON lines
          console.warn('[chunked] Malformed NDJSON line:', line);
        }
      }
    };
  }

  // ─── Stream Consumer ────────────────────────────────────────────────

  /**
   * Send a message and stream the response via chunked transfer.
   *
   * @param {string} message - User message
   * @param {Object} opts - Options
   * @param {string} opts.sessionId - Session ID
   * @param {Object} opts.profile - User profile data
   * @param {Object} opts.goals - User goals data
   * @param {Function} opts.onStart - Called when stream starts
   * @param {Function} opts.onChunk - Called with (chunkText, index) for each chunk
   * @param {Function} opts.onDone - Called with (fullReply, meta) when complete
   * @param {Function} opts.onError - Called with (errorObj) on error
   * @param {Function} opts.onKeepalive - Called on keepalive (optional)
   * @param {number} opts.timeout - Timeout in ms (default: 130000)
   * @returns {Promise<Object>} Result with reply, sessionId, meta
   */
  function streamMessage(message, opts) {
    opts = opts || {};

    if (!isSupported()) {
      var err = { error: 'Browser does not support streaming fetch', code: 'C000' };
      if (opts.onError) opts.onError(err);
      return Promise.resolve({ reply: err.error, _error: true, _chunkedFailed: true });
    }

    // Abort previous stream if active
    abort();

    activeController = new AbortController();
    connectionState = 'connecting';

    // Allow external AbortSignal to cancel this stream
    if (opts.signal && typeof opts.signal.addEventListener === 'function') {
      try {
        if (opts.signal.aborted) {
          abort();
          return Promise.resolve({ reply: 'Request cancelled.', _aborted: true });
        }
        opts.signal.addEventListener('abort', function () {
          abort();
        }, { once: true });
      } catch (e) { /* best-effort */ }
    }

    var signal = activeController.signal;
    var fullReply = '';
    var resolved = false;
    var timeoutMs = opts.timeout || 130000;

    return new Promise(function (resolve) {
      function done(result) {
        if (resolved) return;
        resolved = true;
        connectionState = result._error ? 'error' : 'idle';
        activeController = null;
        resolve(result);
      }

      // Timeout safety
      var timeoutTimer = setTimeout(function () {
        if (!resolved) {
          if (activeController) activeController.abort();
          done({ reply: 'Request timed out. Please try again.', _error: true });
        }
      }, timeoutMs);

      var parser = createNDJSONParser(function (obj) {
        switch (obj.type) {
          case 'start':
            connectionState = 'streaming';
            consecutiveFailures = 0; // Successful connection resets failures
            if (opts.onStart) opts.onStart(obj);
            break;

          case 'chunk':
            if (obj.data) {
              fullReply += obj.data;
              if (opts.onChunk) opts.onChunk(obj.data, obj.index);
            }
            break;

          case 'end':
            clearTimeout(timeoutTimer);
            fullReply = obj.reply || fullReply;
            if (opts.onDone) opts.onDone(obj.reply || fullReply, obj.meta);
            done({
              reply: obj.reply || fullReply,
              sessionId: obj.sessionId,
              meta: obj.meta,
            });
            break;

          case 'error':
            clearTimeout(timeoutTimer);
            if (opts.onError) opts.onError(obj);
            done({
              reply: obj.error || 'An error occurred.',
              _error: true,
              _errorCode: obj.code,
            });
            break;

          case 'keepalive':
            if (opts.onKeepalive) opts.onKeepalive(obj.ts);
            break;
        }
      });

      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message,
          sessionId: opts.sessionId,
          profile: opts.profile,
          goals: opts.goals,
          requestId: opts.requestId,
          clientRequestId: opts.requestId,
        }),
        signal: signal,
      }).then(function (response) {
        if (!response.ok) {
          chunkedFailed = true;
          clearTimeout(timeoutTimer);
          return response.json().then(function (data) {
            if (opts.onError) opts.onError(data);
            done({
              reply: data.error || 'Chunked stream unavailable',
              _error: true,
              _chunkedFailed: true,
            });
          }).catch(function () {
            done({
              reply: 'Chunked stream error: ' + response.status,
              _error: true,
              _chunkedFailed: true,
            });
          });
        }

        var reader = response.body.getReader();
        var decoder = new TextDecoder();

        function pump() {
          return reader.read().then(function (result) {
            if (result.done) {
              // Stream ended — if we haven't resolved yet, it's unexpected
              if (!resolved) {
                clearTimeout(timeoutTimer);
                if (fullReply) {
                  // Got data but no 'end' message — still usable
                  if (opts.onDone) opts.onDone(fullReply, {});
                  done({ reply: fullReply, _partial: true });
                } else {
                  done({ reply: 'Stream ended unexpectedly.', _error: true });
                }
              }
              return;
            }

            var text = decoder.decode(result.value, { stream: true });
            parser(text);

            if (!resolved) {
              return pump();
            }
          });
        }

        return pump();
      }).catch(function (err) {
        clearTimeout(timeoutTimer);
        if (err.name === 'AbortError') {
          // User-initiated abort — return what we have
          if (opts.onDone) opts.onDone(fullReply, {});
          done({ reply: fullReply || 'Request cancelled.', _aborted: true });
          return;
        }

        consecutiveFailures++;
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          chunkedFailed = true;
        }

        if (opts.onError) opts.onError({ error: err.message, code: 'C999' });
        done({
          reply: 'Connection error.',
          _error: true,
          _chunkedFailed: consecutiveFailures >= MAX_CONSECUTIVE_FAILURES,
        });
      });
    });
  }

  /**
   * Abort the current stream
   */
  function abort() {
    if (activeController) {
      activeController.abort();
      activeController = null;
      connectionState = 'idle';
      return true;
    }
    return false;
  }

  /**
   * Check if currently streaming
   */
  function isStreaming() {
    return connectionState === 'streaming' || connectionState === 'connecting';
  }

  /**
   * Get current connection state
   */
  function getState() {
    return connectionState;
  }

  // ─── Health Check ───────────────────────────────────────────────────

  /**
   * Quick health check — GET the endpoint to see if chunked streaming
   * is available on the server.
   */
  function healthCheck() {
    return fetch(ENDPOINT, { method: 'GET' })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        return { available: true, status: data.status, data: data };
      })
      .catch(function () {
        return { available: false, status: 'unreachable' };
      });
  }

  // ─── Init ───────────────────────────────────────────────────────────

  function init() {
    if (!isSupported()) {
      console.warn('[ChunkedStream] Browser does not support streaming fetch — chunked transfer disabled');
      chunkedFailed = true;
      return;
    }
    console.log('[ChunkedStream] Initialized — NDJSON chunked transfer ready');
  }

  // ─── Expose ─────────────────────────────────────────────────────────

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.ChunkedStream = {
    init: init,
    isSupported: isSupported,
    hasFailed: hasFailed,
    resetFailureState: resetFailureState,
    streamMessage: streamMessage,
    abort: abort,
    isStreaming: isStreaming,
    getState: getState,
    healthCheck: healthCheck,
  };
})();
