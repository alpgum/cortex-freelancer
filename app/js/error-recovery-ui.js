/**
 * CFX-034: Error Recovery UI (Retry + Help)
 *
 * Goal:
 *  - When a transport fails, give the user clear actions (Retry, Switch mode, Copy debug)
 *    instead of dead ends.
 *
 * Design constraints:
 *  - Non-blocking (does not prevent background retries)
 *  - Mobile friendly (bottom sheet)
 *  - Accessible (role/status text, focus-visible)
 *
 * Integration patterns:
 *  - Invoke directly: CortexErrorRecoveryUI.show({ ... })
 *  - Invoke from structured errors (CFX-007): CortexErrorRecoveryUI.showFromError(err, { retryFn })
 *  - Optional: bind to CortexTransport / CortexWsReconnect events
 */
(function () {
  'use strict';

  var rootEl = null;
  var toastEl = null;

  var lastContext = null;

  function ensureDom() {
    if (rootEl) return;

    rootEl = document.createElement('div');
    rootEl.className = 'cfx-rec-root';
    rootEl.id = 'cfx-error-recovery-root';
    rootEl.setAttribute('data-open', '0');

    rootEl.innerHTML =
      '<div class="cfx-rec-card" role="region" aria-label="Connection recovery" aria-live="polite">' +
        '<div class="cfx-rec-top">' +
          '<div class="cfx-rec-icon" data-tone="warn" aria-hidden="true">⟲</div>' +
          '<div class="cfx-rec-head">' +
            '<div class="cfx-rec-title" id="cfx-rec-title">Connection issue</div>' +
            '<div class="cfx-rec-subtitle" id="cfx-rec-subtitle">We’ll keep retrying in the background. You can also take action.</div>' +
            '<div class="cfx-rec-meta" id="cfx-rec-meta"></div>' +
          '</div>' +
          '<button type="button" class="cfx-rec-close" aria-label="Dismiss recovery panel" title="Dismiss">×</button>' +
        '</div>' +
        '<div class="cfx-rec-actions" id="cfx-rec-actions"></div>' +
      '</div>';

    toastEl = document.createElement('div');
    toastEl.className = 'cfx-rec-toast';
    toastEl.setAttribute('data-open', '0');
    toastEl.id = 'cfx-rec-toast';

    // Close
    var closeBtn = rootEl.querySelector('.cfx-rec-close');
    if (closeBtn) closeBtn.addEventListener('click', hide);

    // Insert
    var mount = function () {
      document.body.appendChild(rootEl);
      document.body.appendChild(toastEl);
    };

    if (document.body) mount();
    else document.addEventListener('DOMContentLoaded', mount);
  }

  function nowIso() {
    try { return new Date().toISOString(); } catch (e) { return String(Date.now()); }
  }

  function safeJson(obj) {
    try { return JSON.stringify(obj, null, 2); } catch (e) { return String(obj); }
  }

  function getConnectionMode() {
    try {
      if (window.CortexChatDispatcher && typeof window.CortexChatDispatcher.getConnectionMode === 'function') {
        return window.CortexChatDispatcher.getConnectionMode();
      }
      if (window.CortexTransport && typeof window.CortexTransport.getStatus === 'function') {
        var st = window.CortexTransport.getStatus();
        return st && st.transport ? st.transport : null;
      }
    } catch (e) {}
    return null;
  }

  function getTransportStatus() {
    // Best-effort diagnostics aggregation
    var out = {
      mode: null,
      webrtc: null,
      websocket: null,
      transportManager: null,
      userAgent: null,
      location: null,
    };

    out.mode = getConnectionMode();

    try { out.userAgent = navigator.userAgent; } catch (e) {}
    try { out.location = location && location.href; } catch (e) {}

    try {
      if (window.CortexChatDispatcher && typeof window.CortexChatDispatcher.getConnectionStats === 'function') {
        out.webrtc = window.CortexChatDispatcher.getConnectionStats().webrtc;
        out.websocket = window.CortexChatDispatcher.getConnectionStats().websocket;
      }
    } catch (e) {}

    try {
      if (window.CortexWsReconnect) {
        out.websocket = out.websocket || {};
        out.websocket.state = window.CortexWsReconnect.getState ? window.CortexWsReconnect.getState() : out.websocket.state;
        out.websocket.queueLength = window.CortexWsReconnect.getQueueLength ? window.CortexWsReconnect.getQueueLength() : undefined;
      }
    } catch (e) {}

    try {
      if (window.CortexTransport && typeof window.CortexTransport.getStatus === 'function') {
        out.transportManager = window.CortexTransport.getStatus();
      }
    } catch (e) {}

    return out;
  }

  function guessErrorCode(err) {
    if (!err) return null;
    return err.code || err._errorCode || err.errorCode || null;
  }

  function guessErrorMessage(err) {
    if (!err) return null;
    if (typeof err === 'string') return err;
    return err.error || err.message || null;
  }

  function defaultRetrySame(ctx) {
    // Retry: prefer provided retryFn (e.g., resend last user message)
    if (ctx && typeof ctx.retryFn === 'function') return ctx.retryFn();

    // Transport-manager path: reconnect same transport if known
    try {
      if (window.CortexTransport && typeof window.CortexTransport.getStatus === 'function' && typeof window.CortexTransport.connect === 'function') {
        var st = window.CortexTransport.getStatus();
        if (st && st.transport) return window.CortexTransport.connect({ transport: st.transport });
        return window.CortexTransport.connect();
      }
    } catch (e) {}

    // Dispatcher path
    try {
      if (window.CortexChatDispatcher && typeof window.CortexChatDispatcher.reconnect === 'function') {
        return window.CortexChatDispatcher.reconnect();
      }
    } catch (e) {}

    return null;
  }

  function defaultTryNextTransport(ctx) {
    // Force fallback / switch transport
    // 1) Transport-manager supports skip list.
    try {
      if (window.CortexTransport && typeof window.CortexTransport.getStatus === 'function' && typeof window.CortexTransport.connect === 'function') {
        var st = window.CortexTransport.getStatus();
        var cur = st && st.transport;
        return window.CortexTransport.connect({ skip: cur ? [cur] : [] });
      }
    } catch (e) {}

    // 2) WebRTC dispatcher: disable WebRTC to force WS/SSE chain.
    try {
      if (window.CortexChatDispatcher && typeof window.CortexChatDispatcher.getConnectionMode === 'function') {
        var mode = window.CortexChatDispatcher.getConnectionMode();
        if (mode === 'webrtc' && typeof window.CortexChatDispatcher.enableWebRTC === 'function') {
          window.CortexChatDispatcher.enableWebRTC(false);
          if (typeof window.CortexChatDispatcher.reconnect === 'function') window.CortexChatDispatcher.reconnect();
          return;
        }
      }
    } catch (e) {}

    // 3) As a fallback, just reconnect (may still pick same transport).
    try {
      if (window.CortexChatDispatcher && typeof window.CortexChatDispatcher.reconnect === 'function') {
        return window.CortexChatDispatcher.reconnect();
      }
    } catch (e) {}

    return null;
  }

  function copyText(text) {
    // Prefer existing clipboard helper if present
    try {
      if (window.ClipboardFix && typeof window.ClipboardFix.copy === 'function') {
        return window.ClipboardFix.copy(text);
      }
    } catch (e) {}

    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }

    // execCommand fallback
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (ok) resolve();
        else reject(new Error('copy failed'));
      } catch (e) {
        reject(e);
      }
    });
  }

  function showToast(msg) {
    ensureDom();
    toastEl.textContent = msg;
    toastEl.setAttribute('data-open', '1');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () {
      toastEl.setAttribute('data-open', '0');
    }, 1400);
  }

  function setMeta(metaItems) {
    var metaEl = rootEl.querySelector('#cfx-rec-meta');
    if (!metaEl) return;
    metaEl.innerHTML = '';
    (metaItems || []).forEach(function (it) {
      var span = document.createElement('span');
      span.className = 'cfx-rec-pill';
      span.textContent = it;
      metaEl.appendChild(span);
    });
  }

  function setTone(tone) {
    var iconEl = rootEl.querySelector('.cfx-rec-icon');
    if (!iconEl) return;
    iconEl.setAttribute('data-tone', tone || 'warn');
    iconEl.textContent = tone === 'ok' ? '✓' : (tone === 'danger' ? '!' : '⟲');
  }

  function show(opts) {
    ensureDom();
    opts = opts || {};

    lastContext = opts;

    var titleEl = rootEl.querySelector('#cfx-rec-title');
    var subtitleEl = rootEl.querySelector('#cfx-rec-subtitle');
    var actionsEl = rootEl.querySelector('#cfx-rec-actions');

    if (titleEl) titleEl.textContent = opts.title || 'Connection issue';
    if (subtitleEl) subtitleEl.textContent = opts.subtitle || 'We’ll keep retrying in the background. You can also take action.';

    setTone(opts.tone || 'warn');

    var meta = [];
    if (opts.errorCode) meta.push('code: ' + opts.errorCode);
    if (opts.mode) meta.push('mode: ' + opts.mode);
    if (opts.timestamp) meta.push('time: ' + opts.timestamp);
    setMeta(meta);

    // Actions
    if (actionsEl) {
      actionsEl.innerHTML = '';

      var retryBtn = document.createElement('button');
      retryBtn.type = 'button';
      retryBtn.className = 'cfx-rec-btn primary';
      retryBtn.textContent = 'Retry';
      retryBtn.addEventListener('click', function () {
        try {
          if (opts.onRetry) opts.onRetry();
          else defaultRetrySame(opts);
          showToast('Retry triggered');
        } catch (e) {
          console.error('[CFX-034] Retry action failed', e);
          showToast('Retry failed');
        }
      });
      actionsEl.appendChild(retryBtn);

      if (opts.showTryNext !== false) {
        var nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'cfx-rec-btn';
        nextBtn.textContent = 'Try next transport';
        nextBtn.addEventListener('click', function () {
          try {
            if (opts.onTryNext) opts.onTryNext();
            else defaultTryNextTransport(opts);
            showToast('Switching transport…');
          } catch (e) {
            console.error('[CFX-034] Try-next action failed', e);
            showToast('Switch failed');
          }
        });
        actionsEl.appendChild(nextBtn);
      }

      var copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'cfx-rec-btn';
      copyBtn.textContent = 'Copy diagnostics';
      copyBtn.addEventListener('click', function () {
        var text = opts.diagnosticsText || buildDiagnosticsText(opts);
        copyBtn.disabled = true;
        copyText(text)
          .then(function () { showToast('Diagnostics copied'); })
          .catch(function () { showToast('Copy failed'); })
          .finally(function () { copyBtn.disabled = false; });
      });
      actionsEl.appendChild(copyBtn);

      if (opts.statusUrl) {
        var a = document.createElement('a');
        a.className = 'cfx-rec-link';
        a.href = opts.statusUrl;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = 'Open status page';
        actionsEl.appendChild(a);
      }
    }

    rootEl.setAttribute('data-open', '1');

    // Gentle focus: focus the Retry button for keyboard users.
    if (opts.focus !== false) {
      setTimeout(function () {
        try {
          var btn = rootEl.querySelector('.cfx-rec-btn.primary');
          if (btn) btn.focus();
        } catch (e) {}
      }, 0);
    }
  }

  function hide() {
    if (!rootEl) return;
    rootEl.setAttribute('data-open', '0');
  }

  function buildDiagnosticsText(ctx) {
    ctx = ctx || {};

    var status = getTransportStatus();

    var diag = {
      spec: 'CFX-034',
      timestamp: ctx.timestamp || nowIso(),
      errorCode: ctx.errorCode || null,
      errorMessage: ctx.errorMessage || null,
      mode: ctx.mode || status.mode,
      statusUrl: ctx.statusUrl || null,
      transportStatus: status,
    };

    // Avoid huge dumps where possible
    if (diag.transportStatus && diag.transportStatus.transportManager && diag.transportStatus.transportManager.stats) {
      // stats may contain large objects; leave as-is but bounded by upstream
    }

    return safeJson(diag);
  }

  function showFromError(err, ctx) {
    ctx = ctx || {};

    var code = ctx.errorCode || guessErrorCode(err);
    var msg = ctx.errorMessage || guessErrorMessage(err);

    var mode = ctx.mode || getConnectionMode() || 'unknown';

    // If we can classify via CFX-007, use that title.
    var title = ctx.title || 'Connection issue';
    var subtitle = ctx.subtitle || (msg ? String(msg) : 'We’ll keep retrying in the background.');
    var tone = ctx.tone || 'warn';

    try {
      if (window.CortexFreelancer && window.CortexFreelancer.ChatErrorHandler && typeof window.CortexFreelancer.ChatErrorHandler.classifyError === 'function') {
        var info = window.CortexFreelancer.ChatErrorHandler.classifyError(err);
        if (info && info.title) title = info.title;
        if (info && info.message && !ctx.subtitle) subtitle = info.message;
        if (info && info.category === 'server') tone = 'warn';
        if (info && (info.category === 'connection' || info.category === 'network' || info.category === 'timeout')) tone = 'danger';
      }
    } catch (e) {}

    show({
      title: title,
      subtitle: subtitle,
      tone: tone,
      errorCode: code,
      errorMessage: msg,
      timestamp: ctx.timestamp || nowIso(),
      mode: mode,
      retryFn: ctx.retryFn,
      onRetry: ctx.onRetry,
      onTryNext: ctx.onTryNext,
      showTryNext: ctx.showTryNext,
      statusUrl: ctx.statusUrl || '/status',
    });
  }

  function bindToTransport() {
    // Optional convenience: show on transport-manager errors
    try {
      if (window.CortexTransport && typeof window.CortexTransport.on === 'function') {
        window.CortexTransport.on('error', function (data) {
          showFromError({ code: 'E100', error: (data && data.error) || 'Transport error' }, { source: 'CortexTransport' });
        });
      }
    } catch (e) {}

    // Optional: show on WS reconnect failures
    try {
      if (window.CortexWsReconnect && typeof window.CortexWsReconnect.on === 'function') {
        window.CortexWsReconnect.on('failed', function (info) {
          showFromError({ code: 'E100', error: (info && info.message) || 'Connection failed' }, { source: 'CortexWsReconnect' });
        });
      }
    } catch (e) {}
  }

  // Export
  window.CortexErrorRecoveryUI = {
    show: show,
    hide: hide,
    showFromError: showFromError,
    buildDiagnosticsText: buildDiagnosticsText,
    getTransportStatus: getTransportStatus,
    bindToTransport: bindToTransport,
  };

})();
