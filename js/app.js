class App {
  constructor() {
    this.selectedDeliveryPackage = null;
    this.lastCreatedPackage = null;
    this.currentCalculatedAmount = 0;
  }

  async init() {
    await db.init();
    if (localStorage.getItem('pt_logged') === 'true') {
      document.getElementById('view-login').classList.add('hidden');
    }
    this.initNetwork();
    this.loadDashboard();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js');
    }
  }

  login() {
    const pin = document.getElementById('pin-input').value;
    if (pin === '1234') {
      localStorage.setItem('pt_logged', 'true');
      document.getElementById('view-login').classList.add('hidden');
    } else {
      document.getElementById('login-error').classList.remove('hidden');
    }
  }

  initNetwork() {
    const updateNet = () => {
      const online = navigator.onLine;
      const el = document.getElementById('net-status');
      el.textContent = online ? 'ONLINE' : 'OFFLINE';
      el.className = online 
        ? 'px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
        : 'px-2 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30';
      if (online) syncEngine.processQueue();
    };
    window.addEventListener('online', updateNet);
    window.addEventListener('offline', updateNet);
    updateNet();
  }

  showSec(secId) {
    ['sec-dashboard', 'sec-reception', 'sec-inventory', 'sec-delivery'].forEach(id => {
      document.getElementById(id).classList.add('hidden');
    });
    document.getElementById(secId).classList.remove('hidden');
  }

  async savePackage(e) {
    e.preventDefault();
    const packages = await db.getAll('packages');
    const nextNum = (packages.length + 1).toString().padStart(5, '0');
    const pkgId = 'PKG-' + Date.now();

    const pkg = {
      packageId: pkgId,
      code: nextNum,
      qrCode: `PT:${pkgId}`,
      client: document.getElementById('rec-cliente').value,
      category: document.getElementById('rec-categoria').value,
      location: document.getElementById('rec-ubicacion').value,
      status: 'PENDIENTE',
      createdAt: new Date().toISOString(),
      amountCharged: 0
    };

    this.lastCreatedPackage = pkg;

    await db.put('packages', pkg);
    await db.put('syncQueue', { id: 'SYNC-' + Date.now(), type: 'CREATE', payload: pkg });

    const qr = qrcode(4, 'L');
    qr.addData(pkg.qrCode);
    qr.make();
    
    document.getElementById('qrcode-target').innerHTML = qr.createImgTag(5);
    document.getElementById('res-code').textContent = pkg.code;
    document.getElementById('res-client').textContent = pkg.client;
    document.getElementById('qr-result').classList.remove('hidden');

    document.getElementById('form-reception').reset();
    this.loadDashboard();
    syncEngine.processQueue();
  }

  printCurrentPackage() {
    if (this.lastCreatedPackage) {
      printer.printLabel(this.lastCreatedPackage);
    }
  }

  async updatePackageLocation(qrCode, newLocation) {
    const packages = await db.getAll('packages');
    const pkg = packages.find(p => p.qrCode === qrCode || p.code === qrCode);

    if (!pkg) {
      alert('Paquete no encontrado');
      return;
    }

    pkg.location = newLocation;
    await db.put('packages', pkg);
    await db.put('syncQueue', { id: 'SYNC-' + Date.now(), type: 'UPDATE', payload: pkg });

    const list = document.getElementById('inv-scanned-list');
    const li = document.createElement('li');
    li.className = 'py-2 flex justify-between font-mono';
    li.innerHTML = `<span>Code: <strong>${pkg.code}</strong></span> <span class="text-emerald-600 font-bold">✔ OK</span>`;
    list.prepend(li);

    this.loadDashboard();
    syncEngine.processQueue();
  }

  // Prepara la entrega y realiza el cálculo monetario
  async prepareDelivery(qrCode) {
    const packages = await db.getAll('packages');
    const pkg = packages.find(p => p.qrCode === qrCode || p.code === qrCode);

    if (!pkg || pkg.status === 'ENTREGADO') {
      alert('Paquete no disponible para entrega.');
      return;
    }

    this.selectedDeliveryPackage = pkg;
    
    // Cálculo de Días y Tarifa
    const createdDate = new Date(pkg.createdAt || Date.now());
    const now = new Date();
    const diffTime = Math.abs(now - createdDate);
    const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    const tarifaBasePorDia = 2.0; // Bs. 2 por día
    const diasGracia = 3;
    const penalizacionDiaria = 1.0; // Bs. 1 por día extra

    const montoBase = diffDays * tarifaBasePorDia;
    const diasRetraso = Math.max(0, diffDays - diasGracia);
    const montoPenalizacion = diasRetraso * penalizacionDiaria;
    const totalCobro = montoBase + montoPenalizacion;

    this.currentCalculatedAmount = totalCobro;

    document.getElementById('del-pkg-code').textContent = pkg.code;
    document.getElementById('del-pkg-client').textContent = pkg.client;
    document.getElementById('del-pkg-loc').textContent = pkg.location;

    document.getElementById('calc-days').textContent = diffDays;
    document.getElementById('calc-base').textContent = `Bs. ${montoBase.toFixed(2)}`;
    document.getElementById('calc-penalty').textContent = `Bs. ${montoPenalizacion.toFixed(2)}`;
    document.getElementById('calc-total').textContent = `Bs. ${totalCobro.toFixed(2)}`;

    document.getElementById('del-details').classList.remove('hidden');
  }

  async confirmDelivery() {
    if (!this.selectedDeliveryPackage) return;

    const nombre = document.getElementById('del-retira-nombre').value;
    const doc = document.getElementById('del-retira-id').value;

    if (!nombre || !doc) {
      alert('Complete los datos de la persona que retira');
      return;
    }

    this.selectedDeliveryPackage.status = 'ENTREGADO';
    this.selectedDeliveryPackage.deliveredTo = `${nombre} (${doc})`;
    this.selectedDeliveryPackage.deliveredAt = new Date().toISOString();
    this.selectedDeliveryPackage.amountCharged = this.currentCalculatedAmount;

    await db.put('packages', this.selectedDeliveryPackage);
    await db.put('syncQueue', { id: 'SYNC-' + Date.now(), type: 'DELIVERY', payload: this.selectedDeliveryPackage });

    alert(`¡Entrega confirmada! Cobro realizado: Bs. ${this.currentCalculatedAmount.toFixed(2)}`);
    document.getElementById('del-details').classList.add('hidden');
    this.selectedDeliveryPackage = null;
    this.loadDashboard();
    syncEngine.processQueue();
  }

  async loadDashboard() {
    const packages = await db.getAll('packages');
    const todayStr = new Date().toISOString().split('T')[0];

    const recibidosHoy = packages.filter(p => p.createdAt && p.createdAt.startsWith(todayStr)).length;
    const entregadosHoyPackages = packages.filter(p => p.status === 'ENTREGADO' && p.deliveredAt && p.deliveredAt.startsWith(todayStr));
    const entregadosHoy = entregadosHoyPackages.length;
    const pendientes = packages.filter(p => p.status === 'PENDIENTE');

    const ingresosHoy = entregadosHoyPackages.reduce((sum, p) => sum + (p.amountCharged || 0), 0);

    document.getElementById('kpi-recibidos').textContent = recibidosHoy;
    document.getElementById('kpi-entregados').textContent = entregadosHoy;
    document.getElementById('kpi-pendientes').textContent = pendientes.length;
    document.getElementById('kpi-ingresos').textContent = `Bs. ${ingresosHoy.toFixed(2)}`;

    const query = (document.getElementById('search-input')?.value || '').toLowerCase();
    const statusFilter = document.getElementById('filter-status')?.value || 'PENDIENTE';

    let filtered = packages.filter(p => {
      const matchQuery = (p.client || '').toLowerCase().includes(query) || 
                         (p.code || '').toLowerCase().includes(query) || 
                         (p.location || '').toLowerCase().includes(query);
      const matchStatus = statusFilter === 'ALL' || p.status === statusFilter;
      return matchQuery && matchStatus;
    });

    const listEl = document.getElementById('list-pending');
    if (filtered.length === 0) {
      listEl.innerHTML = '<p class="text-xs text-slate-400 text-center py-4">No se encontraron paquetes con los filtros actuales.</p>';
      return;
    }

    listEl.innerHTML = filtered.map(p => `
      <div class="bg-white p-3 rounded-xl border border-slate-200 flex justify-between items-center text-xs shadow-sm">
        <div>
          <span class="font-mono font-bold text-slate-800">#${p.code}</span> - <span class="font-semibold text-slate-700">${p.client}</span>
          <div class="text-[10px] text-slate-400 mt-0.5">Ub: <strong class="text-slate-600">${p.location}</strong> | Cat: ${p.category}</div>
          ${p.deliveredTo ? `<div class="text-[10px] text-emerald-600">Retiró: ${p.deliveredTo} (Bs.${(p.amountCharged || 0).toFixed(2)})</div>` : ''}
        </div>
        <div class="flex flex-col items-end gap-1">
          <span class="px-2 py-0.5 ${p.status === 'ENTREGADO' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'} font-bold rounded text-[10px]">${p.status}</span>
          <button onclick='printer.printLabel(${JSON.stringify(p)})' class="text-[10px] text-blue-600 underline">🖨️ Ticket</button>
        </div>
      </div>
    `).join('');
  }

  async downloadReport() {
    const packages = await db.getAll('packages');
    reports.exportToCSV(packages, `Reporte_ParcelTrack_${new Date().toISOString().split('T')[0]}.csv`);
  }

  syncNow() {
    syncEngine.processQueue();
  }
}

const app = new App();
document.addEventListener('DOMContentLoaded', () => app.init());
