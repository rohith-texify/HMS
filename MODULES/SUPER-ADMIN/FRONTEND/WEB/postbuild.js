import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, 'dist');
const indexPath = path.join(distDir, 'index.html');

if (fs.existsSync(indexPath)) {
  const indexHtml = fs.readFileSync(indexPath, 'utf-8');

  // 1. Create 404.html (Render Static Site automatic fallback)
  fs.writeFileSync(path.join(distDir, '404.html'), indexHtml);

  // 2. Create physical route directories and index.html files so any direct URL hit succeeds
  const routes = [
    'login',
    'dashboard',
    'colleges',
    'staff',
    'roles',
    'permissions',
    'onboarding',
    'approvals',
    'settings',
    'reports',
    'monitoring',
    'support',
    'notifications',
    'change-sets',
    'modules',
    'applications',
    'access-control',
    'audit-logs'
  ];

  for (const route of routes) {
    const routeDir = path.join(distDir, route);
    if (!fs.existsSync(routeDir)) {
      fs.mkdirSync(routeDir, { recursive: true });
    }
    fs.writeFileSync(path.join(routeDir, 'index.html'), indexHtml);
    fs.writeFileSync(path.join(distDir, `${route}.html`), indexHtml);
  }

  console.log('✅ Postbuild: Generated SPA static fallback files (404.html and physical route entrypoints)');
}

