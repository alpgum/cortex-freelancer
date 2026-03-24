/**
 * CF-224: Account Linking — Merge Guest Data with Registered Account
 *
 * When a guest user signs up or logs in, this module detects the transition,
 * collects all relevant guest data from localStorage, migrates it to Firestore
 * under the new user's document, handles merge conflicts, and cleans up.
 *
 * Conflict resolution strategies:
 *   - keepLocal:  guest (local) data wins on conflict
 *   - keepRemote: cloud (Firestore) data wins on conflict
 *   - merge:      combine both, newest timestamp wins per field
 *
 * Usage:
 *   CortexFreelancer.AccountLinking.init()
 *   CortexFreelancer.AccountLinking.migrateGuestData(userId, strategy)
 *   CortexFreelancer.AccountLinking.resolveConflicts(local, remote, strategy)
 *   CortexFreelancer.AccountLinking.getGuestData()
 *   CortexFreelancer.AccountLinking.clearGuestData()
 *
 * @namespace window.CortexFreelancer.AccountLinking
 */
window.CortexFreelancer = window.CortexFreelancer || {};

(function () {
  'use strict';

  // ── Constants ────────────────────────────────────────────────────────

  var LOG_PREFIX = '[CF-224]';
  var STYLE_ID = 'cortex-account-linking-styles';
  var MIGRATION_STATUS_KEY = 'cortex_migration_status';
  var GUEST_FLAG_KEY = 'cortex_guest_session';

  /**
   * All localStorage keys the app uses for guest data.
   * Grouped by Firestore target collection / document field.
   */
  var GUEST_DATA_MAP = {
    settings: {
      collection: 'users',
      field: 'settings',
      localKeys: ['cortex_user_settings']
    },
    onboarding: {
      collection: 'users',
      field: 'onboarding',
      localKeys: ['cortex_onboarding', 'cortex_onboarding_complete']
    },
    bookmarks: {
      collection: 'bookmarks',
      field: 'items',
      localKeys: ['cortex_saved_jobs']
    },
    proposals: {
      collection: 'proposals',
      field: 'items',
      localKeys: ['cf_proposal_tracker', 'cf_bulk_proposals']
    },
    earnings: {
      collection: 'analytics',
      field: 'earnings',
      localKeys: ['cortex_earnings_log', 'cortex_revenue_client_pie']
    },
    toolFeedback: {
      collection: 'analytics',
      field: 'toolFeedback',
      localKeys: ['cortex_tool_feedback']
    },
    feedbackData: {
      collection: 'analytics',
      field: 'feedback',
      localKeys: ['cortex_feedback_data']
    },
    smartFilter: {
      collection: 'users',
      field: 'smartFilter',
      localKeys: ['cortex_smart_filter_config']
    },
    weeklyInsights: {
      collection: 'analytics',
      field: 'weeklyInsights',
      localKeys: ['cortex_weekly_insights']
    },
    skillGap: {
      collection: 'analytics',
      field: 'skillGap',
      localKeys: ['cortex_skill_gap_data']
    },
    clientComms: {
      collection: 'analytics',
      field: 'clientComms',
      localKeys: ['cortex_client_comms']
    },
    availability: {
      collection: 'users',
      field: 'availability',
      localKeys: ['cf_availability_calendar']
    },
    subscription: {
      collection: 'users',
      field: 'subscription',
      localKeys: ['cf_subscription_pause', 'cf_trial']
    },
    notifications: {
      collection: 'users',
      field: 'revenueNotifications',
      localKeys: ['cf_revenue_notifications']
    },
    multiPlatform: {
      collection: 'users',
      field: 'multiPlatform',
      localKeys: ['cf_multi_platform']
    },
    profileComparison: {
      collection: 'analytics',
      field: 'profileComparison',
      localKeys: ['cortex_profile_comparison']
    },
    guestData: {
      collection: 'users',
      field: 'guestData',
      localKeys: ['cortex_guest_data', 'cortex_guest_usage']
    },
    userRole: {
      collection: 'users',
      field: 'role',
      localKeys: ['cortex_user_role']
    }
  };

  /**
   * All localStorage keys that are safe to remove after migration.
   * Computed from GUEST_DATA_MAP plus ephemeral session keys.
   */
  var EPHEMERAL_KEYS = [
    'cortex_guest_session',
    'cortex_checkout_pending',
    'cortex_auth_sync_event',
    'cortex_impersonate'
  ];

  var STRATEGIES = {
    KEEP_LOCAL: 'keepLocal',
    KEEP_REMOTE: 'keepRemote',
    MERGE: 'merge'
  };

  var MAX_RETRIES = 3;
  var RETRY_DELAY_MS = 1500;

  // ── Internal state ───────────────────────────────────────────────────

  var state = {
    initialized: false,
    migrating: false,
    progress: 0,
    totalSteps: 0,
    currentStep: '',
    error: null,
    listeners: [],
    uiEl: null,
    authUnsubscribe: null
  };

  // ── Helpers ──────────────────────────────────────────────────────────

  function log() {
    var args = [LOG_PREFIX].concat(Array.prototype.slice.call(arguments));
    console.log.apply(console, args);
  }

  function warn() {
    var args = [LOG_PREFIX].concat(Array.prototype.slice.call(arguments));
    console.warn.apply(console, args);
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }

  function notify() {
    var snapshot = {
      migrating: state.migrating,
      progress: state.progress,
      totalSteps: state.totalSteps,
      currentStep: state.currentStep,
      error: state.error
    };
    for (var i = 0; i < state.listeners.length; i++) {
      try { state.listeners[i](snapshot); } catch (e) { console.error(e); }
    }
  }

  function delay(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  // ── Firebase accessors ───────────────────────────────────────────────

  function getFirestore() {
    if (typeof firebase !== 'undefined' && firebase.firestore) {
      return firebase.firestore();
    }
    return null;
  }

  function getAuth() {
    if (typeof firebase !== 'undefined' && firebase.auth) {
      return firebase.auth();
    }
    return null;
  }

  function getCurrentUser() {
    var auth = getAuth();
    return auth ? auth.currentUser : null;
  }

  // ── Guest data detection ─────────────────────────────────────────────

  /**
   * Returns true if the current browser session has guest data worth migrating.
   */
  function hasGuestData() {
    var keys = getAllGuestKeys();
    for (var i = 0; i < keys.length; i++) {
      try {
        var val = localStorage.getItem(keys[i]);
        if (val !== null && val !== '' && val !== '{}' && val !== '[]' && val !== '0') {
          return true;
        }
      } catch (e) { /* ignore */ }
    }
    return false;
  }

  /**
   * Build a flat list of all localStorage keys tracked in GUEST_DATA_MAP.
   */
  function getAllGuestKeys() {
    var keys = [];
    var groups = Object.keys(GUEST_DATA_MAP);
    for (var i = 0; i < groups.length; i++) {
      var localKeys = GUEST_DATA_MAP[groups[i]].localKeys;
      for (var j = 0; j < localKeys.length; j++) {
        if (keys.indexOf(localKeys[j]) === -1) {
          keys.push(localKeys[j]);
        }
      }
    }
    return keys;
  }

  /**
   * Detect if the user was previously a guest and is now authenticated.
   * A guest session is indicated by either having guest data present or
   * an explicit flag set by progressive-auth.
   */
  function isGuestToRegisteredTransition(user) {
    if (!user) return false;
    // Explicit flag from progressive-auth
    try {
      if (localStorage.getItem(GUEST_FLAG_KEY) === 'true') return true;
    } catch (e) { /* ignore */ }
    // Check if a previous migration already ran for this user
    try {
      var status = JSON.parse(localStorage.getItem(MIGRATION_STATUS_KEY) || '{}');
      if (status.userId === user.uid && status.completed) return false;
    } catch (e) { /* ignore */ }
    return hasGuestData();
  }

  // ── Collect guest data ───────────────────────────────────────────────

  /**
   * Collect all guest data from localStorage, organized by group name.
   * @returns {Object} Keyed by group name, each value is the parsed data.
   */
  function getGuestData() {
    var result = {};
    var groups = Object.keys(GUEST_DATA_MAP);

    for (var i = 0; i < groups.length; i++) {
      var groupName = groups[i];
      var mapping = GUEST_DATA_MAP[groupName];
      var groupData = {};
      var hasData = false;

      for (var j = 0; j < mapping.localKeys.length; j++) {
        var key = mapping.localKeys[j];
        try {
          var raw = localStorage.getItem(key);
          if (raw !== null) {
            try {
              groupData[key] = JSON.parse(raw);
            } catch (e) {
              groupData[key] = raw;
            }
            hasData = true;
          }
        } catch (e) {
          warn('Failed to read localStorage key:', key, e);
        }
      }

      if (hasData) {
        result[groupName] = {
          collection: mapping.collection,
          field: mapping.field,
          data: groupData,
          collectedAt: new Date().toISOString()
        };
      }
    }

    // Also scoop up any cortex_/cf_ keys we may have missed
    try {
      for (var k = 0; k < localStorage.length; k++) {
        var storageKey = localStorage.key(k);
        if (storageKey && (storageKey.indexOf('cortex_') === 0 || storageKey.indexOf('cf_') === 0)) {
          // Check it's not already captured
          var alreadyCaptured = false;
          var allKeys = getAllGuestKeys();
          for (var m = 0; m < allKeys.length; m++) {
            if (allKeys[m] === storageKey) { alreadyCaptured = true; break; }
          }
          if (!alreadyCaptured && EPHEMERAL_KEYS.indexOf(storageKey) === -1) {
            if (!result._uncategorized) {
              result._uncategorized = {
                collection: 'users',
                field: 'miscGuestData',
                data: {},
                collectedAt: new Date().toISOString()
              };
            }
            try {
              result._uncategorized.data[storageKey] = JSON.parse(localStorage.getItem(storageKey));
            } catch (e2) {
              result._uncategorized.data[storageKey] = localStorage.getItem(storageKey);
            }
          }
        }
      }
    } catch (e) {
      warn('Failed to scan for uncategorized keys:', e);
    }

    return result;
  }

  // ── Conflict resolution ──────────────────────────────────────────────

  /**
   * Resolve conflicts between local guest data and existing remote data.
   *
   * @param {*} localData   Data from localStorage
   * @param {*} remoteData  Data from Firestore
   * @param {string} strategy  One of 'keepLocal', 'keepRemote', 'merge'
   * @returns {*}  Resolved data
   */
  function resolveConflicts(localData, remoteData, strategy) {
    strategy = strategy || STRATEGIES.MERGE;

    // If one side is null/undefined, the other wins trivially
    if (localData == null) return remoteData;
    if (remoteData == null) return localData;

    if (strategy === STRATEGIES.KEEP_LOCAL) {
      return localData;
    }

    if (strategy === STRATEGIES.KEEP_REMOTE) {
      return remoteData;
    }

    // strategy === 'merge'
    return deepMerge(localData, remoteData);
  }

  /**
   * Deep-merge two values.
   *  - Arrays: concatenate and deduplicate by 'id' field if present, otherwise by value.
   *  - Objects: recursive field-by-field merge; timestamp-based priority where available.
   *  - Primitives: local wins (guest data is more recent in the transition scenario).
   */
  function deepMerge(local, remote) {
    // Type mismatch — local wins (it's the freshest intent)
    if (typeof local !== typeof remote) return local;

    // Arrays
    if (Array.isArray(local) && Array.isArray(remote)) {
      return mergeArrays(local, remote);
    }

    // Plain objects
    if (local && remote && typeof local === 'object' && typeof remote === 'object') {
      return mergeObjects(local, remote);
    }

    // Primitives — local wins
    return local;
  }

  function mergeArrays(localArr, remoteArr) {
    // If items have an 'id' field, merge by id
    var hasIds = (localArr.length > 0 && localArr[0] && typeof localArr[0].id !== 'undefined') ||
                 (remoteArr.length > 0 && remoteArr[0] && typeof remoteArr[0].id !== 'undefined');

    if (hasIds) {
      var map = {};
      var order = [];
      var i, item;

      // Remote items first (lower priority)
      for (i = 0; i < remoteArr.length; i++) {
        item = remoteArr[i];
        var id = item && item.id != null ? String(item.id) : ('__remote_' + i);
        map[id] = item;
        order.push(id);
      }

      // Local items override or append
      for (i = 0; i < localArr.length; i++) {
        item = localArr[i];
        var lid = item && item.id != null ? String(item.id) : ('__local_' + i);
        if (map[lid]) {
          // Both sides have same id — pick newer by timestamp
          map[lid] = pickNewer(item, map[lid]);
        } else {
          map[lid] = item;
          order.push(lid);
        }
      }

      var result = [];
      for (i = 0; i < order.length; i++) {
        if (map[order[i]]) result.push(map[order[i]]);
      }
      return result;
    }

    // No ids — concatenate and deduplicate primitives
    var seen = {};
    var merged = [];
    var all = remoteArr.concat(localArr);
    for (var j = 0; j < all.length; j++) {
      var serialized = JSON.stringify(all[j]);
      if (!seen[serialized]) {
        seen[serialized] = true;
        merged.push(all[j]);
      }
    }
    return merged;
  }

  function mergeObjects(local, remote) {
    var result = {};
    var key;

    // Start with all remote keys
    for (key in remote) {
      if (remote.hasOwnProperty(key)) {
        result[key] = remote[key];
      }
    }

    // Overlay / merge local keys
    for (key in local) {
      if (local.hasOwnProperty(key)) {
        if (result.hasOwnProperty(key)) {
          result[key] = deepMerge(local[key], result[key]);
        } else {
          result[key] = local[key];
        }
      }
    }

    return result;
  }

  /**
   * Pick the item with the more recent timestamp.
   * Checks common timestamp fields: updatedAt, savedAt, createdAt, ts, timestamp.
   */
  function pickNewer(a, b) {
    var tsFields = ['updatedAt', 'savedAt', 'createdAt', 'ts', 'timestamp'];
    for (var i = 0; i < tsFields.length; i++) {
      var field = tsFields[i];
      var aTs = a && a[field] ? new Date(a[field]).getTime() : 0;
      var bTs = b && b[field] ? new Date(b[field]).getTime() : 0;
      if (aTs && bTs) {
        return aTs >= bTs ? a : b;
      }
      if (aTs) return a;
      if (bTs) return b;
    }
    // No timestamp — local (a) wins
    return a;
  }

  // ── Migration engine ─────────────────────────────────────────────────

  /**
   * Migrate all guest localStorage data to Firestore under the given user ID.
   *
   * @param {string} userId           Firebase uid
   * @param {string} [strategy='merge']  Conflict resolution strategy
   * @returns {Promise<Object>}       Migration result summary
   */
  function migrateGuestData(userId, strategy) {
    if (!userId) {
      return Promise.reject(new Error('userId is required for migration'));
    }
    if (state.migrating) {
      return Promise.reject(new Error('Migration already in progress'));
    }

    strategy = strategy || STRATEGIES.MERGE;
    var db = getFirestore();
    var guestData = getGuestData();
    var groupNames = Object.keys(guestData);

    if (groupNames.length === 0) {
      log('No guest data to migrate.');
      markMigrationComplete(userId);
      return Promise.resolve({ migrated: 0, skipped: 0, errors: 0 });
    }

    state.migrating = true;
    state.progress = 0;
    state.totalSteps = groupNames.length;
    state.currentStep = 'Starting migration...';
    state.error = null;
    notify();
    showProgressUI();

    var summary = { migrated: 0, skipped: 0, errors: 0, details: {} };

    // If Firestore is not available, store locally with a migration-pending flag
    if (!db) {
      warn('Firestore not available — queuing migration for later.');
      try {
        localStorage.setItem(MIGRATION_STATUS_KEY, JSON.stringify({
          userId: userId,
          completed: false,
          pending: true,
          strategy: strategy,
          queuedAt: new Date().toISOString()
        }));
      } catch (e) { /* ignore */ }
      state.migrating = false;
      hideProgressUI();
      notify();
      return Promise.resolve({ migrated: 0, skipped: 0, errors: 0, queued: true });
    }

    // Process each group sequentially
    return groupNames.reduce(function (chain, groupName) {
      return chain.then(function () {
        return migrateGroup(db, userId, groupName, guestData[groupName], strategy, summary);
      });
    }, Promise.resolve()).then(function () {
      // Write migration metadata
      var metaRef = db.collection('users').doc(userId);
      return metaRef.set({
        migrationLog: {
          completedAt: new Date().toISOString(),
          strategy: strategy,
          summary: {
            migrated: summary.migrated,
            skipped: summary.skipped,
            errors: summary.errors
          }
        }
      }, { merge: true }).catch(function (e) {
        warn('Failed to write migration log:', e);
      });
    }).then(function () {
      markMigrationComplete(userId);
      clearGuestData();

      state.migrating = false;
      state.progress = state.totalSteps;
      state.currentStep = 'Migration complete!';
      notify();

      log('Migration complete.', summary);

      // Auto-hide progress UI after a short delay
      setTimeout(function () { hideProgressUI(); }, 2000);

      return summary;
    }).catch(function (err) {
      state.migrating = false;
      state.error = err.message || 'Migration failed';
      state.currentStep = 'Error: ' + (err.message || 'Unknown error');
      notify();
      updateProgressUI();

      warn('Migration failed:', err);
      return Promise.reject(err);
    });
  }

  /**
   * Migrate a single data group to Firestore with retry logic.
   */
  function migrateGroup(db, userId, groupName, groupInfo, strategy, summary) {
    state.currentStep = 'Migrating ' + groupName + '...';
    state.progress++;
    notify();
    updateProgressUI();

    var collection = groupInfo.collection;
    var field = groupInfo.field;
    var localData = groupInfo.data;

    var ref = db.collection(collection).doc(userId);

    return retryOperation(function () {
      return ref.get().then(function (doc) {
        var existingData = null;
        if (doc.exists) {
          var docData = doc.data();
          existingData = docData ? docData[field] : null;
        }

        // Flatten local data — if there's only one key, unwrap it
        var localKeys = Object.keys(localData);
        var flatLocal;
        if (localKeys.length === 1) {
          flatLocal = localData[localKeys[0]];
        } else {
          flatLocal = localData;
        }

        var resolved;
        if (existingData != null) {
          resolved = resolveConflicts(flatLocal, existingData, strategy);
          log('Conflict resolved for', groupName, '(' + strategy + ')');
        } else {
          resolved = flatLocal;
        }

        var update = {};
        update[field] = resolved;
        update['_lastMigrated'] = new Date().toISOString();

        return ref.set(update, { merge: true });
      });
    }, MAX_RETRIES).then(function () {
      summary.migrated++;
      summary.details[groupName] = 'ok';
    }).catch(function (err) {
      summary.errors++;
      summary.details[groupName] = 'error: ' + (err.message || 'unknown');
      warn('Failed to migrate group "' + groupName + '":', err);
      // Don't reject — continue with other groups
    });
  }

  /**
   * Retry an async operation up to maxRetries times.
   */
  function retryOperation(fn, maxRetries) {
    var attempt = 0;

    function tryOnce() {
      attempt++;
      return fn().catch(function (err) {
        if (attempt < maxRetries) {
          log('Retry attempt', attempt, 'of', maxRetries, '...');
          return delay(RETRY_DELAY_MS * attempt).then(tryOnce);
        }
        return Promise.reject(err);
      });
    }

    return tryOnce();
  }

  // ── Cleanup ──────────────────────────────────────────────────────────

  /**
   * Remove all guest data from localStorage after a successful migration.
   */
  function clearGuestData() {
    var keys = getAllGuestKeys().concat(EPHEMERAL_KEYS);

    // Also clear the guest flag
    keys.push(GUEST_FLAG_KEY);

    for (var i = 0; i < keys.length; i++) {
      try {
        localStorage.removeItem(keys[i]);
      } catch (e) {
        warn('Failed to remove key:', keys[i], e);
      }
    }

    // Scan for any remaining cortex_/cf_ keys that might be guest data
    // (but skip auth-related ones that should persist)
    var keepPrefixes = ['cortex_user', 'cf_auth', 'cortex_migration_status'];
    try {
      var toRemove = [];
      for (var j = 0; j < localStorage.length; j++) {
        var key = localStorage.key(j);
        if (key && (key.indexOf('cortex_guest') === 0)) {
          toRemove.push(key);
        }
      }
      for (var k = 0; k < toRemove.length; k++) {
        localStorage.removeItem(toRemove[k]);
      }
    } catch (e) {
      warn('Scan cleanup failed:', e);
    }

    log('Guest data cleared from localStorage.');
  }

  function markMigrationComplete(userId) {
    try {
      localStorage.setItem(MIGRATION_STATUS_KEY, JSON.stringify({
        userId: userId,
        completed: true,
        completedAt: new Date().toISOString()
      }));
    } catch (e) { /* ignore */ }
  }

  // ── Progress UI ──────────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent =
      '.cf-migration-overlay {' +
        'position: fixed; inset: 0; z-index: 10000;' +
        'background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center;' +
        'backdrop-filter: blur(4px); animation: cf-mig-fade 0.3s ease;' +
        'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;' +
      '}' +
      '@keyframes cf-mig-fade { from { opacity: 0; } to { opacity: 1; } }' +
      '.cf-migration-card {' +
        'background: #1e1e2e; border-radius: 16px; padding: 32px;' +
        'max-width: 400px; width: 90%; text-align: center;' +
        'border: 1px solid #2d2d44; box-shadow: 0 20px 60px rgba(0,0,0,0.5);' +
        'animation: cf-mig-slide 0.3s ease;' +
      '}' +
      '@keyframes cf-mig-slide { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }' +
      '.cf-migration-card h3 {' +
        'color: #e0e0e0; font-size: 18px; margin: 0 0 6px; font-weight: 700;' +
      '}' +
      '.cf-migration-card .cf-mig-sub {' +
        'color: #888; font-size: 13px; margin: 0 0 20px;' +
      '}' +
      '.cf-migration-bar-bg {' +
        'width: 100%; height: 8px; background: #2d2d44; border-radius: 4px;' +
        'overflow: hidden; margin: 0 0 12px;' +
      '}' +
      '.cf-migration-bar-fill {' +
        'height: 100%; background: linear-gradient(90deg, #4ecca3, #00d2ff);' +
        'border-radius: 4px; transition: width 0.4s ease;' +
        'width: 0%;' +
      '}' +
      '.cf-migration-step {' +
        'color: #aaa; font-size: 12px; min-height: 18px;' +
      '}' +
      '.cf-migration-error {' +
        'color: #ff6b6b; font-size: 13px; margin: 12px 0 0; min-height: 18px;' +
      '}' +
      '.cf-migration-retry {' +
        'margin-top: 14px; padding: 8px 20px; border: none; border-radius: 8px;' +
        'background: #4ecca3; color: #1e1e2e; font-size: 13px; font-weight: 600;' +
        'cursor: pointer; display: none;' +
      '}' +
      '.cf-migration-retry:hover { background: #3dbb92; }' +
      '.cf-migration-dismiss {' +
        'margin-top: 8px; padding: 6px 16px; border: 1px solid #444; border-radius: 8px;' +
        'background: transparent; color: #888; font-size: 12px;' +
        'cursor: pointer; display: none;' +
      '}' +
      '.cf-migration-dismiss:hover { color: #ccc; border-color: #666; }';
    document.head.appendChild(s);
  }

  function showProgressUI() {
    injectStyles();

    // Remove any existing overlay
    hideProgressUI();

    var pct = state.totalSteps > 0 ? Math.round((state.progress / state.totalSteps) * 100) : 0;

    var overlay = document.createElement('div');
    overlay.className = 'cf-migration-overlay';
    overlay.id = 'cf-migration-overlay';
    overlay.innerHTML =
      '<div class="cf-migration-card">' +
        '<h3>Syncing your data</h3>' +
        '<p class="cf-mig-sub">Migrating your guest data to your new account...</p>' +
        '<div class="cf-migration-bar-bg">' +
          '<div class="cf-migration-bar-fill" id="cf-mig-bar" style="width:' + pct + '%"></div>' +
        '</div>' +
        '<div class="cf-migration-step" id="cf-mig-step">' + escapeHtml(state.currentStep) + '</div>' +
        '<div class="cf-migration-error" id="cf-mig-error"></div>' +
        '<button class="cf-migration-retry" id="cf-mig-retry">Retry Migration</button>' +
        '<button class="cf-migration-dismiss" id="cf-mig-dismiss">Dismiss</button>' +
      '</div>';

    document.body.appendChild(overlay);
    state.uiEl = overlay;

    // Wire up retry button
    var retryBtn = document.getElementById('cf-mig-retry');
    if (retryBtn) {
      retryBtn.addEventListener('click', function () {
        var user = getCurrentUser();
        if (user) {
          migrateGuestData(user.uid, STRATEGIES.MERGE);
        }
      });
    }

    // Wire up dismiss button
    var dismissBtn = document.getElementById('cf-mig-dismiss');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', function () {
        hideProgressUI();
      });
    }
  }

  function updateProgressUI() {
    var bar = document.getElementById('cf-mig-bar');
    var step = document.getElementById('cf-mig-step');
    var errorEl = document.getElementById('cf-mig-error');
    var retryBtn = document.getElementById('cf-mig-retry');
    var dismissBtn = document.getElementById('cf-mig-dismiss');

    if (!bar) return;

    var pct = state.totalSteps > 0 ? Math.round((state.progress / state.totalSteps) * 100) : 0;
    bar.style.width = pct + '%';

    if (step) {
      step.textContent = state.currentStep;
    }

    if (errorEl) {
      errorEl.textContent = state.error || '';
    }

    if (retryBtn) {
      retryBtn.style.display = state.error ? 'inline-block' : 'none';
    }

    if (dismissBtn) {
      dismissBtn.style.display = state.error ? 'inline-block' : 'none';
    }
  }

  function hideProgressUI() {
    var el = document.getElementById('cf-migration-overlay');
    if (el) {
      el.parentNode.removeChild(el);
    }
    state.uiEl = null;
  }

  // ── Auth state listener ──────────────────────────────────────────────

  function onAuthStateChanged(user) {
    if (!user) return;

    // Check if this is a guest-to-registered transition
    if (!isGuestToRegisteredTransition(user)) {
      log('No guest data to migrate for user:', user.uid);

      // Check for a queued pending migration (Firestore was unavailable earlier)
      checkPendingMigration(user);
      return;
    }

    log('Guest-to-registered transition detected for user:', user.uid);

    // Small delay to let the auth flow settle (redirects, UI updates)
    setTimeout(function () {
      migrateGuestData(user.uid, STRATEGIES.MERGE).catch(function (err) {
        warn('Auto-migration failed:', err);
      });
    }, 800);
  }

  /**
   * Check if there's a pending migration that was queued when Firestore
   * was unavailable and retry it now.
   */
  function checkPendingMigration(user) {
    try {
      var raw = localStorage.getItem(MIGRATION_STATUS_KEY);
      if (!raw) return;
      var status = JSON.parse(raw);
      if (status.pending && !status.completed && status.userId === user.uid) {
        var db = getFirestore();
        if (db) {
          log('Retrying pending migration for user:', user.uid);
          migrateGuestData(user.uid, status.strategy || STRATEGIES.MERGE).catch(function (err) {
            warn('Pending migration retry failed:', err);
          });
        }
      }
    } catch (e) { /* ignore */ }
  }

  // ── Init ─────────────────────────────────────────────────────────────

  /**
   * Initialize the account linking module.
   * Listens to Firebase auth state changes and auto-triggers migration
   * when a guest-to-registered transition is detected.
   */
  function init() {
    if (state.initialized) {
      log('Already initialized.');
      return;
    }

    // Listen via CortexFreelancer.firebaseAuth if available
    var ns = window.CortexFreelancer || {};
    if (ns.firebaseAuth && typeof ns.firebaseAuth.onAuthChange === 'function') {
      state.authUnsubscribe = ns.firebaseAuth.onAuthChange(function (authState) {
        if (authState && authState.user && !authState.loading) {
          onAuthStateChanged(authState.user);
        }
      });
      log('Listening via CortexFreelancer.firebaseAuth.onAuthChange');
    } else {
      // Fall back to direct Firebase auth listener
      var auth = getAuth();
      if (auth) {
        state.authUnsubscribe = auth.onAuthStateChanged(function (user) {
          onAuthStateChanged(user);
        });
        log('Listening via firebase.auth().onAuthStateChanged');
      } else {
        warn('Firebase auth not available. Call init() after Firebase is loaded.');
      }
    }

    state.initialized = true;
    log('Initialized.');
  }

  // ── Public API ───────────────────────────────────────────────────────

  /**
   * Subscribe to migration progress events.
   * @param {Function} callback  Receives { migrating, progress, totalSteps, currentStep, error }
   * @returns {Function} unsubscribe
   */
  function onProgress(callback) {
    state.listeners.push(callback);
    return function () {
      var idx = state.listeners.indexOf(callback);
      if (idx !== -1) state.listeners.splice(idx, 1);
    };
  }

  /**
   * Get the current migration status.
   * @returns {Object|null}
   */
  function getMigrationStatus() {
    try {
      var raw = localStorage.getItem(MIGRATION_STATUS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Tear down the module — remove auth listener and UI.
   */
  function destroy() {
    if (state.authUnsubscribe) {
      state.authUnsubscribe();
      state.authUnsubscribe = null;
    }
    hideProgressUI();
    state.initialized = false;
    state.listeners = [];
    log('Destroyed.');
  }

  // ── Export ──────────────────────────────────────────────────────────

  window.CortexFreelancer.AccountLinking = {
    init: init,
    destroy: destroy,
    migrateGuestData: migrateGuestData,
    resolveConflicts: resolveConflicts,
    getGuestData: getGuestData,
    clearGuestData: clearGuestData,
    hasGuestData: hasGuestData,
    getMigrationStatus: getMigrationStatus,
    onProgress: onProgress,
    STRATEGIES: STRATEGIES
  };

  console.log('[CF] Account linking module loaded');
})();
