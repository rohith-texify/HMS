import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  SlidersHorizontal,
  ShieldCheck,
  Building2,
  Search,
  X,
  RotateCw,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Layers,
  Settings,
  Activity,
  Sparkles,
  Lock,
  Unlock,
  Eye,
  Check,
  Zap,
  Info,
  Calendar,
  Clock,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { fetchCollegesList } from '../services/collegeService';
import {
  fetchAccessMatrix,
  updateFeatureAccess,
  evaluateAccessOutcome,
} from '../services/accessControlService';

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

export default function AccessControlPage() {
  // Active top-level tab: 'matrix' | 'why-denied' | 'templates'
  const [activeTab, setActiveTab] = useState('matrix');

  // Tenant / College selection
  const [colleges, setColleges] = useState([]);
  const [selectedCollegeId, setSelectedCollegeId] = useState('');
  const [collegesLoading, setCollegesLoading] = useState(false);

  // Access Matrix State
  const [matrixData, setMatrixData] = useState(null);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
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

  // Global Feedback Toast
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
    setIsRefreshing(true);
    setMatrixError(null);

    try {
      const data = await fetchAccessMatrix(collegeId, abortControllerRef.current.signal);
      setMatrixData(data);

      // Default expand top-level apps and modules
      const initialExpanded = {};
      const markExpanded = (items) => {
        if (!items) return;
        items.forEach((item) => {
          initialExpanded[item.module_id] = true;
          if (item.children) markExpanded(item.children);
        });
      };
      markExpanded(data.hierarchy || data.root_applications || []);
      setExpandedNodes(initialExpanded);
    } catch (err) {
      if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
        setMatrixError(err.response?.data?.error || err.message || 'Failed to load access matrix');
        setMatrixData(null);
      }
    } finally {
      setMatrixLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCollegeId) {
      loadMatrix(selectedCollegeId);
    }
  }, [selectedCollegeId, loadMatrix]);

  // Tree expand/collapse toggles
  const toggleNode = (nodeId) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  };

  const expandAll = () => {
    const all = {};
    function mark(items) {
      if (!items) return;
      items.forEach((item) => {
        all[item.module_id] = true;
        if (item.children) mark(item.children);
      });
    }
    mark(matrixData?.hierarchy || matrixData?.root_applications);
    setExpandedNodes(all);
  };

  const collapseAll = () => {
    setExpandedNodes({});
  };

  // Open Configuration Modal
  const openConfigModal = (node) => {
    setSelectedItemForConfig(node);
    setConfigForm({
      status: node.configured_status || node.effective_status || 'ACTIVE',
      mode: node.configured_mode || node.mode || 'FULL',
      effective_from: node.effective_from ? node.effective_from.substring(0, 16) : '',
      effective_to: node.effective_to ? node.effective_to.substring(0, 16) : '',
      reason: '',
    });
    setConfigError(null);
  };

  const closeConfigModal = () => {
    setSelectedItemForConfig(null);
    setConfigError(null);
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    if (!selectedItemForConfig) return;

    if (!configForm.reason || configForm.reason.trim().length < 5) {
      setConfigError('A mandatory justification reason (min 5 characters) is required for audit logs.');
      return;
    }

    try {
      setConfigSubmitting(true);
      setConfigError(null);

      const payload = {
        college_id: selectedCollegeId,
        module_id: selectedItemForConfig.module_id,
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
    const roots = matrixData?.hierarchy || matrixData?.root_applications;
    if (!roots) return [];

    function matchesFilter(node) {
      const q = searchFilter.toLowerCase();
      const nodeName = (node.module_name || node.name || '').toLowerCase();
      const nodeCode = (node.module_code || '').toLowerCase();
      const matchesSearch = !q || nodeName.includes(q) || nodeCode.includes(q);

      const matchesKind = kindFilter === 'ALL' || node.kind === kindFilter;
      const matchesStatus = statusFilter === 'ALL' || node.effective_status === statusFilter;
      const nodeMode = node.effective_mode || node.mode || 'FULL';
      const matchesMode = modeFilter === 'ALL' || nodeMode === modeFilter;

      return matchesSearch && matchesKind && matchesStatus && matchesMode;
    }

    function filterNode(node) {
      const childMatches = (node.children || []).map(filterNode).filter(Boolean);
      const isSelfMatch = matchesFilter(node);

      if (isSelfMatch || childMatches.length > 0) {
        return {
          ...node,
          children: childMatches,
        };
      }
      return null;
    }

    return roots.map(filterNode).filter(Boolean);
  }, [matrixData, searchFilter, kindFilter, statusFilter, modeFilter]);

  // Aggregate Metrics
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
        const itemMode = item.effective_mode || item.mode || 'FULL';
        if (itemMode === 'READ_ONLY') readOnlyNodes++;
        if (item.inherited_disabled) inheritedDisabledNodes++;
        if (item.children) count(item.children);
      });
    }

    const roots = matrixData?.hierarchy || matrixData?.root_applications;
    if (roots) {
      count(roots);
    }

    return { totalNodes, activeNodes, disabledNodes, readOnlyNodes, inheritedDisabledNodes };
  }, [matrixData]);

  const selectedCollege = colleges.find((c) => c.college_id === selectedCollegeId);

  return (
    <div className="access-control-page-container animate-fade-in">
      {/* Top Header & Breadcrumbs */}
      <div className="access-hero-header">
        <div className="access-hero-text">
          <div className="access-breadcrumbs">
            <Link to="/dashboard" className="breadcrumb-link">Dashboard</Link>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current">Governance Matrix</span>
          </div>
          <h1 className="access-title">Feature &amp; Module Access Control</h1>
          <p className="access-subtitle">
            Granular entitlement enforcement, action-level restrictions, read-only policies, and inheritance diagnostics.
          </p>
        </div>

        {/* Tenant Selector Pill */}
        <div className="tenant-selector-pill">
          <Building2 size={16} className="text-blue-600 flex-shrink-0" />
          <div className="tenant-selector-content">
            <span className="selector-label">Target Tenant:</span>
            {collegesLoading ? (
              <span className="text-xs text-slate-500">Loading institutions...</span>
            ) : (
              <select
                value={selectedCollegeId}
                onChange={(e) => {
                  setSelectedCollegeId(e.target.value);
                  setEvalForm((prev) => ({ ...prev, college_id: e.target.value }));
                }}
                className="tenant-select-dropdown"
              >
                {colleges.map((c) => (
                  <option key={c.college_id} value={c.college_id}>
                    {c.name} ({c.college_code || c.code})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Top 4 KPI Stat Cards */}
      <div className="access-kpi-grid">
        {/* Card 1: Total Nodes */}
        <div className="access-stat-card card-stagger-1">
          <div className="access-stat-header">
            <span className="access-stat-label">Hierarchy Nodes</span>
            <div className="access-stat-icon-wrap blue">
              <Layers size={17} />
            </div>
          </div>
          <div className="access-stat-value text-slate-900">
            <CountUpNumber value={matrixMetrics.totalNodes} />
          </div>
          <div className="access-stat-subtext">Registered apps, modules &amp; features</div>
          <div className="access-stat-accent-bar blue" />
        </div>

        {/* Card 2: Active Effective */}
        <div className="access-stat-card card-stagger-2">
          <div className="access-stat-header">
            <span className="access-stat-label">Active Effective</span>
            <div className="access-stat-icon-wrap green">
              <CheckCircle2 size={17} />
            </div>
          </div>
          <div className="access-stat-value text-emerald-600">
            <CountUpNumber value={matrixMetrics.activeNodes} />
          </div>
          <div className="access-stat-subtext">Fully operational for tenant</div>
          <div className="access-stat-accent-bar green" />
        </div>

        {/* Card 3: Disabled Effective */}
        <div className="access-stat-card card-stagger-3">
          <div className="access-stat-header">
            <span className="access-stat-label">Disabled Restrictions</span>
            <div className="access-stat-icon-wrap rose">
              <AlertTriangle size={17} />
            </div>
          </div>
          <div className="access-stat-value text-rose-600">
            <CountUpNumber value={matrixMetrics.disabledNodes} />
          </div>
          <div className="access-stat-subtext">Directly or inherited off</div>
          <div className="access-stat-accent-bar rose" />
        </div>

        {/* Card 4: Read-Only Mode */}
        <div className="access-stat-card card-stagger-4">
          <div className="access-stat-header">
            <span className="access-stat-label">Read-Only Mode</span>
            <div className="access-stat-icon-wrap indigo">
              <Eye size={17} />
            </div>
          </div>
          <div className="access-stat-value text-indigo-600">
            <CountUpNumber value={matrixMetrics.readOnlyNodes} />
          </div>
          <div className="access-stat-subtext">Mutations blocked by backend</div>
          <div className="access-stat-accent-bar indigo" />
        </div>
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div className={`access-feedback-banner ${feedback.type === 'success' ? 'success' : 'danger'} animate-slide-up`}>
          <div className="feedback-content">
            {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{feedback.message}</span>
          </div>
          <button type="button" className="feedback-close-btn" onClick={() => setFeedback(null)}>
            <X size={14} />
          </button>
        </div>
      )}
          
      {/* Main Content Card */}
      <div className="access-main-card card-stagger-4">
        {/* Navigation Tabs Pillbox */}
        <div className="access-nav-tabs">
          <button
            type="button"
            className={`access-tab-pill ${activeTab === 'matrix' ? 'active' : ''}`}
            onClick={() => setActiveTab('matrix')}
          >
            <SlidersHorizontal size={13} className="inline-icon" />
            Access Hierarchy Matrix
          </button>
          <button
            type="button"
            className={`access-tab-pill ${activeTab === 'why-denied' ? 'active' : ''}`}
            onClick={() => setActiveTab('why-denied')}
          >
            <Zap size={13} className="inline-icon" />
            &quot;Why Is This Denied?&quot; Inspector
          </button>
          <button
            type="button"
            className={`access-tab-pill ${activeTab === 'templates' ? 'active' : ''}`}
            onClick={() => setActiveTab('templates')}
          >
            <Layers size={13} className="inline-icon" />
            Plan &amp; Blueprint Advisory
          </button>
        </div>

        {/* TAB 1: ACCESS MATRIX */}
        {activeTab === 'matrix' && (
          <div>
            {/* Filter Toolbar */}
            <div className="access-toolbar">
              <div className="access-search-box">
                <Search size={15} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search feature, module, or code..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="access-search-input"
                />
                {searchFilter && (
                  <button
                    type="button"
                    className="search-clear-btn"
                    onClick={() => setSearchFilter('')}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <div className="access-filters-group">
                <select
                  value={kindFilter}
                  onChange={(e) => setKindFilter(e.target.value)}
                  className="access-select-input"
                >
                  <option value="ALL">All Levels</option>
                  <option value="APP">Applications Only</option>
                  <option value="MODULE">Modules Only</option>
                  <option value="FEATURE">Features Only</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="access-select-input"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Effective ACTIVE</option>
                  <option value="DISABLED">Effective DISABLED</option>
                  <option value="SCHEDULED">Effective SCHEDULED</option>
                </select>

                <select
                  value={modeFilter}
                  onChange={(e) => setModeFilter(e.target.value)}
                  className="access-select-input"
                >
                  <option value="ALL">All Modes</option>
                  <option value="FULL">FULL Access</option>
                  <option value="READ_ONLY">READ_ONLY Mode</option>
                </select>
              </div>

              <div className="access-tree-buttons">
                <button
                  type="button"
                  className="btn-enterprise btn-outline-soft btn-sm"
                  onClick={expandAll}
                >
                  Expand All
                </button>
                <button
                  type="button"
                  className="btn-enterprise btn-outline-soft btn-sm"
                  onClick={collapseAll}
                >
                  Collapse All
                </button>
                <button
                  type="button"
                  className={`btn-enterprise btn-outline-soft btn-sm ${isRefreshing ? 'is-loading' : ''}`}
                  onClick={() => loadMatrix(selectedCollegeId)}
                  disabled={isRefreshing}
                >
                  <RotateCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Error Banner */}
            {matrixError && !matrixLoading && (
              <div className="access-error-banner">
                <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
                <span>{matrixError}</span>
              </div>
            )}

            {/* Loading State */}
            {matrixLoading ? (
              <div className="access-loading-state">
                <div className="loading-spinner-blue" />
                <div className="loading-state-title">Loading Access Hierarchy Matrix...</div>
                <div className="loading-state-sub">Evaluating parent/child inheritance states for tenant {selectedCollege?.name || 'institution'}.</div>
              </div>
            ) : filteredTree.length === 0 ? (
              <div className="access-empty-state">
                <div className="empty-state-badge-stage">
                  <div className="empty-state-badge-pulse" />
                  <div className="empty-state-icon-badge">
                    <SlidersHorizontal size={32} className="text-blue-600" />
                  </div>
                </div>
                <h3 className="empty-state-heading">No Features Match Filters</h3>
                <p className="empty-state-description">Try adjusting your search criteria or resetting filters.</p>
              </div>
            ) : (
              <div className="access-tree-container">
                {filteredTree.map((appNode) => (
                  <ModernTreeNodeCard
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
          <div className="inspector-grid">
            {/* Simulator Form */}
            <div className="inspector-card">
              <div className="inspector-card-header">
                <div className="modal-header-icon-wrap blue">
                  <Zap size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Simulate Access Check</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Test backend entitlement validation with live tenant state</p>
                </div>
              </div>

              <form onSubmit={handleRunEvaluation} className="inspector-form mt-4">
                <div className="form-group-custom">
                  <label className="form-label-custom">Tenant College *</label>
                  <select
                    value={evalForm.college_id}
                    onChange={(e) => setEvalForm({ ...evalForm, college_id: e.target.value })}
                    className="form-input-custom"
                    required
                  >
                    {colleges.map((c) => (
                      <option key={c.college_id} value={c.college_id}>
                        {c.name} ({c.college_code || c.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group-custom">
                  <label className="form-label-custom">Module / Feature Code *</label>
                  <input
                    type="text"
                    placeholder="e.g. VISITOR_LOGS or HOSTEL_SETUP"
                    value={evalForm.module_code}
                    onChange={(e) => setEvalForm({ ...evalForm, module_code: e.target.value })}
                    className="form-input-custom font-mono"
                    required
                  />
                </div>

                <div className="form-group-custom">
                  <label className="form-label-custom">Action Capability *</label>
                  <input
                    type="text"
                    placeholder="e.g. visitor.view, visitor.manage, hostel.delete"
                    value={evalForm.action}
                    onChange={(e) => setEvalForm({ ...evalForm, action: e.target.value })}
                    className="form-input-custom font-mono"
                    required
                  />
                </div>

                <div className="form-group-custom">
                  <label className="form-label-custom">HTTP Method</label>
                  <select
                    value={evalForm.http_method}
                    onChange={(e) => setEvalForm({ ...evalForm, http_method: e.target.value })}
                    className="form-input-custom"
                  >
                    <option value="GET">GET (Read request)</option>
                    <option value="POST">POST (Create / Trigger)</option>
                    <option value="PUT">PUT (Replace record)</option>
                    <option value="PATCH">PATCH (Update record)</option>
                    <option value="DELETE">DELETE (Remove record)</option>
                  </select>
                </div>

                <div className="form-group-custom">
                  <label className="form-label-custom">User ID (Optional)</label>
                  <input
                    type="text"
                    placeholder="UUID of user to test user-level permissions"
                    value={evalForm.user_id}
                    onChange={(e) => setEvalForm({ ...evalForm, user_id: e.target.value })}
                    className="form-input-custom font-mono text-xs"
                  />
                </div>

                {evalError && (
                  <div className="modal-error-notice">
                    <AlertCircle size={15} />
                    <span>{evalError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={evalLoading}
                  className="btn-enterprise btn-primary-blue w-full justify-center mt-2"
                >
                  <Zap size={14} className={evalLoading ? 'animate-spin' : ''} />
                  <span>{evalLoading ? 'Evaluating Multi-Stage Gates...' : 'Evaluate Access Outcome'}</span>
                </button>
              </form>
            </div>

            {/* Diagnostic Trace Outcome */}
            <div className="inspector-card">
              <div className="inspector-card-header">
                <div className="modal-header-icon-wrap indigo">
                  <Activity size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Diagnostic Outcome &amp; Pipeline Trace</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Authoritative 6-stage policy decision pipeline</p>
                </div>
              </div>

              {!evalResult && !evalLoading && (
                <div className="inspector-empty-state">
                  <ShieldCheck size={36} className="text-slate-300" />
                  <div className="empty-title">No Evaluation Executed Yet</div>
                  <div className="empty-sub">
                    Configure parameters on the left or click &quot;Inspect&quot; on any tree item to test permission outcomes.
                  </div>
                </div>
              )}

              {evalLoading && (
                <div className="access-loading-state" style={{ padding: '40px' }}>
                  <div className="loading-spinner-blue" />
                  <div className="loading-state-title">Evaluating Multi-Stage Policy Gates...</div>
                  <div className="loading-state-sub">Checking catalog, tenant entitlement, parent hierarchy &amp; permissions.</div>
                </div>
              )}

              {evalResult && !evalLoading && (
                <div className="eval-results-container mt-4 animate-slide-up">
                  {/* Decision Banner */}
                  <div className={`eval-decision-banner ${evalResult.decision === 'ALLOWED' ? 'allowed' : 'denied'}`}>
                    <div className="decision-left">
                      <div className="decision-tag">POLICY DECISION</div>
                      <div className="decision-headline">
                        {evalResult.decision === 'ALLOWED' ? 'ACCESS ALLOWED' : 'ACCESS DENIED'}
                      </div>
                      <div className="decision-code">
                        Reason: <code>{evalResult.reason_code}</code>
                      </div>
                    </div>
                    {evalResult.decision === 'ALLOWED' ? (
                      <CheckCircle2 size={32} className="text-emerald-500" />
                    ) : (
                      <AlertCircle size={32} className="text-rose-500" />
                    )}
                  </div>

                  {/* Remediation Advice */}
                  {evalResult.remediation && (
                    <div className="eval-remediation-box mt-3">
                      <div className="remediation-title">
                        <Sparkles size={14} className="text-blue-600" />
                        <span>Remediation Advice</span>
                      </div>
                      <p className="remediation-text">{evalResult.remediation}</p>
                    </div>
                  )}

                  {/* Step Trace Pipeline */}
                  <div className="eval-steps-list mt-4">
                    <h4 className="steps-heading">Evaluation Pipeline Steps</h4>
                    <div className="steps-cards-wrap">
                      {evalResult.steps &&
                        evalResult.steps.map((st, idx) => (
                          <div
                            key={idx}
                            className={`eval-step-row ${
                              st.status === 'PASS' ? 'pass' : st.status === 'FAIL' ? 'fail' : 'neutral'
                            }`}
                          >
                            <div className="step-main">
                              <div className="step-title-wrap">
                                <span className="step-name">{st.step}</span>
                                <span className={`step-badge ${st.status.toLowerCase()}`}>
                                  {st.status}
                                </span>
                              </div>
                              <div className="step-message">{st.message}</div>
                            </div>
                            {st.detail && <div className="step-detail">{st.detail}</div>}
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
          <div className="advisories-container">
            <div className="advisories-card">
              <div className="advisory-header">
                <div className="modal-header-icon-wrap indigo">
                  <Info size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Plan &amp; Blueprint Entitlement Architecture</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Authoritative template and feature bundle synchronization</p>
                </div>
              </div>

              <div className="advisories-body">
                <div className="advisory-item">
                  <div className="advisory-title">Template Blueprints</div>
                  <p className="advisory-text">
                    Institutions inherit entitlement configurations from assigned subscription tier blueprints.
                    Individual overrides configured in the Access Hierarchy Matrix supersede global template defaults.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                  <div className="blueprint-card">
                    <div className="blueprint-title">Standard College Blueprint</div>
                    <div className="blueprint-desc">
                      Includes Core Student Management, Basic Attendance, Hostel Hierarchy, and Read-Only Complaints.
                    </div>
                    <span className="badge-type-pill system mt-2 inline-block">Active Fixture</span>
                  </div>

                  <div className="blueprint-card">
                    <div className="blueprint-title">Premium Enterprise Blueprint</div>
                    <div className="blueprint-desc">
                      Includes Full Access to all Apps, Biometric Gate Pass workflows, Mess Management, and Deep Analytics.
                    </div>
                    <span className="badge-type-pill custom mt-2 inline-block">Enterprise Ready</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CONFIGURATION MODAL */}
      {selectedItemForConfig && (
        <div className="modal-backdrop-blur">
          <div className="modal-dialog-card animate-badge-pop" style={{ maxWidth: '600px' }}>
            <div className="modal-dialog-header">
              <div className="modal-header-icon-wrap blue">
                <Settings size={20} />
              </div>
              <div className="modal-header-text">
                <h3 className="modal-header-title">{selectedItemForConfig.name}</h3>
                <div className="role-modal-badges">
                  <span className="code-pill">{selectedItemForConfig.module_code}</span>
                  <span className="badge-scope platform">{selectedItemForConfig.kind}</span>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={closeConfigModal}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveConfig}>
              <div className="modal-dialog-body">
                {selectedItemForConfig.inherited_disabled && (
                  <div className="modal-error-notice" style={{ backgroundColor: '#fffbeb', borderColor: '#fde68a', color: '#92400e' }}>
                    <AlertTriangle size={16} className="text-amber-600" />
                    <span>
                      <strong>Inherited Disabled Notice:</strong> An ancestor ({selectedItemForConfig.inheritance_source}) is disabled. Enabling this node will take effect once the parent application/module is also enabled.
                    </span>
                  </div>
                )}

                {configError && (
                  <div className="modal-error-notice">
                    <AlertCircle size={15} />
                    <span>{configError}</span>
                  </div>
                )}

                <div className="form-group-custom">
                  <label className="form-label-custom">Entitlement Status *</label>
                  <select
                    value={configForm.status}
                    onChange={(e) => setConfigForm({ ...configForm, status: e.target.value })}
                    className="form-input-custom"
                  >
                    <option value="ACTIVE">ACTIVE (Feature enabled for tenant)</option>
                    <option value="DISABLED">DISABLED (Feature denied for tenant)</option>
                    <option value="SCHEDULED">SCHEDULED (Active during effective dates only)</option>
                  </select>
                </div>

                <div className="form-group-custom">
                  <label className="form-label-custom">Operating Mode *</label>
                  <select
                    value={configForm.mode}
                    onChange={(e) => setConfigForm({ ...configForm, mode: e.target.value })}
                    className="form-input-custom"
                  >
                    <option value="FULL">FULL ACCESS (All permitted actions allowed)</option>
                    <option value="READ_ONLY">READ_ONLY (Mutations POST/PUT/PATCH/DELETE blocked by backend)</option>
                  </select>
                  <span className="text-xs text-slate-500 mt-1">
                    When READ_ONLY is set, users can view records but edit/create operations are rejected with HTTP 403.
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="form-group-custom">
                    <label className="form-label-custom">Effective From</label>
                    <input
                      type="datetime-local"
                      value={configForm.effective_from}
                      onChange={(e) => setConfigForm({ ...configForm, effective_from: e.target.value })}
                      className="form-input-custom text-xs"
                    />
                  </div>

                  <div className="form-group-custom">
                    <label className="form-label-custom">Effective To</label>
                    <input
                      type="datetime-local"
                      value={configForm.effective_to}
                      onChange={(e) => setConfigForm({ ...configForm, effective_to: e.target.value })}
                      className="form-input-custom text-xs"
                    />
                  </div>
                </div>

                <div className="form-group-custom">
                  <label className="form-label-custom">Reason for Change *</label>
                  <textarea
                    rows={3}
                    placeholder="Provide mandatory audit justification for change log..."
                    value={configForm.reason}
                    onChange={(e) => setConfigForm({ ...configForm, reason: e.target.value })}
                    className="form-input-custom textarea"
                    required
                  />
                </div>
              </div>

              <div className="modal-dialog-footer">
                <button
                  type="button"
                  className="btn-enterprise btn-outline-soft"
                  onClick={closeConfigModal}
                  disabled={configSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-enterprise btn-primary-blue"
                  disabled={configSubmitting}
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
 * Modern Recursive Tree Node Component
 */
function ModernTreeNodeCard({ node, level, expandedNodes, toggleNode, onConfigure, onInspect }) {
  const isExpanded = !!expandedNodes[node.module_id];
  const hasChildren = node.children && node.children.length > 0;
  const indentPadding = level * 20;

  return (
    <div
      className={`access-node-card level-${level}`}
      style={{ marginLeft: `${indentPadding}px` }}
    >
      <div className="access-node-header">
        <div className="access-node-left">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleNode(node.module_id)}
              className="toggle-expand-btn"
              title={isExpanded ? 'Collapse node' : 'Expand node'}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <span className="no-children-dot">•</span>
          )}

          <span className={`node-kind-tag ${node.kind.toLowerCase()}`}>
            {node.kind}
          </span>

          <div className="node-title-group">
            <span className="node-name">{node.module_name || node.name}</span>
            <code className="node-code">[{node.module_code}]</code>
          </div>

          {node.inherited_disabled && (
            <span className="inherited-disabled-pill" title={`Disabled due to ancestor: ${node.inheritance_source}`}>
              <AlertTriangle size={11} />
              <span>Inherited Disabled ({node.inheritance_source})</span>
            </span>
          )}
        </div>

        <div className="access-node-right">
          <span className={`node-status-badge ${node.effective_status.toLowerCase()}`}>
            {node.effective_status === 'ACTIVE' ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
            <span>{node.effective_status}</span>
          </span>

          <span className={`node-mode-badge ${(node.effective_mode || node.mode) === 'FULL' ? 'full' : 'readonly'}`}>
            {(node.effective_mode || node.mode) === 'FULL' ? <Unlock size={11} /> : <Lock size={11} />}
            <span>{node.effective_mode || node.mode || 'FULL'}</span>
          </span>

          <button
            type="button"
            onClick={() => onConfigure(node)}
            className="btn-table-action"
            title="Configure entitlement & mode"
          >
            <Settings size={12} />
            <span>Configure</span>
          </button>

          <button
            type="button"
            onClick={() => onInspect(node)}
            className="btn-table-action"
            title="Inspect in diagnostic simulator"
          >
            <Zap size={12} />
            <span>Inspect</span>
          </button>
        </div>
      </div>

      {/* Expanded Actions & Subtree */}
      {isExpanded && (
        <div className="access-node-body">
          {node.actions && node.actions.length > 0 && (
            <div className="node-actions-strip">
              <span className="actions-strip-label">Action Entitlements:</span>
              <div className="actions-chips-wrap">
                {node.actions.map((act) => {
                  const actionCode = act.action_code || act.action;
                  const accessOutcome = act.effective_access || act.outcome || 'ALLOWED';
                  const isAllowed = accessOutcome === 'ALLOWED';
                  return (
                    <button
                      type="button"
                      key={actionCode}
                      onClick={() => onInspect(node, actionCode)}
                      className={`action-chip ${isAllowed ? 'allowed' : 'denied'}`}
                      title={`Click to test: ${actionCode}`}
                    >
                      <span>{isAllowed ? '✓' : '✗'}</span>
                      <strong>{actionCode}</strong>
                      <span className="action-outcome">({accessOutcome})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {hasChildren && (
            <div className="node-subtree">
              {node.children.map((childNode) => (
                <ModernTreeNodeCard
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
