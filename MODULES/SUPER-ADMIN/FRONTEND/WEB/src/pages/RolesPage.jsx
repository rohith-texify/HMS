import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
} from '../services/roleService';

export default function RolesPage() {
  // Directory & Filter State
  const [roles, setRoles] = useState([]);
  const [totalRoles, setTotalRoles] = useState(0);
  const [scopeFilter, setScopeFilter] = useState('ALL');
  const [systemFilter, setSystemFilter] = useState('ALL'); // ALL, SYSTEM, CUSTOM
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const limit = 10;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Global Permission Catalog
  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  // Global Feedback Banner
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'danger', message: string }

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
      setLoading(false);
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err.message || 'Failed to load roles directory');
        setLoading(false);
      }
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
        setCatalog(res.permissions || []);
      } catch (err) {
        console.warn('Could not load permission catalog:', err.message);
      } finally {
        setCatalogLoading(false);
      }
    }
    loadCatalog();
  }, []);

  // Group Catalog Permissions by Module Code
  const groupedCatalog = useMemo(() => {
    const map = {};
    catalog.forEach((p) => {
      const mod = p.module_code || 'GENERAL';
      if (!map[mod]) {
        map[mod] = [];
      }
      map[mod].push(p);
    });
    return map;
  }, [catalog]);

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

  return (
    <div className="page-container" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 'bold', margin: 0 }}>
              🛡️ Role & Permission Management
            </h1>
            <span className="badge badge-info">Platform & College Scope</span>
          </div>
          <p className="page-subtitle" style={{ color: 'var(--text-secondary)', marginTop: '6px' }}>
            Central authorization catalogue. Manage system roles, create and clone custom roles, and configure atomic permission matrices.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-outline" onClick={handleOpenTemplates} title="View role template advisory status">
            📋 Role Templates Status
          </button>
          <button className="btn btn-primary" onClick={handleOpenCreate}>
            ➕ Create Custom Role
          </button>
        </div>
      </div>

      {/* Architecture Limitation Notice */}
      <div
        className="card"
        style={{
          marginBottom: '20px',
          borderLeft: '4px solid #3b82f6',
          backgroundColor: '#eff6ff',
          padding: '12px 18px',
        }}
      >
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '1.25rem' }}>ℹ️</span>
          <div style={{ fontSize: '0.85rem', color: '#1e3a8a', lineHeight: 1.5 }}>
            <strong>System Role & Scope Governance:</strong> System roles (e.g. <code>SUPER_ADMIN</code>, <code>COLLEGE_ADMIN</code>, <code>INCHARGE</code>)
            are protected immutable fixtures; their definitions and core permissions cannot be altered. Custom roles can be created, cloned, and modified with
            strict scope validation. Permissions of scope <code>PLATFORM</code> cannot be mapped to <code>COLLEGE</code>-scoped roles.
          </div>
        </div>
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          className={`card alert alert-${feedback.type}`}
          style={{
            marginBottom: '20px',
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>{feedback.message}</div>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setFeedback(null)}
            style={{ fontSize: '0.75rem', padding: '2px 8px' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Controls & Filter Bar */}
      <div
        className="card"
        style={{
          marginBottom: '20px',
          padding: '14px 18px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: '600' }} htmlFor="role-scope-filter">
              Scope:
            </label>
            <select
              id="role-scope-filter"
              className="form-control"
              style={{ width: '140px', padding: '6px 10px', fontSize: '0.85rem' }}
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: '600' }} htmlFor="role-system-filter">
              Type:
            </label>
            <select
              id="role-system-filter"
              className="form-control"
              style={{ width: '140px', padding: '6px 10px', fontSize: '0.85rem' }}
              value={systemFilter}
              onChange={(e) => {
                setSystemFilter(e.target.value);
                setPage(0);
              }}
            >
              <option value="ALL">All Roles</option>
              <option value="SYSTEM">System Only</option>
              <option value="CUSTOM">Custom Only</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="text"
              className="form-control"
              style={{ width: '220px', padding: '6px 10px', fontSize: '0.85rem' }}
              placeholder="Search code or name..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(0);
              }}
            />
          </div>
        </div>

        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Showing <strong>{roles.length}</strong> of <strong>{totalRoles}</strong> roles
        </div>
      </div>

      {/* Main Table Card */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Loading role directory...
          </div>
        ) : error ? (
          <div style={{ padding: '30px', textAlign: 'center' }}>
            <div className="alert alert-danger" style={{ display: 'inline-block', maxWidth: '500px' }}>
              ⚠️ {error}
            </div>
            <div style={{ marginTop: '12px' }}>
              <button className="btn btn-outline btn-sm" onClick={loadRoles}>
                Retry
              </button>
            </div>
          </div>
        ) : roles.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <p style={{ fontSize: '1.1rem', marginBottom: '8px' }}>No roles match your query.</p>
            <span style={{ fontSize: '0.85rem' }}>Try clearing your filters or create a new custom role.</span>
          </div>
        ) : (
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '12px 16px' }}>Role Code</th>
                <th style={{ padding: '12px 16px' }}>Role Name</th>
                <th style={{ padding: '12px 16px' }}>Scope</th>
                <th style={{ padding: '12px 16px' }}>Type</th>
                <th style={{ padding: '12px 16px' }}>Permissions</th>
                <th style={{ padding: '12px 16px' }}>Active Assignments</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.role_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 'bold' }}>
                    {r.role_code}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: '600' }}>
                    {r.role_name}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span className={r.scope === 'PLATFORM' ? 'badge badge-info' : 'badge badge-outline'}>
                      {r.scope}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {r.is_system_role ? (
                      <span className="badge badge-success" title="Protected System Role">
                        🔒 System
                      </span>
                    ) : (
                      <span className="badge badge-warning" title="Custom User Role">
                        ✏️ Custom
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => handleOpenDetail(r)}
                      style={{ fontSize: '0.8rem', padding: '2px 8px' }}
                    >
                      {r.permission_count} permissions
                    </button>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {r.user_count} user(s)
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => handleOpenDetail(r)}
                        title="View role details and permissions"
                      >
                        Inspect
                      </button>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => handleOpenClone(r)}
                        title="Clone this role into a new custom role"
                      >
                        Clone
                      </button>
                      {!r.is_system_role && (
                        <>
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => handleOpenEdit(r)}
                            title="Edit custom role name"
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => handleOpenPermissionsMapping(r)}
                            title="Edit permission mappings"
                          >
                            Permissions
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleOpenDelete(r)}
                            title={r.user_count > 0 ? 'Cannot delete role with active users' : 'Delete unused custom role'}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination Bar */}
        {totalRoles > limit && (
          <div
            style={{
              padding: '12px 18px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid var(--border-color)',
            }}
          >
            <button
              className="btn btn-outline btn-sm"
              disabled={page === 0 || loading}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </button>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Page {page + 1} of {Math.ceil(totalRoles / limit)}
            </span>
            <button
              className="btn btn-outline btn-sm"
              disabled={(page + 1) * limit >= totalRoles || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* MODAL 1: Role Detail & Mapped Permissions Drawer */}
      {selectedRole && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '750px', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                  {selectedRole.is_system_role ? '🔒' : '✏️'} {selectedRole.role_name}
                </h2>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <code style={{ fontSize: '0.85rem' }}>{selectedRole.role_code}</code>
                  <span className={selectedRole.scope === 'PLATFORM' ? 'badge badge-info' : 'badge badge-outline'}>
                    {selectedRole.scope}
                  </span>
                  {selectedRole.is_system_role ? (
                    <span className="badge badge-success">System Role (Immutable)</span>
                  ) : (
                    <span className="badge badge-warning">Custom Role</span>
                  )}
                </div>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => setSelectedRole(null)}>
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
              <div style={{ backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Mapped Permissions</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                  {selectedRole.permissions ? selectedRole.permissions.length : selectedRole.permission_count}
                </div>
              </div>
              <div style={{ backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Active User Assignments</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{selectedRole.user_count}</div>
              </div>
              <div style={{ backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Created Timestamp</span>
                <div style={{ fontSize: '0.85rem', fontWeight: '600' }}>
                  {new Date(selectedRole.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>

            <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '10px' }}>
              Mapped Permission Matrix
            </h3>

            {detailLoading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Loading permissions...
              </div>
            ) : !selectedRole.permissions || selectedRole.permissions.length === 0 ? (
              <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '6px', textAlign: 'center' }}>
                No atomic permissions currently mapped to this role.
              </div>
            ) : (
              <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '8px 12px' }}>Module</th>
                      <th style={{ padding: '8px 12px' }}>Permission Code</th>
                      <th style={{ padding: '8px 12px' }}>Scope</th>
                      <th style={{ padding: '8px 12px' }}>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRole.permissions.map((p) => (
                      <tr key={p.permission_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '8px 12px', fontWeight: '600' }}>{p.module_code}</td>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{p.permission_code}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span className={p.scope_type === 'PLATFORM' ? 'badge badge-info' : 'badge badge-outline'}>
                            {p.scope_type}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
                          {p.description || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              {!selectedRole.is_system_role && (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    handleOpenPermissionsMapping(selectedRole);
                    setSelectedRole(null);
                  }}
                >
                  Configure Permissions
                </button>
              )}
              <button className="btn btn-outline" onClick={() => setSelectedRole(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Create Custom Role */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '640px', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>➕ Create Custom Role</h2>
              <button className="btn btn-outline btn-sm" onClick={() => setShowCreateModal(false)} disabled={createSubmitting}>
                ✕
              </button>
            </div>

            {createError && (
              <div className="alert alert-danger" style={{ marginBottom: '14px', padding: '10px 12px', fontSize: '0.85rem' }}>
                ⚠️ {createError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: '600', fontSize: '0.85rem' }}>
                  Role Code (Unique Identifier) *
                </label>
                <input
                  type="text"
                  className="form-control"
                  required
                  placeholder="e.g. COLLEGE_FINANCE_OFFICER"
                  value={createForm.role_code}
                  onChange={(e) => setCreateForm({ ...createForm, role_code: e.target.value.toUpperCase() })}
                  disabled={createSubmitting}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Must start with a letter and contain only uppercase alphanumeric characters and underscores.
                </span>
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: '600', fontSize: '0.85rem' }}>
                  Role Name (Display Name) *
                </label>
                <input
                  type="text"
                  className="form-control"
                  required
                  placeholder="e.g. College Finance Officer"
                  value={createForm.role_name}
                  onChange={(e) => setCreateForm({ ...createForm, role_name: e.target.value })}
                  disabled={createSubmitting}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ fontWeight: '600', fontSize: '0.85rem' }}>
                  Scope Boundary *
                </label>
                <select
                  className="form-control"
                  value={createForm.scope}
                  onChange={(e) => setCreateForm({ ...createForm, scope: e.target.value, permission_ids: [] })}
                  disabled={createSubmitting}
                >
                  <option value="COLLEGE">COLLEGE (Tenant-Specific Authorization)</option>
                  <option value="PLATFORM">PLATFORM (Global System Authorization)</option>
                </select>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  College-scoped roles can only receive College and Global permissions.
                </span>
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label" style={{ fontWeight: '600', fontSize: '0.85rem' }}>
                  Initial Mapped Permissions ({createForm.permission_ids.length} selected)
                </label>
                <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px' }}>
                  {catalogLoading ? (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Loading catalog...</div>
                  ) : (
                    Object.entries(groupedCatalog).map(([modCode, perms]) => {
                      const allowedPerms = perms.filter(
                        (p) => createForm.scope === 'PLATFORM' || p.scope_type !== 'PLATFORM'
                      );
                      if (allowedPerms.length === 0) return null;
                      return (
                        <div key={modCode} style={{ marginBottom: '12px' }}>
                          <strong style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Module: {modCode}</strong>
                          <div style={{ marginTop: '4px' }}>
                            {allowedPerms.map((p) => {
                              const checked = createForm.permission_ids.includes(p.permission_id);
                              return (
                                <label
                                  key={p.permission_id}
                                  style={{ display: 'block', fontSize: '0.8rem', cursor: 'pointer', marginBottom: '4px' }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setCreateForm({
                                          ...createForm,
                                          permission_ids: [...createForm.permission_ids, p.permission_id],
                                        });
                                      } else {
                                        setCreateForm({
                                          ...createForm,
                                          permission_ids: createForm.permission_ids.filter((id) => id !== p.permission_id),
                                        });
                                      }
                                    }}
                                    style={{ marginRight: '8px' }}
                                  />
                                  <code>{p.permission_code}</code> — {p.description || p.permission_code}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowCreateModal(false)}
                  disabled={createSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={createSubmitting}>
                  {createSubmitting ? 'Creating...' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Clone Role */}
      {cloningRole && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                🧬 Clone Role: {cloningRole.role_code}
              </h2>
              <button className="btn btn-outline btn-sm" onClick={() => setCloningRole(null)} disabled={cloneSubmitting}>
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Creates a new <strong>Custom Role</strong> based on <code>{cloningRole.role_code}</code> with identical scope ({cloningRole.scope}).
              The cloned role is fully editable and can be customized independently.
            </p>

            {cloneError && (
              <div className="alert alert-danger" style={{ marginBottom: '14px', padding: '10px 12px', fontSize: '0.85rem' }}>
                ⚠️ {cloneError}
              </div>
            )}

            <form onSubmit={handleCloneSubmit}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: '600', fontSize: '0.85rem' }}>
                  New Role Code *
                </label>
                <input
                  type="text"
                  className="form-control"
                  required
                  value={cloneForm.new_role_code}
                  onChange={(e) => setCloneForm({ ...cloneForm, new_role_code: e.target.value.toUpperCase() })}
                  disabled={cloneSubmitting}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: '600', fontSize: '0.85rem' }}>
                  New Role Name *
                </label>
                <input
                  type="text"
                  className="form-control"
                  required
                  value={cloneForm.new_role_name}
                  onChange={(e) => setCloneForm({ ...cloneForm, new_role_name: e.target.value })}
                  disabled={cloneSubmitting}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={cloneForm.include_permissions}
                    onChange={(e) => setCloneForm({ ...cloneForm, include_permissions: e.target.checked })}
                    disabled={cloneSubmitting}
                  />
                  <strong>Copy permission mappings</strong> ({cloningRole.permission_count} permissions)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setCloningRole(null)}
                  disabled={cloneSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={cloneSubmitting}>
                  {cloneSubmitting ? 'Cloning...' : 'Confirm Clone'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Edit Custom Role Metadata */}
      {editingRole && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                ✏️ Edit Role: {editingRole.role_code}
              </h2>
              <button className="btn btn-outline btn-sm" onClick={() => setEditingRole(null)} disabled={editSubmitting}>
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              In accordance with schema governance, role code and scope are immutable. Only display name can be updated.
            </p>

            {editError && (
              <div className="alert alert-danger" style={{ marginBottom: '14px', padding: '10px 12px', fontSize: '0.85rem' }}>
                ⚠️ {editError}
              </div>
            )}

            <form onSubmit={handleEditSubmit}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: '600', fontSize: '0.85rem' }}>
                  Role Code (Immutable)
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={editingRole.role_code}
                  disabled
                  style={{ backgroundColor: '#f1f5f9' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label" style={{ fontWeight: '600', fontSize: '0.85rem' }}>
                  Role Name *
                </label>
                <input
                  type="text"
                  className="form-control"
                  required
                  value={editForm.role_name}
                  onChange={(e) => setEditForm({ ...editForm, role_name: e.target.value })}
                  disabled={editSubmitting}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setEditingRole(null)}
                  disabled={editSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={editSubmitting}>
                  {editSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Configure Permissions Mapping */}
      {mappingRole && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '680px', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                  🔑 Configure Permissions: {mappingRole.role_code}
                </h2>
                <span className="badge badge-outline" style={{ marginTop: '4px' }}>
                  Scope: {mappingRole.scope}
                </span>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => setMappingRole(null)} disabled={mappingSubmitting}>
                ✕
              </button>
            </div>

            {mappingError && (
              <div className="alert alert-danger" style={{ marginBottom: '14px', padding: '10px 12px', fontSize: '0.85rem' }}>
                ⚠️ {mappingError}
              </div>
            )}

            <form onSubmit={handleMappingSubmit}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="form-label" style={{ fontWeight: '600', fontSize: '0.85rem', margin: 0 }}>
                    Select Permissions ({selectedPermIDs.length} assigned)
                  </label>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                    onClick={() => setSelectedPermIDs([])}
                  >
                    Clear All
                  </button>
                </div>

                <div style={{ maxHeight: '260px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px' }}>
                  {Object.entries(groupedCatalog).map(([modCode, perms]) => {
                    const allowedPerms = perms.filter(
                      (p) => mappingRole.scope === 'PLATFORM' || p.scope_type !== 'PLATFORM'
                    );
                    if (allowedPerms.length === 0) return null;
                    return (
                      <div key={modCode} style={{ marginBottom: '12px' }}>
                        <strong style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Module: {modCode}</strong>
                        <div style={{ marginTop: '4px' }}>
                          {allowedPerms.map((p) => {
                            const checked = selectedPermIDs.includes(p.permission_id);
                            return (
                              <label
                                key={p.permission_id}
                                style={{ display: 'block', fontSize: '0.8rem', cursor: 'pointer', marginBottom: '4px' }}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedPermIDs([...selectedPermIDs, p.permission_id]);
                                    } else {
                                      setSelectedPermIDs(selectedPermIDs.filter((id) => id !== p.permission_id));
                                    }
                                  }}
                                  style={{ marginRight: '8px' }}
                                />
                                <code>{p.permission_code}</code> — {p.description || p.permission_code}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label" style={{ fontWeight: '600', fontSize: '0.85rem' }}>
                  Mandatory Audit Reason *
                </label>
                <textarea
                  className="form-control"
                  rows={2}
                  required
                  placeholder="e.g. Permission elevation request for semester examination management"
                  value={mappingReason}
                  onChange={(e) => setMappingReason(e.target.value)}
                  disabled={mappingSubmitting}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setMappingRole(null)}
                  disabled={mappingSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={mappingSubmitting}>
                  {mappingSubmitting ? 'Updating...' : 'Save Permissions'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: Delete Custom Role */}
      {deletingRole && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '12px' }}>
              🗑️ Delete Custom Role
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Are you sure you want to permanently delete custom role <strong>{deletingRole.role_code}</strong>?
            </p>

            {deletingRole.user_count > 0 ? (
              <div className="alert alert-danger" style={{ marginBottom: '16px', fontSize: '0.85rem' }}>
                ⚠️ <strong>Deletion Prohibited:</strong> This role is actively assigned to <strong>{deletingRole.user_count}</strong> user(s).
                In accordance with database integrity constraints, all user assignments must be revoked or reassigned before deleting a role.
              </div>
            ) : (
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '12px',
                  fontSize: '0.8rem',
                  marginBottom: '16px',
                }}
              >
                ✓ <strong>Safety Check Passed:</strong> This role is not assigned to any users. Deleting it will remove its permission mappings and record an audit log entry.
              </div>
            )}

            {deleteError && (
              <div className="alert alert-danger" style={{ marginBottom: '14px', padding: '10px 12px', fontSize: '0.85rem' }}>
                ⚠️ {deleteError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                className="btn btn-outline"
                onClick={() => setDeletingRole(null)}
                disabled={deleteSubmitting}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDeleteSubmit}
                disabled={deleteSubmitting || deletingRole.user_count > 0}
              >
                {deleteSubmitting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: Role Templates Advisory Status */}
      {showTemplatesModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '620px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                📋 College Role Templates Architecture Status
              </h2>
              <button className="btn btn-outline btn-sm" onClick={() => setShowTemplatesModal(false)}>
                ✕
              </button>
            </div>

            {templateLoading ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Checking role template storage...
              </div>
            ) : templateStatus ? (
              <div>
                <div
                  style={{
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: '6px',
                    padding: '14px',
                    fontSize: '0.85rem',
                    color: '#92400e',
                    marginBottom: '16px',
                    lineHeight: 1.5,
                  }}
                >
                  <strong>Architectural Capability Limitation:</strong>
                  <p style={{ marginTop: '6px' }}>
                    {templateStatus.message}
                  </p>
                </div>

                <h3 style={{ fontSize: '0.95rem', fontWeight: 'bold', marginBottom: '8px' }}>
                  Required Role Templates Catalog (Pending Migration)
                </h3>

                <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                  <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '8px 12px' }}>Template Code</th>
                        <th style={{ padding: '8px 12px' }}>Target Scope</th>
                        <th style={{ padding: '8px 12px' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(templateStatus.templates || []).map((t) => (
                        <tr key={t.template_code} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 'bold' }}>{t.name}</td>
                          <td style={{ padding: '8px 12px' }}>
                            <span className="badge badge-outline">{t.scope}</span>
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <span className="badge badge-warning">{t.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <div style={{ marginTop: '20px', textAlign: 'right' }}>
              <button className="btn btn-outline" onClick={() => setShowTemplatesModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
