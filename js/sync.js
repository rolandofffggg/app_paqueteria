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
            console.warn(`No se pudo sincronizar el ítem ${item.id} en este ciclo (posible red lenta/inestable):`, err);
            // En lugar de hacer 'break' y congelar todo, permitimos continuar 
            // con otros elementos independientes de la cola o detener ordenadamente sin romper la app.
            continue; 
          }
        }
      }

      await this.pullRemoteChanges();
    } catch (e) {
      console.error('Error general en sincronización:', e);
    } finally {
      this.isSyncing = false;
      if (typeof app !== 'undefined') {
        app.loadDashboard();
        app.loadBrandSettings();
        app.loadTariffSettings();
        app.loadCatalogSettings();
        if (typeof auth !== 'undefined' && auth.isAdmin()) {
          app.loadUsersList();
        }
      }
    }
  }

  async pullRemoteChanges() {
    try {
      // 1. Paquetes
      const remoteData = await api.getRemotePackages();
      if (Array.isArray(remoteData)) {
        for (const remotePkg of remoteData) {
          const localPkg = await db.get('packages', remotePkg.packageId);
          if (!localPkg || (remotePkg.updatedAt && new Date(remotePkg.updatedAt) > new Date(localPkg.updatedAt || localPkg.createdAt))) {
            await db.put('packages', remotePkg);
          }
        }
      }

      // 2. Usuarios
      const remoteUsers = await api.getRemoteUsers();
      if (Array.isArray(remoteUsers)) {
        for (const remoteUser of remoteUsers) {
          await db.put('users', remoteUser);
        }
      }

      // 3. Ajustes Globales
      const remoteSettings = await api.getRemoteSettings();
      if (remoteSettings && typeof remoteSettings === 'object') {
        for (const [key, value] of Object.entries(remoteSettings)) {
          await db.put('settings', { key, value });
        }
      }
    } catch (e) {
      console.warn('Error bajando cambios remotos (red inestable):', e);
    }
  }
}

const syncEngine = new SyncEngine();
