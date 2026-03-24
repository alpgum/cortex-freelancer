/**
 * Tools router for /app/index.html
 * Supports linking from /app/tools.html via #tool=<id>
 */
(function(){
  'use strict';

  function getToolId(){
    try {
      var h = window.location.hash || '';
      var m = h.match(/tool=([^&]+)/);
      if(!m) return null;
      return decodeURIComponent(m[1]);
    } catch(e){ return null; }
  }

  function openTool(id){
    var reg = window.CortexToolRegistry;
    if(!reg) return false;
    var t = reg.get(id);
    if(!t) return false;

    // Prefer existing tab switcher
    if(t.open && t.open.tab && typeof window.switchTab === 'function') {
      try { window.switchTab(t.open.tab); } catch(e) {}
    }

    // Advanced toolkit widget render
    if(t.open && t.open.widget && typeof window.renderAdvancedWidget === 'function') {
      setTimeout(function(){
        try { window.renderAdvancedWidget(t.open.widget); } catch(e) {}
      }, 50);
    }

    return true;
  }

  function onHash(){
    var id = getToolId();
    if(!id) return;
    openTool(id);
  }

  window.addEventListener('hashchange', onHash);
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onHash);
  else onHash();
})();
