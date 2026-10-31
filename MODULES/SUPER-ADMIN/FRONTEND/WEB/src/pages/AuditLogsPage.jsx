import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  fetchAuditLogs,
  fetchAuditLogDetail,
  verifyAuditIntegrity,
  requestAuditExport,
  fetchAuditExportRequests,
  processAuditExportDecision,
} from '../services/auditService';
import { fetchCollegesList } from '../services/collegeService';

export default function AuditLogsPage() {
  const [activeTab, setActiveTab] = useState('events'); // 'events' | 'integrity' | 'exports'

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
  const [exportSubmitting, setExportSubmitting] = useState(false);

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
  const loadAuditLogs = useCallback(async () => {
    try {
      setLoading(true);
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
      if (filters.ticket_reference) params.ticket_reference = filters.ticket_reference;
      if (filters.start_date) params.start_date = new Date(filters.start_date).toISOString();
      if (filters.end_date) params.end_date = new Date(filters.end_date).toISOString();

      const res = await fetchAuditLogs(params);
      setRecords(res.records || []);
      setTotalRecords(res.total || 0);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to retrieve audit events');
    } finally {
      setLoading(false);
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
        type: res.integrity_report.is_integrity_intact ? 'success' : 'error',
        text: res.integrity_report.is_integrity_intact
          ? `Verified ${res.integrity_report.total_checked} records. Cryptographic hash chain is intact!`
          : `Tampering detected in audit records!`,
      });
    } catch (err) {
      alert('Integrity check failed: ' + (err.response?.data?.error?.message || err.message));
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
      alert('Failed to load audit detail: ' + (err.response?.data?.error?.message || err.message));
    } finally {
      setDetailLoading(false);
    }
  };

  // Submit Export Request
  const handleSubmitExport = async (e) => {
    e.preventDefault();
    if (!exportReason.trim() || exportReason.trim().length < 5) {
      alert('A valid business justification is mandatory (minimum 5 characters).');
      return;
    }
    try {
      setExportSubmitting(true);
      await requestAuditExport({
        filters,
        reason: exportReason.trim(),
      });
      setShowExportModal(false);
      setExportReason('');
      setFeedback({
        type: 'success',
        text: 'Bulk audit export request created. Awaiting peer Super Admin approval.',
      });
      if (activeTab === 'exports') await loadExportRequests();
    } catch (err) {
      alert(err.response?.data?.error?.message || err.message || 'Failed to submit export request');
    } finally {
      setExportSubmitting(false);
    }
  };

  // Approve/Reject Export
  const handleExportDecision = async (id, decision) => {
    const reason = window.prompt(`Enter reason for ${decision} export request:`, 'Authorized audit compliance review');
    if (!reason) return;

    try {
      await processAuditExportDecision(id, { decision, reason });
      setFeedback({ type: 'success', text: `Audit export request ${decision.toLowerCase()} successfully.` });
      await loadExportRequests();
    } catch (err) {
      alert(err.response?.data?.error?.message || err.message || 'Failed to process decision');
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', color: '#f8fafc' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '2rem' }}>📜</span>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
              Platform Audit &amp; Activity Log
            </h1>
            <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '0.9rem' }}>
              Immutable record of company-platform actions, security events, before/after diffs, and tamper-evident hash chaining.
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => {
              setActiveTab('integrity');
              runIntegrityVerification();
            }}
            style={{
              padding: '8px 14px',
              background: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              borderRadius: '6px',
              color: '#38bdf8',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>🛡️</span>
            <span>Verify Tamper Evidence</span>
          </button>

          <button
            onClick={() => setShowExportModal(true)}
            style={{
              padding: '8px 16px',
              background: '#0284c7',
              border: 'none',
              borderRadius: '6px',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>📥</span>
            <span>Request Bulk Export</span>
          </button>
        </div>
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          style={{
            padding: '12px 16px',
            marginBottom: '20px',
            borderRadius: '8px',
            background: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${feedback.type === 'success' ? '#10b981' : '#ef4444'}`,
            color: feedback.type === 'success' ? '#6ee7b7' : '#fca5a5',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{feedback.text}</span>
          <button
            onClick={() => setFeedback(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1.1rem' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #334155', marginBottom: '24px' }}>
        {[
          { id: 'events', label: '📋 Platform Audit Events' },
          { id: 'integrity', label: '🔗 Tamper-Evident Hash Chain' },
          { id: 'exports', label: '📤 Controlled Bulk Exports' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 18px',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #38bdf8' : '2px solid transparent',
              background: 'none',
              color: activeTab === tab.id ? '#38bdf8' : '#94a3b8',
              fontWeight: activeTab === tab.id ? 600 : 500,
              fontSize: '0.95rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: AUDIT EVENTS LIST */}
      {activeTab === 'events' && (
        <div>
          {/* Filters Bar */}
          <div
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '10px',
              padding: '16px',
              marginBottom: '20px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              alignItems: 'center',
            }}
          >
            {/* Search Query */}
            <input
              type="text"
              placeholder="Search module, action, reason, user..."
              value={filters.query}
              onChange={(e) => setFilters((prev) => ({ ...prev, query: e.target.value }))}
              style={{
                padding: '8px 12px',
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '6px',
                color: '#f8fafc',
                fontSize: '0.85rem',
                minWidth: '220px',
                flex: '1',
              }}
            />

            {/* College Tenant Filter */}
            <select
              value={filters.college_id}
              onChange={(e) => setFilters((prev) => ({ ...prev, college_id: e.target.value }))}
              style={{
                padding: '8px 12px',
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '6px',
                color: '#f8fafc',
                fontSize: '0.85rem',
              }}
            >
              <option value="">All Colleges / Platform</option>
              {colleges.map((c) => (
                <option key={c.college_id} value={c.college_id}>
                  {c.name} ({c.college_code || c.code})
                </option>
              ))}
            </select>

            {/* Severity Filter */}
            <select
              value={filters.severity}
              onChange={(e) => setFilters((prev) => ({ ...prev, severity: e.target.value }))}
              style={{
                padding: '8px 12px',
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '6px',
                color: '#f8fafc',
                fontSize: '0.85rem',
              }}
            >
              <option value="">All Severities</option>
              <option value="DEBUG">DEBUG</option>
              <option value="INFO">INFO</option>
              <option value="WARNING">WARNING</option>
              <option value="ERROR">ERROR</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>

            {/* Result Status Filter */}
            <select
              value={filters.result_status}
              onChange={(e) => setFilters((prev) => ({ ...prev, result_status: e.target.value }))}
              style={{
                padding: '8px 12px',
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '6px',
                color: '#f8fafc',
                fontSize: '0.85rem',
              }}
            >
              <option value="">All Outcomes</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="FAILURE">FAILURE</option>
              <option value="DENIED">DENIED</option>
            </select>

            {/* Ticket Ref Filter */}
            <input
              type="text"
              placeholder="Ticket Ref (e.g. SEC-104)"
              value={filters.ticket_reference}
              onChange={(e) => setFilters((prev) => ({ ...prev, ticket_reference: e.target.value }))}
              style={{
                padding: '8px 12px',
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '6px',
                color: '#f8fafc',
                fontSize: '0.85rem',
                width: '150px',
              }}
            />

            <button
              onClick={() => {
                setPage(0);
                loadAuditLogs();
              }}
              style={{
                padding: '8px 16px',
                background: '#334155',
                border: 'none',
                borderRadius: '6px',
                color: '#f8fafc',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              Filter
            </button>
          </div>

          {/* Audit Records Table */}
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '10px', overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading audit records...</div>
            ) : error ? (
              <div style={{ padding: '24px', background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5' }}>{error}</div>
            ) : records.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No audit records match the criteria.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#0f172a', borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                      <th style={{ padding: '12px 14px' }}>Timestamp (UTC)</th>
                      <th style={{ padding: '12px 14px' }}>Module / Action</th>
                      <th style={{ padding: '12px 14px' }}>Actor</th>
                      <th style={{ padding: '12px 14px' }}>Tenant College</th>
                      <th style={{ padding: '12px 14px' }}>Severity</th>
                      <th style={{ padding: '12px 14px' }}>Status</th>
                      <th style={{ padding: '12px 14px' }}>Ticket</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r) => (
                      <tr key={r.audit_id} style={{ borderBottom: '1px solid #334155', transition: 'background 0.15s ease' }}>
                        <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', color: '#cbd5e1' }}>
                          {new Date(r.created_at).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontWeight: 600, color: '#f8fafc' }}>{r.action}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{r.module}</div>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ color: '#f8fafc' }}>{r.actor_email || 'System / Batch'}</div>
                          <div style={{ fontSize: '0.75rem', color: '#38bdf8' }}>{r.actor_role}</div>
                        </td>
                        <td style={{ padding: '12px 14px', color: r.college_name ? '#cbd5e1' : '#64748b' }}>
                          {r.college_name ? `${r.college_name} (${r.college_code})` : 'Company Platform'}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontWeight: 700,
                              background:
                                r.severity === 'CRITICAL'
                                  ? '#7f1d1d'
                                  : r.severity === 'ERROR'
                                  ? '#991b1b'
                                  : r.severity === 'WARNING'
                                  ? '#78350f'
                                  : '#0f172a',
                              color:
                                r.severity === 'CRITICAL' || r.severity === 'ERROR'
                                  ? '#fca5a5'
                                  : r.severity === 'WARNING'
                                  ? '#fde68a'
                                  : '#94a3b8',
                            }}
                          >
                            {r.severity}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontWeight: 600,
                              background:
                                r.result_status === 'SUCCESS'
                                  ? 'rgba(16, 185, 129, 0.15)'
                                  : 'rgba(239, 68, 68, 0.15)',
                              color: r.result_status === 'SUCCESS' ? '#6ee7b7' : '#fca5a5',
                            }}
                          >
                            {r.result_status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', color: '#cbd5e1' }}>
                          {r.ticket_reference || '—'}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          <button
                            onClick={() => handleViewDetail(r.audit_id)}
                            style={{
                              padding: '5px 12px',
                              background: '#334155',
                              border: 'none',
                              borderRadius: '6px',
                              color: '#38bdf8',
                              fontWeight: 600,
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                            }}
                          >
                            Inspect Diff
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            <div
              style={{
                padding: '12px 16px',
                borderTop: '1px solid #334155',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#0f172a',
                fontSize: '0.85rem',
                color: '#94a3b8',
              }}
            >
              <span>
                Showing {records.length} of {totalRecords} records
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  style={{
                    padding: '6px 12px',
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '4px',
                    color: page === 0 ? '#475569' : '#f8fafc',
                    cursor: page === 0 ? 'not-allowed' : 'pointer',
                  }}
                >
                  Previous
                </button>
                <button
                  disabled={(page + 1) * pageSize >= totalRecords}
                  onClick={() => setPage((p) => p + 1)}
                  style={{
                    padding: '6px 12px',
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '4px',
                    color: (page + 1) * pageSize >= totalRecords ? '#475569' : '#f8fafc',
                    cursor: (page + 1) * pageSize >= totalRecords ? 'not-allowed' : 'pointer',
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TAMPER-EVIDENT HASH CHAIN */}
      {activeTab === 'integrity' && (
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 6px 0', color: '#f8fafc' }}>
                Cryptographic Hash-Chain Verification
              </h2>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.875rem' }}>
                Validates sequential SHA-256 hash chains across audit logs to mathematically prove records have not been altered or deleted.
              </p>
            </div>
            <button
              onClick={runIntegrityVerification}
              disabled={integrityLoading}
              style={{
                padding: '8px 18px',
                background: '#0284c7',
                border: 'none',
                borderRadius: '6px',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: integrityLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {integrityLoading ? 'Verifying Hashes...' : 'Re-verify Hash Chain'}
            </button>
          </div>

          {integrityReport && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div style={{ background: '#0f172a', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Chain Status</div>
                <div
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    marginTop: '4px',
                    color: integrityReport.is_integrity_intact ? '#10b981' : '#ef4444',
                  }}
                >
                  {integrityReport.is_integrity_intact ? 'TAMPER-FREE' : 'COMPROMISED'}
                </div>
              </div>

              <div style={{ background: '#0f172a', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Records Scanned</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '4px', color: '#f8fafc' }}>
                  {integrityReport.total_checked}
                </div>
              </div>

              <div style={{ background: '#0f172a', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Tampered Logs</div>
                <div
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    marginTop: '4px',
                    color: integrityReport.tampered_records > 0 ? '#ef4444' : '#10b981',
                  }}
                >
                  {integrityReport.tampered_records}
                </div>
              </div>

              <div style={{ background: '#0f172a', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Verified At</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 500, marginTop: '6px', color: '#cbd5e1' }}>
                  {new Date(integrityReport.checked_at).toLocaleTimeString()}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CONTROLLED BULK EXPORTS */}
      {activeTab === 'exports' && (
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #334155' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Bulk Audit Export Authorization Pipeline</h3>
            <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '0.85rem' }}>
              Enforces four-eyes approval workflow for bulk data downloads to prevent unauthorized extraction of company audit records.
            </p>
          </div>

          {exportLoading ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>Loading export requests...</div>
          ) : exportRequests.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No bulk export requests submitted.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#0f172a', borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                  <th style={{ padding: '12px 16px' }}>Request ID</th>
                  <th style={{ padding: '12px 16px' }}>Requester</th>
                  <th style={{ padding: '12px 16px' }}>Reason</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px' }}>Approver</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {exportRequests.map((req) => (
                  <tr key={req.request_id} style={{ borderBottom: '1px solid #334155' }}>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#94a3b8' }}>
                      {req.request_id.substring(0, 8)}...
                    </td>
                    <td style={{ padding: '12px 16px', color: '#f8fafc' }}>
                      <div>{req.requester_email || req.requester_user_id}</div>
                      <div style={{ fontSize: '0.75rem', color: '#38bdf8' }}>{req.requester_role}</div>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#cbd5e1' }}>{req.reason}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontWeight: 600,
                          background:
                            req.status === 'APPROVED'
                              ? 'rgba(16, 185, 129, 0.15)'
                              : req.status === 'REJECTED'
                              ? 'rgba(239, 68, 68, 0.15)'
                              : 'rgba(245, 158, 11, 0.15)',
                          color:
                            req.status === 'APPROVED'
                              ? '#6ee7b7'
                              : req.status === 'REJECTED'
                              ? '#fca5a5'
                              : '#fde68a',
                        }}
                      >
                        {req.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: req.approver_email ? '#cbd5e1' : '#64748b' }}>
                      {req.approver_email || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {req.status === 'PENDING' && (
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleExportDecision(req.request_id, 'APPROVED')}
                            style={{
                              padding: '4px 10px',
                              background: '#059669',
                              border: 'none',
                              borderRadius: '4px',
                              color: '#ffffff',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleExportDecision(req.request_id, 'REJECTED')}
                            style={{
                              padding: '4px 10px',
                              background: '#dc2626',
                              border: 'none',
                              borderRadius: '4px',
                              color: '#ffffff',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Event Detail Modal (Diff Inspector) */}
      {selectedEvent && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
        >
          <div
            style={{
              background: '#1e293b',
              border: '1px solid #475569',
              borderRadius: '12px',
              padding: '24px',
              width: '100%',
              maxWidth: '850px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 4px 0', color: '#f8fafc' }}>
                  Audit Event: {selectedEvent.action}
                </h2>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  Module: <strong>{selectedEvent.module}</strong> | ID: <code>{selectedEvent.audit_id}</code>
                </div>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Event Metadata Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
                background: '#0f172a',
                padding: '14px',
                borderRadius: '8px',
                border: '1px solid #334155',
                marginBottom: '16px',
                fontSize: '0.85rem',
              }}
            >
              <div>
                <span style={{ color: '#64748b' }}>Actor: </span>
                <span style={{ color: '#f8fafc' }}>{selectedEvent.actor_email || 'System'}</span>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Role: </span>
                <span style={{ color: '#38bdf8' }}>{selectedEvent.actor_role}</span>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Tenant: </span>
                <span style={{ color: '#f8fafc' }}>{selectedEvent.college_name || 'Global Platform'}</span>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Outcome: </span>
                <span style={{ color: selectedEvent.result_status === 'SUCCESS' ? '#10b981' : '#ef4444' }}>
                  {selectedEvent.result_status}
                </span>
              </div>
              {selectedEvent.ticket_reference && (
                <div>
                  <span style={{ color: '#64748b' }}>Ticket Ref: </span>
                  <span style={{ color: '#fbbf24' }}>{selectedEvent.ticket_reference}</span>
                </div>
              )}
              {selectedEvent.correlation_id && (
                <div>
                  <span style={{ color: '#64748b' }}>Correlation ID: </span>
                  <span style={{ color: '#cbd5e1', fontFamily: 'monospace' }}>
                    {selectedEvent.correlation_id.substring(0, 8)}...
                  </span>
                </div>
              )}
            </div>

            {/* Reason */}
            {selectedEvent.reason && (
              <div style={{ marginBottom: '16px', fontSize: '0.85rem', color: '#cbd5e1' }}>
                <strong>Justification / Reason: </strong> {selectedEvent.reason}
              </div>
            )}

            {/* Before vs After Diff View */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '0.85rem', color: '#f87171' }}>Before (Old Data)</h4>
                <pre
                  style={{
                    background: '#020617',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    padding: '12px',
                    fontSize: '0.75rem',
                    color: '#fca5a5',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {selectedEvent.old_data ? JSON.stringify(selectedEvent.old_data, null, 2) : '(none)'}
                </pre>
              </div>

              <div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '0.85rem', color: '#34d399' }}>After (New Data)</h4>
                <pre
                  style={{
                    background: '#020617',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    padding: '12px',
                    fontSize: '0.75rem',
                    color: '#a7f3d0',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {selectedEvent.new_data ? JSON.stringify(selectedEvent.new_data, null, 2) : '(none)'}
                </pre>
              </div>
            </div>

            {/* Cryptographic Tamper Hash */}
            {selectedEvent.current_hash && (
              <div style={{ background: '#020617', padding: '10px', borderRadius: '6px', fontSize: '0.75rem', color: '#94a3b8' }}>
                <div>
                  <strong>Cryptographic Hash (SHA-256): </strong>
                  <code style={{ color: '#38bdf8' }}>{selectedEvent.current_hash}</code>
                </div>
                {selectedEvent.previous_hash && (
                  <div style={{ marginTop: '4px' }}>
                    <strong>Chained Previous Hash: </strong>
                    <code style={{ color: '#64748b' }}>{selectedEvent.previous_hash}</code>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Export Request Modal */}
      {showExportModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
        >
          <div
            style={{
              background: '#1e293b',
              border: '1px solid #475569',
              borderRadius: '12px',
              padding: '24px',
              width: '100%',
              maxWidth: '550px',
            }}
          >
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 6px 0', color: '#f8fafc' }}>
              Request Bulk Audit Export
            </h2>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: '#94a3b8' }}>
              Bulk exports require explicit justification and peer approval to adhere to platform compliance standards.
            </p>

            <form onSubmit={handleSubmitExport}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Business Justification &amp; Ticket ID (Mandatory)
                </label>
                <textarea
                  rows={4}
                  value={exportReason}
                  onChange={(e) => setExportReason(e.target.value)}
                  placeholder="e.g. Statutory regulatory compliance audit requested via Ticket #SEC-982"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#f8fafc',
                    fontSize: '0.85rem',
                    padding: '10px',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  style={{
                    padding: '8px 16px',
                    background: 'transparent',
                    border: '1px solid #475569',
                    borderRadius: '6px',
                    color: '#cbd5e1',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={exportSubmitting}
                  style={{
                    padding: '8px 18px',
                    background: '#0284c7',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#ffffff',
                    fontWeight: 600,
                    cursor: exportSubmitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {exportSubmitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
