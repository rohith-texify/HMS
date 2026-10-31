import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../shared/auth/useAuth';
import { ROLE_ROUTE_MAP, SUPER_ADMIN_URL } from '../shared/auth/portalAuthService';
import '../shared/styles/portal.css';

export default function SharedLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [superAdminNotice, setSuperAdminNotice] = useState(false);

  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // If already authenticated, redirect to authorized dashboard
  useEffect(() => {
    if (isAuthenticated && user?.role && ROLE_ROUTE_MAP[user.role]) {
      const fromPath = location.state?.from?.pathname;
      const targetPath = fromPath || ROLE_ROUTE_MAP[user.role].path;
      navigate(targetPath, { replace: true });
    }
  }, [isAuthenticated, user, navigate, location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuperAdminNotice(false);

    if (!email.trim()) {
      setError('Please provide your institutional email address.');
      return;
    }
    if (!password) {
      setError('Please enter your account password.');
      return;
    }

    setLoading(true);
    try {
      const result = await login(email, password, rememberMe);

      if (result.isSuperAdmin) {
        setSuperAdminNotice(true);
        setLoading(false);
        return;
      }

      const targetPath = location.state?.from?.pathname || result.redirectPath;
      navigate(targetPath, { replace: true });
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify your credentials.');
      setLoading(false);
    }
  };

  return (
    <div className="portal-auth-container">
      <div className="portal-card">
        {/* Institutional Header */}
        <div className="portal-header">
          <div className="portal-badge-pill">Hostel Management System</div>
          <h1 className="portal-title">Institutional Portal</h1>
          <p className="portal-subtitle">
            Sign in with your registered college credentials. You will be automatically routed to your authorized operational dashboard.
          </p>
        </div>

        {/* Super Admin Notice Banner */}
        {superAdminNotice && (
          <div className="alert-banner alert-warning" role="alert">
            <div>
              <strong>Super Administrator Identity Detected</strong>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem' }}>
                Platform administrators manage multi-tenant infrastructure from the dedicated Super Admin control plane.
              </p>
              <div style={{ marginTop: '10px' }}>
                <a
                  href={SUPER_ADMIN_URL}
                  className="btn-portal-primary"
                  style={{ display: 'inline-block', textDecoration: 'none', padding: '6px 14px', fontSize: '0.85rem' }}
                >
                  Launch Super Admin Console →
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="alert-banner alert-error" role="alert">
            <span>⚠️ {error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-field">
            <label className="field-label" htmlFor="portal-email">
              Institutional Email
            </label>
            <input
              id="portal-email"
              type="email"
              className="field-input"
              placeholder="e.g. admin@college.edu or student@college.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoComplete="email"
              required
            />
          </div>

          <div className="form-field">
            <label className="field-label" htmlFor="portal-password">
              Password
            </label>
            <div className="input-with-action">
              <input
                id="portal-password"
                type={showPassword ? 'text' : 'password'}
                className="field-input"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="btn-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div className="form-options">
            <label className="remember-checkbox">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={loading}
              />
              <span>Keep me signed in</span>
            </label>
          </div>

          <button
            type="submit"
            className="btn-portal-primary"
            disabled={loading}
            id="btn-portal-submit"
          >
            {loading ? (
              <span className="spinner-inline">
                <span className="spinner" /> Authenticating...
              </span>
            ) : (
              'Sign In to Institutional Portal'
            )}
          </button>
        </form>

        {/* Role Routing Matrix Guide */}
        <div className="portal-footer">
          <div className="roles-guide-title">Supported Institutional Roles:</div>
          <div className="roles-pill-grid">
            <span className="role-chip" title="College Administration">🏛️ Admin</span>
            <span className="role-chip" title="Resident Student">🎓 Student</span>
            <span className="role-chip" title="Parent / Guardian">👨‍👩‍👧 Parent</span>
            <span className="role-chip" title="Hostel In-Charge & Wardens">📋 Incharge</span>
            <span className="role-chip" title="Campus Security Gate">🛡️ Security</span>
          </div>
        </div>
      </div>
    </div>
  );
}

