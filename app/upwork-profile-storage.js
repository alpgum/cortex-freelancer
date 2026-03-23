/**
 * Upwork Profile Storage — Cortex Freelancer
 * Saves fetched Upwork profiles to Firestore (authenticated) or localStorage (guest).
 * Structure: { url, data: {...}, fetchedAt, source: 'live'|'cached' }
 */
(function () {
  'use strict';

  var LS_KEY = 'cortex_upwork_profile';
  var FIRESTORE_PATH = 'profiles'; // profiles/{uid}/upwork

  // ── Helpers ──

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem('cortex_firebase_user'));
    } catch (e) {
      return null;
    }
  }

  function isGuest(user) {
    return !user || user.uid === 'guest' || !user.uid;
  }

  function getFirestore() {
    try {
      return firebase.firestore();
    } catch (e) {
      return null;
    }
  }

  function buildRecord(url, profileData, source) {
    return {
      url: url,
      data: profileData,
      platform: (profileData && profileData._meta && profileData._meta.platform) || detectPlatformFromUrl(url),
      fetchedAt: new Date().toISOString(),
      source: source || 'live'
    };
  }

  function detectPlatformFromUrl(url) {
    if (!url) return 'upwork';
    if (url.indexOf('fiverr.com') !== -1) return 'fiverr';
    if (url.indexOf('freelancer.com') !== -1) return 'freelancer';
    return 'upwork';
  }

  // ── Save ──

  function saveProfile(url, profileData, source) {
    var record = buildRecord(url, profileData, source);
    var user = getUser();

    // Always save to localStorage as fallback
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(record));
    } catch (e) { /* quota exceeded — ignore */ }

    // If authenticated, also save to Firestore
    if (!isGuest(user)) {
      var db = getFirestore();
      if (db) {
        db.collection(FIRESTORE_PATH).doc(user.uid).set({
          upwork: record
        }, { merge: true }).catch(function (err) {
          console.warn('[upwork-storage] Firestore save failed:', err);
        });
      }
    }

    return record;
  }

  // ── Load ──

  function loadProfile(callback) {
    var user = getUser();

    // Try Firestore first for authenticated users
    if (!isGuest(user)) {
      var db = getFirestore();
      if (db) {
        db.collection(FIRESTORE_PATH).doc(user.uid).get().then(function (doc) {
          if (doc.exists && doc.data().upwork) {
            var record = doc.data().upwork;
            // Update localStorage cache
            try { localStorage.setItem(LS_KEY, JSON.stringify(record)); } catch (e) { /* ignore */ }
            callback(record);
          } else {
            callback(loadFromLocalStorage());
          }
        }).catch(function () {
          callback(loadFromLocalStorage());
        });
        return;
      }
    }

    // Guest or no Firestore — use localStorage
    callback(loadFromLocalStorage());
  }

  function loadFromLocalStorage() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  // ── Clear ──

  function clearProfile() {
    localStorage.removeItem(LS_KEY);
    var user = getUser();
    if (!isGuest(user)) {
      var db = getFirestore();
      if (db) {
        db.collection(FIRESTORE_PATH).doc(user.uid).update({
          upwork: firebase.firestore.FieldValue.delete()
        }).catch(function () { /* ignore */ });
      }
    }
  }

  // ── Expose globally ──

  window.cortexUpworkStorage = {
    save: saveProfile,
    load: loadProfile,
    loadSync: loadFromLocalStorage,
    clear: clearProfile
  };
})();
