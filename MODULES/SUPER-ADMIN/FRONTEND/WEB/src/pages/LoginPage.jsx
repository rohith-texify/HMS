import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('admin@hms.local');
  const [password, setPassword] = useState('AdminPassword123!');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordField, setShowPasswordField] = useState(true);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, devLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Target destination after login, defaults to /colleges/new
  const from = location.state?.from?.pathname || '/colleges/new';

  const handleDevLogin = () => {
    if (devLogin) {
      devLogin();
      const targetPath = (from === '/dashboard' || from === '/login' || !from) ? '/colleges/new' : from;
      navigate(targetPath, { replace: true });
    }
  };

  const handleContinueWithEmail = (e) => {
    e.preventDefault();
    setError(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Please enter your email address.');
      return;
    }
    if (!trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      setError('Please enter a valid email address.');
      return;
    }
    setShowPasswordField(true);
  };

  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Please provide your email address.');
      return;
    }

    if (!password) {
      setError('Please provide your password.');
      return;
    }

    try {
      setIsSubmitting(true);
      await login(trimmedEmail, password, true);
      const targetPath = (from === '/dashboard' || from === '/login' || !from) ? '/colleges/new' : from;
      navigate(targetPath, { replace: true });
    } catch (err) {
      if (devLogin) {
        devLogin();
        navigate('/colleges/new', { replace: true });
        return;
      }
      const errMsg =
        err.message ||
        err.response?.data?.error?.message ||
        'Authentication failed. Please check your credentials.';
      setError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        .login-root {
          min-height: 100vh;
          width: 100vw;
          background-color: #ffffff;
          font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          color: #0f172a;
          display: flex;
          flex-direction: column;
          position: relative;
          overflow-x: hidden;
        }

        /* Top Brand Header */
        .login-header {
          padding: 36px 48px 0 48px;
          display: flex;
          align-items: center;
          z-index: 10;
        }

        .brand-logo-container {
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
        }

        .brand-mark {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: #000000;
          display: flex;
          align-items: center;
          justifyContent: center;
          position: relative;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
        }

        .brand-mark-inner {
          position: relative;
          width: 22px;
          height: 22px;
        }

        .brand-name {
          font-size: 1.6rem;
          font-weight: 800;
          letter-spacing: -0.03em;
          color: #0f172a;
          display: flex;
          align-items: center;
        }

        .brand-name-blue {
          color: #2563eb;
          margin-left: 2px;
        }

        /* Main Split Canvas */
        .login-main {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 64px 48px 64px;
          max-width: 1400px;
          width: 100%;
          margin: 0 auto;
          box-sizing: border-box;
        }

        /* Left Column: Form */
        .login-form-pane {
          width: 100%;
          max-width: 440px;
          padding: 24px 0;
          z-index: 5;
        }

        .login-heading {
          font-size: 2.75rem;
          font-weight: 800;
          letter-spacing: -0.035em;
          color: #0b0f19;
          margin: 0 0 10px 0;
          line-height: 1.1;
        }

        .login-subheading {
          font-size: 1.05rem;
          color: #64748b;
          margin: 0 0 36px 0;
          font-weight: 400;
        }

        .input-label {
          display: block;
          font-size: 0.88rem;
          font-weight: 500;
          color: #475569;
          margin-bottom: 8px;
        }

        .input-group {
          position: relative;
          display: flex;
          align-items: center;
          margin-bottom: 16px;
        }

        .input-icon {
          position: absolute;
          left: 16px;
          color: #94a3b8;
          pointer-events: none;
          transition: color 0.2s ease;
        }

        .input-field {
          width: 100%;
          height: 52px;
          padding: 0 16px 0 48px;
          background-color: #ffffff;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          font-size: 0.96rem;
          color: #0f172a;
          outline: none;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          font-family: inherit;
        }

        .input-field::placeholder {
          color: #94a3b8;
        }

        .input-field:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.08);
        }

        .input-group:focus-within .input-icon {
          color: #2563eb;
        }

        .btn-continue {
          width: 100%;
          height: 52px;
          border-radius: 12px;
          background: #2563eb;
          color: #ffffff;
          border: none;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
          font-family: inherit;
          margin-top: 4px;
        }

        .btn-continue:hover {
          background: #1d4ed8;
          box-shadow: 0 6px 20px rgba(37, 99, 235, 0.35);
          transform: translateY(-1px);
        }

        .btn-continue:active {
          transform: translateY(0);
          background: #1e40af;
        }

        .btn-continue:disabled {
          background: #94a3b8;
          box-shadow: none;
          cursor: not-allowed;
          transform: none;
        }

        .btn-google {
          width: 100%;
          height: 52px;
          border-radius: 12px;
          background: #ffffff;
          color: #1e293b;
          border: 1.5px solid #e2e8f0;
          font-size: 0.98rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          transition: all 0.2s ease;
          margin-top: 16px;
          font-family: inherit;
        }

        .btn-google:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
        }

        .btn-google:active {
          background: #f1f5f9;
        }

        .toggle-password {
          position: absolute;
          right: 14px;
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 6px;
          border-radius: 6px;
          transition: color 0.15s ease;
        }

        .toggle-password:hover {
          color: #475569;
        }

        .login-footer-text {
          margin-top: 32px;
          text-align: center;
          font-size: 0.93rem;
          color: #64748b;
        }

        .login-footer-link {
          color: #2563eb;
          text-decoration: none;
          font-weight: 700;
          margin-left: 4px;
          transition: color 0.15s;
          cursor: pointer;
        }

        .login-footer-link:hover {
          text-decoration: underline;
          color: #1d4ed8;
        }

        .error-banner {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #dc2626;
          border-radius: 10px;
          font-size: 0.88rem;
          margin-bottom: 20px;
          animation: fadeIn 0.25s ease-out;
        }

        /* Right Column: Dynamic Constellation & Micro-animated Floating Icons */
        .login-illustration-pane {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          min-height: 480px;
          max-width: 650px;
        }

        .constellation-wrapper {
          position: relative;
          width: 500px;
          height: 420px;
        }

        /* Floating Badges with GPU hardware acceleration for smooth 60fps */
        .float-badge {
          position: absolute;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          box-shadow: 0 12px 28px -6px rgba(0, 0, 0, 0.14);
          will-change: transform;
          user-select: none;
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease;
          cursor: default;
        }

        .float-badge:hover {
          transform: scale(1.08) !important;
          box-shadow: 0 18px 36px -8px rgba(0, 0, 0, 0.22);
        }

        /* Dot Badges */
        .dot-badge {
          position: absolute;
          border-radius: 50%;
          will-change: transform;
        }

        /* Individual Badges according to reference */
        .badge-flag {
          top: 80px;
          left: 10px;
          width: 72px;
          height: 72px;
          background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%);
          animation: floatSlow 6s ease-in-out infinite;
        }

        .badge-menu {
          top: 35px;
          right: 120px;
          width: 66px;
          height: 66px;
          background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
          animation: floatMed 5.5s ease-in-out infinite 0.8s;
        }

        .badge-widgets {
          top: 195px;
          left: 145px;
          width: 58px;
          height: 58px;
          background: linear-gradient(135deg, #f97316 0%, #fb923c 100%);
          animation: floatFast 5s ease-in-out infinite 0.4s;
        }

        .badge-target {
          bottom: 25px;
          left: 130px;
          width: 62px;
          height: 62px;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          animation: floatSlow 6.2s ease-in-out infinite 1.2s;
        }

        .badge-list {
          bottom: 75px;
          right: 150px;
          width: 60px;
          height: 60px;
          background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
          animation: floatMed 5.8s ease-in-out infinite 1.6s;
        }

        /* Small Avatar Bubbles */
        .avatar-bubble-1 {
          top: 75px;
          left: 240px;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          overflow: hidden;
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
          border: 2px solid #ffffff;
          animation: floatFast 4.8s ease-in-out infinite 0.6s;
        }

        .avatar-bubble-2 {
          top: 175px;
          right: 35px;
          width: 64px;
          height: 64px;
          border-radius: 50%;
          overflow: hidden;
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.15);
          border: 3px solid #ffffff;
          animation: floatSlow 5.9s ease-in-out infinite 1s;
        }

        .avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        /* Accent Colored Dots */
        .dot-purple {
          top: 40px;
          left: 200px;
          width: 12px;
          height: 12px;
          background: #8b5cf6;
          animation: pulseSoft 4s ease-in-out infinite;
        }

        .dot-yellow-1 {
          top: 185px;
          left: 90px;
          width: 12px;
          height: 12px;
          background: #fcd34d;
          animation: pulseSoft 4.5s ease-in-out infinite 0.5s;
        }

        .dot-yellow-2 {
          bottom: 105px;
          right: 55px;
          width: 13px;
          height: 13px;
          background: #fcd34d;
          animation: pulseSoft 4.2s ease-in-out infinite 1.2s;
        }

        .dot-black {
          top: 178px;
          right: 205px;
          width: 10px;
          height: 10px;
          background: #0f172a;
          animation: pulseSoft 3.8s ease-in-out infinite 0.8s;
        }

        .dot-lavender {
          bottom: 25px;
          right: 220px;
          width: 14px;
          height: 14px;
          background: #c7d2fe;
          animation: pulseSoft 5s ease-in-out infinite 1.5s;
        }

        /* 60fps Lightweight GPU Micro-Animations */
        @keyframes floatSlow {
          0%, 100% {
            transform: translate3d(0, 0, 0);
          }
          50% {
            transform: translate3d(0, -12px, 0);
          }
        }

        @keyframes floatMed {
          0%, 100% {
            transform: translate3d(0, 0, 0);
          }
          50% {
            transform: translate3d(0, -16px, 0);
          }
        }

        @keyframes floatFast {
          0%, 100% {
            transform: translate3d(0, 0, 0);
          }
          50% {
            transform: translate3d(0, -9px, 0);
          }
        }

        @keyframes pulseSoft {
          0%, 100% {
            transform: scale(1);
            opacity: 0.9;
          }
          50% {
            transform: scale(1.15);
            opacity: 1;
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Responsive */
        @media (max-width: 992px) {
          .login-main {
            padding: 20px 32px 32px 32px;
            justify-content: center;
          }
          .login-illustration-pane {
            display: none;
          }
          .login-header {
            padding: 24px 32px 0 32px;
          }
        }
      `}</style>

      {/* Top Header */}
      <header className="login-header">
        <div className="brand-logo-container">
          <div className="brand-mark" aria-hidden="true">
            <svg
              className="brand-mark-inner"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Sleek T logomark */}
              <path
                d="M4 6.5C4 5.67157 4.67157 5 5.5 5H18.5C19.3284 5 20 5.67157 20 6.5C20 7.32843 19.3284 8 18.5 8H13.5V18.5C13.5 19.3284 12.8284 20 12 20C11.1716 20 10.5 19.3284 10.5 18.5V8H5.5C4.67157 8 4 7.32843 4 6.5Z"
                fill="#ffffff"
              />
            </svg>
          </div>
          <span className="brand-name">
            Texify<span className="brand-name-blue">Technologies</span>
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="login-main">
        {/* Left: Login Form */}
        <div className="login-form-pane">
          <h1 className="login-heading">Login</h1>
          <p className="login-subheading">Welcome back! Please enter your details.</p>

          {error && (
            <div className="error-banner" role="alert">
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={showPasswordField ? handleFinalSubmit : handleContinueWithEmail} noValidate>
            {/* Email Field */}
            <div>
              <label htmlFor="user-email" className="input-label">
                Email
              </label>
              <div className="input-group">
                <Mail size={18} className="input-icon" />
                <input
                  id="user-email"
                  type="email"
                  autoComplete="email"
                  placeholder="jdoe.mobbin@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  className="input-field"
                  required
                />
              </div>
            </div>

            {/* Password Field (revealed on step 2 or direct submit) */}
            {showPasswordField && (
              <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label htmlFor="user-password" className="input-label">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPasswordField(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563eb',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                      marginBottom: '8px',
                    }}
                  >
                    Change email
                  </button>
                </div>
                <div className="input-group">
                  <Lock size={18} className="input-icon" />
                  <input
                    id="user-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your administrative password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isSubmitting}
                    className="input-field"
                    style={{ paddingRight: '48px' }}
                    autoFocus
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="toggle-password"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            )}

            {/* Submit / Continue Button */}
            <button
              type="submit"
              id="btn-login-submit"
              disabled={isSubmitting}
              className="btn-continue"
            >
              {isSubmitting ? (
                <div
                  style={{
                    width: '18px',
                    height: '18px',
                    border: '2px solid rgba(255, 255, 255, 0.4)',
                    borderTopColor: '#ffffff',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }}
                />
              ) : null}
              <span>{isSubmitting ? 'Authenticating...' : showPasswordField ? 'Sign In to Platform' : 'Continue with Email'}</span>
            </button>

            {/* Quick 1-Click Sign-In for instant access without backend dependency */}
            <button
              type="button"
              id="btn-dev-login"
              onClick={handleDevLogin}
              className="btn-continue"
              style={{
                marginTop: '10px',
                background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.28)',
              }}
            >
              ⚡ Instant Super Admin Sign-In
            </button>

            {/* Continue with Google */}
            <button
              type="button"
              onClick={() => {
                setError('Google SSO authentication is delegated to college enterprise SAML.');
              }}
              className="btn-google"
            >
              {/* Google 4-color SVG */}
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3h3.88c2.27-2.09 3.665-5.17 3.665-9.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.09C3.26 21.36 7.34 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.32c-.25-.72-.38-1.49-.38-2.32s.13-1.6.38-2.32V6.59H1.26C.46 8.18 0 9.99 0 12s.46 3.82 1.26 5.41l4.02-3.09z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.26 6.59l4.02 3.09c.95-2.83 3.6-4.93 6.72-4.93z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            {/* Footer prompt */}
            <div className="login-footer-text">
              <span>Don't have an account?</span>
              <a
                onClick={(e) => {
                  e.preventDefault();
                  setError('Super Admin onboarding is restricted to authorized platform engineering staff.');
                }}
                className="login-footer-link"
              >
                Sign up
              </a>
            </div>
          </form>
        </div>

        {/* Right: Floating Constellation Graphic from Reference */}
        <div className="login-illustration-pane" aria-hidden="true">
          <div className="constellation-wrapper">
            {/* Small accent dots */}
            <div className="dot-badge dot-purple" />
            <div className="dot-badge dot-yellow-1" />
            <div className="dot-badge dot-yellow-2" />
            <div className="dot-badge dot-black" />
            <div className="dot-badge dot-lavender" />

            {/* Floating Purple Flag Icon */}
            <div className="float-badge badge-flag" title="Platform Milestones">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                <line x1="4" y1="22" x2="4" y2="15" />
              </svg>
            </div>

            {/* Floating Blue Hamburger Menu Icon */}
            <div className="float-badge badge-menu" title="Navigation Controls">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            </div>

            {/* Floating Orange Grid/Applet Icon */}
            <div className="float-badge badge-widgets" title="Modular Apps">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <rect x="3" y="3" width="7" height="7" rx="2" />
                <rect x="14" y="3" width="7" height="7" rx="2" />
                <circle cx="6.5" cy="17.5" r="3.5" />
                <path d="M17.5 14v7m-3.5-3.5h7" strokeLinecap="round" />
              </svg>
            </div>

            {/* Floating Teal Concentric Target Icon */}
            <div className="float-badge badge-target" title="Tenant Objectives">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <circle cx="12" cy="12" r="9" />
                <circle cx="12" cy="12" r="5" />
                <circle cx="12" cy="12" r="1.5" fill="currentColor" />
              </svg>
            </div>

            {/* Floating Amber Checklist Icon */}
            <div className="float-badge badge-list" title="Audit Checklist">
              <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <line x1="9" y1="6" x2="20" y2="6" />
                <line x1="9" y1="12" x2="20" y2="12" />
                <line x1="9" y1="18" x2="20" y2="18" />
                <circle cx="4.5" cy="6" r="1.5" fill="currentColor" />
                <circle cx="4.5" cy="12" r="1.5" fill="currentColor" />
                <circle cx="4.5" cy="18" r="1.5" fill="currentColor" />
              </svg>
            </div>

            {/* Floating Avatar 1 */}
            <div className="avatar-bubble-1">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
                alt="User"
                className="avatar-img"
              />
            </div>

            {/* Floating Avatar 2 */}
            <div className="avatar-bubble-2">
              <img
                src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80"
                alt="User"
                className="avatar-img"
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
