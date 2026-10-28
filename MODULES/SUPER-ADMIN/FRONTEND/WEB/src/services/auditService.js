import api from './api';

/**
 * Search and filter platform audit records.
 * @param {Object} [params]
 * @param {string} [params.query]
 * @param {string} [params.college_id]
 * @param {string} [params.actor_user_id]
 * @param {string} [params.actor_role]
 * @param {string} [params.module]
 * @param {string} [params.action]
 * @param {string} [params.entity_type]
 * @param {string} [params.severity]
 * @param {string} [params.result_status]
 * @param {string} [params.ticket_reference]
 * @param {string} [params.correlation_id]
 * @param {string} [params.start_date]
 * @param {string} [params.end_date]
 * @param {number} [params.limit=50]
 * @param {number} [params.offset=0]
 * @returns {Promise<{ records: Array, total: number, limit: number, offset: number }>}
 */
export async function fetchAuditLogs(params = {}) {
  const res = await api.get('/super-admin/audit-logs', { params });
  return res.data;
}

/**
 * Retrieve full details and before/after difference for an audit log event.
 * @param {string} id
 * @returns {Promise<{ record: Object }>}
 */
export async function fetchAuditLogDetail(id) {
  const res = await api.get(`/super-admin/audit-logs/${encodeURIComponent(id)}`);
  return res.data;
}

/**
 * Verify cryptographic hash chain tamper evidence.
 * @param {number} [limit=100]
 * @returns {Promise<{ integrity_report: Object }>}
 */
export async function verifyAuditIntegrity(limit = 100) {
  const res = await api.post('/super-admin/audit-logs/verify-integrity', null, {
    params: { limit },
  });
  return res.data;
}

/**
 * Request bulk export of audit logs requiring peer approval.
 * @param {Object} payload
 * @param {Object} payload.filters
 * @param {string} payload.reason
 * @returns {Promise<{ message: string, export_request: Object }>}
 */
export async function requestAuditExport(payload) {
  const res = await api.post('/super-admin/audit-logs/exports', payload);
  return res.data;
}

/**
 * List pending or past audit export requests.
 * @param {string} [status] - 'PENDING' | 'APPROVED' | 'REJECTED'
 * @returns {Promise<{ export_requests: Array, total: number }>}
 */
export async function fetchAuditExportRequests(status = '') {
  const params = status ? { status } : {};
  const res = await api.get('/super-admin/audit-logs/exports', { params });
  return res.data;
}

/**
 * Process approval or rejection decision on an export request.
 * @param {string} id
 * @param {Object} payload
 * @param {string} payload.decision - 'APPROVED' | 'REJECTED'
 * @param {string} payload.reason
 * @returns {Promise<{ message: string, decision: string }>}
 */
export async function processAuditExportDecision(id, payload) {
  const res = await api.post(`/super-admin/audit-logs/exports/${encodeURIComponent(id)}/decision`, payload);
  return res.data;
}
