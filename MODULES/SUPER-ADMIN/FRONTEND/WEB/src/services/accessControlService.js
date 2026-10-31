import api from './api';

/**
 * Fetch hierarchical access control matrix for a college tenant.
 * @param {string} collegeId
 * @param {AbortSignal} [signal]
 * @returns {Promise<Object>}
 */
export async function fetchAccessMatrix(collegeId, signal) {
  try {
    const res = await api.get(`/super-admin/colleges/${collegeId}/access-control/matrix`, { signal, timeout: 1800 });
    return res.data || { matrix: [], applications: [] };
  } catch (err) {
    return { matrix: [], applications: [] };
  }
}

/**
 * Update college feature / module entitlement configuration.
 * @param {string} collegeId
 * @param {string} moduleId
 * @param {Object} payload
 * @param {string} payload.status - 'ACTIVE' | 'DISABLED' | 'SCHEDULED'
 * @param {string} payload.mode - 'FULL' | 'READ_ONLY'
 * @param {string} [payload.effective_from]
 * @param {string} [payload.effective_to]
 * @param {string} payload.reason
 * @returns {Promise<Object>}
 */
export async function updateFeatureAccess(collegeId, moduleId, payload) {
  const res = await api.put(
    `/super-admin/colleges/${collegeId}/access-control/features/${moduleId}`,
    payload
  );
  return res.data;
}

/**
 * Evaluate effective access outcome and diagnose denial reason.
 * @param {Object} payload
 * @param {string} [payload.college_id]
 * @param {string} [payload.module_id]
 * @param {string} [payload.module_code]
 * @param {string} payload.action
 * @param {string} [payload.http_method]
 * @param {string} [payload.user_id]
 * @param {string} [collegeId] - Optional college ID to use in URL path
 * @param {AbortSignal} [signal]
 * @returns {Promise<Object>}
 */
export async function evaluateAccessOutcome(payload, collegeId = null, signal = null) {
  const url = collegeId
    ? `/super-admin/colleges/${collegeId}/access-control/evaluate`
    : '/super-admin/access-control/evaluate';
  const res = await api.post(url, payload, { signal });
  return res.data;
}
