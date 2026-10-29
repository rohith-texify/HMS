import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backendTarget = process.env.VITE_BACKEND_TARGET || 'https://hms-backend-dtcm.onrender.com';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/super-admin': {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
      },
      '/auth': {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
      },
      '/geo': {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
