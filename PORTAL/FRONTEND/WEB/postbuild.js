import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, 'dist');
const indexPath = path.join(distDir, 'index.html');

if (fs.existsSync(indexPath)) {
  const indexHtml = fs.readFileSync(indexPath, 'utf-8');

  // 1. Create 404.html (Render Static Site automatic fallback), _redirects, and _headers
  fs.writeFileSync(path.join(distDir, '404.html'), indexHtml);
  fs.writeFileSync(path.join(distDir, '_redirects'), '/*    /index.html   200\n');
  fs.writeFileSync(
    path.join(distDir, '_headers'),
    `/*\n  Cache-Control: public, max-age=0, must-revalidate\n\n/index.html\n  Cache-Control: no-cache, no-store, must-revalidate\n\n/*.html\n  Cache-Control: no-cache, no-store, must-revalidate\n\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n`
  );

  // 2. Physical directory entrypoints for clean SPA direct URL hit compatibility
  const routes = [
    'login',
    'unauthorized',
    'admin',
    'student',
    'parent',
    'hostel-incharge',
    'security'
  ];

  for (const route of routes) {
    const routeDir = path.join(distDir, route);
    if (!fs.existsSync(routeDir)) {
      fs.mkdirSync(routeDir, { recursive: true });
    }
    fs.writeFileSync(path.join(routeDir, 'index.html'), indexHtml);
    fs.writeFileSync(path.join(distDir, `${route}.html`), indexHtml);
  }

  console.log('✅ Postbuild: Generated SPA static fallback files (404.html, _redirects, _headers, and physical routes)');
}

