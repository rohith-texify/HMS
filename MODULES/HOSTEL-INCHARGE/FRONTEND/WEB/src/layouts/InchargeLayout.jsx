import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getFilteredNavigation, resolveBreadcrumbs } from './inchargeNavigation';
import ConfirmationDialog from '../components/ConfirmationDialog';
import {
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Building2,
  BedDouble,
  User,
  LogOut,
  ChevronDown,
  ShieldCheck,
} from 'lucide-react';
import '../styles/layout.css';

export default function InchargeLayout() {
  const { user, assignedHostel, logout } = useAuth();
  const location = useLocation();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const profileMenuRef = useRef(null);

  const navConfig = getFilteredNavigation(user);
  const breadcrumb = resolveBreadcrumbs(location.pathname);

  const userEmail = user?.email || 'incharge@college.edu';
  const userInitials = (userEmail.slice(0, 2) || 'IN').toUpperCase();
  const collegeName = user?.collegeName || user?.collegeCode || 'Institutional Campus';
  const hostelName = assignedHostel?.name || assignedHostel?.hostel_name || 'Assigned Hostel';

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

  // Close mobile drawer on route transition
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className={`enterprise-shell ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
      {/* Mobile Topbar */}
      <header className="enterprise-mobile-bar">
        <div className="mobile-bar-brand">
          <div className="mobile-bar-badge">
            <BedDouble size={16} />
          </div>
          <span className="mobile-bar-title">{hostelName}</span>
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
          {!sidebarCollapsed ? (
            <div className="sidebar-brand-content">
              <div className="sidebar-brand-badge">
                <BedDouble size={20} />
              </div>
              <div className="sidebar-brand-text-block">
                <span className="sidebar-brand-name">Hostel In-Charge</span>
                <span className="sidebar-brand-sub" title={hostelName}>
                  {hostelName}
                </span>
              </div>
            </div>
          ) : (
            <div className="sidebar-brand-badge" title="Hostel In-Charge Operations">
              <BedDouble size={20} />
            </div>
          )}

          <button
            type="button"
            className="sidebar-collapse-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            aria-label={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Assigned Hostel Scope Pill */}
        {!sidebarCollapsed && (
          <div
            style={{
              margin: '8px 16px 12px 16px',
              padding: '8px 12px',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Building2 size={14} color="#60a5fa" />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: '0.72rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#94a3b8',
                  fontWeight: 600,
                }}
              >
                Active Premises
              </div>
              <div
                style={{
                  fontSize: '0.82rem',
                  color: '#f8fafc',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={hostelName}
              >
                {hostelName}
              </div>
            </div>
          </div>
        )}

        {/* Navigation Group Items */}
        <nav className="sidebar-nav-container" aria-label="Hostel incharge navigation">
          {navConfig.navGroups.map((group) => (
            <div key={group.group} className="sidebar-nav-group">
              {!sidebarCollapsed && (
                <div className="sidebar-nav-group-heading">{group.group}</div>
              )}
              <div className="sidebar-nav-items-list">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={({ isActive }) =>
                        `sidebar-nav-link ${isActive ? 'is-active' : ''}`
                      }
                      title={sidebarCollapsed ? item.label : undefined}
                    >
                      <span className="sidebar-nav-icon-slot">
                        <Icon size={18} />
                      </span>
                      {!sidebarCollapsed && (
                        <span className="sidebar-nav-text-slot">{item.label}</span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Sidebar Footer User Info */}
        <div className="sidebar-footer-block">
          <div
            className="sidebar-user-card"
            onClick={() => setProfileMenuOpen(true)}
            title="Account Options"
          >
            <div className="sidebar-user-avatar">{userInitials}</div>
            {!sidebarCollapsed && (
              <div className="sidebar-user-details">
                <span className="sidebar-user-name">
                  {user?.roleName || 'Hostel Incharge'}
                </span>
                <span className="sidebar-user-role" title={userEmail}>
                  {userEmail}
                </span>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Viewport Container */}
      <div className="enterprise-viewport">
        {/* Top Header Bar */}
        <header className="enterprise-top-header">
          <div className="header-breadcrumbs-block">
            <div className="header-breadcrumbs">
              <span className="breadcrumb-group">{breadcrumb.group}</span>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-active-title">{breadcrumb.title}</span>
            </div>
          </div>

          {/* Header Right Actions */}
          <div className="header-actions-block">
            {/* College & Hostel Identity Badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="hostel-badge-tag" title="Assigned Hostel">
                <BedDouble size={13} />
                <span>{hostelName}</span>
              </span>

              {collegeName && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#f1f5f9',
                    color: '#475569',
                    border: '1px solid #e2e8f0',
                    padding: '4px 10px',
                    borderRadius: '9999px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                  }}
                  title={collegeName}
                >
                  <Building2 size={13} />
                  <span>{collegeName}</span>
                </span>
              )}
            </div>

            {/* User Profile Menu */}
            <div className="profile-menu-container" ref={profileMenuRef}>
              <button
                type="button"
                className="profile-menu-trigger"
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                aria-haspopup="true"
                aria-expanded={profileMenuOpen}
              >
                <div className="profile-menu-avatar">{userInitials}</div>
                <div className="profile-menu-meta">
                  <span className="profile-name">
                    {user?.roleName || 'Hostel Incharge'}
                  </span>
                  <span className="profile-role">Verified Incharge</span>
                </div>
                <ChevronDown size={14} className="profile-chevron" />
              </button>

              {profileMenuOpen && (
                <div className="profile-dropdown-card" role="menu">
                  <div className="dropdown-account-header">
                    <p className="account-email">{userEmail}</p>
                    <p className="account-role-badge">
                      <ShieldCheck size={12} />
                      <span>{user?.roleName || 'Hostel Incharge'}</span>
                    </p>
                    <p
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        marginTop: '4px',
                      }}
                    >
                      Hostel: <strong>{hostelName}</strong>
                    </p>
                  </div>

                  <div className="dropdown-divider" />

                  <button
                    type="button"
                    className="dropdown-menu-item item-danger"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      setLogoutModalOpen(true);
                    }}
                    role="menuitem"
                  >
                    <LogOut size={16} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content Rendering Area */}
        <main className="enterprise-main-content">
          <div className="enterprise-page-wrap">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Logout Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={logoutModalOpen}
        onClose={() => setLogoutModalOpen(false)}
        onConfirm={logout}
        title="Sign Out of Hostel In-Charge Portal"
        message="Are you sure you want to sign out? Your active session will be securely terminated."
        confirmText="Sign Out"
        cancelText="Stay Signed In"
        type="danger"
      />
    </div>
  );
}

