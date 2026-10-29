# ARCHITECTURE AUDIT: HMS SHARED CAPABILITIES 22 & 23
## Entitlement Engine + Account, Authentication and Permission Safeguards

**Audit Scope:** Shared platform capabilities across `D:\HMS\API`, `D:\HMS\MODULES\SUPER-ADMIN\BACKEND`, and `D:\HMS\MODULES\SUPER-ADMIN\FRONTEND\WEB`.  
**Date:** October 29, 2026  
**Auditor:** Antigravity AI Engineering Assistant  
**Database Schema Status:** Read-Only Audit — Zero Schema Mutations, Zero Migrations Run.

---

## 1. Executive Summary

This architecture audit investigates the current state of **Capability 22 (Entitlement Engine)** and **Capability 23 (Account, Authentication and Permission Safeguards)** in the Hostel Management System (HMS).

### Key Audit Findings:
1. **Entitlement Engine (Capability 22):**
   - **Status:** `PARTIAL`
   - **Existing Foundations:** The codebase possesses strong building blocks:
     - `platform.modules` stores a 3-tier hierarchy (`APP -> MODULE -> FEATURE`).
     - `platform.college_modules` tracks per-tenant assignments (`status`, `mode` (`FULL`/`READ_ONLY`), `effective_from`, `effective_to`).
     - `middleware.ModuleEntitlementMiddleware` (`API/internal/middleware/module_entitlement.go`) evaluates college module entitlements and enforces read-only mutate restrictions (`POST`/`PUT`/`PATCH`/`DELETE`).
     - `middleware.ApplicationAccessMiddleware` (`API/internal/middleware/application_access.go`) enforces application-level suspension/disabled status.
     - `AccessControlRepository` (`MODULES/SUPER-ADMIN/BACKEND/repository/access_control_repository.go`) implements `GetTenantAccessHierarchy` and `EvaluateWhyDenied`.
   - **Architectural Gaps:**
     - The shared API currently checks application access and tenant status at the root of `/college`, but granular module entitlement (`RequireModule`) is only wired on demonstration routes (`/hostel-test`) rather than comprehensively across all functional sub-routes (`/students`, `/hostels`, `/mess`, `/leaves`, `/complaints`).
     - There is no single unified decision service in `API/internal/service` unifying the 7-factor logical rule:
       `ALLOW = VALID_IDENTITY AND CORRECT_SCOPE AND ACTIVE_TENANT AND APPLICATION_ALLOWED AND MODULE_ALLOWED AND FEATURE_ACTION_ALLOWED AND USER_PERMISSION_GRANTED`.
     - Caching is non-existent: every check queries PostgreSQL directly without an in-memory TTL bounded cache.
     - Cyclic dependency checking is not required by the current schema because `platform.modules` uses a strict hierarchical tree (`parent_id` foreign key referencing `platform.modules(module_id)`), not an arbitrary graph.

2. **Account, Authentication and Permission Safeguards (Capability 23):**
   - **Status:** `PARTIAL`
   - **Existing Foundations:**
     - Scope separation (`PLATFORM` vs `COLLEGE`) is strictly enforced via cryptographically signed JWT claims (`claims.go`, `scope_middleware.go`). Platform tokens have `college_id = NULL`.
     - User account statuses (`ACTIVE`, `LOCKED`, `SUSPENDED`, `DEACTIVATED`, `INVITED`) are verified during authentication in `auth/service.go`.
     - Passwords use bcrypt hashing (`golang.org/x/crypto/bcrypt`).
     - Rate limiting is active via `middleware.RateLimit` (IP-based token bucket).
     - Security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, and CSP `default-src 'none'`) are applied globally in `router.go`.
     - 1MB request body limit is enforced globally.
   - **Architectural & Security Gaps:**
     - **MFA:** `app.users.mfa_enabled` exists, and `auth/service.go` correctly **fails closed** (`"MFA verification required; second-factor verification is not yet available"`). However, TOTP secrets or recovery storage tables do not exist in the schema.
     - **Stateless JWT Exposure Window:** Access tokens are stateless HS256 JWTs with a configured duration (typically 24 hours). If an account is locked or a role revoked mid-session, the already-issued token remains valid until expiration unless individual route middleware checks user status or an active token revocation blocklist is consulted.
     - **Maker-Checker Self-Approval:** The approval engine in `platform_approval_decision_service.go` checks maker-checker separation for specific operations, but direct database executions must be safeguarded.

---

## 2. Requirement-by-Requirement Audit Matrix

### PART A: Capability 22 — Entitlement Engine

| Requirement | Implementation & File Location | Database Support | Enforced by Backend? | Gaps & Limitations | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **B1. Authoritative Decision Service** | `MODULES/SUPER-ADMIN/BACKEND/repository/access_control_repository.go` (`EvaluateWhyDenied`), `API/internal/middleware/module_entitlement.go` | `platform.modules`, `platform.college_modules` | Partial (split between Super Admin backend and shared API middleware) | Needs a single cohesive `EntitlementService` in `API/internal/service` that unifies tenant status, application status, module entitlement, and permission checking. | `PARTIAL` |
| **B2. Effective-Access Decision Rule** | `access_control_repository.go` (6-stage evaluation), `router.go` (middleware chain) | `platform.colleges`, `platform.college_modules`, `platform.permissions`, `platform.user_roles` | Yes | Needs complete chain applied systematically across all college domain endpoints. | `PARTIAL` |
| **B3. Fail-Closed Handling** | `module_entitlement.go` (returns 401/403/500), `access_control_repository.go` | Standard PostgreSQL | Yes | Returns structured non-sensitive error payloads without SQL leakage. | `IMPLEMENTED` |
| **B4. Catalogue & Hierarchy Validation** | `platform.modules` (`parent_id`, `kind IN ('APP', 'MODULE', 'FEATURE')`) | `parent_id` FK to `platform.modules` | Yes | Parent-child tree structure prevents cyclic loops via foreign key constraints. Missing prerequisites check exists in `access_control_repository.go`. | `IMPLEMENTED` |
| **B5. Effective Dates & State** | `platform.college_modules.effective_from`, `effective_to`, `status` | Supported in `001_platform.sql` & `010_super_admin_platform.sql` | Yes | Evaluated in `checkModuleEntitlement` and `EvaluateWhyDenied`. Expired and future dates are strictly denied. | `IMPLEMENTED` |
| **B6. Route Tagging & Enforcement** | `API/internal/server/router.go` | N/A | Partial | Protected endpoints currently have `RequirePermission`, but lack module-specific `RequireModule` tags (e.g. `/leaves` lacks `RequireModule("LEAVE")`). | `PARTIAL` |
| **B7. Caching & Versioning** | In-memory only (None configured for entitlements) | No version column or Redis | No | Direct database queries on every request. In-process TTL cache can be safely introduced without external dependencies. | `MISSING` |
| **B8. Entitlement Administration** | `MODULES/SUPER-ADMIN/BACKEND/handlers/access_control_handler.go`, `college_module_handler.go` | `platform.college_modules` | Yes | Platform permissions (`platform.manage`) and audit logging enforced. | `IMPLEMENTED` |
| **B9. Denial Logging** | `platform.login_events`, `platform.audit_logs` | `platform.audit_logs` | Partial | Authentication denials are logged. Entitlement denials currently return HTTP 403 without writing to `platform.audit_logs` to prevent DB log saturation. | `PARTIAL` |

---

### PART B: Capability 23 — Account, Authentication and Permission Safeguards

| Requirement | Implementation & File Location | Database Support | Enforced by Backend? | Gaps & Limitations | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **C1. Identity & Scope Separation** | `API/internal/auth/claims.go`, `scope_middleware.go` | `platform.roles.scope` (`PLATFORM` vs `COLLEGE`) | Yes | Strict cryptographic validation. Platform tokens cannot access college routes; college tokens cannot access platform routes. | `IMPLEMENTED` |
| **C2. Permission Checks** | `API/internal/middleware/permission.go`, `API/internal/repository/permission_repository.go` | `platform.permissions`, `platform.role_permissions` | Yes | `RequirePermission` verifies active role assignments and matching scope. | `IMPLEMENTED` |
| **C3. Separation of Duties (Maker-Checker)** | `API/internal/service/platform_approval_decision_service.go` | `platform.approval_requests`, `platform.approval_steps` | Yes | Requester cannot approve their own request (`requested_by != approver_id`). | `IMPLEMENTED` |
| **C4. Multi-Factor Authentication (MFA)** | `API/internal/auth/service.go` | `app.users.mfa_enabled` | Partial (Fail-closed) | Accounts with `mfa_enabled = true` are blocked from login with a fail-closed message. Real TOTP enrollment is blocked by missing schema tables. | `PARTIAL` |
| **C5. Session & Token Revocation** | `API/internal/auth/jwt.go` | Stateless JWTs | Partial | JWTs expire after token duration. Immediate revocation of existing JWTs prior to expiration is limited by stateless design (documented exposure window). | `PARTIAL` |
| **C6. Password Resets & Lockouts** | `API/internal/auth/service.go` | `app.users.status = 'LOCKED'` | Yes | Bcrypt hashing, account lockout checks, and failure logging in `platform.login_events`. | `IMPLEMENTED` |
| **C7. Rate Limiting** | `API/internal/middleware/rate_limit.go` | In-memory token bucket (`golang.org/x/time/rate`) | Yes | Differentiates `/auth/` (strict) vs general endpoints. Cleaned up via periodic ticker. | `IMPLEMENTED` |
| **C8. Browser & HTTP Security** | `API/internal/middleware/cors.go`, `API/internal/server/router.go` | N/A | Yes | Restrictive CORS allowlist, security headers (`nosniff`, `DENY`, strict referrer, CSP), 1MB body limit. | `IMPLEMENTED` |
| **C9. Database & Secrets Safeguards** | `API/internal/database/database.go` | Split pools (`platform_pool` vs `college_pool`) | Yes | Parameterized SQL queries, RLS tenant isolation (`SET LOCAL app.current_tenant_id`). No credentials leaked in logs. | `IMPLEMENTED` |
| **C10. Security Auditing** | `platform.audit_logs`, `platform.login_events` | `001_platform.sql`, `015_audit_logs_tamper_evidence.sql` | Yes | SHA-256 tamper-evident hash chaining, before/after diffs, IP and user-agent logging. | `IMPLEMENTED` |

---

## 3. Detailed Technical Analysis

### 3.1. Entitlement Decision Architecture

The platform architecture defines that an entitlement decision must follow:
$$\text{ALLOW} = \text{Valid Identity} \land \text{Correct Scope} \land \text{Active Tenant} \land \text{App Allowed} \land \text{Module Allowed} \land \text{Mode Allowed} \land \text{User Permission}$$

Currently:
1. **Scope & Identity:** `RequireAuth()` + `RequireCollegeScope()` enforces identity and scope.
2. **Tenant Context & Status:** `TenantContextMiddleware()` + `RequireActiveTenant()` enforces active tenant lifecycle.
3. **Application Access:** `RequireActiveApplication()` verifies `platform.college_settings` for `app_config.<app_id>`.
4. **Module & Mode:** `RequireModule(code)` checks `platform.college_modules` and restricts mutate methods if `mode == 'READ_ONLY'`.
5. **User Permission:** `RequirePermission(code)` checks `platform.role_permissions`.

**Remediation Plan:**
To achieve 100% route coverage without breaking existing tests, we will:
1. Wire `moduleEntitlementMiddleware.RequireModule(...)` onto the relevant college route groups:
   - Hostel operations: `HOSTEL`
   - Bed allocation: `HOSTEL` / `ALLOCATION`
   - Attendance: `ATTENDANCE`
   - Leaves: `LEAVE`
   - Mess operations: `MESS`
   - Complaints & Maintenance: `COMPLAINTS` / `MAINTENANCE`
   - Reports: `REPORTS`
2. Create an authoritative `EntitlementEngine` service in `API/internal/service/entitlement_service.go` providing a unified `EvaluateAccess(ctx, req)` method that wraps all 7 checks in a single high-performance call, complete with a bounded in-memory TTL cache (e.g. 60 seconds) to prevent database saturation.

---

### 3.2. Authentication & Permission Safeguards

1. **Stateless JWT Lifetime:**
   - JWT tokens have a duration of 24h by default.
   - For high-security environments, token revocation requires either:
     a) Checking the database user status on every request (adds latency unless cached).
     b) A short-lived token (e.g. 15 minutes) with refresh tokens.
     c) An in-memory revocation blocklist (token IDs / user timestamps).
   - *Current capability:* `app.users.status` is checked at login time. Once a token is issued, it remains valid until expiry. We will document this exposure window.

2. **MFA Production Readiness:**
   - `app.users.mfa_enabled` exists in PostgreSQL.
   - `auth/service.go` safely **fails closed** if `mfa_enabled = true`.
   - Real TOTP requires tables like `platform.user_mfa_secrets` (secret key, backup codes, confirmed status), which do not exist in the database. Per non-negotiable constraint #2 and #8, we will **NOT** fabricate tables, but will verify the fail-closed protection in tests.

3. **Rate Limiting:**
   - In-memory rate limiting using `golang.org/x/time/rate` protects against brute-force attacks on `/auth/login`.
   - Bounded cleanup prevents memory leaks.

---

## 4. Minimal Safe Remediation Scope

1. **Backend (`API/internal/service/entitlement_service.go`):**
   - Create authoritative `EntitlementService` implementing:
     - 7-factor evaluation rule.
     - In-memory thread-safe TTL cache (60s duration with LRU/map expiration).
     - Cache invalidation method for tenant entitlement updates.
     - Detailed diagnostic reason generation without sensitive data leaks.
2. **Backend (`API/internal/server/router.go`):**
   - Wire `moduleEntitlementMiddleware.RequireModule(...)` to all college module route endpoints so that disabled modules reject requests before executing domain handlers.
3. **Backend Unit & Isolation Tests:**
   - Create `API/internal/service/entitlement_service_test.go` verifying:
     - Active tenant + valid entitlement + permission = ALLOW.
     - Suspended tenant = DENY.
     - Disabled module = DENY.
     - Expired entitlement = DENY.
     - Future entitlement = DENY.
     - Read-only mode blocking POST/PUT/DELETE while allowing GET.
     - Missing user permission = DENY.
     - In-memory cache isolation and invalidation.
   - Create `API/internal/auth/safeguards_test.go` verifying:
     - MFA fail-closed behavior.
     - Scope separation (Platform token on College route rejected; College token on Platform route rejected).
     - Account lockout rejection.

---

## 5. Items Requiring Separate Approval (Future Scope)

The following items are blocked by existing schema/infrastructure constraints and cannot be implemented without database changes:
1. **Persistent TOTP MFA:** Requires `platform.user_mfa_credentials` table (TOTP secret, recovery codes, verified timestamp).
2. **Cluster-Wide Distributed Rate Limiting & Revocation:** Requires distributed Redis/Valkey infrastructure.
3. **Persistent Token Revocation Blocklist Table:** Requires `platform.revoked_tokens` table.
