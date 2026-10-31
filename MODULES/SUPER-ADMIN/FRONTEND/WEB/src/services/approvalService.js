import api from './api';

/**
 * Fetch approval requests with optional filtering.
 * @param {Object} params
 * @param {string} [params.status] - 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED' | 'EXECUTED'
 * @param {string} [params.college_id]
 * @param {string} [params.requested_by]
 * @param {boolean} [params.inbox] - When true, filters for requests actionable by current user excluding own requests
 * @param {number} [params.limit=20]
 * @param {number} [params.offset=0]
 */
export async function fetchApprovalRequests(params = {}) {
  try {
    const res = await api.get('/super-admin/approvals', { params, timeout: 1800 });
    return res.data || { requests: [], total: 0 };
  } catch (err) {
    return { requests: [], total: 0 };
  }
}

/**
 * Fetch a single approval request with its decision steps.
 * @param {string} requestId
 */
export async function fetchApprovalRequest(requestId) {
  const res = await api.get(`/super-admin/approvals/${encodeURIComponent(requestId)}`);
  return res.data;
}

/**
 * Submit an approval decision (APPROVE or REJECT) on a step.
 * @param {string} stepId
 * @param {Object} payload
 * @param {string} payload.decision - 'APPROVED' | 'REJECTED'
 * @param {string} [payload.comment]
 * @param {string} [payload.reason]
 */
export async function processApprovalDecision(stepId, payload) {
  const res = await api.post(`/super-admin/approvals/steps/${encodeURIComponent(stepId)}/decision`, payload);
  return res.data;
}

/**
 * Explicitly execute an approved request.
 * @param {string} requestId
 */
export async function executeApprovalRequest(requestId) {
  const res = await api.post(`/super-admin/approvals/${encodeURIComponent(requestId)}/execute`);
  return res.data;
}

/**
 * Cancel or withdraw a pending approval request.
 * @param {string} requestId
 * @param {string} reason
 */
export async function cancelApprovalRequest(requestId, reason) {
  const res = await api.post(`/super-admin/approvals/${encodeURIComponent(requestId)}/cancel`, { reason });
  return res.data;
}
