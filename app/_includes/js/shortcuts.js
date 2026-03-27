/* Unified Keyboard Shortcuts System — Cortex Freelancer
   Cmd/Ctrl+K  = Tool search (command palette)
   Cmd/Ctrl+T  = Start/stop time tracker
   Cmd/Ctrl+N  = New (context-aware: project, invoice, proposal)
   Cmd/Ctrl+S  = Save current work
   Escape      = Close modals/overlays
   ?           = Shortcut help overlay
   Cmd/Ctrl+Enter = Submit/Generate
   Cmd/Ctrl+P  = Download PDF
   Shortcuts are customizable via localStorage
*/
(function(){
  'use strict';

  var STORAGE_KEY = 'cortex_shortcuts_custom';
  var SEEN_KEY = 'cortex_shortcuts_seen';

  // ── Default shortcut map ──
  var DEFAULTS = {
    toolSearch:  { mod: true,  key: 'k',     label: '⌘K',           desc: 'Search tools' },
    timer:       { mod: true,  key: 't',     label: '⌘T',           desc: 'Start / stop timer' },
    newItem:     { mod: true,  key: 'n',     label: '⌘N',           desc: 'New item (contextual)' },
    save:        { mod: true,  key: 's',     label: '⌘S',           desc: 'Save current' },
    submit:      { mod: true,  key: 'Enter', label: '⌘Enter',       desc: 'Submit / Generate' },
    downloadPdf: { mod: true,  key: 'p',     label: '⌘P',           desc: 'Download PDF' },
    copyResult:  { mod: true,  key: 'c',     label: '⌘C',           desc: 'Copy result' },
    closeModal:  { mod: false, key: 'Escape',label: 'Esc',          desc: 'Close modal' },
    helpOverlay: { mod: false, key: '?',     label: '?',            desc: 'Shortcut help' }
  };

  // ── Load user customizations ──
  var shortcuts = {};
  try {
    var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    Object.keys(DEFAULTS).forEach(function(id){
      shortcuts[id] = saved[id] ? Object.assign({}, DEFAULTS[id], saved[id]) : Object.assign({}, DEFAULTS[id]);
    });
  } catch(e){ shortcuts = JSON.parse(JSON.stringify(DEFAULTS)); }

  // ── TOOLS list — pull from nav.js or use fallback ──
  function getTools(){
    if(window.CortexNav && window.CortexNav.tools) return window.CortexNav.tools;
    var navEl = document.querySelector('[data-tools-json]');
    if(navEl) try { return JSON.parse(navEl.dataset.toolsJson); } catch(e){}
    return [
      { name: 'Rate Calculator',   icon: '💰', href: '/app/tools/rate-calculator.html' },
      { name: 'Fee Calculator',    icon: '📊', href: '/app/tools/fee-calculator.html' },
      { name: 'Invoice Generator', icon: '🧾', href: '/app/tools/invoice.html' },
      { name: 'Proposal Writer',   icon: '📝', href: '/app/tools/proposal.html' },
      { name: 'Contract Review',   icon: '📑', href: '/app/tools/contract-review.html' },
      { name: 'Email Writer',      icon: '✉️',  href: '/app/tools/email-writer.html' },
      { name: 'Scope Analyzer',    icon: '🔍', href: '/app/tools/scope-analyzer.html' },
      { name: 'Job Scanner',       icon: '🎯', href: '/app/tools/job-scanner.html' },
      { name: 'Time Tracker',      icon: '⏱',  href: '/app/tools/time-tracker.html' },
      { name: 'Project Tracker',   icon: '📋', href: '/app/tools/project-tracker.html' },
      { name: 'Bio Generator',     icon: '✍️',  href: '/app/tools/bio-generator.html' },
      { name: 'Portfolio Review',   icon: '🖼',  href: '/app/tools/portfolio-review.html' },
      { name: 'Tax Estimator',     icon: '🏦', href: '/app/tools/tax-estimator.html' },
      { name: 'Meeting Notes',     icon: '📓', href: '/app/tools/meeting-notes.html' },
      { name: 'SOW Generator',     icon: '📄', href: '/app/tools/sow-generator.html' },
      { name: 'Weekly Summary',    icon: '📅', href: '/app/tools/weekly-summary.html' },
      { name: 'Client CRM',        icon: '👥', href: '/app/tools/client-crm.html' },
      { name: 'Payment Checker',   icon: '💳', href: '/app/tools/payment-checker.html' },
      { name: 'Income Dashboard',  icon: '📈', href: '/app/tools/income-dashboard.html' },
      { name: 'Job Digest',        icon: '📬', href: '/app/tools/job-digest.html' },
      { name: 'Templates',         icon: '📋', href: '/app/tools/templates.html' },
      { name: 'Project Brief',     icon: '📁', href: '/app/tools/project-brief.html' }
    ];
  }

  // ── Utility: is user typing in an input? ──
  function isInputFocused(){
    var tag = (document.activeElement.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || document.activeElement.isContentEditable;
  }

  // ── Utility: find first matching button ──
  function findBtn(selectors){
    for(var i = 0; i < selectors.length; i++){
      var el = document.querySelector(selectors[i]);
      if(el) return el;
    }
    return null;
  }

  // ── Detect current page context for Cmd+N ──
  function detectContext(){
    var path = window.location.pathname;
    if(path.indexOf('invoice') !== -1)       return { label: 'Invoice',  action: 'newInvoice' };
    if(path.indexOf('proposal') !== -1)      return { label: 'Proposal', action: 'newProposal' };
    if(path.indexOf('project') !== -1)       return { label: 'Project',  action: 'newProject' };
    if(path.indexOf('client-crm') !== -1)    return { label: 'Client',   action: 'newClient' };
    if(path.indexOf('time-tracker') !== -1)  return { label: 'Entry',    action: 'newTimeEntry' };
    if(path.indexOf('templates') !== -1)     return { label: 'Template', action: 'newTemplate' };
    if(path.indexOf('meeting') !== -1)       return { label: 'Meeting',  action: 'newMeeting' };
    return { label: 'Item', action: 'newGeneric' };
  }

  // ═══════════════════════════════════════════
  // COMMAND PALETTE (Cmd+K)
  // ═══════════════════════════════════════════

  var paletteOpen = false;
  var paletteOverlay = null;
  var paletteInput = null;
  var paletteList = null;
  var paletteIdx = 0;
  var prevFocus = null;

  function buildPalette(){
    if(paletteOverlay) return;

    paletteOverlay = document.createElement('div');
    paletteOverlay.id = 'cx-palette';
    paletteOverlay.setAttribute('role', 'dialog');
    paletteOverlay.setAttribute('aria-modal', 'true');
    paletteOverlay.setAttribute('aria-label', 'Command palette');
    paletteOverlay.style.cssText = 'display:none;position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);align-items:flex-start;justify-content:center;padding-top:18vh';

    var box = document.createElement('div');
    box.style.cssText = 'background:var(--bg2,#111118);border:1px solid rgba(255,255,255,.1);border-radius:16px;width:92%;max-width:520px;box-shadow:0 20px 60px rgba(0,0,0,.5);overflow:hidden;font-family:Inter,system-ui,sans-serif';

    // Header
    var hdr = document.createElement('div');
    hdr.style.cssText = 'display:flex;align-items:center;gap:.75rem;padding:.75rem 1rem;border-bottom:1px solid rgba(255,255,255,.06)';

    paletteInput = document.createElement('input');
    paletteInput.type = 'text';
    paletteInput.placeholder = 'Search tools…';
    paletteInput.setAttribute('aria-label', 'Search tools');
    paletteInput.style.cssText = 'flex:1;background:none;border:none;color:var(--text,#f0f0f0);font-size:.95rem;outline:none;font-family:inherit';

    var esc = document.createElement('kbd');
    esc.textContent = 'ESC';
    esc.style.cssText = 'background:var(--bg3,#222230);border:1px solid rgba(255,255,255,.1);border-radius:4px;padding:2px 6px;font-size:.65rem;color:#666;font-family:monospace';

    hdr.appendChild(paletteInput);
    hdr.appendChild(esc);

    paletteList = document.createElement('div');
    paletteList.setAttribute('role', 'listbox');
    paletteList.style.cssText = 'max-height:360px;overflow-y:auto;padding:.25rem 0';

    box.appendChild(hdr);
    box.appendChild(paletteList);
    paletteOverlay.appendChild(box);
    document.body.appendChild(paletteOverlay);

    // Events
    paletteOverlay.addEventListener('click', function(e){
      if(e.target === paletteOverlay) closePalette();
    });

    paletteInput.addEventListener('input', function(){
      renderPaletteList(this.value);
    });

    paletteInput.addEventListener('keydown', function(e){
      var items = paletteList.querySelectorAll('.cx-pal-item');
      if(e.key === 'ArrowDown'){
        e.preventDefault();
        paletteIdx = Math.min(paletteIdx + 1, items.length - 1);
        highlightPalette(paletteIdx);
      } else if(e.key === 'ArrowUp'){
        e.preventDefault();
        paletteIdx = Math.max(paletteIdx - 1, 0);
        highlightPalette(paletteIdx);
      } else if(e.key === 'Enter'){
        e.preventDefault();
        if(items[paletteIdx]) items[paletteIdx].click();
      } else if(e.key === 'Escape'){
        closePalette();
      }
    });
  }

  function renderPaletteList(query){
    var q = (query || '').toLowerCase().trim();
    var tools = getTools();
    var recent = [];
    try { recent = JSON.parse(localStorage.getItem('cortex_nav_recent') || '[]'); } catch(e){}

    var filtered = tools.filter(function(t){
      return !q || (t.name || '').toLowerCase().indexOf(q) !== -1;
    });

    // Sort: recent first when no query
    if(!q && recent.length){
      filtered.sort(function(a, b){
        var ai = recent.indexOf(a.href || a.url);
        var bi = recent.indexOf(b.href || b.url);
        if(ai !== -1 && bi === -1) return -1;
        if(ai === -1 && bi !== -1) return 1;
        if(ai !== -1 && bi !== -1) return ai - bi;
        return 0;
      });
    }

    paletteList.innerHTML = '';
    paletteIdx = 0;

    if(!filtered.length){
      paletteList.innerHTML = '<div style="padding:1.5rem;text-align:center;color:#666;font-size:.85rem">No tools found</div>';
      return;
    }

    filtered.forEach(function(tool, i){
      var a = document.createElement('a');
      a.href = tool.href || tool.url;
      a.className = 'cx-pal-item';
      a.setAttribute('role', 'option');
      a.style.cssText = 'display:flex;align-items:center;gap:.75rem;padding:.6rem 1rem;text-decoration:none;color:var(--text,#f0f0f0);transition:background .1s;cursor:pointer';
      if(i === 0) a.style.background = 'rgba(255,136,68,.08)';

      var icon = document.createElement('span');
      icon.style.cssText = 'width:28px;height:28px;border-radius:8px;background:rgba(255,136,68,.1);display:grid;place-items:center;font-size:.85rem;flex-shrink:0';
      icon.textContent = tool.icon || '🔧';

      var name = document.createElement('span');
      name.style.cssText = 'font-size:.9rem;font-weight:600;flex:1';
      name.textContent = tool.name;

      a.appendChild(icon);
      a.appendChild(name);

      a.addEventListener('mouseenter', function(){ highlightPalette(i); });
      a.addEventListener('click', function(){
        // Track as recent
        var url = tool.href || tool.url;
        var r = recent.filter(function(u){ return u !== url; });
        r.unshift(url);
        if(r.length > 8) r = r.slice(0, 8);
        try { localStorage.setItem('cortex_nav_recent', JSON.stringify(r)); } catch(e){}
      });

      paletteList.appendChild(a);
    });
  }

  function highlightPalette(idx){
    var items = paletteList.querySelectorAll('.cx-pal-item');
    items.forEach(function(el, i){
      el.style.background = i === idx ? 'rgba(255,136,68,.08)' : 'none';
    });
    paletteIdx = idx;
    if(items[idx]) items[idx].scrollIntoView({ block: 'nearest' });
  }

  function openPalette(){
    buildPalette();
    prevFocus = document.activeElement;
    paletteOverlay.style.display = 'flex';
    paletteInput.value = '';
    renderPaletteList('');
    paletteOpen = true;
    setTimeout(function(){ paletteInput.focus(); }, 30);
  }

  function closePalette(){
    if(!paletteOverlay) return;
    paletteOverlay.style.display = 'none';
    paletteOpen = false;
    if(prevFocus) try { prevFocus.focus(); } catch(e){}
    prevFocus = null;
  }

  // ═══════════════════════════════════════════
  // HELP OVERLAY (?)
  // ═══════════════════════════════════════════

  var helpOpen = false;
  var helpOverlay = null;

  function buildHelpOverlay(){
    if(helpOverlay) return;

    helpOverlay = document.createElement('div');
    helpOverlay.id = 'cx-help';
    helpOverlay.setAttribute('role', 'dialog');
    helpOverlay.setAttribute('aria-label', 'Keyboard shortcuts');
    helpOverlay.style.cssText = 'display:none;position:fixed;inset:0;z-index:10002;background:rgba(0,0,0,.65);backdrop-filter:blur(4px);align-items:center;justify-content:center';

    var box = document.createElement('div');
    box.style.cssText = 'background:var(--bg2,#111118);border:1px solid rgba(255,255,255,.1);border-radius:16px;width:92%;max-width:440px;padding:1.5rem;box-shadow:0 20px 60px rgba(0,0,0,.5);font-family:Inter,system-ui,sans-serif';

    var title = document.createElement('h3');
    title.textContent = 'Keyboard Shortcuts';
    title.style.cssText = 'margin:0 0 1rem;font-size:1rem;color:var(--text,#f0f0f0);font-weight:700';

    var grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:auto 1fr;gap:.5rem .75rem;align-items:center';

    Object.keys(shortcuts).forEach(function(id){
      var s = shortcuts[id];
      var kbd = document.createElement('kbd');
      kbd.textContent = s.label;
      kbd.style.cssText = 'background:var(--bg3,#222230);border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:4px 10px;font-size:.8rem;color:#ff8844;font-family:monospace;text-align:center;min-width:60px;display:inline-block';

      var desc = document.createElement('span');
      desc.textContent = s.desc;
      desc.style.cssText = 'font-size:.85rem;color:var(--text,#ccc)';

      grid.appendChild(kbd);
      grid.appendChild(desc);
    });

    var footer = document.createElement('div');
    footer.style.cssText = 'margin-top:1.25rem;padding-top:.75rem;border-top:1px solid rgba(255,255,255,.06);display:flex;justify-content:space-between;align-items:center';

    var customBtn = document.createElement('button');
    customBtn.textContent = 'Customize…';
    customBtn.style.cssText = 'background:none;border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:6px 14px;color:#ff8844;font-size:.8rem;cursor:pointer;font-family:inherit';
    customBtn.addEventListener('click', function(){ closeHelp(); openCustomizer(); });

    var closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = 'background:rgba(255,136,68,.1);border:none;border-radius:8px;padding:6px 18px;color:#ff8844;font-size:.8rem;cursor:pointer;font-family:inherit;font-weight:600';
    closeBtn.addEventListener('click', closeHelp);

    footer.appendChild(customBtn);
    footer.appendChild(closeBtn);

    box.appendChild(title);
    box.appendChild(grid);
    box.appendChild(footer);
    helpOverlay.appendChild(box);
    document.body.appendChild(helpOverlay);

    helpOverlay.addEventListener('click', function(e){
      if(e.target === helpOverlay) closeHelp();
    });
  }

  function openHelp(){
    buildHelpOverlay();
    helpOverlay.style.display = 'flex';
    helpOpen = true;
  }

  function closeHelp(){
    if(!helpOverlay) return;
    helpOverlay.style.display = 'none';
    helpOpen = false;
  }

  // ═══════════════════════════════════════════
  // CUSTOMIZER
  // ═══════════════════════════════════════════

  function openCustomizer(){
    if(typeof Modal === 'undefined' || !Modal.open) return openCustomizerFallback();

    var content = document.createElement('div');
    content.style.cssText = 'font-family:Inter,system-ui,sans-serif';

    var desc = document.createElement('p');
    desc.textContent = 'Click a shortcut key to rebind it. Press the new key combo to assign.';
    desc.style.cssText = 'font-size:.85rem;color:#999;margin:0 0 1rem';
    content.appendChild(desc);

    var rows = document.createElement('div');
    rows.style.cssText = 'display:flex;flex-direction:column;gap:.5rem';

    Object.keys(shortcuts).forEach(function(id){
      var s = shortcuts[id];
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:.5rem;border-radius:8px;background:rgba(255,255,255,.03)';

      var label = document.createElement('span');
      label.textContent = s.desc;
      label.style.cssText = 'font-size:.85rem;color:var(--text,#ccc)';

      var keyBtn = document.createElement('button');
      keyBtn.textContent = s.label;
      keyBtn.dataset.shortcutId = id;
      keyBtn.style.cssText = 'background:var(--bg3,#222230);border:1px solid rgba(255,255,255,.15);border-radius:6px;padding:4px 12px;font-size:.8rem;color:#ff8844;cursor:pointer;font-family:monospace;min-width:70px';

      keyBtn.addEventListener('click', function(){
        keyBtn.textContent = '…press key…';
        keyBtn.style.borderColor = '#ff8844';

        function captureKey(e){
          e.preventDefault();
          e.stopPropagation();
          document.removeEventListener('keydown', captureKey, true);

          if(e.key === 'Escape'){
            keyBtn.textContent = s.label;
            keyBtn.style.borderColor = 'rgba(255,255,255,.15)';
            return;
          }

          var mod = e.ctrlKey || e.metaKey;
          var newKey = e.key;
          var newLabel = (mod ? '⌘' : '') + (newKey.length === 1 ? newKey.toUpperCase() : newKey);

          shortcuts[id].mod = mod;
          shortcuts[id].key = newKey;
          shortcuts[id].label = newLabel;

          keyBtn.textContent = newLabel;
          keyBtn.style.borderColor = 'rgba(255,255,255,.15)';

          saveCustomizations();
        }

        document.addEventListener('keydown', captureKey, true);
      });

      row.appendChild(label);
      row.appendChild(keyBtn);
      rows.appendChild(row);
    });

    content.appendChild(rows);

    var resetRow = document.createElement('div');
    resetRow.style.cssText = 'margin-top:1rem;text-align:center';
    var resetBtn = document.createElement('button');
    resetBtn.textContent = 'Reset to defaults';
    resetBtn.style.cssText = 'background:none;border:none;color:#666;font-size:.8rem;cursor:pointer;text-decoration:underline';
    resetBtn.addEventListener('click', function(){
      localStorage.removeItem(STORAGE_KEY);
      shortcuts = JSON.parse(JSON.stringify(DEFAULTS));
      // Rebuild help overlay on next open
      if(helpOverlay){ helpOverlay.remove(); helpOverlay = null; }
      if(typeof Modal !== 'undefined') Modal.close();
    });
    resetRow.appendChild(resetBtn);
    content.appendChild(resetRow);

    Modal.open({
      title: 'Customize Shortcuts',
      content: content,
      size: 'sm',
      showClose: true
    });
  }

  function openCustomizerFallback(){
    // Minimal fallback if Modal isn't loaded
    openHelp();
  }

  function saveCustomizations(){
    var toSave = {};
    Object.keys(shortcuts).forEach(function(id){
      var d = DEFAULTS[id];
      var s = shortcuts[id];
      if(s.key !== d.key || s.mod !== d.mod){
        toSave[id] = { key: s.key, mod: s.mod, label: s.label };
      }
    });
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave)); } catch(e){}
    // Rebuild help overlay on next open
    if(helpOverlay){ helpOverlay.remove(); helpOverlay = null; }
  }

  // ═══════════════════════════════════════════
  // ACTION HANDLERS
  // ═══════════════════════════════════════════

  function handleTimer(){
    // If on the time-tracker page, toggle the timer button
    var btn = findBtn([
      '#timerToggle', '.timer-toggle', 'button[onclick*="toggleTimer"]',
      'button[onclick*="startTimer"]', 'button[onclick*="Timer"]',
      '.start-btn', '#startBtn'
    ]);
    if(btn){
      btn.click();
      return;
    }
    // Otherwise navigate to time tracker
    window.location.href = '/app/tools/time-tracker.html';
  }

  function handleNewItem(){
    var ctx = detectContext();
    // Try to find a "New" or "Clear" or "Reset" button on the current page
    var btn = findBtn([
      'button[onclick*="new"]', 'button[onclick*="New"]',
      'button[onclick*="clear"]', 'button[onclick*="Clear"]',
      'button[onclick*="reset"]', '.btn-new', '#newBtn', '#clearBtn',
      'button[onclick*="addEntry"]', 'button[onclick*="addRow"]',
      'button[onclick*="addClient"]', 'button[onclick*="addProject"]'
    ]);
    if(btn){
      btn.click();
      return;
    }
    // Fallback: navigate to appropriate tool
    var routes = {
      newInvoice:   '/app/tools/invoice.html',
      newProposal:  '/app/tools/proposal.html',
      newProject:   '/app/tools/project-tracker.html',
      newClient:    '/app/tools/client-crm.html',
      newTimeEntry: '/app/tools/time-tracker.html',
      newTemplate:  '/app/tools/templates.html',
      newMeeting:   '/app/tools/meeting-notes.html',
      newGeneric:   '/app/tools/index.html'
    };
    if(routes[ctx.action]) window.location.href = routes[ctx.action];
  }

  function handleSave(){
    var btn = findBtn([
      'button[onclick*="saveDraft"]', 'button[onclick*="save"]',
      'button[onclick*="Save"]', '.btn-save', '#saveBtn'
    ]);
    if(btn && !btn.disabled) btn.click();
  }

  function handleSubmit(){
    var btn = findBtn([
      '.generate-btn', '#generateBtn', '.btn-generate', '.calc-btn',
      'button[onclick*="generate"]', 'button[onclick*="calculate"]',
      'button[onclick*="analyze"]', 'button[onclick*="check"]',
      'button[onclick*="review"]', 'button[onclick*="submit"]',
      'button[type="submit"]'
    ]);
    if(btn && !btn.disabled) btn.click();
  }

  function handlePdf(){
    var btn = findBtn([
      'button[onclick*="downloadPDF"]', 'button[onclick*="exportPDF"]',
      'button[onclick*="pdf"]', 'button[onclick*="PDF"]',
      '.btn-pdf', '#pdfBtn'
    ]);
    if(btn && !btn.disabled) btn.click();
  }

  function handleCopy(){
    var sel = window.getSelection();
    if(sel && sel.toString().length > 0) return false; // let native copy work
    var btn = findBtn(['.btn-copy', 'button[onclick*="copy"]', 'button[onclick*="Copy"]']);
    if(btn && !btn.disabled){ btn.click(); return true; }
    return false;
  }

  function handleCloseModal(){
    // Close palette first
    if(paletteOpen){ closePalette(); return; }
    // Close help overlay
    if(helpOpen){ closeHelp(); return; }
    // Close Modal system
    if(typeof Modal !== 'undefined' && Modal.close) Modal.close();
    // Close any visible overlay with common patterns
    var overlays = document.querySelectorAll('.modal-backdrop, [data-modal-backdrop]');
    overlays.forEach(function(el){ el.style.display = 'none'; });
  }

  // ═══════════════════════════════════════════
  // MAIN KEY HANDLER
  // ═══════════════════════════════════════════

  function matchesShortcut(e, sc){
    var ctrl = e.ctrlKey || e.metaKey;
    if(sc.mod && !ctrl) return false;
    if(!sc.mod && ctrl) return false;
    return e.key === sc.key || e.key.toLowerCase() === sc.key.toLowerCase();
  }

  document.addEventListener('keydown', function(e){
    var inInput = isInputFocused();
    var s = shortcuts;

    // Cmd+K — always works, even in inputs (like Spotlight)
    if(matchesShortcut(e, s.toolSearch)){
      e.preventDefault();
      if(paletteOpen) closePalette(); else openPalette();
      return;
    }

    // Escape — always works
    if(matchesShortcut(e, s.closeModal)){
      handleCloseModal();
      return;
    }

    // Cmd+Enter — works in inputs (submit form)
    if(matchesShortcut(e, s.submit)){
      e.preventDefault();
      handleSubmit();
      return;
    }

    // Cmd+S — works everywhere (prevent browser save)
    if(matchesShortcut(e, s.save)){
      e.preventDefault();
      handleSave();
      return;
    }

    // Below: skip if user is typing
    if(inInput) return;

    // ? — help overlay
    if(matchesShortcut(e, s.helpOverlay)){
      e.preventDefault();
      if(helpOpen) closeHelp(); else openHelp();
      return;
    }

    // Cmd+T — timer
    if(matchesShortcut(e, s.timer)){
      e.preventDefault();
      handleTimer();
      return;
    }

    // Cmd+N — new item
    if(matchesShortcut(e, s.newItem)){
      e.preventDefault();
      handleNewItem();
      return;
    }

    // Cmd+P — download PDF
    if(matchesShortcut(e, s.downloadPdf)){
      e.preventDefault();
      handlePdf();
      return;
    }

    // Cmd+C — copy result
    if(matchesShortcut(e, s.copyResult)){
      if(handleCopy()) e.preventDefault();
    }
  });

  // ── First-visit hint toast ──
  if(!localStorage.getItem(SEEN_KEY)){
    document.addEventListener('DOMContentLoaded', function(){
      localStorage.setItem(SEEN_KEY, '1');
      var toast = document.createElement('div');
      toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9999;background:var(--bg2,#111118);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:10px 20px;font-size:.85rem;color:var(--text,#ccc);font-family:Inter,system-ui,sans-serif;box-shadow:0 8px 32px rgba(0,0,0,.4);display:flex;gap:12px;align-items:center;animation:cx-fade-in .3s';
      toast.innerHTML = 'Press <kbd style="background:#222230;border:1px solid rgba(255,255,255,.1);border-radius:4px;padding:2px 8px;font-size:.8rem;color:#ff8844;margin:0 2px;font-family:monospace">?</kbd> for keyboard shortcuts';
      document.body.appendChild(toast);
      setTimeout(function(){ toast.style.opacity = '0'; toast.style.transition = 'opacity .3s'; }, 4000);
      setTimeout(function(){ toast.remove(); }, 4400);
    });
  }

  // ── Inject minimal animation CSS ──
  var style = document.createElement('style');
  style.textContent = '@keyframes cx-fade-in{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}';
  document.head.appendChild(style);

  // ── Public API ──
  window.CortexShortcuts = {
    openPalette: openPalette,
    closePalette: closePalette,
    openHelp: openHelp,
    closeHelp: closeHelp,
    getShortcuts: function(){ return JSON.parse(JSON.stringify(shortcuts)); },
    resetDefaults: function(){
      localStorage.removeItem(STORAGE_KEY);
      shortcuts = JSON.parse(JSON.stringify(DEFAULTS));
      if(helpOverlay){ helpOverlay.remove(); helpOverlay = null; }
    }
  };

})();
