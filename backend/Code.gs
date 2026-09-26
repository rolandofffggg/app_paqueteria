// Lectura de datos (GET)
function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('PACKAGES');
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return ContentService.createTextOutput(JSON.stringify({ success: true, packages: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var data = sheet.getDataRange().getValues();
    var packages = [];
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      packages.push({
        packageId: String(row[0]),
        code: String(row[1]),
        qrCode: String(row[2]),
        client: String(row[3]),
        phone: String(row[4] || ''),
        recipientPhone: String(row[5] || ''),
        category: String(row[6] || ''),
        size: String(row[7] || ''),
        color: String(row[8] || ''),
        location: String(row[9] || ''),
        status: String(row[10] || ''),
        deliveredTo: String(row[11] || ''),
        createdAt: String(row[12] || ''),
        deliveredAt: String(row[13] || ''),
        amountCharged: Number(row[14] || 0)
      });
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: true, packages: packages }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Escritura/Sincronización en Lote (POST)
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
    if (data.action === 'syncBatch') {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = ss.getSheetByName('PACKAGES') || ss.insertSheet('PACKAGES');
      
      if (sheet.getLastRow() === 0) {
        sheet.appendRow([
          'packageId', 'code', 'qrCode', 'client', 'phone', 'recipientPhone',
          'category', 'size', 'color', 'location', 'status', 
          'deliveredTo', 'createdAt', 'deliveredAt', 'amountCharged'
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
          sheet.getRange(foundRow, 10).setValue(p.location);
          sheet.getRange(foundRow, 11).setValue(p.status);
          sheet.getRange(foundRow, 12).setValue(p.deliveredTo || '');
          sheet.getRange(foundRow, 14).setValue(p.deliveredAt || '');
          sheet.getRange(foundRow, 15).setValue(p.amountCharged || 0);
        } else {
          sheet.appendRow([
            p.packageId, p.code, p.qrCode, p.client, p.phone || '', p.recipientPhone || '',
            p.category || '', p.size || '', p.color || '', p.location, p.status,
            p.deliveredTo || '', p.createdAt, p.deliveredAt || '', p.amountCharged || 0
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
