/**
 * Motor de Sincronización Offline-First para ParcelTrack_DB
 */
class SyncEngine {
  constructor() {
    this.isSyncing = false;
  }

  async processQueue() {
    if (this.isSyncing || !navigator.onLine) return;
    this.isSyncing = true;

    try {
      // 1. Enviar cambios locales pendientes hacia la nube
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

      // 2. Descargar cambios remotos desde ParcelTrack_DB
      await this.pullRemoteChanges();
    } catch (e) {
      console.error('Error durante el proceso de sincronización:', e);
    } finally {
      this.isSyncing = false;
      if (typeof app !== 'undefined') {
        app.loadDashboard();
        if (typeof auth !== 'undefined' && auth.isAdmin()) {
          app.loadUsersList();
        }
      }
    }
  }

  async pullRemoteChanges() {
    try {
      // 1. Descargar paquetes y fusionar con IndexedDB
      const remoteData = await api.getRemotePackages();
      if (Array.isArray(remoteData)) {
        for (const remotePkg of remoteData) {
          const localPkg = await db.get('packages', remotePkg.packageId);
          if (!localPkg || (remotePkg.updatedAt && new Date(remotePkg.updatedAt) > new Date(localPkg.updatedAt || localPkg.createdAt))) {
            await db.put('packages', remotePkg);
          }
        }
      }

      // 2. Descargar usuarios y actualizar base de datos local
      const remoteUsers = await api.getRemoteUsers();
      if (Array.isArray(remoteUsers)) {
        for (const remoteUser of remoteUsers) {
          await db.put('users', remoteUser);
        }
      }
    } catch (e) {
      console.warn('No se pudieron descargar actualizaciones remotas:', e);
    }
  }
}

const syncEngine = new SyncEngine();
