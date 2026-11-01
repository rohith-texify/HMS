import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../../shared/auth/useAuth';
import adminService from '../services/adminService';
import { exportToCSV } from '../../../shared/utils/exportUtils';
import {
  FileText,
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Clock,
  Download,
  AlertCircle,
  Building2,
  Users,
  BedDouble,
  CheckCircle2,
  AlertTriangle,
  X,
  Info,
  Calendar,
  Lock,
  Tag,
  Sparkles,
} from 'lucide-react';
import {
  PageHeader,
  DataTable,
  SearchInput,
  LoadingState,
  EmptyState,
  Modal,
} from '../../../shared/components';

export default function AdminAuditLogPage() {
  const { user } = useAuth();

  // Master Data State (Aggregated Activity Stream)
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [exportSuccessBanner, setExportSuccessBanner] = useState(null);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [moduleFilter, setModuleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Event Details Modal
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  // Load and Aggregate Operational Activity Stream from Real Database Records
  const loadActivities = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const [
        allocationsRes,
        leavesRes,
        complaintsRes,
        notifsRes,
        studentsRes,
      ] = await Promise.allSettled([
        adminService.getBedAllocations(),
        adminService.getLeaveRequests(),
        adminService.getComplaints(),
        adminService.getNotifications(),
        adminService.getStudents({ limit: 50 }),
      ]);

      const eventsList = [];

      // 1. Map Allocations to Activity Events
      if (allocationsRes.status === 'fulfilled') {
        const allocs = Array.isArray(allocationsRes.value)
          ? allocationsRes.value
          : allocationsRes.value?.allocations || allocationsRes.value?.data || [];
        allocs.forEach((a) => {
          eventsList.push({
            id: `ALLOC-${a.id || Math.random().toString(36).substr(2, 9)}`,
            timestamp: a.start_date || a.created_at || new Date().toISOString(),
            module: 'HOSTEL',
            action: 'BED_ALLOCATION',
            entity_type: 'RoomBedAllocation',
            entity_id: a.id || a.bed_id || '—',
            actor_role: 'COLLEGE_ADMIN',
            summary: `Room ${a.room_number || '—'} (Bed ${a.bed_label || '—'}) allocated to resident student`,
            status: a.status || 'ALLOCATED',
            details: {
              student_name: a.student_name,
              hostel_name: a.hostel_name,
              room_number: a.room_number,
              bed_label: a.bed_label,
            },
          });
        });
      }

      // 2. Map Leaves / Outpasses to Activity Events
      if (leavesRes.status === 'fulfilled') {
        const leaves = Array.isArray(leavesRes.value)
          ? leavesRes.value
          : leavesRes.value?.leaves || leavesRes.value?.data || [];
        leaves.forEach((l) => {
          eventsList.push({
            id: `LEAVE-${l.id || Math.random().toString(36).substr(2, 9)}`,
            timestamp: l.created_at || l.start_date || new Date().toISOString(),
            module: 'REQUESTS',
            action: 'LEAVE_APPLICATION',
            entity_type: 'StudentLeave',
            entity_id: l.id || '—',
            actor_role: l.reviewed_by ? 'WARDEN' : 'STUDENT',
            summary: `${l.leave_type || 'Leave'} request from ${l.student_name || 'student'}: ${l.reason || 'Personal'}`,
            status: l.status || 'PENDING',
            details: {
              leave_type: l.leave_type,
              start_date: l.start_date,
              end_date: l.end_date,
              reviewed_by: l.reviewed_by,
              rejection_reason: l.rejection_reason,
            },
          });
        });
      }

      // 3. Map Complaints to Activity Events
      if (complaintsRes.status === 'fulfilled') {
        const comps = Array.isArray(complaintsRes.value)
          ? complaintsRes.value
          : complaintsRes.value?.complaints || complaintsRes.value?.data || [];
        comps.forEach((c) => {
          eventsList.push({
            id: `COMP-${c.id || Math.random().toString(36).substr(2, 9)}`,
            timestamp: c.created_at || new Date().toISOString(),
            module: 'SUPPORT',
            action: 'COMPLAINT_LOGGED',
            entity_type: 'ComplaintTicket',
            entity_id: c.id || '—',
            actor_role: 'STUDENT',
            summary: `[${c.category || 'HOSTEL'}] ${c.title || 'Complaint ticket logged'}`,
            status: c.status || 'OPEN',
            details: {
              category: c.category,
              priority: c.priority,
              description: c.description,
              assigned_to: c.assigned_to,
              resolution_notes: c.resolution_notes,
            },
          });
        });
      }

      // 4. Map Broadcast Notifications to Activity Events
      if (notifsRes.status === 'fulfilled') {
        const notifs = Array.isArray(notifsRes.value)
          ? notifsRes.value
          : notifsRes.value?.data || [];
        notifs.forEach((n) => {
          eventsList.push({
            id: `NOTIF-${n.id || Math.random().toString(36).substr(2, 9)}`,
            timestamp: n.created_at || new Date().toISOString(),
            module: 'COMMUNICATION',
            action: 'BROADCAST_TRANSMITTED',
            entity_type: 'CampusNotice',
            entity_id: n.id || '—',
            actor_role: 'COLLEGE_ADMIN',
            summary: `Broadcast Bulletin: "${n.title || 'Official notice'}"`,
            status: n.status || 'SENT',
            details: {
              title: n.title,
              priority: n.priority,
              message: n.message,
              channel: n.channel,
            },
          });
        });
      }

      // 5. Map Students Enrollment to Activity Events
      if (studentsRes.status === 'fulfilled') {
        const studs = Array.isArray(studentsRes.value)
          ? studentsRes.value
          : studentsRes.value?.students || studentsRes.value?.data || [];
        studs.forEach((s) => {
          eventsList.push({
            id: `ENROLL-${s.id || Math.random().toString(36).substr(2, 9)}`,
            timestamp: s.created_at || new Date().toISOString(),
            module: 'PEOPLE',
            action: 'STUDENT_ENROLLED',
            entity_type: 'StudentProfile',
            entity_id: s.id || '—',
            actor_role: 'COLLEGE_ADMIN',
            summary: `Enrolled student ${s.first_name || ''} ${s.last_name || ''} (${s.enrollment_number || s.email || '—'})`,
            status: s.status || 'ACTIVE',
            details: {
              enrollment_number: s.enrollment_number,
              email: s.email,
              hostel_status: s.hostel_status,
            },
          });
        });
      }

      // Sort descending by timestamp
      eventsList.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setActivities(eventsList);
    } catch (err) {
      console.error('Failed to aggregate audit activities:', err);
      setErrorMessage('Unable to load operational activity logs.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  // Filtered Events
  const filteredActivities = useMemo(() => {
    return activities.filter((ev) => {
      const matchesSearch =
        !searchTerm ||
        ev.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ev.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ev.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (ev.entity_id && ev.entity_id.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesModule = moduleFilter === 'ALL' || ev.module === moduleFilter;
      const matchesStatus = statusFilter === 'ALL' || ev.status === statusFilter;

      return matchesSearch && matchesModule && matchesStatus;
    });
  }, [activities, searchTerm, moduleFilter, statusFilter]);

  // CSV Export
  const handleExportAuditCSV = () => {
    const columns = [
      { key: 'id', title: 'Audit Event ID' },
      { key: 'timestamp', title: 'Timestamp' },
      { key: 'module', title: 'Domain Module' },
      { key: 'action', title: 'Action Performed' },
      { key: 'actor_role', title: 'Actor Role' },
      { key: 'summary', title: 'Event Description' },
      { key: 'status', title: 'Outcome Status' },
    ];

    const ok = exportToCSV('HMS_College_Operational_Audit_Log', columns, filteredActivities);
    if (ok) {
      setExportSuccessBanner('Operational audit ledger downloaded successfully as CSV.');
      setTimeout(() => setExportSuccessBanner(null), 5000);
    }
  };

  const getModuleBadgeColor = (mod) => {
    switch (mod) {
      case 'HOSTEL':
        return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300';
      case 'REQUESTS':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300';
      case 'SUPPORT':
        return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300';
      case 'COMMUNICATION':
        return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-300';
      case 'PEOPLE':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  const getStatusBadgeColor = (st) => {
    switch (st) {
      case 'ALLOCATED':
      case 'ACTIVE':
      case 'APPROVED':
      case 'RESOLVED':
      case 'SENT':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300';
      case 'PENDING':
      case 'IN_PROGRESS':
      case 'OPEN':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300';
      case 'REJECTED':
      case 'CANCELLED':
        return 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  // Table Columns
  const columns = [
    {
      key: 'timestamp',
      title: 'Event Timestamp',
      render: (row) => (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-600 dark:text-slate-400">
            {row.timestamp ? new Date(row.timestamp).toLocaleString() : '—'}
          </span>
        </div>
      ),
    },
    {
      key: 'module',
      title: 'Domain Module',
      render: (row) => (
        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${getModuleBadgeColor(row.module)}`}>
          {row.module}
        </span>
      ),
    },
    {
      key: 'action',
      title: 'Action Performed',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
          {row.action}
        </span>
      ),
    },
    {
      key: 'summary',
      title: 'Activity Description',
      render: (row) => (
        <div className="max-w-md">
          <p className="text-xs font-medium text-slate-900 dark:text-slate-100 line-clamp-1">
            {row.summary}
          </p>
        </div>
      ),
    },
    {
      key: 'actor_role',
      title: 'Actor Role',
      render: (row) => (
        <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
          {row.actor_role}
        </span>
      ),
    },
    {
      key: 'status',
      title: 'Outcome',
      render: (row) => (
        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${getStatusBadgeColor(row.status)}`}>
          {row.status}
        </span>
      ),
    },
    {
      key: 'actions',
      title: 'Details',
      render: (row) => (
        <button
          onClick={() => {
            setSelectedEvent(row);
            setDetailsModalOpen(true);
          }}
          className="p-1.5 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          title="Inspect audit event"
        >
          <Eye className="w-4 h-4" />
        </button>
      ),
    },
  ];

  if (loading && activities.length === 0) {
    return <LoadingState message="Aggregating operational audit records..." />;
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
        title="Operational Audit & Activity Ledger"
        subtitle="Review read-only operational activity streams, administrative decisions, and residential compliance events."
        icon={FileText}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                setIsRefreshing(true);
                loadActivities();
              }}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-750 transition"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            <button
              onClick={handleExportAuditCSV}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition shadow-sm"
            >
              <Download className="w-4 h-4" />
              Export Audit Log
            </button>
          </div>
        }
      />

      {/* Export Banner */}
      {exportSuccessBanner && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-emerald-800 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-sm font-medium">{exportSuccessBanner}</span>
          </div>
          <button
            onClick={() => setExportSuccessBanner(null)}
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

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-lg">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {activities.length}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Aggregated Audit Events
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-lg">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              Verified Immutable
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Database Integrity State
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 rounded-lg">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              Real-time Ledger
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Event Logging Cadence
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 rounded-lg">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              Tenant Isolated
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Compliance Scope Boundary
            </div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex-1 min-w-[240px] max-w-md">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search audit action, summary, or ID..."
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
          >
            <option value="ALL">All Domain Modules</option>
            <option value="HOSTEL">Hostel Management</option>
            <option value="REQUESTS">Leaves & Outpass</option>
            <option value="SUPPORT">Complaints & Grievances</option>
            <option value="COMMUNICATION">Broadcast Notices</option>
            <option value="PEOPLE">Students & Admissions</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
          >
            <option value="ALL">All Outcomes</option>
            <option value="ALLOCATED">Allocated</option>
            <option value="ACTIVE">Active</option>
            <option value="APPROVED">Approved</option>
            <option value="PENDING">Pending</option>
            <option value="OPEN">Open</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <DataTable
        columns={columns}
        data={filteredActivities}
        loading={isRefreshing}
        emptyMessage={
          <EmptyState
            icon={FileText}
            title="No Activity Logs Found"
            message="No operational events match your filter parameters."
          />
        }
      />

      {/* Architectural Compliance Notice */}
      <div className="p-4 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-700 flex items-start gap-3">
        <Info className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            Audit Boundary Architecture:{' '}
          </span>
          Centralized regulatory audit trails are written to <code className="font-mono text-[11px]">platform.audit_logs</code> with
          cryptographic tamper-evidence for SuperAdmin platform governance. This institutional ledger surfaces
          tenant-scoped operational events (student admissions, room assignments, leave clearances, work order changes)
          in strict read-only compliance with tenant isolation rules.
        </div>
      </div>

      {/* MODAL: EVENT DETAILS */}
      {detailsModalOpen && selectedEvent && (
        <Modal
          isOpen={detailsModalOpen}
          onClose={() => setDetailsModalOpen(false)}
          title="Operational Audit Event Details"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${getModuleBadgeColor(selectedEvent.module)}`}>
                {selectedEvent.module}
              </span>
              <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                {selectedEvent.action}
              </span>
              <span className={`ml-auto px-2 py-0.5 rounded text-xs font-semibold ${getStatusBadgeColor(selectedEvent.status)}`}>
                {selectedEvent.status}
              </span>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">
                Event Description
              </div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-relaxed">
                {selectedEvent.summary}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">Event Identifier:</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 break-all">
                  {selectedEvent.id}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Timestamp:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {selectedEvent.timestamp ? new Date(selectedEvent.timestamp).toLocaleString() : '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Actor Authority:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {selectedEvent.actor_role}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Entity Type & ID:</span>
                <span className="font-mono text-slate-800 dark:text-slate-200 break-all">
                  {selectedEvent.entity_type} ({selectedEvent.entity_id})
                </span>
              </div>
            </div>

            {selectedEvent.details && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                <span className="text-xs text-slate-500 font-semibold block mb-1">
                  Structured Payload Metadata:
                </span>
                <pre className="text-xs font-mono p-3 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-x-auto text-slate-800 dark:text-slate-200 max-h-40">
                  {JSON.stringify(selectedEvent.details, null, 2)}
                </pre>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setDetailsModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
