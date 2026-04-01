// ===== SHARED HEAD INJECTOR — Cortex Freelancer =====
// Injects common <head> elements: meta, favicon, manifest, GA4/GTM, Sentry, Firebase SDK, fonts
// Usage: <script src="/_includes/head.js"></script> (place as first script in <head>)

(function () {
  var head = document.head || document.getElementsByTagName('head')[0];

  // [CF-106] Ensure relative paths resolve correctly when accessed via clean URLs / bookmarks
  // e.g. /tools/rate-calculator/ needs <base> to resolve ../loading-skeleton.css correctly
  if (!document.querySelector('base')) {
    var base = document.createElement('base');
    base.href = window.location.pathname.replace(/\/[^\/]*$/, '/');
    head.insertBefore(base, head.firstChild);
  }

  // [395] Cache busting — append version to key asset URLs
  var ASSET_VERSION = '2026032101';
  function versioned(url) {
    return url + (url.indexOf('?') === -1 ? '?' : '&') + 'v=' + ASSET_VERSION;
  }

  // — Google Tag Manager —
  (function (w, d, s, l, i) {
    w[l] = w[l] || [];
    w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
    var f = d.getElementsByTagName(s)[0],
      j = d.createElement(s),
      dl = l !== 'dataLayer' ? '&l=' + l : '';
    j.async = true;
    j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i + dl;
    f.parentNode.insertBefore(j, f);
  })(window, document, 'script', 'dataLayer', 'GTM-NDV9WQ7');

  // — Meta tags —
  var metas = [
    { charset: 'UTF-8' },
    { 'http-equiv': 'Content-Security-Policy', content: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://www.gstatic.com https://*.firebaseio.com https://apis.google.com https://js.stripe.com https://browser.sentry-cdn.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https: http:; connect-src 'self' https://www.google-analytics.com https://www.googletagmanager.com https://analytics.google.com https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://api.stripe.com https://*.sentry.io https://*.ingest.sentry.io https://cortexfreelancer.com; frame-src 'self' https://accounts.google.com https://apis.google.com https://js.stripe.com https://*.firebaseapp.com https://cortexfreelancer.com; object-src 'none'; base-uri 'self'" },
    { name: 'viewport', content: 'width=device-width, initial-scale=1.0' },
    { name: 'theme-color', content: '#00ff88' }
  ];

  metas.forEach(function (attrs) {
    var meta = document.createElement('meta');
    Object.keys(attrs).forEach(function (k) {
      if (k === 'charset') meta.setAttribute('charset', attrs[k]);
      else if (k === 'http-equiv') meta.setAttribute('http-equiv', attrs['http-equiv']);
      else meta.setAttribute(k, attrs[k]);
    });
    head.appendChild(meta);
  });

  // — Favicon —
  var favicon = document.createElement('link');
  favicon.rel = 'icon';
  favicon.href = '/favicon.ico';
  favicon.type = 'image/x-icon';
  head.appendChild(favicon);

  // — Manifest —
  var manifest = document.createElement('link');
  manifest.rel = 'manifest';
  manifest.href = '/manifest.json';
  head.appendChild(manifest);

  // — Google Fonts (Inter) —
  var preconnect = document.createElement('link');
  preconnect.rel = 'preconnect';
  preconnect.href = 'https://fonts.googleapis.com';
  head.appendChild(preconnect);

  var preconnect2 = document.createElement('link');
  preconnect2.rel = 'preconnect';
  preconnect2.href = 'https://fonts.gstatic.com';
  preconnect2.crossOrigin = 'anonymous';
  head.appendChild(preconnect2);

  var fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap';
  head.appendChild(fontLink);

  // — Sentry SDK —
  var sentryScript = document.createElement('script');
  sentryScript.src = 'https://browser.sentry-cdn.com/8.46.0/bundle.min.js';
  sentryScript.crossOrigin = 'anonymous';
  head.appendChild(sentryScript);

  sentryScript.onload = function () {
    if (typeof Sentry === 'undefined') return;

    // If DSN already set (e.g. via inline script), init immediately
    if (window.SENTRY_DSN) {
      _initSentry(window.SENTRY_DSN);
      return;
    }

    // Fetch DSN from server config endpoint
    fetch('/api/client-config')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (cfg) {
        if (cfg && cfg.sentryDsn) {
          window.SENTRY_DSN = cfg.sentryDsn;
          _initSentry(cfg.sentryDsn, cfg.environment, cfg.version);
        }
      })
      .catch(function () {
        // Config unavailable — Sentry stays disabled, errors still caught by error-boundary.js
      });
  };

  function _initSentry(dsn, env, release) {
    if (window.__sentryInitialized) return;
    window.__sentryInitialized = true;
    Sentry.init({
      dsn: dsn,
      environment: env || (location.hostname === 'localhost' ? 'development' : 'production'),
      release: release || '',
      sampleRate: 1.0,
      tracesSampleRate: 0,
      autoSessionTracking: false,
      beforeSend: function (event) {
        // Don't send errors from browser extensions
        var frames = event.exception && event.exception.values && event.exception.values[0] &&
                     event.exception.values[0].stacktrace && event.exception.values[0].stacktrace.frames;
        if (frames && frames.some(function (f) { return f.filename && f.filename.indexOf('extension') !== -1; })) {
          return null;
        }
        return event;
      }
    });
    // Set page context
    Sentry.setTag('page', window.location.pathname);
  }

  // — Firebase SDK (compat for auth) —
  var fbApp = document.createElement('script');
  fbApp.src = 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js';
  head.appendChild(fbApp);

  fbApp.onload = function () {
    var fbAuth = document.createElement('script');
    fbAuth.src = 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js';
    head.appendChild(fbAuth);

    var fbFirestore = document.createElement('script');
    fbFirestore.src = 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js';
    head.appendChild(fbFirestore);

    // Config is embedded in /app/auth.js (loaded per-page)
  };

  // — Common CSS (nav) — [395] versioned
  var navCss = document.createElement('link');
  navCss.rel = 'stylesheet';
  navCss.href = versioned('/app/_includes/nav.css');
  head.appendChild(navCss);

  // — [CF-084] Shared tools utility CSS —
  var toolsCss = document.createElement('link');
  toolsCss.rel = 'stylesheet';
  toolsCss.href = versioned('/app/css/tools.css');
  head.appendChild(toolsCss);

  // — [CF-102] Safe localStorage wrapper (load early, before other scripts) —
  var safeStorage = document.createElement('script');
  safeStorage.src = versioned('/app/_includes/safe-storage.js');
  head.appendChild(safeStorage);

  // — [CF-101,104] Global error boundary + unhandled rejection handler —
  var errorBoundary = document.createElement('script');
  errorBoundary.src = versioned('/app/_includes/error-boundary.js');
  head.appendChild(errorBoundary);

  // — [CF-083] Event binder — migrates inline handlers to addEventListener —
  var eventBinder = document.createElement('script');
  eventBinder.src = versioned('/app/_includes/event-binder.js');
  eventBinder.defer = true;
  head.appendChild(eventBinder);

  // — GTM noscript fallback (inject into body when ready) —
  function injectGTMNoscript() {
    var noscript = document.createElement('noscript');
    var iframe = document.createElement('iframe');
    iframe.src = 'https://www.googletagmanager.com/ns.html?id=GTM-NDV9WQ7';
    iframe.height = '0';
    iframe.width = '0';
    iframe.style.display = 'none';
    iframe.style.visibility = 'hidden';
    noscript.appendChild(iframe);
    document.body.insertBefore(noscript, document.body.firstChild);
  }

  if (document.body) {
    injectGTMNoscript();
  } else {
    document.addEventListener('DOMContentLoaded', injectGTMNoscript);
  }
})();
