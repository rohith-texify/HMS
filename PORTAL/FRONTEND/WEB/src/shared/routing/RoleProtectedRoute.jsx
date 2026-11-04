import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { getAuthorizedRedirectPath } from '../auth/portalAuthService';
import LoadingSpinner from '../components/LoadingSpinner';

/**
 * Enterprise Route Guard enforcing Role-Based and Scope-Based Access Control.
 * Guarantees that only authorized institutional personas with valid tenant scope can enter.
 */
export default function RoleProtectedRoute({
  children,
  allowedRoles = [],
  requiredScope = 'COLLEGE',
  requiredPermissions = [],
}) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner message="Verifying institutional credentials & tenant context..." size="lg" />
      </div>
    );
  }

  // 1. Unauthenticated users redirected to Login
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. Prevent Super Admin (PLATFORM scope) from entering college portal routes directly
  const userScope = (user.scope || '').toUpperCase();
  if (requiredScope && userScope !== requiredScope.toUpperCase()) {
    return (
      <Navigate
        to="/unauthorized"
        state={{
          attemptedPath: location.pathname,
          reason: `Requires ${requiredScope} institutional scope. Current scope: ${userScope || 'NONE'}`,
          requiredRoles: allowedRoles,
          actualRole: user.roleName || user.role,
        }}
        replace
      />
    );
  }

  // 3. Verify Role Authorization
  const userRole = (user.role || '').toUpperCase();
  const normalizedAllowed = allowedRoles.map((r) => r.toUpperCase());

  if (normalizedAllowed.length > 0 && !normalizedAllowed.includes(userRole)) {
    // Seamlessly redirect authenticated users to their own authorized portal dashboard
    const authorizedDashboard = getAuthorizedRedirectPath(userRole, null);
    if (authorizedDashboard && authorizedDashboard !== '/login' && authorizedDashboard !== location.pathname) {
      return <Navigate to={authorizedDashboard} replace />;
    }
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

  // 4. Verify College Tenant Context exists for college-scoped roles
  if (userScope === 'COLLEGE' && !user.collegeId) {
    console.warn(`[HMS Security Warning] User ${user.email} authenticated under COLLEGE scope without tenant collegeId.`);
    return (
      <Navigate
        to="/unauthorized"
        state={{
          attemptedPath: location.pathname,
          reason: 'No active college tenant assignment was found for this user account.',
          actualRole: user.roleName || user.role,
        }}
        replace
      />
    );
  }

  // 5. Optional Permission check
  if (requiredPermissions.length > 0 && Array.isArray(user.permissions)) {
    const userPerms = new Set(user.permissions.map((p) => (typeof p === 'string' ? p.toLowerCase() : p?.code?.toLowerCase())));
    const hasAll = requiredPermissions.every((rp) => userPerms.has(rp.toLowerCase()));
    if (!hasAll) {
      return (
        <Navigate
          to="/unauthorized"
          state={{
            attemptedPath: location.pathname,
            reason: 'Insufficient module permissions.',
            requiredPermissions,
            actualRole: user.roleName || user.role,
          }}
          replace
        />
      );
    }
  }

  return children;
}
