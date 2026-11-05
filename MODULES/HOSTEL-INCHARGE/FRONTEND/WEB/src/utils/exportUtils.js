/**
 * Client-Side CSV & Print Export Utility
 * Conforms to RFC 4180 standards with UTF-8 BOM for Microsoft Excel compatibility.
 */

/**
 * Escapes a cell value for CSV formatting according to RFC 4180.
 * @param {*} val 
 * @returns {string}
 */
function escapeCSVValue(val) {
  if (val === null || val === undefined) return '""';
  let str = typeof val === 'object' ? JSON.stringify(val) : String(val).trim();
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    str = '"' + str.replace(/"/g, '""') + '"';
  } else {
    str = '"' + str + '"';
  }
  return str;
}

/**
 * Exports data rows to a downloadable CSV file.
 * @param {Array<Object>} data Data rows
 * @param {string} filename Output file name
 * @param {Array<{key: string, label: string}>} columns Optional column definitions
 * @returns {boolean} Success status
 */
export function exportToCSV(data = [], filename = 'export.csv', columns = []) {
  if (!data || !data.length) {
    console.warn('exportToCSV: No data provided for export.');
    return false;
  }

  // Derive columns if not provided
  const headerKeys = columns.length
    ? columns
    : Object.keys(data[0]).map((key) => ({ key, label: key.toUpperCase().replace(/_/g, ' ') }));

  const headers = headerKeys.map((c) => escapeCSVValue(c.label || c.key)).join(',');

  const rows = data.map((item) => {
    return headerKeys
      .map((col) => {
        let val = item[col.key];
        if (typeof col.format === 'function') {
          val = col.format(val, item);
        }
        return escapeCSVValue(val);
      })
      .join(',');
  });

  // RFC 4180 CSV with UTF-8 BOM (\uFEFF) for Microsoft Excel compatibility
  const csvContent = '\uFEFF' + [headers, ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;

  link.setAttribute('href', url);
  link.setAttribute('download', safeFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return true;
}

/**
 * Triggers browser print dialog for printable institutional reporting.
 * @param {string} reportTitle Report header title
 */
export function triggerPrintReport(reportTitle = 'Hostel Operational Report') {
  const originalTitle = document.title;
  document.title = `${reportTitle} - ${new Date().toLocaleDateString()}`;
  window.print();
  document.title = originalTitle;
}

export default { exportToCSV, triggerPrintReport };
