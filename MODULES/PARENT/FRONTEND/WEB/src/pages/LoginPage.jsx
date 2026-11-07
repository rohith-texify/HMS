import React, { useEffect } from 'react';
import { authService, UNIFIED_PORTAL_URL } from '../services/authService';

export default function LoginPage() {
  useEffect(() => {
    authService.redirectToUnifiedPortal();
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#475569',
        backgroundColor: '#f8fafc',
      }}
    >
      <div
        style={{
          padding: '2rem',
          borderRadius: '0.75rem',
          backgroundColor: '#ffffff',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          textAlign: 'center',
          maxWidth: '420px',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.5rem' }}>
          HMS Parent Portal
        </h2>
        <p style={{ fontSize: '0.875rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
          Parent authentication is centrally managed through the Unified Institutional Portal.
          Redirecting you to the shared sign-in...
        </p>
        <a
          href={`${UNIFIED_PORTAL_URL}/login`}
          style={{
            display: 'inline-block',
            padding: '0.625rem 1.25rem',
            backgroundColor: '#2563eb',
            color: '#ffffff',
            borderRadius: '0.5rem',
            textDecoration: 'none',
            fontSize: '0.875rem',
            fontWeight: 500,
          }}
        >
          Go to Unified Portal Sign In
        </a>
      </div>
    </div>
  );
}
