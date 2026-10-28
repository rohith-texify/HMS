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
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
