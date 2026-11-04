/**
 * Client-Side CSV Export Utility
 */
export function exportToCSV(data = [], filename = 'export.csv', columns = []) {
  if (!data || !data.length) {
    console.warn('exportToCSV: No data provided for export.');
    return;
  }

  // Derive columns if not provided
  const headerKeys = columns.length
    ? columns
    : Object.keys(data[0]).map((key) => ({ key, label: key.toUpperCase().replace(/_/g, ' ') }));

  const headers = headerKeys.map((c) => `"${(c.label || c.key).replace(/"/g, '""')}"`).join(',');

  const rows = data.map((item) => {
    return headerKeys
      .map((col) => {
        let val = item[col.key];
        if (val === undefined || val === null) val = '';
        if (typeof val === 'object') val = JSON.stringify(val);
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      })
      .join(',');
  });

  const csvContent = [headers, ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default { exportToCSV };

