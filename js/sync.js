class SyncEngine {
  constructor() {
    this.isSyncing = false;
  }

  async processQueue() {
    if (this.isSyncing || !navigator.onLine) return;
    this.isSyncing = true;

    const queue = await db.getAll('syncQueue');
    const syncStatusEl = document.getElementById('sync-status');
    
    if (queue.length === 0) {
      syncStatusEl.classList.add('hidden');
      this.isSyncing = false;
      return;
    }

    syncStatusEl.textContent = `Sync: ${queue.length}`;
    syncStatusEl.classList.remove('hidden');

    const success = await api.sendBatch(queue);
    if (success) {
      for (const item of queue) {
        await db.delete('syncQueue', item.id);
      }
      syncStatusEl.classList.add('hidden');
      if (window.app) app.loadDashboard();
    }

    this.isSyncing = false;
  }
}

const syncEngine = new SyncEngine();
