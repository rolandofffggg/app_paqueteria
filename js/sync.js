class SyncEngine {
  constructor() {
    this.isSyncing = false;
  }

  async processQueue() {
    if (this.isSyncing || !navigator.onLine) return;
    this.isSyncing = true;

    const syncStatusEl = document.getElementById('sync-status');
    
    try {
      // 1. PUSH: Enviar cambios locales pendientes a la nube
      const queue = await db.getAll('syncQueue');
      if (queue.length > 0) {
        syncStatusEl.textContent = `Enviando: ${queue.length}`;
        syncStatusEl.classList.remove('hidden');

        const success = await api.sendBatch(queue);
        if (success) {
          for (const item of queue) {
            await db.delete('syncQueue', item.id);
          }
        }
      }

      // 2. PULL: Traer datos frescos de Google Sheets
      syncStatusEl.textContent = `Actualizando...`;
      syncStatusEl.classList.remove('hidden');

      const remotePackages = await api.fetchPackages();
      if (remotePackages && Array.isArray(remotePackages)) {
        for (const remotePkg of remotePackages) {
          const localPkg = await db.get('packages', remotePkg.packageId);
          // Actualizar en local solo si no hay cambios locales pendientes para este paquete
          const inQueue = queue.some(q => q.payload.packageId === remotePkg.packageId);
          if (!inQueue) {
            await db.put('packages', remotePkg);
          }
        }
      }
    } catch (e) {
      console.error('Error durante la sincronización:', e);
    } finally {
      syncStatusEl.classList.add('hidden');
      this.isSyncing = false;
      if (window.app) app.loadDashboard();
    }
  }
}

const syncEngine = new SyncEngine();
