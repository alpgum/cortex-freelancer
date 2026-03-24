/**
 * T02: Chat UI Manager
 * Renders messages, handles input, wires to dispatcher.
 */
(function () {
  'use strict';

  var messagesEl, typingEl, inputEl, sendBtn, suggestionsEl, badgeEl;

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
  }

  /* ── Typing indicator ── */
  function setLoading(show) {
    if (typingEl) typingEl.className = 'chat-typing' + (show ? ' active' : '');
    if (show) scrollToBottom();
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
    setLoading(true);
    updateBadge();

    // Dispatch
    if (window.CortexChatDispatcher) {
      var result = await window.CortexChatDispatcher.send(msg);
      setLoading(false);
      addMessage('ai', result.reply);
    } else {
      // Fallback mock
      setTimeout(function () {
        setLoading(false);
        addMessage('ai', "👋 Chat is being connected. Try again in a moment!");
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
      ? 'Hey ' + name + '! 👋 I\'m Cortex, your AI freelancer assistant. Ask me about proposals, rates, emails, or job analysis!'
      : 'Hey! 👋 I\'m Cortex, your AI freelancer assistant. Ask me about proposals, rates, emails, or job analysis!';
    addMessage('ai', welcome);

    // Suggestions
    addSuggestions(['✍️ Write a proposal', '📧 Draft an email', '🔍 Analyze a job', '💰 Rate advice']);

    updateBadge();

    // Restore session (last few messages)
    if (window.CortexChatSessions && window.CortexChatDispatcher) {
      var sid = window.CortexChatDispatcher.getSessionId();
      var history = window.CortexChatSessions.getHistory(sid, 20);
      if (history.length > 0) {
        // Clear welcome, show history
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

  window.CortexChat = { init: init, addMessage: addMessage, setLoading: setLoading, addSuggestions: addSuggestions, scrollToBottom: scrollToBottom };
})();
