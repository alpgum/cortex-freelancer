/**
 * CFX-026: Chat Dispatcher Integration
 * 
 * Integration patch for chat-dispatcher.js to add REST polling as final fallback.
 * This adds REST polling after the existing transport chain.
 * 
 * Transport Chain (final):
 * WebSocket → SSE → Chunked Transfer → Long Polling → REST Polling → Basic HTTP
 */

(function () {
  'use strict';

  // Wait for dependencies to load
  if (typeof window.CortexRestPolling === 'undefined') {
    console.warn('[REST Integration] CortexRestPolling not loaded, REST polling unavailable');
    return;
  }

  if (typeof window.CortexChatDispatcher === 'undefined') {
    console.warn('[REST Integration] CortexChatDispatcher not loaded, cannot integrate');
    return;
  }

  // REST polling via serverless endpoint (/api/chat-rest)
  var restFailed = false;
  var REST_API = '/api/chat-rest';

  /**
   * Send via REST Polling (uses POST-only serverless handler)
   */
  function sendViaRestPolling(message, callbacks) {
    if (restFailed) {
      return Promise.resolve({
        reply: 'REST polling unavailable',
        _error: true,
        _restFailed: true
      });
    }

    var sessionId = window.CortexChatDispatcher.getSessionId();
    var profile = getProfile();
    var goals = getGoals();

    // Step 1: Submit
    return fetch(REST_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'send',
        message: message,
        sessionId: sessionId,
        profile: profile,
        goals: goals
      })
    }).then(function (res) {
      if (!res.ok) return res.json().then(function (e) { throw new Error(e.error || 'Submit failed'); });
      return res.json();
    }).then(function (data) {
      var requestId = data.requestId;
      if (callbacks.onQueued) callbacks.onQueued(data.position);

      // Step 2: Poll loop
      return new Promise(function (resolve, reject) {
        var retries = 0;
        var maxRetries = 3;

        function poll() {
          fetch(REST_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'poll', requestId: requestId })
          }).then(function (res) {
            if (!res.ok) throw new Error('Poll failed');
            return res.json();
          }).then(function (status) {
            retries = 0;

            if (callbacks.onProgress) callbacks.onProgress(status);

            if (status.status === 'processing' && callbacks.onStreamStart && !poll._started) {
              callbacks.onStreamStart();
              poll._started = true;
            }

            if (status.status === 'complete') {
              // Step 3: Fetch result
              fetch(REST_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'result', requestId: requestId })
              }).then(function (r) { return r.json(); }).then(function (result) {
                if (callbacks.onDone) callbacks.onDone(result.result, result.meta);
                resolve({ reply: result.result, sessionId: result.sessionId, meta: result.meta });
              }).catch(reject);
              return;
            }

            if (status.status === 'error') {
              var err = new Error(status.error || 'Request failed');
              if (callbacks.onError) callbacks.onError(err);
              reject(err);
              return;
            }

            if (status.status === 'cancelled' || status.status === 'expired') {
              reject(new Error('Request ' + status.status));
              return;
            }

            setTimeout(poll, status.pollInterval || 1000);
          }).catch(function (err) {
            retries++;
            if (retries >= maxRetries) { reject(err); return; }
            setTimeout(poll, 2000 * retries);
          });
        }

        setTimeout(poll, data.pollInterval || 1000);
      });
    }).catch(function (error) {
      restFailed = true;
      if (callbacks.onError) callbacks.onError(error);
      return { reply: error.message || 'REST polling failed', _error: true, _restFailed: true };
    });
  }

  // Helper functions (copied from chat-dispatcher.js)
  function getProfile() {
    if (window.CortexFreelancer && typeof window.CortexFreelancer.getProfile === 'function') {
      return window.CortexFreelancer.getProfile();
    }
    return null;
  }

  function getGoals() {
    if (window.CortexFreelancer && typeof window.CortexFreelancer.getGoals === 'function') {
      return window.CortexFreelancer.getGoals();
    }
    return null;
  }

  /**
   * Enhanced send function with REST polling fallback
   */
  var originalSend = window.CortexChatDispatcher.send;
  
  window.CortexChatDispatcher.send = function (message, callbacks) {
    callbacks = callbacks || {};

    // Rate limit check
    if (window.CortexChatLimiter && !window.CortexChatLimiter.canSend()) {
      return Promise.resolve({
        reply: '⚡ Daily message limit reached. Upgrade to Pro for 200 messages/day! → /pricing',
        _limited: true
      });
    }

    // Save user message
    var sid = window.CortexChatDispatcher.getSessionId();
    if (window.CortexChatSessions) {
      window.CortexChatSessions.getOrCreate(sid);
      window.CortexChatSessions.addMessage(sid, { role: 'user', content: message });
    }
    if (window.CortexChatLimiter) window.CortexChatLimiter.record();

    try {
      // Try the original transport chain first
      return originalSend.call(this, message, callbacks).then(function (result) {
        // If all transports failed, try REST polling as final fallback
        if (result._error && (result._sseFailed || result._chunkedFailed || result._httpFailed)) {
          console.log('[REST Integration] Trying REST polling as final fallback');
          
          return sendViaRestPolling(message, callbacks).then(function (restResult) {
            if (!restResult._restFailed) {
              // Save AI response
              if (window.CortexChatSessions && restResult.reply && !restResult._error) {
                window.CortexChatSessions.addMessage(sid, { 
                  role: 'assistant', 
                  content: restResult.reply 
                });
              }
            }
            return restResult;
          });
        }
        
        return result;
      });
    } catch (error) {
      console.error('[REST Integration] Send error:', error);
      
      // Try REST polling on exception
      return sendViaRestPolling(message, callbacks).then(function (restResult) {
        if (!restResult._restFailed) {
          // Save AI response
          if (window.CortexChatSessions && restResult.reply && !restResult._error) {
            window.CortexChatSessions.addMessage(sid, { 
              role: 'assistant', 
              content: restResult.reply 
            });
          }
        }
        return restResult;
      }).catch(function () {
        return {
          reply: 'All connection methods failed. Please check your internet and try again.',
          _error: true
        };
      });
    }
  };

  /**
   * Enhanced getConnectionMode function
   */
  var originalGetConnectionMode = window.CortexChatDispatcher.getConnectionMode;
  
  window.CortexChatDispatcher.getConnectionMode = function () {
    var mode = originalGetConnectionMode.call(this);
    
    // If all other modes failed, check REST polling
    if (mode === 'http' && restPolling.isSupported() && !restFailed) {
      return 'rest-polling';
    }
    
    return mode;
  };

  /**
   * Add REST polling status to dispatcher
   */
  window.CortexChatDispatcher.isRestPollingAvailable = function () {
    return restPolling.isSupported() && !restFailed;
  };

  window.CortexChatDispatcher.getActiveRestRequests = function () {
    return restPolling.getActiveRequestCount ? restPolling.getActiveRequestCount() : 0;
  };

  /**
   * Enhanced reconnect function to reset REST polling
   */
  var originalReconnect = window.CortexChatDispatcher.reconnect;
  
  window.CortexChatDispatcher.reconnect = function () {
    // Reset REST polling failure state
    restFailed = false;
    
    // Call original reconnect
    if (originalReconnect) {
      originalReconnect.call(this);
    }
  };

  console.log('[REST Integration] REST polling integrated as final transport fallback');

  // Expose REST polling transport for debugging
  window.CortexChatDispatcher._restPolling = restPolling;

})();