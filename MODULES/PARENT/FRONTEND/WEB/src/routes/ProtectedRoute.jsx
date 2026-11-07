import React, { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import authService from '../services/authService';
import { UnauthorizedState, LoadingState } from '../components/PageStates';

export default function ProtectedRoute() {
  const { isAuthenticated, user, logout } = useAuth();
  const expired = isAuthenticated && typeof authService?.isSessionExpired === 'function' && authService.isSessionExpired(user);

  useEffect(() => {
    if (expired) logout();
  }, [expired, logout]);

  if (!isAuthenticated || expired) {
    const portalUrl =
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PORTAL_URL) ||
      (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://localhost:5173'
        : '');
    window.location.replace(`${portalUrl}/parent/login`);
    return (
      <main className="access-boundary">
        <LoadingState title="Redirecting..." message="Redirecting to Unified Portal login..." />
      </main>
    );
  }

  if (user?.role !== 'PARENT' || user?.scope !== 'COLLEGE') {
    return (
      <UnauthorizedState
        title="Unauthorized access"
        message="This portal is restricted to authenticated Parent accounts in college scope."
        action={
          <button type="button" className="button button-primary" onClick={logout}>
            Return to login
          </button>
        }
      />
    );
  }

  return <Outlet />;
}
