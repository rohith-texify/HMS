import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  ShieldCheck,
  ShieldAlert,
  RotateCw,
  KeyRound,
  UserCheck,
  UserX,
  Lock,
  Search,
  X,
  Phone,
  Mail,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowRight,
  Eye,
  Edit3,
  AlertCircle,
  FileCheck,
} from 'lucide-react';
import {
  fetchPlatformStaffList,
  fetchPlatformStaffById,
  updatePlatformStaffProfile,
  updatePlatformStaffStatus,
  fetchStaffPendingApprovals,
} from '../services/staffService';

/**
 * Animated number count-up effect
 */
function CountUpNumber({ value, duration = 800 }) {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (typeof value !== 'number') {
      setDisplayValue(value);
      return;
    }

    const start = prevValueRef.current || 0;
    const end = value;
    const range = end - start;
    if (range === 0) {
      setDisplayValue(end);
      return;
    }

    const startTime = performance.now();
    let frameId;

    const updateCount = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + range * easeProgress);

      setDisplayValue(current);

      if (progress < 1) {
        frameId = requestAnimationFrame(updateCount);
      } else {
        prevValueRef.current = end;
      }
    };

    frameId = requestAnimationFrame(updateCount);
    return () => cancelAnimationFrame(frameId);
  }, [value, duration]);

  return <span>{displayValue}</span>;
}

export default function StaffPage() {
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
  const [searchQuery, setSearchQuery] = useState('');
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
      setTotalStaff(res.total || (res.staff ? res.staff.length : 1));
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

  // Handle Status Change
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

  // Derived counts for KPI cards
  const activeCount = staffList.filter((s) => s.status === 'ACTIVE').length;
  const mfaCount = staffList.filter((s) => s.mfa_enabled).length;
  const inactiveCount = staffList.filter((s) => s.status === 'DEACTIVATED' || s.status === 'SUSPENDED' || s.status === 'LOCKED').length;

  // Filtered staff list by search query
  const filteredStaffList = staffList.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (s.email && s.email.toLowerCase().includes(q)) ||
      (s.phone && s.phone.includes(q)) ||
      (s.role_name && s.role_name.toLowerCase().includes(q)) ||
      (s.role_code && s.role_code.toLowerCase().includes(q))
    );
  });

  const totalPages = Math.ceil(totalStaff / limit) || 1;

  return (
    <div className="staff-page-container animate-fade-in">
      {/* Top Header & Breadcrumbs */}
      <div className="staff-hero-header">
        <div className="staff-hero-text">
          <div className="staff-breadcrumbs">
            <Link to="/dashboard" className="breadcrumb-link">Dashboard</Link>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current">Company Staff</span>
          </div>
          <div className="staff-title-row">
            <h1 className="staff-title">Company Staff & Administrators</h1>
            <span className="badge-enterprise badge-blue">Platform Scope</span>
          </div>
          <p className="staff-subtitle">
            Central identity directory for platform operators and system administrators with global governance authority.
          </p>
        </div>

        <div className="staff-actions-cluster">
          <button
            type="button"
            className={`btn-enterprise btn-outline-soft ${isRefreshing ? 'is-loading' : ''}`}
            onClick={loadStaff}
            disabled={isRefreshing}
            title="Refresh staff directory"
          >
            <RotateCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Top 4 KPI Metric Cards */}
      <div className="staff-kpi-grid">
        {/* Card 1: Total Platform Staff */}
        <div className="staff-stat-card card-stagger-1">
          <div className="staff-stat-header">
            <span className="staff-stat-label">Total Platform Staff</span>
            <div className="staff-stat-icon-wrap blue">
              <Users size={17} />
            </div>
          </div>
          <div className="staff-stat-value text-slate-900">
            <CountUpNumber value={totalStaff} />
          </div>
          <div className="staff-stat-subtext">Registered platform governance accounts</div>
          <div className="staff-stat-accent-bar blue" />
        </div>

        {/* Card 2: Active Operators */}
        <div className="staff-stat-card card-stagger-2">
          <div className="staff-stat-header">
            <span className="staff-stat-label">Active Operators</span>
            <div className="staff-stat-icon-wrap green">
              <UserCheck size={17} />
            </div>
          </div>
          <div className="staff-stat-value text-emerald-600">
            <CountUpNumber value={activeCount} />
          </div>
          <div className="staff-stat-subtext">Unrestricted active system administrators</div>
          <div className="staff-stat-accent-bar green" />
        </div>

        {/* Card 3: MFA Protected */}
        <div className="staff-stat-card card-stagger-3">
          <div className="staff-stat-header">
            <span className="staff-stat-label">MFA Enrolled</span>
            <div className="staff-stat-icon-wrap purple">
              <KeyRound size={17} />
            </div>
          </div>
          <div className="staff-stat-value text-purple-600">
            <CountUpNumber value={mfaCount} />
          </div>
          <div className="staff-stat-subtext">Multi-factor security verified staff</div>
          <div className="staff-stat-accent-bar purple" />
        </div>

        {/* Card 4: Inactive / Restricted */}
        <div className="staff-stat-card card-stagger-4">
          <div className="staff-stat-header">
            <span className="staff-stat-label">Restricted / Inactive</span>
            <div className="staff-stat-icon-wrap amber">
              <UserX size={17} />
            </div>
          </div>
          <div className="staff-stat-value text-amber-600">
            <CountUpNumber value={inactiveCount} />
          </div>
          <div className="staff-stat-subtext">Suspended, locked, or offboarded</div>
          <div className="staff-stat-accent-bar amber" />
        </div>
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div className={`staff-feedback-banner ${feedback.type} animate-badge-pop`}>
          <div className="feedback-content">
            <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            className="feedback-close-btn"
            onClick={() => setFeedback(null)}
            title="Dismiss notice"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Main Staff Directory Card */}
      <div className="staff-main-card card-stagger-5">
        {/* Controls Toolbar: Filter Tabs & Search */}
        <div className="staff-toolbar">
          {/* Segmented Status Filter Tabs */}
          <div className="staff-tabs-pillbox">
            {[
              { label: 'All Statuses', value: 'ALL' },
              { label: 'Active', value: 'ACTIVE' },
              { label: 'Locked', value: 'LOCKED' },
              { label: 'Suspended', value: 'SUSPENDED' },
              { label: 'Deactivated', value: 'DEACTIVATED' },
            ].map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => {
                  setStatusFilter(tab.value);
                  setPage(0);
                }}
                className={`staff-tab-pill ${statusFilter === tab.value ? 'active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="staff-search-box">
            <Search size={15} className="search-icon" />
            <input
              type="text"
              placeholder="Search staff by email, phone, role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="staff-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearchQuery('')}
                title="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="staff-loading-state">
            <div className="loading-spinner-blue" />
            <div className="loading-state-title">Loading Staff Directory...</div>
            <div className="loading-state-sub">Fetching verified platform administrators and security attributes.</div>
          </div>
        ) : error ? (
          <div className="staff-error-state">
            <ShieldAlert size={24} className="text-rose-600 mb-2" />
            <div className="error-state-title">Error Loading Staff Directory</div>
            <div className="error-state-sub">{error}</div>
            <button
              type="button"
              className="btn-enterprise btn-outline-soft mt-3"
              onClick={loadStaff}
            >
              Retry Connection
            </button>
          </div>
        ) : filteredStaffList.length === 0 ? (
          /* Empty State */
          <div className="staff-empty-state">
            <div className="empty-state-badge-stage">
              <div className="empty-state-badge-pulse" />
              <div className="empty-state-icon-badge">
                <Users size={32} className="text-blue-600" />
              </div>
            </div>
            <h3 className="empty-state-heading">No Platform Staff Found</h3>
            <p className="empty-state-description">
              {statusFilter !== 'ALL' || searchQuery
                ? 'No staff members match your selected status filter or search query.'
                : 'No platform-scoped staff accounts found.'}
            </p>
            {(statusFilter !== 'ALL' || searchQuery) && (
              <button
                type="button"
                className="btn-enterprise btn-outline-soft empty-state-btn"
                onClick={() => {
                  setStatusFilter('ALL');
                  setSearchQuery('');
                  setPage(0);
                }}
              >
                Clear Filters & Search
              </button>
            )}
          </div>
        ) : (
          /* Directory Table */
          <div className="staff-table-responsive">
            <table className="staff-table">
              <thead>
                <tr>
                  <th>Staff Identity</th>
                  <th>Contact Phone</th>
                  <th>Platform Role</th>
                  <th>Account Status</th>
                  <th>MFA Security</th>
                  <th>Last Login</th>
                  <th>Registered</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaffList.map((staff) => {
                  const isLocked = staff.status === 'LOCKED';
                  const isInactive = staff.status === 'DEACTIVATED' || staff.status === 'SUSPENDED';
                  const initials = staff.email ? staff.email.slice(0, 2).toUpperCase() : 'OP';

                  return (
                    <tr
                      key={staff.user_id}
                      className={`staff-table-row ${isLocked ? 'locked' : isInactive ? 'inactive' : ''}`}
                    >
                      {/* Identity */}
                      <td>
                        <div className="staff-cell-wrap">
                          <div className="staff-avatar-box">
                            {initials}
                          </div>
                          <div>
                            <div className="staff-email-text">{staff.email}</div>
                            <div className="staff-uuid-text">
                              ID: #{staff.user_id ? staff.user_id.slice(0, 8) : '—'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td>
                        {staff.phone ? (
                          <div className="staff-phone-pill">
                            <Phone size={12} className="text-slate-400" />
                            <span>{staff.phone}</span>
                          </div>
                        ) : (
                          <span className="text-muted-tag">Not configured</span>
                        )}
                      </td>

                      {/* Role */}
                      <td>
                        <span className="badge-role">
                          {staff.role_name || staff.role_code}
                        </span>
                      </td>

                      {/* Status */}
                      <td>
                        <span className={`badge-staff-status ${staff.status ? staff.status.toLowerCase() : 'muted'}`}>
                          <span className="status-dot-inner" />
                          {staff.status}
                        </span>
                      </td>

                      {/* MFA */}
                      <td>
                        {staff.mfa_enabled ? (
                          <span className="badge-mfa enabled">
                            <ShieldCheck size={13} />
                            <span>Enrolled</span>
                          </span>
                        ) : (
                          <span className="badge-mfa disabled">
                            <span>Not Enrolled</span>
                          </span>
                        )}
                      </td>

                      {/* Last Login */}
                      <td>
                        {staff.last_login_at ? (
                          <div className="staff-login-cell">
                            <div>{new Date(staff.last_login_at).toLocaleDateString()}</div>
                            <div className="login-time-sub">
                              {new Date(staff.last_login_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-tag">Never logged in</span>
                        )}
                      </td>

                      {/* Created */}
                      <td>
                        <span className="date-cell">
                          {staff.created_at ? new Date(staff.created_at).toLocaleDateString() : '—'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <div className="action-buttons-wrap">
                          <button
                            type="button"
                            className="btn-enterprise btn-outline-soft btn-sm"
                            onClick={() => openStaffDetail(staff)}
                            title="View staff details & pending approvals"
                          >
                            <Eye size={13} />
                            <span>View</span>
                          </button>

                          <button
                            type="button"
                            className="btn-enterprise btn-outline-soft btn-sm"
                            onClick={() => {
                              setEditError(null);
                              setEditPhone(staff.phone || '');
                              setEditingStaff(staff);
                            }}
                            title="Edit phone contact"
                          >
                            <Edit3 size={13} />
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            className="btn-enterprise btn-outline-soft btn-sm"
                            onClick={() => {
                              setStatusError(null);
                              setStatusReason('');
                              setTargetStatus(staff.status === 'ACTIVE' ? 'DEACTIVATED' : 'ACTIVE');
                              setStatusStaff(staff);
                            }}
                            title="Change account operational status"
                          >
                            <RotateCw size={13} />
                            <span>Status</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="staff-pagination-bar">
                <span className="pagination-info">
                  Showing {page * limit + 1} to {Math.min((page + 1) * limit, totalStaff)} of {totalStaff} operators
                </span>
                <div className="pagination-actions">
                  <button
                    type="button"
                    className="btn-enterprise btn-outline-soft btn-sm"
                    disabled={page === 0 || loading}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    Previous
                  </button>
                  <span className="page-indicator">
                    Page {page + 1} of {totalPages}
                  </span>
                  <button
                    type="button"
                    className="btn-enterprise btn-outline-soft btn-sm"
                    disabled={page >= totalPages - 1 || loading}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL 1: Staff Detail & Pending Approvals Drawer */}
      {selectedStaff && (
        <div className="staff-modal-backdrop">
          <div className="staff-modal-dialog animate-badge-pop">
            <div className="staff-modal-header">
              <div className="modal-title-wrap">
                <Users size={20} className="text-blue-600" />
                <div>
                  <h2 className="modal-title-text">Platform Staff Details</h2>
                  <span className="modal-title-sub">{selectedStaff.email}</span>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedStaff(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="staff-modal-body">
              {detailsLoading ? (
                <div className="staff-modal-loading">
                  <div className="loading-spinner-blue" />
                  <span>Loading account details...</span>
                </div>
              ) : (
                <div className="staff-details-grid">
                  <div className="detail-item-box">
                    <span className="detail-label">User Identifier (UUID)</span>
                    <span className="detail-value mono">{selectedStaff.user_id}</span>
                  </div>

                  <div className="detail-item-box">
                    <span className="detail-label">Email Address</span>
                    <span className="detail-value font-semibold">{selectedStaff.email}</span>
                  </div>

                  <div className="detail-item-box">
                    <span className="detail-label">Contact Phone</span>
                    <span className="detail-value">{selectedStaff.phone || 'Not configured'}</span>
                  </div>

                  <div className="detail-item-box">
                    <span className="detail-label">Platform Role</span>
                    <span className="badge-role">{selectedStaff.role_name || selectedStaff.role_code}</span>
                  </div>

                  <div className="detail-item-box">
                    <span className="detail-label">Scope Boundary</span>
                    <span className="badge-enterprise badge-blue">PLATFORM (Global)</span>
                  </div>

                  <div className="detail-item-box">
                    <span className="detail-label">Account Status</span>
                    <span className={`badge-staff-status ${selectedStaff.status ? selectedStaff.status.toLowerCase() : 'muted'}`}>
                      <span className="status-dot-inner" />
                      {selectedStaff.status}
                    </span>
                  </div>

                  <div className="detail-item-box">
                    <span className="detail-label">Last Successful Login</span>
                    <span className="detail-value">
                      {selectedStaff.last_login_at
                        ? new Date(selectedStaff.last_login_at).toLocaleString()
                        : 'Never logged in yet'}
                    </span>
                  </div>

                  <div className="detail-item-box">
                    <span className="detail-label">Created At</span>
                    <span className="detail-value">
                      {new Date(selectedStaff.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              {/* Pending Approvals Review (Offboarding Verification) */}
              <div className="staff-modal-section">
                <div className="section-title-wrap">
                  <FileCheck size={16} className="text-blue-600" />
                  <h3 className="section-title-text">Pending Approvals Review</h3>
                </div>
                <p className="section-subtext">
                  Approval requests assigned to this administrator. Ensure all requests are completed prior to offboarding.
                </p>

                {pendingLoading ? (
                  <div className="pending-loading-text">Checking pending approval assignments...</div>
                ) : pendingError ? (
                  <div className="pending-error-box">
                    <AlertCircle size={15} />
                    <span>{pendingError}</span>
                  </div>
                ) : pendingApprovals.length === 0 ? (
                  <div className="pending-clear-box">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    <span>Clear: No pending approval requests are assigned to this staff member.</span>
                  </div>
                ) : (
                  <div className="pending-table-wrap">
                    <table className="staff-table">
                      <thead>
                        <tr>
                          <th>Operation</th>
                          <th>Request ID</th>
                          <th>Step Order</th>
                          <th>Created</th>
                          <th>Expires</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingApprovals.map((appr) => (
                          <tr key={appr.approval_step_id}>
                            <td className="font-semibold">{appr.operation_type}</td>
                            <td className="mono text-xs">{appr.request_id}</td>
                            <td>Step {appr.step_order}</td>
                            <td>{new Date(appr.created_at).toLocaleDateString()}</td>
                            <td>{appr.expires_at ? new Date(appr.expires_at).toLocaleDateString() : 'Never'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="staff-modal-footer">
              <button
                type="button"
                className="btn-enterprise btn-outline-soft"
                onClick={() => setSelectedStaff(null)}
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Contact Phone */}
      {editingStaff && (
        <div className="staff-modal-backdrop">
          <div className="staff-modal-dialog animate-badge-pop" style={{ maxWidth: '480px' }}>
            <div className="staff-modal-header">
              <div className="modal-title-wrap">
                <Edit3 size={18} className="text-blue-600" />
                <h2 className="modal-title-text">Edit Staff Profile</h2>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setEditingStaff(null)}
                disabled={editSubmitting}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className="staff-modal-body">
                <p className="modal-instruction-text">
                  Modify profile details for <strong>{editingStaff.email}</strong>.
                </p>

                {editError && (
                  <div className="pending-error-box mb-4">
                    <AlertCircle size={15} />
                    <span>{editError}</span>
                  </div>
                )}

                <div className="form-group-custom">
                  <label className="form-label-custom">Email Address</label>
                  <input
                    type="text"
                    className="form-input-custom disabled"
                    value={editingStaff.email}
                    disabled
                  />
                </div>

                <div className="form-group-custom">
                  <label className="form-label-custom">Contact Phone</label>
                  <input
                    type="tel"
                    className="form-input-custom"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="+919876543210"
                    disabled={editSubmitting}
                  />
                </div>
              </div>

              <div className="staff-modal-footer">
                <button
                  type="button"
                  className="btn-enterprise btn-outline-soft"
                  onClick={() => setEditingStaff(null)}
                  disabled={editSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-enterprise btn-primary-blue"
                  disabled={editSubmitting}
                >
                  {editSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Update Account Status */}
      {statusStaff && (
        <div className="staff-modal-backdrop">
          <div className="staff-modal-dialog animate-badge-pop" style={{ maxWidth: '500px' }}>
            <div className="staff-modal-header">
              <div className="modal-title-wrap">
                <RotateCw size={18} className="text-amber-600" />
                <h2 className="modal-title-text">Change Account Status</h2>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setStatusStaff(null)}
                disabled={statusSubmitting}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleStatusSubmit}>
              <div className="staff-modal-body">
                <p className="modal-instruction-text">
                  Update operational status for <strong>{statusStaff.email}</strong>.
                </p>

                {statusError && (
                  <div className="pending-error-box mb-4">
                    <AlertCircle size={15} />
                    <span>{statusError}</span>
                  </div>
                )}

                <div className="form-group-custom">
                  <label className="form-label-custom">Target Status *</label>
                  <select
                    className="form-input-custom"
                    value={targetStatus}
                    onChange={(e) => setTargetStatus(e.target.value)}
                    disabled={statusSubmitting}
                  >
                    <option value="ACTIVE">ACTIVE — Full platform authority</option>
                    <option value="SUSPENDED">SUSPENDED — Temporary access block</option>
                    <option value="DEACTIVATED">DEACTIVATED — Offboarded</option>
                  </select>
                </div>

                <div className="form-group-custom">
                  <label className="form-label-custom">Reason for Status Change (Mandatory Audit Trail) *</label>
                  <textarea
                    className="form-input-custom textarea"
                    rows={3}
                    required
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    placeholder="e.g. Platform operator offboarding, role rotation, or temporary security suspension"
                    disabled={statusSubmitting}
                  />
                </div>
              </div>

              <div className="staff-modal-footer">
                <button
                  type="button"
                  className="btn-enterprise btn-outline-soft"
                  onClick={() => setStatusStaff(null)}
                  disabled={statusSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={targetStatus === 'ACTIVE' ? 'btn-enterprise btn-primary-blue' : 'btn-enterprise btn-danger'}
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
