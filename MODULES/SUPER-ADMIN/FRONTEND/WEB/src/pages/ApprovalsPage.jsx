import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  CheckSquare,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RotateCw,
  Search,
  X,
  FileText,
  User,
  ArrowRight,
  ShieldCheck,
  Send,
  Ban,
  ChevronLeft,
  ChevronRight,
  GitPullRequest,
  Rocket,
  AlertTriangle,
  Building2,
  Lock,
  Layers,
} from 'lucide-react';
import {
  fetchApprovalRequests,
  fetchApprovalRequest,
  processApprovalDecision,
  executeApprovalRequest,
  cancelApprovalRequest,
} from '../services/approvalService';

/**
 * Animated number count-up effect
 */
function CountUpNumber({ value, duration = 800 }) {
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

export default function ApprovalsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('inbox'); // 'inbox' | 'my_requests' | 'history' | 'all'
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Pagination & Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [total, setTotal] = useState(0);

  // Modal / Detail State
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [decisionStepId, setDecisionStepId] = useState(null);
  const [decisionType, setDecisionType] = useState('APPROVED');
  const [decisionComment, setDecisionComment] = useState('');
  const [decisionReason, setDecisionReason] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);

  // Cancellation Modal State
  const [cancellingRequest, setCancellingRequest] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [submittingCancel, setSubmittingCancel] = useState(false);

  // Load Requests
  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      setIsRefreshing(true);
      setError(null);
      const params = { limit: 50, offset: 0 };

      if (activeTab === 'inbox') {
        params.status = 'PENDING';
        params.inbox = true; // Excludes own requests for maker-checker
      } else if (activeTab === 'my_requests') {
        if (user?.user_id) {
          params.requested_by = user.user_id;
        }
        if (statusFilter) params.status = statusFilter;
      } else if (activeTab === 'history') {
        if (statusFilter) {
          params.status = statusFilter;
        }
      } else if (statusFilter) {
        params.status = statusFilter;
      }

      const res = await fetchApprovalRequests(params);
      setRequests(res.data?.approval_requests || res.approval_requests || []);
      setTotal(res.meta?.total || 0);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to load approval requests');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [activeTab, statusFilter, user]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // Open Detail View
  const handleOpenDetail = async (req) => {
    try {
      setDetailLoading(true);
      setSelectedRequest(req);
      const res = await fetchApprovalRequest(req.request_id);
      const fullReq = res.data?.approval_request || res.approval_request || req;
      setSelectedRequest(fullReq);

      // Pre-select pending step if available
      const pendingStep = fullReq.steps?.find((s) => s.status === 'PENDING');
      if (pendingStep) {
        setDecisionStepId(pendingStep.step_id);
      }
    } catch (err) {
      setError('Failed to fetch request details: ' + (err.response?.data?.error?.message || err.message));
    } finally {
      setDetailLoading(false);
    }
  };

  // Submit Approval Decision
  const handleProcessDecision = async (e) => {
    e.preventDefault();
    if (!decisionStepId) return;
    try {
      setSubmittingDecision(true);
      setError(null);

      await processApprovalDecision(decisionStepId, {
        decision: decisionType,
        comment: decisionComment.trim() || undefined,
        reason: decisionReason.trim() || undefined,
      });

      setFeedback(`Decision ${decisionType} processed successfully.`);
      setDecisionStepId(null);
      setDecisionComment('');
      setDecisionReason('');
      setSelectedRequest(null);
      loadRequests();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to process approval decision');
    } finally {
      setSubmittingDecision(false);
    }
  };

  // Execute Request Explicitly
  const handleExecuteRequest = async (requestId) => {
    if (!window.confirm('Are you sure you want to execute this approved platform operation?')) return;
    try {
      setLoading(true);
      await executeApprovalRequest(requestId);
      setFeedback('Approved request executed successfully.');
      setSelectedRequest(null);
      loadRequests();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to execute approval request');
    } finally {
      setLoading(false);
    }
  };

  // Cancel / Withdraw Request
  const handleCancelRequest = async (e) => {
    e.preventDefault();
    if (!cancellingRequest || !cancelReason.trim()) return;
    try {
      setSubmittingCancel(true);
      await cancelApprovalRequest(cancellingRequest.request_id, cancelReason.trim());
      setFeedback('Approval request withdrawn/cancelled successfully.');
      setCancellingRequest(null);
      setCancelReason('');
      setSelectedRequest(null);
      loadRequests();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to cancel approval request');
    } finally {
      setSubmittingCancel(false);
    }
  };

  // Compute Metrics
  const pendingCount = useMemo(
    () => requests.filter((r) => r.status === 'PENDING').length,
    [requests]
  );
  const approvedCount = useMemo(
    () => requests.filter((r) => r.status === 'APPROVED').length,
    [requests]
  );
  const executedCount = useMemo(
    () => requests.filter((r) => r.status === 'EXECUTED').length,
    [requests]
  );
  const rejectedCount = useMemo(
    () => requests.filter((r) => r.status === 'REJECTED' || r.status === 'CANCELLED').length,
    [requests]
  );

  // Search Filter
  const filteredRequests = useMemo(() => {
    if (!searchQuery.trim()) return requests;
    const q = searchQuery.toLowerCase();
    return requests.filter(
      (r) =>
        r.request_id?.toLowerCase().includes(q) ||
        r.operation_type?.toLowerCase().includes(q) ||
        r.entity_type?.toLowerCase().includes(q) ||
        r.reason?.toLowerCase().includes(q) ||
        r.requested_by_email?.toLowerCase().includes(q)
    );
  }, [requests, searchQuery]);

  return (
    <div className="approvals-page-container animate-fade-in">
      {/* Top Header & Breadcrumbs */}
      <div className="approvals-hero-header">
        <div className="approvals-hero-text">
          <div className="approvals-breadcrumbs">
            <Link to="/dashboard" className="breadcrumb-link">Dashboard</Link>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current">Approvals &amp; Maker-Checker</span>
          </div>
          <h1 className="approvals-title">Approval Queue &amp; Maker-Checker</h1>
          <p className="approvals-subtitle">
            Multi-step authorization queue enforcing maker-checker separation, row-locked executions, and tamper-evident audit logs.
          </p>
        </div>

        <div className="approvals-header-actions">
          <button
            type="button"
            className={`btn-enterprise btn-outline-soft ${isRefreshing ? 'is-loading' : ''}`}
            onClick={loadRequests}
            disabled={isRefreshing}
            title="Refresh approval queue"
          >
            <RotateCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Top 4 KPI Stat Cards */}
      <div className="approvals-kpi-grid">
        {/* Card 1: Pending */}
        <div className="approvals-stat-card card-stagger-1">
          <div className="approvals-stat-header">
            <span className="approvals-stat-label">Pending In Queue</span>
            <div className="approvals-stat-icon-wrap amber">
              <Clock size={17} />
            </div>
          </div>
          <div className="approvals-stat-value text-amber-600">
            <CountUpNumber value={pendingCount} />
          </div>
          <div className="approvals-stat-subtext">Awaiting peer validation decision</div>
          <div className="approvals-stat-accent-bar amber" />
        </div>

        {/* Card 2: Approved Awaiting Execution */}
        <div className="approvals-stat-card card-stagger-2">
          <div className="approvals-stat-header">
            <span className="approvals-stat-label">Approved &amp; Ready</span>
            <div className="approvals-stat-icon-wrap green">
              <CheckCircle2 size={17} />
            </div>
          </div>
          <div className="approvals-stat-value text-emerald-600">
            <CountUpNumber value={approvedCount} />
          </div>
          <div className="approvals-stat-subtext">Maker-checker gate satisfied</div>
          <div className="approvals-stat-accent-bar green" />
        </div>

        {/* Card 3: Executed */}
        <div className="approvals-stat-card card-stagger-3">
          <div className="approvals-stat-header">
            <span className="approvals-stat-label">Executed Operations</span>
            <div className="approvals-stat-icon-wrap blue">
              <Rocket size={17} />
            </div>
          </div>
          <div className="approvals-stat-value text-slate-900">
            <CountUpNumber value={executedCount} />
          </div>
          <div className="approvals-stat-subtext">Safely applied to database</div>
          <div className="approvals-stat-accent-bar blue" />
        </div>

        {/* Card 4: Rejected / Voided */}
        <div className="approvals-stat-card card-stagger-4">
          <div className="approvals-stat-header">
            <span className="approvals-stat-label">Rejected / Cancelled</span>
            <div className="approvals-stat-icon-wrap rose">
              <XCircle size={17} />
            </div>
          </div>
          <div className="approvals-stat-value text-rose-600">
            <CountUpNumber value={rejectedCount} />
          </div>
          <div className="approvals-stat-subtext">Denied by reviewer or withdrawn</div>
          <div className="approvals-stat-accent-bar rose" />
        </div>
      </div>

      {/* Global Feedback Alert */}
      {feedback && (
        <div className="approvals-feedback-banner success animate-slide-up">
          <div className="feedback-content">
            <CheckCircle2 size={16} />
            <span>{feedback}</span>
          </div>
          <button type="button" className="feedback-close-btn" onClick={() => setFeedback(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Global Error Banner */}
      {error && (
        <div className="approvals-feedback-banner danger animate-slide-up">
          <div className="feedback-content">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button type="button" className="feedback-close-btn" onClick={() => setError(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Main Content Card */}
      <div className="approvals-main-card card-stagger-4">
        {/* Unified Balanced Toolbar: Tabs on Left, Status + Search on Right */}
        <div className="approvals-toolbar">
          <div className="approvals-nav-tabs">
            <button
              type="button"
              className={`approvals-tab-pill ${activeTab === 'inbox' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('inbox');
                setStatusFilter('');
              }}
            >
              <Clock size={13} className="inline-icon" />
              <span>Inbox ({pendingCount})</span>
            </button>
            <button
              type="button"
              className={`approvals-tab-pill ${activeTab === 'my_requests' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('my_requests');
                setStatusFilter('');
              }}
            >
              <User size={13} className="inline-icon" />
              <span>My Requests</span>
            </button>
            <button
              type="button"
              className={`approvals-tab-pill ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('history');
                setStatusFilter('');
              }}
            >
              <CheckSquare size={13} className="inline-icon" />
              <span>History</span>
            </button>
            <button
              type="button"
              className={`approvals-tab-pill ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('all');
                setStatusFilter('');
              }}
            >
              <GitPullRequest size={13} className="inline-icon" />
              <span>All Requests</span>
            </button>
          </div>

          <div className="approvals-controls-cluster">
            <div className="filter-select-item">
              <span className="filter-item-label">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="permissions-select-input"
              >
                <option value="">All Statuses</option>
                <option value="PENDING">Pending Review</option>
                <option value="APPROVED">Approved</option>
                <option value="EXECUTED">Executed</option>
                <option value="REJECTED">Rejected</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            <div className="approvals-search-box">
              <Search size={15} className="search-icon" />
              <input
                type="text"
                placeholder="Search requests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="approvals-search-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearchQuery('')}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Table / Loading / Empty */}
        {loading ? (
          <div className="approvals-loading-state">
            <div className="loading-spinner-blue" />
            <div className="loading-state-title">Loading Approval Queue...</div>
            <div className="loading-state-sub">Validating maker-checker separation rules and active steps.</div>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="approvals-empty-state">
            <div className="empty-state-badge-stage">
              <div className="empty-state-badge-pulse" />
              <div className="empty-state-icon-badge">
                <CheckSquare size={32} className="text-blue-600" />
              </div>
            </div>
            <h3 className="empty-state-heading">No Requests in Queue</h3>
            <p className="empty-state-description">
              {activeTab === 'inbox'
                ? 'Your approval inbox is clear. All required maker-checker validations are up to date.'
                : 'No approval requests found matching your filter parameters.'}
            </p>
          </div>
        ) : (
          <div className="approvals-table-responsive">
            <table className="approvals-table">
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Operation Type</th>
                  <th>Target Entity</th>
                  <th>Requested By</th>
                  <th>Governance Status</th>
                  <th>Created At</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((req) => {
                  const isApproved = req.status === 'APPROVED';
                  const isPending = req.status === 'PENDING';
                  const isExecuted = req.status === 'EXECUTED';

                  return (
                    <tr key={req.request_id} className="approvals-table-row">
                      <td>
                        <span className="code-pill font-mono">
                          {req.request_id ? req.request_id.substring(0, 8) : '—'}...
                        </span>
                      </td>

                      <td>
                        <span className="operation-tag">
                          {req.operation_type || 'GENERAL_CONFIG'}
                        </span>
                      </td>

                      <td>
                        <div className="entity-cell">
                          <span className="entity-type">{req.entity_type}</span>
                          {req.entity_id && (
                            <code className="entity-id font-mono">
                              {req.entity_id.substring(0, 8)}...
                            </code>
                          )}
                        </div>
                      </td>

                      <td>
                        <div className="requester-cell">
                          <User size={13} className="text-slate-400" />
                          <span className="requester-email">
                            {req.requested_by_email || req.requested_by || 'Platform User'}
                          </span>
                        </div>
                      </td>

                      <td>
                        <span className={`node-status-badge ${req.status?.toLowerCase()}`}>
                          {isPending && <Clock size={11} />}
                          {isApproved && <CheckCircle2 size={11} />}
                          {isExecuted && <Rocket size={11} />}
                          {req.status === 'REJECTED' && <XCircle size={11} />}
                          {req.status === 'CANCELLED' && <Ban size={11} />}
                          <span>{req.status}</span>
                        </span>
                      </td>

                      <td className="text-xs text-slate-500">
                        {req.created_at ? new Date(req.created_at).toLocaleDateString() : '—'}
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div className="approvals-action-buttons">
                          <button
                            type="button"
                            className="btn-table-action"
                            onClick={() => handleOpenDetail(req)}
                            title="Inspect full request diff and steps"
                          >
                            Inspect
                          </button>

                          {isApproved && (
                            <button
                              type="button"
                              className="btn-table-action primary"
                              onClick={() => handleExecuteRequest(req.request_id)}
                              title="Execute approved operation"
                            >
                              <Rocket size={12} />
                              <span>Execute</span>
                            </button>
                          )}

                          {isPending && req.requested_by === user?.user_id && (
                            <button
                              type="button"
                              className="btn-table-action danger"
                              onClick={() => {
                                setCancellingRequest(req);
                                setCancelReason('');
                              }}
                              title="Withdraw your submitted request"
                            >
                              <Ban size={12} />
                              <span>Withdraw</span>
                            </button>
                          )}
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

      {/* MODAL 1: Request Detail & Maker-Checker Review */}
      {selectedRequest && (
        <div className="modal-backdrop-blur">
          <div className="modal-dialog-card animate-badge-pop" style={{ maxWidth: '780px', maxHeight: '90vh' }}>
            <div className="modal-dialog-header">
              <div className="modal-header-icon-wrap blue">
                <GitPullRequest size={20} />
              </div>
              <div className="modal-header-text">
                <h3 className="modal-header-title">
                  Approval Request: {selectedRequest.operation_type}
                </h3>
                <div className="role-modal-badges">
                  <span className="code-pill font-mono">{selectedRequest.request_id}</span>
                  <span className={`node-status-badge ${selectedRequest.status?.toLowerCase()}`}>
                    {selectedRequest.status}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => setSelectedRequest(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-dialog-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {detailLoading ? (
                <div className="approvals-loading-state" style={{ padding: '24px' }}>
                  <div className="loading-spinner-blue" />
                  <div className="loading-state-title">Loading Full Request Trace...</div>
                </div>
              ) : (
                <>
                  {/* Summary Details Grid */}
                  <div className="role-detail-summary-grid">
                    <div className="summary-item-card">
                      <span className="summary-label">Target Entity</span>
                      <div className="summary-val text-slate-800" style={{ fontSize: '0.95rem' }}>
                        {selectedRequest.entity_type}
                      </div>
                    </div>
                    <div className="summary-item-card">
                      <span className="summary-label">Requester</span>
                      <div className="summary-val text-blue-600" style={{ fontSize: '0.85rem' }}>
                        {selectedRequest.requested_by_email || selectedRequest.requested_by}
                      </div>
                    </div>
                    <div className="summary-item-card">
                      <span className="summary-label">Created At</span>
                      <div className="summary-val text-slate-600" style={{ fontSize: '0.85rem' }}>
                        {selectedRequest.created_at ? new Date(selectedRequest.created_at).toLocaleString() : '—'}
                      </div>
                    </div>
                  </div>

                  <div className="form-group-custom mt-3">
                    <label className="form-label-custom">Audit Justification</label>
                    <div className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200">
                      {selectedRequest.reason || 'No audit reason specified.'}
                    </div>
                  </div>

                  {/* Multi-Step Pipeline Visualizer */}
                  {selectedRequest.steps && selectedRequest.steps.length > 0 && (
                    <div className="approval-steps-chain mt-4">
                      <h4 className="section-subheading">Maker-Checker Authorization Steps</h4>
                      <div className="steps-chain-list">
                        {selectedRequest.steps.map((st, idx) => (
                          <div key={st.step_id || idx} className={`step-chain-item ${st.status.toLowerCase()}`}>
                            <div className="step-chain-dot">
                              {st.status === 'APPROVED' ? '✓' : st.status === 'REJECTED' ? '✗' : idx + 1}
                            </div>
                            <div className="step-chain-content">
                              <div className="step-chain-header">
                                <span className="step-chain-role">
                                  Step {idx + 1}: Required Role <strong>{st.required_role || 'SUPER_ADMIN'}</strong>
                                </span>
                                <span className={`step-badge ${st.status.toLowerCase()}`}>
                                  {st.status}
                                </span>
                              </div>
                              {st.decided_by && (
                                <div className="text-xs text-slate-500 mt-1">
                                  Reviewed by: {st.decided_by_email || st.decided_by} ({new Date(st.decided_at).toLocaleString()})
                                </div>
                              )}
                              {st.comment && (
                                <div className="text-xs text-slate-600 italic mt-1">
                                  &quot;{st.comment}&quot;
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Proposed Payload Diff Inspector */}
                  {selectedRequest.payload && (
                    <div className="payload-inspect-box mt-4">
                      <h4 className="section-subheading">Proposed Operation Payload</h4>
                      <pre className="payload-json-view">
                        {typeof selectedRequest.payload === 'string'
                          ? selectedRequest.payload
                          : JSON.stringify(selectedRequest.payload, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Decision Form if Pending and current user is not requester */}
                  {selectedRequest.status === 'PENDING' && decisionStepId && (
                    <form onSubmit={handleProcessDecision} className="decision-form-box mt-4">
                      <h4 className="section-subheading text-blue-600">Submit Peer Review Decision</h4>

                      <div className="decision-radio-group">
                        <label className={`decision-radio-label ${decisionType === 'APPROVED' ? 'selected-approve' : ''}`}>
                          <input
                            type="radio"
                            name="decision"
                            value="APPROVED"
                            checked={decisionType === 'APPROVED'}
                            onChange={() => setDecisionType('APPROVED')}
                          />
                          <CheckCircle2 size={16} className="text-emerald-600" />
                          <span>Approve Operation</span>
                        </label>

                        <label className={`decision-radio-label ${decisionType === 'REJECTED' ? 'selected-reject' : ''}`}>
                          <input
                            type="radio"
                            name="decision"
                            value="REJECTED"
                            checked={decisionType === 'REJECTED'}
                            onChange={() => setDecisionType('REJECTED')}
                          />
                          <XCircle size={16} className="text-rose-600" />
                          <span>Reject Operation</span>
                        </label>
                      </div>

                      <div className="form-group-custom mt-3">
                        <label className="form-label-custom">Reviewer Comments</label>
                        <textarea
                          rows={2}
                          placeholder="Optional audit comment..."
                          value={decisionComment}
                          onChange={(e) => setDecisionComment(e.target.value)}
                          className="form-input-custom textarea"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={submittingDecision}
                        className={`btn-enterprise w-full justify-center mt-3 ${
                          decisionType === 'APPROVED' ? 'btn-primary-blue' : 'btn-danger'
                        }`}
                      >
                        {submittingDecision ? 'Processing...' : `Submit Decision (${decisionType})`}
                      </button>
                    </form>
                  )}
                </>
              )}
            </div>

            <div className="modal-dialog-footer">
              <button
                type="button"
                className="btn-enterprise btn-outline-soft"
                onClick={() => setSelectedRequest(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Cancel / Withdraw Dialog */}
      {cancellingRequest && (
        <div className="modal-backdrop-blur">
          <div className="modal-dialog-card animate-badge-pop" style={{ maxWidth: '480px' }}>
            <div className="modal-dialog-header">
              <div className="modal-header-icon-wrap rose">
                <Ban size={20} />
              </div>
              <div className="modal-header-text">
                <h3 className="modal-header-title">Withdraw Approval Request</h3>
                <p className="modal-header-subtitle">Cancel your submitted pending authorization request.</p>
              </div>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => setCancellingRequest(null)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCancelRequest}>
              <div className="modal-dialog-body">
                <p className="modal-instruction-text">
                  Withdrawing this request will immediately mark it as <strong>CANCELLED</strong> and remove it from reviewer queues.
                </p>

                <div className="form-group-custom">
                  <label className="form-label-custom">Reason for Withdrawal *</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="e.g. Configuration parameters no longer needed or superseded..."
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="form-input-custom textarea"
                  />
                </div>
              </div>

              <div className="modal-dialog-footer">
                <button
                  type="button"
                  className="btn-enterprise btn-outline-soft"
                  onClick={() => setCancellingRequest(null)}
                  disabled={submittingCancel}
                >
                  Keep Request
                </button>
                <button
                  type="submit"
                  className="btn-enterprise btn-danger"
                  disabled={submittingCancel}
                >
                  {submittingCancel ? 'Cancelling...' : 'Confirm Withdrawal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
