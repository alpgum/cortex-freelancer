/**
 * CFX-041: SessionStorage (IndexedDB wrapper)
 * Client-side message persistence.
 *
 * Storage model:
 *   DB: cortex_sessions_v1
 *   Stores:
 *     - messages: keyPath [sessionId, ts]
 *     - meta: keyPath sessionId
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CortexSessionStorage = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DB_NAME = 'cortex_sessions_v1';
  var DB_VERSION = 1;
  var STORE_MESSAGES = 'messages';
  var STORE_META = 'meta';

  function openDb() {
    return new Promise(function (resolve, reject) {
      if (!('indexedDB' in self)) {
        reject(new Error('IndexedDB not supported'));
        return;
      }

      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
          var msg = db.createObjectStore(STORE_MESSAGES, { keyPath: ['sessionId', 'ts'] });
          msg.createIndex('by_session', 'sessionId', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'sessionId' });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('Failed to open IndexedDB')); };
    });
  }

  function withTx(db, storeName, mode, fn) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(storeName, mode);
      var store = tx.objectStore(storeName);
      var result;
      try { result = fn(store, tx); }
      catch (e) { reject(e); return; }
      tx.oncomplete = function () { resolve(result); };
      tx.onerror = function () { reject(tx.error || new Error('IndexedDB transaction error')); };
      tx.onabort = function () { reject(tx.error || new Error('IndexedDB transaction aborted')); };
    });
  }

  function Storage(options) {
    options = options || {};
    this.maxMessages = typeof options.maxMessages === 'number' ? options.maxMessages : 200;
    this._dbp = null;
  }

  Storage.prototype._db = function () {
    if (!this._dbp) this._dbp = openDb();
    return this._dbp;
  };

  Storage.prototype.putMeta = async function (meta) {
    var db = await this._db();
    return withTx(db, STORE_META, 'readwrite', function (store) {
      store.put(meta);
    });
  };

  Storage.prototype.getMeta = async function (sessionId) {
    var db = await this._db();
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE_META, 'readonly');
      var store = tx.objectStore(STORE_META);
      var req = store.get(sessionId);
      req.onsuccess = function () { resolve(req.result || null); };
      req.onerror = function () { reject(req.error || new Error('IndexedDB getMeta error')); };
    });
  };

  Storage.prototype.addMessage = async function (sessionId, message) {
    var db = await this._db();
    var selfRef = this;

    var entry = {
      sessionId: sessionId,
      ts: message.ts || Date.now(),
      role: message.role,
      content: message.content
    };

    await withTx(db, STORE_MESSAGES, 'readwrite', function (store) {
      store.put(entry);
    });

    // Best-effort trimming to maxMessages
    try {
      var count = await this.countMessages(sessionId);
      if (count > selfRef.maxMessages) {
        var toDelete = count - selfRef.maxMessages;
        await this.deleteOldest(sessionId, toDelete);
      }
    } catch (_e) {}
  };

  Storage.prototype.countMessages = async function (sessionId) {
    var db = await this._db();
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE_MESSAGES, 'readonly');
      var store = tx.objectStore(STORE_MESSAGES);
      var idx = store.index('by_session');
      var req = idx.count(sessionId);
      req.onsuccess = function () { resolve(req.result || 0); };
      req.onerror = function () { reject(req.error || new Error('IndexedDB countMessages error')); };
    });
  };

  Storage.prototype.getMessages = async function (sessionId, limit) {
    var db = await this._db();
    limit = typeof limit === 'number' && limit > 0 ? limit : null;

    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE_MESSAGES, 'readonly');
      var store = tx.objectStore(STORE_MESSAGES);
      var idx = store.index('by_session');
      var range = IDBKeyRange.only(sessionId);
      var req = idx.openCursor(range, 'next');

      var items = [];
      req.onsuccess = function (e) {
        var cursor = e.target.result;
        if (!cursor) {
          if (limit && items.length > limit) items = items.slice(-limit);
          resolve(items);
          return;
        }
        items.push(cursor.value);
        cursor.continue();
      };
      req.onerror = function () { reject(req.error || new Error('IndexedDB getMessages error')); };
    });
  };

  Storage.prototype.deleteOldest = async function (sessionId, n) {
    if (!n || n <= 0) return;
    var db = await this._db();

    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE_MESSAGES, 'readwrite');
      var store = tx.objectStore(STORE_MESSAGES);
      var idx = store.index('by_session');
      var range = IDBKeyRange.only(sessionId);
      var req = idx.openCursor(range, 'next');
      var deleted = 0;

      req.onsuccess = function (e) {
        var cursor = e.target.result;
        if (!cursor || deleted >= n) return;
        store.delete(cursor.primaryKey);
        deleted++;
        cursor.continue();
      };

      tx.oncomplete = function () { resolve(deleted); };
      tx.onerror = function () { reject(tx.error || new Error('IndexedDB deleteOldest error')); };
      tx.onabort = function () { reject(tx.error || new Error('IndexedDB deleteOldest aborted')); };
    });
  };

  Storage.prototype.clearSession = async function (sessionId) {
    var db = await this._db();

    // Delete messages for session
    await new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE_MESSAGES, 'readwrite');
      var store = tx.objectStore(STORE_MESSAGES);
      var idx = store.index('by_session');
      var range = IDBKeyRange.only(sessionId);
      var req = idx.openCursor(range, 'next');

      req.onsuccess = function (e) {
        var cursor = e.target.result;
        if (!cursor) return;
        store.delete(cursor.primaryKey);
        cursor.continue();
      };

      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error || new Error('IndexedDB clearSession messages error')); };
    });

    // Delete meta
    await withTx(db, STORE_META, 'readwrite', function (store) {
      store.delete(sessionId);
    });
  };

  return Storage;
});
