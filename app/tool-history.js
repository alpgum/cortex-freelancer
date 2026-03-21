/* Tool History — Cortex Freelancer
   Tracks last 5 tool uses in localStorage.
   Renders a "Recent Tools" section on tool pages.
*/
(function(){
  var STORAGE_KEY = 'cortex-tool-history';
  var MAX_ITEMS = 5;

  // ── Tool metadata (slug → display info) ──
  var TOOL_MAP = {
    'proposal':        { name: 'Proposal Writer',     icon: '✍️' },
    'invoice':         { name: 'Invoice Generator',   icon: '🧾' },
    'bio-generator':   { name: 'Bio Generator',       icon: '👤' },
    'rate-calculator': { name: 'Rate Calculator',     icon: '💰' },
    'email-writer':    { name: 'Email Writer',        icon: '📧' },
    'contract-review': { name: 'Contract Review',     icon: '📋' },
    'client-red-flags':{ name: 'Client Red Flags',    icon: '🚩' },
    'scope-analyzer':  { name: 'Scope Analyzer',      icon: '🔍' },
    'meeting-notes':   { name: 'Meeting Notes',       icon: '📝' },
    'project-brief':   { name: 'Project Brief',       icon: '📑' },
    'sow-generator':   { name: 'SOW Generator',       icon: '📄' },
    'portfolio-review':{ name: 'Portfolio Review',     icon: '🎨' },
    'payment-checker': { name: 'Payment Checker',     icon: '💳' },
    'fee-calculator':  { name: 'Fee Calculator',      icon: '🧮' },
    'tax-estimator':   { name: 'Tax Estimator',       icon: '🏦' },
    'templates':       { name: 'Templates',           icon: '📂' }
  };

  function getSlug(){
    var path = window.location.pathname.replace(/\/+$/,'');
    var parts = path.split('/');
    return parts[parts.length - 1] || null;
  }

  function getHistory(){
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch(e){ return []; }
  }

  function saveHistory(list){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  // ── Record this visit ──
  var slug = getSlug();
  if(slug && TOOL_MAP[slug]){
    var history = getHistory();
    // Remove duplicates of this tool
    history = history.filter(function(h){ return h.slug !== slug; });
    // Add to front
    history.unshift({ slug: slug, ts: Date.now() });
    // Keep only MAX_ITEMS
    if(history.length > MAX_ITEMS) history = history.slice(0, MAX_ITEMS);
    saveHistory(history);
  }

  // ── Render "Recent Tools" section ──
  function render(){
    var history = getHistory();
    if(history.length === 0) return;

    // Don't render on tool index page
    if(slug === 'tools' || slug === 'index') return;

    var container = document.createElement('div');
    container.id = 'recent-tools';
    container.style.cssText = 'max-width:800px;margin:0 auto 2rem;padding:0 1.5rem';

    var heading = document.createElement('div');
    heading.style.cssText = 'font-size:13px;font-weight:600;color:#a0a0a0;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;font-family:Inter,sans-serif';
    heading.textContent = 'Recent';
    container.appendChild(heading);

    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';

    history.forEach(function(h){
      var meta = TOOL_MAP[h.slug];
      if(!meta) return;
      var isCurrent = h.slug === slug;
      var chip = document.createElement('a');
      chip.href = '/app/tools/' + h.slug;
      chip.style.cssText = 'display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:100px;font-size:13px;font-weight:500;font-family:Inter,sans-serif;text-decoration:none;transition:all .2s;border:1px solid ' + (isCurrent ? 'rgba(255,136,68,.4)' : 'rgba(255,255,255,.08)') + ';background:' + (isCurrent ? 'rgba(255,136,68,.1)' : 'rgba(17,17,24,.8)') + ';color:' + (isCurrent ? '#ff8844' : '#ccc');
      chip.innerHTML = meta.icon + ' ' + meta.name;
      chip.onmouseover = function(){ this.style.borderColor='rgba(255,136,68,.4)'; this.style.background='rgba(255,136,68,.08)'; };
      chip.onmouseout = function(){ this.style.borderColor = isCurrent ? 'rgba(255,136,68,.4)' : 'rgba(255,255,255,.08)'; this.style.background = isCurrent ? 'rgba(255,136,68,.1)' : 'rgba(17,17,24,.8)'; };
      row.appendChild(chip);
    });

    container.appendChild(row);

    // Insert after hero section or at top of main content
    var hero = document.querySelector('.hero') || document.querySelector('.tool-hero') || document.querySelector('section');
    if(hero && hero.nextSibling){
      hero.parentNode.insertBefore(container, hero.nextSibling);
    } else {
      document.body.appendChild(container);
    }
  }

  // Render after DOM ready
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
