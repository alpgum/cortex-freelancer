/* [CF-096→100] Service worker registration with offline banner + update notification */
(function(){
  // Register service worker
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('/sw.js').then(function(reg){
      // Check for updates periodically
      setInterval(function(){ reg.update(); }, 60 * 60 * 1000);

      // [CF-100] Show update notification when new SW is waiting
      function onNewSW(){
        showUpdateBanner(reg);
      }

      if(reg.waiting){
        onNewSW();
      }

      reg.addEventListener('updatefound', function(){
        var newWorker = reg.installing;
        if(!newWorker) return;
        newWorker.addEventListener('statechange', function(){
          if(newWorker.state === 'installed' && navigator.serviceWorker.controller){
            onNewSW();
          }
        });
      });
    }).catch(function(){});

    // Reload page when new SW takes over
    var refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', function(){
      if(!refreshing){
        refreshing = true;
        location.reload();
      }
    });
  }

  // [CF-100] Update notification banner
  function showUpdateBanner(reg){
    // Don't show if already showing
    if(document.getElementById('sw-update-banner')) return;

    var banner = document.createElement('div');
    banner.id = 'sw-update-banner';
    banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:10002;background:linear-gradient(135deg,#00cc6a,#00aa55);color:#fff;text-align:center;padding:12px 16px;font-size:14px;font-weight:600;font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;gap:12px;box-shadow:0 -2px 10px rgba(0,0,0,0.3);transform:translateY(100%);transition:transform .3s ease';

    var text = document.createElement('span');
    text.textContent = 'New version available!';

    var btn = document.createElement('button');
    btn.textContent = 'Update Now';
    btn.style.cssText = 'background:#fff;color:#00aa55;border:none;border-radius:6px;padding:6px 16px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit';
    btn.addEventListener('click', function(){
      if(reg.waiting){
        reg.waiting.postMessage('skipWaiting');
      }
    });

    var dismiss = document.createElement('button');
    dismiss.textContent = '\u2715';
    dismiss.style.cssText = 'background:none;border:none;color:#fff;font-size:18px;cursor:pointer;padding:0 4px;opacity:0.7';
    dismiss.addEventListener('click', function(){
      banner.style.transform = 'translateY(100%)';
      setTimeout(function(){ banner.remove(); }, 300);
    });

    banner.appendChild(text);
    banner.appendChild(btn);
    banner.appendChild(dismiss);
    document.body.appendChild(banner);

    // Slide in
    setTimeout(function(){ banner.style.transform = 'translateY(0)'; }, 50);
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
