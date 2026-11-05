import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { ROLE_ROUTE_MAP, normalizeRoleCode } from '../auth/portalAuthService';
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

  const role = normalizeRoleCode(user?.role || '');
  if (isAuthenticated && role && (ROLE_ROUTE_MAP[role] || ROLE_ROUTE_MAP[user?.role])) {
    const target = ROLE_ROUTE_MAP[role]?.path || ROLE_ROUTE_MAP[user?.role]?.path;
    return <Navigate to={target} replace />;
  }

  return <Navigate to="/login" replace />;
}

// Enterprise Role-Aware Route Forwarder
function SmartRoleRedirect({ routeType }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return <LoadingSpinner message="Resolving route..." size="sm" />;
  }

  const role = normalizeRoleCode(user?.role || '');

  if (!isAuthenticated || !role) {
    if (['incharges', 'incharge'].includes(routeType)) {
      return <Navigate to="/hostel-incharge/login" replace />;
    }
    if (['security', 'security-assignments'].includes(routeType)) {
      return <Navigate to="/security/login" replace />;
    }
    if (['students'].includes(routeType)) {
      return <Navigate to="/student/login" replace />;
    }
    if (['parents'].includes(routeType)) {
      return <Navigate to="/parent/login" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  // Role: Hostel In-Charge
  if (role === 'HOSTEL_INCHARGE') {
    switch (routeType) {
      case 'dashboard':
      case 'incharges':
      case 'incharge':
        return <Navigate to="/hostel-incharge/dashboard" replace />;
      case 'students':
        return <Navigate to="/hostel-incharge/students" replace />;
      case 'rooms':
      case 'hostels':
      case 'allocations':
        return <Navigate to="/hostel-incharge/rooms" replace />;
      case 'attendance':
        return <Navigate to="/hostel-incharge/attendance" replace />;
      case 'complaints':
        return <Navigate to="/hostel-incharge/complaints" replace />;
      default:
        return <Navigate to="/hostel-incharge/dashboard" replace />;
    }
  }

  // Role: Student
  if (role === 'STUDENT') {
    switch (routeType) {
      case 'dashboard':
        return <Navigate to="/student/dashboard" replace />;
      case 'leaves':
        return <Navigate to="/student/leaves" replace />;
      case 'complaints':
        return <Navigate to="/student/complaints" replace />;
      default:
        return <Navigate to="/student/dashboard" replace />;
    }
  }

  // Role: Parent
  if (role === 'PARENT') {
    switch (routeType) {
      case 'dashboard':
        return <Navigate to="/parent/dashboard" replace />;
      case 'leaves':
        return <Navigate to="/parent/leaves" replace />;
      default:
        return <Navigate to="/parent/dashboard" replace />;
    }
  }

  // Role: Security
  if (role === 'SECURITY') {
    switch (routeType) {
      case 'dashboard':
        return <Navigate to="/security/dashboard" replace />;
      case 'gates':
        return <Navigate to="/security/gates" replace />;
      case 'leaves':
        return <Navigate to="/security/leaves" replace />;
      case 'students':
        return <Navigate to="/security/students" replace />;
      default:
        return <Navigate to="/security/dashboard" replace />;
    }
  }

  // Default: College Administrator
  switch (routeType) {
    case 'dashboard': return <Navigate to="/admin/dashboard" replace />;
    case 'attendance': return <Navigate to="/admin/attendance" replace />;
    case 'leaves': return <Navigate to="/admin/leaves" replace />;
    case 'movement': return <Navigate to="/admin/movement" replace />;
    case 'gate-passes': return <Navigate to="/admin/gate-passes" replace />;
    case 'complaints': return <Navigate to="/admin/complaints" replace />;
    case 'visitors': return <Navigate to="/admin/visitors" replace />;
    case 'parcels': return <Navigate to="/admin/parcels" replace />;
    case 'sos': return <Navigate to="/admin/sos" replace />;
    case 'food': return <Navigate to="/admin/food" replace />;
    case 'announcements': return <Navigate to="/admin/announcements" replace />;
    case 'staff': return <Navigate to="/admin/staff" replace />;
    case 'incharges': return <Navigate to="/admin/incharges" replace />;
    case 'security-assignments': return <Navigate to="/admin/security-assignments" replace />;
    case 'passwords': return <Navigate to="/admin/passwords" replace />;
    case 'hostels': return <Navigate to="/admin/hostels" replace />;
    case 'rooms': return <Navigate to="/admin/rooms" replace />;
    case 'allocations': return <Navigate to="/admin/allocations" replace />;
    case 'students': return <Navigate to="/admin/students" replace />;
    case 'parents': return <Navigate to="/admin/parents" replace />;
    case 'reports': return <Navigate to="/admin/reports" replace />;
    case 'settings': return <Navigate to="/admin/settings" replace />;
    case 'audit-logs': return <Navigate to="/admin/audit-logs" replace />;
    default: return <Navigate to="/admin/dashboard" replace />;
  }
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
        <Route path="/hostel-incharges" element={<Navigate to="/hostel-incharge/dashboard" replace />} />
        <Route path="/incharge" element={<SmartRoleRedirect routeType="incharge" />} />
        <Route path="/incharges" element={<SmartRoleRedirect routeType="incharges" />} />

        {/* Top-Level Route Aliases (Dynamic Persona Forwarding) */}
        <Route path="/dashboard" element={<SmartRoleRedirect routeType="dashboard" />} />
        <Route path="/attendance" element={<SmartRoleRedirect routeType="attendance" />} />
        <Route path="/leaves" element={<SmartRoleRedirect routeType="leaves" />} />
        <Route path="/movement" element={<SmartRoleRedirect routeType="movement" />} />
        <Route path="/gate-passes" element={<SmartRoleRedirect routeType="gate-passes" />} />
        <Route path="/complaints" element={<SmartRoleRedirect routeType="complaints" />} />
        <Route path="/visitors" element={<SmartRoleRedirect routeType="visitors" />} />
        <Route path="/parcels" element={<SmartRoleRedirect routeType="parcels" />} />
        <Route path="/sos" element={<SmartRoleRedirect routeType="sos" />} />
        <Route path="/food" element={<SmartRoleRedirect routeType="food" />} />
        <Route path="/announcements" element={<SmartRoleRedirect routeType="announcements" />} />
        <Route path="/staff" element={<SmartRoleRedirect routeType="staff" />} />
        <Route path="/security-assignments" element={<SmartRoleRedirect routeType="security-assignments" />} />
        <Route path="/passwords" element={<SmartRoleRedirect routeType="passwords" />} />
        <Route path="/hostels" element={<SmartRoleRedirect routeType="hostels" />} />
        <Route path="/rooms" element={<SmartRoleRedirect routeType="rooms" />} />
        <Route path="/allocations" element={<SmartRoleRedirect routeType="allocations" />} />
        <Route path="/students" element={<SmartRoleRedirect routeType="students" />} />
        <Route path="/parents" element={<SmartRoleRedirect routeType="parents" />} />
        <Route path="/reports" element={<SmartRoleRedirect routeType="reports" />} />
        <Route path="/settings" element={<SmartRoleRedirect routeType="settings" />} />
        <Route path="/audit-logs" element={<SmartRoleRedirect routeType="audit-logs" />} />

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

