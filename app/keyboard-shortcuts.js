/* Keyboard Shortcuts — Cortex Freelancer
   Ctrl+Enter = Submit/Generate
   Ctrl+C     = Copy result (when not selecting text)
   Ctrl+S     = Save draft
   Ctrl+P     = Download PDF
   ?          = Toggle hint bar
*/
(function(){
  var SHORTCUTS = [
    { keys: 'Ctrl + Enter', action: 'Submit / Generate' },
    { keys: 'Ctrl + C', action: 'Copy result' },
    { keys: 'Ctrl + S', action: 'Save draft' },
    { keys: 'Ctrl + P', action: 'Download PDF' },
    { keys: '?', action: 'Toggle shortcuts' }
  ];

  // ── Hint bar ──
  var bar = document.createElement('div');
  bar.id = 'kb-hints';
  bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9999;background:rgba(17,17,24,.95);border-top:1px solid rgba(255,255,255,.08);padding:8px 16px;display:flex;gap:20px;align-items:center;justify-content:center;font-size:12px;color:#a0a0a0;font-family:Inter,sans-serif;backdrop-filter:blur(12px);transition:transform .2s;transform:translateY(100%)';
  SHORTCUTS.forEach(function(s){
    var span = document.createElement('span');
    span.innerHTML = '<kbd style="background:#222230;border:1px solid rgba(255,255,255,.1);border-radius:4px;padding:2px 6px;font-size:11px;color:#ff8844;margin-right:4px;font-family:monospace">' + s.keys + '</kbd> ' + s.action;
    bar.appendChild(span);
  });
  document.body.appendChild(bar);

  var hintVisible = false;
  function toggleHints(){
    hintVisible = !hintVisible;
    bar.style.transform = hintVisible ? 'translateY(0)' : 'translateY(100%)';
  }

  // Show hint bar briefly on first visit
  if(!localStorage.getItem('kb-seen')){
    setTimeout(function(){ toggleHints(); localStorage.setItem('kb-seen','1'); setTimeout(function(){ if(hintVisible) toggleHints(); }, 4000); }, 1500);
  }

  // ── Find buttons by common patterns ──
  function findBtn(selectors){
    for(var i=0;i<selectors.length;i++){
      var el = document.querySelector(selectors[i]);
      if(el) return el;
    }
    return null;
  }

  function getGenerateBtn(){
    return findBtn(['.generate-btn','#generateBtn','.btn-generate','.calc-btn','button[onclick*="generate"]','button[onclick*="calculate"]','button[onclick*="analyze"]','button[onclick*="check"]','button[onclick*="review"]']);
  }

  function getCopyBtn(){
    return findBtn(['.btn-copy','button[onclick*="copy"]','button[onclick*="Copy"]']);
  }

  function getSaveBtn(){
    return findBtn(['button[onclick*="saveDraft"]','button[onclick*="save"]','button[onclick*="Save"]']);
  }

  function getPdfBtn(){
    return findBtn(['button[onclick*="downloadPDF"]','button[onclick*="exportPDF"]','button[onclick*="pdf"]','button[onclick*="PDF"]']);
  }

  // ── Key handler ──
  document.addEventListener('keydown', function(e){
    var tag = (e.target.tagName||'').toLowerCase();
    var inInput = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
    var ctrl = e.ctrlKey || e.metaKey;

    // ? to toggle hints (only when not typing)
    if(!inInput && !ctrl && e.key === '?'){
      e.preventDefault();
      toggleHints();
      return;
    }

    // Ctrl+Enter — submit/generate
    if(ctrl && e.key === 'Enter'){
      e.preventDefault();
      var btn = getGenerateBtn();
      if(btn && !btn.disabled) btn.click();
      return;
    }

    // Ctrl+S — save draft
    if(ctrl && e.key === 's'){
      e.preventDefault();
      var btn = getSaveBtn();
      if(btn && !btn.disabled) btn.click();
      return;
    }

    // Ctrl+P — download PDF
    if(ctrl && e.key === 'p'){
      e.preventDefault();
      var btn = getPdfBtn();
      if(btn && !btn.disabled) btn.click();
      return;
    }

    // Ctrl+C — copy result (only when no text selected)
    if(ctrl && e.key === 'c'){
      var sel = window.getSelection();
      if(sel && sel.toString().length > 0) return; // let native copy work
      var btn = getCopyBtn();
      if(btn && !btn.disabled){
        e.preventDefault();
        btn.click();
      }
    }
  });
})();
