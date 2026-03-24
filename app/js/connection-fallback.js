/**
 * [CFX-022] Connection Fallback Manager — Progressive Degradation
 *
 * Orchestrates transport selection: WebSocket → SSE → Long Polling
 * Automatically detects failures and falls back to the next transport.
 *
 * Usage:
 *   var manager = CortexFreelancer.ConnectionFallback.create({
 *     wsUrl: 'wss://...',
 *     sseUrl: '/api/chat-stream',
 *     pollUrl: '/api/chat-poll',
 *     onToken: function(token, full) {},
 *     onDone: function(text, meta) {},
 *     onError: function(err) {},
 *     onTransportChange: function(transport) {},
 *   });
 *   manager.send('How do I raise my rates?');
 *
 * Exposed on window.CortexFreelancer.ConnectionFallback
 */
(function () {
  'use strict';

  var TRANSPORTS = ['websocket', 'sse', 'longpoll'];

  var TRANSPORT_LABELS = {
    websocket: 'WebSocket (real-time)',
    sse: 'SSE (streaming)',
    longpoll: 'Long Polling (compatible)',
  };

  // Persistence key for remembering last working transport
  var STORAGE_KEY = 'cortex_transport_preference';

  // ── Feature detection ──

  function detectSupport() {
    return {
      websocket: typeof WebSocket !== 'undefined',
      sse: typeof EventSource !== 'undefined',
      longpoll: typeof fetch === 'function' || typeof XMLHttpRequest === 'function',
    };
  }

  // ── Saved preference ──

  function loadPreference() {
    try {
      var pref = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (pref && pref.transport && pref.timestamp) {
        // Expire after 24 hours — retry higher tiers periodically
        if (Date.now() - pref.timestamp < 24 * 60 * 60 * 1000) {
          return pref.transport;
        }
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  function savePreference(transport) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        transport: transport,
        timestamp: Date.now(),
      }));
    } catch (e) { /* ignore */ }
  }

  function clearPreference() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
  }

  // ── Create fallback manager ──

  function create(opts) {
    opts = opts || {};
    var wsUrl = opts.wsUrl || null;
    var sseUrl = opts.sseUrl || '/api/chat-stream';
    var pollUrl = opts.pollUrl || '/api/chat-poll';
    var onToken = opts.onToken || function () {};
    var onDone = opts.onDone || function () {};
    var onError = opts.onError || function () {};
    var onStart = opts.onStart || function () {};
    var onTransportChange = opts.onTransportChange || function () {};
    var onStatus = opts.onStatus || function () {};

    var support = detectSupport();
    var currentTransport = null;
    var failedTransports = {};
    var consecutiveFailures = {};
    var sessionId = opts.sessionId || null;
    var profile = opts.profile || null;
    var goals = opts.goals || null;
    var isActive = false;

    // Determine starting transport
    function selectTransport() {
      // Check saved preference first
      var pref = loadPreference();
      if (pref && support[pref === 'longpoll' ? 'longpoll' : pref]) {
        return pref;
      }

      // Try transports in order, skip unsupported/failed ones
      for (var i = 0; i < TRANSPORTS.length; i++) {
        var t = TRANSPORTS[i];
        var supportKey = t === 'longpoll' ? 'longpoll' : t;
        if (support[supportKey] && !failedTransports[t]) {
          return t;
        }
      }

      // Everything failed — try long polling as absolute last resort
      return 'longpoll';
    }

    function setTransport(t) {
      if (currentTransport !== t) {
        currentTransport = t;
        onTransportChange(t, TRANSPORT_LABELS[t]);
        console.log('[ConnectionFallback] Using transport:', t);
      }
    }

    function markFailed(transport) {
      consecutiveFailures[transport] = (consecutiveFailures[transport] || 0) + 1;

      // Mark as failed after 2 consecutive failures
      if (consecutiveFailures[transport] >= 2) {
        failedTransports[transport] = true;
        console.warn('[ConnectionFallback] Transport failed:', transport);
      }
    }

    function markSuccess(transport) {
      consecutiveFailures[transport] = 0;
      delete failedTransports[transport];
      savePreference(transport);
    }

    function fallback(failedFrom) {
      markFailed(failedFrom);
      var next = selectTransport();
      if (next === failedFrom) {
        // No fallback available
        onError(new Error('All connection methods failed. Please check your network.'));
        onStatus('disconnected');
        return false;
      }
      setTransport(next);
      return true;
    }

    // ── Send via WebSocket ──

    function sendViaWebSocket(message) {
      if (!wsUrl) {
        markFailed('websocket');
        return sendMessage(message);
      }

      // Check if WebSocket module is available
      var ChatWS = window.CortexFreelancer && window.CortexFreelancer.ChatWebSocket;
      if (!ChatWS) {
        markFailed('websocket');
        return sendMessage(message);
      }

      try {
        ChatWS.send(message, {
          onToken: function (token, full) {
            markSuccess('websocket');
            onToken(token, full);
          },
          onDone: function (text, meta) {
            isActive = false;
            markSuccess('websocket');
            onDone(text, meta);
          },
          onError: function (err) {
            isActive = false;
            console.warn('[ConnectionFallback] WebSocket failed:', err.message);
            if (fallback('websocket')) {
              sendMessage(message); // Retry on next transport
            }
          },
        });
      } catch (e) {
        if (fallback('websocket')) {
          sendMessage(message);
        }
      }
    }

    // ── Send via SSE ──

    function sendViaSSE(message) {
      var ChatSSE = window.CortexFreelancer && window.CortexFreelancer.ChatStreaming;
      if (!ChatSSE) {
        markFailed('sse');
        return sendMessage(message);
      }

      var body = { message: message };
      if (sessionId) body.sessionId = sessionId;
      if (profile) body.profile = profile;
      if (goals) body.goals = goals;

      ChatSSE.streamMessage(sseUrl, body, {
        onStart: function () {
          onStart();
        },
        onToken: function (token, full) {
          markSuccess('sse');
          onToken(token, full);
        },
        onDone: function (text) {
          isActive = false;
          markSuccess('sse');
          onDone(text, {});
        },
        onError: function (err) {
          isActive = false;
          console.warn('[ConnectionFallback] SSE failed:', err.message);
          if (fallback('sse')) {
            sendMessage(message); // Retry on next transport
          }
        },
      });
    }

    // ── Send via Long Polling ──

    function sendViaLongPoll(message) {
      var ChatPoll = window.CortexFreelancer && window.CortexFreelancer.ChatLongPolling;
      if (!ChatPoll) {
        onError(new Error('Long polling module not loaded.'));
        return;
      }

      ChatPoll.sendMessage(message, {
        apiUrl: pollUrl,
        sessionId: sessionId,
        profile: profile,
        goals: goals,
        onStart: function () {
          onStart();
        },
        onToken: function (token, full) {
          markSuccess('longpoll');
          onToken(token, full);
        },
        onDone: function (text, meta) {
          isActive = false;
          markSuccess('longpoll');
          sessionId = ChatPoll.getSessionId() || sessionId;
          onDone(text, meta);
        },
        onError: function (err) {
          isActive = false;
          markFailed('longpoll');
          onError(err);
        },
        onStatus: function (status) {
          onStatus(status);
        },
      });
    }

    // ── Public: Send ──

    function sendMessage(message) {
      if (isActive) {
        abort();
      }

      isActive = true;
      var transport = currentTransport || selectTransport();
      setTransport(transport);
      onStatus('connecting');

      switch (transport) {
        case 'websocket': return sendViaWebSocket(message);
        case 'sse':       return sendViaSSE(message);
        case 'longpoll':  return sendViaLongPoll(message);
        default:          return sendViaLongPoll(message);
      }
    }

    // ── Public: Abort ──

    function abort() {
      isActive = false;
      // Abort all transports
      var ChatSSE = window.CortexFreelancer && window.CortexFreelancer.ChatStreaming;
      var ChatPoll = window.CortexFreelancer && window.CortexFreelancer.ChatLongPolling;
      if (ChatSSE && ChatSSE.abortStream) ChatSSE.abortStream();
      if (ChatPoll && ChatPoll.abort) ChatPoll.abort();
    }

    // ── Public: Status ──

    function getStatus() {
      return {
        currentTransport: currentTransport,
        transportLabel: TRANSPORT_LABELS[currentTransport] || 'none',
        support: support,
        failedTransports: Object.keys(failedTransports),
        consecutiveFailures: Object.assign({}, consecutiveFailures),
        sessionId: sessionId,
        isActive: isActive,
      };
    }

    // ── Public: Reset (retry from top) ──

    function reset() {
      abort();
      failedTransports = {};
      consecutiveFailures = {};
      currentTransport = null;
      clearPreference();
      console.log('[ConnectionFallback] Reset — will retry from WebSocket');
    }

    // ── Public: Force transport ──

    function forceTransport(t) {
      if (TRANSPORTS.indexOf(t) === -1) {
        console.error('[ConnectionFallback] Unknown transport:', t);
        return;
      }
      failedTransports = {};
      consecutiveFailures = {};
      setTransport(t);
      savePreference(t);
    }

    // Initialize
    var initialTransport = selectTransport();
    setTransport(initialTransport);

    return {
      send: sendMessage,
      abort: abort,
      getStatus: getStatus,
      reset: reset,
      forceTransport: forceTransport,
      setProfile: function (p) { profile = p; },
      setGoals: function (g) { goals = g; },
      setSessionId: function (s) { sessionId = s; },
    };
  }

  // ── Init ──

  function init() {
    var support = detectSupport();
    console.log('[ConnectionFallback] Initialized — Support:', JSON.stringify(support));
  }

  // ── Expose ──
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.ConnectionFallback = {
    init: init,
    create: create,
    detectSupport: detectSupport,
    TRANSPORTS: TRANSPORTS,
    TRANSPORT_LABELS: TRANSPORT_LABELS,
  };
})();
