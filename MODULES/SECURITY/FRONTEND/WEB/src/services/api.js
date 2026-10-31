import axios from 'axios';

const baseURL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? 'https://hms-1-mjvj.onrender.com' : 'http://localhost:8080');

const api = axios.create({
  baseURL,
  timeout: 8000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem('hms_security_token') ||
      sessionStorage.getItem('hms_security_token') ||
      localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('hms_security_token');
      sessionStorage.removeItem('hms_security_token');
      localStorage.removeItem('token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
