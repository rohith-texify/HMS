import React from 'react';

export default function Badge({ children, variant = 'info', dot = false, className = '', style = {} }) {
  const getBadgeColors = () => {
    switch (variant) {
      case 'success':
      case 'green':
        return {
          background: '#ecfdf5',
          color: '#065f46',
          border: '1px solid #a7f3d0',
        };
      case 'warning':
      case 'amber':
        return {
          background: '#fffbeb',
          color: '#92400e',
          border: '1px solid #fde68a',
        };
      case 'danger':
      case 'rose':
      case 'error':
        return {
          background: '#fef2f2',
          color: '#991b1b',
          border: '1px solid #fecaca',
        };
      case 'purple':
        return {
          background: '#faf5ff',
          color: '#6b21a8',
          border: '1px solid #e9d5ff',
        };
      case 'indigo':
        return {
          background: '#eef2ff',
          color: '#4338ca',
          border: '1px solid #c7d2fe',
        };
      case 'muted':
      case 'gray':
      case 'neutral':
        return {
          background: '#f1f5f9',
          color: '#475569',
          border: '1px solid #e2e8f0',
        };
      case 'info':
      case 'blue':
      default:
        return {
          background: '#eff6ff',
          color: '#1e40af',
          border: '1px solid #bfdbfe',
        };
    }
  };

  return (
    <span
      className={`badge-enterprise ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '3px 8px',
        borderRadius: '6px',
        fontSize: '0.74rem',
        fontWeight: 600,
        lineHeight: 1.25,
        ...getBadgeColors(),
        ...style,
      }}
    >
      {dot && (
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: 'currentColor',
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
}
