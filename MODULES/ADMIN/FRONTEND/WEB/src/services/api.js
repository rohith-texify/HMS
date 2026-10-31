import axios from 'axios';

const baseURL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? 'https://hms-1-mjvj.onrender.com' : '');

const api = axios.create({
  baseURL: baseURL || undefined,
  timeout: 8000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem('hms_college_token') ||
      sessionStorage.getItem('hms_college_token') ||
      localStorage.getItem('token');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Indicate college scope for tenant operational requests
    config.headers['X-Scope'] = 'COLLEGE';
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => {
    if (response.data && response.data.success !== undefined) {
      return response.data;
    }
    return { success: true, data: response.data };
  },
  (error) => {
    const responseData = error.response?.data;
    const message = responseData?.error?.message || error.message || 'An unexpected error occurred';
    const code = responseData?.error?.code || 'NETWORK_ERROR';
    return Promise.reject({
      status: error.response?.status || 500,
      code,
      message,
    });
  }
);

export default api;
