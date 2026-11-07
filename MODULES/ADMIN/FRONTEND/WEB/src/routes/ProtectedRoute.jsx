import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getAuthorizedRedirectPath, normalizeRoleCode, PORTAL_URL } from '../hooks/portalAuthService';

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
    const portalUrl =
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PORTAL_URL) ||
      PORTAL_URL ||
      (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://localhost:5173'
        : '');
    window.location.replace(`${portalUrl}/admin/login`);
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p className="text-sm text-slate-500">Redirecting to Unified Portal login...</p>
      </div>
    );
  }

  // 2. Scope check: enforce COLLEGE scope
  const userScope = (user.scope || 'COLLEGE').toUpperCase();
  if (requiredScope && userScope !== requiredScope.toUpperCase()) {
    return <Navigate to="/unauthorized" replace />;
  }

  // 3. Role check
  const userRole = normalizeRoleCode(user.role || user.roleName || '');
  const normalizedAllowed = allowedRoles.map((r) => normalizeRoleCode(r));
  if (allowedRoles.length > 0 && !normalizedAllowed.includes(userRole)) {
    const authorizedDashboard = getAuthorizedRedirectPath(userRole, null);
    if (PORTAL_URL && ['HOSTEL_INCHARGE', 'SECURITY', 'STUDENT', 'PARENT'].includes(userRole)) {
      window.location.replace(`${PORTAL_URL}${authorizedDashboard}`);
      return null;
    }
    if (authorizedDashboard && authorizedDashboard !== '/login' && authorizedDashboard !== location.pathname) {
      return <Navigate to={authorizedDashboard} replace />;
    }
    return <Navigate to="/unauthorized" state={{ attemptedPath: location.pathname }} replace />;
  }

  return children;
}
