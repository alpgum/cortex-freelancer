/* ===== SHARE + FEEDBACK — auto-injected on tool pages ===== */
(function () {
  'use strict';

  /* ── CSS ── */
  var css = document.createElement('style');
  css.textContent = '' +
    /* Share bar */
    '.cortex-share-bar{display:flex;align-items:center;gap:.6rem;margin-top:1.25rem;padding:1rem 0;border-top:1px solid rgba(255,255,255,.06);flex-wrap:wrap}' +
    '.cortex-share-bar .share-label{font-size:.75rem;color:var(--text3,#666);text-transform:uppercase;letter-spacing:.5px;font-weight:600}' +
    '.cortex-share-btn{display:inline-flex;align-items:center;gap:.35rem;padding:.45rem .9rem;border-radius:100px;border:1px solid rgba(255,255,255,.1);background:var(--bg3,#1a1a24);color:var(--text2,#a0a0a0);font-size:.78rem;font-weight:600;cursor:pointer;transition:all .2s;font-family:inherit}' +
    '.cortex-share-btn:hover{border-color:var(--orange,#ff8844);color:var(--orange,#ff8844)}' +
    '.cortex-share-btn.copied{border-color:var(--green,#00ff88);color:var(--green,#00ff88)}' +
    '.cortex-share-btn svg{width:14px;height:14px;fill:currentColor}' +

    /* Feedback widget (fixed bottom-right) */
    '.cortex-feedback{position:fixed;bottom:1.5rem;right:1.5rem;z-index:999;font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif}' +
    '.cortex-fb-trigger{display:flex;align-items:center;gap:.4rem;padding:.55rem 1rem;border-radius:100px;background:var(--bg2,#111118);border:1px solid rgba(255,255,255,.08);color:var(--text2,#a0a0a0);font-size:.8rem;font-weight:600;cursor:pointer;transition:all .25s;box-shadow:0 4px 20px rgba(0,0,0,.4)}' +
    '.cortex-fb-trigger:hover{border-color:var(--orange,#ff8844);color:var(--text,#f0f0f0)}' +
    '.cortex-fb-panel{position:absolute;bottom:calc(100% + .75rem);right:0;width:280px;background:var(--bg2,#111118);border:1px solid rgba(255,255,255,.08);border-radius:var(--radius,16px);padding:1.25rem;box-shadow:0 12px 40px rgba(0,0,0,.5);display:none;animation:cortexFbIn .2s ease}' +
    '.cortex-fb-panel.open{display:block}' +
    '@keyframes cortexFbIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}' +
    '.cortex-fb-title{font-size:.85rem;font-weight:700;color:var(--text,#f0f0f0);margin-bottom:.75rem}' +
    '.cortex-fb-thumbs{display:flex;gap:.5rem;margin-bottom:.75rem}' +
    '.cortex-fb-thumb{flex:1;padding:.5rem;border-radius:var(--radius-sm,10px);border:1px solid rgba(255,255,255,.08);background:var(--bg3,#1a1a24);cursor:pointer;font-size:1.3rem;text-align:center;transition:all .2s}' +
    '.cortex-fb-thumb:hover{border-color:var(--orange,#ff8844)}' +
    '.cortex-fb-thumb.selected{border-color:var(--green,#00ff88);background:rgba(0,255,136,.08)}' +
    '.cortex-fb-text{width:100%;padding:.5rem .7rem;border-radius:var(--radius-sm,10px);border:1px solid rgba(255,255,255,.08);background:var(--bg3,#1a1a24);color:var(--text,#f0f0f0);font-size:.8rem;font-family:inherit;resize:none;outline:none;min-height:56px;transition:border-color .2s}' +
    '.cortex-fb-text:focus{border-color:var(--orange,#ff8844)}' +
    '.cortex-fb-text::placeholder{color:var(--text3,#666)}' +
    '.cortex-fb-send{width:100%;margin-top:.6rem;padding:.5rem;border:none;border-radius:var(--radius-sm,10px);background:linear-gradient(135deg,var(--orange,#ff8844),var(--orange2,#ff6622));color:#fff;font-size:.8rem;font-weight:700;cursor:pointer;transition:all .2s;font-family:inherit}' +
    '.cortex-fb-send:hover{filter:brightness(1.1)}' +
    '.cortex-fb-send:disabled{opacity:.4;cursor:default}' +
    '.cortex-fb-thanks{text-align:center;padding:1rem 0;color:var(--green,#00ff88);font-size:.85rem;font-weight:600}' +
    '@media(max-width:640px){.cortex-feedback{bottom:1rem;right:1rem}.cortex-fb-panel{width:260px}}';
  document.head.appendChild(css);

  /* ── Helpers ── */
  function getToolName() {
    var path = location.pathname;
    var m = path.match(/\/tools\/([^/.]+)/);
    return m ? m[1] : 'tool';
  }

  function getShareUrl() {
    return location.href.split('#')[0].split('?')[0];
  }

  /* ── Share bar injection ── */
  function createShareBar() {
    var bar = document.createElement('div');
    bar.className = 'cortex-share-bar';
    bar.innerHTML = '' +
      '<span class="share-label">Share this result</span>' +
      '<button class="cortex-share-btn" data-action="copy">' +
        '<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>' +
        'Copy link' +
      '</button>' +
      '<button class="cortex-share-btn" data-action="twitter">' +
        '<svg viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>' +
        'Tweet' +
      '</button>';

    bar.querySelector('[data-action="copy"]').addEventListener('click', function () {
      var btn = this;
      var url = getShareUrl();
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function () {
          btn.classList.add('copied');
          btn.querySelector('svg + *') || null;
          var txt = btn.childNodes[btn.childNodes.length - 1];
          var orig = txt.textContent;
          txt.textContent = 'Copied!';
          setTimeout(function () { btn.classList.remove('copied'); txt.textContent = orig; }, 2000);
        });
      } else {
        /* fallback */
        var ta = document.createElement('textarea');
        ta.value = url; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy');
        document.body.removeChild(ta);
        btn.classList.add('copied');
        var txt = btn.childNodes[btn.childNodes.length - 1];
        var orig = txt.textContent;
        txt.textContent = 'Copied!';
        setTimeout(function () { btn.classList.remove('copied'); txt.textContent = orig; }, 2000);
      }
    });

    bar.querySelector('[data-action="twitter"]').addEventListener('click', function () {
      var tool = getToolName().replace(/-/g, ' ');
      var text = 'Just used the ' + tool + ' on Cortex Freelancer — check it out!';
      var url = getShareUrl();
      var tw = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(url);
      window.open(tw, '_blank', 'width=550,height=420');
    });

    return bar;
  }

  function injectShareBars() {
    /* Target all result containers across tools */
    var selectors = '.results.visible, .results-section.visible, .calc-result.visible';
    var containers = document.querySelectorAll(selectors);
    containers.forEach(function (el) {
      if (el.querySelector('.cortex-share-bar')) return; /* already injected */
      el.appendChild(createShareBar());
    });
  }

  /* Observe class changes to detect results becoming visible */
  var observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      if (m.type === 'attributes' && m.attributeName === 'class') {
        var el = m.target;
        if (el.classList.contains('visible') &&
            (el.classList.contains('results') || el.classList.contains('results-section') || el.classList.contains('calc-result'))) {
          /* Small delay so the tool's own rendering finishes first */
          setTimeout(injectShareBars, 100);
        }
      }
    });
  });

  /* Observe existing result containers */
  var targets = document.querySelectorAll('.results, .results-section, .calc-result, #results, #calc-result');
  targets.forEach(function (el) {
    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
  });

  /* Also run once in case results are already visible (e.g. page reload) */
  setTimeout(injectShareBars, 500);


  /* ── Feedback widget ── */
  var STORAGE_KEY = 'cortex_feedback';

  var widget = document.createElement('div');
  widget.className = 'cortex-feedback';
  widget.innerHTML = '' +
    '<div class="cortex-fb-panel" id="cortex-fb-panel">' +
      '<div class="cortex-fb-title">How was this tool?</div>' +
      '<div class="cortex-fb-thumbs">' +
        '<button class="cortex-fb-thumb" data-vote="up" aria-label="Thumbs up">&#128077;</button>' +
        '<button class="cortex-fb-thumb" data-vote="down" aria-label="Thumbs down">&#128078;</button>' +
      '</div>' +
      '<textarea class="cortex-fb-text" placeholder="Any details? (optional)" maxlength="500"></textarea>' +
      '<button class="cortex-fb-send" disabled>Send feedback</button>' +
    '</div>' +
    '<button class="cortex-fb-trigger" id="cortex-fb-trigger">' +
      '<span>&#128172;</span> Feedback' +
    '</button>';

  document.body.appendChild(widget);

  var trigger = document.getElementById('cortex-fb-trigger');
  var panel = document.getElementById('cortex-fb-panel');
  var thumbBtns = panel.querySelectorAll('.cortex-fb-thumb');
  var textArea = panel.querySelector('.cortex-fb-text');
  var sendBtn = panel.querySelector('.cortex-fb-send');
  var selectedVote = null;

  trigger.addEventListener('click', function () {
    panel.classList.toggle('open');
  });

  /* Close panel on outside click */
  document.addEventListener('click', function (e) {
    if (!widget.contains(e.target)) {
      panel.classList.remove('open');
    }
  });

  thumbBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      thumbBtns.forEach(function (b) { b.classList.remove('selected'); });
      btn.classList.add('selected');
      selectedVote = btn.getAttribute('data-vote');
      sendBtn.disabled = false;
    });
  });

  sendBtn.addEventListener('click', function () {
    if (!selectedVote) return;

    var entry = {
      tool: getToolName(),
      vote: selectedVote,
      text: textArea.value.trim(),
      url: getShareUrl(),
      ts: new Date().toISOString()
    };

    /* Save to localStorage */
    var existing = [];
    try { existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch (e) {}
    existing.push(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));

    /* Show thanks */
    var inner = panel.innerHTML;
    panel.innerHTML = '<div class="cortex-fb-thanks">Thanks for your feedback!</div>';
    setTimeout(function () {
      panel.classList.remove('open');
      /* Reset for next use */
      panel.innerHTML = inner;
      /* Re-bind events after reset */
      rebindPanel();
    }, 1800);
  });

  function rebindPanel() {
    var newThumbs = panel.querySelectorAll('.cortex-fb-thumb');
    textArea = panel.querySelector('.cortex-fb-text');
    sendBtn = panel.querySelector('.cortex-fb-send');
    selectedVote = null;

    newThumbs.forEach(function (btn) {
      btn.addEventListener('click', function () {
        newThumbs.forEach(function (b) { b.classList.remove('selected'); });
        btn.classList.add('selected');
        selectedVote = btn.getAttribute('data-vote');
        sendBtn.disabled = false;
      });
    });

    sendBtn.addEventListener('click', function () {
      if (!selectedVote) return;
      var entry = {
        tool: getToolName(),
        vote: selectedVote,
        text: textArea.value.trim(),
        url: getShareUrl(),
        ts: new Date().toISOString()
      };
      var existing = [];
      try { existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch (e) {}
      existing.push(entry);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));

      panel.innerHTML = '<div class="cortex-fb-thanks">Thanks for your feedback!</div>';
      setTimeout(function () {
        panel.classList.remove('open');
        panel.innerHTML = '' +
          '<div class="cortex-fb-title">How was this tool?</div>' +
          '<div class="cortex-fb-thumbs">' +
            '<button class="cortex-fb-thumb" data-vote="up" aria-label="Thumbs up">&#128077;</button>' +
            '<button class="cortex-fb-thumb" data-vote="down" aria-label="Thumbs down">&#128078;</button>' +
          '</div>' +
          '<textarea class="cortex-fb-text" placeholder="Any details? (optional)" maxlength="500"></textarea>' +
          '<button class="cortex-fb-send" disabled>Send feedback</button>';
        rebindPanel();
      }, 1800);
    });
  }

})();
