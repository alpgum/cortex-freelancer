/**
 * CF-255: Lightweight in-app live chat widget for support
 * Chat bubble UI, message queue, auto-responses, support ticket creation. No external dependencies.
 */
(function () {
  'use strict';

  var AUTO_RESPONSES = {
    pricing: { pattern: /pric|cost|plan|subscription|free|pro|premium/i, reply: 'We offer a free tier and a Pro plan at $29/mo. Visit cortexfreelancer.com/pricing for details. Need help choosing?' },
    proposals: { pattern: /proposal|cover letter|bid/i, reply: 'Our AI Proposal Generator crafts personalized cover letters in seconds. Go to Dashboard > Proposals to try it!' },
    rate: { pattern: /rate|hourly|charge|pricing calculator/i, reply: 'Use our Rate Calculator under Tools to find your ideal freelance rate based on market data.' },
    account: { pattern: /account|password|login|sign.?in|email/i, reply: 'For account issues, go to Settings > Account. To reset your password, click "Forgot Password" on the login page.' },
    bug: { pattern: /bug|error|broken|crash|not working/i, reply: 'Sorry to hear that! I\'ll create a support ticket so our team can look into it. Can you describe what happened?' },
    cancel: { pattern: /cancel|refund|unsubscribe/i, reply: 'You can cancel anytime from Settings > Billing. Refund requests are handled within 48 hours. Want me to connect you with billing support?' },
    hello: { pattern: /^(hi|hello|hey|howdy|good morning|good afternoon)/i, reply: 'Hi there! Welcome to Cortex Freelancer support. How can I help you today?' }
  };

  function LiveChat(opts) {
    opts = opts || {};
    this.userId = opts.userId || 'anonymous';
    this.userName = opts.userName || 'Guest';
    this.messages = [];
    this.isOpen = false;
    this.unreadCount = 0;
    this.ticketQueue = [];
    this.container = null;
  }

  /* ---------- message handling ---------- */

  LiveChat.prototype.sendMessage = function (text) {
    if (!text || !text.trim()) return null;
    text = text.trim();

    var msg = {
      id: 'msg_' + Date.now(),
      sender: 'user',
      senderName: this.userName,
      text: text,
      timestamp: new Date().toISOString()
    };
    this.messages.push(msg);
    this._renderMessages();

    // Check auto-responses
    var autoReply = this._matchAutoResponse(text);
    if (autoReply) {
      var self = this;
      setTimeout(function () {
        var reply = {
          id: 'msg_' + Date.now(),
          sender: 'bot',
          senderName: 'Cortex Support',
          text: autoReply,
          timestamp: new Date().toISOString()
        };
        self.messages.push(reply);
        if (!self.isOpen) self.unreadCount++;
        self._renderMessages();
      }, 600);
    }

    return msg;
  };

  LiveChat.prototype._matchAutoResponse = function (text) {
    var keys = Object.keys(AUTO_RESPONSES);
    for (var i = 0; i < keys.length; i++) {
      if (AUTO_RESPONSES[keys[i]].pattern.test(text)) {
        return AUTO_RESPONSES[keys[i]].reply;
      }
    }
    return 'Thanks for your message! A support agent will get back to you shortly. Typical response time is under 2 hours.';
  };

  LiveChat.prototype.getMessages = function () {
    return this.messages.slice();
  };

  /* ---------- support ticket creation ---------- */

  LiveChat.prototype.createTicket = function (subject, description) {
    var ticket = {
      id: 'tkt_' + Date.now(),
      userId: this.userId,
      subject: subject || 'Support request',
      description: description || this.messages.map(function (m) { return m.senderName + ': ' + m.text; }).join('\n'),
      status: 'open',
      priority: 'normal',
      createdAt: new Date().toISOString(),
      messages: this.messages.slice()
    };

    this.ticketQueue.push(ticket);

    // Stub: would POST to support API
    console.log('[LiveChat] Ticket created:', ticket.id);

    var confirmMsg = {
      id: 'msg_' + Date.now(),
      sender: 'bot',
      senderName: 'Cortex Support',
      text: 'Support ticket ' + ticket.id + ' has been created. Our team will follow up via email within 24 hours.',
      timestamp: new Date().toISOString()
    };
    this.messages.push(confirmMsg);
    this._renderMessages();

    return ticket;
  };

  LiveChat.prototype.getTickets = function () {
    return this.ticketQueue.slice();
  };

  /* ---------- chat bubble UI ---------- */

  LiveChat.prototype.mount = function (parentEl) {
    if (this.container) return;
    var parent = parentEl || document.body;

    this.container = document.createElement('div');
    this.container.id = 'cortex-live-chat';
    this.container.innerHTML = this._buildHTML();
    parent.appendChild(this.container);
    this._attachEvents();
  };

  LiveChat.prototype.unmount = function () {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
      this.container = null;
    }
  };

  LiveChat.prototype.toggle = function () {
    this.isOpen = !this.isOpen;
    if (this.isOpen) this.unreadCount = 0;
    if (this.container) {
      var panel = this.container.querySelector('.lc-panel');
      var badge = this.container.querySelector('.lc-badge');
      if (panel) panel.style.display = this.isOpen ? 'flex' : 'none';
      if (badge) badge.textContent = this.unreadCount || '';
    }
  };

  LiveChat.prototype._buildHTML = function () {
    return '<style>' +
      '#cortex-live-chat{position:fixed;bottom:20px;right:20px;z-index:9999;font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;}' +
      '.lc-bubble{width:56px;height:56px;border-radius:50%;background:#4f46e5;color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,.15);position:relative;}' +
      '.lc-bubble:hover{background:#4338ca;}' +
      '.lc-badge{position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;border-radius:50%;width:20px;height:20px;font-size:11px;display:flex;align-items:center;justify-content:center;}' +
      '.lc-panel{display:none;flex-direction:column;width:340px;height:440px;background:#fff;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.12);position:absolute;bottom:70px;right:0;overflow:hidden;}' +
      '.lc-header{background:#4f46e5;color:#fff;padding:14px 16px;font-weight:600;}' +
      '.lc-messages{flex:1;overflow-y:auto;padding:12px;}' +
      '.lc-msg{margin-bottom:10px;max-width:85%;}' +
      '.lc-msg.user{margin-left:auto;text-align:right;}' +
      '.lc-msg .bubble{display:inline-block;padding:8px 12px;border-radius:12px;line-height:1.4;}' +
      '.lc-msg.user .bubble{background:#4f46e5;color:#fff;}' +
      '.lc-msg.bot .bubble{background:#f3f4f6;color:#1f2937;}' +
      '.lc-input-row{display:flex;border-top:1px solid #e5e7eb;padding:8px;}' +
      '.lc-input-row input{flex:1;border:none;outline:none;padding:8px;font-size:14px;}' +
      '.lc-input-row button{background:#4f46e5;color:#fff;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;}' +
    '</style>' +
    '<div class="lc-panel">' +
      '<div class="lc-header">Cortex Support</div>' +
      '<div class="lc-messages"></div>' +
      '<div class="lc-input-row">' +
        '<input type="text" class="lc-input" placeholder="Type a message..." />' +
        '<button class="lc-send">Send</button>' +
      '</div>' +
    '</div>' +
    '<button class="lc-bubble" aria-label="Open chat">' +
      '<span class="lc-badge"></span>' +
      '<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
    '</button>';
  };

  LiveChat.prototype._attachEvents = function () {
    var self = this;
    var bubble = this.container.querySelector('.lc-bubble');
    var sendBtn = this.container.querySelector('.lc-send');
    var input = this.container.querySelector('.lc-input');

    bubble.addEventListener('click', function () { self.toggle(); });

    var doSend = function () {
      var text = input.value;
      if (text.trim()) {
        self.sendMessage(text);
        input.value = '';
      }
    };

    sendBtn.addEventListener('click', doSend);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') doSend();
    });
  };

  LiveChat.prototype._renderMessages = function () {
    if (!this.container) return;
    var wrapper = this.container.querySelector('.lc-messages');
    if (!wrapper) return;

    wrapper.innerHTML = this.messages.map(function (m) {
      var cls = m.sender === 'user' ? 'user' : 'bot';
      return '<div class="lc-msg ' + cls + '"><span class="bubble">' + escapeHtml(m.text) + '</span></div>';
    }).join('');

    wrapper.scrollTop = wrapper.scrollHeight;
  };

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // Export to namespace
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.LiveChat = LiveChat;
})();
