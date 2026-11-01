import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { ROLE_NAVIGATION } from '../routing/roleNavigation';
import {
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Search,
  LogOut,
  Building2,
  Shield,
  Bell,
} from 'lucide-react';
import '../styles/layout.css';

export default function InstitutionalLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const userRole = (user?.role || 'COLLEGE_ADMIN').toUpperCase();
  const navConfig = ROLE_NAVIGATION[userRole] || ROLE_NAVIGATION.COLLEGE_ADMIN;

  const adminEmail = user?.email || 'admin@college.edu';
  const adminRoleTitle = user?.roleName || 'College Administrator';
  const userInitials = adminEmail.slice(0, 2).toUpperCase();

  // Derive active breadcrumb
  const getBreadcrumbTitle = (pathname) => {
    const routeMap = {
      '/admin/dashboard': { group: 'Overview', title: 'Dashboard' },
      '/admin/hostels': { group: 'Facility & Inventory', title: 'Hostels & Blocks' },
      '/admin/staff': { group: 'Community Management', title: 'College Staff' },
      '/admin/students': { group: 'Community Management', title: 'Students Directory' },
    };
    return routeMap[pathname] || { group: 'College Administration', title: 'Overview' };
  };

  const breadcrumbs = getBreadcrumbTitle(location.pathname);

  return (
    <div className={`enterprise-shell ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
      {/* Mobile Topbar */}
      <header className="enterprise-mobile-bar">
        <div className="mobile-bar-brand">
          <div className="mobile-bar-badge">
            <Building2 size={16} />
          </div>
          <span className="mobile-bar-title">{navConfig.brand}</span>
        </div>
        <button
          type="button"
          className="mobile-bar-menu-btn"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'}
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

      {/* Collapsible Enterprise Sidebar */}
      <aside
        className={`sidebar-enterprise ${mobileMenuOpen ? 'mobile-open' : ''} ${
          sidebarCollapsed ? 'collapsed' : ''
        }`}
      >
        {/* Brand Header */}
        <div className="sidebar-brand-wrapper">
          <div className="sidebar-brand-content">
            <div className="sidebar-brand-badge">
              {user?.college_logo_url ? (
                <img
                  src={user.college_logo_url}
                  alt={user.college_name || 'College Logo'}
                  className="sidebar-brand-college-logo"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div style={{ display: user?.college_logo_url ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Building2 size={18} />
              </div>
            </div>
            {!sidebarCollapsed && (
              <div className="sidebar-brand-info">
                <span className="sidebar-brand-title" title={user?.college_name || 'Texify HMS'}>
                  {user?.college_name || 'Texify HMS'}
                </span>
                <span className="sidebar-brand-tag">
                  {user?.college_code ? `${user.college_code} • Admin` : navConfig.brand}
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            className="sidebar-collapse-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>

          <button
            type="button"
            className="sidebar-close-toggle"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Navigation Items */}
        <nav className="sidebar-scrollable-nav">
          {navConfig.navGroups?.map((group) => (
            <div key={group.group} className="sidebar-nav-group">
              {!sidebarCollapsed && (
                <div className="sidebar-group-heading">{group.group}</div>
              )}
              <div className="sidebar-group-items">
                {group.items.map((item) => {
                  const IconComponent = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `sidebar-nav-pill ${isActive ? 'active' : ''}`
                      }
                      title={sidebarCollapsed ? item.label : undefined}
                    >
                      <span className="sidebar-active-indicator" />
                      <div className="sidebar-item-icon-box">
                        <IconComponent size={18} />
                      </div>
                      {!sidebarCollapsed && (
                        <span className="sidebar-item-label">{item.label}</span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom User Footer & Sign Out */}
        <div className="sidebar-footer-card">
          {!sidebarCollapsed ? (
            <div className="sidebar-user-block">
              <div className="sidebar-user-avatar">{userInitials}</div>
              <div className="sidebar-user-details">
                <span className="sidebar-user-name" title={adminEmail}>
                  {adminEmail}
                </span>
                <span className="sidebar-user-role">{adminRoleTitle}</span>
              </div>
              <button
                type="button"
                onClick={logout}
                className="sidebar-logout-icon-btn"
                title="Sign Out"
                aria-label="Sign Out"
                id="btn-sidebar-signout"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={logout}
              className="sidebar-logout-collapsed-btn"
              title="Sign Out"
              aria-label="Sign Out"
              id="btn-sidebar-signout-collapsed"
            >
              <LogOut size={17} />
            </button>
          )}
        </div>
      </aside>

      {/* Main Viewport */}
      <div className="enterprise-viewport">
        {/* Top Header */}
        <header className="enterprise-top-header">
          {/* Breadcrumbs */}
          <div className="header-breadcrumbs-block">
            <div className="header-breadcrumbs">
              <span className="breadcrumb-group">{breadcrumbs.group}</span>
              <ChevronRight size={13} className="breadcrumb-separator" />
              <span className="breadcrumb-active">{breadcrumbs.title}</span>
            </div>
          </div>

          {/* Quick Search */}
          <div className="header-search-wrap">
            <Search size={15} className="header-search-icon" />
            <input
              type="text"
              className="header-search-input"
              placeholder="Search hostel blocks, rooms, students, staff..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Header Right Actions */}
          <div className="header-actions-group">
            <div className="header-status-pill" title="College Database Nominal">
              <span className="status-dot green" />
              <span>Operational</span>
            </div>

            <div className="header-profile-pill">
              <div className="header-avatar-circle">{userInitials}</div>
              <div className="header-profile-text">
                <span className="profile-name" title={adminEmail}>
                  {adminEmail.split('@')[0]}
                </span>
                <span className="profile-role">College Admin</span>
              </div>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="enterprise-main-content">
          <div className="enterprise-page-wrap">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
