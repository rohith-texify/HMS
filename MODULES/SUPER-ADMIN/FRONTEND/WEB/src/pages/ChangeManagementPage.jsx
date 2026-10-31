import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  fetchChangeSets,
  fetchChangeSet,
  proposeChangeSet,
  withdrawChangeSet,
  proposeRollback,
} from '../services/changeManagementService';
import { fetchCollegesList as fetchColleges } from '../services/collegeService';

export default function ChangeManagementPage() {
  const { user } = useAuth();
  const [changeSets, setChangeSets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Filters & Pagination
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [collegeFilter, setCollegeFilter] = useState('');
  const [colleges, setColleges] = useState([]);

  // Detail & Diff Modal
  const [selectedChangeSet, setSelectedChangeSet] = useState(null);
  const [diffItems, setDiffItems] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Proposal Creation Modal
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [propCategory, setPropCategory] = useState('COLLEGE_SETTING');
  const [propCollegeId, setPropCollegeId] = useState('');
  const [propTargetKey, setPropTargetKey] = useState('');
  const [propJsonValue, setPropJsonValue] = useState('{\n  "setting_value": "example"\n}');
  const [propReason, setPropReason] = useState('');
  const [submittingProposal, setSubmittingProposal] = useState(false);

  // Rollback Modal
  const [showRollbackModal, setShowRollbackModal] = useState(false);
  const [rollbackCollegeId, setRollbackCollegeId] = useState('');
  const [rollbackAuditId, setRollbackAuditId] = useState('');
  const [rollbackReason, setRollbackReason] = useState('');
  const [submittingRollback, setSubmittingRollback] = useState(false);

  // Load Colleges for selectors
  useEffect(() => {
    fetchColleges({ limit: 100 })
      .then((res) => {
        setColleges(res.data?.colleges || res.colleges || []);
      })
      .catch((err) => console.error('Failed to load colleges for filter:', err));
  }, []);

  // Load Change Sets
  const loadChangeSets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { limit: 50, offset: 0 };
      if (statusFilter) params.status = statusFilter;
      if (categoryFilter) params.category = categoryFilter;
      if (collegeFilter) params.college_id = collegeFilter;

      const res = await fetchChangeSets(params);
      setChangeSets(res.data?.change_sets || res.change_sets || []);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to load change sets');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, collegeFilter]);

  useEffect(() => {
    loadChangeSets();
  }, [loadChangeSets]);

  // Open Detail / Diff
  const handleOpenDetail = async (cs) => {
    try {
      setDetailLoading(true);
      setSelectedChangeSet(cs);
      const res = await fetchChangeSet(cs.change_set_id);
      setSelectedChangeSet(res.data?.change_set || res.change_set || cs);
      setDiffItems(res.data?.diffs || res.diffs || []);
    } catch (err) {
      setError('Failed to load change set diff: ' + (err.response?.data?.error?.message || err.message));
    } finally {
      setDetailLoading(false);
    }
  };

  // Submit Proposal
  const handleCreateProposal = async (e) => {
    e.preventDefault();
    try {
      setSubmittingProposal(true);
      setError(null);

      let parsedVal;
      try {
        parsedVal = JSON.parse(propJsonValue);
      } catch (pErr) {
        throw new Error('Invalid JSON format in proposed value');
      }

      const payload = {
        category: propCategory,
        operation_type: propCategory === 'COLLEGE_SETTING' ? 'COLLEGE_SETTING_UPDATE' : 'COLLEGE_MODULE_UPDATE',
        college_id: propCollegeId || undefined,
        target_key: propTargetKey.trim(),
        proposed_value: parsedVal,
        reason: propReason.trim(),
        require_approval: true,
      };

      await proposeChangeSet(payload);
      setFeedback('Change set proposal submitted successfully and routed to Maker-Checker queue.');
      setShowProposeModal(false);
      setPropTargetKey('');
      setPropReason('');
      loadChangeSets();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to submit change proposal');
    } finally {
      setSubmittingProposal(false);
    }
  };

  // Submit Rollback Proposal
  const handleRollbackSubmit = async (e) => {
    e.preventDefault();
    if (!rollbackCollegeId || !rollbackAuditId || !rollbackReason.trim()) return;
    try {
      setSubmittingRollback(true);
      setError(null);
      await proposeRollback(rollbackCollegeId, rollbackAuditId.trim(), rollbackReason.trim());
      setFeedback('Rollback proposal submitted and safely routed through senior peer approval.');
      setShowRollbackModal(false);
      setRollbackAuditId('');
      setRollbackReason('');
      loadChangeSets();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to propose rollback');
    } finally {
      setSubmittingRollback(false);
    }
  };

  // Withdraw Change Set
  const handleWithdraw = async (changeSetId) => {
    const reason = window.prompt('Please enter the reason for withdrawing this change set:');
    if (!reason || !reason.trim()) return;
    try {
      setLoading(true);
      await withdrawChangeSet(changeSetId, reason.trim());
      setFeedback('Change set successfully withdrawn.');
      setSelectedChangeSet(null);
      loadChangeSets();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to withdraw change set');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return <span className="badge badge-warning">⏳ Pending Approval</span>;
      case 'APPROVED':
        return <span className="badge badge-success">✅ Approved</span>;
      case 'APPLIED':
        return <span className="badge badge-info">🚀 Applied / Executed</span>;
      case 'REJECTED':
        return <span className="badge badge-danger">❌ Rejected</span>;
      case 'CANCELLED':
        return <span className="badge badge-secondary">🚫 Cancelled</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  return (
    <div className="change-management-page" style={{ padding: '24px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 6px 0', color: '#0f172a' }}>
            🔄 Configuration Change Management
          </h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
            Version, compare, propose, and safely roll back configuration and entitlement change sets with before/after diffs.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setShowRollbackModal(true)} className="btn btn-outline btn-sm" style={{ borderColor: '#f59e0b', color: '#b45309' }}>
            ⏪ Propose Rollback
          </button>
          <button onClick={() => setShowProposeModal(true)} className="btn btn-primary btn-sm">
            ➕ Propose Change Set
          </button>
        </div>
      </div>

      {/* Notifications */}
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

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>Status:</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}>
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="APPLIED">Applied</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>Category:</label>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}>
            <option value="">All Categories</option>
            <option value="COLLEGE_SETTING">College Setting</option>
            <option value="COLLEGE_MODULE">College Module Access</option>
            <option value="COLLEGE_STATUS">College Status / Lifecycle</option>
            <option value="SYSTEM_SETTING">Global System Setting</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>Tenant College:</label>
          <select value={collegeFilter} onChange={(e) => setCollegeFilter(e.target.value)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}>
            <option value="">All Colleges</option>
            {colleges.map((c) => (
              <option key={c.college_id} value={c.college_id}>{c.name} ({c.college_code})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Change Sets Table */}
      <div className="card" style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading change sets directory...</div>
        ) : changeSets.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <span style={{ fontSize: '36px', display: 'block', marginBottom: '12px' }}>📂</span>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', color: '#0f172a' }}>No Change Sets Found</h3>
            <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
              Create a change set proposal to version and audit configuration modifications.
            </p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '12px 16px', fontWeight: '600' }}>Change Set</th>
                <th style={{ padding: '12px 16px', fontWeight: '600' }}>Category</th>
                <th style={{ padding: '12px 16px', fontWeight: '600' }}>Target / Scope</th>
                <th style={{ padding: '12px 16px', fontWeight: '600' }}>Status</th>
                <th style={{ padding: '12px 16px', fontWeight: '600' }}>Proposal Reason</th>
                <th style={{ padding: '12px 16px', fontWeight: '600' }}>Submitted</th>
                <th style={{ padding: '12px 16px', fontWeight: '600', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {changeSets.map((cs) => {
                const isMyOwn = user?.user_id && cs.requested_by === user.user_id;
                return (
                  <tr key={cs.change_set_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', fontWeight: '600', color: '#0f172a' }}>
                      <code>{cs.target_key}</code>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className="badge badge-outline">{cs.category}</span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#475569' }}>
                      {cs.college_id ? `College (${cs.college_id.slice(0, 8)}...)` : 'Platform Global'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>{getStatusBadge(cs.status)}</td>
                    <td style={{ padding: '12px 16px', color: '#64748b', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {cs.reason || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748b' }}>
                      {new Date(cs.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleOpenDetail(cs)}
                          style={{ padding: '4px 10px', fontSize: '12px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Diff Inspection
                        </button>
                        {cs.status === 'PENDING' && isMyOwn && (
                          <button
                            onClick={() => handleWithdraw(cs.change_set_id)}
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

      {/* Diff & Detail Modal */}
      {selectedChangeSet && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '760px', maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 4px 0', color: '#0f172a' }}>
                  Configuration Diff: {selectedChangeSet.target_key}
                </h2>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Change Set ID: {selectedChangeSet.change_set_id}</span>
              </div>
              <button onClick={() => setSelectedChangeSet(null)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: '16px', background: '#f8fafc', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
              <div><strong>Status:</strong> {getStatusBadge(selectedChangeSet.status)}</div>
              <div><strong>Category:</strong> {selectedChangeSet.category}</div>
              <div><strong>Scope:</strong> {selectedChangeSet.college_id ? 'College Tenant' : 'Platform Global'}</div>
            </div>

            {/* Granular Field Diff Table */}
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#0f172a' }}>Before / Proposed Granular Comparison:</h4>
              {detailLoading ? (
                <p style={{ color: '#64748b' }}>Computing granular diffs...</p>
              ) : diffItems.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '13px' }}>No field-level diffs detected.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', border: '1px solid #e2e8f0' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', textAlign: 'left', color: '#475569' }}>
                      <th style={{ padding: '8px 12px' }}>Attribute Key</th>
                      <th style={{ padding: '8px 12px' }}>Original (Before)</th>
                      <th style={{ padding: '8px 12px' }}>Proposed (After)</th>
                      <th style={{ padding: '8px 12px' }}>Change Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diffItems.map((d) => (
                      <tr key={d.key} style={{ borderBottom: '1px solid #e2e8f0', background: d.changeType === 'MODIFIED' ? '#fefce8' : d.changeType === 'ADDED' ? '#f0fdf4' : d.changeType === 'REMOVED' ? '#fef2f2' : '#fff' }}>
                        <td style={{ padding: '8px 12px', fontWeight: '600' }}>{d.key}</td>
                        <td style={{ padding: '8px 12px', color: '#64748b' }}>
                          <code>{d.is_sensitive ? '••••••••' : JSON.stringify(d.original_value)}</code>
                        </td>
                        <td style={{ padding: '8px 12px', color: '#0f172a', fontWeight: '500' }}>
                          <code>{d.is_sensitive ? '••••••••' : JSON.stringify(d.proposed_value)}</code>
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '600',
                            background: d.changeType === 'MODIFIED' ? '#fef08a' : d.changeType === 'ADDED' ? '#bbf7d0' : d.changeType === 'REMOVED' ? '#fecaca' : '#e2e8f0',
                            color: d.changeType === 'MODIFIED' ? '#854d0e' : d.changeType === 'ADDED' ? '#166534' : d.changeType === 'REMOVED' ? '#991b1b' : '#475569',
                          }}>
                            {d.changeType}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setSelectedChangeSet(null)} style={{ padding: '8px 16px', background: '#e2e8f0', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Propose Change Set Modal */}
      {showProposeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '560px', maxWidth: '90vw', padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#0f172a' }}>Propose Configuration Change Set</h3>
            <form onSubmit={handleCreateProposal}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>Change Category *</label>
                <select value={propCategory} onChange={(e) => setPropCategory(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}>
                  <option value="COLLEGE_SETTING">College Tenant Setting</option>
                  <option value="COLLEGE_MODULE">College Module Entitlement</option>
                  <option value="COLLEGE_STATUS">College Status / Lifecycle</option>
                </select>
              </div>

              {propCategory !== 'SYSTEM_SETTING' && (
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>Target College *</label>
                  <select value={propCollegeId} onChange={(e) => setPropCollegeId(e.target.value)} required style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}>
                    <option value="">Select a College</option>
                    {colleges.map((c) => (
                      <option key={c.college_id} value={c.college_id}>{c.name} ({c.college_code})</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>Target Setting Key / Identifier *</label>
                <input
                  type="text"
                  value={propTargetKey}
                  onChange={(e) => setPropTargetKey(e.target.value)}
                  placeholder="e.g. attendance_mode, max_visitors_per_student, etc."
                  required
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>Proposed Value (JSON) *</label>
                <textarea
                  rows={4}
                  value={propJsonValue}
                  onChange={(e) => setPropJsonValue(e.target.value)}
                  required
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontFamily: 'monospace', fontSize: '12px' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>Proposal Reason *</label>
                <textarea
                  rows={2}
                  value={propReason}
                  onChange={(e) => setPropReason(e.target.value)}
                  placeholder="Explain why this change is necessary..."
                  required
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setShowProposeModal(false)} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                  Cancel
                </button>
                <button type="submit" disabled={submittingProposal} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '13px' }}>
                  {submittingProposal ? 'Submitting...' : 'Submit Proposal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Propose Rollback Modal */}
      {showRollbackModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '520px', maxWidth: '90vw', padding: '24px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#0f172a' }}>⏪ Propose Configuration Rollback</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b' }}>
              Rollback generates an auditable, peer-approved change set that restores a retained historical snapshot from platform audit logs.
            </p>
            <form onSubmit={handleRollbackSubmit}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>Target College *</label>
                <select value={rollbackCollegeId} onChange={(e) => setRollbackCollegeId(e.target.value)} required style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}>
                  <option value="">Select College</option>
                  {colleges.map((c) => (
                    <option key={c.college_id} value={c.college_id}>{c.name} ({c.college_code})</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>Historical Audit Log ID *</label>
                <input
                  type="text"
                  value={rollbackAuditId}
                  onChange={(e) => setRollbackAuditId(e.target.value)}
                  placeholder="UUID of historical audit snapshot (from Audit Log viewer)"
                  required
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>Rollback Justification *</label>
                <textarea
                  rows={3}
                  value={rollbackReason}
                  onChange={(e) => setRollbackReason(e.target.value)}
                  placeholder="State operational reason for reverting to this previous configuration version..."
                  required
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setShowRollbackModal(false)} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                  Cancel
                </button>
                <button type="submit" disabled={submittingRollback} style={{ padding: '8px 16px', background: '#b45309', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                  {submittingRollback ? 'Proposing...' : 'Submit Rollback Proposal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
