import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-title">
          <span>🏛️</span>
          <span>College Admin</span>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span>📊</span>
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/students" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span>🎓</span>
            <span>Students</span>
          </NavLink>
          <NavLink to="/staff" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span>👥</span>
            <span>College Staff</span>
          </NavLink>
          <NavLink to="/hostels" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span>🏢</span>
            <span>Hostels & Blocks</span>
          </NavLink>
        </nav>

        <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #1e293b' }}>
          {user && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc' }}>{user.email}</div>
              <div style={{ fontSize: '0.75rem', color: '#38bdf8' }}>{user.roleName || user.role}</div>
            </div>
          )}
          <button
            onClick={logout}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '6px',
              color: '#fca5a5',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            <span>🚪</span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
