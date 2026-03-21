/**
 * Cortex Freelancer — Smart Upgrade Nudge [483]
 * Shows upgrade CTA only after user has gotten value (3+ tool uses).
 * Contextual, non-annoying — dismissed for 24 hours if closed.
 */
(function () {
  'use strict';

  var DISMISS_KEY = 'cortex_nudge_dismiss_until';
  var MIN_USES = 3;

  function getTotalUses() {
    try {
      var history = JSON.parse(localStorage.getItem('cortex_tool_history') || '[]');
      return history.length;
    } catch (e) {
      return 0;
    }
  }

  function isDismissed() {
    try {
      var until = localStorage.getItem(DISMISS_KEY);
      if (!until) return false;
      return Date.now() < parseInt(until, 10);
    } catch (e) {
      return false;
    }
  }

  function dismiss() {
    // Dismiss for 24 hours
    localStorage.setItem(DISMISS_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
  }

  function getToolSlug() {
    var path = window.location.pathname;
    var match = path.match(/\/app\/tools\/([a-z0-9-]+)/);
    return match ? match[1] : null;
  }

  function getContextualMessage(toolSlug) {
    var messages = {
      'invoice':          'Love creating invoices? Pro gives you unlimited invoices + PDF export.',
      'proposal':         'Writing proposals faster? Pro unlocks unlimited proposals + templates.',
      'rate-calculator':  'Got your rate dialed in? Pro includes advanced rate analytics.',
      'scope-analyzer':   'Analyzing scopes like a pro? Upgrade for unlimited analyses.',
      'contract-review':  'Reviewing contracts with AI? Pro gives unlimited reviews + red flag alerts.',
      'job-scanner':      'Finding great jobs? Pro unlocks unlimited job results + daily digests.',
      'tax-estimator':    'Tracking taxes? Pro adds quarterly reports + multi-currency support.',
      'email-writer':     'Sending better emails? Pro unlocks unlimited emails + tone options.',
      'payment-checker':  'Tracking payments? Pro adds automatic reminders + overdue alerts.',
      'portfolio-review': 'Improving your portfolio? Pro gives unlimited reviews + detailed feedback.'
    };
    return messages[toolSlug] || 'You\'re getting value from Cortex! Upgrade to Pro for unlimited access to all tools.';
  }

  function showNudge(toolSlug) {
    if (document.getElementById('upgrade-nudge-bar')) return;

    var message = getContextualMessage(toolSlug);

    var bar = document.createElement('div');
    bar.id = 'upgrade-nudge-bar';
    bar.setAttribute('role', 'complementary');
    bar.setAttribute('aria-label', 'Upgrade suggestion');
    bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:80;background:linear-gradient(135deg,rgba(255,136,68,.12),rgba(170,102,255,.08));border-top:1px solid rgba(255,136,68,.2);padding:.75rem 1.25rem;display:flex;align-items:center;gap:1rem;font-family:Inter,-apple-system,sans-serif;animation:nudgeSlideUp .4s ease;backdrop-filter:blur(12px)';

    bar.innerHTML =
      '<span style="font-size:1.1rem;flex-shrink:0">&#9889;</span>' +
      '<span style="flex:1;font-size:.85rem;color:var(--text,#f0f0f0);line-height:1.4">' + message + '</span>' +
      '<a href="/pricing" style="flex-shrink:0;background:linear-gradient(135deg,#ff8844,#ff6622);color:#000;padding:.5rem 1.2rem;border-radius:100px;font-weight:700;font-size:.82rem;text-decoration:none;white-space:nowrap;transition:transform .2s" onmouseover="this.style.transform=\'translateY(-1px)\'" onmouseout="this.style.transform=\'none\'">Go Pro</a>' +
      '<button id="nudge-close" style="background:none;border:none;color:var(--text3,#666);font-size:1.1rem;cursor:pointer;padding:.25rem;flex-shrink:0" aria-label="Dismiss">&times;</button>';

    // Add animation style
    if (!document.getElementById('nudge-style')) {
      var style = document.createElement('style');
      style.id = 'nudge-style';
      style.textContent = '@keyframes nudgeSlideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}';
      document.head.appendChild(style);
    }

    document.body.appendChild(bar);

    bar.querySelector('#nudge-close').addEventListener('click', function () {
      bar.style.transform = 'translateY(100%)';
      bar.style.opacity = '0';
      bar.style.transition = 'all .3s ease';
      setTimeout(function () { bar.remove(); }, 300);
      dismiss();
    });

    // Track impression
    if (window.dataLayer) {
      window.dataLayer.push({ event: 'upgrade_nudge_shown', tool: toolSlug });
    }
  }

  function init() {
    var toolSlug = getToolSlug();
    if (!toolSlug) return;

    // Don't show if dismissed
    if (isDismissed()) return;

    // Don't show until 3+ uses
    if (getTotalUses() < MIN_USES) return;

    // Don't show to Pro users
    document.addEventListener('cortex-auth-ready', function (e) {
      var uid = e.detail && e.detail.uid;
      if (uid && window.checkProStatus) {
        window.checkProStatus(uid).then(function (isPro) {
          if (!isPro) {
            // Delay showing nudge — let user interact first
            setTimeout(function () { showNudge(toolSlug); }, 8000);
          }
        });
      } else {
        setTimeout(function () { showNudge(toolSlug); }, 8000);
      }
    });

    // Fallback if auth never fires
    setTimeout(function () {
      if (!document.getElementById('upgrade-nudge-bar') && getTotalUses() >= MIN_USES && !isDismissed()) {
        showNudge(toolSlug);
      }
    }, 12000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
