/**
 * Backend en Google Apps Script para ParcelTrack_DB.
 * Permite la sincronización de registros entre múltiples usuarios en tiempo real.
 */

// Nombre de la base de datos / hoja
const DB_SHEET_NAME = 'PAQUETES';

/**
 * Endpoint GET: Descarga los registros centralizados para sincronización remota.
 */
function doGet(e) {
  try {
    const sheet = getDatabaseSheet();
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return responseJSON([]);
    }

    const headers = data[0];
    const rows = data.slice(1);

    const records = rows.map(row => {
      let pkg = {};
      headers.forEach((header, index) => {
        pkg[header] = row[index];
      });
      return pkg;
    });

    return responseJSON(records);
  } catch (error) {
    return responseJSON({ status: 'error', message: error.toString() });
  }
}

/**
 * Endpoint POST: Procesa creaciones, ediciones, entregas y eliminaciones de cada usuario.
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  // Bloqueo temporal para evitar conflictos entre solicitudes concurrentes de distintos usuarios
  lock.tryLock(10000);

  try {
    if (!e.postData || !e.postData.contents) {
      return responseJSON({ status: 'error', message: 'No se recibieron datos de sincronización.' });
    }

    const syncItem = JSON.parse(e.postData.contents);
    const sheet = getDatabaseSheet();
    const actionType = syncItem.type;
    const payload = syncItem.payload;

    if (!payload || !payload.packageId) {
      return responseJSON({ status: 'error', message: 'Identificador de registro no válido.' });
    }

    let result;
    switch (actionType) {
      case 'CREATE':
        result = saveOrUpdateRecord(sheet, payload);
        break;
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

/**
 * Guarda o actualiza un registro basándose en su ID único en ParcelTrack_DB.
 */
function saveOrUpdateRecord(sheet, record) {
  const headers = getDatabaseHeaders();
  const rowIndex = findRowIndexById(sheet, record.packageId);

  const rowData = headers.map(header => record[header] !== undefined ? record[header] : '');

  if (rowIndex > -1) {
    // Si ya existe en la hoja, sobreescribe la fila con los datos más recientes
    sheet.getRange(rowIndex, 1, 1, headers.length).setValues([rowData]);
    return { status: 'success', action: 'UPDATE', packageId: record.packageId };
  } else {
    // Si es nuevo, lo agrega al final
    sheet.appendRow(rowData);
    return { status: 'success', action: 'CREATE', packageId: record.packageId };
  }
}

/**
 * Elimina la fila correspondiente a un packageId.
 */
function deleteRecord(sheet, packageId) {
  const rowIndex = findRowIndexById(sheet, packageId);

  if (rowIndex !== -1) {
    sheet.deleteRow(rowIndex);
    return { status: 'success', action: 'DELETE', packageId: packageId };
  }

  return { status: 'warning', message: 'Registro no encontrado en ParcelTrack_DB.', packageId: packageId };
}

/**
 * Busca la fila exacta del paquete en la hoja de cálculo.
 */
function findRowIndexById(sheet, packageId) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return -1;

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === packageId) {
      return i + 1; // Ajuste por índice de fila en Sheets (empieza en 1)
    }
  }
  return -1;
}

/**
 * Inicializa y obtiene la pestaña PAQUETES en el libro ParcelTrack_DB.
 */
function getDatabaseSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(DB_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(DB_SHEET_NAME);
    sheet.appendRow(getDatabaseHeaders());
    sheet.getRange(1, 1, 1, getDatabaseHeaders().length).setFontWeight('bold');
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(getDatabaseHeaders());
    sheet.getRange(1, 1, 1, getDatabaseHeaders().length).setFontWeight('bold');
  }

  return sheet;
}

/**
 * Esquema de columnas de ParcelTrack_DB para auditar las acciones por usuario.
 */
function getDatabaseHeaders() {
  return [
    'packageId',
    'code',
    'qrCode',
    'client',
    'phone',
    'recipientPhone',
    'category',
    'size',
    'color',
    'location',
    'status',
    'createdAt',
    'createdBy',
    'updatedAt',
    'updatedBy',
    'deliveredTo',
    'deliveredAt',
    'deliveredBy',
    'amountCharged'
  ];
}

/**
 * Formateador de respuesta JSON con soporte para CORS.
 */
function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
