import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import inchargeService from '../services/inchargeService';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Badge from '../components/Badge';
import Button from '../components/Button';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import { exportToCSV, triggerPrintReport } from '../utils/exportUtils';
import {
  BarChart3,
  Download,
  RefreshCw,
  CheckCircle2,
  Calendar,
  BedDouble,
  Wrench,
  Printer,
  Clock,
  FileSpreadsheet
} from 'lucide-react';

export default function ReportsPage() {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const canViewCollegeReports = hasPermission('reports.view');
  const assignedHostelId = user?.hostelId || user?.hostel_id;

  // Active Report Suite
  const [activeReportSuite, setActiveReportSuite] = useState('OCCUPANCY');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [exportBanner, setExportBanner] = useState(null);

  // Authoritative Report Datasets from /college/reports/* and domain fallbacks
  const [overviewData, setOverviewData] = useState(null);
  const [occupancyData, setOccupancyData] = useState([]);
  const [, setStudentStats] = useState(null);
  const [allocationStats, setAllocationStats] = useState(null);
  const [attendanceStats, setAttendanceStats] = useState(null);
  const [leaveStats, setLeaveStats] = useState(null);
  const [complaintStats, setComplaintStats] = useState(null);
  const [maintenanceStats, setMaintenanceStats] = useState(null);
  const [, setStaffStats] = useState(null);

  // Hostel specific context
  const [, setMyHostel] = useState(null);

  // Stale request guard
  const reqSeqRef = useRef(0);

  // Load Authoritative Report Datasets from Backend
  const loadReportsData = useCallback(async (isSilent = false) => {
    const seq = ++reqSeqRef.current;
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);
      setErrorMessage(null);

      const hostelPromise = inchargeService.getMyHostel().catch(() => null);

      if (canViewCollegeReports) {
        // Symmetrically fetch all 9 institutional report suites alongside hostel context
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
          hostelRes,
        ] = await Promise.allSettled([
          inchargeService.getReportsOverview(),
          inchargeService.getReportsOccupancy(),
          inchargeService.getReportsStudents(),
          inchargeService.getReportsAllocations(),
          inchargeService.getReportsAttendance(),
          inchargeService.getReportsLeave(),
          inchargeService.getReportsComplaints(),
          inchargeService.getReportsMaintenance(),
          inchargeService.getReportsStaff(),
          hostelPromise,
        ]);

        if (seq !== reqSeqRef.current) return;

        if (hostelRes.status === 'fulfilled') {
          const h = hostelRes.value?.data || hostelRes.value?.hostel || hostelRes.value;
          setMyHostel(h);
        }

        // 1. Overview
        if (overviewRes.status === 'fulfilled') {
          setOverviewData(overviewRes.value?.data || overviewRes.value);
        }

        // 2. Occupancy
        if (occupancyRes.status === 'fulfilled') {
          const occ = occupancyRes.value?.data || occupancyRes.value || [];
          setOccupancyData(Array.isArray(occ) ? occ : []);
        } else if (hostelRes.status === 'fulfilled') {
          // Fallback to assigned hostel occupancy if college-wide reports.view is restricted
          const h = hostelRes.value?.data || hostelRes.value?.hostel || hostelRes.value;
          if (h) {
            const cap = h.total_capacity || h.capacity || 0;
            const occ = h.occupied_beds || h.occupied_capacity || 0;
            const avail = Math.max(0, cap - occ);
            const pct = cap > 0 ? Number(((occ / cap) * 100).toFixed(1)) : 0;
            setOccupancyData([
              {
                hostel_id: h.id || h.hostel_id || assignedHostelId,
                hostel_name: h.name || 'Assigned Hostel',
                total_capacity: cap,
                occupied_beds: occ,
                available_capacity: avail,
                occupancy_percentage: pct,
              },
            ]);
          }
        }

        // 3. Students
        if (studentsRes.status === 'fulfilled') {
          setStudentStats(studentsRes.value?.data || studentsRes.value);
        }

        // 4. Allocations
        if (allocationsRes.status === 'fulfilled') {
          setAllocationStats(allocationsRes.value?.data || allocationsRes.value);
        }

        // 5. Attendance (with fallback to getAttendanceSummary)
        if (attendanceRes.status === 'fulfilled') {
          setAttendanceStats(attendanceRes.value?.data || attendanceRes.value);
        } else {
          const attSum = await inchargeService.getAttendanceSummary().catch(() => null);
          if (seq === reqSeqRef.current && attSum) {
            setAttendanceStats(attSum?.data || attSum);
          }
        }

        // 6. Leave (with fallback to getLeaveSummary)
        if (leaveRes.status === 'fulfilled') {
          setLeaveStats(leaveRes.value?.data || leaveRes.value);
        } else {
          const lSum = await inchargeService.getLeaveSummary().catch(() => null);
          if (seq === reqSeqRef.current && lSum) {
            setLeaveStats(lSum?.data || lSum);
          }
        }

        // 7. Complaints (with fallback to getComplaintSummary)
        if (complaintsRes.status === 'fulfilled') {
          setComplaintStats(complaintsRes.value?.data || complaintsRes.value);
        } else {
          const cSum = await inchargeService.getComplaintSummary().catch(() => null);
          if (seq === reqSeqRef.current && cSum) {
            setComplaintStats(cSum?.data || cSum);
          }
        }

        // 8. Maintenance
        if (maintenanceRes.status === 'fulfilled') {
          setMaintenanceStats(maintenanceRes.value?.data || maintenanceRes.value);
        }

        // 9. Staff
        if (staffRes.status === 'fulfilled') {
          setStaffStats(staffRes.value?.data || staffRes.value);
        }
      } else {
        // Direct hostel-scoped intelligence fetching: avoids 403 Forbidden errors when reports.view is institutional
        const [hostelRes, attSumRes, leaveSumRes, complaintSumRes] = await Promise.allSettled([
          hostelPromise,
          inchargeService.getAttendanceSummary().catch(() => null),
          inchargeService.getLeaveSummary().catch(() => null),
          inchargeService.getComplaintSummary().catch(() => null),
        ]);

        if (seq !== reqSeqRef.current) return;

        if (hostelRes.status === 'fulfilled' && hostelRes.value) {
          const h = hostelRes.value?.data || hostelRes.value?.hostel || hostelRes.value;
          setMyHostel(h);
          if (h) {
            const cap = h.total_capacity || h.capacity || 0;
            const occ = h.occupied_beds || h.occupied_capacity || 0;
            const avail = Math.max(0, cap - occ);
            const pct = cap > 0 ? Number(((occ / cap) * 100).toFixed(1)) : 0;
            setOccupancyData([
              {
                hostel_id: h.id || h.hostel_id || assignedHostelId,
                hostel_name: h.name || 'Assigned Hostel',
                total_capacity: cap,
                occupied_beds: occ,
                available_capacity: avail,
                occupancy_percentage: pct,
              },
            ]);
            setOverviewData({
              total_capacity: cap,
              occupied_beds: occ,
              available_capacity: avail,
              occupancy_percentage: pct,
              active_residents: occ,
            });
          }
        }

        if (attSumRes.status === 'fulfilled' && attSumRes.value) {
          setAttendanceStats(attSumRes.value?.data || attSumRes.value);
        }
        if (leaveSumRes.status === 'fulfilled' && leaveSumRes.value) {
          setLeaveStats(leaveSumRes.value?.data || leaveSumRes.value);
        }
        if (complaintSumRes.status === 'fulfilled' && complaintSumRes.value) {
          setComplaintStats(complaintSumRes.value?.data || complaintSumRes.value);
        }
      }
    } catch (err) {
      if (seq === reqSeqRef.current) {
        setErrorMessage(
          err.response?.data?.error?.message ||
          err.message ||
          'Failed to load authoritative institutional reports.'
        );
      }
    } finally {
      if (seq === reqSeqRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [assignedHostelId, canViewCollegeReports]);

  useEffect(() => {
    loadReportsData();
  }, [loadReportsData]);

  // Computed Analytical KPIs from Authoritative Sourced Datasets
  const kpis = useMemo(() => {
    // Occupancy
    let totalCap = 0;
    let totalOcc = 0;
    if (occupancyData.length > 0) {
      totalCap = occupancyData.reduce((acc, h) => acc + (h.total_capacity || 0), 0);
      totalOcc = occupancyData.reduce((acc, h) => acc + (h.occupied_beds || 0), 0);
    } else if (overviewData) {
      totalCap = overviewData.total_beds || 0;
      totalOcc = overviewData.occupied_beds || 0;
    }
    const occRate = totalCap > 0 ? ((totalOcc / totalCap) * 100).toFixed(1) : '0.0';

    // Attendance
    const pres = attendanceStats?.present_count ?? attendanceStats?.present ?? 0;
    const abs = attendanceStats?.absent_count ?? attendanceStats?.absent ?? 0;
    const totalAtt = pres + abs;
    const attRate = totalAtt > 0 ? ((pres / totalAtt) * 100).toFixed(1) : '—';

    // Leaves
    const pendingLeaves = leaveStats?.pending ?? 0;
    const approvedLeaves = leaveStats?.approved ?? 0;

    // Complaints
    const openGrievances = (complaintStats?.open ?? 0) + (complaintStats?.in_progress ?? 0);
    const resolvedGrievances = complaintStats?.resolved ?? 0;

    return {
      occupancyRate: `${occRate}%`,
      occupiedBeds: totalOcc,
      totalCapacity: totalCap,
      attendanceRate: attRate !== '—' ? `${attRate}%` : '100%',
      presentCount: pres,
      absentCount: abs,
      pendingLeaves,
      approvedLeaves,
      openGrievances,
      resolvedGrievances,
    };
  }, [occupancyData, overviewData, attendanceStats, leaveStats, complaintStats]);

  // Export Active Report to CSV
  const handleExportActiveReport = () => {
    let exportRows = [];
    let filename = `hostel_report_${activeReportSuite.toLowerCase()}`;

    if (activeReportSuite === 'OCCUPANCY') {
      filename = 'hostel_occupancy_report';
      exportRows = occupancyData.map((h, idx) => ({
        'S.No': idx + 1,
        'Hostel Name': h.hostel_name || '—',
        'Total Capacity (Beds)': h.total_capacity || 0,
        'Occupied Beds': h.occupied_beds || 0,
        'Available Capacity': h.available_capacity || 0,
        'Occupancy Rate (%)': `${h.occupancy_percentage || 0}%`,
      }));
    } else if (activeReportSuite === 'ATTENDANCE') {
      filename = 'hostel_attendance_summary_report';
      exportRows = [
        {
          Metric: 'Present Residents',
          Count: attendanceStats?.present_count ?? attendanceStats?.present ?? 0,
        },
        {
          Metric: 'Absent Residents',
          Count: attendanceStats?.absent_count ?? attendanceStats?.absent ?? 0,
        },
        {
          Metric: 'Late Curfew Check-ins',
          Count: attendanceStats?.late_count ?? attendanceStats?.late ?? 0,
        },
        {
          Metric: 'Residents on Approved Leave',
          Count: attendanceStats?.leave_count ?? attendanceStats?.on_leave ?? 0,
        },
      ];
    } else if (activeReportSuite === 'LEAVES') {
      filename = 'hostel_leave_distribution_report';
      exportRows = [
        { Status: 'Pending Review', Count: leaveStats?.pending ?? 0 },
        { Status: 'Approved & Active', Count: leaveStats?.approved ?? 0 },
        { Status: 'Rejected', Count: leaveStats?.rejected ?? 0 },
        { Status: 'Cancelled', Count: leaveStats?.cancelled ?? 0 },
      ];
    } else if (activeReportSuite === 'COMPLAINTS') {
      filename = 'hostel_complaints_maintenance_report';
      exportRows = [
        { Category: 'Complaints - Open', Count: complaintStats?.open ?? 0 },
        { Category: 'Complaints - In Progress', Count: complaintStats?.in_progress ?? 0 },
        { Category: 'Complaints - Resolved', Count: complaintStats?.resolved ?? 0 },
        { Category: 'Complaints - Closed', Count: complaintStats?.closed ?? 0 },
        { Category: 'Maintenance - Open', Count: maintenanceStats?.open ?? 0 },
        { Category: 'Maintenance - In Progress', Count: maintenanceStats?.in_progress ?? 0 },
        { Category: 'Maintenance - Resolved', Count: maintenanceStats?.resolved ?? 0 },
        { Category: 'Maintenance - Closed', Count: maintenanceStats?.closed ?? 0 },
      ];
    } else if (activeReportSuite === 'ALLOCATIONS') {
      filename = 'hostel_allocation_velocity_report';
      exportRows = [
        { AllocationMetric: 'Total Currently Allocated', Count: allocationStats?.total_allocated ?? 0 },
        { AllocationMetric: 'Total Released / Vacated', Count: allocationStats?.total_released ?? 0 },
      ];
    }

    if (!exportRows.length) return;

    const dateStr = new Date().toISOString().split('T')[0];
    const success = exportToCSV(exportRows, `${filename}_${dateStr}.csv`);
    if (success) {
      setExportBanner(`Report "${activeReportSuite}" exported to CSV successfully.`);
      setTimeout(() => setExportBanner(null), 4000);
    }
  };

  // Occupancy Table Columns
  const occupancyColumns = [
    {
      key: 'hostel_name',
      header: 'Hostel Facility',
      render: (row) => (
        <div>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row?.hostel_name || 'Hostel'}</span>
          {row?.hostel_id === assignedHostelId && (
            <Badge variant="primary" style={{ marginLeft: '8px' }}>
              ASSIGNED
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'total_capacity',
      header: 'Total Capacity',
      align: 'right',
      render: (row) => <span style={{ fontWeight: 600 }}>{row?.total_capacity ?? 0}</span>,
    },
    {
      key: 'occupied_beds',
      header: 'Occupied Beds',
      align: 'right',
      render: (row) => <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row?.occupied_beds ?? 0}</span>,
    },
    {
      key: 'available_capacity',
      header: 'Available Beds',
      align: 'right',
      render: (row) => (
        <span style={{ fontWeight: 600, color: 'var(--success-color, #16a34a)' }}>{row?.available_capacity ?? 0}</span>
      ),
    },
    {
      key: 'occupancy_percentage',
      header: 'Occupancy Rate',
      align: 'right',
      render: (row) => {
        const pct = Number(row?.occupancy_percentage ?? 0);
        const variant = pct >= 90 ? 'danger' : pct >= 70 ? 'warning' : 'success';
        return <Badge variant={variant}>{pct.toFixed(1)}%</Badge>;
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Hostel Reports & Analytical Intelligence"
        description="Authoritative hostel occupancy statistics, curfew attendance rates, leave movement distributions, and grievance SLA reports."
        icon={BarChart3}
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Reports & Analytics' },
        ]}
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              variant="secondary"
              icon={RefreshCw}
              loading={refreshing}
              onClick={() => loadReportsData(true)}
            >
              Refresh
            </Button>
            <Button
              variant="secondary"
              icon={Printer}
              onClick={() => triggerPrintReport(`Hostel_${activeReportSuite}_Report`)}
            >
              Print
            </Button>
            <Button
              variant="primary"
              icon={Download}
              disabled={loading}
              onClick={handleExportActiveReport}
            >
              Export CSV
            </Button>
          </div>
        }
      />

      {/* Integration Boundary Note */}
      <div
        className="card"
        style={{
          borderLeft: '4px solid var(--primary-color, #2563eb)',
          backgroundColor: 'rgba(37, 99, 235, 0.04)',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <FileSpreadsheet size={22} color="var(--primary-color, #2563eb)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
              Authoritative Server-Side Intelligence & Export Standards
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
              All report figures are generated directly from backend database aggregate endpoints (<code>/college/reports/*</code> and domain summary views).
              Report exports conform to RFC 4180 CSV specifications with a UTF-8 Byte Order Mark (BOM) for compatibility with Microsoft Excel.
              Binary PDF generation microservices are not implemented in the current backend.
            </p>
          </div>
        </div>
      </div>

      {exportBanner && (
        <div
          style={{
            backgroundColor: 'rgba(22, 163, 74, 0.1)',
            color: 'var(--success-color, #16a34a)',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.88rem',
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={16} />
          <span>{exportBanner}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid-4" style={{ marginBottom: '20px' }}>
        <div className="card stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'rgba(37, 99, 235, 0.1)', color: '#2563eb' }}>
            <BedDouble size={22} />
          </div>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {kpis.occupancyRate}
            </div>
            <div className="stat-label">
              Occupancy ({kpis.occupiedBeds} / {kpis.totalCapacity} beds)
            </div>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'rgba(22, 163, 74, 0.1)', color: '#16a34a' }}>
            <Calendar size={22} />
          </div>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {kpis.attendanceRate}
            </div>
            <div className="stat-label">
              Curfew Attendance ({kpis.presentCount} present)
            </div>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'rgba(234, 88, 12, 0.1)', color: '#ea580c' }}>
            <Clock size={22} />
          </div>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {kpis.pendingLeaves}
            </div>
            <div className="stat-label">
              Pending Leaves ({kpis.approvedLeaves} active)
            </div>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>
            <Wrench size={22} />
          </div>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {kpis.openGrievances}
            </div>
            <div className="stat-label">
              Open Grievances ({kpis.resolvedGrievances} resolved)
            </div>
          </div>
        </div>
      </div>

      {/* Report Suite Tabs */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-subtle, rgba(0,0,0,0.02))',
            overflowX: 'auto',
          }}
        >
          <button
            type="button"
            className="tab-button"
            style={{
              padding: '12px 20px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.88rem',
              color: activeReportSuite === 'OCCUPANCY' ? 'var(--primary-color)' : 'var(--text-secondary)',
              borderBottom: activeReportSuite === 'OCCUPANCY' ? '2px solid var(--primary-color)' : '2px solid transparent',
              whiteSpace: 'nowrap',
            }}
            onClick={() => setActiveReportSuite('OCCUPANCY')}
          >
            Occupancy & Capacity
          </button>
          <button
            type="button"
            className="tab-button"
            style={{
              padding: '12px 20px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.88rem',
              color: activeReportSuite === 'ATTENDANCE' ? 'var(--primary-color)' : 'var(--text-secondary)',
              borderBottom: activeReportSuite === 'ATTENDANCE' ? '2px solid var(--primary-color)' : '2px solid transparent',
              whiteSpace: 'nowrap',
            }}
            onClick={() => setActiveReportSuite('ATTENDANCE')}
          >
            Attendance & Curfew
          </button>
          <button
            type="button"
            className="tab-button"
            style={{
              padding: '12px 20px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.88rem',
              color: activeReportSuite === 'LEAVES' ? 'var(--primary-color)' : 'var(--text-secondary)',
              borderBottom: activeReportSuite === 'LEAVES' ? '2px solid var(--primary-color)' : '2px solid transparent',
              whiteSpace: 'nowrap',
            }}
            onClick={() => setActiveReportSuite('LEAVES')}
          >
            Leave & Movement
          </button>
          <button
            type="button"
            className="tab-button"
            style={{
              padding: '12px 20px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.88rem',
              color: activeReportSuite === 'COMPLAINTS' ? 'var(--primary-color)' : 'var(--text-secondary)',
              borderBottom: activeReportSuite === 'COMPLAINTS' ? '2px solid var(--primary-color)' : '2px solid transparent',
              whiteSpace: 'nowrap',
            }}
            onClick={() => setActiveReportSuite('COMPLAINTS')}
          >
            Complaints & Maintenance
          </button>
          <button
            type="button"
            className="tab-button"
            style={{
              padding: '12px 20px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.88rem',
              color: activeReportSuite === 'ALLOCATIONS' ? 'var(--primary-color)' : 'var(--text-secondary)',
              borderBottom: activeReportSuite === 'ALLOCATIONS' ? '2px solid var(--primary-color)' : '2px solid transparent',
              whiteSpace: 'nowrap',
            }}
            onClick={() => setActiveReportSuite('ALLOCATIONS')}
          >
            Allocations Velocity
          </button>
        </div>

        {/* Tab Content Panes */}
        <div style={{ padding: '20px' }}>
          {loading && <LoadingState title="Loading authoritative analytical reports..." rows={5} />}
          {errorMessage && (
            <ErrorState
              title="Report Query Failure"
              message={errorMessage}
              onRetry={() => loadReportsData()}
            />
          )}

          {!loading && !errorMessage && activeReportSuite === 'OCCUPANCY' && (
            <div>
              <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
                    Hostel Occupancy & Bed Inventory
                  </h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                    Authoritative bed allocation metrics aggregated from active room inventory.
                  </p>
                </div>
              </div>
              {occupancyData.length === 0 ? (
                <EmptyState
                  icon={BedDouble}
                  title="No Occupancy Data Available"
                  message="No hostel facility bed capacity records were returned for your institution."
                />
              ) : (
                <DataTable
                  columns={occupancyColumns}
                  data={occupancyData}
                  keyField={(row) => row.hostel_id || row.hostel_name || Math.random().toString()}
                  pageSize={10}
                />
              )}
            </div>
          )}

          {!loading && !errorMessage && activeReportSuite === 'ATTENDANCE' && (
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '4px' }}>
                Daily Curfew & Attendance Distribution
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Student presence, absences, and curfew compliance metrics from attendance roll call.
              </p>
              <div className="grid-4" style={{ marginBottom: '20px' }}>
                <div className="card" style={{ textAlign: 'center', padding: '16px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>PRESENT</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--success-color, #16a34a)', marginTop: '4px' }}>
                    {attendanceStats?.present_count ?? attendanceStats?.present ?? 0}
                  </div>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '16px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>ABSENT</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--danger-color, #dc2626)', marginTop: '4px' }}>
                    {attendanceStats?.absent_count ?? attendanceStats?.absent ?? 0}
                  </div>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '16px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>LATE CURFEW</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--warning-color, #f59e0b)', marginTop: '4px' }}>
                    {attendanceStats?.late_count ?? attendanceStats?.late ?? 0}
                  </div>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '16px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>ON APPROVED LEAVE</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#2563eb', marginTop: '4px' }}>
                    {attendanceStats?.leave_count ?? attendanceStats?.on_leave ?? 0}
                  </div>
                </div>
              </div>
            </div>
          )}

          {!loading && !errorMessage && activeReportSuite === 'LEAVES' && (
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '4px' }}>
                Resident Leave Applications & Movement
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Breakdown of student leave requests across review and authorization stages.
              </p>
              <div className="grid-4" style={{ marginBottom: '20px' }}>
                <div className="card" style={{ textAlign: 'center', padding: '16px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>PENDING REVIEW</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--warning-color, #f59e0b)', marginTop: '4px' }}>
                    {leaveStats?.pending ?? 0}
                  </div>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '16px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>APPROVED</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--success-color, #16a34a)', marginTop: '4px' }}>
                    {leaveStats?.approved ?? 0}
                  </div>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '16px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>REJECTED</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--danger-color, #dc2626)', marginTop: '4px' }}>
                    {leaveStats?.rejected ?? 0}
                  </div>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '16px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>CANCELLED</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-muted)', marginTop: '4px' }}>
                    {leaveStats?.cancelled ?? 0}
                  </div>
                </div>
              </div>
            </div>
          )}

          {!loading && !errorMessage && activeReportSuite === 'COMPLAINTS' && (
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '4px' }}>
                Complaints & Maintenance Resolution SLA
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Resolution progress for resident student grievances and physical maintenance work orders.
              </p>
              <div className="grid-4" style={{ marginBottom: '20px' }}>
                <div className="card" style={{ textAlign: 'center', padding: '16px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>OPEN GRIEVANCES</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--danger-color, #dc2626)', marginTop: '4px' }}>
                    {(complaintStats?.open ?? 0) + (maintenanceStats?.open ?? 0)}
                  </div>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '16px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>IN PROGRESS</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--warning-color, #f59e0b)', marginTop: '4px' }}>
                    {(complaintStats?.in_progress ?? 0) + (maintenanceStats?.in_progress ?? 0)}
                  </div>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '16px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>RESOLVED</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--success-color, #16a34a)', marginTop: '4px' }}>
                    {(complaintStats?.resolved ?? 0) + (maintenanceStats?.resolved ?? 0)}
                  </div>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '16px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>CLOSED</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#2563eb', marginTop: '4px' }}>
                    {(complaintStats?.closed ?? 0) + (maintenanceStats?.closed ?? 0)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {!loading && !errorMessage && activeReportSuite === 'ALLOCATIONS' && (
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '4px' }}>
                Bed Allocation & Vacating Velocity
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Total cumulative allocations and vacated check-out transitions recorded by the system.
              </p>
              <div className="grid-2" style={{ maxWidth: '600px' }}>
                <div className="card" style={{ textAlign: 'center', padding: '16px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>CUMULATIVE ALLOCATED</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary-color)', marginTop: '4px' }}>
                    {allocationStats?.total_allocated ?? 0}
                  </div>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '16px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>RELEASED / VACATED</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-secondary)', marginTop: '4px' }}>
                    {allocationStats?.total_released ?? 0}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
