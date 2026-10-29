import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import ProtectedRoute from '../routes/ProtectedRoute';
import { Menu, X, Shield } from 'lucide-react';

export default function AdminLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <ProtectedRoute>
      <div className="app-container">
        {/* Mobile Header Bar */}
        <header className="mobile-topbar">
          <div className="mobile-brand">
            <div className="mobile-brand-icon">
              <Shield size={18} />
            </div>
            <span className="mobile-brand-text">HMS Super Admin</span>
          </div>
          <button
            type="button"
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </header>

        {/* Mobile Backdrop Overlay */}
        {mobileMenuOpen && (
          <div
            className="mobile-backdrop"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar Component with mobile state */}
        <Sidebar
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
        />

        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </ProtectedRoute>
  );
}
