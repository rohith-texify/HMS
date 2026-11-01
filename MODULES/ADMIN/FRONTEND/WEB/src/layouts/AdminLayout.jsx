import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getFilteredNavigation, resolveBreadcrumb } from './roleNavigation';
import NotificationDisplay from '../components/NotificationDisplay';
import {
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Search,
  LogOut,
  Building2,
  Shield,
  User,
  ChevronDown,
} from 'lucide-react';
import '../styles/layout.css';

export default function InstitutionalLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const profileMenuRef = useRef(null);

  const userRole = (user?.role || 'COLLEGE_ADMIN').toUpperCase();
  const navConfig = getFilteredNavigation(userRole, user?.permissions);

  const adminEmail = user?.email || 'admin@college.edu';
  const adminRoleTitle = user?.roleName || 'College Administrator';
  const userInitials = (adminEmail.slice(0, 2) || 'AD').toUpperCase();
  const collegeName = user?.collegeName || user?.collegeCode || navConfig.brand;

  // Dynamically derive active breadcrumbs
  const breadcrumbs = resolveBreadcrumb(location.pathname, navConfig);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setProfileMenuOpen(false);
      }
    };
    if (profileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [profileMenuOpen]);

  return (
    <div className={`enterprise-shell ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
      {/* Mobile Topbar */}
      <header className="enterprise-mobile-bar">
        <div className="mobile-bar-brand">
          <div className="mobile-bar-badge">
            <Building2 size={16} />
          </div>
          <span className="mobile-bar-title">{collegeName}</span>
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
              <Building2 size={18} />
            </div>
            {!sidebarCollapsed && (
              <div className="sidebar-brand-info">
                <span className="sidebar-brand-title">Texify HMS</span>
                <span className="sidebar-brand-tag" title={collegeName}>{collegeName}</span>
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
            {/* Notification Center */}
            <NotificationDisplay />

            {/* Operational Status Pill */}
            <div className="header-status-pill" title="College Database Connected & Nominal">
              <span className="status-dot green" />
              <span>Operational</span>
            </div>

            {/* User Profile Dropdown Pill */}
            <div className="header-profile-menu-container" ref={profileMenuRef} style={{ position: 'relative' }}>
              <button
                type="button"
                className="header-profile-pill"
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                style={{ cursor: 'pointer', border: '1px solid var(--border-color)', background: '#ffffff' }}
                aria-label="Open user profile menu"
              >
                <div className="header-avatar-circle">{userInitials}</div>
                <div className="header-profile-text">
                  <span className="profile-name" title={adminEmail}>
                    {adminEmail.split('@')[0]}
                  </span>
                  <span className="profile-role">{adminRoleTitle}</span>
                </div>
                <ChevronDown size={14} style={{ color: 'var(--text-muted, #94a3b8)', marginLeft: '2px' }} />
              </button>

              {profileMenuOpen && (
                <div
                  className="profile-dropdown-card fade-in-up"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    width: '260px',
                    backgroundColor: '#ffffff',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                    zIndex: 85,
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color, #e2e8f0)', backgroundColor: '#f8fafc' }}>
                    <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
                      {adminEmail}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--primary-color, #2563eb)', fontWeight: 600, marginTop: '2px' }}>
                      {adminRoleTitle}
                    </div>
                    {user?.collegeId && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)', marginTop: '4px' }}>
                        Tenant ID: <span className="code-pill">{user.collegeId.slice(0, 8)}...</span>
                      </div>
                    )}
                  </div>

                  <div style={{ padding: '6px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        logout();
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '9px 12px',
                        borderRadius: '6px',
                        border: 'none',
                        background: 'transparent',
                        color: '#dc2626',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fef2f2')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <LogOut size={15} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
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
