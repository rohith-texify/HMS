# Setup Guide - Hostel Management System

## Prerequisites Installation

### 1. Install Node.js
Download and install Node.js 18+ from [nodejs.org](https://nodejs.org/)

Verify installation:
```bash
node --version
npm --version
```

### 2. Install Go
Download and install Go 1.21+ from [go.dev](https://go.dev/dl/)

**Windows:**
- Download the MSI installer
- Run the installer
- Add Go to PATH (installer does this automatically)

Verify installation:
```bash
go version
```

### 3. Install PostgreSQL
Download and install PostgreSQL 14+ from [postgresql.org](https://www.postgresql.org/download/)

**Windows:**
- Download the installer
- Install with default settings
- Remember the password you set for the postgres user
- PostgreSQL will run as a service automatically

Verify installation:
```bash
psql --version
```

### 4. Install Git
Download from [git-scm.com](https://git-scm.com/)

Verify installation:
```bash
git --version
```

### 5. Install Redis (Optional, for caching)
**Windows:**
- Download Redis from [github.com/microsoftarchive/redis/releases](https://github.com/microsoftarchive/redis/releases)
- Or use Docker: `docker run -d -p 6379:6379 redis:alpine`

## Project Setup

### 1. Clone Repository (if using Git)
```bash
git clone https://github.com/yourusername/hostel-management-system.git
cd hostel-management-system
```

### 2. Environment Configuration
```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your actual values
# Update database credentials, JWT secret, etc.
```

### 3. Install Dependencies

#### Frontend Dependencies (Already Installed ✓)
```bash
npm install
npm run install:modules
```

#### Backend Dependencies
```bash
go mod download
go mod tidy
```

### 4. Database Setup

#### Create Database
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE hostel_management;

# Exit psql
\q
```

#### Run Migrations
```bash
# Using Make (if make is installed)
make migrate-up

# Or manually
go run SCRIPTS/database/migrate.go up
```

## Development Workflow

### Running the Application

#### 1. Start Backend Server
```bash
# Method 1: Direct
go run API/cmd/server/main.go

# Method 2: Using Make
make dev

# Backend will start on http://localhost:8080
```

#### 2. Start Frontend Modules
Open separate terminal windows for each module:

```bash
# Student Portal (http://localhost:5173)
npm run dev:student

# Parent Portal (http://localhost:5174)
npm run dev:parent

# Admin Portal (http://localhost:5175)
npm run dev:admin

# Hostel Incharge Portal (http://localhost:5176)
npm run dev:incharge

# Security Portal (http://localhost:5177)
npm run dev:security

# Super Admin Portal (http://localhost:5178)
npm run dev:super-admin
```

### Using Docker (Alternative)

If you prefer using Docker:

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

## Building for Production

### Build Frontend
```bash
# Build all modules
npm run build:all

# Build specific module
npm run build --workspace=MODULES/STUDENT/FRONTEND/WEB
```

### Build Backend
```bash
# Using Make
make build

# Or directly
go build -o bin/server API/cmd/server/main.go

# Run the binary
./bin/server
```

## Testing

### Run Tests
```bash
# All tests
make test

# Backend only
go test ./...

# Frontend only
npm test
```

## Common Issues & Solutions

### Issue: Go command not found
**Solution:** Add Go to your PATH environment variable
- Windows: Add `C:\Go\bin` to PATH
- Restart your terminal

### Issue: PostgreSQL connection refused
**Solution:** 
- Check if PostgreSQL service is running
- Verify DB credentials in .env file
- Ensure DB_HOST is correct (localhost for local setup)

### Issue: Port already in use
**Solution:**
- Check if another process is using the port
- Change port in .env file
- Kill the process using the port

### Issue: npm install fails
**Solution:**
- Clear npm cache: `npm cache clean --force`
- Delete node_modules and package-lock.json
- Run `npm install` again

## Next Steps

1. ✅ Dependencies installed
2. ⏳ Configure environment variables (.env)
3. ⏳ Set up database and run migrations
4. ⏳ Install Go (if not already installed)
5. ⏳ Start development servers
6. ⏳ Begin development!

## Useful Commands

```bash
# View all available Make commands
make help

# Format Go code
make fmt

# Run linters
make lint

# Clean build artifacts
make clean

# Create new database migration
make migrate-create name=add_users_table

# View running processes
docker-compose ps
```

## Support

For issues or questions:
- Check [DOCS/](../DOCS/) for detailed documentation
- Open an issue on GitHub
- Contact the development team

## File Structure Reference

```
HOSTEL-MANAGEMENT-SYSTEM/
├── .env                    # Environment variables (create from .env.example)
├── go.mod                  # Go dependencies
├── package.json            # Node.js root workspace config
├── docker-compose.yml      # Docker services configuration
├── Makefile               # Build and task automation
├── MODULES/               # Feature modules
├── SHARED/                # Shared code

├── DATABASE/              # Migrations and seeds
└── DOCS/                  # Documentation
```
