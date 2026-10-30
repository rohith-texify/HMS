# HMS - Local Development Quick Start

## ✅ Everything is Ready!

Your HMS system is now fully configured for local development with:
- ✅ Frontend running on `http://localhost:3000`
- ✅ Backend running on `http://localhost:8080`
- ✅ Database connected (PostgreSQL)
- ✅ Superadmin user seeded and ready
- ✅ Login authentication working
- ✅ Environment configs for local vs production

---

## 🚀 Quick Start (5 minutes)

### 1. Start Backend
```powershell
cd d:\HMS\API\cmd\server
go build -o server.exe main.go
.\server.exe
```

**Backend will be ready at**: http://localhost:8080

### 2. Start Frontend
```powershell
cd d:\HMS\MODULES\SUPER-ADMIN\FRONTEND\WEB
npm run dev
```

**Frontend will be ready at**: http://localhost:3000

### 3. Login to Dashboard
1. Open http://localhost:3000 in browser
2. Enter credentials:
   - **Email**: `superadmin@hms.local`
   - **Password**: `Password@123`
3. Click **Sign In**
4. Dashboard loads ✅

---

## 🧪 Verify Everything Works

Run the included test script:
```powershell
cd d:\HMS
powershell -ExecutionPolicy Bypass -File test_login.ps1
```

Expected output:
- ✅ Backend is running on port 8080
- ✅ Frontend is running on port 3000
- ✅ Login API is working

---

## 🗄️ Database Management

### Local PostgreSQL (Default)
- **Host**: localhost
- **Port**: 5432
- **Database**: HMS
- **User**: postgres
- **Password**: Rohith@acet

### Switch to Neon Database
Edit `d:\HMS\.env`:
```env
# Comment out local config
# DB_HOST=localhost
# DB_PORT=5432

# Uncomment Neon URL
DATABASE_URL=postgresql://neondb_owner:npg_5kb3oGlwITEz@ep-calm-river-b421p61u-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

Then restart backend.

### Seed Database
If user doesn't exist, run:
```powershell
cd d:\HMS\cmd\seed
go run main.go
```

This creates `superadmin@hms.local` user with correct password hash.

---

## 🔧 Environment Configuration

### Frontend Environments

**Local Development** (`.env.local`):
```env
VITE_API_BASE_URL=
VITE_BACKEND_TARGET=http://localhost:8080
```
- Uses Vite proxy to forward API calls to localhost:8080
- Perfect for development with hot reload

**Production** (`.env.production`):
```env
VITE_API_BASE_URL=https://hms-backend-dtcm.onrender.com
VITE_BACKEND_TARGET=https://hms-backend-dtcm.onrender.com
```
- Direct calls to Render backend
- Used when deployed to Vercel

### Backend (.env)
```env
# Local development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=HMS
DB_USER=postgres
DB_PASSWORD=Rohith@acet

# Or Neon for testing
# DATABASE_URL=postgresql://...
```

---

## 🔄 How API Requests Work

### Local Development Flow
```
Browser (localhost:3000)
    ↓
React App
    ↓
Vite Dev Proxy (port 3000)
    ↓
Routes:
  /auth/*       → localhost:8080
  /super-admin/* → localhost:8080
  /geo/*        → localhost:8080
    ↓
Backend (localhost:8080)
    ↓
PostgreSQL
```

### Production Flow (Vercel → Render)
```
Browser
    ↓
React App (from Vercel)
    ↓
Direct HTTPS
    ↓
Backend (Render)
    ↓
PostgreSQL (Neon)
```

---

## 📊 Available Test Credentials

| Role | Email | Password |
|------|-------|----------|
| **Super Admin** | superadmin@hms.local | Password@123 |
| College Admin | admin@test-college.local | Password@123 |
| Student | student@test-college.local | Password@123 |
| Parent | parent@test-college.local | Password@123 |

Only **Super Admin** is seeded by default. Other users can be created through the app.

---

## 📝 Key Files

| Path | Purpose |
|------|---------|
| `d:\HMS\.env` | Backend configuration |
| `d:\HMS\MODULES\SUPER-ADMIN\FRONTEND\WEB\.env.local` | Frontend dev config |
| `d:\HMS\MODULES\SUPER-ADMIN\FRONTEND\WEB\.env.production` | Frontend prod config |
| `d:\HMS\MODULES\SUPER-ADMIN\FRONTEND\WEB\vite.config.js` | Vite dev proxy config |
| `d:\HMS\API\cmd\server\main.go` | Backend entry point |
| `d:\HMS\cmd\seed\main.go` | Database seeding utility |
| `d:\HMS\test_login.ps1` | Login flow test script |

---

## ✅ Deployment Checklist

### Deploy Frontend to Vercel
1. Push to GitHub
2. Vercel auto-deploys
3. `.env.production` ensures correct API URL
4. Check: `https://your-app.vercel.app` loads login

### Deploy Backend to Render
1. Push to GitHub
2. Render auto-deploys
3. Set `DATABASE_URL` env var in Render
4. Check: `https://your-api.render.com/health` returns `{"success":true,"data":{"status":"ok"}}`

---

## 🛑 Troubleshooting

### Login page shows "Loading..." forever
- ✅ **Fixed** - Auth state now loads synchronously
- Check browser console (F12) for errors
- Verify backend health: http://localhost:8080/health

### API returns 401 Unauthorized
- User session expired
- Browser cache has stale token
- Clear localStorage: `localStorage.clear()`
- Refresh and login again

### Backend won't connect to database
**Local PostgreSQL:**
- Check PostgreSQL service is running
- Verify credentials in `.env`
- Test: `psql -h localhost -U postgres -d HMS`

**Neon Database:**
- Copy correct connection string from Neon dashboard
- Test connectivity with `psql`

### Frontend shows white screen
- Check browser console (F12) for errors
- Check Network tab for failed API calls
- Backend must be running on port 8080
- Clear browser cache: `Ctrl+Shift+Delete`

---

## 📚 Documentation

Full detailed guides:
- `DEVELOPMENT_GUIDE.md` - Complete setup and configuration
- `LOCALHOST_SETUP.md` - Running all services locally

---

## 🎓 Tech Stack

- **Frontend**: React + Vite + Axios
- **Backend**: Go + Gin
- **Database**: PostgreSQL (local) or Neon (cloud)
- **Auth**: JWT + Bcrypt
- **Deployment**: Vercel (frontend) + Render (backend)

---

## ⚡ Next Steps

1. **Modify code**: Edit `.jsx` files, backend auto-reloads changes (need restart)
2. **Run tests**: `npm run test` or `go test ./...`
3. **Build for production**: `npm run build` (frontend) or `go build` (backend)
4. **Deploy**: Push to GitHub → Vercel/Render auto-deploy

---

## 🆘 Need Help?

Check logs in:
- **Backend**: Terminal where you ran `.\server.exe`
- **Frontend**: Terminal where you ran `npm run dev`
- **Browser**: F12 → Console tab

All services running correctly? Login and start building! 🚀
