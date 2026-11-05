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
      className={`form-group form-field-wrapper ${className}`}
      style={style}
    >
      {label && (
        <label
          htmlFor={htmlFor}
          className="form-label"
        >
          <span>{label}</span>
          {required && (
            <span className="required" style={{ color: '#dc2626', fontWeight: 'bold' }}>*</span>
          )}
        </label>
      )}

      {children}

      {error ? (
        <span
          className="form-hint"
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
          className="form-hint"
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

