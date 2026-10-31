import api from './api';

/**
 * Fetch the authoritative platform module catalogue.
 * @param {Object} [params]
 * @param {AbortSignal} [signal]
 * @returns {Promise<Object>}
 */
export async function fetchModuleCatalogue(params = {}, signal) {
  const query = new URLSearchParams();
  if (params.kind) query.set('kind', params.kind);
  if (params.is_active !== undefined) query.set('is_active', params.is_active);
  if (params.limit) query.set('limit', params.limit);
  if (params.offset) query.set('offset', params.offset);

  const queryString = query.toString();
  const url = `/super-admin/modules${queryString ? `?${queryString}` : ''}`;
  try {
    const res = await api.get(url, { signal, timeout: 5000 });
    return {
      modules: res.data?.modules || [],
      meta: res.meta || {},
    };
  } catch (err) {
    if (err?.name === 'CanceledError' || err?.isCanceled || signal?.aborted) {
      throw err;
    }
    return {
      modules: [],
      meta: {},
    };
  }
}

/**
 * Fetch the college module entitlement matrix with effective state and workflow analysis.
 * @param {string} collegeId
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array>}
 */
export async function fetchCollegeEntitlementMatrix(collegeId, signal) {
  if (!collegeId) {
    throw new Error('College ID is required to fetch entitlement matrix');
  }
  const res = await api.get(`/super-admin/colleges/${collegeId}/entitlements/matrix`, { signal });
  return res.data?.matrix || [];
}

/**
 * Preview the impact of modifying or disabling a module entitlement.
 * @param {string} collegeId
 * @param {string} moduleId
 * @param {Object} payload { status, mode }
 * @param {AbortSignal} [signal]
 * @returns {Promise<Object>}
 */
export async function previewModuleImpact(collegeId, moduleId, payload, signal) {
  if (!collegeId || !moduleId) {
    throw new Error('College ID and Module ID are required for impact preview');
  }
  const res = await api.post(
    `/super-admin/colleges/${collegeId}/modules/${moduleId}/preview`,
    payload,
    { signal }
  );
  return res.data?.preview;
}

/**
 * Request an entitlement state change (immediate or via maker-checker approval).
 * @param {string} collegeId
 * @param {string} moduleId
 * @param {Object} payload { status, mode, reason, effective_from, effective_to, request_approval }
 * @returns {Promise<Object>}
 */
export async function requestModuleEntitlementChange(collegeId, moduleId, payload) {
  if (!collegeId || !moduleId) {
    throw new Error('College ID and Module ID are required for entitlement change');
  }
  const res = await api.post(
    `/super-admin/colleges/${collegeId}/modules/${moduleId}/change`,
    payload
  );
  return res;
}

/**
 * Fetch immutable module audit history.
 * @param {string} [collegeId]
 * @param {string} [moduleId]
 * @param {number} [limit=20]
 * @param {number} [offset=0]
 * @param {AbortSignal} [signal]
 * @returns {Promise<Object>}
 */
export async function fetchModuleHistory(collegeId, moduleId, limit = 20, offset = 0, signal) {
  const query = new URLSearchParams();
  if (collegeId) query.set('college_id', collegeId);
  if (moduleId) query.set('module_id', moduleId);
  query.set('limit', limit);
  query.set('offset', offset);

  const url = collegeId
    ? `/super-admin/colleges/${collegeId}/modules/history?${query.toString()}`
    : `/super-admin/modules/history?${query.toString()}`;

  const res = await api.get(url, { signal });
  return {
    history: res.data?.history || [],
    meta: res.meta || {},
  };
}

/**
 * Fetch entitlement templates from the backend.
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array>}
 */
export async function fetchEntitlementTemplates(signal) {
  const res = await api.get('/super-admin/entitlement-templates', { signal });
  return res.data?.templates || [];
}

/**
 * Apply entitlement template to college.
 * Note: backend returns validation error explaining the schema limitation if mapping table is absent.
 * @param {string} templateId
 * @param {string} collegeId
 * @returns {Promise<Object>}
 */
export async function applyTemplateToCollege(templateId, collegeId) {
  if (!templateId || !collegeId) {
    throw new Error('Template ID and College ID are required');
  }
  return await api.post(`/super-admin/entitlement-templates/${templateId}/apply/${collegeId}`);
}
