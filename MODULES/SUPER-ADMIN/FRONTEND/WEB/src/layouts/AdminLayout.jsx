import React, { useState, Suspense } from 'react';
import { Outlet, Navigate, useLocation, Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../hooks/useAuth';
import {
  Menu,
  X,
  Calendar,
  ChevronDown,
  LayoutGrid,
  Download,
  Plus,
} from 'lucide-react';

export default function AdminLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (!isLoading && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Derive human-readable page title
  const getPageTitle = (pathname) => {
    const titles = {
      '/dashboard': 'Dashboard',
      '/onboarding': 'Onboarding',
      '/colleges': 'Colleges',
      '/colleges/new': 'New College',
      '/staff': 'Company Staff',
      '/roles': 'Roles',
      '/permissions': 'Permissions',
      '/access-control': 'Access Control',
      '/approvals': 'Approvals',
      '/change-sets': 'Change Sets',
      '/modules': 'Modules',
      '/applications': 'Applications',
      '/system-settings': 'Settings',
      '/settings': 'Settings',
      '/audit-logs': 'Audit Logs',
      '/notifications': 'Notifications',
      '/monitoring': 'Monitoring',
      '/support': 'Support',
      '/reports': 'Analytics',
    };
    return titles[pathname] || 'Dashboard';
  };

  return (
    <div className="shopeers-light-app">
      {/* Mobile Topbar */}
      <header className="shopeers-light-mobile-bar">
        <div className="shopeers-mobile-brand-box">
          <img
            src="/texify-logo.png"
            alt="Texify Technologies"
            className="shopeers-mobile-logo-img"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <span className="shopeers-mobile-brand-title">Texify</span>
        </div>
        <button
          type="button"
          className="shopeers-mobile-toggle-btn"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle Navigation"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Mobile Backdrop Overlay */}
      {mobileMenuOpen && (
        <div
          className="shopeers-mobile-backdrop-overlay"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Component */}
      <Sidebar
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      {/* Main Viewport */}
      <div className="shopeers-light-viewport">
        {/* Top Header Bar from Screenshot */}
        <header className="shopeers-light-topbar">
          <div className="shopeers-topbar-title-wrap">
            <h1 className="shopeers-topbar-page-heading">
              {getPageTitle(location.pathname)}
            </h1>
          </div>

          <div className="shopeers-topbar-controls">
            {/* Date Range Pill */}
            <div className="shopeers-pill-btn date-pill">
              <Calendar size={14} className="text-gray-500" />
              <span>Jan 1, 2026 - Dec 31, 2026</span>
            </div>

            {/* Time Filter Dropdown Pill */}
            <div className="shopeers-pill-btn filter-pill">
              <span>Last 30 days</span>
              <ChevronDown size={14} className="text-gray-500" />
            </div>

            {/* Add Widget Pill */}
            <Link to="/colleges/new" className="shopeers-pill-btn widget-pill">
              <LayoutGrid size={14} />
              <span>Add institution</span>
            </Link>

            {/* Export / Primary CTA Button */}
            <Link to="/colleges/new" className="shopeers-primary-export-btn" id="btn-topbar-primary">
              <Download size={14} />
              <span>Export</span>
            </Link>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="shopeers-light-page-content">
          <Suspense
            fallback={
              <div className="shopeers-light-loader">
                <div className="shopeers-loader-circle" />
                <span>Loading view...</span>
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
