import axios from 'axios';

// Supports configurable VITE_API_BASE_URL for Vercel production deployment
const baseURL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? 'https://hms-backend-dtcm.onrender.com' : '');

const api = axios.create({
  baseURL,
  timeout: 15000,
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

    // When access token is expired or invalid (401), clear stale credentials
    // and seamlessly redirect to /login so the user isn't stuck with repeated failures
    if (status === 401 && !window.location.pathname.startsWith('/login')) {
      const isDev = Boolean(import.meta.env.DEV);
      const token =
        localStorage.getItem('hms_token') ||
        sessionStorage.getItem('hms_token') ||
        localStorage.getItem('token');
      const isDevToken = token === 'dev-super-admin-bypass-token';

      // In local development or when dev bypass token is active, NEVER kick the user to /login!
      // This prevents remote 401s from purging the active test session.
      if (!isDev && !isDevToken) {
        localStorage.removeItem('hms_token');
        localStorage.removeItem('hms_user');
        localStorage.removeItem('token');
        sessionStorage.removeItem('hms_token');
        sessionStorage.removeItem('hms_user');
        sessionStorage.removeItem('token');
        window.location.href = '/login';
      }
    }

    return Promise.reject({
      status,
      code,
      message,
      name: error.name || 'Error',
    });
  }
);

export default api;
