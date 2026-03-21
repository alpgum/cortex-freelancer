// ===== Firebase Auth Config — Cortex Freelancer =====
// Environment-aware Firebase configuration with Google + Email/Password providers
// Usage: <script src="/app/_includes/firebase-config.js"></script>
// Must be loaded AFTER Firebase SDK scripts

(function () {
  'use strict';

  // Environment-aware config: use runtime config if injected, else fallback defaults
  var config = window.__CORTEX_CONFIG || {
    apiKey: "AIzaSyDMNIz5VcOn-PVfxTiKCzY97gLAVwU5oBI",
    authDomain: "tets-e825e.firebaseapp.com",
    projectId: "tets-e825e",
    storageBucket: "tets-e825e.firebasestorage.app",
    messagingSenderId: "284616120390",
    appId: "1:284616120390:web:4e0d92e1b8e07996555247",
    measurementId: "G-NXNY507YCQ"
  };

  // Initialize Firebase (avoid double-init)
  var app;
  try {
    app = firebase.app();
  } catch (e) {
    app = firebase.initializeApp(config);
  }

  var auth = firebase.auth();

  // ── Providers ──
  var googleProvider = new firebase.auth.GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: 'select_account' });

  // Enable Email/Password provider (configured in Firebase Console)
  // No SDK-side setup needed — just expose auth instance

  // ── Expose globally ──
  window._cortexFirebaseApp = app;
  window._cortexFirebaseAuth = auth;
  window._cortexGoogleProvider = googleProvider;
})();
