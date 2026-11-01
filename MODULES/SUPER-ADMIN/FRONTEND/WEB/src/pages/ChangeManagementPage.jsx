import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  GitCommit,
  RotateCcw,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RotateCw,
  Search,
  X,
  FileCode2,
  Building2,
  SlidersHorizontal,
  ChevronRight,
  ArrowRight,
  ShieldAlert,
  GitCompare,
  Layers,
  Sparkles,
  Calendar,
  User,
  Ban,
  Check,
} from 'lucide-react';
import {
  fetchChangeSets,
  fetchChangeSet,
  proposeChangeSet,
  withdrawChangeSet,
  proposeRollback,
} from '../services/changeManagementService';
import { fetchCollegesList as fetchColleges } from '../services/collegeService';

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

export default function ChangeManagementPage() {
  const { user } = useAuth();
  const [changeSets, setChangeSets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Filters & Pagination
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [collegeFilter, setCollegeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
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
  const [jsonError, setJsonError] = useState(null);

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
      setIsRefreshing(true);
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
      setIsRefreshing(false);
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
    setJsonError(null);
    let parsedVal;
    try {
      parsedVal = JSON.parse(propJsonValue);
    } catch (pErr) {
      setJsonError('Invalid JSON format in proposed value.');
      return;
    }

    try {
      setSubmittingProposal(true);
      setError(null);

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
      setError(err.response?.data?.error?.message || err.message || 'Failed to submit proposal');
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

  // KPI Metrics
  const totalChangeSets = changeSets.length;
  const pendingCount = useMemo(
    () => changeSets.filter((cs) => cs.status === 'PENDING').length,
    [changeSets]
  );
  const appliedCount = useMemo(
    () => changeSets.filter((cs) => cs.status === 'APPLIED').length,
    [changeSets]
  );
  const rollbackCount = useMemo(
    () => changeSets.filter((cs) => cs.category?.includes('ROLLBACK') || cs.operation_type?.includes('ROLLBACK')).length,
    [changeSets]
  );

  // Filtered change sets with search
  const filteredChangeSets = useMemo(() => {
    if (!searchQuery.trim()) return changeSets;
    const q = searchQuery.toLowerCase();
    return changeSets.filter(
      (cs) =>
        cs.change_set_id?.toLowerCase().includes(q) ||
        cs.target_key?.toLowerCase().includes(q) ||
        cs.category?.toLowerCase().includes(q) ||
        cs.reason?.toLowerCase().includes(q)
    );
  }, [changeSets, searchQuery]);

  return (
    <div className="change-page-container animate-fade-in">
      {/* Top Header & Breadcrumbs */}
      <div className="change-hero-header">
        <div className="change-hero-text">
          <div className="change-breadcrumbs">
            <Link to="/dashboard" className="breadcrumb-link">Dashboard</Link>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current">Configuration Governance</span>
          </div>
          <h1 className="change-title">Configuration Change Management</h1>
          <p className="change-subtitle">
            Version, compare, propose, and safely roll back configuration and entitlement change sets with before/after diffs.
          </p>
        </div>

        <div className="change-header-actions">
          <button
            type="button"
            className="btn-enterprise btn-outline-soft"
            onClick={() => setShowRollbackModal(true)}
            title="Propose historical configuration rollback"
          >
            <RotateCcw size={14} className="text-amber-600" />
            <span>Propose Rollback</span>
          </button>

          <button
            type="button"
            className={`btn-enterprise btn-outline-soft ${isRefreshing ? 'is-loading' : ''}`}
            onClick={loadChangeSets}
            disabled={isRefreshing}
            title="Refresh change sets"
          >
            <RotateCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            className="btn-enterprise btn-primary-blue"
            onClick={() => {
              setShowProposeModal(true);
              setJsonError(null);
            }}
            id="btn-propose-changeset"
          >
            <Plus size={15} />
            <span>Propose Change Set</span>
          </button>
        </div>
      </div>

      {/* Top 4 KPI Stat Cards */}
      <div className="change-kpi-grid">
        {/* Card 1: Total Change Sets */}
        <div className="change-stat-card card-stagger-1">
          <div className="change-stat-header">
            <span className="change-stat-label">Total Change Sets</span>
            <div className="change-stat-icon-wrap blue">
              <GitCommit size={17} />
            </div>
          </div>
          <div className="change-stat-value text-slate-900">
            <CountUpNumber value={totalChangeSets} />
          </div>
          <div className="change-stat-subtext">Versioned configuration updates</div>
          <div className="change-stat-accent-bar blue" />
        </div>

        {/* Card 2: Pending Reviews */}
        <div className="change-stat-card card-stagger-2">
          <div className="change-stat-header">
            <span className="change-stat-label">Pending Approval</span>
            <div className="change-stat-icon-wrap amber">
              <Clock size={17} />
            </div>
          </div>
          <div className="change-stat-value text-amber-600">
            <CountUpNumber value={pendingCount} />
          </div>
          <div className="change-stat-subtext">Maker-checker approval queue</div>
          <div className="change-stat-accent-bar amber" />
        </div>

        {/* Card 3: Applied & Live */}
        <div className="change-stat-card card-stagger-3">
          <div className="change-stat-header">
            <span className="change-stat-label">Applied &amp; Active</span>
            <div className="change-stat-icon-wrap green">
              <CheckCircle2 size={17} />
            </div>
          </div>
          <div className="change-stat-value text-emerald-600">
            <CountUpNumber value={appliedCount} />
          </div>
          <div className="change-stat-subtext">Successfully applied to tenants</div>
          <div className="change-stat-accent-bar green" />
        </div>

        {/* Card 4: Rollback Operations */}
        <div className="change-stat-card card-stagger-4">
          <div className="change-stat-header">
            <span className="change-stat-label">Rollback History</span>
            <div className="change-stat-icon-wrap purple">
              <RotateCcw size={17} />
            </div>
          </div>
          <div className="change-stat-value text-purple-600">
            <CountUpNumber value={rollbackCount} />
          </div>
          <div className="change-stat-subtext">Historical state restorations</div>
          <div className="change-stat-accent-bar purple" />
        </div>
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div className="change-feedback-banner success animate-slide-up">
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
        <div className="change-feedback-banner danger animate-slide-up">
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
      <div className="change-main-card card-stagger-4">
        {/* Controls Toolbar: Filters & Search */}
        <div className="change-toolbar">
          <div className="change-filters-group">
            <div className="filter-select-item">
              <span className="filter-item-label">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="permissions-select-input"
              >
                <option value="">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="APPLIED">Applied</option>
                <option value="REJECTED">Rejected</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            <div className="filter-select-item">
              <span className="filter-item-label">Category:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="permissions-select-input"
              >
                <option value="">All Categories</option>
                <option value="COLLEGE_SETTING">College Setting</option>
                <option value="COLLEGE_MODULE">College Module Access</option>
                <option value="COLLEGE_STATUS">College Status / Lifecycle</option>
                <option value="SYSTEM_SETTING">Global System Setting</option>
              </select>
            </div>

            <div className="filter-select-item">
              <span className="filter-item-label">Tenant:</span>
              <select
                value={collegeFilter}
                onChange={(e) => setCollegeFilter(e.target.value)}
                className="permissions-select-input"
              >
                <option value="">All Colleges</option>
                {colleges.map((c) => (
                  <option key={c.college_id} value={c.college_id}>
                    {c.name} ({c.college_code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="change-search-box">
            <Search size={15} className="search-icon" />
            <input
              type="text"
              placeholder="Search target key, ID, or reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="change-search-input"
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

        {/* Directory Table / Loading / Empty */}
        {loading ? (
          <div className="change-loading-state">
            <div className="loading-spinner-blue" />
            <div className="loading-state-title">Loading Change Sets...</div>
            <div className="loading-state-sub">Fetching version hashes and diff comparison records.</div>
          </div>
        ) : filteredChangeSets.length === 0 ? (
          <div className="change-empty-state">
            <div className="empty-state-badge-stage">
              <div className="empty-state-badge-pulse" />
              <div className="empty-state-icon-badge">
                <GitCommit size={32} className="text-blue-600" />
              </div>
            </div>
            <h3 className="empty-state-heading">No Change Sets Match Query</h3>
            <p className="empty-state-description">Try adjusting your filters or propose a new configuration change set.</p>
          </div>
        ) : (
          <div className="change-table-responsive">
            <table className="change-table">
              <thead>
                <tr>
                  <th>Change Set ID</th>
                  <th>Category</th>
                  <th>Target Parameter</th>
                  <th>Target Tenant</th>
                  <th>Governance Status</th>
                  <th>Created Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredChangeSets.map((cs) => {
                  const isPending = cs.status === 'PENDING';
                  const isApplied = cs.status === 'APPLIED';
                  const isApproved = cs.status === 'APPROVED';

                  return (
                    <tr key={cs.change_set_id} className="change-table-row">
                      <td>
                        <span className="code-pill font-mono">
                          {cs.change_set_id ? cs.change_set_id.substring(0, 8) : '—'}...
                        </span>
                      </td>

                      <td>
                        <span className="category-tag">
                          {cs.category}
                        </span>
                      </td>

                      <td>
                        <div className="target-key-cell">
                          <code className="target-key-text">{cs.target_key || '—'}</code>
                        </div>
                      </td>

                      <td>
                        <div className="tenant-cell">
                          <Building2 size={13} className="text-slate-400" />
                          <span>{cs.college_name || cs.college_id ? (cs.college_name || cs.college_id.substring(0, 8)) : 'Global Platform'}</span>
                        </div>
                      </td>

                      <td>
                        <span className={`node-status-badge ${cs.status?.toLowerCase()}`}>
                          {isPending && <Clock size={11} />}
                          {isApproved && <CheckCircle2 size={11} />}
                          {isApplied && <CheckCircle2 size={11} />}
                          {cs.status === 'REJECTED' && <XCircle size={11} />}
                          {cs.status === 'CANCELLED' && <Ban size={11} />}
                          <span>{cs.status}</span>
                        </span>
                      </td>

                      <td className="text-xs text-slate-500">
                        {cs.created_at ? new Date(cs.created_at).toLocaleDateString() : '—'}
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div className="change-action-buttons">
                          <button
                            type="button"
                            className="btn-table-action"
                            onClick={() => handleOpenDetail(cs)}
                            title="Inspect visual diff"
                          >
                            <GitCompare size={12} />
                            <span>Inspect Diff</span>
                          </button>

                          {isPending && cs.proposed_by === user?.user_id && (
                            <button
                              type="button"
                              className="btn-table-action danger"
                              onClick={() => handleWithdraw(cs.change_set_id)}
                              title="Withdraw change set"
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

      {/* MODAL 1: Diff Inspector Modal */}
      {selectedChangeSet && (
        <div className="modal-backdrop-blur">
          <div className="modal-dialog-card animate-badge-pop" style={{ maxWidth: '840px', maxHeight: '90vh' }}>
            <div className="modal-dialog-header">
              <div className="modal-header-icon-wrap blue">
                <GitCompare size={20} />
              </div>
              <div className="modal-header-text">
                <h3 className="modal-header-title">
                  Change Set Diff: {selectedChangeSet.target_key || selectedChangeSet.category}
                </h3>
                <div className="role-modal-badges">
                  <span className="code-pill font-mono">{selectedChangeSet.change_set_id}</span>
                  <span className={`node-status-badge ${selectedChangeSet.status?.toLowerCase()}`}>
                    {selectedChangeSet.status}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => setSelectedChangeSet(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-dialog-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {detailLoading ? (
                <div className="change-loading-state" style={{ padding: '24px' }}>
                  <div className="loading-spinner-blue" />
                  <div className="loading-state-title">Computing Diff Comparison...</div>
                </div>
              ) : (
                <>
                  <div className="role-detail-summary-grid">
                    <div className="summary-item-card">
                      <span className="summary-label">Category</span>
                      <div className="summary-val text-blue-600" style={{ fontSize: '0.9rem' }}>
                        {selectedChangeSet.category}
                      </div>
                    </div>
                    <div className="summary-item-card">
                      <span className="summary-label">Target Scope</span>
                      <div className="summary-val text-slate-800" style={{ fontSize: '0.85rem' }}>
                        {selectedChangeSet.college_name || selectedChangeSet.college_id || 'Global Platform'}
                      </div>
                    </div>
                    <div className="summary-item-card">
                      <span className="summary-label">Audit Reason</span>
                      <div className="summary-val text-slate-600" style={{ fontSize: '0.8rem', fontWeight: 500 }}>
                        {selectedChangeSet.reason || 'None provided'}
                      </div>
                    </div>
                  </div>

                  <h4 className="section-subheading mt-4">Before vs After Comparison</h4>

                  {diffItems && diffItems.length > 0 ? (
                    <div className="diff-items-container">
                      {diffItems.map((d, idx) => (
                        <div key={idx} className="diff-card">
                          <div className="diff-field-name">{d.field_name || selectedChangeSet.target_key}</div>
                          <div className="diff-split-view">
                            <div className="diff-col before">
                              <div className="diff-col-header text-rose-700 bg-rose-50">
                                Previous / Current State
                              </div>
                              <pre className="diff-pre">
                                {JSON.stringify(d.old_value, null, 2) || '(Not set / Default)'}
                              </pre>
                            </div>
                            <div className="diff-col after">
                              <div className="diff-col-header text-emerald-700 bg-emerald-50">
                                Proposed State
                              </div>
                              <pre className="diff-pre">
                                {JSON.stringify(d.new_value, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="diff-split-view">
                      <div className="diff-col before">
                        <div className="diff-col-header text-slate-700 bg-slate-100">
                          Current Persisted Value
                        </div>
                        <pre className="diff-pre">
                          {selectedChangeSet.current_value
                            ? JSON.stringify(selectedChangeSet.current_value, null, 2)
                            : '(Baseline Setting)'}
                        </pre>
                      </div>
                      <div className="diff-col after">
                        <div className="diff-col-header text-emerald-700 bg-emerald-50">
                          Proposed Payload Value
                        </div>
                        <pre className="diff-pre">
                          {selectedChangeSet.proposed_value
                            ? JSON.stringify(selectedChangeSet.proposed_value, null, 2)
                            : '(Empty)'}
                        </pre>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="modal-dialog-footer">
              <button
                type="button"
                className="btn-enterprise btn-outline-soft"
                onClick={() => setSelectedChangeSet(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Propose Change Set */}
      {showProposeModal && (
        <div className="modal-backdrop-blur">
          <div className="modal-dialog-card animate-badge-pop" style={{ maxWidth: '640px' }}>
            <div className="modal-dialog-header">
              <div className="modal-header-icon-wrap blue">
                <Plus size={20} />
              </div>
              <div className="modal-header-text">
                <h3 className="modal-header-title">Propose Configuration Change Set</h3>
                <p className="modal-header-subtitle">
                  Create a version-controlled proposal routed through peer review.
                </p>
              </div>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => setShowProposeModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateProposal}>
              <div className="modal-dialog-body">
                {jsonError && (
                  <div className="modal-error-notice">
                    <AlertCircle size={15} />
                    <span>{jsonError}</span>
                  </div>
                )}

                <div className="form-group-custom">
                  <label className="form-label-custom">Category *</label>
                  <select
                    value={propCategory}
                    onChange={(e) => setPropCategory(e.target.value)}
                    className="form-input-custom"
                  >
                    <option value="COLLEGE_SETTING">College Setting</option>
                    <option value="COLLEGE_MODULE">College Module Access</option>
                    <option value="COLLEGE_STATUS">College Status / Lifecycle</option>
                    <option value="SYSTEM_SETTING">Global System Setting</option>
                  </select>
                </div>

                <div className="form-group-custom">
                  <label className="form-label-custom">Target College (Optional for global)</label>
                  <select
                    value={propCollegeId}
                    onChange={(e) => setPropCollegeId(e.target.value)}
                    className="form-input-custom"
                  >
                    <option value="">Global Platform / Multi-Tenant</option>
                    {colleges.map((c) => (
                      <option key={c.college_id} value={c.college_id}>
                        {c.name} ({c.college_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group-custom">
                  <label className="form-label-custom">Target Parameter Key *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. max_students_per_room or biometric_gate_pass_enabled"
                    value={propTargetKey}
                    onChange={(e) => setPropTargetKey(e.target.value)}
                    className="form-input-custom font-mono"
                  />
                </div>

                <div className="form-group-custom">
                  <label className="form-label-custom">Proposed Value (Valid JSON) *</label>
                  <textarea
                    rows={5}
                    required
                    value={propJsonValue}
                    onChange={(e) => {
                      setPropJsonValue(e.target.value);
                      setJsonError(null);
                    }}
                    className="form-input-custom textarea font-mono text-xs"
                  />
                </div>

                <div className="form-group-custom">
                  <label className="form-label-custom">Justification Reason *</label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Audit reason required for Maker-Checker queue..."
                    value={propReason}
                    onChange={(e) => setPropReason(e.target.value)}
                    className="form-input-custom textarea"
                  />
                </div>
              </div>

              <div className="modal-dialog-footer">
                <button
                  type="button"
                  className="btn-enterprise btn-outline-soft"
                  onClick={() => setShowProposeModal(false)}
                  disabled={submittingProposal}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-enterprise btn-primary-blue"
                  disabled={submittingProposal}
                >
                  {submittingProposal ? 'Proposing...' : 'Submit to Queue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Propose Rollback */}
      {showRollbackModal && (
        <div className="modal-backdrop-blur">
          <div className="modal-dialog-card animate-badge-pop" style={{ maxWidth: '540px' }}>
            <div className="modal-dialog-header">
              <div className="modal-header-icon-wrap amber">
                <RotateCcw size={20} />
              </div>
              <div className="modal-header-text">
                <h3 className="modal-header-title">Propose Historical Rollback</h3>
                <p className="modal-header-subtitle">
                  Safely revert a specific historical mutation via peer authorization.
                </p>
              </div>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => setShowRollbackModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleRollbackSubmit}>
              <div className="modal-dialog-body">
                <div className="form-group-custom">
                  <label className="form-label-custom">Tenant College *</label>
                  <select
                    value={rollbackCollegeId}
                    onChange={(e) => setRollbackCollegeId(e.target.value)}
                    className="form-input-custom"
                    required
                  >
                    <option value="">Select target institution...</option>
                    {colleges.map((c) => (
                      <option key={c.college_id} value={c.college_id}>
                        {c.name} ({c.college_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group-custom">
                  <label className="form-label-custom">Audit Log ID to Revert *</label>
                  <input
                    type="text"
                    required
                    placeholder="UUID of the historical audit entry"
                    value={rollbackAuditId}
                    onChange={(e) => setRollbackAuditId(e.target.value)}
                    className="form-input-custom font-mono"
                  />
                  <span className="text-xs text-slate-500 mt-1">
                    Copy the Audit Log ID from the Audit Logs explorer.
                  </span>
                </div>

                <div className="form-group-custom">
                  <label className="form-label-custom">Rollback Justification *</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Explain why this historical change must be reversed..."
                    value={rollbackReason}
                    onChange={(e) => setRollbackReason(e.target.value)}
                    className="form-input-custom textarea"
                  />
                </div>
              </div>

              <div className="modal-dialog-footer">
                <button
                  type="button"
                  className="btn-enterprise btn-outline-soft"
                  onClick={() => setShowRollbackModal(false)}
                  disabled={submittingRollback}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-enterprise btn-primary-blue"
                  disabled={submittingRollback}
                >
                  {submittingRollback ? 'Submitting...' : 'Submit Rollback Proposal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
