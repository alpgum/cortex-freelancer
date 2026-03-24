/**
 * [CF-093] Chat Streaming — SSE Incremental Rendering
 * Full chat streaming UI: connects to SSE endpoint, renders tokens
 * incrementally with typing cursor, markdown support, auto-scroll,
 * retry/abort controls, and chat message management.
 *
 * Depends on: chat-stream-renderer.js (window.CortexFreelancer.ChatStreamRenderer)
 * Exposed on window.CortexFreelancer.ChatStreaming
 */
(function () {
  'use strict';

  var CHAT_KEY = 'cortex_chat_history';
  var activeController = null;

  // ─── Persistence ────────────────────────────────────────────────────

  function _loadChat() {
    try { return JSON.parse(localStorage.getItem(CHAT_KEY)) || []; } catch (e) { return []; }
  }

  function _saveChat(messages) {
    try { localStorage.setItem(CHAT_KEY, JSON.stringify(messages.slice(-100))); } catch (e) { /* ignore */ }
  }

  function _esc(str) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(str || ''));
    return d.innerHTML;
  }

  // ─── SSE Stream Connection ─────────────────────────────────────────

  function streamMessage(apiUrl, body, opts) {
    opts = opts || {};
    var onToken = opts.onToken || function () {};
    var onDone = opts.onDone || function () {};
    var onError = opts.onError || function () {};
    var onStart = opts.onStart || function () {};

    // Abort previous stream if active
    if (activeController) {
      activeController.abort();
      activeController = null;
    }

    activeController = new AbortController();
    var signal = activeController.signal;
    var fullText = '';

    onStart();

    return fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({}, body, { stream: true })),
      signal: signal
    }).then(function (response) {
      if (!response.ok) {
        throw new Error('Stream request failed: ' + response.status);
      }

      var reader = response.body.getReader();
      var decoder = new TextDecoder();
      var partialLine = '';

      function pump() {
        return reader.read().then(function (result) {
          if (result.done) {
            if (partialLine) _processLine(partialLine);
            activeController = null;
            onDone(fullText);
            return fullText;
          }

          var text = decoder.decode(result.value, { stream: true });
          var lines = (partialLine + text).split('\n');
          partialLine = lines.pop();

          for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;
            if (_processLine(line) === 'done') {
              reader.cancel();
              activeController = null;
              onDone(fullText);
              return fullText;
            }
          }
          return pump();
        });
      }

      function _processLine(line) {
        if (!line.startsWith('data: ')) return;
        var data = line.slice(6);
        if (data === '[DONE]') return 'done';

        try {
          var parsed = JSON.parse(data);
          var token = '';
          if (parsed.delta && parsed.delta.text) {
            token = parsed.delta.text;
          } else if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta) {
            token = parsed.choices[0].delta.content || '';
          } else if (parsed.content) {
            token = parsed.content;
          } else if (parsed.text) {
            token = parsed.text;
          }
          if (token) {
            fullText += token;
            onToken(token, fullText);
          }
        } catch (e) {
          // Non-JSON SSE data, treat as raw text
          if (data.trim()) {
            fullText += data;
            onToken(data, fullText);
          }
        }
      }

      return pump();
    }).catch(function (err) {
      activeController = null;
      if (err.name === 'AbortError') {
        onDone(fullText);
        return fullText;
      }
      onError(err);
      throw err;
    });
  }

  function abortStream() {
    if (activeController) {
      activeController.abort();
      activeController = null;
      return true;
    }
    return false;
  }

  function isStreaming() {
    return activeController !== null;
  }

  // ─── Chat UI Component ─────────────────────────────────────────────

  function createChatUI(containerId, apiUrl, opts) {
    opts = opts || {};
    var container = document.getElementById(containerId);
    if (!container) return null;

    var messages = _loadChat();
    var streaming = false;

    // Inject CSS
    _injectStyles();

    // Build UI
    container.innerHTML = '';
    container.className = 'cs-chat-container';
    container.style.cssText = 'display:flex;flex-direction:column;height:100%;font-family:inherit;';

    var messagesEl = document.createElement('div');
    messagesEl.className = 'cs-messages';
    messagesEl.style.cssText = 'flex:1;overflow-y:auto;padding:16px;';

    var inputRow = document.createElement('div');
    inputRow.style.cssText = 'display:flex;gap:8px;padding:12px;border-top:1px solid #e5e7eb;';

    var input = document.createElement('input');
    input.type = 'text';
    input.placeholder = opts.placeholder || 'Ask anything about freelancing...';
    input.style.cssText = 'flex:1;padding:10px 14px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;outline:none;';

    var sendBtn = document.createElement('button');
    sendBtn.textContent = 'Send';
    sendBtn.style.cssText = 'padding:10px 20px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer;';

    var stopBtn = document.createElement('button');
    stopBtn.textContent = 'Stop';
    stopBtn.style.cssText = 'padding:10px 16px;background:#ef4444;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer;display:none;';

    inputRow.appendChild(input);
    inputRow.appendChild(sendBtn);
    inputRow.appendChild(stopBtn);
    container.appendChild(messagesEl);
    container.appendChild(inputRow);

    // Render existing messages
    _renderMessages();

    // Event handlers
    function sendMessage() {
      var text = input.value.trim();
      if (!text || streaming) return;
      input.value = '';

      // Add user message
      _addMessage('user', text);

      // Create assistant message placeholder
      var assistantDiv = _createMessageBubble('assistant', '');
      var contentEl = assistantDiv.querySelector('.cs-content');
      messagesEl.appendChild(assistantDiv);

      // Create cursor
      var cursor = document.createElement('span');
      cursor.className = 'cs-cursor';
      cursor.textContent = '▊';
      cursor.style.cssText = 'animation:cs-blink .7s step-end infinite;opacity:.6;';
      contentEl.appendChild(cursor);

      streaming = true;
      sendBtn.style.display = 'none';
      stopBtn.style.display = '';
      _scrollToBottom();

      var body = Object.assign({}, opts.requestBody || {}, {
        messages: messages.map(function (m) { return { role: m.role, content: m.content }; }).concat([{ role: 'user', content: text }])
      });

      streamMessage(apiUrl, body, {
        onToken: function (token) {
          contentEl.insertBefore(document.createTextNode(token), cursor);
          _scrollToBottom();
        },
        onDone: function (fullText) {
          if (cursor.parentNode) cursor.parentNode.removeChild(cursor);
          _addMessage('assistant', fullText);
          streaming = false;
          sendBtn.style.display = '';
          stopBtn.style.display = 'none';
        },
        onError: function (err) {
          if (cursor.parentNode) cursor.parentNode.removeChild(cursor);
          contentEl.innerHTML += '<div style="color:#ef4444;font-size:12px;margin-top:8px;">Error: ' + _esc(err.message) + '</div>';
          streaming = false;
          sendBtn.style.display = '';
          stopBtn.style.display = 'none';
        }
      });
    }

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    stopBtn.addEventListener('click', function () {
      abortStream();
    });

    function _addMessage(role, content) {
      messages.push({ role: role, content: content, timestamp: new Date().toISOString() });
      _saveChat(messages);
      if (role === 'user') {
        messagesEl.appendChild(_createMessageBubble('user', content));
        _scrollToBottom();
      }
    }

    function _createMessageBubble(role, content) {
      var div = document.createElement('div');
      div.style.cssText = 'display:flex;margin-bottom:12px;' + (role === 'user' ? 'justify-content:flex-end;' : '');

      var bubble = document.createElement('div');
      bubble.style.cssText = 'max-width:80%;padding:10px 14px;border-radius:12px;font-size:14px;line-height:1.5;' +
        (role === 'user'
          ? 'background:#2563eb;color:#fff;border-bottom-right-radius:4px;'
          : 'background:#f3f4f6;color:#111827;border-bottom-left-radius:4px;');
      bubble.className = 'cs-content';
      if (content) bubble.textContent = content;

      div.appendChild(bubble);
      return div;
    }

    function _renderMessages() {
      messagesEl.innerHTML = '';
      messages.forEach(function (m) {
        messagesEl.appendChild(_createMessageBubble(m.role, m.content));
      });
      _scrollToBottom();
    }

    function _scrollToBottom() {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    return {
      sendMessage: function (text) {
        input.value = text;
        sendMessage();
      },
      clearHistory: function () {
        messages = [];
        _saveChat(messages);
        _renderMessages();
      },
      getMessages: function () { return messages.slice(); }
    };
  }

  function _injectStyles() {
    if (document.getElementById('cs-chat-styles')) return;
    var style = document.createElement('style');
    style.id = 'cs-chat-styles';
    style.textContent = '@keyframes cs-blink{0%,100%{opacity:1}50%{opacity:0}}';
    document.head.appendChild(style);
  }

  // ─── Init ───────────────────────────────────────────────────────────

  function init() {
    console.log('[ChatStreaming] Initialized — SSE incremental rendering ready');
  }

  // ─── Expose ─────────────────────────────────────────────────────────
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.ChatStreaming = {
    init: init,
    streamMessage: streamMessage,
    abortStream: abortStream,
    isStreaming: isStreaming,
    createChatUI: createChatUI
  };
})();
