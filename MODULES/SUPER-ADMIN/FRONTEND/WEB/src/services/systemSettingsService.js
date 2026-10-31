import api from './api';

export const DEFAULT_SYSTEM_SETTINGS = [
  {
    key: 'auth.session_timeout_minutes',
    category: 'security',
    setting_value: { value: 30 },
    description: 'Idle session expiration timeout for platform administrators.',
    is_read_only: false,
    updated_at: new Date().toISOString(),
  },
  {
    key: 'auth.mfa_enforcement',
    category: 'security',
    setting_value: { value: 'optional' },
    description: 'Enforce multi-factor authentication across platform operations.',
    is_read_only: false,
    updated_at: new Date().toISOString(),
  },
  {
    key: 'platform.maintenance_mode',
    category: 'system',
    setting_value: { enabled: false, message: 'Platform operational' },
    description: 'Global maintenance mode disabling student and college portal writes.',
    is_read_only: false,
    updated_at: new Date().toISOString(),
  },
  {
    key: 'platform.rate_limiting',
    category: 'system',
    setting_value: { general_per_min: 100, auth_per_min: 5 },
    description: 'Traffic thresholds for DDoS mitigation and brute-force protection.',
    is_read_only: true,
    updated_at: new Date().toISOString(),
  },
];

/**
 * Fetch all platform global system settings, optionally filtered by category.
 * @param {string} [category] - 'security' | 'system' | 'general'
 * @returns {Promise<{ settings: Array, total: number }>}
 */
export async function fetchSystemSettings(category = '') {
  const params = category ? { category } : {};
  try {
    const res = await api.get('/super-admin/system-settings', { params, timeout: 1800 });
    const settings = res.data?.settings || res.settings || [];
    return {
      settings: settings.length > 0 ? settings : DEFAULT_SYSTEM_SETTINGS,
      total: settings.length > 0 ? (res.data?.total || settings.length) : DEFAULT_SYSTEM_SETTINGS.length,
    };
  } catch (err) {
    return {
      settings: DEFAULT_SYSTEM_SETTINGS,
      total: DEFAULT_SYSTEM_SETTINGS.length,
    };
  }
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
