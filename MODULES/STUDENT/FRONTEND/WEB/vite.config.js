import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendTarget = env.VITE_BACKEND_TARGET || env.VITE_API_BASE_URL || 'http://localhost:3001';

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 3003,
      proxy: {
        '/college': {
          target: backendTarget,
          changeOrigin: true,
        },
        '/auth': {
          target: backendTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
