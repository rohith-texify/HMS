import api from './api';

/**
 * Fetch paginated colleges list with optional status and search filter.
 * @param {Object} options
 * @param {string} [options.search]
 * @param {string} [options.status]
 * @param {number} [options.limit=20]
 * @param {number} [options.offset=0]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ colleges: Array, meta: Object }>}
 */
export async function fetchCollegesList({ search, status, limit = 20, offset = 0, signal } = {}) {
  const params = { limit, offset };
  if (status && status !== 'ALL') {
    params.status = status;
  }
  if (search && search.trim()) {
    params.search = search.trim();
  }

  const res = await api.get('/super-admin/colleges', { params, signal });
  return {
    colleges: res.data?.colleges || [],
    meta: res.meta || {
      total: res.data?.colleges?.length || 0,
      limit,
      offset,
    },
  };
}

/**
 * Fetch a single college by its UUID.
 * @param {string} collegeId
 * @param {AbortSignal} [signal]
 * @returns {Promise<Object>} College details
 */
export async function fetchCollegeById(collegeId, signal) {
  const res = await api.get(`/super-admin/colleges/${collegeId}`, { signal });
  return res.data?.college;
}

/**
 * Fetch onboarding steps for a college.
 * @param {string} collegeId
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array>} Checklist steps
 */
export async function fetchCollegeOnboarding(collegeId, signal) {
  const res = await api.get(`/super-admin/colleges/${collegeId}/onboarding`, { signal });
  return res.data?.steps || [];
}

/**
 * Create a new college tenant in ONBOARDING status.
 * @param {Object} payload
 * @returns {Promise<Object>} Created college
 */
export async function createCollege(payload) {
  const res = await api.post('/super-admin/colleges', payload);
  const college = res.data?.college;
  if (college && res.data?.admin) {
    college.admin = res.data.admin;
  }
  return college;
}

/**
 * Fetch administrator account details for a college.
 * @param {string} collegeId
 * @param {AbortSignal} [signal]
 * @returns {Promise<Object|null>} College admin account details
 */
export async function fetchCollegeAdmin(collegeId, signal) {
  try {
    const res = await api.get(`/super-admin/colleges/${collegeId}/admin`, { signal });
    return res.data?.admin || null;
  } catch (err) {
    if (err.status === 404 || err.code === 'NOT_FOUND') {
      return null;
    }
    throw err;
  }
}

/**
 * Update or reset the college administrator's password.
 * @param {string} collegeId
 * @param {Object} payload
 * @param {string} payload.password
 * @param {string} [payload.admin_email]
 * @returns {Promise<Object>} Updated admin account
 */
export async function updateCollegeAdminPassword(collegeId, payload) {
  const res = await api.put(`/super-admin/colleges/${collegeId}/admin/password`, payload);
  return res.data?.admin;
}

/**
 * Update college profile details.
 * @param {string} collegeId
 * @param {Object} payload
 * @returns {Promise<Object>} Updated college
 */
export async function updateCollege(collegeId, payload) {
  const res = await api.put(`/super-admin/colleges/${collegeId}`, payload);
  return res.data?.college;
}

/**
 * Update college lifecycle status.
 * @param {string} collegeId
 * @param {Object} payload
 * @param {string} payload.status - ONBOARDING, ACTIVE, SUSPENDED, DEACTIVATED
 * @param {string} payload.reason - Mandatory lifecycle reason
 * @returns {Promise<Object>} Updated college
 */
export async function updateCollegeStatus(collegeId, { status, reason }) {
  const res = await api.put(`/super-admin/colleges/${collegeId}/status`, {
    status,
    reason,
    lifecycle_reason: reason,
  });
  return res.data?.college;
}

/**
 * Submit a maker-checker approval request for college status change.
 * @param {Object} params
 * @param {string} params.college_id
 * @param {string} params.status
 * @param {string} params.reason
 * @returns {Promise<Object>} Approval request
 */
export async function createStatusApprovalRequest({ college_id, status, reason }) {
  const res = await api.post('/super-admin/approvals', {
    operation_type: 'COLLEGE_STATUS_UPDATE',
    college_id,
    payload: {
      status,
      reason,
      college_id,
    },
    reason,
    steps: [
      {
        step_order: 1,
      },
    ],
  });
  return res.data;
}

/**
 * Fetch all administrators for a specific college with optional status and pagination.
 * @param {string} collegeId
 * @param {Object} [options]
 * @param {string} [options.status]
 * @param {number} [options.limit=20]
 * @param {number} [options.offset=0]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ college_id: string, admins: Array, total: number, limit: number, offset: number }>}
 */
export async function fetchCollegeAdmins(collegeId, { status, limit = 20, offset = 0, signal } = {}) {
  const params = { limit, offset };
  if (status && status !== 'ALL') {
    params.status = status;
  }
  const res = await api.get(`/super-admin/colleges/${collegeId}/admins`, { params, signal });
  return {
    college_id: res.data?.college_id || collegeId,
    admins: res.data?.admins || [],
    total: res.data?.total || 0,
    limit: res.data?.limit || limit,
    offset: res.data?.offset || offset,
  };
}

/**
 * Provision the initial administrator account for a college.
 * @param {string} collegeId
 * @param {Object} payload
 * @param {string} payload.email
 * @param {string} [payload.phone]
 * @param {string} payload.password
 * @returns {Promise<Object>} Created admin account
 */
export async function provisionFirstCollegeAdmin(collegeId, payload) {
  const res = await api.post(`/super-admin/colleges/${collegeId}/admins/first`, payload);
  return res.data?.admin;
}

/**
 * Update permitted profile fields of a college administrator account.
 * @param {string} collegeId
 * @param {string} adminId
 * @param {Object} payload
 * @param {string} [payload.phone]
 * @returns {Promise<Object>} Updated admin account
 */
export async function updateCollegeAdminProfile(collegeId, adminId, payload) {
  const res = await api.patch(`/super-admin/colleges/${collegeId}/admins/${adminId}`, payload);
  return res.data?.admin;
}

/**
 * Update administrator status (ACTIVE, SUSPENDED, DEACTIVATED).
 * @param {string} collegeId
 * @param {string} adminId
 * @param {Object} payload
 * @param {string} payload.status
 * @param {string} payload.reason
 * @returns {Promise<Object>} Updated admin account
 */
export async function updateCollegeAdminStatus(collegeId, adminId, { status, reason }) {
  const res = await api.put(`/super-admin/colleges/${collegeId}/admins/${adminId}/status`, {
    status,
    reason,
  });
  return res.data?.admin;
}

/**
 * Unlock a locked administrator account.
 * @param {string} collegeId
 * @param {string} adminId
 * @returns {Promise<Object>} Unlocked admin account
 */
export async function unlockCollegeAdmin(collegeId, adminId) {
  const res = await api.post(`/super-admin/colleges/${collegeId}/admins/${adminId}/unlock`);
  return res.data?.admin;
}

/**
 * Invalidate push notification device tokens for an administrator account.
 * Note: Stateless JWT access tokens will remain valid until natural expiration.
 * @param {string} collegeId
 * @param {string} adminId
 * @returns {Promise<Object>} Revocation result
 */
export async function revokeCollegeAdminDeviceTokens(collegeId, adminId) {
  const res = await api.post(`/super-admin/colleges/${collegeId}/admins/${adminId}/revoke-sessions`);
  return res.data;
}

/**
 * Fetch authentication history from platform.login_events for an administrator.
 * @param {string} collegeId
 * @param {string} adminId
 * @param {number} [limit=20]
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ college_id: string, admin_id: string, events: Array, total: number }>}
 */
export async function fetchCollegeAdminLoginHistory(collegeId, adminId, limit = 20, signal) {
  const res = await api.get(`/super-admin/colleges/${collegeId}/admins/${adminId}/login-history`, {
    params: { limit },
    signal,
  });
  return {
    college_id: res.data?.college_id || collegeId,
    admin_id: res.data?.admin_id || adminId,
    events: res.data?.events || [],
    total: res.data?.total || 0,
  };
}
