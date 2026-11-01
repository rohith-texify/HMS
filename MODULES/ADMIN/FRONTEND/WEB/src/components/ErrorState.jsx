import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

/**
 * Enterprise Error State component with retry action and clean diagnostics.
 */
export default function ErrorState({
  title = 'Failed to load data',
  message = 'An unexpected error occurred while communicating with the college service.',
  onRetry,
  className = '',
  style = {},
}) {
  return (
    <div
      className={`error-state-card ${className}`}
      style={{
        padding: '32px 24px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--danger-bg, #fef2f2)',
        borderRadius: '10px',
        border: '1px solid var(--danger-border, #fecaca)',
        margin: '16px 0',
        ...style,
      }}
    >
      <div
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          backgroundColor: '#fee2e2',
          color: 'var(--danger-text, #991b1b)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '12px',
        }}
      >
        <AlertCircle size={22} />
      </div>
      <h3
        style={{
          fontSize: '0.96rem',
          fontWeight: 600,
          color: 'var(--danger-text, #991b1b)',
          marginBottom: '4px',
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: '0.84rem',
          color: '#7f1d1d',
          maxWidth: '420px',
          lineHeight: 1.4,
          marginBottom: onRetry ? '14px' : '0',
        }}
      >
        {message}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#ffffff',
            border: '1px solid var(--danger-border, #fecaca)',
            color: 'var(--danger-text, #991b1b)',
            padding: '6px 14px',
            borderRadius: '6px',
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <RotateCcw size={13} />
          <span>Retry Operation</span>
        </button>
      )}
    </div>
  );
}

