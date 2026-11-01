/**
 * Utility functions for client-side report exports (CSV, Excel-compatible, and Print).
 * Conforms to RFC 4180 standards with UTF-8 BOM for seamless Microsoft Excel compatibility.
 */

/**
 * Escapes a cell value for CSV formatting according to RFC 4180.
 * @param {*} val 
 * @returns {string}
 */
function escapeCSVValue(val) {
  if (val === null || val === undefined) return '""';
  let str = String(val).trim();
  // If value contains comma, quotes, or newlines, quote it and escape internal quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    str = '"' + str.replace(/"/g, '""') + '"';
  } else {
    str = '"' + str + '"';
  }
  return str;
}

/**
 * Exports data rows to a downloadable CSV file.
 * @param {string} filename Base filename (without extension)
 * @param {Array<{key: string, title: string}>} columns Column definitions
 * @param {Array<Object>} rows Data rows
 */
export function exportToCSV(filename, columns, rows) {
  if (!columns || columns.length === 0 || !rows) {
    console.warn('exportToCSV: Missing columns or rows');
    return false;
  }

  // 1. Build Header Line
  const headerLine = columns.map(c => escapeCSVValue(c.title || c.key)).join(',');

  // 2. Build Data Lines
  const dataLines = rows.map(row => {
    return columns.map(col => {
      let val = row[col.key];
      if (typeof col.format === 'function') {
        val = col.format(val, row);
      }
      return escapeCSVValue(val);
    }).join(',');
  });

  // 3. Assemble CSV with UTF-8 BOM (\uFEFF) so Excel correctly handles UTF-8 chars
  const csvContent = '\uFEFF' + [headerLine, ...dataLines].join('\r\n');

  // 4. Create Blob & Trigger Download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  const fullFilename = `${filename.replace(/[^a-zA-Z0-9_-]/g, '_')}_${dateStr}.csv`;

  link.setAttribute('href', url);
  link.setAttribute('download', fullFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return true;
}

/**
 * Triggers a formatted print view for the report.
 * @param {string} reportTitle 
 */
export function triggerPrintReport(reportTitle = 'Institutional Report') {
  const originalTitle = document.title;
  document.title = `${reportTitle} - ${new Date().toLocaleDateString()}`;
  window.print();
  document.title = originalTitle;
}
