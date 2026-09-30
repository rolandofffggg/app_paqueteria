/**
 * Servidor Backend para ParcelTrack_BD
 * Sincronización multiusuario de Paquetes, Usuarios y Configuración Global.
 */

const DB_SHEET_NAME = 'PAQUETES';
const DB_USERS_SHEET_NAME = 'USUARIOS';
const DB_SETTINGS_SHEET_NAME = 'CONFIGURACION';

function doGet(e) {
  try {
    const action = e.parameter.action;

    // 1. Obtener Usuarios
    if (action === 'getUsers') {
      const userSheet = getOrCreateUserSheet();
      const userData = userSheet.getDataRange().getValues();
      if (userData.length <= 1) return responseJSON([]);
      const userHeaders = userData[0];
      const users = userData.slice(1).map(row => {
        let u = {};
        userHeaders.forEach((h, i) => u[h] = row[i]);
        return u;
      });
      return responseJSON(users);
    }

    // 2. Obtener Ajustes Globales
    if (action === 'getSettings') {
      const settingsSheet = getOrCreateSettingsSheet();
      const data = settingsSheet.getDataRange().getValues();
      if (data.length <= 1) return responseJSON([]);
      const settings = {};
      data.slice(1).forEach(row => {
        try {
          settings[row[0]] = JSON.parse(row[1]);
        } catch (err) {
          settings[row[0]] = row[1];
        }
      });
      return responseJSON(settings);
    }

    // 3. Obtener Paquetes (Por Defecto)
    const sheet = getDatabaseSheet();
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return responseJSON([]);

    const headers = data[0];
    const packages = data.slice(1).map(row => {
      let pkg = {};
      headers.forEach((header, index) => pkg[header] = row[index]);
      return pkg;
    });

    return responseJSON(packages);
  } catch (error) {
    return responseJSON({ status: 'error', message: error.toString() });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    if (!e.postData || !e.postData.contents) {
      return responseJSON({ status: 'error', message: 'No se recibieron datos.' });
    }

    const syncItem = JSON.parse(e.postData.contents);
    const actionType = syncItem.type;
    const payload = syncItem.payload;

    // --- MANEJO DE CONFIGURACIÓN GLOBAL ---
    if (actionType === 'SYNC_SETTING') {
      const settingsSheet = getOrCreateSettingsSheet();
      const result = saveOrUpdateSetting(settingsSheet, payload.key, payload.value);
      return responseJSON(result);
    }

    // --- MANEJO DE USUARIOS ---
    if (actionType === 'SYNC_USER') {
      const userSheet = getOrCreateUserSheet();
      const result = saveOrUpdateUser(userSheet, payload);
      return responseJSON(result);
    }

    // --- MANEJO DE PAQUETES ---
    if (!payload || !payload.packageId) {
      return responseJSON({ status: 'error', message: 'Identificador no válido.' });
    }

    const sheet = getDatabaseSheet();
    let result;

    switch (actionType) {
      case 'CREATE':
      case 'UPDATE':
      case 'DELIVERY':
        result = saveOrUpdateRecord(sheet, payload);
        break;
      case 'DELETE':
        result = deleteRecord(sheet, payload.packageId);
        break;
      default:
        result = { status: 'error', message: 'Acción no reconocida: ' + actionType };
    }

    return responseJSON(result);

  } catch (error) {
    return responseJSON({ status: 'error', message: error.toString() });
  } finally {
    lock.releaseLock();
  }
}

// --- AUXILIARES CONFIGURACIÓN ---
function saveOrUpdateSetting(sheet, key, value) {
  const data = sheet.getDataRange().getValues();
  const jsonValue = JSON.stringify(value);
  let rowIndex = -1;

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex > -1) {
    sheet.getRange(rowIndex, 2).setValue(jsonValue);
    sheet.getRange(rowIndex, 3).setValue(new Date().toISOString());
    return { status: 'success', action: 'UPDATE_SETTING', key };
  } else {
    sheet.appendRow([key, jsonValue, new Date().toISOString()]);
    return { status: 'success', action: 'CREATE_SETTING', key };
  }
}

function getOrCreateSettingsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(DB_SETTINGS_SHEET_NAME);
  if (!sheet || sheet.getLastRow() === 0) {
    if (!sheet) sheet = ss.insertSheet(DB_SETTINGS_SHEET_NAME);
    sheet.appendRow(['key', 'value', 'updatedAt']);
    sheet.getRange(1, 1, 1, 3).setFontWeight('bold');
  }
  return sheet;
}

// --- AUXILIARES PAQUETES Y USUARIOS ---
function saveOrUpdateRecord(sheet, record) {
  const headers = getDatabaseHeaders();
  const rowIndex = findRowIndexById(sheet, record.packageId);
  const rowData = headers.map(header => record[header] !== undefined ? record[header] : '');

  if (rowIndex > -1) {
    sheet.getRange(rowIndex, 1, 1, headers.length).setValues([rowData]);
    return { status: 'success', action: 'UPDATE', packageId: record.packageId };
  } else {
    sheet.appendRow(rowData);
    return { status: 'success', action: 'CREATE', packageId: record.packageId };
  }
}

function deleteRecord(sheet, packageId) {
  const rowIndex = findRowIndexById(sheet, packageId);
  if (rowIndex !== -1) {
    sheet.deleteRow(rowIndex);
    return { status: 'success', action: 'DELETE', packageId };
  }
  return { status: 'warning', message: 'Registro no encontrado.', packageId };
}

function findRowIndexById(sheet, packageId) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === packageId) return i + 1;
  }
  return -1;
}

function getDatabaseSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(DB_SHEET_NAME);
  if (!sheet || sheet.getLastRow() === 0) {
    if (!sheet) sheet = ss.insertSheet(DB_SHEET_NAME);
    sheet.appendRow(getDatabaseHeaders());
    sheet.getRange(1, 1, 1, getDatabaseHeaders().length).setFontWeight('bold');
  }
  return sheet;
}

function getDatabaseHeaders() {
  return [
    'packageId', 'code', 'qrCode', 'client', 'phone', 'recipientPhone',
    'category', 'size', 'color', 'location', 'status', 'createdAt',
    'createdBy', 'updatedAt', 'updatedBy', 'deliveredTo', 'deliveredAt',
    'deliveredBy', 'amountCharged'
  ];
}

function saveOrUpdateUser(sheet, user) {
  const headers = ['username', 'fullName', 'pin', 'role', 'status', 'createdAt'];
  const data = sheet.getDataRange().getValues();
  let rowIndex = -1;

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === user.username) {
      rowIndex = i + 1;
      break;
    }
  }

  const rowData = headers.map(h => user[h] !== undefined ? user[h] : '');

  if (rowIndex > -1) {
    sheet.getRange(rowIndex, 1, 1, headers.length).setValues([rowData]);
    return { status: 'success', action: 'UPDATE_USER', username: user.username };
  } else {
    sheet.appendRow(rowData);
    return { status: 'success', action: 'CREATE_USER', username: user.username };
  }
}

function getOrCreateUserSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(DB_USERS_SHEET_NAME);
  if (!sheet || sheet.getLastRow() === 0) {
    if (!sheet) sheet = ss.insertSheet(DB_USERS_SHEET_NAME);
    const headers = ['username', 'fullName', 'pin', 'role', 'status', 'createdAt'];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  return sheet;
}

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
