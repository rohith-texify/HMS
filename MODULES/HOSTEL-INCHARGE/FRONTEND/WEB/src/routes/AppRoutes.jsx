import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import InchargeLayout from '../layouts/InchargeLayout';
import ProtectedRoute from './ProtectedRoute';
import PermissionRoute from './PermissionRoute';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorBoundary from '../app/ErrorBoundary';
import { PERMISSIONS } from '../constants/permissions';

// Lazy-loaded pages
const LoginPage = lazy(() => import('../pages/LoginPage'));
const DashboardPage = lazy(() => import('../pages/DashboardPage'));
const HostelOverviewPage = lazy(() => import('../pages/HostelOverviewPage'));
const RoomsPage = lazy(() => import('../pages/RoomsPage'));
const StudentsPage = lazy(() => import('../pages/StudentsPage'));
const AllocationsPage = lazy(() => import('../pages/AllocationsPage'));
const AttendancePage = lazy(() => import('../pages/AttendancePage'));
const LeavesPage = lazy(() => import('../pages/LeavesPage'));
const GatePassesPage = lazy(() => import('../pages/GatePassesPage'));
const VisitorsPage = lazy(() => import('../pages/VisitorsPage'));
const ParcelsPage = lazy(() => import('../pages/ParcelsPage'));
const SOSPage = lazy(() => import('../pages/SOSPage'));
const ComplaintsPage = lazy(() => import('../pages/ComplaintsPage'));
const MaintenancePage = lazy(() => import('../pages/MaintenancePage'));
const MessPage = lazy(() => import('../pages/MessPage'));
const AnnouncementsPage = lazy(() => import('../pages/AnnouncementsPage'));
const DocumentsPage = lazy(() => import('../pages/DocumentsPage'));
const ReportsPage = lazy(() => import('../pages/ReportsPage'));
const AuditLogPage = lazy(() => import('../pages/AuditLogPage'));
const UnauthorizedPage = lazy(() => import('../pages/UnauthorizedPage'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));

function LoginRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner message="Verifying session status..." size="lg" />
      </div>
    );
  }

  if (isAuthenticated) {
    const from = location.state?.from?.pathname || '/dashboard';
    return <Navigate to={from} replace />;
  }

  return <LoginPage />;
}

export default function AppRoutes() {
  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LoadingSpinner message="Loading workspace..." size="lg" />
          </div>
        }
      >
        <Routes>
          {/* Public Authentication Route */}
          <Route path="/login" element={<LoginRoute />} />

          {/* Protected Application Workspace */}
          <Route
            element={
              <ProtectedRoute allowedRoles={['HOSTEL_INCHARGE', 'INCHARGE']}>
                <InchargeLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />

            {/* 1. Dashboard */}
            <Route
              path="dashboard"
              element={
                <PermissionRoute permission={PERMISSIONS.HOSTEL_VIEW}>
                  <DashboardPage />
                </PermissionRoute>
              }
            />

            {/* 2. Hostel Overview */}
            <Route
              path="hostel"
              element={
                <PermissionRoute permission={PERMISSIONS.HOSTEL_VIEW}>
                  <HostelOverviewPage />
                </PermissionRoute>
              }
            />

            {/* 3. Room & Bed Operations */}
            <Route
              path="rooms"
              element={
                <PermissionRoute permission={PERMISSIONS.HOSTEL_VIEW}>
                  <RoomsPage />
                </PermissionRoute>
              }
            />

            {/* 4. Student Accommodation */}
            <Route
              path="students"
              element={
                <PermissionRoute permission={PERMISSIONS.PEOPLE_VIEW}>
                  <StudentsPage />
                </PermissionRoute>
              }
            />

            {/* 5. Room Allocation */}
            <Route
              path="allocations"
              element={
                <PermissionRoute permission={PERMISSIONS.HOSTEL_MANAGE}>
                  <AllocationsPage />
                </PermissionRoute>
              }
            />

            {/* 6. Attendance Management */}
            <Route
              path="attendance"
              element={
                <PermissionRoute permission={PERMISSIONS.MOVEMENT_VIEW}>
                  <AttendancePage />
                </PermissionRoute>
              }
            />

            {/* 7. Leave Management */}
            <Route
              path="leaves"
              element={
                <PermissionRoute permission={PERMISSIONS.REQUESTS_VIEW}>
                  <LeavesPage />
                </PermissionRoute>
              }
            />

            {/* 8. Outings & Gate Passes */}
            <Route
              path="gate-passes"
              element={
                <PermissionRoute permission={PERMISSIONS.MOVEMENT_VIEW}>
                  <GatePassesPage />
                </PermissionRoute>
              }
            />

            {/* 9. Visitor Management */}
            <Route
              path="visitors"
              element={
                <PermissionRoute permission={PERMISSIONS.REQUESTS_VIEW}>
                  <VisitorsPage />
                </PermissionRoute>
              }
            />

            {/* 10. Parcel Management */}
            <Route
              path="parcels"
              element={
                <PermissionRoute permission={PERMISSIONS.REQUESTS_VIEW}>
                  <ParcelsPage />
                </PermissionRoute>
              }
            />

            {/* 11. SOS & Emergency */}
            <Route
              path="emergency"
              element={
                <PermissionRoute permission={PERMISSIONS.PEOPLE_VIEW}>
                  <SOSPage />
                </PermissionRoute>
              }
            />

            {/* 12. Complaint Management */}
            <Route
              path="complaints"
              element={
                <PermissionRoute permission={PERMISSIONS.REQUESTS_VIEW}>
                  <ComplaintsPage />
                </PermissionRoute>
              }
            />

            {/* 13. Maintenance Management */}
            <Route
              path="maintenance"
              element={
                <PermissionRoute permission={PERMISSIONS.HOSTEL_VIEW}>
                  <MaintenancePage />
                </PermissionRoute>
              }
            />

            {/* 14. Mess & Food Management */}
            <Route
              path="mess"
              element={
                <PermissionRoute permission={PERMISSIONS.HOSTEL_VIEW}>
                  <MessPage />
                </PermissionRoute>
              }
            />

            {/* 15. Announcements & Notices */}
            <Route
              path="announcements"
              element={
                <PermissionRoute permission={PERMISSIONS.HOSTEL_VIEW}>
                  <AnnouncementsPage />
                </PermissionRoute>
              }
            />

            {/* 16. Documents & Records */}
            <Route
              path="documents"
              element={
                <PermissionRoute permission={PERMISSIONS.PEOPLE_VIEW}>
                  <DocumentsPage />
                </PermissionRoute>
              }
            />

            {/* 17. Reports & Analytics */}
            <Route
              path="reports"
              element={
                <PermissionRoute permission={PERMISSIONS.REPORTS_VIEW}>
                  <ReportsPage />
                </PermissionRoute>
              }
            />

            {/* 18. Audit & Activity Logs */}
            <Route
              path="audit"
              element={
                <PermissionRoute permission={PERMISSIONS.HOSTEL_VIEW}>
                  <AuditLogPage />
                </PermissionRoute>
              }
            />
          </Route>

          {/* Access Control & Fallback Routes */}
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
