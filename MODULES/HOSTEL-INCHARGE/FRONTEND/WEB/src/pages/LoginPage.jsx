import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  Building2,
  GraduationCap,
  Users,
  LayoutDashboard,
  ShieldCheck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  HelpCircle,
  X,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import '../styles/portal.css';

const PERSONA_CONFIGS = {
  HOSTEL_INCHARGE: {
    id: 'HOSTEL_INCHARGE',
    label: 'Hostel In-Charge',
    icon: Building2,
    badge: 'Residential Operations & Welfare',
    title: 'Hostel In-Charge Sign In',
    subtitle: 'Sign in to access resident directory, room allotments, daily roll-call attendance, and maintenance complaints.',
    fieldLabel: 'Hostel In-Charge Email / Staff ID',
    emailPlaceholder: 'e.g. incharge@college.edu or institutional email',
    buttonText: 'Sign In to In-Charge Workspace',
    quickEmail: 'rohith.vinothini07@gmail.com',
    quickPassword: 'Rohith@acet',
    quickRoleName: 'Institutional Administrator / In-Charge',
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
    quickEmail: 'rohith.vinothini07@gmail.com',
    quickPassword: 'Rohith@acet',
    quickRoleName: 'College Administrator',
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
  },
  PARENT: {
    id: 'PARENT',
    label: 'Parent Portal',
    icon: Users,
    badge: 'Parent & Guardian Portal',
    title: 'Parent & Guardian Sign In',
    subtitle: "Sign in to track your ward's attendance, review and approve gate exit requests, and access warden contacts.",
    fieldLabel: 'Parent Login Email',
    emailPlaceholder: 'e.g. parent.guardian@example.com',
    buttonText: 'Sign In to Parent Portal',
    quickEmail: '',
    quickPassword: '',
    quickRoleName: 'Registered Parent / Guardian',
  },
};

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [selectedPersona, setSelectedPersona] = useState('HOSTEL_INCHARGE');
  const [email, setEmail] = useState('rohith.vinothini07@gmail.com');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showHelp, setShowHelp] = useState(false);

  const from = location.state?.from?.pathname || '/dashboard';

  // Initialize persona from URL query parameters if present
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const personaParam = (params.get('persona') || params.get('role') || '').toUpperCase();
    if (personaParam && PERSONA_CONFIGS[personaParam]) {
      setSelectedPersona(personaParam);
      const cfg = PERSONA_CONFIGS[personaParam];
      if (cfg.quickEmail) setEmail(cfg.quickEmail);
    }
  }, [location.search]);

  const handlePersonaClick = (personaId) => {
    setSelectedPersona(personaId);
    setError(null);
    const cfg = PERSONA_CONFIGS[personaId];
    if (cfg?.quickEmail) {
      setEmail(cfg.quickEmail);
      if (cfg.quickPassword) {
        setPassword(cfg.quickPassword);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Please provide your institutional staff email.');
      return;
    }
    if (!password) {
      setError('Please enter your account password.');
      return;
    }

    try {
      setLoading(true);
      await login(trimmedEmail, password, rememberMe);
      navigate(from, { replace: true });
    } catch (err) {
      setError(
        err.message || 'Authentication failed. Please verify your credentials or contact College Admin.'
      );
    } finally {
      setLoading(false);
    }
  };

  const activeCfg = selectedPersona ? PERSONA_CONFIGS[selectedPersona] : PERSONA_CONFIGS.HOSTEL_INCHARGE;
  const currentBadge = activeCfg?.badge || 'Residential Operations & Welfare';
  const currentTitle = activeCfg?.title || 'Hostel In-Charge Sign In';
  const currentSubtitle = activeCfg?.subtitle || 'Sign in to access resident directory, room allotments, and attendance.';
  const currentFieldLabel = activeCfg?.fieldLabel || 'Institutional Email / Staff ID';
  const currentPlaceholder = activeCfg?.emailPlaceholder || 'e.g. incharge@college.edu';
  const currentButtonText = activeCfg?.buttonText || 'Sign In to Workspace';

  const portalPersonas = [
    { id: 'HOSTEL_INCHARGE', label: 'Hostel In-Charge', icon: Building2, desc: 'Wardens, room inventory & resident welfare' },
    { id: 'COLLEGE_ADMIN', label: 'College Admin', icon: LayoutDashboard, desc: 'Hostels, staff allocations & governance' },
    { id: 'SECURITY', label: 'Campus Security', icon: ShieldCheck, desc: 'Gate posts, clearance checks & movements' },
    { id: 'STUDENT', label: 'Student Portal', icon: GraduationCap, desc: 'Leaves, daily attendance, mess & grievances' },
    { id: 'PARENT', label: 'Parent Portal', icon: Users, desc: 'Ward activity oversight & gate approvals' },
  ];

  return (
    <div className="portal-auth-container">
      <div className="portal-card">
        {/* Brand & Header Topbar */}
        <div className="portal-brand-block">
          <div className="portal-brand-identity">
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: 'var(--primary-color, #2563eb)',
                color: '#ffffff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 16px -4px rgba(37, 99, 235, 0.35)',
              }}
            >
              <Building2 size={24} />
            </div>
            <div className="portal-brand-name-group">
              <span className="portal-brand-main-title">
                Akshaya College of Engineering & Technology
              </span>
              <span className="portal-brand-caption">
                7203 • Unified Campus Portal
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

        {/* Expandable Help Notice */}
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
              Institutional accounts are provisioned for College Administrators, Hostel In-Charges, Security Officers, Students, and Parents. Enter your registered institutional email address and password. If you need assistance, please contact the campus administrator.
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
                onChange={(e) => setEmail(e.target.value)}
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
                placeholder="Enter your account password"
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
            {selectedPersona !== 'HOSTEL_INCHARGE' && (
              <button
                type="button"
                onClick={() => setSelectedPersona('HOSTEL_INCHARGE')}
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
                Reset to In-Charge
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
                  title={`Click to select ${cap.label}: ${cap.desc}`}
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
