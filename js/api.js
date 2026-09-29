// Reemplaza esta URL con el enlace de tu Web App desplegada en Google Apps Script
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
      if (!res.ok) return false;
      const data = await res.json();
      return !!data.success;
    } catch (e) {
      console.error('Error Sync Push (sendBatch):', e);
      return false;
    }
  },

  // Sincronización Pull (Nube -> Local)
  async fetchPackages() {
    if (!navigator.onLine || !API_URL || API_URL.includes('REEMPLAZAR')) return null;
    try {
      const res = await fetch(API_URL, { method: 'GET' });
      if (!res.ok) return null;
      const data = await res.json();
      return data.success && Array.isArray(data.packages) ? data.packages : null;
    } catch (e) {
      console.error('Error Sync Pull (fetchPackages):', e);
      return null;
    }
  }
};
