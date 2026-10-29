import api from './api';

/**
 * Fetch configuration change sets with optional filtering.
 * @param {Object} params
 * @param {string} [params.status]
 * @param {string} [params.category]
 * @param {string} [params.college_id]
 * @param {number} [params.limit=50]
 * @param {number} [params.offset=0]
 */
export async function fetchChangeSets(params = {}) {
  const res = await api.get('/super-admin/change-sets', { params });
  return res.data;
}

/**
 * Fetch single change set details along with before/after granular diff.
 * @param {string} changeSetId
 */
export async function fetchChangeSet(changeSetId) {
  const res = await api.get(`/super-admin/change-sets/${encodeURIComponent(changeSetId)}`);
  return res.data;
}

/**
 * Propose a new configuration or entitlement change set.
 * @param {Object} payload
 */
export async function proposeChangeSet(payload) {
  const res = await api.post('/super-admin/change-sets', payload);
  return res.data;
}

/**
 * Withdraw/cancel a pending change set.
 * @param {string} changeSetId
 * @param {string} reason
 */
export async function withdrawChangeSet(changeSetId, reason) {
  const res = await api.post(`/super-admin/change-sets/${encodeURIComponent(changeSetId)}/withdraw`, { reason });
  return res.data;
}

/**
 * Propose a configuration rollback to a historical audit log version.
 * @param {string} collegeId
 * @param {string} auditId
 * @param {string} reason
 */
export async function proposeRollback(collegeId, auditId, reason) {
  const res = await api.post(`/super-admin/change-sets/rollback?college_id=${encodeURIComponent(collegeId)}`, {
    audit_id: auditId,
    reason,
  });
  return res.data;
}
