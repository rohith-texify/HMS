import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import AdminLayout from '../layouts/AdminLayout';
import LoadingSpinner from '../components/LoadingSpinner';

// Authentication & Public Pages
import LoginPage from '../pages/LoginPage';
import UnauthorizedPage from '../pages/UnauthorizedPage';
import NotFoundPage from '../pages/NotFoundPage';

// Lazy-loaded Domain Administration Pages
const DashboardPage = lazy(() => import('../pages/DashboardPage'));
const StudentsPage = lazy(() => import('../pages/StudentsPage'));
const ParentsPage = lazy(() => import('../pages/ParentsPage'));
const StaffPage = lazy(() => import('../pages/StaffPage'));
const HostelsPage = lazy(() => import('../pages/HostelsPage'));
const AllocationsPage = lazy(() => import('../pages/AllocationsPage'));
const AttendancePage = lazy(() => import('../pages/AttendancePage'));
const LeavesPage = lazy(() => import('../pages/LeavesPage'));
const MovementPage = lazy(() => import('../pages/MovementPage'));
const GatePassesPage = lazy(() => import('../pages/GatePassesPage'));
const ComplaintsPage = lazy(() => import('../pages/ComplaintsPage'));
const VisitorsPage = lazy(() => import('../pages/VisitorsPage'));
const ParcelsPage = lazy(() => import('../pages/ParcelsPage'));
const SOSPage = lazy(() => import('../pages/SOSPage'));
const FoodPage = lazy(() => import('../pages/FoodPage'));
const AnnouncementsPage = lazy(() => import('../pages/AnnouncementsPage'));
const ReportsPage = lazy(() => import('../pages/ReportsPage'));
const SettingsPage = lazy(() => import('../pages/SettingsPage'));
const AuditLogPage = lazy(() => import('../pages/AuditLogPage'));

// Persona Forwarder to Unified Portal
function ExternalPersonaRedirect({ targetPath }) {
  React.useEffect(() => {
    window.location.replace(`http://localhost:5173${targetPath}`);
  }, [targetPath]);
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <LoadingSpinner message="Redirecting to Unified Campus Portal..." size="md" />
    </div>
  );
}

export default function AppRoutes() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <LoadingSpinner message="Loading view..." size="md" />
        </div>
      }
    >
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin/login" element={<LoginPage initialPersona="COLLEGE_ADMIN" />} />
        <Route path="/hostel-incharge/login" element={<LoginPage initialPersona="HOSTEL_INCHARGE" />} />
        <Route path="/incharge/login" element={<LoginPage initialPersona="HOSTEL_INCHARGE" />} />
        <Route path="/security/login" element={<LoginPage initialPersona="SECURITY" />} />
        <Route path="/student/login" element={<LoginPage initialPersona="STUDENT" />} />
        <Route path="/parent/login" element={<LoginPage initialPersona="PARENT" />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route path="/hostel-incharge/*" element={<ExternalPersonaRedirect targetPath="/hostel-incharge/dashboard" />} />
        <Route path="/security/*" element={<ExternalPersonaRedirect targetPath="/security/dashboard" />} />
        <Route path="/student/*" element={<ExternalPersonaRedirect targetPath="/student/dashboard" />} />
        <Route path="/parent/*" element={<ExternalPersonaRedirect targetPath="/parent/dashboard" />} />
        <Route path="/incharge" element={<ExternalPersonaRedirect targetPath="/hostel-incharge/dashboard" />} />
        <Route path="/incharges" element={<ExternalPersonaRedirect targetPath="/hostel-incharge/dashboard" />} />

        {/* Primary Protected Admin Shell - Supports both / and /admin prefixes */}
        <Route
          element={
            <ProtectedRoute allowedRoles={['COLLEGE_ADMIN', 'HOSTEL_ADMIN', 'ADMIN']}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          {/* Root Redirect */}
          <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/dashboard" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/students" element={<Navigate to="/admin/students" replace />} />
          <Route path="/parents" element={<Navigate to="/admin/parents" replace />} />
          <Route path="/staff" element={<Navigate to="/admin/staff" replace />} />
          <Route path="/security-assignments" element={<Navigate to="/admin/security-assignments" replace />} />
          <Route path="/passwords" element={<Navigate to="/admin/passwords" replace />} />
          <Route path="/hostels" element={<Navigate to="/admin/hostels" replace />} />
          <Route path="/rooms" element={<Navigate to="/admin/rooms" replace />} />
          <Route path="/allocations" element={<Navigate to="/admin/allocations" replace />} />
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
          <Route path="/reports" element={<Navigate to="/admin/reports" replace />} />
          <Route path="/settings" element={<Navigate to="/admin/settings" replace />} />
          <Route path="/audit-logs" element={<Navigate to="/admin/audit-logs" replace />} />

          {/* Canonical /admin/* Routes */}
          <Route path="/admin">
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="students" element={<StudentsPage />} />
            <Route path="parents" element={<ParentsPage />} />
            <Route path="staff" element={<StaffPage />} />
            <Route path="incharges" element={<StaffPage defaultTab="incharges" />} />
            <Route path="security-assignments" element={<StaffPage defaultTab="security" />} />
            <Route path="passwords" element={<StaffPage defaultTab="passwords" />} />
            <Route path="hostels" element={<HostelsPage />} />
            <Route path="rooms" element={<HostelsPage />} />
            <Route path="allocations" element={<AllocationsPage />} />
            <Route path="attendance" element={<AttendancePage />} />
            <Route path="leaves" element={<LeavesPage />} />
            <Route path="movement" element={<MovementPage />} />
            <Route path="gate-passes" element={<GatePassesPage />} />
            <Route path="complaints" element={<ComplaintsPage />} />
            <Route path="visitors" element={<VisitorsPage />} />
            <Route path="parcels" element={<ParcelsPage />} />
            <Route path="sos" element={<SOSPage />} />
            <Route path="food" element={<FoodPage />} />
            <Route path="announcements" element={<AnnouncementsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="audit-logs" element={<AuditLogPage />} />
          </Route>
        </Route>

        {/* 404 Fallback */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
