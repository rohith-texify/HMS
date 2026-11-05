import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import inchargeService from '../services/inchargeService';
import PageHeader from '../components/PageHeader';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import { formatDate, getStatusBadgeVariant } from '../utils/formatUtils';
import {
  LayoutDashboard,
  Building2,
  BedDouble,
  Users,
  ClipboardList,
  FileText,
  Wrench,
  KeyRound,
  RefreshCw,
  Clock,
  ArrowRight,
  Bell,
  CheckCircle2,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';

export default function DashboardPage() {
  const { assignedHostel } = useAuth();
  const navigate = useNavigate();

  // Master Data State
  const [hostelOverview, setHostelOverview] = useState(null);
  const [residents, setResidents] = useState([]);
  const [vacantBeds, setVacantBeds] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [notifications, setNotifications] = useState([]);

  // Telemetry & UI State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(new Date());

  // Load live operational data from authorized Go backend endpoints
  const loadDashboardData = useCallback(async (isSilentRefresh = false) => {
    try {
      if (isSilentRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const [
        hostelRes,
        residentsRes,
        vacantBedsRes,
        leavesRes,
        complaintsRes,
        attendanceRes,
        notifsRes,
      ] = await Promise.allSettled([
        inchargeService.getMyHostel(),
        inchargeService.getHostelResidents(),
        inchargeService.getVacantBeds(),
        inchargeService.getLeaves({ limit: 15 }),
        inchargeService.getComplaints({ limit: 15 }),
        inchargeService.getAttendance({ limit: 20 }),
        inchargeService.getNotifications({ limit: 5 }),
      ]);

      if (hostelRes.status === 'fulfilled') {
        setHostelOverview(hostelRes.value);
      }
      if (residentsRes.status === 'fulfilled') {
        const raw = residentsRes.value;
        setResidents(Array.isArray(raw) ? raw : raw?.data || raw?.residents || []);
      }
      if (vacantBedsRes.status === 'fulfilled') {
        const raw = vacantBedsRes.value;
        setVacantBeds(Array.isArray(raw) ? raw : raw?.data || raw?.beds || []);
      }
      if (leavesRes.status === 'fulfilled') {
        const raw = leavesRes.value;
        setLeaves(Array.isArray(raw) ? raw : raw?.data || raw?.leaves || []);
      }
      if (complaintsRes.status === 'fulfilled') {
        const raw = complaintsRes.value;
        setComplaints(Array.isArray(raw) ? raw : raw?.data || raw?.complaints || []);
      }
      if (attendanceRes.status === 'fulfilled') {
        const raw = attendanceRes.value;
        setAttendanceLogs(Array.isArray(raw) ? raw : raw?.data || raw?.attendance || []);
      }
      if (notifsRes.status === 'fulfilled') {
        const raw = notifsRes.value;
        setNotifications(Array.isArray(raw) ? raw : raw?.data || raw?.notifications || []);
      }

      setLastRefreshedAt(new Date());
    } catch (err) {
      setError(err.message || 'Failed to refresh live hostel dashboard data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData(false);
  }, [loadDashboardData]);

  // Derived Operational Metrics
  const activeHostel = hostelOverview || assignedHostel;
  const totalCapacity = Number(activeHostel?.total_capacity || activeHostel?.capacity || 0);
  const occupiedBeds = residents.length;
  const occupancyRate = totalCapacity > 0 ? Math.min(100, Math.round((occupiedBeds / totalCapacity) * 100)) : 0;

  const pendingLeaves = useMemo(() => {
    return leaves.filter(
      (l) => String(l.status || '').toUpperCase() === 'PENDING' || String(l.status || '').toUpperCase() === 'UNDER_REVIEW'
    );
  }, [leaves]);

  const openComplaints = useMemo(() => {
    return complaints.filter(
      (c) => String(c.status || '').toUpperCase() !== 'RESOLVED' && String(c.status || '').toUpperCase() !== 'CLOSED'
    );
  }, [complaints]);

  // Check if today's attendance has been recorded
  const todayDateStr = new Date().toISOString().split('T')[0];
  const todayAttendanceCount = useMemo(() => {
    return attendanceLogs.filter((a) => {
      const aDate = String(a.attendance_date || a.date || a.created_at || '').split('T')[0];
      return aDate === todayDateStr;
    }).length;
  }, [attendanceLogs, todayDateStr]);

  const hostelName = activeHostel?.name || activeHostel?.hostel_name || 'Assigned Hostel';

  return (
    <div>
      {/* Page Header with Real-Time Scope & Refresh Action */}
      <PageHeader
        title="Hostel Operations Dashboard"
        description="Live occupancy telemetry, urgent resident actions, and premises management."
        icon={LayoutDashboard}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                fontSize: '0.78rem',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'var(--bg-surface)',
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
              }}
            >
              <Clock size={13} color="var(--text-muted)" />
              <span>
                Synced at{' '}
                <strong>
                  {lastRefreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </strong>
              </span>
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => loadDashboardData(true)}
              disabled={refreshing || loading}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              title="Refresh live operational data from server"
            >
              <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
              <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
            </button>
          </div>
        }
      />

      {/* Loading Skeleton */}
      {loading && <LoadingState title="Loading live operations data..." rows={4} />}

      {/* Error Alert */}
      {error && !loading && (
        <ErrorState
          title="Telemetry Synchronization Failed"
          message={error}
          onRetry={() => loadDashboardData(false)}
        />
      )}

      {/* Dashboard Viewport */}
      {!loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Active Hostel Scope Banner */}
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--primary-light)',
                  color: 'var(--primary-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Building2 size={22} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {hostelName}
                  </h2>
                  <span className="hostel-badge-tag">
                    <ShieldCheck size={12} />
                    <span>In-Charge Post</span>
                  </span>
                  {activeHostel?.code && (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: '#f1f5f9',
                        color: '#475569',
                        padding: '2px 8px',
                        borderRadius: '6px',
                      }}
                    >
                      Code: {activeHostel.code}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Gender Policy: <strong>{activeHostel?.gender_category || activeHostel?.type || 'General'}</strong> •
                  Blocks: <strong>{activeHostel?.total_blocks || activeHostel?.blocks_count || '1'}</strong> • Status:{' '}
                  <strong style={{ color: 'var(--success-text)' }}>{activeHostel?.status || 'ACTIVE'}</strong>
                </p>
              </div>
            </div>

            <Link
              to="/hostel"
              className="btn btn-outline"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '6px 12px' }}
            >
              <span>View Building Architecture</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          {/* 6 Key Operational Metric Stat Cards */}
          <div className="grid-3">
            {/* Card 1: Capacity & Occupancy */}
            <div className="stat-card">
              <div className="stat-icon" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary-color)' }}>
                <BedDouble size={24} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
                  <div className="stat-value">{occupancyRate}%</div>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: occupancyRate > 90 ? 'var(--danger-text)' : 'var(--primary-color)',
                      backgroundColor: occupancyRate > 90 ? 'var(--danger-bg)' : 'var(--primary-light)',
                      padding: '2px 8px',
                      borderRadius: '9999px',
                    }}
                  >
                    Occupied
                  </span>
                </div>
                <div className="stat-label">
                  {occupiedBeds} occupied / {totalCapacity > 0 ? totalCapacity : occupiedBeds} total beds
                </div>
                {/* Visual Progress Bar */}
                <div
                  style={{
                    width: '100%',
                    height: '6px',
                    backgroundColor: '#e2e8f0',
                    borderRadius: '9999px',
                    marginTop: '8px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${occupancyRate}%`,
                      height: '100%',
                      backgroundColor:
                        occupancyRate > 90 ? '#ef4444' : occupancyRate > 75 ? '#f59e0b' : 'var(--primary-color)',
                      borderRadius: '9999px',
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Card 2: Resident Students Count */}
            <div className="stat-card">
              <div className="stat-icon" style={{ backgroundColor: 'var(--info-bg)', color: 'var(--info-text)' }}>
                <Users size={24} />
              </div>
              <div>
                <div className="stat-value">{residents.length}</div>
                <div className="stat-label">Enrolled Resident Students</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Allotment verified in assigned hostel
                </div>
              </div>
            </div>

            {/* Card 3: Vacant Beds Ready */}
            <div className="stat-card">
              <div className="stat-icon" style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success-text)' }}>
                <KeyRound size={24} />
              </div>
              <div>
                <div className="stat-value">{vacantBeds.length}</div>
                <div className="stat-label">Vacant Beds Ready</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Available for new student allocation
                </div>
              </div>
            </div>

            {/* Card 4: Pending Leaves */}
            <div className="stat-card">
              <div className="stat-icon" style={{ backgroundColor: 'var(--warning-bg)', color: 'var(--warning-text)' }}>
                <FileText size={24} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <div className="stat-value">{pendingLeaves.length}</div>
                  {pendingLeaves.length > 0 && (
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: 'var(--warning-text)',
                        backgroundColor: 'var(--warning-bg)',
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        border: '1px solid var(--warning-border)',
                      }}
                    >
                      Action Required
                    </span>
                  )}
                </div>
                <div className="stat-label">Pending Student Leaves</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Night-out & home leave requests
                </div>
              </div>
            </div>

            {/* Card 5: Open Complaints & Maintenance */}
            <div className="stat-card">
              <div className="stat-icon" style={{ backgroundColor: '#fef2f2', color: '#b91c1c' }}>
                <Wrench size={24} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <div className="stat-value">{openComplaints.length}</div>
                  {openComplaints.length > 0 && (
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: '#b91c1c',
                        backgroundColor: '#fee2e2',
                        padding: '2px 8px',
                        borderRadius: '9999px',
                      }}
                    >
                      Unresolved
                    </span>
                  )}
                </div>
                <div className="stat-label">Active Resident Complaints</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Room repairs & student grievances
                </div>
              </div>
            </div>

            {/* Card 6: Curfew & Attendance */}
            <div className="stat-card">
              <div className="stat-icon" style={{ backgroundColor: '#f0fdf4', color: '#15803d' }}>
                <ClipboardList size={24} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <div className="stat-value">{todayAttendanceCount}</div>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: todayAttendanceCount > 0 ? '#15803d' : '#b45309',
                      backgroundColor: todayAttendanceCount > 0 ? '#dcfce7' : '#fef3c7',
                      padding: '2px 8px',
                      borderRadius: '9999px',
                    }}
                  >
                    {todayAttendanceCount > 0 ? 'Logged Today' : 'Pending Verification'}
                  </span>
                </div>
                <div className="stat-label">Night Attendance Records</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Curfew status for {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions Bar */}
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Quick Operational Actions:
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate('/attendance')}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}
              >
                <ClipboardList size={14} />
                <span>Log Attendance</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate('/leaves')}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}
              >
                <FileText size={14} />
                <span>Verify Leaves ({pendingLeaves.length})</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate('/complaints')}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}
              >
                <Wrench size={14} />
                <span>Complaints ({openComplaints.length})</span>
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate('/allocations')}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}
              >
                <KeyRound size={14} />
                <span>Allocate Vacant Bed</span>
              </button>
            </div>
          </div>

          {/* Split Sections: Urgent Action Center */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '24px' }}>
            {/* Section 1A: Pending Leave Approvals */}
            <div className="card">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                }}
              >
                <h3
                  style={{
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <FileText size={18} color="var(--primary-color)" />
                  <span>Pending Leave Approvals</span>
                </h3>
                <Link
                  to="/leaves"
                  style={{
                    fontSize: '0.82rem',
                    color: 'var(--primary-color)',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    textDecoration: 'none',
                  }}
                >
                  <span>View All</span>
                  <ArrowRight size={14} />
                </Link>
              </div>

              {pendingLeaves.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="No Pending Leaves"
                  description="All student leave applications are reviewed and up to date."
                />
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Resident Student</th>
                        <th>Reason</th>
                        <th>Dates</th>
                        <th>Decision</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingLeaves.slice(0, 5).map((leave, i) => (
                        <tr key={leave.id || i}>
                          <td>
                            <strong>
                              {leave.student_name ||
                                (leave.student_id ? leave.student_id.substring(0, 8) + '...' : 'Resident Student')}
                            </strong>
                          </td>
                          <td>
                            <span style={{ fontSize: '0.85rem' }}>{leave.reason || 'General Outing'}</span>
                          </td>
                          <td>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                              {formatDate(leave.from_date || leave.start_date)} -{' '}
                              {formatDate(leave.to_date || leave.end_date)}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => navigate('/leaves')}
                              style={{
                                padding: '4px 8px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                backgroundColor: 'var(--primary-light)',
                                color: 'var(--primary-color)',
                                border: '1px solid var(--primary-border)',
                                borderRadius: '6px',
                                cursor: 'pointer',
                              }}
                            >
                              Review
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Section 1B: Unresolved Resident Complaints */}
            <div className="card">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                }}
              >
                <h3
                  style={{
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <Wrench size={18} color="var(--primary-color)" />
                  <span>Unresolved Resident Grievances</span>
                </h3>
                <Link
                  to="/complaints"
                  style={{
                    fontSize: '0.82rem',
                    color: 'var(--primary-color)',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    textDecoration: 'none',
                  }}
                >
                  <span>View All</span>
                  <ArrowRight size={14} />
                </Link>
              </div>

              {openComplaints.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="No Open Complaints"
                  description="No unresolved student grievances reported for your premises."
                />
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Title / Issue</th>
                        <th>Category</th>
                        <th>Severity</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openComplaints.slice(0, 5).map((comp, i) => (
                        <tr key={comp.id || i}>
                          <td>
                            <strong>
                              {comp.title || comp.description?.substring(0, 32) || 'Complaint Report'}
                            </strong>
                          </td>
                          <td>
                            <span style={{ fontSize: '0.82rem' }}>{comp.category || 'Maintenance'}</span>
                          </td>
                          <td>
                            <span
                              className={`badge badge-${getStatusBadgeVariant(comp.severity || comp.status)}`}
                            >
                              {comp.severity || comp.status || 'NORMAL'}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => navigate('/complaints')}
                              style={{
                                padding: '4px 8px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                backgroundColor: '#f1f5f9',
                                color: '#334155',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                cursor: 'pointer',
                              }}
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Vacant Bed Inventory Ready for Allocation */}
          <div className="card">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px',
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <BedDouble size={18} color="var(--primary-color)" />
                  <span>Vacant Bed Inventory Ready for Allocation</span>
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Unallocated beds currently available in {hostelName}.
                </p>
              </div>
              <Link
                to="/allocations"
                className="btn btn-outline"
                style={{ fontSize: '0.82rem', padding: '6px 12px' }}
              >
                <span>Allocate Beds</span>
                <ChevronRight size={14} />
              </Link>
            </div>

            {vacantBeds.length === 0 ? (
              <EmptyState
                icon={BedDouble}
                title="Hostel at 100% Capacity"
                description="All beds in your assigned hostel are currently allocated to resident students."
              />
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Bed Label</th>
                      <th>Room Number</th>
                      <th>Floor / Block</th>
                      <th>Operational Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vacantBeds.slice(0, 5).map((bed, i) => (
                      <tr key={bed.id || bed.bed_id || i}>
                        <td>
                          <strong>{bed.bed_label || bed.label || `Bed ${i + 1}`}</strong>
                        </td>
                        <td>Room {bed.room_number || bed.room_no || '—'}</td>
                        <td>{bed.floor_number ? `Floor ${bed.floor_number}` : bed.block_name || 'Ground'}</td>
                        <td>
                          <span className="badge badge-resolved">VACANT</span>
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => navigate('/allocations')}
                            style={{
                              padding: '4px 10px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              backgroundColor: 'var(--primary-color)',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                            }}
                          >
                            Assign Student
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 3: Campus & Hostel Broadcast Notices */}
          {notifications.length > 0 && (
            <div className="card">
              <h3
                style={{
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '16px',
                }}
              >
                <Bell size={18} color="var(--primary-color)" />
                <span>Recent Hostel Broadcasts & Circulars</span>
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {notifications.map((notif, i) => (
                  <div
                    key={notif.id || i}
                    style={{
                      padding: '12px 16px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0f172a' }}>
                        {notif.title || 'Official Announcement'}
                      </div>
                      <div
                        style={{
                          fontSize: '0.82rem',
                          color: '#475569',
                          marginTop: '4px',
                          lineHeight: 1.5,
                        }}
                      >
                        {notif.message || notif.content || '—'}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: '#94a3b8',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      {formatDate(notif.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
