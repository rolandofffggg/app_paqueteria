const DB_NAME = 'ParcelTrackDB';
const DB_VERSION = 3; // Incrementado para la tienda de usuarios (Fase 11)

class LocalDB {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = async () => {
        this.db = req.result;
        await this.seedDefaultUser();
        resolve();
      };
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('packages')) {
          const store = db.createObjectStore('packages', { keyPath: 'packageId' });
          store.createIndex('status', 'status', { unique: false });
        }
        if (!db.objectStoreNames.contains('syncQueue')) {
          db.createObjectStore('syncQueue', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('users')) {
          db.createObjectStore('users', { keyPath: 'username' });
        }
      };
    });
  }

  async seedDefaultUser() {
    const users = await this.getAll('users');
    if (users.length === 0) {
      const defaultAdmin = {
        username: 'admin',
        pin: '1234',
        fullName: 'Administrador del Sistema',
        role: 'ADMIN',
        status: 'ACTIVE',
        createdAt: new Date().toISOString()
      };
      await this.put('users', defaultAdmin);
    }
  }

  async get(storeName, key) {
    return new Promise((resolve) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
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
