/**
 * CF-262: API Key Rotation Strategy
 * Key rotation scheduler with zero-downtime switchover, audit logging, and expiration tracking.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_key_rotation';
  var API_ENDPOINT = '/api/keys';
  var DEFAULT_ROTATION_DAYS = 90;

  /**
   * Get rotation state from localStorage.
   * @returns {object}
   */
  function getState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { keys: {}, auditLog: [] };
    } catch (_e) {
      return { keys: {}, auditLog: [] };
    }
  }

  /**
   * Save rotation state.
   * @param {object} state
   */
  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  /**
   * Add an entry to the audit log.
   * @param {string} action
   * @param {string} keyName
   * @param {object} [details]
   */
  function logAudit(action, keyName, details) {
    var state = getState();
    state.auditLog.push({
      action: action,
      keyName: keyName,
      timestamp: new Date().toISOString(),
      details: details || {}
    });
    // Keep last 100 entries
    if (state.auditLog.length > 100) {
      state.auditLog = state.auditLog.slice(-100);
    }
    saveState(state);
  }

  /**
   * Register a key for rotation tracking.
   * @param {string} keyName - Identifier (e.g., 'ANTHROPIC_API_KEY')
   * @param {{ rotationDays: number, createdAt: string }} [opts]
   */
  function registerKey(keyName, opts) {
    var o = opts || {};
    var state = getState();
    state.keys[keyName] = {
      keyName: keyName,
      createdAt: o.createdAt || new Date().toISOString(),
      rotationDays: o.rotationDays || DEFAULT_ROTATION_DAYS,
      status: 'active',
      lastRotated: null,
      nextRotation: null
    };

    var created = new Date(state.keys[keyName].createdAt);
    var next = new Date(created.getTime() + (state.keys[keyName].rotationDays * 24 * 60 * 60 * 1000));
    state.keys[keyName].nextRotation = next.toISOString();

    saveState(state);
    logAudit('register', keyName, { rotationDays: state.keys[keyName].rotationDays });
  }

  /**
   * Get all registered keys with their rotation status.
   * @returns {Array<{ keyName: string, status: string, daysUntilRotation: number, isExpired: boolean }>}
   */
  function getKeyStatuses() {
    var state = getState();
    var now = Date.now();

    return Object.keys(state.keys).map(function (name) {
      var key = state.keys[name];
      var nextRotation = key.nextRotation ? new Date(key.nextRotation).getTime() : 0;
      var daysUntil = Math.ceil((nextRotation - now) / (1000 * 60 * 60 * 24));

      return {
        keyName: name,
        status: key.status,
        createdAt: key.createdAt,
        lastRotated: key.lastRotated,
        nextRotation: key.nextRotation,
        daysUntilRotation: daysUntil,
        isExpired: daysUntil <= 0
      };
    });
  }

  /**
   * Perform zero-downtime key rotation.
   * Creates new key, validates it, then deactivates the old one.
   * @param {string} keyName
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async function rotateKey(keyName) {
    var state = getState();
    var key = state.keys[keyName];
    if (!key) return { success: false, message: 'Key not registered: ' + keyName };

    logAudit('rotation_started', keyName);

    // Step 1: Request new key generation
    try {
      var res = await fetch(API_ENDPOINT + '/rotate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyName: keyName })
      });

      if (!res.ok) {
        logAudit('rotation_failed', keyName, { step: 'generate', status: res.status });
        return { success: false, message: 'Failed to generate new key' };
      }

      var result = await res.json();

      // Step 2: Validate new key works
      var validateRes = await fetch(API_ENDPOINT + '/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyName: keyName, keyId: result.newKeyId })
      });

      if (!validateRes.ok) {
        logAudit('rotation_failed', keyName, { step: 'validate' });
        return { success: false, message: 'New key validation failed — old key preserved' };
      }

      // Step 3: Deactivate old key
      await fetch(API_ENDPOINT + '/deactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyName: keyName, keyId: result.oldKeyId })
      });

      // Update state
      var now = new Date();
      state.keys[keyName].lastRotated = now.toISOString();
      state.keys[keyName].createdAt = now.toISOString();
      var nextDate = new Date(now.getTime() + (key.rotationDays * 24 * 60 * 60 * 1000));
      state.keys[keyName].nextRotation = nextDate.toISOString();
      saveState(state);

      logAudit('rotation_completed', keyName);
      return { success: true, message: 'Key rotated successfully' };
    } catch (err) {
      logAudit('rotation_failed', keyName, { error: err.message });
      return { success: false, message: 'Rotation error: ' + err.message };
    }
  }

  /**
   * Get keys that are due for rotation.
   * @returns {Array}
   */
  function getKeysNeedingRotation() {
    return getKeyStatuses().filter(function (k) {
      return k.isExpired || k.daysUntilRotation <= 7;
    });
  }

  /**
   * Check all keys and send notifications for upcoming expirations.
   * @param {function} notifyFn - Called with { keyName, daysUntilRotation, isExpired }
   */
  function checkAndNotify(notifyFn) {
    if (typeof notifyFn !== 'function') return;

    var needsAttention = getKeysNeedingRotation();
    needsAttention.forEach(function (key) {
      notifyFn({
        keyName: key.keyName,
        daysUntilRotation: key.daysUntilRotation,
        isExpired: key.isExpired,
        message: key.isExpired
          ? key.keyName + ' has expired and needs immediate rotation'
          : key.keyName + ' expires in ' + key.daysUntilRotation + ' days'
      });
    });
  }

  /**
   * Get the audit log.
   * @param {number} [limit]
   * @returns {Array}
   */
  function getAuditLog(limit) {
    var state = getState();
    var log = state.auditLog || [];
    if (limit && limit > 0) return log.slice(-limit);
    return log;
  }

  /**
   * Remove a key from rotation tracking.
   * @param {string} keyName
   */
  function unregisterKey(keyName) {
    var state = getState();
    delete state.keys[keyName];
    saveState(state);
    logAudit('unregister', keyName);
  }

  // Export to namespace
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.APIKeyRotation = {
    registerKey: registerKey,
    getKeyStatuses: getKeyStatuses,
    rotateKey: rotateKey,
    getKeysNeedingRotation: getKeysNeedingRotation,
    checkAndNotify: checkAndNotify,
    getAuditLog: getAuditLog,
    unregisterKey: unregisterKey
  };
})();
