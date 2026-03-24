/**
 * CF-100: Service Worker update notification banner
 * Shows "New version available" banner when a new SW is waiting.
 */
(function () {
  'use strict';
  window.CortexFreelancer = window.CortexFreelancer || {};

  const BANNER_ID = 'sw-update-banner';

  function createBanner() {
    if (document.getElementById(BANNER_ID)) return;
    const banner = document.createElement('div');
    banner.id = BANNER_ID;
    banner.setAttribute('role', 'alert');
    Object.assign(banner.style, {
      position: 'fixed', bottom: '0', left: '0', right: '0',
      background: '#1a73e8', color: '#fff', padding: '12px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      zIndex: '99999', fontFamily: 'system-ui, sans-serif', fontSize: '14px',
      boxShadow: '0 -2px 8px rgba(0,0,0,.15)'
    });
    banner.innerHTML =
      '<span>New version available — click to update</span>' +
      '<button id="sw-update-btn" style="background:#fff;color:#1a73e8;border:none;' +
      'padding:8px 16px;border-radius:4px;cursor:pointer;font-weight:600;min-height:44px">Update</button>';
    document.body.appendChild(banner);
    document.getElementById('sw-update-btn').addEventListener('click', function () {
      if (window.__waitingSW) {
        window.__waitingSW.postMessage({ type: 'SKIP_WAITING' });
      }
      banner.remove();
    });
  }

  function init() {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.ready.then(function (reg) {
      // Already waiting
      if (reg.waiting) {
        window.__waitingSW = reg.waiting;
        createBanner();
      }
      // Future updates
      reg.addEventListener('updatefound', function () {
        var newSW = reg.installing;
        if (!newSW) return;
        newSW.addEventListener('statechange', function () {
          if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
            window.__waitingSW = newSW;
            createBanner();
          }
        });
      });
    });

    // Reload on controller change
    var refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }

  window.CortexFreelancer.SWUpdateBanner = { init: init };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
