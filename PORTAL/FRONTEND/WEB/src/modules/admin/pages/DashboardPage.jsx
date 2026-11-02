import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import adminService from '../services/adminService';
import { useAuth } from '../../../shared/auth/useAuth';
import {
  Building2,
  GraduationCap,
  Users,
  BedDouble,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  Send,
  Wrench,
  Search,
  Filter,
  BarChart3,
  TrendingUp,
  Inbox,
  AlertCircle,
  ShieldAlert,
  Info,
} from 'lucide-react';
import {
  PageHeader,
  Card,
  Badge,
  LoadingState,
  ErrorState,
  EmptyState,
} from '../../../shared/components';

/**
 * Lightweight count-up animation component for statistics.
 */
function CountUpNumber({ value, duration = 300 }) {
  const [displayValue, setDisplayValue] = useState(0);
  const animatedRef = useRef(false);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion || animatedRef.current || typeof value !== 'number') {
      setDisplayValue(value || 0);
      return;
    }

    animatedRef.current = true;
    let startTimestamp = null;
    const target = Number(value) || 0;

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(easeProgress * target));

      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setDisplayValue(target);
      }
    };

    window.requestAnimationFrame(step);
  }, [value, duration]);

  return <span>{displayValue.toLocaleString()}</span>;
}

export default function AdminDashboardPage() {
  const { user } = useAuth();

  // Filter States
  const [selectedHostel, setSelectedHostel] = useState('ALL');
  const [selectedDateRange, setSelectedDateRange] = useState('ALL'); // 'ALL' | 'TODAY' | '7D' | '30D'

  // Live Data States
  const [overview, setOverview] = useState(null);
  const [studentStats, setStudentStats] = useState(null);
  const [hostelOccupancy, setHostelOccupancy] = useState([]);
  const [hostelsList, setHostelsList] = useState([]);
  const [attendanceStats, setAttendanceStats] = useState(null);
  const [leaveStats, setLeaveStats] = useState(null);
  const [complaintStats, setComplaintStats] = useState(null);
  const [maintenanceStats, setMaintenanceStats] = useState(null);
  const [recentLeaves, setRecentLeaves] = useState([]);
  const [recentComplaints, setRecentComplaints] = useState([]);
  const [recentNotifications, setRecentNotifications] = useState([]);

  // Operational State
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [sectionErrors, setSectionErrors] = useState({});

  // Compute RFC3339 Date Range for endpoints supporting date filters
  const getDateRangeParams = useCallback(() => {
    if (selectedDateRange === 'ALL') return {};

    const now = new Date();
    let startDate = new Date();

    if (selectedDateRange === 'TODAY') {
      startDate.setHours(0, 0, 0, 0);
    } else if (selectedDateRange === '7D') {
      startDate.setDate(now.getDate() - 7);
    } else if (selectedDateRange === '30D') {
      startDate.setDate(now.getDate() - 30);
    }

    return {
      start_date: startDate.toISOString(),
      end_date: now.toISOString(),
    };
  }, [selectedDateRange]);

  // Parallel Data Loading Engine with Graceful Degradation
  const loadDashboardData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setLoading(true);

    const dateParams = getDateRangeParams();
    const errors = {};

    try {
      const results = await Promise.allSettled([
        // 0: Overview KPI metrics
        adminService.getReportsOverview(),
        // 1: Detailed student breakdown
        adminService.getReportsStudents(),
        // 2: Hostel-wise occupancy analytics
        adminService.getReportsOccupancy(),
        // 3: Hostels catalog list
        adminService.getHostels(),
        // 4: Attendance summary statistics
        adminService.getReportsAttendance(),
        // 5: Leave requests summary statistics
        adminService.getReportsLeave(),
        // 6: Complaints statistics
        adminService.getReportsComplaints(),
        // 7: Maintenance requests statistics
        adminService.getReportsMaintenance(),
        // 8: Recent leave applications
        adminService.getLeaveRequests(dateParams),
        // 9: Recent complaints
        adminService.getComplaints(),
        // 10: Recent institutional notifications
        adminService.getNotifications(),
      ]);

      // Process 0: Overview
      if (results[0].status === 'fulfilled') {
        const d = results[0].value?.data || results[0].value;
        setOverview(d || null);
      } else {
        errors.overview = results[0].reason?.message || 'Failed to load overview';
      }

      // Process 1: Student Stats
      if (results[1].status === 'fulfilled') {
        const d = results[1].value?.data || results[1].value;
        setStudentStats(d || null);
      } else {
        errors.students = results[1].reason?.message || 'Failed to load student statistics';
      }

      // Process 2: Hostel Occupancy
      if (results[2].status === 'fulfilled') {
        const d = results[2].value?.data || results[2].value;
        setHostelOccupancy(Array.isArray(d) ? d : []);
      } else {
        errors.occupancy = results[2].reason?.message || 'Failed to load occupancy report';
      }

      // Process 3: Hostels Catalog
      if (results[3].status === 'fulfilled') {
        const d = results[3].value?.data || results[3].value;
        const list = Array.isArray(d) ? d : d?.hostels || [];
        setHostelsList(list);
      }

      // Process 4: Attendance Stats
      if (results[4].status === 'fulfilled') {
        const d = results[4].value?.data || results[4].value;
        setAttendanceStats(d || null);
      } else {
        errors.attendance = results[4].reason?.message || 'Failed to load attendance report';
      }

      // Process 5: Leave Stats
      if (results[5].status === 'fulfilled') {
        const d = results[5].value?.data || results[5].value;
        setLeaveStats(d || null);
      } else {
        errors.leaves = results[5].reason?.message || 'Failed to load leave statistics';
      }

      // Process 6: Complaint Stats
      if (results[6].status === 'fulfilled') {
        const d = results[6].value?.data || results[6].value;
        setComplaintStats(d || null);
      } else {
        errors.complaints = results[6].reason?.message || 'Failed to load complaint statistics';
      }

      // Process 7: Maintenance Stats
      if (results[7].status === 'fulfilled') {
        const d = results[7].value?.data || results[7].value;
        setMaintenanceStats(d || null);
      }

      // Process 8: Recent Leaves
      if (results[8].status === 'fulfilled') {
        const d = results[8].value?.data || results[8].value;
        setRecentLeaves(Array.isArray(d) ? d.slice(0, 5) : []);
      }

      // Process 9: Recent Complaints
      if (results[9].status === 'fulfilled') {
        const d = results[9].value?.data || results[9].value;
        setRecentComplaints(Array.isArray(d) ? d.slice(0, 5) : []);
      }

      // Process 10: Recent Notifications
      if (results[10].status === 'fulfilled') {
        const d = results[10].value?.data || results[10].value;
        const list = Array.isArray(d) ? d : d?.notifications || [];
        setRecentNotifications(list.slice(0, 5));
      }

      setSectionErrors(errors);
      setLastSyncTime(new Date());
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [getDateRangeParams]);

  // Initial Load and Re-fetch when Date Range changes
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Filtered Occupancy Calculation
  const filteredOccupancyList = hostelOccupancy.filter((h) => {
    if (selectedHostel === 'ALL') return true;
    return h.hostel_id === selectedHostel;
  });

  // Calculate Aggregated Metrics from verified fields
  const totalStudents = overview?.total_students ?? 0;
  const activeStudents = overview?.active_students ?? (studentStats?.total_by_status?.ACTIVE ?? 0);
  const inactiveStudents = Math.max(0, totalStudents - activeStudents);
  const allocatedStudents = studentStats?.total_by_hostel_status?.ALLOCATED ?? 0;
  const unallocatedStudents = studentStats?.total_by_hostel_status?.UNALLOCATED ?? Math.max(0, totalStudents - allocatedStudents);

  const totalHostels = overview?.total_hostels ?? hostelsList.length;
  const totalBeds = overview?.total_beds ?? 0;
  const occupiedBeds = overview?.occupied_beds ?? 0;
  const availableBeds = Math.max(0, totalBeds - occupiedBeds);
  const overallOccupancyRate = totalBeds > 0 ? ((occupiedBeds / totalBeds) * 100).toFixed(1) : '0.0';

  const totalStaff = overview?.total_staff ?? 0;

  // Attendance Calculations
  const presentCount = attendanceStats?.present_count ?? 0;
  const absentCount = attendanceStats?.absent_count ?? 0;
  const lateCount = attendanceStats?.late_count ?? 0;
  const onLeaveCount = attendanceStats?.leave_count ?? 0;
  const totalRecordedAttendance = presentCount + absentCount + lateCount + onLeaveCount;
  const attendanceRate = totalRecordedAttendance > 0
    ? (((presentCount + lateCount) / totalRecordedAttendance) * 100).toFixed(1)
    : '0.0';

  // Leave Calculations
  const pendingLeaves = leaveStats?.pending ?? 0;
  const approvedLeaves = leaveStats?.approved ?? 0;
  const rejectedLeaves = leaveStats?.rejected ?? 0;
  const totalLeaves = pendingLeaves + approvedLeaves + rejectedLeaves + (leaveStats?.cancelled ?? 0);

  // Complaints Calculations
  const openComplaints = complaintStats?.open ?? (overview?.open_complaints ?? 0);
  const inProgressComplaints = complaintStats?.in_progress ?? 0;
  const resolvedComplaints = complaintStats?.resolved ?? 0;
  const totalComplaints = openComplaints + inProgressComplaints + resolvedComplaints + (complaintStats?.closed ?? 0);

  // Unified Activity Stream
  const activityItems = [
    ...recentNotifications.map((n) => ({
      id: `notif-${n.id || n.notification_id}`,
      type: 'NOTIFICATION',
      title: n.title || 'Institutional Notice',
      desc: n.message || n.content,
      date: n.created_at,
      icon: Info,
      badge: 'INFO',
      badgeClass: 'badge-blue',
    })),
    ...recentLeaves.map((l) => ({
      id: `leave-${l.leave_id || l.id}`,
      type: 'LEAVE',
      title: `Leave Request: ${l.reason || 'Personal Leave'}`,
      desc: `Status: ${l.status || 'PENDING'} · Student: ${l.student_id ? l.student_id.slice(0, 8) : 'Resident'}`,
      date: l.created_at,
      icon: Send,
      badge: l.status || 'PENDING',
      badgeClass: l.status === 'APPROVED' ? 'badge-green' : l.status === 'REJECTED' ? 'badge-amber' : 'badge-blue',
    })),
    ...recentComplaints.map((c) => ({
      id: `complaint-${c.complaint_id || c.id}`,
      type: 'COMPLAINT',
      title: `Complaint: ${c.title || c.category || 'Maintenance Issue'}`,
      desc: `Status: ${c.status || 'OPEN'} · Priority: ${c.priority || 'NORMAL'}`,
      date: c.created_at,
      icon: Wrench,
      badge: c.status || 'OPEN',
      badgeClass: c.status === 'RESOLVED' ? 'badge-green' : 'badge-amber',
    })),
  ]
    .filter((item) => item.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 6);

  if (loading && !overview) {
    return (
      <div style={{ padding: '40px 0' }}>
        <LoadingState message="Retrieving live college operational metrics..." size="lg" />
      </div>
    );
  }

  return (
    <div className="fade-in-up">
      {/* 1. Page Header & Operational Toolbar */}
      <div className="enterprise-hero-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
          {user?.college_logo_url && (
            <img
              src={user.college_logo_url}
              alt={user.college_name || 'College Logo'}
              style={{
                width: '56px',
                height: '56px',
                objectFit: 'contain',
                borderRadius: '12px',
                background: '#ffffff',
                padding: '4px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                flexShrink: 0,
              }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          )}
          <div className="hero-header-titles">
            <div className="hero-category-pill">
              <BarChart3 size={13} />
              <span>{user?.college_code ? `${user.college_code} • Operational Telemetry` : 'Operational Telemetry'}</span>
            </div>
            <h1 className="hero-main-title">{user?.college_name || 'College Admin Dashboard'}</h1>
            <p className="hero-subtitle">
              Live residential metrics, capacity utilization, student movement, and facility management.
            </p>
          </div>
        </div>

        <div className="hero-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Hostel Filter Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Building2 size={14} style={{ color: 'var(--text-muted, #94a3b8)' }} />
            <select
              className="filter-search-input"
              style={{ padding: '6px 12px', fontSize: '0.82rem', height: '36px', width: 'auto' }}
              value={selectedHostel}
              onChange={(e) => setSelectedHostel(e.target.value)}
              title="Filter statistics by hostel"
              aria-label="Filter statistics by hostel"
            >
              <option value="ALL">All Hostels ({hostelsList.length})</option>
              {hostelsList.map((h) => (
                <option key={h.hostel_id || h.id} value={h.hostel_id || h.id}>
                  {h.name} ({h.code || 'BLD'})
                </option>
              ))}
            </select>
          </div>

          {/* Date Filter Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={14} style={{ color: 'var(--text-muted, #94a3b8)' }} />
            <select
              className="filter-search-input"
              style={{ padding: '6px 12px', fontSize: '0.82rem', height: '36px', width: 'auto' }}
              value={selectedDateRange}
              onChange={(e) => setSelectedDateRange(e.target.value)}
              title="Filter activity by date range"
              aria-label="Filter activity by date range"
            >
              <option value="ALL">All Time</option>
              <option value="TODAY">Today</option>
              <option value="7D">Last 7 Days</option>
              <option value="30D">Last 30 Days</option>
            </select>
          </div>

          {/* Manual Refresh Trigger */}
          <button
            type="button"
            onClick={() => loadDashboardData(true)}
            disabled={isRefreshing}
            className="btn-enterprise-refresh"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: '#ffffff',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              cursor: isRefreshing ? 'not-allowed' : 'pointer',
            }}
            title="Refresh dashboard data"
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Sync Status Banner */}
      {lastSyncTime && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', fontSize: '0.76rem', color: 'var(--text-muted, #94a3b8)' }}>
          <span>Live data synced with Neon PostgreSQL</span>
          <span>Last updated: {lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </div>
      )}

      {/* 2. Top Executive KPI Cards */}
      <div className="kpi-cards-grid" style={{ marginBottom: '24px' }}>
        {/* KPI 1: Total Students */}
        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-title">Student Residents</span>
            <div className="stat-kpi-icon-box" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
              <GraduationCap size={20} />
            </div>
          </div>
          <div className="stat-kpi-value">
            <CountUpNumber value={totalStudents} />
          </div>
          <div className="stat-kpi-subtext" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
            <span>Active: <strong>{activeStudents}</strong></span>
            <span>Allocated: <strong>{allocatedStudents}</strong></span>
          </div>
          <div style={{ marginTop: '10px' }}>
            <Link to="/admin/students" style={{ fontSize: '0.78rem', color: 'var(--primary-color, #2563eb)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
              <span>View Directory</span>
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>

        {/* KPI 2: Hostel Capacity & Beds */}
        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-title">Hostels & Capacity</span>
            <div className="stat-kpi-icon-box" style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}>
              <Building2 size={20} />
            </div>
          </div>
          <div className="stat-kpi-value">
            <CountUpNumber value={totalBeds} />
          </div>
          <div className="stat-kpi-subtext" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
            <span>Hostels: <strong>{totalHostels}</strong></span>
            <span>Occupied: <strong>{occupiedBeds}</strong></span>
          </div>
          <div style={{ marginTop: '10px' }}>
            <Link to="/admin/hostels" style={{ fontSize: '0.78rem', color: '#16a34a', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
              <span>Manage Hostels</span>
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>

        {/* KPI 3: Occupancy Rate */}
        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-title">Campus Occupancy</span>
            <div className="stat-kpi-icon-box" style={{ backgroundColor: '#fffbeb', color: '#d97706' }}>
              <BedDouble size={20} />
            </div>
          </div>
          <div className="stat-kpi-value" style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span>{overallOccupancyRate}%</span>
          </div>
          <div className="occupancy-bar-track">
            <div
              className={`occupancy-bar-fill ${Number(overallOccupancyRate) > 90 ? 'red' : Number(overallOccupancyRate) > 75 ? 'amber' : 'green'}`}
              style={{ width: `${Math.min(100, Number(overallOccupancyRate))}%` }}
            />
          </div>
          <div className="stat-kpi-subtext" style={{ marginTop: '8px' }}>
            Available Beds: <strong>{availableBeds}</strong>
          </div>
        </div>

        {/* KPI 4: Staff & In-Charges */}
        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-title">College Staff</span>
            <div className="stat-kpi-icon-box" style={{ backgroundColor: '#faf5ff', color: '#9333ea' }}>
              <Users size={20} />
            </div>
          </div>
          <div className="stat-kpi-value">
            <CountUpNumber value={totalStaff} />
          </div>
          <div className="stat-kpi-subtext" style={{ marginTop: '6px' }}>
            Wardens, in-charges & security
          </div>
          <div style={{ marginTop: '10px' }}>
            <Link to="/admin/staff" style={{ fontSize: '0.78rem', color: '#9333ea', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
              <span>Staff Management</span>
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </div>

      {/* 3. Main Dashboard Two-Column Split Layout */}
      <div className="dashboard-split-layout">
        {/* Left Column (2fr): Occupancy & Detailed Operations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Section A: Hostel-Wise Bed Occupancy Breakdown */}
          <div className="dashboard-panel-card">
            <div className="dashboard-section-header">
              <div className="dashboard-section-title-wrap">
                <Building2 size={18} style={{ color: 'var(--primary-color, #2563eb)' }} />
                <div>
                  <h2 className="dashboard-section-title">Hostel-Wise Occupancy Breakdown</h2>
                  <p className="dashboard-section-subtitle">Real-time room and bed allocation metrics per residential building</p>
                </div>
              </div>
              <span className="badge-enterprise badge-blue">
                {filteredOccupancyList.length} {filteredOccupancyList.length === 1 ? 'Hostel' : 'Hostels'}
              </span>
            </div>

            {filteredOccupancyList.length === 0 ? (
              <EmptyState
                icon={Building2}
                title="No hostel occupancy records found"
                description={
                  selectedHostel !== 'ALL'
                    ? 'The selected hostel does not currently have capacity records configured.'
                    : 'Configure hostel blocks and rooms to view residential capacity metrics.'
                }
              />
            ) : (
              <div className="enterprise-table-container">
                <table className="enterprise-table">
                  <thead>
                    <tr>
                      <th>Hostel Name</th>
                      <th>Total Capacity</th>
                      <th>Occupied Beds</th>
                      <th>Available</th>
                      <th>Occupancy %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOccupancyList.map((h) => {
                      const pct = typeof h.occupancy_percentage === 'number'
                        ? h.occupancy_percentage.toFixed(1)
                        : ((h.occupied_beds / (h.total_capacity || 1)) * 100).toFixed(1);
                      return (
                        <tr key={h.hostel_id}>
                          <td>
                            <strong style={{ color: 'var(--text-primary)' }}>{h.hostel_name}</strong>
                          </td>
                          <td>{h.total_capacity || 0}</td>
                          <td>
                            <span className="badge-enterprise badge-purple">{h.occupied_beds || 0}</span>
                          </td>
                          <td>
                            <span className="badge-enterprise badge-green">{h.available_capacity || (h.total_capacity - h.occupied_beds)}</span>
                          </td>
                          <td style={{ minWidth: '140px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '0.78rem', fontWeight: 600, minWidth: '38px' }}>{pct}%</span>
                              <div className="occupancy-bar-track" style={{ margin: 0, flex: 1 }}>
                                <div
                                  className={`occupancy-bar-fill ${Number(pct) > 85 ? 'red' : Number(pct) > 60 ? 'amber' : 'green'}`}
                                  style={{ width: `${Math.min(100, Number(pct))}%` }}
                                />
                              </div>
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

          {/* Section B: Attendance & Leaves Dual Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            {/* Sub-Card 1: Attendance Summary */}
            <div className="dashboard-panel-card" style={{ marginBottom: 0 }}>
              <div className="dashboard-section-header">
                <div className="dashboard-section-title-wrap">
                  <CheckCircle2 size={16} style={{ color: '#16a34a' }} />
                  <h3 className="dashboard-section-title" style={{ fontSize: '0.94rem' }}>Attendance Status</h3>
                </div>
                <span className="badge-enterprise badge-green">Rate: {attendanceRate}%</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '12px' }}>
                <div style={{ padding: '12px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 600 }}>PRESENT</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#14532d', marginTop: '2px' }}>
                    {presentCount}
                  </div>
                </div>

                <div style={{ padding: '12px', backgroundColor: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
                  <div style={{ fontSize: '0.72rem', color: '#991b1b', fontWeight: 600 }}>ABSENT</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#7f1d1d', marginTop: '2px' }}>
                    {absentCount}
                  </div>
                </div>

                <div style={{ padding: '12px', backgroundColor: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a' }}>
                  <div style={{ fontSize: '0.72rem', color: '#92400e', fontWeight: 600 }}>LATE</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#78350f', marginTop: '2px' }}>
                    {lateCount}
                  </div>
                </div>

                <div style={{ padding: '12px', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                  <div style={{ fontSize: '0.72rem', color: '#1e40af', fontWeight: 600 }}>ON LEAVE</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e3a8a', marginTop: '2px' }}>
                    {onLeaveCount}
                  </div>
                </div>
              </div>
            </div>

            {/* Sub-Card 2: Leave Requests Summary */}
            <div className="dashboard-panel-card" style={{ marginBottom: 0 }}>
              <div className="dashboard-section-header">
                <div className="dashboard-section-title-wrap">
                  <Send size={16} style={{ color: '#2563eb' }} />
                  <h3 className="dashboard-section-title" style={{ fontSize: '0.94rem' }}>Student Leaves</h3>
                </div>
                <span className="badge-enterprise badge-blue">Total: {totalLeaves}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '12px' }}>
                <div style={{ padding: '12px', backgroundColor: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a' }}>
                  <div style={{ fontSize: '0.72rem', color: '#92400e', fontWeight: 600 }}>PENDING</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#78350f', marginTop: '2px' }}>
                    {pendingLeaves}
                  </div>
                </div>

                <div style={{ padding: '12px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 600 }}>APPROVED</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#14532d', marginTop: '2px' }}>
                    {approvedLeaves}
                  </div>
                </div>

                <div style={{ padding: '12px', backgroundColor: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
                  <div style={{ fontSize: '0.72rem', color: '#991b1b', fontWeight: 600 }}>REJECTED</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#7f1d1d', marginTop: '2px' }}>
                    {rejectedLeaves}
                  </div>
                </div>

                <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 600 }}>CANCELLED</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#334155', marginTop: '2px' }}>
                    {leaveStats?.cancelled ?? 0}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section C: Complaints & Maintenance Summary */}
          <div className="dashboard-panel-card">
            <div className="dashboard-section-header">
              <div className="dashboard-section-title-wrap">
                <Wrench size={18} style={{ color: '#d97706' }} />
                <div>
                  <h3 className="dashboard-section-title">Facility Grievances & Work Orders</h3>
                  <p className="dashboard-section-subtitle">Real-time resolution status for maintenance tickets and complaints</p>
                </div>
              </div>
              <span className="badge-enterprise badge-amber">Open Tickets: {openComplaints}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginTop: '12px' }}>
              <div style={{ padding: '12px', backgroundColor: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a' }}>
                <span style={{ fontSize: '0.72rem', color: '#92400e', fontWeight: 600 }}>OPEN</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#78350f', marginTop: '2px' }}>{openComplaints}</div>
              </div>

              <div style={{ padding: '12px', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                <span style={{ fontSize: '0.72rem', color: '#1e40af', fontWeight: 600 }}>IN PROGRESS</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1e3a8a', marginTop: '2px' }}>{inProgressComplaints}</div>
              </div>

              <div style={{ padding: '12px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                <span style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 600 }}>RESOLVED</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#14532d', marginTop: '2px' }}>{resolvedComplaints}</div>
              </div>

              <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 600 }}>MAINTENANCE</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#334155', marginTop: '2px' }}>{overview?.open_maintenance ?? 0}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (1fr): Movement Notice, Recent Activity & Quick Nav */}
        <div className="side-quick-panel">
          {/* Section D: Campus Movement & Gate Operations (Phase 9 Strict Specification) */}
          <div className="side-panel-card" style={{ borderColor: '#e2e8f0', backgroundColor: '#ffffff' }}>
            <div className="side-panel-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={16} style={{ color: '#d97706' }} />
                <h3 className="side-panel-title" style={{ fontSize: '0.88rem' }}>Campus Movement & Gates</h3>
              </div>
              <span className="badge-enterprise badge-amber" style={{ fontSize: '0.68rem' }}>Awaiting Handler</span>
            </div>

            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #475569)', lineHeight: 1.45 }}>
              Gate pass approvals (<code>app.gate_passes</code>), entry/exit records (<code>app.entry_exit_records</code>), and visitor logs (<code>app.visitors</code>) are defined in the schema migrations.
            </p>
            <div style={{ marginTop: '10px', padding: '8px 12px', backgroundColor: '#fffbeb', borderRadius: '6px', border: '1px solid #fef3c7', fontSize: '0.74rem', color: '#92400e' }}>
              <strong>Notice:</strong> Movement APIs will be activated once HTTP router handlers are published. No fabricated metrics are displayed.
            </div>
          </div>

          {/* Section E: Live College Activity Stream (Phase 10) */}
          <div className="side-panel-card">
            <div className="side-panel-header">
              <h3 className="side-panel-title">Recent College Activity</h3>
              <span className="badge-enterprise badge-blue">{activityItems.length} records</span>
            </div>

            {activityItems.length === 0 ? (
              <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted, #94a3b8)', fontSize: '0.8rem' }}>
                No recent activity records available.
              </div>
            ) : (
              <div>
                {activityItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.id} className="activity-stream-item">
                      <div className="activity-stream-icon-box" style={{ backgroundColor: '#f1f5f9', color: 'var(--text-secondary)' }}>
                        <Icon size={16} />
                      </div>
                      <div className="activity-stream-content">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                          <span className="activity-stream-title">{item.title}</span>
                          <span className={`badge-enterprise ${item.badgeClass}`} style={{ fontSize: '0.65rem' }}>
                            {item.badge}
                          </span>
                        </div>
                        <div className="activity-stream-meta">{item.desc}</div>
                        {item.date && (
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {new Date(item.date).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section F: Quick Navigation Links */}
          <div className="side-panel-card">
            <div className="side-panel-header">
              <h3 className="side-panel-title">Operational Navigation</h3>
            </div>

            <Link to="/admin/hostels" className="quick-action-link-item">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building2 size={15} />
                <span>Hostels & Bed Inventory</span>
              </div>
              <ArrowRight size={13} />
            </Link>

            <Link to="/admin/students" className="quick-action-link-item">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <GraduationCap size={15} />
                <span>Student Admissions Directory</span>
              </div>
              <ArrowRight size={13} />
            </Link>

            <Link to="/admin/staff" className="quick-action-link-item">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={15} />
                <span>Wardens & College Staff</span>
              </div>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
