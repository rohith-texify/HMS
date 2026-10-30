# HMS Development Guide - Local, Vercel & Render Setup

## 🎯 Overview

HMS (Hostel Management System) is configured to run in three environments:
- **Local Development**: Frontend + Backend + Database all on localhost
- **Vercel Production**: Frontend deployed on Vercel
- **Render Production**: Backend deployed on Render

This guide explains how to set up and configure each environment.

---

## 🚀 Local Development Setup

### Prerequisites
- Node.js (v18+)
- Go (v1.21+)
- PostgreSQL (running locally) OR Neon Database credentials

### Quick Start

**1. Start Backend**
```powershell
cd d:\HMS\API\cmd\server
go build -o server.exe main.go
.\server.exe
```

Backend runs on: `http://localhost:8080`

**2. Start Frontend**
```powershell
cd d:\HMS\MODULES\SUPER-ADMIN\FRONTEND\WEB
npm install --legacy-peer-deps
npm run dev
```

Frontend runs on: `http://localhost:3000`

**3. Database Setup**

**Option A: Local PostgreSQL (Recommended for local dev)**
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=HMS
DB_USER=postgres
DB_PASSWORD=Rohith@acet
DB_SSLMODE=disable
```

**Option B: Neon Database (Cloud-based)**
```env
DATABASE_URL=postgresql://neondb_owner:npg_5kb3oGlwITEz@ep-calm-river-b421p61u-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

### Test Local Development

**1. Login Page**
- Open: http://localhost:3000
- Should show login page

**2. Test Login**
```bash
Email: superadmin@hms.local
Password: Password@123
```

**3. Expected Flow**
- Login page → Enter credentials → Click Login → Dashboard loads

---

## 📁 Environment Configuration Files

### Backend (.env)
Located at: `d:\HMS\.env`

```env
# Development Configuration
APP_ENV=development
SERVER_PORT=8080
ENVIRONMENT=development
GIN_MODE=debug

# Database (Local PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=HMS
DB_USER=postgres
DB_PASSWORD=Rohith@acet
DB_SSLMODE=disable

# Or Neon (uncomment to switch)
# DATABASE_URL=postgresql://...

# CORS - Allow local frontend
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# JWT
JWT_SECRET=HMS_2026_a8F7kP2xQ9mL4vR6tY3nW8zC5jD1sG7hK0pX
JWT_ISSUER=hms-api
JWT_AUDIENCE=hms-client
```

### Frontend Local Development (.env.local)
Located at: `d:\HMS\MODULES\SUPER-ADMIN\FRONTEND\WEB\.env.local`

```env
# Leave blank - uses Vite proxy to http://localhost:8080
VITE_API_BASE_URL=
VITE_BACKEND_TARGET=http://localhost:8080
```

### Frontend Production (.env.production)
Located at: `d:\HMS\MODULES\SUPER-ADMIN\FRONTEND\WEB\.env.production`

```env
# Production backend on Render
VITE_API_BASE_URL=https://hms-backend-dtcm.onrender.com
VITE_BACKEND_TARGET=https://hms-backend-dtcm.onrender.com
```

---

## 🔧 How Configuration Works

### Development Flow
```
User Browser (localhost:3000)
    ↓
React App (uses Vite proxy)
    ↓
Vite Dev Server (http://localhost:3000)
    ↓
Vite Proxy Configuration (vite.config.js)
    ↓
Backend (http://localhost:8080)
```

**vite.config.js** proxies these paths:
- `/auth/*` → http://localhost:8080
- `/super-admin/*` → http://localhost:8080
- `/geo/*` → http://localhost:8080

### Production Flow (Vercel → Render)
```
User Browser
    ↓
React App (from Vercel CDN)
    ↓
axios API client
    ↓
VITE_API_BASE_URL = https://hms-backend-dtcm.onrender.com
    ↓
Backend (on Render)
```

---

## 🔄 Switching Environments

### Switch to Neon Database (Local Dev)

Edit `d:\HMS\.env`:
```env
# Comment out local PostgreSQL
# DB_HOST=localhost
# DB_PORT=5432

# Uncomment Neon URL
DATABASE_URL=postgresql://neondb_owner:npg_5kb3oGlwITEz@ep-calm-river-b421p61u-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

Restart backend: `Ctrl+C` then `.\server.exe`

### Switch Backend URL for Frontend

Edit `d:\HMS\MODULES\SUPER-ADMIN\FRONTEND\WEB\.env.local` or `.env.production`

**Local Dev:**
```env
VITE_API_BASE_URL=
VITE_BACKEND_TARGET=http://localhost:8080
```

**Production (Render):**
```env
VITE_API_BASE_URL=https://hms-backend-dtcm.onrender.com
VITE_BACKEND_TARGET=https://hms-backend-dtcm.onrender.com
```

Restart frontend: `Ctrl+C` then `npm run dev`

---

## 📊 API Communication

### Request Flow

**Local Development:**
```javascript
// api.js sets baseURL to empty string (for development)
const baseURL = import.meta.env.VITE_API_BASE_URL || '';

// Vite proxy handles forwarding to localhost:8080
// Example:
// Request: POST /auth/login
// Proxied to: POST http://localhost:8080/auth/login
```

**Production (Vercel):**
```javascript
// api.js uses production backend URL
const baseURL = import.meta.env.VITE_API_BASE_URL;
// = 'https://hms-backend-dtcm.onrender.com'

// Requests go directly to Render
// Example:
// Request: POST /auth/login
// Sent to: POST https://hms-backend-dtcm.onrender.com/auth/login
```

### Response Normalization

All API responses are normalized by axios interceptor:

```javascript
{
  success: true,
  data: {
    // actual response data
  }
}
```

---

## 🧪 Testing Authentication

### Local Testing

**1. Clear Browser Cache**
```
Ctrl+Shift+Delete
```

**2. Go to Login**
```
http://localhost:3000
```

**3. Enter Credentials**
```
Email: superadmin@hms.local
Password: Password@123
```

**4. Check Backend Health**
```bash
curl http://localhost:8080/health
```

Expected response:
```json
{
  "success": true,
  "data": {
    "status": "ok"
  }
}
```

**5. Test Login API**
```bash
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "superadmin@hms.local",
    "password": "Password@123"
  }'
```

---

## 🌐 Deployment Checklist

### Before Pushing to Vercel (Frontend)

- [ ] Test locally: `npm run build`
- [ ] No console errors
- [ ] Login works
- [ ] Dashboard loads
- [ ] Update `.env.production` with correct API URL
- [ ] Push to GitHub
- [ ] Vercel auto-deploys

### Before Pushing to Render (Backend)

- [ ] Test locally: `go build`
- [ ] All migrations run
- [ ] Database connection stable
- [ ] Update `.env` with Render database URL
- [ ] Push to GitHub
- [ ] Render auto-deploys

---

## 🛑 Troubleshooting

### Issue: "Loading..." stuck on login page

**Solution:**
1. Check backend is running: `http://localhost:8080/health`
2. Check browser console (F12) for errors
3. Clear localStorage: `localStorage.clear()`
4. Refresh browser: `Ctrl+Shift+R`

### Issue: API calls failing with 404

**Solution:**
1. Check backend proxy paths in `vite.config.js`
2. Verify backend is listening on correct port
3. Check CORS settings in backend `.env`

### Issue: Login fails with "Access denied"

**Solution:**
1. Verify credentials: `superadmin@hms.local` / `Password@123`
2. Check database connection: `http://localhost:8080/health/db`
3. Check user exists in database
4. Check JWT configuration in `.env`

### Issue: Database connection error

**Solution:**
1. **Local PostgreSQL:**
   - Verify PostgreSQL service is running
   - Check DB credentials in `.env`
   - Test connection: `psql -h localhost -U postgres`

2. **Neon Database:**
   - Verify CONNECTION STRING in `.env`
   - Check network connectivity
   - Verify Neon database exists

---

## 📝 Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | superadmin@hms.local | Password@123 |
| College Admin | admin@test-college.local | Password@123 |
| Student | student@test-college.local | Password@123 |
| Parent | parent@test-college.local | Password@123 |

---

## 🔗 Important URLs

| Service | Local | Production |
|---------|-------|------------|
| Frontend | http://localhost:3000 | https://hms-vercel.vercel.app |
| Backend | http://localhost:8080 | https://hms-backend-dtcm.onrender.com |
| Health | http://localhost:8080/health | https://hms-backend-dtcm.onrender.com/health |
| Database | localhost:5432 | Neon Database |

---

## 📚 Key Configuration Files

1. **Backend**
   - `.env` - Environment variables
   - `MODULES/SUPER-ADMIN/FRONTEND/WEB/vite.config.js` - Build config

2. **Frontend (Local Dev)**
   - `.env.local` - Development overrides
   - `vite.config.js` - Dev proxy configuration
   - `src/services/api.js` - API client setup

3. **Frontend (Production)**
   - `.env.production` - Production overrides
   - `vercel.json` - Vercel deployment config

---

## ✅ Development Workflow

1. **Start services in order:**
   - Terminal 1: Backend (`.\server.exe`)
   - Terminal 2: Frontend (`npm run dev`)

2. **Make changes:**
   - Backend: Restart after edits
   - Frontend: Auto-reload with Vite HMR

3. **Test locally:**
   - Open http://localhost:3000
   - Test login flow
   - Verify API calls in Network tab

4. **Commit and push:**
   - Backend changes: Push to GitHub → Render auto-deploys
   - Frontend changes: Push to GitHub → Vercel auto-deploys

---

## 🎓 Learning Resources

- [Vite Proxy Documentation](https://vitejs.dev/config/server-options.html#server-proxy)
- [Axios Interceptors](https://github.com/axios/axios#interceptors)
- [Environment Variables in Vite](https://vitejs.dev/guide/env-and-modes.html)
- [Render Deployment Guide](https://render.com/docs)
- [Vercel Deployment Guide](https://vercel.com/docs)

---

**Status**: ✅ Local development fully configured and ready!
