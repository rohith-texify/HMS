import React from 'react';
import { NavLink } from 'react-router-dom';

export default function Sidebar() {
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
      </nav>

      <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid #334155', fontSize: '0.75rem', color: '#64748b' }}>
        Super Admin Control Plane
      </div>
    </aside>
  );
}
