import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Development: use localhost:8080, Production: use Render backend
export default defineConfig(({ mode }) => {
  // Load environment variables based on mode
  const env = loadEnv(mode, process.cwd(), '');
  
  // Use VITE_BACKEND_TARGET if set, otherwise default to backend target based on mode
  const backendTarget = env.VITE_BACKEND_TARGET || 
    (mode === 'production' ? 'https://hms-backend-dtcm.onrender.com' : 'http://localhost:8080');
  
  return {
    plugins: [react()],
    base: '/',
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      emptyOutDir: true
    },
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
  };
});
