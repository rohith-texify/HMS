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
  LayoutGrid,
  List,
  Download,
  Printer,
  QrCode,
  Building2,
  AlertCircle,
  FileCheck,
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
import { exportToCSV } from '../../../shared/utils/exportUtils';

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

  // View & Display Mode: CARDS (visual grid) or TABLE (tabular list)
  const [displayMode, setDisplayMode] = useState('CARDS');

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Modals Visibility
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  const [passVoucherModalOpen, setPassVoucherModalOpen] = useState(false);

  // Active Selected Request
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [voucherLeave, setVoucherLeave] = useState(null);
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
      const decided = approved + rejected;
      const approvalRate = decided > 0 ? ((approved / decided) * 100).toFixed(1) : '100.0';
      return { total, pending, approved, rejected, cancelled, approvalRate };
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

    const decided = approved + rejected;
    const approvalRate = decided > 0 ? ((approved / decided) * 100).toFixed(1) : '100.0';
    return { total, pending, approved, rejected, cancelled, approvalRate };
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
      const phone = leave.contact_phone || student?.phone || '';
      const term = searchTerm.toLowerCase().trim();

      const matchesSearch =
        !term ||
        studentName.toLowerCase().includes(term) ||
        regNo.toLowerCase().includes(term) ||
        reason.toLowerCase().includes(term) ||
        dest.toLowerCase().includes(term) ||
        phone.toLowerCase().includes(term) ||
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

  // Quick Preset Tabs
  const statusPresets = [
    { id: 'ALL', label: 'All Applications', count: leaveRequests.length, chipClass: '' },
    { id: 'PENDING', label: 'Pending Review', count: kpis.pending, chipClass: 'chip-amber' },
    { id: 'APPROVED', label: 'Approved Clearances', count: kpis.approved, chipClass: 'chip-emerald' },
    { id: 'REJECTED', label: 'Rejected', count: kpis.rejected, chipClass: 'chip-rose' },
    { id: 'CANCELLED', label: 'Cancelled', count: kpis.cancelled, chipClass: 'chip-slate' },
  ];

  const typePresets = [
    { id: 'ALL', label: 'All Types' },
    { id: 'WEEKEND', label: 'Weekend' },
    { id: 'DAY_LEAVE', label: 'Day Outpass' },
    { id: 'OVERNIGHT', label: 'Overnight' },
    { id: 'EMERGENCY', label: 'Emergency' },
    { id: 'MEDICAL', label: 'Medical' },
  ];

  // =========================================================================
  // Workflow: Export to CSV
  // =========================================================================
  const handleExportCSV = () => {
    if (filteredLeaves.length === 0) return;
    const columns = [
      {
        key: 'student',
        title: 'Applicant Resident',
        format: (_, leave) => {
          const student = studentMap.get(leave.student_id);
          return student ? `${student.first_name || ''} ${student.last_name || ''}`.trim() : leave.student_id;
        },
      },
      {
        key: 'reg_no',
        title: 'Registration / Admission No',
        format: (_, leave) => {
          const student = studentMap.get(leave.student_id);
          return student?.registration_number || student?.admission_number || 'N/A';
        },
      },
      {
        key: 'leave_type',
        title: 'Leave Type',
        format: (val) => String(val || '').replace('_', ' '),
      },
      {
        key: 'from_date',
        title: 'Departure Date',
        format: (val) => (val ? new Date(val).toISOString().split('T')[0] : 'N/A'),
      },
      {
        key: 'to_date',
        title: 'Expected Return Date',
        format: (val) => (val ? new Date(val).toISOString().split('T')[0] : 'N/A'),
      },
      {
        key: 'destination',
        title: 'Destination',
        format: (val) => val || 'Home Address',
      },
      {
        key: 'contact_phone',
        title: 'Emergency Contact',
        format: (val, leave) => val || studentMap.get(leave.student_id)?.phone || 'N/A',
      },
      {
        key: 'status',
        title: 'Decision Status',
        format: (val) => String(val || '').toUpperCase(),
      },
      {
        key: 'reason',
        title: 'Application Reason',
        format: (val) => val || '',
      },
      {
        key: 'requested_at',
        title: 'Applied On',
        format: (val) => (val ? new Date(val).toLocaleString() : 'N/A'),
      },
    ];
    exportToCSV('HMS_Leave_Applications_Ledger', columns, filteredLeaves);
  };

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

  // =========================================================================
  // Workflow: Digital Pass Voucher
  // =========================================================================
  const handleOpenVoucher = (leave) => {
    setVoucherLeave(leave);
    setPassVoucherModalOpen(true);
  };

  // Helper status badge
  const renderStatusBadge = (status) => {
    const st = String(status || '').toUpperCase();
    if (st === 'APPROVED') {
      return (
        <span className="badge-enterprise badge-emerald">
          <span className="live-pulse" />
          APPROVED
        </span>
      );
    } else if (st === 'PENDING') {
      return (
        <span className="badge-enterprise badge-amber">
          <span className="live-pulse" />
          PENDING
        </span>
      );
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
    <div className="fade-in-up">
      {/* 1. Modern Enterprise Hero Header */}
      <div className="enterprise-hero-header">
        <div className="hero-header-titles">
          <div className="hero-category-pill">
            <Plane size={13} />
            <span>Operations &amp; Movement</span>
          </div>
          <h1 className="hero-main-title">Student Leave Applications</h1>
          <p className="hero-subtitle">
            Outpass processing, weekend permissions, overnight leaves, guardian verifications, and gate departure authorization.
          </p>
        </div>

        <div className="hero-action-buttons">
          <button
            type="button"
            className="btn-enterprise-secondary"
            onClick={() => loadLeavesData(true)}
            disabled={isRefreshing || loading}
            title="Refresh Leaves Data"
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync Applications'}</span>
          </button>

          <button
            type="button"
            className="btn-enterprise-secondary"
            onClick={handleExportCSV}
            disabled={filteredLeaves.length === 0}
            title="Export filtered applications to RFC 4180 CSV"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>

          {canManageRequests && (
            <button
              type="button"
              className="btn-enterprise-primary"
              onClick={handleOpenCreateModal}
              disabled={loading}
              title="Submit New Leave Application"
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

      {/* 2. Executive KPI Cards */}
      <div className="kpi-cards-grid" style={{ marginBottom: '20px' }}>
        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-title">Total Applications</span>
            <div className="stat-kpi-icon-box" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
              <FileText size={18} />
            </div>
          </div>
          <div className="stat-kpi-value">{kpis.total}</div>
          <div className="stat-kpi-subtext">All student outpass submissions</div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-title">Pending Decision</span>
            <div className="stat-kpi-icon-box" style={{ backgroundColor: '#fffbeb', color: '#d97706' }}>
              <Clock size={18} />
            </div>
          </div>
          <div className="stat-kpi-value" style={{ color: '#d97706' }}>
            {kpis.pending}
          </div>
          <div className="stat-kpi-subtext" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Awaiting warden or admin review</span>
            {kpis.pending > 0 && (
              <span className="curfew-risk-tag" style={{ color: '#d97706', background: '#fffbeb', borderColor: '#fef3c7' }}>
                <Clock size={11} />
                Action Needed
              </span>
            )}
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-title">Approved Clearances</span>
            <div className="stat-kpi-icon-box" style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="stat-kpi-value" style={{ color: '#16a34a' }}>
            {kpis.approved}
          </div>
          <div className="stat-kpi-subtext">
            <span className="live-pulse" style={{ display: 'inline-block', marginRight: '5px' }} />
            <strong>{kpis.approvalRate}%</strong> clearance endorsement rate
          </div>
          <div className="leave-progress-container" title={`${kpis.approvalRate}% Endorsement Rate`}>
            <div
              className="leave-progress-fill"
              style={{ width: `${Math.min(100, Math.max(0, parseFloat(kpis.approvalRate) || 0))}%` }}
            />
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-title">Rejected / Cancelled</span>
            <div className="stat-kpi-icon-box" style={{ backgroundColor: '#fff1f2', color: '#e11d48' }}>
              <XCircle size={18} />
            </div>
          </div>
          <div className="stat-kpi-value" style={{ color: '#e11d48' }}>
            {kpis.rejected + kpis.cancelled}
          </div>
          <div className="stat-kpi-subtext">
            {kpis.rejected} rejected • {kpis.cancelled} cancelled
          </div>
        </div>
      </div>

      {/* 3. Quick Status & Leave Type Filter Strip */}
      <div className="leave-quick-filter-strip">
        <span className="leave-filter-label">
          <Filter size={12} />
          <span>Status:</span>
        </span>
        {statusPresets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`leave-filter-chip ${preset.chipClass} ${statusFilter === preset.id ? 'active' : ''}`}
            onClick={() => setStatusFilter(preset.id)}
          >
            <span>{preset.label}</span>
            <span className="leave-chip-count">{preset.count}</span>
          </button>
        ))}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span className="leave-filter-label">
            <Plane size={12} />
            <span>Category:</span>
          </span>
          {typePresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`leave-filter-chip ${typeFilter === preset.id ? 'active' : ''}`}
              onClick={() => setTypeFilter(preset.id)}
            >
              <span>{preset.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 4. Search and Filters Toolbar */}
      <FilterControls
        totalRecords={filteredLeaves.length}
        onReset={() => {
          setSearchTerm('');
          setStatusFilter('ALL');
          setTypeFilter('ALL');
        }}
      >
        <SearchInput
          placeholder="Search by student, reg #, reason, destination..."
          value={searchTerm}
          onChange={setSearchTerm}
          width={320}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status:</span>
          <select
            className="filter-search-input"
            style={{ width: 'auto', padding: '6px 12px' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Decision Statuses</option>
            <option value="PENDING">PENDING</option>
            <option value="APPROVED">APPROVED</option>
            <option value="REJECTED">REJECTED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Type:</span>
          <select
            className="filter-search-input"
            style={{ width: 'auto', padding: '6px 12px' }}
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

        {/* View Switcher: Cards vs Table */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="view-mode-toggle">
            <button
              type="button"
              className={`view-mode-btn ${displayMode === 'CARDS' ? 'active' : ''}`}
              onClick={() => setDisplayMode('CARDS')}
              title="Card Grid View"
            >
              <LayoutGrid size={13} />
              <span>Cards</span>
            </button>
            <button
              type="button"
              className={`view-mode-btn ${displayMode === 'TABLE' ? 'active' : ''}`}
              onClick={() => setDisplayMode('TABLE')}
              title="Table View"
            >
              <List size={13} />
              <span>Table</span>
            </button>
          </div>
        </div>
      </FilterControls>

      {/* 5. Enterprise Card Container */}
      <div className="enterprise-card" style={{ marginTop: '16px' }}>
        <div className="card-topbar">
          <div className="card-title-group">
            <div className="card-title-icon-wrap" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
              <FileText size={16} />
            </div>
            <div>
              <h2 className="card-title-text">Leave & Outpass Registry</h2>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Showing {filteredLeaves.length} of {leaveRequests.length} leave applications
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {kpis.pending > 0 && (
              <span className="badge-enterprise badge-amber">
                <span className="live-pulse" />
                {kpis.pending} Pending Review
              </span>
            )}
            <span className="badge-enterprise badge-emerald">
              {kpis.approved} Approved
            </span>
            {kpis.rejected > 0 && (
              <span className="badge-enterprise badge-rose">
                {kpis.rejected} Rejected
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '40px' }}>
            <LoadingState message="Loading leave applications from institutional database..." />
          </div>
        ) : filteredLeaves.length === 0 ? (
          <div style={{ padding: '40px' }}>
            <EmptyState
              title="No leave applications found"
              message={
                searchTerm || statusFilter !== 'ALL' || typeFilter !== 'ALL'
                  ? 'Try adjusting your search criteria or status filter.'
                  : 'No leave applications have been submitted by students yet.'
              }
            />
          </div>
        ) : displayMode === 'CARDS' ? (
          <div style={{ padding: '20px' }}>
            <div className="leaves-grid-cards">
              {filteredLeaves.map((leave) => {
                const student = studentMap.get(leave.student_id);
                const studentName = student
                  ? `${student.first_name || ''} ${student.last_name || ''}`.trim()
                  : 'Resident Student';
                const initials = student
                  ? `${student.first_name?.[0] || 'S'}${student.last_name?.[0] || ''}`.toUpperCase()
                  : 'ST';
                const regNo =
                  student?.registration_number ||
                  student?.admission_number ||
                  (leave.student_id ? leave.student_id.slice(0, 8) : 'N/A');

                const fromDate = leave.from_date
                  ? new Date(leave.from_date).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })
                  : 'N/A';
                const toDate = leave.to_date
                  ? new Date(leave.to_date).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : 'N/A';

                const isPending = leave.status === 'PENDING';
                const isApproved = leave.status === 'APPROVED';
                const canCancel = ['PENDING', 'APPROVED'].includes(leave.status);
                const st = String(leave.status || 'PENDING').toLowerCase();
                const stClass =
                  st === 'approved'
                    ? 'approved'
                    : st === 'pending'
                    ? 'pending'
                    : st === 'rejected'
                    ? 'rejected'
                    : 'cancelled';

                return (
                  <div key={leave.id} className={`leave-card-v2 ${stClass}`}>
                    {/* Card Top: Avatar, Name, Status Badge */}
                    <div className="leave-card-top">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                        <div className={`leave-avatar-box ${stClass}`}>
                          {initials}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <h3 className="leave-name-title" title={studentName}>
                            {studentName}
                          </h3>
                          <div className="leave-adm-sub">
                            <span className="code-pill" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                              Reg: {regNo}
                            </span>
                            {renderTypeBadge(leave.leave_type)}
                          </div>
                        </div>
                      </div>

                      {renderStatusBadge(leave.status)}
                    </div>

                    {/* Card Body: Info stack with Dates, Destination, Reason, Phone */}
                    <div className="leave-card-body">
                      <div className="leave-info-stack">
                        <div className="leave-info-row" title={`${fromDate} to ${toDate}`}>
                          <Calendar size={13} style={{ color: '#6366f1', flexShrink: 0 }} />
                          <span style={{ fontWeight: 600 }}>{fromDate} &rarr; {toDate}</span>
                        </div>
                        <div className="leave-info-row" title={leave.destination || 'Home Address'}>
                          <MapPin size={13} style={{ color: '#f59e0b', flexShrink: 0 }} />
                          <span>Destination: <strong>{leave.destination || 'Home Address'}</strong></span>
                        </div>
                        <div className="leave-info-row" title={leave.reason || 'Personal visit'}>
                          <FileText size={13} style={{ color: '#94a3b8', flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{leave.reason || 'Personal visit'}</span>
                        </div>
                        {(leave.contact_phone || student?.phone) && (
                          <div className="leave-info-row">
                            <Phone size={13} style={{ color: '#10b981', flexShrink: 0 }} />
                            <span>Contact: {leave.contact_phone || student?.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Footer: Action Buttons */}
                    <div className="leave-card-footer">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn-enterprise-secondary"
                          style={{ padding: '6px 10px', fontSize: '0.76rem', gap: '5px' }}
                          onClick={() => {
                            setSelectedLeave(leave);
                            setDetailsDrawerOpen(true);
                          }}
                          title="View Full Application Dossier"
                        >
                          <Eye size={13} />
                          <span>Dossier</span>
                        </button>

                        {isApproved && (
                          <button
                            type="button"
                            className="btn-enterprise-secondary"
                            style={{ padding: '6px 10px', fontSize: '0.76rem', gap: '5px', color: '#059669', borderColor: '#a7f3d0' }}
                            onClick={() => handleOpenVoucher(leave)}
                            title="Generate Official Gate Outpass Voucher"
                          >
                            <QrCode size={13} />
                            <span>Outpass Pass</span>
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {canManageRequests && isPending && (
                          <>
                            <button
                              type="button"
                              className="btn-enterprise-secondary"
                              style={{ padding: '6px 9px', color: '#16a34a', gap: '4px', borderColor: '#bbf7d0', background: '#f0fdf4' }}
                              onClick={() => handleOpenDecisionModal(leave, 'APPROVED')}
                              title="Approve Leave Application"
                            >
                              <Check size={13} />
                              <span style={{ fontSize: '0.74rem', fontWeight: 600 }}>Approve</span>
                            </button>
                            <button
                              type="button"
                              className="btn-enterprise-secondary"
                              style={{ padding: '6px 9px', color: '#dc2626', gap: '4px', borderColor: '#fecaca', background: '#fef2f2' }}
                              onClick={() => handleOpenDecisionModal(leave, 'REJECTED')}
                              title="Reject Leave Application"
                            >
                              <X size={13} />
                              <span style={{ fontSize: '0.74rem', fontWeight: 600 }}>Reject</span>
                            </button>
                          </>
                        )}

                        {canManageRequests && canCancel && !isPending && (
                          <button
                            type="button"
                            className="btn-enterprise-secondary"
                            style={{ padding: '6px 8px', color: '#64748b' }}
                            onClick={() => handleOpenCancelModal(leave)}
                            title="Cancel Application"
                          >
                            <XCircle size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
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
                {filteredLeaves.map((leave) => {
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
                    : 'N/A';
                  const toDate = leave.to_date
                    ? new Date(leave.to_date).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'N/A';

                  const isPending = leave.status === 'PENDING';
                  const isApproved = leave.status === 'APPROVED';
                  const canCancel = ['PENDING', 'APPROVED'].includes(leave.status);

                  return (
                    <tr key={leave.id} className="enterprise-table-row">
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '34px',
                              height: '34px',
                              borderRadius: '8px',
                              background: '#eff6ff',
                              color: '#2563eb',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.78rem',
                              flexShrink: 0,
                            }}
                          >
                            {student ? (student.first_name?.[0] || 'S').toUpperCase() : 'S'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.86rem' }}>
                              {studentName}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              Reg: {regNo}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>{renderTypeBadge(leave.leave_type)}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                          <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                            {fromDate} &rarr; {toDate}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={12} style={{ color: '#f59e0b', flexShrink: 0 }} />
                          <span
                            style={{
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              fontSize: '0.82rem',
                              maxWidth: '160px',
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
                            fontSize: '0.74rem',
                            color: 'var(--text-muted)',
                            maxWidth: '180px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {leave.reason || 'Personal visit'}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Phone size={12} style={{ color: '#10b981', flexShrink: 0 }} />
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {leave.contact_phone || student?.phone || 'Not provided'}
                          </span>
                        </div>
                      </td>
                      <td>{renderStatusBadge(leave.status)}</td>
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
                            className="btn-enterprise-secondary"
                            style={{ padding: '5px 9px', fontSize: '0.76rem', gap: '4px' }}
                            title="View Full Application Dossier"
                            onClick={() => {
                              setSelectedLeave(leave);
                              setDetailsDrawerOpen(true);
                            }}
                          >
                            <Eye size={13} />
                            <span>Dossier</span>
                          </button>

                          {isApproved && (
                            <button
                              type="button"
                              className="btn-enterprise-secondary"
                              style={{ padding: '5px 9px', fontSize: '0.76rem', gap: '4px', color: '#059669', borderColor: '#a7f3d0' }}
                              title="Print / View Outpass Gate Voucher"
                              onClick={() => handleOpenVoucher(leave)}
                            >
                              <QrCode size={13} />
                              <span>Pass</span>
                            </button>
                          )}

                          {canManageRequests && isPending && (
                            <>
                              <button
                                type="button"
                                className="btn-enterprise-secondary"
                                style={{ padding: '5px 9px', fontSize: '0.76rem', color: '#16a34a', borderColor: '#bbf7d0', background: '#f0fdf4', gap: '4px' }}
                                title="Approve Leave Application"
                                onClick={() => handleOpenDecisionModal(leave, 'APPROVED')}
                              >
                                <Check size={13} />
                                <span>Approve</span>
                              </button>
                              <button
                                type="button"
                                className="btn-enterprise-secondary"
                                style={{ padding: '5px 9px', fontSize: '0.76rem', color: '#dc2626', borderColor: '#fecaca', background: '#fef2f2', gap: '4px' }}
                                title="Reject Leave Application"
                                onClick={() => handleOpenDecisionModal(leave, 'REJECTED')}
                              >
                                <X size={13} />
                                <span>Reject</span>
                              </button>
                            </>
                          )}

                          {canManageRequests && canCancel && !isPending && (
                            <button
                              type="button"
                              className="btn-enterprise-secondary"
                              style={{ padding: '5px 8px', fontSize: '0.76rem', color: '#64748b' }}
                              title="Cancel Application"
                              onClick={() => handleOpenCancelModal(leave)}
                            >
                              <XCircle size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
      {/* MODAL 4: Digital Gate Outpass Pass / Voucher                        */}
      {/* =================================================================== */}
      {passVoucherModalOpen && voucherLeave && (
        <Modal
          isOpen={passVoucherModalOpen}
          onClose={() => setPassVoucherModalOpen(false)}
          title="Gate Outpass Clearance Voucher"
          size="md"
        >
          <div className="outpass-voucher-container">
            <div className="outpass-voucher-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: '#eff6ff',
                    color: '#2563eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Plane size={22} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                    Institutional Outpass Voucher
                  </h4>
                  <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                    Voucher UUID: {voucherLeave.id.slice(0, 13)}
                  </span>
                </div>
              </div>
              <span className="badge-enterprise badge-emerald">
                <CheckCircle2 size={13} />
                <span>AUTHORIZED EXIT</span>
              </span>
            </div>

            <div className="outpass-voucher-grid">
              <div className="outpass-voucher-field">
                <div className="outpass-voucher-label">Resident Student</div>
                <div className="outpass-voucher-val">
                  {studentMap.get(voucherLeave.student_id)?.first_name || 'Resident'}{' '}
                  {studentMap.get(voucherLeave.student_id)?.last_name || ''}
                </div>
              </div>

              <div className="outpass-voucher-field">
                <div className="outpass-voucher-label">Admission / Reg No</div>
                <div className="outpass-voucher-val">
                  {studentMap.get(voucherLeave.student_id)?.registration_number ||
                    studentMap.get(voucherLeave.student_id)?.admission_number ||
                    'N/A'}
                </div>
              </div>

              <div className="outpass-voucher-field">
                <div className="outpass-voucher-label">Leave Category</div>
                <div className="outpass-voucher-val">
                  {String(voucherLeave.leave_type || '').replace('_', ' ')}
                </div>
              </div>

              <div className="outpass-voucher-field">
                <div className="outpass-voucher-label">Emergency Phone</div>
                <div className="outpass-voucher-val">
                  {voucherLeave.contact_phone || studentMap.get(voucherLeave.student_id)?.phone || 'N/A'}
                </div>
              </div>

              <div className="outpass-voucher-field" style={{ gridColumn: 'span 2' }}>
                <div className="outpass-voucher-label">Permitted Clearance Period</div>
                <div className="outpass-voucher-val" style={{ color: '#2563eb' }}>
                  {new Date(voucherLeave.from_date).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}{' '}
                  &rarr;{' '}
                  {new Date(voucherLeave.to_date).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </div>
              </div>

              <div className="outpass-voucher-field" style={{ gridColumn: 'span 2' }}>
                <div className="outpass-voucher-label">Destination Address</div>
                <div className="outpass-voucher-val">
                  {voucherLeave.destination || 'Home Address'}
                </div>
              </div>
            </div>

            <div className="outpass-security-stamp">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={20} style={{ color: '#059669' }} />
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#065f46' }}>
                    Security Checkpoint Validated
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#047857' }}>
                    Authorized by College Administration for Main Campus Gates
                  </div>
                </div>
              </div>
              <QrCode size={36} style={{ color: '#059669', opacity: 0.8 }} />
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                marginTop: '20px',
                paddingTop: '16px',
                borderTop: '1px solid #f1f5f9',
              }}
            >
              <button
                type="button"
                className="action-btn-secondary"
                onClick={() => setPassVoucherModalOpen(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="action-btn-primary"
                onClick={() => window.print()}
              >
                <Printer size={15} />
                <span>Print Voucher</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* DRAWER: Leave Dossier                                               */}
      {/* =================================================================== */}
      {detailsDrawerOpen && selectedLeave && (
        <div
          className="leave-drawer-overlay"
          onClick={() => setDetailsDrawerOpen(false)}
        >
          <div
            className="leave-drawer-content"
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: '#eff6ff',
                    color: '#2563eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <FileText size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                    Leave Request Dossier
                  </h3>
                  <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                    Outpass Verification & Audit Trail
                  </span>
                </div>
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
                background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '18px',
              }}
            >
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Applicant Profile
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>
                {studentMap.get(selectedLeave.student_id)?.first_name || 'Resident'}{' '}
                {studentMap.get(selectedLeave.student_id)?.last_name || ''}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <GraduationCap size={14} style={{ color: '#2563eb' }} />
                <span>
                  Registration Number:{' '}
                  <strong>
                    {studentMap.get(selectedLeave.student_id)?.registration_number ||
                      studentMap.get(selectedLeave.student_id)?.admission_number ||
                      'N/A'}
                  </strong>
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                Email: {studentMap.get(selectedLeave.student_id)?.email || 'N/A'}
              </div>
            </div>

            {/* Status Breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 14px',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #f1f5f9',
                }}
              >
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>Current Status</span>
                <div>{renderStatusBadge(selectedLeave.status)}</div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 14px',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #f1f5f9',
                }}
              >
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>Leave Category</span>
                <div>{renderTypeBadge(selectedLeave.leave_type)}</div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 14px',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #f1f5f9',
                }}
              >
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>Effective Dates</span>
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>
                  {new Date(selectedLeave.from_date).toLocaleDateString()} &rarr;{' '}
                  {new Date(selectedLeave.to_date).toLocaleDateString()}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 14px',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #f1f5f9',
                }}
              >
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>Travel Destination</span>
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>
                  {selectedLeave.destination || 'Home Address'}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 14px',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #f1f5f9',
                }}
              >
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>Emergency Phone</span>
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>
                  {selectedLeave.contact_phone || 'None provided'}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 14px',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #f1f5f9',
                }}
              >
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>Application Submitted</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a' }}>
                  {selectedLeave.requested_at
                    ? new Date(selectedLeave.requested_at).toLocaleString()
                    : 'N/A'}
                </span>
              </div>
            </div>

            {/* Reason Section */}
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>
                Application Reason
              </div>
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '14px',
                  fontSize: '0.82rem',
                  color: '#334155',
                  lineHeight: 1.6,
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
                    style={{ justifyContent: 'center', padding: '10px 16px' }}
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
                    style={{ justifyContent: 'center', borderColor: '#fecaca', color: '#dc2626', padding: '10px 16px' }}
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

              {selectedLeave.status === 'APPROVED' && (
                <button
                  type="button"
                  className="action-btn-primary"
                  style={{ width: '100%', justifyContent: 'center', padding: '10px 16px' }}
                  onClick={() => {
                    setDetailsDrawerOpen(false);
                    handleOpenVoucher(selectedLeave);
                  }}
                >
                  <QrCode size={15} />
                  <span>View Official Gate Pass</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
