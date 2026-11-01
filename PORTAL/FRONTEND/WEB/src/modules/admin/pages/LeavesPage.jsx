import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../shared/auth/useAuth';
import adminService from '../services/adminService';
import {
  FileText,
  CalendarCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Send,
  Calendar,
  Search,
  Filter,
  Plus,
  RefreshCw,
  Eye,
  MapPin,
  Phone,
  Check,
  X,
  ChevronRight,
  GraduationCap,
  Users,
  Shield,
  ShieldCheck,
  Sparkles,
  Plane,
} from 'lucide-react';
import {
  PageHeader,
  DataTable,
  SearchInput,
  FilterControls,
  Modal,
  FormField,
  ConfirmationDialog,
  LoadingState,
  EmptyState,
  ErrorState,
} from '../../../shared/components';

export default function AdminLeavesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Permission checks
  const canManageRequests = useMemo(() => {
    if (!user) return true;
    if (['COLLEGE_ADMIN', 'ADMIN', 'HOSTEL_ADMIN'].includes(user?.role)) return true;
    if (Array.isArray(user?.permissions)) {
      return (
        user.permissions.includes('requests.manage') ||
        user.permissions.includes('movement.manage') ||
        user.permissions.includes('*')
      );
    }
    return true;
  }, [user]);

  // Master Data State
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveSummary, setLeaveSummary] = useState(null);
  const [students, setStudents] = useState([]);

  // UI & Loading States
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successBanner, setSuccessBanner] = useState(null);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Modals Visibility
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);

  // Active Selected Request
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [pendingDecisionType, setPendingDecisionType] = useState('APPROVED'); // 'APPROVED' or 'REJECTED'
  const [decisionRemarks, setDecisionRemarks] = useState('');

  // Create Form State
  const [createFormData, setCreateFormData] = useState({
    student_id: '',
    leave_type: 'WEEKEND',
    from_date: new Date().toISOString().split('T')[0],
    to_date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    destination: '',
    reason: '',
    contact_phone: '',
  });

  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Student metadata lookup map
  const studentMap = useMemo(() => {
    const map = new Map();
    students.forEach((s) => map.set(s.id, s));
    return map;
  }, [students]);

  // =========================================================================
  // Master Data Fetching
  // =========================================================================
  const loadLeavesData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setLoading(true);
    setErrorMessage(null);

    try {
      const [leavesRes, summaryRes, studentsRes] = await Promise.allSettled([
        adminService.getLeaveRequests(),
        adminService.getLeaveSummary(),
        adminService.getStudents(),
      ]);

      if (leavesRes.status === 'fulfilled') {
        const raw = leavesRes.value;
        setLeaveRequests(Array.isArray(raw) ? raw : raw?.leaves || raw?.requests || []);
      } else {
        console.warn('Failed to load leave requests:', leavesRes.reason);
      }

      if (summaryRes.status === 'fulfilled') {
        const rawSummary = summaryRes.value;
        setLeaveSummary(rawSummary?.data || rawSummary || null);
      }

      if (studentsRes.status === 'fulfilled') {
        const rawStudents = studentsRes.value;
        setStudents(Array.isArray(rawStudents) ? rawStudents : rawStudents?.students || []);
      }
    } catch (err) {
      console.error('Failed to load leave master data:', err);
      setErrorMessage('Failed to load leave applications. Please check your network connection.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadLeavesData();
  }, [loadLeavesData]);

  // Toast banner auto-dismiss
  useEffect(() => {
    if (successBanner) {
      const timer = setTimeout(() => setSuccessBanner(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successBanner]);

  // =========================================================================
  // Computed KPI Metrics
  // =========================================================================
  const kpis = useMemo(() => {
    if (leaveSummary) {
      const total = leaveSummary.total || leaveRequests.length;
      const pending = leaveSummary.pending || 0;
      const approved = leaveSummary.approved || 0;
      const rejected = leaveSummary.rejected || 0;
      const cancelled = leaveSummary.cancelled || 0;
      return { total, pending, approved, rejected, cancelled };
    }

    const total = leaveRequests.length;
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let cancelled = 0;

    leaveRequests.forEach((l) => {
      const st = String(l.status || '').toUpperCase();
      if (st === 'PENDING') pending++;
      else if (st === 'APPROVED') approved++;
      else if (st === 'REJECTED') rejected++;
      else if (st === 'CANCELLED') cancelled++;
    });

    return { total, pending, approved, rejected, cancelled };
  }, [leaveSummary, leaveRequests]);

  // =========================================================================
  // Search & Filtering
  // =========================================================================
  const filteredLeaves = useMemo(() => {
    return leaveRequests.filter((leave) => {
      const student = studentMap.get(leave.student_id);
      const studentName = student
        ? `${student.first_name || ''} ${student.last_name || ''}`.trim()
        : '';
      const regNo = student?.registration_number || student?.admission_number || '';
      const reason = leave.reason || '';
      const dest = leave.destination || '';
      const term = searchTerm.toLowerCase().trim();

      const matchesSearch =
        !term ||
        studentName.toLowerCase().includes(term) ||
        regNo.toLowerCase().includes(term) ||
        reason.toLowerCase().includes(term) ||
        dest.toLowerCase().includes(term) ||
        (leave.id && leave.id.toLowerCase().includes(term));

      const matchesStatus =
        statusFilter === 'ALL' ||
        String(leave.status || '').toUpperCase() === statusFilter.toUpperCase();

      const matchesType =
        typeFilter === 'ALL' ||
        String(leave.leave_type || '').toUpperCase() === typeFilter.toUpperCase();

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [leaveRequests, studentMap, searchTerm, statusFilter, typeFilter]);

  // =========================================================================
  // Workflow: Create Leave Request
  // =========================================================================
  const handleOpenCreateModal = () => {
    setCreateFormData({
      student_id: students[0]?.id || '',
      leave_type: 'WEEKEND',
      from_date: new Date().toISOString().split('T')[0],
      to_date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
      destination: '',
      reason: '',
      contact_phone: '',
    });
    setFormError(null);
    setCreateModalOpen(true);
  };

  const handleCreateLeaveSubmit = async (e) => {
    e.preventDefault();
    if (!createFormData.student_id) {
      setFormError('Please select a student.');
      return;
    }
    if (!createFormData.from_date || !createFormData.to_date) {
      setFormError('Please select both departure and return dates.');
      return;
    }
    if (new Date(createFormData.to_date) < new Date(createFormData.from_date)) {
      setFormError('Return date cannot be earlier than departure date.');
      return;
    }
    if (!createFormData.reason.trim()) {
      setFormError('Please enter a reason for the leave application.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        student_id: createFormData.student_id,
        leave_type: createFormData.leave_type,
        reason: createFormData.reason.trim(),
        from_date: new Date(createFormData.from_date).toISOString(),
        to_date: new Date(createFormData.to_date).toISOString(),
        destination: createFormData.destination ? createFormData.destination.trim() : null,
        contact_phone: createFormData.contact_phone ? createFormData.contact_phone.trim() : null,
      };

      await adminService.createLeaveRequest(payload);
      setSuccessBanner('Leave application registered successfully.');
      setCreateModalOpen(false);
      loadLeavesData();
    } catch (err) {
      console.error('Failed to submit leave request:', err);
      setFormError(
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        'Failed to register leave application.'
      );
    } finally {
      setFormSubmitting(false);
    }
  };

  // =========================================================================
  // Workflow: Process Decision (Approve / Reject)
  // =========================================================================
  const handleOpenDecisionModal = (leave, decisionType) => {
    setSelectedLeave(leave);
    setPendingDecisionType(decisionType);
    setDecisionRemarks(
      decisionType === 'APPROVED'
        ? 'Approved by College Administration after guardian verification.'
        : 'Leave request rejected per institution guidelines.'
    );
    setFormError(null);
    setDecisionModalOpen(true);
  };

  const handleDecisionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedLeave) return;

    setFormSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        decision: pendingDecisionType,
        remarks: decisionRemarks ? decisionRemarks.trim() : null,
      };

      await adminService.processLeaveDecision(selectedLeave.id, payload);
      setSuccessBanner(
        `Leave application #${selectedLeave.id.slice(0, 8)} ${pendingDecisionType.toLowerCase()} successfully.`
      );
      setDecisionModalOpen(false);
      loadLeavesData();
    } catch (err) {
      console.error('Failed to process leave decision:', err);
      setFormError(
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        'Failed to process decision on this leave request.'
      );
    } finally {
      setFormSubmitting(false);
    }
  };

  // =========================================================================
  // Workflow: Cancel Leave Request
  // =========================================================================
  const handleOpenCancelModal = (leave) => {
    setSelectedLeave(leave);
    setCancelModalOpen(true);
  };

  const handleCancelSubmit = async () => {
    if (!selectedLeave) return;
    setFormSubmitting(true);

    try {
      await adminService.cancelLeaveRequest(selectedLeave.id);
      setSuccessBanner(`Leave request #${selectedLeave.id.slice(0, 8)} cancelled successfully.`);
      setCancelModalOpen(false);
      loadLeavesData();
    } catch (err) {
      console.error('Failed to cancel leave request:', err);
      setSuccessBanner(null);
      setErrorMessage(
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        'Failed to cancel leave request.'
      );
      setCancelModalOpen(false);
    } finally {
      setFormSubmitting(false);
    }
  };

  // Helper status badge
  const renderStatusBadge = (status) => {
    const st = String(status || '').toUpperCase();
    if (st === 'APPROVED') {
      return <span className="badge-enterprise badge-emerald">APPROVED</span>;
    } else if (st === 'PENDING') {
      return <span className="badge-enterprise badge-amber">PENDING</span>;
    } else if (st === 'REJECTED') {
      return <span className="badge-enterprise badge-rose">REJECTED</span>;
    } else if (st === 'CANCELLED') {
      return <span className="badge-enterprise badge-slate">CANCELLED</span>;
    } else if (st === 'COMPLETED') {
      return <span className="badge-enterprise badge-cyan">COMPLETED</span>;
    } else if (st === 'EXPIRED') {
      return <span className="badge-enterprise badge-zinc">EXPIRED</span>;
    }
    return <span className="badge-enterprise badge-slate">{st}</span>;
  };

  // Helper leave type badge
  const renderTypeBadge = (type) => {
    const t = String(type || '').toUpperCase();
    let colorClass = 'badge-blue';
    if (t === 'EMERGENCY') colorClass = 'badge-rose';
    else if (t === 'MEDICAL') colorClass = 'badge-purple';
    else if (t === 'OVERNIGHT') colorClass = 'badge-amber';
    else if (t === 'WEEKEND') colorClass = 'badge-emerald';

    return <span className={`badge-enterprise ${colorClass}`}>{t.replace('_', ' ')}</span>;
  };

  return (
    <div className="enterprise-module-page">
      {/* Header Bar */}
      <div className="enterprise-page-header">
        <div className="header-text-group">
          <div className="header-title-row">
            <div className="header-icon-badge">
              <FileText size={22} />
            </div>
            <div>
              <h1 className="header-title">Student Leave Applications</h1>
              <p className="header-subtitle">
                Outpass processing, weekend permissions, overnight leaves, and gate departure authorization.
              </p>
            </div>
          </div>
        </div>

        <div className="header-actions-group">
          <button
            type="button"
            className="action-btn-secondary"
            onClick={() => loadLeavesData(true)}
            disabled={isRefreshing || loading}
            title="Refresh Leaves Data"
          >
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          {canManageRequests && (
            <button
              type="button"
              className="action-btn-primary"
              onClick={handleOpenCreateModal}
              disabled={loading}
            >
              <Plus size={15} />
              <span>New Leave Application</span>
            </button>
          )}
        </div>
      </div>

      {/* Success Notification Banner */}
      {successBanner && (
        <div
          style={{
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            padding: '12px 18px',
            borderRadius: '10px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '13.5px',
            fontWeight: 500,
          }}
        >
          <CheckCircle2 size={16} style={{ color: '#059669', flexShrink: 0 }} />
          <span>{successBanner}</span>
        </div>
      )}

      {/* Error State Banner */}
      {errorMessage && (
        <div style={{ marginBottom: '20px' }}>
          <ErrorState message={errorMessage} onRetry={() => loadLeavesData(true)} />
        </div>
      )}

      {/* KPI Stats Bar */}
      <div className="kpi-cards-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Total Applications</span>
            <div className="stat-kpi-icon-wrap blue">
              <FileText size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-blue-600">{kpis.total}</div>
          <div className="stat-kpi-footnote">
            <span>All student outpass submissions</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Pending Decision</span>
            <div className="stat-kpi-icon-wrap orange">
              <Clock size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-orange-600">{kpis.pending}</div>
          <div className="stat-kpi-footnote">
            <span className="status-dot amber" />
            <span>Awaiting administrator or warden review</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Approved Clearances</span>
            <div className="stat-kpi-icon-wrap emerald">
              <CheckCircle2 size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-emerald-600">{kpis.approved}</div>
          <div className="stat-kpi-footnote">
            <span className="status-dot green" />
            <span>Authorized for campus gate exit</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Rejected / Cancelled</span>
            <div className="stat-kpi-icon-wrap red">
              <XCircle size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-rose-600">{kpis.rejected + kpis.cancelled}</div>
          <div className="stat-kpi-footnote">
            <span>{kpis.rejected} rejected • {kpis.cancelled} cancelled</span>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="enterprise-card">
        <div className="card-topbar">
          <div className="card-title-group">
            <div className="card-title-icon-wrap">
              <FileText size={16} />
            </div>
            <h2 className="card-title-text">Leave & Outpass Registry</h2>
          </div>
          <span className="badge-enterprise badge-emerald">
            {filteredLeaves.length} of {leaveRequests.length} Applications Showing
          </span>
        </div>

        {/* Filter Toolbar */}
        <div className="enterprise-filter-bar">
          <div className="filter-search-field">
            <Search size={14} className="filter-search-icon" />
            <input
              type="text"
              className="filter-search-input"
              placeholder="Search by student name, registration number, reason, destination..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <select
              className="filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Decision Statuses</option>
              <option value="PENDING">PENDING</option>
              <option value="APPROVED">APPROVED</option>
              <option value="REJECTED">REJECTED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>

            <select
              className="filter-select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="ALL">All Leave Types</option>
              <option value="DAY_LEAVE">DAY LEAVE</option>
              <option value="OVERNIGHT">OVERNIGHT</option>
              <option value="WEEKEND">WEEKEND</option>
              <option value="EMERGENCY">EMERGENCY</option>
              <option value="MEDICAL">MEDICAL</option>
              <option value="OTHER">OTHER</option>
            </select>
          </div>
        </div>

        {/* Leave Requests Table */}
        <div className="enterprise-table-container">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th>Applicant Resident</th>
                <th>Leave Type</th>
                <th>Leave Period</th>
                <th>Destination & Reason</th>
                <th>Emergency Contact</th>
                <th>Decision Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '48px 0' }}>
                    <LoadingState message="Loading leave applications from institutional database..." />
                  </td>
                </tr>
              ) : filteredLeaves.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '48px 0' }}>
                    <EmptyState
                      icon={FileText}
                      title="No leave applications found"
                      description={
                        searchTerm || statusFilter !== 'ALL' || typeFilter !== 'ALL'
                          ? 'Try adjusting your search criteria or status filter.'
                          : 'No leave applications have been submitted by students yet.'
                      }
                      actionLabel={canManageRequests ? 'New Leave Application' : undefined}
                      onAction={canManageRequests ? handleOpenCreateModal : undefined}
                    />
                  </td>
                </tr>
              ) : (
                filteredLeaves.map((leave) => {
                  const student = studentMap.get(leave.student_id);
                  const studentName = student
                    ? `${student.first_name || ''} ${student.last_name || ''}`.trim()
                    : 'Resident Student';
                  const regNo =
                    student?.registration_number ||
                    student?.admission_number ||
                    (leave.student_id ? leave.student_id.slice(0, 8) + '...' : 'N/A');

                  const fromDate = leave.from_date
                    ? new Date(leave.from_date).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })
                    : '—';
                  const toDate = leave.to_date
                    ? new Date(leave.to_date).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : '—';

                  const isPending = leave.status === 'PENDING';
                  const canCancel = ['PENDING', 'APPROVED'].includes(leave.status);

                  return (
                    <tr key={leave.id} className="enterprise-table-row">
                      {/* Resident Student */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              background: '#f1f5f9',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#475569',
                              fontWeight: 600,
                              fontSize: '13px',
                              flexShrink: 0,
                            }}
                          >
                            <GraduationCap size={16} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '13.5px' }}>
                              {studentName}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>
                              Reg: <code style={{ fontSize: '11.5px' }}>{regNo}</code>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Leave Type */}
                      <td>{renderTypeBadge(leave.leave_type)}</td>

                      {/* Leave Period */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Calendar size={13} style={{ color: '#64748b' }} />
                          <span style={{ fontWeight: 500, fontSize: '13px' }}>
                            {fromDate} &rarr; {toDate}
                          </span>
                        </div>
                      </td>

                      {/* Destination & Reason */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={12} style={{ color: '#64748b' }} />
                          <span
                            style={{
                              fontWeight: 600,
                              color: '#1e293b',
                              fontSize: '13px',
                              maxWidth: '150px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {leave.destination || 'Home Address'}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: '12px',
                            color: '#64748b',
                            maxWidth: '180px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {leave.reason || 'Personal visit'}
                        </div>
                      </td>

                      {/* Contact Phone */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Phone size={12} style={{ color: '#64748b' }} />
                          <span style={{ fontSize: '12.5px', color: '#334155' }}>
                            {leave.contact_phone || student?.phone || 'Not provided'}
                          </span>
                        </div>
                      </td>

                      {/* Decision Status */}
                      <td>{renderStatusBadge(leave.status)}</td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <div
                          style={{
                            display: 'flex',
                            gap: '6px',
                            justifyContent: 'flex-end',
                            alignItems: 'center',
                          }}
                        >
                          <button
                            type="button"
                            className="table-icon-btn"
                            title="View Full Application Dossier"
                            onClick={() => {
                              setSelectedLeave(leave);
                              setDetailsDrawerOpen(true);
                            }}
                          >
                            <Eye size={14} />
                          </button>

                          {canManageRequests && isPending && (
                            <>
                              <button
                                type="button"
                                className="table-icon-btn text-emerald-600 hover:bg-emerald-50"
                                title="Approve Leave Application"
                                onClick={() => handleOpenDecisionModal(leave, 'APPROVED')}
                              >
                                <Check size={14} />
                              </button>
                              <button
                                type="button"
                                className="table-icon-btn text-rose-600 hover:bg-rose-50"
                                title="Reject Leave Application"
                                onClick={() => handleOpenDecisionModal(leave, 'REJECTED')}
                              >
                                <X size={14} />
                              </button>
                            </>
                          )}

                          {canManageRequests && canCancel && (
                            <button
                              type="button"
                              className="table-icon-btn text-slate-500 hover:bg-slate-100"
                              title="Cancel Application"
                              onClick={() => handleOpenCancelModal(leave)}
                            >
                              <XCircle size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =================================================================== */}
      {/* MODAL 1: Create Leave Application                                   */}
      {/* =================================================================== */}
      {createModalOpen && (
        <Modal
          isOpen={createModalOpen}
          onClose={() => !formSubmitting && setCreateModalOpen(false)}
          title="New Student Leave Application"
          size="md"
        >
          <form onSubmit={handleCreateLeaveSubmit}>
            {formError && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  fontSize: '13px',
                }}
              >
                {formError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <FormField label="Select Applicant Resident" required>
                <select
                  className="filter-select"
                  style={{ width: '100%', height: '38px' }}
                  value={createFormData.student_id}
                  onChange={(e) =>
                    setCreateFormData((prev) => ({ ...prev, student_id: e.target.value }))
                  }
                  required
                >
                  <option value="">-- Choose Resident Student --</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.first_name} {s.last_name} (
                      {s.registration_number || s.admission_number || s.id.slice(0, 8)})
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Leave Type Category" required>
                <select
                  className="filter-select"
                  style={{ width: '100%', height: '38px' }}
                  value={createFormData.leave_type}
                  onChange={(e) =>
                    setCreateFormData((prev) => ({ ...prev, leave_type: e.target.value }))
                  }
                  required
                >
                  <option value="DAY_LEAVE">DAY LEAVE (Local Outpass, Return Same Day)</option>
                  <option value="OVERNIGHT">OVERNIGHT (Night Out with Guardian Approval)</option>
                  <option value="WEEKEND">WEEKEND (Home Visit / Holiday)</option>
                  <option value="EMERGENCY">EMERGENCY (Family / Urgent Matter)</option>
                  <option value="MEDICAL">MEDICAL (Hospitalization / Recovery)</option>
                  <option value="OTHER">OTHER (Academic Conference / Event)</option>
                </select>
              </FormField>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <FormField label="Departure Date" required>
                  <input
                    type="date"
                    className="filter-select"
                    style={{ width: '100%', height: '38px' }}
                    value={createFormData.from_date}
                    onChange={(e) =>
                      setCreateFormData((prev) => ({ ...prev, from_date: e.target.value }))
                    }
                    required
                  />
                </FormField>

                <FormField label="Expected Return Date" required>
                  <input
                    type="date"
                    className="filter-select"
                    style={{ width: '100%', height: '38px' }}
                    value={createFormData.to_date}
                    onChange={(e) =>
                      setCreateFormData((prev) => ({ ...prev, to_date: e.target.value }))
                    }
                    required
                  />
                </FormField>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <FormField label="Destination / Travel Address">
                  <input
                    type="text"
                    className="filter-search-input"
                    style={{ width: '100%', height: '38px' }}
                    placeholder="e.g. Hometown / Parents Residence"
                    value={createFormData.destination}
                    onChange={(e) =>
                      setCreateFormData((prev) => ({ ...prev, destination: e.target.value }))
                    }
                  />
                </FormField>

                <FormField label="Emergency Contact Phone">
                  <input
                    type="tel"
                    className="filter-search-input"
                    style={{ width: '100%', height: '38px' }}
                    placeholder="e.g. +91 98765 43210"
                    value={createFormData.contact_phone}
                    onChange={(e) =>
                      setCreateFormData((prev) => ({ ...prev, contact_phone: e.target.value }))
                    }
                  />
                </FormField>
              </div>

              <FormField label="Application Reason & Explanation" required>
                <textarea
                  className="filter-search-input"
                  style={{ width: '100%', minHeight: '80px', padding: '8px 12px' }}
                  placeholder="Explain the purpose of this leave request..."
                  value={createFormData.reason}
                  onChange={(e) =>
                    setCreateFormData((prev) => ({ ...prev, reason: e.target.value }))
                  }
                  required
                />
              </FormField>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                marginTop: '24px',
                paddingTop: '16px',
                borderTop: '1px solid #f1f5f9',
              }}
            >
              <button
                type="button"
                className="action-btn-secondary"
                onClick={() => setCreateModalOpen(false)}
                disabled={formSubmitting}
              >
                Cancel
              </button>
              <button type="submit" className="action-btn-primary" disabled={formSubmitting}>
                {formSubmitting ? 'Submitting Application...' : 'Submit Application'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* MODAL 2: Process Decision (Approve / Reject)                         */}
      {/* =================================================================== */}
      {decisionModalOpen && selectedLeave && (
        <Modal
          isOpen={decisionModalOpen}
          onClose={() => !formSubmitting && setDecisionModalOpen(false)}
          title={
            pendingDecisionType === 'APPROVED'
              ? 'Approve Leave Application'
              : 'Reject Leave Application'
          }
          size="md"
        >
          <form onSubmit={handleDecisionSubmit}>
            {formError && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  fontSize: '13px',
                }}
              >
                {formError}
              </div>
            )}

            <div
              style={{
                background: pendingDecisionType === 'APPROVED' ? '#ecfdf5' : '#fef2f2',
                border: `1px solid ${pendingDecisionType === 'APPROVED' ? '#a7f3d0' : '#fecaca'}`,
                borderRadius: '8px',
                padding: '14px 16px',
                marginBottom: '16px',
                fontSize: '13px',
              }}
            >
              <div style={{ fontWeight: 600, color: '#0f172a' }}>
                Application #{selectedLeave.id.slice(0, 8)} for{' '}
                {studentMap.get(selectedLeave.student_id)?.first_name || 'Resident'}{' '}
                {studentMap.get(selectedLeave.student_id)?.last_name || ''}
              </div>
              <div style={{ color: '#475569', marginTop: '4px' }}>
                Type: <strong>{selectedLeave.leave_type}</strong> • Duration:{' '}
                {new Date(selectedLeave.from_date).toLocaleDateString()} &rarr;{' '}
                {new Date(selectedLeave.to_date).toLocaleDateString()}
              </div>
              <div style={{ color: '#64748b', marginTop: '4px' }}>
                Reason: {selectedLeave.reason}
              </div>
            </div>

            <FormField
              label="Decision Remarks / Endorsement"
              helperText="This note will be permanently logged in the audit record and visible to student and security."
            >
              <textarea
                className="filter-search-input"
                style={{ width: '100%', minHeight: '80px', padding: '8px 12px' }}
                placeholder="Enter remarks regarding this decision..."
                value={decisionRemarks}
                onChange={(e) => setDecisionRemarks(e.target.value)}
              />
            </FormField>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                marginTop: '24px',
                paddingTop: '16px',
                borderTop: '1px solid #f1f5f9',
              }}
            >
              <button
                type="button"
                className="action-btn-secondary"
                onClick={() => setDecisionModalOpen(false)}
                disabled={formSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={
                  pendingDecisionType === 'APPROVED' ? 'action-btn-primary' : 'action-btn-danger'
                }
                style={
                  pendingDecisionType === 'REJECTED'
                    ? { background: '#dc2626', color: '#ffffff', borderColor: '#dc2626' }
                    : {}
                }
                disabled={formSubmitting}
              >
                {formSubmitting
                  ? 'Processing Decision...'
                  : pendingDecisionType === 'APPROVED'
                  ? 'Confirm Approval'
                  : 'Confirm Rejection'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* MODAL 3: Cancel Leave Confirmation                                 */}
      {/* =================================================================== */}
      {cancelModalOpen && selectedLeave && (
        <ConfirmationDialog
          isOpen={cancelModalOpen}
          onClose={() => setCancelModalOpen(false)}
          onConfirm={handleCancelSubmit}
          title="Cancel Leave Application"
          message={`Are you sure you want to cancel the leave application for ${
            studentMap.get(selectedLeave.student_id)?.first_name || 'Resident'
          }? This action revokes campus gate departure authorization.`}
          confirmLabel="Cancel Application"
          isDanger
          loading={formSubmitting}
        />
      )}

      {/* =================================================================== */}
      {/* DRAWER: Leave Dossier                                               */}
      {/* =================================================================== */}
      {detailsDrawerOpen && selectedLeave && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            justifyContent: 'flex-end',
            background: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(2px)',
          }}
          onClick={() => setDetailsDrawerOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              height: '100%',
              background: '#ffffff',
              boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.15)',
              padding: '28px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: '16px',
                borderBottom: '1px solid #f1f5f9',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={20} style={{ color: '#2563eb' }} />
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 600, color: '#0f172a' }}>
                  Leave Request Dossier
                </h3>
              </div>
              <button
                type="button"
                className="table-icon-btn"
                onClick={() => setDetailsDrawerOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            {/* Resident Card */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '16px',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Applicant Profile
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                {studentMap.get(selectedLeave.student_id)?.first_name || 'Resident'}{' '}
                {studentMap.get(selectedLeave.student_id)?.last_name || ''}
              </div>
              <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px' }}>
                Registration Number:{' '}
                <code style={{ color: '#0f172a' }}>
                  {studentMap.get(selectedLeave.student_id)?.registration_number ||
                    studentMap.get(selectedLeave.student_id)?.admission_number ||
                    'N/A'}
                </code>
              </div>
              <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px' }}>
                Email: {studentMap.get(selectedLeave.student_id)?.email || 'N/A'}
              </div>
            </div>

            {/* Status Breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                <span style={{ fontSize: '13px', color: '#64748b' }}>Current Status</span>
                <div>{renderStatusBadge(selectedLeave.status)}</div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                <span style={{ fontSize: '13px', color: '#64748b' }}>Leave Category</span>
                <div>{renderTypeBadge(selectedLeave.leave_type)}</div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                <span style={{ fontSize: '13px', color: '#64748b' }}>Effective Dates</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                  {new Date(selectedLeave.from_date).toLocaleDateString()} &rarr;{' '}
                  {new Date(selectedLeave.to_date).toLocaleDateString()}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                <span style={{ fontSize: '13px', color: '#64748b' }}>Travel Destination</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                  {selectedLeave.destination || 'Home Address'}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                <span style={{ fontSize: '13px', color: '#64748b' }}>Emergency Phone</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                  {selectedLeave.contact_phone || 'None provided'}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                <span style={{ fontSize: '13px', color: '#64748b' }}>Application Submitted</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                  {selectedLeave.requested_at
                    ? new Date(selectedLeave.requested_at).toLocaleString()
                    : 'N/A'}
                </span>
              </div>
            </div>

            {/* Reason Section */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                Application Reason
              </div>
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '12px',
                  fontSize: '13px',
                  color: '#334155',
                  lineHeight: 1.5,
                }}
              >
                {selectedLeave.reason || 'No specific explanation provided.'}
              </div>
            </div>

            {/* Actions inside drawer */}
            <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
              {canManageRequests && selectedLeave.status === 'PENDING' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    type="button"
                    className="action-btn-primary"
                    style={{ justifyContent: 'center' }}
                    onClick={() => {
                      setDetailsDrawerOpen(false);
                      handleOpenDecisionModal(selectedLeave, 'APPROVED');
                    }}
                  >
                    <Check size={15} />
                    <span>Approve Outpass</span>
                  </button>
                  <button
                    type="button"
                    className="action-btn-secondary text-rose-600"
                    style={{ justifyContent: 'center', borderColor: '#fecaca' }}
                    onClick={() => {
                      setDetailsDrawerOpen(false);
                      handleOpenDecisionModal(selectedLeave, 'REJECTED');
                    }}
                  >
                    <X size={15} />
                    <span>Reject Outpass</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
