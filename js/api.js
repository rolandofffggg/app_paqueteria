const API_URL = 'REEMPLAZAR_CON_TU_URL_DE_GOOGLE_APPS_SCRIPT';

const api = {
  // Sincronización Push (Local -> Nube)
  async sendBatch(operations) {
    if (!navigator.onLine || !API_URL || API_URL.includes('REEMPLAZAR')) return false;
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'syncBatch', operations })
      });
      const data = await res.json();
      return data.success;
    } catch (e) {
      console.error('Error Sync Push:', e);
      return false;
    }
  },

  // Sincronización Pull (Nube -> Local) [Fase 2]
  async fetchPackages() {
    if (!navigator.onLine || !API_URL || API_URL.includes('REEMPLAZAR')) return null;
    try {
      const res = await fetch(API_URL);
      const data = await res.json();
      return data.success ? data.packages : null;
    } catch (e) {
      console.error('Error Sync Pull:', e);
      return null;
    }
  }
};
