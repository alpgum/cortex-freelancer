// ===== Auth Guard — Cortex Freelancer =====
// Checks Firebase auth on protected pages.
// Not logged in → redirect to /app/login.html?redirect=<current page>
// After auth confirmed → syncs profile to localStorage, dispatches cortex-auth-ready
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

  // Sync user profile to localStorage and dispatch auth-ready event
  function syncProfile(user) {
    var isPro = localStorage.getItem('cortex_pro') === 'true' ||
                localStorage.getItem('cortex_pro_uid') === user.uid;

    var profileData = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      proUser: isPro
    };

    localStorage.setItem('cortex_firebase_user', JSON.stringify(profileData));
    // Keep legacy cortex_user in sync
    localStorage.setItem('cortex_user', JSON.stringify({
      name: user.displayName,
      email: user.email
    }));

    // Dispatch cortex-auth-ready event for dashboard and other listeners
    document.dispatchEvent(new CustomEvent('cortex-auth-ready', {
      detail: profileData
    }));
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

      if (user) {
        // Authenticated — sync profile and notify listeners
        syncProfile(user);
      } else {
        // Session expired or invalid — clear stale data and redirect
        localStorage.removeItem('cortex_firebase_user');
        window.location.replace(redirectUrl);
      }
    });

    // Timeout fallback: if onAuthStateChanged hasn't fired in 5s,
    // trust the localStorage check and dispatch with cached data
    setTimeout(function () {
      if (!checked) {
        checked = true;
        document.dispatchEvent(new CustomEvent('cortex-auth-ready', {
          detail: storedUser
        }));
      }
    }, 5000);
  }

  checkAuth();
})();
