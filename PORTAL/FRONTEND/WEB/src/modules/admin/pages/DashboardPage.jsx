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
  DoorOpen,
  Footprints,
  Copy,
  Check,
  PlusCircle,
  Megaphone,
  UserPlus,
  Shield,
  Activity,
  Layers,
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
function CountUpNumber({ value, duration = 350 }) {
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

/**
 * Helper to compute relative time label (e.g. "10 mins ago", "Today at 2:30 PM")
 */
function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffSec = Math.floor((now - d) / 1000);

  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 172800) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function AdminDashboardPage() {
  const { user } = useAuth();

  // Filter States
  const [selectedHostel, setSelectedHostel] = useState('ALL');
  const [selectedDateRange, setSelectedDateRange] = useState('ALL');
  const [copiedCode, setCopiedCode] = useState(false);

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

  // Compute Date Range Params
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

  // Parallel Data Loading Engine
  const loadDashboardData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setLoading(true);

    const dateParams = getDateRangeParams();
    const errors = {};

    try {
      const results = await Promise.allSettled([
        adminService.getReportsOverview(),
        adminService.getReportsStudents(),
        adminService.getReportsOccupancy(),
        adminService.getHostels(),
        adminService.getReportsAttendance(),
        adminService.getReportsLeave(),
        adminService.getReportsComplaints(),
        adminService.getReportsMaintenance(),
        adminService.getLeaveRequests(dateParams),
        adminService.getComplaints(),
        adminService.getNotifications(),
      ]);

      if (results[0].status === 'fulfilled') {
        const d = results[0].value?.data || results[0].value;
        setOverview(d || null);
      } else {
        errors.overview = results[0].reason?.message || 'Failed to load overview';
      }

      if (results[1].status === 'fulfilled') {
        const d = results[1].value?.data || results[1].value;
        setStudentStats(d || null);
      }

      if (results[2].status === 'fulfilled') {
        const d = results[2].value?.data || results[2].value;
        setHostelOccupancy(Array.isArray(d) ? d : []);
      }

      if (results[3].status === 'fulfilled') {
        const d = results[3].value?.data || results[3].value;
        const list = Array.isArray(d) ? d : d?.hostels || [];
        setHostelsList(list);
      }

      if (results[4].status === 'fulfilled') {
        const d = results[4].value?.data || results[4].value;
        setAttendanceStats(d || null);
      }

      if (results[5].status === 'fulfilled') {
        const d = results[5].value?.data || results[5].value;
        setLeaveStats(d || null);
      }

      if (results[6].status === 'fulfilled') {
        const d = results[6].value?.data || results[6].value;
        setComplaintStats(d || null);
      }

      if (results[7].status === 'fulfilled') {
        const d = results[7].value?.data || results[7].value;
        setMaintenanceStats(d || null);
      }

      if (results[8].status === 'fulfilled') {
        const d = results[8].value?.data || results[8].value;
        setRecentLeaves(Array.isArray(d) ? d.slice(0, 5) : []);
      }

      if (results[9].status === 'fulfilled') {
        const d = results[9].value?.data || results[9].value;
        setRecentComplaints(Array.isArray(d) ? d.slice(0, 5) : []);
      }

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

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleCopyCode = () => {
    if (user?.college_code) {
      navigator.clipboard.writeText(user.college_code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  // Filtered Occupancy List
  const filteredOccupancyList = hostelOccupancy.filter((h) => {
    if (selectedHostel === 'ALL') return true;
    return h.hostel_id === selectedHostel;
  });

  // Calculate Aggregated Metrics
  const totalStudents = overview?.total_students ?? 0;
  const activeStudents = overview?.active_students ?? (studentStats?.total_by_status?.ACTIVE ?? 0);
  const allocatedStudents = studentStats?.total_by_hostel_status?.ALLOCATED ?? 0;
  const unallocatedStudents = studentStats?.total_by_hostel_status?.UNALLOCATED ?? Math.max(0, totalStudents - allocatedStudents);

  const totalHostels = overview?.total_hostels ?? hostelsList.length;
  const totalBeds = overview?.total_beds ?? 0;
  const occupiedBeds = overview?.occupied_beds ?? 0;
  const availableBeds = Math.max(0, totalBeds - occupiedBeds);
  const overallOccupancyRate = totalBeds > 0 ? ((occupiedBeds / totalBeds) * 100).toFixed(1) : '0.0';

  const totalStaff = overview?.total_staff ?? 0;

  // Attendance
  const presentCount = attendanceStats?.present_count ?? 0;
  const absentCount = attendanceStats?.absent_count ?? 0;
  const lateCount = attendanceStats?.late_count ?? 0;
  const onLeaveCount = attendanceStats?.leave_count ?? 0;
  const totalRecordedAttendance = presentCount + absentCount + lateCount + onLeaveCount;
  const attendanceRate = totalRecordedAttendance > 0
    ? (((presentCount + lateCount) / totalRecordedAttendance) * 100).toFixed(1)
    : '0.0';

  // Leaves
  const pendingLeaves = leaveStats?.pending ?? 0;
  const approvedLeaves = leaveStats?.approved ?? 0;
  const rejectedLeaves = leaveStats?.rejected ?? 0;
  const totalLeaves = pendingLeaves + approvedLeaves + rejectedLeaves + (leaveStats?.cancelled ?? 0);

  // Complaints
  const openComplaints = complaintStats?.open ?? (overview?.open_complaints ?? 0);
  const inProgressComplaints = complaintStats?.in_progress ?? 0;
  const resolvedComplaints = complaintStats?.resolved ?? 0;
  const totalComplaints = openComplaints + inProgressComplaints + resolvedComplaints + (complaintStats?.closed ?? 0);

  // Unified Activity Stream
  const activityItems = [
    ...recentNotifications.map((n) => ({
      id: `notif-${n.id || n.notification_id}`,
      type: 'NOTIFICATION',
      title: n.title || 'Institutional Announcement',
      desc: n.message || n.content,
      date: n.created_at,
      icon: Megaphone,
      badge: 'CIRCULAR',
      badgeClass: 'badge-blue',
    })),
    ...recentLeaves.map((l) => ({
      id: `leave-${l.leave_id || l.id}`,
      type: 'LEAVE',
      title: `Leave: ${l.reason || 'Personal Leave'}`,
      desc: `Status: ${l.status || 'PENDING'} · Student: ${l.student_id ? l.student_id.slice(0, 8) : 'Resident'}`,
      date: l.created_at,
      icon: Send,
      badge: l.status || 'PENDING',
      badgeClass: l.status === 'APPROVED' ? 'badge-green' : l.status === 'REJECTED' ? 'badge-amber' : 'badge-blue',
    })),
    ...recentComplaints.map((c) => ({
      id: `complaint-${c.complaint_id || c.id}`,
      type: 'COMPLAINT',
      title: `Ticket: ${c.title || c.category || 'Maintenance Issue'}`,
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
      <div style={{ padding: '60px 0' }}>
        <LoadingState message="Retrieving institutional operational telemetry..." size="lg" />
      </div>
    );
  }

  const collegeName = user?.college_name || user?.collegeName || 'Institution Administration';
  const collegeCode = user?.college_code || '7203';
  const logoUrl = user?.college_logo_url;

  return (
    <div className="fade-in-up" style={{ paddingBottom: '32px' }}>
      {/* ========================================================================= */}
      {/* 1. EXECUTIVE INSTITUTION IDENTITY BANNER                                 */}
      {/* ========================================================================= */}
      <div className="dashboard-hero-banner">
        <div className="dashboard-hero-content">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={collegeName}
              className="dashboard-hero-logo"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <div className="dashboard-hero-logo-fallback">
              <Building2 size={32} />
            </div>
          )}

          <div className="dashboard-hero-text">
            <h1>
              <span>{collegeName}</span>
              <span className="dashboard-hero-pill status-operational" title="Operational Control Plane Active">
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                <span>Operational</span>
              </span>
            </h1>

            <div className="dashboard-hero-meta">
              <button
                type="button"
                onClick={handleCopyCode}
                className="dashboard-hero-pill"
                style={{ cursor: 'pointer', border: '1px solid rgba(255, 255, 255, 0.25)' }}
                title="Click to copy tenant login code"
              >
                <span>Tenant Code: <strong>{collegeCode}</strong></span>
                {copiedCode ? <Check size={11} style={{ color: '#6ee7b7' }} /> : <Copy size={11} />}
              </button>

              <span className="dashboard-hero-pill">
                <Shield size={12} style={{ color: '#93c5fd' }} />
                <span>Admin Control Plane</span>
              </span>

              <span className="dashboard-hero-pill" style={{ opacity: 0.85 }}>
                <Clock size={12} />
                <span>IST (Asia/Kolkata)</span>
              </span>
            </div>
          </div>
        </div>

        {/* Action Shortcuts in Header */}
        <div className="dashboard-hero-actions">
          <Link to="/admin/students" className="dashboard-hero-btn dashboard-hero-btn-primary">
            <UserPlus size={15} />
            <span>Admit Student</span>
          </Link>
          <Link to="/admin/allocations" className="dashboard-hero-btn dashboard-hero-btn-glass">
            <BedDouble size={15} />
            <span>Allocate Bed</span>
          </Link>
          <Link to="/admin/hostels" className="dashboard-hero-btn dashboard-hero-btn-glass">
            <Building2 size={15} />
            <span>Hostel Setup</span>
          </Link>
          <button
            type="button"
            onClick={() => loadDashboardData(true)}
            disabled={isRefreshing}
            className="dashboard-hero-btn dashboard-hero-btn-glass"
            title="Refresh dashboard metrics"
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
            <span>{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. TELEMETRY FILTER & REFRESH STATUS BAR                                */}
      {/* ========================================================================= */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '20px',
        padding: '10px 16px',
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {/* Hostel Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={15} style={{ color: '#64748b' }} />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Hostel:</span>
            <select
              style={{
                padding: '5px 10px',
                fontSize: '0.8rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#f8fafc',
                color: '#1e293b',
                fontWeight: 500,
                cursor: 'pointer',
              }}
              value={selectedHostel}
              onChange={(e) => setSelectedHostel(e.target.value)}
              aria-label="Filter by hostel"
            >
              <option value="ALL">All Hostels ({hostelsList.length})</option>
              {hostelsList.map((h) => (
                <option key={h.hostel_id || h.id} value={h.hostel_id || h.id}>
                  {h.name} ({h.code || 'BLD'})
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={15} style={{ color: '#64748b' }} />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Period:</span>
            <select
              style={{
                padding: '5px 10px',
                fontSize: '0.8rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#f8fafc',
                color: '#1e293b',
                fontWeight: 500,
                cursor: 'pointer',
              }}
              value={selectedDateRange}
              onChange={(e) => setSelectedDateRange(e.target.value)}
              aria-label="Filter by period"
            >
              <option value="ALL">All Time Active</option>
              <option value="TODAY">Today Only</option>
              <option value="7D">Last 7 Days</option>
              <option value="30D">Last 30 Days</option>
            </select>
          </div>
        </div>

        {/* Sync Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.76rem', color: '#64748b' }}>
          <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#10b981' }} />
          <span>PostgreSQL Active</span>
          <span>•</span>
          <span>Synced: {lastSyncTime ? lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. FOUR EXECUTIVE KPI TILES                                             */}
      {/* ========================================================================= */}
      <div className="kpi-cards-grid" style={{ marginBottom: '24px' }}>
        {/* KPI 1: Student Residents */}
        <div className="kpi-card-v2 blue">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Resident Students</span>
            <div className="stat-kpi-icon-wrap blue">
              <GraduationCap size={18} />
            </div>
          </div>
          <div className="stat-kpi-value">
            <CountUpNumber value={totalStudents} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
            <span className="badge-enterprise badge-blue" style={{ fontSize: '0.7rem' }}>
              Active: <strong>{activeStudents}</strong>
            </span>
            <span className="badge-enterprise badge-purple" style={{ fontSize: '0.7rem' }}>
              Allocated: <strong>{allocatedStudents}</strong>
            </span>
          </div>
          <div style={{ marginTop: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
            <Link to="/admin/students" style={{ fontSize: '0.78rem', color: '#2563eb', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
              <span>Manage Student Directory</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {/* KPI 2: Hostel Capacity & Beds */}
        <div className="kpi-card-v2 emerald">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Bed Capacity</span>
            <div className="stat-kpi-icon-wrap emerald">
              <Building2 size={18} />
            </div>
          </div>
          <div className="stat-kpi-value">
            <CountUpNumber value={totalBeds} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
            <span className="badge-enterprise badge-green" style={{ fontSize: '0.7rem' }}>
              Hostels: <strong>{totalHostels}</strong>
            </span>
            <span className="badge-enterprise badge-gray" style={{ fontSize: '0.7rem' }}>
              Occupied: <strong>{occupiedBeds}</strong>
            </span>
          </div>
          <div style={{ marginTop: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
            <Link to="/admin/hostels" style={{ fontSize: '0.78rem', color: '#059669', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
              <span>Hostels & Blocks</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {/* KPI 3: Campus Occupancy Rate */}
        <div className="kpi-card-v2 amber">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Campus Occupancy</span>
            <div className="stat-kpi-icon-wrap amber">
              <BedDouble size={18} />
            </div>
          </div>
          <div className="stat-kpi-value">
            <span>{overallOccupancyRate}%</span>
          </div>
          <div className="occupancy-bar-track">
            <div
              className={`occupancy-bar-fill ${Number(overallOccupancyRate) > 90 ? 'red' : Number(overallOccupancyRate) > 75 ? 'amber' : 'green'}`}
              style={{ width: `${Math.min(100, Math.max(0, Number(overallOccupancyRate)))}%` }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '0.74rem', color: '#64748b' }}>
            <span>Available Beds: <strong style={{ color: '#0f172a' }}>{availableBeds}</strong></span>
            <span className={`badge-enterprise ${Number(overallOccupancyRate) > 85 ? 'badge-amber' : 'badge-green'}`} style={{ fontSize: '0.65rem' }}>
              {Number(overallOccupancyRate) > 85 ? 'Near Capacity' : 'Available Capacity'}
            </span>
          </div>
        </div>

        {/* KPI 4: Hostel Staff & In-Charges */}
        <div className="kpi-card-v2 purple">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Residential Staff</span>
            <div className="stat-kpi-icon-wrap purple">
              <Users size={18} />
            </div>
          </div>
          <div className="stat-kpi-value">
            <CountUpNumber value={totalStaff} />
          </div>
          <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '6px' }}>
            Active wardens, supervisors & gate guards
          </div>
          <div style={{ marginTop: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
            <Link to="/admin/staff" style={{ fontSize: '0.78rem', color: '#7c3aed', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
              <span>Staff Management</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. MAIN SPLIT LAYOUT                                                    */}
      {/* ========================================================================= */}
      <div className="dashboard-split-layout">
        {/* Left Column (2fr): Real-time Inventory & Dual Ops */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Section A: Hostel Occupancy Breakdown */}
          <div className="dashboard-panel-card">
            <div className="dashboard-section-header">
              <div className="dashboard-section-title-wrap">
                <div style={{ padding: '6px', borderRadius: '8px', backgroundColor: '#eff6ff', color: '#2563eb' }}>
                  <Building2 size={18} />
                </div>
                <div>
                  <h2 className="dashboard-section-title">Hostel-Wise Capacity & Occupancy</h2>
                  <p className="dashboard-section-subtitle">Real-time room and bed allocation metrics per building</p>
                </div>
              </div>
              <span className="badge-enterprise badge-blue">
                {filteredOccupancyList.length} {filteredOccupancyList.length === 1 ? 'Building' : 'Buildings'} Configured
              </span>
            </div>

            {filteredOccupancyList.length === 0 ? (
              <EmptyState
                icon={Building2}
                title="No residential hostel records found"
                description={
                  selectedHostel !== 'ALL'
                    ? 'The selected hostel does not have capacity data configured.'
                    : 'Create your hostel buildings and rooms to track residential metrics.'
                }
                action={
                  <Link to="/admin/hostels" className="btn-enterprise btn-primary-blue btn-sm" style={{ textDecoration: 'none' }}>
                    <PlusCircle size={14} />
                    <span>Configure Hostels</span>
                  </Link>
                }
              />
            ) : (
              <div className="enterprise-table-container">
                <table className="enterprise-table">
                  <thead>
                    <tr>
                      <th>Residential Hostel</th>
                      <th>Total Capacity</th>
                      <th>Occupied</th>
                      <th>Available</th>
                      <th>Occupancy Rate</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOccupancyList.map((h) => {
                      const pct = typeof h.occupancy_percentage === 'number'
                        ? h.occupancy_percentage.toFixed(1)
                        : ((h.occupied_beds / (h.total_capacity || 1)) * 100).toFixed(1);
                      return (
                        <tr key={h.hostel_id || h.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
                                <Building2 size={16} />
                              </div>
                              <div>
                                <strong style={{ color: '#0f172a', fontSize: '0.88rem' }}>{h.hostel_name || h.name}</strong>
                                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                  Code: {h.code || 'BLD'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontWeight: 600, color: '#0f172a' }}>{h.total_capacity || h.total_beds || 0} Beds</span>
                          </td>
                          <td>
                            <span className="badge-enterprise badge-purple">{h.occupied_beds || 0} Beds</span>
                          </td>
                          <td>
                            <span className="badge-enterprise badge-green">
                              {h.available_capacity ?? (h.total_capacity - h.occupied_beds) ?? 0} Beds
                            </span>
                          </td>
                          <td style={{ minWidth: '150px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 700, minWidth: '40px', color: '#0f172a' }}>{pct}%</span>
                              <div className="occupancy-bar-track" style={{ margin: 0, flex: 1 }}>
                                <div
                                  className={`occupancy-bar-fill ${Number(pct) > 85 ? 'red' : Number(pct) > 60 ? 'amber' : 'green'}`}
                                  style={{ width: `${Math.min(100, Math.max(0, Number(pct)))}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <Link
                              to={`/admin/hostels`}
                              className="btn-enterprise btn-outline-soft btn-sm"
                              style={{ textDecoration: 'none', fontSize: '0.74rem' }}
                            >
                              <span>Manage</span>
                              <ArrowRight size={11} />
                            </Link>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '20px' }}>
            {/* Sub-Card 1: Attendance Status */}
            <div className="dashboard-panel-card" style={{ marginBottom: 0 }}>
              <div className="dashboard-section-header">
                <div className="dashboard-section-title-wrap">
                  <div style={{ padding: '5px', borderRadius: '6px', backgroundColor: '#f0fdf4', color: '#16a34a' }}>
                    <CheckCircle2 size={16} />
                  </div>
                  <div>
                    <h3 className="dashboard-section-title" style={{ fontSize: '0.94rem' }}>Attendance Roll Call</h3>
                    <p className="dashboard-section-subtitle" style={{ fontSize: '0.74rem' }}>Today's resident curfew telemetry</p>
                  </div>
                </div>
                <span className="badge-enterprise badge-green">Rate: {attendanceRate}%</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '14px' }}>
                <div style={{ padding: '12px', backgroundColor: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: '0.7rem', color: '#166534', fontWeight: 700 }}>PRESENT</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#14532d', marginTop: '2px' }}>
                    {presentCount}
                  </div>
                </div>

                <div style={{ padding: '12px', backgroundColor: '#fef2f2', borderRadius: '10px', border: '1px solid #fecaca' }}>
                  <div style={{ fontSize: '0.7rem', color: '#991b1b', fontWeight: 700 }}>ABSENT</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#7f1d1d', marginTop: '2px' }}>
                    {absentCount}
                  </div>
                </div>

                <div style={{ padding: '12px', backgroundColor: '#fffbeb', borderRadius: '10px', border: '1px solid #fde68a' }}>
                  <div style={{ fontSize: '0.7rem', color: '#92400e', fontWeight: 700 }}>LATE ENTRY</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#78350f', marginTop: '2px' }}>
                    {lateCount}
                  </div>
                </div>

                <div style={{ padding: '12px', backgroundColor: '#eff6ff', borderRadius: '10px', border: '1px solid #bfdbfe' }}>
                  <div style={{ fontSize: '0.7rem', color: '#1e40af', fontWeight: 700 }}>ON LEAVE</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#1e3a8a', marginTop: '2px' }}>
                    {onLeaveCount}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '14px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                <Link to="/admin/attendance" style={{ fontSize: '0.76rem', color: '#16a34a', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
                  <span>Open Roll-Call Ledger</span>
                  <ArrowRight size={12} />
                </Link>
              </div>
            </div>

            {/* Sub-Card 2: Leave Requests Summary */}
            <div className="dashboard-panel-card" style={{ marginBottom: 0 }}>
              <div className="dashboard-section-header">
                <div className="dashboard-section-title-wrap">
                  <div style={{ padding: '5px', borderRadius: '6px', backgroundColor: '#eff6ff', color: '#2563eb' }}>
                    <Send size={16} />
                  </div>
                  <div>
                    <h3 className="dashboard-section-title" style={{ fontSize: '0.94rem' }}>Student Leave Workflows</h3>
                    <p className="dashboard-section-subtitle" style={{ fontSize: '0.74rem' }}>Permits & overnight gate passes</p>
                  </div>
                </div>
                <span className="badge-enterprise badge-blue">Total: {totalLeaves}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '14px' }}>
                <div style={{ padding: '12px', backgroundColor: '#fffbeb', borderRadius: '10px', border: '1px solid #fde68a' }}>
                  <div style={{ fontSize: '0.7rem', color: '#92400e', fontWeight: 700 }}>PENDING REVIEW</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#78350f', marginTop: '2px' }}>
                    {pendingLeaves}
                  </div>
                </div>

                <div style={{ padding: '12px', backgroundColor: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: '0.7rem', color: '#166534', fontWeight: 700 }}>APPROVED</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#14532d', marginTop: '2px' }}>
                    {approvedLeaves}
                  </div>
                </div>

                <div style={{ padding: '12px', backgroundColor: '#fef2f2', borderRadius: '10px', border: '1px solid #fecaca' }}>
                  <div style={{ fontSize: '0.7rem', color: '#991b1b', fontWeight: 700 }}>REJECTED</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#7f1d1d', marginTop: '2px' }}>
                    {rejectedLeaves}
                  </div>
                </div>

                <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 700 }}>CANCELLED</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#334155', marginTop: '2px' }}>
                    {leaveStats?.cancelled ?? 0}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '14px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                <Link to="/admin/leaves" style={{ fontSize: '0.76rem', color: '#2563eb', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
                  <span>Review Pending Leaves</span>
                  <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          </div>

          {/* Section C: Complaints & Maintenance Summary */}
          <div className="dashboard-panel-card">
            <div className="dashboard-section-header">
              <div className="dashboard-section-title-wrap">
                <div style={{ padding: '5px', borderRadius: '6px', backgroundColor: '#fffbeb', color: '#d97706' }}>
                  <Wrench size={18} />
                </div>
                <div>
                  <h3 className="dashboard-section-title">Maintenance & Grievances Work Orders</h3>
                  <p className="dashboard-section-subtitle">Real-time status of student tickets, room repairs & electrical/plumbing tasks</p>
                </div>
              </div>
              <span className="badge-enterprise badge-amber">Open Tickets: {openComplaints}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginTop: '14px' }}>
              <div style={{ padding: '12px', backgroundColor: '#fffbeb', borderRadius: '10px', border: '1px solid #fde68a' }}>
                <span style={{ fontSize: '0.7rem', color: '#92400e', fontWeight: 700 }}>OPEN</span>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#78350f', marginTop: '2px' }}>{openComplaints}</div>
              </div>

              <div style={{ padding: '12px', backgroundColor: '#eff6ff', borderRadius: '10px', border: '1px solid #bfdbfe' }}>
                <span style={{ fontSize: '0.7rem', color: '#1e40af', fontWeight: 700 }}>IN PROGRESS</span>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1e3a8a', marginTop: '2px' }}>{inProgressComplaints}</div>
              </div>

              <div style={{ padding: '12px', backgroundColor: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                <span style={{ fontSize: '0.7rem', color: '#166534', fontWeight: 700 }}>RESOLVED</span>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#14532d', marginTop: '2px' }}>{resolvedComplaints}</div>
              </div>

              <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 700 }}>MAINTENANCE ORDERS</span>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#334155', marginTop: '2px' }}>{overview?.open_maintenance ?? 0}</div>
              </div>
            </div>

            <div style={{ marginTop: '14px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
              <Link to="/admin/complaints" style={{ fontSize: '0.76rem', color: '#d97706', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
                <span>Manage Maintenance Ledger</span>
                <ArrowRight size={12} />
              </Link>
            </div>
          </div>
        </div>

        {/* Right Column (1fr): Operational Shortcuts Hub & Activity Stream */}
        <div className="side-quick-panel">
          {/* Section D: Operational Shortcuts Hub (6 Grid Tiles) */}
          <div className="side-panel-card" style={{ borderColor: '#e2e8f0', backgroundColor: '#ffffff' }}>
            <div className="side-panel-header" style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={16} style={{ color: '#2563eb' }} />
                <h3 className="side-panel-title" style={{ fontSize: '0.9rem' }}>Quick Operations</h3>
              </div>
              <span className="badge-enterprise badge-blue" style={{ fontSize: '0.68rem' }}>Shortcuts</span>
            </div>

            <div className="quick-shortcuts-grid">
              <Link to="/admin/students" className="quick-shortcut-tile">
                <div className="quick-shortcut-icon" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
                  <GraduationCap size={16} />
                </div>
                <span className="quick-shortcut-label">Students</span>
                <span className="quick-shortcut-desc">Admit & verify</span>
              </Link>

              <Link to="/admin/hostels" className="quick-shortcut-tile">
                <div className="quick-shortcut-icon" style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}>
                  <Building2 size={16} />
                </div>
                <span className="quick-shortcut-label">Hostels</span>
                <span className="quick-shortcut-desc">Rooms & blocks</span>
              </Link>

              <Link to="/admin/allocations" className="quick-shortcut-tile">
                <div className="quick-shortcut-icon" style={{ backgroundColor: '#faf5ff', color: '#9333ea' }}>
                  <BedDouble size={16} />
                </div>
                <span className="quick-shortcut-label">Allocations</span>
                <span className="quick-shortcut-desc">Beds & transfers</span>
              </Link>

              <Link to="/admin/attendance" className="quick-shortcut-tile">
                <div className="quick-shortcut-icon" style={{ backgroundColor: '#fffbeb', color: '#d97706' }}>
                  <CheckCircle2 size={16} />
                </div>
                <span className="quick-shortcut-label">Attendance</span>
                <span className="quick-shortcut-desc">Curfew records</span>
              </Link>

              <Link to="/admin/staff" className="quick-shortcut-tile">
                <div className="quick-shortcut-icon" style={{ backgroundColor: '#f1f5f9', color: '#475569' }}>
                  <Users size={16} />
                </div>
                <span className="quick-shortcut-label">Staff</span>
                <span className="quick-shortcut-desc">Wardens & guards</span>
              </Link>

              <Link to="/admin/reports" className="quick-shortcut-tile">
                <div className="quick-shortcut-icon" style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
                  <BarChart3 size={16} />
                </div>
                <span className="quick-shortcut-label">Reports</span>
                <span className="quick-shortcut-desc">Audit & exports</span>
              </Link>
            </div>
          </div>

          {/* Section E: Campus Safety & Security Status */}
          <div className="side-panel-card" style={{ borderColor: '#e2e8f0', backgroundColor: '#ffffff' }}>
            <div className="side-panel-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={16} style={{ color: '#16a34a' }} />
                <h3 className="side-panel-title" style={{ fontSize: '0.9rem' }}>Campus Safety & Gates</h3>
              </div>
              <span className="badge-enterprise badge-green" style={{ fontSize: '0.68rem' }}>Secure</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#334155' }}>
                  <DoorOpen size={14} style={{ color: '#2563eb' }} />
                  <span>Entry/Exit Main Gates</span>
                </div>
                <span className="badge-enterprise badge-green">Operational</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#334155' }}>
                  <AlertCircle size={14} style={{ color: '#10b981' }} />
                  <span>SOS Emergency Network</span>
                </div>
                <span className="badge-enterprise badge-green">0 Alarms</span>
              </div>
            </div>

            <div style={{ marginTop: '12px', display: 'flex', gap: '10px' }}>
              <Link to="/admin/gate-passes" className="btn-enterprise btn-outline-soft btn-sm" style={{ flex: 1, textDecoration: 'none', justifyContent: 'center' }}>
                <span>Gate Passes</span>
              </Link>
              <Link to="/admin/security-assignments" className="btn-enterprise btn-outline-soft btn-sm" style={{ flex: 1, textDecoration: 'none', justifyContent: 'center' }}>
                <span>Guard Roster</span>
              </Link>
            </div>
          </div>

          {/* Section F: Live College Activity Feed */}
          <div className="side-panel-card">
            <div className="side-panel-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={16} style={{ color: '#2563eb' }} />
                <h3 className="side-panel-title" style={{ fontSize: '0.9rem' }}>Recent College Activity</h3>
              </div>
              <span className="badge-enterprise badge-blue">{activityItems.length} events</span>
            </div>

            {activityItems.length === 0 ? (
              <div style={{ padding: '24px 12px', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
                No recent activity records found.
              </div>
            ) : (
              <div>
                {activityItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.id} className="activity-stream-item">
                      <div className="activity-stream-icon-box" style={{ backgroundColor: '#f1f5f9', color: '#475569' }}>
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
                          <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '3px' }}>
                            {formatRelativeTime(item.date)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
