import React, { lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import AdminLayout from '../layouts/AdminLayout';
import ProtectedRoute from './ProtectedRoute';
import LoginPage from '../pages/LoginPage';

// Code-split all protected module views into on-demand asynchronous chunks
const DashboardPage = lazy(() => import('../pages/DashboardPage'));
const CollegesPage = lazy(() => import('../pages/CollegesPage'));
const CreateCollegePage = lazy(() => import('../pages/CreateCollegePage'));
const CollegeDetailPage = lazy(() => import('../pages/CollegeDetailPage'));
const ApprovalsPage = lazy(() => import('../pages/ApprovalsPage'));
const ModulesPage = lazy(() => import('../pages/ModulesPage'));
const OnboardingListPage = lazy(() => import('../pages/OnboardingListPage'));
const CollegeOnboardingWizardPage = lazy(() => import('../pages/CollegeOnboardingWizardPage'));
const CollegeConfigurationPage = lazy(() => import('../pages/CollegeConfigurationPage'));
const ApplicationManagementPage = lazy(() => import('../pages/ApplicationManagementPage'));
const HostelStructureMasterPage = lazy(() => import('../pages/HostelStructureMasterPage'));
const CollegeAdminsPage = lazy(() => import('../pages/CollegeAdminsPage'));
const StaffPage = lazy(() => import('../pages/StaffPage'));
const RolesPage = lazy(() => import('../pages/RolesPage'));
const PermissionsPage = lazy(() => import('../pages/PermissionsPage'));
const AccessControlPage = lazy(() => import('../pages/AccessControlPage'));
const SystemSettingsPage = lazy(() => import('../pages/SystemSettingsPage'));
const AuditLogsPage = lazy(() => import('../pages/AuditLogsPage'));
const ChangeManagementPage = lazy(() => import('../pages/ChangeManagementPage'));
const NotificationsPage = lazy(() => import('../pages/NotificationsPage'));
const SystemMonitoringPage = lazy(() => import('../pages/SystemMonitoringPage'));
const SupportTroubleshootingPage = lazy(() => import('../pages/SupportTroubleshootingPage'));
const ReportsAnalyticsPage = lazy(() => import('../pages/ReportsAnalyticsPage'));

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
