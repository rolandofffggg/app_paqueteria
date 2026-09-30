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
            await api.syncItem(item);
            await db.delete('syncQueue', item.id);
          } catch (err) {
            console.error('Error al sincronizar elemento individual:', err);
          }
        }
      }

      // Sincronización bidireccional de datos remotos (Paquetes y Usuarios)
      await this.pullRemoteData();
    } catch (e) {
      console.error('Error general durante la sincronización:', e);
    } finally {
      this.isSyncing = false;
      if (typeof app !== 'undefined' && app.loadDashboard) {
        app.loadDashboard();
      }
    }
  }

  async pullRemoteData() {
    try {
      const remoteData = await api.fetchLatestData();
      
      // 1. Sincronizar Paquetes Remotos
      if (remoteData && remoteData.packages) {
        for (const remotePkg of remoteData.packages) {
          const localPkg = await db.get('packages', remotePkg.packageId);
          if (!localPkg || new Date(remotePkg.updatedAt || remotePkg.createdAt) > new Date(localPkg.updatedAt || localPkg.createdAt)) {
            await db.put('packages', remotePkg);
          }
        }
      }

      // 2. Sincronizar Usuarios Remotos
      if (remoteData && remoteData.users) {
        for (const remoteUser of remoteData.users) {
          const localUser = await db.get('users', remoteUser.username);
          if (!localUser || new Date(remoteUser.updatedAt || remoteUser.createdAt) > new Date(localUser.updatedAt || localUser.createdAt)) {
            await db.put('users', remoteUser);
          }
        }
      }
    } catch (err) {
      console.warn('No se pudo completar la descarga de datos remotos:', err);
    }
  }
}

const syncEngine = new SyncEngine();
