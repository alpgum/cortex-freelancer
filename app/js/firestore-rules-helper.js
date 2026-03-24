/**
 * Cortex Freelancer — Firestore Rules Helper
 * [CF-221] Client-side validation helper that checks data before Firestore
 * writes to match security rules. Prevents wasted writes and gives clear
 * error messages when data would be rejected by server-side rules.
 *
 * @namespace window.CortexFreelancer.FirestoreRulesHelper
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var LOG_PREFIX = '[CF-221]';

  // ── Collection schemas ──────────────────────────────────────────────

  /**
   * Define expected fields and ownership semantics per collection.
   * ownerField: the document path segment or data field that must match uid.
   * pathOwned: true if the doc ID itself is the userId.
   */
  var COLLECTION_RULES = {
    users: {
      pathOwned: true,
      requiredFields: [],
      optionalFields: ['email', 'displayName', 'role', 'settings', 'onboarding',
        'smartFilter', 'availability', 'subscription', 'revenueNotifications',
        'multiPlatform', 'guestData', 'migrationLog', '_lastMigrated'],
      adminCanRead: true,
      adminCanWrite: false
    },
    profiles: {
      pathOwned: true,
      requiredFields: [],
      optionalFields: ['bio', 'skills', 'portfolio', 'hourlyRate', 'location', 'avatar'],
      adminCanRead: true,
      adminCanWrite: false
    },
    user_preferences: {
      pathOwned: true,
      requiredFields: [],
      optionalFields: ['theme', 'language', 'notifications', 'timezone', 'currency'],
      adminCanRead: true,
      adminCanWrite: false
    },
    bookmarks: {
      pathOwned: true,
      requiredFields: [],
      optionalFields: ['items'],
      adminCanRead: true,
      adminCanWrite: false
    },
    proposals: {
      pathOwned: true,
      requiredFields: [],
      optionalFields: ['items'],
      adminCanRead: true,
      adminCanWrite: false
    },
    analytics: {
      pathOwned: true,
      requiredFields: [],
      optionalFields: ['earnings', 'toolFeedback', 'feedback', 'weeklyInsights',
        'skillGap', 'clientComms', 'profileComparison'],
      adminCanRead: true,
      adminCanWrite: false
    },
    login_analytics: {
      pathOwned: false,
      ownerField: 'uid',
      requiredFields: ['uid'],
      optionalFields: ['timestamp', 'device', 'browser', 'ip', 'method'],
      adminCanRead: true,
      adminCanWrite: false
    },
    subscriptions: {
      pathOwned: true,
      requiredFields: [],
      optionalFields: ['plan', 'status', 'startDate', 'endDate', 'trialEnd'],
      adminCanRead: true,
      adminCanWrite: true,
      adminOnly: true
    },
    contracts: {
      pathOwned: false,
      ownerField: 'freelancerId',
      secondaryOwnerField: 'clientId',
      requiredFields: [],
      optionalFields: ['freelancerId', 'clientId', 'title', 'status', 'amount',
        'startDate', 'endDate', 'terms'],
      adminCanRead: true,
      adminCanWrite: false
    },
    payments: {
      pathOwned: false,
      ownerField: 'userId',
      requiredFields: [],
      optionalFields: [],
      adminCanRead: true,
      serverOnly: true
    }
  };

  // ── Helpers ─────────────────────────────────────────────────────────

  function log() {
    var args = [LOG_PREFIX].concat(Array.prototype.slice.call(arguments));
    console.log.apply(console, args);
  }

  function getAuth() {
    if (typeof firebase !== 'undefined' && firebase.auth) {
      return firebase.auth();
    }
    return null;
  }

  function getCurrentUid() {
    var auth = getAuth();
    return auth && auth.currentUser ? auth.currentUser.uid : null;
  }

  function getCurrentUserRole() {
    var ns = window.CortexFreelancer || {};
    if (ns.RoleBasedAccess && typeof ns.RoleBasedAccess.getCurrentRole === 'function') {
      return ns.RoleBasedAccess.getCurrentRole();
    }
    try {
      return localStorage.getItem('cortex_user_role') || 'user';
    } catch (e) {
      return 'user';
    }
  }

  // ── Validation ──────────────────────────────────────────────────────

  /**
   * Validate a write operation before sending to Firestore.
   *
   * @param {string} collection  Firestore collection name
   * @param {string} docId       Document ID being written
   * @param {Object} data        Data payload
   * @param {string} [operation] 'create', 'update', or 'delete'
   * @returns {{ valid: boolean, errors: string[] }}
   */
  function validateWrite(collection, docId, data, operation) {
    var errors = [];
    var uid = getCurrentUid();
    var role = getCurrentUserRole();
    var rules = COLLECTION_RULES[collection];
    operation = operation || 'update';

    // Unknown collection — can't validate, allow with warning
    if (!rules) {
      log('No rules defined for collection:', collection);
      return { valid: true, errors: [], warnings: ['No client-side rules for collection: ' + collection] };
    }

    // Auth check
    if (!uid) {
      errors.push('User must be authenticated to write to ' + collection);
      return { valid: false, errors: errors };
    }

    // Server-only collections
    if (rules.serverOnly) {
      errors.push(collection + ' is server-only — client writes are not allowed');
      return { valid: false, errors: errors };
    }

    // Admin-only collections
    if (rules.adminOnly && role !== 'admin') {
      errors.push(collection + ' requires admin role for writes');
      return { valid: false, errors: errors };
    }

    // Ownership check
    if (rules.pathOwned) {
      if (docId !== uid && role !== 'admin') {
        errors.push('Document ID must match authenticated user ID for ' + collection);
      }
    } else if (rules.ownerField && data) {
      if (operation === 'create' && data[rules.ownerField] !== uid && role !== 'admin') {
        errors.push(rules.ownerField + ' must match authenticated user ID');
      }
    }

    // Required fields check (on create)
    if (operation === 'create' && rules.requiredFields.length > 0 && data) {
      for (var i = 0; i < rules.requiredFields.length; i++) {
        var field = rules.requiredFields[i];
        if (data[field] === undefined || data[field] === null) {
          errors.push('Missing required field: ' + field);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Validate a read operation.
   *
   * @param {string} collection  Firestore collection name
   * @param {string} docId       Document ID being read
   * @returns {{ valid: boolean, errors: string[] }}
   */
  function validateRead(collection, docId) {
    var errors = [];
    var uid = getCurrentUid();
    var role = getCurrentUserRole();
    var rules = COLLECTION_RULES[collection];

    if (!uid) {
      errors.push('User must be authenticated to read ' + collection);
      return { valid: false, errors: errors };
    }

    if (!rules) {
      return { valid: true, errors: [], warnings: ['No client-side rules for collection: ' + collection] };
    }

    // Ownership check for path-owned collections
    if (rules.pathOwned && docId !== uid && role !== 'admin') {
      errors.push('Can only read own documents from ' + collection);
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Get the collection rules configuration (for debugging/testing).
   * @param {string} [collection]  If omitted, returns all rules.
   * @returns {Object}
   */
  function getRules(collection) {
    if (collection) {
      return COLLECTION_RULES[collection] || null;
    }
    return Object.assign({}, COLLECTION_RULES);
  }

  /**
   * Check whether the current user can perform an operation.
   *
   * @param {string} operation   'read' or 'write'
   * @param {string} collection  Firestore collection
   * @param {string} docId       Document ID
   * @param {Object} [data]      Data payload (for writes)
   * @returns {boolean}
   */
  function canPerform(operation, collection, docId, data) {
    if (operation === 'read') {
      return validateRead(collection, docId).valid;
    }
    return validateWrite(collection, docId, data, operation).valid;
  }

  // ── Public API ──────────────────────────────────────────────────────

  window.CortexFreelancer.FirestoreRulesHelper = {
    validateWrite: validateWrite,
    validateRead: validateRead,
    canPerform: canPerform,
    getRules: getRules
  };

  console.log('[CF] Firestore rules helper loaded');
})();
