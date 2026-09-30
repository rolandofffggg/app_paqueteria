function doPost(e) {
  try {
    const contents = JSON.parse(e.postData.contents);
    const action = contents.action;
    const payload = contents.payload;

    if (action === 'SYNC_ITEM') {
      if (payload.type === 'USER_SAVE') {
        saveUserToSheet(payload.payload);
      } else {
        savePackageToSheet(payload.payload);
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'SUCCESS' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'ERROR', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Lectura de Paquetes
  const pkgSheet = ss.getSheetByName('Packages') || ss.insertSheet('Packages');
  const pkgData = pkgSheet.getDataRange().getValues();
  const packages = [];
  if (pkgData.length > 1) {
    const headers = pkgData[0];
    for (let i = 1; i < pkgData.length; i++) {
      let row = pkgData[i];
      let obj = {};
      headers.forEach((h, idx) => obj[h] = row[idx]);
      packages.push(obj);
    }
  }

  // Lectura de Usuarios
  const usrSheet = ss.getSheetByName('Users') || ss.insertSheet('Users');
  const usrData = usrSheet.getDataRange().getValues();
  const users = [];
  if (usrData.length > 1) {
    const headers = usrData[0];
    for (let i = 1; i < usrData.length; i++) {
      let row = usrData[i];
      let obj = {};
      headers.forEach((h, idx) => obj[h] = row[idx]);
      users.push(obj);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ packages, users }))
    .setMimeType(ContentService.MimeType.JSON);
}

function savePackageToSheet(pkg) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Packages');
  if (!sheet) {
    sheet = ss.insertSheet('Packages');
    sheet.appendRow([
      'packageId', 'code', 'qrCode', 'client', 'phone', 'recipientPhone',
      'category', 'size', 'color', 'location', 'status', 'createdAt',
      'createdBy', 'updatedAt', 'updatedBy', 'deliveredAt', 'deliveredBy', 'deliveredTo', 'amountCharged'
    ]);
  }

  const data = sheet.getDataRange().getValues();
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === pkg.packageId) {
      rowIndex = i + 1;
      break;
    }
  }

  const rowValues = [
    pkg.packageId, pkg.code, pkg.qrCode, pkg.client, pkg.phone, pkg.recipientPhone,
    pkg.category, pkg.size, pkg.color, pkg.location, pkg.status, pkg.createdAt,
    pkg.createdBy || '', pkg.updatedAt || '', pkg.updatedBy || '', pkg.deliveredAt || '', pkg.deliveredBy || '', pkg.deliveredTo || '', pkg.amountCharged || 0
  ];

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
}

function saveUserToSheet(usr) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Users');
  if (!sheet) {
    sheet = ss.insertSheet('Users');
    sheet.appendRow(['username', 'fullName', 'pin', 'role', 'status', 'createdAt', 'updatedAt']);
  }

  const data = sheet.getDataRange().getValues();
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === usr.username) {
      rowIndex = i + 1;
      break;
    }
  }

  const rowValues = [usr.username, usr.fullName, usr.pin, usr.role, usr.status, usr.createdAt, usr.updatedAt || ''];

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
}
