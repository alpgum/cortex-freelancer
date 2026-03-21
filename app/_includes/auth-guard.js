// ===== Auth Guard — Cortex Freelancer =====
// Checks Firebase auth on protected pages.
// Not logged in → redirect to /app/login.html?redirect=<current page>
// Usage: <script src="/app/_includes/auth-guard.js"></script> (after auth.js)

(function () {
  'use strict';

  // Pages that do NOT require auth (don't guard these)
  var publicPaths = ['/app/login.html', '/app/signup.html'];
  var currentPath = window.location.pathname;

  // Skip guard on public pages
  for (var i = 0; i < publicPaths.length; i++) {
    if (currentPath === publicPaths[i]) return;
  }

  var redirectUrl = '/app/login.html?redirect=' + encodeURIComponent(currentPath + window.location.search);

  // Quick check: if we have a stored user, allow page to render
  // (Firebase onAuthStateChanged will do the real check)
  var storedUser = null;
  try {
    storedUser = JSON.parse(localStorage.getItem('cortex_firebase_user'));
  } catch (e) { /* ignore */ }

  if (!storedUser) {
    // No cached user — redirect immediately
    window.location.replace(redirectUrl);
    return;
  }

  // Verify with Firebase auth state (handles expired sessions)
  function checkAuth() {
    if (typeof firebase === 'undefined' || !firebase.auth) {
      // Firebase not loaded yet, retry
      setTimeout(checkAuth, 500);
      return;
    }

    // Give Firebase a moment to restore auth state
    var checked = false;
    firebase.auth().onAuthStateChanged(function (user) {
      if (checked) return;
      checked = true;

      if (!user) {
        // Session expired or invalid — clear stale data and redirect
        localStorage.removeItem('cortex_firebase_user');
        window.location.replace(redirectUrl);
      }
    });

    // Timeout fallback: if onAuthStateChanged hasn't fired in 5s,
    // trust the localStorage check (offline/slow network)
    setTimeout(function () {
      checked = true;
    }, 5000);
  }

  checkAuth();
})();
