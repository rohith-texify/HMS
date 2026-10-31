import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../shared/auth/useAuth';
import { ROLE_ROUTE_MAP } from '../shared/auth/portalAuthService';

export default function NotFoundPage() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleReturn = () => {
    if (isAuthenticated && user?.role && ROLE_ROUTE_MAP[user.role]) {
      navigate(ROLE_ROUTE_MAP[user.role].path, { replace: true });
    } else {
      navigate('/login', { replace: true });
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0f172a',
        padding: '24px',
      }}
    >
      <div
        style={{
          maxWidth: '480px',
          width: '100%',
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '12px',
          padding: '36px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔍</div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
          404 — Page Not Found
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '24px' }}>
          The requested page or resource could not be found on this institutional domain.
        </p>
        <button
          onClick={handleReturn}
          style={{
            padding: '10px 20px',
            backgroundColor: '#0284c7',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Return to Dashboard →
        </button>
      </div>
    </div>
  );
}

