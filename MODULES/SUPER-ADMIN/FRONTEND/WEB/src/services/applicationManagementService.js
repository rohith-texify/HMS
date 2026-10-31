import api from './api';
import { fetchCollegesList as getCollegesList, fetchCollegeById } from './collegeService';

/**
 * Fetch the standard platform application catalogue.
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array>}
 */
export async function fetchApplicationCatalogue(signal) {
  try {
    const res = await api.get('/super-admin/applications/catalogue', { signal, timeout: 8000 });
    return res.data || [];
  } catch (err) {
    return [];
  }
}

/**
 * Fetch all 5 application configurations for a specified college.
 * @param {string} collegeId
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array>}
 */
export async function fetchCollegeApplications(collegeId, signal) {
  if (!collegeId) {
    throw new Error('College ID is required to fetch applications');
  }
  const res = await api.get(`/super-admin/colleges/${collegeId}/applications`, { signal });
  return res.data || [];
}

/**
 * Fetch details for a specific application of a college.
 * @param {string} collegeId
 * @param {string} appId
 * @param {AbortSignal} [signal]
 * @returns {Promise<Object>}
 */
export async function fetchCollegeApplication(collegeId, appId, signal) {
  if (!collegeId || !appId) {
    throw new Error('College ID and Application ID are required');
  }
  const res = await api.get(`/super-admin/colleges/${collegeId}/applications/${appId}`, { signal });
  return res.data;
}

/**
 * Enable an application for a college.
 * @param {string} collegeId
 * @param {string} appId
 * @param {string} [reason]
 * @returns {Promise<Object>}
 */
export async function enableApplication(collegeId, appId, reason) {
  const res = await api.post(`/super-admin/colleges/${collegeId}/applications/${appId}/enable`, {
    reason: reason || undefined,
  });
  return res.data;
}

/**
 * Disable an application for a college.
 * Protected: Admin/Management Portal cannot be disabled.
 * @param {string} collegeId
 * @param {string} appId
 * @param {string} [reason]
 * @returns {Promise<Object>}
 */
export async function disableApplication(collegeId, appId, reason) {
  const res = await api.post(`/super-admin/colleges/${collegeId}/applications/${appId}/disable`, {
    reason: reason || undefined,
  });
  return res.data;
}

/**
 * Suspend an application for a college.
 * Protected: Admin/Management Portal cannot be suspended.
 * @param {string} collegeId
 * @param {string} appId
 * @param {string} [reason]
 * @returns {Promise<Object>}
 */
export async function suspendApplication(collegeId, appId, reason) {
  const res = await api.post(`/super-admin/colleges/${collegeId}/applications/${appId}/suspend`, {
    reason: reason || undefined,
  });
  return res.data;
}

/**
 * Update minimum supported version and force update policy for an application.
 * @param {string} collegeId
 * @param {string} appId
 * @param {Object} payload
 * @param {string} payload.minVersion
 * @param {boolean} [payload.forceUpdate]
 * @param {string} [payload.reason]
 * @returns {Promise<Object>}
 */
export async function updateApplicationVersion(collegeId, appId, payload) {
  const res = await api.put(`/super-admin/colleges/${collegeId}/applications/${appId}/version`, {
    min_version: payload.minVersion,
    force_update: payload.forceUpdate,
    reason: payload.reason || undefined,
  });
  return res.data;
}

/**
 * Fetch change history/audit log for an application.
 * @param {string} collegeId
 * @param {string} appId
 * @param {Object} [options]
 * @param {number} [options.limit]
 * @param {number} [options.offset]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ history: Array, total: number, limit: number, offset: number }>}
 */
export async function fetchApplicationHistory(collegeId, appId, options = {}) {
  const params = {
    limit: options.limit || 20,
    offset: options.offset || 0,
  };
  const res = await api.get(`/super-admin/colleges/${collegeId}/applications/${appId}/history`, {
    params,
    signal: options.signal,
  });

  return {
    history: res.data || [],
    total: res.meta?.total || (res.data ? res.data.length : 0),
    limit: res.meta?.limit || params.limit,
    offset: res.meta?.offset || params.offset,
  };
}

/**
 * Helper to fetch college metadata.
 */
export async function fetchCollegeMetadata(collegeId, signal) {
  return fetchCollegeById(collegeId, signal);
}

/**
 * Helper to list all colleges for college selector dropdown.
 */
export async function fetchCollegesList(signal) {
  const res = await getCollegesList({ limit: 100, signal });
  return res.colleges || [];
}
