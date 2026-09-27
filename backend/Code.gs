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
        
        if (op.type === 'DELETE') {
          if (foundRow > -1) {
            sheet.deleteRow(foundRow);
          }
        } else if (foundRow > -1) {
          // UPDATE / DELIVERY
          sheet.getRange(foundRow, 4).setValue(p.client);
          sheet.getRange(foundRow, 5).setValue(p.phone || '');
          sheet.getRange(foundRow, 6).setValue(p.recipientPhone || '');
          sheet.getRange(foundRow, 7).setValue(p.category || '');
          sheet.getRange(foundRow, 8).setValue(p.size || '');
          sheet.getRange(foundRow, 9).setValue(p.color || '');
          sheet.getRange(foundRow, 10).setValue(p.location);
          sheet.getRange(foundRow, 11).setValue(p.status);
          sheet.getRange(foundRow, 12).setValue(p.deliveredTo || '');
          sheet.getRange(foundRow, 14).setValue(p.deliveredAt || '');
          sheet.getRange(foundRow, 15).setValue(p.amountCharged || 0);
        } else {
          // CREATE
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
