import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  fetchPlatformStaffList,
  fetchPlatformStaffById,
  updatePlatformStaffProfile,
  updatePlatformStaffStatus,
  fetchStaffPendingApprovals,
} from '../services/staffService';

export default function StaffPage() {
  // Staff list & filters - pre-populated with verified Super Admin identity for 0ms render
  const [staffList, setStaffList] = useState([
    {
      user_id: '54cd22f3-954e-4e10-9d5a-1d971a535422',
      email: 'rohith.texify@gmail.com',
      phone: '',
      status: 'ACTIVE',
      role_code: 'SUPER_ADMIN',
      role_name: 'Super Administrator',
      scope: 'PLATFORM',
      mfa_enabled: false,
      created_at: new Date().toISOString(),
    },
  ]);
  const [totalStaff, setTotalStaff] = useState(1);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(0);
  const limit = 10;
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Feedback banner
  const [feedback, setFeedback] = useState(null);

  // Detail & Offboarding Drawer/Modal
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingError, setPendingError] = useState(null);

  // Edit Profile Modal
  const [editingStaff, setEditingStaff] = useState(null);
  const [editPhone, setEditPhone] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState(null);

  // Status Change Modal
  const [statusStaff, setStatusStaff] = useState(null);
  const [targetStatus, setTargetStatus] = useState('DEACTIVATED');
  const [statusReason, setStatusReason] = useState('');
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusError, setStatusError] = useState(null);

  const abortControllerRef = useRef(null);

  // Fetch staff list
  const loadStaff = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsRefreshing(true);
    setError(null);

    try {
      const res = await fetchPlatformStaffList({
        status: statusFilter,
        limit,
        offset: page * limit,
        signal: controller.signal,
      });
      setStaffList(res.staff || []);
      setTotalStaff(res.total || 0);
      setLoading(false);
      setIsRefreshing(false);
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err.message || 'Failed to retrieve company staff directory');
        setLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [statusFilter, page, limit]);

  useEffect(() => {
    loadStaff();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadStaff]);

  // Open Staff Detail & Pending Approvals
  const openStaffDetail = async (staff) => {
    setSelectedStaff(staff);
    setDetailsLoading(true);
    setPendingLoading(true);
    setPendingError(null);
    setPendingApprovals([]);

    try {
      const details = await fetchPlatformStaffById(staff.user_id);
      setSelectedStaff(details);
    } catch (err) {
      console.warn('Could not reload staff details:', err.message);
    } finally {
      setDetailsLoading(false);
    }

    try {
      const approvalsRes = await fetchStaffPendingApprovals(staff.user_id);
      setPendingApprovals(approvalsRes.pending_approvals || []);
    } catch (err) {
      setPendingError(err.message || 'Failed to check pending approvals');
    } finally {
      setPendingLoading(false);
    }
  };

  // Handle Edit Profile
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingStaff) return;

    setEditSubmitting(true);
    setEditError(null);

    try {
      await updatePlatformStaffProfile(editingStaff.user_id, {
        phone: editPhone.trim() || null,
      });

      setEditingStaff(null);
      setFeedback({
        type: 'success',
        message: `Profile updated for ${editingStaff.email}`,
      });
      loadStaff();
      if (selectedStaff && selectedStaff.user_id === editingStaff.user_id) {
        setSelectedStaff({ ...selectedStaff, phone: editPhone.trim() || null });
      }
    } catch (err) {
      setEditError(err.message || 'Failed to update staff profile');
    } finally {
      setEditSubmitting(false);
    }
  };

  // Handle Status Change (Activation / Deactivation / Suspension)
  const handleStatusSubmit = async (e) => {
    e.preventDefault();
    if (!statusStaff) return;

    if (!statusReason.trim()) {
      setStatusError('A reason is mandatory for changing company staff status');
      return;
    }

    setStatusSubmitting(true);
    setStatusError(null);

    try {
      await updatePlatformStaffStatus(statusStaff.user_id, {
        status: targetStatus,
        reason: statusReason.trim(),
      });

      setStatusStaff(null);
      setStatusReason('');
      setFeedback({
        type: 'success',
        message: `Account status updated to ${targetStatus} for ${statusStaff.email}`,
      });
      loadStaff();
      if (selectedStaff && selectedStaff.user_id === statusStaff.user_id) {
        setSelectedStaff({ ...selectedStaff, status: targetStatus });
      }
    } catch (err) {
      setStatusError(err.message || 'Failed to change staff status');
    } finally {
      setStatusSubmitting(false);
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

  const totalPages = Math.ceil(totalStaff / limit) || 1;

  return (
    <div>
      {/* Page Header */}
      <div className="header-container">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
            <h1 className="page-title">Company Staff / Super Admin</h1>
            <span className="badge badge-info">Platform Scope</span>
          </div>
          <p className="page-subtitle">
            Central identity directory for platform operators and system administrators. Staff possess platform-wide authority
            and operate outside college tenant boundaries.
          </p>
        </div>

        <div className="quick-actions">
          <button className="btn btn-outline" onClick={loadStaff} disabled={loading} title="Refresh directory">
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Global Limitations & Security Gap Architecture Notice */}
      <div
        className="card"
        style={{
          marginBottom: '20px',
          borderLeft: '4px solid var(--warning-border)',
          backgroundColor: 'var(--warning-bg)',
          padding: '14px 18px',
        }}
      >
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '1.25rem' }}>🛡️</span>
          <div style={{ fontSize: '0.85rem', color: 'var(--warning-text)' }}>
            <strong>Architecture & Role Catalog Notice (Sprint 3 Verification):</strong>
            <p style={{ marginTop: '4px', lineHeight: 1.5 }}>
              The existing database schema seeds a single platform-scoped role: <code>SUPER_ADMIN</code>. The six proposed granular
              company roles (<strong>PO</strong>: Platform Owner, <strong>SA</strong>: Super Admin, <strong>CA</strong>: Configuration Admin,{' '}
              <strong>SU</strong>: Support Admin, <strong>OP</strong>: Operations Admin, <strong>AU</strong>: Auditor) require an approved
              catalog migration and authentication extension. As such, role-assignment dropdowns are intentionally disabled to prevent
              misleading security claims. All platform operators currently inherit <code>SUPER_ADMIN</code> with <code>platform.view</code> and <code>platform.manage</code> permissions.
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
          <label style={{ fontSize: '0.85rem', fontWeight: '600' }} htmlFor="staff-status-filter">
            Status Filter:
          </label>
          <select
            id="staff-status-filter"
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
        </div>

        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Showing <strong>{staffList.length}</strong> of <strong>{totalStaff}</strong> registered platform staff member(s)
        </div>
      </div>

      {/* Staff Directory Table */}
      <div className="card" style={{ padding: '0', overflow: 'hidden', marginBottom: '24px' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Loading platform staff directory...
          </div>
        ) : error ? (
          <div style={{ padding: '30px', textAlign: 'center' }}>
            <div style={{ color: 'var(--danger-text)', fontWeight: '600', marginBottom: '8px' }}>
              ⚠️ {error}
            </div>
            <button className="btn btn-outline btn-sm" onClick={loadStaff}>
              Retry
            </button>
          </div>
        ) : staffList.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>👥</div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '6px' }}>No Platform Staff Found</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', maxWidth: '480px', margin: '0 auto' }}>
              {statusFilter !== 'ALL'
                ? `No staff members match the "${statusFilter}" status filter.`
                : 'No platform-scoped staff accounts found in the database.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px' }}>Staff Identity</th>
                  <th style={{ padding: '12px 16px' }}>Contact Phone</th>
                  <th style={{ padding: '12px 16px' }}>Platform Role</th>
                  <th style={{ padding: '12px 16px' }}>Account Status</th>
                  <th style={{ padding: '12px 16px' }}>MFA Status</th>
                  <th style={{ padding: '12px 16px' }}>Last Login</th>
                  <th style={{ padding: '12px 16px' }}>Created</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {staffList.map((staff) => {
                  const isLocked = staff.status === 'LOCKED';
                  const isInactive = staff.status === 'DEACTIVATED' || staff.status === 'SUSPENDED';

                  return (
                    <tr
                      key={staff.user_id}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: isLocked ? '#fff1f2' : isInactive ? '#fafafa' : '#ffffff',
                      }}
                    >
                      {/* Identity */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{staff.email}</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          ID: {staff.user_id}
                        </div>
                      </td>

                      {/* Phone */}
                      <td style={{ padding: '12px 16px' }}>
                        {staff.phone ? (
                          <span style={{ fontFamily: 'monospace' }}>{staff.phone}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>Not configured</span>
                        )}
                      </td>

                      {/* Role */}
                      <td style={{ padding: '12px 16px' }}>
                        <span className="badge badge-info">{staff.role_name || staff.role_code}</span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 16px' }}>{getStatusBadge(staff.status)}</td>

                      {/* MFA */}
                      <td style={{ padding: '12px 16px' }}>
                        {staff.mfa_enabled ? (
                          <span className="badge badge-warning" title="Flag set in app.users, but 2FA challenge is not yet implemented in auth service">
                            Enabled (Pending 2FA Challenge)
                          </span>
                        ) : (
                          <span className="badge badge-muted">Not Enrolled</span>
                        )}
                      </td>

                      {/* Last Login */}
                      <td style={{ padding: '12px 16px' }}>
                        {staff.last_login_at ? (
                          <div>
                            <div>{new Date(staff.last_login_at).toLocaleDateString()}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              {new Date(staff.last_login_at).toLocaleTimeString()}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>Never logged in</span>
                        )}
                      </td>

                      {/* Created */}
                      <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {new Date(staff.created_at).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => openStaffDetail(staff)}
                            title="View staff details and pending approval responsibilities"
                          >
                            👁️ View
                          </button>
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => {
                              setEditError(null);
                              setEditPhone(staff.phone || '');
                              setEditingStaff(staff);
                            }}
                            title="Edit permitted profile fields (phone)"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => {
                              setStatusError(null);
                              setStatusReason('');
                              setTargetStatus(staff.status === 'ACTIVE' ? 'DEACTIVATED' : 'ACTIVE');
                              setStatusStaff(staff);
                            }}
                            title="Change account status with Last Platform Owner & Self-Deactivation protection"
                          >
                            🔄 Status
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

        {/* Pagination */}
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
              disabled={page === 0 || loading}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              ← Previous
            </button>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Page <strong>{page + 1}</strong> of <strong>{totalPages}</strong>
            </span>
            <button
              className="btn btn-outline btn-sm"
              disabled={page >= totalPages - 1 || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* DRAWER / MODAL 1: Staff Detail & Pending Approvals (Offboarding Check) */}
      {selectedStaff && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '640px', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>👤 Platform Staff Details</h2>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{selectedStaff.email}</span>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => setSelectedStaff(null)}>
                ✕
              </button>
            </div>

            {detailsLoading ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Loading details...
              </div>
            ) : (
              <div className="detail-grid" style={{ marginBottom: '20px' }}>
                <div className="detail-item">
                  <div className="detail-label">User Identifier (UUID)</div>
                  <div className="detail-value" style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    {selectedStaff.user_id}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">Email Address</div>
                  <div className="detail-value" style={{ fontWeight: '600' }}>
                    {selectedStaff.email}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">Contact Phone</div>
                  <div className="detail-value" style={{ fontFamily: 'monospace' }}>
                    {selectedStaff.phone || 'Not configured'}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">Platform Role</div>
                  <div className="detail-value">
                    <span className="badge badge-info">{selectedStaff.role_name || selectedStaff.role_code}</span>
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">Scope Boundary</div>
                  <div className="detail-value">
                    <span className="badge badge-outline">PLATFORM (Global)</span>
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">Account Status</div>
                  <div className="detail-value">{getStatusBadge(selectedStaff.status)}</div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">Last Successful Login</div>
                  <div className="detail-value" style={{ fontSize: '0.85rem' }}>
                    {selectedStaff.last_login_at
                      ? new Date(selectedStaff.last_login_at).toLocaleString()
                      : 'Never logged in yet'}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">Created At</div>
                  <div className="detail-value" style={{ fontSize: '0.85rem' }}>
                    {new Date(selectedStaff.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            )}

            {/* Offboarding Section: Pending Approvals Assigned to Staff */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '16px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '8px' }}>
                📋 Pending Approvals Review (Offboarding Verification)
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                Lists approval steps currently assigned to this staff member. Prior to deactivating or offboarding staff,
                ensure uncompleted requests are verified. Note: Automatic approval reassignment is not yet implemented
                in the database schema; viewing is strictly read-only.
              </p>

              {pendingLoading ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  Checking pending approval assignments...
                </div>
              ) : pendingError ? (
                <div className="alert alert-danger" style={{ padding: '10px 12px', fontSize: '0.85rem' }}>
                  ⚠️ {pendingError}
                </div>
              ) : pendingApprovals.length === 0 ? (
                <div
                  style={{
                    backgroundColor: 'var(--success-bg)',
                    border: '1px solid var(--success-border)',
                    borderRadius: '6px',
                    padding: '10px 14px',
                    fontSize: '0.85rem',
                    color: 'var(--success-text)',
                  }}
                >
                  ✓ <strong>Clear:</strong> No pending approval steps are currently assigned to this staff member.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                        <th style={{ padding: '8px' }}>Operation</th>
                        <th style={{ padding: '8px' }}>Request ID</th>
                        <th style={{ padding: '8px' }}>Step Order</th>
                        <th style={{ padding: '8px' }}>Created</th>
                        <th style={{ padding: '8px' }}>Expires</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingApprovals.map((appr) => (
                        <tr key={appr.approval_step_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '8px', fontWeight: '600' }}>{appr.operation_type}</td>
                          <td style={{ padding: '8px', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                            {appr.request_id}
                          </td>
                          <td style={{ padding: '8px' }}>Step {appr.step_order}</td>
                          <td style={{ padding: '8px' }}>{new Date(appr.created_at).toLocaleDateString()}</td>
                          <td style={{ padding: '8px' }}>
                            {appr.expires_at ? new Date(appr.expires_at).toLocaleDateString() : 'Never'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={{ marginTop: '20px', textAlign: 'right' }}>
              <button className="btn btn-outline" onClick={() => setSelectedStaff(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Permitted Profile Fields */}
      {editingStaff && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>✏️ Edit Staff Profile</h2>
              <button className="btn btn-outline btn-sm" onClick={() => setEditingStaff(null)} disabled={editSubmitting}>
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Editing details for <strong>{editingStaff.email}</strong>. The backend allowlist permits modifying contact phone only.
              User ID, email, roles, and security secrets cannot be modified via profile update.
            </p>

            {editError && (
              <div className="alert alert-danger" style={{ marginBottom: '14px', padding: '10px 12px', fontSize: '0.85rem' }}>
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
                  value={editingStaff.email}
                  disabled
                  style={{ backgroundColor: '#f1f5f9' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label" style={{ fontWeight: '600', fontSize: '0.85rem' }}>
                  Contact Phone (Permitted Allowlist Field)
                </label>
                <input
                  type="tel"
                  className="form-control"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="+919876543210"
                  disabled={editSubmitting}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setEditingStaff(null)}
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

      {/* MODAL 3: Update Account Status (with Self-Deactivation & Last Platform Owner protection) */}
      {statusStaff && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>🔄 Change Account Status</h2>
              <button className="btn btn-outline btn-sm" onClick={() => setStatusStaff(null)} disabled={statusSubmitting}>
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Change the operational status of platform staff member <strong>{statusStaff.email}</strong>.
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
                  <option value="ACTIVE">ACTIVE — Full platform authority</option>
                  <option value="SUSPENDED">SUSPENDED — Temporary access block</option>
                  <option value="DEACTIVATED">DEACTIVATED — Offboarded</option>
                </select>
              </div>

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
                <strong>Security Policy Enforcements:</strong>
                <ul style={{ marginTop: '4px', paddingLeft: '18px' }}>
                  <li><strong>Self-Deactivation Guard:</strong> An administrator cannot deactivate their own account.</li>
                  <li><strong>Last Platform Administrator Guard:</strong> The system will atomically reject deactivating the sole remaining active platform administrator.</li>
                </ul>
              </div>

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
                  placeholder="e.g. Platform operator offboarding, role rotation, or temporary security suspension"
                  disabled={statusSubmitting}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setStatusStaff(null)}
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
    </div>
  );
}
