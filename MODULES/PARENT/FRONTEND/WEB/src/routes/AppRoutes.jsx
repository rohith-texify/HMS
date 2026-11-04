import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import AppLayout from '../layouts/AppLayout';
import PortalState from '../components/PortalState';

const LoginPage = lazy(() => import('../pages/LoginPage'));
const DashboardPage = lazy(() => import('../pages/DashboardPage'));
const StudentDetailPage = lazy(() => import('../pages/StudentDetailPage'));
const LeavesPage = lazy(() => import('../pages/LeavesPage'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));

function RouteLoadingFallback() {
  return (
    <div className="route-loading">
      <PortalState variant="loading" title="Loading page..." />
    </div>
  );
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/students/:studentId" element={<StudentDetailPage />} />
            <Route path="/leaves" element={<LeavesPage />} />
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
