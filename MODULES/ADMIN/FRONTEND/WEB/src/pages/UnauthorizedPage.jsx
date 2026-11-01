import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../shared/auth/useAuth';
import { ROLE_ROUTE_MAP } from '../shared/auth/portalAuthService';

export default function UnauthorizedPage() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const userRole = (user?.role || '').toUpperCase();
  const authorizedPath = userRole && ROLE_ROUTE_MAP[userRole] ? ROLE_ROUTE_MAP[userRole].path : '/login';

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
          maxWidth: '520px',
          width: '100%',
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '12px',
          padding: '36px',
          textAlign: 'center',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)',
        }}
      >
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🚫</div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
          Access Restricted
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '24px' }}>
          Your current account role (<strong>{user?.roleName || user?.role || 'Guest'}</strong>) is not authorized to access the requested module.
        </p>

        {location.state?.attemptedPath && (
          <div
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '0.85rem',
              color: '#fca5a5',
              marginBottom: '24px',
              fontFamily: 'monospace',
            }}
          >
            Attempted route: {location.state.attemptedPath}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={() => navigate(authorizedPath, { replace: true })}
            style={{
              padding: '12px 20px',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.95rem',
              cursor: 'pointer',
            }}
          >
            Return to Your Authorized Dashboard →
          </button>

          <button
            onClick={logout}
            style={{
              padding: '10px 20px',
              backgroundColor: 'transparent',
              color: '#cbd5e1',
              border: '1px solid #475569',
              borderRadius: '8px',
              fontWeight: 500,
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            Sign Out & Switch Account
          </button>
        </div>
      </div>
    </div>
  );
}

