# HMS - Running on Localhost

## ✅ Current Status

Your HMS system is now **RUNNING LOCALLY** with:

- ✅ **Backend API** running on `http://localhost:8080`
- ✅ **Super Admin Frontend** running on `http://localhost:3000`
- ✅ **Database** connected (Local PostgreSQL or Neon as configured in .env)

---

## 🚀 How to Access

### Super Admin Portal
```
URL: http://localhost:3000
Email: superadmin@hms.local
Password: Password@123
```

### Backend API
```
Health Check: http://localhost:8080/health
Database Check: http://localhost:8080/health/db
Base URL: http://localhost:8080
```

---

## 📋 Running the System

### Option 1: Automatic Startup (Recommended)

Run the PowerShell startup script:

```powershell
cd d:\HMS
powershell -ExecutionPolicy Bypass -File START_LOCAL.ps1
```

This will:
1. Check prerequisites
2. Build backend
3. Start backend server (port 8080)
4. Install frontend dependencies
5. Start frontend dev server (port 3000)

### Option 2: Manual Startup

**Terminal 1 - Backend:**
```powershell
cd d:\HMS\API\cmd\server
go build -o server.exe main.go
.\server.exe
```

**Terminal 2 - Frontend:**
```powershell
cd d:\HMS\MODULES\SUPER-ADMIN\FRONTEND\WEB
npm install --legacy-peer-deps
npm run dev
```

---

## 🔧 Configuration

### Environment Variables (.env)

Located at: `d:\HMS\.env`

**Local PostgreSQL (default):**
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=HMS
DB_USER=postgres
DB_PASSWORD=Rohith@acet
DB_SSLMODE=disable
```

**Neon Database (alternative):**
```
DATABASE_URL=postgresql://neondb_owner:npg_5kb3oGlwITEz@ep-calm-river-b421p61u-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

To switch databases: Edit `.env` and restart the backend.

---

## 📊 Project Structure

```
d:\HMS
├── API/                          # Go backend
│   └── cmd/server/main.go       # Entry point
├── MODULES/SUPER-ADMIN/
│   └── FRONTEND/WEB/            # React frontend
│       ├── src/pages/           # Page components
│       ├── src/routes/          # Route configuration
│       └── package.json         # Dependencies
├── DATABASE/                     # Database migrations
├── .env                          # Environment config
└── START_LOCAL.ps1              # Startup script
```

---

## 🧪 Testing the System

### 1. Check Backend Health
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

### 2. Check Database Connection
```bash
curl http://localhost:8080/health/db
```

Expected response:
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "college_pool": "connected",
    "platform_pool": "connected"
  }
}
```

### 3. Test Login
```bash
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "superadmin@hms.local",
    "password": "Password@123"
  }'
```

### 4. Frontend Login
1. Open http://localhost:3000
2. Enter credentials:
   - **Email**: `superadmin@hms.local`
   - **Password**: `Password@123`
3. Click Login
4. Should redirect to `/dashboard`

---

## 📝 Available Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | superadmin@hms.local | Password@123 |
| College Admin | admin@test-college.local | Password@123 |
| Student | student@test-college.local | Password@123 |
| Parent | parent@test-college.local | Password@123 |
| Hostel Incharge | incharge@test-college.local | Password@123 |
| Security | security@test-college.local | Password@123 |

---

## 🛑 Stopping the System

### Stop Backend
Press `Ctrl+C` in the backend terminal

### Stop Frontend
Press `Ctrl+C` in the frontend terminal (or close the window)

---

## 🐛 Troubleshooting

### Issue: White Screen on Dashboard
**Solution**: Dashboard component was simplified. If it's still white:
1. Open browser DevTools (F12)
2. Check Console tab for errors
3. Check Network tab for failed API calls
4. Verify backend is running: `http://localhost:8080/health`

### Issue: Login Fails
**Check:**
1. Backend is running: `http://localhost:8080/health`
2. Database is connected: `http://localhost:8080/health/db`
3. Test credentials are correct (see table above)
4. Check browser console for specific error message

### Issue: CORS Errors
**Solution**: CORS is configured in backend for `localhost:3000`
- If using different port, add it to `.env` CORS_ALLOWED_ORIGINS

### Issue: Database Connection Error
**Solution:**
1. If using local PostgreSQL:
   - Verify PostgreSQL is running
   - Check DB_HOST, DB_PORT, DB_USER, DB_PASSWORD in .env
   
2. If using Neon:
   - Uncomment DATABASE_URL in .env
   - Verify connection string is correct
   - Check network connectivity

### Issue: Port Already in Use
**For port 8080 (backend):**
```powershell
netstat -ano | Select-String ":8080"
# Kill the process: taskkill /PID <PID> /F
```

**For port 3000 (frontend):**
```powershell
netstat -ano | Select-String ":3000"
# Kill the process: taskkill /PID <PID> /F
```

---

## 📚 Development Tips

### File Changes Auto-Reload
- **Frontend**: Changes to `.jsx`, `.css` files auto-reload (Vite HMR)
- **Backend**: Need to rebuild and restart for changes to take effect

### Build Backend for Production
```powershell
cd d:\HMS\API\cmd\server
go build -ldflags="-s -w" -o server.exe main.go
```

### Clean Frontend Build
```powershell
cd d:\HMS\MODULES\SUPER-ADMIN\FRONTEND\WEB
Remove-Item node_modules -Recurse -Force
npm install --legacy-peer-deps
npm run build
```

### View Backend Logs
```powershell
Get-Content -Path d:\HMS\backend.log -Tail 50 -Wait
```

---

## 🔗 Important URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8080 |
| Health Check | http://localhost:8080/health |
| DB Health | http://localhost:8080/health/db |

## 📝 Login Credentials

**Email**: rohith.texify@gmail.com  
**Password**: Rohith@acet

---

## ✅ Checklist

Before going to production, ensure:

- [ ] Backend builds without errors
- [ ] Frontend builds without errors
- [ ] Database connection is stable
- [ ] Login works with all user roles
- [ ] Dashboard loads without white screen
- [ ] Navigation between pages works
- [ ] API endpoints respond correctly
- [ ] No console errors in browser

---

**Status**: ✅ HMS is running successfully on localhost!
