import React from 'react';
import LoadingSpinner from './LoadingSpinner';
import EmptyState from './EmptyState';

/**
 * Standardized Enterprise Data Table component.
 * Supports column definitions, row keys, loading state, empty state, and responsive overflow.
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

  return (
    <div className={`enterprise-table-container ${className}`}>
      <table className="enterprise-table">
        <thead>
          <tr>
            {columns.map((col, idx) => (
              <th
                key={col.key || idx}
                style={{
                  textAlign: col.align || 'left',
                  width: col.width || 'auto',
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIdx) => {
            const key = typeof rowKey === 'function' ? rowKey(row, rowIdx) : row[rowKey] || rowIdx;
            return (
              <tr key={key}>
                {columns.map((col, colIdx) => (
                  <td
                    key={col.key || colIdx}
                    style={{
                      textAlign: col.align || 'left',
                    }}
                  >
                    {col.render ? col.render(row, rowIdx) : row[col.key] ?? '—'}
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

