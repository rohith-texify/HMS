import api from './api';

/**
 * Fetch complete Super Admin Dashboard data with optional filters.
 * @param {Object} filters
 * @param {string} [filters.start_date] - RFC3339 or YYYY-MM-DD
 * @param {string} [filters.end_date] - RFC3339 or YYYY-MM-DD
 * @param {string} [filters.college_id] - UUID of college tenant
 * @returns {Promise<Object>} Dashboard response
 */
export async function fetchDashboard(filters = {}) {
  const params = {};
  if (filters.start_date) params.start_date = filters.start_date;
  if (filters.end_date) params.end_date = filters.end_date;
  if (filters.college_id) params.college_id = filters.college_id;

  const res = await api.get('/super-admin/dashboard', { params });
  return res.data;
}

/**
 * Authenticate Super Admin session.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<Object>} Login response data
 */
export async function loginSuperAdmin(email, password) {
  if (!email || !password) {
    throw new Error('Email and password are required');
  }
  const res = await api.post('/auth/login', { email, password });
  if (res.data?.access_token) {
    localStorage.setItem('token', res.data.access_token);
    return res.data;
  }
  throw new Error('No access token returned');
}

/**
 * Fetch colleges list for selector filter.
 * @returns {Promise<Array>} List of colleges
 */
export async function fetchColleges() {
  try {
    const res = await api.get('/super-admin/colleges', {
      params: { limit: 100, offset: 0 },
    });
    return res.data?.colleges || [];
  } catch (err) {
    console.warn('Could not load colleges for selector:', err.message);
    return [];
  }
}

