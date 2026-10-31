import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  LayoutDashboard,
  Compass,
  Building2,
  Users,
  KeyRound,
  ShieldCheck,
  LockKeyhole,
  FileCheck2,
  GitBranch,
  Boxes,
  AppWindow,
  SlidersHorizontal,
  ScrollText,
  Bell,
  Activity,
  BarChart3,
  LifeBuoy,
  LogOut,
  Sparkles,
} from 'lucide-react';

export default function Sidebar({ isOpen = false, onClose = () => {} }) {
  const { user, logout } = useAuth();

  const handleLinkClick = () => {
    if (onClose) {
      onClose();
    }
  };

  const navSections = [
    {
      title: 'PLATFORM & ANALYTICS',
      items: [
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/onboarding', label: 'Onboarding Pipeline', icon: Compass },
        { to: '/colleges', label: 'Colleges & Campuses', icon: Building2 },
        { to: '/reports', label: 'Reports & Analytics', icon: BarChart3 },
      ],
    },
    {
      title: 'GOVERNANCE & ACCESS',
      items: [
        { to: '/staff', label: 'Company Staff', icon: Users },
        { to: '/roles', label: 'Roles & Hierarchy', icon: KeyRound },
        { to: '/permissions', label: 'Permissions Catalog', icon: ShieldCheck },
        { to: '/access-control', label: 'Access Control', icon: LockKeyhole },
        { to: '/approvals', label: 'Approvals & Workflows', icon: FileCheck2 },
      ],
    },
    {
      title: 'SYSTEM & MODULES',
      items: [
        { to: '/change-sets', label: 'Change Management', icon: GitBranch },
        { to: '/modules', label: 'Modules & Entitlements', icon: Boxes },
        { to: '/applications', label: 'Applications Hub', icon: AppWindow },
        { to: '/system-settings', label: 'System Settings', icon: SlidersHorizontal },
        { to: '/audit-logs', label: 'Audit Logs', icon: ScrollText },
        { to: '/notifications', label: 'Notifications Hub', icon: Bell },
        { to: '/monitoring', label: 'Telemetry & Health', icon: Activity },
        { to: '/support', label: 'Support Console', icon: LifeBuoy },
      ],
    },
  ];

  return (
    <aside className={`shopeers-sidebar ${isOpen ? 'mobile-open' : ''}`}>
      {/* Brand Header */}
      <div className="shopeers-brand-header">
        <div className="shopeers-brand-container">
          <div className="shopeers-logo-frame">
            <img
              src="/texify-logo.png"
              alt="Texify Technologies"
              className="shopeers-brand-logo"
              onError={(e) => {
                // Graceful fallback to high-tech typography if image loading fails
                e.currentTarget.style.display = 'none';
                if (e.currentTarget.nextSibling) {
                  e.currentTarget.nextSibling.style.display = 'flex';
                }
              }}
            />
            <div className="shopeers-fallback-badge" style={{ display: 'none' }}>
              <Sparkles size={18} className="text-blue-400" />
            </div>
          </div>
          <div className="shopeers-brand-meta">
            <div className="shopeers-brand-name">Texify Technologies</div>
            <div className="shopeers-brand-tagline">
              <span className="shopeers-status-dot" />
              <span>Control Plane</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="shopeers-close-btn"
          onClick={onClose}
          aria-label="Close sidebar"
        >
          ✕
        </button>
      </div>

      {/* Grouped Navigation */}
      <nav className="shopeers-nav">
        {navSections.map((section) => (
          <div key={section.title} className="shopeers-nav-group">
            <div className="shopeers-group-title">{section.title}</div>
            <div className="shopeers-group-items">
              {section.items.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={handleLinkClick}
                  className={({ isActive }) =>
                    `shopeers-nav-link ${isActive ? 'active' : ''}`
                  }
                >
                  <Icon size={18} className="shopeers-nav-icon" />
                  <span className="shopeers-nav-text">{label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User Session Profile & Sign Out Footer */}
      <div className="shopeers-user-card">
        <div className="shopeers-user-info">
          <div className="shopeers-user-avatar">
            {(user?.email?.[0] || 'T').toUpperCase()}
          </div>
          <div className="shopeers-user-details">
            <div
              className="shopeers-user-email"
              title={user?.email || 'rohith.texify@gmail.com'}
            >
              {user?.email || 'rohith.texify@gmail.com'}
            </div>
            <div className="shopeers-user-role">
              {user?.roleName || user?.role || 'Super Administrator'}
            </div>
          </div>
        </div>

        <button
          onClick={logout}
          id="btn-sidebar-logout"
          className="shopeers-logout-btn"
          title="Sign out of platform"
        >
          <LogOut size={15} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
