import api from './api';

/**
 * Fetch the onboarding pipeline list of colleges.
 * @param {Object|AbortSignal} [options] - Options or AbortSignal
 * @param {string} [options.search]
 * @param {number} [options.limit]
 * @param {number} [options.offset]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<Array>} List of colleges in onboarding
 */
export async function fetchOnboardingPipeline(options = {}) {
  const signal = options?.signal || (options instanceof AbortSignal ? options : undefined);
  const params = {};
  if (options && typeof options === 'object' && !(options instanceof AbortSignal)) {
    if (options.search) params.search = options.search;
    if (options.limit) params.limit = options.limit;
    if (options.offset) params.offset = options.offset;
  }
  try {
    const res = await api.get('/super-admin/onboarding', { params, signal, timeout: 8000 });
    return res.data?.colleges || [];
  } catch (err) {
    if (err?.name === 'CanceledError' || err?.isCanceled || signal?.aborted) {
      throw err;
    }
    return [];
  }
}

/**
 * Fetch comprehensive onboarding readiness verification report for a college.
 * @param {string} collegeId
 * @param {AbortSignal} [signal]
 * @returns {Promise<Object>} Readiness response with gates and checklist
 */
export async function fetchCollegeReadiness(collegeId, signal) {
  try {
    const res = await api.get(`/super-admin/colleges/${collegeId}/readiness`, { signal });
    return res.data;
  } catch (err) {
    if (err?.name === 'CanceledError' || err?.isCanceled) {
      throw err;
    }
    console.warn(`Could not load readiness report for college ${collegeId}:`, err?.message || err);
    return null;
  }
}

/**
 * Update an onboarding checklist step status and notes.
 * @param {string} collegeId
 * @param {string} stepCode
 * @param {Object} payload
 * @param {string} payload.status - PENDING, IN_PROGRESS, COMPLETED, SKIPPED, FAILED
 * @param {string} [payload.notes]
 * @returns {Promise<Object>} Updated step
 */
export async function updateOnboardingStep(collegeId, stepCode, payload) {
  const res = await api.patch(`/super-admin/colleges/${collegeId}/onboarding/${stepCode}`, payload);
  return res.data?.step || res.data;
}

/**
 * Fetch available entitlement templates catalog.
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array>} List of entitlement templates
 */
export async function fetchEntitlementTemplates(signal) {
  try {
    const res = await api.get('/super-admin/entitlement-templates', { signal });
    return res.data?.templates || [];
  } catch {
    return [];
  }
}

/**
 * Fetch assigned modules for a specific college.
 * @param {string} collegeId
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array>} List of college modules
 */
export async function fetchCollegeModules(collegeId, signal) {
  try {
    const res = await api.get(`/super-admin/colleges/${collegeId}/modules`, { signal });
    return res.data?.college_modules || res.data?.modules || [];
  } catch {
    return [];
  }
}

/**
 * Fetch platform module catalogue.
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array>} List of available platform modules
 */
export async function fetchPlatformModules(signal) {
  try {
    const res = await api.get('/super-admin/modules', { signal });
    return res.data?.modules || [];
  } catch {
    return [];
  }
}

/**
 * Assign a module to a college.
 * @param {string} collegeId
 * @param {Object} payload
 * @param {string} payload.module_id
 * @param {string} [payload.status] - ACTIVE, DISABLED, SCHEDULED
 * @param {string} [payload.mode] - FULL, READ_ONLY
 * @param {string} [payload.reason]
 * @returns {Promise<Object>} Assigned module
 */
export async function assignModuleToCollege(collegeId, payload) {
  const res = await api.post(`/super-admin/colleges/${collegeId}/modules`, {
    status: 'ACTIVE',
    mode: 'FULL',
    ...payload,
  });
  return res.data?.college_module || res.data?.module || res.data;
}

/**
 * Test tenant onboarding notification delivery channel.
 * @param {string} collegeId
 * @returns {Promise<Object>} Notification test result
 */
export async function testCollegeNotification(collegeId) {
  const res = await api.post(`/super-admin/colleges/${collegeId}/test-notification`);
  return res.data;
}

/**
 * Fetch configured settings for a college.
 * @param {string} collegeId
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array>} List of college settings
 */
export async function fetchCollegeSettings(collegeId, signal) {
  try {
    const res = await api.get(`/super-admin/colleges/${collegeId}/settings`, { signal });
    return res.data?.settings || [];
  } catch {
    return [];
  }
}

/**
 * Update a setting key for a college.
 * @param {string} collegeId
 * @param {string} key
 * @param {*} value
 * @returns {Promise<Object>} Updated setting
 */
export async function updateCollegeSetting(collegeId, key, value) {
  const res = await api.put(`/super-admin/colleges/${collegeId}/settings/${key}`, {
    setting_value: value,
  });
  return res.data?.setting;
}

/**
 * Attempt applying an entitlement template to a college.
 * @param {string} collegeId
 * @param {string} templateId
 * @returns {Promise<Object>} Result
 */
export async function applyTemplateToCollege(collegeId, templateId) {
  const res = await api.post(`/super-admin/colleges/${collegeId}/apply-template`, {
    template_id: templateId,
  });
  return res.data;
}

