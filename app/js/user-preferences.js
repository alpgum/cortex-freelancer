/**
 * Cortex Freelancer — User Preferences Persistence
 * [CF-219] Save/load preferred tools, dashboard layout, theme,
 * and notification settings per user in Firestore.
 *
 * @namespace window.CortexFreelancer.UserPreferences
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Constants ──────────────────────────────────────────────────

  var COLLECTION = 'user_preferences';
  var LOCAL_KEY = 'cf_user_preferences';
  var DEBOUNCE_MS = 1500;

  var DEFAULTS = {
    theme: 'light',
    dashboardLayout: 'default',
    preferredTools: [],
    notifications: {
      email: true,
      push: true,
      jobMatches: true,
      payments: true,
      subscriptionUpdates: true,
      tips: true
    },
    locale: 'en',
    compactMode: false
  };

  // ─── State ──────────────────────────────────────────────────────

  var currentPrefs = null;
  var currentUid = null;
  var saveTimer = null;
  var listeners = [];

  // ─── Helpers ────────────────────────────────────────────────────

  function getFirestore() {
    if (typeof firebase !== 'undefined' && firebase.firestore) {
      return firebase.firestore();
    }
    return null;
  }

  function getCurrentUser() {
    if (typeof firebase !== 'undefined' && firebase.auth) {
      return firebase.auth().currentUser;
    }
    return null;
  }

  function deepMerge(target, source) {
    var result = {};
    var keys = Object.keys(target);
    for (var i = 0; i < keys.length; i++) {
      result[keys[i]] = target[keys[i]];
    }
    var srcKeys = Object.keys(source);
    for (var j = 0; j < srcKeys.length; j++) {
      var key = srcKeys[j];
      if (
        source[key] !== null &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key]) &&
        target[key] !== null &&
        typeof target[key] === 'object' &&
        !Array.isArray(target[key])
      ) {
        result[key] = deepMerge(target[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function loadLocal() {
    try {
      var raw = localStorage.getItem(LOCAL_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveLocal(prefs) {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(prefs));
    } catch (e) {
      // ignore
    }
  }

  function notifyListeners(prefs) {
    for (var i = 0; i < listeners.length; i++) {
      try {
        listeners[i](prefs);
      } catch (e) {
        console.error('[UserPreferences] Listener error:', e);
      }
    }
  }

  // ─── Firestore Operations ──────────────────────────────────────

  function loadFromFirestore(uid) {
    var db = getFirestore();
    if (!db) return Promise.resolve(null);

    return db.collection(COLLECTION).doc(uid).get().then(function (doc) {
      if (doc.exists) {
        return doc.data();
      }
      return null;
    }).catch(function (err) {
      console.warn('[UserPreferences] Firestore load failed:', err.message);
      return null;
    });
  }

  function saveToFirestore(uid, prefs) {
    var db = getFirestore();
    if (!db) return Promise.resolve();

    var data = clone(prefs);
    data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

    return db.collection(COLLECTION).doc(uid).set(data, { merge: true }).catch(function (err) {
      console.warn('[UserPreferences] Firestore save failed:', err.message);
    });
  }

  function debouncedSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      if (currentUid && currentPrefs) {
        saveToFirestore(currentUid, currentPrefs);
      }
    }, DEBOUNCE_MS);
  }

  // ─── Public API ─────────────────────────────────────────────────

  window.CortexFreelancer.UserPreferences = {
    /**
     * Load preferences for the current user.
     * Merges Firestore data with defaults and local cache.
     * @param {string} [uid] — override user ID
     * @returns {Promise<Object>}
     */
    load: function (uid) {
      var user = getCurrentUser();
      currentUid = uid || (user ? user.uid : null);

      var localPrefs = loadLocal();

      if (!currentUid) {
        currentPrefs = deepMerge(clone(DEFAULTS), localPrefs || {});
        return Promise.resolve(clone(currentPrefs));
      }

      return loadFromFirestore(currentUid).then(function (remote) {
        if (remote) {
          currentPrefs = deepMerge(clone(DEFAULTS), remote);
        } else if (localPrefs) {
          currentPrefs = deepMerge(clone(DEFAULTS), localPrefs);
          // Push local prefs to Firestore for new users
          saveToFirestore(currentUid, currentPrefs);
        } else {
          currentPrefs = clone(DEFAULTS);
        }
        saveLocal(currentPrefs);
        return clone(currentPrefs);
      });
    },

    /**
     * Get a preference value by dot-notation key.
     * @param {string} key — e.g. 'theme' or 'notifications.email'
     * @returns {*}
     */
    get: function (key) {
      if (!currentPrefs) currentPrefs = deepMerge(clone(DEFAULTS), loadLocal() || {});
      var parts = key.split('.');
      var val = currentPrefs;
      for (var i = 0; i < parts.length; i++) {
        if (val === undefined || val === null) return undefined;
        val = val[parts[i]];
      }
      return val;
    },

    /**
     * Set a preference value. Auto-saves to local and Firestore.
     * @param {string} key — dot-notation key
     * @param {*} value
     */
    set: function (key, value) {
      if (!currentPrefs) currentPrefs = deepMerge(clone(DEFAULTS), loadLocal() || {});
      var parts = key.split('.');
      var obj = currentPrefs;
      for (var i = 0; i < parts.length - 1; i++) {
        if (typeof obj[parts[i]] !== 'object' || obj[parts[i]] === null) {
          obj[parts[i]] = {};
        }
        obj = obj[parts[i]];
      }
      obj[parts[parts.length - 1]] = value;

      saveLocal(currentPrefs);
      notifyListeners(clone(currentPrefs));
      debouncedSave();
    },

    /**
     * Bulk update preferences.
     * @param {Object} updates — partial prefs object
     */
    update: function (updates) {
      if (!currentPrefs) currentPrefs = deepMerge(clone(DEFAULTS), loadLocal() || {});
      currentPrefs = deepMerge(currentPrefs, updates);
      saveLocal(currentPrefs);
      notifyListeners(clone(currentPrefs));
      debouncedSave();
    },

    /**
     * Reset preferences to defaults.
     * @returns {Promise<void>}
     */
    reset: function () {
      currentPrefs = clone(DEFAULTS);
      saveLocal(currentPrefs);
      notifyListeners(clone(currentPrefs));
      if (currentUid) {
        return saveToFirestore(currentUid, currentPrefs);
      }
      return Promise.resolve();
    },

    /** Get all preferences as a copy. */
    getAll: function () {
      if (!currentPrefs) currentPrefs = deepMerge(clone(DEFAULTS), loadLocal() || {});
      return clone(currentPrefs);
    },

    /** Subscribe to preference changes. Returns unsubscribe function. */
    onChange: function (fn) {
      listeners.push(fn);
      return function () {
        listeners = listeners.filter(function (l) { return l !== fn; });
      };
    },

    /** Get default values. */
    getDefaults: function () {
      return clone(DEFAULTS);
    }
  };
})();
