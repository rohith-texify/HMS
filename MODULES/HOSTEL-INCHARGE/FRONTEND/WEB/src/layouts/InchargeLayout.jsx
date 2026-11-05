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
  LogOut,
  ChevronDown,
  ShieldCheck
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
        style={{
          width: sidebarCollapsed ? '72px' : '260px',
          minWidth: sidebarCollapsed ? '72px' : '260px',
          maxWidth: sidebarCollapsed ? '72px' : '260px',
          height: '100vh',
          position: 'sticky',
          top: 0,
          backgroundColor: '#ffffff',
          borderRight: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          zIndex: 40,
          overflowX: 'hidden',
          transition: 'width 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          boxSizing: 'border-box',
        }}
      >
        {/* Brand Header */}
        <div className="sidebar-brand-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px 0 16px', height: '64px', borderBottom: '1px solid #e2e8f0', flexShrink: 0, minWidth: 0, width: '100%', boxSizing: 'border-box' }}>
          {!sidebarCollapsed ? (
            <div className="sidebar-brand-content" style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: '1 1 auto', overflow: 'hidden' }}>
              <div className="sidebar-brand-badge" style={{ width: '34px', height: '34px', minWidth: '34px', borderRadius: '8px', backgroundColor: '#2563eb', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <BedDouble size={20} />
              </div>
              <div className="sidebar-brand-info" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: '1 1 auto', overflow: 'hidden' }}>
                <span className="sidebar-brand-title" style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', lineHeight: 1.25 }}>
                  Hostel In-Charge
                </span>
                <span className="sidebar-brand-tag" style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', lineHeight: 1.25 }} title={hostelName}>
                  {hostelName}
                </span>
              </div>
            </div>
          ) : (
            <div className="sidebar-brand-badge" style={{ width: '34px', height: '34px', minWidth: '34px', borderRadius: '8px', backgroundColor: '#2563eb', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', flexShrink: 0 }} title="Hostel In-Charge Operations">
              <BedDouble size={20} />
            </div>
          )}

          <button
            type="button"
            className="sidebar-collapse-toggle"
            style={{ width: '26px', height: '26px', minWidth: '26px', borderRadius: '6px', background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 'auto' }}
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
              margin: '8px 12px 12px 12px',
              padding: '8px 12px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Building2 size={15} color="#2563eb" />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: '0.68rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#64748b',
                  fontWeight: 600,
                  lineHeight: 1.2,
                }}
              >
                Active Premises
              </div>
              <div
                style={{
                  fontSize: '0.82rem',
                  color: '#0f172a',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  lineHeight: 1.3,
                }}
                title={hostelName}
              >
                {hostelName}
              </div>
            </div>
          </div>
        )}

        {/* Navigation Group Items */}
        <nav className="sidebar-scrollable-nav" aria-label="Hostel incharge navigation">
          {navConfig.navGroups.map((group) => (
            <div key={group.group} className="sidebar-nav-group">
              {!sidebarCollapsed && (
                <div className="sidebar-group-heading">{group.group}</div>
              )}
              <div className="sidebar-group-items" style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '100%', boxSizing: 'border-box' }}>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `sidebar-nav-pill ${isActive ? 'active' : ''}`
                      }
                      style={({ isActive }) => ({
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        width: '100%',
                        padding: '9px 12px',
                        margin: '1px 0',
                        borderRadius: '8px',
                        textDecoration: 'none',
                        fontSize: '0.84rem',
                        fontWeight: isActive ? 600 : 500,
                        color: isActive ? '#2563eb' : '#475569',
                        backgroundColor: isActive ? '#eff6ff' : 'transparent',
                        boxShadow: isActive ? 'inset 0 0 0 1px rgba(37, 99, 235, 0.2)' : 'none',
                        boxSizing: 'border-box',
                        transition: 'all 0.15s ease',
                      })}
                      title={sidebarCollapsed ? item.label : undefined}
                    >
                      <span className="sidebar-active-indicator" />
                      <div className="sidebar-item-icon-box" style={{ width: '20px', height: '20px', minWidth: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={18} />
                      </div>
                      {!sidebarCollapsed && (
                        <span className="sidebar-item-label" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, textAlign: 'left' }}>
                          {item.label}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom User Footer & Sign Out */}
        <div className="sidebar-footer-card" style={{ padding: '12px 14px', borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc', flexShrink: 0 }}>
          {!sidebarCollapsed ? (
            <div className="sidebar-user-block" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="sidebar-user-avatar" style={{ width: '32px', height: '32px', minWidth: '32px', borderRadius: '50%', backgroundColor: '#2563eb', color: '#ffffff', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {userInitials}
              </div>
              <div className="sidebar-user-details" style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <span className="sidebar-user-name" style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={userEmail}>
                  {user?.roleName || 'Hostel Incharge'}
                </span>
                <span className="sidebar-user-role" style={{ fontSize: '0.7rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={userEmail}>
                  {userEmail}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setLogoutModalOpen(true)}
                className="sidebar-logout-icon-btn"
                style={{ width: '28px', height: '28px', minWidth: '28px', borderRadius: '6px', background: 'transparent', border: 'none', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setLogoutModalOpen(true)}
              className="sidebar-logout-collapsed-btn"
              style={{ width: '36px', height: '36px', margin: '0 auto', borderRadius: '8px', background: '#ffffff', border: '1px solid #e2e8f0', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut size={17} />
            </button>
          )}
        </div>
      </aside>

      {/* Main Viewport Container */}
      <div className="enterprise-viewport" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc', minHeight: '100vh', boxSizing: 'border-box' }}>
        {/* Top Header Bar */}
        <header
          className="enterprise-top-header"
          style={{
            height: '64px',
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            position: 'sticky',
            top: 0,
            zIndex: 30,
            flexShrink: 0,
            boxSizing: 'border-box',
          }}
        >
          <div className="header-breadcrumbs-block">
            <div className="header-breadcrumbs">
              <span className="breadcrumb-group">{breadcrumb.group}</span>
              <ChevronRight size={13} className="breadcrumb-separator" style={{ color: 'var(--text-muted, #94a3b8)' }} />
              <span className="breadcrumb-active">{breadcrumb.title}</span>
            </div>
          </div>

          {/* Header Right Actions */}
          <div className="header-actions-group" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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

            {/* Operational Status Pill */}
            <div className="header-status-pill" title="Hostel Management Operational">
              <span className="status-dot green" />
              <span>Operational</span>
            </div>

            {/* User Profile Dropdown Pill */}
            <div className="header-profile-menu-container" ref={profileMenuRef} style={{ position: 'relative' }}>
              <button
                type="button"
                className="header-profile-pill"
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                style={{
                  cursor: 'pointer',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '4px 12px 4px 6px',
                  borderRadius: '9999px',
                  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                  height: '38px',
                  whiteSpace: 'nowrap',
                  boxSizing: 'border-box',
                }}
                aria-label="Open user profile menu"
              >
                <div
                  className="header-avatar-circle"
                  style={{
                    width: '28px',
                    height: '28px',
                    minWidth: '28px',
                    borderRadius: '50%',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {userInitials}
                </div>
                <div
                  className="header-profile-text"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    textAlign: 'left',
                    lineHeight: 1.15,
                  }}
                >
                  <span
                    className="profile-name"
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: '#0f172a',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '130px',
                      display: 'block',
                    }}
                    title={userEmail}
                  >
                    {user?.roleName || 'Hostel Incharge'}
                  </span>
                  <span
                    className="profile-role"
                    style={{
                      fontSize: '0.68rem',
                      color: '#64748b',
                      whiteSpace: 'nowrap',
                      display: 'block',
                      marginTop: '1px',
                    }}
                  >
                    Verified Incharge
                  </span>
                </div>
                <ChevronDown size={14} style={{ color: '#94a3b8', marginLeft: '2px', flexShrink: 0 }} />
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
                  role="menu"
                >
                  <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9' }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.86rem', color: '#0f172a' }}>{userEmail}</p>
                    <p style={{ margin: '4px 0 0 0', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#16a34a' }}>
                      <ShieldCheck size={12} />
                      <span>{user?.roleName || 'Hostel Incharge'}</span>
                    </p>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                      Hostel: <strong>{hostelName}</strong>
                    </p>
                  </div>

                  <div style={{ padding: '6px' }}>
                    <button
                      type="button"
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        border: 'none',
                        background: 'transparent',
                        borderRadius: '6px',
                        color: '#ef4444',
                        cursor: 'pointer',
                        fontSize: '0.84rem',
                        fontWeight: 500,
                        textAlign: 'left',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fef2f2')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
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

