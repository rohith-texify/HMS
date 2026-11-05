import React from 'react';
import { Search, X } from 'lucide-react';

/**
 * Standardized Search Input with clear button and Lucide search icon.
 */
export default function SearchInput({
  value,
  onChange,
  onClear,
  placeholder = 'Search records...',
  className = '',
  width = 280,
  id = 'search-input',
}) {
  return (
    <div className={`filter-search-field ${className}`} style={{ width: typeof width === 'number' ? `${width}px` : width }}>
      <Search size={15} className="filter-search-icon" />
      <input
        id={id}
        type="text"
        className="filter-search-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            if (onClear) onClear();
            else onChange('');
          }}
          style={{
            position: 'absolute',
            right: '8px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px',
            color: 'var(--text-muted, #94a3b8)',
            display: 'flex',
            alignItems: 'center',
          }}
          title="Clear search"
          aria-label="Clear search"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

