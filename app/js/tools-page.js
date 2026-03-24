/**
 * Tools Directory page renderer
 */
(function(){
  'use strict';

  function $(id){ return document.getElementById(id); }

  function escapeHtml(s){
    return String(s||'')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');
  }

  function render(){
    var reg = window.CortexToolRegistry;
    if(!reg){ $('tools').innerHTML = '<div class="muted">Tool registry missing.</div>'; return; }

    var q = ($('q').value||'').trim();
    var cat = $('cat').value || '';

    var tools = reg.list({ query:q, category: cat || null });

    if(!tools.length){
      $('tools').innerHTML = '<div class="muted">No tools found.</div>';
      return;
    }

    $('tools').innerHTML = tools.map(function(t){
      var badge = t.isPro ? '<span class="badge pro">PRO</span>' : '<span class="badge free">FREE</span>';
      var req = t.requiresProfile ? '<span class="badge req">PROFILE</span>' : '';
      return (
        '<div class="tool-card">'
          + '<div class="tool-top">'
            + '<div class="tool-name">' + escapeHtml(t.name) + '</div>'
            + '<div class="tool-badges">' + badge + req + '</div>'
          + '</div>'
          + '<div class="tool-desc">' + escapeHtml(t.description) + '</div>'
          + '<div class="tool-meta">' + escapeHtml(t.category||'General') + '</div>'
          + '<a class="btn" href="/app/index.html#tool=' + encodeURIComponent(t.id) + '">OPEN</a>'
        + '</div>'
      );
    }).join('');
  }

  function init(){
    var reg = window.CortexToolRegistry;
    var cats = {};
    reg.list({}).forEach(function(t){ cats[t.category||'General']=true; });
    var catEl = $('cat');
    Object.keys(cats).sort().forEach(function(c){
      var opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      catEl.appendChild(opt);
    });

    $('q').addEventListener('input', render);
    $('cat').addEventListener('change', render);
    render();
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
