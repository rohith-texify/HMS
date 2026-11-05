import React from 'react';
import { ShieldAlert, ArrowLeft, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function UnauthorizedState({
  title = 'Access Denied',
  message = 'You do not have the required permissions or assigned hostel scope to access this operation.',
  onBack,
  showLogout = true,
}) {
  const navigate = useNavigate();
  const { logout } = useAuth();

  return (
    <div className="card" style={{ maxWidth: '600px', margin: '40px auto', textAlign: 'center', padding: '40px 32px' }}>
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          backgroundColor: 'var(--danger-bg)',
          color: 'var(--danger-text)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px auto',
        }}
      >
        <ShieldAlert size={32} />
      </div>

      <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
        {title}
      </h2>

      <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '28px' }}>
        {message}
      </p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => (onBack ? onBack() : navigate('/dashboard'))}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <ArrowLeft size={16} />
          <span>Return to Dashboard</span>
        </button>

        {showLogout && (
          <button
            type="button"
            className="btn btn-danger"
            onClick={logout}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        )}
      </div>
    </div>
  );
}

