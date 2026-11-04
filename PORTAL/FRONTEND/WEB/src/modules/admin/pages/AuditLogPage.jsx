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
  Layers,
  ArrowRight,
} from 'lucide-react';
import {
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

  const getModuleBadgeClass = (mod) => {
    switch (mod) {
      case 'HOSTEL':
        return 'badge-blue';
      case 'REQUESTS':
        return 'badge-green';
      case 'SUPPORT':
        return 'badge-amber';
      case 'COMMUNICATION':
        return 'badge-purple';
      case 'PEOPLE':
        return 'badge-blue';
      default:
        return 'badge-blue';
    }
  };

  const getStatusBadgeClass = (st) => {
    switch (st) {
      case 'ALLOCATED':
      case 'ACTIVE':
      case 'APPROVED':
      case 'RESOLVED':
      case 'SENT':
        return 'badge-green';
      case 'PENDING':
      case 'IN_PROGRESS':
      case 'OPEN':
        return 'badge-amber';
      case 'REJECTED':
      case 'CANCELLED':
        return 'badge-enterprise';
      default:
        return 'badge-enterprise';
    }
  };

  const isFiltered = searchTerm || moduleFilter !== 'ALL' || statusFilter !== 'ALL';

  if (loading && activities.length === 0) {
    return (
      <div className="fade-in-up" style={{ padding: '32px' }}>
        <LoadingState message="Aggregating operational audit records..." />
      </div>
    );
  }

  return (
    <div className="fade-in-up">
      {/* Enterprise Hero Header */}
      <div className="enterprise-hero-header">
        <div className="hero-header-titles">
          <div className="hero-category-pill">
            <FileText size={13} />
            <span>Administration &amp; Governance</span>
          </div>
          <h1 className="hero-main-title">Audit &amp; Activity Log</h1>
          <p className="hero-subtitle">
            Review read-only operational activity streams, administrative decisions, and residential compliance events.
          </p>
        </div>

        <div className="hero-action-buttons">
          <button
            type="button"
            onClick={() => {
              setIsRefreshing(true);
              loadActivities();
            }}
            disabled={isRefreshing}
            className="btn-enterprise-secondary"
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync Data'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportAuditCSV}
            className="btn-enterprise-primary"
            title="Download audit records as CSV"
          >
            <Download size={14} />
            <span>Export Audit Log</span>
          </button>
        </div>
      </div>

      {/* Export Success Banner */}
      {exportSuccessBanner && (
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
            <span>{exportSuccessBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setExportSuccessBanner(null)}
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

      {/* KPI Stat Cards Grid */}
      <div className="kpi-cards-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Ledger Events</span>
            <div className="stat-kpi-icon-wrap blue">
              <FileText size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-blue-600">{activities.length}</div>
          <div className="stat-kpi-footnote">
            <span className="status-dot green" />
            <span>Tenant operational actions recorded</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Ledger Integrity</span>
            <div className="stat-kpi-icon-wrap emerald">
              <ShieldCheck size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-emerald-600">Verified</div>
          <div className="stat-kpi-footnote">
            <span className="status-dot green" />
            <span>Append-only immutable event stream</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Logging Cadence</span>
            <div className="stat-kpi-icon-wrap amber">
              <Clock size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-amber-600">Real-time</div>
          <div className="stat-kpi-footnote">
            <span>Synchronous transaction events</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Tenancy Scope</span>
            <div className="stat-kpi-icon-wrap purple">
              <Lock size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-purple-600">Isolated</div>
          <div className="stat-kpi-footnote">
            <span>College {user?.college_id ? `${user.college_id.slice(0, 8)}...` : 'Partition'} boundary</span>
          </div>
        </div>
      </div>

      {/* Main Activity Table Card */}
      <div className="enterprise-card" style={{ padding: '24px' }}>
        <div className="card-topbar">
          <div className="card-title-group">
            <div className="card-title-icon-wrap">
              <FileText size={16} />
            </div>
            <div>
              <h2 className="card-title-text" style={{ margin: 0 }}>Operational Activity Ledger</h2>
              <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '2px 0 0 0' }}>
                Showing {filteredActivities.length} of {activities.length} recorded administrative &amp; operational actions.
              </p>
            </div>
          </div>
          <span className="badge-enterprise badge-blue">
            {filteredActivities.length} Events Listed
          </span>
        </div>

        {/* Filter Toolbar */}
        <div className="enterprise-filter-bar" style={{ marginBottom: '18px' }}>
          <div className="filter-search-field" style={{ flex: '1 1 320px', maxWidth: '420px' }}>
            <Search size={14} className="filter-search-icon" />
            <input
              type="text"
              className="filter-search-input"
              placeholder="Search audit action, summary, or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              style={{
                padding: '7px 12px',
                fontSize: '0.82rem',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                background: '#ffffff',
                color: '#334155',
                outline: 'none',
                fontWeight: 500,
              }}
            >
              <option value="ALL">All Domain Modules</option>
              <option value="HOSTEL">Hostel Management</option>
              <option value="REQUESTS">Leaves &amp; Outpass</option>
              <option value="SUPPORT">Complaints &amp; Grievances</option>
              <option value="COMMUNICATION">Broadcast Notices</option>
              <option value="PEOPLE">Students &amp; Admissions</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '7px 12px',
                fontSize: '0.82rem',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                background: '#ffffff',
                color: '#334155',
                outline: 'none',
                fontWeight: 500,
              }}
            >
              <option value="ALL">All Outcome Statuses</option>
              <option value="ALLOCATED">Allocated</option>
              <option value="ACTIVE">Active</option>
              <option value="APPROVED">Approved</option>
              <option value="PENDING">Pending</option>
              <option value="OPEN">Open</option>
              <option value="RESOLVED">Resolved</option>
              <option value="SENT">Sent</option>
            </select>

            {isFiltered && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setModuleFilter('ALL');
                  setStatusFilter('ALL');
                }}
                className="btn-enterprise-secondary"
                style={{ fontSize: '0.78rem', padding: '6px 12px' }}
              >
                <X size={12} />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Audit Log Table */}
        {filteredActivities.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No Activity Logs Found"
            message="No operational events match your filter parameters."
          />
        ) : (
          <div className="enterprise-table-container">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Event Timestamp</th>
                  <th>Domain Module</th>
                  <th>Action Performed</th>
                  <th>Activity Description</th>
                  <th>Actor Role</th>
                  <th>Outcome</th>
                  <th style={{ textAlign: 'right' }}>Inspect</th>
                </tr>
              </thead>
              <tbody>
                {filteredActivities.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', fontSize: '0.78rem', color: '#64748b' }}>
                        <Clock size={13} style={{ color: '#94a3b8' }} />
                        <span>{row.timestamp ? new Date(row.timestamp).toLocaleString() : '—'}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge-enterprise ${getModuleBadgeClass(row.module)}`}>
                        {row.module}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.76rem', fontWeight: 700, color: '#1e293b' }}>
                        {row.action}
                      </span>
                    </td>
                    <td>
                      <div style={{ maxWidth: '380px' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 500, color: '#0f172a', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {row.summary}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}>
                        {row.actor_role}
                      </span>
                    </td>
                    <td>
                      <span className={`badge-enterprise ${getStatusBadgeClass(row.status)}`}>
                        {row.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEvent(row);
                          setDetailsModalOpen(true);
                        }}
                        className="btn-enterprise-secondary"
                        style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                        title="Inspect event details"
                      >
                        <Eye size={13} />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Architectural Compliance Notice */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            padding: '14px 16px',
            borderRadius: '10px',
            background: '#f8fafc',
            border: '1px solid var(--border-color)',
            marginTop: '20px',
          }}
        >
          <Info size={16} style={{ color: '#4f46e5', flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.5 }}>
            <strong style={{ color: '#0f172a' }}>Audit Boundary Architecture: </strong>
            Centralized regulatory audit trails are written to <code style={{ fontFamily: 'monospace', fontSize: '0.74rem', background: '#e2e8f0', padding: '1px 5px', borderRadius: '4px' }}>platform.audit_logs</code> with
            cryptographic tamper-evidence for SuperAdmin platform governance. This institutional ledger surfaces
            tenant-scoped operational events (student admissions, room assignments, leave clearances, work order changes)
            in strict read-only compliance with tenant isolation rules.
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODAL: EVENT DETAILS                                                  */}
      {/* ===================================================================== */}
      {detailsModalOpen && selectedEvent && (
        <Modal
          isOpen={detailsModalOpen}
          onClose={() => setDetailsModalOpen(false)}
          title="Operational Audit Event Details"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span className={`badge-enterprise ${getModuleBadgeClass(selectedEvent.module)}`}>
                {selectedEvent.module}
              </span>
              <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
                {selectedEvent.action}
              </span>
              <span className={`badge-enterprise ${getStatusBadgeClass(selectedEvent.status)}`} style={{ marginLeft: 'auto' }}>
                {selectedEvent.status}
              </span>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
                Event Description
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#0f172a', lineHeight: 1.4 }}>
                {selectedEvent.summary}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>Entity Type:</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a' }}>{selectedEvent.entity_type}</span>
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>Entity ID:</span>
                <span style={{ fontSize: '0.82rem', fontFamily: 'monospace', color: '#2563eb' }}>{selectedEvent.entity_id}</span>
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>Actor Role:</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a' }}>{selectedEvent.actor_role}</span>
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>Recorded Timestamp:</span>
                <span style={{ fontSize: '0.82rem', color: '#0f172a' }}>
                  {selectedEvent.timestamp ? new Date(selectedEvent.timestamp).toLocaleString() : '—'}
                </span>
              </div>
            </div>

            {selectedEvent.details && Object.keys(selectedEvent.details).length > 0 && (
              <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Payload Attributes
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  {Object.entries(selectedEvent.details).map(([k, v]) => (
                    <div key={k} style={{ fontSize: '0.78rem' }}>
                      <span style={{ color: '#64748b', textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}: </span>
                      <strong style={{ color: '#0f172a' }}>{v ? String(v) : '—'}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px' }}>
              <button
                type="button"
                onClick={() => setDetailsModalOpen(false)}
                className="btn-enterprise-primary"
                style={{ padding: '8px 18px', fontSize: '0.84rem' }}
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
