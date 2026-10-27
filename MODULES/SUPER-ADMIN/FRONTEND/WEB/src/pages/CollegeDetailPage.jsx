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

export default function CollegeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [college, setCollege] = useState(null);
  const [onboardingSteps, setOnboardingSteps] = useState([]);
  const [loading, setLoading] = useState(true);
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
  const [passwordSuccessCredentials, setPasswordSuccessCredentials] = useState(null);

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
        <h2 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>⚠️ College Not Found</h2>
        <p>{error || 'The requested college record could not be loaded.'}</p>
        <div style={{ marginTop: '20px' }}>
          <button className="btn btn-outline" onClick={() => navigate('/colleges')}>
            ← Return to Directory
          </button>
        </div>
      </div>
    );
  }

  const isDeactivated = college.status === 'DEACTIVATED';
  const completedStepsCount = onboardingSteps.filter((s) => s.status === 'COMPLETED').length;

  return (
    <div>
      {/* Header */}
      <div className="header-container">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
            <h1 className="page-title">{college.name}</h1>
            <span className={`badge ${getStatusBadgeClass(college.status)}`} style={{ fontSize: '0.85rem' }}>
              {college.status}
            </span>
          </div>
          <p className="page-subtitle">
            Tenant Code:{' '}
            <strong style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>
              {college.college_code}
            </strong>{' '}
            | ID: <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{college.college_id}</span>
          </p>
        </div>

        <div className="quick-actions">
          {college.status === 'ONBOARDING' ? (
            <Link
              to={`/colleges/${college.college_id}/onboarding`}
              className="btn btn-primary"
              id="btn-onboarding-wizard"
            >
              Resume Onboarding 🚀
            </Link>
          ) : (
            <Link
              to={`/colleges/${college.college_id}/onboarding`}
              className="btn btn-outline"
              id="btn-onboarding-wizard"
              title="View onboarding workspace and setup checklist"
            >
              Onboarding Wizard 🚀
            </Link>
          )}
          <Link to="/colleges" className="btn btn-outline" id="btn-back-directory">
            ← Directory
          </Link>
          <Link
            to={`/colleges/${college.college_id}/configuration`}
            className="btn btn-outline"
            id="btn-college-configuration"
            title="Manage platform tenant configuration, security floors, and policies"
          >
            ⚙️ Configuration
          </Link>
          <Link
            to={`/colleges/${college.college_id}/modules`}
            className="btn btn-outline"
            id="btn-college-modules"
            title="Manage college module entitlements, dependencies, and matrix"
          >
            📦 Modules
          </Link>
          <Link
            to={`/colleges/${college.college_id}/applications`}
            className="btn btn-outline"
            id="btn-college-applications"
            title="Manage mobile and portal application access, version policy, and force-updates"
          >
            📱 Applications
          </Link>
          <Link
            to={`/colleges/${college.college_id}/hostel-structure`}
            className="btn btn-outline"
            id="btn-college-hostel-structure"
            title="Manage physical hostel facilities, buildings, floors, rooms, and beds"
          >
            🏰 Hostel Structure
          </Link>
          <Link
            to={`/colleges/${college.college_id}/admins`}
            className="btn btn-outline"
            id="btn-college-admins"
            title="Manage all college administrator accounts, status, unlock, and login history"
          >
            👥 Admins
          </Link>
          <button
            className="btn btn-outline"
            onClick={() => setShowEditModal(true)}
            disabled={isDeactivated}
            title={isDeactivated ? 'Cannot edit profile while deactivated' : 'Edit college details'}
            id="btn-edit-profile"
          >
            ✏️ Edit Profile
          </button>
        </div>
      </div>

      {/* Onboarding in Progress Banner */}
      {college.status === 'ONBOARDING' && (
        <div style={{
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderLeft: '5px solid #2563eb',
          padding: '16px 20px',
          borderRadius: '8px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <div style={{ fontWeight: '700', color: '#1e40af', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🚀</span>
              <span>College Onboarding in Progress ({completedStepsCount} of {onboardingSteps.length || 6} Steps Completed)</span>
            </div>
            <p style={{ color: '#1e3a8a', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
              This college tenant has not completed go-live activation. Complete the 7-stage checklist in the onboarding workspace.
            </p>
          </div>
          <Link
            to={`/colleges/${college.college_id}/onboarding`}
            className="btn btn-primary btn-sm"
            id="btn-banner-resume-wizard"
          >
            Open Onboarding Wizard →
          </Link>
        </div>
      )}

      {/* Success Notification */}
      {actionSuccessNotice && (
        <div
          className="card"
          style={{
            marginBottom: '20px',
            borderColor: 'var(--success-border)',
            backgroundColor: 'var(--success-bg)',
            color: 'var(--success-text)',
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>✓ {actionSuccessNotice}</span>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setActionSuccessNotice(null)}
            style={{ fontSize: '0.75rem', padding: '2px 8px' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Password Reset Success Credentials Banner */}
      {passwordSuccessCredentials && (
        <div
          className="card"
          style={{
            marginBottom: '20px',
            borderColor: 'var(--success-border)',
            backgroundColor: 'var(--success-bg)',
            padding: '16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ color: 'var(--success-text)', fontWeight: 'bold', fontSize: '1rem' }}>
              🎉 Administrator Password Updated Successfully
            </div>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setPasswordSuccessCredentials(null)}
              style={{ fontSize: '0.75rem', padding: '2px 8px' }}
            >
              ✕
            </button>
          </div>
          <p style={{ color: 'var(--success-text)', fontSize: '0.85rem', marginBottom: '12px' }}>
            The administrator credentials for <strong>{college.name}</strong> have been updated. The administrator can immediately log into the Admin Module.
          </p>

          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              padding: '12px 14px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '16px',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Login Identifier / Code:</span>
                <div style={{ fontFamily: 'monospace', fontWeight: '700' }}>{passwordSuccessCredentials.college_code}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Admin Email:</span>
                <div style={{ fontFamily: 'monospace', fontWeight: '600' }}>{passwordSuccessCredentials.email}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>New Password:</span>
                <div style={{ fontFamily: 'monospace', fontWeight: '700', color: 'var(--primary-color)' }}>
                  {passwordSuccessCredentials.password}
                </div>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                const creds = `HMS College Administrator Access\nCollege: ${college.name}\nCollege ID / Code: ${passwordSuccessCredentials.college_code}\nAdmin Email: ${passwordSuccessCredentials.email}\nPassword: ${passwordSuccessCredentials.password}`;
                navigator.clipboard.writeText(creds);
                setCopiedKey('notice');
                setTimeout(() => setCopiedKey(null), 2500);
              }}
            >
              {copiedKey === 'notice' ? '✓ Copied!' : '📋 Copy Credentials'}
            </button>
          </div>
        </div>
      )}

      {/* Top Details Grid */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <div className="card-title">
            <span>Identity & Operational Parameters</span>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Last Updated: {college.updated_at ? new Date(college.updated_at).toLocaleString() : '—'}
          </span>
        </div>

        <div className="detail-grid">
          <div className="detail-item">
            <div className="detail-label">College Code (Immutable)</div>
            <div className="detail-value" style={{ fontFamily: 'monospace' }}>
              {college.college_code}
            </div>
          </div>

          <div className="detail-item">
            <div className="detail-label">Operational Status</div>
            <div className="detail-value">
              <span className={`badge ${getStatusBadgeClass(college.status)}`}>{college.status}</span>
            </div>
          </div>

          <div className="detail-item">
            <div className="detail-label">Operational Timezone</div>
            <div className="detail-value">IST (Asia/Kolkata, UTC+05:30)</div>
          </div>

          <div className="detail-item">
            <div className="detail-label">Primary Contact Email</div>
            <div className="detail-value">{college.contact_email || '—'}</div>
          </div>

          <div className="detail-item">
            <div className="detail-label">Address / Location</div>
            <div className="detail-value">
              {college.city || college.state
                ? [college.city, college.state].filter(Boolean).join(', ')
                : '—'}
            </div>
          </div>

          <div className="detail-item">
            <div className="detail-label">Created Date</div>
            <div className="detail-value" style={{ fontSize: '0.85rem' }}>
              {college.created_at ? new Date(college.created_at).toLocaleDateString() : '—'}
            </div>
          </div>

          {college.activated_at && (
            <div className="detail-item">
              <div className="detail-label">Activated At</div>
              <div className="detail-value" style={{ fontSize: '0.85rem' }}>
                {new Date(college.activated_at).toLocaleString()}
              </div>
            </div>
          )}

          {college.suspended_at && (
            <div className="detail-item" style={{ borderColor: 'var(--danger-border)' }}>
              <div className="detail-label" style={{ color: 'var(--danger-text)' }}>Suspended At</div>
              <div className="detail-value" style={{ fontSize: '0.85rem', color: 'var(--danger-text)' }}>
                {new Date(college.suspended_at).toLocaleString()}
              </div>
            </div>
          )}

          {college.deactivated_at && (
            <div className="detail-item">
              <div className="detail-label">Deactivated At</div>
              <div className="detail-value" style={{ fontSize: '0.85rem' }}>
                {new Date(college.deactivated_at).toLocaleString()}
              </div>
            </div>
          )}
        </div>

        {college.lifecycle_reason && (
          <div
            style={{
              padding: '12px 14px',
              backgroundColor: '#f8fafc',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              fontSize: '0.85rem',
            }}
          >
            <strong>Current Lifecycle Reason:</strong> {college.lifecycle_reason}
          </div>
        )}
      </div>

      {/* College Administrator & Module Access Card */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <div className="card-title">
            <span>🔑 College Administrator & Module Access</span>
            {adminAccount ? (
              <span className="badge badge-success">Credentials Configured</span>
            ) : (
              <span className="badge badge-warning">No Admin Account</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link
              to={`/colleges/${college.college_id}/admins`}
              className="btn btn-outline btn-sm"
              id="btn-manage-all-admins"
              title="View and manage all administrators for this college"
            >
              👥 Manage All Admins
            </Link>
            <button
              className="btn btn-primary btn-sm"
              onClick={openPasswordModal}
              id="btn-manage-admin-password"
              title="Update or reset college administrator password"
            >
              {adminAccount ? '🔑 Reset Admin Password' : '+ Initialize Admin Credentials'}
            </button>
          </div>
        </div>

        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Credentials used by the college administrator to log into and run the <strong>Admin Module</strong> for this tenant. The administrator can authenticate using either the <strong>College Code ({college.college_code})</strong> or the <strong>Admin Email</strong>.
        </p>

        {adminAccount ? (
          <div className="detail-grid">
            <div className="detail-item">
              <div className="detail-label">Admin Login Email / ID</div>
              <div className="detail-value" style={{ fontFamily: 'monospace', fontWeight: '600' }}>
                {adminAccount.email}
              </div>
            </div>

            <div className="detail-item">
              <div className="detail-label">Tenant Login Code</div>
              <div className="detail-value" style={{ fontFamily: 'monospace', fontWeight: '700' }}>
                {college.college_code}
              </div>
            </div>

            <div className="detail-item">
              <div className="detail-label">Assigned Role</div>
              <div className="detail-value">
                <span className="badge badge-info">{adminAccount.role_name || adminAccount.role_code}</span>
              </div>
            </div>

            <div className="detail-item">
              <div className="detail-label">Account Status</div>
              <div className="detail-value">
                <span className={`badge ${adminAccount.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`}>
                  {adminAccount.status}
                </span>
              </div>
            </div>

            <div className="detail-item">
              <div className="detail-label">Password Status</div>
              <div className="detail-value">
                {adminAccount.has_password ? (
                  <span className="badge badge-success">✓ Active (Hashed)</span>
                ) : (
                  <span className="badge badge-danger">Not Set</span>
                )}
              </div>
            </div>

            <div className="detail-item">
              <div className="detail-label">Last Successful Login</div>
              <div className="detail-value" style={{ fontSize: '0.85rem' }}>
                {adminAccount.last_login_at ? new Date(adminAccount.last_login_at).toLocaleString() : 'Never logged in yet'}
              </div>
            </div>
          </div>
        ) : (
          <div className="notice-box" style={{ marginTop: 0 }}>
            ⚠️ <strong>No administrator account found:</strong> The College Administrator credentials have not been configured for this institution yet. Click <strong>Initialize Admin Credentials</strong> above to create the administrator account and set their password.
          </div>
        )}
      </div>

      {/* Lifecycle Management Controls */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <div className="card-title">
            <span>🛡️ Lifecycle Management</span>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Permitted State Transitions
          </span>
        </div>

        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Lifecycle transitions enforce immutable audit logging, mandatory justification, and prerequisite checks.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {college.status === 'ONBOARDING' && (
            <>
              <button
                className="btn btn-primary"
                onClick={() => openLifecycleModal('ACTIVE')}
                id="btn-lifecycle-activate"
              >
                Activate College
              </button>
              <button
                className="btn btn-outline"
                style={{ borderColor: 'var(--danger-border)', color: 'var(--danger-text)' }}
                onClick={() => openLifecycleModal('DEACTIVATED')}
                id="btn-lifecycle-deactivate"
              >
                Deactivate College
              </button>
            </>
          )}

          {college.status === 'ACTIVE' && (
            <>
              <button
                className="btn btn-outline"
                style={{ borderColor: 'var(--danger-border)', color: 'var(--danger-text)' }}
                onClick={() => openLifecycleModal('SUSPENDED')}
                id="btn-lifecycle-suspend"
              >
                Suspend Operations
              </button>
              <button
                className="btn btn-outline"
                style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                onClick={() => openLifecycleModal('DEACTIVATED')}
                id="btn-lifecycle-deactivate"
              >
                Deactivate College
              </button>
            </>
          )}

          {college.status === 'SUSPENDED' && (
            <>
              <button
                className="btn btn-primary"
                onClick={() => openLifecycleModal('ACTIVE')}
                id="btn-lifecycle-reinstate"
              >
                Reinstate Operations (Activate)
              </button>
              <button
                className="btn btn-outline"
                style={{ borderColor: 'var(--danger-border)', color: 'var(--danger-text)' }}
                onClick={() => openLifecycleModal('DEACTIVATED')}
                id="btn-lifecycle-deactivate"
              >
                Deactivate College
              </button>
            </>
          )}

          {college.status === 'DEACTIVATED' && (
            <button
              className="btn btn-primary"
              onClick={() => openLifecycleModal('ACTIVE')}
              id="btn-lifecycle-reactivate"
            >
              Reactivate College
            </button>
          )}
        </div>
      </div>

      {/* Onboarding Checklist Summary */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <div className="card-title">
            <span>📋 Canonical Onboarding Checklist</span>
            {onboardingSteps.length > 0 && (
              <span className="badge badge-info">
                {completedStepsCount} / {onboardingSteps.length} Completed
              </span>
            )}
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Module 3 Onboarding Wizard Preview
          </span>
        </div>

        {onboardingSteps.length === 0 ? (
          <div className="empty-box" style={{ padding: '24px' }}>
            <p className="empty-text">No onboarding steps recorded for this tenant.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Step Code</th>
                  <th>Status</th>
                  <th>Completed At</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {onboardingSteps.map((step) => (
                  <tr key={step.onboarding_id || step.step_code}>
                    <td>
                      <span style={{ fontWeight: '600' }}>{step.step_code}</span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          step.status === 'COMPLETED'
                            ? 'badge-success'
                            : step.status === 'IN_PROGRESS'
                            ? 'badge-warning'
                            : 'badge-muted'
                        }`}
                      >
                        {step.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {step.completed_at ? new Date(step.completed_at).toLocaleString() : '—'}
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>{step.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Related Platform Navigation */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <span>🔗 Related Control Plane Sections</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <Link to="/approvals" className="btn btn-outline btn-sm">
            Pending Approvals Workflow →
          </Link>
          <Link to="/modules" className="btn btn-outline btn-sm">
            Module Entitlements Catalogue →
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
              >
                ✕
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
              >
                ✕
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
              >
                ✕
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
