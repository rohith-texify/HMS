import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f8fafc' }}>
        <div>Loading College Administration...</div>
      </div>
    );
  }

  if (!isAuthenticated || !user || (user.role !== 'COLLEGE_ADMIN' && user.role !== 'ADMIN')) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
