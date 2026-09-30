/**
 * Conector API con Google Apps Script / ParcelTrack_DB
 */
const PARCELTRACK_API_URL = 'https://script.google.com/macros/s/TU_SCRIPT_ID_AQUI/exec';

class ApiService {
  /**
   * Envía un elemento de la cola de sincronización local hacia ParcelTrack_DB.
   */
  async sendSyncItem(syncItem) {
    if (!PARCELTRACK_API_URL || PARCELTRACK_API_URL.includes('TU_SCRIPT_ID_AQUI')) {
      console.warn('URL de ParcelTrack_DB no configurada.');
      return;
    }

    try {
      const response = await fetch(PARCELTRACK_API_URL, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(syncItem)
      });

      if (!response.ok) {
        throw new Error(`Error en servidor: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error al sincronizar elemento con ParcelTrack_DB:', error);
      throw error;
    }
  }

  /**
   * Obtiene todos los paquetes actualizados desde ParcelTrack_DB.
   */
  async getRemotePackages() {
    if (!PARCELTRACK_API_URL || PARCELTRACK_API_URL.includes('TU_SCRIPT_ID_AQUI')) {
      return [];
    }

    try {
      const response = await fetch(PARCELTRACK_API_URL, {
        method: 'GET',
        mode: 'cors'
      });

      if (!response.ok) {
        throw new Error(`Error al obtener datos: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error al descargar registros de ParcelTrack_DB:', error);
      return [];
    }
  }
}

const api = new ApiService();
