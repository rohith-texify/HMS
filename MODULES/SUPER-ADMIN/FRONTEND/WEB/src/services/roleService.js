import api from './api';

export const DEFAULT_ROLES = [
  { role_id: '54cd22f3-954e-4e10-9d5a-1d971a535422', role_code: 'SUPER_ADMIN', role_name: 'Super Administrator', scope: 'PLATFORM', is_system_role: true },
  { role_id: 'd9b1c7a2-4e5f-6a7b-8c9d-0e1f2a3b4c5d', role_code: 'COLLEGE_ADMIN', role_name: 'College Administrator', scope: 'COLLEGE', is_system_role: true },
  { role_id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', role_code: 'STUDENT', role_name: 'Student', scope: 'COLLEGE', is_system_role: true },
];

export const DEFAULT_PERMISSIONS = [
  { permission_id: 'p-1', permission_code: 'platform.view', description: 'View platform wide resources', module_code: 'PLATFORM', scope_type: 'PLATFORM' },
  { permission_id: 'p-2', permission_code: 'platform.manage', description: 'Manage platform operations', module_code: 'PLATFORM', scope_type: 'PLATFORM' },
  { permission_id: 'p-3', permission_code: 'colleges.view', description: 'View colleges catalog', module_code: 'COLLEGES', scope_type: 'GLOBAL' },
  { permission_id: 'p-4', permission_code: 'colleges.manage', description: 'Create and configure colleges', module_code: 'COLLEGES', scope_type: 'GLOBAL' },
  { permission_id: 'p-5', permission_code: 'hostel.view', description: 'View hostels, blocks, and rooms', module_code: 'HOSTEL_MGMT', scope_type: 'COLLEGE' },
  { permission_id: 'p-6', permission_code: 'hostel.manage', description: 'Manage room allocations and structure', module_code: 'HOSTEL_MGMT', scope_type: 'COLLEGE' },
  { permission_id: 'p-7', permission_code: 'students.view', description: 'View student directory and enrollments', module_code: 'STUDENTS', scope_type: 'COLLEGE' },
  { permission_id: 'p-8', permission_code: 'students.manage', description: 'Manage student records', module_code: 'STUDENTS', scope_type: 'COLLEGE' },
  { permission_id: 'p-9', permission_code: 'approvals.view', description: 'View pending approval workflows', module_code: 'APPROVALS', scope_type: 'GLOBAL' },
  { permission_id: 'p-10', permission_code: 'approvals.act', description: 'Approve or reject requests', module_code: 'APPROVALS', scope_type: 'GLOBAL' },
];

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

  try {
    const res = await api.get('/super-admin/roles', { params, signal, timeout: 8000 });
    return {
      roles: res.data?.roles || [],
      total: res.data?.total !== undefined ? res.data.total : (res.data?.roles?.length || 0),
      limit: res.data?.limit || limit,
      offset: res.data?.offset || offset,
    };
  } catch (err) {
    if (err?.name === 'CanceledError' || err?.isCanceled || signal?.aborted) {
      throw err;
    }
    return {
      roles: DEFAULT_ROLES,
      total: DEFAULT_ROLES.length,
      limit,
      offset,
    };
  }
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
  try {
    const res = await api.get('/super-admin/roles/permissions', { params, signal, timeout: 8000 });
    const list = res.data?.permissions || [];
    return {
      permissions: list.length > 0 ? list : DEFAULT_PERMISSIONS,
      total: list.length > 0 ? (res.data?.total || list.length) : DEFAULT_PERMISSIONS.length,
    };
  } catch (err) {
    if (err?.name === 'CanceledError' || err?.isCanceled || signal?.aborted) {
      throw err;
    }
    return {
      permissions: DEFAULT_PERMISSIONS,
      total: DEFAULT_PERMISSIONS.length,
    };
  }
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
