# Security and Operations Guide

The HMS API enforces strict security controls at the application and database tiers.

## Tenant Isolation & RLS Responsibilities
- **Application Tier:** The JWT validates identity. The `TenantStatusMiddleware` blocks deactivated tenants. The API uses the user's `college_id` when invoking Repositories.
- **Database Tier:** The definitive tenant barrier. Repositories inject `app.current_tenant_id` into the transaction context. PostgreSQL Row-Level Security (RLS) ensures that queries cannot cross tenant boundaries under any circumstances.

## RBAC & Entitlements
- **Module Entitlements:** Colleges must have access to specific modules (e.g., `attendance`, `leave`) via `ModuleEntitlementMiddleware`.
- **User Roles:** Validated via `PermissionMiddleware`, users must possess specific flags (e.g., `CREATE_COMPLAINT`, `MANAGE_HOSTELS`).

## Authentication & Secret Management
- Passwords use bcrypt hashing.
- JWTs use HS256 signatures derived from the `JWT_SECRET` environment variable.
- `.env` files are `.gitignore`d and must never be committed.

## Hardening and Protection
- **Request Limits:** Incoming HTTP payloads are strictly limited to 1MB (`http.MaxBytesReader`) to prevent OOM exhaustion.
- **Timeouts:** `ReadHeaderTimeout` protects against Slowloris attacks. `WriteTimeout` prevents indefinite resource locking.
- **CORS:** Controlled dynamically via `CORS_ALLOWED_ORIGINS`.
- **Database SSL:** In `production` environments, the API refuses to launch if `DB_SSLMODE=disable`.
- **Error Disclosure:** Internal database constraints and stack traces are caught by `pkg/errors` and standard `middleware.Recovery()`, emitting a generic `500` error to the client while logging securely in the `zap` structured stdout logs.

For detailed audit history, see the Phase 11 `production_hardening_report.md`.
