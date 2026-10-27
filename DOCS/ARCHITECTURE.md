# HMS Architecture

This document describes the architectural flow and design principles of the Hostel Management System API.

## Request Flow

All incoming HTTP requests follow this exact execution path:

`HTTP Request → RequestID → Recovery → Logger → CORS → Security Headers → AuthMiddleware → TenantStatusMiddleware → ModuleEntitlementMiddleware → PermissionMiddleware → Handler → Service → Repository → PostgreSQL`

### 1. Middleware Pipeline
- **RequestID:** Injects a unique `X-Request-ID` into the context for tracing.
- **Recovery:** Captures panics, logs the stack trace internally, and returns a safe HTTP 500.
- **Logger:** Logs request duration, path, and status code.
- **CORS & Security Headers:** Enforces origin checks and browser security bounds (`CSP`, `nosniff`).
- **AuthMiddleware (JWT):** Extracts and validates the Bearer token.
- **TenantStatusMiddleware:** Ensures the user's `college_id` corresponds to an `ACTIVE` college.
- **ModuleEntitlementMiddleware:** Verifies the college has purchased/enabled the requested module.
- **PermissionMiddleware:** Ensures the user's role has the explicit RBAC permission to execute the route.

### 2. Scopes and Tenant Context

- **Platform-Scoped Requests:** Operations managed by `SUPER_ADMIN` (e.g., creating a new college). These bypass tenant context.
- **College-Scoped Requests:** Standard operations where `college_id` is extracted from the JWT. The user can only access resources within their own college.

### 3. Tenant Isolation and Security
Data isolation is guaranteed at the database level.
When a repository executes a query, it injects the `college_id` into the transaction context as `app.current_tenant_id`. PostgreSQL Row-Level Security (RLS) automatically blocks any query attempting to read or write rows belonging to a different tenant.

### 4. Responsibilities
- **Handlers:** Extract URL params and JSON bodies. Return structured JSON responses.
- **Services:** Validate business rules (e.g., date conflicts, capacity checks). Return domain errors.
- **Repositories:** Execute raw SQL via `pgxpool`. Handle `pgx.Tx` for atomic multi-table operations.
- **Database:** Enforces referential integrity, constraints, and RLS.
