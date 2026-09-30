const PARCELTRACK_API_URL = 'https://script.google.com/macros/s/AKfycbyOZpnkHZUu13TURsRMx4cuwkpN5JqPzHE2Fc6bBe_yyAAwIV9pGQqmwWoN8220aqMGgA/exec';

class ApiService {
  async sendSyncItem(syncItem) {
    if (!PARCELTRACK_API_URL || PARCELTRACK_API_URL.includes('TU_SCRIPT_ID_AQUI')) return;
    try {
      const response = await fetch(PARCELTRACK_API_URL, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(syncItem)
      });
      return await response.json();
    } catch (error) {
      console.error('Error enviando item:', error);
      throw error;
    }
  }

  async getRemotePackages() {
    if (!PARCELTRACK_API_URL || PARCELTRACK_API_URL.includes('TU_SCRIPT_ID_AQUI')) return [];
    try {
      const response = await fetch(PARCELTRACK_API_URL, { method: 'GET', mode: 'cors' });
      return await response.json();
    } catch (error) {
      return [];
    }
  }

  async getRemoteUsers() {
    if (!PARCELTRACK_API_URL || PARCELTRACK_API_URL.includes('TU_SCRIPT_ID_AQUI')) return [];
    try {
      const response = await fetch(`${PARCELTRACK_API_URL}?action=getUsers`, { method: 'GET', mode: 'cors' });
      return await response.json();
    } catch (error) {
      return [];
    }
  }

  async getRemoteSettings() {
    if (!PARCELTRACK_API_URL || PARCELTRACK_API_URL.includes('TU_SCRIPT_ID_AQUI')) return null;
    try {
      const response = await fetch(`${PARCELTRACK_API_URL}?action=getSettings`, { method: 'GET', mode: 'cors' });
      return await response.json();
    } catch (error) {
      return null;
    }
  }
}

const api = new ApiService();
