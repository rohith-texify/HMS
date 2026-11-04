import axios from 'axios';

/**
 * Hostel In-Charge API Client Configuration
 * 
 * In development: Uses Vite proxy to Go Backend on port 3001
 * In production: Uses VITE_API_BASE_URL or default production domain
 */
const baseURL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_TARGET) ||
  (typeof import.meta !== 'undefined' && import.meta.env?.PROD ? 'https://hms-1-mjvj.onrender.com' : '');

const api = axios.create({
  baseURL: baseURL || undefined,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach active incharge JWT token & college scope
api.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem('hms_incharge_token') ||
      sessionStorage.getItem('hms_incharge_token') ||
      localStorage.getItem('token') ||
      sessionStorage.getItem('token');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Explicit college scope requirement for all tenant requests
    config.headers['X-Scope'] = 'COLLEGE';
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: normalize response structure & handle session expiration
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
    const message =
      responseData?.error?.message ||
      responseData?.message ||
      error.message ||
      'An unexpected error occurred';
    const code =
      responseData?.error?.code ||
      (error.response ? 'HTTP_ERROR' : 'NETWORK_ERROR');
    const status = error.response?.status || 500;

    // Handle 401 Unauthorized / Token Expiration
    if (status === 401 && typeof window !== 'undefined') {
      const isAuthEndpoint = error.config?.url?.includes('/auth/login');
      if (!isAuthEndpoint && !window.location.pathname.includes('/login')) {
        window.dispatchEvent(
          new CustomEvent('hms:auth_expired', { detail: { status, message } })
        );
      }
    }

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
