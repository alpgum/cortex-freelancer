/**
 * CF-090 — Deploy chat API as Vercel serverless function
 * Client-side helper that detects chat API availability and provides fallback
 */
(function () {
  const ns = (window.CortexFreelancer = window.CortexFreelancer || {});

  const CHAT_API_PATH = '/api/chat';
  const HEALTH_PATH = '/api/health';
  const MAX_RETRIES = 2;
  const RETRY_DELAY_MS = 1000;

  let _apiAvailable = null;

  function checkApiHealth() {
    return fetch(HEALTH_PATH, { method: 'GET' })
      .then(function (r) { return r.ok; })
      .catch(function () { return false; });
  }

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function sendMessage(messages, options) {
    options = options || {};
    var retries = options.retries || 0;

    var body = {
      messages: messages,
      model: options.model || 'claude-sonnet-4-20250514',
      max_tokens: options.maxTokens || 1024,
      stream: options.stream || false
    };

    return fetch(CHAT_API_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) {
        if (res.status === 503 && retries < MAX_RETRIES) {
          return sleep(RETRY_DELAY_MS * (retries + 1)).then(function () {
            return sendMessage(messages, Object.assign({}, options, { retries: retries + 1 }));
          });
        }
        return res.json().then(function (err) {
          throw new Error(err.error || 'Chat API error: ' + res.status);
        });
      }
      if (options.stream) return res;
      return res.json();
    });
  }

  function init() {
    checkApiHealth().then(function (ok) {
      _apiAvailable = ok;
      if (!ok) {
        console.warn('[ChatDeploy] Chat API not available — check Vercel deployment');
      }
    });
  }

  ns.ChatDeployFix = {
    init: init,
    sendMessage: sendMessage,
    checkHealth: checkApiHealth,
    isAvailable: function () { return _apiAvailable; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
