/**
 * CFX-007 — Enhanced Chat Error Handler
 * User-friendly error messages with structured error codes,
 * recovery hints, auto-retry, and graceful degradation UI.
 *
 * Handles: API errors (HTTP), WebSocket errors (structured codes),
 * network failures, timeouts, and resource exhaustion.
 */
(function () {
  'use strict';

  var ns = (window.CortexFreelancer = window.CortexFreelancer || {});

  // ─── Error Code Definitions ───
  // Maps server error codes (E1xx–E5xx) to client-friendly display
  var WS_ERROR_MAP = {
    // Connection errors
    E100: { icon: '🔌', title: 'Connection Timeout', category: 'connection',
      message: 'Couldn\'t connect to the server. Check your internet and try again.',
      retryable: true, retryAfterMs: 3000 },
    E101: { icon: '🔌', title: 'Connection Error', category: 'connection',
      message: 'Connection interrupted. Reconnecting automatically...',
      retryable: true, retryAfterMs: 2000 },
    E102: { icon: '💤', title: 'Session Idle', category: 'connection',
      message: 'Connection closed due to inactivity. Send a message to reconnect.',
      retryable: true, retryAfterMs: 0 },

    // Spawn/AI errors
    E200: { icon: '🤖', title: 'AI Service Unavailable', category: 'spawn',
      message: 'The AI assistant couldn\'t start. Retrying shortly...',
      retryable: true, retryAfterMs: 5000 },
    E201: { icon: '⏱️', title: 'Response Timeout', category: 'spawn',
      message: 'Your question took too long to process. Try a shorter or simpler message.',
      retryable: true, retryAfterMs: 3000 },
    E202: { icon: '🤖', title: 'AI Error', category: 'spawn',
      message: 'The AI assistant encountered an unexpected error. Please try again.',
      retryable: true, retryAfterMs: 5000 },
    E203: { icon: '🚫', title: 'Service Not Configured', category: 'spawn',
      message: 'The AI service is not available on this server.',
      retryable: false },

    // Rate/resource errors
    E300: { icon: '🕐', title: 'Slow Down', category: 'rate',
      message: 'Too many messages! Please wait a moment before sending another.',
      retryable: true, retryAfterMs: 30000 },
    E301: { icon: '📋', title: 'Server Busy', category: 'rate',
      message: 'The server is handling other requests. Yours is queued.',
      retryable: false },
    E302: { icon: '🔥', title: 'Server Overloaded', category: 'resource',
      message: 'The server is under heavy load. Please try again in a few minutes.',
      retryable: true, retryAfterMs: 60000 },
    E303: { icon: '🔄', title: 'Session Expired', category: 'session',
      message: 'Your session expired. A new one will start automatically.',
      retryable: true, retryAfterMs: 0 },

    // Client errors
    E400: { icon: '⚠️', title: 'Invalid Request', category: 'client',
      message: 'Something went wrong with your message format.',
      retryable: false },
    E401: { icon: '✏️', title: 'Empty Message', category: 'client',
      message: 'Please type a message first.',
      retryable: false },
    E403: { icon: '📝', title: 'Message Too Long', category: 'client',
      message: 'Your message is too long. Please keep it under 4000 characters.',
      retryable: false },

    // Server errors
    E500: { icon: '⚠️', title: 'Server Error', category: 'server',
      message: 'Something went wrong on our end. Please try again.',
      retryable: true, retryAfterMs: 3000 },
  };

  // HTTP status code map (for REST/SSE fallback)
  var HTTP_ERROR_MAP = {
    429: { icon: '🕐', title: 'Rate Limited', category: 'rate',
      message: 'Too many requests. Please wait a moment and try again.',
      retryable: true, retryAfterMs: 5000 },
    401: { icon: '🔑', title: 'Authentication Error', category: 'auth',
      message: 'Chat service authentication failed. Please refresh the page.',
      retryable: false },
    403: { icon: '🔒', title: 'Access Denied', category: 'auth',
      message: 'You don\'t have access. Please check your subscription.',
      retryable: false },
    500: { icon: '⚠️', title: 'Server Error', category: 'server',
      message: 'The AI service encountered an error. Please try again.',
      retryable: true, retryAfterMs: 3000 },
    502: { icon: '🌐', title: 'Service Unavailable', category: 'server',
      message: 'The AI service is temporarily unavailable.',
      retryable: true, retryAfterMs: 5000 },
    503: { icon: '🔥', title: 'Service Overloaded', category: 'server',
      message: 'The AI service is overloaded. Please try again in a minute.',
      retryable: true, retryAfterMs: 10000 },
  };

  var FALLBACK_ERROR = {
    icon: '⚠️', title: 'Something Went Wrong', category: 'unknown',
    message: 'An unexpected error occurred. Please try again.',
    retryable: true, retryAfterMs: 3000
  };

  // ─── Error Classification ───

  /** Classify any error into a display-friendly object */
  function classifyError(error) {
    if (!error) return FALLBACK_ERROR;

    // Structured WS error (has code from server)
    if (error.code && WS_ERROR_MAP[error.code]) {
      var mapped = WS_ERROR_MAP[error.code];
      // Use server hint if available, otherwise use our default message
      return Object.assign({}, mapped, {
        hint: error.hint || mapped.message,
        serverMessage: error.error,
        retryAfterMs: error.retryAfterMs || mapped.retryAfterMs,
      });
    }

    // HTTP status error
    if (error.status && HTTP_ERROR_MAP[error.status]) {
      return HTTP_ERROR_MAP[error.status];
    }

    // Network/fetch errors
    if (error instanceof TypeError && error.message && error.message.indexOf('fetch') !== -1) {
      return {
        icon: '📡', title: 'Connection Error', category: 'network',
        message: 'Unable to reach the server. Check your internet connection.',
        retryable: true, retryAfterMs: 3000
      };
    }

    // Abort/timeout
    if (error.name === 'AbortError' || (error.message && error.message.indexOf('timeout') !== -1)) {
      return {
        icon: '⏱️', title: 'Request Timeout', category: 'timeout',
        message: 'The request took too long. Please try a shorter message.',
        retryable: true, retryAfterMs: 1000
      };
    }

    // String error from WS dispatcher
    if (typeof error === 'string') {
      if (error.indexOf('timed out') !== -1 || error.indexOf('Timeout') !== -1) {
        return WS_ERROR_MAP.E201;
      }
      if (error.indexOf('Reconnecting') !== -1) {
        return WS_ERROR_MAP.E101;
      }
      if (error.indexOf('Connection failed') !== -1 || error.indexOf('Connection lost') !== -1) {
        return WS_ERROR_MAP.E100;
      }
      return Object.assign({}, FALLBACK_ERROR, { message: error });
    }

    return FALLBACK_ERROR;
  }

  // ─── Error UI Rendering ───

  function createErrorElement(errorInfo, options) {
    options = options || {};
    var el = document.createElement('div');
    el.className = 'chat-error cfx-007';
    el.setAttribute('role', 'alert');
    el.setAttribute('data-category', errorInfo.category || 'unknown');

    // Styled inline for portability (no external CSS dependency)
    el.style.cssText =
      'background:#1e1215;border:1px solid #5c2130;border-radius:12px;padding:14px 18px;' +
      'margin:8px 0;color:#f87171;font-size:14px;animation:fadeInUp 0.3s ease-out;';

    var html = '';

    // Icon + title
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">';
    html += '<span style="font-size:18px;">' + (errorInfo.icon || '⚠️') + '</span>';
    html += '<strong style="font-size:14px;">' + escapeHtml(errorInfo.title || 'Error') + '</strong>';
    if (errorInfo.category) {
      html += '<span style="font-size:11px;color:#6b7280;margin-left:auto;font-family:monospace;">' +
        escapeHtml(errorInfo.category.toUpperCase()) + '</span>';
    }
    html += '</div>';

    // Message
    html += '<div style="color:#fca5a5;margin-bottom:8px;line-height:1.5;">' +
      escapeHtml(errorInfo.message || errorInfo.hint || 'Something went wrong.') + '</div>';

    // Server hint (if different from message)
    if (errorInfo.hint && errorInfo.hint !== errorInfo.message) {
      html += '<div style="color:#9ca3af;font-size:12px;margin-bottom:8px;">💡 ' +
        escapeHtml(errorInfo.hint) + '</div>';
    }

    // Action buttons
    html += '<div style="display:flex;gap:8px;flex-wrap:wrap;">';

    if (errorInfo.retryable) {
      var retryDelay = errorInfo.retryAfterMs || 3000;
      var retryLabel = retryDelay > 0 ? 'Retry in ' + Math.ceil(retryDelay / 1000) + 's' : 'Try Again';
      html += '<button class="chat-error-retry" data-delay="' + retryDelay + '" style="' +
        'padding:6px 16px;background:#7f1d1d;color:#fca5a5;border:1px solid #991b1b;' +
        'border-radius:6px;cursor:pointer;font-size:13px;transition:all 0.2s;' +
        '">' + retryLabel + '</button>';
    }

    // Dismiss button
    html += '<button class="chat-error-dismiss" style="' +
      'padding:6px 12px;background:transparent;color:#6b7280;border:1px solid #374151;' +
      'border-radius:6px;cursor:pointer;font-size:12px;"' +
      '>Dismiss</button>';

    html += '</div>';

    el.innerHTML = html;
    return el;
  }

  /** Handle a chat error: classify, render, wire retry/dismiss */
  function handleChatError(error, containerEl, retryFn) {
    var info = classifyError(error);
    var el = createErrorElement(info);

    if (containerEl) {
      containerEl.appendChild(el);
      containerEl.scrollTop = containerEl.scrollHeight;
    }

    // Wire retry button with countdown
    if (info.retryable && retryFn) {
      var retryBtn = el.querySelector('.chat-error-retry');
      if (retryBtn) {
        var delay = parseInt(retryBtn.getAttribute('data-delay'), 10) || 3000;

        if (delay > 0) {
          // Countdown timer
          var remaining = Math.ceil(delay / 1000);
          retryBtn.disabled = true;
          retryBtn.style.opacity = '0.6';
          var countdownInterval = setInterval(function () {
            remaining--;
            if (remaining <= 0) {
              clearInterval(countdownInterval);
              retryBtn.disabled = false;
              retryBtn.style.opacity = '1';
              retryBtn.textContent = 'Try Again';
            } else {
              retryBtn.textContent = 'Retry in ' + remaining + 's';
            }
          }, 1000);
        }

        retryBtn.addEventListener('click', function () {
          if (retryBtn.disabled) return;
          if (el.parentNode) el.parentNode.removeChild(el);
          retryFn();
        });
      }
    }

    // Wire dismiss button
    var dismissBtn = el.querySelector('.chat-error-dismiss');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', function () {
        el.style.opacity = '0';
        el.style.transform = 'translateY(-10px)';
        setTimeout(function () {
          if (el.parentNode) el.parentNode.removeChild(el);
        }, 200);
      });
    }

    // Log for debugging (structured)
    console.error('[ChatError]', info.category + '/' + info.title, {
      code: error && error.code,
      message: info.message,
      retryable: info.retryable,
      raw: error,
    });

    return info;
  }

  // ─── Utility ───

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }

  // Inject animation keyframe
  if (!document.getElementById('cfx007-anim')) {
    var style = document.createElement('style');
    style.id = 'cfx007-anim';
    style.textContent = '@keyframes fadeInUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}';
    document.head.appendChild(style);
  }

  // ─── Export ───
  ns.ChatErrorHandler = {
    handleError: handleChatError,
    classifyError: classifyError,
    createErrorElement: createErrorElement,
    WS_ERROR_MAP: WS_ERROR_MAP,
    HTTP_ERROR_MAP: HTTP_ERROR_MAP,
  };
})();
