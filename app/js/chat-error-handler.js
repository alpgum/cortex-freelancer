/**
 * CF-094 — Add chat error handling for API failures
 * User-friendly error messages for Anthropic API issues
 */
(function () {
  const ns = (window.CortexFreelancer = window.CortexFreelancer || {});

  const ERROR_MESSAGES = {
    429: {
      title: 'Rate Limited',
      message: 'Too many requests. Please wait a moment and try again.',
      retryable: true,
      retryAfterMs: 5000
    },
    401: {
      title: 'Authentication Error',
      message: 'Chat service authentication failed. Please try refreshing the page.',
      retryable: false
    },
    403: {
      title: 'Access Denied',
      message: 'You don\'t have access to the chat service. Please check your subscription.',
      retryable: false
    },
    500: {
      title: 'Server Error',
      message: 'The AI service encountered an error. Please try again shortly.',
      retryable: true,
      retryAfterMs: 3000
    },
    502: {
      title: 'Service Unavailable',
      message: 'The AI service is temporarily unavailable. Please try again in a few seconds.',
      retryable: true,
      retryAfterMs: 5000
    },
    503: {
      title: 'Service Overloaded',
      message: 'The AI service is currently overloaded. Please try again in a minute.',
      retryable: true,
      retryAfterMs: 10000
    },
    network: {
      title: 'Connection Error',
      message: 'Unable to reach the server. Please check your internet connection.',
      retryable: true,
      retryAfterMs: 3000
    },
    timeout: {
      title: 'Request Timeout',
      message: 'The request took too long. Please try a shorter message.',
      retryable: true,
      retryAfterMs: 1000
    },
    unknown: {
      title: 'Something Went Wrong',
      message: 'An unexpected error occurred. Please try again.',
      retryable: true,
      retryAfterMs: 2000
    }
  };

  function classifyError(error) {
    if (error && error.status) {
      return ERROR_MESSAGES[error.status] || ERROR_MESSAGES.unknown;
    }
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return ERROR_MESSAGES.network;
    }
    if (error && error.name === 'AbortError') {
      return ERROR_MESSAGES.timeout;
    }
    return ERROR_MESSAGES.unknown;
  }

  function createErrorElement(errorInfo) {
    var el = document.createElement('div');
    el.className = 'chat-error';
    el.style.cssText =
      'background:#1e1215;border:1px solid #5c2130;border-radius:8px;padding:12px 16px;' +
      'margin:8px 0;color:#f87171;font-size:14px;';

    var html = '<strong>' + errorInfo.title + '</strong><br>' +
      '<span style="color:#fca5a5;">' + errorInfo.message + '</span>';

    if (errorInfo.retryable) {
      html += '<br><button class="chat-error-retry" style="margin-top:8px;padding:4px 12px;' +
        'background:#7f1d1d;color:#fca5a5;border:1px solid #991b1b;border-radius:4px;' +
        'cursor:pointer;font-size:13px;">Try Again</button>';
    }

    el.innerHTML = html;
    return el;
  }

  function handleChatError(error, containerEl, retryFn) {
    var info = classifyError(error);
    var el = createErrorElement(info);

    if (containerEl) {
      containerEl.appendChild(el);
      containerEl.scrollTop = containerEl.scrollHeight;
    }

    if (info.retryable && retryFn) {
      var btn = el.querySelector('.chat-error-retry');
      if (btn) {
        btn.addEventListener('click', function () {
          el.parentNode.removeChild(el);
          if (info.retryAfterMs) {
            setTimeout(retryFn, info.retryAfterMs);
          } else {
            retryFn();
          }
        });
      }
    }

    console.error('[ChatError]', info.title, error);
    return info;
  }

  ns.ChatErrorHandler = {
    handleError: handleChatError,
    classifyError: classifyError,
    createErrorElement: createErrorElement,
    ERROR_MESSAGES: ERROR_MESSAGES
  };
})();
