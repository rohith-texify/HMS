import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>Loading Student Portal...</div>;
  }

  if (!isAuthenticated || !user || user.role !== 'STUDENT') {
    const portalUrl =
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PORTAL_URL) ||
      (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://localhost:5173'
        : '');
    window.location.replace(`${portalUrl}/student/login`);
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        Redirecting to Unified Portal login...
      </div>
    );
  }

  return children;
}
