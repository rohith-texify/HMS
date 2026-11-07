import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import useAuth from '../hooks/useAuth';
import { getParentNavigation } from '../config/navigation';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  const navigation = getParentNavigation(user);

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
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <button
            type="button"
            className="menu-toggle"
            aria-expanded={isNavigationOpen}
            aria-controls="primary-navigation"
            onClick={() => setIsNavigationOpen((isOpen) => !isOpen)}
          >
            <span className="sr-only">{isNavigationOpen ? 'Close navigation' : 'Open navigation'}</span>
            {isNavigationOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
          <NavLink to="/dashboard" className="brand" aria-label="Parent portal home">
            <span className="brand-mark">H</span>
            <span>
              <strong>Parent portal</strong>
              <small>Hostel Management System</small>
            </span>
          </NavLink>
          <div className="account-controls">
            <span className="account-email">{user?.email}</span>
            <button type="button" className="button button-secondary" onClick={handleLogout}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="app-body">
        {isNavigationOpen && (
          <button type="button" className="navigation-backdrop" aria-label="Close navigation" onClick={() => setIsNavigationOpen(false)} />
        )}
        <aside id="primary-navigation" className={`sidebar${isNavigationOpen ? ' is-open' : ''}`} aria-label="Parent navigation">
          <p className="sidebar-label">Available services</p>
          <nav className="primary-navigation">
            {navigation.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/dashboard'}
                onClick={() => setIsNavigationOpen(false)}
                className={({ isActive }) => `navigation-link${isActive ? ' active' : ''}`}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="main-content" id="main-content">
          <Outlet />
        </main>
      </div>

      <footer className="app-footer">Hostel Management System</footer>
    </div>
  );
}
