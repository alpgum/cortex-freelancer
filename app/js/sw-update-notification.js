/**
 * CF-100 — Service Worker: update notification banner
 * Shows "New version available — click to update" when new SW is waiting
 */
(function () {
  const ns = (window.CortexFreelancer = window.CortexFreelancer || {});

  const BANNER_ID = 'sw-update-banner';
  const DISMISS_KEY = 'cortex_sw_update_dismissed';

  function createBanner(onUpdate, onDismiss) {
    if (document.getElementById(BANNER_ID)) return null;

    var banner = document.createElement('div');
    banner.id = BANNER_ID;
    banner.style.cssText =
      'position:fixed;bottom:0;left:0;right:0;background:#1e1b4b;color:#e0e7ff;' +
      'padding:12px 16px;display:flex;align-items:center;justify-content:space-between;' +
      'z-index:99999;font-size:14px;border-top:2px solid #6366f1;' +
      'box-shadow:0 -4px 12px rgba(0,0,0,.3);';

    banner.innerHTML =
      '<span>New version available!</span>' +
      '<div>' +
      '<button id="sw-update-btn" style="padding:6px 16px;background:#6366f1;color:#fff;' +
      'border:none;border-radius:4px;cursor:pointer;font-size:13px;margin-right:8px;">' +
      'Update Now</button>' +
      '<button id="sw-dismiss-btn" style="padding:6px 12px;background:transparent;' +
      'color:#94a3b8;border:1px solid #334155;border-radius:4px;cursor:pointer;font-size:13px;">' +
      'Later</button></div>';

    document.body.appendChild(banner);

    document.getElementById('sw-update-btn').addEventListener('click', function () {
      onUpdate();
      removeBanner();
    });

    document.getElementById('sw-dismiss-btn').addEventListener('click', function () {
      if (onDismiss) onDismiss();
      removeBanner();
      sessionStorage.setItem(DISMISS_KEY, 'true');
    });

    return banner;
  }

  function removeBanner() {
    var el = document.getElementById(BANNER_ID);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function skipWaitingAndReload(registration) {
    if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    // Reload once the new SW takes control
    var reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!reloading) {
        reloading = true;
        window.location.reload();
      }
    });
  }

  function init() {
    if (!('serviceWorker' in navigator)) return;
    if (sessionStorage.getItem(DISMISS_KEY) === 'true') return;

    navigator.serviceWorker.ready.then(function (registration) {
      // Check if there's already a waiting SW
      if (registration.waiting) {
        createBanner(
          function () { skipWaitingAndReload(registration); },
          null
        );
      }

      // Listen for new SW installations
      registration.addEventListener('updatefound', function () {
        var newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', function () {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            createBanner(
              function () { skipWaitingAndReload(registration); },
              null
            );
          }
        });
      });
    });
  }

  ns.SWUpdateNotification = {
    init: init,
    createBanner: createBanner,
    removeBanner: removeBanner,
    skipWaitingAndReload: skipWaitingAndReload
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
