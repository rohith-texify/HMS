import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Layers,
  BookOpen,
  History,
  Building2,
  RotateCw,
  Search,
  X,
  SlidersHorizontal,
  Snowflake,
  Zap,
  Power,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  CopyCheck,
  ExternalLink,
  Calendar,
  Sparkles,
  Check,
  Lock,
  Unlock,
  AlertCircle,
  ChevronRight,
  Filter,
  Info,
} from 'lucide-react';
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

// Case-tolerant normalizers for matrix items
const getModuleId = (m) => m?.ModuleID || m?.module_id || m?.id || '';
const getModuleName = (m) => m?.ModuleName || m?.module_name || m?.name || 'Unknown Module';
const getModuleCode = (m) => m?.ModuleCode || m?.module_code || m?.code || '';
const getModuleKind = (m) => (m?.Kind || m?.kind || 'MODULE').toUpperCase();
const getConfiguredStatus = (m) => (m?.ConfiguredStatus || m?.configured_status || 'ACTIVE').toUpperCase();
const getConfiguredMode = (m) => (m?.ConfiguredMode || m?.configured_mode || 'FULL').toUpperCase();
const getEffectiveStatus = (m) => (m?.EffectiveStatus || m?.effective_status || 'ACTIVE').toUpperCase();
const getEffectiveMode = (m) => (m?.EffectiveMode || m?.effective_mode || 'FULL').toUpperCase();
const getIsCore = (m) => !!(m?.IsCore ?? m?.is_core ?? false);
const getPriority = (m) => m?.Priority || m?.priority || 'O';
const getParentName = (m) => m?.ParentName || m?.parent_name || '';

export default function ModulesPage() {
  const { id: routeCollegeId } = useParams();
  const navigate = useNavigate();

  // Active view tab: 'matrix' | 'catalogue' | 'history'
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

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterKind, setFilterKind] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Loading & Notice States
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  // Action Dialog Modal State
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

  // Template Application Modal State
  const [templateModal, setTemplateModal] = useState({
    isOpen: false,
    templateId: '',
    submitting: false,
    error: null,
  });

  const abortRef = useRef(null);

  // 1. Initial Load of Colleges
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

  // 2. Concurrently Load College Details, Entitlements Matrix, Catalogue & History
  const loadData = useCallback(async (isSilent = false) => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    if (!isSilent) {
      setLoading(true);
    }
    setIsRefreshing(true);
    setError(null);

    const promises = [
      fetchModuleCatalogue({}, controller.signal),
      fetchEntitlementTemplates(controller.signal),
    ];

    if (selectedCollegeId) {
      promises.push(
        fetchCollegeById(selectedCollegeId, controller.signal),
        fetchCollegeEntitlementMatrix(selectedCollegeId, controller.signal),
        fetchModuleHistory(selectedCollegeId, null, 50, 0, controller.signal)
      );
    }

    try {
      const results = await Promise.allSettled(promises);
      if (controller.signal.aborted) return;

      // Handle catalogue
      if (results[0].status === 'fulfilled' && results[0].value?.modules?.length > 0) {
        setCatalogue(results[0].value.modules);
      }
      // Handle templates
      if (results[1].status === 'fulfilled' && results[1].value) {
        setTemplates(results[1].value);
      }

      if (selectedCollegeId && results.length >= 5) {
        if (results[2].status === 'fulfilled' && results[2].value) {
          setCurrentCollege(results[2].value);
        }
        if (results[3].status === 'fulfilled' && results[3].value) {
          setMatrix(results[3].value);
        }
        if (results[4].status === 'fulfilled' && results[4].value?.history) {
          setHistoryRecords(results[4].value.history);
        }
      }
    } catch (err) {
      if (err?.name !== 'CanceledError' && !err?.isCanceled && !controller.signal.aborted) {
        setError(err.message || 'Failed to refresh module entitlements');
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [selectedCollegeId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCollegeChange = (e) => {
    const newId = e.target.value;
    setSelectedCollegeId(newId);
    if (newId) {
      navigate(`/colleges/${newId}/modules`);
    }
  };

  // Open Action Modal with Impact Preview
  const openActionModal = async (item, initialStatus, initialMode) => {
    const currentStatus = getConfiguredStatus(item);
    const currentMode = getConfiguredMode(item);
    const targetStatus = initialStatus || currentStatus || 'ACTIVE';
    const targetMode = initialMode || currentMode || 'FULL';

    setActionModal({
      isOpen: true,
      item,
      targetStatus,
      targetMode,
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
      const prev = await previewModuleImpact(selectedCollegeId, getModuleId(item), {
        status: targetStatus,
        mode: targetMode,
      });
      setActionModal((prevModal) => ({
        ...prevModal,
        previewLoading: false,
        preview: prev,
        requestApproval: !!prev?.requires_approval,
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
        error: 'An authoritative business justification is required for entitlement state changes.',
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
        getModuleId(actionModal.item),
        payload
      );

      setActionModal((prev) => ({ ...prev, isOpen: false }));
      setNotice({
        type: 'success',
        text: res.requires_approval
          ? `Module "${getModuleName(actionModal.item)}" change submitted for Super Admin Maker-Checker approval.`
          : `Module "${getModuleName(actionModal.item)}" entitlement updated successfully.`,
      });
      setTimeout(() => setNotice(null), 6000);

      // Refresh table
      loadData(true);
    } catch (err) {
      setActionModal((prev) => ({
        ...prev,
        submitting: false,
        error: err.message || 'Operation failed',
      }));
    }
  };

  // Apply Bulk Template
  const handleApplyTemplate = async (e) => {
    e.preventDefault();
    if (!templateModal.templateId) {
      setTemplateModal((prev) => ({ ...prev, error: 'Please select an entitlement template.' }));
      return;
    }

    setTemplateModal((prev) => ({ ...prev, submitting: true, error: null }));
    try {
      await applyTemplateToCollege(templateModal.templateId, selectedCollegeId);
      setTemplateModal({ isOpen: false, templateId: '', submitting: false, error: null });
      setNotice({
        type: 'success',
        text: 'Bulk entitlement template applied successfully to the college.',
      });
      setTimeout(() => setNotice(null), 6000);
      loadData(true);
    } catch (err) {
      setTemplateModal((prev) => ({
        ...prev,
        submitting: false,
        error: err.message || 'Template application failed',
      }));
    }
  };

  // KPI Calculations
  const stats = useMemo(() => {
    const total = matrix.length;
    let active = 0;
    let frozen = 0;
    let pendingApprovalOrDisabled = 0;

    matrix.forEach((item) => {
      const effStatus = getEffectiveStatus(item);
      const effMode = getEffectiveMode(item);
      const hasPendingApproval = !!(item.PendingApprovalID || item.pending_approval_id);

      if (effStatus === 'ACTIVE' && effMode === 'FULL') {
        active++;
      } else if (effStatus === 'ACTIVE' && effMode === 'READ_ONLY') {
        frozen++;
      }
      if (effStatus === 'DISABLED' || hasPendingApproval) {
        pendingApprovalOrDisabled++;
      }
    });

    return { total, active, frozen, pendingApprovalOrDisabled };
  }, [matrix]);

  // Filtered Matrix List
  const filteredMatrix = useMemo(() => {
    return matrix.filter((item) => {
      const kind = getModuleKind(item);
      const effStatus = getEffectiveStatus(item);
      const effMode = getEffectiveMode(item);
      const confStatus = getConfiguredStatus(item);
      const name = getModuleName(item).toLowerCase();
      const code = getModuleCode(item).toLowerCase();
      const parent = getParentName(item).toLowerCase();

      if (filterKind !== 'ALL' && kind !== filterKind) return false;

      if (filterStatus !== 'ALL') {
        if (filterStatus === 'ACTIVE' && (effStatus !== 'ACTIVE' || effMode === 'READ_ONLY')) return false;
        if (filterStatus === 'READ_ONLY' && (effStatus !== 'ACTIVE' || effMode !== 'READ_ONLY')) return false;
        if (filterStatus === 'DISABLED' && effStatus !== 'DISABLED') return false;
        if (filterStatus === 'SCHEDULED' && confStatus !== 'SCHEDULED') return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return name.includes(q) || code.includes(q) || parent.includes(q);
      }

      return true;
    });
  }, [matrix, filterKind, filterStatus, searchQuery]);

  // Filtered Catalogue List
  const filteredCatalogue = useMemo(() => {
    return catalogue.filter((m) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const name = (m.module_name || m.name || '').toLowerCase();
      const code = (m.module_code || m.code || '').toLowerCase();
      return name.includes(q) || code.includes(q);
    });
  }, [catalogue, searchQuery]);

  // Active filters count
  const activeFiltersCount = (filterKind !== 'ALL' ? 1 : 0) + (filterStatus !== 'ALL' ? 1 : 0) + (searchQuery.trim() ? 1 : 0);

  return (
    <div className="modules-page-container">
      {/* Breadcrumbs & Header Section */}
      <div className="modules-header-section">
        <div className="modules-header-left">
          <div className="breadcrumb-trail" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#64748B', marginBottom: '6px' }}>
            <Link to="/dashboard" style={{ color: '#64748B', textDecoration: 'none' }}>Dashboard</Link>
            <ChevronRight size={14} />
            <span style={{ color: '#0F172A', fontWeight: 600 }}>Module Management</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h1 className="page-title" style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
              Module Management & Entitlements
            </h1>
            {currentCollege && (
              <span className={`modules-tenant-badge-pill ${currentCollege.status === 'ACTIVE' ? 'active' : ''}`}>
                <Building2 size={13} style={{ color: currentCollege.status === 'ACTIVE' ? '#10B981' : '#F59E0B' }} />
                <span>{currentCollege.name} ({currentCollege.college_code})</span>
              </span>
            )}
          </div>
          <p className="page-subtitle" style={{ fontSize: '0.86rem', color: '#64748B', margin: '4px 0 0 0' }}>
            Authoritative platform module catalogue, tenant entitlement matrix, dependency enforcement, and workflow freeze governance.
          </p>
        </div>

        {/* Header Actions */}
        <div className="modules-header-right">
          {/* Tenant Selector Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '4px 10px' }}>
            <Building2 size={15} style={{ color: '#2563EB' }} />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>College:</span>
            <select
              id="college-select"
              value={selectedCollegeId}
              onChange={handleCollegeChange}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: '0.83rem',
                fontWeight: 600,
                color: '#0F172A',
                cursor: 'pointer',
                maxWidth: '240px',
              }}
            >
              {(Array.isArray(colleges) ? colleges : []).map((c) => (
                <option key={c.college_id} value={c.college_id}>
                  {c.name} ({c.college_code})
                </option>
              ))}
            </select>
          </div>

          {selectedCollegeId && (
            <Link to={`/colleges/${selectedCollegeId}`} className="btn-enterprise btn-outline-soft" style={{ textDecoration: 'none' }}>
              <ExternalLink size={14} />
              <span>College Profile</span>
            </Link>
          )}

          <button
            type="button"
            className="btn-enterprise btn-outline-soft"
            onClick={() => setTemplateModal({ isOpen: true, templateId: '', submitting: false, error: null })}
            disabled={!selectedCollegeId}
          >
            <CopyCheck size={14} />
            <span>Apply Template</span>
          </button>

          <button
            type="button"
            className={`btn-enterprise btn-outline-soft ${isRefreshing ? 'is-loading' : ''}`}
            onClick={() => loadData(false)}
            disabled={isRefreshing}
          >
            <RotateCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Top 4 KPI Metric Cards */}
      <div className="modules-kpi-grid">
        {/* KPI 1: Total Capabilities */}
        <div className="modules-stat-card card-stagger-1">
          <div className="modules-stat-header">
            <span className="modules-stat-label">Total Capabilities</span>
            <div className="modules-stat-icon-wrap blue">
              <Layers size={18} />
            </div>
          </div>
          <div className="modules-stat-value text-slate-900">
            <CountUpNumber value={stats.total} />
          </div>
          <div className="modules-stat-subtext">Registered platform capabilities</div>
          <div className="modules-stat-accent-bar blue" />
        </div>

        {/* KPI 2: Active & Operational */}
        <div className="modules-stat-card card-stagger-2">
          <div className="modules-stat-header">
            <span className="modules-stat-label">Active & Operational</span>
            <div className="modules-stat-icon-wrap green">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="modules-stat-value text-emerald-600">
            <CountUpNumber value={stats.active} />
          </div>
          <div className="modules-stat-subtext">Full read-and-write accessibility</div>
          <div className="modules-stat-accent-bar green" />
        </div>

        {/* KPI 3: Workflow Frozen (Read-Only) */}
        <div className="modules-stat-card card-stagger-3">
          <div className="modules-stat-header">
            <span className="modules-stat-label">Frozen (Read-Only)</span>
            <div className="modules-stat-icon-wrap amber">
              <Snowflake size={18} />
            </div>
          </div>
          <div className="modules-stat-value text-amber-600">
            <CountUpNumber value={stats.frozen} />
          </div>
          <div className="modules-stat-subtext">Workflows frozen for governance</div>
          <div className="modules-stat-accent-bar amber" />
        </div>

        {/* KPI 4: Pending / Disabled */}
        <div className="modules-stat-card card-stagger-4">
          <div className="modules-stat-header">
            <span className="modules-stat-label">Disabled / Pending Gate</span>
            <div className="modules-stat-icon-wrap purple">
              <Clock size={18} />
            </div>
          </div>
          <div className="modules-stat-value text-purple-600">
            <CountUpNumber value={stats.pendingApprovalOrDisabled} />
          </div>
          <div className="modules-stat-subtext">Restricted or awaiting approval</div>
          <div className="modules-stat-accent-bar purple" />
        </div>
      </div>

      {/* Dismissible Notice Banner */}
      {notice && (
        <div className={`alert alert-${notice.type}`} style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', animation: 'fadeIn 0.3s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {notice.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <span>{notice.text}</span>
          </div>
          <button
            onClick={() => setNotice(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 'bold' }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Error Banner */}
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
      <div className="modules-main-card">
        {/* Navigation Toolbar & Filters */}
        <div className="modules-toolbar">
          {/* Segmented Pill Tabs */}
          <div className="modules-tabs-pillbox">
            <button
              type="button"
              className={`modules-tab-pill ${activeTab === 'matrix' ? 'active' : ''}`}
              onClick={() => setActiveTab('matrix')}
            >
              <Layers size={14} />
              <span>Entitlement Matrix</span>
              <span className="pill-counter">{matrix.length}</span>
            </button>

            <button
              type="button"
              className={`modules-tab-pill ${activeTab === 'catalogue' ? 'active' : ''}`}
              onClick={() => setActiveTab('catalogue')}
            >
              <BookOpen size={14} />
              <span>Platform Catalogue</span>
              <span className="pill-counter">{catalogue.length}</span>
            </button>

            <button
              type="button"
              className={`modules-tab-pill ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              <History size={14} />
              <span>Audit History</span>
              <span className="pill-counter">{historyRecords.length}</span>
            </button>
          </div>

          {/* Search & Filters Group */}
          <div className="modules-filters-group">
            {/* Search Input */}
            <div className="modules-search-box">
              <Search size={15} style={{ color: '#94A3B8' }} />
              <input
                type="text"
                placeholder={activeTab === 'matrix' ? 'Search by name, code, parent...' : 'Search modules...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="modules-search-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#94A3B8' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter by Kind */}
            {activeTab === 'matrix' && (
              <>
                <select
                  value={filterKind}
                  onChange={(e) => setFilterKind(e.target.value)}
                  className="modules-select-dropdown"
                >
                  <option value="ALL">All Kinds</option>
                  <option value="APP">Root Apps (APP)</option>
                  <option value="MODULE">Modules (MODULE)</option>
                  <option value="FEATURE">Features (FEATURE)</option>
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="modules-select-dropdown"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Effective Active</option>
                  <option value="READ_ONLY">Read-Only / Frozen</option>
                  <option value="DISABLED">Effective Disabled</option>
                  <option value="SCHEDULED">Scheduled Future</option>
                </select>

                {activeFiltersCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setFilterKind('ALL');
                      setFilterStatus('ALL');
                    }}
                    className="btn-enterprise btn-outline-soft"
                    style={{ fontSize: '0.78rem', padding: '6px 10px' }}
                  >
                    Reset Filters ({activeFiltersCount})
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Content Body */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div className="spinner" style={{ margin: '0 auto 14px' }}></div>
            <p style={{ color: '#64748B', fontSize: '0.88rem' }}>Loading module governance & entitlement records...</p>
          </div>
        ) : (
          <>
            {/* VIEW 1: ENTITLEMENT MATRIX */}
            {activeTab === 'matrix' && (
              <div className="modules-table-container">
                <table className="modules-table">
                  <thead>
                    <tr>
                      <th style={{ width: '26%' }}>Capability & Code</th>
                      <th style={{ width: '13%' }}>Kind / Hierarchy</th>
                      <th style={{ width: '15%' }}>Configured State</th>
                      <th style={{ width: '14%' }}>Effective State</th>
                      <th style={{ width: '12%' }}>Dependencies</th>
                      <th style={{ width: '10%' }}>Approvals</th>
                      <th style={{ width: '10%', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMatrix.length === 0 ? (
                      <tr>
                        <td colSpan="7">
                          <div className="modules-empty-state">
                            <Layers size={44} style={{ color: '#CBD5E1', marginBottom: '12px' }} />
                            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1E293B', margin: '0 0 6px 0' }}>
                              No Entitlement Records Found
                            </h3>
                            <p style={{ fontSize: '0.82rem', color: '#64748B', maxWidth: '380px', margin: '0 0 16px 0' }}>
                              {searchQuery || filterKind !== 'ALL' || filterStatus !== 'ALL'
                                ? 'No modules match your current filter parameters. Try clearing your filters.'
                                : 'No entitlement matrix configured for this tenant.'}
                            </p>
                            {activeFiltersCount > 0 && (
                              <button
                                type="button"
                                className="btn-enterprise btn-primary"
                                onClick={() => {
                                  setSearchQuery('');
                                  setFilterKind('ALL');
                                  setFilterStatus('ALL');
                                }}
                              >
                                Clear All Filters
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredMatrix.map((item) => {
                        const moduleId = getModuleId(item);
                        const moduleName = getModuleName(item);
                        const moduleCode = getModuleCode(item);
                        const kind = getModuleKind(item);
                        const confStatus = getConfiguredStatus(item);
                        const confMode = getConfiguredMode(item);
                        const effStatus = getEffectiveStatus(item);
                        const effMode = getEffectiveMode(item);
                        const isCore = getIsCore(item) || getPriority(item) === 'M';
                        const parentName = getParentName(item);
                        const isEffectiveActive = effStatus === 'ACTIVE';
                        const isFrozen = effMode === 'READ_ONLY';
                        const depsSatisfied = !!(item.DependenciesSatisfied ?? item.dependencies_satisfied ?? true);
                        const missingDeps = item.MissingDependencies || item.missing_dependencies || [];
                        const pendingApprovalId = item.PendingApprovalID || item.pending_approval_id;
                        const pendingWorkflows = item.PendingWorkflowsCount ?? item.pending_workflows_count ?? 0;

                        return (
                          <tr key={moduleId}>
                            {/* Capability & Code */}
                            <td>
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                <div>
                                  <div style={{ fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span>{moduleName}</span>
                                    {isCore && (
                                      <span
                                        className="badge badge-primary"
                                        style={{ fontSize: '0.66rem', padding: '1px 6px', fontWeight: 700 }}
                                        title="Core mandatory platform capability"
                                      >
                                        CORE
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                    <code style={{ fontSize: '0.74rem', background: '#F1F5F9', color: '#475569', padding: '1px 5px', borderRadius: '4px' }}>
                                      {moduleCode}
                                    </code>
                                    {item.description && (
                                      <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                                        — {item.description}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Kind / Hierarchy */}
                            <td>
                              <div>
                                <span className={`module-kind-pill ${kind.toLowerCase()}`}>
                                  {kind}
                                </span>
                                {parentName && (
                                  <div style={{ fontSize: '0.73rem', color: '#64748B', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                    <span>↳</span>
                                    <span>{parentName}</span>
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Configured State */}
                            <td>
                              <div>
                                <span className={`module-state-pill ${confStatus === 'ACTIVE' ? 'active' : confStatus === 'SCHEDULED' ? 'scheduled' : 'disabled'}`}>
                                  {confStatus} ({confMode})
                                </span>
                                {item.effective_from && (
                                  <div style={{ fontSize: '0.71rem', color: '#64748B', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                    <Calendar size={11} />
                                    <span>{new Date(item.effective_from).toLocaleDateString()}</span>
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Effective State */}
                            <td>
                              <div>
                                {isEffectiveActive ? (
                                  isFrozen ? (
                                    <span className="module-state-pill frozen" title="Read-Only Mode: state mutations frozen">
                                      <Snowflake size={11} />
                                      <span>ACTIVE (FROZEN)</span>
                                    </span>
                                  ) : (
                                    <span className="module-state-pill active" title="Active Operational">
                                      <CheckCircle2 size={11} />
                                      <span>ACTIVE (FULL)</span>
                                    </span>
                                  )
                                ) : (
                                  <span className="module-state-pill disabled" title="Disabled Capability">
                                    <X size={11} />
                                    <span>DISABLED</span>
                                  </span>
                                )}
                                {pendingWorkflows > 0 && (
                                  <div style={{ fontSize: '0.72rem', color: '#B45309', marginTop: '3px', fontWeight: 600 }}>
                                    ⚠️ {pendingWorkflows} active workflow(s)
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Dependencies */}
                            <td>
                              {depsSatisfied ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#059669', fontSize: '0.78rem', fontWeight: 600 }}>
                                  <Check size={13} />
                                  <span>Satisfied</span>
                                </div>
                              ) : (
                                <div style={{ color: '#DC2626', fontSize: '0.76rem', fontWeight: 600 }} title={`Missing: ${missingDeps.join(', ')}`}>
                                  <AlertTriangle size={12} style={{ display: 'inline', marginRight: '4px' }} />
                                  <span>Missing {missingDeps.length}</span>
                                </div>
                              )}
                              {(item.DependentModules?.length > 0 || item.dependent_modules?.length > 0) && (
                                <div style={{ fontSize: '0.71rem', color: '#64748B', marginTop: '2px' }}>
                                  {(item.DependentModules || item.dependent_modules).length} child feature(s)
                                </div>
                              )}
                            </td>

                            {/* Approval Status */}
                            <td>
                              {pendingApprovalId ? (
                                <Link
                                  to="/approvals"
                                  className="module-state-pill scheduled"
                                  style={{ textDecoration: 'none' }}
                                  title="View approval request in Approvals queue"
                                >
                                  <Clock size={11} />
                                  <span>AWAITING GATE</span>
                                </Link>
                              ) : (
                                <span style={{ color: '#94A3B8', fontSize: '0.78rem' }}>None</span>
                              )}
                            </td>

                            {/* Actions */}
                            <td style={{ textAlign: 'right' }}>
                              <div className="module-action-btn-group">
                                {isEffectiveActive ? (
                                  <>
                                    <button
                                      type="button"
                                      className={`btn-module-action ${confMode === 'FULL' ? 'freeze' : 'primary'}`}
                                      onClick={() => openActionModal(item, 'ACTIVE', confMode === 'FULL' ? 'READ_ONLY' : 'FULL')}
                                      title={confMode === 'FULL' ? 'Freeze workflows to Read-Only' : 'Unfreeze to Full Access'}
                                    >
                                      {confMode === 'FULL' ? <Snowflake size={12} /> : <Zap size={12} />}
                                      <span>{confMode === 'FULL' ? 'Freeze' : 'Unfreeze'}</span>
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-module-action danger"
                                      onClick={() => openActionModal(item, 'DISABLED', 'FULL')}
                                      title="Disable module access"
                                    >
                                      <Power size={12} />
                                      <span>Disable</span>
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    className="btn-module-action primary"
                                    onClick={() => openActionModal(item, 'ACTIVE', 'FULL')}
                                  >
                                    <Power size={12} />
                                    <span>Enable</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="btn-module-action"
                                  onClick={() => openActionModal(item, confStatus, confMode)}
                                  title="Configure Entitlement Settings"
                                >
                                  <SlidersHorizontal size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* VIEW 2: AUTHORITATIVE MODULE CATALOGUE */}
            {activeTab === 'catalogue' && (
              <div>
                <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <p style={{ color: '#64748B', fontSize: '0.84rem', margin: 0 }}>
                    Authoritative HMS global capability catalogue describing the three-tier hierarchy (<strong>APP</strong> → <strong>MODULE</strong> → <strong>FEATURE</strong>).
                  </p>
                  <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                    Showing {filteredCatalogue.length} of {catalogue.length} capabilities
                  </span>
                </div>

                <div className="modules-table-container">
                  <table className="modules-table">
                    <thead>
                      <tr>
                        <th style={{ width: '18%' }}>Module Code</th>
                        <th style={{ width: '32%' }}>Capability Name & Purpose</th>
                        <th style={{ width: '15%' }}>Hierarchy Kind</th>
                        <th style={{ width: '12%' }}>Priority</th>
                        <th style={{ width: '12%' }}>Core Platform</th>
                        <th style={{ width: '11%', textAlign: 'right' }}>Catalogue Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCatalogue.length === 0 ? (
                        <tr>
                          <td colSpan="6">
                            <div className="modules-empty-state">
                              <BookOpen size={40} style={{ color: '#CBD5E1', marginBottom: '10px' }} />
                              <p style={{ color: '#64748B', fontSize: '0.86rem' }}>No capabilities matched your catalogue search.</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredCatalogue.map((m) => {
                          const code = m.module_code || m.code || '';
                          const name = m.module_name || m.name || '';
                          const kind = (m.kind || 'MODULE').toUpperCase();
                          const isCore = !!(m.is_core ?? false);
                          const isActive = !!(m.is_active ?? true);

                          return (
                            <tr key={m.module_id || code}>
                              <td>
                                <code style={{ fontWeight: 700, color: '#1E293B', background: '#F1F5F9', padding: '2px 7px', borderRadius: '4px' }}>
                                  {code}
                                </code>
                              </td>
                              <td>
                                <div style={{ fontWeight: 700, color: '#0F172A' }}>{name}</div>
                                {m.description && (
                                  <div style={{ fontSize: '0.76rem', color: '#64748B', marginTop: '2px' }}>
                                    {m.description}
                                  </div>
                                )}
                              </td>
                              <td>
                                <span className={`module-kind-pill ${kind.toLowerCase()}`}>
                                  {kind}
                                </span>
                              </td>
                              <td>
                                <span className="badge badge-outline" style={{ fontSize: '0.72rem' }}>
                                  {m.priority === 'M' || m.priority === 1 ? 'MANDATORY' : m.priority === 2 ? 'RECOMMENDED' : 'OPTIONAL'}
                                </span>
                              </td>
                              <td>
                                {isCore ? (
                                  <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>
                                    CORE MANDATORY
                                  </span>
                                ) : (
                                  <span style={{ color: '#64748B', fontSize: '0.78rem' }}>Optional</span>
                                )}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <span className={`module-state-pill ${isActive ? 'active' : 'disabled'}`}>
                                  {isActive ? 'ACTIVE' : 'INACTIVE'}
                                </span>
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

            {/* VIEW 3: AUDIT HISTORY */}
            {activeTab === 'history' && (
              <div>
                <p style={{ color: '#64748B', fontSize: '0.84rem', marginBottom: '16px' }}>
                  Immutable audit records from <code>platform.audit_logs</code> recording every module transition, state freeze, and approval event.
                </p>

                {historyRecords.length === 0 ? (
                  <div className="modules-empty-state">
                    <History size={40} style={{ color: '#CBD5E1', marginBottom: '10px' }} />
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1E293B', margin: '0 0 6px 0' }}>
                      No Audit Records Logged
                    </h3>
                    <p style={{ fontSize: '0.82rem', color: '#64748B', maxWidth: '380px', margin: 0 }}>
                      No entitlement state changes have been registered for this college yet.
                    </p>
                  </div>
                ) : (
                  <div className="modules-table-container">
                    <table className="modules-table">
                      <thead>
                        <tr>
                          <th style={{ width: '22%' }}>Timestamp</th>
                          <th style={{ width: '20%' }}>Action</th>
                          <th style={{ width: '18%' }}>Actor & Role</th>
                          <th style={{ width: '28%' }}>Business Reason</th>
                          <th style={{ width: '12%', textAlign: 'right' }}>Severity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyRecords.map((h) => (
                          <tr key={h.audit_id || h.id || Math.random()}>
                            <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem', color: '#475569' }}>
                              {new Date(h.created_at).toLocaleString()}
                            </td>
                            <td>
                              <code style={{ fontSize: '0.78rem', fontWeight: 700, color: '#2563EB', background: '#EFF6FF', padding: '2px 6px', borderRadius: '4px' }}>
                                {h.action}
                              </code>
                            </td>
                            <td>
                              <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#0F172A' }}>
                                {h.actor_role || 'SUPER_ADMIN'}
                              </div>
                              {h.actor_id && (
                                <div style={{ fontSize: '0.71rem', color: '#64748B' }}>
                                  ID: {h.actor_id.substring(0, 8)}...
                                </div>
                              )}
                            </td>
                            <td>
                              <span style={{ fontSize: '0.8rem', color: '#334155', fontStyle: h.reason ? 'italic' : 'normal' }}>
                                {h.reason ? `"${h.reason}"` : '—'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <span
                                className={`module-state-pill ${
                                  h.severity === 'WARNING'
                                    ? 'frozen'
                                    : h.severity === 'ERROR'
                                    ? 'disabled'
                                    : 'active'
                                }`}
                              >
                                {h.severity || 'INFO'}
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
        <div className="modal-backdrop" style={{ zIndex: 1050 }}>
          <div className="modal-card" style={{ maxWidth: '620px', borderRadius: '16px', overflow: 'hidden' }}>
            <div className="modal-header" style={{ padding: '18px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <SlidersHorizontal size={18} style={{ color: '#2563EB' }} />
                <h2 className="modal-title" style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0F172A' }}>
                  {actionModal.targetStatus === 'ACTIVE'
                    ? actionModal.targetMode === 'READ_ONLY'
                      ? 'Freeze Module to Read-Only'
                      : 'Configure Module Entitlement'
                    : 'Disable / Suspend Capability'}
                </h2>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setActionModal((p) => ({ ...p, isOpen: false }))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleActionSubmit} style={{ padding: '24px' }}>
              {actionModal.error && (
                <div className="alert alert-danger" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={15} />
                  <span>{actionModal.error}</span>
                </div>
              )}

              {/* Module Summary Card */}
              <div
                style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '10px',
                  padding: '14px 16px',
                  marginBottom: '18px',
                }}
              >
                <div style={{ fontWeight: 800, fontSize: '0.96rem', color: '#0F172A' }}>
                  {getModuleName(actionModal.item)}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '3px' }}>
                  Code: <code>{getModuleCode(actionModal.item)}</code> &bull; Kind:{' '}
                  <span className={`module-kind-pill ${getModuleKind(actionModal.item).toLowerCase()}`}>
                    {getModuleKind(actionModal.item)}
                  </span>
                </div>
                <div style={{ marginTop: '10px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#64748B' }}>Transition:</span>
                  <span className="badge badge-outline">
                    {getConfiguredStatus(actionModal.item)} ({getConfiguredMode(actionModal.item)})
                  </span>
                  <ChevronRight size={14} style={{ color: '#94A3B8' }} />
                  <span className={`module-state-pill ${actionModal.targetStatus === 'ACTIVE' ? (actionModal.targetMode === 'READ_ONLY' ? 'frozen' : 'active') : 'disabled'}`}>
                    {actionModal.targetStatus} ({actionModal.targetMode})
                  </span>
                </div>
              </div>

              {/* Impact Preview Card */}
              {actionModal.previewLoading ? (
                <div style={{ textAlign: 'center', padding: '18px', background: '#F8FAFC', borderRadius: '10px', marginBottom: '18px' }}>
                  <div className="spinner" style={{ margin: '0 auto 8px' }}></div>
                  <small style={{ color: '#64748B' }}>Evaluating cascaded dependencies & pending workflow impact...</small>
                </div>
              ) : actionModal.preview ? (
                <div className="impact-preview-container">
                  <div className="impact-preview-title">
                    <Sparkles size={14} style={{ color: '#2563EB' }} />
                    <span>Real-time Impact Assessment</span>
                  </div>

                  {actionModal.preview.dependent_modules_count > 0 && (
                    <div className="impact-warning-row">
                      <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
                      <div>
                        <strong>{actionModal.preview.dependent_modules_count} child feature(s)</strong> will also be affected:{' '}
                        <code>{actionModal.preview.dependent_modules?.join(', ')}</code>
                      </div>
                    </div>
                  )}

                  {actionModal.preview.pending_workflows_count > 0 && (
                    <div className="impact-warning-row">
                      <Clock size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
                      <div>
                        <strong>{actionModal.preview.pending_workflows_count} pending workflow(s)</strong> detected. Under the platform freeze policy, existing records remain read-only; new mutations will be prevented.
                      </div>
                    </div>
                  )}

                  {actionModal.preview.requires_approval && (
                    <div className="impact-maker-checker-row">
                      <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
                      <div>
                        <strong>Super Admin Maker-Checker Enforced:</strong>{' '}
                        {actionModal.preview.approval_reason || 'This capability modification requires secondary operator validation.'}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              {/* State & Mode Selectors */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label className="label" style={{ fontWeight: 700, fontSize: '0.82rem', color: '#334155', marginBottom: '6px' }}>
                    Target Status
                  </label>
                  <select
                    className="modules-select-dropdown"
                    style={{ width: '100%' }}
                    value={actionModal.targetStatus}
                    onChange={(e) => setActionModal((p) => ({ ...p, targetStatus: e.target.value }))}
                  >
                    <option value="ACTIVE">ACTIVE (Enabled)</option>
                    <option value="DISABLED">DISABLED (Suspended)</option>
                    <option value="SCHEDULED">SCHEDULED (Future Activation)</option>
                  </select>
                </div>

                <div>
                  <label className="label" style={{ fontWeight: 700, fontSize: '0.82rem', color: '#334155', marginBottom: '6px' }}>
                    Operating Mode
                  </label>
                  <select
                    className="modules-select-dropdown"
                    style={{ width: '100%' }}
                    value={actionModal.targetMode}
                    onChange={(e) => setActionModal((p) => ({ ...p, targetMode: e.target.value }))}
                  >
                    <option value="FULL">FULL (Read & Write)</option>
                    <option value="READ_ONLY">READ_ONLY (Workflow Freeze)</option>
                  </select>
                </div>
              </div>

              {/* Scheduling Datetimes (Optional) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label className="label" style={{ fontWeight: 600, fontSize: '0.8rem', color: '#475569', marginBottom: '4px' }}>
                    Effective From (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    className="input-text"
                    style={{ fontSize: '0.82rem' }}
                    value={actionModal.effectiveFrom}
                    onChange={(e) => setActionModal((p) => ({ ...p, effectiveFrom: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label" style={{ fontWeight: 600, fontSize: '0.8rem', color: '#475569', marginBottom: '4px' }}>
                    Effective To (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    className="input-text"
                    style={{ fontSize: '0.82rem' }}
                    value={actionModal.effectiveTo}
                    onChange={(e) => setActionModal((p) => ({ ...p, effectiveTo: e.target.value }))}
                  />
                </div>
              </div>

              {/* Authoritative Reason Textarea */}
              <div style={{ marginBottom: '18px' }}>
                <label className="label" style={{ fontWeight: 700, fontSize: '0.82rem', color: '#334155', marginBottom: '6px' }}>
                  Authoritative Justification <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <textarea
                  className="input-textarea"
                  rows="3"
                  placeholder="Provide an authoritative reason for audit compliance and maker-checker validation..."
                  value={actionModal.reason}
                  onChange={(e) => setActionModal((p) => ({ ...p, reason: e.target.value }))}
                  style={{ width: '100%', fontSize: '0.83rem', borderRadius: '8px', border: '1px solid #CBD5E1' }}
                  required
                />
              </div>

              {/* Maker-Checker Checkbox */}
              <div style={{ marginBottom: '22px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', color: '#334155', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={actionModal.requestApproval}
                    disabled={actionModal.preview?.requires_approval}
                    onChange={(e) => setActionModal((p) => ({ ...p, requestApproval: e.target.checked }))}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontWeight: 500 }}>
                    Route change through Super Admin Maker-Checker peer approval gate
                  </span>
                </label>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-enterprise btn-outline-soft"
                  onClick={() => setActionModal((p) => ({ ...p, isOpen: false }))}
                  disabled={actionModal.submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`btn-enterprise ${actionModal.targetStatus === 'ACTIVE' ? 'btn-primary' : 'btn-danger'}`}
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
        <div className="modal-backdrop" style={{ zIndex: 1050 }}>
          <div className="modal-card" style={{ maxWidth: '520px', borderRadius: '16px', overflow: 'hidden' }}>
            <div className="modal-header" style={{ padding: '18px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CopyCheck size={18} style={{ color: '#2563EB' }} />
                <h2 className="modal-title" style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0F172A' }}>
                  Apply Entitlement Template
                </h2>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setTemplateModal((p) => ({ ...p, isOpen: false }))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleApplyTemplate} style={{ padding: '24px' }}>
              {templateModal.error && (
                <div className="alert alert-danger" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={15} />
                  <span>{templateModal.error}</span>
                </div>
              )}

              <p style={{ fontSize: '0.84rem', color: '#64748B', marginBottom: '16px' }}>
                Select a platform standard blueprint to bulk-configure module allocations for{' '}
                <strong style={{ color: '#0F172A' }}>{currentCollege?.name || 'Selected Tenant'}</strong>.
              </p>

              <div style={{ marginBottom: '20px' }}>
                <label className="label" style={{ fontWeight: 700, fontSize: '0.82rem', color: '#334155', marginBottom: '6px' }}>
                  Entitlement Blueprint
                </label>
                <select
                  className="modules-select-dropdown"
                  style={{ width: '100%', padding: '10px 12px' }}
                  value={templateModal.templateId}
                  onChange={(e) => setTemplateModal((p) => ({ ...p, templateId: e.target.value }))}
                  required
                >
                  <option value="">-- Choose Platform Template --</option>
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
                  className="btn-enterprise btn-outline-soft"
                  onClick={() => setTemplateModal((p) => ({ ...p, isOpen: false }))}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-enterprise btn-primary"
                  disabled={templateModal.submitting}
                >
                  {templateModal.submitting ? 'Applying Template...' : 'Apply Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
