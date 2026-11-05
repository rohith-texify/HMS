import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import inchargeService from '../services/inchargeService';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import SearchInput from '../components/SearchInput';
import Modal from '../components/Modal';
import ConfirmationDialog from '../components/ConfirmationDialog';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import Badge from '../components/Badge';
import {
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  RefreshCw,
  Eye,
  MapPin,
  Phone,
  X,
  AlertCircle,
  LayoutGrid,
  List,
  Download,
  Footprints
} from 'lucide-react';

export default function LeavesPage() {
  useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // URL query params for cross-module deep linking
  const studentIdParam = searchParams.get('studentId');
  const leaveIdParam = searchParams.get('leaveId');

  // Master Data State
  const [leaves, setLeaves] = useState([]);
  const [students, setStudents] = useState([]);
  const [summary, setSummary] = useState(null);

  // UI & Loading States
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successBanner, setSuccessBanner] = useState(null);

  // Display View: CARDS or TABLE
  const [displayMode, setDisplayMode] = useState('TABLE');

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [dateQuickFilter, setDateQuickFilter] = useState('ALL');

  // Modal State
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState(null);

  // Decision Form State
  const [decisionType, setDecisionType] = useState('APPROVED'); // 'APPROVED' | 'REJECTED'
  const [decisionRemarks, setDecisionRemarks] = useState('');
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);
  const [decisionError, setDecisionError] = useState(null);

  // Cancellation State
  const [isCancelling, setIsCancelling] = useState(false);

  // Fast Student Lookup Map
  const studentMap = useMemo(() => {
    const map = new Map();
    students.forEach((s) => {
      const id = s.student_id || s.id;
      if (id) map.set(id, s);
    });
    return map;
  }, [students]);

  // Load Data
  const loadData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setLoading(true);
    setErrorMessage(null);

    try {
      const [leavesRes, studentsRes, summaryRes] = await Promise.allSettled([
        inchargeService.getLeaves(),
        inchargeService.getStudents(),
        inchargeService.getLeaveSummary(),
      ]);

      let leavesList = [];
      if (leavesRes.status === 'fulfilled') {
        const val = leavesRes.value;
        leavesList = Array.isArray(val) ? val : val?.leaves || val?.data || [];
        setLeaves(leavesList);
      } else {
        console.warn('Leaves fetch warning:', leavesRes.reason);
      }

      if (studentsRes.status === 'fulfilled') {
        const val = studentsRes.value;
        const sList = Array.isArray(val) ? val : val?.students || val?.data || [];
        setStudents(sList);
      }

      if (summaryRes.status === 'fulfilled') {
        const val = summaryRes.value;
        setSummary(val?.data || val);
      }

      // Check if deep linked leaveId exists
      if (leaveIdParam && leavesList.length > 0) {
        const target = leavesList.find((l) => (l.id || l.leave_id) === leaveIdParam);
        if (target) {
          setSelectedLeave(target);
          setDetailsModalOpen(true);
        }
      }
    } catch (err) {
      console.error('Error loading leaves:', err);
      setErrorMessage(err.message || 'Failed to load leave records.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [leaveIdParam]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Set studentId filter if provided in query param
  useEffect(() => {
    if (studentIdParam && students.length > 0) {
      const s = studentMap.get(studentIdParam);
      if (s) {
        setSearchTerm(s.full_name || s.first_name || s.admission_number || s.roll_number || '');
      }
    }
  }, [studentIdParam, students, studentMap]);

  // Auto-dismiss success toast
  useEffect(() => {
    if (successBanner) {
      const t = setTimeout(() => setSuccessBanner(null), 5000);
      return () => clearTimeout(t);
    }
  }, [successBanner]);

  // Format Helper
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

  
  // Leave Type Label & Badge Color
  const getLeaveTypeBadge = (type) => {
    const t = (type || 'OTHER').toUpperCase();
    switch (t) {
      case 'DAY_LEAVE':
        return <Badge variant="info">Day Outing</Badge>;
      case 'OVERNIGHT':
        return <Badge variant="primary">Overnight</Badge>;
      case 'WEEKEND':
        return <Badge variant="secondary">Weekend</Badge>;
      case 'EMERGENCY':
        return <Badge variant="danger">Emergency</Badge>;
      case 'MEDICAL':
        return <Badge variant="warning">Medical</Badge>;
      default:
        return <Badge variant="neutral">{type || 'Standard'}</Badge>;
    }
  };

  // Status Badge
  const getStatusBadge = (status) => {
    const s = (status || 'PENDING').toUpperCase();
    switch (s) {
      case 'APPROVED':
        return <Badge variant="success">Approved</Badge>;
      case 'PENDING':
        return <Badge variant="warning">Pending Review</Badge>;
      case 'REJECTED':
        return <Badge variant="danger">Rejected</Badge>;
      case 'CANCELLED':
        return <Badge variant="neutral">Cancelled</Badge>;
      case 'COMPLETED':
        return <Badge variant="info">Completed</Badge>;
      case 'EXPIRED':
        return <Badge variant="neutral">Expired</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  // Enriched Leaves with Student Information
  const enrichedLeaves = useMemo(() => {
    return leaves.map((leave) => {
      const student = studentMap.get(leave.student_id);
      const studentName = student
        ? student.full_name || `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Resident Student'
        : 'Resident Student';
      const regNumber = student?.admission_number || student?.roll_number || student?.reg_number || '—';
      const roomNumber = student?.room_name || student?.room_code || student?.room_number || '—';
      const bedName = student?.bed_name || student?.bed_label || '';
      const phone = leave.contact_phone || student?.phone || '—';
      const department = student?.department || student?.branch || '—';
      const year = student?.year || student?.semester || '—';

      // Duration calculation
      let daysCount = 1;
      if (leave.from_date && leave.to_date) {
        const start = new Date(leave.from_date);
        const end = new Date(leave.to_date);
        const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        daysCount = diff >= 0 ? diff + 1 : 1;
      }

      return {
        ...leave,
        studentName,
        regNumber,
        roomNumber,
        bedName,
        phone,
        department,
        year,
        daysCount,
      };
    });
  }, [leaves, studentMap]);

  // Filtering Logic
  const filteredLeaves = useMemo(() => {
    return enrichedLeaves.filter((l) => {
      // Search term
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesName = l.studentName.toLowerCase().includes(term);
        const matchesReg = l.regNumber.toLowerCase().includes(term);
        const matchesDest = (l.destination || '').toLowerCase().includes(term);
        const matchesReason = (l.reason || '').toLowerCase().includes(term);
        const matchesRoom = l.roomNumber.toLowerCase().includes(term);
        if (!matchesName && !matchesReg && !matchesDest && !matchesReason && !matchesRoom) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'ALL') {
        if ((l.status || '').toUpperCase() !== statusFilter) return false;
      }

      // Leave Type filter
      if (typeFilter !== 'ALL') {
        if ((l.leave_type || '').toUpperCase() !== typeFilter) return false;
      }

      // Quick Date filter
      if (dateQuickFilter !== 'ALL') {
        const now = new Date();
        const start = l.from_date ? new Date(l.from_date) : null;
        const end = l.to_date ? new Date(l.to_date) : null;

        if (dateQuickFilter === 'ACTIVE_NOW') {
          if (!start || !end) return false;
          if (now < start || now > end) return false;
        } else if (dateQuickFilter === 'TODAY') {
          if (!start) return false;
          const todayStr = now.toISOString().slice(0, 10);
          const startStr = start.toISOString().slice(0, 10);
          if (todayStr !== startStr) return false;
        }
      }

      return true;
    });
  }, [enrichedLeaves, searchTerm, statusFilter, typeFilter, dateQuickFilter]);

  // Dynamic KPI Stats
  const metrics = useMemo(() => {
    const total = leaves.length;
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let cancelled = 0;

    leaves.forEach((l) => {
      const s = (l.status || '').toUpperCase();
      if (s === 'PENDING') pending++;
      else if (s === 'APPROVED') approved++;
      else if (s === 'REJECTED') rejected++;
      else if (s === 'CANCELLED') cancelled++;
    });

    return {
      total: summary?.total ?? total,
      pending: summary?.pending ?? pending,
      approved: summary?.approved ?? approved,
      rejected: summary?.rejected ?? rejected,
      cancelled: summary?.cancelled ?? cancelled,
    };
  }, [leaves, summary]);

  // Open Decision Modal
  const handleOpenDecision = (leave, defaultDecision = 'APPROVED') => {
    setSelectedLeave(leave);
    setDecisionType(defaultDecision);
    setDecisionRemarks(
      defaultDecision === 'APPROVED' ? 'Approved by Hostel In-Charge.' : ''
    );
    setDecisionError(null);
    setDecisionModalOpen(true);
  };

  // Submit Decision
  const handleProcessDecision = async (e) => {
    if (e) e.preventDefault();
    if (!selectedLeave) return;

    if (decisionType === 'REJECTED' && !decisionRemarks.trim()) {
      setDecisionError('Please specify a rejection reason for institutional audit.');
      return;
    }

    setIsSubmittingDecision(true);
    setDecisionError(null);

    try {
      const leaveId = selectedLeave.id || selectedLeave.leave_id;
      await inchargeService.processLeaveDecision(leaveId, {
        decision: decisionType,
        remarks: decisionRemarks.trim() || undefined,
      });

      setSuccessBanner(
        `Leave request for ${selectedLeave.studentName} has been ${decisionType.toLowerCase()} successfully.`
      );

      setDecisionModalOpen(false);
      setDetailsModalOpen(false);
      setSelectedLeave(null);
      await loadData(false);
    } catch (err) {
      console.error('Failed to submit decision:', err);
      setDecisionError(err.response?.data?.error?.message || err.message || 'Failed to submit leave decision.');
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  // Cancel Leave Request (for In-Charge)
  const handleConfirmCancel = async () => {
    if (!selectedLeave) return;
    setIsCancelling(true);

    try {
      const leaveId = selectedLeave.id || selectedLeave.leave_id;
      await inchargeService.cancelLeaveRequest(leaveId);
      setSuccessBanner(`Leave request for ${selectedLeave.studentName} has been cancelled.`);
      setCancelModalOpen(false);
      setDetailsModalOpen(false);
      setSelectedLeave(null);
      await loadData(false);
    } catch (err) {
      alert(`Failed to cancel leave: ${err.response?.data?.error?.message || err.message}`);
    } finally {
      setIsCancelling(false);
    }
  };

  // Export Filtered Records to CSV
  const handleExportCSV = () => {
    if (filteredLeaves.length === 0) return;

    const headers = [
      'Student Name',
      'Register Number',
      'Room & Bed',
      'Department',
      'Leave Type',
      'From Date',
      'To Date',
      'Days',
      'Destination',
      'Contact Phone',
      'Reason',
      'Status',
      'Requested At',
    ];

    const rows = filteredLeaves.map((l) => [
      `"${l.studentName}"`,
      `"${l.regNumber}"`,
      `"${l.roomNumber} ${l.bedName}"`,
      `"${l.department}"`,
      `"${l.leave_type}"`,
      `"${formatDate(l.from_date)}"`,
      `"${formatDate(l.to_date)}"`,
      l.daysCount,
      `"${l.destination || '—'}"`,
      `"${l.phone || '—'}"`,
      `"${(l.reason || '').replace(/"/g, '""')}"`,
      `"${l.status}"`,
      `"${formatDate(l.requested_at || l.created_at)}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Hostel_Leaves_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Table Columns Definition
  const columns = [
    {
      header: 'Resident Student',
      accessor: 'studentName',
      cell: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: 'var(--primary-light, #eff6ff)',
              color: 'var(--primary-color, #2563eb)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '0.85rem',
              flexShrink: 0,
            }}
          >
            {row.studentName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div
              style={{
                fontWeight: 600,
                color: 'var(--primary-color)',
                cursor: 'pointer',
              }}
              onClick={() => navigate(`/students?search=${encodeURIComponent(row.regNumber || row.studentName)}`)}
              title="View student profile in resident directory"
            >
              {row.studentName}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Reg: <strong>{row.regNumber}</strong> • Room {row.roomNumber}
            </div>
          </div>
        </div>
      ),
    },
    {
      header: 'Type & Purpose',
      accessor: 'leave_type',
      cell: (row) => (
        <div>
          <div style={{ marginBottom: '4px' }}>{getLeaveTypeBadge(row.leave_type)}</div>
          <div
            style={{
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              maxWidth: '220px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={row.reason}
          >
            {row.reason}
          </div>
        </div>
      ),
    },
    {
      header: 'Travel Window',
      accessor: 'from_date',
      cell: (row) => (
        <div>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {formatDate(row.from_date)} → {formatDate(row.to_date)}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Duration: <strong>{row.daysCount} {row.daysCount === 1 ? 'day' : 'days'}</strong>
          </div>
        </div>
      ),
    },
    {
      header: 'Destination & Phone',
      accessor: 'destination',
      cell: (row) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem' }}>
            <MapPin size={13} color="var(--text-secondary)" />
            <span>{row.destination || 'Family Residence'}</span>
          </div>
          {row.phone && row.phone !== '—' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              <Phone size={11} />
              <span>{row.phone}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      cell: (row) => getStatusBadge(row.status),
    },
    {
      header: 'Actions',
      accessor: 'id',
      cell: (row) => {
        const isPending = (row.status || '').toUpperCase() === 'PENDING';
        const isApproved = (row.status || '').toUpperCase() === 'APPROVED';

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isPending && (
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => handleOpenDecision(row, 'APPROVED')}
                style={{ fontSize: '0.78rem', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                title="Review application"
              >
                <CheckCircle2 size={13} />
                <span>Review</span>
              </button>
            )}

            {isApproved && (
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => navigate(`/gate-passes?leaveId=${row.id || row.leave_id}`)}
                style={{ fontSize: '0.78rem', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '4px', borderColor: '#10b981', color: '#047857' }}
                title="View active gate clearance voucher"
              >
                <Footprints size={13} />
                <span>Gate Pass</span>
              </button>
            )}

            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => {
                setSelectedLeave(row);
                setDetailsModalOpen(true);
              }}
              style={{ fontSize: '0.78rem', padding: '5px 8px' }}
              title="Inspect complete leave particulars"
            >
              <Eye size={14} />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div style={{ paddingBottom: '40px' }}>
      {/* Page Header */}
      <PageHeader
        title="Student Leave & Outing Requests"
        description="Review, verify, and approve overnight, weekend, medical, and emergency leaves for resident students."
        icon={FileText}
        actions={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
              disabled={filteredLeaves.length === 0}
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

      {/* Success Notification Banner */}
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

      {/* KPI Stats Summary Cards */}
      <div className="grid-4" style={{ marginBottom: '24px' }}>
        <div className="card stat-card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Total Requests
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
              <FileText size={20} />
            </div>
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
            All recorded leave applications
          </div>
        </div>

        <div
          className="card stat-card"
          style={{
            padding: '18px',
            borderLeft: metrics.pending > 0 ? '4px solid #f59e0b' : '1px solid var(--border-color)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: '#b45309', fontWeight: 600 }}>
                Pending Review
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#d97706', marginTop: '4px' }}>
                {metrics.pending}
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
            {metrics.pending > 0 ? 'Requires in-charge decision' : 'Queue cleared'}
          </div>
        </div>

        <div className="card stat-card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: '#047857', fontWeight: 600 }}>
                Approved Clearances
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
                {metrics.approved}
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
            Gate passes generated
          </div>
        </div>

        <div className="card stat-card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Rejected / Cancelled
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-secondary)', marginTop: '4px' }}>
                {metrics.rejected + metrics.cancelled}
              </div>
            </div>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '8px',
                backgroundColor: '#f1f5f9',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <XCircle size={20} />
            </div>
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
            Audit preserved applications
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
            placeholder="Search student, reg number, room, destination, reason..."
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
            style={{ width: 'auto', minWidth: '140px', fontSize: '0.85rem' }}
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending Review</option>
            <option value="APPROVED">Approved (Gate Pass)</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          {/* Type Filter */}
          <select
            className="form-control"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{ width: 'auto', minWidth: '140px', fontSize: '0.85rem' }}
          >
            <option value="ALL">All Leave Types</option>
            <option value="DAY_LEAVE">Day Outing</option>
            <option value="OVERNIGHT">Overnight Leave</option>
            <option value="WEEKEND">Weekend Leave</option>
            <option value="EMERGENCY">Emergency Leave</option>
            <option value="MEDICAL">Medical Leave</option>
            <option value="OTHER">Other Purpose</option>
          </select>

          {/* Quick Date Filter */}
          <select
            className="form-control"
            value={dateQuickFilter}
            onChange={(e) => setDateQuickFilter(e.target.value)}
            style={{ width: 'auto', minWidth: '130px', fontSize: '0.85rem' }}
          >
            <option value="ALL">All Dates</option>
            <option value="ACTIVE_NOW">Away Today</option>
            <option value="TODAY">Departing Today</option>
          </select>

          {/* Reset Filters */}
          {(searchTerm || statusFilter !== 'ALL' || typeFilter !== 'ALL' || dateQuickFilter !== 'ALL') && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('ALL');
                setTypeFilter('ALL');
                setDateQuickFilter('ALL');
              }}
              style={{ fontSize: '0.82rem', padding: '6px 10px' }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <LoadingState title="Loading leave records..." rows={5} />
      ) : errorMessage ? (
        <ErrorState
          title="Failed to Load Leaves"
          message={errorMessage}
          onRetry={() => loadData(false)}
        />
      ) : filteredLeaves.length === 0 ? (
        <EmptyState
          title="No Leave Records Found"
          description={
            searchTerm || statusFilter !== 'ALL' || typeFilter !== 'ALL'
              ? 'No leave requests match your search criteria. Try adjusting or clearing filters.'
              : 'There are currently no student leave requests on record.'
          }
          icon={FileText}
          action={
            (searchTerm || statusFilter !== 'ALL' || typeFilter !== 'ALL') && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('ALL');
                  setTypeFilter('ALL');
                  setDateQuickFilter('ALL');
                }}
              >
                Clear Filters
              </button>
            )
          }
        />
      ) : displayMode === 'TABLE' ? (
        <div className="card" style={{ overflow: 'hidden' }}>
          <DataTable
            columns={columns}
            data={filteredLeaves}
            keyField="id"
          />
        </div>
      ) : (
        /* Card Grid View */
        <div className="grid-3" style={{ gap: '16px' }}>
          {filteredLeaves.map((l) => {
            const isPending = (l.status || '').toUpperCase() === 'PENDING';
            const isApproved = (l.status || '').toUpperCase() === 'APPROVED';

            return (
              <div
                key={l.id || l.leave_id}
                className="card"
                style={{
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderTop: isPending
                    ? '3px solid #f59e0b'
                    : isApproved
                    ? '3px solid #10b981'
                    : '1px solid var(--border-color)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: '1rem',
                          color: 'var(--primary-color)',
                          cursor: 'pointer',
                        }}
                        onClick={() => navigate(`/students?search=${encodeURIComponent(l.regNumber || l.studentName)}`)}
                      >
                        {l.studentName}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        Reg: {l.regNumber} • Room {l.roomNumber}
                      </div>
                    </div>
                    <div>{getStatusBadge(l.status)}</div>
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'inline-block', marginBottom: '6px' }}>
                      {getLeaveTypeBadge(l.leave_type)}
                    </div>
                    <p
                      style={{
                        fontSize: '0.82rem',
                        color: 'var(--text-secondary)',
                        fontStyle: 'italic',
                        margin: 0,
                        lineHeight: 1.4,
                      }}
                    >
                      &ldquo;{l.reason}&rdquo;
                    </p>
                  </div>

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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
                      <Calendar size={13} color="var(--primary-color)" />
                      <span>
                        <strong>{formatDate(l.from_date)}</strong> → <strong>{formatDate(l.to_date)}</strong> ({l.daysCount}d)
                      </span>
                    </div>
                    {l.destination && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                        <MapPin size={13} />
                        <span>{l.destination}</span>
                      </div>
                    )}
                    {l.phone && l.phone !== '—' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                        <Phone size={13} />
                        <span>{l.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                    justifyContent: 'flex-end',
                    paddingTop: '12px',
                    borderTop: '1px solid var(--border-color)',
                  }}
                >
                  {isPending && (
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => handleOpenDecision(l, 'APPROVED')}
                      style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <CheckCircle2 size={13} />
                      <span>Review</span>
                    </button>
                  )}

                  {isApproved && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={() => navigate(`/gate-passes?leaveId=${l.id || l.leave_id}`)}
                      style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px', borderColor: '#10b981', color: '#047857' }}
                    >
                      <Footprints size={13} />
                      <span>Gate Pass</span>
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => {
                      setSelectedLeave(l);
                      setDetailsModalOpen(true);
                    }}
                    style={{ fontSize: '0.78rem' }}
                  >
                    Details
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Leave Details Dossier Modal */}
      <Modal
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        title="Leave Application Dossier"
        maxWidth="680px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <div>
              {selectedLeave && (selectedLeave.status || '').toUpperCase() === 'APPROVED' && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setDetailsModalOpen(false);
                    setCancelModalOpen(true);
                  }}
                  style={{ color: '#ef4444', fontSize: '0.82rem' }}
                >
                  Revoke / Cancel Leave
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {selectedLeave && (selectedLeave.status || '').toUpperCase() === 'PENDING' && (
                <>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => {
                      setDetailsModalOpen(false);
                      handleOpenDecision(selectedLeave, 'REJECTED');
                    }}
                    style={{ fontSize: '0.85rem' }}
                  >
                    Reject Application
                  </button>
                  <button
                    type="button"
                    className="btn btn-success"
                    onClick={() => {
                      setDetailsModalOpen(false);
                      handleOpenDecision(selectedLeave, 'APPROVED');
                    }}
                    style={{ fontSize: '0.85rem' }}
                  >
                    Approve Application
                  </button>
                </>
              )}
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setDetailsModalOpen(false)}
                style={{ fontSize: '0.85rem' }}
              >
                Close
              </button>
            </div>
          </div>
        }
      >
        {selectedLeave && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Student Identification Banner */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '16px',
                backgroundColor: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--primary-color)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '1.1rem',
                  flexShrink: 0,
                }}
              >
                {selectedLeave.studentName.slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {selectedLeave.studentName}
                  </h4>
                  {getStatusBadge(selectedLeave.status)}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Reg: <strong>{selectedLeave.regNumber}</strong> • Room: <strong>{selectedLeave.roomNumber} ({selectedLeave.bedName || 'Bed'})</strong> • Dept: <strong>{selectedLeave.department}</strong>
                </div>
              </div>
            </div>

            {/* Application Particulars */}
            <div>
              <h5 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Application Particulars
              </h5>
              <div className="grid-2" style={{ gap: '12px' }}>
                <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Leave Classification</div>
                  <div style={{ marginTop: '4px' }}>{getLeaveTypeBadge(selectedLeave.leave_type)}</div>
                </div>

                <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Requested Schedule</div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', marginTop: '2px' }}>
                    {formatDate(selectedLeave.from_date)} → {formatDate(selectedLeave.to_date)}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                    Total {selectedLeave.daysCount} days
                  </div>
                </div>

                <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Destination Address / City</div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', marginTop: '2px' }}>
                    {selectedLeave.destination || 'Not specified (Family Residence)'}
                  </div>
                </div>

                <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Emergency Contact Phone</div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', marginTop: '2px' }}>
                    {selectedLeave.phone || 'Not provided'}
                  </div>
                </div>
              </div>
            </div>

            {/* Travel Reason */}
            <div>
              <h5 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Reason & Travel Purpose
              </h5>
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
                {selectedLeave.reason || 'No statement provided.'}
              </div>
            </div>

            {/* Audit Timestamps */}
            <div
              style={{
                padding: '12px 16px',
                backgroundColor: '#f1f5f9',
                borderRadius: '6px',
                fontSize: '0.76rem',
                color: 'var(--text-secondary)',
                display: 'flex',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <span>Application ID: <code style={{ fontSize: '0.74rem' }}>{selectedLeave.id || selectedLeave.leave_id}</code></span>
              <span>Submitted: {formatDate(selectedLeave.requested_at || selectedLeave.created_at)}</span>
            </div>
          </div>
        )}
      </Modal>

      {/* Decision Review Modal */}
      <Modal
        isOpen={decisionModalOpen}
        onClose={() => !isSubmittingDecision && setDecisionModalOpen(false)}
        title={decisionType === 'APPROVED' ? 'Approve Leave Request' : 'Reject Leave Request'}
        maxWidth="540px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', width: '100%' }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setDecisionModalOpen(false)}
              disabled={isSubmittingDecision}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`btn ${decisionType === 'APPROVED' ? 'btn-success' : 'btn-danger'}`}
              onClick={handleProcessDecision}
              disabled={isSubmittingDecision}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {isSubmittingDecision ? (
                <>
                  <RefreshCw size={14} className="spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  {decisionType === 'APPROVED' ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                  <span>Confirm {decisionType === 'APPROVED' ? 'Approval' : 'Rejection'}</span>
                </>
              )}
            </button>
          </div>
        }
      >
        {selectedLeave && (
          <form onSubmit={handleProcessDecision}>
            {decisionError && (
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
                <span>{decisionError}</span>
              </div>
            )}

            <div
              style={{
                padding: '14px',
                backgroundColor: '#f8fafc',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                marginBottom: '16px',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                {selectedLeave.studentName} ({selectedLeave.regNumber})
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {selectedLeave.leave_type} • {formatDate(selectedLeave.from_date)} → {formatDate(selectedLeave.to_date)}
              </div>
            </div>

            {/* Decision Toggle */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px' }}>
                Decision Outcome
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setDecisionType('APPROVED');
                    setDecisionRemarks('Approved by Hostel In-Charge.');
                  }}
                  style={{
                    padding: '10px',
                    borderRadius: '6px',
                    border: decisionType === 'APPROVED' ? '2px solid #10b981' : '1px solid var(--border-color)',
                    backgroundColor: decisionType === 'APPROVED' ? '#ecfdf5' : 'var(--bg-surface)',
                    color: decisionType === 'APPROVED' ? '#047857' : 'var(--text-secondary)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <CheckCircle2 size={16} />
                  <span>Approve</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDecisionType('REJECTED');
                    setDecisionRemarks('');
                  }}
                  style={{
                    padding: '10px',
                    borderRadius: '6px',
                    border: decisionType === 'REJECTED' ? '2px solid #ef4444' : '1px solid var(--border-color)',
                    backgroundColor: decisionType === 'REJECTED' ? '#fef2f2' : 'var(--bg-surface)',
                    color: decisionType === 'REJECTED' ? '#b91c1c' : 'var(--text-secondary)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <XCircle size={16} />
                  <span>Reject</span>
                </button>
              </div>
            </div>

            {/* Remarks Field */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                Decision Remarks {decisionType === 'REJECTED' && <span style={{ color: '#ef4444' }}>* (Required)</span>}
              </label>
              <textarea
                className="form-control"
                rows={3}
                placeholder={
                  decisionType === 'APPROVED'
                    ? 'Optional approval comments or gate instructions...'
                    : 'State the specific reason for rejecting this leave application...'
                }
                value={decisionRemarks}
                onChange={(e) => setDecisionRemarks(e.target.value)}
                required={decisionType === 'REJECTED'}
                style={{ width: '100%', resize: 'vertical' }}
              />
              <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                This record will be permanently logged in the audit ledger.
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* Revoke / Cancel Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={cancelModalOpen}
        title="Revoke Approved Leave"
        message={`Are you sure you want to cancel the approved leave for ${selectedLeave?.studentName}? Once revoked, any issued gate pass clearance will be invalidated.`}
        confirmText={isCancelling ? 'Revoking...' : 'Revoke Leave'}
        confirmVariant="danger"
        onConfirm={handleConfirmCancel}
        onCancel={() => setCancelModalOpen(false)}
        isLoading={isCancelling}
      />
    </div>
  );
}
