/* [469] Keyboard shortcuts — Ctrl+K search modal, Ctrl+1-9 jump to tool
   Works on the tools hub (index.html) */
(function(){
  var TOOLS = [
    { name: 'Rate Calculator', url: '/app/tools/rate-calculator.html' },
    { name: 'Fee Calculator', url: '/app/tools/fee-calculator.html' },
    { name: 'Invoice Generator', url: '/app/tools/invoice.html' },
    { name: 'Proposal Writer', url: '/app/tools/proposal.html' },
    { name: 'Contract Review', url: '/app/tools/contract-review.html' },
    { name: 'Email Writer', url: '/app/tools/email-writer.html' },
    { name: 'Scope Analyzer', url: '/app/tools/scope-analyzer.html' },
    { name: 'Job Scanner', url: '/app/tools/job-scanner.html' },
    { name: 'Time Tracker', url: '/app/tools/time-tracker.html' }
  ];

  // ── Search modal ──
  var overlay = document.createElement('div');
  overlay.id = 'kb-search-overlay';
  overlay.style.cssText = 'display:none;position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);align-items:flex-start;justify-content:center;padding-top:20vh';

  var modal = document.createElement('div');
  modal.style.cssText = 'background:#111118;border:1px solid rgba(255,255,255,.1);border-radius:16px;width:90%;max-width:480px;box-shadow:0 20px 60px rgba(0,0,0,.5);overflow:hidden;font-family:Inter,sans-serif';

  var header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;gap:.75rem;padding:.75rem 1rem;border-bottom:1px solid rgba(255,255,255,.06)';
  header.innerHTML = '<span style="color:#ff8844;font-size:1rem">&#128269;</span>';

  var input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Search tools...';
  input.style.cssText = 'flex:1;background:none;border:none;color:#f0f0f0;font-size:.95rem;outline:none;font-family:inherit';
  header.appendChild(input);

  var kbdHint = document.createElement('kbd');
  kbdHint.textContent = 'ESC';
  kbdHint.style.cssText = 'background:#222230;border:1px solid rgba(255,255,255,.1);border-radius:4px;padding:2px 6px;font-size:.7rem;color:#666;font-family:monospace';
  header.appendChild(kbdHint);

  var list = document.createElement('div');
  list.id = 'kb-search-list';
  list.style.cssText = 'max-height:320px;overflow-y:auto;padding:.5rem 0';

  modal.appendChild(header);
  modal.appendChild(list);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  var activeIdx = 0;

  function renderList(query){
    var q = (query || '').toLowerCase().trim();
    var filtered = TOOLS.filter(function(t){
      return !q || t.name.toLowerCase().indexOf(q) !== -1;
    });

    list.innerHTML = '';
    activeIdx = 0;

    if(!filtered.length){
      list.innerHTML = '<div style="padding:1.5rem;text-align:center;color:#666;font-size:.85rem">No tools found</div>';
      return;
    }

    filtered.forEach(function(tool, i){
      var item = document.createElement('a');
      item.href = tool.url;
      item.className = 'kb-search-item';
      item.dataset.index = i;
      item.style.cssText = 'display:flex;align-items:center;gap:.75rem;padding:.65rem 1rem;text-decoration:none;transition:background .1s;cursor:pointer;color:#f0f0f0';
      item.innerHTML = '<span style="width:24px;height:24px;border-radius:6px;background:rgba(255,136,68,.1);display:grid;place-items:center;font-size:.75rem;color:#ff8844;font-weight:700;flex-shrink:0">' + (i + 1) + '</span>' +
        '<span style="font-size:.9rem;font-weight:600">' + tool.name + '</span>';
      if(i === 0) item.style.background = 'rgba(255,136,68,.08)';
      item.addEventListener('mouseenter', function(){
        highlightItem(i);
      });
      list.appendChild(item);
    });
  }

  function highlightItem(idx){
    var items = list.querySelectorAll('.kb-search-item');
    items.forEach(function(el, i){
      el.style.background = i === idx ? 'rgba(255,136,68,.08)' : 'none';
    });
    activeIdx = idx;
  }

  function openModal(){
    overlay.style.display = 'flex';
    input.value = '';
    renderList('');
    setTimeout(function(){ input.focus(); }, 50);
  }

  function closeModal(){
    overlay.style.display = 'none';
  }

  function navigateToActive(){
    var items = list.querySelectorAll('.kb-search-item');
    if(items[activeIdx]) items[activeIdx].click();
  }

  overlay.addEventListener('click', function(e){
    if(e.target === overlay) closeModal();
  });

  input.addEventListener('input', function(){
    renderList(this.value);
  });

  input.addEventListener('keydown', function(e){
    var items = list.querySelectorAll('.kb-search-item');
    if(e.key === 'ArrowDown'){
      e.preventDefault();
      activeIdx = Math.min(activeIdx + 1, items.length - 1);
      highlightItem(activeIdx);
    } else if(e.key === 'ArrowUp'){
      e.preventDefault();
      activeIdx = Math.max(activeIdx - 1, 0);
      highlightItem(activeIdx);
    } else if(e.key === 'Enter'){
      e.preventDefault();
      navigateToActive();
    } else if(e.key === 'Escape'){
      closeModal();
    }
  });

  // ── Global key handler ──
  document.addEventListener('keydown', function(e){
    var tag = (e.target.tagName || '').toLowerCase();
    var inInput = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
    var ctrl = e.ctrlKey || e.metaKey;

    // Ctrl+K — open search modal
    if(ctrl && e.key === 'k'){
      e.preventDefault();
      if(overlay.style.display === 'flex') closeModal();
      else openModal();
      return;
    }

    // Ctrl+1-9 — jump to tool (only when not typing)
    if(ctrl && !inInput && e.key >= '1' && e.key <= '9'){
      var idx = parseInt(e.key) - 1;
      if(TOOLS[idx]){
        e.preventDefault();
        window.location.href = TOOLS[idx].url;
      }
    }
  });
})();
