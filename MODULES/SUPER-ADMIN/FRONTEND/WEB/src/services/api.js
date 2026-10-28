import axios from 'axios';

// Create configured Axios client for Super Admin API
// Supports configurable VITE_API_BASE_URL for Vercel production deployment
const baseURL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '';

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
    return Promise.reject({
      status: error.response?.status || 500,
      code,
      message,
      name: error.name || 'Error',
    });
  }
);

export default api;
