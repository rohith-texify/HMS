import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import AdminLayout from '../layouts/AdminLayout';
import ProtectedRoute from './ProtectedRoute';
import LoginPage from '../pages/LoginPage';
import DashboardPage from '../pages/DashboardPage';
import CollegesPage from '../pages/CollegesPage';
import CreateCollegePage from '../pages/CreateCollegePage';
import CollegeDetailPage from '../pages/CollegeDetailPage';
import ApprovalsPage from '../pages/ApprovalsPage';
import ModulesPage from '../pages/ModulesPage';
import OnboardingListPage from '../pages/OnboardingListPage';
import CollegeOnboardingWizardPage from '../pages/CollegeOnboardingWizardPage';
import CollegeConfigurationPage from '../pages/CollegeConfigurationPage';
import ApplicationManagementPage from '../pages/ApplicationManagementPage';
import HostelStructureMasterPage from '../pages/HostelStructureMasterPage';
import CollegeAdminsPage from '../pages/CollegeAdminsPage';
import StaffPage from '../pages/StaffPage';
import RolesPage from '../pages/RolesPage';
import PermissionsPage from '../pages/PermissionsPage';
import AccessControlPage from '../pages/AccessControlPage';
import SystemSettingsPage from '../pages/SystemSettingsPage';
import AuditLogsPage from '../pages/AuditLogsPage';
import ChangeManagementPage from '../pages/ChangeManagementPage';
import NotificationsPage from '../pages/NotificationsPage';
import SystemMonitoringPage from '../pages/SystemMonitoringPage';
import SupportTroubleshootingPage from '../pages/SupportTroubleshootingPage';
import ReportsAnalyticsPage from '../pages/ReportsAnalyticsPage';

// Component that redirects already authenticated Super Admins away from /login to /dashboard
function LoginRoute() {
  const { isAuthenticated } = useAuth();

  // If already authenticated, redirect to dashboard
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  // Show login page for unauthenticated users
  return <LoginPage />;
}

// Component for root path - redirects to either login or dashboard
function RootRoute() {
  const { isAuthenticated } = useAuth();

  // Redirect based on authentication status
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* Root route - redirects to login or dashboard based on auth */}
      <Route path="/" element={<RootRoute />} />

      {/* Public Authentication Route - NOT protected */}
      <Route path="/login" element={<LoginRoute />} />

      {/* Protected Super Admin Platform Routes - wrapped in ProtectedRoute */}
      <Route
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/onboarding" element={<OnboardingListPage />} />
        <Route path="/colleges" element={<CollegesPage />} />
        <Route path="/colleges/new" element={<CreateCollegePage />} />
        <Route path="/colleges/:id" element={<CollegeDetailPage />} />
        <Route path="/colleges/:id/admins" element={<CollegeAdminsPage />} />
        <Route path="/colleges/:id/onboarding" element={<CollegeOnboardingWizardPage />} />
        <Route path="/colleges/:id/configuration" element={<CollegeConfigurationPage />} />
        <Route path="/colleges/:id/settings" element={<CollegeConfigurationPage />} />
        <Route path="/colleges/:id/applications" element={<ApplicationManagementPage />} />
        <Route path="/colleges/:id/modules" element={<ModulesPage />} />
        <Route path="/colleges/:id/access-control" element={<AccessControlPage />} />
        <Route path="/colleges/:id/hostel-structure" element={<HostelStructureMasterPage />} />
        <Route path="/staff" element={<StaffPage />} />
        <Route path="/roles" element={<RolesPage />} />
        <Route path="/permissions" element={<PermissionsPage />} />
        <Route path="/access-control" element={<AccessControlPage />} />
        <Route path="/applications" element={<ApplicationManagementPage />} />
        <Route path="/approvals" element={<ApprovalsPage />} />
        <Route path="/change-sets" element={<ChangeManagementPage />} />
        <Route path="/modules" element={<ModulesPage />} />
        <Route path="/system-settings" element={<SystemSettingsPage />} />
        <Route path="/settings" element={<SystemSettingsPage />} />
        <Route path="/audit-logs" element={<AuditLogsPage />} />
        <Route path="/audit" element={<AuditLogsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/monitoring" element={<SystemMonitoringPage />} />
        <Route path="/support" element={<SupportTroubleshootingPage />} />
        <Route path="/reports" element={<ReportsAnalyticsPage />} />
        <Route path="/analytics" element={<ReportsAnalyticsPage />} />
      </Route>

      {/* Catch-all route - redirects to login if not authenticated, dashboard if authenticated */}
      <Route path="*" element={<RootRoute />} />
    </Routes>
  );
}
