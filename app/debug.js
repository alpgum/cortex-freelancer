// [392] Debug mode flag
// Activate with ?debug=1 in the URL
// Shows extra diagnostics (non-PII) in the console

(function() {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var debugMode = params.get('debug') === '1';

  window.__cortexDebug = debugMode;

  if (!debugMode) return;

  console.log('%c[Cortex Debug Mode]', 'color: #ff8844; font-weight: bold; font-size: 14px');
  console.log('Debug mode enabled. Diagnostics will appear in this console.');

  // Log environment info
  console.group('[Debug] Environment');
  console.log('URL:', window.location.href);
  console.log('User Agent:', navigator.userAgent);
  console.log('Screen:', window.screen.width + 'x' + window.screen.height);
  console.log('Viewport:', window.innerWidth + 'x' + window.innerHeight);
  console.log('Online:', navigator.onLine);
  console.log('Language:', navigator.language);
  console.log('Timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
  console.groupEnd();

  // Log localStorage keys (no values for privacy)
  console.group('[Debug] LocalStorage Keys');
  for (var i = 0; i < localStorage.length; i++) {
    var key = localStorage.key(i);
    if (key.startsWith('cortex_')) {
      console.log(key, '(' + (localStorage.getItem(key) || '').length + ' chars)');
    }
  }
  console.groupEnd();

  // Log loaded scripts
  console.group('[Debug] Loaded Scripts');
  var scripts = document.querySelectorAll('script[src]');
  scripts.forEach(function(s) { console.log(s.src); });
  console.groupEnd();

  // Log service worker status
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistration().then(function(reg) {
      console.log('[Debug] Service Worker:', reg ? 'registered (' + reg.active.scriptURL + ')' : 'not registered');
    });
  }

  // Performance timing
  window.addEventListener('load', function() {
    setTimeout(function() {
      var perf = performance.getEntriesByType('navigation')[0];
      if (perf) {
        console.group('[Debug] Performance');
        console.log('DOM Interactive:', Math.round(perf.domInteractive) + 'ms');
        console.log('DOM Complete:', Math.round(perf.domComplete) + 'ms');
        console.log('Load Event:', Math.round(perf.loadEventEnd) + 'ms');
        console.log('Transfer Size:', Math.round(perf.transferSize / 1024) + 'KB');
        console.groupEnd();
      }
    }, 100);
  });
})();
