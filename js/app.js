class App {
  constructor() {
    this.selectedDeliveryPackage = null;
    this.lastCreatedPackage = null;
    this.currentCalculatedAmount = 0;
    this.selectedShelf = null;
    this.selectedRow = null;
    this.tariffs = { baseRate: 2.0, graceDays: 3, dailyPenalty: 1.0 };
    this.companyName = '';
    this.catalog = {
      categories: ['ROPA', 'JOYAS', 'REPUESTOS', 'DOCUMENTOS', 'ELECTRÓNICA', 'OTROS'],
      sizes: ['PEQUEÑO', 'MEDIANO', 'GRANDE'],
      colors: ['AMARILLO', 'ROJO', 'AZUL', 'NEGRO', 'BLANCO', 'VERDE', 'OTRO']
    };
  }

  async init() {
    await db.init();
    const isAuthenticated = await auth.init();
    
    if (isAuthenticated) {
      document.getElementById('view-login').classList.add('hidden');
    } else {
      document.getElementById('view-login').classList.remove('hidden');
    }

    await this.loadBrandSettings();
    await this.loadTariffSettings();
    await this.loadCatalogSettings();
    
    this.initNetwork();
    this.loadDashboard();
    this.renderShelfButtons();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js');
    }
  }

  async login() {
    const username = document.getElementById('login-username').value;
    const pin = document.getElementById('pin-input').value;
    const remember = document.getElementById('login-remember').checked;
    const errEl = document.getElementById('login-error');

    const result = await auth.login(username, pin, remember);
    if (result.success) {
      errEl.classList.add('hidden');
      document.getElementById('view-login').classList.add('hidden');
      this.loadDashboard();
    } else {
      errEl.textContent = result.message;
      errEl.classList.remove('hidden');
    }
  }

  showToast(message, type = 'error') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const bgClass = type === 'error' ? 'bg-red-600' : type === 'warning' ? 'bg-amber-600' : 'bg-emerald-600';
    toast.className = `${bgClass} text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg transition-all transform duration-300 opacity-0 translate-y-2 mb-2 text-center pointer-events-auto flex justify-between items-center`;
    toast.innerHTML = `<span>${message}</span><button onclick="this.parentElement.remove()" class="ml-2 font-black">&times;</button>`;
    
    container.appendChild(toast);
    setTimeout(() => toast.classList.remove('opacity-0', 'translate-y-2'), 10);

    setTimeout(() => {
      toast.classList.add('opacity-0', '-translate-y-2');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  showSec(secId) {
    if (!auth.hasAccess(secId)) {
      this.showToast('Acceso denegado: No tiene permisos para este módulo.', 'warning');
      secId = 'sec-dashboard';
    }

    const sections = ['sec-dashboard', 'sec-reception', 'sec-print-notify', 'sec-inventory', 'sec-delivery', 'sec-manage', 'sec-settings', 'sec-users'];
    sections.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });

    const targetSec = document.getElementById(secId);
    if (targetSec) targetSec.classList.remove('hidden');

    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
      if (btn.getAttribute('onclick')?.includes(`'${secId}'`)) {
        btn.classList.add('active', 'text-blue-600', 'scale-105');
        btn.classList.remove('text-slate-500');
      } else {
        btn.classList.remove('active', 'text-blue-600', 'scale-105');
        btn.classList.add('text-slate-500');
      }
    });

    if (secId === 'sec-reception') {
      this.renderShelfButtons();
    } else if (secId === 'sec-manage') {
      this.loadManageList();
    } else if (secId === 'sec-print-notify') {
      this.loadPrintNotifyView();
    } else if (secId === 'sec-users') {
      this.loadUsersList();
    }
  }

  // --- RECEPCIÓN CON AUDITORÍA DE USUARIO ---
  async savePackage(e) {
    e.preventDefault();
    const pkgCode = document.getElementById('rec-codigo').value.trim().toUpperCase();
    
    const codeFormatRegex = /^[A-Za-z].{3}[0-9]$/;
    if (pkgCode.length !== 5 || !codeFormatRegex.test(pkgCode)) {
      this.showToast('El código debe tener 5 caracteres (Ej: P0001).');
      return;
    }

    const packages = await db.getAll('packages');
    if (packages.some(p => (p.code || '').toUpperCase() === pkgCode)) {
      this.showToast(`El código "${pkgCode}" ya existe. Ingrese uno diferente.`);
      return;
    }

    const clientName = document.getElementById('rec-cliente').value.toUpperCase().trim();
    const rawPhone = document.getElementById('rec-celular').value;
    const rawRecipientPhone = document.getElementById('rec-celular-dest').value;
    const phoneClient = rawPhone ? rawPhone.replace(/\D/g, '') : '';
    const phoneRecipient = rawRecipientPhone ? rawRecipientPhone.replace(/\D/g, '') : '';

    const locationVal = document.getElementById('rec-ubicacion').value;
    const keepClient = document.getElementById('chk-keep-client').checked;

    if (!locationVal || locationVal.includes('?')) {
      this.showToast('Complete la selección de Estante y Fila.');
      return;
    }

    const activeUser = auth.getUser();
    const pkgId = 'PKG-' + Date.now();
    const pkg = {
      packageId: pkgId,
      code: pkgCode,
      qrCode: `PT:${pkgCode}`,
      client: clientName,
      phone: phoneClient,
      recipientPhone: phoneRecipient,
      category: document.getElementById('rec-categoria').value || 'OTROS',
      size: document.getElementById('rec-tamano').value || 'PEQUEÑO',
      color: document.getElementById('rec-color').value || 'NEGRO',
      location: locationVal,
      status: 'PENDIENTE',
      createdAt: new Date().toISOString(),
      createdBy: activeUser ? activeUser.username : 'sistema',
      updatedBy: activeUser ? activeUser.username : 'sistema',
      amountCharged: 0
    };

    this.lastCreatedPackage = pkg;

    await db.put('packages', pkg);
    await db.put('syncQueue', { id: 'SYNC-' + Date.now(), type: 'CREATE', payload: pkg });

    this.showToast(`✅ Paquete ${pkg.code} registrado con éxito.`, 'success');

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

  // --- ACTUALIZACIÓN DE UBICACIÓN Y REUBICACIÓN ---
  async updatePackageLocation(qrCode, newLocation) {
    const packages = await db.getAll('packages');
    const pkg = packages.find(p => p.qrCode === qrCode || p.code === qrCode);

    if (!pkg) {
      this.showToast('Paquete no encontrado.');
      return;
    }

    if (pkg.status !== 'PENDIENTE') {
      this.showToast(`Error: El paquete ${pkg.code} está en estado "${pkg.status}". Reubicación no permitida.`);
      return;
    }

    const activeUser = auth.getUser();
    pkg.location = newLocation;
    pkg.updatedAt = new Date().toISOString();
    pkg.updatedBy = activeUser ? activeUser.username : 'sistema';

    await db.put('packages', pkg);
    await db.put('syncQueue', { id: 'SYNC-' + Date.now(), type: 'UPDATE', payload: pkg });

    const list = document.getElementById('inv-scanned-list');
    const li = document.createElement('li');
    li.className = 'py-1.5 flex justify-between font-mono';
    li.innerHTML = `<span>Code: <strong>${pkg.code}</strong> -> ${newLocation}</span> <span class="text-emerald-600 font-bold">✔ OK</span>`;
    list.prepend(li);

    this.showToast(`Ubicación de ${pkg.code} actualizada a ${newLocation}`, 'success');
    this.loadDashboard();
    syncEngine.processQueue();
  }

  // --- ENTREGA Y COBRO CON AUDITORÍA DE USUARIO ---
  async confirmDelivery() {
    if (!this.selectedDeliveryPackage) return;

    const nombre = document.getElementById('del-retira-nombre').value.trim();
    const doc = document.getElementById('del-retira-id').value.trim();
    const activeUser = auth.getUser();

    const recipientInfo = (nombre || doc) ? `${nombre} ${doc ? '(' + doc + ')' : ''}`.trim() : 'Titular';

    this.selectedDeliveryPackage.status = 'ENTREGADO';
    this.selectedDeliveryPackage.deliveredTo = recipientInfo;
    this.selectedDeliveryPackage.deliveredAt = new Date().toISOString();
    this.selectedDeliveryPackage.deliveredBy = activeUser ? activeUser.username : 'sistema';
    this.selectedDeliveryPackage.amountCharged = this.currentCalculatedAmount;
    this.selectedDeliveryPackage.updatedAt = new Date().toISOString();
    this.selectedDeliveryPackage.updatedBy = activeUser ? activeUser.username : 'sistema';

    await db.put('packages', this.selectedDeliveryPackage);
    await db.put('syncQueue', { id: 'SYNC-' + Date.now(), type: 'DELIVERY', payload: this.selectedDeliveryPackage });

    this.showToast(`¡Entrega confirmada! Cobro realizado: Bs. ${this.currentCalculatedAmount.toFixed(2)}`, 'success');
    document.getElementById('del-details').classList.add('hidden');
    document.getElementById('del-search-code').value = '';
    this.selectedDeliveryPackage = null;
    this.loadDashboard();
    syncEngine.processQueue();
  }

  // --- NOTIFICACIÓN WHATSAPP (+591) ---
  sendWhatsAppNotification(pkg, type) {
    const rawPhone = type === 'client' ? pkg.phone : pkg.recipientPhone;
    if (!rawPhone) {
      this.showToast('El paquete no tiene registrado un número telefónico.');
      return;
    }

    let cleanPhone = rawPhone.replace(/\D/g, '');
    if (cleanPhone.length === 8) {
      cleanPhone = '591' + cleanPhone;
    } else if (!cleanPhone.startsWith('591') || cleanPhone.length !== 11) {
      this.showToast('Número inválido. Debe ser un número de Bolivia (8 dígitos).');
      return;
    }

    const company = this.companyName ? `#${this.companyName}` : '#PAQUETERÍA';
    const message = 
`--------------------------------------------------
📦 Paquetería: ${company}
--------------------------------------------------
*Código:* ${pkg.code}
*Remitente:* ${pkg.client} (${pkg.phone || 'N/A'})
*Destinatario:* ${pkg.recipientPhone ? '(' + pkg.recipientPhone + ')' : 'N/A'}
*Contenido:* ${pkg.category} | *Tamaño:* ${pkg.size} | *Color:* ${pkg.color}
--------------------------------------------------
💵 *Tarifa Base:* Bs. ${this.tariffs.baseRate.toFixed(2)} / día
📋 *Política:* Días de gracia: ${this.tariffs.graceDays} días. Penalización tras vencimiento: Bs. ${this.tariffs.dailyPenalty.toFixed(2)} / día.`;

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  }

  // --- GESTIÓN DE USUARIOS ---
  async loadUsersList() {
    if (!auth.isAdmin()) return;
    const container = document.getElementById('users-list');
    if (!container) return;

    const users = await db.getAll('users');
    const currentUser = auth.getUser();

    if (users.length === 0) {
      container.innerHTML = '<p class="text-xs text-slate-400 text-center py-2">No hay usuarios registrados.</p>';
      return;
    }

    container.innerHTML = users.map(u => {
      const isSelf = currentUser && currentUser.username === u.username;
      const statusBadge = u.status === 'ACTIVE' 
        ? '<span class="px-2 py-0.5 bg-emerald-50 text-emerald-600 font-bold rounded text-[9px] border border-emerald-200">Activo</span>'
        : '<span class="px-2 py-0.5 bg-red-50 text-red-600 font-bold rounded text-[9px] border border-red-200">Bloqueado</span>';

      return `
        <div class="pt-2 flex justify-between items-center text-xs">
          <div>
            <span class="font-bold text-slate-800">${u.fullName}</span> 
            <span class="text-[10px] text-slate-400">(@${u.username})</span>
            <div class="text-[10px] text-slate-500">Rol: <strong>${u.role}</strong> | ${statusBadge}</div>
          </div>
          <div class="flex gap-1">
            <button onclick="app.editUser('${u.username}')" class="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold border border-blue-200">✏️ Editar</button>
            <button onclick="app.toggleUserStatus('${u.username}')" ${isSelf ? 'disabled' : ''} 
              class="px-2 py-1 ${u.status === 'ACTIVE' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'} disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-[10px] font-bold border">
              ${u.status === 'ACTIVE' ? '🚫 Bloquear' : '✅ Activar'}
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  async saveUser(e) {
    e.preventDefault();
    if (!auth.isAdmin()) return;

    const fullName = document.getElementById('usr-fullname').value.trim();
    const username = document.getElementById('usr-username').value.toLowerCase().trim();
    const pin = document.getElementById('usr-pin').value.trim();
    const role = document.getElementById('usr-role').value;
    const isEdit = document.getElementById('usr-is-edit').value === 'true';

    if (!fullName || !username || !pin) {
      this.showToast('Complete todos los campos del usuario.');
      return;
    }

    const existingUser = await db.get('users', username);
    if (!isEdit && existingUser) {
      this.showToast(`El usuario "${username}" ya existe.`);
      return;
    }

    const userObj = {
      username,
      fullName,
      pin,
      role,
      status: existingUser ? existingUser.status : 'ACTIVE',
      createdAt: existingUser ? existingUser.createdAt : new Date().toISOString()
    };

    await db.put('users', userObj);
    this.showToast(`Usuario "${username}" guardado correctamente.`, 'success');
    this.resetUserForm();
    this.loadUsersList();
  }

  async editUser(username) {
    const u = await db.get('users', username);
    if (!u) return;

    document.getElementById('usr-fullname').value = u.fullName;
    document.getElementById('usr-username').value = u.username;
    document.getElementById('usr-username').readOnly = true;
    document.getElementById('usr-pin').value = u.pin;
    document.getElementById('usr-role').value = u.role;
    document.getElementById('usr-is-edit').value = 'true';
    document.getElementById('usr-form-title').textContent = `Editar Usuario: ${u.username}`;
  }

  async toggleUserStatus(username) {
    const currentUser = auth.getUser();
    if (currentUser && currentUser.username === username) {
      this.showToast('Restricción: No puede bloquear su propio usuario activo.');
      return;
    }

    const u = await db.get('users', username);
    if (!u) return;

    u.status = u.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';
    await db.put('users', u);
    this.showToast(`Estado de "${u.username}" cambiado a ${u.status}`, 'success');
    this.loadUsersList();
  }

  resetUserForm() {
    document.getElementById('form-user-manage').reset();
    document.getElementById('usr-username').readOnly = false;
    document.getElementById('usr-is-edit').value = 'false';
    document.getElementById('usr-form-title').textContent = 'Crear Nuevo Usuario';
  }

  // --- DASHBOARD CON MOSTRADO DE AUDITORÍA ---
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
    
    const kpiAcumulados = document.getElementById('kpi-acumulados');
    if (kpiAcumulados) kpiAcumulados.textContent = packages.length;

    const query = (document.getElementById('search-input')?.value || '').toLowerCase();
    const statusFilter = document.getElementById('filter-status')?.value || 'PENDIENTE';

    packages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    let filtered = packages.filter(p => {
      const matchQuery = (p.client || '').toLowerCase().includes(query) || 
                         (p.code || '').toLowerCase().includes(query) || 
                         (p.location || '').toLowerCase().includes(query) ||
                         (p.createdBy || '').toLowerCase().includes(query);
      const matchStatus = statusFilter === 'ALL' || p.status === statusFilter;
      return matchQuery && matchStatus;
    });

    const listEl = document.getElementById('list-pending');
    if (filtered.length === 0) {
      listEl.innerHTML = '<p class="text-xs text-slate-400 text-center py-4">No se encontraron paquetes.</p>';
      return;
    }

    listEl.innerHTML = filtered.map(p => `
      <div class="bg-white p-2.5 rounded-xl border border-slate-200 flex justify-between items-center text-xs shadow-sm">
        <div>
          <span class="font-mono font-bold text-slate-800">${p.code}</span> - <span class="font-bold text-slate-700">${p.client}</span>
          <div class="text-[10px] text-slate-400 mt-0.5">Ub: <strong class="text-slate-600">${p.location}</strong> | Reg: <span class="text-slate-600 font-semibold">@${p.createdBy || 'sis'}</span></div>
          ${p.deliveredTo ? `<div class="text-[10px] text-emerald-600">Retiró: ${p.deliveredTo} (${p.deliveredBy ? '@' + p.deliveredBy : ''}) - Bs.${(p.amountCharged || 0).toFixed(2)}</div>` : ''}
        </div>
        <div class="flex flex-col items-end gap-1">
          <span class="px-2 py-0.5 ${p.status === 'ENTREGADO' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'} font-bold rounded text-[9px]">${p.status}</span>
        </div>
      </div>
    `).join('');
  }

  // --- CONFIGURACIONES Y PARÁMETROS ---
  async loadBrandSettings() {
    const saved = await db.get('settings', 'brand');
    this.companyName = saved && saved.value ? saved.value : '';
    const headerTitle = document.getElementById('header-app-title');
    if (headerTitle) {
      headerTitle.textContent = this.companyName ? `📦 ${this.companyName}` : '📦 Paquetería';
    }
    const inputComp = document.getElementById('cfg-company-name');
    if (inputComp) inputComp.value = this.companyName;
  }

  async saveBrandSettings(e) {
    e.preventDefault();
    const val = document.getElementById('cfg-company-name').value.trim();
    this.companyName = val;
    await db.put('settings', { key: 'brand', value: val });
    this.loadBrandSettings();
    this.showToast('¡Nombre de paquetería guardado!', 'success');
  }

  async loadCatalogSettings() {
    const saved = await db.get('settings', 'catalog');
    if (saved && saved.value) this.catalog = saved.value;
    this.populateReceptionSelects();
  }

  populateReceptionSelects() {
    const catSel = document.getElementById('rec-categoria');
    const sizeSel = document.getElementById('rec-tamano');
    const colSel = document.getElementById('rec-color');

    if (catSel) {
      catSel.innerHTML = '<option value="" disabled selected>Contenido</option>' +
        this.catalog.categories.map(c => `<option value="${c}">${c}</option>`).join('');
    }
    if (sizeSel) {
      sizeSel.innerHTML = '<option value="" disabled selected>Tamaño</option>' +
        this.catalog.sizes.map(s => `<option value="${s}">${s}</option>`).join('');
    }
    if (colSel) {
      colSel.innerHTML = '<option value="" disabled selected>Color</option>' +
        this.catalog.colors.map(c => `<option value="${c}">${c}</option>`).join('');
    }
  }

  async exportBackup() {
    const packages = await db.getAll('packages');
    const settings = await db.getAll('settings');
    const syncQueue = await db.getAll('syncQueue');
    const users = await db.getAll('users');

    const backupData = { version: 3, timestamp: new Date().toISOString(), packages, settings, syncQueue, users };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `Backup_Paqueteria_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
  }

  async importBackup(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.packages) { for (const pkg of data.packages) await db.put('packages', pkg); }
        if (data.settings) { for (const st of data.settings) await db.put('settings', st); }
        if (data.users) { for (const us of data.users) await db.put('users', us); }
        this.showToast('¡Restauración completada con éxito!', 'success');
        setTimeout(() => location.reload(), 1000);
      } catch (err) {
        this.showToast('Error al leer el archivo JSON de respaldo.');
      }
    };
    reader.readAsText(file);
  }

  async loadTariffSettings() {
    const saved = await db.get('settings', 'tariffs');
    if (saved && saved.value) this.tariffs = saved.value;
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
    this.showToast('¡Tarifas guardadas correctamente!', 'success');
  }

  initNetwork() {
    const updateNet = () => {
      const online = navigator.onLine;
      const el = document.getElementById('net-status');
      if (el) {
        el.textContent = online ? 'ONLINE' : 'OFFLINE';
        el.className = online 
          ? 'px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
          : 'px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30';
      }
      if (online) syncEngine.processQueue();
    };
    window.addEventListener('online', updateNet);
    window.addEventListener('offline', updateNet);
    updateNet();
  }

  renderShelfButtons() {
    const shelfContainer = document.getElementById('shelf-buttons');
    if (!shelfContainer) return;
    shelfContainer.innerHTML = '';
    for (let i = 1; i <= 10; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      const shelfId = `E${i}`;
      btn.className = `shelf-btn p-1.5 text-xs font-bold rounded-lg border transition ${
        this.selectedShelf === shelfId ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
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
    if (rowsContainer) rowsContainer.classList.remove('hidden');
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
        this.selectedRow === rowId ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
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

  async handleClientAutocomplete(value) {
    const listEl = document.getElementById('client-suggestions');
    if (!value || value.trim().length < 2) { 
      if (listEl) listEl.classList.add('hidden'); 
      return; 
    }

    const packages = await db.getAll('packages');
    const clientMap = new Map();
    packages.forEach(p => {
      if (p.client) clientMap.set(p.client.toLowerCase(), { name: p.client, phone: p.phone || '' });
    });

    const matches = Array.from(clientMap.values()).filter(c => c.name.toLowerCase().includes(value.toLowerCase())).slice(0, 5);

    if (matches.length === 0) { 
      if (listEl) listEl.classList.add('hidden'); 
      return; 
    }

    if (listEl) {
      listEl.innerHTML = matches.map(c => `
        <div onclick="app.selectClientSuggestion('${c.name.replace(/'/g, "\\'")}', '${c.phone}')" class="p-2 hover:bg-slate-50 cursor-pointer text-slate-700 font-bold">
          👤 ${c.name} ${c.phone ? '<span class="text-slate-400 font-normal">(' + c.phone + ')</span>' : ''}
        </div>
      `).join('');
      listEl.classList.remove('hidden');
    }
  }

  selectClientSuggestion(clientName, phone) {
    document.getElementById('rec-cliente').value = clientName;
    if (phone) document.getElementById('rec-celular').value = phone;
    const listEl = document.getElementById('client-suggestions');
    if (listEl) listEl.classList.add('hidden');
  }

  async loadPrintNotifyView() {
    const printCard = document.getElementById('print-card-target');
    if (!printCard) return;

    const packages = await db.getAll('packages');
    if (packages.length === 0) {
      printCard.innerHTML = '<p class="text-xs text-slate-400 py-4">No hay paquetes registrados.</p>';
      return;
    }

    packages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    this.renderPrintCard(packages[0]);
  }

  async searchPrintPackage(query) {
    const q = (query || '').toLowerCase().trim();
    const printCard = document.getElementById('print-card-target');
    if (!printCard) return;

    const packages = await db.getAll('packages');
    if (!q) {
      this.loadPrintNotifyView();
      return;
    }

    const filtered = packages.filter(p => 
      (p.code || '').toLowerCase().includes(q) || 
      (p.client || '').toLowerCase().includes(q)
    );

    if (filtered.length === 0) {
      printCard.innerHTML = '<p class="text-xs text-slate-400 py-4">No se encontró ningún paquete.</p>';
      return;
    }

    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    this.renderPrintCard(filtered[0]);
  }

  renderPrintCard(pkg) {
    const printCard = document.getElementById('print-card-target');
    if (!printCard || !pkg) return;

    const qr = qrcode(4, 'L');
    qr.addData(pkg.qrCode);
    qr.make();
    const qrImg = qr.createImgTag(5);

    const hasClientPhone = !!pkg.phone;
    const hasRecipientPhone = !!pkg.recipientPhone;

    printCard.innerHTML = `
      <div class="text-xl font-black text-slate-800 font-mono">${pkg.code}</div>
      <div class="flex justify-center py-1">${qrImg}</div>
      <div class="bg-slate-50 p-2.5 rounded-lg border text-left text-xs space-y-1 my-2">
        <p><strong>Cliente:</strong> ${pkg.client} ${pkg.phone ? '(' + pkg.phone + ')' : ''}</p>
        <p><strong>Destinatario:</strong> ${pkg.recipientPhone ? pkg.recipientPhone : 'N/A'}</p>
        <p><strong>Contenido:</strong> ${pkg.category} | <strong>Tamaño:</strong> ${pkg.size} | <strong>Color:</strong> ${pkg.color}</p>
        <p><strong>Ubicación:</strong> <span class="font-mono font-bold text-blue-600">${pkg.location}</span></p>
        <p><strong>Registrado por:</strong> <span class="font-semibold text-slate-700">@${pkg.createdBy || 'sis'}</span></p>
      </div>
      <div class="space-y-1.5 pt-1">
        <button onclick='app.sendWhatsAppNotification(${JSON.stringify(pkg)}, "client")' ${!hasClientPhone ? 'disabled' : ''} 
          class="w-full bg-green-500 disabled:bg-slate-300 text-white font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-1 shadow-sm">
          🟢 Enviar WhatsApp Cliente
        </button>
        <button onclick='app.sendWhatsAppNotification(${JSON.stringify(pkg)}, "recipient")' ${!hasRecipientPhone ? 'disabled' : ''} 
          class="w-full bg-green-600 disabled:bg-slate-300 text-white font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-1 shadow-sm">
          🟢 Enviar WhatsApp Destinatario
        </button>
      </div>
    `;
  }

  async loadManageList() {
    const listEl = document.getElementById('manage-list');
    if (!listEl) return;

    const query = (document.getElementById('manage-search')?.value || '').toLowerCase();
    const packages = await db.getAll('packages');
    packages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

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
          <span class="font-mono font-bold text-slate-800">${p.code}</span> - <span class="font-semibold text-slate-700">${p.client}</span>
          <div class="text-[10px] text-slate-400 mt-0.5">Ub: <strong class="text-slate-600">${p.location}</strong> | Por: <strong class="text-slate-600">@${p.createdBy || 'sis'}</strong></div>
        </div>
        <div class="flex gap-1">
          <button onclick="app.openEditModal('${p.packageId}')" class="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold border border-blue-200">✏️️ Editar</button>
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

    const activeUser = auth.getUser();
    pkg.client = document.getElementById('edit-client').value.toUpperCase().trim();
    pkg.phone = document.getElementById('edit-phone').value.replace(/\D/g, '');
    pkg.recipientPhone = document.getElementById('edit-recipient-phone').value.replace(/\D/g, '');
    pkg.location = document.getElementById('edit-location').value.trim();
    pkg.status = document.getElementById('edit-status').value;
    pkg.category = document.getElementById('edit-category').value.trim();
    pkg.size = document.getElementById('edit-size').value.trim();
    pkg.color = document.getElementById('edit-color').value.trim();
    pkg.updatedAt = new Date().toISOString();
    pkg.updatedBy = activeUser ? activeUser.username : 'sistema';

    await db.put('packages', pkg);
    await db.put('syncQueue', { id: 'SYNC-' + Date.now(), type: 'UPDATE', payload: pkg });

    this.closeEditModal();
    this.loadManageList();
    this.loadDashboard();
    syncEngine.processQueue();
  }

  async deletePackage(packageId) {
    if (!confirm('¿Está seguro de eliminar este registro permanente?')) return;
    const pkg = await db.get('packages', packageId);
    if (!pkg) return;

    await db.delete('packages', packageId);
    await db.put('syncQueue', { id: 'SYNC-' + Date.now(), type: 'DELETE', payload: { packageId } });

    this.loadManageList();
    this.loadDashboard();
    syncEngine.processQueue();
  }

  setFixedLocationManual() {
    const val = document.getElementById('inv-loc-input').value.trim();
    if (!val) { this.showToast('Ingrese una ubicación válida'); return; }
    document.getElementById('inv-fixed-loc').textContent = val;
    document.getElementById('btn-scan-pkg').disabled = false;
    document.getElementById('btn-add-inv-pkg').disabled = false;
    document.getElementById('inv-scanned-list').innerHTML = '';
  }

  async processInventoryManual() {
    const code = document.getElementById('inv-pkg-input').value.trim();
    const fixedLoc = document.getElementById('inv-fixed-loc').textContent;
    if (!code) { this.showToast('Ingrese un código de paquete'); return; }
    await this.updatePackageLocation(code, fixedLoc);
    document.getElementById('inv-pkg-input').value = '';
  }

  async searchDeliveryManual() {
    const code = document.getElementById('del-search-code').value.trim();
    if (!code) { this.showToast('Ingrese un código de paquete'); return; }
    await this.prepareDelivery(code);
  }

  async prepareDelivery(qrCode) {
    const packages = await db.getAll('packages');
    const pkg = packages.find(p => p.qrCode === qrCode || p.code === qrCode);

    if (!pkg || pkg.status === 'ENTREGADO') {
      this.showToast('Paquete no disponible para entrega.');
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

  async downloadReport() {
    const packages = await db.getAll('packages');
    packages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    reports.exportToCSV(packages, `Reporte_Paqueteria_${new Date().toISOString().split('T')[0]}.csv`);
  }

  syncNow() {
    syncEngine.processQueue();
  }
}

const app = new App();
document.addEventListener('DOMContentLoaded', () => app.init());
