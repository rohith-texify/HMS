import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import inchargeService from '../services/inchargeService';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Badge from '../components/Badge';
import Button from '../components/Button';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import SearchInput from '../components/SearchInput';
import { exportToCSV } from '../utils/exportUtils';
import {
  History,
  ShieldCheck,
  ShieldAlert,
  Bell,
  MessageSquare,
  RefreshCw,
  Clock,
  Download,
  CheckCircle2
} from 'lucide-react';

export default function AuditLogPage() {
  // Navigation / View modes: NOTICES (Dispatched Notifications) vs ENTITY_UPDATES (Complaint Update Timelines)
  const [activeTab, setActiveTab] = useState('NOTICES');

  // Master Data States
  const [notifications, setNotifications] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [selectedComplaintId, setSelectedComplaintId] = useState('');
  const [complaintUpdates, setComplaintUpdates] = useState([]);
  const [loadingUpdates, setLoadingUpdates] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [exportBanner, setExportBanner] = useState(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  // Stale request guard
  const reqSeqRef = useRef(0);

  // Load Authoritative Notification Activity & Complaint Entities
  const loadActivityLogs = useCallback(async (isSilent = false) => {
    const seq = ++reqSeqRef.current;
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);
      setErrorMessage(null);

      const [notifsRes, complaintsRes] = await Promise.allSettled([
        inchargeService.getNotifications({ limit: 100 }),
        inchargeService.getComplaints({ limit: 50 }),
      ]);

      if (seq !== reqSeqRef.current) return;

      if (notifsRes.status === 'fulfilled') {
        const rawNotifs = Array.isArray(notifsRes.value)
          ? notifsRes.value
          : notifsRes.value?.notifications || notifsRes.value?.data || [];
        setNotifications(rawNotifs);
      }

      if (complaintsRes.status === 'fulfilled') {
        const rawComplaints = Array.isArray(complaintsRes.value)
          ? complaintsRes.value
          : complaintsRes.value?.complaints || complaintsRes.value?.data || [];
        setComplaints(rawComplaints);
        // Default select the first complaint for update trail if none selected
        if (!selectedComplaintId && rawComplaints.length > 0) {
          const firstId = rawComplaints[0].id || rawComplaints[0].complaint_id;
          setSelectedComplaintId(firstId);
          fetchComplaintTrail(firstId);
        }
      }
    } catch (err) {
      if (seq === reqSeqRef.current) {
        setErrorMessage(
          err.response?.data?.error?.message ||
          err.message ||
          'Failed to load operational activity records.'
        );
      }
    } finally {
      if (seq === reqSeqRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [selectedComplaintId]);

  // Fetch real entity updates trail for a selected complaint
  const fetchComplaintTrail = async (complaintId) => {
    if (!complaintId) return;
    try {
      setLoadingUpdates(true);
      const updates = await inchargeService.getComplaintUpdates(complaintId);
      const rawUpdates = Array.isArray(updates) ? updates : updates?.updates || updates?.data || [];
      setComplaintUpdates(rawUpdates);
    } catch (e) {
      console.warn('Failed to load complaint updates trail:', e.message);
      setComplaintUpdates([]);
    } finally {
      setLoadingUpdates(false);
    }
  };

  useEffect(() => {
    loadActivityLogs();
  }, [loadActivityLogs]);

  const handleSelectComplaint = (e) => {
    const cid = e.target.value;
    setSelectedComplaintId(cid);
    fetchComplaintTrail(cid);
  };

  // Filtered Notifications based on debounced search and attributes
  const filteredNotifications = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return notifications.filter((n) => {
      const nType = (n.type || 'GENERAL').toUpperCase();
      const nPrio = (n.priority || 'NORMAL').toUpperCase();

      if (typeFilter !== 'ALL' && nType !== typeFilter) return false;
      if (priorityFilter !== 'ALL' && nPrio !== priorityFilter) return false;

      if (!query) return true;
      const title = (n.title || '').toLowerCase();
      const msg = (n.message || '').toLowerCase();
      return title.includes(query) || msg.includes(query);
    });
  }, [notifications, searchTerm, typeFilter, priorityFilter]);

  // Export Active Activity Stream to CSV
  const handleExportActivity = () => {
    if (activeTab === 'NOTICES') {
      if (!filteredNotifications.length) return;
      const exportRows = filteredNotifications.map((n, idx) => ({
        'S.No': idx + 1,
        'Timestamp': n.created_at || '—',
        'Title': n.title || 'Notice',
        'Type': n.type || 'GENERAL',
        'Priority': n.priority || 'NORMAL',
        'Message Content': n.message || '—',
        'Read Status': n.is_read ? 'READ' : 'UNREAD',
      }));

      const dateStr = new Date().toISOString().split('T')[0];
      const success = exportToCSV(exportRows, `hostel_communication_audit_${dateStr}.csv`);
      if (success) {
        setExportBanner('Communication and notice activity trail exported to CSV.');
        setTimeout(() => setExportBanner(null), 4000);
      }
    } else {
      if (!complaintUpdates.length) return;
      const exportRows = complaintUpdates.map((u, idx) => ({
        'S.No': idx + 1,
        'Timestamp': u.created_at || '—',
        'Updated Status': u.status || '—',
        'Update Notes': u.comment || u.message || u.notes || '—',
        'Updated By': u.updated_by_name || u.updated_by || 'Staff',
      }));

      const dateStr = new Date().toISOString().split('T')[0];
      const success = exportToCSV(exportRows, `complaint_resolution_audit_${dateStr}.csv`);
      if (success) {
        setExportBanner('Complaint resolution audit timeline exported to CSV.');
        setTimeout(() => setExportBanner(null), 4000);
      }
    }
  };

  // Notification Table Columns
  const notificationColumns = [
    {
      key: 'created_at',
      title: 'Timestamp',
      render: (val) => (
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          {val ? new Date(val).toLocaleString() : '—'}
        </span>
      ),
    },
    {
      key: 'type',
      title: 'Type',
      render: (val) => {
        const t = (val || 'GENERAL').toUpperCase();
        const variant =
          t === 'URGENT' || t === 'SYSTEM' ? 'danger' : t === 'ANNOUNCEMENT' ? 'primary' : 'neutral';
        return <Badge variant={variant}>{t}</Badge>;
      },
    },
    {
      key: 'priority',
      title: 'Priority',
      render: (val) => {
        const p = (val || 'NORMAL').toUpperCase();
        const variant = p === 'URGENT' || p === 'HIGH' ? 'warning' : 'neutral';
        return <Badge variant={variant}>{p}</Badge>;
      },
    },
    {
      key: 'content',
      title: 'Subject & Particulars',
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.title || 'Notice'}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {row.message || '—'}
          </div>
        </div>
      ),
    },
    {
      key: 'read_state',
      title: 'Read State',
      align: 'right',
      render: (_, row) => (
        <Badge variant={row.is_read ? 'success' : 'warning'}>
          {row.is_read ? 'READ' : 'UNREAD'}
        </Badge>
      ),
    },
  ];

  const selectedComplaint = useMemo(() => {
    return complaints.find((c) => (c.id || c.complaint_id) === selectedComplaintId);
  }, [complaints, selectedComplaintId]);

  return (
    <div>
      <PageHeader
        title="Hostel Governance & Activity Trail"
        description="Operational activity records, communication audit trail, and verified grievance resolution timelines."
        icon={History}
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Activity Trail' },
        ]}
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              variant="secondary"
              icon={RefreshCw}
              loading={refreshing}
              onClick={() => loadActivityLogs(true)}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              icon={Download}
              disabled={loading}
              onClick={handleExportActivity}
            >
              Export CSV
            </Button>
          </div>
        }
      />

      {/* Architectural Audit Boundary Notice */}
      <div
        className="card"
        style={{
          borderLeft: '4px solid var(--primary-color, #2563eb)',
          backgroundColor: 'rgba(37, 99, 235, 0.04)',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <ShieldAlert size={22} color="var(--primary-color, #2563eb)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
              Central Platform Audit Trail vs Tenant Scope Integration Boundary
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
              The HMS system maintains an immutable, cryptographically chained audit log in <code>platform.audit_logs</code>,
              accessible exclusively to Super Administrators via <code>/platform/reports/activity</code>. A dedicated college-level
              audit query API (such as <code>GET /college/audit-logs</code>) is not implemented in the current backend.
              To preserve architectural integrity and avoid fabricating simulated audit entries, this workspace presents
              verified chronological event trails from authorized endpoints: the Institutional Notice Log
              (<code>/college/notifications</code>) and Grievance Resolution Audit Timelines (<code>/college/complaints/:id/updates</code>).
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
      <div className="grid-3" style={{ marginBottom: '20px' }}>
        <div className="card stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'rgba(37, 99, 235, 0.1)', color: '#2563eb' }}>
            <Bell size={22} />
          </div>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {notifications.length}
            </div>
            <div className="stat-label">Communication Events</div>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'rgba(234, 88, 12, 0.1)', color: '#ea580c' }}>
            <MessageSquare size={22} />
          </div>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {complaints.length}
            </div>
            <div className="stat-label">Grievance Audit Entities</div>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'rgba(22, 163, 74, 0.1)', color: '#16a34a' }}>
            <ShieldCheck size={22} />
          </div>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              RFC 900
            </div>
            <div className="stat-label">Platform Audit Compliance</div>
          </div>
        </div>
      </div>

      {/* Workspace Tabs */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-subtle, rgba(0,0,0,0.02))',
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
              color: activeTab === 'NOTICES' ? 'var(--primary-color)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'NOTICES' ? '2px solid var(--primary-color)' : '2px solid transparent',
            }}
            onClick={() => setActiveTab('NOTICES')}
          >
            Communication & Notice Log
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
              color: activeTab === 'ENTITY_UPDATES' ? 'var(--primary-color)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'ENTITY_UPDATES' ? '2px solid var(--primary-color)' : '2px solid transparent',
            }}
            onClick={() => setActiveTab('ENTITY_UPDATES')}
          >
            Grievance Resolution Audit Inspector
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          {loading && <LoadingState title="Loading operational activity trail..." rows={5} />}
          {errorMessage && (
            <ErrorState
              title="Activity Load Error"
              message={errorMessage}
              onRetry={() => loadActivityLogs()}
            />
          )}

          {!loading && !errorMessage && activeTab === 'NOTICES' && (
            <div>
              {/* Toolbar */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '12px',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                }}
              >
                <div style={{ flex: '1 1 280px', maxWidth: '360px' }}>
                  <SearchInput
                    value={searchTerm}
                    onChange={setSearchTerm}
                    placeholder="Search by subject or content..."
                    aria-label="Filter communication log"
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <select
                    className="form-control"
                    style={{ width: 'auto', padding: '6px 12px' }}
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    aria-label="Filter by notice type"
                  >
                    <option value="ALL">All Types</option>
                    <option value="ANNOUNCEMENT">Announcement</option>
                    <option value="SYSTEM">System</option>
                    <option value="GENERAL">General</option>
                    <option value="LEAVE">Leave</option>
                    <option value="COMPLAINT">Complaint</option>
                  </select>

                  <select
                    className="form-control"
                    style={{ width: 'auto', padding: '6px 12px' }}
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    aria-label="Filter by priority"
                  >
                    <option value="ALL">All Priorities</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              {filteredNotifications.length === 0 ? (
                <EmptyState
                  icon={Bell}
                  title="No Communication Activity Found"
                  message={
                    searchTerm || typeFilter !== 'ALL' || priorityFilter !== 'ALL'
                      ? 'No notices match the active search or filter criteria.'
                      : 'No communication records exist in the current feed.'
                  }
                />
              ) : (
                <DataTable
                  columns={notificationColumns}
                  data={filteredNotifications}
                  keyField={(row) => row.id || row.notification_id || Math.random().toString()}
                  pageSize={15}
                />
              )}
            </div>
          )}

          {!loading && !errorMessage && activeTab === 'ENTITY_UPDATES' && (
            <div>
              <div style={{ marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Select Grievance Entity to Inspect:
                </span>
                <select
                  className="form-control"
                  style={{ minWidth: '320px', maxWidth: '500px', padding: '6px 12px' }}
                  value={selectedComplaintId}
                  onChange={handleSelectComplaint}
                  aria-label="Select grievance entity"
                >
                  {complaints.length === 0 && <option value="">No Grievance Entities Available</option>}
                  {complaints.map((c) => {
                    const cid = c.id || c.complaint_id;
                    return (
                      <option key={cid} value={cid}>
                        {c.title || c.category || 'Grievance'} — [{c.status || 'PENDING'}] ({cid.slice(0, 8)}...)
                      </option>
                    );
                  })}
                </select>
              </div>

              {selectedComplaint && (
                <div
                  style={{
                    padding: '12px 16px',
                    backgroundColor: 'var(--bg-subtle, rgba(0,0,0,0.02))',
                    borderRadius: '8px',
                    marginBottom: '20px',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                        Entity Title & Category
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', marginTop: '2px' }}>
                        {selectedComplaint.title || 'Institutional Grievance'} ({selectedComplaint.category || 'GENERAL'})
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Reported on: {selectedComplaint.created_at ? new Date(selectedComplaint.created_at).toLocaleString() : '—'}
                      </div>
                    </div>
                    <div>
                      <Badge variant={(selectedComplaint.status || 'PENDING').toUpperCase() === 'RESOLVED' ? 'success' : 'warning'}>
                        {(selectedComplaint.status || 'PENDING').toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                </div>
              )}

              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary)' }}>
                Authoritative Resolution Audit History (from <code>/college/complaints/:id/updates</code>)
              </h4>

              {loadingUpdates && <LoadingState title="Loading entity audit timeline..." rows={3} />}

              {!loadingUpdates && complaintUpdates.length === 0 && (
                <EmptyState
                  icon={History}
                  title="No Transition Updates Recorded"
                  message="This entity has no recorded resolution updates or status transitions in the backend database."
                />
              )}

              {!loadingUpdates && complaintUpdates.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {complaintUpdates.map((u, idx) => (
                    <div
                      key={u.id || idx}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        padding: '12px 16px',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        backgroundColor: 'var(--card-bg, #fff)',
                      }}
                    >
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          backgroundColor: 'rgba(37, 99, 235, 0.1)',
                          color: 'var(--primary-color, #2563eb)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          marginTop: '2px',
                        }}
                      >
                        <Clock size={16} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                            Status Transition: <Badge variant="primary">{u.status || 'UPDATE'}</Badge>
                          </span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            {u.created_at ? new Date(u.created_at).toLocaleString() : '—'}
                          </span>
                        </div>
                        <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          {u.comment || u.message || u.notes || 'Status updated by authorized staff member.'}
                        </p>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Audited Actor: {u.updated_by_name || u.updated_by || 'Staff / Incharge'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
