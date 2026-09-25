class ReportManager {
  // Exportar paquetes a un archivo CSV estructurado
  exportToCSV(packages, filename = 'reporte_paquetes.csv') {
    if (!packages || packages.length === 0) {
      alert('No hay datos para exportar.');
      return;
    }

    const headers = [
      'Código', 'Cliente', 'Categoría', 'Ubicación', 
      'Estado', 'Fecha Recepción', 'Persona Retira', 'Fecha Entrega', 'Importe Cobrado (Bs)'
    ];

    const rows = packages.map(p => [
      `"${p.code || ''}"`,
      `"${(p.client || '').replace(/"/g, '""')}"`,
      `"${p.category || ''}"`,
      `"${p.location || ''}"`,
      `"${p.status || ''}"`,
      `"${p.createdAt ? new Date(p.createdAt).toLocaleString() : ''}"`,
      `"${(p.deliveredTo || '').replace(/"/g, '""')}"`,
      `"${p.deliveredAt ? new Date(p.deliveredAt).toLocaleString() : ''}"`,
      (p.amountCharged || 0).toFixed(2)
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

const reports = new ReportManager();
