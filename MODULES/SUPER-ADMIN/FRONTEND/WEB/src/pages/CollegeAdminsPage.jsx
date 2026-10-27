import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
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
  const [collegeLoading, setCollegeLoading] = useState(true);
  const [collegeError, setCollegeError] = useState(null);

  // Admins list & pagination
  const [admins, setAdmins] = useState([]);
  const [totalAdmins, setTotalAdmins] = useState(0);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(0);
  const limit = 10;
  const [adminsLoading, setAdminsLoading] = useState(true);
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
        return <span className="badge badge-success">ACTIVE</span>;
      case 'LOCKED':
        return <span className="badge badge-danger">🔒 LOCKED</span>;
      case 'SUSPENDED':
        return <span className="badge badge-warning">SUSPENDED</span>;
      case 'DEACTIVATED':
        return <span className="badge badge-muted">DEACTIVATED</span>;
      case 'INVITED':
        return <span className="badge badge-info">INVITED</span>;
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
    <div>
      {/* College Context Header */}
      <div className="header-container">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
            <h1 className="page-title">College Administrators</h1>
            <span className="badge badge-info">{college.name}</span>
            <span className="badge badge-outline">Code: {college.college_code}</span>
          </div>
          <p className="page-subtitle">
            Manage authenticated administrator accounts for <strong>{college.name}</strong> ({college.college_id}).
          </p>
        </div>

        <div className="quick-actions">
          <button
            className="btn btn-primary"
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
            + Provision Administrator
          </button>
          <Link to={`/colleges/${collegeId}`} className="btn btn-outline" id="btn-back-college-details">
            ← College Details
          </Link>
          <Link to="/colleges" className="btn btn-outline">
            Directory
          </Link>
        </div>
      </div>

      {/* Limitation Notice */}
      <div
        className="card"
        style={{
          marginBottom: '20px',
          borderLeft: '4px solid var(--info-border)',
          backgroundColor: 'var(--info-bg)',
          padding: '12px 16px',
        }}
      >
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '1.2rem' }}>ℹ️</span>
          <div style={{ fontSize: '0.85rem', color: 'var(--info-text)' }}>
            <strong>Platform Account Management Notice:</strong>
            <p style={{ marginTop: '4px' }}>
              College administrator accounts possess full operational rights for this tenant in the Admin Module.
              Verified-contact one-time password reset links and forced password reset at next login are currently unavailable
              pending platform outbound email delivery infrastructure. Reset credentials directly via the secure Super Admin backend.
            </p>
          </div>
        </div>
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          className={`card alert alert-${feedback.type}`}
          style={{
            marginBottom: '20px',
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>{feedback.message}</div>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setFeedback(null)}
            style={{ fontSize: '0.75rem', padding: '2px 8px' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter and Control Bar */}
      <div
        className="card"
        style={{
          marginBottom: '20px',
          padding: '14px 18px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: '600' }} htmlFor="admin-status-filter">
            Filter by Status:
          </label>
          <select
            id="admin-status-filter"
            className="form-control"
            style={{ width: '180px', padding: '6px 10px', fontSize: '0.85rem' }}
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
            className="btn btn-outline btn-sm"
            onClick={loadAdmins}
            disabled={adminsLoading}
            title="Refresh list from backend"
          >
            🔄 Refresh
          </button>
        </div>

        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Showing <strong>{admins.length}</strong> of <strong>{totalAdmins}</strong> registered administrator(s)
        </div>
      </div>

      {/* Administrators Table */}
      <div className="card" style={{ padding: '0', overflow: 'hidden', marginBottom: '24px' }}>
        {adminsLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Loading administrator accounts...
          </div>
        ) : adminsError ? (
          <div style={{ padding: '30px', textAlign: 'center' }}>
            <div style={{ color: 'var(--danger-text)', fontWeight: '600', marginBottom: '8px' }}>
              ⚠️ {adminsError}
            </div>
            <button className="btn btn-outline btn-sm" onClick={loadAdmins}>
              Retry
            </button>
          </div>
        ) : admins.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>👤</div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '6px' }}>No Administrators Found</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', maxWidth: '480px', margin: '0 auto 16px' }}>
              {statusFilter !== 'ALL'
                ? `No administrator accounts match the "${statusFilter}" filter for this college.`
                : 'This college does not have any administrator accounts configured yet.'}
            </p>
            {statusFilter === 'ALL' && (
              <button
                className="btn btn-primary btn-sm"
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
                + Provision First Administrator
              </button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px' }}>Administrator</th>
                  <th style={{ padding: '12px 16px' }}>Contact Phone</th>
                  <th style={{ padding: '12px 16px' }}>Assigned Role</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px' }}>Last Login</th>
                  <th style={{ padding: '12px 16px' }}>Created At</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((admin) => {
                  const isLocked = admin.status === 'LOCKED';
                  const isInactive = admin.status === 'DEACTIVATED' || admin.status === 'SUSPENDED';

                  return (
                    <tr
                      key={admin.user_id}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: isLocked ? '#fff1f2' : isInactive ? '#fafafa' : '#ffffff',
                      }}
                    >
                      {/* Administrator Info */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{admin.email}</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          ID: {admin.user_id}
                        </div>
                        {isLocked && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--danger-text)', fontWeight: 'bold', marginTop: '2px' }}>
                            ⚠️ Account Locked due to failed attempts
                          </div>
                        )}
                      </td>

                      {/* Phone */}
                      <td style={{ padding: '12px 16px' }}>
                        {admin.phone ? (
                          <span style={{ fontFamily: 'monospace' }}>{admin.phone}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>Not configured</span>
                        )}
                      </td>

                      {/* Role */}
                      <td style={{ padding: '12px 16px' }}>
                        <span className="badge badge-info">{admin.role_name || admin.role_code}</span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 16px' }}>{getStatusBadge(admin.status)}</td>

                      {/* Last Login */}
                      <td style={{ padding: '12px 16px' }}>
                        {admin.last_login_at ? (
                          <div>
                            <div>{new Date(admin.last_login_at).toLocaleDateString()}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              {new Date(admin.last_login_at).toLocaleTimeString()}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>Never logged in</span>
                        )}
                      </td>

                      {/* Created At */}
                      <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {new Date(admin.created_at).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {/* Unlock (only if locked) */}
                          {isLocked && (
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => {
                                setUnlockError(null);
                                setUnlockingAdmin(admin);
                              }}
                              title="Unlock this locked administrator account"
                            >
                              🔓 Unlock
                            </button>
                          )}

                          {/* Edit Profile */}
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => {
                              setEditError(null);
                              setEditForm({ phone: admin.phone || '' });
                              setEditingAdmin(admin);
                            }}
                            title="Edit permitted profile fields"
                          >
                            ✏️ Edit
                          </button>

                          {/* Status Management */}
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => {
                              setStatusError(null);
                              setStatusReason('');
                              setTargetStatus(admin.status === 'ACTIVE' ? 'DEACTIVATED' : 'ACTIVE');
                              setStatusAdmin(admin);
                            }}
                            title="Activate, suspend, or deactivate administrator"
                          >
                            🔄 Status
                          </button>

                          {/* Login History */}
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => openLoginHistory(admin)}
                            title="Inspect login attempts from platform.login_events"
                          >
                            📜 History
                          </button>

                          {/* Invalidate Device Tokens */}
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => {
                              setRevokeError(null);
                              setRevokeResult(null);
                              setRevokingAdmin(admin);
                            }}
                            title="Invalidate push notification device tokens"
                          >
                            📲 Push Tokens
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
              padding: '12px 16px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f8fafc',
            }}
          >
            <button
              className="btn btn-outline btn-sm"
              disabled={page === 0 || adminsLoading}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              ← Previous
            </button>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Page <strong>{page + 1}</strong> of <strong>{totalPages}</strong>
            </span>
            <button
              className="btn btn-outline btn-sm"
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
