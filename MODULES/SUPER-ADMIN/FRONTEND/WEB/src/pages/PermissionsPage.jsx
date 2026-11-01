import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  KeyRound,
  Shield,
  Layers,
  Search,
  X,
  RotateCw,
  Building2,
  Globe,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Users,
  ChevronLeft,
  ChevronRight,
  Info,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  Lock,
} from 'lucide-react';
import {
  fetchPermissions,
  fetchPermissionById,
  fetchPermissionWhoHasWhat,
  fetchOrphanPermissions,
  fetchDeprecationStatus,
  DEFAULT_PERMISSIONS,
} from '../services/permissionService';

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

export default function PermissionsPage() {
  // Navigation tabs: 'catalog' | 'orphans' | 'advisories'
  const [activeTab, setActiveTab] = useState('catalog');

  // Directory & Filter State
  const [permissions, setPermissions] = useState(DEFAULT_PERMISSIONS);
  const [totalPermissions, setTotalPermissions] = useState(DEFAULT_PERMISSIONS.length);
  const [scopeFilter, setScopeFilter] = useState('ALL'); // ALL, PLATFORM, COLLEGE, GLOBAL
  const [moduleFilter, setModuleFilter] = useState('ALL');
  const [orphanFilter, setOrphanFilter] = useState('ALL'); // ALL, ORPHAN, MAPPED
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const limit = 25;
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Global Feedback Banner
  const [feedback, setFeedback] = useState(null);

  // Detail Modal / Drawer
  const [selectedPermission, setSelectedPermission] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Who-Has-What View Modal / Drawer
  const [whoHasWhatPermId, setWhoHasWhatPermId] = useState(null);
  const [whoHasWhatData, setWhoHasWhatData] = useState(null);
  const [whoHasWhatLoading, setWhoHasWhatLoading] = useState(false);
  const [whoHasWhatError, setWhoHasWhatError] = useState(null);

  // Orphan Audit Data
  const [orphanReport, setOrphanReport] = useState(null);
  const [orphanLoading, setOrphanLoading] = useState(false);

  // Deprecation Advisory Data
  const [deprecationAdvisory, setDeprecationAdvisory] = useState(null);
  const [advisoryLoading, setAdvisoryLoading] = useState(false);

  const abortControllerRef = useRef(null);

  // Compute available module codes
  const moduleOptions = useMemo(() => {
    const set = new Set();
    permissions.forEach((p) => {
      if (p.module_code) set.add(p.module_code);
    });
    return Array.from(set).sort();
  }, [permissions]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = totalPermissions;
    let platformCount = 0;
    let collegeCount = 0;
    let orphanCount = 0;

    permissions.forEach((p) => {
      if (p.scope_type === 'PLATFORM') platformCount++;
      if (p.scope_type === 'COLLEGE') collegeCount++;
      if (p.is_orphan) orphanCount++;
    });

    return { total, platformCount, collegeCount, orphanCount };
  }, [permissions, totalPermissions]);

  // Load Permissions Catalog
  const loadPermissions = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setIsRefreshing(true);
    setError(null);

    let isOrphanParam = undefined;
    if (orphanFilter === 'ORPHAN') isOrphanParam = true;
    if (orphanFilter === 'MAPPED') isOrphanParam = false;

    try {
      const data = await fetchPermissions({
        scope_type: scopeFilter,
        module_code: moduleFilter,
        search: searchQuery,
        is_orphan: isOrphanParam,
        limit,
        offset: page * limit,
        signal: abortControllerRef.current.signal,
      });

      setPermissions(data.permissions || []);
      setTotalPermissions(data.total || 0);
    } catch (err) {
      if (err.isCanceled) return;
      setError(err.message || 'Failed to load permission catalog');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [scopeFilter, moduleFilter, orphanFilter, searchQuery, page, limit]);

  // Load Orphan Report
  const loadOrphanReport = useCallback(async () => {
    setOrphanLoading(true);
    try {
      const data = await fetchOrphanPermissions();
      setOrphanReport(data);
    } catch (err) {
      console.error('Failed to load orphan report', err);
    } finally {
      setOrphanLoading(false);
    }
  }, []);

  // Load Deprecation Advisory
  const loadDeprecationAdvisory = useCallback(async () => {
    setAdvisoryLoading(true);
    try {
      const data = await fetchDeprecationStatus();
      setDeprecationAdvisory(data);
    } catch (err) {
      console.error('Failed to load deprecation status', err);
    } finally {
      setAdvisoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPermissions();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadPermissions]);

  // Open Permission Detail Modal
  const handleOpenDetail = async (perm) => {
    setSelectedPermission(perm);
    setDetailLoading(true);
    try {
      const detail = await fetchPermissionById(perm.permission_id);
      setSelectedPermission(detail);
    } catch (err) {
      console.warn('Failed to load permission details', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // Open Who-Has-What Modal
  const handleOpenWhoHasWhat = async (perm) => {
    setWhoHasWhatPermId(perm.permission_id);
    setWhoHasWhatLoading(true);
    setWhoHasWhatError(null);
    setWhoHasWhatData(null);
    try {
      const data = await fetchPermissionWhoHasWhat(perm.permission_id);
      setWhoHasWhatData(data);
    } catch (err) {
      setWhoHasWhatError(err.message || 'Failed to load mapped role assignments');
    } finally {
      setWhoHasWhatLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalPermissions / limit));

  return (
    <div className="permissions-page-container animate-fade-in">
      {/* Top Header & Breadcrumbs */}
      <div className="permissions-hero-header">
        <div className="permissions-hero-text">
          <div className="permissions-breadcrumbs">
            <Link to="/dashboard" className="breadcrumb-link">Dashboard</Link>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current">Authorization Registry</span>
          </div>
          <h1 className="permissions-title">Permission Management</h1>
          <p className="permissions-subtitle">
            Atomic permission catalog, role assignment matrices, cross-tenant Who-Has-What traceability, and orphan detection audit.
          </p>
        </div>

        <div className="permissions-actions-cluster">
          <button
            type="button"
            className={`btn-enterprise btn-outline-soft ${isRefreshing ? 'is-loading' : ''}`}
            onClick={() => {
              loadPermissions();
              loadOrphanReport();
              loadDeprecationAdvisory();
              setFeedback({ type: 'success', message: 'Permission catalog refreshed successfully.' });
            }}
            disabled={isRefreshing}
            title="Refresh permissions catalog"
          >
            <RotateCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Top 4 KPI Stat Cards */}
      <div className="permissions-kpi-grid">
        {/* Card 1: Catalog Permissions */}
        <div className="permissions-stat-card card-stagger-1">
          <div className="permissions-stat-header">
            <span className="permissions-stat-label">Catalog Capabilities</span>
            <div className="permissions-stat-icon-wrap blue">
              <KeyRound size={17} />
            </div>
          </div>
          <div className="permissions-stat-value text-slate-900">
            <CountUpNumber value={totalPermissions} />
          </div>
          <div className="permissions-stat-subtext">Registered atomic capabilities</div>
          <div className="permissions-stat-accent-bar blue" />
        </div>

        {/* Card 2: Platform Scoped */}
        <div className="permissions-stat-card card-stagger-2">
          <div className="permissions-stat-header">
            <span className="permissions-stat-label">Platform Scoped</span>
            <div className="permissions-stat-icon-wrap indigo">
              <Globe size={17} />
            </div>
          </div>
          <div className="permissions-stat-value text-indigo-600">
            <CountUpNumber value={metrics.platformCount} />
          </div>
          <div className="permissions-stat-subtext">Restricted to platform operators</div>
          <div className="permissions-stat-accent-bar indigo" />
        </div>

        {/* Card 3: College Scoped */}
        <div className="permissions-stat-card card-stagger-3">
          <div className="permissions-stat-header">
            <span className="permissions-stat-label">College Scoped</span>
            <div className="permissions-stat-icon-wrap green">
              <Building2 size={17} />
            </div>
          </div>
          <div className="permissions-stat-value text-emerald-600">
            <CountUpNumber value={metrics.collegeCount} />
          </div>
          <div className="permissions-stat-subtext">Tenant-isolated operations</div>
          <div className="permissions-stat-accent-bar green" />
        </div>

        {/* Card 4: Unmapped (Orphans) */}
        <div className="permissions-stat-card card-stagger-4">
          <div className="permissions-stat-header">
            <span className="permissions-stat-label">Unmapped In Catalog</span>
            <div className="permissions-stat-icon-wrap amber">
              <AlertTriangle size={17} />
            </div>
          </div>
          <div className="permissions-stat-value text-amber-600">
            <CountUpNumber value={orphanReport?.total_count ?? metrics.orphanCount} />
          </div>
          <div className="permissions-stat-subtext">0 active role assignments</div>
          <div className="permissions-stat-accent-bar amber" />
        </div>
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div className={`permissions-feedback-banner ${feedback.type === 'success' ? 'success' : 'danger'} animate-slide-up`}>
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
      <div className="permissions-main-card card-stagger-4">
        {/* Navigation Tabs Pillbox */}
        <div className="permissions-nav-tabs">
          <button
            type="button"
            className={`permissions-tab-pill ${activeTab === 'catalog' ? 'active' : ''}`}
            onClick={() => setActiveTab('catalog')}
          >
            <KeyRound size={13} className="inline-icon" />
            Permission Catalog ({totalPermissions})
          </button>
          <button
            type="button"
            className={`permissions-tab-pill ${activeTab === 'orphans' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('orphans');
              loadOrphanReport();
            }}
          >
            <ShieldAlert size={13} className="inline-icon" />
            Orphan Detection Audit ({orphanReport?.total_count ?? metrics.orphanCount})
          </button>
          <button
            type="button"
            className={`permissions-tab-pill ${activeTab === 'advisories' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('advisories');
              loadDeprecationAdvisory();
            }}
          >
            <Info size={13} className="inline-icon" />
            Deprecation Advisories
          </button>
        </div>

        {/* TAB 1: PERMISSION CATALOG */}
        {activeTab === 'catalog' && (
          <>
            {/* Filter Toolbar */}
            <div className="permissions-toolbar">
              <div className="permissions-filters-group">
                <div className="filter-select-item">
                  <span className="filter-item-label">Scope:</span>
                  <select
                    id="perm-scope-filter"
                    className="permissions-select-input"
                    value={scopeFilter}
                    onChange={(e) => {
                      setScopeFilter(e.target.value);
                      setPage(0);
                    }}
                  >
                    <option value="ALL">All Scopes</option>
                    <option value="PLATFORM">PLATFORM</option>
                    <option value="COLLEGE">COLLEGE</option>
                    <option value="GLOBAL">GLOBAL</option>
                  </select>
                </div>

                <div className="filter-select-item">
                  <span className="filter-item-label">Module:</span>
                  <select
                    id="perm-module-filter"
                    className="permissions-select-input"
                    value={moduleFilter}
                    onChange={(e) => {
                      setModuleFilter(e.target.value);
                      setPage(0);
                    }}
                  >
                    <option value="ALL">All Modules</option>
                    {moduleOptions.map((mod) => (
                      <option key={mod} value={mod}>
                        {mod}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-select-item">
                  <span className="filter-item-label">Role Mapping:</span>
                  <select
                    id="perm-orphan-filter"
                    className="permissions-select-input"
                    value={orphanFilter}
                    onChange={(e) => {
                      setOrphanFilter(e.target.value);
                      setPage(0);
                    }}
                  >
                    <option value="ALL">All Permissions</option>
                    <option value="MAPPED">Mapped To Roles</option>
                    <option value="ORPHAN">Orphans (Unmapped)</option>
                  </select>
                </div>
              </div>

              <div className="permissions-search-box">
                <Search size={15} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search code, description..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(0);
                  }}
                  className="permissions-search-input"
                  id="input-search-permissions"
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="search-clear-btn"
                    onClick={() => setSearchQuery('')}
                    title="Clear search"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="permissions-error-banner">
                <div className="error-text-wrap">
                  <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
                  <span>{error}</span>
                </div>
                <button type="button" className="btn-enterprise btn-outline-soft" onClick={loadPermissions}>
                  Retry
                </button>
              </div>
            )}

            {/* Table or Empty State */}
            {loading ? (
              <div className="permissions-loading-state">
                <div className="loading-spinner-blue" />
                <div className="loading-state-title">Loading Permission Catalog...</div>
                <div className="loading-state-sub">Querying atomic capability index and role mappings.</div>
              </div>
            ) : permissions.length === 0 ? (
              <div className="permissions-empty-state">
                <div className="empty-state-badge-stage">
                  <div className="empty-state-badge-pulse" />
                  <div className="empty-state-icon-badge">
                    <KeyRound size={32} className="text-blue-600" />
                  </div>
                </div>
                <h3 className="empty-state-heading">No Permissions Match Query</h3>
                <p className="empty-state-description">
                  Try clearing your search terms or expanding your scope and module filters.
                </p>
                <button
                  type="button"
                  className="btn-enterprise btn-outline-soft empty-state-btn"
                  onClick={() => {
                    setScopeFilter('ALL');
                    setModuleFilter('ALL');
                    setOrphanFilter('ALL');
                    setSearchQuery('');
                  }}
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="permissions-table-responsive">
                <table className="permissions-table">
                  <thead>
                    <tr>
                      <th>Module</th>
                      <th>Permission Code</th>
                      <th>Scope</th>
                      <th>Description</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {permissions.map((p) => (
                      <tr key={p.permission_id} className="permissions-table-row">
                        <td>
                          <span className="module-code-tag">{p.module_code}</span>
                        </td>

                        <td>
                          <span className="code-pill">
                            {p.permission_code}
                          </span>
                        </td>

                        <td>
                          <span className={`badge-scope ${p.scope_type === 'PLATFORM' ? 'platform' : 'college'}`}>
                            {p.scope_type === 'PLATFORM' ? <Globe size={11} /> : <Building2 size={11} />}
                            <span>{p.scope_type}</span>
                          </span>
                        </td>

                        <td className="permission-desc-cell">
                          {p.description || '—'}
                        </td>

                        <td>
                          {p.is_orphan ? (
                            <span className="badge-orphan-pill">
                              <span className="orphan-dot" />
                              Orphan
                            </span>
                          ) : (
                            <span className="badge-active-pill">
                              <span className="active-dot" />
                              Mapped
                            </span>
                          )}
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          <div className="permissions-action-buttons">
                            <button
                              type="button"
                              className="btn-table-action"
                              onClick={() => handleOpenDetail(p)}
                              title="View details"
                            >
                              Inspect
                            </button>
                            <button
                              type="button"
                              className="btn-table-action"
                              onClick={() => handleOpenWhoHasWhat(p)}
                              title="Trace mapped roles"
                            >
                              <Users size={12} />
                              <span>Who Has What</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Bar */}
            {totalPermissions > limit && (
              <div className="permissions-pagination-bar">
                <span className="pagination-info">
                  Showing Page {page + 1} of {totalPages} ({totalPermissions} total capabilities)
                </span>
                <div className="pagination-actions">
                  <button
                    type="button"
                    className="btn-enterprise btn-outline-soft btn-sm"
                    disabled={page === 0 || loading}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    <ChevronLeft size={13} />
                    <span>Previous</span>
                  </button>
                  <button
                    type="button"
                    className="btn-enterprise btn-outline-soft btn-sm"
                    disabled={(page + 1) * limit >= totalPermissions || loading}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <span>Next</span>
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* TAB 2: ORPHAN DETECTION AUDIT */}
        {activeTab === 'orphans' && (
          <div className="orphans-audit-container">
            <div className="orphans-hero-card">
              <div className="orphans-hero-icon-wrap">
                <ShieldAlert size={24} className="text-amber-600" />
              </div>
              <div>
                <h3 className="orphans-hero-title">Orphan Permission Audit Report</h3>
                <p className="orphans-hero-sub">
                  Permissions existing in database but currently not assigned to any system or custom role.
                </p>
              </div>
            </div>

            {orphanLoading ? (
              <div className="permissions-loading-state" style={{ padding: '36px' }}>
                <div className="loading-spinner-blue" />
                <div className="loading-state-title">Running Orphan Audit Scan...</div>
              </div>
            ) : !orphanReport || !orphanReport.orphans || orphanReport.orphans.length === 0 ? (
              <div className="orphans-clean-card">
                <CheckCircle2 size={32} className="text-emerald-600" />
                <div className="clean-title">Zero Orphan Capabilities Detected</div>
                <p className="clean-sub">All database capabilities are actively assigned to authorized roles.</p>
              </div>
            ) : (
              <div className="orphans-list-grid">
                {orphanReport.orphans.map((p) => (
                  <div key={p.permission_id} className="orphan-item-card">
                    <div className="orphan-item-header">
                      <span className="code-pill">{p.permission_code}</span>
                      <span className={`badge-scope ${p.scope_type === 'PLATFORM' ? 'platform' : 'college'}`}>
                        {p.scope_type}
                      </span>
                    </div>
                    <div className="orphan-item-desc">{p.description || 'No description provided.'}</div>
                    <div className="orphan-item-footer">
                      <span className="text-xs text-slate-500">Module: {p.module_code}</span>
                      <button
                        type="button"
                        className="btn-table-action"
                        onClick={() => handleOpenDetail(p)}
                      >
                        Inspect
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: DEPRECATION ADVISORIES */}
        {activeTab === 'advisories' && (
          <div className="advisories-container">
            <div className="advisories-card">
              <div className="advisory-header">
                <div className="modal-header-icon-wrap indigo">
                  <Info size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Permission Lifecycle Governance</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Authoritative deprecation guidance and sunset standards</p>
                </div>
              </div>

              <div className="advisories-body">
                <div className="advisory-item">
                  <div className="advisory-title">Safe Deprecation Protocol</div>
                  <p className="advisory-text">
                    Permissions must undergo a minimum 2-sprint deprecation transition before retirement.
                    Platform auditing ensures no automated integrations rely on sunset actions.
                  </p>
                </div>

                <div className="advisory-item">
                  <div className="advisory-title">Immutable System Seeds</div>
                  <p className="advisory-text">
                    Core administrative endpoints require fundamental platform authorization capabilities and cannot be detached from protected operator roles.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: Permission Detail Drawer */}
      {selectedPermission && (
        <div className="modal-backdrop-blur">
          <div className="modal-dialog-card animate-badge-pop" style={{ maxWidth: '640px' }}>
            <div className="modal-dialog-header">
              <div className="modal-header-icon-wrap blue">
                <KeyRound size={20} />
              </div>
              <div className="modal-header-text">
                <h3 className="modal-header-title">{selectedPermission.permission_code}</h3>
                <div className="role-modal-badges">
                  <span className="module-code-tag">{selectedPermission.module_code}</span>
                  <span className={`badge-scope ${selectedPermission.scope_type === 'PLATFORM' ? 'platform' : 'college'}`}>
                    {selectedPermission.scope_type}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => setSelectedPermission(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-dialog-body">
              <div className="form-group-custom">
                <label className="form-label-custom">Description</label>
                <div className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  {selectedPermission.description || 'No description provided.'}
                </div>
              </div>

              <div className="role-detail-summary-grid mt-4">
                <div className="summary-item-card">
                  <span className="summary-label">Module Code</span>
                  <div className="summary-val text-slate-800">{selectedPermission.module_code}</div>
                </div>
                <div className="summary-item-card">
                  <span className="summary-label">Scope Classification</span>
                  <div className="summary-val text-blue-600">{selectedPermission.scope_type}</div>
                </div>
                <div className="summary-item-card">
                  <span className="summary-label">Mapping State</span>
                  <div className="summary-val text-emerald-600">
                    {selectedPermission.is_orphan ? 'Orphan' : 'Actively Mapped'}
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-dialog-footer">
              <button
                type="button"
                className="btn-enterprise btn-outline-soft"
                onClick={() => setSelectedPermission(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn-enterprise btn-primary-blue"
                onClick={() => {
                  const perm = selectedPermission;
                  setSelectedPermission(null);
                  handleOpenWhoHasWhat(perm);
                }}
              >
                <Users size={14} />
                <span>View Who Has What</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Who-Has-What Drawer */}
      {whoHasWhatPermId && (
        <div className="modal-backdrop-blur">
          <div className="modal-dialog-card animate-badge-pop" style={{ maxWidth: '680px' }}>
            <div className="modal-dialog-header">
              <div className="modal-header-icon-wrap indigo">
                <Users size={20} />
              </div>
              <div className="modal-header-text">
                <h3 className="modal-header-title">Role Assignment Traceability</h3>
                <p className="modal-header-subtitle">
                  Listing all system and custom roles that grant this atomic capability.
                </p>
              </div>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => setWhoHasWhatPermId(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-dialog-body">
              {whoHasWhatLoading ? (
                <div className="permissions-loading-state" style={{ padding: '24px' }}>
                  <div className="loading-spinner-blue" />
                  <div className="loading-state-title">Querying Role Assignments...</div>
                </div>
              ) : whoHasWhatError ? (
                <div className="modal-error-notice">
                  <AlertCircle size={15} />
                  <span>{whoHasWhatError}</span>
                </div>
              ) : !whoHasWhatData?.roles || whoHasWhatData.roles.length === 0 ? (
                <div className="role-permissions-empty">
                  No roles are currently mapped to this permission. This is an orphan capability.
                </div>
              ) : (
                <div className="role-detail-perms-table-wrap">
                  <table className="roles-detail-table">
                    <thead>
                      <tr>
                        <th>Role Code</th>
                        <th>Role Name</th>
                        <th>Scope</th>
                        <th>Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {whoHasWhatData.roles.map((r) => (
                        <tr key={r.role_id}>
                          <td>
                            <code className="text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-mono font-bold">
                              {r.role_code}
                            </code>
                          </td>
                          <td className="font-semibold text-slate-800">{r.role_name}</td>
                          <td>
                            <span className={`badge-scope ${r.scope === 'PLATFORM' ? 'platform' : 'college'}`}>
                              {r.scope}
                            </span>
                          </td>
                          <td>
                            {r.is_system_role ? (
                              <span className="badge-type-pill system">System</span>
                            ) : (
                              <span className="badge-type-pill custom">Custom</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="modal-dialog-footer">
              <button
                type="button"
                className="btn-enterprise btn-outline-soft"
                onClick={() => setWhoHasWhatPermId(null)}
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
