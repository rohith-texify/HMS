import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../shared/auth/useAuth';
import adminService from '../services/adminService';
import {
  Wrench,
  MessageSquare,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Plus,
  RefreshCw,
  Eye,
  UserCheck,
  Check,
  X,
  ChevronRight,
  Sparkles,
  Building2,
  Users,
  Shield,
  FileText,
  Send,
  GraduationCap,
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

export default function AdminComplaintsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Permission checks
  const canManageComplaints = useMemo(() => {
    if (!user) return true;
    if (['COLLEGE_ADMIN', 'ADMIN', 'HOSTEL_ADMIN'].includes(user?.role)) return true;
    if (Array.isArray(user?.permissions)) {
      return (
        user.permissions.includes('requests.manage') ||
        user.permissions.includes('hostel.manage') ||
        user.permissions.includes('*')
      );
    }
    return true;
  }, [user]);

  // Master Data State
  const [complaints, setComplaints] = useState([]);
  const [complaintSummary, setComplaintSummary] = useState(null);
  const [students, setStudents] = useState([]);
  const [staffList, setStaffList] = useState([]);

  // UI & Loading States
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successBanner, setSuccessBanner] = useState(null);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  // Modals Visibility
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);

  // Selected Complaint State
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [complaintUpdates, setComplaintUpdates] = useState([]);
  const [loadingUpdates, setLoadingUpdates] = useState(false);

  // Form States
  const [createFormData, setCreateFormData] = useState({
    student_id: '',
    category: 'HOSTEL',
    title: '',
    description: '',
    priority: 'NORMAL',
  });

  const [assignFormData, setAssignFormData] = useState({
    assigned_to: '',
    message: '',
  });

  const [statusFormData, setStatusFormData] = useState({
    status: 'IN_PROGRESS',
    message: '',
  });

  const [resolveFormData, setResolveFormData] = useState({
    resolution: '',
  });

  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Quick lookup dictionary for student metadata
  const studentMap = useMemo(() => {
    const map = new Map();
    students.forEach((s) => map.set(s.id, s));
    return map;
  }, [students]);

  // Quick lookup dictionary for staff metadata
  const staffMap = useMemo(() => {
    const map = new Map();
    staffList.forEach((s) => map.set(s.id, s));
    return map;
  }, [staffList]);

  // =========================================================================
  // Master Data Fetching
  // =========================================================================
  const loadComplaintsData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setLoading(true);
    setErrorMessage(null);

    try {
      const [complaintsRes, summaryRes, studentsRes, staffRes] = await Promise.allSettled([
        adminService.getComplaints(),
        adminService.getComplaintSummary(),
        adminService.getStudents(),
        adminService.getStaff(),
      ]);

      if (complaintsRes.status === 'fulfilled') {
        const raw = complaintsRes.value;
        setComplaints(Array.isArray(raw) ? raw : raw?.complaints || raw?.data || []);
      } else {
        console.warn('Failed to load complaints:', complaintsRes.reason);
      }

      if (summaryRes.status === 'fulfilled') {
        const rawSum = summaryRes.value;
        setComplaintSummary(rawSum?.data || rawSum || null);
      }

      if (studentsRes.status === 'fulfilled') {
        const rawS = studentsRes.value;
        setStudents(Array.isArray(rawS) ? rawS : rawS?.students || []);
      }

      if (staffRes.status === 'fulfilled') {
        const rawStaff = staffRes.value;
        setStaffList(Array.isArray(rawStaff) ? rawStaff : rawStaff?.staff || []);
      }
    } catch (err) {
      console.error('Failed to load complaints master data:', err);
      setErrorMessage('Failed to load institutional complaints registry.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadComplaintsData();
  }, [loadComplaintsData]);

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
    const total = complaints.length;
    let openCount = 0;
    let assignedCount = 0;
    let inProgressCount = 0;
    let resolvedCount = 0;
    let closedCount = 0;

    complaints.forEach((c) => {
      const st = String(c.status || '').toUpperCase();
      if (st === 'OPEN') openCount++;
      else if (st === 'ASSIGNED') assignedCount++;
      else if (st === 'IN_PROGRESS') inProgressCount++;
      else if (st === 'RESOLVED') resolvedCount++;
      else if (st === 'CLOSED') closedCount++;
    });

    return {
      total,
      open: openCount,
      assigned: assignedCount,
      inProgress: inProgressCount,
      resolved: resolvedCount,
      closed: closedCount,
    };
  }, [complaints]);

  // =========================================================================
  // Search & Filtering
  // =========================================================================
  const filteredComplaints = useMemo(() => {
    return complaints.filter((comp) => {
      const student = comp.student_id ? studentMap.get(comp.student_id) : null;
      const studentName = student
        ? `${student.first_name || ''} ${student.last_name || ''}`.trim()
        : '';
      const regNo = student?.registration_number || student?.admission_number || '';
      const title = comp.title || '';
      const desc = comp.description || '';
      const compNum = comp.complaint_number || '';
      const term = searchTerm.toLowerCase().trim();

      const matchesSearch =
        !term ||
        title.toLowerCase().includes(term) ||
        desc.toLowerCase().includes(term) ||
        compNum.toLowerCase().includes(term) ||
        studentName.toLowerCase().includes(term) ||
        regNo.toLowerCase().includes(term);

      const matchesStatus =
        statusFilter === 'ALL' ||
        String(comp.status || '').toUpperCase() === statusFilter.toUpperCase();

      const matchesCategory =
        categoryFilter === 'ALL' ||
        String(comp.category || '').toUpperCase() === categoryFilter.toUpperCase();

      const matchesPriority =
        priorityFilter === 'ALL' ||
        String(comp.priority || '').toUpperCase() === priorityFilter.toUpperCase();

      return matchesSearch && matchesStatus && matchesCategory && matchesPriority;
    });
  }, [complaints, studentMap, searchTerm, statusFilter, categoryFilter, priorityFilter]);

  // =========================================================================
  // Workflow: Create Complaint
  // =========================================================================
  const handleOpenCreateModal = () => {
    setCreateFormData({
      student_id: students[0]?.id || '',
      category: 'HOSTEL',
      title: '',
      description: '',
      priority: 'NORMAL',
    });
    setFormError(null);
    setCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createFormData.title.trim() || !createFormData.description.trim()) {
      setFormError('Please enter both complaint title and description.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        student_id: createFormData.student_id ? createFormData.student_id : undefined,
        category: createFormData.category,
        title: createFormData.title.trim(),
        description: createFormData.description.trim(),
        priority: createFormData.priority,
      };

      await adminService.createComplaint(payload);
      setSuccessBanner('Complaint registered successfully.');
      setCreateModalOpen(false);
      loadComplaintsData();
    } catch (err) {
      console.error('Failed to create complaint:', err);
      setFormError(
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        'Failed to log complaint.'
      );
    } finally {
      setFormSubmitting(false);
    }
  };

  // =========================================================================
  // Workflow: Assign Complaint to Staff
  // =========================================================================
  const handleOpenAssignModal = (complaint) => {
    setSelectedComplaint(complaint);
    setAssignFormData({
      assigned_to: staffList[0]?.id || '',
      message: 'Assigned for immediate maintenance inspection and resolution.',
    });
    setFormError(null);
    setAssignModalOpen(true);
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!selectedComplaint) return;
    if (!assignFormData.assigned_to) {
      setFormError('Please select a staff member.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        assigned_to: assignFormData.assigned_to,
        message: assignFormData.message ? assignFormData.message.trim() : '',
      };

      await adminService.assignComplaint(selectedComplaint.id, payload);
      setSuccessBanner(`Complaint #${selectedComplaint.complaint_number || selectedComplaint.id.slice(0, 8)} assigned successfully.`);
      setAssignModalOpen(false);
      loadComplaintsData();
    } catch (err) {
      console.error('Failed to assign complaint:', err);
      setFormError(
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        'Failed to assign complaint.'
      );
    } finally {
      setFormSubmitting(false);
    }
  };

  // =========================================================================
  // Workflow: Update Status
  // =========================================================================
  const handleOpenStatusModal = (complaint) => {
    setSelectedComplaint(complaint);
    setStatusFormData({
      status: complaint.status === 'OPEN' ? 'IN_PROGRESS' : 'CLOSED',
      message: 'Status updated by College Administrator.',
    });
    setFormError(null);
    setStatusModalOpen(true);
  };

  const handleStatusSubmit = async (e) => {
    e.preventDefault();
    if (!selectedComplaint) return;
    if (!statusFormData.message.trim()) {
      setFormError('Please enter a note explaining this status transition.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        status: statusFormData.status,
        message: statusFormData.message.trim(),
      };

      await adminService.updateComplaintStatus(selectedComplaint.id, payload);
      setSuccessBanner(`Complaint status transitioned to ${payload.status}.`);
      setStatusModalOpen(false);
      loadComplaintsData();
    } catch (err) {
      console.error('Failed to update status:', err);
      setFormError(
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        'Failed to transition complaint status.'
      );
    } finally {
      setFormSubmitting(false);
    }
  };

  // =========================================================================
  // Workflow: Resolve Complaint
  // =========================================================================
  const handleOpenResolveModal = (complaint) => {
    setSelectedComplaint(complaint);
    setResolveFormData({
      resolution: 'Work completed. Replacement parts installed and verified operational.',
    });
    setFormError(null);
    setResolveModalOpen(true);
  };

  const handleResolveSubmit = async (e) => {
    e.preventDefault();
    if (!selectedComplaint) return;
    if (!resolveFormData.resolution.trim()) {
      setFormError('Please enter a resolution description.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        resolution: resolveFormData.resolution.trim(),
      };

      await adminService.resolveComplaint(selectedComplaint.id, payload);
      setSuccessBanner(`Complaint resolved successfully.`);
      setResolveModalOpen(false);
      loadComplaintsData();
    } catch (err) {
      console.error('Failed to resolve complaint:', err);
      setFormError(
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        'Failed to mark complaint as resolved.'
      );
    } finally {
      setFormSubmitting(false);
    }
  };

  // =========================================================================
  // Workflow: View Details & Timeline History
  // =========================================================================
  const handleOpenDetailsDrawer = async (complaint) => {
    setSelectedComplaint(complaint);
    setDetailsDrawerOpen(true);
    setLoadingUpdates(true);
    setComplaintUpdates([]);

    try {
      const updatesRes = await adminService.getComplaintUpdates(complaint.id);
      const rawUpdates = Array.isArray(updatesRes) ? updatesRes : updatesRes?.updates || [];
      setComplaintUpdates(rawUpdates);
    } catch (err) {
      console.warn('Could not load complaint updates:', err);
    } finally {
      setLoadingUpdates(false);
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (status) => {
    const st = String(status || '').toUpperCase();
    if (st === 'OPEN') return <span className="badge-enterprise badge-amber">OPEN</span>;
    if (st === 'ASSIGNED') return <span className="badge-enterprise badge-blue">ASSIGNED</span>;
    if (st === 'IN_PROGRESS') return <span className="badge-enterprise badge-purple">IN PROGRESS</span>;
    if (st === 'RESOLVED') return <span className="badge-enterprise badge-emerald">RESOLVED</span>;
    if (st === 'CLOSED') return <span className="badge-enterprise badge-slate">CLOSED</span>;
    if (st === 'REJECTED') return <span className="badge-enterprise badge-rose">REJECTED</span>;
    return <span className="badge-enterprise badge-slate">{st}</span>;
  };

  // Priority Badge Helper
  const renderPriorityBadge = (priority) => {
    const p = String(priority || '').toUpperCase();
    if (p === 'URGENT') return <span className="badge-enterprise badge-rose">URGENT</span>;
    if (p === 'HIGH') return <span className="badge-enterprise badge-amber">HIGH</span>;
    if (p === 'NORMAL') return <span className="badge-enterprise badge-blue">NORMAL</span>;
    return <span className="badge-enterprise badge-slate">LOW</span>;
  };

  return (
    <div className="enterprise-module-page">
      {/* Header Bar */}
      <div className="enterprise-page-header">
        <div className="header-text-group">
          <div className="header-title-row">
            <div className="header-icon-badge">
              <Wrench size={22} />
            </div>
            <div>
              <h1 className="header-title">Student Complaints & Maintenance</h1>
              <p className="header-subtitle">
                Facility work orders, resident repair requests, staff dispatch, and resolution tracking.
              </p>
            </div>
          </div>
        </div>

        <div className="header-actions-group">
          <button
            type="button"
            className="action-btn-secondary"
            onClick={() => loadComplaintsData(true)}
            disabled={isRefreshing || loading}
            title="Refresh Complaints Data"
          >
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          {canManageComplaints && (
            <button
              type="button"
              className="action-btn-primary"
              onClick={handleOpenCreateModal}
              disabled={loading}
            >
              <Plus size={15} />
              <span>Log Complaint</span>
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
          <ErrorState message={errorMessage} onRetry={() => loadComplaintsData(true)} />
        </div>
      )}

      {/* KPI Stats Bar */}
      <div className="kpi-cards-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Total Logged</span>
            <div className="stat-kpi-icon-wrap blue">
              <MessageSquare size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-blue-600">{kpis.total}</div>
          <div className="stat-kpi-footnote">
            <span>All student service tickets</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Open & In Progress</span>
            <div className="stat-kpi-icon-wrap orange">
              <AlertTriangle size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-orange-600">
            {kpis.open + kpis.inProgress}
          </div>
          <div className="stat-kpi-footnote">
            <span className="status-dot amber" />
            <span>{kpis.open} new • {kpis.inProgress} ongoing</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Assigned Work Orders</span>
            <div className="stat-kpi-icon-wrap purple">
              <Wrench size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-purple-600">{kpis.assigned}</div>
          <div className="stat-kpi-footnote">
            <span>Dispatched to maintenance staff</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Resolved / Closed</span>
            <div className="stat-kpi-icon-wrap emerald">
              <CheckCircle2 size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-emerald-600">
            {kpis.resolved + kpis.closed}
          </div>
          <div className="stat-kpi-footnote">
            <span className="status-dot green" />
            <span>Repairs completed successfully</span>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="enterprise-card">
        <div className="card-topbar">
          <div className="card-title-group">
            <div className="card-title-icon-wrap">
              <Wrench size={16} />
            </div>
            <h2 className="card-title-text">Service Ticket & Maintenance Registry</h2>
          </div>
          <span className="badge-enterprise badge-emerald">
            {filteredComplaints.length} of {complaints.length} Records Showing
          </span>
        </div>

        {/* Filter Toolbar */}
        <div className="enterprise-filter-bar">
          <div className="filter-search-field">
            <Search size={14} className="filter-search-icon" />
            <input
              type="text"
              className="filter-search-input"
              placeholder="Search by ticket number, title, description, or student..."
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
              <option value="ALL">All Ticket Statuses</option>
              <option value="OPEN">OPEN</option>
              <option value="ASSIGNED">ASSIGNED</option>
              <option value="IN_PROGRESS">IN PROGRESS</option>
              <option value="RESOLVED">RESOLVED</option>
              <option value="CLOSED">CLOSED</option>
              <option value="REJECTED">REJECTED</option>
            </select>

            <select
              className="filter-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="ALL">All Categories</option>
              <option value="HOSTEL">HOSTEL</option>
              <option value="ROOM">ROOM</option>
              <option value="FOOD">FOOD</option>
              <option value="WATER">WATER</option>
              <option value="ELECTRICITY">ELECTRICITY</option>
              <option value="CLEANLINESS">CLEANLINESS</option>
              <option value="MAINTENANCE">MAINTENANCE</option>
              <option value="SECURITY">SECURITY</option>
              <option value="OTHER">OTHER</option>
            </select>

            <select
              className="filter-select"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <option value="ALL">All Priorities</option>
              <option value="URGENT">URGENT</option>
              <option value="HIGH">HIGH</option>
              <option value="NORMAL">NORMAL</option>
              <option value="LOW">LOW</option>
            </select>
          </div>
        </div>

        {/* Complaints Table */}
        <div className="enterprise-table-container">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th>Ticket Reference</th>
                <th>Issue Details</th>
                <th>Resident Student</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Assigned Staff</th>
                <th>Date Logged</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '48px 0' }}>
                    <LoadingState message="Loading complaints ledger..." />
                  </td>
                </tr>
              ) : filteredComplaints.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '48px 0' }}>
                    <EmptyState
                      icon={Wrench}
                      title="No complaints or service requests found"
                      description={
                        searchTerm || statusFilter !== 'ALL' || categoryFilter !== 'ALL'
                          ? 'Try adjusting your search query or filters.'
                          : 'No student maintenance complaints have been reported yet.'
                      }
                      actionLabel={canManageComplaints ? 'Log Complaint' : undefined}
                      onAction={canManageComplaints ? handleOpenCreateModal : undefined}
                    />
                  </td>
                </tr>
              ) : (
                filteredComplaints.map((comp) => {
                  const student = comp.student_id ? studentMap.get(comp.student_id) : null;
                  const studentName = student
                    ? `${student.first_name || ''} ${student.last_name || ''}`.trim()
                    : 'Institutional Incident';
                  const regNo = student?.registration_number || student?.admission_number || 'N/A';

                  const staff = comp.assigned_to ? staffMap.get(comp.assigned_to) : null;
                  const staffName = staff
                    ? `${staff.first_name || ''} ${staff.last_name || ''}`.trim()
                    : comp.assigned_to
                    ? 'Staff #' + comp.assigned_to.slice(0, 8)
                    : 'Unassigned';

                  const formattedDate = comp.created_at
                    ? new Date(comp.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : '—';

                  const isResolved = comp.status === 'RESOLVED' || comp.status === 'CLOSED';

                  return (
                    <tr key={comp.id} className="enterprise-table-row">
                      {/* Ticket Number */}
                      <td>
                        <code
                          style={{
                            background: '#f1f5f9',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontWeight: 600,
                            fontSize: '12px',
                            color: '#0f172a',
                          }}
                        >
                          {comp.complaint_number || comp.id.slice(0, 8)}
                        </code>
                      </td>

                      {/* Issue Details */}
                      <td>
                        <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '13.5px' }}>
                          {comp.title}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              color: '#64748b',
                              textTransform: 'uppercase',
                            }}
                          >
                            {comp.category}
                          </span>
                          <span style={{ color: '#cbd5e1' }}>•</span>
                          <span
                            style={{
                              fontSize: '12px',
                              color: '#64748b',
                              maxWidth: '180px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {comp.description}
                          </span>
                        </div>
                      </td>

                      {/* Resident */}
                      <td>
                        <div style={{ fontWeight: 600, color: '#334155', fontSize: '13px' }}>
                          {studentName}
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                          Reg: {regNo}
                        </div>
                      </td>

                      {/* Priority */}
                      <td>{renderPriorityBadge(comp.priority)}</td>

                      {/* Status */}
                      <td>{renderStatusBadge(comp.status)}</td>

                      {/* Assigned Staff */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Users size={12} style={{ color: comp.assigned_to ? '#2563eb' : '#94a3b8' }} />
                          <span style={{ fontSize: '12.5px', color: comp.assigned_to ? '#1e293b' : '#94a3b8' }}>
                            {staffName}
                          </span>
                        </div>
                      </td>

                      {/* Date Logged */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Clock size={12} style={{ color: '#64748b' }} />
                          <span style={{ fontSize: '12.5px', color: '#475569' }}>
                            {formattedDate}
                          </span>
                        </div>
                      </td>

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
                            title="View Full Ticket & Audit History"
                            onClick={() => handleOpenDetailsDrawer(comp)}
                          >
                            <Eye size={14} />
                          </button>

                          {canManageComplaints && !isResolved && (
                            <>
                              <button
                                type="button"
                                className="table-icon-btn"
                                title="Assign to Maintenance Staff"
                                onClick={() => handleOpenAssignModal(comp)}
                              >
                                <UserCheck size={14} />
                              </button>

                              <button
                                type="button"
                                className="table-icon-btn text-purple-600"
                                title="Update Status Transition"
                                onClick={() => handleOpenStatusModal(comp)}
                              >
                                <Send size={14} />
                              </button>

                              <button
                                type="button"
                                className="table-icon-btn text-emerald-600"
                                title="Mark as Resolved"
                                onClick={() => handleOpenResolveModal(comp)}
                              >
                                <Check size={14} />
                              </button>
                            </>
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
      {/* MODAL 1: Create Complaint                                           */}
      {/* =================================================================== */}
      {createModalOpen && (
        <Modal
          isOpen={createModalOpen}
          onClose={() => !formSubmitting && setCreateModalOpen(false)}
          title="Log Maintenance Complaint"
          size="md"
        >
          <form onSubmit={handleCreateSubmit}>
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
              <FormField label="Resident Student">
                <select
                  className="filter-select"
                  style={{ width: '100%', height: '38px' }}
                  value={createFormData.student_id}
                  onChange={(e) =>
                    setCreateFormData((prev) => ({ ...prev, student_id: e.target.value }))
                  }
                >
                  <option value="">General Facility (Not student specific)</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.first_name} {s.last_name} ({s.registration_number || s.id.slice(0, 8)})
                    </option>
                  ))}
                </select>
              </FormField>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <FormField label="Category" required>
                  <select
                    className="filter-select"
                    style={{ width: '100%', height: '38px' }}
                    value={createFormData.category}
                    onChange={(e) =>
                      setCreateFormData((prev) => ({ ...prev, category: e.target.value }))
                    }
                    required
                  >
                    <option value="HOSTEL">HOSTEL</option>
                    <option value="ROOM">ROOM</option>
                    <option value="FOOD">FOOD / MESS</option>
                    <option value="WATER">WATER SUPPLY</option>
                    <option value="ELECTRICITY">ELECTRICITY & POWER</option>
                    <option value="CLEANLINESS">CLEANLINESS & HYGIENE</option>
                    <option value="MAINTENANCE">PLUMBING & CARPENTRY</option>
                    <option value="SECURITY">SECURITY & GATES</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </FormField>

                <FormField label="Priority Level" required>
                  <select
                    className="filter-select"
                    style={{ width: '100%', height: '38px' }}
                    value={createFormData.priority}
                    onChange={(e) =>
                      setCreateFormData((prev) => ({ ...prev, priority: e.target.value }))
                    }
                    required
                  >
                    <option value="NORMAL">NORMAL (Standard priority)</option>
                    <option value="LOW">LOW</option>
                    <option value="HIGH">HIGH (Needs attention today)</option>
                    <option value="URGENT">URGENT (Critical breakdown / hazard)</option>
                  </select>
                </FormField>
              </div>

              <FormField label="Issue Headline / Title" required>
                <input
                  type="text"
                  className="filter-search-input"
                  style={{ width: '100%', height: '38px' }}
                  placeholder="e.g. Broken ceiling fan in Room 302 Block A"
                  value={createFormData.title}
                  onChange={(e) =>
                    setCreateFormData((prev) => ({ ...prev, title: e.target.value }))
                  }
                  required
                />
              </FormField>

              <FormField label="Detailed Description & Location" required>
                <textarea
                  className="filter-search-input"
                  style={{ width: '100%', minHeight: '80px', padding: '8px 12px' }}
                  placeholder="Describe the problem, location details, and any safety hazards..."
                  value={createFormData.description}
                  onChange={(e) =>
                    setCreateFormData((prev) => ({ ...prev, description: e.target.value }))
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
                {formSubmitting ? 'Registering...' : 'Submit Complaint'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* MODAL 2: Assign Complaint to Staff                                  */}
      {/* =================================================================== */}
      {assignModalOpen && selectedComplaint && (
        <Modal
          isOpen={assignModalOpen}
          onClose={() => !formSubmitting && setAssignModalOpen(false)}
          title={`Assign Ticket #${selectedComplaint.complaint_number || selectedComplaint.id.slice(0, 8)}`}
          size="md"
        >
          <form onSubmit={handleAssignSubmit}>
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
              <FormField label="Assign to Maintenance / College Staff" required>
                <select
                  className="filter-select"
                  style={{ width: '100%', height: '38px' }}
                  value={assignFormData.assigned_to}
                  onChange={(e) =>
                    setAssignFormData((prev) => ({ ...prev, assigned_to: e.target.value }))
                  }
                  required
                >
                  <option value="">-- Choose Staff Member --</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.first_name} {s.last_name} ({s.role || 'Staff'})
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Assignment Instructions / Work Order Note">
                <textarea
                  className="filter-search-input"
                  style={{ width: '100%', minHeight: '80px', padding: '8px 12px' }}
                  placeholder="Instructions for the assigned staff member..."
                  value={assignFormData.message}
                  onChange={(e) =>
                    setAssignFormData((prev) => ({ ...prev, message: e.target.value }))
                  }
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
                onClick={() => setAssignModalOpen(false)}
                disabled={formSubmitting}
              >
                Cancel
              </button>
              <button type="submit" className="action-btn-primary" disabled={formSubmitting}>
                {formSubmitting ? 'Assigning...' : 'Confirm Assignment'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* MODAL 3: Update Status Transition                                  */}
      {/* =================================================================== */}
      {statusModalOpen && selectedComplaint && (
        <Modal
          isOpen={statusModalOpen}
          onClose={() => !formSubmitting && setStatusModalOpen(false)}
          title={`Update Status: #${selectedComplaint.complaint_number || selectedComplaint.id.slice(0, 8)}`}
          size="md"
        >
          <form onSubmit={handleStatusSubmit}>
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
              <FormField label="Target Status" required>
                <select
                  className="filter-select"
                  style={{ width: '100%', height: '38px' }}
                  value={statusFormData.status}
                  onChange={(e) =>
                    setStatusFormData((prev) => ({ ...prev, status: e.target.value }))
                  }
                  required
                >
                  <option value="OPEN">OPEN</option>
                  <option value="ASSIGNED">ASSIGNED</option>
                  <option value="IN_PROGRESS">IN PROGRESS</option>
                  <option value="RESOLVED">RESOLVED</option>
                  <option value="CLOSED">CLOSED</option>
                  <option value="REJECTED">REJECTED</option>
                </select>
              </FormField>

              <FormField label="Transition Audit Note / Message" required>
                <textarea
                  className="filter-search-input"
                  style={{ width: '100%', minHeight: '80px', padding: '8px 12px' }}
                  placeholder="Explain the reason for this status change..."
                  value={statusFormData.message}
                  onChange={(e) =>
                    setStatusFormData((prev) => ({ ...prev, message: e.target.value }))
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
                onClick={() => setStatusModalOpen(false)}
                disabled={formSubmitting}
              >
                Cancel
              </button>
              <button type="submit" className="action-btn-primary" disabled={formSubmitting}>
                {formSubmitting ? 'Updating...' : 'Save Status'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* MODAL 4: Mark Complaint Resolved                                   */}
      {/* =================================================================== */}
      {resolveModalOpen && selectedComplaint && (
        <Modal
          isOpen={resolveModalOpen}
          onClose={() => !formSubmitting && setResolveModalOpen(false)}
          title={`Resolve Complaint #${selectedComplaint.complaint_number || selectedComplaint.id.slice(0, 8)}`}
          size="md"
        >
          <form onSubmit={handleResolveSubmit}>
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
              <FormField
                label="Resolution Notes & Work Summary"
                required
                helperText="Provide specific details of the repairs performed for student verification."
              >
                <textarea
                  className="filter-search-input"
                  style={{ width: '100%', minHeight: '100px', padding: '8px 12px' }}
                  placeholder="e.g. Repaired plumbing leak under sink, replaced washer, and verified water pressure."
                  value={resolveFormData.resolution}
                  onChange={(e) =>
                    setResolveFormData((prev) => ({ ...prev, resolution: e.target.value }))
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
                onClick={() => setResolveModalOpen(false)}
                disabled={formSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="action-btn-primary"
                style={{ background: '#10b981', borderColor: '#10b981' }}
                disabled={formSubmitting}
              >
                {formSubmitting ? 'Resolving...' : 'Confirm Resolution'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* DRAWER: Complaint Details & Updates Timeline                        */}
      {/* =================================================================== */}
      {detailsDrawerOpen && selectedComplaint && (
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
                <Wrench size={20} style={{ color: '#2563eb' }} />
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 600, color: '#0f172a' }}>
                  Ticket #{selectedComplaint.complaint_number || selectedComplaint.id.slice(0, 8)}
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

            {/* Headline Card */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  {selectedComplaint.category}
                </div>
                <div>{renderPriorityBadge(selectedComplaint.priority)}</div>
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>
                {selectedComplaint.title}
              </div>
              <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px', lineHeight: 1.5 }}>
                {selectedComplaint.description}
              </div>
            </div>

            {/* Quick Metadata */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b' }}>Current Status</span>
                <div>{renderStatusBadge(selectedComplaint.status)}</div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b' }}>Resident Student</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>
                  {selectedComplaint.student_id && studentMap.get(selectedComplaint.student_id)
                    ? `${studentMap.get(selectedComplaint.student_id).first_name} ${studentMap.get(selectedComplaint.student_id).last_name}`
                    : 'Institutional Incident'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b' }}>Assigned Personnel</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>
                  {selectedComplaint.assigned_to && staffMap.get(selectedComplaint.assigned_to)
                    ? `${staffMap.get(selectedComplaint.assigned_to).first_name} ${staffMap.get(selectedComplaint.assigned_to).last_name}`
                    : 'Unassigned'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b' }}>Reported On</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>
                  {selectedComplaint.created_at ? new Date(selectedComplaint.created_at).toLocaleString() : 'N/A'}
                </span>
              </div>

              {selectedComplaint.resolution && (
                <div style={{ padding: '12px', background: '#ecfdf5', borderRadius: '8px', border: '1px solid #a7f3d0', marginTop: '6px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#047857', textTransform: 'uppercase' }}>
                    Resolution Summary
                  </div>
                  <div style={{ fontSize: '13px', color: '#065f46', marginTop: '4px' }}>
                    {selectedComplaint.resolution}
                  </div>
                </div>
              )}
            </div>

            {/* Timeline History Section */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '10px' }}>
                Activity & Audit Timeline
              </div>

              {loadingUpdates ? (
                <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                  Loading timeline events...
                </div>
              ) : complaintUpdates.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                  No updates recorded yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {complaintUpdates.map((upd, idx) => (
                    <div
                      key={upd.id || idx}
                      style={{
                        padding: '10px 14px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '12.5px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '11.5px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600, color: '#2563eb' }}>{upd.update_type}</span>
                        <span>{upd.created_at ? new Date(upd.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                      </div>
                      <div style={{ color: '#1e293b' }}>{upd.message || 'Status transition recorded.'}</div>
                      {upd.new_status && (
                        <div style={{ marginTop: '4px', fontSize: '11.5px', color: '#475569' }}>
                          Status: <strong>{upd.new_status}</strong>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions in Drawer */}
            <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
              {canManageComplaints && selectedComplaint.status !== 'RESOLVED' && selectedComplaint.status !== 'CLOSED' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    type="button"
                    className="action-btn-secondary"
                    style={{ justifyContent: 'center' }}
                    onClick={() => {
                      setDetailsDrawerOpen(false);
                      handleOpenAssignModal(selectedComplaint);
                    }}
                  >
                    <UserCheck size={14} />
                    <span>Assign Staff</span>
                  </button>

                  <button
                    type="button"
                    className="action-btn-primary"
                    style={{ justifyContent: 'center', background: '#10b981', borderColor: '#10b981' }}
                    onClick={() => {
                      setDetailsDrawerOpen(false);
                      handleOpenResolveModal(selectedComplaint);
                    }}
                  >
                    <Check size={14} />
                    <span>Resolve</span>
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

