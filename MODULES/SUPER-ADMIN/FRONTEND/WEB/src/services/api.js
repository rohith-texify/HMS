import axios from 'axios';

/**
 * API Client Configuration
 * 
 * Local Development: Empty baseURL so axios uses Vite proxy (http://localhost:8080)
 * Production (Render): Uses VITE_API_BASE_URL pointing to Render backend
 * 
 * In development, Vite proxy forwards /auth, /super-admin, /geo requests to localhost:8080
 * In production, requests go directly to the Render backend URL
 */
const baseURL =
  import.meta.env.VITE_API_BASE_URL || // Explicitly set for production (empty for dev)
  (import.meta.env.PROD ? 'https://hms-1-mjvj.onrender.com' : ''); // Production fallback

const api = axios.create({
  baseURL: baseURL || undefined, // Use undefined if empty string to let axios use relative URLs
  timeout: 8000, // 8s fast timeout so UI operations never freeze for minutes
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token and platform scope
api.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem('hms_token') ||
      sessionStorage.getItem('hms_token') ||
      localStorage.getItem('token') ||
      sessionStorage.getItem('token');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Indicate platform scope for requests
    config.headers['X-Scope'] = 'PLATFORM';
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
    // If request was canceled or aborted, preserve cancellation signature
    const isCanceled =
      axios.isCancel(error) ||
      error.name === 'CanceledError' ||
      error.name === 'AbortError' ||
      error.code === 'ERR_CANCELED' ||
      error.message === 'canceled';

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

    // If any protected resource returns 401, clear stale tokens only if not active super admin session
    if (status === 401 && !error.config?.url?.includes('/auth/login')) {
      const activeToken = localStorage.getItem('hms_token') || sessionStorage.getItem('hms_token');
      if (activeToken && !activeToken.startsWith('super-admin-session')) {
        localStorage.removeItem('hms_token');
        localStorage.removeItem('token');
        localStorage.removeItem('hms_user');
        sessionStorage.removeItem('hms_token');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('hms_user');
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
