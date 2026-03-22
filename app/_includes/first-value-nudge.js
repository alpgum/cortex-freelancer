/**
 * Cortex Freelancer — First Value Nudge [521]
 *
 * Tracks time-to-first-value after signup/onboarding.
 * Shows a gentle nudge if user hasn't completed a tool action within 5 minutes.
 * Records TTFV milestone in localStorage for analytics.
 */
(function() {
  'use strict';

  var TTFV_KEY = 'cortex_ttfv';
  var NUDGE_DISMISSED_KEY = 'cortex_nudge_dismissed';
  var NUDGE_DELAY_MS = 5 * 60 * 1000; // 5 minutes

  // Tool action events that count as "first value"
  var VALUE_EVENTS = [
    'analysis_completed',   // scope analyzer
    'rate_calculated',      // rate calculator
    'invoice_generated',    // invoice
    'proposal_generated',   // proposal
    'email_generated',      // email writer
    'contract_reviewed',    // contract review
    'time_logged',          // time tracker
    'client_added',         // CRM
    'income_added'          // income dashboard
  ];

  function getTTFV() {
    try { return JSON.parse(localStorage.getItem(TTFV_KEY)); } catch(e) { return null; }
  }

  function saveTTFV(data) {
    localStorage.setItem(TTFV_KEY, JSON.stringify(data));
  }

  // Initialize TTFV tracking after onboarding completes
  function initTracking() {
    var ttfv = getTTFV();
    if (ttfv && ttfv.achievedAt) return; // already achieved first value

    // Check if onboarding was completed
    var onboarding;
    try { onboarding = JSON.parse(localStorage.getItem('cortex_onboarding')); } catch(e) { return; }
    if (!onboarding || (!onboarding.completedAt && !onboarding.skipped)) return;

    // Start tracking if not already
    if (!ttfv) {
      ttfv = {
        startedAt: onboarding.completedAt || onboarding.skippedAt || new Date().toISOString(),
        achievedAt: null,
        toolUsed: null,
        elapsedMs: null
      };
      saveTTFV(ttfv);
    }

    // Listen for tool usage via dataLayer
    if (window.dataLayer) {
      var origPush = window.dataLayer.push;
      window.dataLayer.push = function() {
        origPush.apply(this, arguments);
        for (var i = 0; i < arguments.length; i++) {
          var evt = arguments[i];
          if (evt && evt.event && VALUE_EVENTS.indexOf(evt.event) !== -1) {
            recordFirstValue(evt.event, evt.tool_name || evt.event);
          }
        }
      };
    }

    // Also listen for tool_used events
    document.addEventListener('cortex-tool-used', function(e) {
      if (e.detail && e.detail.action) {
        recordFirstValue(e.detail.action, e.detail.tool || 'unknown');
      }
    });

    // Schedule nudge
    scheduleNudge(ttfv);
  }

  function recordFirstValue(eventName, toolName) {
    var ttfv = getTTFV();
    if (!ttfv || ttfv.achievedAt) return;

    var now = new Date();
    var startTime = new Date(ttfv.startedAt);
    ttfv.achievedAt = now.toISOString();
    ttfv.toolUsed = toolName;
    ttfv.elapsedMs = now.getTime() - startTime.getTime();
    saveTTFV(ttfv);

    // Dismiss any active nudge
    dismissNudge();

    // Analytics
    if (window.dataLayer) {
      window.dataLayer.push({
        event: 'first_value_achieved',
        ttfv_seconds: Math.round(ttfv.elapsedMs / 1000),
        ttfv_tool: toolName
      });
    }
  }

  function scheduleNudge(ttfv) {
    if (localStorage.getItem(NUDGE_DISMISSED_KEY)) return;
    if (ttfv.achievedAt) return;

    var elapsed = Date.now() - new Date(ttfv.startedAt).getTime();
    var remaining = NUDGE_DELAY_MS - elapsed;

    if (remaining <= 0) {
      showNudge();
    } else {
      setTimeout(showNudge, remaining);
    }
  }

  function showNudge() {
    var ttfv = getTTFV();
    if (!ttfv || ttfv.achievedAt) return;
    if (localStorage.getItem(NUDGE_DISMISSED_KEY)) return;

    // Don't show on onboarding page itself
    if (window.location.pathname.indexOf('onboarding') !== -1) return;

    // Determine best tool suggestion based on onboarding data
    var toolHref = '/app/tools/rate-calculator';
    var toolName = 'Rate Calculator';
    try {
      var ob = JSON.parse(localStorage.getItem('cortex_onboarding'));
      if (ob && ob.challenge) {
        var map = {
          pricing: { href: '/app/tools/rate-calculator', name: 'Rate Calculator' },
          clients: { href: '/app/tools/job-scanner', name: 'Job Scanner' },
          proposals: { href: '/app/tools/proposal', name: 'Proposal Builder' },
          invoicing: { href: '/app/tools/invoice', name: 'Invoice Generator' },
          scope: { href: '/app/tools/scope-analyzer', name: 'Scope Analyzer' },
          contracts: { href: '/app/tools/contract-review', name: 'Contract Review' }
        };
        var match = map[ob.challenge];
        if (match) { toolHref = match.href; toolName = match.name; }
      }
    } catch(e) {}

    var nudge = document.createElement('div');
    nudge.id = 'first-value-nudge';
    nudge.style.cssText = 'position:fixed;bottom:24px;right:24px;max-width:340px;background:#111118;border:1px solid rgba(255,136,68,.2);border-radius:16px;padding:1.25rem 1.5rem;box-shadow:0 20px 60px rgba(0,0,0,.5);z-index:9999;font-family:Inter,-apple-system,sans-serif;animation:nudgeIn .4s ease';
    nudge.innerHTML =
      '<style>@keyframes nudgeIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}</style>' +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.75rem">' +
        '<div>' +
          '<div style="font-size:.85rem;font-weight:700;color:#f0f0f0;margin-bottom:.35rem">Ready to try your first tool?</div>' +
          '<div style="font-size:.78rem;color:#b0b0b0;line-height:1.5;margin-bottom:.75rem">Jump into the <strong style="color:#ff8844">' + toolName + '</strong> — it takes under 2 minutes to get your first result.</div>' +
          '<div style="display:flex;gap:.5rem">' +
            '<a href="' + toolHref + '?sample=1" style="display:inline-block;background:linear-gradient(135deg,#ff8844,#ff6622);color:#000;padding:.5rem 1rem;border-radius:100px;font-weight:700;font-size:.78rem;text-decoration:none;transition:transform .2s" onmouseover="this.style.transform=\'translateY(-1px)\'" onmouseout="this.style.transform=\'none\'">Try Now</a>' +
            '<button onclick="document.getElementById(\'first-value-nudge\').remove();localStorage.setItem(\'' + NUDGE_DISMISSED_KEY + '\',\'1\')" style="background:none;border:1px solid rgba(255,255,255,.1);color:#b0b0b0;padding:.5rem .75rem;border-radius:100px;font-size:.75rem;cursor:pointer;font-family:inherit">Later</button>' +
          '</div>' +
        '</div>' +
        '<button onclick="document.getElementById(\'first-value-nudge\').remove()" style="background:none;border:none;color:#666;cursor:pointer;font-size:1.1rem;line-height:1;padding:0;flex-shrink:0">&times;</button>' +
      '</div>';
    document.body.appendChild(nudge);
  }

  function dismissNudge() {
    var el = document.getElementById('first-value-nudge');
    if (el) el.remove();
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTracking);
  } else {
    initTracking();
  }
})();
