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
      return <span className="badge-enterprise badge-emerald">PRESENT</span>;
    } else if (st === 'ABSENT') {
      return <span className="badge-enterprise badge-rose">ABSENT</span>;
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
    <div className="enterprise-module-page">
      {/* Header Bar */}
      <div className="enterprise-page-header">
        <div className="header-text-group">
          <div className="header-title-row">
            <div className="header-icon-badge">
              <ClipboardCheck size={22} />
            </div>
            <div>
              <h1 className="header-title">Student Attendance & Curfew</h1>
              <p className="header-subtitle">
                Institutional roll-call registry, nightly presence checks, and correction audits.
              </p>
            </div>
          </div>
        </div>

        <div className="header-actions-group">
          <button
            type="button"
            className="action-btn-secondary"
            onClick={() => loadAttendanceData(true)}
            disabled={isRefreshing || loading}
            title="Refresh Attendance Data"
          >
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          {canManageAttendance && (
            <>
              <button
                type="button"
                className="action-btn-secondary"
                onClick={handleOpenBulkModal}
                disabled={loading}
              >
                <Users size={15} />
                <span>Bulk Roll Call</span>
              </button>

              <button
                type="button"
                className="action-btn-primary"
                onClick={handleOpenMarkModal}
                disabled={loading}
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

      {/* KPI Stats Bar */}
      <div className="kpi-cards-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Total Attendance Logs</span>
            <div className="stat-kpi-icon-wrap blue">
              <ClipboardCheck size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-blue-600">{kpis.total}</div>
          <div className="stat-kpi-footnote">
            <span>Authoritative check-in registry</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Verified Present</span>
            <div className="stat-kpi-icon-wrap emerald">
              <UserCheck size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-emerald-600">{kpis.present}</div>
          <div className="stat-kpi-footnote">
            <span className="status-dot green" />
            <span>Curfew attendance confirmed</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Unaccounted Absent</span>
            <div className="stat-kpi-icon-wrap red">
              <UserX size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-rose-600">{kpis.absent}</div>
          <div className="stat-kpi-footnote">
            <span className="status-dot red" />
            <span>Missing at roll call</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Late / On Leave / Excused</span>
            <div className="stat-kpi-icon-wrap orange">
              <Clock size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-orange-600">
            {kpis.late + kpis.onLeave + kpis.excused}
          </div>
          <div className="stat-kpi-footnote">
            <span>{kpis.late} late • {kpis.onLeave} on leave • {kpis.excused} excused</span>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="enterprise-card">
        <div className="card-topbar">
          <div className="card-title-group">
            <div className="card-title-icon-wrap">
              <ClipboardCheck size={16} />
            </div>
            <h2 className="card-title-text">Attendance Roll-Call Ledger</h2>
          </div>
          <span className="badge-enterprise badge-emerald">
            {filteredRecords.length} of {attendanceRecords.length} Records Showing
          </span>
        </div>

        {/* Filter Toolbar */}
        <div className="enterprise-filter-bar">
          <div className="filter-search-field">
            <Search size={14} className="filter-search-icon" />
            <input
              type="text"
              className="filter-search-input"
              placeholder="Search by student name, registration number, or remarks..."
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
              <option value="ALL">All Attendance Statuses</option>
              <option value="PRESENT">PRESENT</option>
              <option value="ABSENT">ABSENT</option>
              <option value="LATE">LATE</option>
              <option value="ON_LEAVE">ON_LEAVE</option>
              <option value="EXCUSED">EXCUSED</option>
              <option value="HOLIDAY">HOLIDAY</option>
            </select>

            <select
              className="filter-select"
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
            >
              <option value="ALL">All Scan Methods</option>
              <option value="MANUAL">MANUAL</option>
              <option value="QR">QR CODE</option>
              <option value="BARCODE">BARCODE</option>
              <option value="SYSTEM">SYSTEM</option>
            </select>

            <select
              className="filter-select"
              value={dateFilterPreset}
              onChange={(e) => setDateFilterPreset(e.target.value)}
            >
              <option value="ALL">All Recorded Dates</option>
              <option value="TODAY">Today Only</option>
              <option value="YESTERDAY">Yesterday</option>
              <option value="LAST_7_DAYS">Last 7 Days</option>
              <option value="LAST_30_DAYS">Last 30 Days</option>
            </select>
          </div>
        </div>

        {/* Attendance Records Table */}
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
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '48px 0' }}>
                    <LoadingState message="Loading attendance records from institutional server..." />
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '48px 0' }}>
                    <EmptyState
                      icon={ClipboardCheck}
                      title="No attendance records found"
                      description={
                        searchTerm || statusFilter !== 'ALL' || dateFilterPreset !== 'ALL'
                          ? 'Try adjusting your search criteria or date preset.'
                          : 'No roll-call attendance records have been registered yet.'
                      }
                      actionLabel={canManageAttendance ? 'Mark Attendance' : undefined}
                      onAction={canManageAttendance ? handleOpenMarkModal : undefined}
                    />
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => {
                  const student = studentMap.get(rec.student_id);
                  const studentName = student
                    ? `${student.first_name || ''} ${student.last_name || ''}`.trim()
                    : 'Unknown Resident';
                  const regNo =
                    student?.registration_number ||
                    student?.admission_number ||
                    (rec.student_id ? rec.student_id.slice(0, 8) + '...' : 'N/A');

                  const formattedDate = rec.attendance_date
                    ? new Date(rec.attendance_date).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                    : '—';

                  const formattedRecordedTime = rec.recorded_at
                    ? new Date(rec.recorded_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—';

                  return (
                    <tr key={rec.id} className="enterprise-table-row">
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

                      {/* Attendance Date */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Calendar size={13} style={{ color: '#64748b' }} />
                          <span style={{ fontWeight: 500, fontSize: '13px' }}>{formattedDate}</span>
                        </div>
                      </td>

                      {/* Attendance Status */}
                      <td>{renderStatusBadge(rec.status)}</td>

                      {/* Scan Method */}
                      <td>
                        <span
                          style={{
                            fontSize: '11.5px',
                            fontWeight: 600,
                            color: '#475569',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            padding: '3px 7px',
                            borderRadius: '4px',
                          }}
                        >
                          {rec.scan_method || 'MANUAL'}
                        </span>
                      </td>

                      {/* Recorded Timestamp */}
                      <td>
                        <div style={{ fontSize: '12.5px', color: '#334155' }}>
                          {formattedRecordedTime}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                          {rec.recorded_at ? new Date(rec.recorded_at).toLocaleDateString() : ''}
                        </div>
                      </td>

                      {/* Remarks & Corrected State */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {rec.is_corrected && (
                            <span
                              className="badge-enterprise badge-purple"
                              title="Record was adjusted via approved correction"
                            >
                              CORRECTED
                            </span>
                          )}
                          <span
                            style={{
                              fontSize: '12.5px',
                              color: rec.remarks ? '#334155' : '#94a3b8',
                              maxWidth: '180px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              display: 'inline-block',
                            }}
                          >
                            {rec.remarks || 'No notes'}
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
                            title="View Full Attendance Dossier"
                            onClick={() => handleOpenDetailsDrawer(rec)}
                          >
                            <Eye size={14} />
                          </button>

                          {canManageAttendance && (
                            <button
                              type="button"
                              className="table-icon-btn"
                              title="Request / Submit Attendance Correction"
                              onClick={() => handleOpenCorrectionModal(rec)}
                            >
                              <FileEdit size={14} />
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
      {/* MODAL 2: Bulk Roll Call                                            */}
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

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#475569',
                      marginBottom: '4px',
                    }}
                  >
                    Roll-Call Date
                  </label>
                  <input
                    type="date"
                    className="filter-select"
                    style={{ height: '36px' }}
                    value={bulkDate}
                    onChange={(e) => setBulkDate(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#475569',
                      marginBottom: '4px',
                    }}
                  >
                    Method
                  </label>
                  <select
                    className="filter-select"
                    style={{ height: '36px' }}
                    value={bulkMethod}
                    onChange={(e) => setBulkMethod(e.target.value)}
                  >
                    <option value="MANUAL">MANUAL</option>
                    <option value="SYSTEM">SYSTEM</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className="action-btn-secondary"
                  style={{ fontSize: '12px', padding: '6px 10px' }}
                  onClick={() => handleToggleAllBulk('PRESENT')}
                >
                  All Present
                </button>
                <button
                  type="button"
                  className="action-btn-secondary"
                  style={{ fontSize: '12px', padding: '6px 10px' }}
                  onClick={() => handleToggleAllBulk('ABSENT')}
                >
                  All Absent
                </button>
              </div>
            </div>

            <div
              style={{
                maxHeight: '380px',
                overflowY: 'auto',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
              }}
            >
              <table className="enterprise-table" style={{ fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th>Student Name & Reg</th>
                    <th style={{ textAlign: 'center' }}>Presence Status</th>
                  </tr>
                </thead>
                <tbody>
                  {students.length === 0 ? (
                    <tr>
                      <td colSpan="2" style={{ textAlign: 'center', padding: '24px' }}>
                        No enrolled students found in directory.
                      </td>
                    </tr>
                  ) : (
                    students.map((s) => {
                      const curStatus = bulkStudentStatuses[s.id] || 'PRESENT';
                      return (
                        <tr key={s.id}>
                          <td>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>
                              {s.first_name} {s.last_name}
                            </div>
                            <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                              Reg: {s.registration_number || s.admission_number || 'N/A'}
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div
                              style={{ display: 'inline-flex', gap: '4px', background: '#f8fafc', padding: '3px', borderRadius: '6px' }}
                            >
                              {['PRESENT', 'ABSENT', 'LATE', 'ON_LEAVE'].map((st) => (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={() => handleSetStudentStatus(s.id, st)}
                                  style={{
                                    border: 'none',
                                    borderRadius: '4px',
                                    padding: '4px 8px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    background:
                                      curStatus === st
                                        ? st === 'PRESENT'
                                          ? '#10b981'
                                          : st === 'ABSENT'
                                          ? '#ef4444'
                                          : st === 'LATE'
                                          ? '#f59e0b'
                                          : '#3b82f6'
                                        : 'transparent',
                                    color: curStatus === st ? '#ffffff' : '#64748b',
                                  }}
                                >
                                  {st}
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                marginTop: '20px',
                paddingTop: '14px',
                borderTop: '1px solid #f1f5f9',
              }}
            >
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
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                Date:{' '}
                {new Date(selectedRecord.attendance_date).toLocaleDateString()} • Current Status:{' '}
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
      {/* DRAWER: Attendance Dossier                                          */}
      {/* =================================================================== */}
      {detailsDrawerOpen && selectedRecord && (
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
              maxWidth: '460px',
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
                <ClipboardCheck size={20} style={{ color: '#2563eb' }} />
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 600, color: '#0f172a' }}>
                  Attendance Record Dossier
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

            {/* Resident Overview */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '16px',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Resident Identity
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                {studentMap.get(selectedRecord.student_id)?.first_name || 'Resident'}{' '}
                {studentMap.get(selectedRecord.student_id)?.last_name || ''}
              </div>
              <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px' }}>
                Reg Number:{' '}
                <code style={{ color: '#0f172a' }}>
                  {studentMap.get(selectedRecord.student_id)?.registration_number ||
                    studentMap.get(selectedRecord.student_id)?.admission_number ||
                    'N/A'}
                </code>
              </div>
              <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px' }}>
                Email: {studentMap.get(selectedRecord.student_id)?.email || 'N/A'}
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
                <span style={{ fontSize: '13px', color: '#64748b' }}>Attendance Status</span>
                <div>{renderStatusBadge(selectedRecord.status)}</div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                <span style={{ fontSize: '13px', color: '#64748b' }}>Roll-Call Date</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
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
                  padding: '10px 0',
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                <span style={{ fontSize: '13px', color: '#64748b' }}>Verification Method</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                  {selectedRecord.scan_method || 'MANUAL'}
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
                <span style={{ fontSize: '13px', color: '#64748b' }}>Recorded At</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                  {selectedRecord.recorded_at
                    ? new Date(selectedRecord.recorded_at).toLocaleString()
                    : 'N/A'}
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
                <span style={{ fontSize: '13px', color: '#64748b' }}>Correction Flag</span>
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: selectedRecord.is_corrected ? '#9333ea' : '#64748b',
                  }}
                >
                  {selectedRecord.is_corrected ? 'Corrected Record' : 'Original Entry'}
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
                <span style={{ fontSize: '13px', color: '#64748b' }}>Record UUID</span>
                <code style={{ fontSize: '11px', color: '#64748b' }}>
                  {selectedRecord.id}
                </code>
              </div>
            </div>

            {/* Remarks Section */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                Audit Remarks
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
                {selectedRecord.remarks || 'No remarks recorded for this roll call entry.'}
              </div>
            </div>

            {/* Action buttons inside drawer */}
            <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
              {canManageAttendance && (
                <button
                  type="button"
                  className="action-btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
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
