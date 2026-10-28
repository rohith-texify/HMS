import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="portal-layout">
      <header className="portal-header">
        <div className="header-inner">
          <div className="brand-group">
            <span className="brand-badge">HMS SEC</span>
            <div>
              <h1 className="portal-title">Campus Security & Gate Portal</h1>
              <p className="portal-subtitle">Access Control, Gates & Leave Verification</p>
            </div>
          </div>
          <div className="user-profile-bar">
            <div className="user-info">
              <span className="user-email">{user?.email}</span>
              <span className="user-role-badge">Security Staff</span>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <nav className="portal-nav">
        <div className="nav-inner">
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/gates"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            Gate Checkpoints
          </NavLink>
          <NavLink
            to="/leaves"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            Approved Outpasses / Leaves
          </NavLink>
          <NavLink
            to="/students"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            Student Directory
          </NavLink>
        </div>
      </nav>

      <main className="portal-main">
        <Outlet />
      </main>

      <footer className="portal-footer">
        <div className="footer-inner">
          <p>© {new Date().getFullYear()} Hostel Management System. Verified Campus Security Session.</p>
          <span className="security-notice">Active Gate Officer Operational Mode</span>
        </div>
      </footer>
    </div>
  );
}
