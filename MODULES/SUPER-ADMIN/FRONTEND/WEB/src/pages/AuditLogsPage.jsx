import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  ShieldCheck,
  Download,
  RotateCw,
  Search,
  X,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Eye,
  Link2,
  Layers,
  ExternalLink,
  Clock,
  Tag,
  User,
  Building2,
  Check,
  XCircle,
  PlusCircle,
  MinusCircle,
  ArrowRight,
  Filter,
  ShieldAlert,
  Sparkles,
  Key,
} from 'lucide-react';
import {
  fetchAuditLogs,
  fetchAuditLogDetail,
  verifyAuditIntegrity,
  requestAuditExport,
  fetchAuditExportRequests,
  processAuditExportDecision,
} from '../services/auditService';
import { fetchCollegesList } from '../services/collegeService';

/**
 * Animated number count-up effect
 */
function CountUpNumber({ value, duration = 350 }) {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (typeof value !== 'number') {
      setDisplayValue(value);
      return;
    }

    const start = prevValueRef.current || 0;
    const end = value;
    const range = end - start;
    if (range === 0) {
      setDisplayValue(end);
      return;
    }

    const startTime = performance.now();
    let frameId;

    const updateCount = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + range * easeProgress);

      setDisplayValue(current);

      if (progress < 1) {
        frameId = requestAnimationFrame(updateCount);
      } else {
        prevValueRef.current = end;
      }
    };

    frameId = requestAnimationFrame(updateCount);
    return () => cancelAnimationFrame(frameId);
  }, [value, duration]);

  return <span>{displayValue}</span>;
}

export default function AuditLogsPage() {
  // Navigation tabs: 'events' | 'integrity' | 'exports'
  const [activeTab, setActiveTab] = useState('events');

  // Records & Pagination
  const [records, setRecords] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const pageSize = 25;

  // Colleges list for filtering
  const [colleges, setColleges] = useState([]);

  // Search & Filter state
  const [filters, setFilters] = useState({
    query: '',
    college_id: '',
    module: '',
    action: '',
    severity: '',
    result_status: '',
    ticket_reference: '',
    start_date: '',
    end_date: '',
  });

  // Event Detail Drawer / Modal
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Integrity Check State
  const [integrityReport, setIntegrityReport] = useState(null);
  const [integrityLoading, setIntegrityLoading] = useState(false);

  // Export Request State
  const [exportRequests, setExportRequests] = useState([]);
  const [exportLoading, setExportLoading] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportReason, setExportReason] = useState('');
  const [exportTicketRef, setExportTicketRef] = useState('');
  const [exportSubmitting, setExportSubmitting] = useState(false);

  // Export Decision Modal State (Replaces window.prompt)
  const [decisionModal, setDecisionModal] = useState({
    isOpen: false,
    requestId: '',
    decision: 'APPROVED',
    reason: 'Authorized audit compliance review',
    submitting: false,
    error: null,
  });

  // Feedback Notification
  const [feedback, setFeedback] = useState(null);

  // Load Colleges for dropdown
  useEffect(() => {
    async function loadColleges() {
      try {
        const res = await fetchCollegesList({ limit: 100 });
        setColleges(res.colleges || []);
      } catch (err) {
        console.error('Failed to load colleges for filter:', err);
      }
    }
    loadColleges();
  }, []);

  // Fetch Audit Logs
  const loadAuditLogs = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      setIsRefreshing(true);
      setError(null);

      const params = {
        limit: pageSize,
        offset: page * pageSize,
      };

      if (filters.query.trim()) params.query = filters.query.trim();
      if (filters.college_id) params.college_id = filters.college_id;
      if (filters.module) params.module = filters.module;
      if (filters.action) params.action = filters.action;
      if (filters.severity) params.severity = filters.severity;
      if (filters.result_status) params.result_status = filters.result_status;
      if (filters.ticket_reference.trim()) params.ticket_reference = filters.ticket_reference.trim();
      if (filters.start_date) params.start_date = new Date(filters.start_date).toISOString();
      if (filters.end_date) params.end_date = new Date(filters.end_date).toISOString();

      const res = await fetchAuditLogs(params);
      setRecords(res.records || []);
      setTotalRecords(res.total || 0);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to retrieve audit events');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [filters, page]);

  useEffect(() => {
    if (activeTab === 'events') {
      loadAuditLogs();
    }
  }, [activeTab, loadAuditLogs]);

  // Load Integrity Verification
  const runIntegrityVerification = async () => {
    try {
      setIntegrityLoading(true);
      const res = await verifyAuditIntegrity(200);
      setIntegrityReport(res.integrity_report);
      setFeedback({
        type: res.integrity_report?.is_integrity_intact ? 'success' : 'error',
        text: res.integrity_report?.is_integrity_intact
          ? `Verified ${res.integrity_report.total_checked} records. Cryptographic hash chain is intact!`
          : `Tampering detected in audit records!`,
      });
      setTimeout(() => setFeedback(null), 6000);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: 'Integrity check failed: ' + (err.response?.data?.error?.message || err.message),
      });
    } finally {
      setIntegrityLoading(false);
    }
  };

  // Load Export Requests
  const loadExportRequests = useCallback(async () => {
    try {
      setExportLoading(true);
      const res = await fetchAuditExportRequests();
      setExportRequests(res.export_requests || []);
    } catch (err) {
      console.error('Failed to load export requests:', err);
    } finally {
      setExportLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'exports') {
      loadExportRequests();
    }
  }, [activeTab, loadExportRequests]);

  // View Event Detail
  const handleViewDetail = async (id) => {
    try {
      setDetailLoading(true);
      const res = await fetchAuditLogDetail(id);
      setSelectedEvent(res.record);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: 'Failed to load audit detail: ' + (err.response?.data?.error?.message || err.message),
      });
    } finally {
      setDetailLoading(false);
    }
  };

  // Submit Export Request
  const handleSubmitExport = async (e) => {
    e.preventDefault();
    if (!exportReason.trim() || exportReason.trim().length < 5) {
      setFeedback({
        type: 'error',
        text: 'A valid business justification is mandatory (minimum 5 characters).',
      });
      return;
    }
    try {
      setExportSubmitting(true);
      await requestAuditExport({
        filters: {
          ...filters,
          ticket_reference: exportTicketRef.trim() || undefined,
        },
        reason: exportReason.trim(),
      });
      setShowExportModal(false);
      setExportReason('');
      setExportTicketRef('');
      setFeedback({
        type: 'success',
        text: 'Bulk audit export request created. Awaiting peer Super Admin authorization.',
      });
      setTimeout(() => setFeedback(null), 6000);
      if (activeTab === 'exports') await loadExportRequests();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.error?.message || err.message || 'Failed to submit export request',
      });
    } finally {
      setExportSubmitting(false);
    }
  };

  // Process Export Decision (Replaces window.prompt)
  const handleConfirmDecision = async (e) => {
    e.preventDefault();
    if (!decisionModal.reason.trim()) {
      setDecisionModal((p) => ({ ...p, error: 'A valid decision justification is required.' }));
      return;
    }

    setDecisionModal((p) => ({ ...p, submitting: true, error: null }));
    try {
      await processAuditExportDecision(decisionModal.requestId, {
        decision: decisionModal.decision,
        reason: decisionModal.reason.trim(),
      });
      setFeedback({
        type: 'success',
        text: `Audit export request ${decisionModal.decision.toLowerCase()} successfully.`,
      });
      setTimeout(() => setFeedback(null), 6000);
      setDecisionModal({ isOpen: false, requestId: '', decision: 'APPROVED', reason: '', submitting: false, error: null });
      await loadExportRequests();
    } catch (err) {
      setDecisionModal((p) => ({
        ...p,
        submitting: false,
        error: err.response?.data?.error?.message || err.message || 'Failed to process decision',
      }));
    }
  };

  // KPI Statistics
  const stats = useMemo(() => {
    const total = totalRecords;
    let criticalOrWarning = 0;
    records.forEach((r) => {
      const sev = (r.severity || '').toUpperCase();
      if (sev === 'CRITICAL' || sev === 'ERROR' || sev === 'WARNING') {
        criticalOrWarning++;
      }
    });

    const pendingExports = exportRequests.filter((e) => e.status === 'PENDING').length;
    return { total, criticalOrWarning, pendingExports };
  }, [totalRecords, records, exportRequests]);

  // Active Filter Count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.query.trim()) count++;
    if (filters.college_id) count++;
    if (filters.severity) count++;
    if (filters.result_status) count++;
    if (filters.ticket_reference.trim()) count++;
    return count;
  }, [filters]);

  const handleResetFilters = () => {
    setFilters({
      query: '',
      college_id: '',
      module: '',
      action: '',
      severity: '',
      result_status: '',
      ticket_reference: '',
      start_date: '',
      end_date: '',
    });
    setPage(0);
  };

  return (
    <div className="audit-page-container">
      {/* Breadcrumbs & Header Section */}
      <div className="audit-header-section">
        <div className="audit-header-left">
          <div className="breadcrumb-trail" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#64748B', marginBottom: '6px' }}>
            <Link to="/dashboard" style={{ color: '#64748B', textDecoration: 'none' }}>Dashboard</Link>
            <ChevronRight size={14} />
            <span style={{ color: '#0F172A', fontWeight: 600 }}>Audit Logs</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h1 className="page-title" style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
              Platform Audit &amp; Activity Log
            </h1>
            <span className="audit-severity-pill info">
              <ShieldCheck size={11} />
              <span>SHA-256 HASH CHAINED</span>
            </span>
          </div>
          <p className="page-subtitle" style={{ fontSize: '0.86rem', color: '#64748B', margin: '4px 0 0 0' }}>
            Immutable record of company-platform actions, security events, before/after diffs, and tamper-evident hash chaining.
          </p>
        </div>

        {/* Header Actions */}
        <div className="audit-header-right">
          <button
            type="button"
            className="btn-enterprise btn-outline-soft"
            onClick={() => {
              setActiveTab('integrity');
              runIntegrityVerification();
            }}
          >
            <ShieldCheck size={14} style={{ color: '#2563EB' }} />
            <span>Verify Tamper Evidence</span>
          </button>

          <button
            type="button"
            className="btn-enterprise btn-primary"
            onClick={() => setShowExportModal(true)}
          >
            <Download size={14} />
            <span>Request Bulk Export</span>
          </button>

          <button
            type="button"
            className={`btn-enterprise btn-outline-soft ${isRefreshing ? 'is-loading' : ''}`}
            onClick={() => {
              if (activeTab === 'events') loadAuditLogs(false);
              else if (activeTab === 'integrity') runIntegrityVerification();
              else if (activeTab === 'exports') loadExportRequests();
            }}
            disabled={isRefreshing}
          >
            <RotateCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Top 4 KPI Metric Cards */}
      <div className="audit-kpi-grid">
        {/* Card 1: Total Audit Records */}
        <div className="audit-stat-card card-stagger-1">
          <div className="audit-stat-header">
            <span className="audit-stat-label">Total Transactions</span>
            <div className="audit-stat-icon-wrap blue">
              <FileText size={18} />
            </div>
          </div>
          <div className="audit-stat-value text-slate-900">
            <CountUpNumber value={stats.total} />
          </div>
          <div className="audit-stat-subtext">Immutable audit trail entries</div>
          <div className="audit-stat-accent-bar blue" />
        </div>

        {/* Card 2: Security & Warning Alerts */}
        <div className="audit-stat-card card-stagger-2">
          <div className="audit-stat-header">
            <span className="audit-stat-label">Critical / Warnings</span>
            <div className="audit-stat-icon-wrap amber">
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="audit-stat-value text-amber-600">
            <CountUpNumber value={stats.criticalOrWarning} />
          </div>
          <div className="audit-stat-subtext">Elevated severity operations</div>
          <div className="audit-stat-accent-bar amber" />
        </div>

        {/* Card 3: Cryptographic Integrity */}
        <div className="audit-stat-card card-stagger-3">
          <div className="audit-stat-header">
            <span className="audit-stat-label">Hash Integrity</span>
            <div className="audit-stat-icon-wrap green">
              <ShieldCheck size={18} />
            </div>
          </div>
          <div className="audit-stat-value text-emerald-600" style={{ fontSize: '1.25rem', paddingTop: '6px' }}>
            {integrityReport?.is_integrity_intact === false ? 'COMPROMISED' : 'TAMPER-FREE'}
          </div>
          <div className="audit-stat-subtext">Sequential cryptographic chain</div>
          <div className="audit-stat-accent-bar green" />
        </div>

        {/* Card 4: Governance Exports */}
        <div className="audit-stat-card card-stagger-4">
          <div className="audit-stat-header">
            <span className="audit-stat-label">Export Governance</span>
            <div className="audit-stat-icon-wrap purple">
              <Download size={18} />
            </div>
          </div>
          <div className="audit-stat-value text-purple-600">
            <CountUpNumber value={stats.pendingExports} />
          </div>
          <div className="audit-stat-subtext">Pending four-eyes reviews</div>
          <div className="audit-stat-accent-bar purple" />
        </div>
      </div>

      {/* Dismissible Feedback Banner */}
      {feedback && (
        <div className={`alert alert-${feedback.type}`} style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', animation: 'fadeIn 0.3s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <span>{feedback.text}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 'bold' }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Global Error Banner */}
      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
            <X size={15} />
          </button>
        </div>
      )}

      {/* Main Card Container */}
      <div className="audit-main-card">
        {/* Navigation Toolbar */}
        <div className="audit-toolbar">
          {/* Segmented Pill Tabs */}
          <div className="audit-tabs-pillbox">
            <button
              type="button"
              className={`audit-tab-pill ${activeTab === 'events' ? 'active' : ''}`}
              onClick={() => setActiveTab('events')}
            >
              <FileText size={14} />
              <span>Audit Events</span>
              <span className="pill-counter">{totalRecords}</span>
            </button>

            <button
              type="button"
              className={`audit-tab-pill ${activeTab === 'integrity' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('integrity');
                if (!integrityReport) runIntegrityVerification();
              }}
            >
              <Link2 size={14} />
              <span>Cryptographic Hash Chain</span>
            </button>

            <button
              type="button"
              className={`audit-tab-pill ${activeTab === 'exports' ? 'active' : ''}`}
              onClick={() => setActiveTab('exports')}
            >
              <Download size={14} />
              <span>Controlled Bulk Exports</span>
              <span className="pill-counter">{exportRequests.length || '•'}</span>
            </button>
          </div>

          {/* Search & Filter Toolbar (Events Tab) */}
          {activeTab === 'events' && (
            <div className="audit-filters-group">
              <div className="audit-search-box">
                <Search size={15} style={{ color: '#94A3B8' }} />
                <input
                  type="text"
                  placeholder="Search action, module, actor..."
                  value={filters.query}
                  onChange={(e) => setFilters((p) => ({ ...p, query: e.target.value }))}
                  className="audit-search-input"
                />
                {filters.query && (
                  <button
                    type="button"
                    onClick={() => setFilters((p) => ({ ...p, query: '' }))}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#94A3B8' }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* College Filter */}
              <select
                value={filters.college_id}
                onChange={(e) => {
                  setFilters((p) => ({ ...p, college_id: e.target.value }));
                  setPage(0);
                }}
                className="audit-select-dropdown"
              >
                <option value="">All Tenants / Platform</option>
                {colleges.map((c) => (
                  <option key={c.college_id} value={c.college_id}>
                    {c.name} ({c.college_code || c.code})
                  </option>
                ))}
              </select>

              {/* Severity Filter */}
              <select
                value={filters.severity}
                onChange={(e) => {
                  setFilters((p) => ({ ...p, severity: e.target.value }));
                  setPage(0);
                }}
                className="audit-select-dropdown"
              >
                <option value="">All Severities</option>
                <option value="CRITICAL">CRITICAL</option>
                <option value="ERROR">ERROR</option>
                <option value="WARNING">WARNING</option>
                <option value="INFO">INFO</option>
                <option value="DEBUG">DEBUG</option>
              </select>

              {/* Outcome Status Filter */}
              <select
                value={filters.result_status}
                onChange={(e) => {
                  setFilters((p) => ({ ...p, result_status: e.target.value }));
                  setPage(0);
                }}
                className="audit-select-dropdown"
              >
                <option value="">All Outcomes</option>
                <option value="SUCCESS">SUCCESS</option>
                <option value="FAILURE">FAILURE</option>
                <option value="DENIED">DENIED</option>
              </select>

              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="btn-enterprise btn-outline-soft"
                  style={{ fontSize: '0.78rem', padding: '6px 10px' }}
                >
                  Reset ({activeFiltersCount})
                </button>
              )}
            </div>
          )}
        </div>

        {/* TAB 1: AUDIT EVENTS LIST */}
        {activeTab === 'events' && (
          <div>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <div className="spinner" style={{ margin: '0 auto 14px' }}></div>
                <p style={{ color: '#64748B', fontSize: '0.88rem' }}>Loading platform audit events...</p>
              </div>
            ) : records.length === 0 ? (
              <div className="modules-empty-state">
                <FileText size={42} style={{ color: '#CBD5E1', marginBottom: '12px' }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1E293B', margin: '0 0 6px 0' }}>
                  No Audit Events Found
                </h3>
                <p style={{ fontSize: '0.82rem', color: '#64748B', maxWidth: '380px', margin: '0 0 16px 0' }}>
                  No records match your selected filter criteria.
                </p>
                {activeFiltersCount > 0 && (
                  <button
                    type="button"
                    className="btn-enterprise btn-primary"
                    onClick={handleResetFilters}
                  >
                    Clear All Filters
                  </button>
                )}
              </div>
            ) : (
              <div>
                <div className="modules-table-container">
                  <table className="modules-table">
                    <thead>
                      <tr>
                        <th style={{ width: '18%' }}>Timestamp (UTC)</th>
                        <th style={{ width: '22%' }}>Action & Module</th>
                        <th style={{ width: '18%' }}>Actor & Role</th>
                        <th style={{ width: '16%' }}>Tenant Scope</th>
                        <th style={{ width: '10%' }}>Severity</th>
                        <th style={{ width: '8%' }}>Outcome</th>
                        <th style={{ width: '8%', textAlign: 'right' }}>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((r) => {
                        const sev = (r.severity || 'INFO').toLowerCase();
                        const status = (r.result_status || 'SUCCESS').toLowerCase();

                        return (
                          <tr key={r.audit_id}>
                            <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem', color: '#475569' }}>
                              {new Date(r.created_at).toLocaleString()}
                            </td>
                            <td>
                              <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.86rem' }}>
                                {r.action}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                <code style={{ fontSize: '0.72rem', background: '#F1F5F9', color: '#475569', padding: '1px 5px', borderRadius: '4px' }}>
                                  {r.module}
                                </code>
                                {r.ticket_reference && (
                                  <span style={{ fontSize: '0.72rem', color: '#D97706', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 600 }}>
                                    <Tag size={10} />
                                    <span>{r.ticket_reference}</span>
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              <div style={{ fontWeight: 600, color: '#1E293B', fontSize: '0.82rem' }}>
                                {r.actor_email || 'System / Batch'}
                              </div>
                              <span className="badge badge-outline" style={{ fontSize: '0.68rem', marginTop: '2px' }}>
                                {r.actor_role || 'SUPER_ADMIN'}
                              </span>
                            </td>
                            <td>
                              <div style={{ fontSize: '0.82rem', color: r.college_name ? '#0F172A' : '#64748B', fontWeight: 500 }}>
                                {r.college_name ? `${r.college_name}` : 'Platform Global'}
                              </div>
                              {r.college_code && (
                                <code style={{ fontSize: '0.7rem', color: '#64748B' }}>
                                  Tenant #{r.college_code}
                                </code>
                              )}
                            </td>
                            <td>
                              <span className={`audit-severity-pill ${sev}`}>
                                {r.severity || 'INFO'}
                              </span>
                            </td>
                            <td>
                              <span className={`audit-status-pill ${status}`}>
                                {r.result_status === 'SUCCESS' ? (
                                  <Check size={11} />
                                ) : (
                                  <XCircle size={11} />
                                )}
                                <span>{r.result_status}</span>
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                className="btn-module-action"
                                onClick={() => handleViewDetail(r.audit_id)}
                                title="Inspect Before & After Diff and Cryptographic Hash"
                              >
                                <Eye size={12} />
                                <span>Diff</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '16px 4px 4px 4px',
                    fontSize: '0.82rem',
                    color: '#64748B',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <span>
                    Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalRecords)} of {totalRecords} records
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn-enterprise btn-outline-soft"
                      disabled={page === 0}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      style={{ fontSize: '0.78rem', padding: '5px 12px' }}
                    >
                      Previous
                    </button>
                    <span style={{ display: 'flex', alignItems: 'center', padding: '0 8px', fontWeight: 700, color: '#0F172A' }}>
                      Page {page + 1}
                    </span>
                    <button
                      type="button"
                      className="btn-enterprise btn-outline-soft"
                      disabled={(page + 1) * pageSize >= totalRecords}
                      onClick={() => setPage((p) => p + 1)}
                      style={{ fontSize: '0.78rem', padding: '5px 12px' }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: TAMPER-EVIDENT HASH CHAIN */}
        {activeTab === 'integrity' && (
          <div>
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <ShieldCheck size={22} style={{ color: '#2563EB' }} />
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#0F172A' }}>
                      Cryptographic Hash-Chain Verification
                    </h2>
                  </div>
                  <p style={{ margin: 0, color: '#64748B', fontSize: '0.86rem', maxWidth: '680px' }}>
                    Validates sequential SHA-256 hash chains across audit logs to mathematically prove records have not been altered, deleted, or backdated.
                  </p>
                </div>

                <button
                  type="button"
                  className="btn-enterprise btn-primary"
                  onClick={runIntegrityVerification}
                  disabled={integrityLoading}
                >
                  <RotateCw size={14} className={integrityLoading ? 'animate-spin' : ''} />
                  <span>{integrityLoading ? 'Verifying Hashes...' : 'Re-verify Hash Chain'}</span>
                </button>
              </div>

              {integrityReport && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                  <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Chain Status
                    </div>
                    <div
                      style={{
                        fontSize: '1.15rem',
                        fontWeight: 800,
                        marginTop: '6px',
                        color: integrityReport.is_integrity_intact ? '#10B981' : '#E11D48',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      {integrityReport.is_integrity_intact ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                      <span>{integrityReport.is_integrity_intact ? 'TAMPER-FREE' : 'COMPROMISED'}</span>
                    </div>
                  </div>

                  <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Records Scanned
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '6px', color: '#0F172A' }}>
                      {integrityReport.total_checked} blocks
                    </div>
                  </div>

                  <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Tampered Anomalies
                    </div>
                    <div
                      style={{
                        fontSize: '1.25rem',
                        fontWeight: 800,
                        marginTop: '6px',
                        color: integrityReport.tampered_records > 0 ? '#E11D48' : '#10B981',
                      }}
                    >
                      {integrityReport.tampered_records}
                    </div>
                  </div>

                  <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Verified At
                    </div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, marginTop: '6px', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={15} style={{ color: '#64748B' }} />
                      <span>{new Date(integrityReport.checked_at).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: CONTROLLED BULK EXPORTS */}
        {activeTab === 'exports' && (
          <div>
            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ color: '#64748B', fontSize: '0.84rem', margin: 0 }}>
                Enforces four-eyes approval workflow for bulk audit data extraction to protect company data governance standards.
              </p>
              <button
                type="button"
                className="btn-enterprise btn-primary"
                onClick={() => setShowExportModal(true)}
              >
                <Download size={14} />
                <span>New Export Request</span>
              </button>
            </div>

            {exportLoading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div className="spinner" style={{ margin: '0 auto 10px' }}></div>
                <p style={{ color: '#64748B', fontSize: '0.85rem' }}>Loading export requests...</p>
              </div>
            ) : exportRequests.length === 0 ? (
              <div className="modules-empty-state">
                <Download size={40} style={{ color: '#CBD5E1', marginBottom: '10px' }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1E293B', margin: '0 0 6px 0' }}>
                  No Export Requests Submitted
                </h3>
                <p style={{ fontSize: '0.82rem', color: '#64748B', maxWidth: '380px', margin: '0 0 16px 0' }}>
                  Bulk data downloads require an explicit business justification and peer Super Admin validation.
                </p>
                <button
                  type="button"
                  className="btn-enterprise btn-primary"
                  onClick={() => setShowExportModal(true)}
                >
                  Create Export Request
                </button>
              </div>
            ) : (
              <div className="modules-table-container">
                <table className="modules-table">
                  <thead>
                    <tr>
                      <th style={{ width: '18%' }}>Request ID</th>
                      <th style={{ width: '22%' }}>Requester</th>
                      <th style={{ width: '28%' }}>Business Justification</th>
                      <th style={{ width: '12%' }}>Status</th>
                      <th style={{ width: '20%', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exportRequests.map((req) => (
                      <tr key={req.request_id}>
                        <td>
                          <code style={{ fontSize: '0.78rem', color: '#2563EB', background: '#EFF6FF', padding: '2px 6px', borderRadius: '4px' }}>
                            {req.request_id.substring(0, 10)}...
                          </code>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#0F172A', fontSize: '0.82rem' }}>
                            {req.requester_email || req.requester_user_id}
                          </div>
                          <span className="badge badge-outline" style={{ fontSize: '0.68rem', marginTop: '2px' }}>
                            {req.requester_role}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.82rem', color: '#334155' }}>
                            {req.reason}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`badge ${req.status === 'APPROVED'
                                ? 'badge-success'
                                : req.status === 'REJECTED'
                                  ? 'badge-danger'
                                  : 'badge-warning'
                              }`}
                            style={{ fontSize: '0.72rem', fontWeight: 700 }}
                          >
                            {req.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {req.status === 'PENDING' ? (
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              <button
                                type="button"
                                className="btn-module-action primary"
                                onClick={() => setDecisionModal({
                                  isOpen: true,
                                  requestId: req.request_id,
                                  decision: 'APPROVED',
                                  reason: 'Authorized audit compliance review',
                                  submitting: false,
                                  error: null,
                                })}
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                className="btn-module-action danger"
                                onClick={() => setDecisionModal({
                                  isOpen: true,
                                  requestId: req.request_id,
                                  decision: 'REJECTED',
                                  reason: 'Denied: insufficient authorization',
                                  submitting: false,
                                  error: null,
                                })}
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>
                              Validated by {req.approver_email || 'Operator'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL 1: EVENT DETAIL / DIFF INSPECTOR MODAL */}
      {selectedEvent && (
        <div className="modal-backdrop" style={{ zIndex: 1050 }}>
          <div className="modal-card" style={{ maxWidth: '840px', borderRadius: '16px', overflow: 'hidden' }}>
            <div className="modal-header" style={{ padding: '18px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Eye size={18} style={{ color: '#2563EB' }} />
                <h2 className="modal-title" style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0F172A' }}>
                  Audit Event Diff: {selectedEvent.action}
                </h2>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setSelectedEvent(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '24px' }}>
              {/* Event Metadata Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '12px',
                  background: '#F8FAFC',
                  padding: '14px 16px',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  marginBottom: '18px',
                  fontSize: '0.82rem',
                }}
              >
                <div>
                  <span style={{ color: '#64748B', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700 }}>Actor</span>
                  <strong style={{ color: '#0F172A' }}>{selectedEvent.actor_email || 'System'}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748B', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700 }}>Role</span>
                  <span style={{ color: '#2563EB', fontWeight: 600 }}>{selectedEvent.actor_role}</span>
                </div>
                <div>
                  <span style={{ color: '#64748B', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700 }}>Tenant Scope</span>
                  <span style={{ color: '#0F172A', fontWeight: 600 }}>{selectedEvent.college_name || 'Global Platform'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748B', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700 }}>Result Outcome</span>
                  <span style={{ color: selectedEvent.result_status === 'SUCCESS' ? '#059669' : '#DC2626', fontWeight: 700 }}>
                    {selectedEvent.result_status}
                  </span>
                </div>
                {selectedEvent.ticket_reference && (
                  <div>
                    <span style={{ color: '#64748B', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700 }}>Ticket Ref</span>
                    <span style={{ color: '#D97706', fontWeight: 700 }}>{selectedEvent.ticket_reference}</span>
                  </div>
                )}
              </div>

              {/* Business Justification */}
              {selectedEvent.reason && (
                <div style={{ marginBottom: '18px', fontSize: '0.84rem', color: '#334155', background: '#EFF6FF', padding: '10px 14px', borderRadius: '8px', borderLeft: '3px solid #2563EB' }}>
                  <strong style={{ color: '#1E40AF' }}>Audit Justification: </strong>
                  <span>{selectedEvent.reason}</span>
                </div>
              )}

              {/* Before vs After Diff Split View */}
              <div className="audit-diff-grid">
                <div className="audit-diff-pane">
                  <div className="audit-diff-header before">
                    <MinusCircle size={13} />
                    <span>Before (Previous State)</span>
                  </div>
                  <pre className="audit-diff-code">
                    {selectedEvent.old_data ? JSON.stringify(selectedEvent.old_data, null, 2) : '(No previous record state)'}
                  </pre>
                </div>

                <div className="audit-diff-pane">
                  <div className="audit-diff-header after">
                    <PlusCircle size={13} />
                    <span>After (Committed State)</span>
                  </div>
                  <pre className="audit-diff-code">
                    {selectedEvent.new_data ? JSON.stringify(selectedEvent.new_data, null, 2) : '(No mutation state)'}
                  </pre>
                </div>
              </div>

              {/* Cryptographic SHA-256 Hash Chain Box */}
              {selectedEvent.current_hash && (
                <div className="audit-hash-chain-box">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <Key size={13} style={{ color: '#38BDF8' }} />
                    <span style={{ fontWeight: 700, color: '#F8FAFC' }}>Cryptographic Block Hash (SHA-256):</span>
                  </div>
                  <code>{selectedEvent.current_hash}</code>
                  {selectedEvent.previous_hash && (
                    <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid #1E293B' }}>
                      <span style={{ color: '#64748B' }}>Chained Previous Hash: </span>
                      <code>{selectedEvent.previous_hash}</code>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button
                  type="button"
                  className="btn-enterprise btn-outline-soft"
                  onClick={() => setSelectedEvent(null)}
                >
                  Close Inspector
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: REQUEST BULK EXPORT MODAL */}
      {showExportModal && (
        <div className="modal-backdrop" style={{ zIndex: 1050 }}>
          <div className="modal-card" style={{ maxWidth: '540px', borderRadius: '16px', overflow: 'hidden' }}>
            <div className="modal-header" style={{ padding: '18px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Download size={18} style={{ color: '#2563EB' }} />
                <h2 className="modal-title" style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0F172A' }}>
                  Request Bulk Audit Export
                </h2>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setShowExportModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitExport} style={{ padding: '24px' }}>
              <p style={{ fontSize: '0.84rem', color: '#64748B', marginBottom: '18px' }}>
                Bulk exports trigger a Maker-Checker validation ticket to safeguard platform and tenant audit records from unmonitored extraction.
              </p>

              <div style={{ marginBottom: '16px' }}>
                <label className="label" style={{ fontWeight: 700, fontSize: '0.82rem', color: '#334155', marginBottom: '6px' }}>
                  Ticket Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. SEC-104 or AUDIT-2026-Q4"
                  value={exportTicketRef}
                  onChange={(e) => setExportTicketRef(e.target.value)}
                  className="input-text"
                  style={{ width: '100%', fontSize: '0.84rem' }}
                />
              </div>

              <div style={{ marginBottom: '22px' }}>
                <label className="label" style={{ fontWeight: 700, fontSize: '0.82rem', color: '#334155', marginBottom: '6px' }}>
                  Business Justification <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <textarea
                  rows={4}
                  value={exportReason}
                  onChange={(e) => setExportReason(e.target.value)}
                  placeholder="Provide an authoritative reason for audit extraction..."
                  className="input-textarea"
                  style={{ width: '100%', fontSize: '0.84rem' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-enterprise btn-outline-soft"
                  onClick={() => setShowExportModal(false)}
                  disabled={exportSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-enterprise btn-primary"
                  disabled={exportSubmitting}
                >
                  {exportSubmitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: EXPORT DECISION MODAL (Replaces window.prompt) */}
      {decisionModal.isOpen && (
        <div className="modal-backdrop" style={{ zIndex: 1050 }}>
          <div className="modal-card" style={{ maxWidth: '520px', borderRadius: '16px', overflow: 'hidden' }}>
            <div className="modal-header" style={{ padding: '18px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={18} style={{ color: decisionModal.decision === 'APPROVED' ? '#059669' : '#DC2626' }} />
                <h2 className="modal-title" style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0F172A' }}>
                  {decisionModal.decision === 'APPROVED' ? 'Approve Export Request' : 'Reject Export Request'}
                </h2>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setDecisionModal((p) => ({ ...p, isOpen: false }))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmDecision} style={{ padding: '24px' }}>
              {decisionModal.error && (
                <div className="alert alert-danger" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={15} />
                  <span>{decisionModal.error}</span>
                </div>
              )}

              <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '16px' }}>
                Please confirm your validation decision for Export Request{' '}
                <code style={{ color: '#2563EB' }}>{decisionModal.requestId.substring(0, 12)}...</code>
              </p>

              <div style={{ marginBottom: '20px' }}>
                <label className="label" style={{ fontWeight: 700, fontSize: '0.82rem', color: '#334155', marginBottom: '6px' }}>
                  Peer Decision Justification <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  type="text"
                  value={decisionModal.reason}
                  onChange={(e) => setDecisionModal((p) => ({ ...p, reason: e.target.value }))}
                  className="input-text"
                  style={{ width: '100%', fontSize: '0.84rem' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-enterprise btn-outline-soft"
                  onClick={() => setDecisionModal((p) => ({ ...p, isOpen: false }))}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`btn-enterprise ${decisionModal.decision === 'APPROVED' ? 'btn-primary' : 'btn-danger'}`}
                  disabled={decisionModal.submitting}
                >
                  {decisionModal.submitting
                    ? 'Processing...'
                    : decisionModal.decision === 'APPROVED'
                      ? 'Confirm Approval'
                      : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
