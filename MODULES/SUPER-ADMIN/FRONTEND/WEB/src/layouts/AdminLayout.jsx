import React, { useState, Suspense } from 'react';
import { Outlet, Navigate, useLocation, Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../hooks/useAuth';
import {
  Menu,
  X,
  Search,
  Bell,
  CheckCircle2,
  SlidersHorizontal,
  ChevronRight,
  Shield,
} from 'lucide-react';

export default function AdminLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (!isLoading && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Derive human-readable page title and breadcrumbs
  const getPageMeta = (pathname) => {
    const routeMap = {
      '/dashboard': { group: 'Overview', title: 'Dashboard' },
      '/onboarding': { group: 'Management', title: 'Onboarding Pipeline' },
      '/colleges': { group: 'Management', title: 'Colleges Directory' },
      '/colleges/new': { group: 'Management', title: 'Register College' },
      '/staff': { group: 'Management', title: 'Company Staff' },
      '/roles': { group: 'Management', title: 'Roles & Hierarchy' },
      '/permissions': { group: 'Management', title: 'Permissions Matrix' },
      '/access-control': { group: 'Management', title: 'Access Control' },
      '/applications': { group: 'Operations', title: 'Applications Catalog' },
      '/approvals': { group: 'Operations', title: 'Pending Approvals' },
      '/change-sets': { group: 'Operations', title: 'Configuration Change Sets' },
      '/modules': { group: 'Platform', title: 'Modules Management' },
      '/system-settings': { group: 'Platform', title: 'System Settings' },
      '/audit-logs': { group: 'Platform', title: 'Audit Trail' },
      '/notifications': { group: 'Platform', title: 'Notifications Hub' },
      '/monitoring': { group: 'Platform', title: 'Telemetry & Monitoring' },
      '/reports': { group: 'Platform', title: 'Reports & Analytics' },
      '/support': { group: 'Platform', title: 'Support Console' },
    };

    return routeMap[pathname] || { group: 'Platform', title: 'Super Admin' };
  };

  const pageMeta = getPageMeta(location.pathname);
  const adminEmail =
    user?.email && !user.email.endsWith('@hms.local') && !user.email.includes('superadmin')
      ? user.email
      : 'rohith.texify@gmail.com';

  return (
    <div className={`enterprise-shell ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
      {/* Mobile Topbar */}
      <header className="enterprise-mobile-bar">
        <div className="mobile-bar-brand">
          <div className="mobile-bar-badge">
            <Shield size={16} />
          </div>
          <span className="mobile-bar-title">HMS Super Admin</span>
        </div>
        <button
          type="button"
          className="mobile-bar-menu-btn"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Mobile Backdrop Overlay */}
      {mobileMenuOpen && (
        <div
          className="enterprise-mobile-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Shared Collapsible Sidebar */}
      <Sidebar
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Content Viewport */}
      <div className="enterprise-viewport">
        {/* Top Header */}
        <header className="enterprise-top-header">
          {/* Left: Breadcrumbs & Page title */}
          <div className="header-breadcrumbs-block">
            <div className="header-breadcrumbs">
              <span className="breadcrumb-group">{pageMeta.group}</span>
              <ChevronRight size={13} className="breadcrumb-separator" />
              <span className="breadcrumb-active">{pageMeta.title}</span>
            </div>
          </div>

          {/* Center: Search Field */}
          <div className="header-search-wrap">
            <Search size={15} className="header-search-icon" />
            <input
              type="text"
              className="header-search-input"
              placeholder="Search colleges, modules, audit logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Right: Actions, Telemetry Badge, Profile */}
          <div className="header-actions-group">
            {/* Health Indicator */}
            <div className="header-status-pill" title="System Services Nominal">
              <span className="status-dot green" />
              <span className="status-label">Operational</span>
            </div>

            {/* Notification Quick Link */}
            <Link
              to="/notifications"
              className="header-icon-action-btn"
              title="Notifications Hub"
              aria-label="Notifications"
            >
              <Bell size={17} />
              <span className="notification-ping-dot" />
            </Link>

            {/* Administrator Profile Pill */}
            <div className="header-profile-pill">
              <div className="header-avatar-circle">
                {adminEmail.slice(0, 2).toUpperCase()}
              </div>
              <div className="header-profile-text">
                <span className="profile-name" title={adminEmail}>
                  {adminEmail.split('@')[0]}
                </span>
                <span className="profile-role">Super Admin</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content Body */}
        <main className="enterprise-main-content">
          <div className="enterprise-page-wrap">
            <Suspense
              fallback={
                <div className="enterprise-loading-container">
                  <div className="enterprise-spinner" />
                  <span className="loading-label">Loading enterprise view...</span>
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
