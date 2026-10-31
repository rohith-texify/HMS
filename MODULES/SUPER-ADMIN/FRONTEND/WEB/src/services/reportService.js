import api from './api';

export const reportService = {
  // Get platform-wide aggregated reporting summary
  getSummary: async () => {
    try {
      const res = await api.get('/api/v1/super-admin/reports/summary', { timeout: 1800 });
      return res.data || res;
    } catch {
      return { total_colleges: 0, active_users: 0, adoption_rate: 0 };
    }
  },

  // Get college-wise usage metrics with small-count suppression applied
  getCollegeUsage: async (params = {}) => {
    try {
      const res = await api.get('/api/v1/super-admin/reports/college-usage', { params, timeout: 1800 });
      return res.data || res;
    } catch {
      return [];
    }
  },

  // Get module adoption statistics
  getModuleAdoption: async () => {
    try {
      const res = await api.get('/api/v1/super-admin/reports/module-adoption', { timeout: 1800 });
      return res.data || res;
    } catch {
      return [];
    }
  },

  // Get login security event trends
  getLoginSecurity: async (days = 7) => {
    try {
      const res = await api.get('/api/v1/super-admin/reports/login-security', {
        params: { days },
        timeout: 1800,
      });
      return res.data || res;
    } catch {
      return [];
    }
  },

  // Export audited CSV for college usage reports with anti-formula injection
  exportCollegeUsageCsv: async (params = {}) => {
    const response = await api.get('/api/v1/super-admin/reports/export/college-usage', {
      params,
      responseType: 'blob',
    });
    return response;
  },
};

export default reportService;
