/* ===== [248] TOOL UPGRADE CTA — Inline upsell after tool results ===== */
(function() {
  'use strict';

  var CTA_ID = 'cortex-tool-upgrade-cta';
  var DISMISSED_KEY = 'cortex_upgrade_cta_dismissed';

  function isPro() {
    return typeof window.cortexIsPro === 'function' && window.cortexIsPro();
  }

  function wasDismissed() {
    try {
      var ts = parseInt(localStorage.getItem(DISMISSED_KEY), 10);
      if (!ts) return false;
      // Re-show after 24 hours
      return Date.now() - ts < 86400000;
    } catch (e) { return false; }
  }

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    var el = document.getElementById(CTA_ID);
    if (el) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(-8px)';
      setTimeout(function() { el.remove(); }, 300);
    }
  }

  function createCTA(container) {
    if (isPro() || wasDismissed()) return;
    if (document.getElementById(CTA_ID)) return;

    var cta = document.createElement('div');
    cta.id = CTA_ID;
    cta.style.cssText = 'margin-top:1.5rem;padding:1.2rem 1.5rem;background:linear-gradient(135deg,rgba(255,136,68,.06),rgba(255,102,34,.03));border:1px solid rgba(255,136,68,.2);border-radius:12px;display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;transition:all .3s ease;opacity:0;transform:translateY(8px)';
    cta.innerHTML =
      '<div style="flex:1;min-width:200px">' +
        '<p style="font-weight:700;font-size:.95rem;margin-bottom:.25rem;color:#f0f0f0">Want more? Pro gives unlimited access</p>' +
        '<p style="font-size:.85rem;color:#a0a0a0;line-height:1.5">Unlimited analyses, invoices, proposals, and all 78+ templates.</p>' +
      '</div>' +
      '<div style="display:flex;gap:.5rem;align-items:center;flex-shrink:0">' +
        '<a href="/pricing" id="ctaUpgradeBtn" style="background:linear-gradient(135deg,#ff8844,#ff6622);color:#000;padding:.55rem 1.4rem;border-radius:100px;font-weight:700;font-size:.85rem;text-decoration:none;transition:all .2s;white-space:nowrap">Upgrade to Pro</a>' +
        '<button id="ctaDismissBtn" style="background:none;border:none;color:#666;font-size:1.2rem;cursor:pointer;padding:.25rem;line-height:1" title="Dismiss">&times;</button>' +
      '</div>';

    var target = container || document.querySelector('.result-container, .tool-result, #result, [data-tool-result]');
    if (target) {
      target.parentNode.insertBefore(cta, target.nextSibling);
    } else {
      // Fallback: append to main content area
      var main = document.querySelector('main, .tool-content, .container, #main-content');
      if (main) main.appendChild(cta);
      else return;
    }

    // Animate in
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        cta.style.opacity = '1';
        cta.style.transform = 'translateY(0)';
      });
    });

    document.getElementById('ctaDismissBtn').addEventListener('click', dismiss);
    document.getElementById('ctaUpgradeBtn').addEventListener('click', function() {
      if (typeof window.dataLayer !== 'undefined') {
        window.dataLayer.push({ event: 'upgrade_clicked', source_page: 'tool_result_cta' });
      }
    });
  }

  // Expose globally so tools can call it after rendering results
  window.CortexUpgradeCTA = { show: createCTA, dismiss: dismiss };

  // Auto-show: listen for tool result events or MutationObserver on result containers
  document.addEventListener('cortex-tool-result', function(e) {
    setTimeout(function() { createCTA(e.detail && e.detail.container); }, 500);
  });

  // Fallback: watch for result containers appearing in the DOM
  if (typeof MutationObserver !== 'undefined') {
    var observer = new MutationObserver(function(mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var nodes = mutations[i].addedNodes;
        for (var j = 0; j < nodes.length; j++) {
          var node = nodes[j];
          if (node.nodeType === 1 && (node.classList.contains('result-container') || node.classList.contains('tool-result') || node.id === 'result' || node.hasAttribute('data-tool-result'))) {
            setTimeout(function() { createCTA(node); }, 800);
            return;
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();
