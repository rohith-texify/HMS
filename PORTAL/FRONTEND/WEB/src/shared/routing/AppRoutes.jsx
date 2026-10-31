import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { ROLE_ROUTE_MAP } from '../auth/portalAuthService';
import InstitutionalLayout from '../layouts/InstitutionalLayout';
import RoleProtectedRoute from './RoleProtectedRoute';
import LoadingSpinner from '../components/LoadingSpinner';

// Lazy-loaded Public Pages
const SharedLoginPage = lazy(() => import('../../pages/SharedLoginPage'));
const UnauthorizedPage = lazy(() => import('../../pages/UnauthorizedPage'));
const NotFoundPage = lazy(() => import('../../pages/NotFoundPage'));

// Lazy-loaded Admin Pages
const AdminDashboardPage = lazy(() => import('../../modules/admin/pages/DashboardPage'));
const AdminStudentsPage = lazy(() => import('../../modules/admin/pages/StudentsPage'));
const AdminStaffPage = lazy(() => import('../../modules/admin/pages/StaffPage'));
const AdminHostelsPage = lazy(() => import('../../modules/admin/pages/HostelsPage'));

// Lazy-loaded Student Pages
const StudentDashboardPage = lazy(() => import('../../modules/student/pages/DashboardPage'));
const StudentLeavesPage = lazy(() => import('../../modules/student/pages/LeavesPage'));
const StudentComplaintsPage = lazy(() => import('../../modules/student/pages/ComplaintsPage'));

// Lazy-loaded Parent Pages
const ParentDashboardPage = lazy(() => import('../../modules/parent/pages/DashboardPage'));
const ParentStudentDetailPage = lazy(() => import('../../modules/parent/pages/StudentDetailPage'));
const ParentLeavesPage = lazy(() => import('../../modules/parent/pages/LeavesPage'));

// Lazy-loaded Hostel Incharge Pages
const InchargeDashboardPage = lazy(() => import('../../modules/hostel-incharge/pages/DashboardPage'));
const InchargeRoomsPage = lazy(() => import('../../modules/hostel-incharge/pages/RoomsPage'));
const InchargeComplaintsPage = lazy(() => import('../../modules/hostel-incharge/pages/ComplaintsPage'));
const InchargeAttendancePage = lazy(() => import('../../modules/hostel-incharge/pages/AttendancePage'));

// Lazy-loaded Security Pages
const SecurityDashboardPage = lazy(() => import('../../modules/security/pages/DashboardPage'));
const SecurityGatesPage = lazy(() => import('../../modules/security/pages/GatesPage'));
const SecurityLeavesPage = lazy(() => import('../../modules/security/pages/LeavesPage'));
const SecurityStudentsPage = lazy(() => import('../../modules/security/pages/StudentsPage'));

// Root Redirection Component
function RootRoute() {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner message="Resolving institutional session..." size="lg" />;
  }

  if (isAuthenticated && user?.role && ROLE_ROUTE_MAP[user.role]) {
    return <Navigate to={ROLE_ROUTE_MAP[user.role].path} replace />;
  }

  return <Navigate to="/login" replace />;
}

export default function AppRoutes() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <LoadingSpinner message="Loading module view..." size="md" />
        </div>
      }
    >
      <Routes>
        {/* Root and Public Authentication Routes */}
        <Route path="/" element={<RootRoute />} />
        <Route path="/login" element={<SharedLoginPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        {/* ============================================================== */}
        {/* Module 1: College Administration (/admin/*)                   */}
        {/* ============================================================== */}
        <Route
          path="/admin"
          element={
            <RoleProtectedRoute allowedRoles={['COLLEGE_ADMIN', 'HOSTEL_ADMIN', 'ADMIN']}>
              <InstitutionalLayout />
            </RoleProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboardPage />} />
          <Route path="students" element={<AdminStudentsPage />} />
          <Route path="staff" element={<AdminStaffPage />} />
          <Route path="hostels" element={<AdminHostelsPage />} />
        </Route>

        {/* ============================================================== */}
        {/* Module 2: Student Portal (/student/*)                         */}
        {/* ============================================================== */}
        <Route
          path="/student"
          element={
            <RoleProtectedRoute allowedRoles={['STUDENT']}>
              <InstitutionalLayout />
            </RoleProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/student/dashboard" replace />} />
          <Route path="dashboard" element={<StudentDashboardPage />} />
          <Route path="leaves" element={<StudentLeavesPage />} />
          <Route path="complaints" element={<StudentComplaintsPage />} />
        </Route>

        {/* ============================================================== */}
        {/* Module 3: Parent Portal (/parent/*)                           */}
        {/* ============================================================== */}
        <Route
          path="/parent"
          element={
            <RoleProtectedRoute allowedRoles={['PARENT']}>
              <InstitutionalLayout />
            </RoleProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/parent/dashboard" replace />} />
          <Route path="dashboard" element={<ParentDashboardPage />} />
          <Route path="students/:studentId" element={<ParentStudentDetailPage />} />
          <Route path="leaves" element={<ParentLeavesPage />} />
        </Route>

        {/* ============================================================== */}
        {/* Module 4: Hostel Incharge & Wardens (/hostel-incharge/*)      */}
        {/* ============================================================== */}
        <Route
          path="/hostel-incharge"
          element={
            <RoleProtectedRoute allowedRoles={['HOSTEL_INCHARGE', 'INCHARGE', 'WARDEN']}>
              <InstitutionalLayout />
            </RoleProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/hostel-incharge/dashboard" replace />} />
          <Route path="dashboard" element={<InchargeDashboardPage />} />
          <Route path="rooms" element={<InchargeRoomsPage />} />
          <Route path="complaints" element={<InchargeComplaintsPage />} />
          <Route path="attendance" element={<InchargeAttendancePage />} />
        </Route>

        {/* ============================================================== */}
        {/* Module 5: Campus Security & Gates (/security/*)               */}
        {/* ============================================================== */}
        <Route
          path="/security"
          element={
            <RoleProtectedRoute allowedRoles={['SECURITY', 'SECURITY_GUARD']}>
              <InstitutionalLayout />
            </RoleProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/security/dashboard" replace />} />
          <Route path="dashboard" element={<SecurityDashboardPage />} />
          <Route path="gates" element={<SecurityGatesPage />} />
          <Route path="leaves" element={<SecurityLeavesPage />} />
          <Route path="students" element={<SecurityStudentsPage />} />
        </Route>

        {/* Catch-all 404 Route */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

