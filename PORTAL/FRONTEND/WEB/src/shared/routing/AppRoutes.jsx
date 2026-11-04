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
const AdminAllocationsPage = lazy(() => import('../../modules/admin/pages/AllocationsPage'));
const AdminParentsPage = lazy(() => import('../../modules/admin/pages/ParentsPage'));
const AdminAttendancePage = lazy(() => import('../../modules/admin/pages/AttendancePage'));
const AdminLeavesPage = lazy(() => import('../../modules/admin/pages/LeavesPage'));
const AdminMovementPage = lazy(() => import('../../modules/admin/pages/MovementPage'));
const AdminGatePassesPage = lazy(() => import('../../modules/admin/pages/GatePassesPage'));
const AdminComplaintsPage = lazy(() => import('../../modules/admin/pages/ComplaintsPage'));
const AdminVisitorsPage = lazy(() => import('../../modules/admin/pages/VisitorsPage'));
const AdminParcelsPage = lazy(() => import('../../modules/admin/pages/ParcelsPage'));
const AdminSOSPage = lazy(() => import('../../modules/admin/pages/SOSPage'));
const AdminFoodPage = lazy(() => import('../../modules/admin/pages/FoodPage'));
const AdminAnnouncementsPage = lazy(() => import('../../modules/admin/pages/AnnouncementsPage'));
const AdminReportsPage = lazy(() => import('../../modules/admin/pages/ReportsPage'));
const AdminSettingsPage = lazy(() => import('../../modules/admin/pages/SettingsPage'));
const AdminAuditLogPage = lazy(() => import('../../modules/admin/pages/AuditLogPage'));

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
const InchargeStudentsPage = lazy(() => import('../../modules/hostel-incharge/pages/StudentsPage'));

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
        <Route path="/admin/login" element={<SharedLoginPage initialPersona="COLLEGE_ADMIN" />} />
        <Route path="/hostel-incharge/login" element={<SharedLoginPage initialPersona="HOSTEL_INCHARGE" />} />
        <Route path="/incharge/login" element={<SharedLoginPage initialPersona="HOSTEL_INCHARGE" />} />
        <Route path="/security/login" element={<SharedLoginPage initialPersona="SECURITY" />} />
        <Route path="/student/login" element={<SharedLoginPage initialPersona="STUDENT" />} />
        <Route path="/parent/login" element={<SharedLoginPage initialPersona="PARENT" />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route path="/incharge" element={<Navigate to="/hostel-incharge/dashboard" replace />} />

        {/* Top-Level Route Aliases (Direct Navigation to Admin Modules) */}
        <Route path="/dashboard" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/attendance" element={<Navigate to="/admin/attendance" replace />} />
        <Route path="/leaves" element={<Navigate to="/admin/leaves" replace />} />
        <Route path="/movement" element={<Navigate to="/admin/movement" replace />} />
        <Route path="/gate-passes" element={<Navigate to="/admin/gate-passes" replace />} />
        <Route path="/complaints" element={<Navigate to="/admin/complaints" replace />} />
        <Route path="/visitors" element={<Navigate to="/admin/visitors" replace />} />
        <Route path="/parcels" element={<Navigate to="/admin/parcels" replace />} />
        <Route path="/sos" element={<Navigate to="/admin/sos" replace />} />
        <Route path="/food" element={<Navigate to="/admin/food" replace />} />
        <Route path="/announcements" element={<Navigate to="/admin/announcements" replace />} />
        <Route path="/staff" element={<Navigate to="/admin/staff" replace />} />
        <Route path="/incharges" element={<Navigate to="/admin/incharges" replace />} />
        <Route path="/security-assignments" element={<Navigate to="/admin/security-assignments" replace />} />
        <Route path="/passwords" element={<Navigate to="/admin/passwords" replace />} />
        <Route path="/hostels" element={<Navigate to="/admin/hostels" replace />} />
        <Route path="/rooms" element={<Navigate to="/admin/rooms" replace />} />
        <Route path="/allocations" element={<Navigate to="/admin/allocations" replace />} />
        <Route path="/students" element={<Navigate to="/admin/students" replace />} />
        <Route path="/parents" element={<Navigate to="/admin/parents" replace />} />
        <Route path="/reports" element={<Navigate to="/admin/reports" replace />} />
        <Route path="/settings" element={<Navigate to="/admin/settings" replace />} />
        <Route path="/audit-logs" element={<Navigate to="/admin/audit-logs" replace />} />

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
          <Route path="incharges" element={<AdminStaffPage defaultTab="incharges" />} />
          <Route path="security-assignments" element={<AdminStaffPage defaultTab="security" />} />
          <Route path="passwords" element={<AdminStaffPage defaultTab="passwords" />} />
          <Route path="hostels" element={<AdminHostelsPage />} />
          <Route path="rooms" element={<AdminHostelsPage />} />
          <Route path="allocations" element={<AdminAllocationsPage />} />
          <Route path="parents" element={<AdminParentsPage />} />
          <Route path="attendance" element={<AdminAttendancePage />} />
          <Route path="leaves" element={<AdminLeavesPage />} />
          <Route path="movement" element={<AdminMovementPage />} />
          <Route path="gate-passes" element={<AdminGatePassesPage />} />
          <Route path="complaints" element={<AdminComplaintsPage />} />
          <Route path="visitors" element={<AdminVisitorsPage />} />
          <Route path="parcels" element={<AdminParcelsPage />} />
          <Route path="sos" element={<AdminSOSPage />} />
          <Route path="food" element={<AdminFoodPage />} />
          <Route path="announcements" element={<AdminAnnouncementsPage />} />
          <Route path="reports" element={<AdminReportsPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
          <Route path="audit-logs" element={<AdminAuditLogPage />} />
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
          <Route path="students" element={<InchargeStudentsPage />} />
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

