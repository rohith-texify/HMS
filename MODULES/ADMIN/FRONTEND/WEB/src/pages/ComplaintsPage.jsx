import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../shared/auth/useAuth';
import adminService from '../services/adminService';
import { exportToCSV } from '../../../shared/utils/exportUtils';
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
  LayoutGrid,
  List,
  Zap,
  Droplets,
  UtensilsCrossed,
  DoorClosed,
  HelpCircle,
  Download,
  Phone,
  ArrowRight,
  ExternalLink,
  SlidersHorizontal,
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

  // Display Mode: Cards vs Table
  const [displayMode, setDisplayMode] = useState(() => {
    return localStorage.getItem('hms_complaints_view_mode') || 'cards';
  });

  const handleSetDisplayMode = (mode) => {
    setDisplayMode(mode);
    localStorage.setItem('hms_complaints_view_mode', mode);
  };

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
  const [drawerNewNote, setDrawerNewNote] = useState('');
  const [submittingDrawerNote, setSubmittingDrawerNote] = useState(false);

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
    let urgentCount = 0;

    complaints.forEach((c) => {
      const st = String(c.status || '').toUpperCase();
      const pr = String(c.priority || '').toUpperCase();
      if (st === 'OPEN') openCount++;
      else if (st === 'ASSIGNED') assignedCount++;
      else if (st === 'IN_PROGRESS') inProgressCount++;
      else if (st === 'RESOLVED') resolvedCount++;
      else if (st === 'CLOSED') closedCount++;

      if (pr === 'URGENT' && st !== 'RESOLVED' && st !== 'CLOSED') {
        urgentCount++;
      }
    });

    const resolvedTotal = resolvedCount + closedCount;
    const resolutionRate = total ? Math.round((resolvedTotal / total) * 100) : 100;

    return {
      total,
      open: openCount,
      assigned: assignedCount,
      inProgress: inProgressCount,
      resolved: resolvedCount,
      closed: closedCount,
      urgent: urgentCount,
      resolutionRate,
    };
  }, [complaints]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts = {
      ALL: complaints.length,
      HOSTEL: 0,
      ROOM: 0,
      FOOD: 0,
      WATER: 0,
      ELECTRICITY: 0,
      CLEANLINESS: 0,
      MAINTENANCE: 0,
      SECURITY: 0,
    };
    complaints.forEach((c) => {
      const cat = String(c.category || '').toUpperCase();
      if (counts[cat] !== undefined) counts[cat]++;
    });
    return counts;
  }, [complaints]);

  // Status counts
  const statusCounts = useMemo(() => {
    const counts = {
      ALL: complaints.length,
      OPEN: 0,
      ASSIGNED: 0,
      IN_PROGRESS: 0,
      RESOLVED: 0,
      CLOSED: 0,
    };
    complaints.forEach((c) => {
      const st = String(c.status || '').toUpperCase();
      if (counts[st] !== undefined) counts[st]++;
    });
    return counts;
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

  const hasActiveFilters =
    searchTerm !== '' ||
    statusFilter !== 'ALL' ||
    categoryFilter !== 'ALL' ||
    priorityFilter !== 'ALL';

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setCategoryFilter('ALL');
    setPriorityFilter('ALL');
  };

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
      loadComplaintsData(true);
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
      setSuccessBanner(
        `Complaint #${selectedComplaint.complaint_number || selectedComplaint.id.slice(0, 8)} assigned successfully.`
      );
      setAssignModalOpen(false);
      loadComplaintsData(true);
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
      setSuccessBanner(
        `Complaint #${selectedComplaint.complaint_number || selectedComplaint.id.slice(0, 8)} status updated to ${payload.status}.`
      );
      setStatusModalOpen(false);
      loadComplaintsData(true);
    } catch (err) {
      console.error('Failed to update complaint status:', err);
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
      resolution: '',
    });
    setFormError(null);
    setResolveModalOpen(true);
  };

  const handleResolveSubmit = async (e) => {
    e.preventDefault();
    if (!selectedComplaint) return;
    if (!resolveFormData.resolution.trim()) {
      setFormError('Please describe the corrective actions and resolution.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        resolution: resolveFormData.resolution.trim(),
      };

      await adminService.resolveComplaint(selectedComplaint.id, payload);
      setSuccessBanner(
        `Complaint #${selectedComplaint.complaint_number || selectedComplaint.id.slice(0, 8)} successfully resolved.`
      );
      setResolveModalOpen(false);
      loadComplaintsData(true);
    } catch (err) {
      console.error('Failed to resolve complaint:', err);
      setFormError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          'Failed to resolve complaint.'
      );
    } finally {
      setFormSubmitting(false);
    }
  };

  // =========================================================================
  // Workflow: Inspect Complaint Updates in Slide-Out Drawer
  // =========================================================================
  const handleOpenDetailsDrawer = async (complaint) => {
    setSelectedComplaint(complaint);
    setDetailsDrawerOpen(true);
    setLoadingUpdates(true);
    setDrawerNewNote('');

    try {
      const res = await adminService.getComplaintUpdates(complaint.id);
      const updates = Array.isArray(res) ? res : res?.updates || res?.data || [];
      setComplaintUpdates(updates);
    } catch (err) {
      console.warn('Failed to load complaint updates:', err);
      setComplaintUpdates([]);
    } finally {
      setLoadingUpdates(false);
    }
  };

  const handleAddDrawerNoteSubmit = async (e) => {
    e.preventDefault();
    if (!selectedComplaint || !drawerNewNote.trim()) return;

    setSubmittingDrawerNote(true);
    try {
      await adminService.updateComplaintStatus(selectedComplaint.id, {
        status: selectedComplaint.status,
        message: drawerNewNote.trim(),
      });
      setDrawerNewNote('');
      // Refresh updates
      const res = await adminService.getComplaintUpdates(selectedComplaint.id);
      const updates = Array.isArray(res) ? res : res?.updates || res?.data || [];
      setComplaintUpdates(updates);
      setSuccessBanner('Progress note logged to audit trail.');
    } catch (err) {
      console.error('Failed to add note:', err);
    } finally {
      setSubmittingDrawerNote(false);
    }
  };

  // =========================================================================
  // CSV Export
  // =========================================================================
  const handleExportCSV = () => {
    const data = filteredComplaints.map((c) => {
      const student = c.student_id ? studentMap.get(c.student_id) : null;
      const studentName = student
        ? `${student.first_name || ''} ${student.last_name || ''}`.trim()
        : 'General Campus Incident';
      const staff = c.assigned_to ? staffMap.get(c.assigned_to) : null;
      const staffName = staff
        ? `${staff.first_name || ''} ${staff.last_name || ''}`.trim()
        : 'Unassigned';

      return {
        ticket_no: c.complaint_number || c.id?.slice(0, 8),
        category: c.category,
        priority: c.priority,
        status: c.status,
        title: c.title,
        student: studentName,
        roll_number: student?.registration_number || student?.roll_number || 'N/A',
        assigned_to: staffName,
        date_reported: c.created_at ? new Date(c.created_at).toLocaleDateString() : 'N/A',
        resolution: c.resolution || 'Pending',
      };
    });

    exportToCSV(
      data,
      `complaints_ledger_${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { label: 'Ticket #', key: 'ticket_no' },
        { label: 'Category', key: 'category' },
        { label: 'Priority', key: 'priority' },
        { label: 'Status', key: 'status' },
        { label: 'Issue Headline', key: 'title' },
        { label: 'Resident Student', key: 'student' },
        { label: 'Roll Number', key: 'roll_number' },
        { label: 'Assigned Staff', key: 'assigned_to' },
        { label: 'Date Reported', key: 'date_reported' },
        { label: 'Resolution Summary', key: 'resolution' },
      ]
    );
  };

  // Status Badge Helper
  const renderStatusBadge = (status) => {
    const st = String(status || '').toUpperCase();
    if (st === 'OPEN') return <span className="badge-enterprise badge-amber">OPEN</span>;
    if (st === 'ASSIGNED') return <span className="badge-enterprise badge-purple">ASSIGNED</span>;
    if (st === 'IN_PROGRESS') return <span className="badge-enterprise badge-blue">IN PROGRESS</span>;
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

  // Category Avatar Icon & Class
  const getCategoryAvatar = (category) => {
    const cat = String(category || '').toUpperCase();
    switch (cat) {
      case 'ELECTRICITY':
        return {
          icon: <Zap size={20} />,
          className: 'category-electricity',
        };
      case 'WATER':
        return {
          icon: <Droplets size={20} />,
          className: 'category-water',
        };
      case 'ROOM':
        return {
          icon: <DoorClosed size={20} />,
          className: 'category-hostel',
        };
      case 'FOOD':
        return {
          icon: <UtensilsCrossed size={20} />,
          className: 'category-food',
        };
      case 'CLEANLINESS':
        return {
          icon: <Sparkles size={20} />,
          className: 'category-cleanliness',
        };
      case 'SECURITY':
        return {
          icon: <Shield size={20} />,
          className: 'category-security',
        };
      case 'MAINTENANCE':
      case 'HOSTEL':
        return {
          icon: <Wrench size={20} />,
          className: 'category-hostel',
        };
      default:
        return {
          icon: <MessageSquare size={20} />,
          className: 'category-default',
        };
    }
  };

  const getCardBorderClass = (comp) => {
    const isResolved = comp.status === 'RESOLVED' || comp.status === 'CLOSED';
    if (isResolved) return 'status-resolved';
    const p = String(comp.priority || '').toUpperCase();
    if (p === 'URGENT') return 'priority-urgent';
    if (p === 'HIGH') return 'priority-high';
    if (p === 'NORMAL') return 'priority-normal';
    return 'priority-low';
  };

  return (
    <div className="fade-in-up">
      {/* Enterprise Hero Header */}
      <div className="enterprise-hero-header">
        <div className="hero-header-titles">
          <div className="hero-category-pill">
            <Wrench size={13} className="hero-category-icon" />
            <span>Support &amp; Safety</span>
          </div>
          <h1 className="hero-main-title">Student Complaints & Service Requests</h1>
          <p className="hero-subtitle">
            Resident maintenance tickets, facility work orders, technician assignments, resolution audits, and institutional service level agreements.
          </p>
        </div>

        <div className="hero-action-buttons">
          <button
            type="button"
            className="btn-enterprise-secondary"
            onClick={() => loadComplaintsData(true)}
            disabled={isRefreshing || loading}
            title="Refresh Complaints Data"
          >
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Sync Ledger</span>
          </button>

          {canManageComplaints && (
            <button
              type="button"
              className="btn-enterprise-primary"
              onClick={handleOpenCreateModal}
              disabled={loading}
            >
              <Plus size={15} />
              <span>Log Service Ticket</span>
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
        {/* Total Logged Tickets */}
        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Total Logged Tickets</span>
            <div className="stat-kpi-icon-wrap blue">
              <MessageSquare size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-blue-600">{kpis.total}</div>
          <div className="stat-kpi-footnote">
            <span>All student service tickets</span>
          </div>
        </div>

        {/* Open & Escalated */}
        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Open & Escalated</span>
            <div className="stat-kpi-icon-wrap orange">
              <AlertTriangle size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-orange-600">{kpis.open}</div>
          <div className="stat-kpi-footnote">
            <span className="status-dot amber" />
            <span>
              {kpis.urgent > 0 ? (
                <strong style={{ color: '#e11d48' }}>{kpis.urgent} Urgent Escalations</strong>
              ) : (
                'Under initial triage'
              )}
            </span>
          </div>
        </div>

        {/* Assigned & In Progress */}
        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Active Work Orders</span>
            <div className="stat-kpi-icon-wrap purple">
              <Wrench size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-purple-600">
            {kpis.assigned + kpis.inProgress}
          </div>
          <div className="stat-kpi-footnote">
            <span>{kpis.assigned} assigned • {kpis.inProgress} in progress</span>
          </div>
        </div>

        {/* Resolved & Closed */}
        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Resolved & Closed</span>
            <div className="stat-kpi-icon-wrap emerald">
              <CheckCircle2 size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-emerald-600">
            {kpis.resolved + kpis.closed}
          </div>
          <div style={{ marginTop: '8px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.72rem',
                color: '#64748b',
                fontWeight: 600,
                marginBottom: '4px',
              }}
            >
              <span>Resolution Rate</span>
              <span>{kpis.resolutionRate}%</span>
            </div>
            <div
              style={{
                width: '100%',
                height: '5px',
                background: '#e2e8f0',
                borderRadius: '3px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${kpis.resolutionRate}%`,
                  height: '100%',
                  background: '#10b981',
                  borderRadius: '3px',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Filter Strip 1: Ticket Status */}
      <div className="complaint-quick-filter-strip">
        <span className="complaint-filter-label">
          <Filter size={12} />
          <span>Status:</span>
        </span>

        <button
          type="button"
          className={`complaint-filter-chip ${statusFilter === 'ALL' ? 'active' : ''}`}
          onClick={() => setStatusFilter('ALL')}
        >
          <span>All Tickets</span>
          <span className="complaint-chip-count">{statusCounts.ALL}</span>
        </button>

        <button
          type="button"
          className={`complaint-filter-chip chip-amber ${statusFilter === 'OPEN' ? 'active' : ''}`}
          onClick={() => setStatusFilter('OPEN')}
        >
          <Clock size={12} />
          <span>Open / New</span>
          <span className="complaint-chip-count">{statusCounts.OPEN}</span>
        </button>

        <button
          type="button"
          className={`complaint-filter-chip chip-purple ${statusFilter === 'ASSIGNED' ? 'active' : ''}`}
          onClick={() => setStatusFilter('ASSIGNED')}
        >
          <UserCheck size={12} />
          <span>Assigned</span>
          <span className="complaint-chip-count">{statusCounts.ASSIGNED}</span>
        </button>

        <button
          type="button"
          className={`complaint-filter-chip ${statusFilter === 'IN_PROGRESS' ? 'active' : ''}`}
          onClick={() => setStatusFilter('IN_PROGRESS')}
        >
          <Wrench size={12} />
          <span>In Progress</span>
          <span className="complaint-chip-count">{statusCounts.IN_PROGRESS}</span>
        </button>

        <button
          type="button"
          className={`complaint-filter-chip chip-emerald ${statusFilter === 'RESOLVED' ? 'active' : ''}`}
          onClick={() => setStatusFilter('RESOLVED')}
        >
          <CheckCircle2 size={12} />
          <span>Resolved</span>
          <span className="complaint-chip-count">{statusCounts.RESOLVED}</span>
        </button>

        <button
          type="button"
          className={`complaint-filter-chip chip-slate ${statusFilter === 'CLOSED' ? 'active' : ''}`}
          onClick={() => setStatusFilter('CLOSED')}
        >
          <span>Closed</span>
          <span className="complaint-chip-count">{statusCounts.CLOSED}</span>
        </button>
      </div>

      {/* Quick Filter Strip 2: Issue Categories */}
      <div className="complaint-quick-filter-strip" style={{ marginTop: '-8px' }}>
        <span className="complaint-filter-label">
          <Wrench size={12} />
          <span>Category:</span>
        </span>

        <button
          type="button"
          className={`complaint-filter-chip ${categoryFilter === 'ALL' ? 'active' : ''}`}
          onClick={() => setCategoryFilter('ALL')}
        >
          <span>All Categories</span>
        </button>

        <button
          type="button"
          className={`complaint-filter-chip chip-amber ${categoryFilter === 'ELECTRICITY' ? 'active' : ''}`}
          onClick={() => setCategoryFilter('ELECTRICITY')}
        >
          <Zap size={12} />
          <span>Electricity</span>
          {categoryCounts.ELECTRICITY > 0 && (
            <span className="complaint-chip-count">{categoryCounts.ELECTRICITY}</span>
          )}
        </button>

        <button
          type="button"
          className={`complaint-filter-chip chip-water ${categoryFilter === 'WATER' ? 'active' : ''}`}
          onClick={() => setCategoryFilter('WATER')}
        >
          <Droplets size={12} />
          <span>Water Supply</span>
          {categoryCounts.WATER > 0 && (
            <span className="complaint-chip-count">{categoryCounts.WATER}</span>
          )}
        </button>

        <button
          type="button"
          className={`complaint-filter-chip ${categoryFilter === 'ROOM' ? 'active' : ''}`}
          onClick={() => setCategoryFilter('ROOM')}
        >
          <DoorClosed size={12} />
          <span>Room & Furniture</span>
          {categoryCounts.ROOM > 0 && (
            <span className="complaint-chip-count">{categoryCounts.ROOM}</span>
          )}
        </button>

        <button
          type="button"
          className={`complaint-filter-chip ${categoryFilter === 'FOOD' ? 'active' : ''}`}
          onClick={() => setCategoryFilter('FOOD')}
        >
          <UtensilsCrossed size={12} />
          <span>Food / Mess</span>
          {categoryCounts.FOOD > 0 && (
            <span className="complaint-chip-count">{categoryCounts.FOOD}</span>
          )}
        </button>

        <button
          type="button"
          className={`complaint-filter-chip chip-emerald ${categoryFilter === 'CLEANLINESS' ? 'active' : ''}`}
          onClick={() => setCategoryFilter('CLEANLINESS')}
        >
          <Sparkles size={12} />
          <span>Cleanliness</span>
          {categoryCounts.CLEANLINESS > 0 && (
            <span className="complaint-chip-count">{categoryCounts.CLEANLINESS}</span>
          )}
        </button>

        <button
          type="button"
          className={`complaint-filter-chip chip-purple ${categoryFilter === 'SECURITY' ? 'active' : ''}`}
          onClick={() => setCategoryFilter('SECURITY')}
        >
          <Shield size={12} />
          <span>Security</span>
          {categoryCounts.SECURITY > 0 && (
            <span className="complaint-chip-count">{categoryCounts.SECURITY}</span>
          )}
        </button>
      </div>

      {/* Main Complaints Card */}
      <div className="enterprise-card">
        <div className="card-topbar">
          <div className="card-title-group">
            <div className="card-title-icon-wrap">
              <Wrench size={16} />
            </div>
            <h2 className="card-title-text">Service Ticket & Maintenance Registry</h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              className="btn-enterprise-secondary"
              style={{ padding: '6px 12px', fontSize: '12px' }}
              onClick={handleExportCSV}
              title="Export Complaints to CSV"
            >
              <Download size={13} />
              <span>Export CSV</span>
            </button>

            {/* View Mode Switcher */}
            <div className="view-toggle-group">
              <button
                type="button"
                className={`view-toggle-btn ${displayMode === 'cards' ? 'active' : ''}`}
                onClick={() => handleSetDisplayMode('cards')}
                title="Card Grid View"
              >
                <LayoutGrid size={15} />
                <span>Cards</span>
              </button>
              <button
                type="button"
                className={`view-toggle-btn ${displayMode === 'table' ? 'active' : ''}`}
                onClick={() => handleSetDisplayMode('table')}
                title="Table View"
              >
                <List size={15} />
                <span>Table</span>
              </button>
            </div>
          </div>
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

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
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

            {hasActiveFilters && (
              <button
                type="button"
                className="btn-enterprise-secondary"
                style={{ padding: '6px 12px', fontSize: '12px' }}
                onClick={handleResetFilters}
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <LoadingState message="Loading complaints ledger from institutional database..." />
          </div>
        ) : filteredComplaints.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <EmptyState
              icon={Wrench}
              title="No maintenance complaints found"
              description={
                hasActiveFilters
                  ? 'Try clearing your search filters to view recorded tickets.'
                  : 'No student maintenance or facility tickets currently logged.'
              }
              actionLabel={canManageComplaints ? 'Log Service Ticket' : undefined}
              onAction={canManageComplaints ? handleOpenCreateModal : undefined}
            />
          </div>
        ) : displayMode === 'cards' ? (
          /* ========================================================================= */
          /* CARDS VIEW MODE                                                           */
          /* ========================================================================= */
          <div style={{ padding: '18px 20px' }}>
            <div className="complaints-grid-cards">
              {filteredComplaints.map((comp) => {
                const student = comp.student_id ? studentMap.get(comp.student_id) : null;
                const studentName = student
                  ? `${student.first_name || ''} ${student.last_name || ''}`.trim()
                  : 'Institutional Incident';
                const regNumber = student?.registration_number || student?.roll_number || 'N/A';
                const assignedStaff = comp.assigned_to ? staffMap.get(comp.assigned_to) : null;
                const avatar = getCategoryAvatar(comp.category);

                return (
                  <div
                    key={comp.id}
                    className={`complaint-card-v2 ${getCardBorderClass(comp)}`}
                  >
                    {/* Top Row: Avatar Box + Header + Badges */}
                    <div className="complaint-card-top">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                        <div className={`complaint-avatar-box ${avatar.className}`}>
                          {avatar.icon}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <h3 className="complaint-title-text" title={comp.title}>
                            {comp.title}
                          </h3>
                          <div className="complaint-meta-sub">
                            <code
                              style={{
                                background: '#f1f5f9',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontWeight: 700,
                                fontSize: '11px',
                                color: '#0f172a',
                              }}
                            >
                              #{comp.complaint_number || comp.id.slice(0, 8)}
                            </code>
                            <span>•</span>
                            <span>{comp.category || 'GENERAL'}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        {renderStatusBadge(comp.status)}
                        {renderPriorityBadge(comp.priority)}
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="complaint-card-body">
                      {/* Description Clamp */}
                      <p className="complaint-desc-clamp" title={comp.description}>
                        {comp.description}
                      </p>

                      {/* Information Stack */}
                      <div className="complaint-info-stack">
                        {/* Student Info */}
                        <div className="complaint-info-row" title={`Resident: ${studentName}`}>
                          <GraduationCap size={13} style={{ color: '#64748b', flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, color: '#334155' }}>Resident:</span>
                          <span style={{ color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {studentName} ({regNumber})
                          </span>
                        </div>

                        {/* Assigned Technician */}
                        <div className="complaint-info-row">
                          <UserCheck size={13} style={{ color: '#64748b', flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, color: '#334155' }}>Work Order:</span>
                          {assignedStaff ? (
                            <span style={{ color: '#059669', fontWeight: 600 }}>
                              {assignedStaff.first_name} {assignedStaff.last_name}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                              Awaiting assignment
                            </span>
                          )}
                        </div>

                        {/* Reported Time */}
                        <div className="complaint-info-row">
                          <Clock size={13} style={{ color: '#64748b', flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, color: '#334155' }}>Reported:</span>
                          <span style={{ color: '#64748b' }}>
                            {comp.created_at ? new Date(comp.created_at).toLocaleDateString() : 'Recent'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer Actions */}
                    <div className="complaint-card-footer">
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn-enterprise-secondary"
                          style={{ padding: '6px 10px', fontSize: '11.5px' }}
                          onClick={() => handleOpenDetailsDrawer(comp)}
                        >
                          <Eye size={12} />
                          <span>Dossier</span>
                        </button>

                        {canManageComplaints && (
                          <button
                            type="button"
                            className="btn-enterprise-secondary"
                            style={{ padding: '6px 10px', fontSize: '11.5px' }}
                            onClick={() => handleOpenAssignModal(comp)}
                            title="Assign to Staff"
                          >
                            <UserCheck size={12} />
                            <span>Assign</span>
                          </button>
                        )}
                      </div>

                      {canManageComplaints && (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn-enterprise-secondary"
                            style={{ padding: '6px 10px', fontSize: '11.5px' }}
                            onClick={() => handleOpenStatusModal(comp)}
                            title="Transition Status"
                          >
                            <SlidersHorizontal size={12} />
                            <span>Status</span>
                          </button>

                          {comp.status !== 'RESOLVED' && comp.status !== 'CLOSED' && (
                            <button
                              type="button"
                              className="btn-enterprise-primary"
                              style={{
                                padding: '6px 10px',
                                fontSize: '11.5px',
                                background: '#10b981',
                                borderColor: '#10b981',
                              }}
                              onClick={() => handleOpenResolveModal(comp)}
                              title="Mark as Resolved"
                            >
                              <Check size={12} />
                              <span>Resolve</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* TABLE VIEW MODE                                                           */
          /* ========================================================================= */
          <div className="enterprise-table-container">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Ticket #</th>
                  <th>Category</th>
                  <th>Headline / Summary</th>
                  <th>Resident Student</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Assigned Technician</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredComplaints.map((comp) => {
                  const student = comp.student_id ? studentMap.get(comp.student_id) : null;
                  const studentName = student
                    ? `${student.first_name || ''} ${student.last_name || ''}`.trim()
                    : 'Campus Incident';
                  const assignedStaff = comp.assigned_to ? staffMap.get(comp.assigned_to) : null;
                  const avatar = getCategoryAvatar(comp.category);

                  return (
                    <tr key={comp.id} className="enterprise-table-row">
                      {/* Ticket # */}
                      <td>
                        <code
                          style={{
                            background: '#f1f5f9',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontWeight: 700,
                            fontSize: '12px',
                            color: '#0f172a',
                          }}
                        >
                          #{comp.complaint_number || comp.id.slice(0, 8)}
                        </code>
                      </td>

                      {/* Category */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div
                            className={`complaint-avatar-box ${avatar.className}`}
                            style={{ width: '28px', height: '28px', borderRadius: '6px' }}
                          >
                            {React.cloneElement(avatar.icon, { size: 14 })}
                          </div>
                          <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>
                            {comp.category || 'GENERAL'}
                          </span>
                        </div>
                      </td>

                      {/* Headline / Summary */}
                      <td style={{ maxWidth: '280px' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '13.5px' }}>
                          {comp.title}
                        </div>
                        <div
                          style={{
                            fontSize: '12px',
                            color: '#64748b',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {comp.description}
                        </div>
                      </td>

                      {/* Student */}
                      <td>
                        <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '13px' }}>
                          {studentName}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          {student?.registration_number || 'N/A'}
                        </div>
                      </td>

                      {/* Priority */}
                      <td>{renderPriorityBadge(comp.priority)}</td>

                      {/* Status */}
                      <td>{renderStatusBadge(comp.status)}</td>

                      {/* Assigned Tech */}
                      <td>
                        {assignedStaff ? (
                          <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#059669' }}>
                            {assignedStaff.first_name} {assignedStaff.last_name}
                          </div>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                            Unassigned
                          </span>
                        )}
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
                            title="Ticket Dossier"
                            onClick={() => handleOpenDetailsDrawer(comp)}
                          >
                            <Eye size={14} />
                          </button>

                          {canManageComplaints && (
                            <>
                              <button
                                type="button"
                                className="table-icon-btn"
                                title="Assign Staff"
                                onClick={() => handleOpenAssignModal(comp)}
                              >
                                <UserCheck size={14} />
                              </button>

                              {comp.status !== 'RESOLVED' && comp.status !== 'CLOSED' && (
                                <button
                                  type="button"
                                  className="table-icon-btn text-emerald-600"
                                  title="Mark Resolved"
                                  onClick={() => handleOpenResolveModal(comp)}
                                >
                                  <Check size={14} />
                                </button>
                              )}
                            </>
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
                className="btn-enterprise-secondary"
                onClick={() => setCreateModalOpen(false)}
                disabled={formSubmitting}
              >
                Cancel
              </button>
              <button type="submit" className="btn-enterprise-primary" disabled={formSubmitting}>
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
              <FormField label="Assign to Maintenance / Hostel Staff" required>
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
                  placeholder="Provide instructions for the technician..."
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
                className="btn-enterprise-secondary"
                onClick={() => setAssignModalOpen(false)}
                disabled={formSubmitting}
              >
                Cancel
              </button>
              <button type="submit" className="btn-enterprise-primary" disabled={formSubmitting}>
                {formSubmitting ? 'Assigning...' : 'Dispatch Ticket'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* MODAL 3: Update Complaint Status                                    */}
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
              <FormField label="New Operational Status" required>
                <select
                  className="filter-select"
                  style={{ width: '100%', height: '38px' }}
                  value={statusFormData.status}
                  onChange={(e) =>
                    setStatusFormData((prev) => ({ ...prev, status: e.target.value }))
                  }
                  required
                >
                  <option value="OPEN">OPEN (Under review)</option>
                  <option value="ASSIGNED">ASSIGNED (Technician dispatched)</option>
                  <option value="IN_PROGRESS">IN PROGRESS (Work ongoing)</option>
                  <option value="CLOSED">CLOSED (Archived without action)</option>
                  <option value="REJECTED">REJECTED (Duplicate or out of scope)</option>
                </select>
              </FormField>

              <FormField label="Status Transition Note" required>
                <textarea
                  className="filter-search-input"
                  style={{ width: '100%', minHeight: '80px', padding: '8px 12px' }}
                  placeholder="Explain why this status transition is being recorded..."
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
                className="btn-enterprise-secondary"
                onClick={() => setStatusModalOpen(false)}
                disabled={formSubmitting}
              >
                Cancel
              </button>
              <button type="submit" className="btn-enterprise-primary" disabled={formSubmitting}>
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
                className="btn-enterprise-secondary"
                onClick={() => setResolveModalOpen(false)}
                disabled={formSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-enterprise-primary"
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
        <div className="complaint-drawer-overlay" onClick={() => setDetailsDrawerOpen(false)}>
          <div className="complaint-drawer-content" onClick={(e) => e.stopPropagation()}>
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
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                  Ticket #{selectedComplaint.complaint_number || selectedComplaint.id.slice(0, 8)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailsDrawerOpen(false)}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#64748b',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Headline Card */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
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
              <div style={{ fontSize: '13px', color: '#475569', marginTop: '6px', lineHeight: 1.5 }}>
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

            {/* Interactive Note Form in Drawer */}
            <form onSubmit={handleAddDrawerNoteSubmit}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
                Post Work Order Note
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="filter-search-input"
                  style={{ flex: 1, height: '36px', fontSize: '12.5px' }}
                  placeholder="Add progress note or audit remark..."
                  value={drawerNewNote}
                  onChange={(e) => setDrawerNewNote(e.target.value)}
                />
                <button
                  type="submit"
                  className="btn-enterprise-primary"
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                  disabled={submittingDrawerNote || !drawerNewNote.trim()}
                >
                  <Send size={12} />
                  <span>Post</span>
                </button>
              </div>
            </form>

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
                <div className="complaint-audit-timeline">
                  {complaintUpdates.map((upd, idx) => (
                    <div key={upd.id || idx} className="complaint-audit-node">
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '11.5px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 700, color: '#2563eb' }}>{upd.update_type}</span>
                        <span>
                          {upd.created_at
                            ? new Date(upd.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : ''}
                        </span>
                      </div>
                      <div style={{ color: '#1e293b', fontSize: '12.5px' }}>{upd.message || 'Status transition recorded.'}</div>
                      {upd.new_status && (
                        <div style={{ marginTop: '4px', fontSize: '11px', color: '#475569' }}>
                          Status: <strong>{upd.new_status}</strong>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions in Drawer Footer */}
            <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
              {canManageComplaints && selectedComplaint.status !== 'RESOLVED' && selectedComplaint.status !== 'CLOSED' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    type="button"
                    className="btn-enterprise-secondary"
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
                    className="btn-enterprise-primary"
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
