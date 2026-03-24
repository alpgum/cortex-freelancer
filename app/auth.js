// Cortex Freelancer — Firebase Auth Module
// Loaded via CDN (firebase-app, firebase-auth) + this file on every page

(function() {
  'use strict';

  // ── Firebase Init ──
  const firebaseConfig = {
    apiKey: "AIzaSyDMNIz5VcOn-PVfxTiKCzY97gLAVwU5oBI",
    authDomain: "cortexfreelancer.com",
    projectId: "tets-e825e",
    storageBucket: "tets-e825e.firebasestorage.app",
    messagingSenderId: "284616120390",
    appId: "1:284616120390:web:4e0d92e1b8e07996555247",
    measurementId: "G-NXNY507YCQ"
  };

  let app, auth, provider;
  try {
    app = firebase.app();
  } catch (e) {
    app = firebase.initializeApp(firebaseConfig);
  }
  auth = firebase.auth();

  // [CF-087] Explicitly set LOCAL persistence so auth state survives page navigations
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function(err) {
    console.warn('Auth persistence error:', err);
  });

  const db = firebase.firestore();
  provider = new firebase.auth.GoogleAuthProvider();

  // Expose Firestore instance for other modules (e.g. pro-status.js)
  window._cortexFirestore = db;

  // ── [254] Touch Source Tracking ──
  function getTouchSource() {
    var params = new URLSearchParams(window.location.search);
    return {
      utm_source: params.get('utm_source') || null,
      utm_medium: params.get('utm_medium') || null,
      utm_campaign: params.get('utm_campaign') || null,
      referrer: document.referrer || null,
      landing_page: window.location.pathname
    };
  }

  // Capture first touch on very first visit
  (function() {
    if (!localStorage.getItem('cortex_first_touch')) {
      localStorage.setItem('cortex_first_touch', JSON.stringify(getTouchSource()));
    }
    // Always update last touch
    localStorage.setItem('cortex_last_touch', JSON.stringify(getTouchSource()));
  })();

  // ── State ──
  let currentUser = null;

  // ── Sign in with Google (redirect flow — no popup, no ugly domain) ──
  window.cortexSignIn = function() {
    try {
      auth.signInWithRedirect(provider);
    } catch (err) {
      console.error('Sign-in error:', err);
      showAuthToast('Sign-in failed. Please try again.');
    }
  };

  // Handle redirect result on page load
  auth.getRedirectResult().then(function(result) {
    if (result && result.user) {
      saveUser(result.user);
      updateAuthUI(result.user);
      showAuthToast('Signed in!');
    }
  }).catch(function(err) {
    console.error('Redirect sign-in error:', err);
    if (err.code !== 'auth/popup-closed-by-user') {
      // silently fail — user can try again
    }
  });

  // ── Sign out ──
  window.cortexSignOut = async function() {
    try {
      await auth.signOut();
      currentUser = null;
      localStorage.removeItem('cortex_firebase_user');
      updateAuthUI(null);
      showAuthToast('Signed out');
    } catch (err) {
      console.error('Sign-out error:', err);
    }
  };

  // ── Sync user document to Firestore ──
  async function syncUserToFirestore(user) {
    if (!user) return;
    try {
      const userRef = db.collection('users').doc(user.uid);
      const doc = await userRef.get();
      if (doc.exists) {
        // Returning user — update login time and profile fields
        await userRef.update({
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          lastLoginAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      } else {
        // First-time user — create full document with touch sources [254]
        var firstTouch = null;
        var lastTouch = null;
        try { firstTouch = JSON.parse(localStorage.getItem('cortex_first_touch')); } catch (e) { /* ignore */ }
        try { lastTouch = JSON.parse(localStorage.getItem('cortex_last_touch')); } catch (e) { /* ignore */ }
        await userRef.set({
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
          isPro: false,
          proExpiresAt: null,
          stripeCustomerId: null,
          plan: 'free',
          toolUsage: {},
          savedAnalyses: [],
          first_touch_source: firstTouch,
          last_touch_source: lastTouch
        });
      }
    } catch (err) {
      console.error('Firestore user sync error:', err);
    }
  }

  // ── Save user to localStorage ──
  function saveUser(user) {
    if (!user) return;
    // [CF-089] Clear guest flag on real sign-in
    localStorage.removeItem('cortex_guest');
    const data = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      proUser: localStorage.getItem('cortex_pro') === 'true' || localStorage.getItem('cortex_pro_uid') === user.uid
    };
    localStorage.setItem('cortex_firebase_user', JSON.stringify(data));
    // Keep legacy cortex_user in sync
    localStorage.setItem('cortex_user', JSON.stringify({ name: user.displayName, email: user.email }));
    currentUser = data;
    // Sync to Firestore (non-blocking)
    syncUserToFirestore(user);
  }

  // ── Get stored user ──
  window.cortexGetUser = function() {
    if (currentUser) return currentUser;
    try {
      return JSON.parse(localStorage.getItem('cortex_firebase_user'));
    } catch (e) {
      return null;
    }
  };

  // ── Check Pro status ──
  window.cortexIsPro = function() {
    const user = window.cortexGetUser();
    if (!user) return localStorage.getItem('cortex_pro') === 'true';
    const proData = localStorage.getItem('cortex_pro_uid');
    if (proData === user.uid) return true;
    return localStorage.getItem('cortex_pro') === 'true';
  };

  // ── Auth state listener ──
  // [CF-087] Immediately render from cached user to prevent flash on navigation
  var cachedUser = null;
  try { cachedUser = JSON.parse(localStorage.getItem('cortex_firebase_user')); } catch (e) { /* ignore */ }
  if (cachedUser && cachedUser.uid && cachedUser.uid !== 'guest') {
    currentUser = cachedUser;
    updateAuthUI(cachedUser);
  }

  auth.onAuthStateChanged(function(user) {
    if (user) {
      saveUser(user);
      updateAuthUI(user);
    } else {
      currentUser = null;
      updateAuthUI(null);
    }
  });

  // ── Update header UI ──
  function updateAuthUI(user) {
    // Auth button area
    const authArea = document.getElementById('cortex-auth');
    if (!authArea) return;

    if (user) {
      const displayName = user.displayName || user.email || 'User';
      const photoURL = user.photoURL;
      const proLabel = window.cortexIsPro() ? '<span class="cortex-pro-badge">PRO</span>' : '';
      authArea.innerHTML =
        '<div class="cortex-user-info">' +
          (photoURL ? '<img src="' + photoURL + '" alt="" class="cortex-avatar">' : '<div class="cortex-avatar-placeholder">' + displayName.charAt(0).toUpperCase() + '</div>') +
          '<span class="cortex-user-name">' + displayName + '</span>' +
          proLabel +
          '<button onclick="cortexSignOut()" class="cortex-auth-btn cortex-logout-btn">Sign Out</button>' +
        '</div>';
    } else {
      authArea.innerHTML =
        '<button onclick="cortexSignIn()" class="cortex-auth-btn cortex-login-btn">' +
          '<svg width="16" height="16" viewBox="0 0 18 18" style="vertical-align:middle;margin-right:4px"><path fill="#fff" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#fff" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#fff" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#fff" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/></svg>' +
          'Sign In' +
        '</button>';
    }
  }

  // ── Toast helper ──
  function showAuthToast(msg) {
    let t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      t.className = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
  }

  // [389] Sync auth state across tabs via storage events
  window.addEventListener('storage', function(e) {
    if (e.key === 'cortex_firebase_user') {
      if (e.newValue) {
        try {
          var userData = JSON.parse(e.newValue);
          currentUser = userData;
          updateAuthUI(userData);
        } catch (err) { /* ignore parse errors */ }
      } else {
        // User signed out in another tab
        currentUser = null;
        updateAuthUI(null);
      }
    }
  });

  // ── Init: render auth UI on DOMContentLoaded ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { updateAuthUI(window.cortexGetUser()); });
  } else {
    updateAuthUI(window.cortexGetUser());
  }

})();
