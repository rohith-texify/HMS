import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Sidebar() {
  const { user, logout } = useAuth();
  return (
    <aside className="sidebar">
      <div className="sidebar-title">
        <span>🛡️</span>
        <span>HMS Platform</span>
      </div>

      <nav className="sidebar-nav">
        <NavLink
          to="/dashboard"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <span>📊</span>
          <span>Dashboard</span>
        </NavLink>

        <NavLink
          to="/onboarding"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <span>🚀</span>
          <span>Onboarding</span>
        </NavLink>

        <NavLink
          to="/colleges"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <span>🏫</span>
          <span>Colleges</span>
        </NavLink>

        <NavLink
          to="/staff"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <span>👥</span>
          <span>Company Staff</span>
        </NavLink>

        <NavLink
          to="/roles"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <span>🔑</span>
          <span>Roles</span>
        </NavLink>

        <NavLink
          to="/permissions"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <span>🛡️</span>
          <span>Permissions</span>
        </NavLink>

        <NavLink
          to="/access-control"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <span>🔒</span>
          <span>Access Control</span>
        </NavLink>

        <NavLink
          to="/approvals"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <span>📋</span>
          <span>Approvals</span>
        </NavLink>

        <NavLink
          to="/modules"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <span>📦</span>
          <span>Modules</span>
        </NavLink>

        <NavLink
          to="/applications"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <span>📱</span>
          <span>Applications</span>
        </NavLink>

        <NavLink
          to="/system-settings"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <span>⚙️</span>
          <span>System Settings</span>
        </NavLink>
      </nav>

      <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #334155' }}>
        {user && (
          <div style={{ marginBottom: '12px' }}>
            <div
              style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: '#f8fafc',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={user.email}
            >
              {user.email}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#38bdf8', marginTop: '2px' }}>
              {user.roleName || user.role} (Platform)
            </div>
          </div>
        )}

        <button
          onClick={logout}
          id="btn-sidebar-logout"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: '6px',
            color: '#fca5a5',
            fontSize: '0.85rem',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
          }}
        >
          <span>🚪</span>
          <span>Sign Out</span>
        </button>

        <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '12px', textAlign: 'center' }}>
          Super Admin Control Plane
        </div>
      </div>
    </aside>
  );
}
