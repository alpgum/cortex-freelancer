/**
 * Cortex Freelancer — Free Tier Usage Limiter [482]
 * Limits: 3 invoices/month, 5 proposals/month, 10 job results/month.
 * Tracks usage in localStorage with monthly reset.
 * Shows "X/N used" indicator on tool pages.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_usage_limits';

  var LIMITS = {
    'invoice':     { max: 3,  label: 'invoices' },
    'proposal':    { max: 5,  label: 'proposals' },
    'job-scanner': { max: 10, label: 'job results' }
  };

  function getCurrentMonth() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function getData() {
    try {
      var raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      // Monthly reset
      if (raw.month !== getCurrentMonth()) {
        raw = { month: getCurrentMonth(), tools: {} };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
      }
      return raw;
    } catch (e) {
      return { month: getCurrentMonth(), tools: {} };
    }
  }

  function save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function getToolSlug() {
    var path = window.location.pathname;
    var match = path.match(/\/app\/tools\/([a-z0-9-]+)/);
    return match ? match[1] : null;
  }

  function getUsed(toolSlug) {
    var data = getData();
    return (data.tools && data.tools[toolSlug]) || 0;
  }

  // Public API
  window.cortexUsageLimiter = {
    /**
     * Check if the current tool has uses remaining.
     * Returns { allowed: bool, used: number, max: number, label: string } or null if tool isn't limited.
     */
    check: function (toolSlug) {
      toolSlug = toolSlug || getToolSlug();
      if (!toolSlug || !LIMITS[toolSlug]) return null;

      var limit = LIMITS[toolSlug];
      var used = getUsed(toolSlug);
      return {
        allowed: used < limit.max,
        used: used,
        max: limit.max,
        label: limit.label
      };
    },

    /**
     * Record one use of a tool. Returns false if limit reached.
     */
    record: function (toolSlug) {
      toolSlug = toolSlug || getToolSlug();
      if (!toolSlug || !LIMITS[toolSlug]) return true; // no limit

      var data = getData();
      if (!data.tools) data.tools = {};
      var used = data.tools[toolSlug] || 0;
      if (used >= LIMITS[toolSlug].max) return false;

      data.tools[toolSlug] = used + 1;
      save(data);
      updateBadge(toolSlug);
      return true;
    },

    /** Get usage info for display */
    getUsage: function (toolSlug) {
      toolSlug = toolSlug || getToolSlug();
      if (!toolSlug || !LIMITS[toolSlug]) return null;
      var limit = LIMITS[toolSlug];
      var used = getUsed(toolSlug);
      return { used: used, max: limit.max, label: limit.label };
    }
  };

  // ========== UI: Show usage badge on limited tool pages ==========
  function updateBadge(toolSlug) {
    var info = window.cortexUsageLimiter.check(toolSlug);
    if (!info) return;

    var badge = document.getElementById('usage-limit-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'usage-limit-badge';
      badge.setAttribute('role', 'status');
      badge.setAttribute('aria-live', 'polite');
      badge.style.cssText = 'position:fixed;bottom:1.5rem;right:1.5rem;z-index:90;background:var(--bg2,#111118);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:.6rem 1rem;font-size:.82rem;font-weight:600;color:var(--text2,#a0a0a0);font-family:Inter,-apple-system,sans-serif;display:flex;align-items:center;gap:.5rem;box-shadow:0 4px 20px rgba(0,0,0,.4);transition:all .3s';
      document.body.appendChild(badge);
    }

    var remaining = info.max - info.used;
    var color = remaining <= 1 ? '#ff4466' : remaining <= 2 ? '#ffcc00' : '#00ff88';
    badge.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:' + color + ';flex-shrink:0"></span>' +
      info.used + '/' + info.max + ' ' + info.label + ' used this month';

    if (!info.allowed) {
      badge.innerHTML += '<a href="/pricing" style="color:var(--orange,#ff8844);font-weight:700;margin-left:.5rem;text-decoration:underline;font-size:.8rem">Upgrade</a>';
      badge.style.borderColor = 'rgba(255,68,102,.3)';
    }
  }

  // ========== UI: Block form submission when limit reached ==========
  function showLimitReachedOverlay() {
    if (document.getElementById('limit-reached-overlay')) return;

    var overlay = document.createElement('div');
    overlay.id = 'limit-reached-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(6px);z-index:200;display:flex;align-items:center;justify-content:center;animation:fadeIn .3s ease';
    overlay.innerHTML =
      '<div style="background:var(--bg2,#111118);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:2.5rem;max-width:420px;width:90%;text-align:center">' +
        '<div style="font-size:2.5rem;margin-bottom:1rem">&#128274;</div>' +
        '<h3 style="font-size:1.2rem;font-weight:800;margin-bottom:.5rem;color:var(--text,#f0f0f0)">Monthly limit reached</h3>' +
        '<p style="color:var(--text2,#a0a0a0);font-size:.9rem;line-height:1.6;margin-bottom:1.5rem">You\'ve used all your free uses this month. Upgrade to Pro for unlimited access.</p>' +
        '<a href="/pricing" style="display:inline-block;background:linear-gradient(135deg,#ff8844,#ff6622);color:#000;padding:.8rem 2rem;border-radius:100px;font-weight:800;font-size:.95rem;text-decoration:none;transition:transform .2s">Upgrade to Pro</a>' +
        '<button onclick="this.closest(\'#limit-reached-overlay\').remove()" style="display:block;margin:.75rem auto 0;background:none;border:none;color:var(--text3,#666);font-size:.85rem;cursor:pointer">Maybe later</button>' +
      '</div>';
    document.body.appendChild(overlay);
  }

  // ========== INIT: Show badge and intercept if on a limited tool page ==========
  function init() {
    var toolSlug = getToolSlug();
    if (!toolSlug || !LIMITS[toolSlug]) return;

    // Check pro status — if pro, skip limits entirely
    document.addEventListener('cortex-auth-ready', function (e) {
      var uid = e.detail && e.detail.uid;
      if (uid && window.checkProStatus) {
        window.checkProStatus(uid).then(function (isPro) {
          if (isPro) {
            var badge = document.getElementById('usage-limit-badge');
            if (badge) badge.remove();
            return;
          }
          updateBadge(toolSlug);
        });
      } else {
        updateBadge(toolSlug);
      }
    });

    // Fallback
    setTimeout(function () {
      if (!document.getElementById('usage-limit-badge')) {
        updateBadge(toolSlug);
      }
    }, 3000);

    // Intercept main form submissions
    document.addEventListener('submit', function (e) {
      var info = window.cortexUsageLimiter.check(toolSlug);
      if (info && !info.allowed) {
        e.preventDefault();
        showLimitReachedOverlay();
      }
    }, true);

    // Also intercept generate/submit button clicks
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('button[type="submit"], .generate-btn, .btn-generate, #generateBtn, #submitBtn');
      if (!btn) return;
      var info = window.cortexUsageLimiter.check(toolSlug);
      if (info && !info.allowed) {
        e.preventDefault();
        e.stopPropagation();
        showLimitReachedOverlay();
      }
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
