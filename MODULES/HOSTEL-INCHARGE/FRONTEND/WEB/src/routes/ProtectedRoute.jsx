import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/LoadingSpinner';
import UnauthorizedState from '../components/UnauthorizedState';

export default function ProtectedRoute({ children, allowedRoles = ['HOSTEL_INCHARGE', 'INCHARGE'] }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner message="Resolving hostel in-charge session..." size="lg" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    const portalUrl =
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PORTAL_URL) ||
      (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://localhost:5173'
        : '');
    window.location.replace(`${portalUrl}/hostel-incharge/login`);
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner message="Redirecting to Unified Portal login..." size="lg" />
      </div>
    );
  }

  // Strict role check
  const userRole = String(user.role || '').toUpperCase();
  const isAuthorized = allowedRoles.map((r) => r.toUpperCase()).includes(userRole);

  if (!isAuthorized) {
    return (
      <div style={{ padding: '40px 24px' }}>
        <UnauthorizedState
          title="Role Unauthorized"
          message={`Your authenticated role (${user.roleName || userRole}) is not permitted into the Hostel In-Charge management module.`}
        />
      </div>
    );
  }

  return children;
}
