import React from 'react';
import LoadingSpinner from './LoadingSpinner';
import EmptyState from './EmptyState';

/**
 * Standardized Enterprise Data Table component for Hostel In-Charge module.
 * Fully compatible with column definitions having header/title, cell/render, accessor/key.
 * Guards defensively against React child object crashes.
 */
export default function DataTable({
  columns = [],
  data = [],
  rowKey = 'id',
  loading = false,
  emptyTitle = 'No data records found',
  emptyMessage = 'There are no records matching your current filter criteria.',
  className = '',
  footer,
}) {
  if (loading) {
    return (
      <div className="enterprise-table-container" style={{ padding: '40px 0' }}>
        <LoadingSpinner message="Retrieving data records..." size="md" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="enterprise-table-container" style={{ border: 'none', background: 'transparent' }}>
        <EmptyState title={emptyTitle} description={emptyMessage} />
      </div>
    );
  }

  const renderCellContent = (col, row, rowIdx) => {
    const field = col.accessor || col.key || col.dataIndex;
    const rawVal = field && row && typeof row === 'object' ? row[field] : undefined;

    let result = undefined;
    if (typeof col.cell === 'function') {
      result = col.cell(row, rowIdx);
    } else if (typeof col.render === 'function') {
      // If render expects (val, row) vs (row, index)
      if (col.render.length >= 2 && rawVal !== undefined) {
        result = col.render(rawVal, row, rowIdx);
      } else {
        result = col.render(row, rowIdx);
      }
    } else {
      result = rawVal;
    }

    // Safety guard against plain object rendering in React
    if (result === undefined || result === null) {
      return rawVal !== undefined && rawVal !== null ? String(rawVal) : '—';
    }

    if (typeof result === 'object' && !React.isValidElement(result) && !Array.isArray(result)) {
      if (rawVal !== undefined && typeof rawVal !== 'object') {
        return String(rawVal);
      }
      return '—';
    }

    return result;
  };

  return (
    <div className={`enterprise-table-container ${className}`}>
      <table className="enterprise-table">
        <thead>
          <tr>
            {columns.map((col, idx) => (
              <th
                key={col.key || col.accessor || idx}
                style={{
                  textAlign: col.align || 'left',
                  width: col.width || 'auto',
                }}
              >
                {col.header || col.title || col.label || ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIdx) => {
            const key = typeof rowKey === 'function' ? rowKey(row, rowIdx) : row?.[rowKey] || row?.id || rowIdx;
            return (
              <tr key={key}>
                {columns.map((col, colIdx) => (
                  <td
                    key={col.key || col.accessor || colIdx}
                    style={{
                      textAlign: col.align || 'left',
                    }}
                  >
                    {renderCellContent(col, row, rowIdx)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>

      {footer && (
        <div
          style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--border-color, #e2e8f0)',
            backgroundColor: '#f8fafc',
            fontSize: '0.8rem',
            color: 'var(--text-secondary, #475569)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}
