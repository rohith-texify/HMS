import React from 'react';
import { Inbox } from 'lucide-react';

/**
 * Enterprise Empty State component for data lists, tables, and search results.
 */
export default function EmptyState({
  icon: Icon = Inbox,
  title = 'No records found',
  description = 'There is currently no data available for this view.',
  actionText,
  onAction,
  className = '',
  style = {},
}) {
  return (
    <div
      className={`empty-state-card ${className}`}
      style={{
        padding: '48px 24px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-surface, #ffffff)',
        borderRadius: '10px',
        border: '1px dashed var(--border-color, #e2e8f0)',
        margin: '16px 0',
        ...style,
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          backgroundColor: 'var(--primary-light, #eff6ff)',
          color: 'var(--primary-color, #2563eb)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '14px',
        }}
      >
        <Icon size={24} />
      </div>
      <h3
        style={{
          fontSize: '1rem',
          fontWeight: 600,
          color: 'var(--text-primary, #0f172a)',
          marginBottom: '6px',
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: '0.85rem',
          color: 'var(--text-secondary, #475569)',
          maxWidth: '380px',
          lineHeight: 1.5,
          marginBottom: onAction ? '16px' : '0',
        }}
      >
        {description}
      </p>
      {onAction && actionText && (
        <button
          type="button"
          onClick={onAction}
          className="btn-enterprise-primary"
          style={{
            fontSize: '0.82rem',
            padding: '7px 14px',
          }}
        >
          {actionText}
        </button>
      )}
    </div>
  );
}

