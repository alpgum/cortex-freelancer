/**
 * CF-288: Error States
 * Error UI with recovery actions: retry button, go-back, report-issue.
 *
 * @namespace window.CortexFreelancer.ErrorStates
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var STYLE_ID = 'cortex-error-states-styles';

  var CSS = '\n\
.ct-error{display:flex;flex-direction:column;align-items:center;text-align:center;padding:3rem 1.5rem;max-width:440px;margin:0 auto}\
.ct-error__icon{font-size:3rem;margin-bottom:1rem;line-height:1}\
.ct-error__title{font-size:1.125rem;font-weight:600;color:var(--ct-colors-neutral-900,#111827);margin:0 0 0.5rem}\
.ct-error__desc{font-size:0.875rem;color:var(--ct-colors-neutral-500,#6b7280);margin:0 0 1.25rem;line-height:1.5}\
.ct-error__actions{display:flex;gap:0.5rem;flex-wrap:wrap;justify-content:center}\
.ct-error__btn{display:inline-flex;align-items:center;gap:0.375rem;padding:0.5rem 1rem;border-radius:var(--ct-radius-md,0.5rem);font-size:0.875rem;font-weight:600;cursor:pointer;font-family:inherit;transition:all 0.15s;border:none}\
.ct-error__btn--primary{background:var(--ct-colors-primary-600,#4f46e5);color:#fff}\
.ct-error__btn--primary:hover{background:var(--ct-colors-primary-700,#4338ca)}\
.ct-error__btn--secondary{background:var(--ct-colors-neutral-100,#f3f4f6);color:var(--ct-colors-neutral-700,#374151);border:1px solid var(--ct-colors-neutral-300,#d1d5db)}\
.ct-error__btn--secondary:hover{background:var(--ct-colors-neutral-200,#e5e7eb)}\
.ct-error__code{margin-top:1rem;font-size:0.75rem;color:var(--ct-colors-neutral-400,#9ca3af);font-family:monospace}\
';

  var TYPES = {
    network: {
      icon: '\uD83D\uDCE1',
      title: 'Connection lost',
      description: 'We couldn\'t reach the server. Check your internet connection and try again.',
      actions: ['retry', 'go-back']
    },
    'not-found': {
      icon: '\uD83D\uDD0D',
      title: 'Page not found',
      description: 'The page you\'re looking for doesn\'t exist or has been moved.',
      actions: ['go-home', 'go-back']
    },
    'server-error': {
      icon: '\u26A0\uFE0F',
      title: 'Something went wrong',
      description: 'Our server hit an unexpected error. We\'ve been notified and are looking into it.',
      actions: ['retry', 'report-issue']
    },
    'auth-error': {
      icon: '\uD83D\uDD12',
      title: 'Authentication required',
      description: 'Your session has expired or you don\'t have permission to access this resource.',
      actions: ['login', 'go-back']
    },
    'rate-limit': {
      icon: '\u23F1\uFE0F',
      title: 'Too many requests',
      description: 'You\'ve hit the rate limit. Please wait a moment before trying again.',
      actions: ['retry']
    },
    'ai-error': {
      icon: '\uD83E\uDD16',
      title: 'AI unavailable',
      description: 'The AI service is temporarily unavailable. Your request has been saved.',
      actions: ['retry', 'report-issue']
    },
    'payment-error': {
      icon: '\uD83D\uDCB3',
      title: 'Payment failed',
      description: 'We couldn\'t process your payment. Please check your card details and try again.',
      actions: ['retry', 'go-back']
    },
    timeout: {
      icon: '\u231B',
      title: 'Request timed out',
      description: 'The request took too long to complete. Please try again.',
      actions: ['retry', 'go-back']
    },
    generic: {
      icon: '\u274C',
      title: 'An error occurred',
      description: 'Something unexpected happened. Please try again or contact support.',
      actions: ['retry', 'report-issue']
    }
  };

  var ACTION_MAP = {
    retry: { label: 'Try Again', variant: 'primary', handler: 'retry' },
    'go-back': { label: 'Go Back', variant: 'secondary', handler: 'back' },
    'go-home': { label: 'Go Home', variant: 'primary', handler: 'home' },
    login: { label: 'Sign In', variant: 'primary', handler: 'login' },
    'report-issue': { label: 'Report Issue', variant: 'secondary', handler: 'report' }
  };

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function esc(str) {
    var el = document.createElement('span');
    el.textContent = str;
    return el.innerHTML;
  }

  function handleAction(action) {
    switch (action) {
      case 'retry': window.location.reload(); break;
      case 'back': window.history.back(); break;
      case 'home': window.location.href = '/'; break;
      case 'login': window.location.href = '/app/login.html'; break;
      case 'report': window.location.href = '/support.html'; break;
    }
  }

  function renderError(type, container, opts) {
    opts = opts || {};
    var config = TYPES[type] || TYPES.generic;
    var title = opts.title || config.title;
    var desc = opts.description || config.description;

    var html = '<div class="ct-error">';
    html += '<div class="ct-error__icon">' + config.icon + '</div>';
    html += '<h3 class="ct-error__title">' + esc(title) + '</h3>';
    html += '<p class="ct-error__desc">' + esc(desc) + '</p>';
    html += '<div class="ct-error__actions">';

    var actions = opts.actions || config.actions;
    actions.forEach(function (actionKey) {
      var a = ACTION_MAP[actionKey];
      if (!a) return;
      if (opts.onRetry && actionKey === 'retry') {
        html += '<button class="ct-error__btn ct-error__btn--' + a.variant + '" data-error-action="custom-retry">' + a.label + '</button>';
      } else {
        html += '<button class="ct-error__btn ct-error__btn--' + a.variant + '" data-error-action="' + a.handler + '">' + a.label + '</button>';
      }
    });

    html += '</div>';
    if (opts.errorCode) {
      html += '<div class="ct-error__code">Error: ' + esc(opts.errorCode) + '</div>';
    }
    html += '</div>';

    if (container) {
      var el = typeof container === 'string' ? document.querySelector(container) : container;
      if (el) {
        el.innerHTML = html;
        el.querySelectorAll('[data-error-action]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var act = btn.getAttribute('data-error-action');
            if (act === 'custom-retry' && opts.onRetry) {
              opts.onRetry();
            } else {
              handleAction(act);
            }
          });
        });
      }
    }

    return html;
  }

  function renderErrorShowcase() {
    var html = '<div style="font-family:var(--ct-typography-font-family,sans-serif);padding:1.5rem">';
    html += '<h2 style="font-size:1.5rem;font-weight:700;margin-bottom:1.5rem">Error States</h2>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:1.5rem">';

    Object.keys(TYPES).forEach(function (type) {
      html += '<div style="border:1px solid var(--ct-colors-neutral-200,#e5e7eb);border-radius:var(--ct-radius-lg,0.75rem);overflow:hidden">';
      html += '<div style="padding:0.5rem 1rem;background:var(--ct-colors-semantic-error-light,#fee2e2);border-bottom:1px solid var(--ct-colors-neutral-200,#e5e7eb);font-size:0.75rem;font-weight:600;color:var(--ct-colors-semantic-error,#ef4444);text-transform:uppercase;letter-spacing:0.05em">' + type + '</div>';
      html += renderError(type);
      html += '</div>';
    });

    html += '</div></div>';
    return html;
  }

  // Delegate click handler
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-error-action]');
    if (btn && btn.getAttribute('data-error-action') !== 'custom-retry') {
      handleAction(btn.getAttribute('data-error-action'));
    }
  });

  injectStyles();

  window.CortexFreelancer.ErrorStates = {
    types: TYPES,
    renderError: renderError,
    renderErrorShowcase: renderErrorShowcase,
    handleAction: handleAction
  };
})();
