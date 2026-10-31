import React from 'react';

export default function Alert({ children, type = 'info', style = {} }) {
  const getAlertStyles = () => {
    switch (type) {
      case 'danger':
      case 'error':
        return {
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid #ef4444',
          color: '#fca5a5',
        };
      case 'warning':
        return {
          background: 'rgba(245, 158, 11, 0.15)',
          border: '1px solid #f59e0b',
          color: '#fde68a',
        };
      case 'success':
        return {
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid #10b981',
          color: '#a7f3d0',
        };
      case 'info':
      default:
        return {
          background: 'rgba(56, 189, 248, 0.15)',
          border: '1px solid #38bdf8',
          color: '#bae6fd',
        };
    }
  };

  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: '8px',
        fontSize: '0.875rem',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        ...getAlertStyles(),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

