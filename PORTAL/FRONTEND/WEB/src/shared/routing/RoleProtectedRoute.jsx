import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import LoadingSpinner from '../components/LoadingSpinner';

export default function RoleProtectedRoute({ children, allowedRoles = [] }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner message="Verifying institutional credentials..." size="lg" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const userRole = (user.role || '').toUpperCase();
  const normalizedAllowed = allowedRoles.map((r) => r.toUpperCase());

  if (normalizedAllowed.length > 0 && !normalizedAllowed.includes(userRole)) {
    return (
      <Navigate
        to="/unauthorized"
        state={{
          attemptedPath: location.pathname,
          requiredRoles: allowedRoles,
          actualRole: user.roleName || user.role,
        }}
        replace
      />
    );
  }

  return children;
}

