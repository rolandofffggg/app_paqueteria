// URL proporcionada al desplegar Google Apps Script como Web App
const API_URL = 'https://script.google.com/macros/s/AKfycbyznYkKUO--UCkdJGQpA-8cpr7UWzHFekNAG-DGrfu2HARel4PUd4lJxIC3cE5sOqs3jw/exec';

const api = {
  async sendBatch(operations) {
    if (!navigator.onLine || !API_URL || API_URL.includes('REEMPLAZAR')) {
      return false;
    }
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'syncBatch', operations })
      });
      const data = await res.json();
      return data.success;
    } catch (e) {
      console.error('Error Sync:', e);
      return false;
    }
  }
};
