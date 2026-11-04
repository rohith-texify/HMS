import React from 'react';
import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import PortalState from '../components/PortalState';

export default function ProtectedRoute() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== 'PARENT' || user?.scope !== 'COLLEGE') {
    return (
      <main className="access-boundary">
        <PortalState
          variant="unauthorized"
          title="Unauthorized access"
          message="This portal is restricted to authenticated Parent accounts in college scope."
          action={
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                logout();
                navigate('/login', { replace: true });
              }}
            >
              Return to Login
            </button>
          }
        />
      </main>
    );
  }

  return <Outlet />;
}
