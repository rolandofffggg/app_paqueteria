const DB_NAME = 'ParcelTrackDB';
const DB_VERSION = 1;

class LocalDB {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        this.db = req.result;
        resolve();
      };
      req.onupgradeneeded = e => {
        const db = e.result;
        if (!db.objectStoreNames.contains('packages')) {
          const store = db.createObjectStore('packages', { keyPath: 'packageId' });
          store.createIndex('status', 'status', { unique: false });
        }
        if (!db.objectStoreNames.contains('syncQueue')) {
          db.createObjectStore('syncQueue', { keyPath: 'id' });
        }
      };
    });
  }

  async getAll(storeName) {
    return new Promise((resolve) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
    });
  }

  async put(storeName, data) {
    return new Promise((resolve) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.put(data);
      tx.oncomplete = () => resolve();
    });
  }

  async delete(storeName, id) {
    return new Promise((resolve) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.delete(id);
      tx.oncomplete = () => resolve();
    });
  }
}

const db = new LocalDB();
