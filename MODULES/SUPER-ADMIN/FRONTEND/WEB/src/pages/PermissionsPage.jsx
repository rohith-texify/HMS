import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  fetchPermissions,
  fetchPermissionById,
  fetchPermissionWhoHasWhat,
  fetchOrphanPermissions,
  fetchDeprecationStatus,
} from '../services/permissionService';

export default function PermissionsPage() {
  // Navigation tabs: 'catalog', 'who-has-what', 'orphans', 'advisories'
  const [activeTab, setActiveTab] = useState('catalog');

  // Directory & Filter State
  const [permissions, setPermissions] = useState([]);
  const [totalPermissions, setTotalPermissions] = useState(0);
  const [scopeFilter, setScopeFilter] = useState('ALL'); // ALL, PLATFORM, COLLEGE, GLOBAL
  const [moduleFilter, setModuleFilter] = useState('ALL');
  const [orphanFilter, setOrphanFilter] = useState('ALL'); // ALL, ORPHAN, MAPPED
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const limit = 25;
  const [loading, setLoading] = useState(true);
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

  // Abort controller refs
  const abortControllerRef = useRef(null);

  // Compute available module codes from current permissions for filter dropdown
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

  // Initial fetch
  useEffect(() => {
    loadPermissions();
    loadOrphanReport();
    loadDeprecationAdvisory();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadPermissions, loadOrphanReport, loadDeprecationAdvisory]);

  // Open Permission Detail
  const handleOpenDetail = async (perm) => {
    setSelectedPermission(perm);
    setDetailLoading(true);
    try {
      const detail = await fetchPermissionById(perm.permission_id);
      setSelectedPermission(detail || perm);
    } catch (err) {
      console.error('Failed to load detail', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // Open Who-Has-What View
  const handleOpenWhoHasWhat = async (perm) => {
    setWhoHasWhatPermId(perm.permission_id);
    setWhoHasWhatLoading(true);
    setWhoHasWhatError(null);
    setWhoHasWhatData(null);
    try {
      const data = await fetchPermissionWhoHasWhat(perm.permission_id);
      setWhoHasWhatData(data);
    } catch (err) {
      setWhoHasWhatError(err.message || 'Failed to retrieve access mapping');
    } finally {
      setWhoHasWhatLoading(false);
    }
  };

  const totalPages = Math.ceil(totalPermissions / limit);

  return (
    <div className="page-container" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 'bold', margin: 0 }}>
              🛡️ Permission Management
            </h1>
            <span className="badge badge-primary">Module 11</span>
            <span className="badge badge-info">Catalog & Access Audit</span>
          </div>
          <p className="page-subtitle" style={{ color: 'var(--text-secondary)', marginTop: '6px' }}>
            Atomic permission registry, role assignment matrices, cross-tenant Who-Has-What traceability, and orphan detection audit.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn btn-outline"
            onClick={() => {
              loadPermissions();
              loadOrphanReport();
              loadDeprecationAdvisory();
              setFeedback({ type: 'success', message: 'Permission catalog data refreshed.' });
            }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Metrics Cards Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div className="card" style={{ padding: '16px', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 'bold' }}>
            Catalog Permissions
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 'bold', marginTop: '4px' }}>
            {totalPermissions}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
            Seeded atomic capabilities
          </div>
        </div>

        <div className="card" style={{ padding: '16px', borderLeft: '4px solid #8b5cf6' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 'bold' }}>
            Platform Scoped
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 'bold', marginTop: '4px', color: '#7c3aed' }}>
            {metrics.platformCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
            Restricted to platform operators
          </div>
        </div>

        <div className="card" style={{ padding: '16px', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 'bold' }}>
            College Scoped
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 'bold', marginTop: '4px', color: '#059669' }}>
            {metrics.collegeCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
            Tenant-isolated operations
          </div>
        </div>

        <div className="card" style={{ padding: '16px', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 'bold' }}>
            Unmapped in DB (Orphans)
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 'bold', marginTop: '4px', color: '#d97706' }}>
            {orphanReport?.total_count ?? metrics.orphanCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
            0 mapped roles in database
          </div>
        </div>

        <div className="card" style={{ padding: '16px', borderLeft: '4px solid #ef4444' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 'bold' }}>
            Deprecation Lifecycle
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginTop: '8px', color: '#dc2626' }}>
            🚫 BLOCKED
          </div>
          <div style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '4px' }}>
            Pending schema approval
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

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #e2e8f0', marginBottom: '20px' }}>
        <button
          className={`btn ${activeTab === 'catalog' ? 'btn-primary' : 'btn-outline'}`}
          style={{ borderRadius: '6px 6px 0 0', borderBottom: 'none' }}
          onClick={() => setActiveTab('catalog')}
        >
          📖 Permission Catalog
        </button>
        <button
          className={`btn ${activeTab === 'orphans' ? 'btn-primary' : 'btn-outline'}`}
          style={{ borderRadius: '6px 6px 0 0', borderBottom: 'none' }}
          onClick={() => {
            setActiveTab('orphans');
            loadOrphanReport();
          }}
        >
          🔍 Orphan Detection Audit ({orphanReport?.total_count ?? 0})
        </button>
        <button
          className={`btn ${activeTab === 'advisories' ? 'btn-primary' : 'btn-outline'}`}
          style={{ borderRadius: '6px 6px 0 0', borderBottom: 'none' }}
          onClick={() => setActiveTab('advisories')}
        >
          ⚠️ Architectural Disclosures & Advisories
        </button>
      </div>

      {/* TAB 1: PERMISSION CATALOG */}
      {activeTab === 'catalog' && (
        <>
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
                <label style={{ fontSize: '0.85rem', fontWeight: '600' }} htmlFor="perm-scope-filter">
                  Scope:
                </label>
                <select
                  id="perm-scope-filter"
                  className="form-control"
                  style={{ width: '140px', padding: '6px 10px', fontSize: '0.85rem' }}
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

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600' }} htmlFor="perm-module-filter">
                  Module:
                </label>
                <select
                  id="perm-module-filter"
                  className="form-control"
                  style={{ width: '160px', padding: '6px 10px', fontSize: '0.85rem' }}
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

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600' }} htmlFor="perm-orphan-filter">
                  Role Mapping:
                </label>
                <select
                  id="perm-orphan-filter"
                  className="form-control"
                  style={{ width: '160px', padding: '6px 10px', fontSize: '0.85rem' }}
                  value={orphanFilter}
                  onChange={(e) => {
                    setOrphanFilter(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="ALL">All Permissions</option>
                  <option value="MAPPED">Mapped to Roles</option>
                  <option value="ORPHAN">Unmapped in DB (Orphans)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Search code or description..."
                style={{ width: '260px', padding: '6px 12px', fontSize: '0.85rem' }}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(0);
                }}
              />
              {searchQuery && (
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    setSearchQuery('');
                    setPage(0);
                  }}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Catalog Table */}
          <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <span className="spinner" style={{ marginRight: '8px' }}></span>
                Loading permission catalog...
              </div>
            ) : error ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#dc2626' }}>
                <div style={{ fontSize: '1.2rem', marginBottom: '8px' }}>⚠️ Error loading permissions</div>
                <p>{error}</p>
                <button className="btn btn-outline" onClick={loadPermissions} style={{ marginTop: '12px' }}>
                  Retry
                </button>
              </div>
            ) : permissions.length === 0 ? (
              <div style={{ padding: '50px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🔍</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>No permissions match your filter criteria</div>
                <p style={{ fontSize: '0.85rem', marginTop: '6px' }}>Try adjusting scope, module, or search filters.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: '12px 16px' }}>Permission Code</th>
                      <th style={{ padding: '12px 16px' }}>Module</th>
                      <th style={{ padding: '12px 16px' }}>Scope</th>
                      <th style={{ padding: '12px 16px' }}>Description</th>
                      <th style={{ padding: '12px 16px' }}>Mapped Roles</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {permissions.map((perm) => (
                      <tr
                        key={perm.permission_id}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          transition: 'background-color 0.15s ease',
                        }}
                      >
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 'bold', color: '#1e293b' }}>
                          {perm.permission_code}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span className="badge badge-secondary" style={{ fontSize: '0.8rem' }}>
                            {perm.module_code}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginTop: '2px' }}>
                            {perm.module_name}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            className={`badge ${
                              perm.scope_type === 'PLATFORM'
                                ? 'badge-primary'
                                : perm.scope_type === 'COLLEGE'
                                ? 'badge-info'
                                : 'badge-warning'
                            }`}
                            style={{ fontSize: '0.75rem' }}
                          >
                            {perm.scope_type}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', maxWidth: '320px', color: '#475569', fontSize: '0.85rem' }}>
                          {perm.description || '—'}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {perm.is_orphan ? (
                            <span
                              className="badge"
                              style={{
                                backgroundColor: '#fef3c7',
                                color: '#b45309',
                                border: '1px solid #fde68a',
                                fontSize: '0.75rem',
                              }}
                              title="No roles in platform.role_permissions map this permission"
                            >
                              ⚠️ 0 Roles (Unmapped)
                            </span>
                          ) : (
                            <span
                              className="badge"
                              style={{
                                backgroundColor: '#dcfce7',
                                color: '#15803d',
                                border: '1px solid #bbf7d0',
                                fontSize: '0.75rem',
                              }}
                            >
                              ✓ {perm.mapped_roles_count} {perm.mapped_roles_count === 1 ? 'Role' : 'Roles'}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button
                              className="btn btn-outline btn-sm"
                              style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                              onClick={() => handleOpenDetail(perm)}
                              title="View permission details and mapped roles"
                            >
                              📋 Details
                            </button>
                            <button
                              className="btn btn-primary btn-sm"
                              style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                              onClick={() => handleOpenWhoHasWhat(perm)}
                              title="View which users and roles have this permission"
                            >
                              👥 Who Has What
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {!loading && totalPages > 1 && (
              <div
                style={{
                  padding: '12px 18px',
                  backgroundColor: '#f8fafc',
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  Showing {page * limit + 1} to {Math.min((page + 1) * limit, totalPermissions)} of {totalPermissions} permissions
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    className="btn btn-outline btn-sm"
                    disabled={page === 0}
                    onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                  >
                    ◀ Previous
                  </button>
                  <span style={{ padding: '4px 10px', fontSize: '0.85rem', alignSelf: 'center' }}>
                    Page {page + 1} of {totalPages}
                  </span>
                  <button
                    className="btn btn-outline btn-sm"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))}
                  >
                    Next ▶
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* TAB 2: ORPHAN DETECTION AUDIT */}
      {activeTab === 'orphans' && (
        <div>
          {/* Audit Definition Box */}
          <div
            className="card"
            style={{
              marginBottom: '20px',
              borderLeft: '4px solid #f59e0b',
              backgroundColor: '#fffbeb',
              padding: '16px 20px',
            }}
          >
            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '1.5rem' }}>🔍</span>
              <div>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '1rem', color: '#92400e' }}>
                  Orphan Permission Definition & Audit Integrity
                </h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#78350f', lineHeight: 1.5 }}>
                  {orphanReport?.definition ||
                    'An orphan permission is defined as an atomic permission in platform.permissions that is currently mapped to ZERO roles in platform.role_permissions.'}
                </p>
                <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#b45309', fontWeight: 'bold' }}>
                  ⚠️ Critical Distinction: Unmapped status in database role mappings does NOT signify that the permission key is unused by API route enforcement in code.
                </div>
              </div>
            </div>
          </div>

          {orphanLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <span className="spinner" style={{ marginRight: '8px' }}></span>
              Running orphan detection audit...
            </div>
          ) : orphanReport?.orphans?.length === 0 ? (
            <div className="card" style={{ padding: '50px', textAlign: 'center', backgroundColor: '#f0fdf4' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>✅</div>
              <h3 style={{ color: '#166534', margin: '0 0 6px 0' }}>Zero Orphan Permissions Detected</h3>
              <p style={{ color: '#15803d', fontSize: '0.9rem', margin: 0 }}>
                All {orphanReport?.catalog_size ?? totalPermissions} permissions in the catalog are currently mapped to at least one role in <code>platform.role_permissions</code>.
              </p>
            </div>
          ) : (
            <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
              <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ fontSize: '1rem' }}>Unmapped Permissions ({orphanReport?.total_count})</strong>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    {((orphanReport?.total_count / (orphanReport?.catalog_size || 1)) * 100).toFixed(1)}% of total catalog ({orphanReport?.catalog_size} permissions)
                  </div>
                </div>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={loadOrphanReport}
                >
                  Re-audit
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
                      <th style={{ padding: '12px 16px' }}>Permission Code</th>
                      <th style={{ padding: '12px 16px' }}>Module</th>
                      <th style={{ padding: '12px 16px' }}>Scope Type</th>
                      <th style={{ padding: '12px 16px' }}>Description</th>
                      <th style={{ padding: '12px 16px' }}>Created Date</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orphanReport?.orphans?.map((orphan) => (
                      <tr key={orphan.permission_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 'bold', color: '#b45309' }}>
                          {orphan.permission_code}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span className="badge badge-secondary">{orphan.module_code}</span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span className="badge badge-info">{orphan.scope_type}</span>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#475569', fontSize: '0.85rem' }}>
                          {orphan.description || '—'}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: '#64748b' }}>
                          {new Date(orphan.created_at).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => handleOpenDetail(orphan)}
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ARCHITECTURAL DISCLOSURES & ADVISORIES */}
      {activeTab === 'advisories' && (
        advisoryLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <span className="spinner" style={{ marginRight: '8px' }}></span>
            Loading architectural advisories...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Deprecation Blocker Card */}
          <div className="card" style={{ padding: '24px', borderLeft: '4px solid #ef4444' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <span style={{ fontSize: '1.5rem' }}>🚫</span>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#991b1b' }}>
                Permission Deprecation Lifecycle: BLOCKED (Mandatory Schema Constraint)
              </h3>
            </div>

            <p style={{ color: '#7f1d1d', lineHeight: 1.6, fontSize: '0.9rem', marginBottom: '14px' }}>
              {deprecationAdvisory?.reason ||
                'The existing PostgreSQL platform.permissions schema does not contain an is_deprecated, deprecated_at, or lifecycle status column. Project constraints strictly prohibit schema migrations or DDL modifications.'}
            </p>

            <div style={{ backgroundColor: '#fee2e2', padding: '14px', borderRadius: '6px', marginBottom: '16px' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#991b1b', marginBottom: '4px' }}>
                Root Schema Limitation:
              </div>
              <div style={{ fontSize: '0.85rem', color: '#7f1d1d', fontFamily: 'monospace' }}>
                {deprecationAdvisory?.schema_blocker ||
                  'Missing column platform.permissions.is_deprecated (boolean) and deprecated_at (timestamptz). Deprecation operations cannot be executed safely without schema support.'}
              </div>
            </div>

            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '8px' }}>
              Blocked Capabilities:
            </div>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.85rem', color: '#475569', lineHeight: 1.6 }}>
              {deprecationAdvisory?.blocked_capabilities?.map((cap) => (
                <li key={cap}>
                  <code>{cap}</code> — Disabled pending formal database migration approval.
                </li>
              ))}
            </ul>
          </div>

          {/* Maker-Checker & Approval Execution Advisory */}
          <div className="card" style={{ padding: '24px', borderLeft: '4px solid #f59e0b' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <span style={{ fontSize: '1.5rem' }}>ℹ️</span>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#92400e' }}>
                Role & Permission Approval Execution Status
              </h3>
            </div>

            <p style={{ color: '#78350f', lineHeight: 1.6, fontSize: '0.9rem', marginBottom: '12px' }}>
              While the Super Admin platform provides an approval request workflow (Module 6) for college settings and module entitlements,
              the underlying approval execution engine (<code>approval_repository.go:ExecuteOperation</code>) does not implement an automated handler
              for role permission alterations.
            </p>

            <div style={{ fontSize: '0.85rem', color: '#92400e', backgroundColor: '#fef3c7', padding: '12px', borderRadius: '6px' }}>
              <strong>Operational Reality:</strong> Role permission mapping updates are applied directly by authenticated Super Admins possessing the <code>platform.manage</code> privilege, with strict immutable audit trail logging in <code>platform.audit_logs</code>. They are not gated behind maker-checker approval execution.
            </div>
          </div>
        </div>
        )
      )}

      {/* WHO-HAS-WHAT MODAL */}
      {whoHasWhatPermId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setWhoHasWhatPermId(null);
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '900px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              backgroundColor: '#fff',
              borderRadius: '8px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '18px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.4rem' }}>👥</span>
                  <h2 style={{ fontSize: '1.3rem', fontWeight: 'bold', margin: 0 }}>
                    Who Has What: Access Traceability
                  </h2>
                </div>
                {whoHasWhatData?.permission && (
                  <div style={{ marginTop: '6px', fontSize: '0.85rem', color: '#64748b' }}>
                    Permission: <code style={{ fontWeight: 'bold', color: '#1e293b' }}>{whoHasWhatData.permission.permission_code}</code> ({whoHasWhatData.permission.scope_type} Scope)
                  </div>
                )}
              </div>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setWhoHasWhatPermId(null)}
                style={{ fontSize: '0.85rem' }}
              >
                ✕ Close
              </button>
            </div>

            {whoHasWhatLoading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <span className="spinner" style={{ marginRight: '8px' }}></span>
                Tracing mapped roles and user assignments...
              </div>
            ) : whoHasWhatError ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#dc2626' }}>
                <p>{whoHasWhatError}</p>
                <button
                  className="btn btn-outline"
                  onClick={() => {
                    const perm = permissions.find((p) => p.permission_id === whoHasWhatPermId);
                    if (perm) handleOpenWhoHasWhat(perm);
                  }}
                >
                  Retry
                </button>
              </div>
            ) : whoHasWhatData ? (
              <div>
                {/* Scope Notice */}
                <div
                  style={{
                    backgroundColor: '#eff6ff',
                    borderLeft: '4px solid #3b82f6',
                    padding: '12px 16px',
                    fontSize: '0.85rem',
                    color: '#1e3a8a',
                    marginBottom: '18px',
                    borderRadius: '4px',
                  }}
                >
                  <strong>Tenant Boundary Enforcement:</strong> {whoHasWhatData.scope_notice}
                </div>

                {/* Section 1: Mapped Roles */}
                <div style={{ marginBottom: '22px' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 'bold', marginBottom: '8px', color: '#1e293b' }}>
                    1. Roles Mapping This Permission ({whoHasWhatData.total_roles_count})
                  </h4>
                  {whoHasWhatData.mapped_roles?.length === 0 ? (
                    <div style={{ padding: '14px', backgroundColor: '#fffbeb', color: '#b45309', borderRadius: '6px', fontSize: '0.85rem' }}>
                      ⚠️ No roles in the platform currently map this permission (Unmapped / Orphan).
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {whoHasWhatData.mapped_roles?.map((r) => (
                        <div
                          key={r.role_id}
                          style={{
                            padding: '8px 12px',
                            backgroundColor: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          <span style={{ fontWeight: 'bold', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                            {r.role_code}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            ({r.role_name})
                          </span>
                          <span className={`badge ${r.scope === 'PLATFORM' ? 'badge-primary' : 'badge-info'}`} style={{ fontSize: '0.7rem' }}>
                            {r.scope}
                          </span>
                          {r.is_system_role && (
                            <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>
                              System
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section 2: Assigned Users */}
                <div>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 'bold', marginBottom: '8px', color: '#1e293b' }}>
                    2. Active Users Assigned These Roles ({whoHasWhatData.total_users_count})
                  </h4>
                  {whoHasWhatData.assigned_users?.length === 0 ? (
                    <div style={{ padding: '14px', backgroundColor: '#f8fafc', color: '#64748b', borderRadius: '6px', fontSize: '0.85rem' }}>
                      ℹ️ No users are currently assigned the roles that hold this permission.
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                      <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                            <th style={{ padding: '10px 14px' }}>User Email</th>
                            <th style={{ padding: '10px 14px' }}>Role</th>
                            <th style={{ padding: '10px 14px' }}>Scope / Tenant</th>
                            <th style={{ padding: '10px 14px' }}>User Status</th>
                            <th style={{ padding: '10px 14px' }}>Assignment Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {whoHasWhatData.assigned_users?.map((u) => (
                            <tr key={`${u.user_id}-${u.role_id}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '10px 14px', fontWeight: '500', color: '#1e293b' }}>
                                {u.email || <span style={{ color: '#94a3b8' }}>ID: {u.user_id.slice(0, 8)}...</span>}
                              </td>
                              <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>
                                {u.role_code}
                              </td>
                              <td style={{ padding: '10px 14px' }}>
                                {u.scope === 'PLATFORM' ? (
                                  <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>
                                    Platform Operator
                                  </span>
                                ) : (
                                  <div>
                                    <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                                      {u.college_name || 'College Tenant'}
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '10px 14px' }}>
                                <span
                                  className={`badge ${
                                    u.user_status === 'ACTIVE'
                                      ? 'badge-success'
                                      : 'badge-secondary'
                                  }`}
                                  style={{ fontSize: '0.7rem' }}
                                >
                                  {u.user_status}
                                </span>
                              </td>
                              <td style={{ padding: '10px 14px' }}>
                                <span
                                  className={`badge ${
                                    u.assignment_status === 'ACTIVE'
                                      ? 'badge-success'
                                      : 'badge-warning'
                                  }`}
                                  style={{ fontSize: '0.7rem' }}
                                >
                                  {u.assignment_status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {selectedPermission && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedPermission(null);
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '650px',
              padding: '24px',
              backgroundColor: '#fff',
              borderRadius: '8px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold' }}>
                  Permission Detail
                </h3>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px', fontFamily: 'monospace' }}>
                  {selectedPermission.permission_code}
                </div>
              </div>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setSelectedPermission(null)}
              >
                ✕ Close
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: '#64748b' }}>Module:</span>
                <div style={{ fontWeight: 'bold' }}>{selectedPermission.module_name} ({selectedPermission.module_code})</div>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Scope Type:</span>
                <div>
                  <span className={`badge ${selectedPermission.scope_type === 'PLATFORM' ? 'badge-primary' : 'badge-info'}`}>
                    {selectedPermission.scope_type}
                  </span>
                </div>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ color: '#64748b' }}>Description:</span>
                <div style={{ marginTop: '2px', color: '#1e293b' }}>
                  {selectedPermission.description || 'No description provided.'}
                </div>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Orphan Status:</span>
                <div>
                  {selectedPermission.is_orphan ? (
                    <span className="badge badge-warning">Unmapped in DB (0 Roles)</span>
                  ) : (
                    <span className="badge badge-success">Mapped to {selectedPermission.mapped_roles_count} Roles</span>
                  )}
                </div>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Created At:</span>
                <div>{new Date(selectedPermission.created_at).toLocaleString()}</div>
              </div>
            </div>

            {/* Mapped Roles in Detail */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '8px' }}>
                Mapped Roles:
              </div>
              {detailLoading ? (
                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Loading mapped roles...</div>
              ) : selectedPermission.mapped_roles?.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {selectedPermission.mapped_roles.map((r) => (
                    <span key={r.role_id} className="badge badge-secondary" style={{ fontSize: '0.8rem' }}>
                      {r.role_code}
                    </span>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '0.85rem', color: '#b45309', backgroundColor: '#fffbeb', padding: '8px 12px', borderRadius: '4px' }}>
                  No roles currently map this permission.
                </div>
              )}
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  const perm = selectedPermission;
                  setSelectedPermission(null);
                  handleOpenWhoHasWhat(perm);
                }}
              >
                👥 View Who Has What
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
