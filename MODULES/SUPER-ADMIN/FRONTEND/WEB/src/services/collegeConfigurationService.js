import api from './api';
import { fetchCollegeById, updateCollege } from './collegeService';

/**
 * Fetch canonical college tenant details.
 * @param {string} collegeId
 * @param {AbortSignal} [signal]
 * @returns {Promise<Object>}
 */
export async function fetchCollege(collegeId, signal) {
  return fetchCollegeById(collegeId, signal);
}

/**
 * Update college identity/profile fields owned by College Management.
 * @param {string} collegeId
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
export async function updateCollegeProfile(collegeId, payload) {
  return updateCollege(collegeId, payload);
}

/**
 * Fetch resolved effective configuration for a college.
 * @param {string} collegeId
 * @param {Object} [options]
 * @param {string} [options.category]
 * @param {boolean} [options.includeSensitive]
 * @param {number} [options.limit]
 * @param {number} [options.offset]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ settings: Array, total: number, limit: number, offset: number }>}
 */
export async function fetchEffectiveSettings(collegeId, options = {}) {
  const params = {};
  if (options.category && options.category !== 'ALL') {
    params.category = options.category;
  }
  if (options.includeSensitive) {
    params.include_sensitive = 'true';
  }
  if (options.limit) params.limit = options.limit;
  if (options.offset !== undefined) params.offset = options.offset;

  const res = await api.get(`/super-admin/colleges/${collegeId}/settings`, {
    params,
    signal: options.signal,
  });

  return {
    settings: res.data?.settings || [],
    total: res.data?.total || 0,
    limit: res.data?.limit || 50,
    offset: res.data?.offset || 0,
  };
}

/**
 * Fetch supported configuration definitions catalog.
 * @param {string} collegeId
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array>} List of setting definitions
 */
export async function fetchSettingDefinitions(collegeId, signal) {
  try {
    const res = await api.get(`/super-admin/colleges/${collegeId}/settings/definitions`, { signal });
    return res.data?.definitions || [];
  } catch (err) {
    if (err?.name === 'CanceledError' || err?.isCanceled) throw err;
    console.warn('Could not fetch setting definitions catalog:', err?.message);
    return [];
  }
}

/**
 * Fetch comparisons between college settings and global defaults.
 * @param {string} collegeId
 * @param {Object} [options]
 * @param {boolean} [options.includeSensitive]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<Array>}
 */
export async function fetchSettingComparisons(collegeId, options = {}) {
  const params = {};
  if (options.includeSensitive) {
    params.include_sensitive = 'true';
  }
  const res = await api.get(`/super-admin/colleges/${collegeId}/settings/compare`, {
    params,
    signal: options.signal,
  });
  return res.data?.comparisons || [];
}

/**
 * Fetch paginated audit history changelog for college settings.
 * @param {string} collegeId
 * @param {Object} [options]
 * @param {string} [options.key]
 * @param {number} [options.limit]
 * @param {number} [options.offset]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ history: Array, total: number }>}
 */
export async function fetchSettingHistory(collegeId, options = {}) {
  const params = {
    limit: options.limit || 20,
    offset: options.offset || 0,
  };
  if (options.key && options.key.trim()) {
    params.key = options.key.trim();
  }

  const res = await api.get(`/super-admin/colleges/${collegeId}/settings/history`, {
    params,
    signal: options.signal,
  });

  return {
    history: res.data?.history || [],
    total: res.data?.total || 0,
  };
}

/**
 * Fetch an individual configuration setting by key.
 * @param {string} collegeId
 * @param {string} key
 * @param {Object} [options]
 * @param {boolean} [options.includeSensitive]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<Object>}
 */
export async function fetchSettingByKey(collegeId, key, options = {}) {
  const params = {};
  if (options.includeSensitive) {
    params.include_sensitive = 'true';
  }
  const res = await api.get(`/super-admin/colleges/${collegeId}/settings/${key}`, {
    params,
    signal: options.signal,
  });
  return res.data?.setting;
}

/**
 * Update or override a college configuration setting.
 * @param {string} collegeId
 * @param {string} key
 * @param {Object} payload
 * @param {*} payload.setting_value
 * @param {string} [payload.reason]
 * @returns {Promise<Object>}
 */
export async function updateCollegeSetting(collegeId, key, payload) {
  const res = await api.put(`/super-admin/colleges/${collegeId}/settings/${key}`, payload);
  return res.data?.setting;
}

/**
 * Reset an overridden college configuration setting to its inherited global default.
 * @param {string} collegeId
 * @param {string} key
 * @param {string} reason
 * @returns {Promise<Object>}
 */
export async function resetCollegeSetting(collegeId, key, reason) {
  const res = await api.post(`/super-admin/colleges/${collegeId}/settings/${key}/reset`, {
    reason,
  });
  return res.data?.setting;
}

/**
 * Revert a college configuration setting to a historical audit log version.
 * @param {string} collegeId
 * @param {string} key
 * @param {Object} payload
 * @param {string} payload.auditId - UUID of the historical audit entry
 * @param {string} payload.reason - Reason for rollback
 * @returns {Promise<Object>}
 */
export async function revertCollegeSetting(collegeId, key, { auditId, reason }) {
  const res = await api.post(`/super-admin/colleges/${collegeId}/settings/${key}/revert`, {
    audit_id: auditId,
    reason,
  });
  return res.data?.setting;
}

/**
 * Fetch pending approval requests for this college.
 * @param {string} collegeId
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array>}
 */
export async function fetchPendingApprovals(collegeId, signal) {
  try {
    const res = await api.get('/super-admin/approvals', {
      params: {
        college_id: collegeId,
        status: 'PENDING',
      },
      signal,
    });
    return res.data?.approval_requests || [];
  } catch (err) {
    if (err?.name === 'CanceledError' || err?.isCanceled) throw err;
    console.warn('Could not fetch pending approvals:', err?.message);
    return [];
  }
}

/**
 * Submit a critical configuration change for approval via the platform approval workflow.
 * @param {Object} payload
 * @param {string} payload.college_id
 * @param {string} payload.operation_type
 * @param {Object} payload.payload
 * @param {string} payload.reason
 * @returns {Promise<Object>}
 */
export async function submitConfigurationApproval(payload) {
  const res = await api.post('/super-admin/approvals', {
    operation_type: payload.operation_type || 'COLLEGE_SETTING_OVERRIDE',
    college_id: payload.college_id,
    payload: payload.payload,
    reason: payload.reason,
  });
  return res.data?.request || res.data;
}
