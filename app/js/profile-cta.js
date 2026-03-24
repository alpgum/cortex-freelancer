/**
 * Consistent CTA when profile data is missing.
 */
(function(){
  'use strict';

  function render(elOrId, opts){
    opts = opts || {};
    var el = (typeof elOrId === 'string') ? document.getElementById(elOrId) : elOrId;
    if (!el) return;

    var title = opts.title || 'Paste your Upwork profile to unlock tools';
    var desc = opts.desc || 'No login needed. Takes ~30 seconds.';

    el.innerHTML = (
      '<div style="padding:12px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(0,255,136,.06)">' +
        '<div style="font-weight:900;color:#fff;margin-bottom:6px">' + title + '</div>' +
        '<div style="color:rgba(255,255,255,.72);font-size:13px;line-height:1.4;margin-bottom:10px">' + desc + '</div>' +
        '<a href="/app/onboarding.html" style="display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:10px 14px;font-weight:900;text-decoration:none;background:#00ff88;color:#001b10;border:1px solid rgba(0,255,136,.35)">Open Onboarding →</a>' +
      '</div>'
    );
  }

  window.CortexProfileCTA = { render: render };
})();
