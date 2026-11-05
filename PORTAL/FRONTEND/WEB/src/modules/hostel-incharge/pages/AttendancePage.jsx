import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import inchargeService from '../services/inchargeService';
import { PERMISSIONS } from '../constants/permissions';
import PageHeader from '../components/PageHeader';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import Badge from '../components/Badge';
import Button from '../components/Button';
import SearchInput from '../components/SearchInput';
import { formatDate, formatDateTime, truncateUUID } from '../utils/formatUtils';
import {
  ClipboardList,
  CheckCircle2,
  RefreshCw,
  Plus,
  SlidersHorizontal,
  FileCheck,
  Info
} from 'lucide-react';

export default function AttendancePage() {
  const [searchParams, setSearchParams] = useSearchParams();
    const { assignedHostel } = useAuth();
  const { hasPermission } = usePermissions();

  const canManage = hasPermission(PERMISSIONS.MOVEMENT_MANAGE) || hasPermission(PERMISSIONS.PEOPLE_MANAGE);

  // URL Query Parameters
  const paramStudentId = searchParams.get('studentId');

  // Master Data
  const [hostelData, setHostelData] = useState(null);
  const [residents, setResidents] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [, setBlocks] = useState([]);

  // Active Date Filter (Defaults to Today YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Loading & State flags
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [successBanner, setSuccessBanner] = useState(null);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [blockFilter, setBlockFilter] = useState('ALL');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(15);

  // Modals & Action State
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [markModalOpen, setMarkModalOpen] = useState(false);
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

  // Forms
  const [markForm, setMarkForm] = useState({
    student_id: '',
    status: 'PRESENT',
    scan_method: 'MANUAL',
    remarks: '',
  });

  const [correctionForm, setCorrectionForm] = useState({
    new_status: 'PRESENT',
    correction_reason: '',
    remarks: '',
  });

  // Bulk Roll-Call State: Map of student_id -> { status: string, remarks: string }
  const [bulkState, setBulkState] = useState({});
  const [bulkBlockFilter, setBulkBlockFilter] = useState('ALL');

  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Auto-dismiss banner
  useEffect(() => {
    if (successBanner) {
      const timer = setTimeout(() => setSuccessBanner(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successBanner]);

  // Load attendance data for the selected date
  const loadAttendanceData = useCallback(
    async (isSilent = false) => {
      try {
        if (isSilent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        setError(null);

        // 1. Fetch assigned hostel
        const hostel = await inchargeService.getMyHostel();
        setHostelData(hostel);

        const hostelId = hostel?.id || hostel?.hostel_id || assignedHostel?.id;
        if (!hostelId) {
          throw new Error('No assigned hostel found for the authenticated user.');
        }

        // 2. Fetch parallel datasets: Assigned Residents, Attendance Records, Blocks
        // Construct start and end of day in RFC3339 for the selected date
        const startOfDay = new Date(`${selectedDate}T00:00:00.000Z`).toISOString();
        const endOfDay = new Date(`${selectedDate}T23:59:59.999Z`).toISOString();

        const [residentsRes, recordsRes, blocksRes] = await Promise.allSettled([
          inchargeService.getHostelResidents(hostelId),
          inchargeService.getStudentAttendanceList({
            start_date: startOfDay,
            end_date: endOfDay,
          }),
          inchargeService.getBlocks(hostelId),
        ]);

        const rawResidents = residentsRes.status === 'fulfilled' ? residentsRes.value : [];
        const rawRecords = recordsRes.status === 'fulfilled' ? recordsRes.value : [];
        const rawBlocks = blocksRes.status === 'fulfilled' ? blocksRes.value : [];

        const validResidents = Array.isArray(rawResidents) ? rawResidents : [];
        setResidents(validResidents);
        setAttendanceRecords(Array.isArray(rawRecords) ? rawRecords : []);
        setBlocks(Array.isArray(rawBlocks) ? rawBlocks : []);
      } catch (err) {
        console.error('Failed to load attendance data:', err);
        setError(err.message || 'Failed to retrieve attendance roster.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [assignedHostel, selectedDate]
  );

  useEffect(() => {
    loadAttendanceData(false);
  }, [loadAttendanceData]);

  // High-Efficiency Algorithmic Maps for O(1) Lookups
  const { residentAttendanceMap } = useMemo(() => {
    const resAttMap = new Map();
    const attRecMap = new Map();

    attendanceRecords.forEach((rec) => {
      if (rec.student_id) {
        resAttMap.set(rec.student_id, rec);
      }
      if (rec.id) {
        attRecMap.set(rec.id, rec);
      }
    });

    return {
      residentAttendanceMap: resAttMap,
      attendanceByRecordMap: attRecMap,
    };
  }, [attendanceRecords]);

  // Synchronize bulk roll-call initial state whenever residents or attendance change
  useEffect(() => {
    const initialBulk = {};
    residents.forEach((r) => {
      const existing = residentAttendanceMap.get(r.student_id);
      initialBulk[r.student_id] = {
        status: existing ? existing.status : 'PRESENT',
        remarks: existing?.remarks || '',
      };
    });
    setBulkState(initialBulk);
  }, [residents, residentAttendanceMap]);

  // Combined Roster Row Model (Resident + Today's Attendance State)
  const roster = useMemo(() => {
    return residents.map((resident) => {
      const attendance = residentAttendanceMap.get(resident.student_id);
      return {
        ...resident,
        attendanceRecord: attendance || null,
        attendanceStatus: attendance ? attendance.status : 'UNRECORDED',
      };
    });
  }, [residents, residentAttendanceMap]);

  // Filtered Roster
  const filteredRoster = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return roster.filter((item) => {
      // 1. Status Filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'UNRECORDED' && item.attendanceStatus !== 'UNRECORDED') return false;
        if (statusFilter !== 'UNRECORDED' && item.attendanceStatus !== statusFilter) return false;
      }

      // 2. Block Filter
      if (blockFilter !== 'ALL' && item.block_name !== blockFilter) return false;

      // 3. URL Param Filter
      if (paramStudentId && item.student_id !== paramStudentId) return false;

      // 4. Search Filter
      if (term) {
        const nameMatch = (item.full_name || '').toLowerCase().includes(term);
        const rollMatch = (item.roll_number || '').toLowerCase().includes(term);
        const admMatch = (item.admission_number || '').toLowerCase().includes(term);
        const roomMatch = (item.room_name || item.room_code || '').toLowerCase().includes(term);
        const bedMatch = (item.bed_name || '').toLowerCase().includes(term);
        const blockMatch = (item.block_name || '').toLowerCase().includes(term);
        if (!nameMatch && !rollMatch && !admMatch && !roomMatch && !bedMatch && !blockMatch) return false;
      }

      return true;
    });
  }, [roster, searchTerm, statusFilter, blockFilter, paramStudentId]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredRoster.length / pageSize));
  const paginatedRoster = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRoster.slice(start, start + pageSize);
  }, [filteredRoster, currentPage, pageSize]);

  // Authoritative Telemetry Counts for Today's Attendance
  const summaryCounts = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let onLeave = 0;
    let unrecorded = 0;

    roster.forEach((item) => {
      switch (item.attendanceStatus) {
        case 'PRESENT':
          present++;
          break;
        case 'ABSENT':
          absent++;
          break;
        case 'LATE':
          late++;
          break;
        case 'ON_LEAVE':
        case 'EXCUSED':
          onLeave++;
          break;
        default:
          unrecorded++;
          break;
      }
    });

    const total = roster.length;
    const presentRate = total > 0 ? Math.round((present / total) * 100) : 0;

    return { total, present, absent, late, onLeave, unrecorded, presentRate };
  }, [roster]);

  // Unique Blocks for Filter
  const availableBlocks = useMemo(() => {
    const bSet = new Set();
    residents.forEach((r) => {
      if (r.block_name) bSet.add(r.block_name);
    });
    return Array.from(bSet).sort();
  }, [residents]);

  // 1. Single Student Attendance Marking Submit Handler
  const handleMarkSubmit = async (e) => {
    e.preventDefault();
    if (!markForm.student_id) {
      setFormError('Please select a resident student.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    try {
      const attendanceDateTimestamp = new Date(`${selectedDate}T00:00:00.000Z`).toISOString();

      await inchargeService.markStudentAttendance({
        student_id: markForm.student_id,
        attendance_date: attendanceDateTimestamp,
        status: markForm.status,
        scan_method: markForm.scan_method || 'MANUAL',
        remarks: markForm.remarks ? markForm.remarks.trim() : null,
      });

      setSuccessBanner('Resident attendance recorded successfully.');
      setMarkModalOpen(false);
      setMarkForm({
        student_id: '',
        status: 'PRESENT',
        scan_method: 'MANUAL',
        remarks: '',
      });
      await loadAttendanceData(true);
    } catch (err) {
      console.error('Failed to mark attendance:', err);
      const msg = err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Failed to mark attendance.';
      setFormError(msg);
    } finally {
      setFormSubmitting(false);
    }
  };

  // 2. Quick-Mark Individual Student Directly from Roster
  const handleQuickMark = async (studentId, status) => {
    setFormError(null);
    try {
      const attendanceDateTimestamp = new Date(`${selectedDate}T00:00:00.000Z`).toISOString();
      await inchargeService.markStudentAttendance({
        student_id: studentId,
        attendance_date: attendanceDateTimestamp,
        status: status,
        scan_method: 'MANUAL',
      });
      setSuccessBanner(`Attendance updated to ${status}.`);
      await loadAttendanceData(true);
    } catch (err) {
      console.error('Quick mark failed:', err);
      const msg = err.response?.data?.error?.message || err.response?.data?.message || err.message;
      alert(`Could not record attendance: ${msg}`);
    }
  };

  // 3. Bulk Roll-Call Submission Handler
  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);

    try {
      const attendanceDateTimestamp = new Date(`${selectedDate}T00:00:00.000Z`).toISOString();
      const recordsToSubmit = [];

      residents.forEach((r) => {
        // Respect block filter if active in bulk modal
        if (bulkBlockFilter !== 'ALL' && r.block_name !== bulkBlockFilter) return;

        const entry = bulkState[r.student_id];
        if (entry) {
          recordsToSubmit.push({
            student_id: r.student_id,
            attendance_date: attendanceDateTimestamp,
            status: entry.status || 'PRESENT',
            scan_method: 'MANUAL',
            remarks: entry.remarks ? entry.remarks.trim() : null,
          });
        }
      });

      if (recordsToSubmit.length === 0) {
        throw new Error('No resident records selected for roll-call submission.');
      }

      await inchargeService.bulkMarkStudentAttendance({
        records: recordsToSubmit,
      });

      setSuccessBanner(`Curfew roll-call completed for ${recordsToSubmit.length} residents successfully.`);
      setBulkModalOpen(false);
      await loadAttendanceData(true);
    } catch (err) {
      console.error('Bulk attendance failed:', err);
      const msg = err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Failed to record bulk attendance.';
      setFormError(msg);
    } finally {
      setFormSubmitting(false);
    }
  };

  // 4. Submit Attendance Correction Request
  const handleCorrectionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRecord || !correctionForm.correction_reason.trim()) {
      setFormError('A justification reason is required for attendance correction.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    try {
      await inchargeService.submitAttendanceCorrection({
        record_id: selectedRecord.id,
        new_status: correctionForm.new_status,
        correction_reason: correctionForm.correction_reason.trim(),
        remarks: correctionForm.remarks ? correctionForm.remarks.trim() : null,
      });

      setSuccessBanner('Attendance correction request submitted successfully.');
      setCorrectionModalOpen(false);
      setSelectedRecord(null);
      await loadAttendanceData(true);
    } catch (err) {
      console.error('Correction failed:', err);
      const msg = err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Failed to submit correction.';
      setFormError(msg);
    } finally {
      setFormSubmitting(false);
    }
  };

  const activeHostel = hostelData || assignedHostel;

  return (
    <div>
      <PageHeader
        title="Daily Attendance & Curfew Operations"
        description="Verify daily night roll-call, mark manual check-ins, record bulk curfew status, and log attendance corrections."
        icon={ClipboardList}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Button
              variant="outline"
              size="sm"
              icon={RefreshCw}
              onClick={() => loadAttendanceData(true)}
              loading={refreshing}
            >
              Sync Records
            </Button>
            {canManage && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={FileCheck}
                  onClick={() => {
                    setFormError(null);
                    setBulkModalOpen(true);
                  }}
                >
                  Curfew Roll-Call (Bulk)
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={Plus}
                  onClick={() => {
                    setFormError(null);
                    setMarkModalOpen(true);
                  }}
                >
                  Mark Resident
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* Success Notification */}
      {successBanner && (
        <div
          style={{
            backgroundColor: 'var(--success-bg)',
            border: '1px solid var(--success-border)',
            borderRadius: '8px',
            padding: '12px 18px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: 'var(--success-text)',
            fontSize: '0.88rem',
            fontWeight: 500,
          }}
        >
          <CheckCircle2 size={18} />
          <span>{successBanner}</span>
        </div>
      )}

      {/* Curfew Protocol Notice */}
      <div
        style={{
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '8px',
          padding: '12px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          color: '#1e40af',
          fontSize: '0.85rem',
        }}
      >
        <Info size={18} style={{ flexShrink: 0 }} />
        <div>
          <strong>Curfew Compliance Protocol:</strong> Night roll-call verifies student physical presence in assigned rooms. Students with approved Leave Requests should be logged as <strong>ON_LEAVE</strong>. Unexcused absentees trigger automatic compliance notifications to hostel wardens.
        </div>
      </div>

      {loading && <LoadingState title="Loading Attendance Records..." rows={4} />}
      {error && (
        <ErrorState
          title="Unable to Access Attendance Roster"
          message={error}
          onRetry={() => loadAttendanceData(false)}
        />
      )}

      {!loading && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Authoritative KPI Tiles for Selected Date */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '14px',
            }}
          >
            <div
              style={{
                padding: '16px',
                borderRadius: '10px',
                backgroundColor: '#ffffff',
                border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Total Residents
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                {summaryCounts.total}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Assigned to hostel</div>
            </div>

            <div
              style={{
                padding: '16px',
                borderRadius: '10px',
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
              }}
            >
              <div style={{ fontSize: '0.78rem', color: '#166534', fontWeight: 600 }}>Present Today</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#15803d', marginTop: '4px' }}>
                {summaryCounts.present}{' '}
                <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>({summaryCounts.presentRate}%)</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#166534' }}>Verified present</div>
            </div>

            <div
              style={{
                padding: '16px',
                borderRadius: '10px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
              }}
            >
              <div style={{ fontSize: '0.78rem', color: '#991b1b', fontWeight: 600 }}>Absent</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#b91c1c', marginTop: '4px' }}>
                {summaryCounts.absent}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#991b1b' }}>Unexcused missing</div>
            </div>

            <div
              style={{
                padding: '16px',
                borderRadius: '10px',
                backgroundColor: '#fffbeb',
                border: '1px solid #fde68a',
              }}
            >
              <div style={{ fontSize: '0.78rem', color: '#92400e', fontWeight: 600 }}>Late Return</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#b45309', marginTop: '4px' }}>
                {summaryCounts.late}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#92400e' }}>After curfew hours</div>
            </div>

            <div
              style={{
                padding: '16px',
                borderRadius: '10px',
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
              }}
            >
              <div style={{ fontSize: '0.78rem', color: '#1e40af', fontWeight: 600 }}>On Leave / Excused</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#2563eb', marginTop: '4px' }}>
                {summaryCounts.onLeave}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#1e40af' }}>Approved night out</div>
            </div>

            <div
              style={{
                padding: '16px',
                borderRadius: '10px',
                backgroundColor: '#f8fafc',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Unrecorded</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-secondary)', marginTop: '4px' }}>
                {summaryCounts.unrecorded}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Pending verification</div>
            </div>
          </div>

          {/* Search, Date & Filter Toolbar */}
          <div className="card" style={{ padding: '18px 24px' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '14px',
                alignItems: 'flex-end',
              }}
            >
              {/* Date Selector */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    marginBottom: '6px',
                  }}
                >
                  Roll-Call Date:
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: '#ffffff',
                    fontSize: '0.86rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              {/* Status Filter */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    marginBottom: '6px',
                  }}
                >
                  Attendance Status:
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: '#ffffff',
                    fontSize: '0.86rem',
                  }}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PRESENT">PRESENT</option>
                  <option value="ABSENT">ABSENT</option>
                  <option value="LATE">LATE</option>
                  <option value="ON_LEAVE">ON_LEAVE</option>
                  <option value="EXCUSED">EXCUSED</option>
                  <option value="UNRECORDED">UNRECORDED</option>
                </select>
              </div>

              {/* Block Filter */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    marginBottom: '6px',
                  }}
                >
                  Hostel Block:
                </label>
                <select
                  value={blockFilter}
                  onChange={(e) => {
                    setBlockFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: '#ffffff',
                    fontSize: '0.86rem',
                  }}
                >
                  <option value="ALL">All Blocks</option>
                  {availableBlocks.map((b) => (
                    <option key={b} value={b}>
                      Block {b}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search Bar */}
              <div style={{ gridColumn: 'span 2' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    marginBottom: '6px',
                  }}
                >
                  Search Residents:
                </label>
                <SearchInput
                  value={searchTerm}
                  onChange={(val) => {
                    setSearchTerm(val);
                    setCurrentPage(1);
                  }}
                  placeholder="Search by student name, roll no, room code, bed..."
                  debounceMs={300}
                />
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '14px',
                paddingTop: '12px',
                borderTop: '1px solid #f1f5f9',
                fontSize: '0.82rem',
                color: 'var(--text-secondary)',
              }}
            >
              <div>
                Showing <strong>{filteredRoster.length}</strong> resident records for{' '}
                <strong>{formatDate(selectedDate)}</strong>
                {paramStudentId && (
                  <span style={{ marginLeft: '10px', color: 'var(--primary-color)' }}>
                    (Filtered by Student ID —{' '}
                    <button
                      type="button"
                      onClick={() => setSearchParams({})}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary-color)',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Clear filter
                    </button>
                    )
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Daily Attendance Roster Table */}
          {filteredRoster.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No Residents Found"
              message="No resident students matched your filter criteria for this date."
            />
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-container" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Resident Student
                      </th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Room & Bed
                      </th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Block</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Curfew Status
                      </th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Method</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Recorded At
                      </th>
                      <th
                        style={{
                          padding: '12px 16px',
                          fontWeight: 600,
                          color: 'var(--text-secondary)',
                          textAlign: 'right',
                        }}
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRoster.map((item) => {
                      const rec = item.attendanceRecord;
                      const hasRecord = Boolean(rec);

                      return (
                        <tr
                          key={item.student_id}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            transition: 'background-color 0.15s ease',
                          }}
                        >
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{item.full_name}</div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                              Roll: <strong>{item.roll_number || item.admission_number || '—'}</strong>
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                Room {item.room_name || item.room_code || '—'}
                              </div>
                              <div style={{ fontSize: '0.74rem', color: 'var(--primary-color)' }}>
                                Bed: {item.bed_name || 'Assigned'}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                            {item.block_name ? `Block ${item.block_name}` : '—'}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Badge
                                variant={
                                  item.attendanceStatus === 'PRESENT'
                                    ? 'success'
                                    : item.attendanceStatus === 'ABSENT'
                                    ? 'danger'
                                    : item.attendanceStatus === 'LATE'
                                    ? 'warning'
                                    : item.attendanceStatus === 'ON_LEAVE' || item.attendanceStatus === 'EXCUSED'
                                    ? 'info'
                                    : 'neutral'
                                }
                              >
                                {item.attendanceStatus}
                              </Badge>
                              {rec?.is_corrected && (
                                <span
                                  title="Corrected Record"
                                  style={{
                                    fontSize: '0.68rem',
                                    padding: '1px 4px',
                                    borderRadius: '3px',
                                    backgroundColor: '#f1f5f9',
                                    color: 'var(--text-muted)',
                                    fontWeight: 700,
                                  }}
                                >
                                  CORRECTED
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                            {rec?.scan_method || '—'}
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                            {rec?.recorded_at ? formatDateTime(rec.recorded_at) : '—'}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            {canManage && (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                                {hasRecord ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    icon={SlidersHorizontal}
                                    title="Request Attendance Correction"
                                    onClick={() => {
                                      setSelectedRecord(rec);
                                      setCorrectionForm({
                                        new_status: rec.status,
                                        correction_reason: '',
                                        remarks: rec.remarks || '',
                                      });
                                      setFormError(null);
                                      setCorrectionModalOpen(true);
                                    }}
                                  >
                                    Correct
                                  </Button>
                                ) : (
                                  <div style={{ display: 'flex', gap: '4px' }}>
                                    <button
                                      type="button"
                                      onClick={() => handleQuickMark(item.student_id, 'PRESENT')}
                                      style={{
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        border: '1px solid #bbf7d0',
                                        backgroundColor: '#f0fdf4',
                                        color: '#15803d',
                                        fontSize: '0.74rem',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                      }}
                                    >
                                      Present
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleQuickMark(item.student_id, 'ABSENT')}
                                      style={{
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        border: '1px solid #fecaca',
                                        backgroundColor: '#fef2f2',
                                        color: '#b91c1c',
                                        fontSize: '0.74rem',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                      }}
                                    >
                                      Absent
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pagination Controls */}
          {filteredRoster.length > pageSize && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 20px',
                borderRadius: '8px',
                backgroundColor: '#ffffff',
                border: '1px solid var(--border-color)',
                fontSize: '0.84rem',
              }}
            >
              <div style={{ color: 'var(--text-secondary)' }}>
                Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================== 1. BULK ROLL-CALL MODAL =================== */}
      <Modal
        isOpen={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        title={`Curfew Roll-Call for ${formatDate(selectedDate)}`}
        subtitle={`Premises: ${activeHostel?.name || 'Assigned Hostel'} (${residents.length} Registered Residents)`}
        maxWidth="820px"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkModalOpen(false)}
              disabled={formSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleBulkSubmit}
              loading={formSubmitting}
            >
              Submit Curfew Roll-Call
            </Button>
          </>
        }
      >
        <form onSubmit={handleBulkSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {formError && (
            <div
              style={{
                backgroundColor: 'var(--danger-bg)',
                color: 'var(--danger-text)',
                padding: '10px 14px',
                borderRadius: '6px',
                fontSize: '0.84rem',
              }}
            >
              {formError}
            </div>
          )}

          {/* Quick Preset Buttons & Block Filter */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: '#f8fafc',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Presets:</span>
              <button
                type="button"
                onClick={() => {
                  const updated = { ...bulkState };
                  residents.forEach((r) => {
                    if (bulkBlockFilter === 'ALL' || r.block_name === bulkBlockFilter) {
                      updated[r.student_id] = { ...updated[r.student_id], status: 'PRESENT' };
                    }
                  });
                  setBulkState(updated);
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid #bbf7d0',
                  backgroundColor: '#f0fdf4',
                  color: '#15803d',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Mark All Present
              </button>
              <button
                type="button"
                onClick={() => {
                  const updated = { ...bulkState };
                  residents.forEach((r) => {
                    if (bulkBlockFilter === 'ALL' || r.block_name === bulkBlockFilter) {
                      updated[r.student_id] = { ...updated[r.student_id], status: 'ABSENT' };
                    }
                  });
                  setBulkState(updated);
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid #fecaca',
                  backgroundColor: '#fef2f2',
                  color: '#b91c1c',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Mark All Absent
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Block:</span>
              <select
                value={bulkBlockFilter}
                onChange={(e) => setBulkBlockFilter(e.target.value)}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: '#ffffff',
                  fontSize: '0.82rem',
                }}
              >
                <option value="ALL">All Blocks</option>
                {availableBlocks.map((b) => (
                  <option key={b} value={b}>
                    Block {b}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Resident Check-in List */}
          <div
            style={{
              maxHeight: '400px',
              overflowY: 'auto',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 5 }}>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Resident</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Room / Bed</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Status Selection</th>
                </tr>
              </thead>
              <tbody>
                {residents
                  .filter((r) => bulkBlockFilter === 'ALL' || r.block_name === bulkBlockFilter)
                  .map((resident) => {
                    const currentEntry = bulkState[resident.student_id] || { status: 'PRESENT', remarks: '' };

                    return (
                      <tr key={resident.student_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{resident.full_name}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {resident.roll_number || resident.admission_number}
                          </div>
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
                          Room {resident.room_name || resident.room_code} ({resident.bed_name})
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {['PRESENT', 'ABSENT', 'LATE', 'ON_LEAVE'].map((st) => {
                              const isSelected = currentEntry.status === st;
                              let activeBg = '#15803d';
                              if (st === 'ABSENT') activeBg = '#b91c1c';
                              if (st === 'LATE') activeBg = '#b45309';
                              if (st === 'ON_LEAVE') activeBg = '#2563eb';

                              return (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={() =>
                                    setBulkState({
                                      ...bulkState,
                                      [resident.student_id]: { ...currentEntry, status: st },
                                    })
                                  }
                                  style={{
                                    padding: '3px 8px',
                                    borderRadius: '4px',
                                    border: isSelected ? `1px solid ${activeBg}` : '1px solid var(--border-color)',
                                    backgroundColor: isSelected ? activeBg : '#ffffff',
                                    color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                                    fontSize: '0.74rem',
                                    fontWeight: isSelected ? 700 : 500,
                                    cursor: 'pointer',
                                  }}
                                >
                                  {st}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </form>
      </Modal>

      {/* =================== 2. MARK SINGLE ATTENDANCE MODAL =================== */}
      <Modal
        isOpen={markModalOpen}
        onClose={() => setMarkModalOpen(false)}
        title="Mark Individual Resident Attendance"
        subtitle={`Selected Date: ${formatDate(selectedDate)}`}
        maxWidth="500px"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMarkModalOpen(false)}
              disabled={formSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleMarkSubmit}
              loading={formSubmitting}
            >
              Record Attendance
            </Button>
          </>
        }
      >
        <form onSubmit={handleMarkSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {formError && (
            <div
              style={{
                backgroundColor: 'var(--danger-bg)',
                color: 'var(--danger-text)',
                padding: '10px 14px',
                borderRadius: '6px',
                fontSize: '0.84rem',
              }}
            >
              {formError}
            </div>
          )}

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '6px',
              }}
            >
              Select Resident Student <span style={{ color: '#ef4444' }}>*</span>:
            </label>
            <select
              value={markForm.student_id}
              onChange={(e) => setMarkForm({ ...markForm, student_id: e.target.value })}
              required
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: '#ffffff',
                fontSize: '0.88rem',
              }}
            >
              <option value="">-- Choose resident student --</option>
              {residents.map((r) => (
                <option key={r.student_id} value={r.student_id}>
                  {r.full_name} ({r.roll_number || r.admission_number}) • Room {r.room_name || r.room_code}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '6px',
                }}
              >
                Curfew Status:
              </label>
              <select
                value={markForm.status}
                onChange={(e) => setMarkForm({ ...markForm, status: e.target.value })}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: '#ffffff',
                  fontSize: '0.88rem',
                }}
              >
                <option value="PRESENT">PRESENT</option>
                <option value="ABSENT">ABSENT</option>
                <option value="LATE">LATE</option>
                <option value="ON_LEAVE">ON_LEAVE</option>
                <option value="EXCUSED">EXCUSED</option>
                <option value="HOLIDAY">HOLIDAY</option>
              </select>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '6px',
                }}
              >
                Verification Method:
              </label>
              <select
                value={markForm.scan_method}
                onChange={(e) => setMarkForm({ ...markForm, scan_method: e.target.value })}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: '#ffffff',
                  fontSize: '0.88rem',
                }}
              >
                <option value="MANUAL">MANUAL (Roll-Call)</option>
                <option value="QR">QR SCAN</option>
                <option value="BARCODE">BARCODE SCAN</option>
                <option value="SYSTEM">SYSTEM AUTO</option>
              </select>
            </div>
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '6px',
              }}
            >
              Remarks / Justification:
            </label>
            <textarea
              value={markForm.remarks}
              onChange={(e) => setMarkForm({ ...markForm, remarks: e.target.value })}
              placeholder="e.g. Reported late due to college lab project..."
              rows={2}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: '#ffffff',
                fontSize: '0.88rem',
              }}
            />
          </div>
        </form>
      </Modal>

      {/* =================== 3. ATTENDANCE CORRECTION MODAL =================== */}
      <Modal
        isOpen={correctionModalOpen}
        onClose={() => setCorrectionModalOpen(false)}
        title="Submit Attendance Correction"
        subtitle={`Record ID: ${selectedRecord ? truncateUUID(selectedRecord.id) : ''}`}
        maxWidth="460px"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCorrectionModalOpen(false)}
              disabled={formSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCorrectionSubmit}
              loading={formSubmitting}
            >
              Submit Correction
            </Button>
          </>
        }
      >
        <form onSubmit={handleCorrectionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {formError && (
            <div
              style={{
                backgroundColor: 'var(--danger-bg)',
                color: 'var(--danger-text)',
                padding: '10px 14px',
                borderRadius: '6px',
                fontSize: '0.84rem',
              }}
            >
              {formError}
            </div>
          )}

          {selectedRecord && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: '#f8fafc',
                border: '1px solid var(--border-color)',
                fontSize: '0.84rem',
              }}
            >
              <div>
                Currently Recorded Status:{' '}
                <Badge variant={selectedRecord.status === 'PRESENT' ? 'success' : 'danger'}>
                  {selectedRecord.status}
                </Badge>
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Recorded At: {formatDateTime(selectedRecord.recorded_at)}
              </div>
            </div>
          )}

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '6px',
              }}
            >
              Corrected Status <span style={{ color: '#ef4444' }}>*</span>:
            </label>
            <select
              value={correctionForm.new_status}
              onChange={(e) => setCorrectionForm({ ...correctionForm, new_status: e.target.value })}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: '#ffffff',
                fontSize: '0.88rem',
              }}
            >
              <option value="PRESENT">PRESENT</option>
              <option value="ABSENT">ABSENT</option>
              <option value="LATE">LATE</option>
              <option value="ON_LEAVE">ON_LEAVE</option>
              <option value="EXCUSED">EXCUSED</option>
            </select>
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '6px',
              }}
            >
              Reason for Correction <span style={{ color: '#ef4444' }}>*</span>:
            </label>
            <textarea
              value={correctionForm.correction_reason}
              onChange={(e) => setCorrectionForm({ ...correctionForm, correction_reason: e.target.value })}
              required
              placeholder="e.g. Student provided valid medical proof; roll-call discrepancy resolved..."
              rows={3}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: '#ffffff',
                fontSize: '0.88rem',
              }}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
