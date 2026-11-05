import React, { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import authService from '../services/authService';
import { UnauthorizedState } from '../components/PageStates';

export default function ProtectedRoute() {
  const { isAuthenticated, user, logout } = useAuth();
  const expired = isAuthenticated && authService.isSessionExpired(user);

  useEffect(() => {
    if (expired) logout();
  }, [expired, logout]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (expired) {
    return <Navigate to="/login" replace />;
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
