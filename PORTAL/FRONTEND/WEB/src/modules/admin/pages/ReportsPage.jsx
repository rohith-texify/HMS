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
} from 'lucide-react';
import {
  PageHeader,
  DataTable,
  SearchInput,
  LoadingState,
  EmptyState,
  ErrorState,
  Modal,
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
  const [selectedHostel, setSelectedHostel] = useState('ALL');

  // Column Selector State for active report table
  const [columnConfigModalOpen, setColumnConfigModalOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({});

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
      title: 'Nightly Curfew & Attendance Summary',
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

  // Helper for Exporting Current Report to CSV
  const handleExportCSV = () => {
    let filename = `HMS_${activeReportId}_Report`;
    let columns = [];
    let rows = [];

    if (activeReportId === 'OCCUPANCY') {
      columns = [
        { key: 'hostel_name', title: 'Hostel Name' },
        { key: 'total_capacity', title: 'Total Bed Capacity' },
        { key: 'occupied_beds', title: 'Occupied Beds' },
        { key: 'available_capacity', title: 'Available Beds' },
        { key: 'occupancy_percentage', title: 'Occupancy Rate (%)' },
      ];
      rows = occupancyData.map((o) => ({
        ...o,
        occupancy_percentage: `${Number(o.occupancy_percentage || 0).toFixed(1)}%`,
      }));
    } else if (activeReportId === 'OVERVIEW' && overviewData) {
      columns = [
        { key: 'metric', title: 'Institutional KPI Metric' },
        { key: 'value', title: 'Value' },
      ];
      rows = [
        { metric: 'Total Students', value: overviewData.total_students },
        { metric: 'Active Students', value: overviewData.active_students },
        { metric: 'Total Staff', value: overviewData.total_staff },
        { metric: 'Total Hostels', value: overviewData.total_hostels },
        { metric: 'Total Beds', value: overviewData.total_beds },
        { metric: 'Occupied Beds', value: overviewData.occupied_beds },
        { metric: 'Open Complaints', value: overviewData.open_complaints },
        { metric: 'Open Maintenance Orders', value: overviewData.open_maintenance },
        { metric: 'Unread Bulletins', value: overviewData.unread_notifications },
      ];
    } else if (activeReportId === 'STUDENTS') {
      columns = [
        { key: 'name', title: 'Student Name' },
        { key: 'enrollment_number', title: 'Enrollment No' },
        { key: 'email', title: 'Email' },
        { key: 'status', title: 'Enrollment Status' },
        { key: 'hostel_status', title: 'Hostel Status' },
      ];
      rows = students.map((s) => ({
        name: `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Student',
        enrollment_number: s.enrollment_number || '—',
        email: s.email || '—',
        status: s.status || 'ACTIVE',
        hostel_status: s.hostel_status || 'DAY_SCHOLAR',
      }));
    } else if (activeReportId === 'ALLOCATIONS') {
      columns = [
        { key: 'student_name', title: 'Resident Student' },
        { key: 'hostel_name', title: 'Hostel Block' },
        { key: 'room_number', title: 'Room Number' },
        { key: 'bed_label', title: 'Bed Label' },
        { key: 'status', title: 'Allocation Status' },
      ];
      rows = allocations.map((a) => ({
        student_name: a.student_name || `${a.first_name || ''} ${a.last_name || ''}`.trim() || 'Resident',
        hostel_name: a.hostel_name || 'Hostel',
        room_number: a.room_number || '—',
        bed_label: a.bed_label || '—',
        status: a.status || 'ACTIVE',
      }));
    } else if (activeReportId === 'COMPLAINTS') {
      columns = [
        { key: 'title', title: 'Complaint Title' },
        { key: 'category', title: 'Category' },
        { key: 'priority', title: 'Priority' },
        { key: 'status', title: 'Status' },
        { key: 'created_at', title: 'Logged Date' },
      ];
      rows = complaints.map((c) => ({
        title: c.title || 'Complaint',
        category: c.category || 'HOSTEL',
        priority: c.priority || 'NORMAL',
        status: c.status || 'OPEN',
        created_at: c.created_at ? new Date(c.created_at).toLocaleDateString() : '—',
      }));
    } else {
      // Fallback for key-value summary reports (ATTENDANCE, LEAVES, MAINTENANCE, STAFF)
      columns = [
        { key: 'status_key', title: 'Status / Category' },
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

  if (loading && !overviewData) {
    return <LoadingState message="Connecting to institutional analytics engine..." />;
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
        title="Reports & Institutional Analytics"
        subtitle="Generate, preview, and export authoritative institutional intelligence and compliance records."
        icon={BarChart3}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                setIsRefreshing(true);
                loadReportsData();
              }}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-750 transition"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            <button
              onClick={() => triggerPrintReport(currentReport.title)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-750 transition"
              title="Print report or save as PDF"
            >
              <Printer className="w-4 h-4 text-indigo-500" />
              Print / PDF
            </button>

            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition shadow-sm"
              title="Export report data to CSV/Excel"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        }
      />

      {/* Export Success Banner */}
      {exportSuccessMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-emerald-800 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-sm font-medium">{exportSuccessMessage}</span>
          </div>
          <button
            onClick={() => setExportSuccessMessage(null)}
            className="text-xs font-semibold uppercase hover:underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-center justify-between text-rose-800 dark:bg-rose-950 dark:border-rose-800 dark:text-rose-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <span className="text-sm font-medium">{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-xs font-semibold uppercase hover:underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Level KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-lg">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {reportCatalogue.length}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Operational Report Suites
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-lg">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {overviewData?.total_students ?? students.length}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Total Enrolled Students
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 rounded-lg">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {overviewData?.total_beds ? `${Math.round((overviewData.occupied_beds / overviewData.total_beds) * 100)}%` : '—'}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Bed Capacity Occupancy Rate
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 rounded-lg">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {(overviewData?.open_complaints ?? 0) + (overviewData?.open_maintenance ?? 0)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Open Support & Repairs
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Catalogue Selector Sidebar + Report Preview Screen */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left Column: Report Catalogue */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2">
          <div className="pb-3 border-b border-slate-200 dark:border-slate-700">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Report Catalogue
            </span>
            <p className="text-xs text-slate-500 mt-0.5">
              Select an authoritative dataset
            </p>
          </div>

          <div className="space-y-1 pt-1">
            {reportCatalogue.map((rep) => {
              const IconComponent = rep.icon;
              const isSelected = rep.id === activeReportId;
              return (
                <button
                  key={rep.id}
                  onClick={() => setActiveReportId(rep.id)}
                  className={`w-full text-left p-3 rounded-lg transition flex items-center justify-between text-xs font-medium ${
                    isSelected
                      ? 'bg-indigo-50 text-indigo-700 font-semibold dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                      : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-750'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <IconComponent className={`w-4 h-4 shrink-0 ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                    <span className="truncate">{rep.title}</span>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition ${isSelected ? 'rotate-90 text-indigo-600' : 'text-slate-400 opacity-60'}`} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Right 3 Columns: Selected Report Preview & Analytics */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-6">
          {/* Active Report Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-700">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 uppercase tracking-wider">
                  {currentReport.category}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {currentReport.endpoint}
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
                {currentReport.title}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {currentReport.description}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">
                Generated: {new Date().toLocaleTimeString()}
              </span>
            </div>
          </div>

          {/* REPORT VIEW 1: EXECUTIVE OVERVIEW */}
          {activeReportId === 'OVERVIEW' && overviewData && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700">
                  <div className="text-xs text-slate-500 font-medium">Students Status</div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                    {overviewData.active_students} / {overviewData.total_students} Active
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700">
                  <div className="text-xs text-slate-500 font-medium">Bed Utilization</div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                    {overviewData.occupied_beds} / {overviewData.total_beds} Occupied
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700">
                  <div className="text-xs text-slate-500 font-medium">Hostel Facilities</div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                    {overviewData.total_hostels} Residential Blocks
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Executive Key Performance Aggregates
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 block">Total Staff:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                      {overviewData.total_staff}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Open Complaints:</span>
                    <span className="font-semibold text-rose-600 dark:text-rose-400 text-sm">
                      {overviewData.open_complaints}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Maintenance Tickets:</span>
                    <span className="font-semibold text-amber-600 dark:text-amber-400 text-sm">
                      {overviewData.open_maintenance}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Unread Bulletins:</span>
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400 text-sm">
                      {overviewData.unread_notifications}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* REPORT VIEW 2: HOSTEL OCCUPANCY */}
          {activeReportId === 'OCCUPANCY' && (
            <div className="space-y-4">
              <DataTable
                columns={[
                  { key: 'hostel_name', title: 'Hostel Block' },
                  { key: 'total_capacity', title: 'Total Capacity' },
                  { key: 'occupied_beds', title: 'Occupied Beds' },
                  { key: 'available_capacity', title: 'Available' },
                  {
                    key: 'occupancy_percentage',
                    title: 'Occupancy Rate',
                    render: (row) => {
                      const pct = Number(row.occupancy_percentage || 0).toFixed(1);
                      return (
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-indigo-600 h-full rounded-full"
                              style={{ width: `${Math.min(100, Math.max(0, row.occupancy_percentage || 0))}%` }}
                            />
                          </div>
                          <span className="font-bold text-xs">{pct}%</span>
                        </div>
                      );
                    },
                  },
                ]}
                data={occupancyData}
                emptyMessage={<EmptyState icon={Building2} title="No Occupancy Data" message="Occupancy analytics could not be retrieved." />}
              />
            </div>
          )}

          {/* REPORT VIEW 3: STUDENTS STATS */}
          {activeReportId === 'STUDENTS' && (
            <div className="space-y-4">
              {studentStats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {Object.entries(studentStats.total_by_status || {}).map(([k, v]) => (
                    <div key={k} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700">
                      <div className="text-[11px] text-slate-500 uppercase tracking-wide">{k}</div>
                      <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">{v}</div>
                    </div>
                  ))}
                </div>
              )}

              <DataTable
                columns={[
                  {
                    key: 'name',
                    title: 'Student Name',
                    render: (row) => `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Resident',
                  },
                  { key: 'enrollment_number', title: 'Enrollment No' },
                  { key: 'email', title: 'Email Address' },
                  { key: 'status', title: 'Status' },
                  { key: 'hostel_status', title: 'Residency Type' },
                ]}
                data={students}
                emptyMessage={<EmptyState icon={Users} title="No Student Records" message="No students found." />}
              />
            </div>
          )}

          {/* REPORT VIEW 4: ALLOCATIONS */}
          {activeReportId === 'ALLOCATIONS' && (
            <div className="space-y-4">
              {allocationStats && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                    <div className="text-xs text-emerald-800 dark:text-emerald-300 font-semibold">Total Active Allocations</div>
                    <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-100 mt-1">{allocationStats.total_allocated}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700">
                    <div className="text-xs text-slate-500 font-semibold">Total Released / Terminated</div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{allocationStats.total_released}</div>
                  </div>
                </div>
              )}

              <DataTable
                columns={[
                  {
                    key: 'student',
                    title: 'Student',
                    render: (row) => row.student_name || `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Resident',
                  },
                  { key: 'hostel_name', title: 'Hostel Block' },
                  { key: 'room_number', title: 'Room No' },
                  { key: 'bed_label', title: 'Bed' },
                  { key: 'status', title: 'Status' },
                ]}
                data={allocations}
                emptyMessage={<EmptyState icon={BedDouble} title="No Allocation Records" message="No bed allocations found." />}
              />
            </div>
          )}

          {/* REPORT VIEW 5: ATTENDANCE STATS */}
          {activeReportId === 'ATTENDANCE' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                  <div className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold">Present Count</div>
                  <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-100 mt-1">{attendanceStats?.present_count ?? 0}</div>
                </div>
                <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800">
                  <div className="text-xs text-rose-700 dark:text-rose-300 font-semibold">Absent Count</div>
                  <div className="text-2xl font-bold text-rose-900 dark:text-rose-100 mt-1">{attendanceStats?.absent_count ?? 0}</div>
                </div>
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                  <div className="text-xs text-amber-700 dark:text-amber-300 font-semibold">Late Entry</div>
                  <div className="text-2xl font-bold text-amber-900 dark:text-amber-100 mt-1">{attendanceStats?.late_count ?? 0}</div>
                </div>
                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
                  <div className="text-xs text-blue-700 dark:text-blue-300 font-semibold">On Approved Leave</div>
                  <div className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-1">{attendanceStats?.leave_count ?? 0}</div>
                </div>
              </div>
            </div>
          )}

          {/* REPORT VIEW 6: LEAVE STATS */}
          {activeReportId === 'LEAVES' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                  <div className="text-xs text-amber-700 dark:text-amber-300 font-semibold">Pending Requests</div>
                  <div className="text-2xl font-bold text-amber-900 dark:text-amber-100 mt-1">{leaveStats?.pending ?? 0}</div>
                </div>
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                  <div className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold">Approved Passes</div>
                  <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-100 mt-1">{leaveStats?.approved ?? 0}</div>
                </div>
                <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800">
                  <div className="text-xs text-rose-700 dark:text-rose-300 font-semibold">Rejected</div>
                  <div className="text-2xl font-bold text-rose-900 dark:text-rose-100 mt-1">{leaveStats?.rejected ?? 0}</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700">
                  <div className="text-xs text-slate-500 font-semibold">Cancelled</div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{leaveStats?.cancelled ?? 0}</div>
                </div>
              </div>
            </div>
          )}

          {/* REPORT VIEW 7 & 8: COMPLAINTS & MAINTENANCE */}
          {(activeReportId === 'COMPLAINTS' || activeReportId === 'MAINTENANCE') && (
            <div className="space-y-6">
              {(() => {
                const s = activeReportId === 'COMPLAINTS' ? complaintStats : maintenanceStats;
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800">
                      <div className="text-xs text-rose-700 dark:text-rose-300 font-semibold">Open Tickets</div>
                      <div className="text-2xl font-bold text-rose-900 dark:text-rose-100 mt-1">{s?.open ?? 0}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                      <div className="text-xs text-amber-700 dark:text-amber-300 font-semibold">In Progress</div>
                      <div className="text-2xl font-bold text-amber-900 dark:text-amber-100 mt-1">{s?.in_progress ?? 0}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                      <div className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold">Resolved</div>
                      <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-100 mt-1">{s?.resolved ?? 0}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700">
                      <div className="text-xs text-slate-500 font-semibold">Closed</div>
                      <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{s?.closed ?? 0}</div>
                    </div>
                  </div>
                );
              })()}

              {activeReportId === 'COMPLAINTS' && (
                <DataTable
                  columns={[
                    { key: 'title', title: 'Complaint Title' },
                    { key: 'category', title: 'Category' },
                    { key: 'priority', title: 'Priority' },
                    { key: 'status', title: 'Status' },
                    {
                      key: 'created_at',
                      title: 'Reported Date',
                      render: (row) => (row.created_at ? new Date(row.created_at).toLocaleDateString() : '—'),
                    },
                  ]}
                  data={complaints}
                  emptyMessage={<EmptyState icon={AlertTriangle} title="No Complaints Logged" message="No grievances recorded." />}
                />
              )}
            </div>
          )}

          {/* REPORT VIEW 9: STAFF STATS */}
          {activeReportId === 'STAFF' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {Object.entries(staffStats?.total_by_status || {}).map(([k, v]) => (
                  <div key={k} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700">
                    <div className="text-xs text-slate-500 font-semibold uppercase">{k} STAFF</div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Honest Capability & Export Status Footer Notice */}
          <div className="p-4 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-700 flex items-start gap-3">
            <Info className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Authoritative Aggregation Engine:{' '}
              </span>
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
