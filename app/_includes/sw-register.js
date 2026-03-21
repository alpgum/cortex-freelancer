/* [470] Service worker registration with offline banner */
(function(){
  // Register service worker
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('/sw.js').then(function(reg){
      // Check for updates periodically
      setInterval(function(){ reg.update(); }, 60 * 60 * 1000);
    }).catch(function(){});
  }

  // Offline/online banner
  var banner = document.createElement('div');
  banner.id = 'offline-banner';
  banner.style.cssText = 'display:none;position:fixed;top:0;left:0;right:0;z-index:10001;background:linear-gradient(135deg,#ff6622,#ff4444);color:#fff;text-align:center;padding:8px 16px;font-size:13px;font-weight:700;font-family:Inter,sans-serif;letter-spacing:.5px;transition:transform .3s;transform:translateY(-100%)';
  banner.innerHTML = '&#9888;&#65039; Offline mode — your tools still work, but some features may be limited';
  document.body.appendChild(banner);

  function showBanner(){
    banner.style.display = 'block';
    setTimeout(function(){ banner.style.transform = 'translateY(0)'; }, 10);
  }

  function hideBanner(){
    banner.style.transform = 'translateY(-100%)';
    setTimeout(function(){ banner.style.display = 'none'; }, 300);
  }

  if(!navigator.onLine) showBanner();

  window.addEventListener('offline', showBanner);
  window.addEventListener('online', hideBanner);
})();
