class SyncEngine {
  constructor() {
    this.isSyncing = false;
    this.autoSyncInterval = null;
  }

  async processQueue() {
    if (this.isSyncing || !navigator.onLine) return;
    this.isSyncing = true;

    const syncStatusEl = document.getElementById('sync-status');
    
    try {
      // 1. PUSH: Enviar cola local pendiente
      const queue = await db.getAll('syncQueue');
      if (queue.length > 0) {
        if (syncStatusEl) {
          syncStatusEl.textContent = `Enviando (${queue.length})...`;
          syncStatusEl.classList.remove('hidden');
        }

        const success = await api.sendBatch(queue);
        if (success) {
          for (const item of queue) {
            await db.delete('syncQueue', item.id);
          }
        }
      }

      // 2. PULL: Descargar registros actualizados de la nube
      if (syncStatusEl) {
        syncStatusEl.textContent = `Actualizando...`;
        syncStatusEl.classList.remove('hidden');
      }

      const remotePackages = await api.fetchPackages();
      if (remotePackages && Array.isArray(remotePackages)) {
        const remainingQueue = await db.getAll('syncQueue');
        
        for (const remotePkg of remotePackages) {
          // Si el paquete no tiene operaciones locales pendientes en cola, actualizar IndexedDB
          const inQueue = remainingQueue.some(q => q.payload && q.payload.packageId === remotePkg.packageId);
          if (!inQueue) {
            await db.put('packages', remotePkg);
          }
        }
      }
    } catch (e) {
      console.error('Error durante la sincronización:', e);
    } finally {
      if (syncStatusEl) {
        syncStatusEl.classList.add('hidden');
      }
      this.isSyncing = false;

      // Refrescar vistas en pantalla si existen
      if (window.app) {
        app.loadDashboard();
        app.loadManageList();
      }
    }
  }

  // Sincronización periódica automática (Cada 30 segundos si hay conexión)
  startAutoSync(intervalMs = 30000) {
    if (this.autoSyncInterval) clearInterval(this.autoSyncInterval);
    this.autoSyncInterval = setInterval(() => {
      if (navigator.onLine) {
        this.processQueue();
      }
    }, intervalMs);
  }
}

const syncEngine = new SyncEngine();

// Iniciar sincronización automática al cargar
document.addEventListener('DOMContentLoaded', () => {
  syncEngine.startAutoSync(30000);
});
