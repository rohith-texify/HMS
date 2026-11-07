import React from 'react';

export default function Badge({ children, variant = 'info', style = {} }) {
  const getBadgeColors = () => {
    switch (variant) {
      case 'success':
      case 'APPROVED':
      case 'ACTIVE':
      case 'RESOLVED':
      case 'PRESENT':
        return {
          background: 'rgba(16, 185, 129, 0.12)',
          color: '#059669',
          border: '1px solid rgba(16, 185, 129, 0.3)',
        };
      case 'warning':
      case 'PENDING':
      case 'REQUESTED':
      case 'IN_PROGRESS':
      case 'ASSIGNED':
      case 'ON_LEAVE':
        return {
          background: 'rgba(245, 158, 11, 0.12)',
          color: '#d97706',
          border: '1px solid rgba(245, 158, 11, 0.3)',
        };
      case 'danger':
      case 'REJECTED':
      case 'ABSENT':
      case 'EXPIRED':
      case 'CANCELLED':
      case 'HIGH':
      case 'URGENT':
        return {
          background: 'rgba(239, 68, 68, 0.12)',
          color: '#dc2626',
          border: '1px solid rgba(239, 68, 68, 0.3)',
        };
      case 'info':
      case 'REGULAR':
      case 'DAY':
      case 'OVERNIGHT':
      default:
        return {
          background: 'rgba(37, 99, 235, 0.12)',
          color: '#2563eb',
          border: '1px solid rgba(37, 99, 235, 0.3)',
        };
    }
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 9px',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: 600,
        letterSpacing: '0.02em',
        ...getBadgeColors(),
        ...style,
      }}
    >
      {children}
    </span>
  );
}

