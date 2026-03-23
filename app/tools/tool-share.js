/* ───────────────────────────────────────────
   tool-share.js  –  "Share Result" widget
   Generates shareable URL pointing to /app/share.html
   with data encoded in URL hash. Adds "Share Result",
   "Copy Link", and "Tweet This" buttons.
   Drop <script src="tool-share.js"></script>
   at the bottom of any tool page.
   ─────────────────────────────────────────── */
(function () {
  'use strict';

  /* ── helpers ─────────────────────────────── */
  function getToolName() {
    var el = document.querySelector('.hero h1, .hero-title, h1');
    return el ? el.textContent.trim() : document.title;
  }

  function getToolSlug() {
    var path = window.location.pathname;
    var match = path.match(/\/tools\/([^/.]+)/);
    return match ? match[1] : 'tool';
  }

  function getResultText() {
    var sec = document.querySelector(
      '.results-section, .results, #results, #resultContent, ' +
      '#resultSection, #outputSection, .output-section, ' +
      '#invoice-preview, #brief-preview, #sow-preview, .inv-preview, .prop-preview'
    );
    if (!sec) return '';
    return sec.innerText.substring(0, 2000);
  }

  function getResultHTML() {
    var sec = document.querySelector(
      '.results-section, .results, #results, #resultContent, ' +
      '#resultSection, #outputSection, .output-section, ' +
      '#invoice-preview, #brief-preview, #sow-preview, .inv-preview, .prop-preview'
    );
    if (!sec) return '';
    return sec.innerHTML.substring(0, 8000);
  }

  function buildPayload() {
    return {
      t: getToolName(),
      s: getToolSlug(),
      r: getResultText(),
      h: getResultHTML(),
      ts: Date.now()
    };
  }

  function encodePayload(payload) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  }

  function buildShareUrl() {
    var encoded = encodePayload(buildPayload());
    return window.location.origin + '/app/share.html#share=' + encoded;
  }

  function buildTweetText() {
    var name = getToolName();
    return 'Just used ' + name + ' on Cortex — free tools for freelancers!';
  }

  /* ── toast ───────────────────────────────── */
  function showToast(msg) {
    var t = document.createElement('div');
    t.textContent = msg;
    Object.assign(t.style, {
      position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
      background: '#00ff88', color: '#0a0a0f', padding: '10px 24px',
      borderRadius: '8px', fontWeight: '600', fontSize: '14px',
      zIndex: '9999', opacity: '0', transition: 'opacity .3s'
    });
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.style.opacity = '1'; });
    setTimeout(function () {
      t.style.opacity = '0';
      setTimeout(function () { t.remove(); }, 300);
    }, 2200);
  }

  function copyToClipboard(text, successMsg) {
    navigator.clipboard.writeText(text).then(function () {
      showToast(successMsg);
    }).catch(function () {
      var inp = document.createElement('input');
      inp.value = text;
      document.body.appendChild(inp);
      inp.select();
      document.execCommand('copy');
      inp.remove();
      showToast(successMsg);
    });
  }

  /* ── inject CSS ──────────────────────────── */
  var css = document.createElement('style');
  css.textContent = [
    '.tool-share-bar{display:flex;gap:10px;justify-content:center;margin:24px 0 8px;flex-wrap:wrap}',
    '.tool-share-btn{display:inline-flex;align-items:center;gap:6px;padding:10px 20px;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;transition:transform .15s,box-shadow .15s;font-family:inherit}',
    '.tool-share-btn:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,.4)}',
    '.tool-share-btn--share{background:linear-gradient(135deg,#ff8844,#ff6622);color:#fff}',
    '.tool-share-btn--copy{background:rgba(255,255,255,.08);color:#f0f0f0;border:1px solid rgba(255,255,255,.12)}',
    '.tool-share-btn--copy:hover{border-color:rgba(255,255,255,.25)}',
    '.tool-share-btn--tweet{background:#1d9bf0;color:#fff}',
    '@media(max-width:640px){.tool-share-bar{flex-direction:column;align-items:stretch}.tool-share-btn{justify-content:center}}'
  ].join('\n');
  document.head.appendChild(css);

  /* ── build bar ───────────────────────────── */
  function createBar() {
    var bar = document.createElement('div');
    bar.className = 'tool-share-bar';
    bar.id = 'toolShareBar';
    bar.style.display = 'none';

    // Share Result (primary)
    var shareBtn = document.createElement('button');
    shareBtn.className = 'tool-share-btn tool-share-btn--share';
    shareBtn.innerHTML = '&#x1F4E4; Share Result';
    shareBtn.onclick = function () {
      var url = buildShareUrl();
      copyToClipboard(url, 'Shareable link copied!');
    };

    // Copy Link
    var copyBtn = document.createElement('button');
    copyBtn.className = 'tool-share-btn tool-share-btn--copy';
    copyBtn.innerHTML = '&#x1F517; Copy Link';
    copyBtn.onclick = function () {
      var url = buildShareUrl();
      copyToClipboard(url, 'Link copied!');
    };

    // Tweet This
    var tweetBtn = document.createElement('button');
    tweetBtn.className = 'tool-share-btn tool-share-btn--tweet';
    tweetBtn.innerHTML = '&#x1D54F; Tweet This';
    tweetBtn.onclick = function () {
      var url = buildShareUrl();
      var text = buildTweetText();
      window.open(
        'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(url),
        '_blank', 'width=550,height=420'
      );
    };

    bar.appendChild(shareBtn);
    bar.appendChild(copyBtn);
    bar.appendChild(tweetBtn);
    return bar;
  }

  /* ── mount ───────────────────────────────── */
  function mount() {
    var results = document.querySelector(
      '.results-section, .results, #results, #resultContent, ' +
      '#resultSection, #outputSection, .output-section'
    );
    if (!results) return;

    var bar = createBar();
    results.appendChild(bar);

    // Show bar when results become visible
    var observer = new MutationObserver(function () {
      var visible = results.classList.contains('visible') ||
                    results.classList.contains('has-results') ||
                    (getComputedStyle(results).display !== 'none' &&
                     results.children.length > 1 &&
                     results.offsetHeight > 50);
      bar.style.display = visible ? 'flex' : 'none';
    });
    observer.observe(results, { attributes: true, attributeFilter: ['class', 'style'], childList: true, subtree: true });

    // Also check immediately
    var visible = results.classList.contains('visible') ||
                  results.classList.contains('has-results') ||
                  (getComputedStyle(results).display !== 'none' &&
                   results.children.length > 1 &&
                   results.offsetHeight > 50);
    if (visible) bar.style.display = 'flex';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
