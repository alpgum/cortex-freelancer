/* ============================================================
   Tool Data Bridge — shared data bus between Cortex tools
   Uses localStorage key: cortex_data_bridge
   ============================================================ */
(function(){
  'use strict';

  var BRIDGE_KEY = 'cortex_data_bridge';

  // ---- Core read/write ----
  function getBridge(){
    try { return JSON.parse(localStorage.getItem(BRIDGE_KEY) || '{}'); }
    catch(e){ return {}; }
  }

  function setBridge(data){
    localStorage.setItem(BRIDGE_KEY, JSON.stringify(data));
  }

  function patchBridge(channel, payload){
    var b = getBridge();
    b[channel] = Object.assign(b[channel] || {}, payload, { updatedAt: new Date().toISOString() });
    setBridge(b);
  }

  // ---- Channel: rate-calculator ----
  // Publishes recommended rate + skill/experience after calculation
  function publishRate(opts){
    patchBridge('rate', {
      recommendedRate: opts.recommendedRate,
      currentRate:     opts.currentRate || null,
      skill:           opts.skill       || null,
      experience:      opts.experience  || null,
      country:         opts.country     || null
    });
  }

  function getRate(){
    return (getBridge().rate) || null;
  }

  // ---- Channel: scope-analyzer ----
  // Publishes deliverables, hours, milestones, red flags
  function publishScope(opts){
    patchBridge('scope', {
      brief:        opts.brief        || '',
      category:     opts.category     || null,
      deliverables: opts.deliverables || [],
      milestones:   opts.milestones   || [],
      redFlags:     opts.redFlags     || [],
      totalMinHours: opts.totalMinHours || 0,
      totalMaxHours: opts.totalMaxHours || 0,
      midpointHours: opts.midpointHours || 0,
      estimatedCost: opts.estimatedCost || 0,
      hourlyRate:    opts.hourlyRate    || 0
    });
  }

  function getScope(){
    return (getBridge().scope) || null;
  }

  // ---- Channel: invoice ----
  // Publishes client + project info after an invoice is created/saved
  function publishInvoice(opts){
    patchBridge('invoice', {
      clientName:    opts.clientName    || '',
      clientEmail:   opts.clientEmail   || '',
      clientAddress: opts.clientAddress || '',
      currency:      opts.currency      || 'USD',
      items:         opts.items         || [],
      totalAmount:   opts.totalAmount   || 0,
      projectName:   opts.projectName   || ''
    });
  }

  function getInvoice(){
    return (getBridge().invoice) || null;
  }

  // ---- Helpers: pre-fill targets ----

  // Pre-fill proposal from invoice data (client, project context)
  function prefillProposalFromInvoice(){
    var inv = getInvoice();
    if(!inv) return false;
    var el;
    // If proposal page has a job description textarea, prepend client context
    el = document.getElementById('jd-input');
    if(el && !el.value.trim()){
      var lines = [];
      if(inv.clientName)  lines.push('Client: ' + inv.clientName);
      if(inv.projectName) lines.push('Project: ' + inv.projectName);
      if(inv.totalAmount) lines.push('Budget: ' + inv.currency + ' ' + inv.totalAmount);
      if(inv.items && inv.items.length){
        lines.push('Scope:');
        inv.items.forEach(function(it){ lines.push('- ' + (it.desc || it.description || 'Item') + ' (' + it.qty + ' × ' + it.rate + ')'); });
      }
      if(lines.length) el.value = lines.join('\n');
    }
    return true;
  }

  // Pre-fill invoice line items from scope analyzer deliverables
  function prefillInvoiceFromScope(){
    var scope = getScope();
    if(!scope || !scope.deliverables || !scope.deliverables.length) return false;
    var rate = scope.hourlyRate || 50;
    // Build items array matching invoice's line item format
    var items = scope.deliverables.map(function(d){
      return { desc: d.name, qty: d.hours, rate: rate };
    });
    // Store for invoice page to pick up
    patchBridge('prefill_invoice', { items: items, currency: 'USD', fromScope: true });
    return true;
  }

  // Pre-fill scope analyzer hourly rate from rate calculator
  function prefillScopeFromRate(){
    var r = getRate();
    if(!r) return false;
    var el = document.getElementById('rateInput');
    if(el && !el.value){
      el.value = r.recommendedRate || r.currentRate || '';
      return true;
    }
    return false;
  }

  // Apply scope→invoice prefill on invoice page
  function applyInvoicePrefill(){
    var pf = getBridge().prefill_invoice;
    if(!pf || !pf.items || !pf.items.length) return false;
    // Check if invoice page line items exist
    var tbody = document.getElementById('line-items');
    if(!tbody) return false;
    // Look for addLineItem or similar global fn
    if(typeof window.addLineItem === 'function'){
      // Clear existing empty rows first
      var rows = tbody.querySelectorAll('tr');
      var firstEmpty = true;
      pf.items.forEach(function(item){
        if(firstEmpty && rows.length === 1){
          // Fill the existing first row
          var cells = rows[0].querySelectorAll('input');
          if(cells.length >= 3){
            cells[0].value = item.desc || '';
            cells[1].value = item.qty  || 1;
            cells[2].value = item.rate || 0;
          }
          firstEmpty = false;
        } else {
          window.addLineItem();
          var newRows = tbody.querySelectorAll('tr');
          var last = newRows[newRows.length - 1];
          var inputs = last.querySelectorAll('input');
          if(inputs.length >= 3){
            inputs[0].value = item.desc || '';
            inputs[1].value = item.qty  || 1;
            inputs[2].value = item.rate || 0;
          }
        }
      });
      // Trigger recalc if available
      if(typeof window.updatePreview === 'function') window.updatePreview();
      // Clear the prefill so it doesn't re-apply
      var b = getBridge();
      delete b.prefill_invoice;
      setBridge(b);
      return true;
    }
    return false;
  }

  // ---- Auto-detect current page & apply relevant prefills ----
  function autoApply(){
    var path = window.location.pathname;
    if(path.indexOf('scope-analyzer') !== -1){
      prefillScopeFromRate();
    }
    if(path.indexOf('proposal') !== -1){
      prefillProposalFromInvoice();
    }
    if(path.indexOf('invoice') !== -1){
      applyInvoicePrefill();
    }
  }

  // ---- Notification banner when prefill data is available ----
  function showBridgeBanner(message, actionLabel, actionFn){
    var existing = document.getElementById('bridge-banner');
    if(existing) existing.remove();
    var banner = document.createElement('div');
    banner.id = 'bridge-banner';
    banner.style.cssText = 'position:fixed;top:12px;right:12px;z-index:9999;background:linear-gradient(135deg,#6c5ce7,#a855f7);color:#fff;padding:12px 18px;border-radius:12px;font-size:0.85rem;box-shadow:0 4px 20px rgba(108,92,231,.4);display:flex;align-items:center;gap:10px;font-family:inherit;animation:bridgeSlideIn .3s ease';
    banner.innerHTML = '<span>' + message + '</span>';
    if(actionLabel && actionFn){
      var btn = document.createElement('button');
      btn.textContent = actionLabel;
      btn.style.cssText = 'background:#fff;color:#6c5ce7;border:none;padding:5px 12px;border-radius:6px;font-weight:700;cursor:pointer;font-size:.8rem';
      btn.onclick = function(){ actionFn(); banner.remove(); };
      banner.appendChild(btn);
    }
    var close = document.createElement('button');
    close.textContent = '\u00d7';
    close.style.cssText = 'background:none;border:none;color:#fff;font-size:1.2rem;cursor:pointer;padding:0 0 0 6px;opacity:.7';
    close.onclick = function(){ banner.remove(); };
    banner.appendChild(close);
    document.body.appendChild(banner);
    // Auto-dismiss after 8s
    setTimeout(function(){ if(banner.parentNode) banner.remove(); }, 8000);
  }

  function checkAndNotify(){
    var path = window.location.pathname;
    var scope = getScope();
    var rate  = getRate();
    var inv   = getInvoice();

    if(path.indexOf('invoice') !== -1 && scope && scope.deliverables && scope.deliverables.length){
      var pf = getBridge().prefill_invoice;
      if(pf && pf.fromScope){
        showBridgeBanner('Scope analysis data available \u2014 auto-fill line items?', 'Apply', applyInvoicePrefill);
      }
    }
    if(path.indexOf('scope-analyzer') !== -1 && rate && rate.recommendedRate){
      var el = document.getElementById('rateInput');
      if(el && !el.value){
        showBridgeBanner('Rate Calculator suggests $' + rate.recommendedRate + '/hr', 'Use Rate', function(){
          el.value = rate.recommendedRate;
        });
      }
    }
    if(path.indexOf('proposal') !== -1 && inv && inv.clientName){
      var jd = document.getElementById('jd-input');
      if(jd && !jd.value.trim()){
        showBridgeBanner('Pre-fill from recent invoice (' + inv.clientName + ')?', 'Apply', prefillProposalFromInvoice);
      }
    }
  }

  // ---- Animation keyframe ----
  var style = document.createElement('style');
  style.textContent = '@keyframes bridgeSlideIn{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:translateX(0)}}';
  document.head.appendChild(style);

  // ---- Expose API ----
  window.CortexBridge = {
    publish: {
      rate:    publishRate,
      scope:   publishScope,
      invoice: publishInvoice
    },
    get: {
      rate:    getRate,
      scope:   getScope,
      invoice: getInvoice
    },
    prefill: {
      proposalFromInvoice: prefillProposalFromInvoice,
      invoiceFromScope:    prefillInvoiceFromScope,
      scopeFromRate:       prefillScopeFromRate,
      applyInvoice:        applyInvoicePrefill
    },
    autoApply: autoApply,
    notify:    checkAndNotify,
    _raw:      getBridge
  };

  // Auto-run on DOM ready
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){
      autoApply();
      setTimeout(checkAndNotify, 600);
    });
  } else {
    autoApply();
    setTimeout(checkAndNotify, 600);
  }
})();
