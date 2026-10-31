import api from './api';

/**
 * Fetch a paginated and filtered list of permissions with role mapping stats.
 * @param {Object} [options]
 * @param {string} [options.scope_type] - Filter by scope (COLLEGE, PLATFORM, GLOBAL, ALL)
 * @param {string} [options.module_code] - Filter by module code
 * @param {string} [options.search] - Search by code or description
 * @param {boolean} [options.is_orphan] - Filter by orphan status
 * @param {number} [options.limit=50]
 * @param {number} [options.offset=0]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ permissions: Array, total: number, limit: number, offset: number }>}
 */
export async function fetchPermissions({
  scope_type,
  module_code,
  search,
  is_orphan,
  limit = 50,
  offset = 0,
  signal,
} = {}) {
  const params = { limit, offset };
  if (scope_type && scope_type !== 'ALL') {
    params.scope_type = scope_type;
  }
  if (module_code && module_code !== 'ALL') {
    params.module_code = module_code;
  }
  if (search && search.trim()) {
    params.search = search.trim();
  }
  if (typeof is_orphan === 'boolean') {
    params.is_orphan = is_orphan;
  }

  try {
    const res = await api.get('/super-admin/permissions', { params, signal, timeout: 5000 });
    return {
      permissions: res.data?.permissions || [],
      total: res.data?.total !== undefined ? res.data.total : (res.data?.permissions?.length || 0),
      limit: res.data?.limit || limit,
      offset: res.data?.offset || offset,
    };
  } catch (err) {
    if (err?.name === 'CanceledError' || err?.isCanceled || signal?.aborted) {
      throw err;
    }
    return {
      permissions: [],
      total: 0,
      limit,
      offset,
    };
  }
}

/**
 * Fetch single permission details including mapped roles.
 * @param {string} permissionId
 * @param {AbortSignal} [signal]
 * @returns {Promise<Object>} Permission detail object
 */
export async function fetchPermissionById(permissionId, signal) {
  const res = await api.get(`/super-admin/permissions/${permissionId}`, { signal });
  return res.data?.permission;
}

/**
 * Fetch who-has-what view for a permission (mapped roles & assigned users).
 * @param {string} permissionId
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ permission: Object, mapped_roles: Array, assigned_users: Array, total_roles_count: number, total_users_count: number, scope_notice: string }>}
 */
export async function fetchPermissionWhoHasWhat(permissionId, signal) {
  const res = await api.get(`/super-admin/permissions/${permissionId}/who-has-what`, { signal });
  return res.data;
}

/**
 * Fetch orphan permissions audit report.
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ definition: string, notice: string, total_count: number, catalog_size: number, orphans: Array }>}
 */
export async function fetchOrphanPermissions(signal) {
  const res = await api.get('/super-admin/permissions/orphans', { signal });
  return res.data;
}

/**
 * Fetch permission deprecation lifecycle advisory status.
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ supported: boolean, status: string, reason: string, schema_blocker: string, blocked_capabilities: Array }>}
 */
export async function fetchDeprecationStatus(signal) {
  const res = await api.get('/super-admin/permissions/deprecation-status', { signal });
  return res.data;
}
