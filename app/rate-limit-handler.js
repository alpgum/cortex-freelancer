/* ===== Rate Limit Handler — Friendly 429 UI ===== */
(function () {
  'use strict';

  var activeOverlay = null;

  /**
   * Show a friendly rate-limit overlay when a 429 is received.
   * @param {number} retryAfter - seconds until the user can retry
   * @param {function} [onRetry] - callback when user clicks retry
   */
  function show429(retryAfter, onRetry) {
    // Don't stack multiple overlays
    if (activeOverlay) dismiss();

    retryAfter = Math.max(1, parseInt(retryAfter, 10) || 60);

    var overlay = document.createElement('div');
    overlay.className = 'rate-limit-overlay';
    overlay.setAttribute('role', 'alertdialog');
    overlay.setAttribute('aria-label', 'Rate limit reached');

    var card = document.createElement('div');
    card.className = 'rate-limit-card';

    var icon = document.createElement('div');
    icon.className = 'rate-limit-icon';
    icon.textContent = '\u23F3';

    var title = document.createElement('h2');
    title.className = 'rate-limit-title';
    title.textContent = 'Slow down a bit';

    var msg = document.createElement('p');
    msg.className = 'rate-limit-msg';
    msg.textContent = "You've made too many requests. Please wait before trying again.";

    var countdown = document.createElement('div');
    countdown.className = 'rate-limit-countdown';

    var retryBtn = document.createElement('button');
    retryBtn.className = 'rate-limit-btn';
    retryBtn.disabled = true;
    retryBtn.textContent = 'Retry';

    card.appendChild(icon);
    card.appendChild(title);
    card.appendChild(msg);
    card.appendChild(countdown);
    card.appendChild(retryBtn);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    activeOverlay = overlay;

    // Inject styles once
    if (!document.getElementById('rate-limit-styles')) {
      var style = document.createElement('style');
      style.id = 'rate-limit-styles';
      style.textContent =
        '.rate-limit-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:10000;backdrop-filter:blur(4px)}' +
        '.rate-limit-card{background:var(--bg2,#111);border:1px solid var(--border,#222);border-radius:16px;padding:2.5rem;text-align:center;max-width:400px;width:90%}' +
        '.rate-limit-icon{font-size:3rem;margin-bottom:1rem}' +
        '.rate-limit-title{font-size:1.3rem;font-weight:700;color:var(--text,#f0f0f0);margin-bottom:.5rem}' +
        '.rate-limit-msg{color:var(--text-dim,#888);font-size:.9rem;line-height:1.5;margin-bottom:1.5rem}' +
        '.rate-limit-countdown{font-size:2rem;font-weight:800;color:var(--orange,#ff8844);margin-bottom:1.5rem;font-variant-numeric:tabular-nums}' +
        '.rate-limit-btn{background:var(--orange,#ff8844);color:#000;border:none;padding:.7rem 2rem;border-radius:100px;font-weight:700;font-size:.9rem;cursor:pointer;transition:all .2s;font-family:inherit}' +
        '.rate-limit-btn:disabled{opacity:.4;cursor:not-allowed}' +
        '.rate-limit-btn:not(:disabled):hover{background:var(--green,#00ff88);transform:translateY(-1px)}';
      document.head.appendChild(style);
    }

    // Countdown timer
    var remaining = retryAfter;
    function tick() {
      var m = Math.floor(remaining / 60);
      var s = remaining % 60;
      countdown.textContent = (m > 0 ? m + ':' : '') + (s < 10 && m > 0 ? '0' : '') + s + 's';
      if (remaining <= 0) {
        retryBtn.disabled = false;
        retryBtn.textContent = 'Retry Now';
        countdown.textContent = 'Ready!';
        return;
      }
      remaining--;
      setTimeout(tick, 1000);
    }
    tick();

    retryBtn.addEventListener('click', function () {
      dismiss();
      if (typeof onRetry === 'function') onRetry();
    });
  }

  function dismiss() {
    if (activeOverlay) {
      activeOverlay.parentNode.removeChild(activeOverlay);
      activeOverlay = null;
    }
  }

  /**
   * Wrap a fetch call to automatically handle 429 responses.
   * @param {string} url
   * @param {object} options - fetch options
   * @returns {Promise<Response>}
   */
  function fetchWithRateLimit(url, options) {
    return fetch(url, options).then(function (res) {
      if (res.status === 429) {
        var retryAfter = parseInt(res.headers.get('Retry-After'), 10) || 60;
        return new Promise(function (resolve, reject) {
          show429(retryAfter, function () {
            fetch(url, options).then(resolve).catch(reject);
          });
        });
      }
      return res;
    });
  }

  // Expose globally
  window.cortexRateLimit = {
    show429: show429,
    dismiss: dismiss,
    fetch: fetchWithRateLimit
  };
})();
