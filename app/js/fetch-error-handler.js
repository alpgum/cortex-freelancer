/**
 * CF-101: Fix uncaught promise rejections in fetch calls
 * Global fetch wrapper with .catch() and fallback UI.
 */
(function () {
  'use strict';
  window.CortexFreelancer = window.CortexFreelancer || {};

  function showFallbackUI(message) {
    var existing = document.getElementById('fetch-error-toast');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.id = 'fetch-error-toast';
    toast.setAttribute('role', 'alert');
    Object.assign(toast.style, {
      position: 'fixed', top: '16px', right: '16px',
      background: '#d93025', color: '#fff', padding: '12px 20px',
      borderRadius: '8px', zIndex: '99998', fontSize: '14px',
      fontFamily: 'system-ui, sans-serif', maxWidth: '360px',
      boxShadow: '0 4px 12px rgba(0,0,0,.2)'
    });
    toast.textContent = message || 'Something went wrong. Please try again.';
    document.body.appendChild(toast);
    setTimeout(function () { toast.remove(); }, 5000);
  }

  function safeFetch(url, options) {
    return fetch(url, options)
      .then(function (res) {
        if (!res.ok) {
          throw new Error('HTTP ' + res.status + ': ' + res.statusText);
        }
        return res;
      })
      .catch(function (err) {
        console.error('[CortexFetch]', url, err);
        showFallbackUI(
          navigator.onLine === false
            ? 'You appear to be offline. Check your connection.'
            : 'Request failed. Please try again.'
        );
        throw err;
      });
  }

  window.CortexFreelancer.FetchErrorHandler = {
    safeFetch: safeFetch,
    showFallbackUI: showFallbackUI
  };
})();
