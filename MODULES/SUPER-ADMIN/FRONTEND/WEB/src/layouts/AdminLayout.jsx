import React, { useState, Suspense } from 'react';
import { Outlet, Navigate, useLocation, Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../hooks/useAuth';
import {
  Menu,
  X,
  Search,
  Plus,
  Shield,
  Activity,
  Bell,
  Sparkles,
} from 'lucide-react';

export default function AdminLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  // If not authenticated, redirect to login
  if (!isLoading && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Derive human-readable page title from active route
  const getPageTitle = (pathname) => {
    const routeTitles = {
      '/dashboard': 'Platform Intelligence & Overview',
      '/onboarding': 'Tenant Onboarding Pipeline',
      '/colleges': 'Colleges & Institutions Registry',
      '/colleges/new': 'New Institution Onboarding',
      '/staff': 'Platform Staff & Operator Directory',
      '/roles': 'Roles & Permission Matrix',
      '/permissions': 'Platform Permission Catalog',
      '/access-control': 'Tenant Access & Entitlement Control',
      '/approvals': 'Governance & Approval Workflows',
      '/change-sets': 'Platform Change Management',
      '/modules': 'Module Catalog & Entitlements',
      '/applications': 'Application Ecosystem Hub',
      '/system-settings': 'Global System Settings & Flags',
      '/settings': 'Global System Settings & Flags',
      '/audit-logs': 'Cryptographic Platform Audit Logs',
      '/audit': 'Cryptographic Platform Audit Logs',
      '/notifications': 'Platform Notifications Hub',
      '/monitoring': 'Real-time Telemetry & Node Health',
      '/support': 'Support & Troubleshooting Console',
      '/reports': 'Platform Analytics & Compliance Reports',
      '/analytics': 'Platform Analytics & Compliance Reports',
    };
    return routeTitles[pathname] || 'Control Plane';
  };

  return (
    <div className="shopeers-app-container">
      {/* Mobile Topbar */}
      <header className="shopeers-mobile-topbar">
        <div className="shopeers-mobile-brand">
          <img
            src="/texify-logo.png"
            alt="Texify Technologies"
            className="shopeers-mobile-logo"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <span className="shopeers-mobile-brand-text">Texify Platform</span>
        </div>
        <button
          type="button"
          className="shopeers-mobile-menu-btn"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {/* Mobile Backdrop Overlay */}
      {mobileMenuOpen && (
        <div
          className="shopeers-mobile-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Component */}
      <Sidebar
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="shopeers-main-viewport">
        {/* Sleek Global Header Bar */}
        <header className="shopeers-global-header">
          <div className="shopeers-header-left">
            <div className="shopeers-breadcrumb-tag">
              <span className="shopeers-tag-accent">Texify</span>
              <span className="shopeers-tag-divider">/</span>
              <span className="shopeers-tag-current">{getPageTitle(location.pathname)}</span>
            </div>
            <div className="shopeers-health-pill" title="Live PostgreSQL & API Telemetry: Verified">
              <span className="shopeers-beacon-dot" />
              <span className="shopeers-health-text">Systems Operational</span>
              <span className="shopeers-sla-badge">99.98% SLA</span>
            </div>
          </div>

          <div className="shopeers-header-right">
            {/* Quick Search Input */}
            <div className="shopeers-search-wrapper">
              <Search size={15} className="shopeers-search-icon" />
              <input
                type="text"
                placeholder="Search colleges, modules, users..."
                className="shopeers-search-input"
                aria-label="Global platform search"
              />
              <kbd className="shopeers-search-kbd">⌘K</kbd>
            </div>

            {/* Quick Action Buttons */}
            <Link
              to="/colleges/new"
              className="shopeers-primary-cta-btn"
              id="btn-global-new-college"
            >
              <Plus size={16} />
              <span>Register College</span>
            </Link>

            <Link
              to="/notifications"
              className="shopeers-icon-badge-btn"
              title="Notifications"
            >
              <Bell size={18} />
              <span className="shopeers-notification-dot" />
            </Link>
          </div>
        </header>

        {/* Dynamic Page Outlet with Sleek Loading Fallback */}
        <main className="shopeers-content-outlet">
          <Suspense
            fallback={
              <div className="shopeers-loader-screen">
                <div className="shopeers-spinner" />
                <div className="shopeers-loader-text">Loading module...</div>
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
