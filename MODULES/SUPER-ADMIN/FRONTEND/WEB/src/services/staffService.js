import api from './api';

/**
 * Fetch paginated list of company / platform staff accounts.
 * @param {Object} [options]
 * @param {string} [options.status] - Filter by status (ACTIVE, LOCKED, SUSPENDED, DEACTIVATED, INVITED)
 * @param {number} [options.limit=20]
 * @param {number} [options.offset=0]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ staff: Array, total: number, limit: number, offset: number }>}
 */
export async function fetchPlatformStaffList({ status, limit = 20, offset = 0, signal } = {}) {
  const params = { limit, offset };
  if (status && status !== 'ALL') {
    params.status = status;
  }
  const res = await api.get('/super-admin/staff', { params, signal });
  return {
    staff: res.data?.staff || [],
    total: res.data?.total || 0,
    limit: res.data?.limit || limit,
    offset: res.data?.offset || offset,
  };
}

/**
 * Fetch details for a single platform staff member.
 * @param {string} userId
 * @param {AbortSignal} [signal]
 * @returns {Promise<Object>} Platform staff details
 */
export async function fetchPlatformStaffById(userId, signal) {
  const res = await api.get(`/super-admin/staff/${userId}`, { signal });
  return res.data?.staff;
}

/**
 * Update permitted profile fields for a platform staff member (allowlist: phone).
 * @param {string} userId
 * @param {Object} payload
 * @param {string} [payload.phone]
 * @returns {Promise<Object>} Updated staff record
 */
export async function updatePlatformStaffProfile(userId, payload) {
  const res = await api.patch(`/super-admin/staff/${userId}`, payload);
  return res.data?.staff;
}

/**
 * Update platform staff account status (ACTIVE, SUSPENDED, DEACTIVATED).
 * @param {string} userId
 * @param {Object} payload
 * @param {string} payload.status
 * @param {string} payload.reason
 * @returns {Promise<Object>} Updated staff record
 */
export async function updatePlatformStaffStatus(userId, { status, reason }) {
  const res = await api.put(`/super-admin/staff/${userId}/status`, {
    status,
    reason,
  });
  return res.data?.staff;
}

/**
 * Fetch pending approval requests assigned to this staff member (for offboarding review).
 * @param {string} userId
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ user_id: string, pending_approvals: Array, total_pending: number }>}
 */
export async function fetchStaffPendingApprovals(userId, signal) {
  const res = await api.get(`/super-admin/staff/${userId}/pending-approvals`, { signal });
  return {
    user_id: res.data?.user_id || userId,
    pending_approvals: res.data?.pending_approvals || [],
    total_pending: res.data?.total_pending || 0,
  };
}
