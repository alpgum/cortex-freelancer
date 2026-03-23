/**
 * Cortex Freelancer — Negotiation Coach Module
 * AI-powered negotiation advice for freelancer-client conversations
 */
(function () {
  'use strict';

  const API_BASE = window.CORTEX_API_BASE || '';

  // ── Styles ──────────────────────────────────────────────────────────

  const STYLES = `
    .cx-negotiation {
      background: #1a1a2e;
      border: 1px solid #2d2d44;
      border-radius: 12px;
      margin: 16px 0;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .cx-negotiation-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      background: #16213e;
      cursor: pointer;
      user-select: none;
      transition: background 0.2s;
    }

    .cx-negotiation-header:hover {
      background: #1a2745;
    }

    .cx-negotiation-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #e0e0e0;
    }

    .cx-negotiation-toggle {
      font-size: 14px;
      color: #888;
      transition: transform 0.3s;
    }

    .cx-negotiation-toggle.open {
      transform: rotate(180deg);
    }

    .cx-negotiation-body {
      display: none;
      padding: 16px 20px;
    }

    .cx-negotiation-body.open {
      display: block;
    }

    /* ── Input Area ── */
    .cx-neg-scenario-select {
      width: 100%;
      padding: 10px 14px;
      background: #2d2d44;
      border: 1px solid #3d3d5c;
      border-radius: 8px;
      color: #e0e0e0;
      font-size: 13px;
      margin-bottom: 12px;
      cursor: pointer;
      appearance: none;
      -webkit-appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23888' fill='none' stroke-width='1.5'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 12px center;
    }

    .cx-neg-scenario-select:focus {
      outline: none;
      border-color: #6c63ff;
    }

    .cx-neg-message-input {
      width: 100%;
      min-height: 80px;
      padding: 10px 14px;
      background: #2d2d44;
      border: 1px solid #3d3d5c;
      border-radius: 8px;
      color: #e0e0e0;
      font-size: 13px;
      resize: vertical;
      margin-bottom: 12px;
      box-sizing: border-box;
      font-family: inherit;
      line-height: 1.5;
    }

    .cx-neg-message-input::placeholder {
      color: #666;
    }

    .cx-neg-message-input:focus {
      outline: none;
      border-color: #6c63ff;
    }

    .cx-neg-actions {
      display: flex;
      gap: 10px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    .cx-neg-btn {
      padding: 8px 16px;
      border: 1px solid #3d3d5c;
      border-radius: 8px;
      background: #2d2d44;
      color: #c0c0d0;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .cx-neg-btn:hover {
      background: #3d3d5c;
      color: #fff;
    }

    .cx-neg-btn.primary {
      background: #6c63ff;
      border-color: #6c63ff;
      color: #fff;
    }

    .cx-neg-btn.primary:hover {
      background: #5a52d5;
    }

    .cx-neg-btn.primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .cx-neg-btn.practice {
      background: transparent;
      border-color: #00c9a7;
      color: #00c9a7;
    }

    .cx-neg-btn.practice:hover {
      background: rgba(0, 201, 167, 0.1);
    }

    .cx-neg-btn.practice.active {
      background: rgba(0, 201, 167, 0.15);
      border-color: #00e6be;
      color: #00e6be;
    }

    /* ── Loading ── */
    .cx-neg-loading {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 16px;
      color: #888;
      font-size: 13px;
    }

    .cx-neg-spinner {
      width: 18px;
      height: 18px;
      border: 2px solid #3d3d5c;
      border-top-color: #6c63ff;
      border-radius: 50%;
      animation: cx-neg-spin 0.8s linear infinite;
    }

    @keyframes cx-neg-spin {
      to { transform: rotate(360deg); }
    }

    /* ── Response Card ── */
    .cx-neg-result {
      margin-top: 8px;
    }

    .cx-neg-tactic-badge {
      display: inline-block;
      padding: 4px 10px;
      background: rgba(108, 99, 255, 0.15);
      border: 1px solid rgba(108, 99, 255, 0.3);
      border-radius: 20px;
      color: #a39dff;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
    }

    .cx-neg-response-box {
      position: relative;
      padding: 14px 16px;
      border-radius: 8px;
      margin-bottom: 12px;
      font-size: 13px;
      line-height: 1.6;
      color: #e0e0e0;
    }

    .cx-neg-response-box.best {
      background: rgba(0, 201, 167, 0.08);
      border: 1px solid rgba(0, 201, 167, 0.25);
    }

    .cx-neg-response-box.alt {
      background: rgba(108, 99, 255, 0.08);
      border: 1px solid rgba(108, 99, 255, 0.25);
    }

    .cx-neg-response-label {
      display: block;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }

    .cx-neg-response-box.best .cx-neg-response-label {
      color: #00c9a7;
    }

    .cx-neg-response-box.alt .cx-neg-response-label {
      color: #a39dff;
    }

    .cx-neg-copy-btn {
      position: absolute;
      top: 10px;
      right: 10px;
      padding: 4px 8px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 4px;
      color: #888;
      font-size: 11px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .cx-neg-copy-btn:hover {
      background: rgba(255, 255, 255, 0.12);
      color: #ccc;
    }

    .cx-neg-response-text {
      white-space: pre-wrap;
      word-break: break-word;
    }

    /* ── Tips / Avoid Sections ── */
    .cx-neg-section {
      margin-bottom: 12px;
    }

    .cx-neg-section-title {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid #2d2d44;
    }

    .cx-neg-section-title.tips {
      color: #00c9a7;
    }

    .cx-neg-section-title.avoid {
      color: #ff6b6b;
    }

    .cx-neg-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .cx-neg-list li {
      padding: 6px 0 6px 20px;
      position: relative;
      font-size: 13px;
      color: #c0c0d0;
      line-height: 1.5;
    }

    .cx-neg-list li::before {
      content: '';
      position: absolute;
      left: 4px;
      top: 13px;
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }

    .cx-neg-list.tips li::before {
      background: #00c9a7;
    }

    .cx-neg-list.avoid li::before {
      background: #ff6b6b;
    }

    /* ── Practice Mode ── */
    .cx-neg-practice {
      margin-top: 16px;
      border-top: 1px solid #2d2d44;
      padding-top: 16px;
    }

    .cx-neg-practice-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    .cx-neg-practice-header h4 {
      margin: 0;
      font-size: 14px;
      color: #00c9a7;
      font-weight: 600;
    }

    .cx-neg-chat {
      max-height: 300px;
      overflow-y: auto;
      margin-bottom: 12px;
      padding: 8px;
      background: #12121e;
      border-radius: 8px;
      border: 1px solid #2d2d44;
    }

    .cx-neg-chat-msg {
      padding: 8px 12px;
      margin-bottom: 8px;
      border-radius: 8px;
      font-size: 13px;
      line-height: 1.5;
      max-width: 85%;
    }

    .cx-neg-chat-msg:last-child {
      margin-bottom: 0;
    }

    .cx-neg-chat-msg.client {
      background: #2d2d44;
      color: #e0e0e0;
      margin-right: auto;
    }

    .cx-neg-chat-msg.freelancer {
      background: rgba(108, 99, 255, 0.15);
      border: 1px solid rgba(108, 99, 255, 0.25);
      color: #e0e0e0;
      margin-left: auto;
    }

    .cx-neg-chat-msg.coach {
      background: rgba(0, 201, 167, 0.08);
      border: 1px solid rgba(0, 201, 167, 0.2);
      color: #b0e0d6;
      font-style: italic;
      font-size: 12px;
      max-width: 100%;
    }

    .cx-neg-chat-role {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
      display: block;
    }

    .cx-neg-chat-msg.client .cx-neg-chat-role { color: #ff9f43; }
    .cx-neg-chat-msg.freelancer .cx-neg-chat-role { color: #a39dff; }
    .cx-neg-chat-msg.coach .cx-neg-chat-role { color: #00c9a7; }

    .cx-neg-practice-input {
      display: flex;
      gap: 8px;
    }

    .cx-neg-practice-input textarea {
      flex: 1;
      min-height: 40px;
      max-height: 80px;
      padding: 8px 12px;
      background: #2d2d44;
      border: 1px solid #3d3d5c;
      border-radius: 8px;
      color: #e0e0e0;
      font-size: 13px;
      resize: none;
      font-family: inherit;
    }

    .cx-neg-practice-input textarea:focus {
      outline: none;
      border-color: #6c63ff;
    }

    .cx-neg-divider {
      height: 1px;
      background: #2d2d44;
      margin: 16px 0;
    }

    .cx-neg-empty {
      text-align: center;
      padding: 24px;
      color: #666;
      font-size: 13px;
    }

    .cx-neg-source {
      font-size: 11px;
      color: #555;
      text-align: right;
      margin-top: 8px;
    }
  `;

  // ── Scenarios ───────────────────────────────────────────────────────

  const SCENARIOS = [
    { value: 'custom', label: '✍️  Paste a client message' },
    { value: 'rate-reduction', label: '💰  Client wants a lower rate' },
    { value: 'free-test', label: '🆓  Client wants free test work' },
    { value: 'unlimited-revisions', label: '🔄  Client wants unlimited revisions' },
    { value: 'outside-platform', label: '⚠️  Client wants to pay outside Upwork' },
    { value: 'scope-creep', label: '📈  Scope is growing beyond agreement' },
    { value: 'late-payment', label: '⏰  Client is delaying payment' },
    { value: 'rush-job', label: '🏃  Client needs it done ASAP' },
    { value: 'competitor-comparison', label: '👥  Client comparing you to cheaper freelancers' }
  ];

  const SCENARIO_PREFILLS = {
    'rate-reduction': 'Your rate is a bit high for our budget. Can you do it for less?',
    'free-test': 'Can you do a small test project for free so we can evaluate your skills?',
    'unlimited-revisions': 'We need unlimited revisions until we\'re fully satisfied with the result.',
    'outside-platform': 'Can we handle payments directly? Upwork fees are too high.',
    'scope-creep': 'Oh, one more thing — can you also add [extra feature]? It should be quick.',
    'late-payment': 'We\'ll release the milestone payment next week, we\'re just waiting on internal approval.',
    'rush-job': 'We need this done by tomorrow. Can you make it happen?',
    'competitor-comparison': 'We found someone on Fiverr who can do this for half the price.'
  };

  // ── Inject Styles ───────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById('cx-negotiation-styles')) return;
    const style = document.createElement('style');
    style.id = 'cx-negotiation-styles';
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

  // ── API Call ────────────────────────────────────────────────────────

  async function getAdvice(scenario, clientMessage, profile) {
    const resp = await fetch(`${API_BASE}/api/negotiation-coach`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario, clientMessage, profile })
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || `Request failed (${resp.status})`);
    }

    return resp.json();
  }

  // ── Copy Helper ─────────────────────────────────────────────────────

  function copyToClipboard(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
      const orig = btn.textContent;
      btn.textContent = '✓ Copied';
      setTimeout(() => { btn.textContent = orig; }, 1500);
    }).catch(() => {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      const orig = btn.textContent;
      btn.textContent = '✓ Copied';
      setTimeout(() => { btn.textContent = orig; }, 1500);
    });
  }

  // ── Render Result ───────────────────────────────────────────────────

  function renderResult(data, container) {
    container.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'cx-neg-result';

    // Tactic badge
    if (data.tactic) {
      const badge = document.createElement('div');
      badge.className = 'cx-neg-tactic-badge';
      badge.textContent = `🎯 ${data.tactic}`;
      wrap.appendChild(badge);
    }

    // Best response
    if (data.bestResponse) {
      const box = document.createElement('div');
      box.className = 'cx-neg-response-box best';
      box.innerHTML = `
        <span class="cx-neg-response-label">✅ Best Response</span>
        <button class="cx-neg-copy-btn">📋 Copy</button>
        <div class="cx-neg-response-text"></div>
      `;
      box.querySelector('.cx-neg-response-text').textContent = data.bestResponse;
      box.querySelector('.cx-neg-copy-btn').addEventListener('click', function () {
        copyToClipboard(data.bestResponse, this);
      });
      wrap.appendChild(box);
    }

    // Alternative response
    if (data.alternativeResponse) {
      const box = document.createElement('div');
      box.className = 'cx-neg-response-box alt';
      box.innerHTML = `
        <span class="cx-neg-response-label">💡 Alternative Approach</span>
        <button class="cx-neg-copy-btn">📋 Copy</button>
        <div class="cx-neg-response-text"></div>
      `;
      box.querySelector('.cx-neg-response-text').textContent = data.alternativeResponse;
      box.querySelector('.cx-neg-copy-btn').addEventListener('click', function () {
        copyToClipboard(data.alternativeResponse, this);
      });
      wrap.appendChild(box);
    }

    // Tips
    if (data.tips && data.tips.length) {
      const sec = document.createElement('div');
      sec.className = 'cx-neg-section';
      sec.innerHTML = `<div class="cx-neg-section-title tips">💡 Pro Tips</div>`;
      const ul = document.createElement('ul');
      ul.className = 'cx-neg-list tips';
      data.tips.forEach((tip) => {
        const li = document.createElement('li');
        li.textContent = tip;
        ul.appendChild(li);
      });
      sec.appendChild(ul);
      wrap.appendChild(sec);
    }

    // What to avoid
    if (data.whatToAvoid && data.whatToAvoid.length) {
      const sec = document.createElement('div');
      sec.className = 'cx-neg-section';
      sec.innerHTML = `<div class="cx-neg-section-title avoid">🚫 What to Avoid</div>`;
      const ul = document.createElement('ul');
      ul.className = 'cx-neg-list avoid';
      data.whatToAvoid.forEach((item) => {
        const li = document.createElement('li');
        li.textContent = item;
        ul.appendChild(li);
      });
      sec.appendChild(ul);
      wrap.appendChild(sec);
    }

    // Source indicator
    if (data.source) {
      const src = document.createElement('div');
      src.className = 'cx-neg-source';
      src.textContent = data.source === 'ai' ? '🤖 AI-powered advice' : '📋 Template-based advice';
      wrap.appendChild(src);
    }

    container.appendChild(wrap);
  }

  // ── Practice Mode ───────────────────────────────────────────────────

  function renderPracticeMode(profile, container) {
    const wrap = document.createElement('div');
    wrap.className = 'cx-neg-practice';

    const header = document.createElement('div');
    header.className = 'cx-neg-practice-header';
    header.innerHTML = `
      <h4>🎭 Practice Mode</h4>
      <button class="cx-neg-btn" id="cx-neg-practice-reset">Reset</button>
    `;
    wrap.appendChild(header);

    const chat = document.createElement('div');
    chat.className = 'cx-neg-chat';
    chat.innerHTML = `
      <div class="cx-neg-chat-msg coach">
        <span class="cx-neg-chat-role">🤝 Coach</span>
        Pick a scenario above and get advice first, then practice your response here. I'll play the client and give you feedback.
      </div>
    `;
    wrap.appendChild(chat);

    const inputRow = document.createElement('div');
    inputRow.className = 'cx-neg-practice-input';
    inputRow.innerHTML = `
      <textarea placeholder="Type your response as the freelancer..." rows="2"></textarea>
      <button class="cx-neg-btn primary">Send</button>
    `;
    wrap.appendChild(inputRow);

    const textarea = inputRow.querySelector('textarea');
    const sendBtn = inputRow.querySelector('button');
    const resetBtn = header.querySelector('#cx-neg-practice-reset');

    let practiceHistory = [];

    function addMessage(role, text) {
      const msg = document.createElement('div');
      msg.className = `cx-neg-chat-msg ${role}`;
      const roleLabel = role === 'client' ? '🏢 Client' : role === 'freelancer' ? '👤 You' : '🤝 Coach';
      msg.innerHTML = `<span class="cx-neg-chat-role">${roleLabel}</span>`;
      const textNode = document.createTextNode(text);
      msg.appendChild(textNode);
      chat.appendChild(msg);
      chat.scrollTop = chat.scrollHeight;
      practiceHistory.push({ role, text });
    }

    async function handlePracticeSend() {
      const text = textarea.value.trim();
      if (!text) return;

      textarea.value = '';
      addMessage('freelancer', text);
      sendBtn.disabled = true;

      try {
        const resp = await getAdvice('practice-roleplay', text, profile);
        if (resp.bestResponse) {
          // Use bestResponse as client's next line, tips as coach feedback
          addMessage('client', resp.bestResponse);
          if (resp.tips && resp.tips.length) {
            addMessage('coach', '💡 ' + resp.tips[0]);
          }
        }
      } catch {
        // Simple roleplay fallback
        const clientResponses = [
          'Hmm, I see your point. But our budget is really tight on this one.',
          'That sounds reasonable. Can you put together a revised proposal?',
          'I appreciate the transparency. Let me discuss with my team.',
          'We have other candidates too. What makes you stand out?',
          'Okay, but can we at least get a small discount for a longer contract?'
        ];
        const pick = clientResponses[Math.floor(Math.random() * clientResponses.length)];
        addMessage('client', pick);
        addMessage('coach', '💡 Tip: Stay professional and frame your value in terms of ROI for the client.');
      }

      sendBtn.disabled = false;
      textarea.focus();
    }

    sendBtn.addEventListener('click', handlePracticeSend);
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handlePracticeSend();
      }
    });

    resetBtn.addEventListener('click', () => {
      practiceHistory = [];
      chat.innerHTML = `
        <div class="cx-neg-chat-msg coach">
          <span class="cx-neg-chat-role">🤝 Coach</span>
          Practice reset! Try a different negotiation approach this time.
        </div>
      `;
    });

    container.appendChild(wrap);
  }

  // ── Main Render ─────────────────────────────────────────────────────

  function renderNegotiationCoach(profileData, container) {
    injectStyles();

    const profile = profileData || {};
    const el = document.createElement('div');
    el.className = 'cx-negotiation';

    // Header
    const header = document.createElement('div');
    header.className = 'cx-negotiation-header';
    header.innerHTML = `
      <h3>🤝 Negotiation Coach</h3>
      <span class="cx-negotiation-toggle">▼</span>
    `;
    el.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'cx-negotiation-body';

    // Scenario selector
    const select = document.createElement('select');
    select.className = 'cx-neg-scenario-select';
    SCENARIOS.forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s.value;
      opt.textContent = s.label;
      select.appendChild(opt);
    });
    body.appendChild(select);

    // Message input
    const messageInput = document.createElement('textarea');
    messageInput.className = 'cx-neg-message-input';
    messageInput.placeholder = 'Paste the client\'s message here...';
    body.appendChild(messageInput);

    // Action buttons
    const actions = document.createElement('div');
    actions.className = 'cx-neg-actions';

    const adviceBtn = document.createElement('button');
    adviceBtn.className = 'cx-neg-btn primary';
    adviceBtn.textContent = '🎯 Get Advice';
    actions.appendChild(adviceBtn);

    const practiceBtn = document.createElement('button');
    practiceBtn.className = 'cx-neg-btn practice';
    practiceBtn.textContent = '🎭 Practice Mode';
    actions.appendChild(practiceBtn);

    body.appendChild(actions);

    // Result area
    const resultArea = document.createElement('div');
    resultArea.id = 'cx-neg-result-area';
    body.appendChild(resultArea);

    // Practice area
    const practiceArea = document.createElement('div');
    practiceArea.id = 'cx-neg-practice-area';
    body.appendChild(practiceArea);

    el.appendChild(body);
    container.appendChild(el);

    // ── Event Handlers ──────────────────────────────────────────────

    let isOpen = false;

    header.addEventListener('click', () => {
      isOpen = !isOpen;
      body.classList.toggle('open', isOpen);
      header.querySelector('.cx-negotiation-toggle').classList.toggle('open', isOpen);
    });

    // Scenario change → prefill message
    select.addEventListener('change', () => {
      const val = select.value;
      if (val !== 'custom' && SCENARIO_PREFILLS[val]) {
        messageInput.value = SCENARIO_PREFILLS[val];
      } else if (val === 'custom') {
        messageInput.value = '';
        messageInput.focus();
      }
    });

    // Get Advice
    adviceBtn.addEventListener('click', async () => {
      const clientMessage = messageInput.value.trim();
      if (!clientMessage) {
        messageInput.focus();
        messageInput.style.borderColor = '#ff6b6b';
        setTimeout(() => { messageInput.style.borderColor = ''; }, 2000);
        return;
      }

      adviceBtn.disabled = true;
      resultArea.innerHTML = `
        <div class="cx-neg-loading">
          <div class="cx-neg-spinner"></div>
          <span>Analyzing negotiation...</span>
        </div>
      `;

      try {
        const scenario = select.value !== 'custom' ? select.value : null;
        const data = await getAdvice(scenario, clientMessage, profile);
        renderResult(data, resultArea);
      } catch (err) {
        resultArea.innerHTML = `
          <div class="cx-neg-response-box" style="border-color: #ff6b6b; background: rgba(255,107,107,0.08);">
            <span class="cx-neg-response-label" style="color: #ff6b6b;">Error</span>
            <div class="cx-neg-response-text">${err.message || 'Failed to get advice. Please try again.'}</div>
          </div>
        `;
      }

      adviceBtn.disabled = false;
    });

    // Toggle Practice Mode
    let practiceActive = false;
    practiceBtn.addEventListener('click', () => {
      practiceActive = !practiceActive;
      practiceBtn.classList.toggle('active', practiceActive);
      practiceArea.innerHTML = '';
      if (practiceActive) {
        renderPracticeMode(profile, practiceArea);
      }
    });
  }

  // ── Public API ──────────────────────────────────────────────────────

  window.CortexNegotiationCoach = {
    renderNegotiationCoach
  };

})();
