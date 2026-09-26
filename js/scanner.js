class ScannerManager {
  constructor() {
    this.html5QrCode = null;
    this.targetInputId = null;
    this.currentMode = null;
    this.activePackage = null;
  }

  async open(title) {
    document.getElementById('scan-title').textContent = title;
    document.getElementById('modal-scanner').classList.remove('hidden');
    this.html5QrCode = new Html5Qrcode("reader");
    await this.html5QrCode.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (text) => this.onScanSuccess(text)
    );
  }

  async close() {
    if (this.html5QrCode) {
      await this.html5QrCode.stop();
      this.html5QrCode = null;
    }
    document.getElementById('modal-scanner').classList.add('hidden');
  }

  async scanToInput(inputId) {
    this.targetInputId = inputId;
    this.currentMode = 'INPUT';
    await this.open('Escanear Código QR');
  }

  async scanLocation() {
    this.currentMode = 'FIX_LOC';
    await this.open('Escanear Ubicación Fija');
  }

  async scanInventoryPackage() {
    this.currentMode = 'INV_PKG';
    await this.open('Escanear Paquete para Inventario');
  }

  async scanForDelivery() {
    this.currentMode = 'DELIVERY';
    await this.open('Escanear Paquete a Entregar');
  }

  async onScanSuccess(text) {
    await this.close();
    
    // Limpiar prefijo PT: si proviene de un código formateado
    const cleanText = text.replace(/^PT:/i, '');

    if (this.currentMode === 'INPUT') {
      const target = document.getElementById(this.targetInputId);
      if (target) {
        target.value = cleanText;
        target.dispatchEvent(new Event('input'));
      }
    } 
    else if (this.currentMode === 'FIX_LOC') {
      document.getElementById('inv-fixed-loc').textContent = cleanText;
      document.getElementById('btn-scan-pkg').disabled = false;
      document.getElementById('inv-scanned-list').innerHTML = '';
    } 
    else if (this.currentMode === 'INV_PKG') {
      const fixedLoc = document.getElementById('inv-fixed-loc').textContent;
      app.updatePackageLocation(cleanText, fixedLoc);
    }
    else if (this.currentMode === 'DELIVERY') {
      app.prepareDelivery(cleanText);
    }
  }
}

const scanner = new ScannerManager();
