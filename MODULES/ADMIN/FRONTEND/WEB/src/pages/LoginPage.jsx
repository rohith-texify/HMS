import React, { useEffect } from 'react';

const PORTAL_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PORTAL_URL) ||
  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5173'
    : '');

/**
 * College Admin Standalone Login Forwarder
 * 
 * Standalone login entry points are retired. All authentication must occur
 * through the Unified Login Portal at http://localhost:5173/login.
 */
export default function LoginPage({ initialPersona = 'COLLEGE_ADMIN' }) {
  const targetUrl = `${PORTAL_URL}/admin/login`;

  useEffect(() => {
    window.location.replace(targetUrl);
  }, [targetUrl]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        background: '#f8fafc',
        color: '#1e293b',
        padding: '24px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          maxWidth: '460px',
          width: '100%',
          padding: '36px',
          background: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
          border: '1px solid #e2e8f0',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '14px',
            background: '#e0e7ff',
            color: '#4338ca',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            marginBottom: '16px',
          }}
        >
          🏛️
        </div>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>
          Redirecting to Unified Login Portal
        </h2>
        <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '0 0 24px', lineHeight: 1.5 }}>
          College Administration authentication has been centralized into the Unified Campus Portal.
        </p>
        <a
          href={targetUrl}
          style={{
            display: 'inline-block',
            padding: '12px 24px',
            background: '#4f46e5',
            color: '#ffffff',
            borderRadius: '8px',
            textDecoration: 'none',
            fontSize: '0.9rem',
            fontWeight: 600,
            boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2)',
          }}
        >
          Sign In via Unified Portal →
        </a>
      </div>
    </div>
  );
}
