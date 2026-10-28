import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

export default function ProtectedRoute() {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== 'PARENT' || user?.scope !== 'COLLEGE') {
    return (
      <div className="portal-container" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
        <div className="card" style={{ maxWidth: '480px', margin: '0 auto', padding: '2rem' }}>
          <h2 style={{ color: 'var(--color-danger, #ef4444)' }}>Unauthorized Access</h2>
          <p style={{ margin: '1rem 0' }}>
            This application is strictly restricted to authenticated Parent or Guardian accounts.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => {
              window.location.href = '/login';
            }}
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
