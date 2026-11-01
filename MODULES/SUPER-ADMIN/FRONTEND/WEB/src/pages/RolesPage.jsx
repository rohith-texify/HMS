import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield,
  ShieldCheck,
  Lock,
  Plus,
  RotateCw,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Copy,
  Edit3,
  Trash2,
  KeyRound,
  Users,
  CheckCircle2,
  Layers,
  Sparkles,
  AlertCircle,
  Clock,
  Filter,
  Check,
  Building2,
  Globe,
  SlidersHorizontal,
} from 'lucide-react';
import {
  fetchRolesList,
  fetchRoleById,
  fetchPermissionsCatalog,
  createCustomRole,
  cloneRole,
  updateCustomRole,
  updateRolePermissions,
  deleteCustomRole,
  fetchRoleTemplates,
  DEFAULT_ROLES,
  DEFAULT_PERMISSIONS,
} from '../services/roleService';

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

export default function RolesPage() {
  // Directory & Filter State
  const [roles, setRoles] = useState(DEFAULT_ROLES);
  const [totalRoles, setTotalRoles] = useState(DEFAULT_ROLES.length);
  const [scopeFilter, setScopeFilter] = useState('ALL'); // ALL | COLLEGE | PLATFORM
  const [systemFilter, setSystemFilter] = useState('ALL'); // ALL | SYSTEM | CUSTOM
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const limit = 10;
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Global Permission Catalog
  const [catalog, setCatalog] = useState(DEFAULT_PERMISSIONS);
  const [catalogLoading, setCatalogLoading] = useState(false);

  // Global Feedback Toast
  const [feedback, setFeedback] = useState(null);

  // Role Detail Drawer
  const [selectedRole, setSelectedRole] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Create Custom Role Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    role_code: '',
    role_name: '',
    scope: 'COLLEGE',
    permission_ids: [],
  });
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState(null);

  // Clone Role Modal
  const [cloningRole, setCloningRole] = useState(null);
  const [cloneForm, setCloneForm] = useState({
    new_role_code: '',
    new_role_name: '',
    include_permissions: true,
  });
  const [cloneSubmitting, setCloneSubmitting] = useState(false);
  const [cloneError, setCloneError] = useState(null);

  // Edit Role Modal
  const [editingRole, setEditingRole] = useState(null);
  const [editForm, setEditForm] = useState({ role_name: '' });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState(null);

  // Permission Mapping Modal
  const [mappingRole, setMappingRole] = useState(null);
  const [selectedPermIDs, setSelectedPermIDs] = useState([]);
  const [mappingReason, setMappingReason] = useState('');
  const [mappingSubmitting, setMappingSubmitting] = useState(false);
  const [mappingError, setMappingError] = useState(null);
  const [permSearch, setPermSearch] = useState('');

  // Delete Custom Role Modal
  const [deletingRole, setDeletingRole] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // Role Templates Advisory View
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [templateStatus, setTemplateStatus] = useState(null);
  const [templateLoading, setTemplateLoading] = useState(false);

  const abortControllerRef = useRef(null);

  // Fetch Roles Directory
  const loadRoles = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setIsRefreshing(true);
    setError(null);

    let isSystemRoleParam;
    if (systemFilter === 'SYSTEM') isSystemRoleParam = true;
    if (systemFilter === 'CUSTOM') isSystemRoleParam = false;

    try {
      const res = await fetchRolesList({
        scope: scopeFilter,
        is_system_role: isSystemRoleParam,
        search: searchQuery,
        limit,
        offset: page * limit,
        signal: controller.signal,
      });
      setRoles(res.roles || []);
      setTotalRoles(res.total || 0);
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err.message || 'Failed to load roles directory');
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [scopeFilter, systemFilter, searchQuery, page, limit]);

  useEffect(() => {
    loadRoles();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadRoles]);

  // Load Permissions Catalog once
  useEffect(() => {
    async function loadCatalog() {
      setCatalogLoading(true);
      try {
        const res = await fetchPermissionsCatalog('ALL');
        if (res?.permissions && res.permissions.length > 0) {
          setCatalog(res.permissions);
        }
      } catch (err) {
        // Fallback catalog is already active
      } finally {
        setCatalogLoading(false);
      }
    }
    loadCatalog();
  }, []);

  // Compute Metrics
  const systemCount = useMemo(() => roles.filter((r) => r.is_system_role).length, [roles]);
  const customCount = useMemo(() => roles.filter((r) => !r.is_system_role).length, [roles]);
  const catalogCount = useMemo(() => catalog.length, [catalog]);

  // Group Catalog Permissions by Module Code
  const groupedCatalog = useMemo(() => {
    const map = {};
    const filtered = permSearch.trim()
      ? catalog.filter(
          (p) =>
            p.permission_code?.toLowerCase().includes(permSearch.toLowerCase()) ||
            p.description?.toLowerCase().includes(permSearch.toLowerCase()) ||
            p.module_code?.toLowerCase().includes(permSearch.toLowerCase())
        )
      : catalog;

    filtered.forEach((p) => {
      const mod = p.module_code || 'GENERAL';
      if (!map[mod]) {
        map[mod] = [];
      }
      map[mod].push(p);
    });
    return map;
  }, [catalog, permSearch]);

  // Open Role Details
  const handleOpenDetail = async (role) => {
    setSelectedRole(role);
    setDetailLoading(true);
    try {
      const detail = await fetchRoleById(role.role_id);
      setSelectedRole(detail);
    } catch (err) {
      console.warn('Failed to load role full detail:', err.message);
    } finally {
      setDetailLoading(false);
    }
  };

  // Open Edit Metadata Modal
  const handleOpenEdit = (role) => {
    setEditingRole(role);
    setEditForm({ role_name: role.role_name });
    setEditError(null);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingRole) return;
    setEditSubmitting(true);
    setEditError(null);
    try {
      await updateCustomRole(editingRole.role_id, {
        role_name: editForm.role_name.trim(),
      });
      setEditingRole(null);
      setFeedback({ type: 'success', message: `Role ${editingRole.role_code} updated successfully.` });
      loadRoles();
      if (selectedRole && selectedRole.role_id === editingRole.role_id) {
        handleOpenDetail(editingRole);
      }
    } catch (err) {
      setEditError(err.message || 'Failed to update role');
    } finally {
      setEditSubmitting(false);
    }
  };

  // Open Clone Role Modal
  const handleOpenClone = (role) => {
    setCloningRole(role);
    setCloneForm({
      new_role_code: `${role.role_code}_COPY`,
      new_role_name: `${role.role_name} (Copy)`,
      include_permissions: true,
    });
    setCloneError(null);
  };

  const handleCloneSubmit = async (e) => {
    e.preventDefault();
    if (!cloningRole) return;
    setCloneSubmitting(true);
    setCloneError(null);
    try {
      const cloned = await cloneRole(cloningRole.role_id, {
        new_role_code: cloneForm.new_role_code.trim().toUpperCase(),
        new_role_name: cloneForm.new_role_name.trim(),
        include_permissions: cloneForm.include_permissions,
      });
      setCloningRole(null);
      setFeedback({
        type: 'success',
        message: `Custom role ${cloned.role_code} cloned successfully from ${cloningRole.role_code}.`,
      });
      loadRoles();
    } catch (err) {
      setCloneError(err.message || 'Failed to clone role');
    } finally {
      setCloneSubmitting(false);
    }
  };

  // Open Create Custom Role Modal
  const handleOpenCreate = () => {
    setCreateForm({
      role_code: '',
      role_name: '',
      scope: 'COLLEGE',
      permission_ids: [],
    });
    setCreateError(null);
    setShowCreateModal(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreateSubmitting(true);
    setCreateError(null);
    try {
      const created = await createCustomRole({
        role_code: createForm.role_code.trim().toUpperCase(),
        role_name: createForm.role_name.trim(),
        scope: createForm.scope,
        permission_ids: createForm.permission_ids,
      });
      setShowCreateModal(false);
      setFeedback({
        type: 'success',
        message: `Custom role ${created.role_code} created successfully.`,
      });
      loadRoles();
    } catch (err) {
      setCreateError(err.message || 'Failed to create custom role');
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Open Permission Mapping Modal
  const handleOpenPermissionsMapping = async (role) => {
    setMappingRole(role);
    setMappingReason('');
    setMappingError(null);
    setPermSearch('');
    try {
      const detail = await fetchRoleById(role.role_id);
      const permIDs = (detail.permissions || []).map((p) => p.permission_id);
      setSelectedPermIDs(permIDs);
    } catch (err) {
      setMappingError('Failed to load current mapped permissions');
    }
  };

  const handleMappingSubmit = async (e) => {
    e.preventDefault();
    if (!mappingRole) return;
    setMappingSubmitting(true);
    setMappingError(null);
    try {
      await updateRolePermissions(mappingRole.role_id, {
        permission_ids: selectedPermIDs,
        reason: mappingReason.trim(),
      });
      setMappingRole(null);
      setFeedback({
        type: 'success',
        message: `Permissions updated for role ${mappingRole.role_code}.`,
      });
      loadRoles();
      if (selectedRole && selectedRole.role_id === mappingRole.role_id) {
        handleOpenDetail(mappingRole);
      }
    } catch (err) {
      setMappingError(err.message || 'Failed to update role permissions');
    } finally {
      setMappingSubmitting(false);
    }
  };

  // Open Delete Custom Role Modal
  const handleOpenDelete = (role) => {
    setDeletingRole(role);
    setDeleteError(null);
  };

  const handleDeleteSubmit = async () => {
    if (!deletingRole) return;
    setDeleteSubmitting(true);
    setDeleteError(null);
    try {
      await deleteCustomRole(deletingRole.role_id);
      setDeletingRole(null);
      setFeedback({
        type: 'success',
        message: `Custom role ${deletingRole.role_code} deleted successfully.`,
      });
      if (selectedRole && selectedRole.role_id === deletingRole.role_id) {
        setSelectedRole(null);
      }
      loadRoles();
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete custom role');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // Open Role Templates Advisory Status Modal
  const handleOpenTemplates = async () => {
    setShowTemplatesModal(true);
    setTemplateLoading(true);
    try {
      const res = await fetchRoleTemplates();
      setTemplateStatus(res);
    } catch (err) {
      setTemplateStatus({ status: 'ERROR', message: err.message });
    } finally {
      setTemplateLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalRoles / limit));

  return (
    <div className="roles-page-container animate-fade-in">
      {/* Top Header & Breadcrumbs */}
      <div className="roles-hero-header">
        <div className="roles-hero-text">
          <div className="roles-breadcrumbs">
            <Link to="/dashboard" className="breadcrumb-link">Dashboard</Link>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current">Roles &amp; Access Profiles</span>
          </div>
          <h1 className="roles-title">Role &amp; Permission Management</h1>
          <p className="roles-subtitle">
            Central authorization catalog. Manage system security baselines, clone custom operational roles, and enforce scope policies.
          </p>
        </div>

        <div className="roles-actions-cluster">
          <button
            type="button"
            className="btn-enterprise btn-outline-soft"
            onClick={handleOpenTemplates}
            title="Inspect role template baseline status"
          >
            <Layers size={14} />
            <span>Templates</span>
          </button>

          <button
            type="button"
            className={`btn-enterprise btn-outline-soft ${isRefreshing ? 'is-loading' : ''}`}
            onClick={loadRoles}
            disabled={isRefreshing}
            title="Refresh role catalog"
          >
            <RotateCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            className="btn-enterprise btn-primary-blue"
            onClick={handleOpenCreate}
            id="btn-create-custom-role"
          >
            <Plus size={15} />
            <span>Create Custom Role</span>
          </button>
        </div>
      </div>

      {/* Top 4 KPI Stat Cards */}
      <div className="roles-kpi-grid">
        {/* Card 1: Total Roles */}
        <div className="roles-stat-card card-stagger-1">
          <div className="roles-stat-header">
            <span className="roles-stat-label">Total Catalog Roles</span>
            <div className="roles-stat-icon-wrap blue">
              <Shield size={17} />
            </div>
          </div>
          <div className="roles-stat-value text-slate-900">
            <CountUpNumber value={totalRoles} />
          </div>
          <div className="roles-stat-subtext">Active authorization profiles</div>
          <div className="roles-stat-accent-bar blue" />
        </div>

        {/* Card 2: System Roles */}
        <div className="roles-stat-card card-stagger-2">
          <div className="roles-stat-header">
            <span className="roles-stat-label">System Protected Roles</span>
            <div className="roles-stat-icon-wrap indigo">
              <Lock size={17} />
            </div>
          </div>
          <div className="roles-stat-value text-indigo-600">
            <CountUpNumber value={systemCount} />
          </div>
          <div className="roles-stat-subtext">Immutable baseline platform fixtures</div>
          <div className="roles-stat-accent-bar indigo" />
        </div>

        {/* Card 3: Custom Roles */}
        <div className="roles-stat-card card-stagger-3">
          <div className="roles-stat-header">
            <span className="roles-stat-label">Custom Operational Roles</span>
            <div className="roles-stat-icon-wrap green">
              <Sparkles size={17} />
            </div>
          </div>
          <div className="roles-stat-value text-emerald-600">
            <CountUpNumber value={customCount} />
          </div>
          <div className="roles-stat-subtext">Tailored college and staff profiles</div>
          <div className="roles-stat-accent-bar green" />
        </div>

        {/* Card 4: Catalog Capabilities */}
        <div className="roles-stat-card card-stagger-4">
          <div className="roles-stat-header">
            <span className="roles-stat-label">Atomic Capabilities</span>
            <div className="roles-stat-icon-wrap purple">
              <KeyRound size={17} />
            </div>
          </div>
          <div className="roles-stat-value text-purple-600">
            <CountUpNumber value={catalogCount} />
          </div>
          <div className="roles-stat-subtext">Registered permissions catalog</div>
          <div className="roles-stat-accent-bar purple" />
        </div>
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div className={`roles-feedback-banner ${feedback.type === 'success' ? 'success' : 'danger'} animate-slide-up`}>
          <div className="feedback-content">
            {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{feedback.message}</span>
          </div>
          <button type="button" className="feedback-close-btn" onClick={() => setFeedback(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Main Content Card: Tabs, Search & Directory Table */}
      <div className="roles-main-card card-stagger-4">
        {/* Controls Toolbar: Segmented Type Tabs & Filters */}
        <div className="roles-toolbar">
          {/* Segmented Filter Tabs */}
          <div className="roles-tabs-pillbox">
            <button
              type="button"
              onClick={() => {
                setSystemFilter('ALL');
                setPage(0);
              }}
              className={`roles-tab-pill ${systemFilter === 'ALL' ? 'active' : ''}`}
              id="tab-role-all"
            >
              All Roles ({totalRoles})
            </button>
            <button
              type="button"
              onClick={() => {
                setSystemFilter('SYSTEM');
                setPage(0);
              }}
              className={`roles-tab-pill ${systemFilter === 'SYSTEM' ? 'active' : ''}`}
              id="tab-role-system"
            >
              <Lock size={12} className="inline-icon" />
              System Roles ({systemCount})
            </button>
            <button
              type="button"
              onClick={() => {
                setSystemFilter('CUSTOM');
                setPage(0);
              }}
              className={`roles-tab-pill ${systemFilter === 'CUSTOM' ? 'active' : ''}`}
              id="tab-role-custom"
            >
              <Sparkles size={12} className="inline-icon" />
              Custom Roles ({customCount})
            </button>
          </div>

          {/* Right Filters Cluster: Scope Select + Search */}
          <div className="roles-filter-cluster">
            <div className="roles-scope-selector">
              <span className="scope-label">Scope:</span>
              <select
                id="role-scope-filter"
                className="roles-select-input"
                value={scopeFilter}
                onChange={(e) => {
                  setScopeFilter(e.target.value);
                  setPage(0);
                }}
              >
                <option value="ALL">All Scopes</option>
                <option value="COLLEGE">COLLEGE</option>
                <option value="PLATFORM">PLATFORM</option>
              </select>
            </div>

            <div className="roles-search-box">
              <Search size={15} className="search-icon" />
              <input
                type="text"
                placeholder="Search code or role name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(0);
                }}
                className="roles-search-input"
                id="input-search-roles"
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
        </div>

        {/* Error Alert */}
        {error && (
          <div className="roles-error-banner">
            <div className="error-text-wrap">
              <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button type="button" className="btn-enterprise btn-outline-soft" onClick={loadRoles}>
              Retry
            </button>
          </div>
        )}

        {/* Directory Table View */}
        {loading ? (
          <div className="roles-loading-state">
            <div className="loading-spinner-blue" />
            <div className="loading-state-title">Loading Role Directory...</div>
            <div className="loading-state-sub">Validating scope hierarchies and assigned permission matrices.</div>
          </div>
        ) : roles.length === 0 ? (
          <div className="roles-empty-state">
            <div className="empty-state-badge-stage">
              <div className="empty-state-badge-pulse" />
              <div className="empty-state-icon-badge">
                <ShieldCheck size={32} className="text-blue-600" />
              </div>
            </div>
            <h3 className="empty-state-heading">No Roles Match Query</h3>
            <p className="empty-state-description">
              Try adjusting your scope filter, changing your search terms, or create a new custom role.
            </p>
            <button
              type="button"
              className="btn-enterprise btn-outline-soft empty-state-btn"
              onClick={() => {
                setSystemFilter('ALL');
                setScopeFilter('ALL');
                setSearchQuery('');
              }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="roles-table-responsive">
            <table className="roles-table">
              <thead>
                <tr>
                  <th>Role Code</th>
                  <th>Role Name</th>
                  <th>Scope</th>
                  <th>Governance Type</th>
                  <th>Permissions</th>
                  <th>Active Users</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((r) => (
                  <tr key={r.role_id} className="roles-table-row">
                    <td>
                      <span className="code-pill">
                        {r.role_code}
                      </span>
                    </td>

                    <td>
                      <div className="role-title-cell">
                        <div className="role-avatar-badge">
                          {r.is_system_role ? (
                            <Lock size={13} className="text-indigo-600" />
                          ) : (
                            <Shield size={13} className="text-blue-600" />
                          )}
                        </div>
                        <span className="role-title-text">{r.role_name}</span>
                      </div>
                    </td>

                    <td>
                      <span className={`badge-scope ${r.scope === 'PLATFORM' ? 'platform' : 'college'}`}>
                        {r.scope === 'PLATFORM' ? <Globe size={11} /> : <Building2 size={11} />}
                        <span>{r.scope}</span>
                      </span>
                    </td>

                    <td>
                      {r.is_system_role ? (
                        <span className="badge-type-pill system">
                          <span className="status-dot-active" />
                          System
                        </span>
                      ) : (
                        <span className="badge-type-pill custom">
                          <span className="status-dot-neutral" />
                          Custom
                        </span>
                      )}
                    </td>

                    <td>
                      <button
                        type="button"
                        className="role-perms-pill"
                        onClick={() => handleOpenDetail(r)}
                        title="View detailed permissions breakdown"
                      >
                        <KeyRound size={12} />
                        <span>{r.permission_count} capabilities</span>
                      </button>
                    </td>

                    <td>
                      <div className="users-count-cell">
                        <Users size={13} className="text-slate-400" />
                        <span>{r.user_count} {r.user_count === 1 ? 'user' : 'users'}</span>
                      </div>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div className="roles-action-buttons">
                        <button
                          type="button"
                          className="btn-table-action"
                          onClick={() => handleOpenDetail(r)}
                          title="View role details and permissions"
                        >
                          Inspect
                        </button>

                        <button
                          type="button"
                          className="btn-table-action"
                          onClick={() => handleOpenClone(r)}
                          title="Clone into a new custom role"
                        >
                          <Copy size={12} />
                          <span>Clone</span>
                        </button>

                        {!r.is_system_role && (
                          <>
                            <button
                              type="button"
                              className="btn-table-action"
                              onClick={() => handleOpenEdit(r)}
                              title="Edit custom role name"
                            >
                              <Edit3 size={12} />
                              <span>Edit</span>
                            </button>

                            <button
                              type="button"
                              className="btn-table-action"
                              onClick={() => handleOpenPermissionsMapping(r)}
                              title="Configure assigned permissions"
                            >
                              <SlidersHorizontal size={12} />
                              <span>Permissions</span>
                            </button>

                            <button
                              type="button"
                              className="btn-table-action danger"
                              onClick={() => handleOpenDelete(r)}
                              title={r.user_count > 0 ? 'Cannot delete role with active assignments' : 'Delete custom role'}
                            >
                              <Trash2 size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalRoles > limit && (
          <div className="roles-pagination-bar">
            <span className="pagination-info">
              Showing Page {page + 1} of {totalPages} ({totalRoles} total roles)
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
                disabled={(page + 1) * limit >= totalRoles || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                <span>Next</span>
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: Role Detail & Mapped Permissions Drawer */}
      {selectedRole && (
        <div className="modal-backdrop-blur">
          <div className="modal-dialog-card animate-badge-pop" style={{ maxWidth: '780px' }}>
            <div className="modal-dialog-header">
              <div className="modal-header-icon-wrap blue">
                {selectedRole.is_system_role ? <Lock size={20} /> : <ShieldCheck size={20} />}
              </div>
              <div className="modal-header-text">
                <h3 className="modal-header-title">{selectedRole.role_name}</h3>
                <div className="role-modal-badges">
                  <span className="code-pill">{selectedRole.role_code}</span>
                  <span className={`badge-scope ${selectedRole.scope === 'PLATFORM' ? 'platform' : 'college'}`}>
                    {selectedRole.scope}
                  </span>
                  {selectedRole.is_system_role ? (
                    <span className="badge-type-pill system">System Role (Immutable)</span>
                  ) : (
                    <span className="badge-type-pill custom">Custom Role</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => setSelectedRole(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-dialog-body">
              {/* Quick Summary Grid */}
              <div className="role-detail-summary-grid">
                <div className="summary-item-card">
                  <span className="summary-label">Mapped Permissions</span>
                  <div className="summary-val text-blue-600">
                    {selectedRole.permissions ? selectedRole.permissions.length : selectedRole.permission_count}
                  </div>
                </div>
                <div className="summary-item-card">
                  <span className="summary-label">Assigned Users</span>
                  <div className="summary-val text-slate-800">{selectedRole.user_count}</div>
                </div>
                <div className="summary-item-card">
                  <span className="summary-label">Created Date</span>
                  <div className="summary-val text-slate-600" style={{ fontSize: '0.9rem' }}>
                    {selectedRole.created_at ? new Date(selectedRole.created_at).toLocaleDateString() : '—'}
                  </div>
                </div>
              </div>

              <h4 className="section-subheading">Atomic Capabilities Breakdown</h4>

              {detailLoading ? (
                <div className="roles-loading-state" style={{ padding: '24px' }}>
                  <div className="loading-spinner-blue" />
                  <div className="loading-state-title">Loading Permission Matrix...</div>
                </div>
              ) : !selectedRole.permissions || selectedRole.permissions.length === 0 ? (
                <div className="role-permissions-empty">
                  No atomic permissions are currently mapped to this role.
                </div>
              ) : (
                <div className="role-detail-perms-table-wrap">
                  <table className="roles-detail-table">
                    <thead>
                      <tr>
                        <th>Module</th>
                        <th>Permission Code</th>
                        <th>Scope</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRole.permissions.map((p) => (
                        <tr key={p.permission_id}>
                          <td style={{ fontWeight: 600 }}>{p.module_code}</td>
                          <td>
                            <code className="text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-mono">
                              {p.permission_code}
                            </code>
                          </td>
                          <td>
                            <span className={`badge-scope ${p.scope_type === 'PLATFORM' ? 'platform' : 'college'}`}>
                              {p.scope_type}
                            </span>
                          </td>
                          <td className="text-slate-600 text-xs">{p.description || '—'}</td>
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
                onClick={() => setSelectedRole(null)}
              >
                Close
              </button>
              {!selectedRole.is_system_role && (
                <button
                  type="button"
                  className="btn-enterprise btn-primary-blue"
                  onClick={() => {
                    handleOpenPermissionsMapping(selectedRole);
                    setSelectedRole(null);
                  }}
                >
                  <SlidersHorizontal size={14} />
                  <span>Configure Permissions</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Create Custom Role */}
      {showCreateModal && (
        <div className="modal-backdrop-blur">
          <div className="modal-dialog-card animate-badge-pop" style={{ maxWidth: '580px' }}>
            <div className="modal-dialog-header">
              <div className="modal-header-icon-wrap blue">
                <Plus size={20} />
              </div>
              <div className="modal-header-text">
                <h3 className="modal-header-title">Create Custom Role</h3>
                <p className="modal-header-subtitle">
                  Define a new organizational role with tenant-level or platform authorization scope.
                </p>
              </div>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => setShowCreateModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div className="modal-dialog-body">
                {createError && (
                  <div className="modal-error-notice">
                    <AlertCircle size={15} />
                    <span>{createError}</span>
                  </div>
                )}

                <div className="form-group-custom">
                  <label className="form-label-custom">Role Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. LAB_COORDINATOR"
                    value={createForm.role_code}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, role_code: e.target.value.toUpperCase() })
                    }
                    className="form-input-custom font-mono"
                  />
                  <span className="text-xs text-slate-500">
                    Uppercase alphanumeric identifier with underscores.
                  </span>
                </div>

                <div className="form-group-custom">
                  <label className="form-label-custom">Role Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Laboratory Operations Coordinator"
                    value={createForm.role_name}
                    onChange={(e) => setCreateForm({ ...createForm, role_name: e.target.value })}
                    className="form-input-custom"
                  />
                </div>

                <div className="form-group-custom">
                  <label className="form-label-custom">Scope *</label>
                  <select
                    value={createForm.scope}
                    onChange={(e) => setCreateForm({ ...createForm, scope: e.target.value })}
                    className="form-input-custom"
                  >
                    <option value="COLLEGE">COLLEGE (Institution tenant operations)</option>
                    <option value="PLATFORM">PLATFORM (Global platform administrative operations)</option>
                  </select>
                </div>
              </div>

              <div className="modal-dialog-footer">
                <button
                  type="button"
                  className="btn-enterprise btn-outline-soft"
                  onClick={() => setShowCreateModal(false)}
                  disabled={createSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-enterprise btn-primary-blue"
                  disabled={createSubmitting}
                >
                  {createSubmitting ? 'Creating...' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Clone Role */}
      {cloningRole && (
        <div className="modal-backdrop-blur">
          <div className="modal-dialog-card animate-badge-pop" style={{ maxWidth: '580px' }}>
            <div className="modal-dialog-header">
              <div className="modal-header-icon-wrap indigo">
                <Copy size={20} />
              </div>
              <div className="modal-header-text">
                <h3 className="modal-header-title">Clone Role: {cloningRole.role_code}</h3>
                <p className="modal-header-subtitle">
                  Duplicate base configuration and inherit mapped permission grants into a new custom profile.
                </p>
              </div>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => setCloningRole(null)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCloneSubmit}>
              <div className="modal-dialog-body">
                {cloneError && (
                  <div className="modal-error-notice">
                    <AlertCircle size={15} />
                    <span>{cloneError}</span>
                  </div>
                )}

                <div className="form-group-custom">
                  <label className="form-label-custom">New Role Code *</label>
                  <input
                    type="text"
                    required
                    value={cloneForm.new_role_code}
                    onChange={(e) =>
                      setCloneForm({ ...cloneForm, new_role_code: e.target.value.toUpperCase() })
                    }
                    className="form-input-custom font-mono"
                  />
                </div>

                <div className="form-group-custom">
                  <label className="form-label-custom">New Role Name *</label>
                  <input
                    type="text"
                    required
                    value={cloneForm.new_role_name}
                    onChange={(e) =>
                      setCloneForm({ ...cloneForm, new_role_name: e.target.value })
                    }
                    className="form-input-custom"
                  />
                </div>

                <div className="role-checkbox-item" style={{ marginTop: '12px' }}>
                  <input
                    type="checkbox"
                    id="clone-include-perms"
                    checked={cloneForm.include_permissions}
                    onChange={(e) =>
                      setCloneForm({ ...cloneForm, include_permissions: e.target.checked })
                    }
                    className="checkbox-custom"
                  />
                  <label htmlFor="clone-include-perms" className="checkbox-label-text">
                    Copy all {cloningRole.permission_count} mapped atomic permissions to the new role
                  </label>
                </div>
              </div>

              <div className="modal-dialog-footer">
                <button
                  type="button"
                  className="btn-enterprise btn-outline-soft"
                  onClick={() => setCloningRole(null)}
                  disabled={cloneSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-enterprise btn-primary-blue"
                  disabled={cloneSubmitting}
                >
                  {cloneSubmitting ? 'Cloning...' : 'Confirm Clone'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Edit Custom Role Name */}
      {editingRole && (
        <div className="modal-backdrop-blur">
          <div className="modal-dialog-card animate-badge-pop" style={{ maxWidth: '520px' }}>
            <div className="modal-dialog-header">
              <div className="modal-header-icon-wrap blue">
                <Edit3 size={20} />
              </div>
              <div className="modal-header-text">
                <h3 className="modal-header-title">Edit Role: {editingRole.role_code}</h3>
                <p className="modal-header-subtitle">Update public display metadata for this custom role.</p>
              </div>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => setEditingRole(null)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className="modal-dialog-body">
                {editError && (
                  <div className="modal-error-notice">
                    <AlertCircle size={15} />
                    <span>{editError}</span>
                  </div>
                )}

                <div className="form-group-custom">
                  <label className="form-label-custom">Role Code (Read-Only)</label>
                  <input
                    type="text"
                    disabled
                    value={editingRole.role_code}
                    className="form-input-custom disabled font-mono"
                  />
                </div>

                <div className="form-group-custom">
                  <label className="form-label-custom">Role Name *</label>
                  <input
                    type="text"
                    required
                    value={editForm.role_name}
                    onChange={(e) => setEditForm({ role_name: e.target.value })}
                    className="form-input-custom"
                  />
                </div>
              </div>

              <div className="modal-dialog-footer">
                <button
                  type="button"
                  className="btn-enterprise btn-outline-soft"
                  onClick={() => setEditingRole(null)}
                  disabled={editSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-enterprise btn-primary-blue"
                  disabled={editSubmitting}
                >
                  {editSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Permission Mapping Modal */}
      {mappingRole && (
        <div className="modal-backdrop-blur">
          <div className="modal-dialog-card animate-badge-pop" style={{ maxWidth: '850px', maxHeight: '90vh' }}>
            <div className="modal-dialog-header">
              <div className="modal-header-icon-wrap purple">
                <SlidersHorizontal size={20} />
              </div>
              <div className="modal-header-text">
                <h3 className="modal-header-title">Configure Permissions: {mappingRole.role_code}</h3>
                <p className="modal-header-subtitle">
                  Assign or revoke atomic capabilities. Selected: {selectedPermIDs.length} capabilities.
                </p>
              </div>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => setMappingRole(null)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleMappingSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="modal-dialog-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                {mappingError && (
                  <div className="modal-error-notice">
                    <AlertCircle size={15} />
                    <span>{mappingError}</span>
                  </div>
                )}

                <div className="mapping-search-toolbar">
                  <div className="roles-search-box" style={{ maxWidth: '100%' }}>
                    <Search size={14} className="search-icon" />
                    <input
                      type="text"
                      placeholder="Filter capabilities by module, code or keyword..."
                      value={permSearch}
                      onChange={(e) => setPermSearch(e.target.value)}
                      className="roles-search-input"
                    />
                    {permSearch && (
                      <button
                        type="button"
                        className="search-clear-btn"
                        onClick={() => setPermSearch('')}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Grouped Permission Checklist */}
                <div className="mapping-modules-list">
                  {Object.keys(groupedCatalog).map((modKey) => {
                    const modulePerms = groupedCatalog[modKey];
                    const allModSelected = modulePerms.every((p) => selectedPermIDs.includes(p.permission_id));

                    const toggleAllMod = () => {
                      if (allModSelected) {
                        const modIDs = new Set(modulePerms.map((p) => p.permission_id));
                        setSelectedPermIDs((prev) => prev.filter((id) => !modIDs.has(id)));
                      } else {
                        const toAdd = modulePerms.map((p) => p.permission_id);
                        setSelectedPermIDs((prev) => Array.from(new Set([...prev, ...toAdd])));
                      }
                    };

                    return (
                      <div key={modKey} className="mapping-module-card">
                        <div className="mapping-module-header">
                          <div className="header-left">
                            <span className="module-title">{modKey}</span>
                            <span className="module-badge">{modulePerms.length} capabilities</span>
                          </div>
                          <button
                            type="button"
                            className="btn-select-all-mod"
                            onClick={toggleAllMod}
                          >
                            {allModSelected ? 'Deselect Module' : 'Select All'}
                          </button>
                        </div>

                        <div className="mapping-checkbox-grid">
                          {modulePerms.map((perm) => {
                            const isChecked = selectedPermIDs.includes(perm.permission_id);
                            return (
                              <label
                                key={perm.permission_id}
                                className={`perm-checkbox-item ${isChecked ? 'selected' : ''}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedPermIDs((prev) => [...prev, perm.permission_id]);
                                    } else {
                                      setSelectedPermIDs((prev) =>
                                        prev.filter((id) => id !== perm.permission_id)
                                      );
                                    }
                                  }}
                                  className="checkbox-custom"
                                />
                                <div className="perm-info">
                                  <div className="perm-code">{perm.permission_code}</div>
                                  <div className="perm-desc">{perm.description || '—'}</div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="form-group-custom" style={{ marginTop: '16px' }}>
                  <label className="form-label-custom">Audit Reason (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Updated role capabilities for Semester 2 security audit"
                    value={mappingReason}
                    onChange={(e) => setMappingReason(e.target.value)}
                    className="form-input-custom"
                  />
                </div>
              </div>

              <div className="modal-dialog-footer">
                <button
                  type="button"
                  className="btn-enterprise btn-outline-soft"
                  onClick={() => setMappingRole(null)}
                  disabled={mappingSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-enterprise btn-primary-blue"
                  disabled={mappingSubmitting}
                >
                  {mappingSubmitting ? 'Saving...' : 'Apply Permissions'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: Delete Custom Role Confirmation */}
      {deletingRole && (
        <div className="modal-backdrop-blur">
          <div className="modal-dialog-card animate-badge-pop" style={{ maxWidth: '480px' }}>
            <div className="modal-dialog-header">
              <div className="modal-header-icon-wrap rose">
                <Trash2 size={20} />
              </div>
              <div className="modal-header-text">
                <h3 className="modal-header-title">Delete Role</h3>
                <p className="modal-header-subtitle">Permanent removal of custom role definition.</p>
              </div>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => setDeletingRole(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-dialog-body">
              {deleteError && (
                <div className="modal-error-notice">
                  <AlertCircle size={15} />
                  <span>{deleteError}</span>
                </div>
              )}

              <p className="modal-instruction-text">
                Are you sure you want to permanently delete custom role <strong>{deletingRole.role_name}</strong> (<code>{deletingRole.role_code}</code>)?
              </p>

              {deletingRole.user_count > 0 && (
                <div className="modal-error-notice">
                  <AlertCircle size={15} />
                  <span>
                    This role is currently assigned to <strong>{deletingRole.user_count}</strong> user(s). You must reassign those users before this role can be removed.
                  </span>
                </div>
              )}
            </div>

            <div className="modal-dialog-footer">
              <button
                type="button"
                className="btn-enterprise btn-outline-soft"
                onClick={() => setDeletingRole(null)}
                disabled={deleteSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-enterprise btn-danger"
                onClick={handleDeleteSubmit}
                disabled={deleteSubmitting || deletingRole.user_count > 0}
              >
                {deleteSubmitting ? 'Deleting...' : 'Delete Custom Role'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: Role Templates Advisory Status */}
      {showTemplatesModal && (
        <div className="modal-backdrop-blur">
          <div className="modal-dialog-card animate-badge-pop" style={{ maxWidth: '640px' }}>
            <div className="modal-dialog-header">
              <div className="modal-header-icon-wrap blue">
                <Layers size={20} />
              </div>
              <div className="modal-header-text">
                <h3 className="modal-header-title">Role Templates &amp; Blueprint Advisory</h3>
                <p className="modal-header-subtitle">
                  Inspect standardized pre-packaged role templates and platform schema fixtures.
                </p>
              </div>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => setShowTemplatesModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-dialog-body">
              {templateLoading ? (
                <div className="roles-loading-state" style={{ padding: '24px' }}>
                  <div className="loading-spinner-blue" />
                  <div className="loading-state-title">Loading Template Status...</div>
                </div>
              ) : (
                <div className="templates-advisory-content">
                  <div className="template-card-preview">
                    <div className="preview-top">
                      <div className="preview-badge">STANDARD FIXTURE</div>
                      <div className="preview-status text-emerald-600 font-semibold text-xs flex items-center gap-1">
                        <Check size={13} /> Active
                      </div>
                    </div>
                    <div className="preview-title">Higher Education Institutional Blueprint</div>
                    <div className="preview-desc text-slate-600 text-xs mt-1">
                      Contains canonical institutional roles: <code>SUPER_ADMIN</code>, <code>COLLEGE_ADMIN</code>, <code>WARDEN</code>, <code>INCHARGE</code>, <code>ACCOUNTANT</code>, <code>STUDENT</code>.
                    </div>
                  </div>

                  <div className="mt-4 text-xs text-slate-500 leading-relaxed">
                    Custom role blueprints can be provisioned across new institutional tenants automatically during college onboarding pipeline execution.
                  </div>
                </div>
              )}
            </div>

            <div className="modal-dialog-footer">
              <button
                type="button"
                className="btn-enterprise btn-primary-blue"
                onClick={() => setShowTemplatesModal(false)}
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
