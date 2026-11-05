import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../shared/auth/useAuth';
import { ROLE_ROUTE_MAP } from '../shared/auth/portalAuthService';
import { FileQuestion, ArrowRight } from 'lucide-react';

export default function NotFoundPage() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleReturn = () => {
    if (isAuthenticated && user?.role && ROLE_ROUTE_MAP[user.role]) {
      navigate(ROLE_ROUTE_MAP[user.role].path, { replace: true });
    } else {
      navigate('/login', { replace: true });
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
        padding: '24px',
      }}
    >
      <div
        className="enterprise-card"
        style={{
          maxWidth: '480px',
          width: '100%',
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '40px 32px',
          textAlign: 'center',
          boxShadow: '0 20px 45px -10px rgba(15, 23, 42, 0.08), 0 8px 16px -6px rgba(15, 23, 42, 0.04)',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            backgroundColor: '#eff6ff',
            color: '#2563eb',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px',
          }}
        >
          <FileQuestion size={32} />
        </div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', marginBottom: '8px', letterSpacing: '-0.02em' }}>
          404 — Page Not Found
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '28px' }}>
          The requested page or resource could not be found on this institutional domain.
        </p>
        <button
          onClick={handleReturn}
          className="btn-enterprise btn-primary-blue"
          style={{ padding: '10px 24px', fontSize: '0.9rem' }}
        >
          <span>Return to Dashboard</span>
          <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}

