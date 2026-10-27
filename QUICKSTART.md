# 🚀 Quick Start Guide

## Current Status
✅ Project structure created  
✅ Frontend dependencies installed  
✅ Configuration files ready  
⏳ Go needs to be installed  
⏳ PostgreSQL needs to be installed  

## Next 5 Steps to Get Running

### Step 1: Install Go (5 minutes)
```
1. Visit: https://go.dev/dl/
2. Download Windows installer (.msi)
3. Run installer with default settings
4. Restart your terminal
5. Verify: go version
```

### Step 2: Install PostgreSQL (10 minutes)
```
1. Visit: https://www.postgresql.org/download/windows/
2. Download installer
3. Install with default settings
4. Remember the password for 'postgres' user
5. Verify: psql --version
```

### Step 3: Setup Environment (2 minutes)
```bash
# Copy environment template
cp .env.example .env

# Edit .env and update these values:
# - DB_PASSWORD=your_postgres_password
# - JWT_SECRET=generate_a_random_secret_key
```

### Step 4: Download Go Dependencies (3 minutes)
```bash
go mod download
go mod tidy
```

### Step 5: Create Database (2 minutes)
```bash
# Open psql
psql -U postgres

# In psql, run:
CREATE DATABASE hostel_management;
\q
```

## Start Development

### Terminal 1 - Backend:
```bash
go run API/cmd/server/main.go
```
Backend runs on: http://localhost:8080

### Terminal 2 - Student Portal:
```bash
npm run dev:student
```
Student portal: http://localhost:5173

### Terminal 3 - Admin Portal:
```bash
npm run dev:admin
```
Admin portal: http://localhost:5175

### All Available Portals:
- Student: `npm run dev:student` → http://localhost:5173
- Parent: `npm run dev:parent` → http://localhost:5174
- Admin: `npm run dev:admin` → http://localhost:5175
- Incharge: `npm run dev:incharge` → http://localhost:5176
- Security: `npm run dev:security` → http://localhost:5177
- Super Admin: `npm run dev:super-admin` → http://localhost:5178

## Using Docker Instead (Alternative)

If you prefer Docker:

```bash
# Install Docker Desktop for Windows
# Then run:
docker-compose up -d

# Everything starts automatically!
```

## Verify Installation

```bash
# Check Node.js
node --version    # Should show v18+

# Check npm
npm --version     # Should show 9+

# Check Go (after installation)
go version        # Should show go1.21+

# Check PostgreSQL (after installation)
psql --version    # Should show 14+

# Check installed packages
npm list --depth=0
```

## Useful Commands

```bash
# View all available commands
make help

# Build everything
make build

# Run tests
make test

# Clean up
make clean

# Format code
make fmt
```

## Project URLs

Once running:
- **API Server:** http://localhost:8080
- **API Docs (Swagger):** http://localhost:8080/swagger/index.html
- **Student Portal:** http://localhost:5173
- **Admin Portal:** http://localhost:5175
- **Super Admin Portal:** http://localhost:5178

## Need Help?

1. Check `SETUP_STATUS.md` for detailed status
2. Read `DOCS/SETUP.md` for complete instructions
3. See `README.md` for project overview
4. Review `.env.example` for configuration options

## Common First-Time Issues

### "go: command not found"
→ Install Go from https://go.dev/dl/

### "psql: command not found"
→ Install PostgreSQL and add to PATH

### "Port already in use"
→ Change port in .env or kill process using the port

### npm vulnerabilities
→ Run: `npm audit fix`

---

**You're almost ready to start coding! Just install Go and PostgreSQL.** 🎉
