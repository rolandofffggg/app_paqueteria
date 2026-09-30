class SyncEngine {
  constructor() {
    this.isSyncing = false;
  }

  async processQueue() {
    if (this.isSyncing || !navigator.onLine) return;
    this.isSyncing = true;

    try {
      const queue = await db.getAll('syncQueue');
      if (queue.length > 0) {
        for (const item of queue) {
          try {
            await api.sendSyncItem(item);
            await db.delete('syncQueue', item.id);
          } catch (err) {
            console.error('Error al enviar item de sincronización:', err);
            break; // Si falla la red, interrumpe el ciclo hasta la próxima reconexión
          }
        }
      }

      // Descargar cambios remotos de otros usuarios
      await this.pullRemoteChanges();
    } catch (e) {
      console.error('Error durante el proceso de sincronización:', e);
    } finally {
      this.isSyncing = false;
      if (typeof app !== 'undefined') {
        app.loadDashboard();
      }
    }
  }

  async pullRemoteChanges() {
    try {
      const remoteData = await api.getRemotePackages();
      if (Array.isArray(remoteData)) {
        for (const remotePkg of remoteData) {
          const localPkg = await db.get('packages', remotePkg.packageId);
          
          // Si no existe localmente o la versión remota es más reciente, actualiza IndexedDB
          if (!localPkg || (remotePkg.updatedAt && new Date(remotePkg.updatedAt) > new Date(localPkg.updatedAt || localPkg.createdAt))) {
            await db.put('packages', remotePkg);
          }
        }
      }
    } catch (e) {
      console.warn('No se pudieron descargar actualizaciones remotas:', e);
    }
  }
}

const syncEngine = new SyncEngine();
