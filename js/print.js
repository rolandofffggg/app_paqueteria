class PrintManager {
  printLabel(pkg) {
    const printWindow = window.open('', '_blank', 'width=400,height=400');
    
    // Generar código QR en SVG/HTML
    const qr = qrcode(4, 'L');
    qr.addData(pkg.qrCode);
    qr.make();
    const qrImg = qr.createImgTag(4);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Etiqueta ${pkg.code}</title>
        <style>
          @page { size: 58mm 58mm; margin: 0; }
          body {
            font-family: monospace, sans-serif;
            text-align: center;
            padding: 8px;
            margin: 0;
          }
          .card {
            border: 2px dashed #000;
            padding: 8px;
            border-radius: 6px;
          }
          .code { font-size: 22px; font-weight: bold; margin-bottom: 4px; }
          .client { font-size: 14px; margin-bottom: 6px; word-break: break-all; }
          .info { font-size: 11px; margin-top: 4px; }
          img { max-width: 140px; height: auto; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="code">#${pkg.code}</div>
          <div class="client">${pkg.client}</div>
          <div>${qrImg}</div>
          <div class="info">UBICACIÓN: <strong>${pkg.location}</strong></div>
          <div class="info">CAT: ${pkg.category}</div>
        </div>
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  }
}

const printer = new PrintManager();
