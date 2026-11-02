import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../shared/auth/useAuth';
import { ROLE_ROUTE_MAP, portalAuthService } from '../shared/auth/portalAuthService';
import {
  Shield,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Building2,
  GraduationCap,
  Users,
  LayoutDashboard,
  AlertCircle,
  HelpCircle,
  X,
  CheckCircle2,
} from 'lucide-react';
import '../shared/styles/portal.css';

export default function SharedLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [colleges, setColleges] = useState([]);
  const [selectedCollege, setSelectedCollege] = useState(null);

  useEffect(() => {
    portalAuthService.listPublicColleges().then((data) => {
      if (Array.isArray(data) && data.length > 0) {
        setColleges(data);
        const queryParams = new URLSearchParams(location.search);
        const colParam = queryParams.get('college');
        if (colParam) {
          const match = data.find(
            (c) =>
              c.college_code?.toLowerCase() === colParam.toLowerCase() ||
              c.college_id === colParam
          );
          if (match) setSelectedCollege(match);
        }
      }
    });
  }, [location.search]);

  const handleEmailChange = (e) => {
    const val = e.target.value;
    setEmail(val);

    if (val.includes('@') || val.length >= 3) {
      const match = colleges.find((c) => {
        const code = c.college_code?.toLowerCase();
        const valLower = val.toLowerCase();
        return (
          code &&
          (valLower.startsWith(code + '.') ||
            valLower.startsWith(code + '@') ||
            valLower.includes('@' + code) ||
            valLower.includes('.' + code + '.'))
        );
      });
      if (match) {
        setSelectedCollege(match);
      }
    }
  };

  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // If already authenticated as an admin, redirect to admin dashboard
  useEffect(() => {
    if (isAuthenticated && user?.role) {
      const allowedAdminRoles = ['COLLEGE_ADMIN', 'HOSTEL_ADMIN', 'ADMIN'];
      if (allowedAdminRoles.includes(user.role)) {
        const fromPath = location.state?.from?.pathname;
        const targetPath = fromPath || '/admin/dashboard';
        navigate(targetPath, { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate, location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Please provide your college administrator email address.');
      return;
    }
    if (!password) {
      setError('Please enter your account password.');
      return;
    }

    setLoading(true);
    try {
      const result = await login(email, password, rememberMe);

      // Block Super Admin accounts from this portal
      if (result.isSuperAdmin) {
        setError('Super Administrator accounts cannot access the College Admin portal. Please sign in with your College Administrator credentials.');
        setLoading(false);
        return;
      }

      // Restrict access strictly to College Admin roles for current design phase
      const role = result.user?.role || '';
      const allowedAdminRoles = ['COLLEGE_ADMIN', 'HOSTEL_ADMIN', 'ADMIN'];
      if (!allowedAdminRoles.includes(role)) {
        setError('Access is currently limited to College Administrators while the Admin module is under active development.');
        setLoading(false);
        return;
      }

      const targetPath = location.state?.from?.pathname || '/admin/dashboard';
      navigate(targetPath, { replace: true });
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify your administrator credentials.');
      setLoading(false);
    }
  };

  const adminCapabilities = [
    { label: 'Admin Dashboard', icon: LayoutDashboard, desc: 'Occupancy & campus KPIs' },
    { label: 'Hostels & Blocks', icon: Building2, desc: 'Structures, wings & rooms' },
    { label: 'College Staff', icon: Users, desc: 'Wardens & supervisors' },
    { label: 'Student Directory', icon: GraduationCap, desc: 'Allotments & records' },
  ];

  return (
    <div className="portal-auth-container">
      <div className="portal-card">
        {/* Brand & Header Topbar */}
        <div className="portal-brand-block">
          <div className="portal-brand-identity">
            {selectedCollege?.logo_url ? (
              <img
                src={selectedCollege.logo_url}
                alt={selectedCollege.name}
                className="portal-college-logo-img"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  if (e.currentTarget.nextSibling) {
                    e.currentTarget.nextSibling.style.display = 'flex';
                  }
                }}
              />
            ) : (
              <img
                src="/texify-logo.png"
                alt="Texify Technologies"
                className="portal-brand-logo-img"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  if (e.currentTarget.nextSibling) {
                    e.currentTarget.nextSibling.style.display = 'flex';
                  }
                }}
              />
            )}
            <div className="portal-brand-fallback-logo" style={{ display: 'none' }}>
              <Building2 size={18} />
            </div>
            <div className="portal-brand-name-group">
              <span className="portal-brand-main-title">
                {selectedCollege?.name || 'Texify HMS'}
              </span>
              <span className="portal-brand-caption">
                {selectedCollege?.college_code ? `${selectedCollege.college_code} College Administration` : 'College Administration'}
              </span>
            </div>
          </div>

          <div className="portal-badge-pill">
            <span className="portal-live-indicator-dot" />
            <span>Admin Module</span>
          </div>
        </div>

        {/* Title Block */}
        <div className="portal-header-titles">
          <h1 className="portal-title">
            {selectedCollege?.name ? `${selectedCollege.name} Sign In` : 'College Admin Sign In'}
          </h1>
          <p className="portal-subtitle">
            {selectedCollege?.name
              ? `Official Administrator portal for ${selectedCollege.name} (${selectedCollege.college_code}). Sign in with your assigned administrative credentials.`
              : 'Sign in with your College Administrator credentials to manage campus hostels, staff, students, and operational allocations.'}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="alert-banner alert-error" role="alert">
            <AlertCircle size={18} className="alert-banner-icon" />
            <div className="alert-banner-content">
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Expandable Help / Information Notice */}
        {showHelp && (
          <div className="portal-help-box">
            <div className="portal-help-header">
              <span>Need Assistance?</span>
              <button
                type="button"
                className="portal-help-close-btn"
                onClick={() => setShowHelp(false)}
                aria-label="Close help"
              >
                <X size={15} />
              </button>
            </div>
            <p style={{ margin: 0 }}>
              College Administrator accounts are provisioned during college onboarding. If you require credentials or password resets, contact your institutional IT department or platform onboarding representative.
            </p>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} noValidate className="portal-login-form">
          {/* Administrator Email Field */}
          <div className="form-field">
            <label className="field-label" htmlFor="portal-email">
              <span className="field-label-text">
                <Mail size={14} className="field-label-icon" />
                <span>Administrator Email</span>
              </span>
            </label>
            <div className="input-with-action">
              <input
                id="portal-email"
                type="email"
                className="field-input"
                placeholder="admin@college.edu"
                value={email}
                onChange={handleEmailChange}
                disabled={loading}
                autoComplete="username"
                required
              />
              <span className="input-leading-icon">
                <Mail size={16} />
              </span>
            </div>
          </div>

          {/* Password Field */}
          <div className="form-field">
            <label className="field-label" htmlFor="portal-password">
              <span className="field-label-text">
                <Lock size={14} className="field-label-icon" />
                <span>Password</span>
              </span>
            </label>
            <div className="input-with-action">
              <input
                id="portal-password"
                type={showPassword ? 'text' : 'password'}
                className="field-input"
                placeholder="Enter your administrator password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoComplete="current-password"
                required
              />
              <span className="input-leading-icon">
                <Lock size={16} />
              </span>
              <button
                type="button"
                className="btn-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          {/* Options Row */}
          <div className="form-options">
            <label className="remember-checkbox-label">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={loading}
              />
              <span>Keep me signed in</span>
            </label>

            <button
              type="button"
              className="btn-help-link"
              onClick={() => setShowHelp((prev) => !prev)}
            >
              <HelpCircle size={13} />
              <span>Forgot password?</span>
            </button>
          </div>

          {/* Submit Action */}
          <button
            type="submit"
            className="btn-portal-primary"
            disabled={loading}
            id="btn-portal-submit"
          >
            {loading ? (
              <span className="spinner-inline">
                <span className="portal-spinner" />
                <span>Authenticating...</span>
              </span>
            ) : (
              <span>Sign In to College Admin</span>
            )}
          </button>
        </form>

        {/* Admin Module Features Pill Grid */}
        <div className="portal-footer-roles">
          <div className="roles-guide-title">
            <span>Admin Module Management Scope</span>
          </div>
          <div className="roles-pill-grid">
            {adminCapabilities.map((cap) => {
              const IconComp = cap.icon;
              return (
                <div
                  key={cap.label}
                  className="role-chip-card"
                  title={cap.desc}
                >
                  <span className="role-chip-icon">
                    <IconComp size={13} />
                  </span>
                  <span>{cap.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Outer Bottom Bar */}
      <footer className="portal-outer-footer">
        <span className="portal-outer-copyright">
          © {new Date().getFullYear()} Texify Technologies Platform Engine • College Administration
        </span>
      </footer>
    </div>
  );
}
