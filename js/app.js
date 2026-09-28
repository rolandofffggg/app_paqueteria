class App {
  constructor() {
    this.selectedDeliveryPackage = null;
    this.lastCreatedPackage = null;
    this.currentCalculatedAmount = 0;
    this.selectedShelf = null;
    this.selectedRow = null;
    this.tariffs = { baseRate: 2.0, graceDays: 3, dailyPenalty: 1.0 };
  }

  async init() {
    await db.init();
    if (localStorage.getItem('pt_logged') === 'true') {
      document.getElementById('view-login').classList.add('hidden');
    }
    await this.loadTariffSettings();
    this.initNetwork();
    this.loadDashboard();
    this.renderShelfButtons();

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

  // --- MÓDULO DE AJUSTES Y TARIFAS ---
  async loadTariffSettings() {
    const saved = await db.get('settings', 'tariffs');
    if (saved && saved.value) {
      this.tariffs = saved.value;
    }
    document.getElementById('cfg-rate-base').value = this.tariffs.baseRate;
    document.getElementById('cfg-grace-days').value = this.tariffs.graceDays;
    document.getElementById('cfg-rate-penalty').value = this.tariffs.dailyPenalty;
  }

  async saveTariffSettings(e) {
    e.preventDefault();
    this.tariffs = {
      baseRate: parseFloat(document.getElementById('cfg-rate-base').value) || 0,
      graceDays: parseInt(document.getElementById('cfg-grace-days').value) || 0,
      dailyPenalty: parseFloat(document.getElementById('cfg-rate-penalty').value) || 0
    };
    await db.put('settings', { key: 'tariffs', value: this.tariffs });
    alert('¡Parámetros tarifarios guardados correctamente!');
  }

  initNetwork() {
    const updateNet = () => {
      const online = navigator.onLine;
      const el = document.getElementById('net-status');
      el.textContent = online ? 'ONLINE' : 'OFFLINE';
      el.className = online 
        ? 'px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
        : 'px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30';
      if (online) syncEngine.processQueue();
    };
    window.addEventListener('online', updateNet);
    window.addEventListener('offline', updateNet);
    updateNet();
  }

  showSec(secId) {
    ['sec-dashboard', 'sec-reception', 'sec-inventory', 'sec-delivery', 'sec-manage', 'sec-settings'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
    
    const targetSec = document.getElementById(secId);
    if (targetSec) targetSec.classList.remove('hidden');

    if (secId === 'sec-reception') {
      this.renderShelfButtons();
    } else if (secId === 'sec-manage') {
      this.loadManageList();
    }
  }

  // --- SELECTOR DE UBICACIÓN ---
  renderShelfButtons() {
    const shelfContainer = document.getElementById('shelf-buttons');
    if (!shelfContainer) return;

    shelfContainer.innerHTML = '';
    for (let i = 1; i <= 10; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      const shelfId = `E${i}`;
      btn.className = `shelf-btn p-1.5 text-xs font-bold rounded-lg border transition ${
        this.selectedShelf === shelfId 
          ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
      }`;
      btn.textContent = shelfId;
      btn.onclick = () => this.selectShelf(shelfId);
      shelfContainer.appendChild(btn);
    }
  }

  selectShelf(shelf) {
    this.selectedShelf = shelf;
    this.selectedRow = null;
    this.renderShelfButtons();
    this.renderRowButtons();
    
    const rowsContainer = document.getElementById('rows-container');
    if (rowsContainer) {
      rowsContainer.classList.remove('hidden');
    }
    this.updateLocationInput();
  }

  renderRowButtons() {
    const rowContainer = document.getElementById('row-buttons');
    if (!rowContainer) return;

    rowContainer.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      const rowId = `F${i}`;
      btn.className = `row-btn p-1.5 text-xs font-bold rounded-lg border transition ${
        this.selectedRow === rowId 
          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
      }`;
      btn.textContent = rowId;
      btn.onclick = () => this.selectRow(rowId);
      rowContainer.appendChild(btn);
    }
  }

  selectRow(row) {
    this.selectedRow = row;
    this.renderRowButtons();
    this.updateLocationInput();
  }

  updateLocationInput() {
    const input = document.getElementById('rec-ubicacion');
    if (!input) return;

    if (this.selectedShelf && this.selectedRow) {
      input.value = `${this.selectedShelf}-${this.selectedRow}`;
    } else if (this.selectedShelf) {
      input.value = `${this.selectedShelf}-?`;
    } else {
      input.value = '';
    }
  }

  // --- RECEPCIÓN Y ENVÍO DE WHATSAPP ---
  async savePackage(e) {
    e.preventDefault();
    const pkgCode = document.getElementById('rec-codigo').value.trim();
    const clientName = document.getElementById('rec-cliente').value.trim();
    const phoneClient = document.getElementById('rec-celular').value.trim();
    const phoneRecipient = document.getElementById('rec-celular-dest').value.trim();
    const locationVal = document.getElementById('rec-ubicacion').value;
    const keepClient = document.getElementById('chk-keep-client').checked;
    const sendWA = document.getElementById('chk-send-wa').checked;

    if (!locationVal || locationVal.includes('?')) {
      alert('Por favor complete la selección de Estante y Fila.');
      return;
    }

    const pkgId = 'PKG-' + Date.now();
    const creationTimestamp = new Date().toISOString();

    const categoryVal = document.getElementById('rec-categoria').value || 'OTROS';
    const sizeVal = document.getElementById('rec-tamano').value || 'PEQUEÑO';
    const colorVal = document.getElementById('rec-color').value || 'NEGRO';

    const pkg = {
      packageId: pkgId,
      code: pkgCode,
      qrCode: `PT:${pkgCode}`,
      client: clientName,
      phone: phoneClient,
      recipientPhone: phoneRecipient,
      category: categoryVal,
      size: sizeVal,
      color: colorVal,
      location: locationVal,
      status: 'PENDIENTE',
      createdAt: creationTimestamp,
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
    document.getElementById('res-client').textContent = `${pkg.client} (${new Date(creationTimestamp).toLocaleString()})`;
    document.getElementById('qr-result').classList.remove('hidden');

    // Confirmación por WhatsApp (Cliente y Remitente/Destinatario)
    if (sendWA) {
      const message = `Hola, confirmamos la recepción del paquete #${pkg.code} en Paquetería.
    
    👤 Cliente: ${clientName}
    📍 Ubicación: ${pkg.location}
    📦 Contenido: ${pkg.category}
    📏 Tamaño: ${pkg.size}
    🎨 Color: ${pkg.color}`;
    
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify({
          action: 'sendWhatsApp',
          phoneClient: phoneClient,
          phoneRecipient: phoneRecipient,
          message: message
        })
      });
    
      const result = await response.json();
    
      if (!result.success) {
        alert('No se pudieron enviar uno o ambos mensajes.');
      }
    }

    if (keepClient) {
      document.getElementById('rec-codigo').value = '';
      document.getElementById('rec-celular-dest').value = '';
      document.getElementById('rec-ubicacion').value = '';
      document.getElementById('rec-categoria').selectedIndex = 0;
      document.getElementById('rec-tamano').selectedIndex = 0;
      document.getElementById('rec-color').selectedIndex = 0;
    } else {
      document.getElementById('form-reception').reset();
    }

    this.selectedShelf = null;
    this.selectedRow = null;
    this.renderShelfButtons();
    const rowsContainer = document.getElementById('rows-container');
    if (rowsContainer) rowsContainer.classList.add('hidden');

    this.loadDashboard();
    syncEngine.processQueue();
  }

  // --- MÓDULO DE GESTIÓN (EDITAR / ELIMINAR) ---
  async loadManageList() {
    const listEl = document.getElementById('manage-list');
    if (!listEl) return;

    const query = (document.getElementById('manage-search')?.value || '').toLowerCase();
    const packages = await db.getAll('packages');

    const filtered = packages.filter(p => 
      (p.client || '').toLowerCase().includes(query) ||
      (p.code || '').toLowerCase().includes(query) ||
      (p.location || '').toLowerCase().includes(query)
    );

    if (filtered.length === 0) {
      listEl.innerHTML = '<p class="text-xs text-slate-400 text-center py-4">No se encontraron registros.</p>';
      return;
    }

    listEl.innerHTML = filtered.map(p => `
      <div class="bg-white p-2.5 rounded-xl border border-slate-200 flex justify-between items-center text-xs shadow-sm">
        <div>
          <span class="font-mono font-bold text-slate-800">#${p.code}</span> - <span class="font-semibold text-slate-700">${p.client}</span>
          <div class="text-[10px] text-slate-400 mt-0.5">Ub: <strong class="text-slate-600">${p.location}</strong> | Tel: ${p.phone || 'N/A'}</div>
        </div>
        <div class="flex gap-1">
          <button onclick="app.openEditModal('${p.packageId}')" class="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold border border-blue-200">✏️ Editar</button>
          <button onclick="app.deletePackage('${p.packageId}')" class="px-2 py-1 bg-red-50 text-red-600 rounded-lg text-[10px] font-bold border border-red-200">🗑️ Borrar</button>
        </div>
      </div>
    `).join('');
  }

  async openEditModal(packageId) {
    const pkg = await db.get('packages', packageId);
    if (!pkg) return;

    document.getElementById('edit-pkg-id').value = pkg.packageId;
    document.getElementById('edit-pkg-code-title').textContent = pkg.code;
    document.getElementById('edit-client').value = pkg.client || '';
    document.getElementById('edit-phone').value = pkg.phone || '';
    document.getElementById('edit-recipient-phone').value = pkg.recipientPhone || '';
    document.getElementById('edit-location').value = pkg.location || '';
    document.getElementById('edit-status').value = pkg.status || 'PENDIENTE';
    document.getElementById('edit-category').value = pkg.category || '';
    document.getElementById('edit-size').value = pkg.size || '';
    document.getElementById('edit-color').value = pkg.color || '';

    document.getElementById('modal-edit-pkg').classList.remove('hidden');
  }

  closeEditModal() {
    document.getElementById('modal-edit-pkg').classList.add('hidden');
  }

  async saveEditedPackage(e) {
    e.preventDefault();
    const pkgId = document.getElementById('edit-pkg-id').value;
    const pkg = await db.get('packages', pkgId);
    if (!pkg) return;

    pkg.client = document.getElementById('edit-client').value.trim();
    pkg.phone = document.getElementById('edit-phone').value.trim();
    pkg.recipientPhone = document.getElementById('edit-recipient-phone').value.trim();
    pkg.location = document.getElementById('edit-location').value.trim();
    pkg.status = document.getElementById('edit-status').value;
    pkg.category = document.getElementById('edit-category').value.trim();
    pkg.size = document.getElementById('edit-size').value.trim();
    pkg.color = document.getElementById('edit-color').value.trim();

    await db.put('packages', pkg);
    await db.put('syncQueue', { id: 'SYNC-' + Date.now(), type: 'UPDATE', payload: pkg });

    this.closeEditModal();
    this.loadManageList();
    this.loadDashboard();
    syncEngine.processQueue();
  }

  async deletePackage(packageId) {
    if (!confirm('¿Está seguro de eliminar este registro permanente de la base de datos?')) return;

    const pkg = await db.get('packages', packageId);
    if (!pkg) return;

    await db.delete('packages', packageId);
    await db.put('syncQueue', { id: 'SYNC-' + Date.now(), type: 'DELETE', payload: { packageId } });

    this.loadManageList();
    this.loadDashboard();
    syncEngine.processQueue();
  }

  // --- INVENTARIO ---
  setFixedLocationManual() {
    const val = document.getElementById('inv-loc-input').value.trim();
    if (!val) { alert('Ingrese una ubicación válida'); return; }
    document.getElementById('inv-fixed-loc').textContent = val;
    document.getElementById('btn-scan-pkg').disabled = false;
    document.getElementById('btn-add-inv-pkg').disabled = false;
    document.getElementById('inv-scanned-list').innerHTML = '';
  }

  async processInventoryManual() {
    const code = document.getElementById('inv-pkg-input').value.trim();
    const fixedLoc = document.getElementById('inv-fixed-loc').textContent;
    if (!code) { alert('Ingrese un código de paquete'); return; }
    await this.updatePackageLocation(code, fixedLoc);
    document.getElementById('inv-pkg-input').value = '';
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
    li.className = 'py-1.5 flex justify-between font-mono';
    li.innerHTML = `<span>Code: <strong>${pkg.code}</strong></span> <span class="text-emerald-600 font-bold">✔ OK</span>`;
    list.prepend(li);

    this.loadDashboard();
    syncEngine.processQueue();
  }

  async handleClientAutocomplete(value) {
    const listEl = document.getElementById('client-suggestions');
    if (!value || value.trim().length < 2) { listEl.classList.add('hidden'); return; }

    const packages = await db.getAll('packages');
    const clients = [...new Set(packages.map(p => p.client).filter(Boolean))];
    const matches = clients.filter(c => c.toLowerCase().includes(value.toLowerCase())).slice(0, 5);

    if (matches.length === 0) { listEl.classList.add('hidden'); return; }

    listEl.innerHTML = matches.map(c => `
      <div onclick="app.selectClientSuggestion('${c.replace(/'/g, "\\'")}')" class="p-2 hover:bg-slate-50 cursor-pointer text-slate-700 font-medium">
        👤 ${c}
      </div>
    `).join('');
    listEl.classList.remove('hidden');
  }

  selectClientSuggestion(clientName) {
    document.getElementById('rec-cliente').value = clientName;
    document.getElementById('client-suggestions').classList.add('hidden');
  }

  // --- ENTREGA ---
  async searchDeliveryManual() {
    const code = document.getElementById('del-search-code').value.trim();
    if (!code) { alert('Ingrese un código de paquete'); return; }
    await this.prepareDelivery(code);
  }

  async prepareDelivery(qrCode) {
    const packages = await db.getAll('packages');
    const pkg = packages.find(p => p.qrCode === qrCode || p.code === qrCode);

    if (!pkg || pkg.status === 'ENTREGADO') {
      alert('Paquete no disponible para entrega.');
      return;
    }

    this.selectedDeliveryPackage = pkg;
    
    const createdDate = new Date(pkg.createdAt || Date.now());
    const now = new Date();
    const diffTime = Math.abs(now - createdDate);
    const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    const { baseRate, graceDays, dailyPenalty } = this.tariffs;

    const montoBase = diffDays * baseRate;
    const diasRetraso = Math.max(0, diffDays - graceDays);
    const montoPenalizacion = diasRetraso * dailyPenalty;
    const totalCobro = montoBase + montoPenalizacion;

    this.currentCalculatedAmount = totalCobro;

    document.getElementById('del-pkg-code').textContent = pkg.code;
    document.getElementById('del-pkg-client').textContent = pkg.client;
    document.getElementById('del-pkg-loc').textContent = pkg.location;

    const formattedDate = new Date(pkg.createdAt).toLocaleString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    document.getElementById('del-pkg-date').textContent = formattedDate;

    document.getElementById('calc-days').textContent = diffDays;
    document.getElementById('calc-base').textContent = `Bs. ${montoBase.toFixed(2)}`;
    document.getElementById('calc-penalty').textContent = `Bs. ${montoPenalizacion.toFixed(2)}`;
    document.getElementById('calc-total').textContent = `Bs. ${totalCobro.toFixed(2)}`;

    document.getElementById('del-details').classList.remove('hidden');
  }

  async confirmDelivery() {
    if (!this.selectedDeliveryPackage) return;

    const nombre = document.getElementById('del-retira-nombre').value.trim();
    const doc = document.getElementById('del-retira-id').value.trim();

    const recipientInfo = (nombre || doc) ? `${nombre} ${doc ? '(' + doc + ')' : ''}`.trim() : 'Titular';

    this.selectedDeliveryPackage.status = 'ENTREGADO';
    this.selectedDeliveryPackage.deliveredTo = recipientInfo;
    this.selectedDeliveryPackage.deliveredAt = new Date().toISOString();
    this.selectedDeliveryPackage.amountCharged = this.currentCalculatedAmount;

    await db.put('packages', this.selectedDeliveryPackage);
    await db.put('syncQueue', { id: 'SYNC-' + Date.now(), type: 'DELIVERY', payload: this.selectedDeliveryPackage });

    alert(`¡Entrega confirmada! Cobro realizado: Bs. ${this.currentCalculatedAmount.toFixed(2)}`);
    document.getElementById('del-details').classList.add('hidden');
    document.getElementById('del-search-code').value = '';
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
      <div class="bg-white p-2.5 rounded-xl border border-slate-200 flex justify-between items-center text-xs shadow-sm">
        <div>
          <span class="font-mono font-bold text-slate-800">#${p.code}</span> - <span class="font-semibold text-slate-700">${p.client}</span>
          <div class="text-[10px] text-slate-400 mt-0.5">Ub: <strong class="text-slate-600">${p.location}</strong> | Cat: ${p.category || 'OTROS'}</div>
          ${p.deliveredTo ? `<div class="text-[10px] text-emerald-600">Retiró: ${p.deliveredTo} (Bs.${(p.amountCharged || 0).toFixed(2)})</div>` : ''}
        </div>
        <div class="flex flex-col items-end gap-1">
          <span class="px-2 py-0.5 ${p.status === 'ENTREGADO' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'} font-bold rounded text-[9px]">${p.status}</span>
          <button onclick='printer.printLabel(${JSON.stringify(p)})' class="text-[10px] text-blue-600 underline">🖨️ Ticket</button>
        </div>
      </div>
    `).join('');
  }

  printCurrentPackage() {
    if (this.lastCreatedPackage) {
      printer.printLabel(this.lastCreatedPackage);
    }
  }

  async downloadReport() {
    const packages = await db.getAll('packages');
    reports.exportToCSV(packages, `Reporte_Paqueteria_${new Date().toISOString().split('T')[0]}.csv`);
  }

  syncNow() {
    syncEngine.processQueue();
  }
}

const app = new App();
document.addEventListener('DOMContentLoaded', () => app.init());
