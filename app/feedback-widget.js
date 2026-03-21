/* ───────────────────────────────────────────
   feedback-widget.js  –  Tool feedback widget
   "Was this helpful? 👍 👎" + optional comment
   Stores in localStorage, POSTs to /api/feedback
   Drop <script src="/app/feedback-widget.js"></script>
   at the bottom of any tool page.
   ─────────────────────────────────────────── */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_feedback';
  var API_URL = '/api/feedback';

  /* ── helpers ─────────────────────────────── */
  function getToolSlug() {
    var path = window.location.pathname;
    var match = path.match(/\/([^\/]+?)(?:\.html)?$/);
    return match ? match[1] : 'unknown';
  }

  function loadAll() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch (e) { return []; }
  }

  function saveAll(arr) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  }

  function findExisting(slug) {
    var all = loadAll();
    for (var i = 0; i < all.length; i++) {
      if (all[i].tool === slug) return all[i];
    }
    return null;
  }

  function postFeedback(entry) {
    try {
      fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      });
    } catch (e) { /* silent */ }
  }

  /* ── inject CSS ──────────────────────────── */
  var css = document.createElement('style');
  css.textContent = [
    '.fb-widget{max-width:480px;margin:32px auto 12px;padding:18px 20px;border-radius:12px;border:1px solid rgba(255,255,255,.07);background:rgba(17,17,17,.85);text-align:center;opacity:0;transform:translateY(8px);transition:opacity .4s,transform .4s}',
    '.fb-widget.visible{opacity:1;transform:translateY(0)}',
    '.fb-label{font-size:13px;color:rgba(240,240,240,.5);font-weight:500;margin-bottom:10px}',
    '.fb-btns{display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:0}',
    '.fb-btn{width:44px;height:44px;border-radius:10px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);cursor:pointer;font-size:20px;display:flex;align-items:center;justify-content:center;transition:all .2s}',
    '.fb-btn:hover{border-color:rgba(255,255,255,.2);background:rgba(255,255,255,.08);transform:scale(1.1)}',
    '.fb-btn.up{background:rgba(0,255,136,.15);border-color:#00ff88;color:#00ff88}',
    '.fb-btn.down{background:rgba(255,68,102,.15);border-color:#ff4466;color:#ff4466}',
    '.fb-thanks{font-size:13px;color:#00ff88;font-weight:500;margin-top:8px;opacity:0;transition:opacity .3s;height:0;overflow:hidden}',
    '.fb-thanks.show{opacity:1;height:auto}',
    '.fb-comment-wrap{margin-top:12px;overflow:hidden;max-height:0;opacity:0;transition:max-height .3s ease,opacity .3s}',
    '.fb-comment-wrap.open{max-height:180px;opacity:1}',
    '.fb-textarea{width:100%;min-height:60px;max-height:100px;padding:10px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:#e0e0e0;font-size:13px;font-family:inherit;resize:vertical;outline:none;transition:border-color .2s}',
    '.fb-textarea::placeholder{color:rgba(255,255,255,.25)}',
    '.fb-textarea:focus{border-color:#ff8844}',
    '.fb-send{margin-top:8px;padding:6px 16px;border-radius:8px;border:none;background:linear-gradient(135deg,#ff8844,#ff6622);color:#fff;font-size:12px;font-weight:600;cursor:pointer;transition:filter .2s,transform .2s}',
    '.fb-send:hover{filter:brightness(1.1);transform:translateY(-1px)}',
    '.fb-send:disabled{opacity:.4;cursor:default;transform:none;filter:none}'
  ].join('\n');
  document.head.appendChild(css);

  /* ── build widget ────────────────────────── */
  function createWidget() {
    var slug = getToolSlug();
    var existing = findExisting(slug);

    var wrap = document.createElement('div');
    wrap.className = 'fb-widget';

    var label = document.createElement('div');
    label.className = 'fb-label';
    label.textContent = 'Was this helpful?';

    var btns = document.createElement('div');
    btns.className = 'fb-btns';

    var upBtn = document.createElement('button');
    upBtn.className = 'fb-btn' + (existing && existing.rating === 'up' ? ' up' : '');
    upBtn.innerHTML = '&#x1F44D;';
    upBtn.title = 'Helpful';

    var downBtn = document.createElement('button');
    downBtn.className = 'fb-btn' + (existing && existing.rating === 'down' ? ' down' : '');
    downBtn.innerHTML = '&#x1F44E;';
    downBtn.title = 'Not helpful';

    var thanks = document.createElement('div');
    thanks.className = 'fb-thanks' + (existing ? ' show' : '');
    thanks.textContent = existing ? 'Thanks for your feedback!' : '';

    /* comment section */
    var commentWrap = document.createElement('div');
    commentWrap.className = 'fb-comment-wrap';

    var textarea = document.createElement('textarea');
    textarea.className = 'fb-textarea';
    textarea.placeholder = 'Tell us more (optional)…';
    textarea.maxLength = 500;
    if (existing && existing.comment) textarea.value = existing.comment;

    var sendBtn = document.createElement('button');
    sendBtn.className = 'fb-send';
    sendBtn.textContent = 'Send feedback';

    commentWrap.appendChild(textarea);
    commentWrap.appendChild(sendBtn);

    var currentRating = existing ? existing.rating : null;

    function persist(rating, comment) {
      var all = loadAll();
      var found = false;
      var entry = {
        tool: slug,
        rating: rating,
        comment: comment || '',
        timestamp: new Date().toISOString()
      };
      for (var i = 0; i < all.length; i++) {
        if (all[i].tool === slug) {
          all[i] = entry;
          found = true;
          break;
        }
      }
      if (!found) all.push(entry);
      saveAll(all);
      postFeedback(entry);
    }

    function vote(type) {
      if (currentRating === type) {
        /* toggle off */
        currentRating = null;
        upBtn.className = 'fb-btn';
        downBtn.className = 'fb-btn';
        thanks.className = 'fb-thanks';
        thanks.textContent = '';
        commentWrap.className = 'fb-comment-wrap';
        /* remove from storage */
        var all = loadAll().filter(function (e) { return e.tool !== slug; });
        saveAll(all);
        return;
      }
      currentRating = type;
      upBtn.className = 'fb-btn' + (type === 'up' ? ' up' : '');
      downBtn.className = 'fb-btn' + (type === 'down' ? ' down' : '');
      thanks.textContent = type === 'up' ? 'Glad it helped!' : "Thanks \u2014 we'll improve!";
      thanks.className = 'fb-thanks show';
      commentWrap.className = 'fb-comment-wrap open';
      persist(type, textarea.value.trim());
    }

    sendBtn.onclick = function () {
      if (!currentRating) return;
      var comment = textarea.value.trim();
      if (!comment) return;
      persist(currentRating, comment);
      sendBtn.textContent = 'Sent!';
      sendBtn.disabled = true;
      setTimeout(function () {
        sendBtn.textContent = 'Send feedback';
        sendBtn.disabled = false;
      }, 2000);
    };

    upBtn.onclick = function () { vote('up'); };
    downBtn.onclick = function () { vote('down'); };

    btns.appendChild(upBtn);
    btns.appendChild(downBtn);

    wrap.appendChild(label);
    wrap.appendChild(btns);
    wrap.appendChild(thanks);
    wrap.appendChild(commentWrap);

    /* if existing feedback, show comment area open */
    if (existing) {
      commentWrap.className = 'fb-comment-wrap open';
    }

    return wrap;
  }

  /* ── mount ───────────────────────────────── */
  function mount() {
    /* Try .results-section first (tool pages), fallback to main or body */
    var target = document.querySelector('.results-section') ||
                 document.querySelector('main') ||
                 document.body;

    var widget = createWidget();
    target.appendChild(widget);

    /* If results-section, show when results appear */
    if (target.classList.contains('results-section')) {
      var observer = new MutationObserver(function () {
        var vis = target.classList.contains('visible') ||
                  getComputedStyle(target).display !== 'none';
        if (vis) widget.classList.add('visible');
        else widget.classList.remove('visible');
      });
      observer.observe(target, { attributes: true, attributeFilter: ['class', 'style'] });
      var vis = target.classList.contains('visible') ||
                getComputedStyle(target).display !== 'none';
      if (vis) widget.classList.add('visible');
    } else {
      /* Show immediately on non-tool pages */
      requestAnimationFrame(function () { widget.classList.add('visible'); });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
