import React from 'react';
import { Filter, RotateCcw } from 'lucide-react';

/**
 * Enterprise Filter Controls Bar with search, dropdown selectors, and reset action.
 */
export default function FilterControls({
  children,
  onReset,
  className = '',
  totalRecords,
}) {
  return (
    <div className={`enterprise-filter-bar ${className}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        {children}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {typeof totalRecords === 'number' && (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)' }}>
            Total: <strong>{totalRecords}</strong> records
          </span>
        )}
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid var(--border-color, #e2e8f0)',
              backgroundColor: '#ffffff',
              color: 'var(--text-secondary, #475569)',
              fontSize: '0.78rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
            title="Reset filters"
          >
            <RotateCcw size={12} />
            <span>Reset</span>
          </button>
        )}
      </div>
    </div>
  );
}

