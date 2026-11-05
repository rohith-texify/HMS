import React from 'react';

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon: Icon,
  onClick,
  type = 'button',
  className = '',
  id,
  style = {},
  ...props
}) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: '#2563eb',
          color: '#ffffff',
          border: '1px solid #2563eb',
          boxShadow: '0 1px 2px rgba(37, 99, 235, 0.15)',
        };
      case 'outline':
        return {
          backgroundColor: '#ffffff',
          color: '#334155',
          border: '1px solid #cbd5e1',
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
        };
      case 'danger':
        return {
          backgroundColor: '#ffffff',
          color: '#dc2626',
          border: '1px solid #fecaca',
          boxShadow: '0 1px 2px rgba(220, 38, 38, 0.04)',
        };
      case 'secondary':
        return {
          backgroundColor: '#f1f5f9',
          color: '#334155',
          border: '1px solid #e2e8f0',
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          color: '#64748b',
          border: '1px solid transparent',
        };
      default:
        return {};
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return { padding: '5px 10px', fontSize: '0.8rem', borderRadius: '6px' };
      case 'lg':
        return { padding: '11px 22px', fontSize: '0.95rem', borderRadius: '10px' };
      default:
        return { padding: '8px 16px', fontSize: '0.85rem', borderRadius: '8px' };
    }
  };

  return (
    <button
      type={type}
      id={id}
      disabled={disabled || loading}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        fontWeight: 600,
        fontFamily: 'inherit',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'all 0.15s ease',
        userSelect: 'none',
        lineHeight: '1.25rem',
        ...getVariantStyles(),
        ...getSizeStyles(),
        ...style,
      }}
      className={`btn ${className}`}
      {...props}
    >
      {loading && (
        <span
          style={{
            display: 'inline-block',
            width: '14px',
            height: '14px',
            border: '2px solid currentColor',
            borderRightColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.75s linear infinite',
          }}
        />
      )}
      {!loading && Icon && <Icon size={size === 'sm' ? 14 : 16} />}
      {children}
    </button>
  );
}
