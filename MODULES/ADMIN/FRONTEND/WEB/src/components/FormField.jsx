import React from 'react';

/**
 * Standardized Form Field wrapper with label, required asterisk, helper text, and validation error.
 */
export default function FormField({
  label,
  htmlFor,
  required = false,
  error,
  helperText,
  children,
  className = '',
  style = {},
}) {
  return (
    <div
      className={`form-field-wrapper ${className}`}
      style={{
        marginBottom: '16px',
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
    >
      {label && (
        <label
          htmlFor={htmlFor}
          style={{
            fontSize: '0.82rem',
            fontWeight: 600,
            color: 'var(--text-primary, #0f172a)',
            marginBottom: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span>{label}</span>
          {required && (
            <span style={{ color: '#ef4444', fontWeight: 'bold' }}>*</span>
          )}
        </label>
      )}

      {children}

      {error ? (
        <span
          style={{
            fontSize: '0.75rem',
            color: '#dc2626',
            marginTop: '4px',
            fontWeight: 500,
          }}
          role="alert"
        >
          {error}
        </span>
      ) : helperText ? (
        <span
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-muted, #94a3b8)',
            marginTop: '4px',
          }}
        >
          {helperText}
        </span>
      ) : null}
    </div>
  );
}

