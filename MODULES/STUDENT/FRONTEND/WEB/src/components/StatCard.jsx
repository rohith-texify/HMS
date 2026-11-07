import React from 'react';

export default function StatCard({ label, value, subtext, icon: Icon, color = '#2563eb', trend }) {
  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '14px',
        border: '1px solid #e2e8f0',
        padding: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
      }}
    >
      {Icon && (
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            backgroundColor: `${color}18`,
            color: color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={24} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </div>
        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: '4px 0 2px 0' }}>
          {value}
        </div>
        {(subtext || trend) && (
          <div style={{ fontSize: '0.78rem', color: trend ? (trend > 0 ? '#16a34a' : '#dc2626') : '#64748b' }}>
            {subtext}
          </div>
        )}
      </div>
    </div>
  );
}

