import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { fetchCollegesList, fetchCollegeById } from '../services/collegeService';
import {
  fetchModuleCatalogue,
  fetchCollegeEntitlementMatrix,
  previewModuleImpact,
  requestModuleEntitlementChange,
  fetchModuleHistory,
  fetchEntitlementTemplates,
  applyTemplateToCollege,
  DEFAULT_MODULES,
} from '../services/moduleManagementService';

export default function ModulesPage() {
  const { id: routeCollegeId } = useParams();
  const navigate = useNavigate();

  // Active view tab: 'matrix' | 'catalogue' | 'history' | 'templates'
  const [activeTab, setActiveTab] = useState('matrix');

  // College Selection
  const [colleges, setColleges] = useState([]);
  const [selectedCollegeId, setSelectedCollegeId] = useState(routeCollegeId || '');
  const [currentCollege, setCurrentCollege] = useState(null);

  // Data states
  const [matrix, setMatrix] = useState([]);
  const [catalogue, setCatalogue] = useState(DEFAULT_MODULES);
  const [historyRecords, setHistoryRecords] = useState([]);
  const [templates, setTemplates] = useState([]);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [filterKind, setFilterKind] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Loading & Error States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successNotice, setSuccessNotice] = useState(null);

  // Action Dialog State
  const [actionModal, setActionModal] = useState({
    isOpen: false,
    item: null,
    targetStatus: 'ACTIVE',
    targetMode: 'FULL',
    effectiveFrom: '',
    effectiveTo: '',
    reason: '',
    requestApproval: false,
    previewLoading: false,
    preview: null,
    submitting: false,
    error: null,
  });

  // Template Modal State
  const [templateModal, setTemplateModal] = useState({
    isOpen: false,
    templateId: '',
    submitting: false,
    error: null,
  });

  const abortRef = useRef(null);

  // 1. Load Colleges List
  useEffect(() => {
    let isMounted = true;
    async function loadColleges() {
      try {
        const res = await fetchCollegesList({ limit: 100 });
        const list = Array.isArray(res) ? res : res?.colleges || [];
        if (isMounted) {
          setColleges(list);
          if (!routeCollegeId && list.length > 0) {
            setSelectedCollegeId(list[0].college_id);
          }
        }
      } catch (err) {
        console.error('Failed to load colleges:', err);
      }
    }
    loadColleges();
    return () => {
      isMounted = false;
    };
  }, [routeCollegeId]);

  // Synchronize route change
  useEffect(() => {
    if (routeCollegeId) {
      setSelectedCollegeId(routeCollegeId);
    }
  }, [routeCollegeId]);

  // 2. Load Selected College Details & Data
  const loadData = async () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      if (selectedCollegeId) {
        const col = await fetchCollegeById(selectedCollegeId, controller.signal);
        setCurrentCollege(col);

        const mData = await fetchCollegeEntitlementMatrix(selectedCollegeId, controller.signal);
        setMatrix(mData || []);

        const hData = await fetchModuleHistory(selectedCollegeId, null, 50, 0, controller.signal);
        setHistoryRecords(hData.history || []);
      }

      // Always load catalogue & templates
      const catData = await fetchModuleCatalogue({}, controller.signal);
      setCatalogue(catData.modules || []);

      const tData = await fetchEntitlementTemplates(controller.signal);
      setTemplates(tData || []);
    } catch (err) {
      if (err.name !== 'CanceledError' && !err.isCanceled) {
        setError(err.message || 'Failed to load module entitlements');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCollegeId]);

  const handleCollegeChange = (e) => {
    const newId = e.target.value;
    setSelectedCollegeId(newId);
    if (newId) {
      navigate(`/colleges/${newId}/modules`);
    }
  };

  // Open Action Modal
  const openActionModal = async (item, initialStatus, initialMode) => {
    setActionModal({
      isOpen: true,
      item,
      targetStatus: initialStatus || item.ConfiguredStatus || 'ACTIVE',
      targetMode: initialMode || item.ConfiguredMode || 'FULL',
      effectiveFrom: '',
      effectiveTo: '',
      reason: '',
      requestApproval: false,
      previewLoading: true,
      preview: null,
      submitting: false,
      error: null,
    });

    try {
      const prev = await previewModuleImpact(selectedCollegeId, item.ModuleID, {
        status: initialStatus || item.ConfiguredStatus,
        mode: initialMode || item.ConfiguredMode,
      });
      setActionModal((prevModal) => ({
        ...prevModal,
        previewLoading: false,
        preview: prev,
        requestApproval: prev.requires_approval,
      }));
    } catch (err) {
      setActionModal((prevModal) => ({
        ...prevModal,
        previewLoading: false,
        error: err.message || 'Failed to generate impact preview',
      }));
    }
  };

  // Submit Action Modal
  const handleActionSubmit = async (e) => {
    e.preventDefault();
    if (!actionModal.reason.trim()) {
      setActionModal((prev) => ({
        ...prev,
        error: 'A meaningful business reason is strictly required for entitlement changes',
      }));
      return;
    }

    setActionModal((prev) => ({ ...prev, submitting: true, error: null }));

    try {
      const payload = {
        status: actionModal.targetStatus,
        mode: actionModal.targetMode,
        reason: actionModal.reason.trim(),
        change_reason: actionModal.reason.trim(),
        request_approval: actionModal.requestApproval,
      };

      if (actionModal.effectiveFrom) {
        payload.effective_from = new Date(actionModal.effectiveFrom).toISOString();
      }
      if (actionModal.effectiveTo) {
        payload.effective_to = new Date(actionModal.effectiveTo).toISOString();
      }

      const res = await requestModuleEntitlementChange(
        selectedCollegeId,
        actionModal.item.ModuleID,
        payload
      );

      setActionModal((prev) => ({ ...prev, isOpen: false }));
      setSuccessNotice(
        res.requires_approval
          ? 'Operation submitted for Super Admin Maker-Checker approval.'
          : 'Entitlement state transition applied successfully.'
      );

      // Refresh table
      loadData();
    } catch (err) {
      setActionModal((prev) => ({
        ...prev,
        submitting: false,
        error: err.message || 'Operation failed',
      }));
    }
  };

  // Submit Template Application
  const handleApplyTemplate = async (e) => {
    e.preventDefault();
    if (!templateModal.templateId) {
      setTemplateModal((prev) => ({ ...prev, error: 'Please select an entitlement template' }));
      return;
    }

    setTemplateModal((prev) => ({ ...prev, submitting: true, error: null }));
    try {
      await applyTemplateToCollege(templateModal.templateId, selectedCollegeId);
      setTemplateModal({ isOpen: false, templateId: '', submitting: false, error: null });
      setSuccessNotice('Entitlement template successfully applied to college.');
      loadData();
    } catch (err) {
      setTemplateModal((prev) => ({
        ...prev,
        submitting: false,
        error: err.message || 'Template application failed',
      }));
    }
  };

  // Filter matrix records
  const filteredMatrix = matrix.filter((item) => {
    if (filterKind !== 'ALL' && item.Kind !== filterKind) return false;
    if (filterStatus !== 'ALL') {
      if (filterStatus === 'ACTIVE' && item.EffectiveStatus !== 'ACTIVE') return false;
      if (filterStatus === 'DISABLED' && item.EffectiveStatus === 'ACTIVE') return false;
      if (filterStatus === 'READ_ONLY' && item.EffectiveMode !== 'READ_ONLY') return false;
      if (filterStatus === 'SCHEDULED' && item.EffectiveStatus !== 'SCHEDULED') return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.ModuleName.toLowerCase().includes(q) ||
        item.ModuleCode.toLowerCase().includes(q) ||
        (item.ParentName && item.ParentName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="card">
      {/* Page Header */}
      <div className="card-header" style={{ alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="card-title" style={{ margin: 0 }}>
              📦 Module Management & Entitlements
            </h1>
            {currentCollege && (
              <span className={`badge ${currentCollege.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`}>
                {currentCollege.status}
              </span>
            )}
          </div>
          <p className="card-subtitle" style={{ marginTop: '4px' }}>
            Authoritative module catalogue, college entitlement matrix, dependency enforcement, and workflow freeze control.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {selectedCollegeId && (
            <Link to={`/colleges/${selectedCollegeId}`} className="btn btn-outline btn-sm">
              ← College Profile
            </Link>
          )}
          <Link to="/dashboard" className="btn btn-outline btn-sm">
            Dashboard
          </Link>
        </div>
      </div>

      {/* College Switcher Banner */}
      <div
        style={{
          background: 'var(--bg-secondary, #f8fafc)',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-color, #e2e8f0)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label htmlFor="college-select" style={{ fontWeight: 600, fontSize: '0.9rem' }}>
            Target College:
          </label>
          <select
            id="college-select"
            value={selectedCollegeId}
            onChange={handleCollegeChange}
            className="input-select"
            style={{ minWidth: '280px', padding: '6px 10px', fontSize: '0.9rem' }}
          >
            {(Array.isArray(colleges) ? colleges : []).map((c) => (
              <option key={c.college_id} value={c.college_id}>
                {c.name} ({c.college_code}) — {c.status}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-sm btn-outline"
            onClick={() => setTemplateModal({ isOpen: true, templateId: '', submitting: false, error: null })}
            disabled={!selectedCollegeId}
          >
            📋 Bulk Template
          </button>
          <button className="btn btn-sm btn-outline" onClick={loadData} title="Refresh Entitlements">
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {successNotice && (
        <div className="alert alert-success" style={{ margin: '16px', display: 'flex', justifyContent: 'space-between' }}>
          <span>{successNotice}</span>
          <button
            onClick={() => setSuccessNotice(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Nav Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color, #e2e8f0)', padding: '0 16px' }}>
        <button
          onClick={() => setActiveTab('matrix')}
          style={{
            padding: '12px 18px',
            border: 'none',
            borderBottom: activeTab === 'matrix' ? '2px solid var(--primary, #3b82f6)' : '2px solid transparent',
            background: 'none',
            fontWeight: activeTab === 'matrix' ? 600 : 400,
            color: activeTab === 'matrix' ? 'var(--primary, #3b82f6)' : 'var(--text-secondary, #64748b)',
            cursor: 'pointer',
          }}
        >
          📊 Entitlement Matrix
        </button>

        <button
          onClick={() => setActiveTab('catalogue')}
          style={{
            padding: '12px 18px',
            border: 'none',
            borderBottom: activeTab === 'catalogue' ? '2px solid var(--primary, #3b82f6)' : '2px solid transparent',
            background: 'none',
            fontWeight: activeTab === 'catalogue' ? 600 : 400,
            color: activeTab === 'catalogue' ? 'var(--primary, #3b82f6)' : 'var(--text-secondary, #64748b)',
            cursor: 'pointer',
          }}
        >
          📖 Platform Catalogue ({catalogue.length})
        </button>

        <button
          onClick={() => setActiveTab('history')}
          style={{
            padding: '12px 18px',
            border: 'none',
            borderBottom: activeTab === 'history' ? '2px solid var(--primary, #3b82f6)' : '2px solid transparent',
            background: 'none',
            fontWeight: activeTab === 'history' ? 600 : 400,
            color: activeTab === 'history' ? 'var(--primary, #3b82f6)' : 'var(--text-secondary, #64748b)',
            cursor: 'pointer',
          }}
        >
          📜 Audit History ({historyRecords.length})
        </button>
      </div>

      {/* TAB CONTENT */}
      <div style={{ padding: '16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }}></div>
            <p>Loading module management data...</p>
          </div>
        ) : error ? (
          <div className="alert alert-danger">
            <strong>Error:</strong> {error}
          </div>
        ) : (
          <>
            {/* VIEW 1: ENTITLEMENT MATRIX */}
            {activeTab === 'matrix' && (
              <div>
                {/* Search & Filters */}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    placeholder="Search module name or code..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input-text"
                    style={{ flex: 1, minWidth: '220px' }}
                  />

                  <select
                    value={filterKind}
                    onChange={(e) => setFilterKind(e.target.value)}
                    className="input-select"
                    style={{ width: '160px' }}
                  >
                    <option value="ALL">All Kinds</option>
                    <option value="APP">Root Apps (APP)</option>
                    <option value="MODULE">Modules (MODULE)</option>
                    <option value="FEATURE">Features (FEATURE)</option>
                  </select>

                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="input-select"
                    style={{ width: '170px' }}
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="ACTIVE">Effective Active</option>
                    <option value="READ_ONLY">Read-Only / Frozen</option>
                    <option value="DISABLED">Effective Disabled</option>
                    <option value="SCHEDULED">Scheduled Future</option>
                  </select>
                </div>

                {/* Matrix Table */}
                <div className="table-responsive">
                  <table className="table" style={{ width: '100%', fontSize: '0.88rem' }}>
                    <thead>
                      <tr>
                        <th>Module / Capability</th>
                        <th>Kind & Hierarchy</th>
                        <th>Configured State</th>
                        <th>Effective State</th>
                        <th>Dependencies</th>
                        <th>Pending Workflows</th>
                        <th>Approval Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMatrix.length === 0 ? (
                        <tr>
                          <td colSpan="8" style={{ textAlign: 'center', padding: '30px' }}>
                            No modules matched your search or filter.
                          </td>
                        </tr>
                      ) : (
                        filteredMatrix.map((item) => {
                          const isMandatory = item.IsCore || item.Priority === 'M';
                          const isEffectiveActive = item.EffectiveStatus === 'ACTIVE';

                          return (
                            <tr key={item.ModuleID} style={{ borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
                              {/* Module Name */}
                              <td>
                                <div style={{ fontWeight: 600 }}>{item.ModuleName}</div>
                                <code style={{ fontSize: '0.78rem', color: '#64748b' }}>{item.ModuleCode}</code>
                                {isMandatory && (
                                  <span
                                    className="badge badge-primary"
                                    style={{ marginLeft: '6px', fontSize: '0.7rem' }}
                                    title="Mandatory / Core Platform Capability"
                                  >
                                    MANDATORY
                                  </span>
                                )}
                              </td>

                              {/* Hierarchy */}
                              <td>
                                <span className="badge badge-outline" style={{ fontSize: '0.75rem' }}>
                                  {item.Kind}
                                </span>
                                {item.ParentName && (
                                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                                    Parent: <strong>{item.ParentName}</strong>
                                  </div>
                                )}
                              </td>

                              {/* Configured State */}
                              <td>
                                <span
                                  className={`badge ${
                                    item.ConfiguredStatus === 'ACTIVE'
                                      ? 'badge-success'
                                      : item.ConfiguredStatus === 'SCHEDULED'
                                      ? 'badge-info'
                                      : 'badge-secondary'
                                  }`}
                                >
                                  {item.ConfiguredStatus} ({item.ConfiguredMode})
                                </span>
                                {item.EffectiveFrom && (
                                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                                    From: {new Date(item.EffectiveFrom).toLocaleDateString()}
                                  </div>
                                )}
                              </td>

                              {/* Effective State */}
                              <td>
                                <span
                                  className={`badge ${
                                    item.EffectiveStatus === 'ACTIVE'
                                      ? item.EffectiveMode === 'READ_ONLY'
                                        ? 'badge-warning'
                                        : 'badge-success'
                                      : 'badge-danger'
                                  }`}
                                  style={{ fontWeight: 600 }}
                                >
                                  {item.EffectiveStatus}
                                  {item.EffectiveStatus === 'ACTIVE' && item.EffectiveMode === 'READ_ONLY' && ' (FROZEN)'}
                                </span>
                              </td>

                              {/* Dependencies */}
                              <td>
                                {item.DependenciesSatisfied ? (
                                  <span style={{ color: '#16a34a', fontSize: '0.8rem' }}>✓ Satisfied</span>
                                ) : (
                                  <span style={{ color: '#dc2626', fontSize: '0.8rem' }} title={`Missing: ${item.MissingDependencies?.join(', ')}`}>
                                    ⚠️ Missing: {item.MissingDependencies?.join(', ')}
                                  </span>
                                )}
                                {item.DependentModules?.length > 0 && (
                                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                    Children: {item.DependentModules.length}
                                  </div>
                                )}
                              </td>

                              {/* Pending Workflows */}
                              <td>
                                {item.PendingWorkflowsCount > 0 ? (
                                  <span className="badge badge-warning" style={{ fontSize: '0.78rem' }}>
                                    {item.PendingWorkflowsCount} Pending
                                  </span>
                                ) : (
                                  <span style={{ color: '#64748b', fontSize: '0.8rem' }}>None</span>
                                )}
                              </td>

                              {/* Approval Status */}
                              <td>
                                {item.PendingApprovalID ? (
                                  <Link
                                    to={`/approvals`}
                                    className="badge badge-info"
                                    style={{ textDecoration: 'none' }}
                                    title="View Approval Request in Approvals Page"
                                  >
                                    ⏳ PENDING APPROVAL
                                  </Link>
                                ) : (
                                  <span style={{ color: '#64748b', fontSize: '0.8rem' }}>—</span>
                                )}
                              </td>

                              {/* Actions */}
                              <td style={{ textAlign: 'right' }}>
                                <div style={{ display: 'inline-flex', gap: '6px' }}>
                                  {isEffectiveActive ? (
                                    <>
                                      <button
                                        className="btn btn-xs btn-outline"
                                        onClick={() => openActionModal(item, 'ACTIVE', item.ConfiguredMode === 'FULL' ? 'READ_ONLY' : 'FULL')}
                                        title={item.ConfiguredMode === 'FULL' ? 'Freeze workflows to Read-Only' : 'Unfreeze to Full Access'}
                                      >
                                        {item.ConfiguredMode === 'FULL' ? '❄️ Freeze' : '⚡ Unfreeze'}
                                      </button>
                                      <button
                                        className="btn btn-xs btn-outline"
                                        style={{ color: '#dc2626' }}
                                        onClick={() => openActionModal(item, 'DISABLED', 'FULL')}
                                        title="Disable module access"
                                      >
                                        Disable
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      className="btn btn-xs btn-primary"
                                      onClick={() => openActionModal(item, 'ACTIVE', 'FULL')}
                                    >
                                      Enable
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* VIEW 2: AUTHORITATIVE MODULE CATALOGUE */}
            {activeTab === 'catalogue' && (
              <div>
                <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '16px' }}>
                  Authoritative HMS hierarchical module registry (APP → MODULE → FEATURE).
                </p>
                <div className="table-responsive">
                  <table className="table" style={{ width: '100%', fontSize: '0.88rem' }}>
                    <thead>
                      <tr>
                        <th>Module Code</th>
                        <th>Name</th>
                        <th>Hierarchy Kind</th>
                        <th>Priority</th>
                        <th>Core Platform</th>
                        <th>Catalogue Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {catalogue.map((m) => (
                        <tr key={m.module_id}>
                          <td>
                            <code style={{ fontWeight: 600 }}>{m.module_code}</code>
                          </td>
                          <td>{m.module_name}</td>
                          <td>
                            <span className="badge badge-outline">{m.kind}</span>
                          </td>
                          <td>
                            <span className="badge badge-outline">{m.priority}</span>
                          </td>
                          <td>{m.is_core ? <span className="badge badge-primary">YES</span> : 'No'}</td>
                          <td>
                            <span className={`badge ${m.is_active ? 'badge-success' : 'badge-danger'}`}>
                              {m.is_active ? 'ACTIVE' : 'INACTIVE'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* VIEW 3: AUDIT HISTORY */}
            {activeTab === 'history' && (
              <div>
                <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '16px' }}>
                  Immutable audit records from <code>platform.audit_logs</code> documenting every module transition and reason.
                </p>
                {historyRecords.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                    No audit records recorded yet for this college&apos;s modules.
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
                      <thead>
                        <tr>
                          <th>Timestamp (UTC)</th>
                          <th>Action</th>
                          <th>Actor</th>
                          <th>Reason</th>
                          <th>Severity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyRecords.map((h) => (
                          <tr key={h.audit_id}>
                            <td style={{ whiteSpace: 'nowrap' }}>{new Date(h.created_at).toLocaleString()}</td>
                            <td>
                              <code>{h.action}</code>
                            </td>
                            <td>{h.actor_role}</td>
                            <td>{h.reason || '—'}</td>
                            <td>
                              <span
                                className={`badge ${
                                  h.severity === 'WARNING'
                                    ? 'badge-warning'
                                    : h.severity === 'ERROR'
                                    ? 'badge-danger'
                                    : 'badge-outline'
                                }`}
                              >
                                {h.severity}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ACTION DIALOG MODAL (ENABLE / DISABLE / SUSPEND / FREEZE) */}
      {actionModal.isOpen && actionModal.item && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '620px' }}>
            <div className="modal-header">
              <h2 className="modal-title">
                {actionModal.targetStatus === 'ACTIVE'
                  ? actionModal.targetMode === 'READ_ONLY'
                    ? 'Freeze Module to Read-Only'
                    : 'Enable Module Entitlement'
                  : 'Disable / Suspend Module'}
              </h2>
              <button
                className="modal-close-btn"
                onClick={() => setActionModal((p) => ({ ...p, isOpen: false }))}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleActionSubmit} style={{ padding: '20px' }}>
              {actionModal.error && (
                <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
                  {actionModal.error}
                </div>
              )}

              {/* Module Summary */}
              <div
                style={{
                  background: 'var(--bg-secondary, #f8fafc)',
                  padding: '12px 16px',
                  borderRadius: '6px',
                  marginBottom: '16px',
                }}
              >
                <div style={{ fontWeight: 600 }}>{actionModal.item.ModuleName}</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Code: <code>{actionModal.item.ModuleCode}</code> | Kind: {actionModal.item.Kind}
                </div>
                <div style={{ marginTop: '8px', fontSize: '0.85rem' }}>
                  Current State:{' '}
                  <strong>
                    {actionModal.item.ConfiguredStatus} ({actionModal.item.ConfiguredMode})
                  </strong>{' '}
                  ➔ Proposed State:{' '}
                  <strong style={{ color: actionModal.targetStatus === 'ACTIVE' ? '#16a34a' : '#dc2626' }}>
                    {actionModal.targetStatus} ({actionModal.targetMode})
                  </strong>
                </div>
              </div>

              {/* Impact Preview */}
              {actionModal.previewLoading ? (
                <div style={{ textAlign: 'center', padding: '16px' }}>
                  <div className="spinner" style={{ margin: '0 auto 8px' }}></div>
                  <small>Evaluating dependencies & pending workflow impact...</small>
                </div>
              ) : actionModal.preview ? (
                <div
                  style={{
                    border: '1px solid var(--border-color, #e2e8f0)',
                    borderRadius: '6px',
                    padding: '12px',
                    marginBottom: '16px',
                    fontSize: '0.85rem',
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: '6px' }}>🔍 Impact Preview</div>

                  {actionModal.preview.dependent_modules_count > 0 && (
                    <div style={{ color: '#d97706', marginBottom: '6px' }}>
                      ⚠️ <strong>{actionModal.preview.dependent_modules_count} child feature(s)</strong> will also be
                      cascaded and affected ({actionModal.preview.dependent_modules?.join(', ')}).
                    </div>
                  )}

                  {actionModal.preview.pending_workflows_count > 0 && (
                    <div style={{ color: '#b45309', marginBottom: '6px' }}>
                      ⚠️ <strong>{actionModal.preview.pending_workflows_count} pending workflow(s)</strong> detected.
                      Under the <strong>freeze/read-only</strong> default policy, pending items will be preserved and
                      accessible in read-only mode, but no new state modifications will be permitted.
                    </div>
                  )}

                  {actionModal.preview.requires_approval && (
                    <div
                      style={{
                        background: '#eff6ff',
                        color: '#1e40af',
                        padding: '8px',
                        borderRadius: '4px',
                        marginTop: '8px',
                      }}
                    >
                      🛡️ <strong>Super Admin Maker-Checker Approval Required:</strong>{' '}
                      {actionModal.preview.approval_reason}
                    </div>
                  )}
                </div>
              ) : null}

              {/* Transition Config */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label className="label">Target Status</label>
                  <select
                    className="input-select"
                    value={actionModal.targetStatus}
                    onChange={(e) => setActionModal((p) => ({ ...p, targetStatus: e.target.value }))}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="DISABLED">DISABLED</option>
                    <option value="SCHEDULED">SCHEDULED (Future)</option>
                  </select>
                </div>

                <div>
                  <label className="label">Operating Mode</label>
                  <select
                    className="input-select"
                    value={actionModal.targetMode}
                    onChange={(e) => setActionModal((p) => ({ ...p, targetMode: e.target.value }))}
                  >
                    <option value="FULL">FULL (Read & Write)</option>
                    <option value="READ_ONLY">READ_ONLY (Workflow Freeze)</option>
                  </select>
                </div>
              </div>

              {/* Effective Dates (Optional Scheduling) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label className="label">Effective From (Optional)</label>
                  <input
                    type="datetime-local"
                    className="input-text"
                    value={actionModal.effectiveFrom}
                    onChange={(e) => setActionModal((p) => ({ ...p, effectiveFrom: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Effective To (Optional)</label>
                  <input
                    type="datetime-local"
                    className="input-text"
                    value={actionModal.effectiveTo}
                    onChange={(e) => setActionModal((p) => ({ ...p, effectiveTo: e.target.value }))}
                  />
                </div>
              </div>

              {/* Reason (Mandatory) */}
              <div style={{ marginBottom: '16px' }}>
                <label className="label">
                  Reason for Entitlement Change <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <textarea
                  className="input-textarea"
                  rows="3"
                  placeholder="Provide an authoritative reason for audit and compliance logging..."
                  value={actionModal.reason}
                  onChange={(e) => setActionModal((p) => ({ ...p, reason: e.target.value }))}
                  required
                />
              </div>

              {/* Explicit Approval Option */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem' }}>
                  <input
                    type="checkbox"
                    checked={actionModal.requestApproval}
                    disabled={actionModal.preview?.requires_approval}
                    onChange={(e) => setActionModal((p) => ({ ...p, requestApproval: e.target.checked }))}
                  />
                  <span>Route change through Super Admin Maker-Checker approval workflow</span>
                </label>
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setActionModal((p) => ({ ...p, isOpen: false }))}
                  disabled={actionModal.submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`btn ${actionModal.targetStatus === 'ACTIVE' ? 'btn-primary' : 'btn-danger'}`}
                  disabled={actionModal.submitting || actionModal.previewLoading}
                >
                  {actionModal.submitting
                    ? 'Processing...'
                    : actionModal.requestApproval
                    ? 'Submit for Approval'
                    : 'Confirm & Apply Change'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BULK TEMPLATE MODAL */}
      {templateModal.isOpen && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Apply Entitlement Template</h2>
              <button
                className="modal-close-btn"
                onClick={() => setTemplateModal((p) => ({ ...p, isOpen: false }))}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleApplyTemplate} style={{ padding: '20px' }}>
              {templateModal.error && (
                <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
                  {templateModal.error}
                </div>
              )}

              <p style={{ fontSize: '0.88rem', color: '#64748b', marginBottom: '16px' }}>
                Select a platform entitlement template plan to configure modules in bulk for{' '}
                <strong>{currentCollege?.name}</strong>.
              </p>

              <div style={{ marginBottom: '16px' }}>
                <label className="label">Entitlement Plan</label>
                <select
                  className="input-select"
                  value={templateModal.templateId}
                  onChange={(e) => setTemplateModal((p) => ({ ...p, templateId: e.target.value }))}
                  required
                >
                  <option value="">-- Choose Template --</option>
                  {templates.map((t) => (
                    <option key={t.template_id} value={t.template_id}>
                      {t.name} ({t.template_code})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setTemplateModal((p) => ({ ...p, isOpen: false }))}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={templateModal.submitting}>
                  {templateModal.submitting ? 'Applying...' : 'Apply Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
