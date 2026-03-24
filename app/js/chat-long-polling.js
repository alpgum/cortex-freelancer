/**
 * [CFX-022] Chat Long Polling — HTTP Fallback Transport
 *
 * Final tier in progressive degradation: WebSocket → SSE → Long Polling.
 * Works on any network that supports basic HTTP POST requests.
 *
 * Features:
 * - Adaptive polling intervals based on activity
 * - Bandwidth optimization (chunk cursoring)
 * - Battery-aware polling on mobile
 * - Automatic retry with exponential backoff
 * - Request deduplication
 *
 * Exposed on window.CortexFreelancer.ChatLongPolling
 */
(function () {
  'use strict';

  // ── Configuration ──
  var DEFAULT_API_URL = '/api/chat-poll';

  var POLL_INTERVALS = {
    active:   1000,   // During active streaming
    idle:     5000,   // After response complete, waiting for next action
    backoff:  2000,   // Base backoff on error
    maxBackoff: 30000,
    mobile:   1500,   // Slightly slower on mobile
  };

  // ── State ──
  var activePollId = null;
  var activeSessionId = null;
  var pollTimer = null;
  var isPolling = false;
  var isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  var consecutiveErrors = 0;
  var lastActivity = Date.now();
  var fullText = '';
  var _callbacks = {};
  var _apiUrl = DEFAULT_API_URL;
  var _abortController = null;
  var _batteryAware = true;
  var _isLowBattery = false;
  var _requestInFlight = false;  // Deduplication flag

  // ── Battery awareness ──
  if (_batteryAware && navigator.getBattery) {
    navigator.getBattery().then(function (battery) {
      function updateBattery() {
        _isLowBattery = !battery.charging && battery.level < 0.2;
      }
      battery.addEventListener('levelchange', updateBattery);
      battery.addEventListener('chargingchange', updateBattery);
      updateBattery();
    }).catch(function () {
      // Battery API not available, ignore
    });
  }

  // ── Helpers ──

  function getInterval() {
    var base;
    if (activePollId && isPolling) {
      base = isMobile ? POLL_INTERVALS.mobile : POLL_INTERVALS.active;
    } else {
      base = POLL_INTERVALS.idle;
    }

    // Low battery: double the interval
    if (_isLowBattery) base *= 2;

    // Error backoff
    if (consecutiveErrors > 0) {
      var backoff = POLL_INTERVALS.backoff * Math.pow(1.5, Math.min(consecutiveErrors - 1, 6));
      base = Math.min(backoff, POLL_INTERVALS.maxBackoff);
    }

    return base;
  }

  function postJSON(url, body) {
    _abortController = new AbortController();
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: _abortController.signal,
    }).then(function (resp) {
      if (!resp.ok) {
        return resp.json().then(function (err) {
          var e = new Error(err.error || 'HTTP ' + resp.status);
          e.status = resp.status;
          e.retryAfter = err.retryAfter;
          throw e;
        }).catch(function (parseErr) {
          if (parseErr.status) throw parseErr;
          var e = new Error('HTTP ' + resp.status);
          e.status = resp.status;
          throw e;
        });
      }
      return resp.json();
    });
  }

  // ── Core: Send Message ──

  function sendMessage(message, opts) {
    opts = opts || {};
    fullText = '';
    consecutiveErrors = 0;
    lastActivity = Date.now();

    _callbacks = {
      onToken: opts.onToken || function () {},
      onDone: opts.onDone || function () {},
      onError: opts.onError || function () {},
      onStart: opts.onStart || function () {},
      onStatus: opts.onStatus || function () {},
    };

    _apiUrl = opts.apiUrl || DEFAULT_API_URL;
    activeSessionId = opts.sessionId || activeSessionId || null;

    _callbacks.onStart();
    _callbacks.onStatus('sending');

    var body = {
      action: 'send',
      message: message,
      sessionId: activeSessionId,
    };
    if (opts.profile) body.profile = opts.profile;
    if (opts.goals) body.goals = opts.goals;

    return postJSON(_apiUrl, body).then(function (data) {
      activePollId = data.pollId;
      activeSessionId = data.sessionId;
      isPolling = true;
      _callbacks.onStatus(data.status);

      // Start polling loop
      schedulePoll();
      return data;
    }).catch(function (err) {
      activePollId = null;
      isPolling = false;
      _callbacks.onError(err);
      _callbacks.onStatus('error');
    });
  }

  // ── Core: Poll Loop ──

  function schedulePoll() {
    if (!isPolling || !activePollId) return;
    var interval = getInterval();
    pollTimer = setTimeout(doPoll, interval);
  }

  function doPoll() {
    if (!isPolling || !activePollId || _requestInFlight) return;

    _requestInFlight = true;

    postJSON(_apiUrl, {
      action: 'poll',
      pollId: activePollId,
      sessionId: activeSessionId,
    }).then(function (data) {
      _requestInFlight = false;
      consecutiveErrors = 0;
      lastActivity = Date.now();

      // Deliver new chunks
      if (data.chunks && data.chunks.length > 0) {
        for (var i = 0; i < data.chunks.length; i++) {
          fullText += data.chunks[i];
          _callbacks.onToken(data.chunks[i], fullText);
        }
      }

      if (data.status === 'complete') {
        isPolling = false;
        var finalText = data.fullText || fullText;
        _callbacks.onDone(finalText, data.meta || {});
        _callbacks.onStatus('complete');
        ackPoll(activePollId);
        activePollId = null;
        return;
      }

      if (data.status === 'error') {
        isPolling = false;
        _callbacks.onError(new Error(data.error || 'Unknown error'));
        _callbacks.onStatus('error');
        ackPoll(activePollId);
        activePollId = null;
        return;
      }

      // Still processing or queued — keep polling
      _callbacks.onStatus(data.status);
      schedulePoll();

    }).catch(function (err) {
      _requestInFlight = false;

      if (err.name === 'AbortError') {
        // Manual abort, don't retry
        return;
      }

      consecutiveErrors++;

      // After 10 consecutive errors, give up
      if (consecutiveErrors >= 10) {
        isPolling = false;
        _callbacks.onError(new Error('Connection lost after multiple retries.'));
        _callbacks.onStatus('error');
        activePollId = null;
        return;
      }

      // Retry with backoff
      _callbacks.onStatus('retrying');
      schedulePoll();
    });
  }

  function ackPoll(pollId) {
    // Fire-and-forget cleanup
    try {
      fetch(_apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ack', pollId: pollId }),
      }).catch(function () { /* ignore */ });
    } catch (e) { /* ignore */ }
  }

  // ── Control ──

  function abort() {
    isPolling = false;
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
    if (_abortController) {
      _abortController.abort();
      _abortController = null;
    }
    if (activePollId) {
      ackPoll(activePollId);
      activePollId = null;
    }
    _requestInFlight = false;
    return true;
  }

  function isActive() {
    return isPolling && activePollId !== null;
  }

  function getSessionId() {
    return activeSessionId;
  }

  function getStatus() {
    return {
      isPolling: isPolling,
      pollId: activePollId,
      sessionId: activeSessionId,
      consecutiveErrors: consecutiveErrors,
      isMobile: isMobile,
      isLowBattery: _isLowBattery,
      currentInterval: getInterval(),
      fullTextLength: fullText.length,
    };
  }

  // ── Feature detection ──

  function isSupported() {
    // Long polling works everywhere that has fetch or XMLHttpRequest
    return typeof fetch === 'function' || typeof XMLHttpRequest === 'function';
  }

  // ── Init ──

  function init(opts) {
    opts = opts || {};
    if (opts.apiUrl) _apiUrl = opts.apiUrl;
    if (opts.batteryAware !== undefined) _batteryAware = opts.batteryAware;
    console.log('[ChatLongPolling] Initialized — HTTP long polling fallback ready');
  }

  // ── Expose ──
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.ChatLongPolling = {
    init: init,
    sendMessage: sendMessage,
    abort: abort,
    isActive: isActive,
    isSupported: isSupported,
    getSessionId: getSessionId,
    getStatus: getStatus,
  };
})();
