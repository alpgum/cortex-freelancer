/**
 * T02: Chat UI Manager
 * Renders messages, handles input, wires to dispatcher.
 * Supports real-time streaming via WebSocket.
 */
(function () {
  'use strict';

  var messagesEl, typingEl, inputEl, sendBtn, suggestionsEl, badgeEl, statusEl;
  var streamingMsgEl = null; // Active streaming message element

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

  /* ── Add message ── */
  function addMessage(role, content) {
    var div = document.createElement('div');
    div.className = 'chat-msg ' + (role === 'user' ? 'user' : 'ai');
    div.innerHTML = md(content);
    messagesEl.appendChild(div);
    scrollToBottom();
    return div;
  }

  /* ── Streaming message helpers ── */
  function startStreamingMessage() {
    var div = document.createElement('div');
    div.className = 'chat-msg ai streaming';
    div.innerHTML = '<span class="stream-cursor"></span>';
    messagesEl.appendChild(div);
    streamingMsgEl = div;
    scrollToBottom();
    return div;
  }

  function finalizeStreamingMessage(finalText) {
    if (streamingMsgEl) {
      streamingMsgEl.innerHTML = md(finalText);
      streamingMsgEl.classList.remove('streaming');
      streamingMsgEl = null;
    }
    scrollToBottom();
  }

  /* ── Typing indicator ── */
  function setLoading(show) {
    if (typingEl) typingEl.className = 'chat-typing' + (show ? ' active' : '');
    if (show) scrollToBottom();
  }

  /* ── Connection status (CFX-004: rich state display) ── */
  function updateConnectionStatus(state, info) {
    if (!statusEl) return;
    info = info || {};
    switch (state) {
      case 'connected':
        statusEl.textContent = '● Live';
        statusEl.className = 'chat-status connected';
        statusEl.title = 'Connected via WebSocket';
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
        break;
      case 'disconnected':
      default:
        statusEl.textContent = '○ Offline';
        statusEl.className = 'chat-status disconnected';
        statusEl.title = 'Not connected';
        break;
    }

    // Show queued message count if any
    if (window.CortexWsReconnect) {
      var qLen = window.CortexWsReconnect.getQueueLength();
      if (qLen > 0 && state !== 'connected') {
        statusEl.textContent += ' · ' + qLen + ' queued';
      }
    }
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

  /* ── Scroll ── */
  function scrollToBottom() {
    if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  /* ── Auto-resize textarea ── */
  function autoResize() {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
  }

  /* ── Update badge ── */
  function updateBadge() {
    if (!badgeEl || !window.CortexChatLimiter) return;
    var rem = window.CortexChatLimiter.remaining();
    badgeEl.textContent = rem + ' left';
    badgeEl.style.display = rem < 999 ? '' : 'none';
  }

  /* ── Send ── */
  async function handleSend(text) {
    var msg = text || (inputEl ? inputEl.value.trim() : '');
    if (!msg) return;

    // Check limit
    if (window.CortexChatLimiter && !window.CortexChatLimiter.canSend()) {
      addMessage('ai', '⚡ Daily message limit reached! Upgrade to Pro for 200 messages/day → [Pricing](/pricing)');
      return;
    }

    addMessage('user', msg);
    if (inputEl) { inputEl.value = ''; autoResize(); }
    addSuggestions([]); // clear chips
    updateBadge();

    // Dispatch with streaming callbacks
    if (window.CortexChatDispatcher) {
      var isStreaming = window.CortexChatDispatcher.isWebSocketConnected && window.CortexChatDispatcher.isWebSocketConnected();

      if (isStreaming) {
        // WebSocket: show streaming cursor
        startStreamingMessage();
        setLoading(true);

        var result = await window.CortexChatDispatcher.send(msg, {
          onStreamStart: function () {
            setLoading(false); // Hide "typing" once stream begins
          },
          onChunk: function () {
            // Chunks are raw stdout — we show the cursor animation
            // Final text comes in stream_end
          },
          onDone: function (reply) {
            finalizeStreamingMessage(reply);
          },
          onError: function (error) {
            finalizeStreamingMessage(error || 'Something went wrong.');
          },
          onQueued: function (position) {
            if (streamingMsgEl) {
              streamingMsgEl.innerHTML = '<em>Queued (position ' + position + ')...</em>';
            }
          }
        });

        // Safety: if streaming message wasn't finalized (e.g. timeout)
        if (streamingMsgEl && result) {
          finalizeStreamingMessage(result.reply);
        }
      } else {
        // HTTP fallback: show typing indicator
        setLoading(true);
        var result = await window.CortexChatDispatcher.send(msg);
        setLoading(false);
        addMessage('ai', result.reply);
      }
    } else {
      // No dispatcher
      setTimeout(function () {
        setLoading(false);
        addMessage('ai', "Chat is being connected. Try again in a moment!");
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

    if (!messagesEl || !inputEl) { console.warn('[CortexChat] Missing DOM elements'); return; }

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
    addMessage('ai', welcome);

    // Suggestions
    addSuggestions(['Write a proposal', 'Draft an email', 'Analyze a job', 'Rate advice']);

    updateBadge();

    // Show initial connection status
    if (window.CortexChatDispatcher && window.CortexChatDispatcher.isWebSocketConnected) {
      updateConnectionStatus(window.CortexChatDispatcher.isWebSocketConnected() ? 'connected' : 'disconnected');
    }

    // Restore session (last few messages)
    if (window.CortexChatSessions && window.CortexChatDispatcher) {
      var sid = window.CortexChatDispatcher.getSessionId();
      var history = window.CortexChatSessions.getHistory(sid, 20);
      if (history.length > 0) {
        messagesEl.innerHTML = '';
        history.forEach(function (m) {
          addMessage(m.role === 'user' ? 'user' : 'ai', m.content);
        });
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
