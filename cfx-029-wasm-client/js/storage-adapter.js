/**
 * Storage Adapter - IndexedDB interface for WASM client
 *
 * WASM cannot directly access IndexedDB, so we provide a JS adapter.
 *
 * Stores:
 * - queue: offline message queue
 * - kv: small key/value items (optional)
 */

class StorageAdapter {
  constructor(options = {}) {
    this.dbName = options.dbName || 'cortex_wasm_client';
    this.dbVersion = options.dbVersion || 1;
    this.db = null;
  }

  async initialize() {
    if (!('indexedDB' in window)) {
      console.warn('[storage] IndexedDB not available; persistence disabled');
      return { supported: false };
    }

    this.db = await new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, this.dbVersion);

      req.onupgradeneeded = () => {
        const db = req.result;

        if (!db.objectStoreNames.contains('queue')) {
          const store = db.createObjectStore('queue', { keyPath: 'id' });
          store.createIndex('byPriority', 'priority');
          store.createIndex('byQueuedAt', 'queuedAt');
        }

        if (!db.objectStoreNames.contains('kv')) {
          db.createObjectStore('kv', { keyPath: 'key' });
        }
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    return { supported: true };
  }

  _tx(storeName, mode = 'readonly') {
    if (!this.db) throw new Error('Storage not initialized');
    return this.db.transaction(storeName, mode).objectStore(storeName);
  }

  async saveQueuedMessage(messageJson, priority = 100) {
    if (!this.db) return;

    const id = `q_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const record = {
      id,
      message: messageJson,
      priority,
      queuedAt: Date.now(),
    };

    await new Promise((resolve, reject) => {
      const store = this._tx('queue', 'readwrite');
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    return id;
  }

  async getQueuedMessages(limit = 200) {
    if (!this.db) return [];

    const records = await new Promise((resolve, reject) => {
      const store = this._tx('queue', 'readonly');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    // Sort: higher priority first; older first
    records.sort((a, b) => (b.priority - a.priority) || (a.queuedAt - b.queuedAt));
    return records.slice(0, limit);
  }

  async deleteQueuedMessage(id) {
    if (!this.db) return;
    await new Promise((resolve, reject) => {
      const store = this._tx('queue', 'readwrite');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async clearQueuedMessages() {
    if (!this.db) return;
    await new Promise((resolve, reject) => {
      const store = this._tx('queue', 'readwrite');
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async setKV(key, value) {
    if (!this.db) return;
    await new Promise((resolve, reject) => {
      const store = this._tx('kv', 'readwrite');
      const req = store.put({ key, value, updatedAt: Date.now() });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getKV(key) {
    if (!this.db) return null;
    const rec = await new Promise((resolve, reject) => {
      const store = this._tx('kv', 'readonly');
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    return rec ? rec.value : null;
  }
}

window.StorageAdapter = StorageAdapter;
