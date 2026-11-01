import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Smartphone,
  AppWindow,
  GraduationCap,
  Users,
  ShieldCheck,
  ClipboardCheck,
  Building2,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Plus,
  Search,
  X,
  History,
  Clock,
  SlidersHorizontal,
  ChevronRight,
  ArrowRight,
  ExternalLink,
  ShieldAlert,
  Calendar,
  AlertCircle,
  Sparkles,
  PauseCircle,
  PlayCircle,
} from 'lucide-react';
import {
  fetchCollegeApplications,
  enableApplication,
  disableApplication,
  suspendApplication,
  updateApplicationVersion,
  fetchApplicationHistory,
  fetchCollegeMetadata,
  fetchCollegesList,
} from '../services/applicationManagementService';

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

const APP_ICONS = {
  student_app: GraduationCap,
  parent_app: Users,
  security_app: ShieldCheck,
  hostel_incharge_app: ClipboardCheck,
  admin_portal: Building2,
};

const APP_PLATFORM_LABELS = {
  student_app: 'Mobile (iOS & Android)',
  parent_app: 'Mobile (iOS & Android)',
  security_app: 'Mobile & Gate Terminal',
  hostel_incharge_app: 'Hybrid (Mobile & Web)',
  admin_portal: 'Web Enterprise Portal',
};

export default function ApplicationManagementPage() {
  const { id: routeCollegeId } = useParams();
  const navigate = useNavigate();

  const [colleges, setColleges] = useState([]);
  const [selectedCollegeId, setSelectedCollegeId] = useState(routeCollegeId || '');
  const [college, setCollege] = useState(null);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals state
  const [statusModal, setStatusModal] = useState({
    isOpen: false,
    app: null,
    targetStatus: '',
    reason: '',
    submitting: false,
    error: null,
  });

  const [versionModal, setVersionModal] = useState({
    isOpen: false,
    app: null,
    minVersion: '',
    forceUpdate: false,
    reason: '',
    submitting: false,
    error: null,
    fieldErrors: {},
  });

  const [historyModal, setHistoryModal] = useState({
    isOpen: false,
    app: null,
    loading: false,
    records: [],
    error: null,
  });

  const abortControllerRef = useRef(null);

  // Load available colleges for the switcher
  useEffect(() => {
    let isMounted = true;
    async function loadColleges() {
      try {
        const list = await fetchCollegesList();
        if (isMounted) {
          setColleges(list || []);
          if (!routeCollegeId && list && list.length > 0) {
            setSelectedCollegeId(list[0].college_id);
          }
        }
      } catch (err) {
        console.error('Failed to load colleges list:', err);
      }
    }
    loadColleges();
    return () => {
      isMounted = false;
    };
  }, [routeCollegeId]);

  // Synchronize when route param changes
  useEffect(() => {
    if (routeCollegeId) {
      setSelectedCollegeId(routeCollegeId);
    }
  }, [routeCollegeId]);

  // Fetch applications whenever selectedCollegeId changes
  useEffect(() => {
    if (!selectedCollegeId) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    async function loadData() {
      setLoading(true);
      setIsRefreshing(true);
      setError(null);

      try {
        const [collegeData, appsData] = await Promise.all([
          fetchCollegeMetadata(selectedCollegeId, abortController.signal),
          fetchCollegeApplications(selectedCollegeId, abortController.signal),
        ]);

        setCollege(collegeData);
        setApplications(appsData || []);
      } catch (err) {
        if (err.isCanceled || err.name === 'CanceledError') return;
        setError(err.message || 'Failed to load college application settings');
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    }

    loadData();

    return () => {
      abortController.abort();
    };
  }, [selectedCollegeId]);

  function handleCollegeSwitch(e) {
    const newId = e.target.value;
    setSelectedCollegeId(newId);
    if (routeCollegeId) {
      navigate(`/colleges/${newId}/applications`);
    }
  }

  // Action: Open Status Transition Confirmation Dialog
  function openStatusModal(app, targetStatus) {
    setStatusModal({
      isOpen: true,
      app,
      targetStatus,
      reason: '',
      submitting: false,
      error: null,
    });
  }

  async function handleStatusSubmit(e) {
    e.preventDefault();
    const { app, targetStatus, reason } = statusModal;
    if (!app || !targetStatus) return;

    setStatusModal((prev) => ({ ...prev, submitting: true, error: null }));

    try {
      let updatedApp;
      if (targetStatus === 'ENABLED') {
        updatedApp = await enableApplication(selectedCollegeId, app.app_id, reason);
      } else if (targetStatus === 'DISABLED') {
        updatedApp = await disableApplication(selectedCollegeId, app.app_id, reason);
      } else if (targetStatus === 'SUSPENDED') {
        updatedApp = await suspendApplication(selectedCollegeId, app.app_id, reason);
      }

      setApplications((prev) =>
        prev.map((item) => (item.app_id === app.app_id ? { ...item, ...updatedApp } : item))
      );

      setStatusModal({ isOpen: false, app: null, targetStatus: '', reason: '', submitting: false, error: null });
      setNotice({
        type: 'success',
        text: `Application "${app.name}" status updated to ${targetStatus} successfully.`,
      });
      setTimeout(() => setNotice(null), 5000);
    } catch (err) {
      setStatusModal((prev) => ({
        ...prev,
        submitting: false,
        error: err.message || `Failed to update status to ${targetStatus}`,
      }));
    }
  }

  // Action: Open Version & Policy Modal
  function openVersionModal(app) {
    setVersionModal({
      isOpen: true,
      app,
      minVersion: app.min_version || '1.0.0',
      forceUpdate: !!app.force_update,
      reason: '',
      submitting: false,
      error: null,
      fieldErrors: {},
    });
  }

  function validateVersionForm() {
    const errors = {};
    const v = versionModal.minVersion.trim();
    if (!v) {
      errors.minVersion = 'Minimum supported version is required.';
    } else if (!/^v?\d+\.\d+(\.\d+)?$/.test(v)) {
      errors.minVersion = 'Must follow semantic version format (e.g. 1.0.0 or 2.1).';
    }
    return errors;
  }

  async function handleVersionSubmit(e) {
    e.preventDefault();
    const { app, minVersion, forceUpdate, reason } = versionModal;
    if (!app) return;

    const validationErrors = validateVersionForm();
    if (Object.keys(validationErrors).length > 0) {
      setVersionModal((prev) => ({ ...prev, fieldErrors: validationErrors }));
      return;
    }

    setVersionModal((prev) => ({ ...prev, submitting: true, error: null, fieldErrors: {} }));

    try {
      const updatedApp = await updateApplicationVersion(selectedCollegeId, app.app_id, {
        minVersion: minVersion.trim(),
        forceUpdate,
        reason,
      });

      setApplications((prev) =>
        prev.map((item) => (item.app_id === app.app_id ? { ...item, ...updatedApp } : item))
      );

      setVersionModal({
        isOpen: false,
        app: null,
        minVersion: '',
        forceUpdate: false,
        reason: '',
        submitting: false,
        error: null,
        fieldErrors: {},
      });
      setNotice({
        type: 'success',
        text: `Version policy for "${app.name}" updated to v${minVersion}${forceUpdate ? ' (Forced Upgrade)' : ''}.`,
      });
      setTimeout(() => setNotice(null), 5000);
    } catch (err) {
      setVersionModal((prev) => ({
        ...prev,
        submitting: false,
        error: err.message || 'Failed to update application version policy',
      }));
    }
  }

  // Action: Open Audit History Drawer
  async function openHistoryModal(app) {
    setHistoryModal({
      isOpen: true,
      app,
      loading: true,
      records: [],
      error: null,
    });

    try {
      const records = await fetchApplicationHistory(selectedCollegeId, app.app_id);
      setHistoryModal((prev) => ({
        ...prev,
        loading: false,
        records: records || [],
      }));
    } catch (err) {
      setHistoryModal((prev) => ({
        ...prev,
        loading: false,
        error: err.message || 'Failed to fetch version history audit log',
      }));
    }
  }

  // KPI Metrics
  const totalApps = applications.length;
  const activeApps = useMemo(
    () => applications.filter((a) => a.status === 'ENABLED').length,
    [applications]
  );
  const suspendedApps = useMemo(
    () => applications.filter((a) => a.status === 'DISABLED' || a.status === 'SUSPENDED').length,
    [applications]
  );
  const forcedUpgradeApps = useMemo(
    () => applications.filter((a) => a.force_update).length,
    [applications]
  );

  // Filtered Apps
  const filteredApps = useMemo(() => {
    return applications.filter((app) => {
      const matchesStatus = statusFilter === 'ALL' || app.status === statusFilter;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        app.name?.toLowerCase().includes(q) ||
        app.app_code?.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [applications, statusFilter, searchQuery]);

  return (
    <div className="apps-page-container animate-fade-in">
      {/* Top Header & Breadcrumbs */}
      <div className="apps-hero-header">
        <div className="apps-hero-text">
          <div className="apps-breadcrumbs">
            <Link to="/dashboard" className="breadcrumb-link">Dashboard</Link>
            <span className="breadcrumb-sep">/</span>
            <Link to="/colleges" className="breadcrumb-link">Colleges</Link>
            {college && (
              <>
                <span className="breadcrumb-sep">/</span>
                <Link to={`/colleges/${college.college_id}`} className="breadcrumb-link">
                  {college.name}
                </Link>
              </>
            )}
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current">Application Management</span>
          </div>
          <div className="apps-title-row">
            <h1 className="apps-title">Application Management</h1>
            {college && (
              <span className={`badge-readiness ${college.status === 'ACTIVE' ? 'ready' : 'in-progress'}`}>
                <span className="readiness-dot" />
                {college.status}
              </span>
            )}
          </div>
          <p className="apps-subtitle">
            Configure client mobile apps and web portals, set minimum supported SemVer floors, and enforce mandatory upgrades.
          </p>
        </div>

        {/* Quick Actions & College Selector */}
        <div className="apps-header-actions">
          {colleges.length > 0 && (
            <div className="tenant-selector-pill">
              <Building2 size={16} className="text-blue-600 flex-shrink-0" />
              <div className="tenant-selector-content">
                <span className="selector-label">Target Tenant:</span>
                <select
                  id="college-select"
                  value={selectedCollegeId}
                  onChange={handleCollegeSwitch}
                  className="tenant-select-dropdown"
                >
                  {colleges.map((c) => (
                    <option key={c.college_id} value={c.college_id}>
                      {c.name} ({c.college_code})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {college && (
            <Link
              to={`/colleges/${college.college_id}/configuration`}
              className="btn-enterprise btn-outline-soft"
            >
              <SlidersHorizontal size={14} />
              <span>College Config</span>
            </Link>
          )}

          <button
            type="button"
            className={`btn-enterprise btn-outline-soft ${isRefreshing ? 'is-loading' : ''}`}
            onClick={() => {
              if (selectedCollegeId) {
                setLoading(true);
                setIsRefreshing(true);
                Promise.all([
                  fetchCollegeMetadata(selectedCollegeId),
                  fetchCollegeApplications(selectedCollegeId),
                ])
                  .then(([c, a]) => {
                    setCollege(c);
                    setApplications(a || []);
                  })
                  .finally(() => {
                    setLoading(false);
                    setIsRefreshing(false);
                  });
              }
            }}
            disabled={isRefreshing}
          >
            <RotateCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Top 4 KPI Stat Cards */}
      <div className="apps-kpi-grid">
        {/* Card 1: Total Apps */}
        <div className="apps-stat-card card-stagger-1">
          <div className="apps-stat-header">
            <span className="apps-stat-label">Client Applications</span>
            <div className="apps-stat-icon-wrap blue">
              <AppWindow size={17} />
            </div>
          </div>
          <div className="apps-stat-value text-slate-900">
            <CountUpNumber value={totalApps} />
          </div>
          <div className="apps-stat-subtext">Registered platform client apps</div>
          <div className="apps-stat-accent-bar blue" />
        </div>

        {/* Card 2: Active Apps */}
        <div className="apps-stat-card card-stagger-2">
          <div className="apps-stat-header">
            <span className="apps-stat-label">Active Operational</span>
            <div className="apps-stat-icon-wrap green">
              <CheckCircle2 size={17} />
            </div>
          </div>
          <div className="apps-stat-value text-emerald-600">
            <CountUpNumber value={activeApps} />
          </div>
          <div className="apps-stat-subtext">Fully operational for tenant</div>
          <div className="apps-stat-accent-bar green" />
        </div>

        {/* Card 3: Suspended / Disabled */}
        <div className="apps-stat-card card-stagger-3">
          <div className="apps-stat-header">
            <span className="apps-stat-label">Suspended / Inactive</span>
            <div className="apps-stat-icon-wrap amber">
              <AlertTriangle size={17} />
            </div>
          </div>
          <div className="apps-stat-value text-amber-600">
            <CountUpNumber value={suspendedApps} />
          </div>
          <div className="apps-stat-subtext">Restricted or maintenance mode</div>
          <div className="apps-stat-accent-bar amber" />
        </div>

        {/* Card 4: Forced Upgrades */}
        <div className="apps-stat-card card-stagger-4">
          <div className="apps-stat-header">
            <span className="apps-stat-label">Mandatory Upgrade Policies</span>
            <div className="apps-stat-icon-wrap purple">
              <ShieldAlert size={17} />
            </div>
          </div>
          <div className="apps-stat-value text-purple-600">
            <CountUpNumber value={forcedUpgradeApps} />
          </div>
          <div className="apps-stat-subtext">Forced SemVer version floors</div>
          <div className="apps-stat-accent-bar purple" />
        </div>
      </div>

      {/* Global Notice Alert */}
      {notice && (
        <div className={`apps-notice-banner ${notice.type} animate-slide-up`}>
          <div className="notice-content">
            <CheckCircle2 size={16} />
            <span>{notice.text}</span>
          </div>
          <button type="button" className="notice-close-btn" onClick={() => setNotice(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Global Error Banner */}
      {error && (
        <div className="apps-error-banner animate-slide-up">
          <div className="error-text-wrap">
            <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Main Content Card */}
      <div className="apps-main-card card-stagger-4">
        {/* Controls Toolbar: Segmented Tabs & Search */}
        <div className="apps-toolbar">
          <div className="apps-tabs-pillbox">
            <button
              type="button"
              className={`apps-tab-pill ${statusFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setStatusFilter('ALL')}
            >
              All Applications ({totalApps})
            </button>
            <button
              type="button"
              className={`apps-tab-pill ${statusFilter === 'ENABLED' ? 'active' : ''}`}
              onClick={() => setStatusFilter('ENABLED')}
            >
              <CheckCircle2 size={12} className="inline-icon" />
              Enabled ({activeApps})
            </button>
            <button
              type="button"
              className={`apps-tab-pill ${statusFilter === 'SUSPENDED' ? 'active' : ''}`}
              onClick={() => setStatusFilter('SUSPENDED')}
            >
              <AlertTriangle size={12} className="inline-icon" />
              Suspended / Disabled ({suspendedApps})
            </button>
          </div>

          <div className="apps-search-box">
            <Search size={15} className="search-icon" />
            <input
              type="text"
              placeholder="Search application name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="apps-search-input"
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

        {/* Loading State */}
        {loading ? (
          <div className="apps-loading-state">
            <div className="loading-spinner-blue" />
            <div className="loading-state-title">Loading Application Suite...</div>
            <div className="loading-state-sub">Fetching version policies and tenant access states.</div>
          </div>
        ) : filteredApps.length === 0 ? (
          <div className="apps-empty-state">
            <div className="empty-state-badge-stage">
              <div className="empty-state-badge-pulse" />
              <div className="empty-state-icon-badge">
                <Smartphone size={32} className="text-blue-600" />
              </div>
            </div>
            <h3 className="empty-state-heading">No Applications Match Filter</h3>
            <p className="empty-state-description">Try clearing your search query or reset status filters.</p>
          </div>
        ) : (
          /* Modern Applications Grid */
          <div className="apps-grid">
            {filteredApps.map((app) => {
              const IconComp = APP_ICONS[app.app_code] || Smartphone;
              const isEnabled = app.status === 'ENABLED';
              const isSuspended = app.status === 'SUSPENDED';

              return (
                <div key={app.app_id} className="app-card">
                  <div className="app-card-top">
                    <div className="app-card-icon-wrap">
                      <IconComp size={22} className="text-blue-600" />
                    </div>
                    <div className="app-card-status">
                      <span className={`node-status-badge ${app.status.toLowerCase()}`}>
                        {isEnabled ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                        <span>{app.status}</span>
                      </span>
                    </div>
                  </div>

                  <div className="app-card-body">
                    <h3 className="app-card-title">{app.name}</h3>
                    <code className="app-card-code">[{app.app_code}]</code>
                    <p className="app-card-desc">
                      {app.description || 'Client application interface for authorized platform actors.'}
                    </p>

                    <div className="app-card-meta-list">
                      <div className="meta-row">
                        <span className="meta-label">Platform:</span>
                        <span className="meta-value">
                          {APP_PLATFORM_LABELS[app.app_code] || app.platform || 'Cross-Platform'}
                        </span>
                      </div>
                      <div className="meta-row">
                        <span className="meta-label">Min Supported Version:</span>
                        <span className="meta-value font-mono">v{app.min_version || '1.0.0'}</span>
                      </div>
                      <div className="meta-row">
                        <span className="meta-label">Forced Upgrade:</span>
                        <span className={`meta-badge ${app.force_update ? 'enforced' : 'optional'}`}>
                          {app.force_update ? 'Mandatory Upgrade' : 'Optional Upgrade'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="app-card-actions">
                    <div className="actions-left">
                      {isEnabled ? (
                        <button
                          type="button"
                          className="btn-card-action suspend"
                          onClick={() => openStatusModal(app, 'SUSPENDED')}
                          title="Suspend application access temporarily"
                        >
                          <PauseCircle size={13} />
                          <span>Suspend</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn-card-action enable"
                          onClick={() => openStatusModal(app, 'ENABLED')}
                          title="Enable application for this college"
                        >
                          <PlayCircle size={13} />
                          <span>Enable</span>
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn-card-action policy"
                        onClick={() => openVersionModal(app)}
                        title="Configure SemVer policy"
                      >
                        <SlidersHorizontal size={13} />
                        <span>Policy</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      className="btn-card-action history"
                      onClick={() => openHistoryModal(app)}
                      title="View version audit history"
                    >
                      <History size={13} />
                      <span>History</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL 1: Status Change Dialog */}
      {statusModal.isOpen && (
        <div className="modal-backdrop-blur">
          <div className="modal-dialog-card animate-badge-pop" style={{ maxWidth: '520px' }}>
            <div className="modal-dialog-header">
              <div className={`modal-header-icon-wrap ${statusModal.targetStatus === 'ENABLED' ? 'green' : 'amber'}`}>
                {statusModal.targetStatus === 'ENABLED' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
              </div>
              <div className="modal-header-text">
                <h3 className="modal-header-title">
                  {statusModal.targetStatus === 'ENABLED' ? 'Enable' : 'Suspend'} {statusModal.app?.name}
                </h3>
                <p className="modal-header-subtitle">
                  Update application access state for {college?.name || 'this institution'}.
                </p>
              </div>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => setStatusModal({ ...statusModal, isOpen: false })}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleStatusSubmit}>
              <div className="modal-dialog-body">
                {statusModal.error && (
                  <div className="modal-error-notice">
                    <AlertCircle size={15} />
                    <span>{statusModal.error}</span>
                  </div>
                )}

                <p className="modal-instruction-text">
                  Setting this application to <strong>{statusModal.targetStatus}</strong> will immediately affect login availability and active user sessions across iOS, Android, and web clients for this institution.
                </p>

                <div className="form-group-custom">
                  <label className="form-label-custom">Audit Reason *</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="e.g. Temporary suspension for emergency database migration..."
                    value={statusModal.reason}
                    onChange={(e) => setStatusModal({ ...statusModal, reason: e.target.value })}
                    className="form-input-custom textarea"
                  />
                </div>
              </div>

              <div className="modal-dialog-footer">
                <button
                  type="button"
                  className="btn-enterprise btn-outline-soft"
                  onClick={() => setStatusModal({ ...statusModal, isOpen: false })}
                  disabled={statusModal.submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`btn-enterprise ${statusModal.targetStatus === 'ENABLED' ? 'btn-primary-blue' : 'btn-danger'}`}
                  disabled={statusModal.submitting}
                >
                  {statusModal.submitting ? 'Applying...' : `Confirm ${statusModal.targetStatus}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Version & Policy Dialog */}
      {versionModal.isOpen && (
        <div className="modal-backdrop-blur">
          <div className="modal-dialog-card animate-badge-pop" style={{ maxWidth: '540px' }}>
            <div className="modal-dialog-header">
              <div className="modal-header-icon-wrap purple">
                <SlidersHorizontal size={20} />
              </div>
              <div className="modal-header-text">
                <h3 className="modal-header-title">Version Policy: {versionModal.app?.name}</h3>
                <p className="modal-header-subtitle">
                  Configure SemVer requirements and mandatory upgrade enforcement.
                </p>
              </div>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => setVersionModal({ ...versionModal, isOpen: false })}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleVersionSubmit}>
              <div className="modal-dialog-body">
                {versionModal.error && (
                  <div className="modal-error-notice">
                    <AlertCircle size={15} />
                    <span>{versionModal.error}</span>
                  </div>
                )}

                <div className="form-group-custom">
                  <label className="form-label-custom">Minimum Supported Version (SemVer) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 1.2.0"
                    value={versionModal.minVersion}
                    onChange={(e) =>
                      setVersionModal({ ...versionModal, minVersion: e.target.value, fieldErrors: {} })
                    }
                    className="form-input-custom font-mono"
                  />
                  {versionModal.fieldErrors.minVersion && (
                    <span className="text-xs text-rose-600 mt-1">{versionModal.fieldErrors.minVersion}</span>
                  )}
                  <span className="text-xs text-slate-500 mt-1">
                    Clients reporting an app version lower than this will be prompted to upgrade.
                  </span>
                </div>

                <div className="role-checkbox-item mt-3">
                  <input
                    type="checkbox"
                    id="force-update-checkbox"
                    checked={versionModal.forceUpdate}
                    onChange={(e) =>
                      setVersionModal({ ...versionModal, forceUpdate: e.target.checked })
                    }
                    className="checkbox-custom"
                  />
                  <label htmlFor="force-update-checkbox" className="checkbox-label-text">
                    <strong>Enforce Forced Upgrade (Hard Gate)</strong>
                    <div className="text-xs text-slate-500 font-normal mt-0.5">
                      Users running older app versions will be completely blocked from accessing platform APIs until they update.
                    </div>
                  </label>
                </div>

                <div className="form-group-custom mt-4">
                  <label className="form-label-custom">Audit Reason (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Security release addressing token rotation"
                    value={versionModal.reason}
                    onChange={(e) => setVersionModal({ ...versionModal, reason: e.target.value })}
                    className="form-input-custom"
                  />
                </div>
              </div>

              <div className="modal-dialog-footer">
                <button
                  type="button"
                  className="btn-enterprise btn-outline-soft"
                  onClick={() => setVersionModal({ ...versionModal, isOpen: false })}
                  disabled={versionModal.submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-enterprise btn-primary-blue"
                  disabled={versionModal.submitting}
                >
                  {versionModal.submitting ? 'Saving Policy...' : 'Save Policy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Audit History Drawer */}
      {historyModal.isOpen && (
        <div className="modal-backdrop-blur">
          <div className="modal-dialog-card animate-badge-pop" style={{ maxWidth: '680px' }}>
            <div className="modal-dialog-header">
              <div className="modal-header-icon-wrap indigo">
                <History size={20} />
              </div>
              <div className="modal-header-text">
                <h3 className="modal-header-title">Version Audit History: {historyModal.app?.name}</h3>
                <p className="modal-header-subtitle">Historical version releases, upgrade policies, and reason logs.</p>
              </div>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => setHistoryModal({ ...historyModal, isOpen: false })}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-dialog-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {historyModal.loading ? (
                <div className="apps-loading-state" style={{ padding: '24px' }}>
                  <div className="loading-spinner-blue" />
                  <div className="loading-state-title">Loading Release History...</div>
                </div>
              ) : historyModal.error ? (
                <div className="modal-error-notice">
                  <AlertCircle size={15} />
                  <span>{historyModal.error}</span>
                </div>
              ) : historyModal.records.length === 0 ? (
                <div className="role-permissions-empty">
                  No historical version changes recorded for this application.
                </div>
              ) : (
                <div className="history-timeline">
                  {historyModal.records.map((rec, idx) => (
                    <div key={rec.history_id || idx} className="history-item">
                      <div className="history-dot" />
                      <div className="history-card">
                        <div className="history-card-header">
                          <span className="code-pill font-mono font-bold">v{rec.min_version}</span>
                          <span className={`meta-badge ${rec.force_update ? 'enforced' : 'optional'}`}>
                            {rec.force_update ? 'Forced Upgrade' : 'Soft Upgrade'}
                          </span>
                          <span className="text-xs text-slate-400 ml-auto">
                            {rec.created_at ? new Date(rec.created_at).toLocaleString() : '—'}
                          </span>
                        </div>
                        <div className="history-reason text-xs text-slate-600 mt-2">
                          <strong>Reason:</strong> {rec.reason || 'No audit reason specified.'}
                        </div>
                        <div className="history-author text-xs text-slate-400 mt-1">
                          Changed by: {rec.changed_by || 'Super Admin Platform Operator'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-dialog-footer">
              <button
                type="button"
                className="btn-enterprise btn-outline-soft"
                onClick={() => setHistoryModal({ ...historyModal, isOpen: false })}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
