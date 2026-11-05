import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Users,
  ShieldCheck,
  Plus,
  ArrowLeft,
  RotateCw,
  Edit3,
  History,
  Smartphone,
  Lock,
  Unlock,
  Info,
  X,
  CheckCircle2,
  AlertCircle,
  Building2,
  Phone,
  Mail,
  Calendar,
  Clock,
  Filter,
} from 'lucide-react';
import {
  fetchCollegeById,
  fetchCollegeAdmins,
  provisionFirstCollegeAdmin,
  updateCollegeAdminProfile,
  updateCollegeAdminStatus,
  unlockCollegeAdmin,
  revokeCollegeAdminDeviceTokens,
  fetchCollegeAdminLoginHistory,
} from '../services/collegeService';

export default function CollegeAdminsPage() {
  const { id: collegeId } = useParams();
  const navigate = useNavigate();

  // College details
  const [college, setCollege] = useState(null);
  const [collegeLoading, setCollegeLoading] = useState(false);
  const [collegeError, setCollegeError] = useState(null);

  // Admins list & pagination
  const [admins, setAdmins] = useState([]);
  const [totalAdmins, setTotalAdmins] = useState(0);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(0);
  const limit = 10;
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [adminsError, setAdminsError] = useState(null);

  // Feedback notifications
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'danger' | 'warning', message: string }

  // Provision First Admin modal
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [provisionForm, setProvisionForm] = useState({
    email: '',
    phone: '',
    password: '',
  });
  const [provisionSubmitting, setProvisionSubmitting] = useState(false);
  const [provisionError, setProvisionError] = useState(null);

  // Edit Profile modal
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [editForm, setEditForm] = useState({ phone: '' });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState(null);

  // Status Change modal
  const [statusAdmin, setStatusAdmin] = useState(null);
  const [targetStatus, setTargetStatus] = useState('DEACTIVATED');
  const [statusReason, setStatusReason] = useState('');
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusError, setStatusError] = useState(null);

  // Unlock modal
  const [unlockingAdmin, setUnlockingAdmin] = useState(null);
  const [unlockSubmitting, setUnlockSubmitting] = useState(false);
  const [unlockError, setUnlockError] = useState(null);

  // Revoke Tokens modal
  const [revokingAdmin, setRevokingAdmin] = useState(null);
  const [revokeSubmitting, setRevokeSubmitting] = useState(false);
  const [revokeResult, setRevokeResult] = useState(null);
  const [revokeError, setRevokeError] = useState(null);

  // Login History modal
  const [historyAdmin, setHistoryAdmin] = useState(null);
  const [loginHistory, setLoginHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  const abortControllerRef = useRef(null);

  // Load college details
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function loadCollege() {
      setCollegeLoading(true);
      setCollegeError(null);
      try {
        const data = await fetchCollegeById(collegeId, controller.signal);
        if (isMounted) {
          setCollege(data);
          setCollegeLoading(false);
        }
      } catch (err) {
        if (!controller.signal.aborted && isMounted) {
          setCollegeError(err.message || 'Failed to load college details');
          setCollegeLoading(false);
        }
      }
    }

    loadCollege();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [collegeId]);

  // Load admins list
  const loadAdmins = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setAdminsLoading(true);
    setAdminsError(null);

    try {
      const res = await fetchCollegeAdmins(collegeId, {
        status: statusFilter,
        limit,
        offset: page * limit,
        signal: controller.signal,
      });
      setAdmins(res.admins || []);
      setTotalAdmins(res.total || 0);
      setAdminsLoading(false);
    } catch (err) {
      if (!controller.signal.aborted) {
        setAdminsError(err.message || 'Failed to retrieve college administrators');
        setAdminsLoading(false);
      }
    }
  }, [collegeId, statusFilter, page, limit]);

  useEffect(() => {
    loadAdmins();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadAdmins]);

  // Handle Provisioning First Admin
  const handleProvisionSubmit = async (e) => {
    e.preventDefault();
    if (!provisionForm.email.trim() || !provisionForm.password.trim()) {
      setProvisionError('Email and initial password are required');
      return;
    }
    if (provisionForm.password.length < 8) {
      setProvisionError('Password must be at least 8 characters');
      return;
    }

    setProvisionSubmitting(true);
    setProvisionError(null);

    try {
      await provisionFirstCollegeAdmin(collegeId, {
        email: provisionForm.email.trim(),
        phone: provisionForm.phone.trim() || undefined,
        password: provisionForm.password,
      });

      setShowProvisionModal(false);
      setProvisionForm({ email: '', phone: '', password: '' });
      setFeedback({
        type: 'success',
        message: 'Initial College Administrator provisioned successfully. The onboarding administrator step has been marked completed.',
      });
      loadAdmins();
    } catch (err) {
      setProvisionError(err.message || 'Failed to provision administrator');
    } finally {
      setProvisionSubmitting(false);
    }
  };

  // Handle Edit Profile
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingAdmin) return;

    setEditSubmitting(true);
    setEditError(null);

    try {
      await updateCollegeAdminProfile(collegeId, editingAdmin.user_id, {
        phone: editForm.phone.trim() || null,
      });

      setEditingAdmin(null);
      setFeedback({
        type: 'success',
        message: `Profile updated for ${editingAdmin.email}`,
      });
      loadAdmins();
    } catch (err) {
      setEditError(err.message || 'Failed to update profile');
    } finally {
      setEditSubmitting(false);
    }
  };

  // Handle Status Update (with Last-Admin rejection)
  const handleStatusSubmit = async (e) => {
    e.preventDefault();
    if (!statusAdmin) return;

    if (!statusReason.trim()) {
      setStatusError('A reason is mandatory for changing account status');
      return;
    }

    setStatusSubmitting(true);
    setStatusError(null);

    try {
      await updateCollegeAdminStatus(collegeId, statusAdmin.user_id, {
        status: targetStatus,
        reason: statusReason.trim(),
      });

      setStatusAdmin(null);
      setStatusReason('');
      setFeedback({
        type: 'success',
        message: `Account status updated to ${targetStatus} for ${statusAdmin.email}`,
      });
      loadAdmins();
    } catch (err) {
      setStatusError(err.message || 'Failed to change administrator status');
    } finally {
      setStatusSubmitting(false);
    }
  };

  // Handle Unlock Account
  const handleUnlockSubmit = async () => {
    if (!unlockingAdmin) return;

    setUnlockSubmitting(true);
    setUnlockError(null);

    try {
      await unlockCollegeAdmin(collegeId, unlockingAdmin.user_id);
      setUnlockingAdmin(null);
      setFeedback({
        type: 'success',
        message: `Account for ${unlockingAdmin.email} has been unlocked and restored to ACTIVE status`,
      });
      loadAdmins();
    } catch (err) {
      setUnlockError(err.message || 'Failed to unlock administrator account');
    } finally {
      setUnlockSubmitting(false);
    }
  };

  // Handle Invalidate Push Tokens
  const handleRevokeTokens = async () => {
    if (!revokingAdmin) return;

    setRevokeSubmitting(true);
    setRevokeError(null);
    setRevokeResult(null);

    try {
      const res = await revokeCollegeAdminDeviceTokens(collegeId, revokingAdmin.user_id);
      setRevokeResult(res);
      setFeedback({
        type: 'success',
        message: `Deactivated ${res.device_tokens_revoked ?? 0} push notification device token(s) for ${revokingAdmin.email}`,
      });
    } catch (err) {
      setRevokeError(err.message || 'Failed to invalidate push device tokens');
    } finally {
      setRevokeSubmitting(false);
    }
  };

  // Open Login History Drawer
  const openLoginHistory = async (admin) => {
    setHistoryAdmin(admin);
    setHistoryLoading(true);
    setHistoryError(null);
    setLoginHistory([]);

    try {
      const res = await fetchCollegeAdminLoginHistory(collegeId, admin.user_id, 25);
      setLoginHistory(res.events || []);
    } catch (err) {
      setHistoryError(err.message || 'Failed to load login event history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="badge-status-active" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#059669' }} />
            ACTIVE
          </span>
        );
      case 'LOCKED':
        return (
          <span className="badge-status-locked" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Lock size={11} /> LOCKED
          </span>
        );
      case 'SUSPENDED':
        return (
          <span className="badge-status-inactive" style={{ background: '#fffbeb', color: '#d97706', borderColor: '#fde68a', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#d97706' }} />
            SUSPENDED
          </span>
        );
      case 'DEACTIVATED':
        return (
          <span className="badge-status-inactive" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#dc2626' }} />
            DEACTIVATED
          </span>
        );
      case 'INVITED':
        return (
          <span className="badge-category-boys" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Mail size={11} /> INVITED
          </span>
        );
      default:
        return <span className="badge badge-muted">{status}</span>;
    }
  };

  if (collegeLoading) {
    return (
      <div className="card loading-box">
        <p>Loading college context...</p>
      </div>
    );
  }

  if (collegeError || !college) {
    return (
      <div className="card error-box" style={{ maxWidth: '640px', margin: '40px auto' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>⚠️ College Not Found</h2>
        <p>{collegeError || 'The requested college record could not be loaded.'}</p>
        <div style={{ marginTop: '20px' }}>
          <button className="btn btn-outline" onClick={() => navigate('/colleges')}>
            ← Return to Directory
          </button>
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(totalAdmins / limit) || 1;

  return (
    <div className="main-content college-admins-container" style={{ padding: '24px 32px' }}>
      {/* College Context Header */}
      <div className="college-admins-hero">
        <div className="college-admins-hero-breadcrumb">
          <Link to="/colleges" className="hostel-hero-breadcrumb-link">Colleges</Link>
          <span style={{ color: '#cbd5e1' }}>/</span>
          <Link to={`/colleges/${collegeId}`} className="hostel-hero-breadcrumb-link">
            {college.name}
          </Link>
          <span style={{ color: '#cbd5e1' }}>/</span>
          <span style={{ fontWeight: '600', color: '#0f172a' }}>Administrators</span>
        </div>

        <div className="college-admins-hero-row">
          <div className="college-admins-title-group">
            <h1 className="college-admins-title">
              <span className="college-admins-icon-badge">
                <Users size={22} />
              </span>
              <span>College Administrators</span>
              <span className="badge-category-boys">{college.name}</span>
              <span className="code-pill">Code: {college.college_code}</span>
            </h1>
            <p className="college-admins-subtitle">
              Manage authenticated administrator accounts for <strong>{college.name}</strong> ({college.college_id}).
            </p>
          </div>

          <div className="college-admins-hero-actions">
            <button
              className="btn-enterprise btn-primary-blue"
              onClick={() => {
                setProvisionError(null);
                setProvisionForm({
                  email: college.contact_email || `${college.college_code.toLowerCase()}.admin@hms.local`,
                  phone: '',
                  password: '',
                });
                setShowProvisionModal(true);
              }}
              id="btn-provision-first-admin"
            >
              <Plus size={15} />
              <span>Provision Administrator</span>
            </button>
            <Link to={`/colleges/${collegeId}`} className="btn-enterprise btn-outline-soft" id="btn-back-college-details">
              <ArrowLeft size={14} />
              <span>College Details</span>
            </Link>
            <Link to="/colleges" className="btn-enterprise btn-outline-soft">
              <Building2 size={14} />
              <span>Directory</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Limitation Notice */}
      <div className="college-admins-notice">
        <div className="college-admins-notice-icon">
          <Info size={16} />
        </div>
        <div className="college-admins-notice-content">
          <div className="college-admins-notice-title">Platform Account Management Notice</div>
          <div>
            College administrator accounts possess full operational rights for this tenant in the Admin Module.
            Verified-contact one-time password reset links and forced password reset at next login are currently unavailable
            pending platform outbound email delivery infrastructure. Reset credentials directly via the secure Super Admin backend.
          </div>
        </div>
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          style={{
            backgroundColor: feedback.type === 'success' ? '#ecfdf5' : '#fef2f2',
            border: `1px solid ${feedback.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
            color: feedback.type === 'success' ? '#065f46' : '#991b1b',
            borderRadius: '12px',
            padding: '12px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500', fontSize: '0.9rem' }}>
            {feedback.type === 'success' ? (
              <CheckCircle2 size={16} className="text-emerald-600" />
            ) : (
              <AlertCircle size={16} className="text-rose-600" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            className="btn-icon-action"
            onClick={() => setFeedback(null)}
            style={{ width: '24px', height: '24px', border: 'none', background: 'transparent' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Filter and Control Bar */}
      <div className="college-admins-filter-panel" style={{ marginBottom: '20px' }}>
        <div className="college-admins-filter-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontSize: '0.88rem', fontWeight: '600' }}>
            <Filter size={15} style={{ color: '#64748b' }} />
            <label htmlFor="admin-status-filter" style={{ margin: 0 }}>Filter Status:</label>
          </div>
          <select
            id="admin-status-filter"
            className="form-control"
            style={{
              width: '180px',
              padding: '7px 12px',
              fontSize: '0.85rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#f8fafc',
              fontWeight: '500',
              color: '#1e293b',
            }}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(0);
            }}
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="LOCKED">LOCKED</option>
            <option value="SUSPENDED">SUSPENDED</option>
            <option value="DEACTIVATED">DEACTIVATED</option>
            <option value="INVITED">INVITED</option>
          </select>

          <button
            className="btn-enterprise btn-outline-soft btn-sm"
            onClick={loadAdmins}
            disabled={adminsLoading}
            title="Refresh list from backend"
            style={{ padding: '6px 14px' }}
          >
            <RotateCw size={13} className={adminsLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>
          Showing <span style={{ fontWeight: '700', color: '#0f172a' }}>{admins.length}</span> of{' '}
          <span style={{ fontWeight: '700', color: '#0f172a' }}>{totalAdmins}</span> registered administrator(s)
        </div>
      </div>

      {/* Administrators Table */}
      <div className="college-admins-table-card">
        {adminsLoading ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: '#64748b' }}>
            <RotateCw size={28} className="animate-spin" style={{ margin: '0 auto 12px', color: '#3b82f6' }} />
            <p style={{ margin: 0, fontWeight: '500', fontSize: '0.9rem' }}>Loading administrator accounts...</p>
          </div>
        ) : adminsError ? (
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#dc2626', fontWeight: '600', marginBottom: '12px' }}>
              <AlertCircle size={20} />
              <span>{adminsError}</span>
            </div>
            <div>
              <button className="btn-enterprise btn-outline-soft btn-sm" onClick={loadAdmins}>
                <RotateCw size={13} />
                <span>Retry</span>
              </button>
            </div>
          </div>
        ) : admins.length === 0 ? (
          <div style={{ padding: '56px 24px', textAlign: 'center' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#f1f5f9', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', marginBottom: '16px' }}>
              <Users size={28} />
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#0f172a', marginBottom: '6px' }}>No Administrators Found</h3>
            <p style={{ color: '#64748b', fontSize: '0.88rem', maxWidth: '480px', margin: '0 auto 20px' }}>
              {statusFilter !== 'ALL'
                ? `No administrator accounts match the "${statusFilter}" filter for this college.`
                : 'This college does not have any administrator accounts configured yet.'}
            </p>
            {statusFilter === 'ALL' && (
              <button
                className="btn-enterprise btn-primary-blue btn-sm"
                onClick={() => {
                  setProvisionError(null);
                  setProvisionForm({
                    email: college.contact_email || `${college.college_code.toLowerCase()}.admin@hms.local`,
                    phone: '',
                    password: '',
                  });
                  setShowProvisionModal(true);
                }}
              >
                <Plus size={14} />
                <span>Provision First Administrator</span>
              </button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem', margin: 0 }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '14px 18px', fontWeight: '700', color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Administrator</th>
                  <th style={{ padding: '14px 18px', fontWeight: '700', color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Contact Phone</th>
                  <th style={{ padding: '14px 18px', fontWeight: '700', color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Assigned Role</th>
                  <th style={{ padding: '14px 18px', fontWeight: '700', color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status</th>
                  <th style={{ padding: '14px 18px', fontWeight: '700', color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Last Login</th>
                  <th style={{ padding: '14px 18px', fontWeight: '700', color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Created At</th>
                  <th style={{ padding: '14px 18px', fontWeight: '700', color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((admin) => {
                  const isLocked = admin.status === 'LOCKED';
                  const isInactive = admin.status === 'DEACTIVATED' || admin.status === 'SUSPENDED';
                  const initials = (admin.email || 'A').slice(0, 2).toUpperCase();

                  return (
                    <tr
                      key={admin.user_id}
                      style={{
                        borderBottom: '1px solid #000000',
                        backgroundColor: isLocked ? '#fff1f2' : isInactive ? '#fafafa' : '#ffffff',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      {/* Administrator Info */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div className="college-admin-avatar">
                            {initials}
                          </div>
                          <div>
                            <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '0.9rem' }}>{admin.email}</div>
                            <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#94a3b8', marginTop: '1px' }}>
                              ID: {admin.user_id}
                            </div>
                            {isLocked && (
                              <div style={{ fontSize: '0.72rem', color: '#dc2626', fontWeight: '600', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <AlertCircle size={12} />
                                <span>Account Locked due to failed attempts</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td style={{ padding: '14px 18px' }}>
                        {admin.phone ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#334155' }}>
                            <Phone size={13} style={{ color: '#94a3b8' }} />
                            <span style={{ fontFamily: 'monospace', fontSize: '0.84rem' }}>{admin.phone}</span>
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.82rem' }}>Not configured</span>
                        )}
                      </td>

                      {/* Role */}
                      <td style={{ padding: '14px 18px' }}>
                        <span className="badge-category-boys" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <ShieldCheck size={12} />
                          <span>{admin.role_name || admin.role_code || 'College Administrator'}</span>
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 18px' }}>{getStatusBadge(admin.status)}</td>

                      {/* Last Login */}
                      <td style={{ padding: '14px 18px' }}>
                        {admin.last_login_at ? (
                          <div style={{ color: '#334155' }}>
                            <div style={{ fontWeight: '500' }}>{new Date(admin.last_login_at).toLocaleDateString()}</div>
                            <div style={{ fontSize: '0.74rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
                              <Clock size={11} />
                              <span>{new Date(admin.last_login_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.82rem' }}>Never logged in</span>
                        )}
                      </td>

                      {/* Created At */}
                      <td style={{ padding: '14px 18px', color: '#64748b', fontSize: '0.82rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Calendar size={13} style={{ color: '#94a3b8' }} />
                          <span>{new Date(admin.created_at).toLocaleDateString()}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', justifyContent: 'flex-end' }}>
                          {/* Unlock (only if locked) */}
                          {isLocked && (
                            <button
                              className="btn-icon-action"
                              style={{ color: '#dc2626', borderColor: '#fca5a5', background: '#fef2f2' }}
                              onClick={() => {
                                setUnlockError(null);
                                setUnlockingAdmin(admin);
                              }}
                              title="Unlock this locked administrator account"
                            >
                              <Unlock size={14} />
                            </button>
                          )}

                          {/* Edit Profile */}
                          <button
                            className="btn-icon-action"
                            onClick={() => {
                              setEditError(null);
                              setEditForm({ phone: admin.phone || '' });
                              setEditingAdmin(admin);
                            }}
                            title="Edit administrator details"
                          >
                            <Edit3 size={14} />
                          </button>

                          {/* Status Management */}
                          <button
                            className="btn-icon-action"
                            onClick={() => {
                              setStatusError(null);
                              setStatusReason('');
                              setTargetStatus(admin.status === 'ACTIVE' ? 'DEACTIVATED' : 'ACTIVE');
                              setStatusAdmin(admin);
                            }}
                            title="Toggle status (Active / Deactivated)"
                          >
                            <RotateCw size={14} />
                          </button>

                          {/* Login History */}
                          <button
                            className="btn-icon-action"
                            onClick={() => openLoginHistory(admin)}
                            title="Inspect login history"
                          >
                            <History size={14} />
                          </button>

                          {/* Invalidate Device Tokens */}
                          <button
                            className="btn-icon-action"
                            onClick={() => {
                              setRevokeError(null);
                              setRevokeResult(null);
                              setRevokingAdmin(admin);
                            }}
                            title="Invalidate push notification device tokens"
                          >
                            <Smartphone size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f8fafc',
            }}
          >
            <button
              className="btn-enterprise btn-outline-soft btn-sm"
              disabled={page === 0 || adminsLoading}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              ← Previous
            </button>
            <span style={{ fontSize: '0.84rem', color: '#64748b' }}>
              Page <strong style={{ color: '#0f172a' }}>{page + 1}</strong> of <strong style={{ color: '#0f172a' }}>{totalPages}</strong>
            </span>
            <button
              className="btn-enterprise btn-outline-soft btn-sm"
              disabled={page >= totalPages - 1 || adminsLoading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* MODAL 1: Provision First Administrator */}
      {showProvisionModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>👤 Provision College Administrator</h2>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setShowProvisionModal(false)}
                disabled={provisionSubmitting}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Create an administrator account for <strong>{college.name}</strong>. The account will automatically receive
              the canonical <code>COLLEGE_ADMIN</code> role.
            </p>

            {provisionError && (
              <div
                className="alert alert-danger"
                style={{ marginBottom: '16px', padding: '10px 12px', fontSize: '0.85rem' }}
              >
                ⚠️ {provisionError}
              </div>
            )}

            <form onSubmit={handleProvisionSubmit}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: '600', fontSize: '0.85rem' }}>
                  Target College
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={`${college.name} (${college.college_code})`}
                  disabled
                  style={{ backgroundColor: '#f1f5f9' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: '600', fontSize: '0.85rem' }}>
                  Admin Email Address *
                </label>
                <input
                  type="email"
                  className="form-control"
                  required
                  value={provisionForm.email}
                  onChange={(e) => setProvisionForm({ ...provisionForm, email: e.target.value })}
                  placeholder="admin@college.edu"
                  disabled={provisionSubmitting}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: '600', fontSize: '0.85rem' }}>
                  Contact Phone (Optional)
                </label>
                <input
                  type="tel"
                  className="form-control"
                  value={provisionForm.phone}
                  onChange={(e) => setProvisionForm({ ...provisionForm, phone: e.target.value })}
                  placeholder="+919876543210"
                  disabled={provisionSubmitting}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label" style={{ fontWeight: '600', fontSize: '0.85rem' }}>
                  Initial Password *
                </label>
                <input
                  type="password"
                  className="form-control"
                  required
                  minLength={8}
                  value={provisionForm.password}
                  onChange={(e) => setProvisionForm({ ...provisionForm, password: e.target.value })}
                  placeholder="Min 8 characters"
                  disabled={provisionSubmitting}
                />
                <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                  Passwords are encrypted using bcrypt hashing. Plaintext passwords are never stored.
                </small>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowProvisionModal(false)}
                  disabled={provisionSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={provisionSubmitting}>
                  {provisionSubmitting ? 'Provisioning...' : 'Provision Administrator'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Permitted Profile Fields */}
      {editingAdmin && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>✏️ Edit Administrator Details</h2>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setEditingAdmin(null)}
                disabled={editSubmitting}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Editing details for <strong>{editingAdmin.email}</strong>. Security boundaries prevent arbitrary modification
              of user IDs, tenant scopes, roles, or password hashes via profile edit.
            </p>

            {editError && (
              <div
                className="alert alert-danger"
                style={{ marginBottom: '14px', padding: '10px 12px', fontSize: '0.85rem' }}
              >
                ⚠️ {editError}
              </div>
            )}

            <form onSubmit={handleEditSubmit}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: '600', fontSize: '0.85rem' }}>
                  Email Address
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={editingAdmin.email}
                  disabled
                  style={{ backgroundColor: '#f1f5f9' }}
                />
                <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                  Email serves as the persistent identity key in app.users.
                </small>
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label" style={{ fontWeight: '600', fontSize: '0.85rem' }}>
                  Contact Phone (Permitted Allowlist Field)
                </label>
                <input
                  type="tel"
                  className="form-control"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ phone: e.target.value })}
                  placeholder="+919876543210"
                  disabled={editSubmitting}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setEditingAdmin(null)}
                  disabled={editSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={editSubmitting}>
                  {editSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Update Account Status (with Last-Admin rejection) */}
      {statusAdmin && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>🔄 Change Administrator Status</h2>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setStatusAdmin(null)}
                disabled={statusSubmitting}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Change the operational lifecycle status of administrator <strong>{statusAdmin.email}</strong>.
            </p>

            {statusError && (
              <div
                className="alert alert-danger"
                style={{
                  marginBottom: '14px',
                  padding: '12px',
                  fontSize: '0.85rem',
                  borderLeft: '4px solid var(--danger-border)',
                }}
              >
                <strong>Operation Rejected:</strong> {statusError}
              </div>
            )}

            <form onSubmit={handleStatusSubmit}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: '600', fontSize: '0.85rem' }}>
                  Target Status *
                </label>
                <select
                  className="form-control"
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value)}
                  disabled={statusSubmitting}
                >
                  <option value="ACTIVE">ACTIVE — Full operational access</option>
                  <option value="SUSPENDED">SUSPENDED — Temporary block</option>
                  <option value="DEACTIVATED">DEACTIVATED — Access revoked</option>
                </select>
              </div>

              {(targetStatus === 'DEACTIVATED' || targetStatus === 'SUSPENDED') && (
                <div
                  style={{
                    backgroundColor: 'var(--warning-bg)',
                    border: '1px solid var(--warning-border)',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    fontSize: '0.8rem',
                    color: 'var(--warning-text)',
                    marginBottom: '14px',
                  }}
                >
                  ⚠️ <strong>Last Active Admin Protection:</strong> If this account is the sole active College Administrator
                  for <strong>{college.name}</strong>, the backend will atomically reject this status change to prevent orphaning the tenant.
                </div>
              )}

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label" style={{ fontWeight: '600', fontSize: '0.85rem' }}>
                  Reason for Status Change (Mandatory Audit Trail) *
                </label>
                <textarea
                  className="form-control"
                  rows={3}
                  required
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="e.g. Administrator resignation, transfer, or temporary security hold"
                  disabled={statusSubmitting}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setStatusAdmin(null)}
                  disabled={statusSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={targetStatus === 'ACTIVE' ? 'btn btn-primary' : 'btn btn-danger'}
                  disabled={statusSubmitting}
                >
                  {statusSubmitting ? 'Updating...' : `Confirm ${targetStatus}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Unlock Locked Account */}
      {unlockingAdmin && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '460px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '12px' }}>
              🔓 Unlock Administrator Account
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Are you sure you want to unlock the administrator account for <strong>{unlockingAdmin.email}</strong>?
            </p>

            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '12px',
                fontSize: '0.8rem',
                marginBottom: '16px',
              }}
            >
              Unlocking restores the account to <code>ACTIVE</code> status. All prior failed authentication events and lockout
              records in <code>platform.login_events</code> will be preserved for security auditing.
            </div>

            {unlockError && (
              <div
                className="alert alert-danger"
                style={{ marginBottom: '14px', padding: '10px 12px', fontSize: '0.85rem' }}
              >
                ⚠️ {unlockError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                className="btn btn-outline"
                onClick={() => setUnlockingAdmin(null)}
                disabled={unlockSubmitting}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleUnlockSubmit} disabled={unlockSubmitting}>
                {unlockSubmitting ? 'Unlocking...' : 'Confirm Unlock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Invalidate Push Device Tokens */}
      {revokingAdmin && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '12px' }}>
              📲 Invalidate Push Device Tokens
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Invalidate registered device push notification tokens for <strong>{revokingAdmin.email}</strong>.
            </p>

            <div
              style={{
                backgroundColor: 'var(--warning-bg)',
                border: '1px solid var(--warning-border)',
                borderRadius: '6px',
                padding: '12px',
                fontSize: '0.8rem',
                color: 'var(--warning-text)',
                marginBottom: '16px',
              }}
            >
              <strong>Security Protocol Notice:</strong>
              <p style={{ marginTop: '4px' }}>
                This operation deactivates push notification registration records in <code>platform.device_tokens</code>.
                Stateless JWT access tokens will remain valid until their expiration (up to 24 hours). To immediately prevent
                authentication requests, change the account status to <code>SUSPENDED</code> or <code>DEACTIVATED</code>.
              </p>
            </div>

            {revokeResult && (
              <div
                className="alert alert-success"
                style={{ marginBottom: '14px', padding: '10px 12px', fontSize: '0.85rem' }}
              >
                ✓ Deactivated {revokeResult.device_tokens_revoked ?? 0} push token(s).
              </div>
            )}

            {revokeError && (
              <div
                className="alert alert-danger"
                style={{ marginBottom: '14px', padding: '10px 12px', fontSize: '0.85rem' }}
              >
                ⚠️ {revokeError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                className="btn btn-outline"
                onClick={() => setRevokingAdmin(null)}
                disabled={revokeSubmitting}
              >
                Close
              </button>
              {!revokeResult && (
                <button
                  className="btn btn-danger"
                  onClick={handleRevokeTokens}
                  disabled={revokeSubmitting}
                >
                  {revokeSubmitting ? 'Invalidating...' : 'Invalidate Device Tokens'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: Login History Drawer / Modal */}
      {historyAdmin && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '680px', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>📜 Authentication History</h2>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {historyAdmin.email} | Real events from <code>platform.login_events</code>
                </span>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => setHistoryAdmin(null)}>
                ✕
              </button>
            </div>

            {historyLoading ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Loading authentication records...
              </div>
            ) : historyError ? (
              <div className="alert alert-danger" style={{ padding: '12px' }}>
                ⚠️ {historyError}
              </div>
            ) : loginHistory.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No authentication events recorded for this administrator yet.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px' }}>Result</th>
                      <th style={{ padding: '8px 12px' }}>Date & Time</th>
                      <th style={{ padding: '8px 12px' }}>IP Address</th>
                      <th style={{ padding: '8px 12px' }}>Device / Client</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loginHistory.map((item) => (
                      <tr key={item.login_event_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '8px 12px' }}>
                          <span
                            className={`badge ${
                              item.result === 'SUCCESS'
                                ? 'badge-success'
                                : item.result === 'LOCKED'
                                ? 'badge-danger'
                                : 'badge-warning'
                            }`}
                          >
                            {item.result}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          {item.event_at ? new Date(item.event_at).toLocaleString() : 'N/A'}
                        </td>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>
                          {item.ip_address || '—'}
                        </td>
                        <td
                          style={{
                            padding: '8px 12px',
                            maxWidth: '220px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={item.user_agent || item.device || ''}
                        >
                          {item.device || item.user_agent || 'Standard Web'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ marginTop: '20px', textAlign: 'right' }}>
              <button className="btn btn-outline" onClick={() => setHistoryAdmin(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
