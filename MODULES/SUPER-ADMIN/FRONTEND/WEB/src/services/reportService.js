import api from './api';

export const reportService = {
  // Get platform-wide aggregated reporting summary
  getSummary: async () => {
    const res = await api.get('/api/v1/super-admin/reports/summary');
    return res.data || res;
  },

  // Get college-wise usage metrics with small-count suppression applied
  getCollegeUsage: async (params = {}) => {
    const res = await api.get('/api/v1/super-admin/reports/college-usage', { params });
    return res.data || res;
  },

  // Get module adoption statistics
  getModuleAdoption: async () => {
    const res = await api.get('/api/v1/super-admin/reports/module-adoption');
    return res.data || res;
  },

  // Get login security event trends
  getLoginSecurity: async (days = 7) => {
    const res = await api.get('/api/v1/super-admin/reports/login-security', {
      params: { days },
    });
    return res.data || res;
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
