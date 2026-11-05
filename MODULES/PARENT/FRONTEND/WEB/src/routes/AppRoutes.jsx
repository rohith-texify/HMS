import React, { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import ProtectedRoute from './ProtectedRoute';
import AppLayout from '../layouts/AppLayout';
import PageBoundary from '../components/PageBoundary';
import { LoadingState } from '../components/PageStates';

const LoginPage = lazy(() => import('../pages/LoginPage'));
const DashboardPage = lazy(() => import('../pages/DashboardPage'));
const NotificationsPage = lazy(() => import('../pages/NotificationsPage'));
const MessPage = lazy(() => import('../pages/MessPage'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));

function RouteView({ page: Page }) {
  return (
    <PageBoundary>
      <Suspense fallback={<LoadingState message="Loading page..." />}>
        <Page />
      </Suspense>
    </PageBoundary>
  );
}

function LoginRoute() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <RouteView page={LoginPage} />;
}

export default function AppRoutes() {
  const location = useLocation();
  const { isAuthenticated, validateSession } = useAuth();

  useEffect(() => {
    if (isAuthenticated) validateSession();
  }, [isAuthenticated, location.pathname, location.search, validateSession]);

  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<RouteView page={DashboardPage} />} />
          <Route path="/notifications" element={<RouteView page={NotificationsPage} />} />
          <Route path="/mess" element={<RouteView page={MessPage} />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<RouteView page={NotFoundPage} />} />
    </Routes>
  );
}
