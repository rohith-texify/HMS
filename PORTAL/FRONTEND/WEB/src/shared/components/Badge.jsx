import React from 'react';

export default function Badge({ children, variant = 'info', style = {} }) {
  const getBadgeColors = () => {
    switch (variant) {
      case 'success':
        return {
          background: 'rgba(16, 185, 129, 0.15)',
          color: '#34d399',
          border: '1px solid #10b981',
        };
      case 'warning':
        return {
          background: 'rgba(245, 158, 11, 0.15)',
          color: '#fbbf24',
          border: '1px solid #f59e0b',
        };
      case 'danger':
        return {
          background: 'rgba(239, 68, 68, 0.15)',
          color: '#f87171',
          border: '1px solid #ef4444',
        };
      case 'info':
      default:
        return {
          background: 'rgba(56, 189, 248, 0.15)',
          color: '#7dd3fc',
          border: '1px solid #38bdf8',
        };
    }
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: 600,
        ...getBadgeColors(),
        ...style,
      }}
    >
      {children}
    </span>
  );
}
