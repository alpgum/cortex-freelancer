/* ───────────────────────────────────────────
   tool-feedback.js  –  Thumbs up / down widget
   Appears at the bottom of every tool result.
   Stores feedback in localStorage.
   Drop <script src="tool-feedback.js"></script>
   at the bottom of any tool page.
   ─────────────────────────────────────────── */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_tool_feedback';

  /* ── helpers ─────────────────────────────── */
  function getToolSlug() {
    var path = window.location.pathname;
    var match = path.match(/\/([^\/]+?)(?:\.html)?$/);
    return match ? match[1] : 'unknown';
  }

  function loadFeedback() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch (e) { return {}; }
  }

  function saveFeedback(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  /* ── inject CSS ──────────────────────────── */
  var css = document.createElement('style');
  css.textContent = [
    '.tool-feedback{display:flex;align-items:center;justify-content:center;gap:16px;margin:20px 0 8px;padding:14px;opacity:0;transition:opacity .4s}',
    '.tool-feedback.visible{opacity:1}',
    '.tool-feedback-label{font-size:13px;color:rgba(240,240,240,.5);font-weight:500}',
    '.tool-feedback-btn{width:40px;height:40px;border-radius:10px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;transition:all .2s}',
    '.tool-feedback-btn:hover{border-color:rgba(255,255,255,.2);background:rgba(255,255,255,.08);transform:scale(1.1)}',
    '.tool-feedback-btn.active-up{background:rgba(0,255,136,.15);border-color:#00ff88;color:#00ff88}',
    '.tool-feedback-btn.active-down{background:rgba(255,68,102,.15);border-color:#ff4466;color:#ff4466}',
    '.tool-feedback-thanks{font-size:13px;color:#00ff88;font-weight:500;opacity:0;transition:opacity .3s}',
    '.tool-feedback-thanks.show{opacity:1}'
  ].join('\n');
  document.head.appendChild(css);

  /* ── build widget ────────────────────────── */
  function createWidget() {
    var slug = getToolSlug();
    var stored = loadFeedback();
    var current = stored[slug] || null; // 'up' | 'down' | null

    var wrap = document.createElement('div');
    wrap.className = 'tool-feedback';
    wrap.id = 'toolFeedback';

    var label = document.createElement('span');
    label.className = 'tool-feedback-label';
    label.textContent = 'Was this helpful?';

    var upBtn = document.createElement('button');
    upBtn.className = 'tool-feedback-btn' + (current === 'up' ? ' active-up' : '');
    upBtn.innerHTML = '👍';
    upBtn.title = 'Helpful';

    var downBtn = document.createElement('button');
    downBtn.className = 'tool-feedback-btn' + (current === 'down' ? ' active-down' : '');
    downBtn.innerHTML = '👎';
    downBtn.title = 'Not helpful';

    var thanks = document.createElement('span');
    thanks.className = 'tool-feedback-thanks' + (current ? ' show' : '');
    thanks.textContent = current ? 'Thanks for your feedback!' : '';

    function vote(type) {
      var data = loadFeedback();
      if (data[slug] === type) {
        // toggle off
        delete data[slug];
        saveFeedback(data);
        upBtn.className = 'tool-feedback-btn';
        downBtn.className = 'tool-feedback-btn';
        thanks.className = 'tool-feedback-thanks';
        thanks.textContent = '';
        return;
      }
      data[slug] = type;
      data[slug + '_ts'] = Date.now();
      saveFeedback(data);
      upBtn.className = 'tool-feedback-btn' + (type === 'up' ? ' active-up' : '');
      downBtn.className = 'tool-feedback-btn' + (type === 'down' ? ' active-down' : '');
      thanks.textContent = type === 'up' ? 'Glad it helped!' : 'Thanks — we\'ll improve!';
      thanks.className = 'tool-feedback-thanks show';
    }

    upBtn.onclick = function () { vote('up'); };
    downBtn.onclick = function () { vote('down'); };

    wrap.appendChild(label);
    wrap.appendChild(upBtn);
    wrap.appendChild(downBtn);
    wrap.appendChild(thanks);
    return wrap;
  }

  /* ── mount ───────────────────────────────── */
  function mount() {
    var results = document.querySelector('.results-section');
    if (!results) return;

    var widget = createWidget();
    results.appendChild(widget);

    // Show widget when results become visible
    var observer = new MutationObserver(function () {
      var visible = results.classList.contains('visible') ||
                    getComputedStyle(results).display !== 'none';
      if (visible) widget.classList.add('visible');
      else widget.classList.remove('visible');
    });
    observer.observe(results, { attributes: true, attributeFilter: ['class', 'style'] });

    // Check immediately
    var visible = results.classList.contains('visible') ||
                  getComputedStyle(results).display !== 'none';
    if (visible) widget.classList.add('visible');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
