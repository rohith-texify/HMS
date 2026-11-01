import React from 'react';

export default function LoadingSpinner({ message = 'Loading...', size = 'md' }) {
  const dim = size === 'sm' ? 20 : size === 'lg' ? 40 : 28;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        color: '#94a3b8',
        gap: '12px',
      }}
    >
      <div
        style={{
          width: `${dim}px`,
          height: `${dim}px`,
          border: '3px solid #334155',
          borderTopColor: '#38bdf8',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      {message && <div style={{ fontSize: '0.875rem' }}>{message}</div>}
    </div>
  );
}

