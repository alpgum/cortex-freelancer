/**
 * T02: Chat UI Manager
 * Renders messages, handles input, wires to dispatcher.
 * Supports real-time streaming via WebSocket/SSE/Chunked.
 *
 * CFX-037: Smooth streaming UI
 * - Throttle streaming DOM updates to animation frames
 * - Sticky scroll: auto-stick unless user scrolls up
 * - Optional typewriter effect for non-streaming (HTTP) fallback
 * - Respects prefers-reduced-motion
 *
 * CFX-040: Performance Metrics UI
 * - Capture: send start time, time-to-first-token (streaming), total time, transport
 * - Display unobtrusively per assistant message (small footer/meta line)
 * - Progressive enhancement: no core-flow impact if dispatcher APIs missing
 */
(function () {
  'use strict';

  var messagesEl, typingEl, inputEl, sendBtn, suggestionsEl, badgeEl, statusEl, cacheClearBtn, inputBarEl;
  // CFX-042: message cooldown + queue + quota feedback
  var chatRateLimiter = null;
  var rateIndicatorEl = null;
  var cancelBtnEl = null;
  var lastConnState = null;
  var lastConnInfo = null;

  // Active streaming message state
  var streamingMsgEl = null;
  var streamState = null;

  // Sticky scroll state
  var scrollState = {
    stickToBottom: true,
    thresholdPx: 32,
    scrollScheduled: false
  };

  // CFX-033: client-side response cache (best-effort)
  var responseCache = null;
  var responseCacheThreadId = null;

  function prefersReducedMotion() {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (_e) {
      return false;
    }
  }

  /* ── CFX-040: performance helpers ── */

  function nowMs() {
    try {
      if (window.performance && typeof window.performance.now === 'function') {
        return window.performance.now();
      }
    } catch (_e) {}
    return Date.now();
  }

  function clampMs(n) {
    n = Number(n);
    if (!isFinite(n) || n < 0) return 0;
    return n;
  }

  function formatDuration(ms) {
    ms = clampMs(ms);
    if (ms < 1000) return Math.round(ms) + 'ms';
    if (ms < 10000) return (ms / 1000).toFixed(2) + 's';
    return (ms / 1000).toFixed(1) + 's';
  }

  function safeTransportLabel(s) {
    s = String(s || '').trim();
    if (!s) return 'unknown';
    // Normalize common variants
    if (s === 'ws') return 'websocket';
    if (s === 'reconnecting') return 'websocket (reconnecting)';
    if (s === 'http1' || s === 'http2') return 'http';
    return s;
  }

  function buildPerfMetaText(perf) {
    if (!perf || !perf.startAt || !perf.endAt) return '';
    var parts = [];
    if (perf.transport) parts.push(safeTransportLabel(perf.transport));

    if (perf.ttftAt && perf.streaming) {
      parts.push('TTFT ' + formatDuration(perf.ttftAt - perf.startAt));
    }

    parts.push('total ' + formatDuration(perf.endAt - perf.startAt));
    return parts.join(' · ');
  }

  function ensureAiMessageStructure(msgEl) {
    if (!msgEl) return { contentEl: null, metaEl: null };

    var contentEl = null;
    var metaEl = null;

    try { contentEl = msgEl.querySelector('.chat-msg-content'); } catch (_e) { contentEl = null; }
    try { metaEl = msgEl.querySelector('.chat-msg-meta'); } catch (_e2) { metaEl = null; }

    // Create content wrapper and move existing nodes into it (keeps future .innerHTML writes scoped)
    if (!contentEl) {
      contentEl = document.createElement('div');
      contentEl.className = 'chat-msg-content';

      // Move existing children into content wrapper
      while (msgEl.firstChild) {
        contentEl.appendChild(msgEl.firstChild);
      }
      msgEl.appendChild(contentEl);
    }

    // Create meta footer
    if (!metaEl) {
      metaEl = document.createElement('div');
      metaEl.className = 'chat-msg-meta';
      metaEl.setAttribute('role', 'note');
      metaEl.setAttribute('aria-label', 'Response timing');
      msgEl.appendChild(metaEl);
    }

    return { contentEl: contentEl, metaEl: metaEl };
  }

  function setAiMessageHtml(msgEl, html) {
    var s = ensureAiMessageStructure(msgEl);
    if (!s.contentEl) return;
    try { s.contentEl.innerHTML = html; } catch (_e) {}
  }

  function setAiMessageMeta(msgEl, metaText) {
    var s = ensureAiMessageStructure(msgEl);
    if (!s.metaEl) return;
    var text = String(metaText || '').trim();
    try {
      s.metaEl.textContent = text;
      s.metaEl.style.display = text ? '' : 'none';
      if (text) s.metaEl.setAttribute('title', text);
      else s.metaEl.removeAttribute('title');
    } catch (_e) {}
  }

  /* ── CFX-038: mobile viewport + bottom UI offsets ──
   * - Sets --app-height to visualViewport height (px) for iOS keyboard reliability
   * - Sets --cfx-bottom-ui so fixed overlays (error recovery, connection indicator) don't cover the input bar
   */
  var mobileLayout = {
    rafId: 0,
    resizeObs: null
  };

  function setRootVar(name, value) {
    try { document.documentElement.style.setProperty(name, value); } catch (_e) {}
  }

  function updateAppHeightVar() {
    var h = window.innerHeight;
    try {
      if (window.visualViewport && typeof window.visualViewport.height === 'number') {
        h = window.visualViewport.height;
      }
    } catch (_e) {}
    if (h && h > 0) setRootVar('--app-height', Math.round(h) + 'px');
  }

  function updateBottomUiVar() {
    if (!inputBarEl) {
      try { inputBarEl = document.querySelector('.chat-input-bar'); } catch (_e) {}
    }
    if (!inputBarEl) return;

    var rect;
    try { rect = inputBarEl.getBoundingClientRect(); } catch (_e2) { rect = null; }
    if (!rect) return;

    // Add a small breathing room so overlays don't kiss the input bar
    var offset = Math.max(0, Math.ceil(rect.height) + 8);
    setRootVar('--cfx-bottom-ui', offset + 'px');
  }

  function scheduleMobileLayoutUpdate() {
    if (mobileLayout.rafId) return;
    mobileLayout.rafId = requestAnimationFrame(function () {
      mobileLayout.rafId = 0;
      updateAppHeightVar();
      updateBottomUiVar();
    });
  }

  function initMobileLayout() {
    // Run once ASAP
    scheduleMobileLayoutUpdate();

    // Keep in sync on rotation / resizes
    try { window.addEventListener('resize', scheduleMobileLayoutUpdate, { passive: true }); } catch (_e) {}
    try { window.addEventListener('orientationchange', scheduleMobileLayoutUpdate, { passive: true }); } catch (_e2) {}

    // visualViewport is the key for iOS keyboard behavior
    try {
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', scheduleMobileLayoutUpdate);
        window.visualViewport.addEventListener('scroll', scheduleMobileLayoutUpdate);
      }
    } catch (_e3) {}

    // Track input bar size changes (textarea auto-grow, safe-area changes)
    try {
      if (window.ResizeObserver) {
        mobileLayout.resizeObs = new ResizeObserver(function () {
          scheduleMobileLayoutUpdate();
        });
        if (inputBarEl) mobileLayout.resizeObs.observe(inputBarEl);
      }
    } catch (_e4) {}
  }

  /* ── Simple markdown ── */
  function md(text) {
    return String(text || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
      .replace(/\n/g, '<br>');
  }

  /* ── Sticky scroll ── */
  function isNearBottom() {
    if (!messagesEl) return true;
    var distance = messagesEl.scrollHeight - (messagesEl.scrollTop + messagesEl.clientHeight);
    return distance <= scrollState.thresholdPx;
  }

  function onMessagesScroll() {
    // User scroll input toggles stickiness
    scrollState.stickToBottom = isNearBottom();
  }

  function requestScrollToBottom(force) {
    if (!messagesEl) return;
    if (!force && !scrollState.stickToBottom) return;

    // Throttle scroll operations to animation frames
    if (scrollState.scrollScheduled) return;
    scrollState.scrollScheduled = true;
    requestAnimationFrame(function () {
      scrollState.scrollScheduled = false;
      messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  }

  /* ── Add message ── */
  function addMessage(role, content, opts) {
    opts = opts || {};
    var div = document.createElement('div');
    div.className = 'chat-msg ' + (role === 'user' ? 'user' : 'ai');

    if (role === 'user') {
      div.innerHTML = md(content);
    } else {
      // AI messages always get a stable structure so we can add a perf footer unobtrusively.
      ensureAiMessageStructure(div);
      setAiMessageHtml(div, md(content));
      setAiMessageMeta(div, opts.metaText || '');
    }

    messagesEl.appendChild(div);

    requestScrollToBottom(!!opts.forceScroll);
    return div;
  }

  // CFX-033: cached response rendering
  function addCachedAiMessage(content, opts) {
    opts = opts || {};
    var div = document.createElement('div');
    div.className = 'chat-msg ai cached';
    ensureAiMessageStructure(div);

    setAiMessageHtml(
      div,
      '<span style="display:inline-block;margin-right:8px;padding:2px 8px;border-radius:999px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);font-size:12px;vertical-align:middle">cached</span>' +
      md(content)
    );
    setAiMessageMeta(div, '');

    messagesEl.appendChild(div);
    requestScrollToBottom(!!opts.forceScroll);
    return div;
  }

  /* ── Streaming message helpers (CFX-037) ── */

  function stopActiveStream() {
    if (streamState && streamState.rafId) {
      try { cancelAnimationFrame(streamState.rafId); } catch (_e) {}
    }
    streamState = null;
    streamingMsgEl = null;
  }

  function startStreamingMessage() {
    // If something was left streaming, finalize it as plain text (best-effort)
    if (streamingMsgEl && streamState) {
      try {
        setAiMessageHtml(streamingMsgEl, md(streamState.fullText || ''));
        streamingMsgEl.classList.remove('streaming');
      } catch (_e) {}
      stopActiveStream();
    }

    var div = document.createElement('div');
    div.className = 'chat-msg ai streaming';

    var s = ensureAiMessageStructure(div);
    var contentEl = s.contentEl;

    // Streaming content: text + cursor (inside content wrapper)
    var textSpan = document.createElement('span');
    textSpan.className = 'stream-text';
    var textNode = document.createTextNode('');
    textSpan.appendChild(textNode);

    var cursor = document.createElement('span');
    cursor.className = 'stream-cursor';
    cursor.setAttribute('aria-hidden', 'true');

    // Ensure content wrapper is empty
    try { contentEl.innerHTML = ''; } catch (_e2) {}
    contentEl.appendChild(textSpan);
    contentEl.appendChild(cursor);

    // Meta footer stays hidden unless set
    setAiMessageMeta(div, '');

    messagesEl.appendChild(div);

    streamingMsgEl = div;
    streamState = {
      el: div,
      textNode: textNode,
      cursorEl: cursor,
      pending: [],
      fullText: '',
      rafId: 0,
      perf: null
    };

    requestScrollToBottom(true);
    return div;
  }

  function scheduleStreamFlush() {
    if (!streamState || streamState.rafId) return;

    streamState.rafId = requestAnimationFrame(function () {
      if (!streamState) return;
      streamState.rafId = 0;

      if (!streamState.pending.length) return;
      var chunk = streamState.pending.join('');
      streamState.pending.length = 0;

      // Minimal DOM churn: append to existing text node once per frame
      try {
        if (streamState.textNode && streamState.textNode.appendData) {
          streamState.textNode.appendData(chunk);
        } else if (streamState.textNode) {
          streamState.textNode.data += chunk;
        }
      } catch (_e) {
        // If something went wrong, fall back to resetting text content
        try { streamState.textNode.data = streamState.fullText; } catch (_e2) {}
      }

      requestScrollToBottom(false);
    });
  }

  function appendStreamingChunk(chunkText) {
    if (!streamState || !streamingMsgEl) return;
    if (typeof chunkText !== 'string' || !chunkText) return;

    streamState.fullText += chunkText;
    streamState.pending.push(chunkText);
    scheduleStreamFlush();
  }

  function setStreamingStatusText(text) {
    if (!streamState || !streamingMsgEl) return;
    streamState.fullText = String(text || '');
    streamState.pending.length = 0;
    try { streamState.textNode.data = streamState.fullText; } catch (_e) {}
    requestScrollToBottom(false);
  }

  function finalizeStreamingMessage(finalText, metaText) {
    if (streamingMsgEl) {
      // Flush any pending chunks into fullText (best-effort)
      if (streamState && streamState.pending && streamState.pending.length) {
        streamState.fullText += streamState.pending.join('');
        streamState.pending.length = 0;
      }

      // Use provided finalText when available (source of truth)
      var text = (typeof finalText === 'string') ? finalText : (streamState ? streamState.fullText : '');

      try {
        setAiMessageHtml(streamingMsgEl, md(text));
        streamingMsgEl.classList.remove('streaming');
      } catch (_e) {
        // If markdown render fails, fall back to plain text
        try { ensureAiMessageStructure(streamingMsgEl).contentEl.textContent = text; } catch (_e2) {}
        try { streamingMsgEl.classList.remove('streaming'); } catch (_e3) {}
      }

      // Add perf footer (if any) AFTER content render (so it survives HTML writes)
      if (metaText) setAiMessageMeta(streamingMsgEl, metaText);

      stopActiveStream();
    }
    requestScrollToBottom(false);
  }

  /* ── Typing indicator ── */
  function setLoading(show) {
    if (typingEl) typingEl.className = 'chat-typing' + (show ? ' active' : '');
    if (show) requestScrollToBottom(false);
  }

  /* ── Connection status (CFX-004 + CFX-007: rich state display with degradation) ── */
  function updateConnectionStatus(state, info) {
    if (!statusEl) return;
    info = info || {};
    lastConnState = state;
    lastConnInfo = info;
    switch (state) {
      case 'connected':
        statusEl.textContent = '● Live';
        statusEl.className = 'chat-status connected';
        statusEl.title = 'Connected via WebSocket';
        statusEl.style.cursor = '';
        statusEl.onclick = null;
        // CFX-007: Update input placeholder
        if (inputEl && window.CortexConnectionStatus) {
          inputEl.placeholder = window.CortexConnectionStatus.getInputPlaceholder();
        }
        break;
      case 'connecting':
        statusEl.textContent = '◌ Connecting...';
        statusEl.className = 'chat-status connecting';
        statusEl.title = 'Establishing connection';
        break;
      case 'reconnecting':
        var attempt = info.retryAttempts || (info.attempt || '?');
        statusEl.textContent = '↻ Reconnecting (' + attempt + ')...';
        statusEl.className = 'chat-status reconnecting';
        statusEl.title = 'Lost connection, retrying...';
        // CFX-007: Update input placeholder for offline composition
        if (inputEl && window.CortexConnectionStatus) {
          inputEl.placeholder = window.CortexConnectionStatus.getInputPlaceholder();
        }
        break;
      case 'failed':
        statusEl.textContent = '✕ Offline';
        statusEl.className = 'chat-status failed';
        statusEl.title = 'Connection failed. Click to retry.';
        statusEl.style.cursor = 'pointer';
        statusEl.onclick = function () {
          if (window.CortexChatDispatcher && window.CortexChatDispatcher.reconnect) {
            window.CortexChatDispatcher.reconnect();
            statusEl.onclick = null;
            statusEl.style.cursor = '';
          }
        };
        // CFX-007: Enable offline composition
        if (inputEl && window.CortexConnectionStatus) {
          inputEl.placeholder = window.CortexConnectionStatus.getInputPlaceholder();
        }
        break;
      case 'degraded':
        statusEl.textContent = '◐ Unstable';
        statusEl.className = 'chat-status degraded';
        statusEl.title = 'Connection is unstable. Messages may be slow.';
        break;
      case 'disconnected':
      default:
        statusEl.textContent = '○ Offline';
        statusEl.className = 'chat-status disconnected';
        statusEl.title = 'Not connected';
        break;
    }

    // Show transport-level queued message count if any
    if (window.CortexWsReconnect) {
      var qLen = window.CortexWsReconnect.getQueueLength();
      if (qLen > 0 && state !== 'connected') {
        statusEl.textContent += ' · ' + qLen + ' queued';
      }
    }

    // Show client-side request queue count (CFX-036)
    try {
      if (window.CortexRequestQueue && window.CortexRequestQueue.getState) {
        var qs = window.CortexRequestQueue.getState();
        if (qs && qs.queued > 0) {
          statusEl.textContent += ' · ' + qs.queued + ' pending';
        }
      }
    } catch (e) { /* best-effort */ }
  }

  /* ── Suggestions ── */
  function addSuggestions(chips) {
    if (!suggestionsEl) return;
    suggestionsEl.innerHTML = '';
    if (!chips || !chips.length) return;
    chips.forEach(function (label) {
      var btn = document.createElement('button');
      btn.className = 'chat-chip';
      btn.textContent = label;
      btn.onclick = function () { handleSend(label); };
      suggestionsEl.appendChild(btn);
    });
  }

  /* ── Scroll (public API) ── */
  function scrollToBottom() {
    requestScrollToBottom(true);
  }

  /* ── Auto-resize textarea ──
   * Mobile perf: avoid synchronous layout thrash on every keystroke.
   */
  var _autoResizeRaf = 0;
  function autoResize() {
    if (!inputEl) return;
    if (_autoResizeRaf) return;

    _autoResizeRaf = requestAnimationFrame(function () {
      _autoResizeRaf = 0;
      try {
        inputEl.style.height = 'auto';
        var h = Math.min(inputEl.scrollHeight || 0, 120);
        if (h > 0) inputEl.style.height = h + 'px';
      } catch (_e) {}

      // Keep fixed overlays from overlapping the input bar as it grows
      scheduleMobileLayoutUpdate();
    });
  }

  /* ── Update badge ── */
  function updateBadge() {
    if (!badgeEl || !window.CortexChatLimiter) return;
    var rem = window.CortexChatLimiter.remaining();
    badgeEl.textContent = rem + ' left';
    badgeEl.style.display = rem < 999 ? '' : 'none';
  }

  /* ── Typewriter (HTTP fallback) ── */
  function addAiMessageTypewriter(text, opts) {
    opts = opts || {};
    var enable = !!opts.enable;

    if (!enable || prefersReducedMotion()) {
      addMessage('ai', text, { forceScroll: !!opts.forceScroll, metaText: opts.metaText || '' });
      return;
    }

    var div = document.createElement('div');
    div.className = 'chat-msg ai streaming';

    var s = ensureAiMessageStructure(div);
    var contentEl = s.contentEl;

    var textSpan = document.createElement('span');
    textSpan.className = 'stream-text';
    var textNode = document.createTextNode('');
    textSpan.appendChild(textNode);

    var cursor = document.createElement('span');
    cursor.className = 'stream-cursor';
    cursor.setAttribute('aria-hidden', 'true');

    try { contentEl.innerHTML = ''; } catch (_e) {}
    contentEl.appendChild(textSpan);
    contentEl.appendChild(cursor);

    setAiMessageMeta(div, opts.metaText || '');

    messagesEl.appendChild(div);
    requestScrollToBottom(!!opts.forceScroll);

    var full = String(text || '');
    var i = 0;
    var lastTs = 0;

    // Adaptive speed: fast enough to avoid feeling slow on long messages
    var cps = Math.max(45, Math.min(120, Math.floor(full.length / 1.6))); // chars/sec

    function frame(ts) {
      if (!lastTs) lastTs = ts;
      var dt = Math.max(0, ts - lastTs);
      lastTs = ts;

      var advance = Math.max(1, Math.floor((dt / 1000) * cps));
      i = Math.min(full.length, i + advance);

      try { textNode.data = full.slice(0, i); } catch (_e) {}
      requestScrollToBottom(false);

      if (i < full.length) {
        requestAnimationFrame(frame);
      } else {
        // Finalize into markdown & remove streaming class
        setAiMessageHtml(div, md(full));
        div.classList.remove('streaming');
        requestScrollToBottom(false);
      }
    }

    requestAnimationFrame(frame);
  }

  /* ── Send ── */
  async function handleSend(text) {
    var msg = text || (inputEl ? inputEl.value.trim() : '');
    msg = (msg || '').trim();
    if (!msg) return;

    // CFX-042: queue & throttle sustained sends client-side
    if (chatRateLimiter && typeof chatRateLimiter.enqueue === 'function' && typeof chatRateLimiter.canSendNow === 'function') {
      if (!chatRateLimiter.canSendNow()) {
        // Accept input, clear box, queue the actual send.
        try { if (inputEl) { inputEl.value = ''; autoResize(); } } catch (_e0) {}
        chatRateLimiter.enqueue(function () { return handleSendCore(msg); }, { text: msg });
        setStreamingStatusText('Queued (' + chatRateLimiter.getState().queued + ')…');
        return;
      }
      // Even if we can send now, run through limiter flush path for burst/cooldown accounting.
      chatRateLimiter.enqueue(function () { return handleSendCore(msg); }, { text: msg });
      return;
    }

    return handleSendCore(msg);
  }

  async function handleSendCore(msg) {
    var sendStartAt = nowMs();

    // Check limit
    if (window.CortexChatLimiter && !window.CortexChatLimiter.canSend()) {
      addMessage('ai', '⚡ Daily message limit reached! Upgrade to Pro for 200 messages/day → [Pricing](/pricing)', { forceScroll: true });
      return;
    }

    // CFX-033: cache check (best-effort, never blocks)
    var cacheKey = null;
    try {
      if (responseCache && window.CortexChatDispatcher) {
        var tid = responseCacheThreadId || (window.CortexChatDispatcher.getSessionId ? window.CortexChatDispatcher.getSessionId() : 'default');
        var mode = (window.CortexChatDispatcher.getConnectionMode ? window.CortexChatDispatcher.getConnectionMode() : 'default');
        cacheKey = await responseCache.buildKey({
          conversationId: tid,
          transport: mode,
          model: 'default',
          mode: 'default',
          prompt: msg,
          request: { role: 'user', content: msg }
        });
        var hit = responseCache.get(cacheKey);
        if (hit && hit.value && typeof hit.value.text === 'string') {
          addMessage('user', msg, { forceScroll: true });
          if (inputEl) { inputEl.value = ''; autoResize(); }
          addSuggestions([]);
          addCachedAiMessage(hit.value.text, { forceScroll: true });
          updateBadge();
          return;
        }
      }
    } catch (_e) {
      // ignore cache issues
    }

    addMessage('user', msg, { forceScroll: true });
    if (inputEl) { inputEl.value = ''; autoResize(); }
    addSuggestions([]); // clear chips
    updateBadge();

    // Dispatch with streaming callbacks
    if (window.CortexChatDispatcher) {
      var connectionMode = (window.CortexChatDispatcher.getConnectionMode ? window.CortexChatDispatcher.getConnectionMode() : null);
      var isStreaming = connectionMode && connectionMode !== 'http';

      // If getConnectionMode() is unavailable, fall back to old WS-only logic
      if (connectionMode === null) {
        isStreaming = window.CortexChatDispatcher.isWebSocketConnected && window.CortexChatDispatcher.isWebSocketConnected();
      }

      // CFX-040 perf object for this assistant message
      var perf = {
        startAt: sendStartAt,
        ttftAt: null,
        endAt: null,
        streaming: !!isStreaming,
        transport: safeTransportLabel(connectionMode || (isStreaming ? 'websocket' : 'http'))
      };

      if (isStreaming) {
        // Streaming path (WebSocket/SSE/Chunked): incremental, throttled
        startStreamingMessage();
        if (streamState) streamState.perf = perf;
        setLoading(true);

        var finalReplyText = '';

        var result = await window.CortexChatDispatcher.send(msg, {
          onStreamStart: function () {
            setLoading(false); // Hide "typing" once stream begins
            requestScrollToBottom(false);
          },
          onChunk: function (chunk) {
            // CFX-040: TTFT = first received chunk
            if (!perf.ttftAt) {
              perf.ttftAt = nowMs();
              // We intentionally keep this subtle; meta is finalized on completion.
            }

            // Throttled render: buffer and flush on rAF
            appendStreamingChunk(chunk);
          },
          onDone: function (reply) {
            finalReplyText = reply;

            // If transport returned only final text without chunks, TTFT == done time
            if (!perf.ttftAt) perf.ttftAt = nowMs();
            perf.endAt = nowMs();

            var metaText = buildPerfMetaText(perf);
            finalizeStreamingMessage(reply, metaText);
          },
          onError: function (error) {
            // Remove streaming element
            if (streamingMsgEl && streamingMsgEl.parentNode) {
              streamingMsgEl.parentNode.removeChild(streamingMsgEl);
            }
            stopActiveStream();
            setLoading(false);

            if (window.CortexFreelancer && window.CortexFreelancer.ChatErrorHandler) {
              window.CortexFreelancer.ChatErrorHandler.handleError(error, messagesEl, function () {
                handleSend(msg); // retry with same message
              });
            } else {
              addMessage(
                'ai',
                (typeof error === 'string' ? error : (error && error.error)) || 'Something went wrong. Please try again.',
                { forceScroll: true }
              );
            }
          },
          onQueued: function (position) {
            setLoading(false);
            setStreamingStatusText('Queued (' + position + ')…');
          }
        });

        // Safety: if stream wasn't finalized (e.g. transport returned a full reply)
        if (streamingMsgEl && result) {
          finalReplyText = result.reply;

          if (!perf.ttftAt) perf.ttftAt = nowMs();
          perf.endAt = nowMs();

          var metaText2 = buildPerfMetaText(perf);
          finalizeStreamingMessage(result.reply, metaText2);
        }

        // CFX-033: cache store
        try {
          if (responseCache && cacheKey && finalReplyText) {
            responseCache.set(cacheKey, { text: finalReplyText }, {
              threadId: responseCacheThreadId || (window.CortexChatDispatcher.getSessionId ? window.CortexChatDispatcher.getSessionId() : null),
              transport: (window.CortexChatDispatcher.getConnectionMode ? window.CortexChatDispatcher.getConnectionMode() : null)
            });
          }
        } catch (_e2) {}
      } else {
        // HTTP fallback (non-streaming)
        setLoading(true);
        var result2 = await window.CortexChatDispatcher.send(msg);
        setLoading(false);

        perf.endAt = nowMs();
        perf.streaming = false;
        perf.transport = safeTransportLabel(connectionMode || (window.CortexChatDispatcher.getConnectionMode ? window.CortexChatDispatcher.getConnectionMode() : 'http'));

        var metaText3 = buildPerfMetaText(perf);

        // Optional: typewriter effect for non-streaming (accessible)
        addAiMessageTypewriter(result2.reply, {
          enable: true,
          forceScroll: true,
          metaText: metaText3
        });

        // CFX-033: cache store
        try {
          if (responseCache && cacheKey && result2 && result2.reply) {
            responseCache.set(cacheKey, { text: result2.reply }, {
              threadId: responseCacheThreadId || (window.CortexChatDispatcher.getSessionId ? window.CortexChatDispatcher.getSessionId() : null),
              transport: (window.CortexChatDispatcher.getConnectionMode ? window.CortexChatDispatcher.getConnectionMode() : null)
            });
          }
        } catch (_e3) {}
      }
    } else {
      // No dispatcher
      setTimeout(function () {
        setLoading(false);
        addMessage('ai', 'Chat is being connected. Try again in a moment!', { forceScroll: true });
      }, 1000);
    }

    updateBadge();
  }

  /* ── Init ── */
  function init() {
    messagesEl = document.getElementById('chat-messages');
    typingEl = document.getElementById('chat-typing');
    inputEl = document.getElementById('chat-input');
    sendBtn = document.getElementById('chat-send');
    suggestionsEl = document.getElementById('chat-suggestions');
    badgeEl = document.getElementById('chat-badge');
    statusEl = document.getElementById('chat-status');
    cacheClearBtn = document.getElementById('cache-clear');
    var sessionClearBtn = document.getElementById('session-clear');
    try { inputBarEl = document.querySelector('.chat-input-bar'); } catch (_e) { inputBarEl = null; }

    // CFX-038: mobile viewport + safe-area layout vars
    initMobileLayout();

    // CFX-042: client message limiter (cooldown + queue + quota UI)
    try {
      if (window.CortexFreelancer && window.CortexFreelancer.ChatRateLimiter) {
        chatRateLimiter = new window.CortexFreelancer.ChatRateLimiter({ minIntervalMs: 1000, burst: 3 });
        window.CortexFreelancer.__chatRateLimiter = chatRateLimiter; // debug hook
      }

      if (inputBarEl && !document.getElementById('chat-rate-indicator')) {
        rateIndicatorEl = document.createElement('div');
        rateIndicatorEl.id = 'chat-rate-indicator';
        rateIndicatorEl.style.cssText = 'margin-top:6px;font-size:12px;color:rgba(203,213,225,.85);display:flex;justify-content:space-between;gap:10px;';
        rateIndicatorEl.innerHTML = '<span id="chat-rate-left"></span><span id="chat-rate-right" style="opacity:.9"></span>';
        inputBarEl.parentNode.insertBefore(rateIndicatorEl, inputBarEl.nextSibling);
      } else {
        rateIndicatorEl = document.getElementById('chat-rate-indicator');
      }

      function renderRateState(st) {
        if (!rateIndicatorEl) return;
        var left = rateIndicatorEl.querySelector('#chat-rate-left');
        var right = rateIndicatorEl.querySelector('#chat-rate-right');
        if (!left || !right) return;

        var parts = [];
        if (typeof st.serverRemaining === 'number' && isFinite(st.serverRemaining)) {
          parts.push('Quota: ' + st.serverRemaining + ' left');
        }
        if (st.queued > 0) parts.push('Queue: ' + st.queued);

        left.textContent = parts.length ? parts.join(' • ') : '';

        var waitMs = st.waitMs || 0;
        if (waitMs > 0) {
          right.textContent = 'Cooldown: ' + Math.ceil(waitMs / 1000) + 's';
        } else {
          right.textContent = '';
        }

        try {
          if (sendBtn) {
            sendBtn.disabled = waitMs > 0;
            sendBtn.style.opacity = waitMs > 0 ? '0.65' : '';
            sendBtn.title = waitMs > 0 ? ('Please wait ' + Math.ceil(waitMs / 1000) + 's') : 'Send';
          }
        } catch (_e) {}
      }

      if (chatRateLimiter && chatRateLimiter.on) {
        chatRateLimiter.on('change', renderRateState);
        renderRateState(chatRateLimiter.getState());
      }
    } catch (_e) {}

    // CFX-036: Cancel + clear-queue controls (progressive enhancement)
    if (statusEl && statusEl.parentNode && !document.getElementById('chat-cancel')) {
      cancelBtnEl = document.createElement('button');
      cancelBtnEl.id = 'chat-cancel';
      cancelBtnEl.type = 'button';
      cancelBtnEl.textContent = 'Cancel';
      cancelBtnEl.title = 'Cancel current request (Shift-click: clear queued)';
      cancelBtnEl.style.cssText = 'margin-left:8px;padding:4px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:transparent;color:#cbd5e1;font-size:12px;cursor:pointer;display:none;';
      cancelBtnEl.onclick = function (e) {
        if (!window.CortexRequestQueue) return;
        window.CortexRequestQueue.cancelCurrent({ clearQueue: !!(e && e.shiftKey) });
      };
      statusEl.parentNode.insertBefore(cancelBtnEl, statusEl.nextSibling);
    }

    if (!messagesEl || !inputEl) { console.warn('[CortexChat] Missing DOM elements'); return; }

    // Sticky scroll listener
    try {
      scrollState.stickToBottom = true;
      messagesEl.addEventListener('scroll', onMessagesScroll, { passive: true });
    } catch (_e) {}

    // Events
    sendBtn.addEventListener('click', function () { handleSend(); });
    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    });
    inputEl.addEventListener('input', autoResize);

    // Welcome
    var profile = window.CortexFreelancer && window.CortexFreelancer.getProfile ? window.CortexFreelancer.getProfile() : null;
    var name = profile && profile.name ? profile.name.split(' ')[0] : null;
    var welcome = name
      ? 'Hey ' + name + '! I\'m Cortex, your AI freelancer assistant. Ask me about proposals, rates, emails, or job analysis!'
      : 'Hey! I\'m Cortex, your AI freelancer assistant. Ask me about proposals, rates, emails, or job analysis!';
    addMessage('ai', welcome, { forceScroll: true });

    // Suggestions
    addSuggestions(['Write a proposal', 'Draft an email', 'Analyze a job', 'Rate advice']);

    // CFX-041: clear session / start fresh chat
    try {
      if (sessionClearBtn) {
        sessionClearBtn.addEventListener('click', function () {
          var ok = true;
          try { ok = window.confirm('Start a new chat? This will clear the current conversation on this device.'); } catch (_e) { ok = true; }
          if (!ok) return;

          try {
            if (window.CortexRequestQueue) window.CortexRequestQueue.cancelCurrent({ clearQueue: true });
          } catch (_e2) {}

          if (window.CortexSessionManager && window.CortexSessionManager.clearSession) {
            window.CortexSessionManager.clearSession().then(function () {
              try { messagesEl.innerHTML = ''; } catch (_e3) {}
              addMessage('ai', welcome, { forceScroll: true });
              addSuggestions(['Write a proposal', 'Draft an email', 'Analyze a job', 'Rate advice']);
              updateBadge();
              // Reset cache thread id so ResponseCache doesn't cross sessions
              try {
                if (window.CortexChatDispatcher && window.CortexChatDispatcher.getSessionId) {
                  responseCacheThreadId = window.CortexChatDispatcher.getSessionId();
                }
              } catch (_e4) {}
            });
          } else {
            // Fallback: hard reload
            try { location.reload(); } catch (_e5) {}
          }
        });
      }
    } catch (_e6) {}

    updateBadge();

    // CFX-033: init response cache (best-effort)
    try {
      if (window.CortexFreelancer && window.CortexFreelancer.ResponseCache) {
        responseCache = window.CortexFreelancer.ResponseCache.create({
          namespace: 'cortex',
          maxEntries: 120,
          maxBytes: 1.5 * 1024 * 1024,
          ttlMs: 24 * 60 * 60 * 1000,
          hashIncludesContext: false
        });
      }
      if (window.CortexChatDispatcher && window.CortexChatDispatcher.getSessionId) {
        responseCacheThreadId = window.CortexChatDispatcher.getSessionId();
      }
      if (cacheClearBtn && responseCache) {
        cacheClearBtn.addEventListener('click', function () {
          responseCache.clearAll();
          addMessage('ai', 'Cache cleared.', { forceScroll: true });
        });
      }
    } catch (_e2) {}

    // Show initial connection status
    if (window.CortexChatDispatcher && window.CortexChatDispatcher.isWebSocketConnected) {
      updateConnectionStatus(window.CortexChatDispatcher.isWebSocketConnected() ? 'connected' : 'disconnected');
    }

    // CFX-036: Request queue UI hooks (queued count + cancel visibility)
    function updateQueueUi() {
      try {
        if (!window.CortexRequestQueue || !window.CortexRequestQueue.getState) return;
        var st = window.CortexRequestQueue.getState();

        if (cancelBtnEl) {
          var show = !!(st.inFlight || st.queued > 0);
          cancelBtnEl.style.display = show ? '' : 'none';
          cancelBtnEl.textContent = st.queued > 0 ? ('Cancel (' + st.queued + ')') : 'Cancel';
        }

        // Refresh status line with queued count
        if (lastConnState) updateConnectionStatus(lastConnState, lastConnInfo || {});
      } catch (_e3) {}
    }

    try {
      if (window.CortexRequestQueue && window.CortexRequestQueue.on) {
        window.CortexRequestQueue.on('change', updateQueueUi);
        updateQueueUi();
      }
    } catch (_e4) {}

    // ESC cancels current request (Shift+ESC clears queue)
    try {
      if (!window.__cfx036EscBound) {
        window.__cfx036EscBound = true;
        document.addEventListener('keydown', function (e) {
          if (!e) return;
          if (e.key === 'Escape' && window.CortexRequestQueue) {
            window.CortexRequestQueue.cancelCurrent({ clearQueue: !!e.shiftKey });
          }
        });
      }
    } catch (_e5) {}

    // CFX-041: if IndexedDB hydration completes after initial paint, refresh UI
    try {
      if (window.CortexSessionManager && window.CortexSessionManager.on) {
        window.CortexSessionManager.on('hydrated', function () {
          try {
            if (!window.CortexChatDispatcher) return;
            var sid2 = window.CortexChatDispatcher.getSessionId();
            var hist2 = window.CortexChatSessions ? window.CortexChatSessions.getHistory(sid2, 20) : [];
            if (!hist2 || hist2.length === 0) return;

            // If UI currently only has the welcome message, replace with restored history
            var currentCount = 0;
            try { currentCount = messagesEl ? messagesEl.children.length : 0; } catch (_e) { currentCount = 0; }
            if (currentCount <= 1) {
              messagesEl.innerHTML = '';
              hist2.forEach(function (m) {
                addMessage(m.role === 'user' ? 'user' : 'ai', m.content, { forceScroll: false });
              });
              scrollState.stickToBottom = true;
              requestScrollToBottom(true);
            }
          } catch (_e2) {}
        });
      }
    } catch (_e3) {}

    // Restore session (last few messages)
    if (window.CortexChatSessions && window.CortexChatDispatcher) {
      var sid = window.CortexChatDispatcher.getSessionId();
      var history = window.CortexChatSessions.getHistory(sid, 20);
      if (history.length > 0) {
        messagesEl.innerHTML = '';
        history.forEach(function (m) {
          addMessage(m.role === 'user' ? 'user' : 'ai', m.content, { forceScroll: false });
        });
        // After restoring, stick to bottom
        scrollState.stickToBottom = true;
        requestScrollToBottom(true);
      }
    }
  }

  // Auto-init on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.CortexChat = {
    init: init,
    addMessage: addMessage,
    setLoading: setLoading,
    addSuggestions: addSuggestions,
    scrollToBottom: scrollToBottom,
    onConnectionChange: updateConnectionStatus
  };
})();
