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
            className="btn-enterprise btn-outline-soft btn-sm"
            onClick={onReset}
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

