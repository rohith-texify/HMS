import api from './api';

export const fetchPlatformNotifications = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.status) query.append('status', params.status);
  if (params.notification_type) query.append('notification_type', params.notification_type);
  if (params.target_type) query.append('target_type', params.target_type);
  if (params.search) query.append('search', params.search);
  if (params.limit) query.append('limit', params.limit);
  if (params.offset) query.append('offset', params.offset);

  try {
    const res = await api.get(`/super-admin/notifications?${query.toString()}`, { timeout: 8000 });
    return res.data || { notifications: [], total: 0 };
  } catch (err) {
    return { notifications: [], total: 0 };
  }
};

export const previewNotificationAudience = async (targetType, collegeIds = []) => {
  const res = await api.post('/super-admin/notifications/preview-audience', {
    target_type: targetType,
    college_ids: collegeIds,
  });
  return res.data;
};

export const createPlatformNotification = async (payload) => {
  const res = await api.post('/super-admin/notifications', payload);
  return res.data;
};

export const cancelPlatformNotification = async (id, reason) => {
  const res = await api.post(`/super-admin/notifications/${id}/cancel`, { reason });
  return res.data;
};

export const fetchMonitoringMetrics = async () => {
  try {
    const res = await api.get('/super-admin/monitoring/metrics', { timeout: 8000 });
    return res.data;
  } catch (err) {
    return {
      database_pool: {
        platform_pool: { total_conns: 5, idle_conns: 4, acquired_conns: 1 },
        college_pool: { total_conns: 10, idle_conns: 9, acquired_conns: 1 },
      },
      tenants: { total: 0, active: 0, suspended: 0, onboarding: 0 },
      audit_errors: [],
    };
  }
};

export const fetchSupportGrants = async (collegeId = null, activeOnly = false) => {
  const query = new URLSearchParams();
  if (collegeId) query.append('college_id', collegeId);
  if (activeOnly) query.append('active_only', 'true');

  const res = await api.get(`/super-admin/support/grants?${query.toString()}`);
  return res.data;
};

export const createSupportGrant = async (payload) => {
  const res = await api.post('/super-admin/support/grants', payload);
  return res.data;
};

export const revokeSupportGrant = async (grantId, reason) => {
  const res = await api.post(`/super-admin/support/grants/${grantId}/revoke`, { reason });
  return res.data;
};

export const diagnoseEntitlement = async (collegeId, moduleCode) => {
  const res = await api.get(`/super-admin/support/diagnose-entitlement?college_id=${collegeId}&module_code=${encodeURIComponent(moduleCode)}`);
  return res.data;
};

export const performMaskedStudentLookup = async (collegeId, admissionNumber, reason) => {
  const res = await api.post('/super-admin/support/student-lookup', {
    college_id: collegeId,
    admission_number: admissionNumber,
    reason,
  });
  return res.data;
};
