import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getAuthorizedRedirectPath } from '../hooks/portalAuthService';

/**
 * ProtectedRoute for College Admin module.
 * Enforces valid authentication, COLLEGE scope, and allowed administrative roles.
 */
export default function ProtectedRoute({
  children,
  allowedRoles = ['COLLEGE_ADMIN', 'HOSTEL_ADMIN', 'ADMIN'],
  requiredScope = 'COLLEGE',
}) {
  const { user, token, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
          <p className="text-sm text-slate-500">Verifying administrative access...</p>
        </div>
      </div>
    );
  }

  // 1. Authentication check
  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. Scope check: enforce COLLEGE scope
  const userScope = (user.scope || 'COLLEGE').toUpperCase();
  if (requiredScope && userScope !== requiredScope.toUpperCase()) {
    return <Navigate to="/unauthorized" replace />;
  }

  // 3. Role check
  const userRole = (user.role || '').toUpperCase();
  const normalizedAllowed = allowedRoles.map((r) => r.toUpperCase());
  if (allowedRoles.length > 0 && !normalizedAllowed.includes(userRole)) {
    const authorizedDashboard = getAuthorizedRedirectPath(userRole, null);
    if (authorizedDashboard && authorizedDashboard !== '/login' && authorizedDashboard !== location.pathname) {
      return <Navigate to={authorizedDashboard} replace />;
    }
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
