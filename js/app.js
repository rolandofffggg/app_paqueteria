// Fragmentos clave actualizados en js/app.js

// 1. Guardar Paquete (Recepción) con autoría de usuario
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

  const currentUser = auth.getUser();
  const activeUsername = currentUser ? currentUser.username : 'sistema';

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
    createdBy: activeUsername, // Auditoría Multiusuario
    amountCharged: 0
  };

  this.lastCreatedPackage = pkg;

  await db.put('packages', pkg);
  await db.put('syncQueue', { id: 'SYNC-' + Date.now(), type: 'CREATE', payload: pkg });

  this.showToast(`✅ Paquete ${pkg.code} registrado por @${activeUsername}.`, 'success');

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

// 2. Reubicación con trazabilidad de usuario
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

  const currentUser = auth.getUser();
  pkg.location = newLocation;
  pkg.updatedAt = new Date().toISOString();
  pkg.updatedBy = currentUser ? currentUser.username : 'sistema';

  await db.put('packages', pkg);
  await db.put('syncQueue', { id: 'SYNC-' + Date.now(), type: 'UPDATE', payload: pkg });

  const list = document.getElementById('inv-scanned-list');
  const li = document.createElement('li');
  li.className = 'py-1.5 flex justify-between font-mono';
  li.innerHTML = `<span>Code: <strong>${pkg.code}</strong> -> ${newLocation}</span> <span class="text-emerald-600 font-bold">✔ OK</span>`;
  list.prepend(li);

  this.showToast(`Ubicación de ${pkg.code} actualizada por @${pkg.updatedBy}`, 'success');
  this.loadDashboard();
  syncEngine.processQueue();
}

// 3. Confirmar Entrega guardando el usuario entregador
async confirmDelivery() {
  if (!this.selectedDeliveryPackage) return;

  const nombre = document.getElementById('del-retira-nombre').value.trim();
  const doc = document.getElementById('del-retira-id').value.trim();
  const recipientInfo = (nombre || doc) ? `${nombre} ${doc ? '(' + doc + ')' : ''}`.trim() : 'Titular';

  const currentUser = auth.getUser();

  this.selectedDeliveryPackage.status = 'ENTREGADO';
  this.selectedDeliveryPackage.deliveredTo = recipientInfo;
  this.selectedDeliveryPackage.deliveredAt = new Date().toISOString();
  this.selectedDeliveryPackage.deliveredBy = currentUser ? currentUser.username : 'sistema';
  this.selectedDeliveryPackage.amountCharged = this.currentCalculatedAmount;

  await db.put('packages', this.selectedDeliveryPackage);
  await db.put('syncQueue', { id: 'SYNC-' + Date.now(), type: 'DELIVERY', payload: this.selectedDeliveryPackage });

  this.showToast(`¡Entrega confirmada! Cobrado: Bs. ${this.currentCalculatedAmount.toFixed(2)} por @${this.selectedDeliveryPackage.deliveredBy}`, 'success');
  document.getElementById('del-details').classList.add('hidden');
  document.getElementById('del-search-code').value = '';
  this.selectedDeliveryPackage = null;
  this.loadDashboard();
  syncEngine.processQueue();
}

// 4. Guardar Usuario y encolar sincronización remota
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
    updatedAt: new Date().toISOString(),
    createdAt: existingUser ? existingUser.createdAt : new Date().toISOString()
  };

  await db.put('users', userObj);
  await db.put('syncQueue', { id: 'SYNC-USER-' + Date.now(), type: 'USER_SAVE', payload: userObj });

  this.showToast(`Usuario "${username}" guardado y encolado para sincronización.`, 'success');
  this.resetUserForm();
  this.loadUsersList();
  syncEngine.processQueue();
}
