import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../shared/auth/useAuth';
import { ROLE_ROUTE_MAP, portalAuthService, getAuthorizedRedirectPath, normalizeRoleCode } from '../shared/auth/portalAuthService';
import {
  Shield,
  ShieldCheck,
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
  Sparkles,
} from 'lucide-react';
import '../shared/styles/portal.css';

const PERSONA_CONFIGS = {
  HOSTEL_INCHARGE: {
    id: 'HOSTEL_INCHARGE',
    label: 'Hostel In-Charge',
    icon: Building2,
    badge: 'Hostel In-Charge Portal',
    title: 'Hostel In-Charge Sign In',
    subtitle: 'Sign in to access resident directory, room & bed allocations, daily attendance, and resident complaints.',
    fieldLabel: 'Hostel In-Charge Email / Staff ID',
    emailPlaceholder: 'e.g. incharge@college.edu or staff ID',
    buttonText: 'Sign In as Hostel In-Charge',
    quickEmail: '',
    quickPassword: '',
    quickRoleName: 'Hostel In-Charge',
    routePath: '/hostel-incharge/login',
  },
  COLLEGE_ADMIN: {
    id: 'COLLEGE_ADMIN',
    label: 'College Admin',
    icon: LayoutDashboard,
    badge: 'Institutional Governance',
    title: 'College Administrator Sign In',
    subtitle: 'Sign in to manage institutional hostels, staff allocations, student admissions, and campus operations.',
    fieldLabel: 'Administrator Email',
    emailPlaceholder: 'e.g. admin@college.edu or institutional email',
    buttonText: 'Sign In as College Administrator',
    quickEmail: '',
    quickPassword: '',
    quickRoleName: 'College Administrator',
    routePath: '/admin/login',
  },
  SECURITY: {
    id: 'SECURITY',
    label: 'Campus Security',
    icon: ShieldCheck,
    badge: 'Campus Security Post',
    title: 'Campus Security Sign In',
    subtitle: 'Sign in to manage entry/exit checkpoints, visitor digital slips, and student gate pass verifications.',
    fieldLabel: 'Security Email / Guard ID',
    emailPlaceholder: 'e.g. security@college.edu or guard ID',
    buttonText: 'Sign In as Security Officer',
    quickEmail: '',
    quickPassword: '',
    quickRoleName: 'Campus Security Personnel',
    routePath: '/security/login',
  },
  STUDENT: {
    id: 'STUDENT',
    label: 'Student Portal',
    icon: GraduationCap,
    badge: 'Student Living Portal',
    title: 'Student Living Portal Sign In',
    subtitle: 'Sign in to view your room allotment, apply for hostel leaves, log maintenance complaints, and check mess menu.',
    fieldLabel: 'Student Email / Register Number',
    emailPlaceholder: 'e.g. student@college.edu or register number',
    buttonText: 'Sign In to Student Portal',
    quickEmail: '',
    quickPassword: '',
    quickRoleName: 'Residential Student',
    routePath: '/student/login',
  },
  PARENT: {
    id: 'PARENT',
    label: 'Parent Portal',
    icon: Users,
    badge: 'Parent & Guardian Portal',
    title: 'Parent & Guardian Sign In',
    subtitle: 'Sign in to track your ward\'s attendance, review and approve gate exit requests, and access warden contacts.',
    fieldLabel: 'Parent Login Email',
    emailPlaceholder: 'e.g. parent.guardian@example.com',
    buttonText: 'Sign In to Parent Portal',
    quickEmail: '',
    quickPassword: '',
    quickRoleName: 'Registered Parent / Guardian',
    routePath: '/parent/login',
  },
};

export default function SharedLoginPage({ initialPersona = null }) {
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [selectedPersona, setSelectedPersona] = useState(initialPersona);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [colleges, setColleges] = useState([]);
  const [selectedCollege, setSelectedCollege] = useState(null);

  // Initialize or detect persona from URL path or search parameters
  useEffect(() => {
    const path = location.pathname.toLowerCase();
    const params = new URLSearchParams(location.search);
    const personaParam = (params.get('persona') || params.get('role') || '').toUpperCase();

    if (personaParam && PERSONA_CONFIGS[personaParam]) {
      setSelectedPersona(personaParam);
    } else if (path.includes('incharge')) {
      setSelectedPersona('HOSTEL_INCHARGE');
    } else if (path.includes('security')) {
      setSelectedPersona('SECURITY');
    } else if (path.includes('student')) {
      setSelectedPersona('STUDENT');
    } else if (path.includes('parent')) {
      setSelectedPersona('PARENT');
    } else if (path.includes('admin')) {
      setSelectedPersona('COLLEGE_ADMIN');
    } else if (initialPersona && PERSONA_CONFIGS[initialPersona]) {
      setSelectedPersona(initialPersona);
    }
  }, [location.pathname, location.search, initialPersona]);

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

  // If already authenticated with any valid institutional role, redirect to their role dashboard
  useEffect(() => {
    if (isAuthenticated && user?.role) {
      const fromPath = location.state?.from?.pathname;
      const targetPath = getAuthorizedRedirectPath(user.role, fromPath);
      navigate(targetPath, { replace: true });
    }
  }, [isAuthenticated, user, navigate, location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Please provide your institutional email address or login ID.');
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
        setError('Super Administrator accounts must sign in through the Central Super Admin Console. Please use your institutional college credentials.');
        setLoading(false);
        return;
      }

      // Check role mapping across all supported institutional roles
      const role = normalizeRoleCode(result.user?.role || '');
      const roleConfig = ROLE_ROUTE_MAP[role] || ROLE_ROUTE_MAP[result.user?.role];
      if (!roleConfig) {
        setError(`Your account role '${result.user?.role || role}' is not configured for institutional portal access. Please contact your college administrator.`);
        setLoading(false);
        return;
      }

      // Route directly to the validated authorized destination or the role's designated portal dashboard
      const fromPath = location.state?.from?.pathname;
      let targetPath = result.redirectPath || roleConfig.path;
      if (fromPath) {
        const validatedFrom = getAuthorizedRedirectPath(role, fromPath);
        if (validatedFrom && validatedFrom !== '/login' && validatedFrom !== '/unauthorized') {
          targetPath = validatedFrom;
        }
      }
      navigate(targetPath, { replace: true });
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify your institutional login credentials.');
      setLoading(false);
    }
  };

  const handlePersonaClick = (personaId) => {
    if (selectedPersona === personaId) {
      // Toggle back to general unified login
      setSelectedPersona(null);
      setError(null);
    } else {
      setSelectedPersona(personaId);
      setError(null);
      // Clean any stale redirect state that may point to an admin page
      if (location.state?.from) {
        navigate(location.pathname, { replace: true, state: {} });
      }
      const cfg = PERSONA_CONFIGS[personaId];
      if (cfg?.quickEmail && !email) {
        setEmail(cfg.quickEmail);
      }
    }
  };

  const handleApplyQuickFill = () => {
    const activeCfg = selectedPersona ? PERSONA_CONFIGS[selectedPersona] : null;
    if (activeCfg?.quickEmail) {
      setEmail(activeCfg.quickEmail);
      if (activeCfg.quickPassword) {
        setPassword(activeCfg.quickPassword);
      }
    }
  };

  const activeCfg = selectedPersona ? PERSONA_CONFIGS[selectedPersona] : null;

  const currentBadge = activeCfg?.badge || 'Unified Campus Access';
  const currentTitle = activeCfg
    ? (selectedCollege?.name ? `${selectedCollege.name} ${activeCfg.label} Sign In` : activeCfg.title)
    : (selectedCollege?.name ? `${selectedCollege.name} Sign In` : 'Campus Living Portal Sign In');
  const currentSubtitle = activeCfg
    ? activeCfg.subtitle
    : (selectedCollege?.name
      ? `Official institutional portal for ${selectedCollege.name} (${selectedCollege.college_code}). Sign in with your assigned administrator, hostel in-charge, security, student, or parent credentials.`
      : 'Sign in with your institutional credentials to access your administrative, hostel in-charge, security, student, or parent portal.');
  const currentFieldLabel = activeCfg?.fieldLabel || 'Institutional Email / Login ID';
  const currentPlaceholder = activeCfg?.emailPlaceholder || 'e.g. name@college.edu or registered email';
  const currentButtonText = activeCfg?.buttonText || 'Sign In to Campus Portal';

  const portalPersonas = [
    { id: 'COLLEGE_ADMIN', label: 'College Admin', icon: LayoutDashboard, desc: 'Hostels, staff allocations & institutional governance' },
    { id: 'HOSTEL_INCHARGE', label: 'Hostel In-Charge', icon: Building2, desc: 'Wardens, room inventory & resident welfare' },
    { id: 'SECURITY', label: 'Campus Security', icon: ShieldCheck, desc: 'Gate posts, clearance checks & movements' },
    { id: 'STUDENT', label: 'Student Portal', icon: GraduationCap, desc: 'Leaves, daily attendance, food & grievances' },
    { id: 'PARENT', label: 'Parent Portal', icon: Users, desc: 'Ward activity oversight & gate exit approvals' },
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
                {selectedCollege?.college_code ? `${selectedCollege.college_code} Institutional Portal` : 'Unified Campus Portal'}
              </span>
            </div>
          </div>

          <div className="portal-badge-pill" title={currentBadge}>
            <span className="portal-live-indicator-dot" />
            <span>{currentBadge}</span>
          </div>
        </div>

        {/* Title Block */}
        <div className="portal-header-titles">
          <h1 className="portal-title">{currentTitle}</h1>
          <p className="portal-subtitle">{currentSubtitle}</p>
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

        {/* Quick-fill helper notice for selected persona */}
        {activeCfg?.quickEmail && (
          <div className="portal-quick-card">
            <div className="portal-quick-info">
              <div className="portal-quick-title">
                <Sparkles size={13} />
                <span>{activeCfg.quickRoleName}</span>
              </div>
              <div className="portal-quick-sub">{activeCfg.quickEmail}</div>
            </div>
            <button
              type="button"
              className="btn-portal-quick-fill"
              onClick={handleApplyQuickFill}
              title="Click to fill credentials"
            >
              Fill Credentials
            </button>
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
              Institutional accounts are provisioned for College Administrators, Hostel In-Charges, Security Officers, Students, and Parents. Enter your registered email address and password. If you forgot your password or need access, please contact your campus administrator.
            </p>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} noValidate className="portal-login-form">
          {/* Email / ID Field */}
          <div className="form-field">
            <label className="field-label" htmlFor="portal-email">
              <span className="field-label-text">
                <Mail size={14} className="field-label-icon" />
                <span>{currentFieldLabel}</span>
              </span>
            </label>
            <div className="input-with-action">
              <input
                id="portal-email"
                type="email"
                className="field-input"
                placeholder={currentPlaceholder}
                value={email}
                onChange={handleEmailChange}
                disabled={loading}
                autoComplete="username"
                required
              />
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
                placeholder="Enter your portal password"
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
              <span>{currentButtonText}</span>
            )}
          </button>
        </form>

        {/* All Supported Institutional Portals & Roles - Interactive Switcher */}
        <div className="portal-footer-roles">
          <div className="roles-guide-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Unified Access Portals & Personas</span>
            {selectedPersona && (
              <button
                type="button"
                onClick={() => setSelectedPersona(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Reset to All
              </button>
            )}
          </div>
          <div className="roles-pill-grid">
            {portalPersonas.map((cap) => {
              const IconComp = cap.icon;
              const isSelected = selectedPersona === cap.id;
              return (
                <button
                  type="button"
                  key={cap.id}
                  className={`role-chip-card ${isSelected ? 'active' : ''}`}
                  onClick={() => handlePersonaClick(cap.id)}
                  title={`Click to sign in as ${cap.label}: ${cap.desc}`}
                >
                  <span className="role-chip-icon">
                    <IconComp size={13} />
                  </span>
                  <span>{cap.label}</span>
                  {isSelected && <CheckCircle2 size={12} style={{ color: '#2563eb', marginLeft: '2px' }} />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Outer Bottom Bar */}
      <footer className="portal-outer-footer">
        <span className="portal-outer-copyright">
          © {new Date().getFullYear()} Texify Technologies Platform Engine • Unified Institutional Portal
        </span>
      </footer>
    </div>
  );
}
