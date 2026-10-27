import api from './api';

/**
 * Fetch a paginated and filtered list of roles.
 * @param {Object} [options]
 * @param {string} [options.scope] - Filter by scope (COLLEGE, PLATFORM, ALL)
 * @param {boolean} [options.is_system_role] - Filter by system role status
 * @param {string} [options.search] - Search by code or name
 * @param {number} [options.limit=20]
 * @param {number} [options.offset=0]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ roles: Array, total: number, limit: number, offset: number }>}
 */
export async function fetchRolesList({
  scope,
  is_system_role,
  search,
  limit = 20,
  offset = 0,
  signal,
} = {}) {
  const params = { limit, offset };
  if (scope && scope !== 'ALL') {
    params.scope = scope;
  }
  if (typeof is_system_role === 'boolean') {
    params.is_system_role = is_system_role;
  }
  if (search && search.trim()) {
    params.search = search.trim();
  }

  const res = await api.get('/super-admin/roles', { params, signal });
  return {
    roles: res.data?.roles || [],
    total: res.data?.total || 0,
    limit: res.data?.limit || limit,
    offset: res.data?.offset || offset,
  };
}

/**
 * Fetch single role details including mapped permissions.
 * @param {string} roleId
 * @param {AbortSignal} [signal]
 * @returns {Promise<Object>} Role detail object
 */
export async function fetchRoleById(roleId, signal) {
  const res = await api.get(`/super-admin/roles/${roleId}`, { signal });
  return res.data?.role;
}

/**
 * Fetch the complete atomic permission catalog.
 * @param {string} [scopeType] - Optional scope filter (COLLEGE, PLATFORM, GLOBAL, ALL)
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ permissions: Array, total: number }>}
 */
export async function fetchPermissionsCatalog(scopeType, signal) {
  const params = {};
  if (scopeType && scopeType !== 'ALL') {
    params.scope_type = scopeType;
  }
  const res = await api.get('/super-admin/roles/permissions', { params, signal });
  return {
    permissions: res.data?.permissions || [],
    total: res.data?.total || 0,
  };
}

/**
 * Create a new custom role.
 * @param {Object} payload
 * @param {string} payload.role_code
 * @param {string} payload.role_name
 * @param {string} payload.scope
 * @param {string[]} [payload.permission_ids]
 * @returns {Promise<Object>} Created role details
 */
export async function createCustomRole(payload) {
  const res = await api.post('/super-admin/roles', payload);
  return res.data?.role;
}

/**
 * Clone an existing role into a new custom role.
 * @param {string} roleId
 * @param {Object} payload
 * @param {string} payload.new_role_code
 * @param {string} payload.new_role_name
 * @param {boolean} [payload.include_permissions=true]
 * @returns {Promise<Object>} Cloned role details
 */
export async function cloneRole(roleId, payload) {
  const res = await api.post(`/super-admin/roles/${roleId}/clone`, payload);
  return res.data?.role;
}

/**
 * Update custom role metadata (role_name).
 * @param {string} roleId
 * @param {Object} payload
 * @param {string} payload.role_name
 * @returns {Promise<Object>} Updated role
 */
export async function updateCustomRole(roleId, payload) {
  const res = await api.put(`/super-admin/roles/${roleId}`, payload);
  return res.data?.role;
}

/**
 * Update mapped permissions for a custom role.
 * @param {string} roleId
 * @param {Object} payload
 * @param {string[]} payload.permission_ids
 * @param {string} payload.reason
 * @returns {Promise<Object>} Updated role details
 */
export async function updateRolePermissions(roleId, payload) {
  const res = await api.put(`/super-admin/roles/${roleId}/permissions`, payload);
  return res.data?.role;
}

/**
 * Delete an unused custom role.
 * @param {string} roleId
 * @returns {Promise<Object>}
 */
export async function deleteCustomRole(roleId) {
  const res = await api.delete(`/super-admin/roles/${roleId}`);
  return res.data;
}

/**
 * Fetch role template advisory status.
 * @param {AbortSignal} [signal]
 * @returns {Promise<Object>}
 */
export async function fetchRoleTemplates(signal) {
  const res = await api.get('/super-admin/roles/templates', { signal });
  return res.data;
}
