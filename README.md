# Hostel Management System (HMS)

A comprehensive, multi-tenant hostel management system API designed for real-time operations, role-based access control, and complete data isolation between different colleges.

## 1. Project Overview

HMS is a production-grade backend API built in Go. It supports multiple tenant colleges running on a single centralized PostgreSQL database, securely partitioned via Row-Level Security (RLS) and JWT-based tenant context.

## 2. Main Technologies

- **Language:** Go 1.21+
- **Framework:** Gin Web Framework
- **Database:** PostgreSQL 14+
- **Database Driver:** pgx/v5
- **Authentication:** JWT (JSON Web Tokens) with HS256
- **Logging:** Uber-go/zap

## 3. Repository Structure

```
D:\HMS
├── API/              # Main API source code (cmd, internal packages)

├── DATABASE/         # Finalized PostgreSQL schemas, migrations, RLS, and seed data
├── DOCS/             # Project documentation
├── INFRASTRUCTURE/   # Deployment resources (Docker, etc)
├── MODULES/          # Feature module specs/frontend assets
├── SHARED/           # Shared types
├── STORAGE/          # Local file storage mounts
└── *.ps1             # Integration testing and automation scripts
```

## 4. Prerequisites

- Go 1.21 or higher
- PostgreSQL 14 or higher
- Git
- PowerShell (for running test scripts on Windows)

## 5. Local Setup

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd HMS
   ```
2. **Download Go dependencies:**
   ```bash
   go mod download
   ```
3. **Configure Environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your local database credentials
   ```

## 6. Environment Configuration

Configuration is managed via the `.env` file for local development. In production, variables should be injected directly.
Key variables:
- `SERVER_PORT`: Port to bind the API (default `8080`)
- `APP_ENV`: `development` or `production`
- `DB_*`: Database connection parameters
- `JWT_SECRET`: Base64 secret for token generation
- `CORS_ALLOWED_ORIGINS`: Comma-separated list of allowed origins

Refer to [DOCS/CONFIGURATION.md](DOCS/CONFIGURATION.md) for details.

## 7. Database Prerequisites

The PostgreSQL database schema is **finalized**.
To initialize:
1. Create a PostgreSQL database named `HMS` (or as configured).
2. Execute the migration scripts in the `DATABASE/` directory in order.
3. Apply RLS policies from `DATABASE/rls/`.
4. Apply the `test_seed.sql` to populate essential system super-admins and reference data.

Refer to [DATABASE/README.md](DATABASE/README.md) for details.

## 8. How to Start the API

To start the API locally:

```bash
cd API/cmd/server
go run main.go
```
The server will start on the configured port (default `8080`).

## 9. How to Run Tests

### Unit and Build Tests:
```bash
go fmt ./...
go vet ./...
go test ./...
go build ./...
```

### Integration Tests (PowerShell):
To run the full end-to-end integration test suite against a running local API:
```powershell
.\integration_test_runner.ps1
```

Refer to [DOCS/TESTING.md](DOCS/TESTING.md) for details.

## 10. Health Endpoints

- `GET /health` : Lightweight API liveness check.
- `GET /health/db` : Database readiness check (pings the PostgreSQL pool).

## 11. Security Notes

- **Tenant Isolation:** Enforced at the database level via PostgreSQL Row-Level Security (RLS). Every request sets `app.current_tenant_id`.
- **JWT:** Tokens are verified using HS256. `JWT_SECRET` must be a strong random string in production.
- **Passwords:** Hashed using `bcrypt`.
- **Hardening:** The server is configured with explicit read/write timeouts, 1MB body limits, strict CORS origins, and security headers.

Refer to [DOCS/SECURITY.md](DOCS/SECURITY.md) for details.

## 12. Links to Detailed Documentation

- [Architecture Guide](DOCS/ARCHITECTURE.md)
- [API Route Reference](DOCS/API_REFERENCE.md)
- [Database Guide](DATABASE/README.md)
- [Testing Guide](DOCS/TESTING.md)
- [Configuration Guide](DOCS/CONFIGURATION.md)
- [Implementation Status](DOCS/IMPLEMENTATION_STATUS.md)

## 13. Current Implementation Status

All core modules are implemented and runtime-tested, including:
- Platform & Tenant Context
- People & RBAC
- Hostel Operations & Allocations
- Attendance & Leave Management
- Mess Operations
- Complaints & Maintenance
- Notifications
- Reports & Dashboards

## 14. Known Limitations

- Production Graceful Shutdown is currently hardcoded to a 10-second timeout context.
- The `go test -race` flag requires CGO to be enabled on Windows.
- Staff attendance tracking relies on the existing finalized `student_attendance` schemas structure where applicable.
- Cross-tenant tests in `.ps1` scripts purposefully trigger HTTP 403 or empty responses, which causes `Invoke-RestMethod` to return an exit code 1 (expected failure behavior for isolated tenants).
