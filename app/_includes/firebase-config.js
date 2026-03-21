// ===== Firebase Auth Config — Cortex Freelancer =====
// Environment-aware Firebase configuration with Google + Email/Password providers
// Usage: <script src="/app/_includes/firebase-config.js"></script>
// Must be loaded AFTER Firebase SDK scripts

(function () {
  'use strict';

  // Environment-aware config: use runtime config if injected, else fallback defaults
  var config = window.__CORTEX_CONFIG || {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_FIREBASE_APP_ID"
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
