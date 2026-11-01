import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendTarget = env.VITE_BACKEND_TARGET || env.VITE_API_BASE_URL || 'http://localhost:3001';

  return {
    root: __dirname,
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '../../../shared/components': path.resolve(__dirname, './src/components'),
        '../../shared/components': path.resolve(__dirname, './src/components'),
        '../shared/components': path.resolve(__dirname, './src/components'),
        '../../../shared/auth/useAuth': path.resolve(__dirname, './src/hooks/useAuth.js'),
        '../../shared/auth/useAuth': path.resolve(__dirname, './src/hooks/useAuth.js'),
        '../../../shared/utils/exportUtils': path.resolve(__dirname, './src/utils/exportUtils.js'),
        '../../shared/utils/exportUtils': path.resolve(__dirname, './src/utils/exportUtils.js'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3002,
      proxy: {
        '/college': {
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
    build: {
      outDir: path.join(__dirname, 'dist'),
      emptyOutDir: true,
    },
  };
});
