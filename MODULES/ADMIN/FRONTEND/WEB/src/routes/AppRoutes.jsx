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
const FeesPage = lazy(() => import('../pages/FeesPage'));
const ReportsPage = lazy(() => import('../pages/ReportsPage'));
const SettingsPage = lazy(() => import('../pages/SettingsPage'));
const AuditLogPage = lazy(() => import('../pages/AuditLogPage'));

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
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

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
            <Route path="fees" element={<FeesPage />} />
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
