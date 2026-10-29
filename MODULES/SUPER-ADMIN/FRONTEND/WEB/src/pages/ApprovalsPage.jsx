import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  fetchApprovalRequests,
  fetchApprovalRequest,
  processApprovalDecision,
  executeApprovalRequest,
  cancelApprovalRequest,
} from '../services/approvalService';

export default function ApprovalsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('inbox'); // 'inbox' | 'my_requests' | 'all' | 'history'
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Pagination & Filters
  const [statusFilter, setStatusFilter] = useState('');
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
        // Finalized states
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
      setSelectedRequest(res.data?.approval_request || res.approval_request || req);
    } catch (err) {
      setError('Failed to fetch full request details: ' + (err.response?.data?.error?.message || err.message));
    } finally {
      setDetailLoading(false);
    }
  };

  // Submit Approval Decision
  const handleProcessDecision = async () => {
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
      setFeedback('Approved operation executed successfully in platform transaction.');
      setSelectedRequest(null);
      loadRequests();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to execute approval request');
    } finally {
      setLoading(false);
    }
  };

  // Cancel / Withdraw Request
  const handleCancelRequest = async () => {
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

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return <span className="badge badge-warning">⏳ Pending Review</span>;
      case 'APPROVED':
        return <span className="badge badge-success">✅ Approved</span>;
      case 'EXECUTED':
        return <span className="badge badge-info">🚀 Executed</span>;
      case 'REJECTED':
        return <span className="badge badge-danger">❌ Rejected</span>;
      case 'CANCELLED':
        return <span className="badge badge-secondary">🚫 Cancelled</span>;
      case 'EXPIRED':
        return <span className="badge badge-secondary">⌛ Expired</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  return (
    <div className="approvals-page" style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 6px 0', color: '#0f172a' }}>
            📋 Approval Workflow & Maker-Checker Queue
          </h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
            Multi-step authorization queue enforcing maker-checker separation, row-locked executions, and tamper-evident audit logs.
          </p>
        </div>
        <button onClick={loadRequests} className="btn btn-outline btn-sm" disabled={loading}>
          🔄 Refresh
        </button>
      </div>

      {/* Alerts */}
      {feedback && (
        <div style={{ background: '#ecfdf5', border: '1px solid #10b981', color: '#065f46', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
          <span>{feedback}</span>
          <button onClick={() => setFeedback(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
        </div>
      )}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #ef4444', color: '#991b1b', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', marginBottom: '20px' }}>
        <button
          onClick={() => { setActiveTab('inbox'); setStatusFilter(''); }}
          style={{
            padding: '10px 18px',
            border: 'none',
            borderBottom: activeTab === 'inbox' ? '2px solid #2563eb' : '2px solid transparent',
            background: 'none',
            color: activeTab === 'inbox' ? '#2563eb' : '#64748b',
            fontWeight: activeTab === 'inbox' ? '600' : '500',
            cursor: 'pointer',
          }}
        >
          📥 Approval Inbox (Others' Requests)
        </button>
        <button
          onClick={() => { setActiveTab('my_requests'); setStatusFilter(''); }}
          style={{
            padding: '10px 18px',
            border: 'none',
            borderBottom: activeTab === 'my_requests' ? '2px solid #2563eb' : '2px solid transparent',
            background: 'none',
            color: activeTab === 'my_requests' ? '#2563eb' : '#64748b',
            fontWeight: activeTab === 'my_requests' ? '600' : '500',
            cursor: 'pointer',
          }}
        >
          👤 My Submitted Requests
        </button>
        <button
          onClick={() => { setActiveTab('history'); setStatusFilter(''); }}
          style={{
            padding: '10px 18px',
            border: 'none',
            borderBottom: activeTab === 'history' ? '2px solid #2563eb' : '2px solid transparent',
            background: 'none',
            color: activeTab === 'history' ? '#2563eb' : '#64748b',
            fontWeight: activeTab === 'history' ? '600' : '500',
            cursor: 'pointer',
          }}
        >
          📜 Approval History
        </button>
        <button
          onClick={() => { setActiveTab('all'); setStatusFilter(''); }}
          style={{
            padding: '10px 18px',
            border: 'none',
            borderBottom: activeTab === 'all' ? '2px solid #2563eb' : '2px solid transparent',
            background: 'none',
            color: activeTab === 'all' ? '#2563eb' : '#64748b',
            fontWeight: activeTab === 'all' ? '600' : '500',
            cursor: 'pointer',
          }}
        >
          🔍 All Platform Requests
        </button>
      </div>

      {/* Filter Toolbar */}
      {activeTab !== 'inbox' && (
        <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <label style={{ fontSize: '13px', fontWeight: '500', color: '#475569' }}>Filter Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="EXECUTED">Executed</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="EXPIRED">Expired</option>
          </select>
        </div>
      )}

      {/* Requests Table */}
      <div className="card" style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading approval queue...</div>
        ) : requests.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <span style={{ fontSize: '36px', display: 'block', marginBottom: '12px' }}>✨</span>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', color: '#0f172a' }}>No requests in this view</h3>
            <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
              {activeTab === 'inbox'
                ? 'Your approval queue is clear. No pending maker-checker actions require your decision.'
                : 'No approval records match your criteria.'}
            </p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '12px 16px', fontWeight: '600' }}>Operation Type</th>
                <th style={{ padding: '12px 16px', fontWeight: '600' }}>Status</th>
                <th style={{ padding: '12px 16px', fontWeight: '600' }}>Target / Scope</th>
                <th style={{ padding: '12px 16px', fontWeight: '600' }}>Requester</th>
                <th style={{ padding: '12px 16px', fontWeight: '600' }}>Reason</th>
                <th style={{ padding: '12px 16px', fontWeight: '600' }}>Created At</th>
                <th style={{ padding: '12px 16px', fontWeight: '600', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => {
                const isMyOwnRequest = user?.user_id && r.requested_by === user.user_id;
                return (
                  <tr key={r.request_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', fontWeight: '600', color: '#0f172a' }}>
                      <code>{r.operation_type}</code>
                    </td>
                    <td style={{ padding: '12px 16px' }}>{getStatusBadge(r.status)}</td>
                    <td style={{ padding: '12px 16px', color: '#475569' }}>
                      {r.college_id ? (
                        <span title={r.college_id}>College ({r.college_id.slice(0, 8)}...)</span>
                      ) : (
                        <span style={{ color: '#0284c7' }}>Global Platform</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#475569' }}>
                      {isMyOwnRequest ? (
                        <span style={{ fontWeight: '600', color: '#2563eb' }}>You (Requester)</span>
                      ) : (
                        <span title={r.requested_by}>{r.requested_by.slice(0, 8)}...</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748b', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.reason || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748b' }}>
                      {new Date(r.created_at).toLocaleDateString()} {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleOpenDetail(r)}
                          style={{ padding: '4px 10px', fontSize: '12px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Details
                        </button>
                        {r.status === 'APPROVED' && (
                          <button
                            onClick={() => handleExecuteRequest(r.request_id)}
                            style={{ padding: '4px 10px', fontSize: '12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            Execute
                          </button>
                        )}
                        {r.status === 'PENDING' && isMyOwnRequest && (
                          <button
                            onClick={() => { setCancellingRequest(r); setCancelReason(''); }}
                            style={{ padding: '4px 10px', fontSize: '12px', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            Withdraw
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Details & Decision Modal */}
      {selectedRequest && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '700px', maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 4px 0', color: '#0f172a' }}>
                  Approval Request: {selectedRequest.operation_type}
                </h2>
                <span style={{ fontSize: '12px', color: '#64748b' }}>ID: {selectedRequest.request_id}</span>
              </div>
              <button onClick={() => setSelectedRequest(null)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ marginBottom: '16px', display: 'flex', gap: '16px', background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
              <div><strong>Status:</strong> {getStatusBadge(selectedRequest.status)}</div>
              <div><strong>Scope:</strong> {selectedRequest.college_id ? `College (${selectedRequest.college_id.slice(0, 8)})` : 'Platform Global'}</div>
              <div><strong>Expires:</strong> {selectedRequest.expires_at ? new Date(selectedRequest.expires_at).toLocaleString() : '72h standard'}</div>
            </div>

            {selectedRequest.reason && (
              <div style={{ marginBottom: '16px' }}>
                <strong style={{ fontSize: '13px', color: '#334155' }}>Proposal Reason:</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#475569', background: '#fff', border: '1px solid #e2e8f0', padding: '8px 12px', borderRadius: '6px' }}>
                  {selectedRequest.reason}
                </p>
              </div>
            )}

            {/* Payload & Snapshot Inspection */}
            <div style={{ marginBottom: '20px' }}>
              <strong style={{ fontSize: '13px', color: '#334155' }}>Operation Payload:</strong>
              <pre style={{ background: '#0f172a', color: '#38bdf8', padding: '12px', borderRadius: '8px', fontSize: '12px', overflowX: 'auto', marginTop: '4px' }}>
                {JSON.stringify(selectedRequest.payload, null, 2)}
              </pre>
            </div>

            {/* Multi-Step Approval Chain */}
            <div style={{ marginBottom: '20px' }}>
              <strong style={{ fontSize: '13px', color: '#334155' }}>Approval Decision Steps:</strong>
              {detailLoading ? (
                <p style={{ color: '#64748b', fontSize: '13px' }}>Loading steps...</p>
              ) : selectedRequest.steps && selectedRequest.steps.length > 0 ? (
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedRequest.steps.map((st) => {
                    const isMyOwnRequest = user?.user_id && selectedRequest.requested_by === user.user_id;
                    const canIDecide = selectedRequest.status === 'PENDING' && st.decision === 'PENDING' && !isMyOwnRequest;

                    return (
                      <div key={st.approval_step_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e2e8f0', padding: '10px 14px', borderRadius: '6px', background: st.decision === 'APPROVED' ? '#f0fdf4' : '#fff' }}>
                        <div>
                          <span style={{ fontWeight: '600', marginRight: '8px' }}>Step #{st.step_order}</span>
                          <span style={{ fontSize: '12px', color: '#64748b' }}>
                            {st.approver_id ? `Assigned to ${st.approver_id.slice(0, 8)}` : 'Any Senior Administrator'}
                          </span>
                          <div style={{ fontSize: '12px', color: '#334155', marginTop: '2px' }}>
                            Decision: <strong>{st.decision}</strong> {st.comment && `— "${st.comment}"`}
                          </div>
                        </div>

                        {canIDecide && (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              onClick={() => {
                                setDecisionStepId(st.approval_step_id);
                                setDecisionType('APPROVED');
                              }}
                              style={{ padding: '6px 12px', fontSize: '12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => {
                                setDecisionStepId(st.approval_step_id);
                                setDecisionType('REJECTED');
                              }}
                              style={{ padding: '6px 12px', fontSize: '12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ color: '#64748b', fontSize: '13px' }}>Single-tier peer approval.</p>
              )}
            </div>

            {/* Decision Dialog Panel */}
            {decisionStepId && (
              <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: decisionType === 'APPROVED' ? '#059669' : '#dc2626' }}>
                  Confirm {decisionType === 'APPROVED' ? 'Approval' : 'Rejection'}
                </h4>
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                    Reason / Justification {decisionType === 'REJECTED' && '<span style={{ color: "#dc2626" }}>*required</span>'}:
                  </label>
                  <input
                    type="text"
                    value={decisionReason}
                    onChange={(e) => setDecisionReason(e.target.value)}
                    placeholder="Enter justification for this decision"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                    Optional Decision Comment:
                  </label>
                  <textarea
                    rows={2}
                    value={decisionComment}
                    onChange={(e) => setDecisionComment(e.target.value)}
                    placeholder="Provide any instructions or context for the requester"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    onClick={() => setDecisionStepId(null)}
                    style={{ padding: '6px 12px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleProcessDecision}
                    disabled={submittingDecision || (decisionType === 'REJECTED' && !decisionReason.trim())}
                    style={{
                      padding: '6px 14px',
                      background: decisionType === 'APPROVED' ? '#10b981' : '#ef4444',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '600',
                    }}
                  >
                    {submittingDecision ? 'Processing...' : `Submit ${decisionType}`}
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setSelectedRequest(null)}
                style={{ padding: '8px 16px', background: '#e2e8f0', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Modal */}
      {cancellingRequest && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '480px', maxWidth: '90vw', padding: '24px' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#0f172a' }}>Withdraw Approval Request</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b' }}>
              Are you sure you want to withdraw proposal for <code>{cancellingRequest.operation_type}</code>? This operation cannot be approved after cancellation.
            </p>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                Withdrawal Reason <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <textarea
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="State reason for withdrawing this proposal..."
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setCancellingRequest(null)}
                style={{ padding: '6px 12px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
              >
                Back
              </button>
              <button
                onClick={handleCancelRequest}
                disabled={submittingCancel || !cancelReason.trim()}
                style={{ padding: '6px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
              >
                {submittingCancel ? 'Withdrawing...' : 'Confirm Withdrawal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
