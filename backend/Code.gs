/**
 * Servidor Backend en Google Apps Script para Sistema de Paquetería Offline-First.
 * Maneja la sincronización multiusuario y la auditoría de registros.
 */

// Nombre de la hoja en Google Sheets donde se almacenan los paquetes
const SHEET_NAME = 'PAQUETES';

/**
 * Función que responde a las peticiones GET (Descarga de paquetes/sincronización remota).
 */
function doGet(e) {
  try {
    const sheet = getOrCreateSheet();
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return responseJSON([]);
    }

    const headers = data[0];
    const rows = data.slice(1);

    const packages = rows.map(row => {
      let pkg = {};
      headers.forEach((header, index) => {
        pkg[header] = row[index];
      });
      return pkg;
    });

    return responseJSON(packages);
  } catch (error) {
    return responseJSON({ status: 'error', message: error.toString() });
  }
}

/**
 * Función que responde a las peticiones POST (Creación, actualización, entrega y eliminación de paquetes).
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  // Evita colisiones cuando múltiples usuarios sincronizan al mismo tiempo
  lock.tryLock(10000);

  try {
    if (!e.postData || !e.postData.contents) {
      return responseJSON({ status: 'error', message: 'No se recibieron datos en la petición.' });
    }

    const item = JSON.parse(e.postData.contents);
    const sheet = getOrCreateSheet();
    const type = item.type;
    const payload = item.payload;

    if (!payload || !payload.packageId) {
      return responseJSON({ status: 'error', message: 'Payload o packageId no válido.' });
    }

    let result;
    switch (type) {
      case 'CREATE':
        result = createPackageRow(sheet, payload);
        break;
      case 'UPDATE':
      case 'DELIVERY':
        result = updatePackageRow(sheet, payload);
        break;
      case 'DELETE':
        result = deletePackageRow(sheet, payload.packageId);
        break;
      default:
        result = { status: 'error', message: 'Tipo de acción no soportada: ' + type };
    }

    return responseJSON(result);

  } catch (error) {
    return responseJSON({ status: 'error', message: error.toString() });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Crea un nuevo registro en la hoja de cálculo.
 */
function createPackageRow(sheet, pkg) {
  const headers = getHeaders();
  const existingRowIndex = findRowIndexByPackageId(sheet, pkg.packageId);

  // Si ya existe la fila por una sincronización previa, se actualiza
  if (existingRowIndex > -1) {
    return updatePackageRow(sheet, pkg);
  }

  const row = headers.map(header => pkg[header] !== undefined ? pkg[header] : '');
  sheet.appendRow(row);

  return { status: 'success', action: 'CREATE', packageId: pkg.packageId };
}

/**
 * Actualiza una fila existente basándose en el packageId.
 */
function updatePackageRow(sheet, pkg) {
  const headers = getHeaders();
  const rowIndex = findRowIndexByPackageId(sheet, pkg.packageId);

  if (rowIndex === -1) {
    // Si no existe localmente en el Sheets, lo crea
    return createPackageRow(sheet, pkg);
  }

  const rowData = headers.map(header => pkg[header] !== undefined ? pkg[header] : '');
  sheet.getRange(rowIndex, 1, 1, headers.length).setValues([rowData]);

  return { status: 'success', action: 'UPDATE', packageId: pkg.packageId };
}

/**
 * Elimina la fila de un paquete por su packageId.
 */
function deletePackageRow(sheet, packageId) {
  const rowIndex = findRowIndexByPackageId(sheet, packageId);

  if (rowIndex !== -1) {
    sheet.deleteRow(rowIndex);
    return { status: 'success', action: 'DELETE', packageId: packageId };
  }

  return { status: 'warning', message: 'Paquete no encontrado para eliminar.', packageId: packageId };
}

/**
 * Busca el índice de la fila según el packageId (1-based index).
 */
function findRowIndexByPackageId(sheet, packageId) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return -1;

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === packageId) {
      return i + 1; // +1 porque las filas en Sheets comienzan en 1
    }
  }
  return -1;
}

/**
 * Obtiene o crea la hoja de trabajo con la cabecera completa de auditoría.
 */
function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(getHeaders());
    sheet.getRange(1, 1, 1, getHeaders().length).setFontWeight('bold');
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(getHeaders());
    sheet.getRange(1, 1, 1, getHeaders().length).setFontWeight('bold');
  }

  return sheet;
}

/**
 * Estructura de cabeceras compatible con la aplicación PWA y trazabilidad multiusuario.
 */
function getHeaders() {
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
 * Formatea la respuesta HTTP en estructura JSON con soporte de CORS.
 */
function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
