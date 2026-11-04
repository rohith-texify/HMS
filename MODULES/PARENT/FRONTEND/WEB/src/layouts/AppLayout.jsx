import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);

  useEffect(() => {
    setIsNavigationOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isNavigationOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsNavigationOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isNavigationOpen]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="portal-layout">
      <header className="portal-header">
        <div className="header-inner">
          <button
            type="button"
            className="navigation-toggle"
            aria-expanded={isNavigationOpen}
            aria-controls="parent-navigation"
            onClick={() => setIsNavigationOpen((isOpen) => !isOpen)}
          >
            <span className="sr-only">
              {isNavigationOpen ? 'Close navigation' : 'Open navigation'}
            </span>
            <span aria-hidden="true">{isNavigationOpen ? '×' : '☰'}</span>
          </button>
          <div className="brand-group">
            <NavLink to="/dashboard" className="brand-badge" aria-label="HMS Parent overview">
              HMS
            </NavLink>
            <div>
              <h1 className="portal-title">Parent & Guardian Portal</h1>
              <p className="portal-subtitle">Secure college account</p>
            </div>
          </div>
          <div className="user-profile-bar">
            <div className="user-info">
              {user?.email && <span className="user-email">{user.email}</span>}
              <span className="user-role-badge">Parent / Guardian</span>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="portal-shell">
        {isNavigationOpen && (
          <button
            type="button"
            className="navigation-backdrop"
            aria-label="Close navigation"
            onClick={() => setIsNavigationOpen(false)}
          />
        )}
        <aside
          id="parent-navigation"
          className={`portal-sidebar${isNavigationOpen ? ' is-open' : ''}`}
          aria-label="Parent portal navigation"
        >
          <div className="sidebar-heading">Parent portal</div>
          <nav className="portal-nav">
            <NavLink
              to="/dashboard"
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              end
            >
              Overview
            </NavLink>
            <NavLink
              to="/updates"
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              Visitors, parcels &amp; notifications
            </NavLink>
          </nav>
          <p className="sidebar-notice">
            Ward and leave information is unavailable until parent-specific access is verified.
          </p>
        </aside>

        <main className="portal-main" id="main-content">
          <Outlet />
        </main>
      </div>

      <footer className="portal-footer">
        <div className="footer-inner">
          <p>© {new Date().getFullYear()} Hostel Management System</p>
          <span className="security-notice">Parent portal</span>
        </div>
      </footer>
    </div>
  );
}
