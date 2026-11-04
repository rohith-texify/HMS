import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  fetchCollegeById,
  fetchCollegeOnboarding,
  fetchCollegeAdmin,
  updateCollege,
  updateCollegeStatus,
  updateCollegeAdminPassword,
  createStatusApprovalRequest,
} from '../services/collegeService';

import {
  INDIAN_STATES,
  getCitiesForState,
  getAreasForCity,
} from '../constants/indiaLocations';
import {
  Rocket,
  ChevronLeft,
  SlidersHorizontal,
  Boxes,
  AppWindow,
  AlertTriangle,
  Building2,
  Key,
  Shield,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Copy,
  Check,
  Edit2,
  RefreshCw,
  ExternalLink,
  X,
  Mail,
  MapPin,
  Calendar,
  Globe,
  Hash,
  ShieldCheck,
  CheckCircle,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  Sparkles,
  UserCheck,
  Lock,
} from 'lucide-react';

export default function CollegeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [college, setCollege] = useState(null);
  const [onboardingSteps, setOnboardingSteps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // College Admin state
  const [adminAccount, setAdminAccount] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordFormData, setPasswordFormData] = useState({
    password: '',
    confirm_password: '',
    admin_email: '',
  });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);
  const [logoError, setLogoError] = useState(false);
  const [passwordSuccessCredentials, setPasswordSuccessCredentials] = useState(null);

  const getInitials = (name) => {
    if (!name) return 'CL';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const handleCopy = (key, text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2200);
  };

  // Modals state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [editErrors, setEditErrors] = useState({});
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState(null);

  const [showLifecycleModal, setShowLifecycleModal] = useState(false);
  const [targetStatus, setTargetStatus] = useState('');
  const [lifecycleReason, setLifecycleReason] = useState('');
  const [lifecycleMode, setLifecycleMode] = useState('DIRECT'); // 'DIRECT' or 'APPROVAL'
  const [lifecycleSubmitting, setLifecycleSubmitting] = useState(false);
  const [lifecycleError, setLifecycleError] = useState(null);
  const [actionSuccessNotice, setActionSuccessNotice] = useState(null);

  const reqCounterRef = useRef(0);
  const abortControllerRef = useRef(null);

  const loadCollegeData = async (collegeId) => {
    const reqId = ++reqCounterRef.current;
    setLoading(true);
    setError(null);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const data = await fetchCollegeById(collegeId, controller.signal);
      if (reqCounterRef.current !== reqId) return;
      setCollege(data);
      let initialCity = data.city || '';
      let initialArea = '';
      if (initialCity.includes(',')) {
        const parts = initialCity.split(',').map((s) => s.trim());
        if (parts.length >= 2) {
          initialArea = parts[0];
          initialCity = parts.slice(1).join(', ');
        }
      }

      setEditFormData({
        name: data.name || '',
        timezone: data.timezone || 'Asia/Kolkata',
        state: data.state || '',
        city: initialCity,
        area: initialArea,
        custom_city: '',
        custom_area: '',
        contact_email: data.contact_email || '',
        logo_url: data.logo_url || '',
      });

      // Attempt to load onboarding steps
      try {
        const steps = await fetchCollegeOnboarding(collegeId, controller.signal);
        if (reqCounterRef.current === reqId) {
          setOnboardingSteps(steps || []);
        }
      } catch (stepsErr) {
        if (stepsErr?.name !== 'CanceledError' && !controller.signal.aborted) {
          console.warn('Could not load onboarding checklist:', stepsErr.message);
        }
      }

      // Attempt to load college admin account
      try {
        const admin = await fetchCollegeAdmin(collegeId, controller.signal);
        if (reqCounterRef.current === reqId) {
          setAdminAccount(admin);
        }
      } catch (adminErr) {
        if (adminErr?.name !== 'CanceledError' && !controller.signal.aborted) {
          console.warn('Could not load college admin:', adminErr.message);
        }
      }

      if (reqCounterRef.current === reqId) {
        setLoading(false);
      }
    } catch (err) {
      if (
        err?.name === 'CanceledError' ||
        err?.name === 'AbortError' ||
        err?.isCanceled ||
        err?.message === 'canceled' ||
        err?.code === 'ERR_CANCELED' ||
        controller.signal.aborted
      ) {
        return;
      }
      if (reqCounterRef.current === reqId) {
        setError(err.message || 'Failed to load college details');
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (id) {
      loadCollegeData(id);
    }
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [id]);

  // Edit form handling
  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditError(null);

    if (!editFormData.name.trim()) {
      setEditErrors({ name: 'College name is required' });
      return;
    }

    setEditSubmitting(true);
    try {
      const resolvedCity = editFormData.city === 'OTHER' ? (editFormData.custom_city || '').trim() : (editFormData.city || '').trim();
      const resolvedArea = editFormData.area === 'OTHER' ? (editFormData.custom_area || '').trim() : (editFormData.area || '').trim();

      let combinedCity = resolvedCity;
      if (resolvedArea && resolvedCity) {
        combinedCity = `${resolvedArea}, ${resolvedCity}`;
      } else if (resolvedArea) {
        combinedCity = resolvedArea;
      }

      const payload = {
        name: editFormData.name.trim(),
        timezone: editFormData.timezone.trim() || 'Asia/Kolkata',
      };
      if (combinedCity) payload.city = combinedCity.slice(0, 100);
      if (editFormData.state !== undefined) payload.state = editFormData.state.trim() || null;
      if (editFormData.contact_email !== undefined) {
        payload.contact_email = editFormData.contact_email.trim() || null;
      }

      const updated = await updateCollege(college.college_id, payload);
      setCollege(updated);
      setShowEditModal(false);
      setActionSuccessNotice('College profile details updated successfully.');
    } catch (err) {
      setEditError(err.message || 'Failed to update college profile');
    } finally {
      setEditSubmitting(false);
    }
  };

  // Password reset/update modal handling
  const openPasswordModal = () => {
    setPasswordFormData({
      password: '',
      confirm_password: '',
      admin_email: adminAccount?.email || college?.contact_email || (college ? `${college.college_code.toLowerCase()}.admin@hms.local` : ''),
    });
    setShowNewPassword(false);
    setShowConfirmNewPassword(false);
    setPasswordError(null);
    setShowPasswordModal(true);
  };

  const generateModalRandomPassword = () => {
    const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowercase = 'abcdefghijkmnopqrstuvwxyz';
    const numbers = '23456789';
    const symbols = '!@#$%^&*';
    const all = uppercase + lowercase + numbers + symbols;

    let pwd = '';
    pwd += uppercase[Math.floor(Math.random() * uppercase.length)];
    pwd += lowercase[Math.floor(Math.random() * lowercase.length)];
    pwd += numbers[Math.floor(Math.random() * numbers.length)];
    pwd += symbols[Math.floor(Math.random() * symbols.length)];

    for (let i = 4; i < 14; i++) {
      pwd += all[Math.floor(Math.random() * all.length)];
    }
    pwd = pwd.split('').sort(() => 0.5 - Math.random()).join('');

    setPasswordFormData((prev) => ({
      ...prev,
      password: pwd,
      confirm_password: pwd,
    }));
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError(null);

    const pwd = passwordFormData.password;
    if (!pwd) {
      setPasswordError('Password is required');
      return;
    }
    if (pwd.length < 8) {
      setPasswordError('Password must be at least 8 characters long');
      return;
    }
    if (pwd.length > 128) {
      setPasswordError('Password cannot exceed 128 characters');
      return;
    }
    if (pwd !== passwordFormData.confirm_password) {
      setPasswordError('Passwords do not match');
      return;
    }

    setPasswordSubmitting(true);
    try {
      const payload = {
        password: pwd,
      };
      if (passwordFormData.admin_email && passwordFormData.admin_email.trim()) {
        payload.admin_email = passwordFormData.admin_email.trim();
      }

      const updated = await updateCollegeAdminPassword(college.college_id, payload);
      setAdminAccount(updated);
      setShowPasswordModal(false);
      setPasswordSuccessCredentials({
        college_code: college.college_code,
        email: updated.email,
        password: pwd,
      });
      setActionSuccessNotice('College administrator password updated successfully.');

      // Refresh onboarding steps if COLLEGE_ADMIN step was pending
      try {
        const steps = await fetchCollegeOnboarding(college.college_id);
        setOnboardingSteps(steps || []);
      } catch (_) {
        // Ignore onboarding refresh failure
      }
    } catch (err) {
      setPasswordError(err.message || 'Failed to update administrator password');
    } finally {
      setPasswordSubmitting(false);
    }
  };

  // Lifecycle action handling
  const openLifecycleModal = (status) => {
    setTargetStatus(status);
    setLifecycleReason('');
    setLifecycleMode('DIRECT');
    setLifecycleError(null);
    setShowLifecycleModal(true);
  };

  const handleLifecycleSubmit = async (e) => {
    e.preventDefault();
    setLifecycleError(null);

    const trimmedReason = lifecycleReason.trim();
    if (!trimmedReason) {
      setLifecycleError('Lifecycle reason is required for administrative audit tracking.');
      return;
    }

    setLifecycleSubmitting(true);
    try {
      if (lifecycleMode === 'APPROVAL') {
        await createStatusApprovalRequest({
          college_id: college.college_id,
          status: targetStatus,
          reason: trimmedReason,
        });
        setShowLifecycleModal(false);
        setActionSuccessNotice(
          `Maker-checker approval request submitted for transitioning status to ${targetStatus}. Awaiting second administrator decision.`
        );
      } else {
        const updated = await updateCollegeStatus(college.college_id, {
          status: targetStatus,
          reason: trimmedReason,
        });
        setCollege(updated);
        setShowLifecycleModal(false);
        setActionSuccessNotice(`College lifecycle status changed to ${targetStatus} successfully.`);
      }
    } catch (err) {
      setLifecycleError(err.message || 'Failed to update college status');
    } finally {
      setLifecycleSubmitting(false);
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'ACTIVE':
        return 'badge-success';
      case 'ONBOARDING':
        return 'badge-warning';
      case 'SUSPENDED':
        return 'badge-danger';
      case 'DEACTIVATED':
        return 'badge-deactivated';
      default:
        return 'badge-muted';
    }
  };

  if (loading) {
    return (
      <div className="card loading-box">
        <p>Loading college profile details...</p>
      </div>
    );
  }

  if (error || !college) {
    return (
      <div className="card error-box" style={{ maxWidth: '640px', margin: '40px auto' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={20} className="text-amber-600" />
          <span>College Not Found</span>
        </h2>
        <p>{error || 'The requested college record could not be loaded.'}</p>
        <div style={{ marginTop: '20px' }}>
          <button className="btn-enterprise btn-outline-soft" onClick={() => navigate('/colleges')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <ChevronLeft size={14} />
            <span>Return to Directory</span>
          </button>
        </div>
      </div>
    );
  }

  const isDeactivated = college.status === 'DEACTIVATED';
  const completedStepsCount = onboardingSteps.filter((s) => s.status === 'COMPLETED').length;

  return (
    <div className="college-detail-container">
      {/* College Hero Card - Enterprise Modern Spec */}
      <div className="college-detail-hero-v2">
        <div className="college-hero-header-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link to="/colleges" className="college-hero-breadcrumb">
              <ChevronLeft size={15} />
              <span>Institutions Directory</span>
            </Link>
            <span style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>/</span>
            <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.84rem' }}>
              {college.name}
            </span>
          </div>

          <div className="college-hero-sync-cluster">
            <span style={{ fontSize: '0.76rem', color: '#059669', display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 600, backgroundColor: '#ecfdf5', padding: '3px 10px', borderRadius: '9999px', border: '1px solid #a7f3d0' }}>
              <span className="badge-dot" style={{ backgroundColor: '#10b981' }} />
              <span>Live DB Sync</span>
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: '#64748b' }}>UUID:</span>
              <span style={{ fontFamily: 'monospace', color: '#0f172a', fontWeight: 600 }}>
                {college.college_id ? `${college.college_id.slice(0, 13)}...` : '—'}
              </span>
              <button
                type="button"
                className={`copy-btn-inline ${copiedKey === 'top_id' ? 'copied' : ''}`}
                onClick={() => handleCopy('top_id', college.college_id)}
                title="Copy Full College UUID"
              >
                {copiedKey === 'top_id' ? <Check size={11} /> : <Copy size={11} />}
                <span>{copiedKey === 'top_id' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="college-hero-profile-row">
          <div className="college-hero-avatar-frame">
            {college.logo_url && !logoError ? (
              <img
                src={college.logo_url}
                alt={college.name}
                className="college-hero-avatar-img"
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="college-hero-monogram-avatar" title={college.name}>
                {getInitials(college.name)}
              </div>
            )}
          </div>

          <div className="college-hero-text-block">
            <h1 className="college-hero-name-heading">
              <span>{college.name}</span>
              <span className={`badge ${getStatusBadgeClass(college.status)}`}>
                <span className="badge-dot" />
                <span>{college.status}</span>
              </span>
            </h1>

            <div className="college-hero-chips-bar">
              <div className="hero-chip hero-chip-code">
                <span>Tenant Code:</span>
                <strong>{college.college_code}</strong>
                <button
                  type="button"
                  className={`copy-btn-inline ${copiedKey === 'code' ? 'copied' : ''}`}
                  onClick={() => handleCopy('code', college.college_code)}
                  title="Copy Tenant Code"
                  style={{ marginLeft: '4px', padding: '1px 6px' }}
                >
                  {copiedKey === 'code' ? <Check size={10} /> : <Copy size={10} />}
                  <span>{copiedKey === 'code' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              {(college.city || college.state) && (
                <div className="hero-chip hero-chip-location">
                  <MapPin size={13} style={{ color: '#dc2626' }} />
                  <span>{[college.city, college.state].filter(Boolean).join(', ')}</span>
                </div>
              )}

              <div className="hero-chip hero-chip-timezone">
                <Globe size={13} style={{ color: '#4f46e5' }} />
                <span>IST (Asia/Kolkata, UTC+05:30)</span>
              </div>

              {college.contact_email && (
                <div className="hero-chip hero-chip-email">
                  <Mail size={13} style={{ color: '#2563eb' }} />
                  <span>{college.contact_email}</span>
                  <button
                    type="button"
                    className={`copy-btn-inline ${copiedKey === 'top_email' ? 'copied' : ''}`}
                    onClick={() => handleCopy('top_email', college.contact_email)}
                    title="Copy Contact Email"
                    style={{ marginLeft: '4px', padding: '1px 6px' }}
                  >
                    {copiedKey === 'top_email' ? <Check size={10} /> : <Copy size={10} />}
                    <span>{copiedKey === 'top_email' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              )}

              {college.created_at && (
                <div className="hero-chip hero-chip-date">
                  <Calendar size={13} style={{ color: '#64748b' }} />
                  <span>Registered {new Date(college.created_at).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Hub Toolbar */}
        <div className="college-hero-toolbar">
          {college.status === 'ONBOARDING' ? (
            <Link
              to={`/colleges/${college.college_id}/onboarding`}
              className="hero-cta-btn"
              id="btn-onboarding-wizard"
            >
              <Rocket size={15} />
              <span>Resume Onboarding Checklist</span>
            </Link>
          ) : (
            <Link
              to={`/colleges/${college.college_id}/onboarding`}
              className="hero-nav-btn"
              id="btn-onboarding-wizard"
              title="View onboarding workspace and setup checklist"
            >
              <Rocket size={14} />
              <span>Onboarding Workspace</span>
            </Link>
          )}

          <Link
            to={`/colleges/${college.college_id}/configuration`}
            className="hero-nav-btn"
            id="btn-college-configuration"
            title="Manage platform tenant configuration, security floors, and policies"
          >
            <SlidersHorizontal size={14} />
            <span>Configuration &amp; Policies</span>
          </Link>

          <Link
            to={`/colleges/${college.college_id}/modules`}
            className="hero-nav-btn"
            id="btn-college-modules"
            title="Manage college module entitlements, dependencies, and matrix"
          >
            <Boxes size={14} />
            <span>Module Entitlements</span>
          </Link>

          <Link
            to={`/colleges/${college.college_id}/applications`}
            className="hero-nav-btn"
            id="btn-college-applications"
            title="Manage mobile and portal application access, version policy, and force-updates"
          >
            <AppWindow size={14} />
            <span>Applications Access</span>
          </Link>

          <Link
            to={`/colleges/${college.college_id}/hostel-structure`}
            className="hero-nav-btn"
            id="btn-college-hostel-structure"
            title="Manage physical hostel facilities, buildings, floors, rooms, and beds"
          >
            <Building2 size={14} />
            <span>Hostel Structure</span>
          </Link>

          <Link
            to={`/colleges/${college.college_id}/admins`}
            className="hero-nav-btn"
            id="btn-college-admins"
            title="Manage all college administrator accounts, status, unlock, and login history"
          >
            <Key size={14} />
            <span>Administrator Accounts</span>
          </Link>

          <button
            className="hero-nav-btn"
            onClick={() => setShowEditModal(true)}
            disabled={isDeactivated}
            title={isDeactivated ? 'Cannot edit profile while deactivated' : 'Edit college details'}
            id="btn-edit-profile"
          >
            <Edit2 size={14} />
            <span>Edit Profile</span>
          </button>
        </div>
      </div>

      {/* Onboarding in Progress Banner */}
      {college.status === 'ONBOARDING' && (
        <div className="college-onboarding-banner">
          <div className="college-onboarding-left">
            <div className="college-onboarding-icon-wrap">
              <Rocket size={24} />
            </div>
            <div className="college-onboarding-content">
              <div className="college-onboarding-title-wrap">
                <h3 className="college-onboarding-heading">
                  Institution Tenant Onboarding in Progress
                </h3>
                <span className="badge badge-blue">
                  {completedStepsCount} of {onboardingSteps.length || 6} Stages Completed ({Math.round((completedStepsCount / (onboardingSteps.length || 6)) * 100)}%)
                </span>
              </div>
              <p className="college-onboarding-sub">
                This institution tenant is undergoing phased onboarding. Complete canonical checklist stages (Hostel Structure, Entitlements, Room Inventory, Bed Allocations) to promote this tenant to Active operational status.
              </p>
              <div className="college-onboarding-progress-bar">
                <div
                  className="college-onboarding-progress-fill"
                  style={{
                    width: `${Math.max(10, Math.round((completedStepsCount / (onboardingSteps.length || 6)) * 100))}%`,
                  }}
                />
              </div>
            </div>
          </div>
          <Link
            to={`/colleges/${college.college_id}/onboarding`}
            className="hero-cta-btn"
            id="btn-banner-resume-wizard"
            style={{ padding: '10px 18px', fontSize: '0.85rem' }}
          >
            <span>Open Onboarding Workspace</span>
            <span>→</span>
          </Link>
        </div>
      )}

      {/* Executive 4-KPI Overview Strip */}
      <div className="college-kpi-grid">
        <div className="college-kpi-card">
          <div className="kpi-icon-squircle blue">
            <Hash size={20} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Tenant Login Code</div>
            <div className="kpi-val" style={{ fontFamily: 'monospace', color: '#1e40af' }}>
              {college.college_code}
            </div>
            <div className="kpi-sub">Multi-tenant Authentication Key</div>
          </div>
          <button
            type="button"
            className={`copy-btn-inline ${copiedKey === 'kpi_code' ? 'copied' : ''}`}
            onClick={() => handleCopy('kpi_code', college.college_code)}
            title="Copy tenant code"
          >
            {copiedKey === 'kpi_code' ? <Check size={11} /> : <Copy size={11} />}
          </button>
        </div>

        <div className="college-kpi-card">
          <div className={`kpi-icon-squircle ${college.status === 'ACTIVE' ? 'emerald' : college.status === 'ONBOARDING' ? 'blue' : 'amber'}`}>
            <ShieldCheck size={20} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Operational Status</div>
            <div className="kpi-val" style={{ fontSize: '1.1rem' }}>
              <span className={`badge ${getStatusBadgeClass(college.status)}`}>
                <span className="badge-dot" />
                <span>{college.status}</span>
              </span>
            </div>
            <div className="kpi-sub">{completedStepsCount} of {onboardingSteps.length || 6} Stages Completed</div>
          </div>
        </div>

        <div className="college-kpi-card">
          <div className="kpi-icon-squircle purple">
            <UserCheck size={20} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Primary Administrator</div>
            <div className="kpi-val" style={{ fontSize: '0.98rem' }} title={adminAccount?.email || 'No account'}>
              {adminAccount ? adminAccount.email.split('@')[0] : 'Unassigned'}
            </div>
            <div className="kpi-sub" style={{ fontSize: '0.74rem' }}>
              {adminAccount ? adminAccount.email : 'Credentials pending setup'}
            </div>
          </div>
          {adminAccount?.email && (
            <button
              type="button"
              className={`copy-btn-inline ${copiedKey === 'kpi_admin' ? 'copied' : ''}`}
              onClick={() => handleCopy('kpi_admin', adminAccount.email)}
              title="Copy admin email"
            >
              {copiedKey === 'kpi_admin' ? <Check size={11} /> : <Copy size={11} />}
            </button>
          )}
        </div>

        <div className="college-kpi-card">
          <div className="kpi-icon-squircle emerald">
            <Lock size={20} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Security &amp; Passwords</div>
            <div className="kpi-val" style={{ fontSize: '1.05rem', color: adminAccount?.has_password ? '#059669' : '#dc2626' }}>
              {adminAccount?.has_password ? 'Configured' : 'Pending'}
            </div>
            <div className="kpi-sub">
              {adminAccount?.has_password ? 'Active (bcrypt encrypted)' : 'Action required'}
            </div>
          </div>
          <button
            type="button"
            className="copy-btn-inline"
            onClick={openPasswordModal}
            title="Update Admin Password"
          >
            <Key size={11} />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {actionSuccessNotice && (
        <div
          className="card enterprise-card"
          style={{
            borderColor: 'var(--success-border)',
            backgroundColor: 'var(--success-bg)',
            color: 'var(--success-text)',
            padding: '12px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontWeight: 600 }}>✓ {actionSuccessNotice}</span>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setActionSuccessNotice(null)}
            style={{ fontSize: '0.75rem', padding: '4px 6px', display: 'inline-flex', alignItems: 'center' }}
            aria-label="Dismiss notice"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Password Reset Success Credentials Banner */}
      {passwordSuccessCredentials && (
        <div
          className="card enterprise-card"
          style={{
            borderColor: 'var(--success-border)',
            backgroundColor: 'var(--success-bg)',
            padding: '18px 20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ color: 'var(--success-text)', fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={18} />
              <span>Administrator Credentials Updated Successfully</span>
            </div>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setPasswordSuccessCredentials(null)}
              style={{ fontSize: '0.75rem', padding: '4px 6px', display: 'inline-flex', alignItems: 'center' }}
              aria-label="Dismiss credentials banner"
            >
              <X size={13} />
            </button>
          </div>
          <p style={{ color: 'var(--success-text)', fontSize: '0.85rem', marginBottom: '14px' }}>
            The administrator credentials for <strong>{college.name}</strong> have been configured. The administrator can immediately authenticate to the Admin Module.
          </p>

          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '14px 18px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '16px',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Tenant Login Code:</span>
                <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.95rem', color: '#1e40af' }}>{passwordSuccessCredentials.college_code}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Admin Email:</span>
                <div style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.95rem' }}>{passwordSuccessCredentials.email}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>New Password:</span>
                <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.95rem', color: 'var(--primary-color)' }}>
                  {passwordSuccessCredentials.password}
                </div>
              </div>
            </div>

            <button
              type="button"
              className="btn-enterprise btn-outline-soft"
              onClick={() => {
                const creds = `HMS College Administrator Access\nCollege: ${college.name}\nCollege ID / Code: ${passwordSuccessCredentials.college_code}\nAdmin Email: ${passwordSuccessCredentials.email}\nPassword: ${passwordSuccessCredentials.password}`;
                handleCopy('notice_creds', creds);
              }}
            >
              {copiedKey === 'notice_creds' ? <Check size={13} /> : <Copy size={13} />}
              <span>{copiedKey === 'notice_creds' ? 'Copied to Clipboard!' : 'Copy Credentials'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Identity & Operational Parameters Card */}
      <div className="card enterprise-card">
        <div className="card-header">
          <div className="card-title">
            <Building2 size={18} style={{ color: '#2563eb' }} />
            <span>Identity &amp; Operational Parameters</span>
          </div>
          <span style={{ fontSize: '0.78rem', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <Clock size={13} />
            <span>Last Updated: {college.updated_at ? new Date(college.updated_at).toLocaleString() : '—'}</span>
          </span>
        </div>

        <div className="parameter-cards-grid">
          <div className="param-tile">
            <div className="param-tile-icon blue">
              <Hash size={18} />
            </div>
            <div className="param-tile-body">
              <div className="param-tile-label">
                <span>College Code (Tenant Code)</span>
              </div>
              <div className="param-tile-value">
                <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '1.05rem', color: '#1e40af' }}>
                  {college.college_code}
                </span>
                <button
                  type="button"
                  className={`copy-btn-inline ${copiedKey === 'code_param' ? 'copied' : ''}`}
                  onClick={() => handleCopy('code_param', college.college_code)}
                  title="Copy code"
                >
                  {copiedKey === 'code_param' ? <Check size={11} /> : <Copy size={11} />}
                  <span>{copiedKey === 'code_param' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="param-tile">
            <div className="param-tile-icon emerald">
              <ShieldCheck size={18} />
            </div>
            <div className="param-tile-body">
              <div className="param-tile-label">
                <span>Operational Status</span>
              </div>
              <div className="param-tile-value">
                <span className={`badge ${getStatusBadgeClass(college.status)}`}>
                  <span className="badge-dot" />
                  <span>{college.status}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="param-tile">
            <div className="param-tile-icon purple">
              <Globe size={18} />
            </div>
            <div className="param-tile-body">
              <div className="param-tile-label">
                <span>Operational Timezone</span>
              </div>
              <div className="param-tile-value" style={{ fontSize: '0.84rem' }}>
                IST (Asia/Kolkata, UTC+05:30)
              </div>
            </div>
          </div>

          <div className="param-tile">
            <div className="param-tile-icon amber">
              <Mail size={18} />
            </div>
            <div className="param-tile-body">
              <div className="param-tile-label">
                <span>Primary Contact Email</span>
              </div>
              <div className="param-tile-value">
                <span style={{ fontSize: '0.84rem', wordBreak: 'break-all' }}>
                  {college.contact_email || '—'}
                </span>
                {college.contact_email && (
                  <button
                    type="button"
                    className={`copy-btn-inline ${copiedKey === 'contact_email' ? 'copied' : ''}`}
                    onClick={() => handleCopy('contact_email', college.contact_email)}
                    title="Copy contact email"
                  >
                    {copiedKey === 'contact_email' ? <Check size={11} /> : <Copy size={11} />}
                    <span>{copiedKey === 'contact_email' ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="param-tile">
            <div className="param-tile-icon rose">
              <MapPin size={18} />
            </div>
            <div className="param-tile-body">
              <div className="param-tile-label">
                <span>Campus Location</span>
              </div>
              <div className="param-tile-value" style={{ fontSize: '0.84rem' }}>
                {college.city || college.state
                  ? [college.city, college.state].filter(Boolean).join(', ')
                  : '—'}
              </div>
            </div>
          </div>

          <div className="param-tile">
            <div className="param-tile-icon slate">
              <Key size={18} />
            </div>
            <div className="param-tile-body">
              <div className="param-tile-label">
                <span>Tenant UUID</span>
              </div>
              <div className="param-tile-value">
                <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#64748b' }}>
                  {college.college_id ? `${college.college_id.slice(0, 16)}...` : '—'}
                </span>
                <button
                  type="button"
                  className={`copy-btn-inline ${copiedKey === 'uuid' ? 'copied' : ''}`}
                  onClick={() => handleCopy('uuid', college.college_id)}
                  title="Copy full UUID"
                >
                  {copiedKey === 'uuid' ? <Check size={11} /> : <Copy size={11} />}
                  <span>{copiedKey === 'uuid' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="param-tile">
            <div className="param-tile-icon slate">
              <Calendar size={18} />
            </div>
            <div className="param-tile-body">
              <div className="param-tile-label">
                <span>Registered Timestamp</span>
              </div>
              <div className="param-tile-value" style={{ fontSize: '0.84rem' }}>
                {college.created_at ? new Date(college.created_at).toLocaleString() : '—'}
              </div>
            </div>
          </div>

          <div className="param-tile">
            <div className="param-tile-icon blue">
              <Clock size={18} />
            </div>
            <div className="param-tile-body">
              <div className="param-tile-label">
                <span>Last Modified</span>
              </div>
              <div className="param-tile-value" style={{ fontSize: '0.84rem' }}>
                {college.updated_at ? new Date(college.updated_at).toLocaleString() : '—'}
              </div>
            </div>
          </div>

          {college.activated_at && (
            <div className="param-tile" style={{ borderColor: '#a7f3d0', backgroundColor: '#f0fdf4' }}>
              <div className="param-tile-icon emerald">
                <CheckCircle2 size={18} />
              </div>
              <div className="param-tile-body">
                <div className="param-tile-label" style={{ color: '#047857' }}>
                  <span>Activated Timestamp</span>
                </div>
                <div className="param-tile-value" style={{ fontSize: '0.84rem', color: '#047857' }}>
                  {new Date(college.activated_at).toLocaleString()}
                </div>
              </div>
            </div>
          )}

          {college.suspended_at && (
            <div className="param-tile" style={{ borderColor: 'var(--danger-border)', backgroundColor: '#fef2f2' }}>
              <div className="param-tile-icon rose">
                <AlertTriangle size={18} />
              </div>
              <div className="param-tile-body">
                <div className="param-tile-label" style={{ color: 'var(--danger-text)' }}>
                  <span>Suspended At</span>
                </div>
                <div className="param-tile-value" style={{ fontSize: '0.84rem', color: 'var(--danger-text)' }}>
                  {new Date(college.suspended_at).toLocaleString()}
                </div>
              </div>
            </div>
          )}

          {college.deactivated_at && (
            <div className="param-tile">
              <div className="param-tile-icon slate">
                <Clock size={18} />
              </div>
              <div className="param-tile-body">
                <div className="param-tile-label">
                  <span>Deactivated At</span>
                </div>
                <div className="param-tile-value" style={{ fontSize: '0.84rem' }}>
                  {new Date(college.deactivated_at).toLocaleString()}
                </div>
              </div>
            </div>
          )}
        </div>

        {college.lifecycle_reason && (
          <div
            style={{
              marginTop: '16px',
              padding: '12px 16px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '0.84rem',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <span style={{ fontWeight: 700, color: '#475569' }}>Lifecycle Justification:</span>
            <span style={{ color: '#0f172a' }}>{college.lifecycle_reason}</span>
          </div>
        )}
      </div>

      {/* College Administrator & Module Access Card */}
      <div className="card enterprise-card">
        <div className="card-header">
          <div className="card-title">
            <Key size={18} style={{ color: '#2563eb' }} />
            <span>College Administrator Access &amp; Module Governance</span>
            {adminAccount ? (
              <span className="badge badge-success">
                <span className="badge-dot" />
                <span>Credentials Configured</span>
              </span>
            ) : (
              <span className="badge badge-warning">
                <span className="badge-dot" />
                <span>No Admin Account</span>
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Link
              to={`/colleges/${college.college_id}/admins`}
              className="btn-enterprise btn-outline-soft btn-sm"
              id="btn-manage-all-admins"
              title="View and manage all administrators for this college"
            >
              <Building2 size={13} />
              <span>Manage All Admins</span>
            </Link>
            <button
              className="btn-enterprise btn-primary-blue btn-sm"
              onClick={openPasswordModal}
              id="btn-manage-admin-password"
              title="Update or reset college administrator password"
            >
              <Key size={13} />
              <span>{adminAccount ? 'Reset Admin Password' : 'Initialize Admin Credentials'}</span>
            </button>
          </div>
        </div>

        <div style={{
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '10px',
          padding: '14px 18px',
          marginBottom: '16px',
          fontSize: '0.84rem',
          color: '#1e40af',
          lineHeight: '1.55',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap',
        }}>
          <div>
            Credentials used by the institutional administrator to log into and run the <strong>Admin Module</strong>. The administrator can authenticate using either the <strong>Tenant Login Code ({college.college_code})</strong> or their <strong>Admin Email ({adminAccount?.email || college.contact_email})</strong>.
            <div style={{ marginTop: '6px', display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '0.78rem' }}>
              <span>🚀 <strong>Portal Login:</strong> <a href="http://localhost:5173/admin/login" target="_blank" rel="noreferrer" style={{ color: '#1d4ed8', fontWeight: 600 }}>http://localhost:5173/admin/login</a></span>
              <span>🏢 <strong>Dedicated Web:</strong> <a href="http://localhost:3002/admin/login" target="_blank" rel="noreferrer" style={{ color: '#1d4ed8', fontWeight: 600 }}>http://localhost:3002/admin/login</a></span>
            </div>
          </div>

          {adminAccount && (
            <button
              type="button"
              className="btn-enterprise btn-outline-soft"
              onClick={() => {
                const packageText = `HMS College Administrator Access\nInstitution: ${college.name}\nTenant Login Code: ${college.college_code}\nAdmin Email: ${adminAccount.email}\nPortal URL: http://localhost:5173/admin/login\nDedicated Admin URL: http://localhost:3002/admin/login`;
                handleCopy('admin_pkg', packageText);
              }}
              style={{ flexShrink: 0 }}
            >
              {copiedKey === 'admin_pkg' ? <Check size={13} /> : <Copy size={13} />}
              <span>{copiedKey === 'admin_pkg' ? 'Copied Full Package!' : 'Copy Access Package'}</span>
            </button>
          )}
        </div>

        {adminAccount ? (
          <div className="parameter-cards-grid">
            <div className="param-tile">
              <div className="param-tile-icon blue">
                <Mail size={18} />
              </div>
              <div className="param-tile-body">
                <div className="param-tile-label">
                  <span>Admin Login Email / ID</span>
                </div>
                <div className="param-tile-value">
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.88rem' }}>
                    {adminAccount.email}
                  </span>
                  <button
                    type="button"
                    className={`copy-btn-inline ${copiedKey === 'admin_email' ? 'copied' : ''}`}
                    onClick={() => handleCopy('admin_email', adminAccount.email)}
                    title="Copy email"
                  >
                    {copiedKey === 'admin_email' ? <Check size={11} /> : <Copy size={11} />}
                    <span>{copiedKey === 'admin_email' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="param-tile">
              <div className="param-tile-icon blue">
                <Hash size={18} />
              </div>
              <div className="param-tile-body">
                <div className="param-tile-label">
                  <span>Tenant Login Code</span>
                </div>
                <div className="param-tile-value">
                  <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '1.05rem', color: '#1e40af' }}>
                    {college.college_code}
                  </span>
                  <button
                    type="button"
                    className={`copy-btn-inline ${copiedKey === 'admin_code' ? 'copied' : ''}`}
                    onClick={() => handleCopy('admin_code', college.college_code)}
                    title="Copy tenant code"
                  >
                    {copiedKey === 'admin_code' ? <Check size={11} /> : <Copy size={11} />}
                    <span>{copiedKey === 'admin_code' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="param-tile">
              <div className="param-tile-icon purple">
                <UserCheck size={18} />
              </div>
              <div className="param-tile-body">
                <div className="param-tile-label">
                  <span>Assigned Platform Role</span>
                </div>
                <div className="param-tile-value">
                  <span className="badge badge-purple">
                    {adminAccount.role_name || adminAccount.role_code}
                  </span>
                </div>
              </div>
            </div>

            <div className="param-tile">
              <div className="param-tile-icon emerald">
                <ShieldCheck size={18} />
              </div>
              <div className="param-tile-body">
                <div className="param-tile-label">
                  <span>Account Status</span>
                </div>
                <div className="param-tile-value">
                  <span className={`badge ${adminAccount.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`}>
                    <span className="badge-dot" />
                    <span>{adminAccount.status}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="param-tile">
              <div className="param-tile-icon emerald">
                <Lock size={18} />
              </div>
              <div className="param-tile-body">
                <div className="param-tile-label">
                  <span>Password Security</span>
                </div>
                <div className="param-tile-value">
                  {adminAccount.has_password ? (
                    <span className="badge badge-success">
                      <Check size={12} />
                      <span>Active (Hashed &amp; Salted)</span>
                    </span>
                  ) : (
                    <span className="badge badge-danger">Not Configured</span>
                  )}
                </div>
              </div>
            </div>

            <div className="param-tile">
              <div className="param-tile-icon slate">
                <Clock size={18} />
              </div>
              <div className="param-tile-body">
                <div className="param-tile-label">
                  <span>Last Successful Login</span>
                </div>
                <div className="param-tile-value" style={{ fontSize: '0.82rem', color: adminAccount.last_login_at ? '#0f172a' : '#64748b' }}>
                  {adminAccount.last_login_at ? new Date(adminAccount.last_login_at).toLocaleString() : 'Never logged in yet'}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: '24px',
              backgroundColor: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <AlertTriangle size={20} style={{ color: '#d97706', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ color: '#92400e', fontSize: '0.92rem' }}>No Administrator Account Configured</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: '#b45309' }}>
                  The administrative credentials have not been initialized for this institution. Initialize admin credentials to provide administrative portal access.
                </p>
              </div>
            </div>
            <button
              className="btn-enterprise btn-primary-blue"
              onClick={openPasswordModal}
            >
              <Key size={14} />
              <span>Initialize Admin Credentials</span>
            </button>
          </div>
        )}
      </div>

      {/* Lifecycle Management Controls */}
      <div className="card enterprise-card">
        <div className="card-header">
          <div className="card-title">
            <Shield size={18} style={{ color: '#4f46e5' }} />
            <span>Lifecycle Governance &amp; State Transitions</span>
          </div>
          <span className="badge badge-muted">Authorized Super Admin Governance</span>
        </div>

        <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '16px' }}>
          State transitions enforce immutable platform audit logging, mandatory justification, and prerequisite checks before mutation.
        </p>

        {/* Visual State Pipeline */}
        <div className="lifecycle-pipeline">
          <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginRight: '6px' }}>Lifecycle Flow:</span>
          <div className={`lifecycle-step ${college.status === 'ONBOARDING' ? 'is-current' : ''}`}>
            <span className="badge-dot" style={{ backgroundColor: college.status === 'ONBOARDING' ? '#2563eb' : '#94a3b8' }} />
            <span>ONBOARDING</span>
          </div>
          <span className="lifecycle-step-arrow">➔</span>
          <div className={`lifecycle-step ${college.status === 'ACTIVE' ? 'is-current' : ''}`}>
            <span className="badge-dot" style={{ backgroundColor: college.status === 'ACTIVE' ? '#059669' : '#94a3b8' }} />
            <span>ACTIVE</span>
          </div>
          <span className="lifecycle-step-arrow">⇄</span>
          <div className={`lifecycle-step ${college.status === 'SUSPENDED' ? 'is-current' : ''}`}>
            <span className="badge-dot" style={{ backgroundColor: college.status === 'SUSPENDED' ? '#d97706' : '#94a3b8' }} />
            <span>SUSPENDED</span>
          </div>
          <span className="lifecycle-step-arrow">➔</span>
          <div className={`lifecycle-step ${college.status === 'DEACTIVATED' ? 'is-current' : ''}`}>
            <span className="badge-dot" style={{ backgroundColor: college.status === 'DEACTIVATED' ? '#dc2626' : '#94a3b8' }} />
            <span>DEACTIVATED</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {college.status === 'ONBOARDING' && (
            <>
              <button
                className="btn-enterprise btn-emerald"
                onClick={() => openLifecycleModal('ACTIVE')}
                id="btn-lifecycle-activate"
              >
                <CheckCircle size={14} />
                <span>Activate College</span>
              </button>
              <button
                className="btn-enterprise btn-outline-rose"
                onClick={() => openLifecycleModal('DEACTIVATED')}
                id="btn-lifecycle-deactivate"
              >
                <X size={14} />
                <span>Deactivate College</span>
              </button>
            </>
          )}

          {college.status === 'ACTIVE' && (
            <>
              <button
                className="btn-enterprise btn-outline-amber"
                onClick={() => openLifecycleModal('SUSPENDED')}
                id="btn-lifecycle-suspend"
              >
                <PauseCircle size={14} />
                <span>Suspend Operations</span>
              </button>
              <button
                className="btn-enterprise btn-outline-rose"
                onClick={() => openLifecycleModal('DEACTIVATED')}
                id="btn-lifecycle-deactivate"
              >
                <X size={14} />
                <span>Deactivate College</span>
              </button>
            </>
          )}

          {college.status === 'SUSPENDED' && (
            <>
              <button
                className="btn-enterprise btn-emerald"
                onClick={() => openLifecycleModal('ACTIVE')}
                id="btn-lifecycle-reinstate"
              >
                <PlayCircle size={14} />
                <span>Reinstate Operations (Activate)</span>
              </button>
              <button
                className="btn-enterprise btn-outline-rose"
                onClick={() => openLifecycleModal('DEACTIVATED')}
                id="btn-lifecycle-deactivate"
              >
                <X size={14} />
                <span>Deactivate College</span>
              </button>
            </>
          )}

          {college.status === 'DEACTIVATED' && (
            <button
              className="btn-enterprise btn-primary-blue"
              onClick={() => openLifecycleModal('ACTIVE')}
              id="btn-lifecycle-reactivate"
            >
              <RotateCcw size={14} />
              <span>Reactivate College</span>
            </button>
          )}
        </div>
      </div>

      {/* Onboarding Checklist Summary */}
      <div className="card enterprise-card">
        <div className="card-header">
          <div className="card-title">
            <Rocket size={18} style={{ color: '#2563eb' }} />
            <span>Canonical Onboarding Checklist</span>
            {onboardingSteps.length > 0 && (
              <span className="badge badge-blue">
                {completedStepsCount} / {onboardingSteps.length} Completed
              </span>
            )}
          </div>
          <Link to={`/colleges/${college.college_id}/onboarding`} className="card-header-link">
            <span>Open Onboarding Workspace</span>
            <span>→</span>
          </Link>
        </div>

        {onboardingSteps.length === 0 ? (
          <div className="empty-state-clean">
            <p style={{ color: '#64748b', fontSize: '0.88rem' }}>No onboarding checklist items recorded for this institution.</p>
          </div>
        ) : (
          <div className="table-responsive" style={{ border: '1px solid #edf2f7', borderRadius: '10px', overflow: 'hidden' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #edf2f7' }}>
                  <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'left' }}>Step Sequence &amp; Code</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'left' }}>Status</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'left' }}>Completed At</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'left' }}>Notes / Context</th>
                </tr>
              </thead>
              <tbody>
                {onboardingSteps.map((step, idx) => (
                  <tr key={step.onboarding_id || step.step_code} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', width: '20px' }}>#{idx + 1}</span>
                        <span style={{ fontWeight: 600, color: '#0f172a', fontFamily: 'monospace' }}>{step.step_code}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        className={`badge ${step.status === 'COMPLETED'
                          ? 'badge-success'
                          : step.status === 'IN_PROGRESS'
                            ? 'badge-warning'
                            : 'badge-muted'
                          }`}
                      >
                        <span className="badge-dot" />
                        <span>{step.status}</span>
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.82rem', color: '#64748b' }}>
                      {step.completed_at ? new Date(step.completed_at).toLocaleString() : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.84rem', color: '#334155' }}>
                      {step.notes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Fast Platform Governance Navigation Hub */}
      <div className="card enterprise-card">
        <div className="card-header">
          <div className="card-title">
            <Sparkles size={18} style={{ color: '#2563eb' }} />
            <span>Platform Governance &amp; Institutional Tooling</span>
          </div>
        </div>

        <div className="platform-links-grid">
          <Link to={`/colleges/${college.college_id}/configuration`} className="platform-link-card">
            <div className="platform-link-icon-box">
              <SlidersHorizontal size={20} />
            </div>
            <div className="platform-link-info">
              <div className="platform-link-title">
                <span>Tenant Configuration</span>
                <span>→</span>
              </div>
              <p className="platform-link-desc">Manage institutional security floors, policies, and parameters</p>
            </div>
          </Link>

          <Link to={`/colleges/${college.college_id}/modules`} className="platform-link-card">
            <div className="platform-link-icon-box">
              <Boxes size={20} />
            </div>
            <div className="platform-link-info">
              <div className="platform-link-title">
                <span>Module Entitlements</span>
                <span>→</span>
              </div>
              <p className="platform-link-desc">Configure module subscriptions, licensing, and feature flags</p>
            </div>
          </Link>

          <Link to={`/colleges/${college.college_id}/hostel-structure`} className="platform-link-card">
            <div className="platform-link-icon-box">
              <Building2 size={20} />
            </div>
            <div className="platform-link-info">
              <div className="platform-link-title">
                <span>Hostel Facilities Master</span>
                <span>→</span>
              </div>
              <p className="platform-link-desc">Physical campus blocks, floors, rooms, and bed capacity</p>
            </div>
          </Link>

          <Link to={`/colleges/${college.college_id}/applications`} className="platform-link-card">
            <div className="platform-link-icon-box">
              <AppWindow size={20} />
            </div>
            <div className="platform-link-info">
              <div className="platform-link-title">
                <span>Applications &amp; Portal</span>
                <span>→</span>
              </div>
              <p className="platform-link-desc">App versions, mobile rollout, and release channels</p>
            </div>
          </Link>

          <Link to="/approvals" className="platform-link-card">
            <div className="platform-link-icon-box">
              <ShieldCheck size={20} />
            </div>
            <div className="platform-link-info">
              <div className="platform-link-title">
                <span>Approvals Workflow</span>
                <span>→</span>
              </div>
              <p className="platform-link-desc">Maker-checker requests and pending administrative changes</p>
            </div>
          </Link>

          <Link to="/audit-logs" className="platform-link-card">
            <div className="platform-link-icon-box">
              <Clock size={20} />
            </div>
            <div className="platform-link-info">
              <div className="platform-link-title">
                <span>Platform Audit Logs</span>
                <span>→</span>
              </div>
              <p className="platform-link-desc">Cryptographically secured operational and compliance history</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Edit College Profile</h2>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setShowEditModal(false)}
                disabled={editSubmitting}
                style={{ padding: '4px 6px', display: 'inline-flex', alignItems: 'center' }}
                aria-label="Close edit modal"
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className="modal-body">
                {editError && (
                  <div className="error-box" style={{ marginBottom: '16px', padding: '10px', textAlign: 'left' }}>
                    <strong>Error:</strong> {editError}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">College Code (Immutable)</label>
                  <input
                    type="text"
                    className="form-control"
                    value={college.college_code}
                    disabled
                  />
                  <div className="form-hint">College code cannot be altered after creation.</div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="edit-name">
                    College Name <span className="required">*</span>
                  </label>
                  <input
                    id="edit-name"
                    name="name"
                    type="text"
                    className="form-control"
                    value={editFormData.name}
                    onChange={handleEditChange}
                    disabled={editSubmitting}
                  />
                  {editErrors.name && <div className="form-error">{editErrors.name}</div>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="edit-logo">
                    College Logo (URL or Base64 Data URL)
                  </label>
                  <input
                    id="edit-logo"
                    name="logo_url"
                    type="text"
                    className="form-control"
                    placeholder="https://example.edu/logo.png"
                    value={editFormData.logo_url || ''}
                    onChange={handleEditChange}
                    disabled={editSubmitting}
                  />
                  <div className="form-hint">Provides branding across the College Admin sign-in screen and dashboard navigation.</div>
                  {editFormData.logo_url && (
                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <img
                        src={editFormData.logo_url}
                        alt="Preview"
                        style={{ width: '40px', height: '40px', objectFit: 'contain', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '2px' }}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                      <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Logo Live Preview</span>
                    </div>
                  )}
                </div>

                {/* Location Hierarchy: State -> Cities -> Areas */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-state">
                      1. State / Union Territory <span className="required">*</span>
                    </label>
                    <select
                      id="edit-state"
                      name="state"
                      className="form-control"
                      value={editFormData.state || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditFormData((prev) => ({
                          ...prev,
                          state: val,
                          city: '',
                          area: '',
                          custom_city: '',
                          custom_area: '',
                        }));
                      }}
                      disabled={editSubmitting}
                    >
                      <option value="">Select State / UT</option>
                      {INDIAN_STATES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-city">
                      2. City <span className="required">*</span>
                    </label>
                    <select
                      id="edit-city"
                      name="city"
                      className="form-control"
                      value={editFormData.city || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditFormData((prev) => ({
                          ...prev,
                          city: val,
                          area: '',
                          custom_city: '',
                          custom_area: '',
                        }));
                      }}
                      disabled={editSubmitting || !editFormData.state}
                    >
                      <option value="">{editFormData.state ? 'Select City' : '← Select State first'}</option>
                      {getCitiesForState(editFormData.state).map((ct) => (
                        <option key={ct} value={ct}>
                          {ct}
                        </option>
                      ))}
                      {editFormData.state && <option value="OTHER">+ Other / Specify City</option>}
                    </select>
                    {editFormData.city === 'OTHER' && (
                      <input
                        id="edit-custom-city"
                        name="custom_city"
                        type="text"
                        className="form-control"
                        style={{ marginTop: '8px' }}
                        placeholder="Enter city name..."
                        value={editFormData.custom_city || ''}
                        onChange={handleEditChange}
                        disabled={editSubmitting}
                      />
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="edit-area">
                    3. Area / Campus Locality
                  </label>
                  <select
                    id="edit-area"
                    name="area"
                    className="form-control"
                    value={editFormData.area || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditFormData((prev) => ({
                        ...prev,
                        area: val,
                        custom_area: '',
                      }));
                    }}
                    disabled={editSubmitting || !editFormData.city}
                  >
                    <option value="">{editFormData.city ? 'Select Area / Campus Locality' : '← Select City first'}</option>
                    {getAreasForCity(editFormData.state, editFormData.city).map((ar) => (
                      <option key={ar} value={ar}>
                        {ar}
                      </option>
                    ))}
                    {editFormData.city && <option value="OTHER">+ Other / Custom Locality</option>}
                  </select>
                  {editFormData.area === 'OTHER' && (
                    <input
                      id="edit-custom-area"
                      name="custom_area"
                      type="text"
                      className="form-control"
                      style={{ marginTop: '8px' }}
                      placeholder="e.g. NH 66, Srinivasnagar, Campus Road..."
                      value={editFormData.custom_area || ''}
                      onChange={handleEditChange}
                      disabled={editSubmitting}
                    />
                  )}
                  <div className="form-hint">Campus locality, street, or landmark.</div>
                </div>



                <div className="form-group">
                  <label className="form-label" htmlFor="edit-contact-email">
                    Primary Contact Email
                  </label>
                  <input
                    id="edit-contact-email"
                    name="contact_email"
                    type="email"
                    className="form-control"
                    value={editFormData.contact_email}
                    onChange={handleEditChange}
                    disabled={editSubmitting}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowEditModal(false)}
                  disabled={editSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  id="btn-save-college-profile"
                  disabled={editSubmitting}
                >
                  {editSubmitting ? 'Saving...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lifecycle Action Modal */}
      {showLifecycleModal && (
        <div className="modal-overlay" onClick={() => setShowLifecycleModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                Confirm Status Transition: {college.status} → {targetStatus}
              </h2>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setShowLifecycleModal(false)}
                disabled={lifecycleSubmitting}
                style={{ padding: '4px 6px', display: 'inline-flex', alignItems: 'center' }}
                aria-label="Close lifecycle modal"
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleLifecycleSubmit}>
              <div className="modal-body">
                {lifecycleError && (
                  <div className="error-box" style={{ marginBottom: '16px', padding: '10px', textAlign: 'left' }}>
                    <strong>Action Error:</strong> {lifecycleError}
                  </div>
                )}

                <div style={{ marginBottom: '16px', fontSize: '0.875rem' }}>
                  You are about to change the status of <strong>{college.name}</strong> from{' '}
                  <span className={`badge ${getStatusBadgeClass(college.status)}`}>{college.status}</span> to{' '}
                  <span className={`badge ${getStatusBadgeClass(targetStatus)}`}>{targetStatus}</span>.
                </div>

                {targetStatus === 'ACTIVE' && college.status === 'ONBOARDING' && (
                  <div className="notice-box" style={{ marginBottom: '16px' }}>
                    ⚠️ <strong>Prerequisite Check:</strong> Activation requires all 6 canonical onboarding steps to be completed.
                    Current status: {completedStepsCount}/6 steps completed.
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" htmlFor="lifecycle-reason-input">
                    Justification / Lifecycle Reason <span className="required">*</span>
                  </label>
                  <textarea
                    id="lifecycle-reason-input"
                    className="form-control"
                    rows={3}
                    placeholder="Enter reason for this operational change (e.g. Annual audit passed, Compliance review, Emergency maintenance)..."
                    value={lifecycleReason}
                    onChange={(e) => setLifecycleReason(e.target.value)}
                    disabled={lifecycleSubmitting}
                  />
                  <div className="form-hint">Recorded immutably in platform audit logs. Max 500 characters.</div>
                </div>

                <div className="form-group">
                  <label className="form-label">Execution Mechanism</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem' }}>
                      <input
                        type="radio"
                        name="lifecycle_mode"
                        value="DIRECT"
                        checked={lifecycleMode === 'DIRECT'}
                        onChange={() => setLifecycleMode('DIRECT')}
                        disabled={lifecycleSubmitting}
                      />
                      <span>
                        <strong>Direct Execution</strong> (Immediate platform state mutation)
                      </span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem' }}>
                      <input
                        type="radio"
                        name="lifecycle_mode"
                        value="APPROVAL"
                        checked={lifecycleMode === 'APPROVAL'}
                        onChange={() => setLifecycleMode('APPROVAL')}
                        disabled={lifecycleSubmitting}
                      />
                      <span>
                        <strong>Maker-Checker Approval Request</strong> (Submits request to Approvals queue)
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowLifecycleModal(false)}
                  disabled={lifecycleSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  id="btn-confirm-lifecycle-transition"
                  disabled={lifecycleSubmitting}
                >
                  {lifecycleSubmitting
                    ? 'Processing...'
                    : lifecycleMode === 'APPROVAL'
                      ? 'Submit Approval Request'
                      : 'Confirm Status Change'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset / Update Modal */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {adminAccount ? 'Reset Administrator Password' : 'Initialize Administrator Credentials'}
              </h2>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setShowPasswordModal(false)}
                disabled={passwordSubmitting}
                style={{ padding: '4px 6px', display: 'inline-flex', alignItems: 'center' }}
                aria-label="Close password modal"
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handlePasswordSubmit}>
              <div className="modal-body">
                {passwordError && (
                  <div className="error-box" style={{ marginBottom: '16px', padding: '10px', textAlign: 'left' }}>
                    <strong>Error:</strong> {passwordError}
                  </div>
                )}

                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Configure credentials for <strong>{college.name}</strong> ({college.college_code}). The college administrator uses this identity and password to log in and administer the Admin Module.
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="modal-admin-email">
                    Administrator Login Email / Username
                  </label>
                  <input
                    id="modal-admin-email"
                    type="email"
                    className="form-control"
                    placeholder={
                      adminAccount?.email ||
                      college.contact_email ||
                      `${college.college_code.toLowerCase()}.admin@hms.local`
                    }
                    value={passwordFormData.admin_email}
                    onChange={(e) =>
                      setPasswordFormData((prev) => ({ ...prev, admin_email: e.target.value }))
                    }
                    disabled={passwordSubmitting}
                  />
                  <div className="form-hint">
                    Current/New login email. Defaults to {adminAccount?.email || college.contact_email || `${college.college_code.toLowerCase()}.admin@hms.local`}.
                  </div>
                </div>

                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="form-label" htmlFor="modal-new-password" style={{ margin: 0 }}>
                      New Password <span className="required">*</span>
                    </label>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={generateModalRandomPassword}
                      disabled={passwordSubmitting}
                      style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                    >
                      ⚡ Generate Password
                    </button>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="modal-new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      className="form-control"
                      placeholder="Min. 8 characters"
                      value={passwordFormData.password}
                      onChange={(e) =>
                        setPasswordFormData((prev) => ({ ...prev, password: e.target.value }))
                      }
                      disabled={passwordSubmitting}
                      style={{ paddingRight: '42px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        color: 'var(--text-secondary)',
                      }}
                      title={showNewPassword ? 'Hide password' : 'Show password'}
                    >
                      {showNewPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                  <div className="form-hint">Minimum 8 characters. Required to access the Admin Module.</div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="modal-confirm-password">
                    Confirm New Password <span className="required">*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="modal-confirm-password"
                      type={showConfirmNewPassword ? 'text' : 'password'}
                      className="form-control"
                      placeholder="Re-enter new password"
                      value={passwordFormData.confirm_password}
                      onChange={(e) =>
                        setPasswordFormData((prev) => ({ ...prev, confirm_password: e.target.value }))
                      }
                      disabled={passwordSubmitting}
                      style={{ paddingRight: '42px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        color: 'var(--text-secondary)',
                      }}
                      title={showConfirmNewPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmNewPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                <div className="notice-box" style={{ marginTop: '12px' }}>
                  ℹ️ Updating this password updates the College Administrator account in <code>app.users</code> and logs the action in the platform audit logs. The administrator can log in using either the College Code (<strong>{college.college_code}</strong>) or their Admin Email.
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowPasswordModal(false)}
                  disabled={passwordSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  id="btn-submit-password-update"
                  disabled={passwordSubmitting}
                >
                  {passwordSubmitting ? 'Updating Password...' : 'Save Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
