import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { cwd } from 'node:process';

// Development: use localhost:8080, Production: use Render backend
export default defineConfig(({ mode }) => {
  // Load environment variables based on mode
  const env = loadEnv(mode, cwd(), '');
  
  // Use VITE_BACKEND_TARGET if set, otherwise default to backend target based on mode
  const backendTarget = env.VITE_BACKEND_TARGET || 
    (mode === 'production' ? 'https://hms-1-mjvj.onrender.com' : 'http://localhost:8080');
  
  return {
    plugins: [react()],
    base: '/',
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-icons': ['lucide-react'],
            'vendor-charts': ['recharts'],
          },
        },
      },
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
