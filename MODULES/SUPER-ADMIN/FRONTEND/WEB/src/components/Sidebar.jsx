import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  LayoutDashboard,
  Compass,
  Rocket,
  Building2,
  Users,
  KeyRound,
  ShieldCheck,
  Lock,
  AppWindow,
  FileCheck,
  GitBranch,
  Boxes,
  SlidersHorizontal,
  ScrollText,
  Bell,
  Activity,
  BarChart3,
  HelpCircle,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
  UserCheck,
  X,
} from 'lucide-react';

export default function Sidebar({
  isOpen = false,
  onClose = () => {},
  isCollapsed = false,
  onToggleCollapse = () => {},
}) {
  const { user, logout } = useAuth();

  const handleLinkClick = () => {
    if (onClose) {
      onClose();
    }
  };

  const navGroups = [
    {
      group: 'Overview',
      items: [
        { label: 'Dashboard', to: '/dashboard', icon: Compass },
      ],
    },
    {
      group: 'Management',
      items: [
        { label: 'Onboarding', to: '/onboarding', icon: Rocket },
        { label: 'Colleges', to: '/colleges', icon: Building2 },
        { label: 'Company Staff', to: '/staff', icon: Users },
        { label: 'Roles', to: '/roles', icon: KeyRound },
        { label: 'Permissions', to: '/permissions', icon: ShieldCheck },
        { label: 'Access Control', to: '/access-control', icon: Lock },
      ],
    },
    {
      group: 'Operations',
      items: [
        { label: 'Applications', to: '/applications', icon: AppWindow },
        { label: 'Approvals', to: '/approvals', icon: FileCheck },
        { label: 'Change Sets', to: '/change-sets', icon: GitBranch },
      ],
    },
    {
      group: 'Platform',
      items: [
        { label: 'Modules', to: '/modules', icon: Boxes },
        { label: 'System Settings', to: '/system-settings', icon: SlidersHorizontal },
        { label: 'Audit Logs', to: '/audit-logs', icon: ScrollText },
        { label: 'Notifications', to: '/notifications', icon: Bell },
        { label: 'Monitoring', to: '/monitoring', icon: Activity },
        { label: 'Reports & Analytics', to: '/reports', icon: BarChart3 },
        { label: 'Support Console', to: '/support', icon: HelpCircle },
      ],
    },
  ];

  const adminEmail =
    user?.email && !user.email.endsWith('@hms.local') && !user.email.includes('superadmin')
      ? user.email
      : 'rohith.texify@gmail.com';

  const adminRole = user?.roleName || user?.role || 'Super Administrator';

  return (
    <aside
      className={`sidebar-enterprise ${isOpen ? 'mobile-open' : ''} ${
        isCollapsed ? 'collapsed' : ''
      }`}
    >
      {/* Brand Header */}
      <div className="sidebar-brand-wrapper">
        <div className="sidebar-brand-content">
          <div className="sidebar-brand-badge">
            <Shield size={18} className="text-white" />
          </div>
          {!isCollapsed && (
            <div className="sidebar-brand-info">
              <span className="sidebar-brand-title">HMS Platform</span>
              <span className="sidebar-brand-tag">Super Admin</span>
            </div>
          )}
        </div>

        {/* Desktop Collapse Toggle */}
        <button
          type="button"
          className="sidebar-collapse-toggle desktop-only"
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>

        {/* Mobile Close Button */}
        <button
          type="button"
          className="sidebar-close-toggle mobile-only"
          onClick={onClose}
          aria-label="Close sidebar"
        >
          <X size={16} />
        </button>
      </div>

      {/* Navigation Groups */}
      <nav className="sidebar-scrollable-nav">
        {navGroups.map((group) => (
          <div key={group.group} className="sidebar-nav-group">
            {!isCollapsed && (
              <div className="sidebar-group-heading">{group.group}</div>
            )}
            <div className="sidebar-group-items">
              {group.items.map((item) => {
                const IconComponent = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={handleLinkClick}
                    title={isCollapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      `sidebar-nav-pill ${isActive ? 'active' : ''}`
                    }
                  >
                    <span className="sidebar-active-indicator" />
                    <span className="sidebar-item-icon-box">
                      <IconComponent size={14} className="sidebar-icon-svg" />
                    </span>
                    {!isCollapsed && (
                      <span className="sidebar-item-text">{item.label}</span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Admin Identity & Footer */}
      <div className="sidebar-footer-container">
        {!isCollapsed ? (
          <div className="sidebar-user-card">
            <div className="sidebar-user-avatar">
              {adminEmail.slice(0, 2).toUpperCase()}
            </div>
            <div className="sidebar-user-details">
              <span className="sidebar-user-name" title={adminEmail}>
                {adminEmail}
              </span>
              <span className="sidebar-user-role">{adminRole}</span>
            </div>
            <button
              onClick={logout}
              id="btn-sidebar-logout"
              className="sidebar-logout-icon-btn"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <button
            onClick={logout}
            id="btn-sidebar-logout"
            className="sidebar-logout-collapsed-btn"
            title="Sign Out"
            aria-label="Sign Out"
          >
            <LogOut size={17} />
          </button>
        )}
      </div>
    </aside>
  );
}
