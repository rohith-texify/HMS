# HMS API Documentation

This directory contains the core Go source code for the Hostel Management System API.

## API Architecture

The API follows a standard layered architecture:
1. **Handlers (Controllers):** Parse incoming HTTP requests, validate input, and serialize HTTP responses.
2. **Services (Business Logic):** Execute business rules, enforce module-specific permissions, and orchestrate repository calls.
3. **Repositories (Data Access):** Execute SQL queries against the PostgreSQL database.
4. **Database Pool:** `pgxpool` manages PostgreSQL connections and propagates context.

## Application Startup Flow

1. `cmd/server/main.go` acts as the entry point.
2. **Configuration Loading:** `config.Load()` parses the `.env` file (if present) and environment variables, strictly validating required production settings.
3. **Logging:** A `zap` logger is initialized.
4. **Database:** `database.New()` establishes a `pgxpool` connection and verifies connectivity via `.Ping()`.
5. **Router Initialization:** `server.NewRouter()` wires all repositories, services, handlers, and middlewares to the Gin engine.
6. **Listener:** An `http.Server` starts listening on the configured port, wrapped with Graceful Shutdown logic tied to OS signals.

## Authentication and JWT Validation

All routes (except `/auth/login` and `/health`) require authentication.
- **Login:** Users authenticate using email and password (bcrypt verification). Upon success, a JWT is generated.
- **JWT Middleware:** Validates the `Authorization: Bearer <token>` header against the `JWT_SECRET` (HS256). It extracts the User ID, College ID, and Role, placing them into the Gin context.

## Platform vs. College Scope

The API distinguishes between two primary scopes:
1. **Platform Scope:** Super-admin operations that affect the entire system (e.g., creating a new college).
2. **College Scope:** Standard operations restricted to a specific college tenant.

## Tenant Context

- The `TenantStatusMiddleware` ensures the user's college is currently `ACTIVE`.
- In handlers and repositories, the `college_id` is extracted from the JWT context and passed to the database.
- RLS Verification: For queries, the repository sets `app.current_tenant_id` at the database level to enforce PostgreSQL Row-Level Security.

## Middleware Ordering

The middleware chain executes in the following strict order:
1. `RequestID` (Injects correlation IDs)
2. `Recovery` (Catches panics, logs via zap, returns 500)
3. `Logger` (Logs HTTP requests with duration and status)
4. `CORS` (Validates origins)
5. Security Headers (CSP, X-Frame-Options, etc)
6. `AuthMiddleware` (Validates JWT)
7. `TenantStatusMiddleware` (Validates tenant is active)
8. `ModuleEntitlementMiddleware` (Validates college has access to the requested module)
9. `PermissionMiddleware` (Validates user's RBAC role allows the action)

## Handler → Service → Repository Responsibilities

- **Handler:** `ShouldBindJSON`, responds via `response.Success()` or `response.Error()`.
- **Service:** Input logic, validation (e.g., date overlap checks), and orchestrating DB calls. Returns domain errors.
- **Repository:** Executes native SQL. Returns `ErrNoRows` or generic DB errors.

## Database Access and Transactions

- `pgxpool` is used directly for queries.
- **Transactions:** Handled via `repository.WithTransaction(ctx, func(tx pgx.Tx) error)`. The transaction context is securely passed down.

## Error and Response Conventions

- All successes use a standard format: `{"success": true, "data": {...}}`.
- All errors use a standard format: `{"success": false, "error": {"code": "...", "message": "..."}}`.
- Internal SQL constraints and stack traces are swallowed by `pkg/errors` and returned as generic 500s to the client to prevent data leakage.

## Health Endpoints

- `GET /health`: Basic ping to verify the API process is alive.
- `GET /health/db`: Database ping to verify connection pool readiness.

## How to Add a New Module Safely

1. **Database:** Verify the schema supports it. Do NOT modify the finalized database.
2. **Repository:** Create `internal/repository/new_module_repo.go`.
3. **Service:** Create `internal/service/new_module_service.go` containing business logic.
4. **Handler:** Create `internal/handler/new_module_handler.go`.
5. **Router:** Register the routes in `internal/server/router.go` under the appropriate `PermissionMiddleware`.

## How to Run API Tests

Execute the following from the root (`D:\HMS`):
```bash
go test ./...
```
For integration testing, ensure the API is running locally and execute `.\integration_test_runner.ps1`.
