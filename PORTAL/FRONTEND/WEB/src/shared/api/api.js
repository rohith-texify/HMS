import axios from 'axios';

/**
 * Institutional API Client Configuration
 *
 * In development: Uses Vite proxy or VITE_API_BASE_URL
 * In production: Uses Render backend https://hms-1-mjvj.onrender.com
 */
const baseURL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_TARGET) ||
  (typeof import.meta !== 'undefined' && import.meta.env?.PROD ? 'https://hms-1-mjvj.onrender.com' : '');

const api = axios.create({
  baseURL: baseURL || undefined,
  timeout: 8000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach active JWT token and scope
api.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem('token') ||
      localStorage.getItem('hms_college_token') ||
      localStorage.getItem('hms_student_token') ||
      localStorage.getItem('hms_parent_token') ||
      localStorage.getItem('hms_incharge_token') ||
      localStorage.getItem('hms_security_token') ||
      sessionStorage.getItem('token');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Default to COLLEGE scope for institutional operations
    config.headers['X-Scope'] = 'COLLEGE';
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to normalize response data
api.interceptors.response.use(
  (response) => {
    if (response.data && response.data.success !== undefined) {
      return response.data;
    }
    return { success: true, data: response.data };
  },
  (error) => {
    const isCanceled =
      axios.isCancel(error) ||
      error.name === 'CanceledError' ||
      error.code === 'ERR_CANCELED';

    if (isCanceled) {
      return Promise.reject({
        name: 'CanceledError',
        code: 'ERR_CANCELED',
        message: 'Request canceled',
        isCanceled: true,
      });
    }

    const responseData = error.response?.data;
    const message = responseData?.error?.message || error.message || 'An unexpected error occurred';
    const code = responseData?.error?.code || 'NETWORK_ERROR';
    const status = error.response?.status || 500;

    return Promise.reject({
      status,
      code,
      message,
      name: error.name || 'Error',
      response: error.response,
    });
  }
);

export default api;

