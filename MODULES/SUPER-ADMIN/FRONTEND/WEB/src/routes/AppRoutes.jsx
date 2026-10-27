import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
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
      <Route path="/modules" element={<ModulesPage />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

