import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { ROLE_NAVIGATION } from '../routing/roleNavigation';
import '../styles/layout.css';

export default function InstitutionalLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const userRole = (user?.role || '').toUpperCase();
  const navConfig = ROLE_NAVIGATION[userRole] || {
    brand: 'HMS Institutional Portal',
    icon: '🏫',
    basePath: '/',
    navItems: [],
  };

  return (
    <div className="institutional-shell">
      {/* Sidebar */}
      <aside className="institutional-sidebar">
        <div className="sidebar-brand">
          <span className="brand-icon">{navConfig.icon}</span>
          <div>
            <div className="brand-title">{navConfig.brand}</div>
            <div className="brand-subtitle">HMS Platform</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navConfig.navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          {user && (
            <div className="user-info">
              <div className="user-email" title={user.email}>
                {user.email}
              </div>
              <div className="user-role-badge">
                {user.roleName || user.role}
              </div>
            </div>
          )}
          <button onClick={logout} className="btn-signout" id="btn-sign-out">
            <span>🚪</span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="institutional-main">
        <header className="institutional-topbar">
          <div className="topbar-left">
            <span className="topbar-module-badge">{navConfig.brand}</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {location.pathname}
            </span>
          </div>

          <div className="topbar-right">
            <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 600 }}>
              ● Connected
            </span>
          </div>
        </header>

        <main className="content-wrapper">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

