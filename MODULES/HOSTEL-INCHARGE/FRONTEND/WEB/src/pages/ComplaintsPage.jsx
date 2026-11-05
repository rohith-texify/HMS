import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import inchargeService from '../services/inchargeService';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import SearchInput from '../components/SearchInput';
import Modal from '../components/Modal';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import Badge from '../components/Badge';
import {
  MessageSquare,
  Clock,
  CheckCircle2,
  Plus,
  RefreshCw,
  Eye,
  UserCheck,
  X,
  Building2,
  LayoutGrid,
  List,
  Download,
  AlertCircle,
  Wrench
} from 'lucide-react';

export default function ComplaintsPage() {
  const { assignedHostel } = useAuth(); // eslint-disable-line no-unused-vars
  const navigate = useNavigate();
    // Display Mode: Cards vs Table
  const [displayMode, setDisplayMode] = useState('TABLE');

  // Master Data State
  const [complaints, setComplaints] = useState([]);
  const [backendSummary, setBackendSummary] = useState([]);
  const [students, setStudents] = useState([]);
  const [staffList, setStaffList] = useState([]);

  // UI & Loading States
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successBanner, setSuccessBanner] = useState(null);

  // Search & Filters (Note: Backend GET /college/complaints does not support query parameters; filters operate client-side)
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Modals Visibility
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [dossierModalOpen, setDossierModalOpen] = useState(false);

  // Active Selected Complaint & History
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [complaintUpdates, setComplaintUpdates] = useState([]);
  const [loadingUpdates, setLoadingUpdates] = useState(false);

  // Create Form State
  const [formCategory, setFormCategory] = useState('ROOM');
  const [formPriority, setFormPriority] = useState('NORMAL');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStudentId, setFormStudentId] = useState('');
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  // Assign Form State
  const [assignStaffId, setAssignStaffId] = useState('');
  const [assignMessage, setAssignMessage] = useState('');
  const [isSubmittingAssign, setIsSubmittingAssign] = useState(false);

  // Status Form State
  const [newStatus, setNewStatus] = useState('IN_PROGRESS');
  const [statusMessage, setStatusMessage] = useState('');
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);

  // Resolve Form State
  const [resolveRemarks, setResolveRemarks] = useState('');
  const [isSubmittingResolve, setIsSubmittingResolve] = useState(false);

  // Modal Error States
  const [modalError, setModalError] = useState(null);

  // Fast Student Map
  const studentMap = useMemo(() => {
    const map = new Map();
    students.forEach((s) => {
      const id = s.student_id || s.id;
      if (id) map.set(id, s);
    });
    return map;
  }, [students]);

  // Fast Staff Map (Index by user_id because app.complaints.assigned_to references app.users.user_id)
  const staffMap = useMemo(() => {
    const map = new Map();
    staffList.forEach((st) => {
      if (st.user_id) map.set(st.user_id, st);
      const id = st.staff_id || st.id;
      if (id) map.set(id, st);
    });
    return map;
  }, [staffList]);

  // Request Sequence Counter to prevent stale responses overwriting newer state
  const reqSeqRef = React.useRef(0);

  // Master Data Fetching
  const loadData = useCallback(async (isManual = false) => {
    const seq = ++reqSeqRef.current;
    if (isManual) setIsRefreshing(true);
    else setLoading(true);
    setErrorMessage(null);

    try {
      const [complaintsRes, summaryRes, studentsRes, staffRes] = await Promise.allSettled([
        inchargeService.getComplaints(),
        inchargeService.getComplaintSummary(),
        inchargeService.getStudents(),
        inchargeService.getStaff(),
      ]);

      if (seq !== reqSeqRef.current) return;

      if (complaintsRes.status === 'fulfilled') {
        const val = complaintsRes.value;
        const list = Array.isArray(val) ? val : val?.complaints || val?.data || [];
        setComplaints(list);
      } else {
        console.warn('Failed to load complaints:', complaintsRes.reason);
      }

      if (summaryRes.status === 'fulfilled') {
        const val = summaryRes.value;
        const summary = Array.isArray(val) ? val : val?.data || val?.summary || [];
        setBackendSummary(summary);
      }

      if (studentsRes.status === 'fulfilled') {
        const val = studentsRes.value;
        const list = Array.isArray(val) ? val : val?.students || val?.data || [];
        setStudents(list);
      }

      if (staffRes.status === 'fulfilled') {
        const val = staffRes.value;
        const list = Array.isArray(val) ? val : val?.staff || val?.data || [];
        setStaffList(list);
      }
    } catch (err) {
      if (seq !== reqSeqRef.current) return;
      console.error('Failed to load complaints data:', err);
      setErrorMessage(err.message || 'Failed to load resident complaints.');
    } finally {
      if (seq === reqSeqRef.current) {
        setLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-dismiss success banner
  useEffect(() => {
    if (successBanner) {
      const t = setTimeout(() => setSuccessBanner(null), 5000);
      return () => clearTimeout(t);
    }
  }, [successBanner]);

  // Date Formatter
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return dateStr;
    }
  };

  // Status Badge Helper
  const getStatusBadge = (status) => {
    const s = (status || 'OPEN').toUpperCase();
    switch (s) {
      case 'OPEN':
        return <Badge variant="warning">Open</Badge>;
      case 'ASSIGNED':
        return <Badge variant="primary">Assigned</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="info">In Progress</Badge>;
      case 'RESOLVED':
        return <Badge variant="success">Resolved</Badge>;
      case 'CLOSED':
        return <Badge variant="neutral">Closed</Badge>;
      case 'REJECTED':
        return <Badge variant="danger">Rejected</Badge>;
      case 'CANCELLED':
        return <Badge variant="neutral">Cancelled</Badge>;
      case 'REOPENED':
        return <Badge variant="warning">Reopened</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  // Priority Badge Helper
  const getPriorityBadge = (priority) => {
    const p = (priority || 'NORMAL').toUpperCase();
    switch (p) {
      case 'URGENT':
        return <span style={{ padding: '3px 8px', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '4px', fontWeight: 700, fontSize: '0.75rem' }}>URGENT</span>;
      case 'HIGH':
        return <span style={{ padding: '3px 8px', backgroundColor: '#ffedd5', color: '#c2410c', borderRadius: '4px', fontWeight: 600, fontSize: '0.75rem' }}>High</span>;
      case 'NORMAL':
        return <span style={{ padding: '3px 8px', backgroundColor: '#eff6ff', color: '#1d4ed8', borderRadius: '4px', fontWeight: 500, fontSize: '0.75rem' }}>Normal</span>;
      case 'LOW':
        return <span style={{ padding: '3px 8px', backgroundColor: '#f1f5f9', color: '#64748b', borderRadius: '4px', fontWeight: 500, fontSize: '0.75rem' }}>Low</span>;
      default:
        return <span>{priority}</span>;
    }
  };

  // Enriched Complaints
  const enrichedComplaints = useMemo(() => {
    return complaints.map((c) => {
      const student = c.student_id ? studentMap.get(c.student_id) : null;
      const studentName = student
        ? student.full_name || `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Resident Student'
        : c.student_id
        ? 'Resident Student'
        : 'Facility / General';

      const regNumber = student?.admission_number || student?.roll_number || '—';
      const roomNumber = student?.room_name || student?.room_code || '—';

      const staff = c.assigned_to ? staffMap.get(c.assigned_to) : null;
      const staffName = staff
        ? staff.full_name || staff.name || `${staff.first_name || ''} ${staff.last_name || ''}`.trim() || 'Staff'
        : c.assigned_to
        ? 'Assigned Staff'
        : 'Unassigned';

      return {
        ...c,
        studentName,
        regNumber,
        roomNumber,
        staffName,
      };
    });
  }, [complaints, studentMap, staffMap]);

  // Filtered Complaints (Evaluated Client-Side on the retrieved tenant dataset)
  const filteredComplaints = useMemo(() => {
    return enrichedComplaints.filter((c) => {
      if (debouncedSearch) {
        const term = debouncedSearch.toLowerCase();
        const matchesNo = (c.complaint_number || '').toLowerCase().includes(term);
        const matchesTitle = (c.title || '').toLowerCase().includes(term);
        const matchesDesc = (c.description || '').toLowerCase().includes(term);
        const matchesStudent = c.studentName.toLowerCase().includes(term);
        const matchesReg = c.regNumber.toLowerCase().includes(term);
        const matchesStaff = c.staffName.toLowerCase().includes(term);

        if (!matchesNo && !matchesTitle && !matchesDesc && !matchesStudent && !matchesReg && !matchesStaff) {
          return false;
        }
      }

      if (statusFilter !== 'ALL') {
        if ((c.status || '').toUpperCase() !== statusFilter) return false;
      }

      if (categoryFilter !== 'ALL') {
        if ((c.category || '').toUpperCase() !== categoryFilter) return false;
      }

      if (priorityFilter !== 'ALL') {
        if ((c.priority || '').toUpperCase() !== priorityFilter) return false;
      }

      return true;
    });
  }, [enrichedComplaints, debouncedSearch, statusFilter, categoryFilter, priorityFilter]);

  // Authoritative Backend Open Complaints Total (from GET /college/complaints/reports/summary)
  const authoritativeOpenTotal = useMemo(() => {
    if (!Array.isArray(backendSummary) || backendSummary.length === 0) return null;
    return backendSummary.reduce((acc, row) => acc + (parseInt(row.complaint_count, 10) || 0), 0);
  }, [backendSummary]);

  // Derived KPI Stats from Loaded Tenant List
  const metrics = useMemo(() => {
    let openCount = 0;
    let inProgressCount = 0;
    let resolvedCount = 0;

    complaints.forEach((c) => {
      const s = (c.status || '').toUpperCase();
      if (s === 'OPEN' || s === 'REOPENED') openCount++;
      else if (s === 'ASSIGNED' || s === 'IN_PROGRESS') inProgressCount++;
      else if (s === 'RESOLVED' || s === 'CLOSED') resolvedCount++;
    });

    return {
      total: complaints.length,
      open: openCount,
      inProgress: inProgressCount,
      resolved: resolvedCount,
    };
  }, [complaints]);

  // Open Dossier & Fetch Updates Timeline
  const handleOpenDossier = async (complaint) => {
    setSelectedComplaint(complaint);
    setDossierModalOpen(true);
    setLoadingUpdates(true);

    try {
      const updates = await inchargeService.getComplaintUpdates(complaint.id);
      setComplaintUpdates(Array.isArray(updates) ? updates : []);
    } catch (err) {
      console.warn('Failed to load complaint updates:', err);
      setComplaintUpdates([]);
    } finally {
      setLoadingUpdates(false);
    }
  };

  // Submit Create Complaint
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formTitle.trim() || !formDescription.trim()) return;

    setIsSubmittingCreate(true);
    setModalError(null);

    try {
      const payload = {
        category: formCategory,
        priority: formPriority,
        title: formTitle.trim(),
        description: formDescription.trim(),
        student_id: formStudentId || undefined,
      };

      await inchargeService.createComplaint(payload);
      setSuccessBanner('Complaint ticket logged successfully.');
      setCreateModalOpen(false);
      setFormTitle('');
      setFormDescription('');
      setFormStudentId('');
      await loadData(false);
    } catch (err) {
      console.error('Failed to create complaint:', err);
      setModalError(err.response?.data?.error?.message || err.message || 'Failed to create complaint.');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Submit Assign Complaint
  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!selectedComplaint || !assignStaffId) return;

    setIsSubmittingAssign(true);
    setModalError(null);

    try {
      await inchargeService.assignComplaint(selectedComplaint.id, {
        assigned_to: assignStaffId,
        message: assignMessage.trim() || 'Assigned by Hostel In-Charge for resolution.',
      });

      setSuccessBanner(`Complaint ${selectedComplaint.complaint_number || ''} assigned successfully.`);
      setAssignModalOpen(false);
      setDossierModalOpen(false);
      setAssignStaffId('');
      setAssignMessage('');
      await loadData(false);
    } catch (err) {
      console.error('Failed to assign complaint:', err);
      setModalError(err.response?.data?.error?.message || err.message || 'Failed to assign complaint.');
    } finally {
      setIsSubmittingAssign(false);
    }
  };

  // Submit Update Status
  const handleStatusSubmit = async (e) => {
    e.preventDefault();
    if (!selectedComplaint || !statusMessage.trim()) return;

    setIsSubmittingStatus(true);
    setModalError(null);

    try {
      await inchargeService.updateComplaintStatus(selectedComplaint.id, {
        status: newStatus,
        message: statusMessage.trim(),
      });

      setSuccessBanner(`Complaint status updated to ${newStatus}.`);
      setStatusModalOpen(false);
      setDossierModalOpen(false);
      setStatusMessage('');
      await loadData(false);
    } catch (err) {
      console.error('Failed to update status:', err);
      setModalError(err.response?.data?.error?.message || err.message || 'Failed to update complaint status.');
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  // Submit Resolve Complaint
  const handleResolveSubmit = async (e) => {
    e.preventDefault();
    if (!selectedComplaint || !resolveRemarks.trim()) return;

    setIsSubmittingResolve(true);
    setModalError(null);

    try {
      await inchargeService.resolveComplaint(selectedComplaint.id, {
        resolution: resolveRemarks.trim(),
      });

      setSuccessBanner(`Complaint ${selectedComplaint.complaint_number || ''} resolved successfully.`);
      setResolveModalOpen(false);
      setDossierModalOpen(false);
      setResolveRemarks('');
      await loadData(false);
    } catch (err) {
      console.error('Failed to resolve complaint:', err);
      setModalError(err.response?.data?.error?.message || err.message || 'Failed to resolve complaint.');
    } finally {
      setIsSubmittingResolve(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (filteredComplaints.length === 0) return;

    const headers = [
      'Complaint Number',
      'Category',
      'Title',
      'Priority',
      'Status',
      'Resident Student',
      'Room',
      'Assigned Staff',
      'Created At',
      'Resolved At',
    ];

    const rows = filteredComplaints.map((c) => [
      `"${c.complaint_number || c.id}"`,
      `"${c.category}"`,
      `"${(c.title || '').replace(/"/g, '""')}"`,
      `"${c.priority}"`,
      `"${c.status}"`,
      `"${c.studentName}"`,
      `"${c.roomNumber}"`,
      `"${c.staffName}"`,
      `"${formatDate(c.created_at)}"`,
      `"${c.resolved_at ? formatDate(c.resolved_at) : '—'}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Hostel_Complaints_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Table Columns
  const columns = [
    {
      header: 'Complaint #',
      accessor: 'complaint_number',
      cell: (row) => (
        <div>
          <div
            style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--primary-color)', cursor: 'pointer' }}
            onClick={() => handleOpenDossier(row)}
            title="Inspect full details and audit history"
          >
            {row.complaint_number || (row.id ? row.id.slice(0, 8) : 'CMP')}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
            {formatDate(row.created_at)}
          </div>
        </div>
      ),
    },
    {
      header: 'Issue Particulars',
      accessor: 'title',
      cell: (row) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
            {row.title}
          </div>
          <div
            style={{
              fontSize: '0.78rem',
              color: 'var(--text-secondary)',
              maxWidth: '260px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={row.description}
          >
            {row.description}
          </div>
        </div>
      ),
    },
    {
      header: 'Category',
      accessor: 'category',
      cell: (row) => (
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          {row.category}
        </span>
      ),
    },
    {
      header: 'Priority',
      accessor: 'priority',
      cell: (row) => getPriorityBadge(row.priority),
    },
    {
      header: 'Status',
      accessor: 'status',
      cell: (row) => getStatusBadge(row.status),
    },
    {
      header: 'Resident / Room',
      accessor: 'studentName',
      cell: (row) => (
        <div>
          <div
            style={{
              fontSize: '0.82rem',
              fontWeight: 600,
              color: row.student_id ? 'var(--primary-color)' : 'var(--text-secondary)',
              cursor: row.student_id ? 'pointer' : 'default',
            }}
            onClick={() => {
              if (row.student_id) navigate(`/students?search=${encodeURIComponent(row.regNumber || row.studentName)}`);
            }}
            title={row.student_id ? 'View student profile' : ''}
          >
            {row.studentName}
          </div>
          {row.roomNumber !== '—' && (
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
              Room {row.roomNumber}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Assigned Staff',
      accessor: 'staffName',
      cell: (row) => (
        <div style={{ fontSize: '0.82rem', color: row.assigned_to ? 'var(--text-primary)' : 'var(--text-muted)' }}>
          {row.staffName}
        </div>
      ),
    },
    {
      header: 'Actions',
      accessor: 'id',
      cell: (row) => {
        const isResolved = row.status === 'RESOLVED' || row.status === 'CLOSED';

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => handleOpenDossier(row)}
              style={{ fontSize: '0.78rem', padding: '5px 8px' }}
              title="Inspect details and updates"
            >
              <Eye size={14} />
            </button>

            {!isResolved && (
              <>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => {
                    setSelectedComplaint(row);
                    setAssignStaffId(row.assigned_to || '');
                    setAssignModalOpen(true);
                  }}
                  style={{ fontSize: '0.76rem', padding: '4px 8px' }}
                  title="Assign staff"
                >
                  <UserCheck size={13} />
                </button>

                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => {
                    setSelectedComplaint(row);
                    setResolveRemarks('');
                    setResolveModalOpen(true);
                  }}
                  style={{ fontSize: '0.76rem', padding: '4px 8px' }}
                  title="Resolve complaint"
                >
                  <CheckCircle2 size={13} />
                </button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div style={{ paddingBottom: '40px' }}>
      {/* Page Header */}
      <PageHeader
        title="Student Complaints & Grievance Workspace"
        description="Review, triage, assign, update, and resolve residential grievances, room repairs, and facility complaints."
        icon={MessageSquare}
        actions={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setModalError(null);
                setCreateModalOpen(true);
              }}
              style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={15} />
              <span>Log Complaint</span>
            </button>

            <button
              type="button"
              className="btn btn-outline"
              onClick={() => loadData(true)}
              disabled={isRefreshing}
              style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              className="btn btn-outline"
              onClick={handleExportCSV}
              disabled={filteredComplaints.length === 0}
              style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>

            {/* View Mode Toggle */}
            <div
              style={{
                display: 'flex',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                overflow: 'hidden',
              }}
            >
              <button
                type="button"
                onClick={() => setDisplayMode('TABLE')}
                style={{
                  padding: '6px 10px',
                  border: 'none',
                  backgroundColor: displayMode === 'TABLE' ? 'var(--primary-color)' : 'var(--bg-surface)',
                  color: displayMode === 'TABLE' ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Table View"
              >
                <List size={16} />
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('CARDS')}
                style={{
                  padding: '6px 10px',
                  border: 'none',
                  backgroundColor: displayMode === 'CARDS' ? 'var(--primary-color)' : 'var(--bg-surface)',
                  color: displayMode === 'CARDS' ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Card Grid View"
              >
                <LayoutGrid size={16} />
              </button>
            </div>
          </div>
        }
      />

      {/* Success Banner */}
      {successBanner && (
        <div
          style={{
            marginBottom: '20px',
            padding: '12px 18px',
            backgroundColor: '#ecfdf5',
            border: '1px solid #a7f3d0',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#065f46',
            fontSize: '0.9rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} color="#10b981" />
            <span>{successBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            style={{ background: 'none', border: 'none', color: '#065f46', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Tenant Scope & Client-Side Filtering Notice */}
      <div
        style={{
          margin: '0 0 16px 0',
          padding: '10px 14px',
          backgroundColor: 'rgba(59, 130, 246, 0.08)',
          borderRadius: '6px',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '0.82rem',
          color: 'var(--text-secondary)',
        }}
      >
        <Building2 size={16} color="#3b82f6" />
        <span>
          <strong>Tenant Integration Notice:</strong> The complaint repository operates at institutional tenant scope (<code style={{ fontSize: '0.78rem' }}>college_id</code>). All filters (search, status, category, priority) are executed on retrieved records, and student linkages resolve to resident profiles.
        </span>
      </div>

      {/* KPI Stats Summary Cards */}
      <div className="grid-4" style={{ marginBottom: '24px' }}>
        <div className="card stat-card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Total Records (Tenant)
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                {metrics.total}
              </div>
            </div>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '8px',
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MessageSquare size={20} />
            </div>
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
            Loaded college tenant complaints
          </div>
        </div>

        <div
          className="card stat-card"
          style={{
            padding: '18px',
            borderLeft: metrics.open > 0 ? '4px solid #f59e0b' : '1px solid var(--border-color)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: '#b45309', fontWeight: 600 }}>
                Open Grievances
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#d97706', marginTop: '4px' }}>
                {authoritativeOpenTotal !== null ? authoritativeOpenTotal : metrics.open}
              </div>
            </div>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '8px',
                backgroundColor: '#fffbeb',
                color: '#d97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Clock size={20} />
            </div>
          </div>
          <div style={{ fontSize: '0.74rem', color: '#b45309', marginTop: '8px' }}>
            {authoritativeOpenTotal !== null
              ? 'Authoritative (/reports/summary)'
              : 'Derived from loaded tenant records'}
          </div>
        </div>

        <div className="card stat-card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: '#1d4ed8', fontWeight: 600 }}>
                In Progress / Assigned
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#2563eb', marginTop: '4px' }}>
                {metrics.inProgress}
              </div>
            </div>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '8px',
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Wrench size={20} />
            </div>
          </div>
          <div style={{ fontSize: '0.74rem', color: '#1d4ed8', marginTop: '8px' }}>
            Derived from loaded tenant records
          </div>
        </div>

        <div className="card stat-card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: '#047857', fontWeight: 600 }}>
                Resolved / Closed
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
                {metrics.resolved}
              </div>
            </div>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '8px',
                backgroundColor: '#ecfdf5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircle2 size={20} />
            </div>
          </div>
          <div style={{ fontSize: '0.74rem', color: '#047857', marginTop: '8px' }}>
            Derived from loaded tenant records
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '14px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ flex: '1 1 280px', minWidth: '240px' }}>
          <SearchInput
            placeholder="Search complaint #, title, student, room, staff..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onClear={() => setSearchTerm('')}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Status Filter */}
          <select
            className="form-control"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: 'auto', minWidth: '130px', fontSize: '0.85rem' }}
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
            <option value="REJECTED">Rejected</option>
            <option value="REOPENED">Reopened</option>
          </select>

          {/* Category Filter */}
          <select
            className="form-control"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ width: 'auto', minWidth: '140px', fontSize: '0.85rem' }}
          >
            <option value="ALL">All Categories</option>
            <option value="HOSTEL">Hostel General</option>
            <option value="ROOM">Room Issue</option>
            <option value="FOOD">Food & Mess</option>
            <option value="WATER">Water Supply</option>
            <option value="ELECTRICITY">Electricity / Power</option>
            <option value="CLEANLINESS">Cleanliness / Hygiene</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="SECURITY">Security</option>
            <option value="FACILITY">Facility</option>
            <option value="STAFF">Staff</option>
            <option value="OTHER">Other</option>
          </select>

          {/* Priority Filter */}
          <select
            className="form-control"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            style={{ width: 'auto', minWidth: '130px', fontSize: '0.85rem' }}
          >
            <option value="ALL">All Priorities</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="NORMAL">Normal</option>
            <option value="LOW">Low</option>
          </select>

          {/* Reset Filters */}
          {(searchTerm || statusFilter !== 'ALL' || categoryFilter !== 'ALL' || priorityFilter !== 'ALL') && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('ALL');
                setCategoryFilter('ALL');
                setPriorityFilter('ALL');
              }}
              style={{ fontSize: '0.82rem', padding: '6px 10px' }}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <LoadingState title="Loading complaints..." rows={5} />
      ) : errorMessage ? (
        <ErrorState title="Failed to Load Complaints" message={errorMessage} onRetry={() => loadData(false)} />
      ) : filteredComplaints.length === 0 ? (
        <EmptyState
          title="No Complaints Found"
          description={
            searchTerm || statusFilter !== 'ALL' || categoryFilter !== 'ALL' || priorityFilter !== 'ALL'
              ? 'No complaints match your search and filter criteria.'
              : 'There are currently no complaints logged for this hostel.'
          }
          icon={MessageSquare}
          action={
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setModalError(null);
                setCreateModalOpen(true);
              }}
            >
              Log New Complaint
            </button>
          }
        />
      ) : displayMode === 'TABLE' ? (
        <div className="card" style={{ overflow: 'hidden' }}>
          <DataTable columns={columns} data={filteredComplaints} keyField="id" />
        </div>
      ) : (
        /* Card Grid View */
        <div className="grid-3" style={{ gap: '16px' }}>
          {filteredComplaints.map((c) => {
            const isResolved = c.status === 'RESOLVED' || c.status === 'CLOSED';

            return (
              <div
                key={c.id}
                className="card"
                style={{
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderTop:
                    c.priority === 'URGENT'
                      ? '3px solid #ef4444'
                      : c.status === 'OPEN'
                      ? '3px solid #f59e0b'
                      : isResolved
                      ? '3px solid #10b981'
                      : '3px solid #3b82f6',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div>
                      <span style={{ fontSize: '0.74rem', fontFamily: 'monospace', color: 'var(--primary-color)', fontWeight: 700 }}>
                        {c.complaint_number || c.id.slice(0, 8)}
                      </span>
                      <h4 style={{ margin: '4px 0 0 0', fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {c.title}
                      </h4>
                    </div>
                    <div>{getStatusBadge(c.status)}</div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Category: {c.category}
                    </span>
                    <span>•</span>
                    <div>{getPriorityBadge(c.priority)}</div>
                  </div>

                  <p
                    style={{
                      fontSize: '0.82rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.4,
                      marginBottom: '14px',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {c.description}
                  </p>

                  <div
                    style={{
                      padding: '10px 12px',
                      backgroundColor: '#f8fafc',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      marginBottom: '14px',
                    }}
                  >
                    <div style={{ color: 'var(--text-primary)' }}>
                      Resident: <strong>{c.studentName}</strong> {c.roomNumber !== '—' && `(Room ${c.roomNumber})`}
                    </div>
                    <div style={{ color: 'var(--text-secondary)' }}>
                      Assigned: <strong>{c.staffName}</strong>
                    </div>
                    <div style={{ color: 'var(--text-secondary)' }}>
                      Logged: {formatDate(c.created_at)}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '6px',
                    justifyContent: 'flex-end',
                    paddingTop: '12px',
                    borderTop: '1px solid var(--border-color)',
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => handleOpenDossier(c)}
                    style={{ fontSize: '0.78rem' }}
                  >
                    Details
                  </button>

                  {!isResolved && (
                    <>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        onClick={() => {
                          setSelectedComplaint(c);
                          setAssignStaffId(c.assigned_to || '');
                          setAssignModalOpen(true);
                        }}
                        style={{ fontSize: '0.78rem' }}
                      >
                        Assign
                      </button>

                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => {
                          setSelectedComplaint(c);
                          setResolveRemarks('');
                          setResolveModalOpen(true);
                        }}
                        style={{ fontSize: '0.78rem' }}
                      >
                        Resolve
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Log New Complaint Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => !isSubmittingCreate && setCreateModalOpen(false)}
        title="Log New Grievance / Complaint"
        maxWidth="580px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', width: '100%' }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setCreateModalOpen(false)}
              disabled={isSubmittingCreate}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCreateSubmit}
              disabled={isSubmittingCreate || !formTitle.trim() || !formDescription.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {isSubmittingCreate ? (
                <>
                  <RefreshCw size={14} className="spin" />
                  <span>Logging...</span>
                </>
              ) : (
                <>
                  <Plus size={15} />
                  <span>Submit Ticket</span>
                </>
              )}
            </button>
          </div>
        }
      >
        <form onSubmit={handleCreateSubmit}>
          {modalError && (
            <div
              style={{
                marginBottom: '16px',
                padding: '10px 14px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                color: '#b91c1c',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={16} />
              <span>{modalError}</span>
            </div>
          )}

          <div className="grid-2" style={{ gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                Category *
              </label>
              <select
                className="form-control"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                required
              >
                <option value="ROOM">Room Issue</option>
                <option value="HOSTEL">Hostel General</option>
                <option value="FOOD">Food & Mess</option>
                <option value="WATER">Water Supply</option>
                <option value="ELECTRICITY">Electricity / Power</option>
                <option value="CLEANLINESS">Cleanliness / Hygiene</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="SECURITY">Security</option>
                <option value="FACILITY">Facility</option>
                <option value="STAFF">Staff</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                Priority *
              </label>
              <select
                className="form-control"
                value={formPriority}
                onChange={(e) => setFormPriority(e.target.value)}
                required
              >
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
              Associated Resident (Optional)
            </label>
            <select
              className="form-control"
              value={formStudentId}
              onChange={(e) => setFormStudentId(e.target.value)}
            >
              <option value="">General Facility / Non-Student Specific</option>
              {students.map((s) => (
                <option key={s.student_id || s.id} value={s.student_id || s.id}>
                  {s.full_name || s.first_name} ({s.admission_number || s.roll_number || 'Reg'} - Room {s.room_name || s.room_code || '—'})
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
              Complaint Subject / Title *
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Broken window latch in Room 204"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              required
            />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
              Detailed Description *
            </label>
            <textarea
              className="form-control"
              rows={4}
              placeholder="Provide complete details of the issue, location, and severity..."
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              required
            />
          </div>
        </form>
      </Modal>

      {/* Assign Complaint Modal */}
      <Modal
        isOpen={assignModalOpen}
        onClose={() => !isSubmittingAssign && setAssignModalOpen(false)}
        title="Assign Complaint to Staff"
        maxWidth="500px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', width: '100%' }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setAssignModalOpen(false)}
              disabled={isSubmittingAssign}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleAssignSubmit}
              disabled={isSubmittingAssign || !assignStaffId}
            >
              {isSubmittingAssign ? 'Assigning...' : 'Confirm Assignment'}
            </button>
          </div>
        }
      >
        {selectedComplaint && (
          <form onSubmit={handleAssignSubmit}>
            {modalError && (
              <div style={{ marginBottom: '12px', padding: '8px 12px', backgroundColor: '#fef2f2', color: '#b91c1c', borderRadius: '6px', fontSize: '0.82rem' }}>
                {modalError}
              </div>
            )}

            <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '6px', marginBottom: '14px', fontSize: '0.85rem' }}>
              <strong>{selectedComplaint.complaint_number || 'CMP'}</strong>: {selectedComplaint.title}
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                Select Staff Member *
              </label>
              {staffList.length === 0 ? (
                <div style={{ padding: '10px 12px', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: '6px', fontSize: '0.82rem' }}>
                  No active institutional staff members found in directory. Assignment is disabled.
                </div>
              ) : (
                <select
                  className="form-control"
                  value={assignStaffId}
                  onChange={(e) => setAssignStaffId(e.target.value)}
                  required
                >
                  <option value="">-- Choose Staff Member --</option>
                  {staffList.map((st) => {
                    // Foreign key app.complaints.assigned_to points to app.users(user_id)
                    const val = st.user_id || st.id || st.staff_id;
                    const name = st.first_name
                      ? `${st.first_name} ${st.last_name || ''}`.trim()
                      : st.full_name || st.name || 'Staff Member';
                    const designation = st.designation || st.role || 'Staff';
                    const empNo = st.employee_number ? ` • ${st.employee_number}` : '';
                    return (
                      <option key={val} value={val}>
                        {name} ({designation}{empNo})
                      </option>
                    );
                  })}
                </select>
              )}
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                Assignment Note / Instructions
              </label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="Specific instructions or expected completion deadline..."
                value={assignMessage}
                onChange={(e) => setAssignMessage(e.target.value)}
              />
            </div>
          </form>
        )}
      </Modal>

      {/* Update Status Modal */}
      <Modal
        isOpen={statusModalOpen}
        onClose={() => !isSubmittingStatus && setStatusModalOpen(false)}
        title="Update Complaint Status"
        maxWidth="500px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', width: '100%' }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setStatusModalOpen(false)}
              disabled={isSubmittingStatus}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleStatusSubmit}
              disabled={isSubmittingStatus || !statusMessage.trim()}
            >
              {isSubmittingStatus ? 'Updating...' : 'Update Status'}
            </button>
          </div>
        }
      >
        {selectedComplaint && (
          <form onSubmit={handleStatusSubmit}>
            {modalError && (
              <div style={{ marginBottom: '12px', padding: '8px 12px', backgroundColor: '#fef2f2', color: '#b91c1c', borderRadius: '6px', fontSize: '0.82rem' }}>
                {modalError}
              </div>
            )}

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                New Status *
              </label>
              <select
                className="form-control"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                required
              >
                <option value="IN_PROGRESS">In Progress</option>
                <option value="CLOSED">Closed</option>
                <option value="REJECTED">Rejected</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="REOPENED">Reopened</option>
              </select>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                Status Update Message * (Required for Audit Trail)
              </label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="State the reason or operational progress for this status update..."
                value={statusMessage}
                onChange={(e) => setStatusMessage(e.target.value)}
                required
              />
            </div>
          </form>
        )}
      </Modal>

      {/* Resolve Complaint Modal */}
      <Modal
        isOpen={resolveModalOpen}
        onClose={() => !isSubmittingResolve && setResolveModalOpen(false)}
        title="Resolve Grievance / Complaint"
        maxWidth="520px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', width: '100%' }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setResolveModalOpen(false)}
              disabled={isSubmittingResolve}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-success"
              onClick={handleResolveSubmit}
              disabled={isSubmittingResolve || !resolveRemarks.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <CheckCircle2 size={15} />
              <span>{isSubmittingResolve ? 'Resolving...' : 'Confirm Resolution'}</span>
            </button>
          </div>
        }
      >
        {selectedComplaint && (
          <form onSubmit={handleResolveSubmit}>
            {modalError && (
              <div style={{ marginBottom: '12px', padding: '8px 12px', backgroundColor: '#fef2f2', color: '#b91c1c', borderRadius: '6px', fontSize: '0.82rem' }}>
                {modalError}
              </div>
            )}

            <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '6px', marginBottom: '14px', fontSize: '0.85rem' }}>
              <strong>{selectedComplaint.complaint_number || 'CMP'}</strong>: {selectedComplaint.title}
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                Resolution Remarks *
              </label>
              <textarea
                className="form-control"
                rows={4}
                placeholder="Describe the action taken, repair performed, or outcome that resolved this issue..."
                value={resolveRemarks}
                onChange={(e) => setResolveRemarks(e.target.value)}
                required
              />
            </div>
          </form>
        )}
      </Modal>

      {/* Complaint Dossier & Updates History Modal */}
      <Modal
        isOpen={dossierModalOpen}
        onClose={() => setDossierModalOpen(false)}
        title="Complaint Dossier & Updates Audit"
        maxWidth="700px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              {selectedComplaint && selectedComplaint.status !== 'RESOLVED' && selectedComplaint.status !== 'CLOSED' && (
                <>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => {
                      setDossierModalOpen(false);
                      setAssignStaffId(selectedComplaint.assigned_to || '');
                      setAssignModalOpen(true);
                    }}
                    style={{ fontSize: '0.82rem' }}
                  >
                    Assign Staff
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => {
                      setDossierModalOpen(false);
                      setNewStatus('IN_PROGRESS');
                      setStatusModalOpen(true);
                    }}
                    style={{ fontSize: '0.82rem' }}
                  >
                    Update Status
                  </button>
                  <button
                    type="button"
                    className="btn btn-success"
                    onClick={() => {
                      setDossierModalOpen(false);
                      setResolveRemarks('');
                      setResolveModalOpen(true);
                    }}
                    style={{ fontSize: '0.82rem' }}
                  >
                    Resolve
                  </button>
                </>
              )}
            </div>
            <button type="button" className="btn btn-primary" onClick={() => setDossierModalOpen(false)}>
              Close
            </button>
          </div>
        }
      >
        {selectedComplaint && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Header Particulars */}
            <div
              style={{
                padding: '16px',
                backgroundColor: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '0.78rem', fontFamily: 'monospace', color: 'var(--primary-color)', fontWeight: 700 }}>
                    {selectedComplaint.complaint_number || selectedComplaint.id}
                  </div>
                  <h3 style={{ margin: '4px 0', fontSize: '1.15rem', color: 'var(--text-primary)' }}>
                    {selectedComplaint.title}
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Category: <strong>{selectedComplaint.category}</strong> • Priority:{' '}
                    <strong>{selectedComplaint.priority}</strong>
                  </div>
                </div>
                <div>{getStatusBadge(selectedComplaint.status)}</div>
              </div>
            </div>

            {/* Description */}
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '6px' }}>
                Statement of Grievance
              </div>
              <div
                style={{
                  padding: '14px',
                  backgroundColor: '#ffffff',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.88rem',
                  lineHeight: 1.5,
                  color: 'var(--text-primary)',
                }}
              >
                {selectedComplaint.description}
              </div>
            </div>

            {/* Resolution Statement (if resolved) */}
            {selectedComplaint.resolution && (
              <div
                style={{
                  padding: '14px',
                  backgroundColor: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  borderRadius: '6px',
                }}
              >
                <div style={{ fontSize: '0.8rem', color: '#065f46', fontWeight: 700, marginBottom: '4px' }}>
                  Resolution Statement (Resolved on {formatDate(selectedComplaint.resolved_at)})
                </div>
                <div style={{ fontSize: '0.85rem', color: '#047857', lineHeight: 1.4 }}>
                  {selectedComplaint.resolution}
                </div>
              </div>
            )}

            {/* Linkage Particulars */}
            <div className="grid-2" style={{ gap: '10px' }}>
              <div style={{ padding: '10px 14px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Resident: </span>
                <strong>{selectedComplaint.studentName}</strong> {selectedComplaint.roomNumber !== '—' && `(Room ${selectedComplaint.roomNumber})`}
              </div>
              <div style={{ padding: '10px 14px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Assigned Staff: </span>
                <strong>{selectedComplaint.staffName}</strong>
              </div>
            </div>

            {/* Updates Audit Trail Timeline */}
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={15} color="var(--primary-color)" />
                <span>Chronological Updates & Audit History</span>
              </div>

              {loadingUpdates ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  Loading update history...
                </div>
              ) : complaintUpdates.length === 0 ? (
                <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                  No intermediate update events recorded.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {complaintUpdates.map((u, idx) => (
                    <div
                      key={u.id || idx}
                      style={{
                        padding: '10px 14px',
                        backgroundColor: '#ffffff',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {u.update_type}: {u.message || 'Status updated'}
                        </div>
                        {u.new_status && (
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            Transition: {u.previous_status || 'INITIAL'} → <strong>{u.new_status}</strong>
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {formatDateTime(u.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
