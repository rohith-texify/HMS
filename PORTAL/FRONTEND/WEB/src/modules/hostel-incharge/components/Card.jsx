import React from 'react';

export default function Card({ children, title, subtitle, action, className = '', style = {} }) {
  return (
    <div
      className={`card enterprise-card ${className}`}
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid var(--border-color, #e2e8f0)',
        borderRadius: '12px',
        padding: '20px 24px',
        marginBottom: '20px',
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
        ...style,
      }}
    >
      {(title || action) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '16px',
            borderBottom: '1px solid #f1f5f9',
            paddingBottom: '12px',
          }}
        >
          <div>
            {title && (
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>
                {title}
              </h3>
            )}
            {subtitle && (
              <p style={{ margin: '3px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                {subtitle}
              </p>
            )}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
