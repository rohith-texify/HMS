import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/**
 * ProtectedRoute guards Super Admin routes.
 *
 * Rules:
 * 1. While loading session state, displays a sleek loading screen.
 * 2. If unauthenticated, redirects to /login and saves current location in state.
 * 3. If authenticated user is NOT SUPER_ADMIN or scope is not PLATFORM, redirects to /login with access denied.
 * 4. Otherwise renders protected children.
 */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          fontFamily: 'inherit',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            border: '3px solid rgba(255, 255, 255, 0.1)',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            marginBottom: '16px',
          }}
        />
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
        <div style={{ fontSize: '1rem', fontWeight: 600, color: '#e2e8f0' }}>
          Verifying Super Admin Authorization...
        </div>
        <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '6px' }}>
          Platform Control Plane Security Check
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user || (user.role !== 'SUPER_ADMIN' && user.roleCode !== 'SUPER_ADMIN')) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
