import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../shared/auth/useAuth';
import adminService from '../services/adminService';
import {
  ClipboardCheck,
  UserCheck,
  UserX,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Search,
  Filter,
  Plus,
  RefreshCw,
  Eye,
  FileEdit,
  X,
  ChevronRight,
  Sparkles,
  Users,
  ShieldCheck,
  FileText,
  BadgeAlert,
  GraduationCap,
  LayoutGrid,
  List,
  Download,
  Check,
  Building2,
  QrCode,
  Shield,
  Layers,
  History,
  TrendingUp,
  AlertTriangle,
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

export default function AdminAttendancePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Permission checks
  const canManageAttendance = useMemo(() => {
    if (!user) return true;
    if (['COLLEGE_ADMIN', 'ADMIN', 'HOSTEL_ADMIN'].includes(user?.role)) return true;
    if (Array.isArray(user?.permissions)) {
      return (
        user.permissions.includes('people.manage') ||
        user.permissions.includes('movement.manage') ||
        user.permissions.includes('*')
      );
    }
    return true;
  }, [user]);

  // Master Data State
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [attendanceSummary, setAttendanceSummary] = useState(null);
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
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [dateFilterPreset, setDateFilterPreset] = useState('ALL');

  // Modals Visibility
  const [markModalOpen, setMarkModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);

  // Active Selected Record
  const [selectedRecord, setSelectedRecord] = useState(null);

  // Mark Form State
  const [markFormData, setMarkFormData] = useState({
    student_id: '',
    attendance_date: new Date().toISOString().split('T')[0],
    status: 'PRESENT',
    scan_method: 'MANUAL',
    remarks: '',
  });

  // Bulk Roll Call State
  const [bulkDate, setBulkDate] = useState(new Date().toISOString().split('T')[0]);
  const [bulkMethod, setBulkMethod] = useState('MANUAL');
  const [bulkStudentStatuses, setBulkStudentStatuses] = useState({});
  const [bulkSearchTerm, setBulkSearchTerm] = useState('');

  // Correction Form State
  const [correctionFormData, setCorrectionFormData] = useState({
    record_id: '',
    new_status: 'PRESENT',
    correction_reason: '',
    remarks: '',
  });

  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Quick lookup dictionary for student metadata
  const studentMap = useMemo(() => {
    const map = new Map();
    students.forEach((s) => {
      map.set(s.id, s);
    });
    return map;
  }, [students]);

  // =========================================================================
  // Master Data Fetching
  // =========================================================================
  const loadAttendanceData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setLoading(true);
    setErrorMessage(null);

    try {
      const [recordsRes, summaryRes, studentsRes] = await Promise.allSettled([
        adminService.getStudentAttendanceList(),
        adminService.getAttendanceSummary(),
        adminService.getStudents(),
      ]);

      if (recordsRes.status === 'fulfilled') {
        const raw = recordsRes.value;
        setAttendanceRecords(Array.isArray(raw) ? raw : raw?.records || raw?.attendance || []);
      } else {
        console.warn('Failed to load attendance records:', recordsRes.reason);
      }

      if (summaryRes.status === 'fulfilled') {
        const rawSummary = summaryRes.value;
        setAttendanceSummary(rawSummary?.data || rawSummary || null);
      }

      if (studentsRes.status === 'fulfilled') {
        const rawStudents = studentsRes.value;
        setStudents(Array.isArray(rawStudents) ? rawStudents : rawStudents?.students || []);
      }
    } catch (err) {
      console.error('Failed to load attendance master data:', err);
      setErrorMessage('Failed to load student attendance records. Please verify server connection.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAttendanceData();
  }, [loadAttendanceData]);

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
    if (attendanceSummary) {
      const total = attendanceSummary.total || attendanceRecords.length;
      const present = attendanceSummary.present || 0;
      const absent = attendanceSummary.absent || 0;
      const late = attendanceSummary.late || 0;
      const onLeave = attendanceSummary.on_leave || 0;
      const excused = attendanceSummary.excused || 0;
      const rate = total > 0 ? ((present / total) * 100).toFixed(1) : '0.0';
      return { total, present, absent, late, onLeave, excused, rate };
    }

    const total = attendanceRecords.length;
    let present = 0;
    let absent = 0;
    let late = 0;
    let onLeave = 0;
    let excused = 0;

    attendanceRecords.forEach((r) => {
      const st = String(r.status || '').toUpperCase();
      if (st === 'PRESENT') present++;
      else if (st === 'ABSENT') absent++;
      else if (st === 'LATE') late++;
      else if (st === 'ON_LEAVE') onLeave++;
      else if (st === 'EXCUSED') excused++;
    });

    const rate = total > 0 ? ((present / total) * 100).toFixed(1) : '0.0';
    return { total, present, absent, late, onLeave, excused, rate };
  }, [attendanceSummary, attendanceRecords]);

  // =========================================================================
  // Filtering & Search
  // =========================================================================
  const filteredRecords = useMemo(() => {
    return attendanceRecords.filter((rec) => {
      const student = studentMap.get(rec.student_id);
      const studentName = student
        ? `${student.first_name || ''} ${student.last_name || ''}`.trim()
        : '';
      const regNo = student?.registration_number || student?.admission_number || '';
      const remarks = rec.remarks || '';
      const term = searchTerm.toLowerCase().trim();

      const matchesSearch =
        !term ||
        studentName.toLowerCase().includes(term) ||
        regNo.toLowerCase().includes(term) ||
        remarks.toLowerCase().includes(term) ||
        (rec.scan_method && rec.scan_method.toLowerCase().includes(term)) ||
        (rec.student_id && rec.student_id.toLowerCase().includes(term));

      const matchesStatus =
        statusFilter === 'ALL' ||
        String(rec.status || '').toUpperCase() === statusFilter.toUpperCase();

      const matchesMethod =
        methodFilter === 'ALL' ||
        String(rec.scan_method || '').toUpperCase() === methodFilter.toUpperCase();

      let matchesDate = true;
      if (dateFilterPreset !== 'ALL' && rec.attendance_date) {
        const recDate = new Date(rec.attendance_date).toISOString().split('T')[0];
        const today = new Date().toISOString().split('T')[0];
        if (dateFilterPreset === 'TODAY') {
          matchesDate = recDate === today;
        } else if (dateFilterPreset === 'YESTERDAY') {
          const y = new Date();
          y.setDate(y.getDate() - 1);
          matchesDate = recDate === y.toISOString().split('T')[0];
        } else if (dateFilterPreset === 'LAST_7_DAYS') {
          const past = new Date();
          past.setDate(past.getDate() - 7);
          matchesDate = new Date(rec.attendance_date) >= past;
        } else if (dateFilterPreset === 'LAST_30_DAYS') {
          const past = new Date();
          past.setDate(past.getDate() - 30);
          matchesDate = new Date(rec.attendance_date) >= past;
        }
      }

      return matchesSearch && matchesStatus && matchesMethod && matchesDate;
    });
  }, [attendanceRecords, studentMap, searchTerm, statusFilter, methodFilter, dateFilterPreset]);

  // =========================================================================
  // Quick Presets
  // =========================================================================
  const datePresets = [
    { id: 'ALL', label: 'All Dates' },
    { id: 'TODAY', label: 'Today' },
    { id: 'YESTERDAY', label: 'Yesterday' },
    { id: 'LAST_7_DAYS', label: 'Last 7 Days' },
    { id: 'LAST_30_DAYS', label: 'Last 30 Days' },
  ];

  const statusPresets = [
    { id: 'ALL', label: 'All Statuses', count: attendanceRecords.length, chipClass: '' },
    { id: 'PRESENT', label: 'Present', count: kpis.present, chipClass: 'chip-emerald' },
    { id: 'ABSENT', label: 'Absent', count: kpis.absent, chipClass: 'chip-rose' },
    { id: 'LATE', label: 'Late', count: kpis.late, chipClass: 'chip-amber' },
    { id: 'ON_LEAVE', label: 'On Leave', count: kpis.onLeave, chipClass: 'chip-amber' },
    { id: 'EXCUSED', label: 'Excused', count: kpis.excused, chipClass: 'chip-purple' },
  ];

  // Filtered students inside Bulk Roll Call Modal
  const filteredBulkStudents = useMemo(() => {
    if (!bulkSearchTerm.trim()) return students;
    const term = bulkSearchTerm.toLowerCase().trim();
    return students.filter((s) => {
      const fullName = `${s.first_name || ''} ${s.last_name || ''}`.toLowerCase();
      const regNo = (s.registration_number || s.admission_number || '').toLowerCase();
      return fullName.includes(term) || regNo.includes(term);
    });
  }, [students, bulkSearchTerm]);

  // =========================================================================
  // Workflow: Export to CSV
  // =========================================================================
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) return;
    const columns = [
      {
        key: 'student',
        title: 'Resident Student',
        format: (_, rec) => {
          const student = studentMap.get(rec.student_id);
          return student ? `${student.first_name || ''} ${student.last_name || ''}`.trim() : rec.student_id;
        },
      },
      {
        key: 'reg_no',
        title: 'Registration / Admission No',
        format: (_, rec) => {
          const student = studentMap.get(rec.student_id);
          return student?.registration_number || student?.admission_number || 'N/A';
        },
      },
      {
        key: 'attendance_date',
        title: 'Roll Call Date',
        format: (val) => (val ? new Date(val).toISOString().split('T')[0] : 'N/A'),
      },
      {
        key: 'status',
        title: 'Status',
        format: (val) => String(val || '').toUpperCase(),
      },
      {
        key: 'scan_method',
        title: 'Verification Method',
        format: (val) => val || 'MANUAL',
      },
      {
        key: 'created_at',
        title: 'Recorded At',
        format: (val) => (val ? new Date(val).toLocaleString() : 'N/A'),
      },
      {
        key: 'is_corrected',
        title: 'Audited & Adjusted',
        format: (val) => (val ? 'YES' : 'NO'),
      },
      {
        key: 'remarks',
        title: 'Audit Remarks',
        format: (val) => val || '',
      },
    ];
    exportToCSV('HMS_Daily_Attendance_Ledger', columns, filteredRecords);
  };

  // =========================================================================
  // Workflow: Mark Single Student Attendance
  // =========================================================================
  const handleOpenMarkModal = () => {
    setMarkFormData({
      student_id: students[0]?.id || '',
      attendance_date: new Date().toISOString().split('T')[0],
      status: 'PRESENT',
      scan_method: 'MANUAL',
      remarks: '',
    });
    setFormError(null);
    setMarkModalOpen(true);
  };

  const handleMarkSubmit = async (e) => {
    e.preventDefault();
    if (!markFormData.student_id) {
      setFormError('Please select a student.');
      return;
    }
    if (!markFormData.attendance_date) {
      setFormError('Please select the attendance date.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        student_id: markFormData.student_id,
        attendance_date: new Date(markFormData.attendance_date).toISOString(),
        status: markFormData.status,
        scan_method: markFormData.scan_method,
        remarks: markFormData.remarks ? markFormData.remarks.trim() : null,
      };

      await adminService.markStudentAttendance(payload);
      setSuccessBanner('Attendance record marked successfully.');
      setMarkModalOpen(false);
      loadAttendanceData();
    } catch (err) {
      console.error('Failed to mark student attendance:', err);
      setFormError(
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        'Failed to mark student attendance. Record may already exist for this date.'
      );
    } finally {
      setFormSubmitting(false);
    }
  };

  // =========================================================================
  // Workflow: Bulk Roll Call
  // =========================================================================
  const handleOpenBulkModal = () => {
    const initialStatuses = {};
    students.forEach((s) => {
      initialStatuses[s.id] = 'PRESENT';
    });
    setBulkStudentStatuses(initialStatuses);
    setBulkDate(new Date().toISOString().split('T')[0]);
    setBulkMethod('MANUAL');
    setBulkSearchTerm('');
    setFormError(null);
    setBulkModalOpen(true);
  };

  const handleToggleAllBulk = (targetStatus) => {
    const updated = {};
    students.forEach((s) => {
      updated[s.id] = targetStatus;
    });
    setBulkStudentStatuses(updated);
  };

  const handleSetStudentStatus = (studentId, status) => {
    setBulkStudentStatuses((prev) => ({
      ...prev,
      [studentId]: status,
    }));
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    if (students.length === 0) {
      setFormError('No students available to mark attendance.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    try {
      const records = students.map((s) => ({
        student_id: s.id,
        attendance_date: new Date(bulkDate).toISOString(),
        status: bulkStudentStatuses[s.id] || 'PRESENT',
        scan_method: bulkMethod,
        remarks: 'Bulk roll call recorded by Administrator',
      }));

      await adminService.bulkMarkStudentAttendance({ records });
      setSuccessBanner(`Bulk roll-call recorded for ${records.length} students successfully.`);
      setBulkModalOpen(false);
      loadAttendanceData();
    } catch (err) {
      console.error('Failed to submit bulk attendance:', err);
      setFormError(
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        'Failed to save bulk roll call. Please review errors and retry.'
      );
    } finally {
      setFormSubmitting(false);
    }
  };

  // =========================================================================
  // Workflow: Submit Attendance Correction
  // =========================================================================
  const handleOpenCorrectionModal = (record) => {
    setSelectedRecord(record);
    setCorrectionFormData({
      record_id: record.id,
      new_status: record.status === 'ABSENT' ? 'PRESENT' : 'ABSENT',
      correction_reason: '',
      remarks: record.remarks || '',
    });
    setFormError(null);
    setCorrectionModalOpen(true);
  };

  const handleCorrectionSubmit = async (e) => {
    e.preventDefault();
    if (!correctionFormData.correction_reason.trim()) {
      setFormError('Please enter a valid correction reason explaining this adjustment.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        record_id: correctionFormData.record_id,
        new_status: correctionFormData.new_status,
        correction_reason: correctionFormData.correction_reason.trim(),
        remarks: correctionFormData.remarks ? correctionFormData.remarks.trim() : null,
      };

      await adminService.submitAttendanceCorrection(payload);
      setSuccessBanner('Attendance correction request submitted successfully.');
      setCorrectionModalOpen(false);
      loadAttendanceData();
    } catch (err) {
      console.error('Failed to submit correction:', err);
      setFormError(
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        'Failed to submit correction request.'
      );
    } finally {
      setFormSubmitting(false);
    }
  };

  // =========================================================================
  // Workflow: View Dossier
  // =========================================================================
  const handleOpenDetailsDrawer = (record) => {
    setSelectedRecord(record);
    setDetailsDrawerOpen(true);
  };

  // Helper status badge renderer
  const renderStatusBadge = (status) => {
    const st = String(status || '').toUpperCase();
    if (st === 'PRESENT') {
      return (
        <span className="badge-enterprise badge-emerald">
          <span className="live-pulse" />
          PRESENT
        </span>
      );
    } else if (st === 'ABSENT') {
      return (
        <span className="badge-enterprise badge-rose">
          <span className="live-pulse" style={{ background: '#f43f5e' }} />
          ABSENT
        </span>
      );
    } else if (st === 'LATE') {
      return <span className="badge-enterprise badge-amber">LATE</span>;
    } else if (st === 'ON_LEAVE') {
      return <span className="badge-enterprise badge-blue">ON LEAVE</span>;
    } else if (st === 'EXCUSED') {
      return <span className="badge-enterprise badge-purple">EXCUSED</span>;
    } else if (st === 'HOLIDAY') {
      return <span className="badge-enterprise badge-slate">HOLIDAY</span>;
    }
    return <span className="badge-enterprise badge-slate">{st || 'UNKNOWN'}</span>;
  };

  return (
    <div className="fade-in-up">
      {/* 1. Modern Enterprise Hero Header */}
      <div className="enterprise-hero-header">
        <div className="hero-header-titles">
          <div className="hero-category-pill">
            <ClipboardCheck size={13} />
            <span>Operations &amp; Movement</span>
          </div>
          <h1 className="hero-main-title">Student Daily Attendance</h1>
          <p className="hero-subtitle">
            Institutional roll-call registry, nightly curfew presence tracking, authorized leaves, and correction audits.
          </p>
        </div>

        <div className="hero-action-buttons">
          <button
            type="button"
            className="btn-enterprise-secondary"
            onClick={() => loadAttendanceData(true)}
            disabled={isRefreshing || loading}
            title="Refresh Attendance Data"
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync Registry'}</span>
          </button>

          <button
            type="button"
            className="btn-enterprise-secondary"
            onClick={handleExportCSV}
            disabled={filteredRecords.length === 0}
            title="Export filtered records to RFC 4180 CSV"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>

          {canManageAttendance && (
            <>
              <button
                type="button"
                className="btn-enterprise-secondary"
                onClick={handleOpenBulkModal}
                disabled={loading}
                title="Curfew Bulk Roll Call"
              >
                <Users size={14} />
                <span>Bulk Roll Call</span>
              </button>

              <button
                type="button"
                className="btn-enterprise-primary"
                onClick={handleOpenMarkModal}
                disabled={loading}
                title="Mark Single Student Attendance"
              >
                <Plus size={15} />
                <span>Mark Attendance</span>
              </button>
            </>
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
          <ErrorState message={errorMessage} onRetry={() => loadAttendanceData(true)} />
        </div>
      )}

      {/* 2. Executive KPI Cards */}
      <div className="kpi-cards-grid" style={{ marginBottom: '20px' }}>
        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-title">Total Roll-Call Logs</span>
            <div className="stat-kpi-icon-box" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
              <ClipboardCheck size={18} />
            </div>
          </div>
          <div className="stat-kpi-value">{kpis.total}</div>
          <div className="stat-kpi-subtext">Authoritative check-in registry</div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-title">Verified Present</span>
            <div className="stat-kpi-icon-box" style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}>
              <UserCheck size={18} />
            </div>
          </div>
          <div className="stat-kpi-value" style={{ color: '#16a34a' }}>
            {kpis.present}
          </div>
          <div className="stat-kpi-subtext">
            <span className="live-pulse" style={{ display: 'inline-block', marginRight: '5px' }} />
            <strong>{kpis.rate}%</strong> confirmed on campus
          </div>
          <div className="attendance-progress-container" title={`${kpis.rate}% Present Rate`}>
            <div
              className="attendance-progress-fill"
              style={{ width: `${Math.min(100, Math.max(0, parseFloat(kpis.rate) || 0))}%` }}
            />
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-title">Unaccounted Absent</span>
            <div className="stat-kpi-icon-box" style={{ backgroundColor: '#fff1f2', color: '#e11d48' }}>
              <UserX size={18} />
            </div>
          </div>
          <div className="stat-kpi-value" style={{ color: '#e11d48' }}>
            {kpis.absent}
          </div>
          <div className="stat-kpi-subtext" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Missing at curfew roll call</span>
            {kpis.absent > 0 && (
              <span className="curfew-risk-tag">
                <AlertTriangle size={11} />
                High Risk
              </span>
            )}
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-title">Late / Leave / Excused</span>
            <div className="stat-kpi-icon-box" style={{ backgroundColor: '#fffbeb', color: '#d97706' }}>
              <Clock size={18} />
            </div>
          </div>
          <div className="stat-kpi-value" style={{ color: '#d97706' }}>
            {kpis.late + kpis.onLeave + kpis.excused}
          </div>
          <div className="stat-kpi-subtext" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ color: '#d97706', fontWeight: 600 }}>{kpis.late} late</span>
            <span>•</span>
            <span style={{ color: '#2563eb', fontWeight: 600 }}>{kpis.onLeave} leave</span>
            <span>•</span>
            <span style={{ color: '#7c3aed', fontWeight: 600 }}>{kpis.excused} excused</span>
          </div>
        </div>
      </div>

      {/* 3. Quick Status & Date Preset Filter Strip */}
      <div className="attendance-quick-filter-strip">
        <span className="attendance-filter-label">
          <Filter size={12} />
          <span>Status:</span>
        </span>
        {statusPresets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`attendance-filter-chip ${preset.chipClass} ${statusFilter === preset.id ? 'active' : ''}`}
            onClick={() => setStatusFilter(preset.id)}
          >
            <span>{preset.label}</span>
            <span className="attendance-chip-count">{preset.count}</span>
          </button>
        ))}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span className="attendance-filter-label">
            <Calendar size={12} />
            <span>Timeline:</span>
          </span>
          {datePresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`attendance-filter-chip ${dateFilterPreset === preset.id ? 'active' : ''}`}
              onClick={() => setDateFilterPreset(preset.id)}
            >
              <span>{preset.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 4. Search and Filters Toolbar */}
      <FilterControls
        totalRecords={filteredRecords.length}
        onReset={() => {
          setSearchTerm('');
          setStatusFilter('ALL');
          setMethodFilter('ALL');
          setDateFilterPreset('ALL');
        }}
      >
        <SearchInput
          placeholder="Search by student, reg #, method, remarks..."
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
            <option value="ALL">All Statuses</option>
            <option value="PRESENT">PRESENT</option>
            <option value="ABSENT">ABSENT</option>
            <option value="LATE">LATE</option>
            <option value="ON_LEAVE">ON LEAVE</option>
            <option value="EXCUSED">EXCUSED</option>
            <option value="HOLIDAY">HOLIDAY</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Method:</span>
          <select
            className="filter-search-input"
            style={{ width: 'auto', padding: '6px 12px' }}
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
          >
            <option value="ALL">All Methods</option>
            <option value="MANUAL">MANUAL</option>
            <option value="QR">QR CODE</option>
            <option value="BARCODE">BARCODE</option>
            <option value="SYSTEM">SYSTEM</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Date:</span>
          <select
            className="filter-search-input"
            style={{ width: 'auto', padding: '6px 12px' }}
            value={dateFilterPreset}
            onChange={(e) => setDateFilterPreset(e.target.value)}
          >
            <option value="ALL">All Dates</option>
            <option value="TODAY">Today Only</option>
            <option value="YESTERDAY">Yesterday</option>
            <option value="LAST_7_DAYS">Last 7 Days</option>
            <option value="LAST_30_DAYS">Last 30 Days</option>
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
              <ClipboardCheck size={16} />
            </div>
            <div>
              <h2 className="card-title-text">Attendance Roll-Call Ledger</h2>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Showing {filteredRecords.length} of {attendanceRecords.length} check-in logs
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge-enterprise badge-emerald">
              <span className="live-pulse" />
              {kpis.present} Present
            </span>
            {kpis.absent > 0 && (
              <span className="badge-enterprise badge-rose">
                {kpis.absent} Absent
              </span>
            )}
            {(kpis.late + kpis.onLeave) > 0 && (
              <span className="badge-enterprise badge-amber">
                {kpis.late + kpis.onLeave} Late/Leave
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '40px' }}>
            <LoadingState message="Loading attendance records from institutional server..." />
          </div>
        ) : filteredRecords.length === 0 ? (
          <div style={{ padding: '40px' }}>
            <EmptyState
              title="No attendance records found"
              message={
                searchTerm || statusFilter !== 'ALL' || dateFilterPreset !== 'ALL'
                  ? 'Try adjusting your search criteria, status filter, or date preset.'
                  : 'No roll-call attendance records have been registered yet.'
              }
            />
          </div>
        ) : displayMode === 'CARDS' ? (
          <div style={{ padding: '20px' }}>
            <div className="attendance-grid-cards">
              {filteredRecords.map((rec) => {
                const student = studentMap.get(rec.student_id);
                const studentName = student
                  ? `${student.first_name || ''} ${student.last_name || ''}`.trim()
                  : `Student (${(rec.student_id || '').slice(0, 8)})`;
                const initials = student
                  ? `${student.first_name?.[0] || 'S'}${student.last_name?.[0] || ''}`.toUpperCase()
                  : 'ST';
                const regNo = student?.registration_number || student?.admission_number || 'N/A';
                const st = String(rec.status || 'PRESENT').toUpperCase();
                const stClass =
                  st === 'PRESENT'
                    ? 'present'
                    : st === 'ABSENT'
                    ? 'absent'
                    : st === 'LATE'
                    ? 'late'
                    : st === 'ON_LEAVE'
                    ? 'on_leave'
                    : st === 'EXCUSED'
                    ? 'excused'
                    : 'present';

                const formattedDate = rec.attendance_date
                  ? new Date(rec.attendance_date).toLocaleDateString(undefined, {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })
                  : 'N/A';

                return (
                  <div key={rec.id} className={`attendance-card-v2 ${stClass}`}>
                    {/* Top Row: Resident Identity & Status */}
                    <div className="attendance-card-top">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                        <div className={`attendance-avatar-box ${stClass}`}>
                          {initials}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <h3 className="attendance-name-title" title={studentName}>
                            {studentName}
                          </h3>
                          <div className="attendance-adm-sub">
                            <GraduationCap size={12} />
                            <span>Reg: {regNo}</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        {renderStatusBadge(rec.status)}
                      </div>
                    </div>

                    {/* Card Body: Information Stack */}
                    <div className="attendance-card-body">
                      <div className="attendance-info-stack">
                        <div className="attendance-info-row">
                          <Calendar size={13} style={{ color: '#6366f1', flexShrink: 0 }} />
                          <span style={{ fontWeight: 600 }}>{formattedDate}</span>
                        </div>

                        <div className="attendance-info-row">
                          {rec.scan_method === 'QR' ? (
                            <QrCode size={13} style={{ color: '#2563eb', flexShrink: 0 }} />
                          ) : (
                            <ShieldCheck size={13} style={{ color: '#10b981', flexShrink: 0 }} />
                          )}
                          <span>
                            Method: <strong>{rec.scan_method || 'MANUAL'}</strong>
                          </span>
                        </div>

                        {rec.created_at && (
                          <div className="attendance-info-row">
                            <Clock size={13} style={{ color: '#f59e0b', flexShrink: 0 }} />
                            <span>
                              Logged: {new Date(rec.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )}

                        {rec.is_corrected && (
                          <div className="attendance-info-row" style={{ color: '#9333ea', fontWeight: 600 }}>
                            <History size={13} style={{ flexShrink: 0 }} />
                            <span>Audited & Adjusted Entry</span>
                          </div>
                        )}

                        {rec.remarks && (
                          <div className="attendance-info-row" style={{ color: '#64748b', fontStyle: 'italic' }} title={rec.remarks}>
                            <FileText size={13} style={{ color: '#94a3b8', flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{rec.remarks}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Footer: Action Buttons */}
                    <div className="attendance-card-footer">
                      <button
                        type="button"
                        className="btn-enterprise-secondary"
                        style={{ padding: '6px 11px', fontSize: '0.76rem', gap: '5px' }}
                        onClick={() => handleOpenDetailsDrawer(rec)}
                        title="View Full Attendance Dossier & Audit"
                      >
                        <Eye size={13} />
                        <span>Dossier & Audit</span>
                      </button>

                      {canManageAttendance && (
                        <button
                          type="button"
                          className="btn-enterprise-secondary"
                          style={{ padding: '6px 11px', fontSize: '0.76rem', gap: '5px' }}
                          onClick={() => handleOpenCorrectionModal(rec)}
                          title="Submit Adjustment or Correction Request"
                        >
                          <FileEdit size={13} />
                          <span>Correct</span>
                        </button>
                      )}
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
                  <th>Resident Student</th>
                  <th>Roll-Call Date</th>
                  <th>Status</th>
                  <th>Scan Method</th>
                  <th>Recorded Timestamp</th>
                  <th>Remarks & Audit</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((rec) => {
                  const student = studentMap.get(rec.student_id);
                  const studentName = student
                    ? `${student.first_name || ''} ${student.last_name || ''}`.trim()
                    : `Student (${rec.student_id ? rec.student_id.slice(0, 8) : 'N/A'})`;
                  const regNo = student?.registration_number || student?.admission_number || 'N/A';
                  const formattedDate = rec.attendance_date
                    ? new Date(rec.attendance_date).toLocaleDateString(undefined, {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                    : 'N/A';

                  return (
                    <tr key={rec.id}>
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
                            <strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: '0.86rem' }}>
                              {studentName}
                            </strong>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              Reg: {regNo}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem' }}>
                          <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                          <span>{formattedDate}</span>
                        </div>
                      </td>
                      <td>{renderStatusBadge(rec.status)}</td>
                      <td>
                        <span className="code-pill" style={{ fontSize: '0.74rem' }}>
                          {rec.scan_method || 'MANUAL'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          <Clock size={13} style={{ color: 'var(--text-muted)' }} />
                          <span>
                            {rec.created_at
                              ? new Date(rec.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {rec.is_corrected && (
                            <span style={{ fontSize: '0.7rem', color: '#9333ea', fontWeight: 600 }}>
                              Audited Adjustment
                            </span>
                          )}
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            {rec.remarks || <em style={{ color: 'var(--text-muted)' }}>None recorded</em>}
                          </span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn-enterprise-secondary"
                            style={{ padding: '5px 9px', fontSize: '0.76rem', gap: '4px' }}
                            onClick={() => handleOpenDetailsDrawer(rec)}
                            title="Inspect Detailed Dossier"
                          >
                            <Eye size={13} />
                            <span>Dossier</span>
                          </button>
                          {canManageAttendance && (
                            <button
                              type="button"
                              className="btn-enterprise-secondary"
                              style={{ padding: '5px 9px', fontSize: '0.76rem', gap: '4px' }}
                              onClick={() => handleOpenCorrectionModal(rec)}
                              title="Submit Correction Request"
                            >
                              <FileEdit size={13} />
                              <span>Correct</span>
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
      {/* MODAL 1: Mark Single Student Attendance                             */}
      {/* =================================================================== */}
      {markModalOpen && (
        <Modal
          isOpen={markModalOpen}
          onClose={() => !formSubmitting && setMarkModalOpen(false)}
          title="Mark Student Attendance"
          size="md"
        >
          <form onSubmit={handleMarkSubmit}>
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
              <FormField label="Select Resident Student" required>
                <select
                  className="filter-select"
                  style={{ width: '100%', height: '38px' }}
                  value={markFormData.student_id}
                  onChange={(e) =>
                    setMarkFormData((prev) => ({ ...prev, student_id: e.target.value }))
                  }
                  required
                >
                  <option value="">-- Choose Student --</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.first_name} {s.last_name} (
                      {s.registration_number || s.admission_number || s.id.slice(0, 8)})
                    </option>
                  ))}
                </select>
              </FormField>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <FormField label="Roll-Call Date" required>
                  <input
                    type="date"
                    className="filter-select"
                    style={{ width: '100%', height: '38px' }}
                    value={markFormData.attendance_date}
                    onChange={(e) =>
                      setMarkFormData((prev) => ({ ...prev, attendance_date: e.target.value }))
                    }
                    required
                  />
                </FormField>

                <FormField label="Attendance Status" required>
                  <select
                    className="filter-select"
                    style={{ width: '100%', height: '38px' }}
                    value={markFormData.status}
                    onChange={(e) =>
                      setMarkFormData((prev) => ({ ...prev, status: e.target.value }))
                    }
                    required
                  >
                    <option value="PRESENT">PRESENT</option>
                    <option value="ABSENT">ABSENT</option>
                    <option value="LATE">LATE</option>
                    <option value="ON_LEAVE">ON_LEAVE</option>
                    <option value="EXCUSED">EXCUSED</option>
                    <option value="HOLIDAY">HOLIDAY</option>
                  </select>
                </FormField>
              </div>

              <FormField label="Verification / Scan Method" required>
                <select
                  className="filter-select"
                  style={{ width: '100%', height: '38px' }}
                  value={markFormData.scan_method}
                  onChange={(e) =>
                    setMarkFormData((prev) => ({ ...prev, scan_method: e.target.value }))
                  }
                  required
                >
                  <option value="MANUAL">MANUAL (Roll-call check by warden)</option>
                  <option value="QR">QR Code Terminal</option>
                  <option value="BARCODE">Barcode Scanner</option>
                  <option value="SYSTEM">System Automated</option>
                </select>
              </FormField>

              <FormField label="Audit Remarks">
                <input
                  type="text"
                  className="filter-search-input"
                  style={{ width: '100%', height: '38px' }}
                  placeholder="e.g. Verified present in room during curfew rounds"
                  value={markFormData.remarks}
                  onChange={(e) =>
                    setMarkFormData((prev) => ({ ...prev, remarks: e.target.value }))
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
                onClick={() => setMarkModalOpen(false)}
                disabled={formSubmitting}
              >
                Cancel
              </button>
              <button type="submit" className="action-btn-primary" disabled={formSubmitting}>
                {formSubmitting ? 'Recording...' : 'Save Attendance Record'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* MODAL 2: Curfew Bulk Roll Call                                      */}
      {/* =================================================================== */}
      {bulkModalOpen && (
        <Modal
          isOpen={bulkModalOpen}
          onClose={() => !formSubmitting && setBulkModalOpen(false)}
          title="Curfew Bulk Roll Call"
          size="lg"
        >
          <form onSubmit={handleBulkSubmit}>
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

            {/* Top Configuration & Fast Actions */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
                flexWrap: 'wrap',
                gap: '12px',
                background: '#f8fafc',
                padding: '12px 16px',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#475569',
                      marginBottom: '4px',
                      textTransform: 'uppercase',
                    }}
                  >
                    Roll-Call Date
                  </label>
                  <input
                    type="date"
                    className="filter-select"
                    style={{ height: '36px', fontSize: '0.84rem' }}
                    value={bulkDate}
                    onChange={(e) => setBulkDate(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#475569',
                      marginBottom: '4px',
                      textTransform: 'uppercase',
                    }}
                  >
                    Method
                  </label>
                  <select
                    className="filter-select"
                    style={{ height: '36px', fontSize: '0.84rem' }}
                    value={bulkMethod}
                    onChange={(e) => setBulkMethod(e.target.value)}
                  >
                    <option value="MANUAL">MANUAL (Warden Rounds)</option>
                    <option value="SYSTEM">SYSTEM AUTOMATED</option>
                  </select>
                </div>
              </div>

              {/* Fast Action Buttons */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  className="action-btn-secondary"
                  style={{
                    fontSize: '12px',
                    padding: '6px 12px',
                    fontWeight: 600,
                    color: '#059669',
                    borderColor: '#a7f3d0',
                    background: '#ecfdf5',
                  }}
                  onClick={() => handleToggleAllBulk('PRESENT')}
                >
                  <Check size={13} />
                  <span>All Present</span>
                </button>
                <button
                  type="button"
                  className="action-btn-secondary"
                  style={{
                    fontSize: '12px',
                    padding: '6px 12px',
                    fontWeight: 600,
                    color: '#dc2626',
                    borderColor: '#fecaca',
                    background: '#fef2f2',
                  }}
                  onClick={() => handleToggleAllBulk('ABSENT')}
                >
                  <X size={13} />
                  <span>All Absent</span>
                </button>
              </div>
            </div>

            {/* In-Modal Search & Live Tally Bar */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ position: 'relative', flex: '1', minWidth: '220px' }}>
                <Search
                  size={14}
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#94a3b8',
                  }}
                />
                <input
                  type="text"
                  className="filter-search-input"
                  style={{ width: '100%', paddingLeft: '32px', height: '36px', fontSize: '0.84rem' }}
                  placeholder="Search resident student in roll call..."
                  value={bulkSearchTerm}
                  onChange={(e) => setBulkSearchTerm(e.target.value)}
                />
              </div>

              {/* Live Counters */}
              <div style={{ display: 'flex', gap: '6px', fontSize: '0.76rem', fontWeight: 600 }}>
                <span className="badge-enterprise badge-emerald">
                  {Object.values(bulkStudentStatuses).filter((st) => st === 'PRESENT').length} Present
                </span>
                <span className="badge-enterprise badge-rose">
                  {Object.values(bulkStudentStatuses).filter((st) => st === 'ABSENT').length} Absent
                </span>
                <span className="badge-enterprise badge-amber">
                  {
                    Object.values(bulkStudentStatuses).filter((st) => st === 'LATE' || st === 'ON_LEAVE')
                      .length
                  }{' '}
                  Late/Leave
                </span>
              </div>
            </div>

            {/* Students Roll Call List */}
            <div className="bulk-rollcall-container">
              {filteredBulkStudents.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', fontSize: '0.86rem' }}>
                  No resident students match your filter.
                </div>
              ) : (
                filteredBulkStudents.map((s) => {
                  const curStatus = bulkStudentStatuses[s.id] || 'PRESENT';
                  const studentInitials = `${s.first_name?.[0] || 'S'}${s.last_name?.[0] || ''}`.toUpperCase();
                  return (
                    <div key={s.id} className="bulk-student-row">
                      <div className="bulk-student-meta">
                        <div className="bulk-student-avatar">
                          {studentInitials}
                        </div>
                        <div className="bulk-student-info">
                          <span className="bulk-student-name">
                            {s.first_name} {s.last_name}
                          </span>
                          <span className="bulk-student-sub">
                            Reg: {s.registration_number || s.admission_number || 'N/A'}
                          </span>
                        </div>
                      </div>

                      {/* 4-Way Toggle Group */}
                      <div className="bulk-status-toggle-group">
                        <button
                          type="button"
                          className={`bulk-status-btn ${curStatus === 'PRESENT' ? 'active-present' : ''}`}
                          onClick={() => handleSetStudentStatus(s.id, 'PRESENT')}
                          title="Mark Present"
                        >
                          <Check size={12} />
                          <span>Present</span>
                        </button>
                        <button
                          type="button"
                          className={`bulk-status-btn ${curStatus === 'ABSENT' ? 'active-absent' : ''}`}
                          onClick={() => handleSetStudentStatus(s.id, 'ABSENT')}
                          title="Mark Absent"
                        >
                          <X size={12} />
                          <span>Absent</span>
                        </button>
                        <button
                          type="button"
                          className={`bulk-status-btn ${curStatus === 'LATE' ? 'active-late' : ''}`}
                          onClick={() => handleSetStudentStatus(s.id, 'LATE')}
                          title="Mark Late"
                        >
                          <Clock size={12} />
                          <span>Late</span>
                        </button>
                        <button
                          type="button"
                          className={`bulk-status-btn ${curStatus === 'ON_LEAVE' ? 'active-leave' : ''}`}
                          onClick={() => handleSetStudentStatus(s.id, 'ON_LEAVE')}
                          title="Mark On Leave"
                        >
                          <Calendar size={12} />
                          <span>Leave</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '20px',
                paddingTop: '16px',
                borderTop: '1px solid #f1f5f9',
              }}
            >
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Roll call will commit <strong>{students.length}</strong> resident records to registry.
              </span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="action-btn-secondary"
                  onClick={() => setBulkModalOpen(false)}
                  disabled={formSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="action-btn-primary" disabled={formSubmitting}>
                  {formSubmitting
                    ? 'Saving Records...'
                    : `Submit Roll Call (${students.length} Students)`}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* MODAL 3: Submit Attendance Correction                               */}
      {/* =================================================================== */}
      {correctionModalOpen && selectedRecord && (
        <Modal
          isOpen={correctionModalOpen}
          onClose={() => !formSubmitting && setCorrectionModalOpen(false)}
          title="Submit Attendance Correction Request"
          size="md"
        >
          <form onSubmit={handleCorrectionSubmit}>
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
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '16px',
                fontSize: '13px',
              }}
            >
              <div style={{ color: '#64748b', marginBottom: '4px' }}>Target Record:</div>
              <div style={{ fontWeight: 600, color: '#0f172a' }}>
                {studentMap.get(selectedRecord.student_id)?.first_name || 'Resident'}{' '}
                {studentMap.get(selectedRecord.student_id)?.last_name || ''}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                Date: {new Date(selectedRecord.attendance_date).toLocaleDateString()} • Current Status:{' '}
                <strong>{selectedRecord.status}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <FormField label="Adjusted New Status" required>
                <select
                  className="filter-select"
                  style={{ width: '100%', height: '38px' }}
                  value={correctionFormData.new_status}
                  onChange={(e) =>
                    setCorrectionFormData((prev) => ({ ...prev, new_status: e.target.value }))
                  }
                  required
                >
                  <option value="PRESENT">PRESENT</option>
                  <option value="ABSENT">ABSENT</option>
                  <option value="LATE">LATE</option>
                  <option value="ON_LEAVE">ON_LEAVE</option>
                  <option value="EXCUSED">EXCUSED</option>
                </select>
              </FormField>

              <FormField
                label="Correction Reason / Justification"
                required
                helperText="Provide formal justification for audit and compliance trail."
              >
                <textarea
                  className="filter-search-input"
                  style={{ width: '100%', minHeight: '80px', padding: '8px 12px' }}
                  placeholder="e.g. Student was attending college cultural event with valid faculty permission note."
                  value={correctionFormData.correction_reason}
                  onChange={(e) =>
                    setCorrectionFormData((prev) => ({
                      ...prev,
                      correction_reason: e.target.value,
                    }))
                  }
                  required
                />
              </FormField>

              <FormField label="Updated Remarks">
                <input
                  type="text"
                  className="filter-search-input"
                  style={{ width: '100%', height: '38px' }}
                  placeholder="Additional audit notes"
                  value={correctionFormData.remarks}
                  onChange={(e) =>
                    setCorrectionFormData((prev) => ({ ...prev, remarks: e.target.value }))
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
                onClick={() => setCorrectionModalOpen(false)}
                disabled={formSubmitting}
              >
                Cancel
              </button>
              <button type="submit" className="action-btn-primary" disabled={formSubmitting}>
                {formSubmitting ? 'Submitting...' : 'Submit Correction'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* DRAWER: Attendance Dossier & Audit                                  */}
      {/* =================================================================== */}
      {detailsDrawerOpen && selectedRecord && (
        <div
          className="attendance-drawer-overlay"
          onClick={() => setDetailsDrawerOpen(false)}
        >
          <div
            className="attendance-drawer-content"
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
                  <ClipboardCheck size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                    Attendance Record Dossier
                  </h3>
                  <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                    Institutional Curfew Verification & Audit
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

            {/* Resident Overview */}
            <div
              style={{
                background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '18px',
              }}
            >
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Resident Profile
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>
                {studentMap.get(selectedRecord.student_id)?.first_name || 'Resident'}{' '}
                {studentMap.get(selectedRecord.student_id)?.last_name || ''}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <GraduationCap size={14} style={{ color: '#2563eb' }} />
                <span>
                  Registration:{' '}
                  <strong>
                    {studentMap.get(selectedRecord.student_id)?.registration_number ||
                      studentMap.get(selectedRecord.student_id)?.admission_number ||
                      'N/A'}
                  </strong>
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                Email: {studentMap.get(selectedRecord.student_id)?.email || 'N/A'}
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
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>Attendance Status</span>
                <div>{renderStatusBadge(selectedRecord.status)}</div>
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
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>Roll-Call Date</span>
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>
                  {new Date(selectedRecord.attendance_date).toLocaleDateString(undefined, {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
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
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>Verification Method</span>
                <span className="code-pill" style={{ fontSize: '0.78rem' }}>
                  {selectedRecord.scan_method || 'MANUAL'}
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
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>Recorded Timestamp</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a' }}>
                  {selectedRecord.created_at
                    ? new Date(selectedRecord.created_at).toLocaleString()
                    : 'N/A'}
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
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>Audit Correction Flag</span>
                <span
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: selectedRecord.is_corrected ? '#9333ea' : '#64748b',
                  }}
                >
                  {selectedRecord.is_corrected ? 'Audited Adjustment' : 'Original Entry'}
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
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>Record UUID</span>
                <code style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  {selectedRecord.id}
                </code>
              </div>
            </div>

            {/* Remarks Section */}
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>
                Audit Remarks & Notes
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
                {selectedRecord.remarks || 'No audit remarks recorded for this roll call entry.'}
              </div>
            </div>

            {/* Action buttons inside drawer */}
            <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
              {canManageAttendance && (
                <button
                  type="button"
                  className="action-btn-primary"
                  style={{ width: '100%', justifyContent: 'center', padding: '10px 16px' }}
                  onClick={() => {
                    setDetailsDrawerOpen(false);
                    handleOpenCorrectionModal(selectedRecord);
                  }}
                >
                  <FileEdit size={15} />
                  <span>Request / Submit Correction</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
