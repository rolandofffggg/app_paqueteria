class App {
  constructor() {
    this.selectedDeliveryPackage = null;
    this.lastCreatedPackage = null;
    this.currentCalculatedAmount = 0;
    this.tariffs = { baseRate: 2.0, graceDays: 3, dailyPenalty: 1.0 };
    this.companyName = '';
    this.catalog = {
      categories: ['ROPA', 'JOYAS', 'REPUESTOS', 'DOCUMENTOS', 'ELECTRÓNICA', 'OTROS'],
      sizes: ['PEQUEÑO', 'MEDIANO', 'GRANDE'],
      colors: ['AMARILLO', 'ROJO', 'AZUL', 'NEGRO', 'BLANCO', 'VERDE', 'OTRO']
    };
    this.locationGroups = {
      group1: ['E1', 'E2', 'E3', 'E4', 'E5'],
      group2: ['PASILLO 1', 'PASILLO 2', 'PASILLO 3'],
      group3: ['ESTANTE A', 'ESTANTE B', 'ESTANTE C']
    };
    this.selectedGroup1 = null;
    this.selectedGroup2 = null;
    this.selectedGroup3 = null;
    this.paletteColors = [
      { name: 'Carmesí', hex: '#DC143C' },
      { name: 'Burdeos / Vino', hex: '#800020' },
      { name: 'Celeste', hex: '#38BDF8' },
      { name: 'Marino', hex: '#1E3A8A' },
      { name: 'Turquesa', hex: '#0D9488' },
      { name: 'Azul eléctrico', hex: '#2563EB' },
      { name: 'Dorado', hex: '#CA8A04' },
      { name: 'Mostaza', hex: '#EAB308' },
      { name: 'Verde claro', hex: '#4ADE80' },
      { name: 'Esmeralda', hex: '#059669' },
      { name: 'Oliva', hex: '#65A30D' },
      { name: 'Verde militar', hex: '#4D7C0F' },
      { name: 'Naranja', hex: '#F97316' },
      { name: 'Lila', hex: '#C084FC' },
      { name: 'Magenta', hex: '#D946EF' },
      { name: 'Fucsia', hex: '#EC4899' },
      { name: 'Rosa pastel', hex: '#F472B6' },
      { name: 'Blanco', hex: '#FFFFFF' },
      { name: 'Negro', hex: '#000000' },
      { name: 'Plata', hex: '#94A3B8' },
      { name: 'Antracita', hex: '#334155' },
      { name: 'Beige', hex: '#F5F5DC' },
      { name: 'Chocolate', hex: '#5C4033' },
      { name: 'Arena', hex: '#D2B48C' }
    ];
    this.selectedColor = '#1E3A8A';
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
    await this.loadLocationGroupsSettings();
    
    this.initNetwork();
    this.loadDashboard();
    
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

  async showSec(secId) {
    if (!auth.hasAccess(secId)) {
      this.showToast('Acceso denegado: No tiene permisos para este módulo.', 'warning');
      secId = 'sec-dashboard';
    }
    const sections = ['sec-dashboard', 'sec-reception', 'sec-print-notify', 'sec-inventory', 'sec-delivery', 'sec-manage', 'sec-settings', 'sec-users', 'sec-labels'];
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
      await this.loadLocationGroupsSettings();
    } else if (secId === 'sec-manage') {
      this.loadManageList();
    } else if (secId === 'sec-print-notify') {
      this.loadPrintNotifyView();
    } else if (secId === 'sec-users') {
      this.loadUsersList();
    } else if (secId === 'sec-labels') {
      this.initLabelsModule();
    }
  }

  async savePackage(e) {
    e.preventDefault();
    const pkgCode = document.getElementById('rec-codigo').value.trim().toUpperCase();
    
    if (!pkgCode) {
      this.showToast('El código del paquete no puede estar vacío.');
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
    let locationVal = document.getElementById('rec-ubicacion').value.trim();
    const keepClient = document.getElementById('chk-keep-client').checked;
    const keepCategory = document.getElementById('chk-keep-category').checked;
    const keepLocation = document.getElementById('chk-keep-location').checked;
    
    if (!locationVal) {
      locationVal = 'SIN UBICACIÓN';
    }
    
    const activeUser = auth.getUser();
    const pkgId = 'PKG-' + Date.now();
    const pkg = {
      packageId: pkgId,
      code: pkgCode,
      qrCode: pkgCode,
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
    
    document.getElementById('rec-codigo').value = '';
    document.getElementById('rec-celular-dest').value = '';

    if (!keepClient) {
      document.getElementById('rec-cliente').value = '';
      document.getElementById('rec-celular').value = '';
    }

    if (!keepCategory) {
      document.getElementById('rec-categoria').selectedIndex = 0;
      document.getElementById('rec-tamano').selectedIndex = 0;
      document.getElementById('rec-color').selectedIndex = 0;
    }

    if (!keepLocation) {
      document.getElementById('rec-ubicacion').value = '';
      this.populateGroupSelects();
    }
    this.loadDashboard();
    syncEngine.processQueue();
  }

  async loadLocationGroupsSettings() {
    const saved = await db.get('settings', 'locationGroups');
    if (saved && saved.value) this.locationGroups = saved.value;
    
    const g1El = document.getElementById('cfg-group1');
    const g2El = document.getElementById('cfg-group2');
    const g3El = document.getElementById('cfg-group3');
    if (g1El) g1El.value = this.locationGroups.group1 ? this.locationGroups.group1.join(', ') : '';
    if (g2El) g2El.value = this.locationGroups.group2 ? this.locationGroups.group2.join(', ') : '';
    if (g3El) g3El.value = this.locationGroups.group3 ? this.locationGroups.group3.join(', ') : '';
    
    this.populateGroupSelects();
  }

  async saveLocationGroupsSettings(e) {
    e.preventDefault();
    const g1 = document.getElementById('cfg-group1').value;
    const g2 = document.getElementById('cfg-group2').value;
    const g3 = document.getElementById('cfg-group3').value;
    this.locationGroups = {
      group1: g1.split(',').map(s => s.trim().toUpperCase()).filter(Boolean),
      group2: g2.split(',').map(s => s.trim().toUpperCase()).filter(Boolean),
      group3: g3.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
    };
    await db.put('settings', { key: 'locationGroups', value: this.locationGroups });
    await db.put('syncQueue', { id: 'SYNC-SET-' + Date.now(), type: 'SYNC_SETTING', payload: { key: 'locationGroups', value: this.locationGroups } });
    this.populateGroupSelects();
    this.showToast('¡Grupos de ubicación guardados y sincronizados!', 'success');
    syncEngine.processQueue();
  }

  populateGroupSelects() {
    const sel1 = document.getElementById('rec-grupo1');
    const sel2 = document.getElementById('rec-grupo2');
    const sel3 = document.getElementById('rec-grupo3');
    
    if (sel1) {
      sel1.innerHTML = '<option value="" disabled selected>Seleccionar...</option>' +
        this.locationGroups.group1.map(val => `<option value="${val}">${val}</option>`).join('');
    }
    if (sel2) {
      sel2.innerHTML = '<option value="" disabled selected>Seleccionar...</option>';
      sel2.disabled = true;
    }
    if (sel3) {
      sel3.innerHTML = '<option value="" disabled selected>Seleccionar...</option>';
      sel3.disabled = true;
    }
    this.selectedGroup1 = null;
    this.selectedGroup2 = null;
    this.selectedGroup3 = null;
    this.updateCascadingLocationInput();
  }

  handleGroup1Change(val) {
    this.selectedGroup1 = val;
    this.selectedGroup2 = null;
    this.selectedGroup3 = null;
    
    const sel2 = document.getElementById('rec-grupo2');
    const sel3 = document.getElementById('rec-grupo3');
    
    sel2.innerHTML = '<option value="" disabled selected>Seleccionar...</option>' +
      this.locationGroups.group2.map(item => `<option value="${item}">${item}</option>`).join('');
    sel2.disabled = false;
    
    sel3.innerHTML = '<option value="" disabled selected>Seleccionar...</option>';
    sel3.disabled = true;
    
    this.updateCascadingLocationInput();
  }

  handleGroup2Change(val) {
    this.selectedGroup2 = val;
    this.selectedGroup3 = null;
    
    const sel3 = document.getElementById('rec-grupo3');
    sel3.innerHTML = '<option value="" disabled selected>Seleccionar...</option>' +
      this.locationGroups.group3.map(item => `<option value="${item}">${item}</option>`).join('');
    sel3.disabled = false;
    
    this.updateCascadingLocationInput();
  }

  handleGroup3Change(val) {
    this.selectedGroup3 = val;
    this.updateCascadingLocationInput();
  }

  updateCascadingLocationInput() {
    const input = document.getElementById('rec-ubicacion');
    if (!input) return;
    let parts = [];
    if (this.selectedGroup1) parts.push(this.selectedGroup1);
    if (this.selectedGroup2) parts.push(this.selectedGroup2);
    if (this.selectedGroup3) parts.push(this.selectedGroup3);
    input.value = parts.join('-');
  }

  async sharePackageQR(code, client) {
    const container = document.getElementById('qr-canvas-container');
    if (!container) return;
    container.innerHTML = '';

    new QRCode(container, {
      text: code,
      width: 260,
      height: 260,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H
    });

    setTimeout(async () => {
      const originalCanvas = container.querySelector('canvas');
      if (!originalCanvas) {
        this.showToast('Error al generar la imagen QR.');
        return;
      }

      const padding = 40;
      const paddedCanvas = document.createElement('canvas');
      paddedCanvas.width = originalCanvas.width + (padding * 2);
      paddedCanvas.height = originalCanvas.height + (padding * 2);
      const ctx = paddedCanvas.getContext('2d');

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, paddedCanvas.width, paddedCanvas.height);

      ctx.drawImage(originalCanvas, padding, padding);

      paddedCanvas.toBlob(async (blob) => {
        if (!blob) {
          this.showToast('No se pudo convertir el QR a imagen.');
          return;
        }
        const file = new File([blob], `QR_${code}.png`, { type: 'image/png' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              title: `Paquete: ${code}`,
              text: code,
              files: [file]
            });
          } catch (err) {
            console.log('Intercambio cancelado o error:', err);
          }   
        } else {
          alert("Tu navegador no soporta compartir archivos directamente. Puedes guardar la imagen manteniendo presionada la pantalla.");
          this.showToast('Intercambio no soportado directamente en este navegador.', 'warning');
        }
      }, 'image/png');
    }, 150);
  }

renderPrintCard(pkg) {
    const printCard = document.getElementById('print-card-target');
    if (!printCard || !pkg) return;
    
    const qr = qrcode(4, 'L');
    qr.addData(pkg.code);
    qr.make();
    const qrImg = qr.createImgTag(4);
    
    const hasClientPhone = !!pkg.phone;
    const hasRecipientPhone = !!pkg.recipientPhone;
    
    printCard.innerHTML = `
      <div class="text-lg font-black text-slate-800 font-mono mb-0">${pkg.code}</div>
      <div class="flex justify-center my-0 p-2 bg-white rounded-xl border border-slate-100 inline-block">${qrImg}</div>
      <div class="bg-slate-50 p-2 rounded-lg border text-left text-xs space-y-1 my-1">
        <p><strong>Cliente:</strong> ${pkg.client} ${pkg.phone ? '(' + pkg.phone + ')' : ''}</p>
        <p><strong>Destinatario:</strong> ${pkg.recipientPhone ? pkg.recipientPhone : 'N/A'}</p>
        <p><strong>Contenido:</strong> ${pkg.category || 'N/A'} | <strong>Tamaño:</strong> ${pkg.size || 'N/A'} | <strong>Color:</strong> ${pkg.color || 'N/A'}</p>
        <p><strong>Ubicación:</strong> <span class="font-mono font-bold text-blue-600">${pkg.location}</span></p>
      </div>
      <div class="space-y-1.5 pt-0">
        <button onclick="app.sharePackageQR('${pkg.code}', '${pkg.client.replace(/'/g, "\\'")}')" class="w-full bg-slate-800 text-white font-bold py-1.5 rounded-lg text-xs flex items-center justify-center gap-1 shadow-sm hover:bg-slate-900">
          📤 Compartir Imagen QR
        </button>
        <button onclick='app.sendWhatsAppNotification(${JSON.stringify(pkg)}, "client")' ${!hasClientPhone ? 'disabled' : ''} 
          class="w-full bg-green-500 disabled:bg-slate-300 text-white font-bold py-1.5 rounded-lg text-xs flex items-center justify-center gap-1 shadow-sm">
          🟢 Enviar WhatsApp Cliente
        </button>
        <button onclick='app.sendWhatsAppNotification(${JSON.stringify(pkg)}, "recipient")' ${!hasRecipientPhone ? 'disabled' : ''} 
          class="w-full bg-green-600 disabled:bg-slate-300 text-white font-bold py-1.5 rounded-lg text-xs flex items-center justify-center gap-1 shadow-sm">
          🟢 Enviar WhatsApp Destinatario
        </button>
      </div>
    `;
  }

  async loadPrintNotifyView() {
    const printCard = document.getElementById('print-card-target');
    if (!printCard) return;
    
    const searchInput = document.getElementById('print-search-input');
    if (searchInput) searchInput.value = '';

    const packages = await db.getAll('packages');
    if (packages.length === 0) {
      printCard.innerHTML = '<p class="text-xs text-slate-400 py-4">No hay paquetes disponibles.</p>';
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
    if (packages.length === 0) {
      printCard.innerHTML = '<p class="text-xs text-slate-400 py-4">No hay paquetes disponibles.</p>';
      return;
    }

    packages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (!q) {
      this.renderPrintCard(packages[0]);
      return;
    }

    const filtered = packages.filter(p => 
      (p.code || '').toLowerCase().includes(q) || 
      (p.client || '').toLowerCase().includes(q)
    );

    if (filtered.length === 0) {
      printCard.innerHTML = '<p class="text-xs text-slate-400 py-4">No se encontró ningún paquete con ese criterio.</p>';
      return;
    }

    this.renderPrintCard(filtered[0]);
  }

  async updatePackageLocation(qrCode, newLocation, autoOpenScanner = false) {
    const cleanQuery = (qrCode || '').toUpperCase().trim();
    if (!cleanQuery) {
      this.showToast('Código de paquete inválido.');
      return;
    }

    const packages = await db.getAll('packages');
    const pkg = packages.find(p => 
      ((p.qrCode || '').toUpperCase().trim() === cleanQuery || 
       (p.code || '').toUpperCase().trim() === cleanQuery)
    );

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

    if (autoOpenScanner) {
      setTimeout(() => {
        scanner.scanInventoryPackage();
      }, 300);
    }
  }

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
💵 *Tarifa Base:* Bs. ${this.tariffs.baseRate.toFixed(2)} por ${this.tariffs.graceDays} días.
+ 💵 *Posteriormente se incrementa:* Bs. ${this.tariffs.dailyPenalty.toFixed(2)} por día adicional.`;
    
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  }

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
    await db.put('syncQueue', {
      id: 'SYNC-USR-' + Date.now(),
      type: 'SYNC_USER',
      payload: userObj
    });
    this.showToast(`Usuario "${username}" guardado correctamente.`, 'success');
    this.resetUserForm();
    this.loadUsersList();
    syncEngine.processQueue();
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
    await db.put('syncQueue', {
      id: 'SYNC-USR-' + Date.now(),
      type: 'SYNC_USER',
      payload: u
    });
    this.showToast(`Estado de "${u.username}" cambiado a ${u.status}`, 'success');
    this.loadUsersList();
    syncEngine.processQueue();
  }

  resetUserForm() {
    const form = document.getElementById('form-user-manage');
    if (form) form.reset();
    document.getElementById('usr-is-edit').value = 'false';
    document.getElementById('usr-username').readOnly = false;
    document.getElementById('usr-form-title').textContent = 'Crear Nuevo Usuario';
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
    await db.put('syncQueue', { id: 'SYNC-SET-' + Date.now(), type: 'SYNC_SETTING', payload: { key: 'brand', value: val } });
    this.loadBrandSettings();
    this.showToast('¡Nombre de marca guardado y sincronizado!', 'success');
    syncEngine.processQueue();
  }

  async loadCatalogSettings() {
    const saved = await db.get('settings', 'catalog');
    if (saved && saved.value) this.catalog = saved.value;
    const catEl = document.getElementById('cfg-catalog-categories');
    const sizeEl = document.getElementById('cfg-catalog-sizes');
    const colEl = document.getElementById('cfg-catalog-colors');
    if (catEl) catEl.value = this.catalog.categories ? this.catalog.categories.join(', ') : '';
    if (sizeEl) sizeEl.value = this.catalog.sizes ? this.catalog.sizes.join(', ') : '';
    if (colEl) colEl.value = this.catalog.colors ? this.catalog.colors.join(', ') : '';
    this.populateReceptionSelects();
  }

  async saveCatalogSettings(e) {
    e.preventDefault();
    const rawCat = document.getElementById('cfg-catalog-categories').value;
    const rawSize = document.getElementById('cfg-catalog-sizes').value;
    const rawCol = document.getElementById('cfg-catalog-colors').value;
    this.catalog = {
      categories: rawCat.split(',').map(s => s.trim().toUpperCase()).filter(Boolean),
      sizes: rawSize.split(',').map(s => s.trim().toUpperCase()).filter(Boolean),
      colors: rawCol.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
    };
    await db.put('settings', { key: 'catalog', value: this.catalog });
    await db.put('syncQueue', { id: 'SYNC-SET-' + Date.now(), type: 'SYNC_SETTING', payload: { key: 'catalog', value: this.catalog } });
    this.populateReceptionSelects();
    this.showToast('¡Catálogo guardado y sincronizado!', 'success');
    syncEngine.processQueue();
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

  async loadTariffSettings() {
    const saved = await db.get('settings', 'tariffs');
    if (saved && saved.value) this.tariffs = saved.value;
    const baseEl = document.getElementById('cfg-rate-base');
    const graceEl = document.getElementById('cfg-grace-days');
    const penEl = document.getElementById('cfg-rate-penalty');
    if (baseEl) baseEl.value = this.tariffs.baseRate;
    if (graceEl) graceEl.value = this.tariffs.graceDays;
    if (penEl) penEl.value = this.tariffs.dailyPenalty;
  }

  async saveTariffSettings(e) {
    e.preventDefault();
    this.tariffs = {
      baseRate: parseFloat(document.getElementById('cfg-rate-base').value) || 0,
      graceDays: parseInt(document.getElementById('cfg-grace-days').value) || 0,
      dailyPenalty: parseFloat(document.getElementById('cfg-rate-penalty').value) || 0
    };
    await db.put('settings', { key: 'tariffs', value: this.tariffs });
    await db.put('syncQueue', { id: 'SYNC-SET-' + Date.now(), type: 'SYNC_SETTING', payload: { key: 'tariffs', value: this.tariffs } });
    this.showToast('¡Tarifas guardadas y sincronizadas!', 'success');
    syncEngine.processQueue();
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
          <button onclick="app.openEditModal('${p.packageId}')" class="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold border border-blue-200">✏ Editar</button>
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

  handleFixedLocationInput(val) {
    const cleanVal = val.trim();
    const btnAdd = document.getElementById('btn-add-inv-pkg');
    const btnScan = document.getElementById('btn-scan-pkg');
    
    if (cleanVal.length > 0) {
      if (btnAdd) btnAdd.disabled = false;
      if (btnScan) btnScan.disabled = false;
    } else {
      if (btnAdd) btnAdd.disabled = true;
      if (btnScan) btnScan.disabled = true;
    }
  }

  processInventoryManual() {
    const code = document.getElementById('inv-pkg-input').value.trim();
    const fixedLocInput = document.getElementById('inv-fixed-loc');
    const fixedLoc = fixedLocInput ? fixedLocInput.value.trim() : '';

    if (!fixedLoc) { 
      this.showToast('Ingrese o escanee una ubicación fija primero.'); 
      return; 
    }
    if (!code) { 
      this.showToast('Ingrese un código de paquete.'); 
      return; 
    }
    this.updatePackageLocation(code, fixedLoc);
    document.getElementById('inv-pkg-input').value = '';
  }

  async searchDeliveryManual() {
    const code = document.getElementById('del-search-code').value.trim();
    if (!code) { this.showToast('Ingrese un código de paquete'); return; }
    await this.prepareDelivery(code);
  }

  async prepareDelivery(qrCode) {
    const cleanQuery = (qrCode || '').toUpperCase().trim();
    if (!cleanQuery) {
      this.showToast('Ingrese un código válido.');
      return;
    }

    const packages = await db.getAll('packages');
    const pkg = packages.find(p => 
      ((p.qrCode || '').toUpperCase().trim() === cleanQuery || 
       (p.code || '').toUpperCase().trim() === cleanQuery)
    );

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

  // --- MÓDULO DE ETIQUETAS ---
  initLabelsModule() {
    const paletteContainer = document.getElementById('colorPalette');
    if (!paletteContainer || paletteContainer.children.length > 0) return;
    
    paletteContainer.innerHTML = '';
    this.paletteColors.forEach(c => {
      const div = document.createElement('div');
      div.className = `color-option w-7 h-7 rounded cursor-pointer border-2 transition-transform hover:scale-110 ${c.hex === this.selectedColor ? 'border-slate-900 shadow-md ring-2 ring-white' : 'border-transparent'}`;
      div.style.backgroundColor = c.hex;
      div.title = c.name;
      div.onclick = () => {
        document.querySelectorAll('.color-option').forEach(el => {
          el.classList.remove('border-slate-900', 'shadow-md', 'ring-2', 'ring-white');
          el.classList.add('border-transparent');
        });
        div.classList.remove('border-transparent');
        div.classList.add('border-slate-900', 'shadow-md', 'ring-2', 'ring-white');
        this.selectedColor = c.hex;
        document.documentElement.style.setProperty('--primary-color', this.selectedColor);
      };
      paletteContainer.appendChild(div);
    });

    const btnGen = document.getElementById('btnGenerate');
    if (btnGen) {
      btnGen.onclick = () => this.generateLabels();
    }
    this.generateLabels();
  }

  convertToCode(n) {
    if (n < 1 || n > 19144736) return "FUERA DE RANGO";
    if (n <= 260000) {
      let idx = n - 1;
      let num = idx % 10000;
      let l1 = Math.floor(idx / 10000);
      return String.fromCharCode(65 + l1) + String(num).padStart(4, '0');
    }
    if (n <= 936000) {
      let idx = n - 260001;
      let num = idx % 1000;
      let lettersIdx = Math.floor(idx / 1000);
      let l1 = Math.floor(lettersIdx / 26);
      let l2 = lettersIdx % 26;
      return String.fromCharCode(65 + l1) + String.fromCharCode(65 + l2) + String(num).padStart(3, '0');
    }
    if (n <= 2693600) {
      let idx = n - 936001;
      let num = idx % 100;
      let lettersIdx = Math.floor(idx / 100);
      let l1 = Math.floor(lettersIdx / 676);
      let rem = lettersIdx % 676;
      let l2 = Math.floor(rem / 26);
      let l3 = rem % 26;
      return String.fromCharCode(65 + l1) + String.fromCharCode(65 + l2) + String.fromCharCode(65 + l3) + String(num).padStart(2, '0');
    }
    if (n <= 7263360) {
      let idx = n - 2693601;
      let num = idx % 10;
      let lettersIdx = Math.floor(idx / 10);
      let l1 = Math.floor(lettersIdx / 17576);
      let rem1 = lettersIdx % 17576;
      let l2 = Math.floor(rem1 / 676);
      let rem2 = rem1 % 676;
      let l3 = Math.floor(rem2 / 26);
      let l4 = rem2 % 26;
      return String.fromCharCode(65 + l1) + String.fromCharCode(65 + l2) + String.fromCharCode(65 + l3) + String.fromCharCode(65 + l4) + String(num).padStart(1, '0');
    }
    if (n <= 19144736) {
      let idx = n - 7263361;
      let l1 = Math.floor(idx / 456976);
      let rem1 = idx % 456976;
      let l2 = Math.floor(rem1 / 17576);
      let rem2 = rem1 % 17576;
      let l3 = Math.floor(rem2 / 676);
      let rem3 = rem2 % 676;
      let l4 = Math.floor(rem3 / 26);
      let l5 = rem3 % 26;
      return String.fromCharCode(65 + l1) + String.fromCharCode(65 + l2) + String.fromCharCode(65 + l3) + String.fromCharCode(65 + l4) + String.fromCharCode(65 + l5);
    }
    return "FUERA DE RANGO";
  }

  generateLabels() {
    const startInput = document.getElementById('inputStart');
    const endInput = document.getElementById('inputEnd');
    const headerInput = document.getElementById('headerText');
    const sheetTypeInput = document.getElementById('sheetType');
    const container = document.getElementById('previewContainer');

    if (!startInput || !endInput || !container) return;

    const start = parseInt(startInput.value);
    const end = parseInt(endInput.value);
    const headerText = headerInput ? headerInput.value : 'LA CLAVE';
    const sheetType = sheetTypeInput ? sheetTypeInput.value : 'carta';

    container.innerHTML = '';

    if (isNaN(start) || isNaN(end) || start < 1 || end > 19144736 || start > end) {
      container.innerHTML = `<div class="out-of-range text-red-600 font-bold p-6 text-center">FUERA DE RANGO (Debe estar entre 1 y 19,144,736)</div>`;
      return;
    }

    let labelsPerRow = 8;
    let rowsPerCarta = 7;   
    let rowsPerOficio = 8;  
    let maxRows = sheetType === 'carta' ? rowsPerCarta : rowsPerOficio;
    let labelsPerSheet = labelsPerRow * maxRows;

    let totalLabels = (end - start) + 1;
    let currentLabelIndex = start;
    let totalSheets = Math.ceil(totalLabels / labelsPerSheet);

    for (let s = 0; s < totalSheets; s++) {
      const sheetDiv = document.createElement('div');
      sheetDiv.className = `sheet ${sheetType} bg-white shadow-lg relative box-border flex flex-col items-center justify-start`;
      sheetDiv.style.width = '21.59cm';
      sheetDiv.style.height = sheetType === 'carta' ? '27.94cm' : '35.56cm';
      
      sheetDiv.style.paddingTop = '0.4cm'; 
      sheetDiv.style.paddingBottom = '0cm';
      sheetDiv.style.paddingLeft = '0.3cm';
      sheetDiv.style.paddingRight = '0.3cm';

      const gridDiv = document.createElement('div');
      gridDiv.className = 'grid-labels grid justify-center items-start align-content-start';
      gridDiv.style.gridTemplateColumns = `repeat(8, 2.3cm)`;
      gridDiv.style.gridTemplateRows = `repeat(${maxRows}, 3.7cm)`;
      
      let uniformGap = '2px'; 
      gridDiv.style.columnGap = uniformGap;
      gridDiv.style.rowGap = uniformGap;

      let labelsInThisSheet = Math.min(labelsPerSheet, totalLabels - (s * labelsPerSheet));

      for (let i = 0; i < labelsInThisSheet; i++) {
        let codeVal = this.convertToCode(currentLabelIndex);

        const card = document.createElement('div');
        card.className = 'label-card border-[0.5px] border-slate-500 flex flex-col bg-white overflow-hidden relative';
        card.style.width = '2.3cm';
        card.style.height = '3.7cm';

        const logoContainer = document.createElement('div');
        logoContainer.className = 'label-logo-container h-[16%] flex items-center justify-center p-[1px] bg-white';
        
        const img = document.createElement('img');
        img.src = './icons/LogoPaqueteria.png';
        img.className = 'label-logo max-h-full max-w-[2.1cm] object-contain';
        logoContainer.appendChild(img);
        
        card.appendChild(logoContainer);

        const header = document.createElement('div');
        header.className = 'label-header h-[15%] text-white flex items-center justify-center text-[7pt] font-black text-center px-[1px] overflow-hidden whitespace-nowrap text-ellipsis mb-[2px]';
        header.style.backgroundColor = this.selectedColor;
        header.textContent = headerText;
        card.appendChild(header);

        const qrContainer = document.createElement('div');
        qrContainer.className = 'label-qr-container flex-1 flex items-center justify-center p-0 overflow-hidden';
        
        const qrBox = document.createElement('div');
        qrBox.className = 'qr-code-box flex items-center justify-center';
        qrBox.style.width = '1.9cm';
        qrBox.style.height = '1.9cm';
        qrBox.style.maxWidth = '1.9cm';
        qrBox.style.maxHeight = '1.9cm';
        qrBox.id = `qr-mod-${s}-${i}-${currentLabelIndex}`;
        qrContainer.appendChild(qrBox);
        card.appendChild(qrContainer);

        const footer = document.createElement('div');
        footer.className = 'label-footer flex items-center justify-center pb-[2px] mt-[-2px] bg-white';
        const codeText = document.createElement('div');
        codeText.className = 'label-code-text text-[11pt] font-semibold text-black tracking-[0.2px] leading-none';
        codeText.textContent = codeVal;
        footer.appendChild(codeText);
        card.appendChild(footer);

        gridDiv.appendChild(card);
        currentLabelIndex++;
      }

      sheetDiv.appendChild(gridDiv);
      container.appendChild(sheetDiv);

      setTimeout(() => {
        let sheetStartIdx = start + (s * labelsPerSheet);
        for (let i = 0; i < labelsInThisSheet; i++) {
          let cIdx = sheetStartIdx + i;
          let codeVal = this.convertToCode(cIdx);
          let elId = `qr-mod-${s}-${i}-${cIdx}`;
          let element = document.getElementById(elId);
          if (element) {
            element.innerHTML = '';
            new QRCode(element, {
              text: codeVal,
              width: 75,
              height: 75,
              colorDark: "#000000",
              colorLight: "#ffffff",
              correctLevel: QRCode.CorrectLevel.M
            });
          }
        }
      }, 50);
    }
  }

  downloadLabelsPDF() {
    const container = document.getElementById('previewContainer');
    const sheetTypeSelect = document.getElementById('sheetType');
    const sheetType = sheetTypeSelect ? sheetTypeSelect.value : 'carta';

    if (!container || container.children.length === 0) {
      this.showToast('No hay etiquetas generadas para exportar.', 'warning');
      return;
    }

    this.showToast('Generando PDF, por favor espere...', 'success');

    const formatType = sheetType === 'oficio' ? 'legal' : 'letter';

    const options = {
      margin:       0,
      filename:     `Etiquetas_${sheetType.toUpperCase()}_${Date.now()}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, letterRendering: true },
      jsPDF:        { unit: 'cm', format: formatType, orientation: 'portrait' }
    };

    html2pdf().from(container).set(options).save().then(() => {
      this.showToast('¡PDF descargado con éxito!', 'success');
    }).catch(err => {
      console.error('Error al generar PDF:', err);
      this.showToast('Error al generar el archivo PDF.', 'error');
    });
  }
}

const app = new App();
document.addEventListener('DOMContentLoaded', () => app.init());
