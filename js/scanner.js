class ScannerManager {
  constructor() {
    this.html5QrCode = null;
    this.targetInputId = null;
    this.currentMode = null;
    this.activePackage = null;
    this.lastScannedCode = null;
    this.lastScanTimestamp = 0;
  }

playSuccessBeep(code = '') {
    const now = Date.now();
    if (code && code === this.lastScannedCode && (now - this.lastScanTimestamp) < 2000) {
      return; // Evita reproducciones duplicadas para el mismo código en menos de 2 segundos
    }
    if (code) {
      this.lastScannedCode = code;
    }
    this.lastScanTimestamp = now;

    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      // 'square' produce un sonido fuerte y electrónico similar a un escáner comercial
      oscillator.type = 'square';
      
      // Frecuencia fija y aguda (aprox. 2000 Hz), típica de las pistolas de códigos de barras
      oscillator.frequency.setValueAtTime(2000, audioCtx.currentTime);

      // Ganancia (volumen) más alta para mayor potencia sonora (0.3)
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
      
      // Corte abrupto (fade-out muy rápido) para lograr el efecto "bip" seco e inmediato
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.08); // Duración corta de 80 milisegundos
    } catch (e) {
      console.error('Error al reproducir sonido de confirmación:', e);
    }
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
        this.playSuccessBeep(cleanText); // Recepción / Notificar (lectura exitosa)
      }
    } 
    else if (this.currentMode === 'FIX_LOC') {
      const locInput = document.getElementById('inv-fixed-loc');
      if (locInput) {
        locInput.value = cleanText;
        app.handleFixedLocationInput(cleanText);
        this.playSuccessBeep(cleanText); // Ubicación fija (lectura exitosa)
      }
      document.getElementById('inv-scanned-list').innerHTML = '';
    } 
    else if (this.currentMode === 'INV_PKG') {
      const fixedLocInput = document.getElementById('inv-fixed-loc');
      const fixedLoc = fixedLocInput ? fixedLocInput.value.trim() : '';
      
      if (!fixedLoc) {
        app.showToast('Ingrese o escanee una ubicación fija primero.');
        return;
      }
      app.updatePackageLocation(cleanText, fixedLoc, true);
    }
    else if (this.currentMode === 'DELIVERY') {
      app.prepareDelivery(cleanText);
    }
  }
}

const scanner = new ScannerManager();
