import axios from 'axios';

const baseURL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  (typeof import.meta !== 'undefined' && import.meta.env?.PROD ? 'https://hms-1-mjvj.onrender.com' : 'https://hms-1-mjvj.onrender.com');

const api = axios.create({
  baseURL: baseURL || undefined,
  timeout: 8000,
  headers: {
    'Content-Type': 'application/json',
  },
});

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
      error.name === 'AbortError' ||
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
      'An unexpected error occurred during authentication';
    const code = responseData?.error?.code || 'AUTH_ERROR';
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
