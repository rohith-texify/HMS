import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../../shared/auth/useAuth';
import adminService from '../services/adminService';
import { exportToCSV, triggerPrintReport } from '../../../shared/utils/exportUtils';
import {
  BarChart3,
  TrendingUp,
  Building2,
  Users,
  Download,
  Filter,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Info,
  Calendar,
  BedDouble,
  FileText,
  Wrench,
  ShieldCheck,
  Printer,
  ChevronRight,
  Eye,
  Columns,
  Search,
  Sparkles,
  ClipboardCheck,
  Clock,
  Layers,
  Check,
  X,
} from 'lucide-react';
import {
  LoadingState,
  EmptyState,
} from '../../../shared/components';

export default function AdminReportsPage() {
  const { user } = useAuth();

  // Active Report Suite Selection
  const [activeReportId, setActiveReportId] = useState('OVERVIEW');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [exportSuccessMessage, setExportSuccessMessage] = useState(null);

  // Aggregated Report Data States (from /college/reports/*)
  const [overviewData, setOverviewData] = useState(null);
  const [occupancyData, setOccupancyData] = useState([]);
  const [studentStats, setStudentStats] = useState(null);
  const [allocationStats, setAllocationStats] = useState(null);
  const [attendanceStats, setAttendanceStats] = useState(null);
  const [leaveStats, setLeaveStats] = useState(null);
  const [complaintStats, setComplaintStats] = useState(null);
  const [maintenanceStats, setMaintenanceStats] = useState(null);
  const [staffStats, setStaffStats] = useState(null);

  // Drilldown detailed datasets for tables
  const [hostels, setHostels] = useState([]);
  const [students, setStudents] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [complaints, setComplaints] = useState([]);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // 1. Load All 9 Authoritative Reports from Backend
  const loadReportsData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const [
        overviewRes,
        occupancyRes,
        studentsRes,
        allocationsRes,
        attendanceRes,
        leaveRes,
        complaintsRes,
        maintenanceRes,
        staffRes,
        hostelsMasterRes,
        studentsMasterRes,
        allocationsMasterRes,
        complaintsMasterRes,
      ] = await Promise.allSettled([
        adminService.getReportsOverview(),
        adminService.getReportsOccupancy(),
        adminService.getReportsStudents(),
        adminService.getReportsAllocations(),
        adminService.getReportsAttendance(),
        adminService.getReportsLeave(),
        adminService.getReportsComplaints(),
        adminService.getReportsMaintenance(),
        adminService.getReportsStaff(),
        adminService.getHostels(),
        adminService.getStudents({ limit: 100 }),
        adminService.getBedAllocations(),
        adminService.getComplaints(),
      ]);

      if (overviewRes.status === 'fulfilled') setOverviewData(overviewRes.value?.data || overviewRes.value);
      if (occupancyRes.status === 'fulfilled') setOccupancyData(Array.isArray(occupancyRes.value) ? occupancyRes.value : occupancyRes.value?.data || []);
      if (studentsRes.status === 'fulfilled') setStudentStats(studentsRes.value?.data || studentsRes.value);
      if (allocationsRes.status === 'fulfilled') setAllocationStats(allocationsRes.value?.data || allocationsRes.value);
      if (attendanceRes.status === 'fulfilled') setAttendanceStats(attendanceRes.value?.data || attendanceRes.value);
      if (leaveRes.status === 'fulfilled') setLeaveStats(leaveRes.value?.data || leaveRes.value);
      if (complaintsRes.status === 'fulfilled') setComplaintStats(complaintsRes.value?.data || complaintsRes.value);
      if (maintenanceRes.status === 'fulfilled') setMaintenanceStats(maintenanceRes.value?.data || maintenanceRes.value);
      if (staffRes.status === 'fulfilled') setStaffStats(staffRes.value?.data || staffRes.value);

      // Detailed datasets
      if (hostelsMasterRes.status === 'fulfilled') setHostels(Array.isArray(hostelsMasterRes.value) ? hostelsMasterRes.value : hostelsMasterRes.value?.hostels || hostelsMasterRes.value?.data || []);
      if (studentsMasterRes.status === 'fulfilled') setStudents(Array.isArray(studentsMasterRes.value) ? studentsMasterRes.value : studentsMasterRes.value?.students || studentsMasterRes.value?.data || []);
      if (allocationsMasterRes.status === 'fulfilled') setAllocations(Array.isArray(allocationsMasterRes.value) ? allocationsMasterRes.value : allocationsMasterRes.value?.allocations || allocationsMasterRes.value?.data || []);
      if (complaintsMasterRes.status === 'fulfilled') setComplaints(Array.isArray(complaintsMasterRes.value) ? complaintsMasterRes.value : complaintsMasterRes.value?.complaints || complaintsMasterRes.value?.data || []);
    } catch (err) {
      console.error('Failed to load reports:', err);
      setErrorMessage(err?.response?.data?.error?.message || err.message || 'Unable to load reports.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadReportsData();
  }, [loadReportsData]);

  // Report Catalogue Definitions
  const reportCatalogue = [
    {
      id: 'OVERVIEW',
      title: 'Executive Institutional Overview',
      category: 'Executive',
      icon: BarChart3,
      description: 'High-level aggregation of student enrollment, bed occupancy, open complaints, and facility health.',
      endpoint: 'GET /college/reports/overview',
    },
    {
      id: 'OCCUPANCY',
      title: 'Hostel & Bed Occupancy Report',
      category: 'Hostel & Facility',
      icon: Building2,
      description: 'Hostel-wise capacity, occupied beds, vacant slots, and percentage utilization metrics.',
      endpoint: 'GET /college/reports/occupancy',
    },
    {
      id: 'STUDENTS',
      title: 'Student Directory & Residency Stats',
      category: 'Community',
      icon: Users,
      description: 'Breakdown of active residents vs day scholars, enrollment status, and student rosters.',
      endpoint: 'GET /college/reports/students',
    },
    {
      id: 'ALLOCATIONS',
      title: 'Room & Bed Allocations Report',
      category: 'Hostel & Facility',
      icon: BedDouble,
      description: 'Active allocations versus completed releases and historical occupancy tracking.',
      endpoint: 'GET /college/reports/allocations',
    },
    {
      id: 'ATTENDANCE',
      title: 'Curfew & Nightly Attendance Summary',
      category: 'Operations',
      icon: ClipboardCheck,
      description: 'Aggregated roll-call presence, absence, late check-in, and approved outpass counts.',
      endpoint: 'GET /college/reports/attendance',
    },
    {
      id: 'LEAVES',
      title: 'Student Leave & Outpass Analytics',
      category: 'Operations',
      icon: FileText,
      description: 'Leave request volume by status: pending approvals, granted permissions, and rejections.',
      endpoint: 'GET /college/reports/leave',
    },
    {
      id: 'COMPLAINTS',
      title: 'Student Grievance & Complaint Lifecycle',
      category: 'Support',
      icon: AlertTriangle,
      description: 'Grievance ticket status distribution: open, in-progress, resolved, and closed tickets.',
      endpoint: 'GET /college/reports/complaints',
    },
    {
      id: 'MAINTENANCE',
      title: 'Facility Maintenance & Work Orders',
      category: 'Support',
      icon: Wrench,
      description: 'Hostel repair and engineering work orders breakdown across residential wings.',
      endpoint: 'GET /college/reports/maintenance',
    },
    {
      id: 'STAFF',
      title: 'Residential Staff & Security Directory',
      category: 'Community',
      icon: ShieldCheck,
      description: 'Staff status, hostel wardens, in-charges, and active security gate assignments.',
      endpoint: 'GET /college/reports/staff',
    },
  ];

  // Current active report meta
  const currentReport = reportCatalogue.find((r) => r.id === activeReportId) || reportCatalogue[0];

  // Filtered catalogue based on category & search
  const filteredCatalogue = useMemo(() => {
    return reportCatalogue.filter((item) => {
      const matchCat = selectedCategory === 'ALL' || item.category === selectedCategory;
      const matchSearch = !searchTerm || item.title.toLowerCase().includes(searchTerm.toLowerCase()) || item.description.toLowerCase().includes(searchTerm.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [reportCatalogue, selectedCategory, searchTerm]);

  // Helper for Exporting Current Report to CSV
  const handleExportCSV = () => {
    let filename = `HMS_${activeReportId}_Report`;
    let columns = [];
    let rows = [];

    if (activeReportId === 'OVERVIEW' && overviewData) {
      columns = [
        { key: 'metric', title: 'Metric Name' },
        { key: 'value', title: 'Value' },
      ];
      rows = Object.entries(overviewData).map(([k, v]) => ({
        metric: k.toUpperCase().replace(/_/g, ' '),
        value: typeof v === 'object' ? JSON.stringify(v) : v,
      }));
    } else if (activeReportId === 'OCCUPANCY') {
      columns = [
        { key: 'hostel_name', title: 'Hostel Name' },
        { key: 'total_capacity', title: 'Total Capacity' },
        { key: 'occupied_beds', title: 'Occupied Beds' },
        { key: 'available_capacity', title: 'Available' },
        { key: 'occupancy_percentage', title: 'Occupancy %' },
      ];
      rows = occupancyData;
    } else if (activeReportId === 'STUDENTS') {
      columns = [
        { key: 'enrollment_number', title: 'Enrollment No' },
        { key: 'name', title: 'Student Name' },
        { key: 'email', title: 'Email' },
        { key: 'status', title: 'Status' },
        { key: 'hostel_status', title: 'Residency' },
      ];
      rows = students.map((s) => ({
        ...s,
        name: `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Resident',
      }));
    } else if (activeReportId === 'ALLOCATIONS') {
      columns = [
        { key: 'student_name', title: 'Student Name' },
        { key: 'hostel_name', title: 'Hostel' },
        { key: 'room_number', title: 'Room No' },
        { key: 'bed_label', title: 'Bed Label' },
        { key: 'status', title: 'Status' },
        { key: 'start_date', title: 'Allocated Date' },
      ];
      rows = allocations.map((a) => ({
        ...a,
        student_name: a.student_name || `${a.first_name || ''} ${a.last_name || ''}`.trim(),
      }));
    } else if (activeReportId === 'COMPLAINTS') {
      columns = [
        { key: 'title', title: 'Title' },
        { key: 'category', title: 'Category' },
        { key: 'priority', title: 'Priority' },
        { key: 'status', title: 'Status' },
        { key: 'created_at', title: 'Reported Date' },
      ];
      rows = complaints;
    } else {
      columns = [
        { key: 'status_key', title: 'Category / Status' },
        { key: 'count_val', title: 'Count' },
      ];
      const statsObj =
        activeReportId === 'ATTENDANCE'
          ? attendanceStats
          : activeReportId === 'LEAVES'
          ? leaveStats
          : activeReportId === 'MAINTENANCE'
          ? maintenanceStats
          : staffStats?.total_by_status || {};
      rows = Object.entries(statsObj || {}).map(([k, v]) => ({
        status_key: k.toUpperCase().replace(/_/g, ' '),
        count_val: v,
      }));
    }

    const ok = exportToCSV(filename, columns, rows);
    if (ok) {
      setExportSuccessMessage(`Downloaded "${currentReport.title}" as CSV file.`);
      setTimeout(() => setExportSuccessMessage(null), 5000);
    }
  };

  const occupancyRate = useMemo(() => {
    if (!overviewData?.total_beds) return '0%';
    const pct = Math.round(((overviewData.occupied_beds || 0) / overviewData.total_beds) * 100);
    return `${pct}%`;
  }, [overviewData]);

  if (loading && !overviewData) {
    return (
      <div className="fade-in-up" style={{ padding: '32px' }}>
        <LoadingState message="Connecting to institutional analytics engine..." />
      </div>
    );
  }

  return (
    <div className="fade-in-up">
      {/* Enterprise Hero Header */}
      <div className="enterprise-hero-header">
        <div className="hero-header-titles">
          <div className="hero-category-pill">
            <BarChart3 size={13} />
            <span>Administration &amp; Governance</span>
          </div>
          <h1 className="hero-main-title">Reports &amp; Institutional Analytics</h1>
          <p className="hero-subtitle">
            Generate, preview, and export authoritative institutional intelligence, occupancy records, and compliance reports.
          </p>
        </div>

        <div className="hero-action-buttons">
          <button
            type="button"
            onClick={() => {
              setIsRefreshing(true);
              loadReportsData();
            }}
            disabled={isRefreshing}
            className="btn-enterprise-secondary"
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync Data'}</span>
          </button>

          <button
            type="button"
            onClick={() => triggerPrintReport(currentReport.title)}
            className="btn-enterprise-secondary"
            title="Print report or save as PDF"
          >
            <Printer size={14} style={{ color: '#6366f1' }} />
            <span>Print / PDF</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="btn-enterprise-primary"
            title="Export report data to CSV/Excel"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Success Banner */}
      {exportSuccessMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            padding: '12px 18px',
            borderRadius: '10px',
            marginBottom: '20px',
            fontSize: '13.5px',
            fontWeight: 500,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} style={{ color: '#10b981' }} />
            <span>{exportSuccessMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setExportSuccessMessage(null)}
            style={{ background: 'none', border: 'none', color: '#047857', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            padding: '12px 18px',
            borderRadius: '10px',
            marginBottom: '20px',
            fontSize: '13.5px',
            fontWeight: 500,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} style={{ color: '#ef4444' }} />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Level KPI Overview Cards */}
      <div className="kpi-cards-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Report Suites</span>
            <div className="stat-kpi-icon-wrap blue">
              <BarChart3 size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-blue-600">{reportCatalogue.length}</div>
          <div className="stat-kpi-footnote">
            <span className="status-dot green" />
            <span>Authoritative analytics domains</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Enrolled Scholars</span>
            <div className="stat-kpi-icon-wrap emerald">
              <Users size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-emerald-600">
            {overviewData?.total_students ?? students.length}
          </div>
          <div className="stat-kpi-footnote">
            <span className="status-dot green" />
            <span>Registered residential scholars</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Bed Occupancy</span>
            <div className="stat-kpi-icon-wrap amber">
              <Building2 size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-amber-600">{occupancyRate}</div>
          <div className="stat-kpi-footnote">
            <span>{overviewData?.occupied_beds || 0} of {overviewData?.total_beds || 0} beds allocated</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Pending Support</span>
            <div className="stat-kpi-icon-wrap purple">
              <AlertTriangle size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-purple-600">
            {(overviewData?.open_complaints ?? 0) + (overviewData?.open_maintenance ?? 0)}
          </div>
          <div className="stat-kpi-footnote">
            <span>Open complaints &amp; maintenance tasks</span>
          </div>
        </div>
      </div>

      {/* Main Dual-Column Layout: Left Catalogue Sidebar + Right Report Suite Workspace */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 320px) 1fr', gap: '24px', alignItems: 'start' }}>
        {/* Left Column: Interactive Report Catalogue */}
        <div className="enterprise-card" style={{ padding: '18px 16px', position: 'sticky', top: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div>
              <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#0f172a' }}>Report Suites</div>
              <div style={{ fontSize: '0.74rem', color: '#64748b' }}>Select dataset to preview &amp; export</div>
            </div>
            <span className="badge-enterprise badge-blue">{filteredCatalogue.length} Suites</span>
          </div>

          {/* Quick Search */}
          <div className="filter-search-field" style={{ width: '100%', marginBottom: '12px' }}>
            <Search size={14} className="filter-search-icon" />
            <input
              type="text"
              className="filter-search-input"
              placeholder="Filter report suites..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ fontSize: '0.8rem', padding: '6px 10px 6px 30px' }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{ position: 'absolute', right: '8px', border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Suites List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {filteredCatalogue.map((rep) => {
              const IconComponent = rep.icon;
              const isSelected = rep.id === activeReportId;
              return (
                <button
                  key={rep.id}
                  type="button"
                  onClick={() => setActiveReportId(rep.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: isSelected ? '1px solid #bfdbfe' : '1px solid transparent',
                    background: isSelected ? '#eff6ff' : 'transparent',
                    color: isSelected ? '#1e40af' : '#334155',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: isSelected ? '#dbeafe' : '#f1f5f9',
                        color: isSelected ? '#2563eb' : '#64748b',
                        flexShrink: 0,
                      }}
                    >
                      <IconComponent size={15} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: isSelected ? 700 : 600,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {rep.title}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: isSelected ? '#3b82f6' : '#94a3b8' }}>
                        {rep.category}
                      </div>
                    </div>
                  </div>
                  <ChevronRight
                    size={14}
                    style={{
                      color: isSelected ? '#2563eb' : '#cbd5e1',
                      flexShrink: 0,
                      transform: isSelected ? 'translateX(2px)' : 'none',
                      transition: 'transform 0.15s ease',
                    }}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Selected Report Suite Workspace */}
        <div className="enterprise-card" style={{ padding: '24px' }}>
          {/* Active Report Header Topbar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '16px',
              paddingBottom: '18px',
              borderBottom: '1px solid var(--border-subtle)',
              marginBottom: '20px',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span className="badge-enterprise badge-purple">
                  {currentReport.category}
                </span>
                <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>
                  {currentReport.endpoint}
                </span>
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0' }}>
                {currentReport.title}
              </h2>
              <p style={{ fontSize: '0.84rem', color: '#64748b', margin: 0 }}>
                {currentReport.description}
              </p>
            </div>

            <button
              type="button"
              onClick={handleExportCSV}
              className="btn-enterprise-secondary"
              style={{ fontSize: '0.8rem', padding: '7px 14px' }}
            >
              <Download size={13} />
              <span>Export Dataset</span>
            </button>
          </div>

          {/* ================================================================= */}
          {/* REPORT VIEW 1: EXECUTIVE OVERVIEW                                 */}
          {/* ================================================================= */}
          {activeReportId === 'OVERVIEW' && overviewData && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 600 }}>Students Status</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                    {overviewData.active_students} / {overviewData.total_students}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#059669', marginTop: '2px', fontWeight: 600 }}>Active Scholars</div>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 600 }}>Bed Utilization</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                    {overviewData.occupied_beds} / {overviewData.total_beds}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#2563eb', marginTop: '2px', fontWeight: 600 }}>Occupied Beds</div>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 600 }}>Hostel Facilities</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                    {overviewData.total_hostels}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#7c3aed', marginTop: '2px', fontWeight: 600 }}>Configured Blocks</div>
                </div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '18px', marginBottom: '20px' }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a', marginBottom: '14px' }}>
                  Executive Key Performance Aggregates
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                  <div>
                    <span style={{ fontSize: '0.74rem', color: '#64748b', display: 'block' }}>Total Staff:</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>{overviewData.total_staff}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.74rem', color: '#64748b', display: 'block' }}>Open Complaints:</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#e11d48' }}>{overviewData.open_complaints}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.74rem', color: '#64748b', display: 'block' }}>Maintenance Tickets:</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#d97706' }}>{overviewData.open_maintenance}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.74rem', color: '#64748b', display: 'block' }}>Unread Bulletins:</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#4f46e5' }}>{overviewData.unread_notifications}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* REPORT VIEW 2: HOSTEL OCCUPANCY                                   */}
          {/* ================================================================= */}
          {activeReportId === 'OCCUPANCY' && (
            <div>
              {occupancyData.length === 0 ? (
                <EmptyState icon={Building2} title="No Occupancy Data" message="Occupancy analytics could not be retrieved." />
              ) : (
                <div className="enterprise-table-container">
                  <table className="enterprise-table">
                    <thead>
                      <tr>
                        <th>Hostel Block</th>
                        <th>Total Capacity</th>
                        <th>Occupied Beds</th>
                        <th>Available</th>
                        <th>Occupancy Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {occupancyData.map((row, idx) => {
                        const pct = Number(row.occupancy_percentage || 0).toFixed(1);
                        return (
                          <tr key={row.hostel_id || idx}>
                            <td style={{ fontWeight: 600 }}>{row.hostel_name || 'Block'}</td>
                            <td>{row.total_capacity}</td>
                            <td>{row.occupied_beds}</td>
                            <td>{row.available_capacity}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '80px', height: '6px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                                  <div
                                    style={{
                                      width: `${Math.min(100, Math.max(0, row.occupancy_percentage || 0))}%`,
                                      height: '100%',
                                      background: Number(pct) > 85 ? '#e11d48' : '#2563eb',
                                      borderRadius: '999px',
                                    }}
                                  />
                                </div>
                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>{pct}%</span>
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
          )}

          {/* ================================================================= */}
          {/* REPORT VIEW 3: STUDENTS STATS                                     */}
          {/* ================================================================= */}
          {activeReportId === 'STUDENTS' && (
            <div>
              {studentStats && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '20px' }}>
                  {Object.entries(studentStats.total_by_status || {}).map(([k, v]) => (
                    <div key={k} style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px' }}>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>{k}</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>{v}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="enterprise-table-container">
                <table className="enterprise-table">
                  <thead>
                    <tr>
                      <th>Student Name</th>
                      <th>Enrollment No</th>
                      <th>Email Address</th>
                      <th>Status</th>
                      <th>Residency Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.slice(0, 15).map((row, idx) => (
                      <tr key={row.id || idx}>
                        <td style={{ fontWeight: 600 }}>{`${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Resident'}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{row.enrollment_number || '—'}</td>
                        <td style={{ color: '#64748b' }}>{row.email || '—'}</td>
                        <td>
                          <span className={`badge-enterprise ${row.status === 'ACTIVE' ? 'badge-green' : 'badge-amber'}`}>
                            {row.status || 'ACTIVE'}
                          </span>
                        </td>
                        <td>{row.hostel_status || 'HOSTEL'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* REPORT VIEW 4: ALLOCATIONS                                        */}
          {/* ================================================================= */}
          {activeReportId === 'ALLOCATIONS' && (
            <div>
              {allocationStats && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '20px' }}>
                  <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '10px', padding: '16px' }}>
                    <div style={{ fontSize: '0.76rem', color: '#065f46', fontWeight: 600 }}>Total Active Allocations</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#064e3b', marginTop: '4px' }}>
                      {allocationStats.total_allocated}
                    </div>
                  </div>
                  <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px' }}>
                    <div style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 600 }}>Total Released / Terminated</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                      {allocationStats.total_released}
                    </div>
                  </div>
                </div>
              )}

              <div className="enterprise-table-container">
                <table className="enterprise-table">
                  <thead>
                    <tr>
                      <th>Resident Scholar</th>
                      <th>Hostel Block</th>
                      <th>Room No</th>
                      <th>Bed</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocations.slice(0, 15).map((row, idx) => (
                      <tr key={row.id || idx}>
                        <td style={{ fontWeight: 600 }}>{row.student_name || `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Resident'}</td>
                        <td>{row.hostel_name || 'Block'}</td>
                        <td><span style={{ fontWeight: 600, color: '#2563eb' }}>{row.room_number || '—'}</span></td>
                        <td>{row.bed_label || '—'}</td>
                        <td>
                          <span className={`badge-enterprise ${row.status === 'ALLOCATED' ? 'badge-green' : 'badge-amber'}`}>
                            {row.status || 'ALLOCATED'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* REPORT VIEW 5: ATTENDANCE STATS                                   */}
          {/* ================================================================= */}
          {activeReportId === 'ATTENDANCE' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
              <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '10px', padding: '16px' }}>
                <div style={{ fontSize: '0.76rem', color: '#065f46', fontWeight: 600 }}>Present Count</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#064e3b', marginTop: '4px' }}>
                  {attendanceStats?.present_count ?? 0}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#059669', marginTop: '2px' }}>In hostel rooms</div>
              </div>

              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '16px' }}>
                <div style={{ fontSize: '0.76rem', color: '#991b1b', fontWeight: 600 }}>Absent Count</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#7f1d1d', marginTop: '4px' }}>
                  {attendanceStats?.absent_count ?? 0}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#dc2626', marginTop: '2px' }}>Unaccounted curfew</div>
              </div>

              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '16px' }}>
                <div style={{ fontSize: '0.76rem', color: '#92400e', fontWeight: 600 }}>Late Entry</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#78350f', marginTop: '4px' }}>
                  {attendanceStats?.late_count ?? 0}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#d97706', marginTop: '2px' }}>Post-curfew entries</div>
              </div>

              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '16px' }}>
                <div style={{ fontSize: '0.76rem', color: '#1e40af', fontWeight: 600 }}>On Approved Leave</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e3a8a', marginTop: '4px' }}>
                  {attendanceStats?.leave_count ?? 0}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#2563eb', marginTop: '2px' }}>Valid outpasses</div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* REPORT VIEW 6: LEAVE STATS                                        */}
          {/* ================================================================= */}
          {activeReportId === 'LEAVES' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '16px' }}>
                <div style={{ fontSize: '0.76rem', color: '#92400e', fontWeight: 600 }}>Pending Requests</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#78350f', marginTop: '4px' }}>
                  {leaveStats?.pending ?? 0}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#d97706', marginTop: '2px' }}>Awaiting warden action</div>
              </div>

              <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '10px', padding: '16px' }}>
                <div style={{ fontSize: '0.76rem', color: '#065f46', fontWeight: 600 }}>Approved Passes</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#064e3b', marginTop: '4px' }}>
                  {leaveStats?.approved ?? 0}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#059669', marginTop: '2px' }}>Authorized leaves</div>
              </div>

              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '16px' }}>
                <div style={{ fontSize: '0.76rem', color: '#991b1b', fontWeight: 600 }}>Rejected Passes</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#7f1d1d', marginTop: '4px' }}>
                  {leaveStats?.rejected ?? 0}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#dc2626', marginTop: '2px' }}>Declined requests</div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px' }}>
                <div style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 600 }}>Cancelled</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                  {leaveStats?.cancelled ?? 0}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>Withdrawn by resident</div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* REPORT VIEW 7 & 8: COMPLAINTS & MAINTENANCE                       */}
          {/* ================================================================= */}
          {(activeReportId === 'COMPLAINTS' || activeReportId === 'MAINTENANCE') && (
            <div>
              {(() => {
                const s = activeReportId === 'COMPLAINTS' ? complaintStats : maintenanceStats;
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '16px' }}>
                      <div style={{ fontSize: '0.76rem', color: '#991b1b', fontWeight: 600 }}>Open Tickets</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#7f1d1d', marginTop: '4px' }}>
                        {s?.open ?? 0}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#dc2626', marginTop: '2px' }}>Awaiting assignment</div>
                    </div>

                    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '16px' }}>
                      <div style={{ fontSize: '0.76rem', color: '#92400e', fontWeight: 600 }}>In Progress</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#78350f', marginTop: '4px' }}>
                        {s?.in_progress ?? 0}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#d97706', marginTop: '2px' }}>Technician active</div>
                    </div>

                    <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '10px', padding: '16px' }}>
                      <div style={{ fontSize: '0.76rem', color: '#065f46', fontWeight: 600 }}>Resolved</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#064e3b', marginTop: '4px' }}>
                        {s?.resolved ?? 0}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#059669', marginTop: '2px' }}>Work completed</div>
                    </div>

                    <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px' }}>
                      <div style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 600 }}>Closed</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                        {s?.closed ?? 0}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>Resident verified</div>
                    </div>
                  </div>
                );
              })()}

              {activeReportId === 'COMPLAINTS' && (
                <div className="enterprise-table-container">
                  <table className="enterprise-table">
                    <thead>
                      <tr>
                        <th>Complaint Title</th>
                        <th>Category</th>
                        <th>Priority</th>
                        <th>Status</th>
                        <th>Reported Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {complaints.slice(0, 15).map((row, idx) => (
                        <tr key={row.id || idx}>
                          <td style={{ fontWeight: 600 }}>{row.title || 'Support ticket'}</td>
                          <td><span className="badge-enterprise badge-blue">{row.category || 'HOSTEL'}</span></td>
                          <td>
                            <span className={`badge-enterprise ${row.priority === 'HIGH' || row.priority === 'CRITICAL' ? 'badge-amber' : 'badge-green'}`}>
                              {row.priority || 'NORMAL'}
                            </span>
                          </td>
                          <td>
                            <span className={`badge-enterprise ${row.status === 'RESOLVED' ? 'badge-green' : 'badge-amber'}`}>
                              {row.status || 'OPEN'}
                            </span>
                          </td>
                          <td style={{ color: '#64748b', fontSize: '0.78rem' }}>
                            {row.created_at ? new Date(row.created_at).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* REPORT VIEW 9: STAFF STATS                                        */}
          {/* ================================================================= */}
          {activeReportId === 'STAFF' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
              {Object.entries(staffStats?.total_by_status || {}).map(([k, v]) => (
                <div key={k} style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ fontSize: '0.76rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>{k} Personnel</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>{v}</div>
                  <div style={{ fontSize: '0.72rem', color: '#2563eb', marginTop: '2px' }}>Enrolled college staff</div>
                </div>
              ))}
            </div>
          )}

          {/* Compliance & Export Status Footer Notice */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '14px 16px',
              borderRadius: '10px',
              background: '#f8fafc',
              border: '1px solid var(--border-color)',
              marginTop: '24px',
            }}
          >
            <Info size={16} style={{ color: '#4f46e5', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.5 }}>
              <strong style={{ color: '#0f172a' }}>Authoritative Aggregation Engine: </strong>
              All reports are computed dynamically from real-time database schema aggregations.
              Exports (CSV, Excel-compatible, Print-to-PDF) execute synchronously on client datasets
              without third-party telemetry or synthetic numbers.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
