// Manejo de lectura (GET): Descargar datos de Google Sheets
function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('PACKAGES');
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return ContentService.createTextOutput(JSON.stringify({ success: true, packages: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var packages = [];
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      packages.push({
        packageId: String(row[0]),
        code: String(row[1]),
        qrCode: String(row[2]),
        client: String(row[3]),
        category: String(row[4]),
        location: String(row[5]),
        status: String(row[6]),
        deliveredTo: String(row[7] || ''),
        createdAt: String(row[8] || ''),
        deliveredAt: String(row[9] || '')
      });
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: true, packages: packages }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Manejo de escritura (POST): Sincronizar en lote (Mantiene lo de Fase 1)
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
    if (data.action === 'syncBatch') {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = ss.getSheetByName('PACKAGES') || ss.insertSheet('PACKAGES');
      
      if (sheet.getLastRow() === 0) {
        sheet.appendRow([
          'packageId', 'code', 'qrCode', 'client', 'category', 
          'location', 'status', 'deliveredTo', 'createdAt', 'deliveredAt'
        ]);
      }
      
      var operations = data.operations;
      var existingData = sheet.getDataRange().getValues();
      
      operations.forEach(function(op) {
        var p = op.payload;
        var foundRow = -1;
        
        for (var i = 1; i < existingData.length; i++) {
          if (String(existingData[i][0]) === String(p.packageId)) {
            foundRow = i + 1;
            break;
          }
        }
        
        if (foundRow > -1) {
          sheet.getRange(foundRow, 6).setValue(p.location);
          sheet.getRange(foundRow, 7).setValue(p.status);
          sheet.getRange(foundRow, 8).setValue(p.deliveredTo || '');
          sheet.getRange(foundRow, 10).setValue(p.deliveredAt || '');
        } else {
          sheet.appendRow([
            p.packageId, p.code, p.qrCode, p.client, p.category,
            p.location, p.status, p.deliveredTo || '', p.createdAt, p.deliveredAt || ''
          ]);
        }
      });
      
      return ContentService.createTextOutput(JSON.stringify({ success: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
