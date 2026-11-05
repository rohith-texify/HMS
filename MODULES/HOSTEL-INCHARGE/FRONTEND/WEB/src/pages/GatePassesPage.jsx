import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import inchargeService from '../services/inchargeService';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import SearchInput from '../components/SearchInput';
import Modal from '../components/Modal';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import {
  Footprints,
  ShieldCheck,
  AlertTriangle,
  Clock,
  RefreshCw,
  Eye,
  PhoneCall,
  LayoutGrid,
  List,
  Download,
  Printer,
  QrCode,
  DoorOpen
} from 'lucide-react';

export default function GatePassesPage() {
    const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Deep linking params
  const leaveIdParam = searchParams.get('leaveId');
  const studentIdParam = searchParams.get('studentId');

  // Master Data State
  const [leaves, setLeaves] = useState([]);
  const [students, setStudents] = useState([]);
  const [, setGates] = useState([]);

  // UI States
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // View Mode: TABLE or CARDS
  const [displayMode, setDisplayMode] = useState('TABLE');

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'OVERDUE' | 'AWAY' | 'TODAY' | 'SCHEDULED'
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Voucher Modal State
  const [selectedPass, setSelectedPass] = useState(null);
  const [voucherModalOpen, setVoucherModalOpen] = useState(false);

  // Fast Student Lookup Map
  const studentMap = useMemo(() => {
    const map = new Map();
    students.forEach((s) => {
      const id = s.student_id || s.id;
      if (id) map.set(id, s);
    });
    return map;
  }, [students]);

  // Load Clearance Passes & Metadata
  const loadData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setLoading(true);
    setErrorMessage(null);

    try {
      const [leavesRes, studentsRes, gatesRes] = await Promise.allSettled([
        inchargeService.getLeaves({ status: 'APPROVED' }),
        inchargeService.getStudents(),
        inchargeService.getGates(),
      ]);

      let approvedList = [];
      if (leavesRes.status === 'fulfilled') {
        const val = leavesRes.value;
        const raw = Array.isArray(val) ? val : val?.leaves || val?.data || [];
        // Keep approved leaves (active gate clearances)
        approvedList = raw.filter((l) => (l.status || '').toUpperCase() === 'APPROVED');
        setLeaves(approvedList);
      } else {
        console.warn('Failed to load leaves for gate passes:', leavesRes.reason);
      }

      if (studentsRes.status === 'fulfilled') {
        const val = studentsRes.value;
        const sList = Array.isArray(val) ? val : val?.students || val?.data || [];
        setStudents(sList);
      }

      if (gatesRes.status === 'fulfilled') {
        const val = gatesRes.value;
        setGates(Array.isArray(val) ? val : val?.gates || val?.data || []);
      }

      // Check if deep linked leaveId matches
      if (leaveIdParam && approvedList.length > 0) {
        const target = approvedList.find((l) => (l.id || l.leave_id) === leaveIdParam);
        if (target) {
          setSelectedPass(target);
          setVoucherModalOpen(true);
        }
      }
    } catch (err) {
      console.error('Error loading gate pass data:', err);
      setErrorMessage(err.message || 'Failed to load gate clearance records.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [leaveIdParam]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Set student search if linked
  useEffect(() => {
    if (studentIdParam && students.length > 0) {
      const s = studentMap.get(studentIdParam);
      if (s) {
        setSearchTerm(s.full_name || s.first_name || s.admission_number || '');
      }
    }
  }, [studentIdParam, students, studentMap]);

  // Date Format Helper
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

  
  // Enriched Passes with Curfew & Overdue Analysis
  const enrichedPasses = useMemo(() => {
    const now = new Date();

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

      // Parse Dates
      let startDate = leave.from_date ? new Date(leave.from_date) : null;
      let endDate = leave.to_date ? new Date(leave.to_date) : null;

      // Adjust return deadline to end of day if no specific time given
      let returnDeadline = endDate ? new Date(endDate) : null;
      if (returnDeadline) {
        if (leave.to_time) {
          const t = new Date(leave.to_time);
          if (!isNaN(t.getTime())) {
            returnDeadline.setHours(t.getHours(), t.getMinutes(), 0, 0);
          } else {
            returnDeadline.setHours(21, 30, 0, 0); // Default 9:30 PM curfew
          }
        } else {
          returnDeadline.setHours(21, 30, 0, 0); // Default 9:30 PM curfew
        }
      }

      // Departure Date
      let departureTime = startDate ? new Date(startDate) : null;
      if (departureTime && leave.from_time) {
        const t = new Date(leave.from_time);
        if (!isNaN(t.getTime())) {
          departureTime.setHours(t.getHours(), t.getMinutes(), 0, 0);
        }
      }

      // Curfew & Movement Evaluation
      let movementStatus = 'SCHEDULED';
      let isOverdue = false;
      let overdueText = '';

      if (returnDeadline && now > returnDeadline) {
        movementStatus = 'OVERDUE';
        isOverdue = true;

        const diffMs = now - returnDeadline;
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        if (diffHrs >= 24) {
          const days = Math.floor(diffHrs / 24);
          overdueText = `Overdue by ${days}d ${diffHrs % 24}h`;
        } else if (diffHrs > 0) {
          overdueText = `Overdue by ${diffHrs}h ${diffMins}m`;
        } else {
          overdueText = `Overdue by ${diffMins}m`;
        }
      } else if (startDate && now >= startDate) {
        const isToday =
          returnDeadline &&
          returnDeadline.getDate() === now.getDate() &&
          returnDeadline.getMonth() === now.getMonth() &&
          returnDeadline.getFullYear() === now.getFullYear();

        if (isToday) {
          movementStatus = 'TODAY';
        } else {
          movementStatus = 'AWAY';
        }
      } else {
        movementStatus = 'SCHEDULED';
      }

      return {
        ...leave,
        studentName,
        regNumber,
        roomNumber,
        bedName,
        phone,
        department,
        startDate,
        returnDeadline,
        departureTime,
        movementStatus,
        isOverdue,
        overdueText,
      };
    });
  }, [leaves, studentMap]);

  // Filtering Logic
  const filteredPasses = useMemo(() => {
    return enrichedPasses.filter((p) => {
      // Search
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesName = p.studentName.toLowerCase().includes(term);
        const matchesReg = p.regNumber.toLowerCase().includes(term);
        const matchesRoom = p.roomNumber.toLowerCase().includes(term);
        const matchesDest = (p.destination || '').toLowerCase().includes(term);
        const matchesReason = (p.reason || '').toLowerCase().includes(term);
        if (!matchesName && !matchesReg && !matchesRoom && !matchesDest && !matchesReason) {
          return false;
        }
      }

      // Status Filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'OVERDUE' && !p.isOverdue) return false;
        if (statusFilter === 'AWAY' && p.movementStatus !== 'AWAY') return false;
        if (statusFilter === 'TODAY' && p.movementStatus !== 'TODAY') return false;
        if (statusFilter === 'SCHEDULED' && p.movementStatus !== 'SCHEDULED') return false;
      }

      // Type Filter
      if (typeFilter !== 'ALL') {
        if ((p.leave_type || '').toUpperCase() !== typeFilter) return false;
      }

      return true;
    });
  }, [enrichedPasses, searchTerm, statusFilter, typeFilter]);

  // KPI Metrics Calculation
  const metrics = useMemo(() => {
    let overdueCount = 0;
    let awayCount = 0;
    let todayCount = 0;
    let scheduledCount = 0;

    enrichedPasses.forEach((p) => {
      if (p.isOverdue) overdueCount++;
      else if (p.movementStatus === 'AWAY') awayCount++;
      else if (p.movementStatus === 'TODAY') todayCount++;
      else if (p.movementStatus === 'SCHEDULED') scheduledCount++;
    });

    return {
      total: enrichedPasses.length,
      overdue: overdueCount,
      away: awayCount,
      today: todayCount,
      scheduled: scheduledCount,
    };
  }, [enrichedPasses]);

  // Print voucher
  const handlePrintVoucher = () => {
    window.print();
  };

  // CSV Export
  const handleExportCSV = () => {
    if (filteredPasses.length === 0) return;

    const headers = [
      'Pass Reference',
      'Student Name',
      'Register Number',
      'Room & Bed',
      'Department',
      'Outing Type',
      'Departure Date',
      'Return Deadline',
      'Movement Status',
      'Overdue Info',
      'Emergency Contact',
      'Destination',
      'Reason',
    ];

    const rows = filteredPasses.map((p) => [
      `"${p.id || p.leave_id}"`,
      `"${p.studentName}"`,
      `"${p.regNumber}"`,
      `"${p.roomNumber} ${p.bedName}"`,
      `"${p.department}"`,
      `"${p.leave_type}"`,
      `"${formatDate(p.from_date)}"`,
      `"${formatDate(p.to_date)}"`,
      `"${p.movementStatus}"`,
      `"${p.overdueText || 'None'}"`,
      `"${p.phone || '—'}"`,
      `"${p.destination || '—'}"`,
      `"${(p.reason || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Gate_Clearance_Passes_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Movement Status Badge Renderer
  const getMovementStatusBadge = (pass) => {
    if (pass.isOverdue) {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '4px 10px',
            backgroundColor: '#fef2f2',
            color: '#b91c1c',
            border: '1px solid #fecaca',
            borderRadius: '9999px',
            fontWeight: 700,
            fontSize: '0.75rem',
          }}
        >
          <AlertTriangle size={13} />
          <span>OVERDUE RETURN</span>
        </span>
      );
    }

    switch (pass.movementStatus) {
      case 'TODAY':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              backgroundColor: '#fffbeb',
              color: '#b45309',
              border: '1px solid #fde68a',
              borderRadius: '9999px',
              fontWeight: 600,
              fontSize: '0.75rem',
            }}
          >
            <Clock size={13} />
            <span>Returns Today</span>
          </span>
        );
      case 'AWAY':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              backgroundColor: '#eff6ff',
              color: '#1d4ed8',
              border: '1px solid #bfdbfe',
              borderRadius: '9999px',
              fontWeight: 600,
              fontSize: '0.75rem',
            }}
          >
            <DoorOpen size={13} />
            <span>Away on Outing</span>
          </span>
        );
      default:
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              backgroundColor: '#ecfdf5',
              color: '#047857',
              border: '1px solid #a7f3d0',
              borderRadius: '9999px',
              fontWeight: 600,
              fontSize: '0.75rem',
            }}
          >
            <ShieldCheck size={13} />
            <span>Gate Cleared</span>
          </span>
        );
    }
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
              backgroundColor: row.isOverdue ? '#fee2e2' : '#ecfdf5',
              color: row.isOverdue ? '#b91c1c' : '#047857',
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
              title="View resident profile"
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
      header: 'Pass Category',
      accessor: 'leave_type',
      cell: (row) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
            {row.leave_type || 'OUTING'}
          </div>
          <div
            style={{
              fontSize: '0.76rem',
              color: 'var(--text-secondary)',
              maxWidth: '180px',
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
      header: 'Departure & Curfew Deadline',
      accessor: 'from_date',
      cell: (row) => (
        <div>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Dep: {formatDate(row.from_date)}
          </div>
          <div
            style={{
              fontSize: '0.78rem',
              color: row.isOverdue ? '#b91c1c' : 'var(--text-secondary)',
              fontWeight: row.isOverdue ? 700 : 500,
              marginTop: '2px',
            }}
          >
            Curfew: {formatDate(row.to_date)}
          </div>
        </div>
      ),
    },
    {
      header: 'Movement Status',
      accessor: 'movementStatus',
      cell: (row) => (
        <div>
          {getMovementStatusBadge(row)}
          {row.isOverdue && row.overdueText && (
            <div style={{ fontSize: '0.72rem', color: '#b91c1c', fontWeight: 700, marginTop: '3px' }}>
              {row.overdueText}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Emergency Contact',
      accessor: 'phone',
      cell: (row) => (
        <div>
          {row.phone && row.phone !== '—' ? (
            <a
              href={`tel:${row.phone}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '0.82rem',
                color: row.isOverdue ? '#b91c1c' : 'var(--primary-color)',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              <PhoneCall size={12} />
              <span>{row.phone}</span>
            </a>
          ) : (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Not configured</span>
          )}
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {row.destination || 'Family Residence'}
          </div>
        </div>
      ),
    },
    {
      header: 'Actions',
      accessor: 'id',
      cell: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={() => {
              setSelectedPass(row);
              setVoucherModalOpen(true);
            }}
            style={{ fontSize: '0.78rem', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
            title="Inspect Digital Gate Pass Voucher"
          >
            <QrCode size={13} />
            <span>Voucher</span>
          </button>

          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => navigate(`/leaves?leaveId=${row.id || row.leave_id}`)}
            style={{ fontSize: '0.78rem', padding: '5px 8px' }}
            title="View original approved leave request"
          >
            <Eye size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ paddingBottom: '40px' }}>
      {/* Page Header */}
      <PageHeader
        title="Outings & Gate Clearance Passes"
        description="Monitor authorized resident student departures, expected return deadlines, and curfew compliance."
        icon={Footprints}
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
              disabled={filteredPasses.length === 0}
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

      {/* Security Operational Boundary Notice */}
      <div
        style={{
          marginBottom: '20px',
          padding: '14px 18px',
          backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
        }}
      >
        <ShieldCheck size={20} color="#16a34a" style={{ marginTop: '2px', flexShrink: 0 }} />
        <div style={{ fontSize: '0.85rem', color: '#166534', lineHeight: 1.5 }}>
          <strong>Campus Gate Clearance & Curfew Coordination:</strong> Hostel In-Charges monitor approved student
          departures, expected return windows, and curfew compliance. Physical gate verification (QR badge scanning,
          physical gate entry and exit logging) is performed in real-time by Campus Security personnel at physical entry gates.
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid-4" style={{ marginBottom: '24px' }}>
        <div className="card stat-card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Total Cleared Passes
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
              <ShieldCheck size={20} />
            </div>
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
            Approved departure clearances
          </div>
        </div>

        <div
          className="card stat-card"
          style={{
            padding: '18px',
            borderLeft: metrics.overdue > 0 ? '4px solid #ef4444' : '1px solid var(--border-color)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: metrics.overdue > 0 ? '#b91c1c' : 'var(--text-secondary)', fontWeight: 600 }}>
                Overdue Returns
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: metrics.overdue > 0 ? '#dc2626' : 'var(--text-primary)', marginTop: '4px' }}>
                {metrics.overdue}
              </div>
            </div>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '8px',
                backgroundColor: metrics.overdue > 0 ? '#fee2e2' : '#f1f5f9',
                color: metrics.overdue > 0 ? '#b91c1c' : '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlertTriangle size={20} />
            </div>
          </div>
          <div style={{ fontSize: '0.74rem', color: metrics.overdue > 0 ? '#b91c1c' : 'var(--text-secondary)', marginTop: '8px' }}>
            {metrics.overdue > 0 ? 'Curfew deadline exceeded' : 'No overdue students'}
          </div>
        </div>

        <div className="card stat-card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: '#1d4ed8', fontWeight: 600 }}>
                Currently Away
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#2563eb', marginTop: '4px' }}>
                {metrics.away}
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
              <DoorOpen size={20} />
            </div>
          </div>
          <div style={{ fontSize: '0.74rem', color: '#1d4ed8', marginTop: '8px' }}>
            Active off-campus residents
          </div>
        </div>

        <div className="card stat-card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: '#b45309', fontWeight: 600 }}>
                Expected Today
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#d97706', marginTop: '4px' }}>
                {metrics.today}
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
            Returning by tonight&apos;s curfew
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
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
            placeholder="Search student, reg number, room, destination..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onClear={() => setSearchTerm('')}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Movement & Curfew Filter */}
          <select
            className="form-control"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: 'auto', minWidth: '150px', fontSize: '0.85rem' }}
          >
            <option value="ALL">All Movement States</option>
            <option value="OVERDUE">Overdue Returns Only</option>
            <option value="AWAY">Currently Away</option>
            <option value="TODAY">Returning Today</option>
            <option value="SCHEDULED">Upcoming Departures</option>
          </select>

          {/* Outing Type Filter */}
          <select
            className="form-control"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{ width: 'auto', minWidth: '140px', fontSize: '0.85rem' }}
          >
            <option value="ALL">All Outing Types</option>
            <option value="DAY_LEAVE">Day Outing</option>
            <option value="OVERNIGHT">Overnight Leave</option>
            <option value="WEEKEND">Weekend Leave</option>
            <option value="EMERGENCY">Emergency Leave</option>
            <option value="MEDICAL">Medical Leave</option>
          </select>

          {/* Reset Filters */}
          {(searchTerm || statusFilter !== 'ALL' || typeFilter !== 'ALL') && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('ALL');
                setTypeFilter('ALL');
              }}
              style={{ fontSize: '0.82rem', padding: '6px 10px' }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <LoadingState title="Loading gate clearance records..." rows={5} />
      ) : errorMessage ? (
        <ErrorState
          title="Failed to Load Clearance Records"
          message={errorMessage}
          onRetry={() => loadData(false)}
        />
      ) : filteredPasses.length === 0 ? (
        <EmptyState
          title="No Gate Clearance Passes Found"
          description={
            searchTerm || statusFilter !== 'ALL' || typeFilter !== 'ALL'
              ? 'No passes match the current filter criteria.'
              : 'There are currently no approved gate clearance passes on record.'
          }
          icon={Footprints}
        />
      ) : displayMode === 'TABLE' ? (
        <div className="card" style={{ overflow: 'hidden' }}>
          <DataTable
            columns={columns}
            data={filteredPasses}
            keyField="id"
          />
        </div>
      ) : (
        /* Card Grid View */
        <div className="grid-3" style={{ gap: '16px' }}>
          {filteredPasses.map((p) => (
            <div
              key={p.id || p.leave_id}
              className="card"
              style={{
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                borderTop: p.isOverdue
                  ? '3px solid #ef4444'
                  : p.movementStatus === 'TODAY'
                  ? '3px solid #f59e0b'
                  : '3px solid #10b981',
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
                      onClick={() => navigate(`/students?search=${encodeURIComponent(p.regNumber || p.studentName)}`)}
                    >
                      {p.studentName}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      Reg: {p.regNumber} • Room {p.roomNumber}
                    </div>
                  </div>
                  <div>{getMovementStatusBadge(p)}</div>
                </div>

                {p.isOverdue && (
                  <div
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#fef2f2',
                      borderRadius: '6px',
                      border: '1px solid #fecaca',
                      marginBottom: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: '#b91c1c',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                    }}
                  >
                    <AlertTriangle size={15} />
                    <span>{p.overdueText || 'Curfew Exceeded'}</span>
                  </div>
                )}

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
                    Type: <strong>{p.leave_type}</strong>
                  </div>
                  <div style={{ color: 'var(--text-secondary)' }}>
                    Departs: <strong>{formatDate(p.from_date)}</strong>
                  </div>
                  <div style={{ color: p.isOverdue ? '#b91c1c' : 'var(--text-secondary)' }}>
                    Return Curfew: <strong>{formatDate(p.to_date)}</strong>
                  </div>
                  {p.destination && (
                    <div style={{ color: 'var(--text-secondary)' }}>
                      Destination: {p.destination}
                    </div>
                  )}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '12px',
                  borderTop: '1px solid var(--border-color)',
                }}
              >
                <div>
                  {p.phone && p.phone !== '—' && (
                    <a
                      href={`tel:${p.phone}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.78rem',
                        color: p.isOverdue ? '#b91c1c' : 'var(--primary-color)',
                        fontWeight: 600,
                        textDecoration: 'none',
                      }}
                    >
                      <PhoneCall size={12} />
                      <span>Call</span>
                    </a>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => {
                      setSelectedPass(p);
                      setVoucherModalOpen(true);
                    }}
                    style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <QrCode size={13} />
                    <span>Voucher</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => navigate(`/leaves?leaveId=${p.id || p.leave_id}`)}
                    style={{ fontSize: '0.78rem' }}
                  >
                    Leave
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Digital Gate Pass Voucher Modal */}
      <Modal
        isOpen={voucherModalOpen}
        onClose={() => setVoucherModalOpen(false)}
        title="Campus Gate Clearance Voucher"
        maxWidth="580px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={handlePrintVoucher}
              style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Printer size={15} />
              <span>Print Pass</span>
            </button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setVoucherModalOpen(false)}
                style={{ fontSize: '0.85rem' }}
              >
                Close
              </button>
            </div>
          </div>
        }
      >
        {selectedPass && (
          <div
            id="gate-pass-printable"
            style={{
              padding: '20px',
              backgroundColor: '#ffffff',
              border: '2px dashed var(--border-color)',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {/* Header */}
            <div style={{ textAlign: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div style={{ fontSize: '0.72rem', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                Hostel Management System • Gate Pass Security Clear
              </div>
              <h3 style={{ margin: '6px 0 2px 0', fontSize: '1.2rem', color: 'var(--primary-color)' }}>
                CAMPUS GATE CLEARANCE VOUCHER
              </h3>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Pass Reference: <strong style={{ fontFamily: 'monospace' }}>GP-{(selectedPass.id || selectedPass.leave_id || '').slice(0, 8).toUpperCase()}</strong>
              </div>
            </div>

            {/* Overdue Alert in Voucher if applicable */}
            {selectedPass.isOverdue && (
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '6px',
                  color: '#b91c1c',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AlertTriangle size={16} />
                <span>ATTENTION: Curfew deadline has passed ({selectedPass.overdueText}).</span>
              </div>
            )}

            {/* Student Particulars */}
            <div className="grid-2" style={{ gap: '12px', fontSize: '0.85rem' }}>
              <div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Student Name</div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{selectedPass.studentName}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Registration Number</div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{selectedPass.regNumber}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Hostel & Accommodation</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  Room {selectedPass.roomNumber} ({selectedPass.bedName || 'Bed'})
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Outing Classification</div>
                <div style={{ fontWeight: 600, color: 'var(--primary-color)' }}>{selectedPass.leave_type}</div>
              </div>
            </div>

            {/* Validity Timeline */}
            <div
              style={{
                padding: '12px 16px',
                backgroundColor: '#f8fafc',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Authorized Departure</div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  {formatDate(selectedPass.from_date)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Expected Curfew Return</div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: selectedPass.isOverdue ? '#b91c1c' : 'var(--text-primary)' }}>
                  {formatDate(selectedPass.to_date)}
                </div>
              </div>
            </div>

            {/* Destination & Emergency Contact */}
            <div style={{ fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Destination: </span>
                <strong>{selectedPass.destination || 'Family Residence'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Purpose / Reason: </span>
                <span>{selectedPass.reason}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Emergency Phone: </span>
                <strong style={{ color: '#b91c1c' }}>{selectedPass.phone || 'Not provided'}</strong>
              </div>
            </div>

            {/* Security Notice & Digital Authorization Seal */}
            <div
              style={{
                marginTop: '10px',
                paddingTop: '12px',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', maxWidth: '320px' }}>
                * Student must show this voucher and ID card to Campus Security at designated entry/exit gates.
              </div>
              <div
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  borderRadius: '6px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.68rem', color: '#047857', fontWeight: 700 }}>VERIFIED BY</div>
                <div style={{ fontSize: '0.78rem', color: '#065f46', fontWeight: 800 }}>HOSTEL IN-CHARGE</div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
