import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../shared/auth/useAuth';
import { ROLE_ROUTE_MAP, getAuthorizedRedirectPath, normalizeRoleCode, PORTAL_URL } from '../hooks/portalAuthService';
import { ShieldAlert, ArrowRight, LogOut } from 'lucide-react';

export default function UnauthorizedPage() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const userRole = normalizeRoleCode(user?.role || user?.roleName || '');
  const authorizedPath = getAuthorizedRedirectPath(userRole, null);

  // Automatically redirect authenticated institutional accounts away from the error page to their authorized home dashboard
  useEffect(() => {
    if (PORTAL_URL && ['HOSTEL_INCHARGE', 'SECURITY', 'STUDENT', 'PARENT'].includes(userRole)) {
      window.location.replace(`${PORTAL_URL}${authorizedPath}`);
      return;
    }
    if (authorizedPath && authorizedPath !== '/login' && authorizedPath !== '/unauthorized') {
      navigate(authorizedPath, { replace: true });
    }
  }, [authorizedPath, userRole, navigate]);

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
          maxWidth: '520px',
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
            backgroundColor: '#fee2e2',
            color: '#dc2626',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px',
          }}
        >
          <ShieldAlert size={34} />
        </div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', marginBottom: '8px', letterSpacing: '-0.02em' }}>
          Access Restricted
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '24px' }}>
          Your current account role (<strong>{user?.roleName || user?.role || 'Guest'}</strong>) is not authorized to access the requested module.
        </p>

        {location.state?.attemptedPath && (
          <div
            style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '0.82rem',
              color: '#991b1b',
              marginBottom: '24px',
              fontFamily: 'monospace',
            }}
          >
            Attempted route: {location.state.attemptedPath}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={() => {
              if (PORTAL_URL && ['HOSTEL_INCHARGE', 'SECURITY', 'STUDENT', 'PARENT'].includes(userRole)) {
                window.location.replace(`${PORTAL_URL}${authorizedPath}`);
              } else {
                navigate(authorizedPath, { replace: true });
              }
            }}
            className="btn-enterprise btn-primary-blue"
            style={{ padding: '11px 20px', fontSize: '0.92rem' }}
          >
            <span>Return to Your Authorized Dashboard</span>
            <ArrowRight size={15} />
          </button>

          <button
            onClick={logout}
            className="btn-enterprise btn-outline-soft"
            style={{ padding: '10px 20px', fontSize: '0.88rem' }}
          >
            <LogOut size={15} />
            <span>Sign Out & Switch Account</span>
          </button>
        </div>
      </div>
    </div>
  );
}

