import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { fetchCollegesList } from '../services/collegeService';
import {
  fetchAccessMatrix,
  updateFeatureAccess,
  evaluateAccessOutcome,
} from '../services/accessControlService';

export default function AccessControlPage() {
  // Active top-level tab: 'matrix' | 'why-denied' | 'templates'
  const [activeTab, setActiveTab] = useState('matrix');

  // Tenant / College selection
  const [colleges, setColleges] = useState([]);
  const [selectedCollegeId, setSelectedCollegeId] = useState('');
  const [collegesLoading, setCollegesLoading] = useState(true);

  // Access Matrix State
  const [matrixData, setMatrixData] = useState(null);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [matrixError, setMatrixError] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [kindFilter, setKindFilter] = useState('ALL'); // ALL, APP, MODULE, FEATURE
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, ACTIVE, DISABLED, SCHEDULED
  const [modeFilter, setModeFilter] = useState('ALL'); // ALL, FULL, READ_ONLY
  const [expandedNodes, setExpandedNodes] = useState({});

  // Configuration Modal Drawer State
  const [selectedItemForConfig, setSelectedItemForConfig] = useState(null);
  const [configForm, setConfigForm] = useState({
    status: 'ACTIVE',
    mode: 'FULL',
    effective_from: '',
    effective_to: '',
    reason: '',
  });
  const [configSubmitting, setConfigSubmitting] = useState(false);
  const [configError, setConfigError] = useState(null);

  // "Why Is This Denied?" Inspector State
  const [evalForm, setEvalForm] = useState({
    college_id: '',
    module_id: '',
    module_code: '',
    action: '',
    http_method: 'POST',
    user_id: '',
  });
  const [evalResult, setEvalResult] = useState(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [evalError, setEvalError] = useState(null);

  // Global Feedback Toast / Banner
  const [feedback, setFeedback] = useState(null);

  const abortControllerRef = useRef(null);

  // Load Colleges list once
  useEffect(() => {
    let isMounted = true;
    async function loadColleges() {
      try {
        setCollegesLoading(true);
        const res = await fetchCollegesList({ limit: 100 });
        if (isMounted) {
          const list = res.colleges || [];
          setColleges(list);
          if (list.length > 0) {
            setSelectedCollegeId(list[0].college_id);
            setEvalForm((prev) => ({ ...prev, college_id: list[0].college_id }));
          }
        }
      } catch (err) {
        if (isMounted) {
          setMatrixError('Failed to load colleges: ' + (err.response?.data?.error || err.message));
        }
      } finally {
        if (isMounted) setCollegesLoading(false);
      }
    }
    loadColleges();
    return () => {
      isMounted = false;
    };
  }, []);

  // Load Access Matrix whenever selectedCollegeId changes
  const loadMatrix = useCallback(async (collegeId) => {
    if (!collegeId) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setMatrixLoading(true);
    setMatrixError(null);

    try {
      const data = await fetchAccessMatrix(collegeId, abortControllerRef.current.signal);
      setMatrixData(data);

      // Default expand top-level apps and modules
      const initialExpanded = {};
      function markExpanded(items) {
        if (!items) return;
        items.forEach((item) => {
          initialExpanded[item.module_id] = true;
          if (item.children) markExpanded(item.children);
        });
      }
      markExpanded(data.root_applications || []);
      setExpandedNodes(initialExpanded);
    } catch (err) {
      if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
        setMatrixError(err.response?.data?.error || err.message || 'Failed to load access matrix');
        setMatrixData(null);
      }
    } finally {
      setMatrixLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCollegeId) {
      loadMatrix(selectedCollegeId);
      setEvalForm((prev) => ({ ...prev, college_id: selectedCollegeId }));
    }
  }, [selectedCollegeId, loadMatrix]);

  // Expand / Collapse toggles
  const toggleNode = (nodeId) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  };

  const expandAll = () => {
    const all = {};
    function collect(items) {
      if (!items) return;
      items.forEach((item) => {
        all[item.module_id] = true;
        if (item.children) collect(item.children);
      });
    }
    if (matrixData?.root_applications) collect(matrixData.root_applications);
    setExpandedNodes(all);
  };

  const collapseAll = () => {
    setExpandedNodes({});
  };

  // Open Configuration Modal
  const openConfigModal = (item) => {
    setSelectedItemForConfig(item);
    setConfigForm({
      status: item.configured_status || 'ACTIVE',
      mode: item.mode || 'FULL',
      effective_from: item.effective_from ? item.effective_from.substring(0, 16) : '',
      effective_to: item.effective_to ? item.effective_to.substring(0, 16) : '',
      reason: '',
    });
    setConfigError(null);
  };

  // Close Configuration Modal
  const closeConfigModal = () => {
    setSelectedItemForConfig(null);
    setConfigError(null);
  };

  // Submit Configuration Changes
  const handleSaveConfig = async (e) => {
    e.preventDefault();
    if (!configForm.reason || !configForm.reason.trim()) {
      setConfigError('A clear business justification / reason is mandatory for access control changes.');
      return;
    }

    try {
      setConfigSubmitting(true);
      setConfigError(null);

      const payload = {
        status: configForm.status,
        mode: configForm.mode,
        effective_from: configForm.effective_from ? new Date(configForm.effective_from).toISOString() : null,
        effective_to: configForm.effective_to ? new Date(configForm.effective_to).toISOString() : null,
        reason: configForm.reason.trim(),
      };

      await updateFeatureAccess(selectedCollegeId, selectedItemForConfig.module_id, payload);

      setFeedback({
        type: 'success',
        message: `Successfully updated entitlement for "${selectedItemForConfig.name}" (${selectedItemForConfig.module_code}).`,
      });

      closeConfigModal();
      await loadMatrix(selectedCollegeId);
    } catch (err) {
      setConfigError(err.response?.data?.error || err.message || 'Failed to update feature entitlement');
    } finally {
      setConfigSubmitting(false);
    }
  };

  // Handle Diagnostic Evaluation Run
  const handleRunEvaluation = async (e) => {
    e.preventDefault();
    if (!evalForm.module_code && !evalForm.module_id) {
      setEvalError('Please provide either a Module / Feature Code or Module ID');
      return;
    }
    if (!evalForm.action || !evalForm.action.trim()) {
      setEvalError('Please specify an Action (e.g. "hostel.view", "hostel.manage", "visitor.edit")');
      return;
    }

    try {
      setEvalLoading(true);
      setEvalError(null);
      setEvalResult(null);

      const payload = {
        college_id: evalForm.college_id || selectedCollegeId,
        module_id: evalForm.module_id.trim() || undefined,
        module_code: evalForm.module_code.trim() || undefined,
        action: evalForm.action.trim(),
        http_method: evalForm.http_method,
        user_id: evalForm.user_id.trim() || undefined,
      };

      const result = await evaluateAccessOutcome(payload, evalForm.college_id);
      setEvalResult(result);
    } catch (err) {
      setEvalError(err.response?.data?.error || err.message || 'Failed to run access evaluation');
    } finally {
      setEvalLoading(false);
    }
  };

  // Populate diagnostic form quickly from matrix node
  const prefillDiagnostic = (node, actionCode = '') => {
    setEvalForm((prev) => ({
      ...prev,
      college_id: selectedCollegeId,
      module_id: node.module_id,
      module_code: node.module_code,
      action: actionCode || (node.actions && node.actions[0] ? node.actions[0].action : `${node.module_code}.view`),
      http_method: actionCode.includes('manage') || actionCode.includes('edit') || actionCode.includes('delete') ? 'POST' : 'GET',
    }));
    setActiveTab('why-denied');
    setEvalResult(null);
    setEvalError(null);
  };

  // Filter matrix tree recursively
  const filteredTree = useMemo(() => {
    if (!matrixData?.root_applications) return [];

    function matchesFilter(node) {
      const q = searchFilter.toLowerCase();
      const matchesSearch =
        !q ||
        node.name?.toLowerCase().includes(q) ||
        node.module_code?.toLowerCase().includes(q) ||
        node.category?.toLowerCase().includes(q);

      const matchesKind = kindFilter === 'ALL' || node.kind === kindFilter;
      const matchesStatus = statusFilter === 'ALL' || node.effective_status === statusFilter;
      const matchesMode = modeFilter === 'ALL' || node.mode === modeFilter;

      return matchesSearch && matchesKind && matchesStatus && matchesMode;
    }

    function filterNode(node) {
      const filteredChildren = node.children ? node.children.map(filterNode).filter(Boolean) : [];
      const selfMatches = matchesFilter(node);

      if (selfMatches || filteredChildren.length > 0) {
        return {
          ...node,
          children: filteredChildren,
        };
      }
      return null;
    }

    return matrixData.root_applications.map(filterNode).filter(Boolean);
  }, [matrixData, searchFilter, kindFilter, statusFilter, modeFilter]);

  // Overall metrics
  const matrixMetrics = useMemo(() => {
    let totalNodes = 0;
    let activeNodes = 0;
    let disabledNodes = 0;
    let readOnlyNodes = 0;
    let inheritedDisabledNodes = 0;

    function count(items) {
      if (!items) return;
      items.forEach((item) => {
        totalNodes++;
        if (item.effective_status === 'ACTIVE') activeNodes++;
        if (item.effective_status === 'DISABLED') disabledNodes++;
        if (item.mode === 'READ_ONLY') readOnlyNodes++;
        if (item.inherited_disabled) inheritedDisabledNodes++;
        if (item.children) count(item.children);
      });
    }

    if (matrixData?.root_applications) {
      count(matrixData.root_applications);
    }

    return { totalNodes, activeNodes, disabledNodes, readOnlyNodes, inheritedDisabledNodes };
  }, [matrixData]);

  return (
    <div className="access-control-page" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.75rem' }}>🛡️</span>
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc' }}>
              Feature &amp; Module Access Control
            </h1>
          </div>
          <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: '0.95rem' }}>
            Granular entitlement control, action restrictions, read-only policies, and inheritance diagnostics.
          </p>
        </div>

        {/* Tenant Selector Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#1e293b', padding: '8px 16px', borderRadius: '8px', border: '1px solid #334155' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#94a3b8' }}>Tenant College:</span>
          {collegesLoading ? (
            <span style={{ color: '#64748b', fontSize: '0.875rem' }}>Loading colleges...</span>
          ) : (
            <select
              value={selectedCollegeId}
              onChange={(e) => setSelectedCollegeId(e.target.value)}
              style={{
                background: '#0f172a',
                color: '#f8fafc',
                border: '1px solid #475569',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '0.9rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {colleges.map((c) => (
                <option key={c.college_id} value={c.college_id}>
                  {c.name} ({c.college_code || c.code}) — [{c.status}]
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          style={{
            padding: '12px 16px',
            marginBottom: '20px',
            borderRadius: '6px',
            background: feedback.type === 'success' ? '#064e3b' : '#7f1d1d',
            border: `1px solid ${feedback.type === 'success' ? '#10b981' : '#ef4444'}`,
            color: '#f8fafc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{feedback.message}</span>
          <button
            onClick={() => setFeedback(null)}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.1rem' }}
          >
            ×
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #334155', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveTab('matrix')}
          style={{
            padding: '10px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'matrix' ? '2px solid #38bdf8' : '2px solid transparent',
            color: activeTab === 'matrix' ? '#38bdf8' : '#94a3b8',
            fontWeight: 600,
            fontSize: '0.95rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>🌳</span>
          <span>Access Hierarchy Matrix</span>
        </button>

        <button
          onClick={() => setActiveTab('why-denied')}
          style={{
            padding: '10px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'why-denied' ? '2px solid #38bdf8' : '2px solid transparent',
            color: activeTab === 'why-denied' ? '#38bdf8' : '#94a3b8',
            fontWeight: 600,
            fontSize: '0.95rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>🔍</span>
          <span>"Why Is This Denied?" Inspector</span>
        </button>

        <button
          onClick={() => setActiveTab('templates')}
          style={{
            padding: '10px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'templates' ? '2px solid #38bdf8' : '2px solid transparent',
            color: activeTab === 'templates' ? '#38bdf8' : '#94a3b8',
            fontWeight: 600,
            fontSize: '0.95rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>📋</span>
          <span>Plan &amp; Template Advisory</span>
        </button>
      </div>

      {/* TAB 1: ACCESS MATRIX */}
      {activeTab === 'matrix' && (
        <div>
          {/* Summary Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div style={{ background: '#1e293b', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 600 }}>Total Nodes</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f8fafc', marginTop: '4px' }}>{matrixMetrics.totalNodes}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>App / Module / Feature items</div>
            </div>

            <div style={{ background: '#1e293b', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
              <div style={{ color: '#34d399', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 600 }}>Active Effective</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#34d399', marginTop: '4px' }}>{matrixMetrics.activeNodes}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>Fully operational for tenant</div>
            </div>

            <div style={{ background: '#1e293b', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
              <div style={{ color: '#f87171', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 600 }}>Disabled Effective</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f87171', marginTop: '4px' }}>{matrixMetrics.disabledNodes}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>Directly or inherited off</div>
            </div>

            <div style={{ background: '#1e293b', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
              <div style={{ color: '#38bdf8', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 600 }}>Read-Only Mode</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#38bdf8', marginTop: '4px' }}>{matrixMetrics.readOnlyNodes}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>Mutations blocked by backend</div>
            </div>

            <div style={{ background: '#1e293b', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
              <div style={{ color: '#fbbf24', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 600 }}>Inherited Disabled</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#fbbf24', marginTop: '4px' }}>{matrixMetrics.inheritedDisabledNodes}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>Parent disabled cascade</div>
            </div>
          </div>

          {/* Controls Bar: Filters & Search */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between', background: '#1e293b', padding: '14px 18px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #334155' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
              {/* Search */}
              <input
                type="text"
                placeholder="Search feature, module, or code..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                style={{
                  background: '#0f172a',
                  color: '#f8fafc',
                  border: '1px solid #475569',
                  borderRadius: '6px',
                  padding: '7px 12px',
                  fontSize: '0.875rem',
                  minWidth: '240px',
                }}
              />

              {/* Kind Filter */}
              <select
                value={kindFilter}
                onChange={(e) => setKindFilter(e.target.value)}
                style={{
                  background: '#0f172a',
                  color: '#f8fafc',
                  border: '1px solid #475569',
                  borderRadius: '6px',
                  padding: '7px 12px',
                  fontSize: '0.875rem',
                }}
              >
                <option value="ALL">All Levels</option>
                <option value="APP">Applications Only</option>
                <option value="MODULE">Modules Only</option>
                <option value="FEATURE">Features Only</option>
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  background: '#0f172a',
                  color: '#f8fafc',
                  border: '1px solid #475569',
                  borderRadius: '6px',
                  padding: '7px 12px',
                  fontSize: '0.875rem',
                }}
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Effective ACTIVE</option>
                <option value="DISABLED">Effective DISABLED</option>
                <option value="SCHEDULED">Effective SCHEDULED</option>
              </select>

              {/* Mode Filter */}
              <select
                value={modeFilter}
                onChange={(e) => setModeFilter(e.target.value)}
                style={{
                  background: '#0f172a',
                  color: '#f8fafc',
                  border: '1px solid #475569',
                  borderRadius: '6px',
                  padding: '7px 12px',
                  fontSize: '0.875rem',
                }}
              >
                <option value="ALL">All Modes</option>
                <option value="FULL">FULL Access</option>
                <option value="READ_ONLY">READ_ONLY Mode</option>
              </select>
            </div>

            {/* Tree Controls */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={expandAll}
                style={{
                  background: '#334155',
                  color: '#f8fafc',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                style={{
                  background: '#334155',
                  color: '#f8fafc',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Collapse All
              </button>
              <button
                onClick={() => loadMatrix(selectedCollegeId)}
                style={{
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 14px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Refresh
              </button>
            </div>
          </div>

          {/* Matrix Content / Loading / Error */}
          {matrixLoading && (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: '1.2rem', marginBottom: '8px' }}>⏳ Loading tenant access hierarchy...</div>
              <div style={{ fontSize: '0.875rem' }}>Evaluating parent/child inheritance states</div>
            </div>
          )}

          {matrixError && !matrixLoading && (
            <div style={{ padding: '24px', background: '#7f1d1d', border: '1px solid #ef4444', borderRadius: '8px', color: '#f8fafc', marginBottom: '20px' }}>
              <strong>Error Loading Access Matrix:</strong> {matrixError}
            </div>
          )}

          {!matrixLoading && !matrixError && filteredTree.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', background: '#1e293b', borderRadius: '8px', color: '#94a3b8' }}>
              No applications, modules, or features match the current filters.
            </div>
          )}

          {!matrixLoading && !matrixError && filteredTree.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {filteredTree.map((appNode) => (
                <TreeNodeCard
                  key={appNode.module_id}
                  node={appNode}
                  level={0}
                  expandedNodes={expandedNodes}
                  toggleNode={toggleNode}
                  onConfigure={openConfigModal}
                  onInspect={prefillDiagnostic}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: "WHY IS THIS DENIED?" DIAGNOSTIC INSPECTOR */}
      {activeTab === 'why-denied' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '24px' }}>
          {/* Simulator Form */}
          <div style={{ background: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#f8fafc', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🔍</span>
              <span>Simulate Access Check</span>
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 18px' }}>
              Test backend entitlement validation with live tenant state, catalogue status, parent hierarchy, read-only mode, and user permissions.
            </p>

            <form onSubmit={handleRunEvaluation} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                  Tenant College
                </label>
                <select
                  value={evalForm.college_id}
                  onChange={(e) => setEvalForm({ ...evalForm, college_id: e.target.value })}
                  style={{
                    width: '100%',
                    background: '#0f172a',
                    color: '#f8fafc',
                    border: '1px solid #475569',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '0.875rem',
                  }}
                  required
                >
                  {colleges.map((c) => (
                    <option key={c.college_id} value={c.college_id}>
                      {c.name} ({c.college_code || c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                  Module or Feature Code (or ID)
                </label>
                <input
                  type="text"
                  placeholder="e.g. hostel, student_management, attendance, complaints"
                  value={evalForm.module_code}
                  onChange={(e) => setEvalForm({ ...evalForm, module_code: e.target.value })}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: '#0f172a',
                    color: '#f8fafc',
                    border: '1px solid #475569',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '0.875rem',
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                  Action / Permission Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. hostel.view, hostel.manage, visitor.edit, gatepass.create"
                  value={evalForm.action}
                  onChange={(e) => setEvalForm({ ...evalForm, action: e.target.value })}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: '#0f172a',
                    color: '#f8fafc',
                    border: '1px solid #475569',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '0.875rem',
                  }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                    HTTP Method
                  </label>
                  <select
                    value={evalForm.http_method}
                    onChange={(e) => setEvalForm({ ...evalForm, http_method: e.target.value })}
                    style={{
                      width: '100%',
                      background: '#0f172a',
                      color: '#f8fafc',
                      border: '1px solid #475569',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      fontSize: '0.875rem',
                    }}
                  >
                    <option value="GET">GET (Read)</option>
                    <option value="POST">POST (Mutate / Create)</option>
                    <option value="PUT">PUT (Mutate / Replace)</option>
                    <option value="PATCH">PATCH (Mutate / Update)</option>
                    <option value="DELETE">DELETE (Mutate / Remove)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                    User ID (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="UUID of user"
                    value={evalForm.user_id}
                    onChange={(e) => setEvalForm({ ...evalForm, user_id: e.target.value })}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      background: '#0f172a',
                      color: '#f8fafc',
                      border: '1px solid #475569',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      fontSize: '0.875rem',
                    }}
                  />
                </div>
              </div>

              {evalError && (
                <div style={{ padding: '10px 14px', background: '#7f1d1d', border: '1px solid #ef4444', borderRadius: '6px', color: '#f8fafc', fontSize: '0.85rem' }}>
                  {evalError}
                </div>
              )}

              <button
                type="submit"
                disabled={evalLoading}
                style={{
                  marginTop: '8px',
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '10px 16px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: evalLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                {evalLoading ? 'Running Multi-Stage Evaluation...' : '⚡ Evaluate Access Outcome'}
              </button>
            </form>
          </div>

          {/* Diagnostic Trace Outcome */}
          <div style={{ background: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#f8fafc', margin: '0 0 14px' }}>
              Diagnostic Outcome &amp; Pipeline Trace
            </h2>

            {!evalResult && !evalLoading && (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🩺</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 500, color: '#94a3b8' }}>No evaluation executed yet</div>
                <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                  Configure the parameters on the left and run the evaluation to trace why an action is allowed or denied.
                </div>
              </div>
            )}

            {evalLoading && (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#38bdf8' }}>
                <div style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Evaluating 6 diagnostic stages...</div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Checking tenant, catalog, parent hierarchy, entitlement, and permissions</div>
              </div>
            )}

            {evalResult && !evalLoading && (
              <div>
                {/* Decision Header Banner */}
                <div
                  style={{
                    padding: '16px 20px',
                    borderRadius: '8px',
                    background: evalResult.decision === 'ALLOWED' ? '#064e3b' : '#7f1d1d',
                    border: `1px solid ${evalResult.decision === 'ALLOWED' ? '#10b981' : '#ef4444'}`,
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', color: evalResult.decision === 'ALLOWED' ? '#a7f3d0' : '#fecaca' }}>
                      Access Outcome
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff', marginTop: '2px' }}>
                      {evalResult.decision === 'ALLOWED' ? '✅ ACCESS ALLOWED' : '🚫 ACCESS DENIED'}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#e2e8f0', marginTop: '4px' }}>
                      Code: <code>{evalResult.reason_code}</code>
                    </div>
                  </div>
                </div>

                {/* Remediation Advice Card */}
                {evalResult.remediation && (
                  <div style={{ padding: '14px 18px', background: '#0f172a', border: '1px solid #38bdf8', borderRadius: '8px', marginBottom: '18px' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '4px' }}>
                      💡 Remediation Advice
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#f1f5f9', lineHeight: 1.5 }}>
                      {evalResult.remediation}
                    </div>
                  </div>
                )}

                {/* Step Trace Pipeline */}
                <div>
                  <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', fontWeight: 700, color: '#94a3b8', margin: '0 0 10px' }}>
                    Evaluation Pipeline Steps
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {evalResult.steps &&
                      evalResult.steps.map((st, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '10px 14px',
                            borderRadius: '6px',
                            background: st.status === 'PASS' ? '#064e3b33' : st.status === 'FAIL' ? '#7f1d1d33' : '#33415533',
                            borderLeft: `4px solid ${st.status === 'PASS' ? '#10b981' : st.status === 'FAIL' ? '#ef4444' : '#64748b'}`,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#f8fafc' }}>
                                {st.step}
                              </span>
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontWeight: 700,
                                  background: st.status === 'PASS' ? '#064e3b' : st.status === 'FAIL' ? '#7f1d1d' : '#334155',
                                  color: st.status === 'PASS' ? '#6ee7b7' : st.status === 'FAIL' ? '#fca5a5' : '#94a3b8',
                                }}
                              >
                                {st.status}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                              {st.message}
                            </div>
                          </div>
                          {st.detail && (
                            <span style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic', maxWidth: '200px', textAlign: 'right' }}>
                              {st.detail}
                            </span>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: PLAN & TEMPLATE ADVISORY */}
      {activeTab === 'templates' && (
        <div style={{ background: '#1e293b', padding: '24px', borderRadius: '8px', border: '1px solid #334155' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <span style={{ fontSize: '1.5rem' }}>📋</span>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
              Plan &amp; Entitlement Template Settings
            </h2>
          </div>

          {/* Architecture Status Alert */}
          <div style={{ padding: '16px', background: '#0284c722', border: '1px solid #0284c7', borderRadius: '8px', marginBottom: '20px' }}>
            <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: '6px', fontSize: '0.95rem' }}>
              ℹ️ Architecture &amp; Schema Status
            </div>
            <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.875rem', lineHeight: 1.6 }}>
              The HMS architecture specifies plan-level entitlement profiles (e.g., standard vs premium feature bundles).
              In the current database schema, templates are managed in <code>platform.entitlement_templates</code>, which can be applied to tenants via <code>POST /super-admin/colleges/:id/apply-template</code>.
              Per-tenant active plan assignment will be integrated when the <code>platform.college_plans</code> junction table is introduced.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <div style={{ background: '#0f172a', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', marginBottom: '8px' }}>
                Standard College Template
              </div>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.5, margin: '0 0 12px' }}>
                Includes Core Student Management, Basic Attendance, Hostel Hierarchy, and Read-Only Complaints.
              </p>
              <button
                disabled
                style={{
                  background: '#334155',
                  color: '#94a3b8',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'not-allowed',
                }}
              >
                Apply to Tenant (Pending Plan Schema)
              </button>
            </div>

            <div style={{ background: '#0f172a', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', marginBottom: '8px' }}>
                Premium Enterprise Template
              </div>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.5, margin: '0 0 12px' }}>
                Includes Full Access to all Apps, Modules, Biometric Gate Pass features, Mess Management, and Analytics.
              </p>
              <button
                disabled
                style={{
                  background: '#334155',
                  color: '#94a3b8',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'not-allowed',
                }}
              >
                Apply to Tenant (Pending Plan Schema)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIGURATION MODAL DRAWER */}
      {selectedItemForConfig && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: '#1e293b',
              borderRadius: '10px',
              border: '1px solid #334155',
              width: '100%',
              maxWidth: '560px',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: selectedItemForConfig.kind === 'APP' ? '#7c3aed' : selectedItemForConfig.kind === 'MODULE' ? '#2563eb' : '#059669',
                      color: '#ffffff',
                    }}
                  >
                    {selectedItemForConfig.kind}
                  </span>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#f8fafc' }}>
                    {selectedItemForConfig.name}
                  </h3>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px' }}>
                  Code: <code>{selectedItemForConfig.module_code}</code> | Priority: {selectedItemForConfig.priority}
                </div>
              </div>
              <button
                onClick={closeConfigModal}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.4rem', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            {/* Inheritance Warning if Ancestor is Disabled */}
            {selectedItemForConfig.inherited_disabled && (
              <div style={{ padding: '12px', background: '#78350f33', border: '1px solid #d97706', borderRadius: '6px', marginBottom: '16px', fontSize: '0.85rem', color: '#fef3c7' }}>
                ⚠️ <strong>Inherited Disabled Notice:</strong> This item is currently disabled because an ancestor ({selectedItemForConfig.inheritance_source}) is disabled. Re-enabling this item will only take effect once the parent application/module is also enabled.
              </div>
            )}

            <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Status Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '6px' }}>
                  Entitlement Status
                </label>
                <select
                  value={configForm.status}
                  onChange={(e) => setConfigForm({ ...configForm, status: e.target.value })}
                  style={{
                    width: '100%',
                    background: '#0f172a',
                    color: '#f8fafc',
                    border: '1px solid #475569',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '0.875rem',
                  }}
                >
                  <option value="ACTIVE">ACTIVE (Feature enabled for tenant)</option>
                  <option value="DISABLED">DISABLED (Feature disabled and denied)</option>
                  <option value="SCHEDULED">SCHEDULED (Active during effective dates only)</option>
                </select>
              </div>

              {/* Mode Selector (Full vs Read Only) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '6px' }}>
                  Operating Mode (Granular Action Restriction)
                </label>
                <select
                  value={configForm.mode}
                  onChange={(e) => setConfigForm({ ...configForm, mode: e.target.value })}
                  style={{
                    width: '100%',
                    background: '#0f172a',
                    color: '#f8fafc',
                    border: '1px solid #475569',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '0.875rem',
                  }}
                >
                  <option value="FULL">FULL ACCESS (All permitted actions allowed)</option>
                  <option value="READ_ONLY">READ_ONLY (Mutations POST/PUT/PATCH/DELETE blocked by backend)</option>
                </select>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                  When set to READ_ONLY, users can view records (e.g. Visitor History) but edit/create operations are automatically blocked with HTTP 403.
                </div>
              </div>

              {/* Effective Dates (For Scheduled changes) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '6px' }}>
                    Effective From
                  </label>
                  <input
                    type="datetime-local"
                    value={configForm.effective_from}
                    onChange={(e) => setConfigForm({ ...configForm, effective_from: e.target.value })}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      background: '#0f172a',
                      color: '#f8fafc',
                      border: '1px solid #475569',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '6px' }}>
                    Effective To (Expiry)
                  </label>
                  <input
                    type="datetime-local"
                    value={configForm.effective_to}
                    onChange={(e) => setConfigForm({ ...configForm, effective_to: e.target.value })}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      background: '#0f172a',
                      color: '#f8fafc',
                      border: '1px solid #475569',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>
              </div>

              {/* Mandatory Reason */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '6px' }}>
                  Reason for Change <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  rows="3"
                  placeholder="Provide audit justification (e.g. Tenant requested visitor history read-only mode, or scheduled pilot launch)"
                  value={configForm.reason}
                  onChange={(e) => setConfigForm({ ...configForm, reason: e.target.value })}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: '#0f172a',
                    color: '#f8fafc',
                    border: '1px solid #475569',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '0.875rem',
                    resize: 'vertical',
                  }}
                  required
                />
              </div>

              {configError && (
                <div style={{ padding: '10px 14px', background: '#7f1d1d', border: '1px solid #ef4444', borderRadius: '6px', color: '#f8fafc', fontSize: '0.85rem' }}>
                  {configError}
                </div>
              )}

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={closeConfigModal}
                  style={{
                    background: '#334155',
                    color: '#f8fafc',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={configSubmitting}
                  style={{
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 18px',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: configSubmitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {configSubmitting ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Recursive Tree Node Card Component
 */
function TreeNodeCard({ node, level, expandedNodes, toggleNode, onConfigure, onInspect }) {
  const isExpanded = !!expandedNodes[node.module_id];
  const hasChildren = node.children && node.children.length > 0;

  // Level-based indentation and styling
  const indentPadding = level * 20;

  return (
    <div
      style={{
        background: level === 0 ? '#1e293b' : level === 1 ? '#182234' : '#141d2e',
        borderRadius: '8px',
        border: '1px solid #334155',
        overflow: 'hidden',
        marginLeft: `${indentPadding}px`,
        transition: 'all 0.2s ease',
      }}
    >
      {/* Node Header Row */}
      <div
        style={{
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: isExpanded && hasChildren ? '1px solid #334155' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
          {/* Expand/Collapse Toggle */}
          {hasChildren ? (
            <button
              onClick={() => toggleNode(node.module_id)}
              style={{
                background: '#334155',
                border: 'none',
                color: '#f8fafc',
                borderRadius: '4px',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 700,
              }}
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          ) : (
            <span style={{ width: '24px', textAlign: 'center', color: '#475569' }}>•</span>
          )}

          {/* Kind Badge */}
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: '4px',
              background: node.kind === 'APP' ? '#7c3aed' : node.kind === 'MODULE' ? '#2563eb' : '#059669',
              color: '#ffffff',
            }}
          >
            {node.kind}
          </span>

          {/* Name & Code */}
          <div>
            <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.95rem' }}>{node.name}</span>
            <span style={{ marginLeft: '8px', color: '#94a3b8', fontSize: '0.8rem', fontFamily: 'monospace' }}>
              [{node.module_code}]
            </span>
          </div>

          {/* Inherited Disabled Warning Badge */}
          {node.inherited_disabled && (
            <span
              style={{
                fontSize: '0.75rem',
                padding: '2px 8px',
                borderRadius: '4px',
                background: '#78350f',
                color: '#fef3c7',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
              title={`Disabled due to ancestor: ${node.inheritance_source}`}
            >
              ⚠️ Inherited Disabled ({node.inheritance_source})
            </span>
          )}
        </div>

        {/* Right Badges & Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Configured Status */}
          <span
            style={{
              fontSize: '0.75rem',
              padding: '2px 8px',
              borderRadius: '4px',
              fontWeight: 600,
              background: node.configured_status === 'ACTIVE' ? '#064e3b' : node.configured_status === 'SCHEDULED' ? '#78350f' : '#7f1d1d',
              color: node.configured_status === 'ACTIVE' ? '#6ee7b7' : node.configured_status === 'SCHEDULED' ? '#fde68a' : '#fca5a5',
            }}
          >
            Config: {node.configured_status}
          </span>

          {/* Effective Status */}
          <span
            style={{
              fontSize: '0.75rem',
              padding: '2px 8px',
              borderRadius: '4px',
              fontWeight: 700,
              background: node.effective_status === 'ACTIVE' ? '#10b981' : '#ef4444',
              color: '#ffffff',
            }}
          >
            Effective: {node.effective_status}
          </span>

          {/* Mode Badge */}
          <span
            style={{
              fontSize: '0.75rem',
              padding: '2px 8px',
              borderRadius: '4px',
              fontWeight: 600,
              background: node.mode === 'FULL' ? '#1e40af' : '#0284c7',
              color: '#ffffff',
            }}
          >
            Mode: {node.mode}
          </span>

          {/* Configure Button */}
          <button
            onClick={() => onConfigure(node)}
            style={{
              background: '#334155',
              color: '#f8fafc',
              border: 'none',
              borderRadius: '6px',
              padding: '4px 10px',
              fontSize: '0.8rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            ⚙️ Configure
          </button>

          {/* Inspect Button */}
          <button
            onClick={() => onInspect(node)}
            style={{
              background: '#0f172a',
              color: '#38bdf8',
              border: '1px solid #38bdf8',
              borderRadius: '6px',
              padding: '4px 10px',
              fontSize: '0.8rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            🔍 Inspect
          </button>
        </div>
      </div>

      {/* Action Entitlements Breakdown & Child Nodes */}
      {isExpanded && (
        <div style={{ padding: '12px 16px', background: '#0f172a55' }}>
          {/* Actions Pill Strip */}
          {node.actions && node.actions.length > 0 && (
            <div style={{ marginBottom: hasChildren ? '14px' : '0' }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>
                Action Entitlement Matrix:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {node.actions.map((act) => (
                  <span
                    key={act.action}
                    onClick={() => onInspect(node, act.action)}
                    style={{
                      fontSize: '0.75rem',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      background: act.outcome === 'ALLOWED' ? '#064e3b55' : '#7f1d1d55',
                      border: `1px solid ${act.outcome === 'ALLOWED' ? '#10b981' : '#ef4444'}`,
                      color: act.outcome === 'ALLOWED' ? '#6ee7b7' : '#fca5a5',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                    title={`Click to inspect action: ${act.action}. Reason: ${act.reason}`}
                  >
                    <span>{act.outcome === 'ALLOWED' ? '✓' : '✗'}</span>
                    <strong>{act.action}</strong>
                    <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>({act.outcome})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Child Subtree */}
          {hasChildren && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
              {node.children.map((childNode) => (
                <TreeNodeCard
                  key={childNode.module_id}
                  node={childNode}
                  level={level + 1}
                  expandedNodes={expandedNodes}
                  toggleNode={toggleNode}
                  onConfigure={onConfigure}
                  onInspect={onInspect}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
