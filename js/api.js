const PARCELTRACK_API_URL = 'https://script.google.com/macros/s/AKfycbyOZpnkHZUu13TURsRMx4cuwkpN5JqPzHE2Fc6bBe_yyAAwIV9pGQqmwWoN8220aqMGgA/exec';

class ApiService {
  async sendSyncItem(syncItem) {
    if (!PARCELTRACK_API_URL || PARCELTRACK_API_URL.includes('TU_SCRIPT_ID_AQUI')) return;
    
    // Configurar un límite de tiempo (Timeout) de 10 segundos para redes móviles lentas
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(PARCELTRACK_API_URL, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(syncItem),
        signal: controller.signal // Asignar la señal de interrupción
      });
      clearTimeout(timeoutId);
      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.warn('La petición expiró por timeout debido a conexión móvil lenta.');
      } else {
        console.error('Error enviando item:', error);
      }
      throw error;
    }
  }

  // Métodos GET remotos con manejo similar opcional...
  async getRemotePackages() {
    if (!PARCELTRACK_API_URL || PARCELTRACK_API_URL.includes('TU_SCRIPT_ID_AQUI')) return [];
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      const response = await fetch(PARCELTRACK_API_URL, { 
        method: 'GET', 
        mode: 'cors',
        signal: controller.signal 
      });
      clearTimeout(timeoutId);
      return await response.json();
    } catch (error) {
      return [];
    }
  }

  async getRemoteUsers() {
    if (!PARCELTRACK_API_URL || PARCELTRACK_API_URL.includes('TU_SCRIPT_ID_AQUI')) return [];
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      const response = await fetch(`${PARCELTRACK_API_URL}?action=getUsers`, { 
        method: 'GET', 
        mode: 'cors',
        signal: controller.signal 
      });
      clearTimeout(timeoutId);
      return await response.json();
    } catch (error) {
      return [];
    }
  }

  async getRemoteSettings() {
    if (!PARCELTRACK_API_URL || PARCELTRACK_API_URL.includes('TU_SCRIPT_ID_AQUI')) return null;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      const response = await fetch(`${PARCELTRACK_API_URL}?action=getSettings`, { 
        method: 'GET', 
        mode: 'cors',
        signal: controller.signal 
      });
      clearTimeout(timeoutId);
      return await response.json();
    } catch (error) {
      return null;
    }
  }
}

const api = new ApiService();
