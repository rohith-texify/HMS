import api from './api';

/**
 * Fetch all platform global system settings, optionally filtered by category.
 * @param {string} [category] - 'security' | 'system' | 'general'
 * @returns {Promise<{ settings: Array, total: number }>}
 */
export async function fetchSystemSettings(category = '') {
  const params = category ? { category } : {};
  const res = await api.get('/super-admin/system-settings', { params });
  return res.data;
}

/**
 * Fetch a single platform system setting by key.
 * @param {string} key
 * @returns {Promise<{ setting: Object }>}
 */
export async function fetchSystemSetting(key) {
  const res = await api.get(`/super-admin/system-settings/${encodeURIComponent(key)}`);
  return res.data;
}

/**
 * Update a platform system setting.
 * @param {string} key
 * @param {Object} payload
 * @param {Object} payload.setting_value
 * @param {string} payload.reason
 * @returns {Promise<{ message: string, setting: Object }>}
 */
export async function updateSystemSetting(key, payload) {
  const res = await api.put(`/super-admin/system-settings/${encodeURIComponent(key)}`, payload);
  return res.data;
}

/**
 * Reset a platform system setting to its default value.
 * @param {string} key
 * @param {string} reason
 * @returns {Promise<{ message: string, setting: Object }>}
 */
export async function resetSystemSetting(key, reason) {
  const res = await api.post(`/super-admin/system-settings/${encodeURIComponent(key)}/reset`, { reason });
  return res.data;
}

/**
 * Revert a platform system setting to an earlier audit log version.
 * @param {string} key
 * @param {string} historyId
 * @param {string} reason
 * @returns {Promise<{ message: string, setting: Object }>}
 */
export async function revertSystemSetting(key, historyId, reason) {
  const res = await api.post(`/super-admin/system-settings/${encodeURIComponent(key)}/revert`, {
    history_id: historyId,
    reason,
  });
  return res.data;
}

/**
 * Fetch audit log history of platform system configuration changes.
 * @param {string} [key] - Optional specific setting key
 * @param {number} [limit=50]
 * @param {number} [offset=0]
 * @returns {Promise<{ history: Array, total: number }>}
 */
export async function fetchSystemSettingsHistory(key = '', limit = 50, offset = 0) {
  const params = { limit, offset };
  if (key) params.key = key;
  const res = await api.get('/super-admin/system-settings/history', { params });
  return res.data;
}

/**
 * Fetch tenant inheritance overview showing which colleges override vs inherit global settings.
 * @returns {Promise<{ inheritance: Array, total: number }>}
 */
export async function fetchTenantInheritanceOverview() {
  const res = await api.get('/super-admin/system-settings/tenant-inheritance');
  return res.data;
}

/**
 * Check active platform maintenance mode status.
 * @returns {Promise<{ maintenance: Object }>}
 */
export async function checkMaintenanceStatus() {
  const res = await api.get('/super-admin/system-settings/maintenance');
  return res.data;
}
