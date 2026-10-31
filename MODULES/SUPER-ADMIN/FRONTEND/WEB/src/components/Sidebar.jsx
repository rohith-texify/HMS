import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  LayoutDashboard,
  Compass,
  Building2,
  Users,
  KeyRound,
  ShieldCheck,
  Lock,
  FileCheck,
  GitBranch,
  Boxes,
  AppWindow,
  SlidersHorizontal,
  ScrollText,
  Bell,
  Activity,
  BarChart3,
  HelpCircle,
  LogOut,
  ChevronDown,
  ChevronRight,
  Shield,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

export default function Sidebar({ isOpen = false, onClose = () => {} }) {
  const { user, logout } = useAuth();
  const [governanceOpen, setGovernanceOpen] = useState(true);
  const [systemOpen, setSystemOpen] = useState(false);

  const handleLinkClick = () => {
    if (onClose) {
      onClose();
    }
  };

  return (
    <aside className={`shopeers-light-sidebar ${isOpen ? 'mobile-open' : ''}`}>
      {/* Brand Header */}
      <div className="shopeers-light-brand">
        <div className="shopeers-brand-flex">
          <div className="shopeers-brand-logo-wrap">
            <img
              src="/texify-logo.png"
              alt="Texify Technologies"
              className="shopeers-brand-img"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                if (e.currentTarget.nextSibling) {
                  e.currentTarget.nextSibling.style.display = 'flex';
                }
              }}
            />
            <div className="shopeers-fallback-logo" style={{ display: 'none' }}>
              <Shield size={20} className="text-blue-600" />
            </div>
          </div>
          <div className="shopeers-brand-text-block">
            <span className="shopeers-brand-title">Texify Technologies</span>
            <span className="shopeers-brand-badge">Super Admin</span>
          </div>
        </div>

        <button
          type="button"
          className="shopeers-light-close-btn"
          onClick={onClose}
          aria-label="Close sidebar"
        >
          ✕
        </button>
      </div>

      {/* Navigation Menu */}
      <nav className="shopeers-light-nav">
        {/* Core Main Items */}
        <NavLink
          to="/dashboard"
          onClick={handleLinkClick}
          className={({ isActive }) =>
            `shopeers-nav-item ${isActive ? 'active' : ''}`
          }
        >
          <div className="shopeers-item-left">
            <CheckCircle2 size={18} className="shopeers-item-icon check-icon" />
            <span>Dashboard</span>
          </div>
        </NavLink>

        <NavLink
          to="/onboarding"
          onClick={handleLinkClick}
          className={({ isActive }) =>
            `shopeers-nav-item ${isActive ? 'active' : ''}`
          }
        >
          <div className="shopeers-item-left">
            <Compass size={18} className="shopeers-item-icon" />
            <span>Onboarding</span>
          </div>
          <span className="shopeers-badge-green">Pipeline</span>
        </NavLink>

        <NavLink
          to="/colleges"
          onClick={handleLinkClick}
          className={({ isActive }) =>
            `shopeers-nav-item ${isActive ? 'active' : ''}`
          }
        >
          <div className="shopeers-item-left">
            <Building2 size={18} className="shopeers-item-icon" />
            <span>Colleges</span>
          </div>
          <span className="shopeers-badge-count">24</span>
        </NavLink>

        <NavLink
          to="/reports"
          onClick={handleLinkClick}
          className={({ isActive }) =>
            `shopeers-nav-item ${isActive ? 'active' : ''}`
          }
        >
          <div className="shopeers-item-left">
            <BarChart3 size={18} className="shopeers-item-icon" />
            <span>Analytics</span>
          </div>
        </NavLink>

        {/* Collapsible Group: Governance & Access */}
        <div className="shopeers-nav-collapsible">
          <button
            type="button"
            className="shopeers-group-header-btn"
            onClick={() => setGovernanceOpen(!governanceOpen)}
          >
            <div className="shopeers-item-left">
              <KeyRound size={18} className="shopeers-item-icon" />
              <span>Governance</span>
            </div>
            {governanceOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>

          {governanceOpen && (
            <div className="shopeers-sub-items">
              <NavLink
                to="/staff"
                onClick={handleLinkClick}
                className={({ isActive }) =>
                  `shopeers-sub-item ${isActive ? 'active' : ''}`
                }
              >
                <span>Company Staff</span>
              </NavLink>

              <NavLink
                to="/roles"
                onClick={handleLinkClick}
                className={({ isActive }) =>
                  `shopeers-sub-item ${isActive ? 'active' : ''}`
                }
              >
                <span>Roles & Hierarchy</span>
              </NavLink>

              <NavLink
                to="/permissions"
                onClick={handleLinkClick}
                className={({ isActive }) =>
                  `shopeers-sub-item ${isActive ? 'active' : ''}`
                }
              >
                <span>Permissions</span>
              </NavLink>

              <NavLink
                to="/access-control"
                onClick={handleLinkClick}
                className={({ isActive }) =>
                  `shopeers-sub-item ${isActive ? 'active' : ''}`
                }
              >
                <span>Access Control</span>
              </NavLink>

              <NavLink
                to="/approvals"
                onClick={handleLinkClick}
                className={({ isActive }) =>
                  `shopeers-sub-item ${isActive ? 'active' : ''}`
                }
              >
                <span>Approvals</span>
              </NavLink>
            </div>
          )}
        </div>

        {/* Collapsible Group: Operations & System */}
        <div className="shopeers-nav-collapsible">
          <button
            type="button"
            className="shopeers-group-header-btn"
            onClick={() => setSystemOpen(!systemOpen)}
          >
            <div className="shopeers-item-left">
              <Boxes size={18} className="shopeers-item-icon" />
              <span>Operations</span>
            </div>
            {systemOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>

          {systemOpen && (
            <div className="shopeers-sub-items">
              <NavLink
                to="/modules"
                onClick={handleLinkClick}
                className={({ isActive }) =>
                  `shopeers-sub-item ${isActive ? 'active' : ''}`
                }
              >
                <span>Modules</span>
              </NavLink>

              <NavLink
                to="/applications"
                onClick={handleLinkClick}
                className={({ isActive }) =>
                  `shopeers-sub-item ${isActive ? 'active' : ''}`
                }
              >
                <span>Applications Hub</span>
              </NavLink>

              <NavLink
                to="/change-sets"
                onClick={handleLinkClick}
                className={({ isActive }) =>
                  `shopeers-sub-item ${isActive ? 'active' : ''}`
                }
              >
                <span>Change Sets</span>
              </NavLink>

              <NavLink
                to="/audit-logs"
                onClick={handleLinkClick}
                className={({ isActive }) =>
                  `shopeers-sub-item ${isActive ? 'active' : ''}`
                }
              >
                <span>Audit Logs</span>
              </NavLink>

              <NavLink
                to="/monitoring"
                onClick={handleLinkClick}
                className={({ isActive }) =>
                  `shopeers-sub-item ${isActive ? 'active' : ''}`
                }
              >
                <span>Telemetry</span>
              </NavLink>
            </div>
          )}
        </div>

        {/* Supporting Secondary Items */}
        <NavLink
          to="/system-settings"
          onClick={handleLinkClick}
          className={({ isActive }) =>
            `shopeers-nav-item ${isActive ? 'active' : ''}`
          }
        >
          <div className="shopeers-item-left">
            <SlidersHorizontal size={18} className="shopeers-item-icon" />
            <span>Settings</span>
          </div>
        </NavLink>

        <NavLink
          to="/support"
          onClick={handleLinkClick}
          className={({ isActive }) =>
            `shopeers-nav-item ${isActive ? 'active' : ''}`
          }
        >
          <div className="shopeers-item-left">
            <HelpCircle size={18} className="shopeers-item-icon" />
            <span>Help & Support</span>
          </div>
        </NavLink>
      </nav>

      {/* Bottom Promo Card (Exact Shopeers Style Dark Blue Gradient Card) */}
      <div className="shopeers-premium-banner">
        <div className="shopeers-banner-icon-wrap">
          <Sparkles size={16} />
        </div>
        <div className="shopeers-banner-title">Upgrade to Premium!</div>
        <div className="shopeers-banner-text">
          Upgrade your account and unlock all of the benefits.
        </div>
        <button
          type="button"
          className="shopeers-banner-btn"
          onClick={() => {}}
        >
          <span>Upgrade premium</span>
        </button>
        <button
          type="button"
          onClick={logout}
          className="shopeers-logout-text-btn"
          id="btn-sidebar-logout"
          title="Sign out of Super Admin"
        >
          <LogOut size={12} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
