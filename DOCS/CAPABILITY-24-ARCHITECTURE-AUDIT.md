# ARCHITECTURE AUDIT: HMS SHARED CAPABILITY 24
## Versioning, Event Propagation & Platform Observability

**Audit Scope:** Shared platform capabilities across `D:\HMS\API`, `D:\HMS\MODULES\SUPER-ADMIN\BACKEND`, `D:\HMS\MODULES\SUPER-ADMIN\FRONTEND\WEB`, and `D:\HMS\DOCS`.  
**Date:** October 29, 2026  
**Auditor:** Antigravity AI Engineering Assistant  
**Database Schema Status:** Read-Only Audit — Zero Schema Mutations, Zero Migrations Run, Zero Records Modified.

---

## 1. Executive Summary

This architecture audit evaluates the shared platform infrastructure of the Hostel Management System (HMS) against the requirements of **Shared Capability 24**:
1. Configuration and entitlement versioning.
2. Change-event publication and consumption.
3. Cache invalidation and refresh.
4. Application bootstrap/configuration APIs.
5. Request and correlation ID propagation.
6. Structured logging and secret redaction.
7. Consistent JSON error responses.
8. Health checks and platform observability.
9. Idempotency for sensitive write operations.
10. Backward-compatible API integration.

### Summary Assessment Matrix

| Capability Dimension | Current Status | Primary Mechanism | Critical Gaps & Limitations |
| :--- | :--- | :--- | :--- |
| **1. Configuration Versioning** | `PARTIAL` | `platform.system_settings_history` (audit diffs); `platform.entitlement_templates.version`; `updated_at` on settings | `platform.college_settings` and `platform.college_modules` lack explicit version columns. Optimistic concurrency (`If-Match`) is not enforced. |
| **2. Event Propagation** | `BLOCKED` | None (No message broker, no outbox table, no Postgres `LISTEN/NOTIFY`) | Cross-process durable event propagation is impossible without schema extensions or message brokers. Best-effort in-process dispatch is only viable within a single binary. |
| **3. Cache Invalidation** | `IMPLEMENTED` | In-memory thread-safe TTL cache (`EntitlementService`) with tenant key prefix eviction | Cache is in-process (`sync.RWMutex` + `map`). Multi-instance cache synchronization requires distributed cache or pub/sub (currently absent). |
| **4. Bootstrap API** | `PARTIAL` | `/college/context` exists (returns tenant ID); `/auth/me` exists | No unified authenticated `/college/bootstrap` endpoint returning tenant-scoped enabled modules, effective modes, and public settings. |
| **5. Request / Correlation ID** | `PARTIAL` | `middleware.RequestID` (`X-Request-ID`) | Client-supplied `X-Request-ID` is not validated for length/content. Downstream panic recovery does not log `request_id`. |
| **6. Logging & Secret Redaction** | `IMPLEMENTED` | `middleware.Logger` (`go.uber.org/zap`), dual pool setup | Passwords and JWTs are not logged. Need to ensure client-supplied parameters and panics strictly sanitize secrets. |
| **7. Consistent JSON Errors** | `PARTIAL` | `API/pkg/response` and `API/pkg/errors` | `response.Error` omits `err.Details`. Some Super Admin handlers use `gin.H{"error": "..."}` instead of structured `ErrorResponse`. |
| **8. Observability & Health** | `IMPLEMENTED` | `/health`, `/health/db`, `/super-admin/monitoring/metrics` | `/health/db` lacks bounded timeout on connection pool `Ping(ctx)`. No Prometheus/OpenTelemetry instrumentation. |
| **9. Idempotency** | `PARTIAL` | Database UNIQUE constraints + row locks (`FOR UPDATE`) | No HTTP `Idempotency-Key` header processing or persistent idempotency store. Multi-instance replay protection is limited to domain constraints. |
| **10. API Compatibility** | `MAINTAINED` | Registered routes preserved across `/college` and `/super-admin` | Frontends depend on both `{ "data": ... }` and `{ "success": true, "data": ... }`. Error responses must preserve `code` and `message`. |

---

## 2. Component Inventory & Existing File Paths

### 2.1. Shared Platform Middleware & Server (`D:\HMS\API`)
- **Router & Server Bootstrap:** `API/internal/server/router.go`
- **Request ID Middleware:** `API/internal/middleware/request_id.go`
- **Structured Request Logger:** `API/internal/middleware/logger.go`
- **Panic Recovery Middleware:** `API/internal/middleware/recovery.go`
- **Tenant Context Middleware:** `API/internal/middleware/tenant_context.go`
- **Tenant Lifecycle Status:** `API/internal/middleware/tenant_status.go`
- **Tenant Dual-Pool Transaction:** `API/internal/middleware/tenant_transaction.go`
- **Application Access & SemVer:** `API/internal/middleware/application_access.go`
- **Module Entitlement Middleware:** `API/internal/middleware/module_entitlement.go`
- **Role Permission Middleware:** `API/internal/middleware/permission.go`
- **Rate Limiting:** `API/internal/middleware/rate_limit.go`
- **CORS & Security Headers:** `API/internal/middleware/cors.go`
- **Database Pools:** `API/internal/database/postgres.go`

### 2.2. Standard Response & Error Envelopes (`D:\HMS\API\pkg`)
- **Response Format:** `API/pkg/response/response.go`
- **Error Response Helper:** `API/pkg/response/error.go`
- **Error Codes:** `API/pkg/errors/codes.go`
- **API Error Struct:** `API/pkg/errors/error.go`
- **HTTP Status Mapping:** `API/pkg/errors/mapping.go`

### 2.3. Super Admin Operations & Control Plane (`D:\HMS\MODULES\SUPER-ADMIN\BACKEND`)
- **Route Registration:** `MODULES/SUPER-ADMIN/BACKEND/routes/routes.go`
- **Monitoring & Telemetry Service:** `MODULES/SUPER-ADMIN/BACKEND/services/monitoring_service.go`
- **Operations & Support Handlers:** `MODULES/SUPER-ADMIN/BACKEND/handlers/operations_handler.go`
- **College Lifecycle Service:** `MODULES/SUPER-ADMIN/BACKEND/services/college_service.go`
- **Module Entitlement Repository:** `MODULES/SUPER-ADMIN/BACKEND/repository/module_repository.go`
- **Global System Settings Repository:** `MODULES/SUPER-ADMIN/BACKEND/repository/system_settings_repository.go`
- **Approval Decision Service:** `API/internal/service/platform_approval_decision_service.go`
- **Authoritative Entitlement Engine:** `API/internal/service/entitlement_service.go`

### 2.4. Frontend API Clients (`D:\HMS\MODULES`)
- **Super Admin Web Client:** `MODULES/SUPER-ADMIN/FRONTEND/WEB/src/services/api.js`
- **College Admin Web Client:** `MODULES/ADMIN/FRONTEND/WEB/src/services/api.js`

---

## 3. Deep-Dive Architecture Audit

### 3.1. Configuration and Entitlement Versioning (Part A1)

1. **Database Schema State:**
   - `platform.colleges`: Contains lifecycle timestamps (`activated_at`, `suspended_at`, `deactivated_at`, `archived_at`) and `updated_at`. No `version` integer column.
   - `platform.college_settings`: Stores key-value settings as JSONB. Unique on `(college_id, setting_key)`. Contains `created_at` and `updated_at`. No `version` or revision column.
   - `platform.college_modules`: Unique on `(college_id, module_id)`. Tracks `status`, `mode`, `effective_from`, `effective_to`, `reason`, `changed_by`, `updated_at`. No explicit `version` column.
   - `platform.entitlement_templates`: Explicitly includes `version integer NOT NULL DEFAULT 1`.
   - `platform.system_settings`: Stores global platform configuration. Paired with `platform.system_settings_history` which logs historical diffs (`old_value`, `new_value`, `action`, `reason`, `actor_user_id`, `created_at`).

2. **Concurrency Guarantees:**
   - **Row Locking:** `college_service.go` enforces pessimistic concurrency using `SELECT status FROM platform.colleges WHERE college_id = $1 FOR UPDATE` within a transaction. This strictly prevents concurrent lifecycle race conditions.
   - **Approval Serialization:** `approval_service.go` uses `SELECT ... FROM platform.approval_requests WHERE approval_id = $1 FOR UPDATE` to serialize maker-checker decisions and prevent double execution.
   - **Optimistic Concurrency Limitation:** Because `platform.college_settings` and `platform.college_modules` lack an explicit `version` or `revision` column, updates do not validate an `If-Match` revision or ETag. Last-write-wins is the current database behavior for settings updates.
   - **Mandatory Constraint Compliance:** Per non-negotiable constraint #7 ("Do not invent schema columns, event tables, version fields"), we will **NOT** execute ALTER TABLE migrations to add version columns. Instead, we must use `updated_at` timestamps or row locking where concurrency validation is required.

---

### 3.2. Event Propagation (Part A2)

1. **Inspection of Event Infrastructure:**
   - Search for message brokers (Kafka, RabbitMQ, Redis, NATS): **NONE FOUND**.
   - Search for PostgreSQL `LISTEN` or `NOTIFY`: **NONE FOUND**.
   - Search for transactional outbox table (`platform.outbox` or `app.events`): **NONE FOUND**.
   - Search for background queues or worker daemons: **NONE FOUND**.

2. **Delivery Guarantees & Constraints:**
   - **Durable Event Delivery:** **BLOCKED by missing infrastructure**. In a multi-replica deployment, an event emitted on Node A cannot be reliably received by Node B without an outbox table or message broker.
   - **In-Process Best-Effort Delivery:** Within a single Go process, change events (e.g. `entitlement.changed`, `config.changed`, `tenant.lifecycle_changed`) can be dispatched synchronously or via in-memory observer channels to trigger cache invalidation and audit logging.
   - **Architectural Honesty:** We strictly document that in-memory event dispatch provides **best-effort, non-durable** delivery. It does not guarantee at-least-once delivery across crashes or distributed nodes.

---

### 3.3. Request Context, Logging, and Error Handling (Part A3)

1. **Request ID Validation & Propagation:**
   - `middleware.RequestID` inspects `X-Request-ID`. If empty, it generates a UUID v4 via `uuid.NewString()`.
   - **Security Vulnerability:** Client-provided `X-Request-ID` is accepted without validation. An attacker can pass arbitrary strings (e.g. 10KB strings, log injection characters `\r\n`).
   - **Remediation:** Validate client-supplied IDs. Enforce format: alphanumeric and hyphens only, maximum 64 characters. If invalid or excessive, discard and generate a fresh UUID v4.

2. **Structured Logging (`middleware.Logger`):**
   - Uses `go.uber.org/zap`.
   - Currently logs: `request_id`, `method`, `path`, `status`, `duration`, `client_ip`.
   - **Enhancements Needed:**
     - Extract `tenant_id` from context when present.
     - Extract `user_id` from JWT claims when present.
     - Add error classification when `status >= 400`.
     - Strictly avoid logging authorization headers, JWTs, passwords, or raw request bodies.

3. **Panic Recovery (`middleware.Recovery`):**
   - Recovers panics via `gin.CustomRecovery`.
   - **Defect:** Currently logs `path` and `panic`, but omits `request_id`.
   - **Defect:** Calls `response.Error(c, err)` which writes HTTP 500 JSON, followed immediately by `c.AbortWithStatus(http.StatusInternalServerError)`. In Gin, calling `AbortWithStatus` after already writing a status code can cause header write warnings. Calling `c.Abort()` is the correct pattern.

4. **Response & Error Helpers:**
   - `API/pkg/response/error.go` writes:
     ```json
     {
       "success": false,
       "error": {
         "code": "CODE",
         "message": "Message"
       },
       "request_id": "uuid"
     }
     ```
   - **Defect:** `err.Details` is omitted even if populated in `APIError`. If validation details are present, they should be safely included in `"details"`.
   - **Compatibility:** Both Super Admin and College Admin frontends (`api.js`) look for `responseData?.error?.message` and `responseData?.error?.code`. Standardizing on this format maintains 100% frontend compatibility.

---

### 3.4. Idempotency and Compatibility (Part A4)

1. **Sensitive Write Operations:**
   - College creation (`POST /super-admin/colleges`).
   - College lifecycle transitions (`PUT /super-admin/colleges/:id/status`).
   - Module assignment & updates (`POST /super-admin/colleges/:id/modules`).
   - Approval execution (`POST /super-admin/approvals/:id/decide`).
   - Support grant issuance (`POST /super-admin/support/grants`).

2. **Current Protection:**
   - Database UNIQUE constraints:
     - `uq_colleges_code` (`college_code`)
     - `uq_college_modules` (`college_id, module_id`)
     - `uq_college_settings_key` (`college_id, setting_key`)
     - `uq_entitlement_templates_code` (`template_code`)
   - Database row locks (`SELECT ... FOR UPDATE`):
     - Prevents concurrent lifecycle status updates.
     - Prevents concurrent approval execution.

3. **Idempotency Gaps:**
   - No HTTP `Idempotency-Key` header handling.
   - If an HTTP request times out on the network after the server commits the transaction, the client has no way to safely retry with an idempotency key and retrieve the previous response.
   - **Limitation:** A durable, cross-process idempotency store requires a dedicated database table (e.g. `platform.idempotency_keys` with key hash, actor ID, status, and cached response payload). Per constraint #7, we cannot create this table without schema migration approval.
   - **Safe In-Scope Remediation:** Document this limitation explicitly. Provide an in-process, bounded LRU/TTL idempotency guard for sensitive write handlers to serialize concurrent duplicates within the active server instance, while documenting that cross-replica persistence is blocked pending schema approval.

---

### 3.5. Platform Observability & Health (Part F)

1. **Existing Endpoints:**
   - `GET /health`: Returns process liveness (`{"success": true, "data": {"status": "ok"}}`).
   - `GET /health/db`: Checks connectivity of `collegePool` and `platformPool`.
   - `GET /super-admin/monitoring/metrics`: Returns aggregated database pool stats, tenant status breakdown, and sanitized recent audit errors.

2. **Observability Gaps:**
   - `/health/db` uses `c.Request.Context()` directly without a bounded ping timeout. If database connections stall or hang, the health check will hang indefinitely.
   - Metric collection is ad-hoc: pool stats are read via `stat.TotalConns()`, `stat.IdleConns()`, `stat.AcquiredConns()`. No Prometheus metrics exporter exists.
   - Diagnostic errors from database queries must not leak SQL queries, connection strings, or table names to public callers.

---

### 3.6. Authenticated Bootstrap API (Part D)

1. **Current State:**
   - `/auth/me` returns identity, role, scope, and tenant ID.
   - `/college/context` returns tenant ID.
   - No single endpoint exists for a college application to bootstrap its UI with:
     - Tenant profile (name, code, timezone, status).
     - Entitled modules and their effective access modes (`FULL` vs `READ_ONLY`).
     - Tenant-specific non-sensitive configurations (e.g. curfew hours, attendance grace period, gate pass policies).

2. **Requirements for New `/college/bootstrap` Endpoint:**
   - Mount under `collegeProtected` route group in `router.go`.
   - Enforce authentication, `COLLEGE` scope, and active tenant status.
   - Derive `tenant_id` exclusively from server-side JWT context (never accept user-supplied query params).
   - Filter `platform.college_settings` to exclude `is_sensitive = true` records (passwords, webhook secrets, API keys).
   - Return cache consistency metadata (`evaluated_at`, `cache_ttl_seconds`).

---

## 4. Proposed Files for Modification

To address the findings of Capability 24 safely without violating constraints:

| File Path | Nature of Change | Rationale |
| :--- | :--- | :--- |
| `API/internal/middleware/request_id.go` | Sanitization & Validation | Validate client-supplied `X-Request-ID` (alphanumeric/hyphen, max 64 chars). Discard invalid IDs and regenerate UUID v4. |
| `API/internal/middleware/logger.go` | Structured Enrichment | Enrich logs with `tenant_id`, `user_id`, and error classification without logging sensitive bodies. |
| `API/internal/middleware/recovery.go` | Fix Double Write & Log Request ID | Include `request_id` in panic log and replace `c.AbortWithStatus` with `c.Abort()` after `response.Error`. |
| `API/pkg/response/error.go` | Include Error Details | Safely include `err.Details` in `safeError["details"]` when present for rich validation reporting. |
| `API/internal/server/router.go` | Add Timeout to `/health/db` & Add `/college/bootstrap` | Apply 3-second context timeout on database pool pings; wire authenticated `/college/bootstrap` route. |
| `API/internal/service/bootstrap_service.go` | New Shared Service | Encapsulate tenant bootstrap configuration gathering (modules, modes, non-sensitive settings). |
| `API/internal/service/event_dispatcher.go` | In-Process Event Propagation | In-process pub/sub event dispatcher supporting `entitlement.changed`, `config.changed`, and `tenant.lifecycle_changed` with cache invalidation hooks. |
| `MODULES/SUPER-ADMIN/BACKEND/routes/routes.go` | Wire Cache Invalidation | Trigger event dispatcher on module entitlement updates and college lifecycle transitions. |

---

## 5. Features Blocked by Missing Infrastructure

Per prompt instructions, the following capabilities are explicitly documented as **BLOCKED**:

1. **Durable Distributed Event Propagation:**
   - *Reason:* No message broker (Kafka/RabbitMQ/Redis) or PostgreSQL outbox table exists in the schema.
   - *Prerequisite:* Schema migration to create `platform.outbox_events` table and a persistent background worker.

2. **Persistent Multi-Instance Idempotency:**
   - *Reason:* No idempotency storage table exists in PostgreSQL.
   - *Prerequisite:* Schema migration to create `platform.idempotency_keys` (`idempotency_key`, `actor_id`, `request_hash`, `status`, `response_body`, `expires_at`).

3. **Optimistic Concurrency on College Settings & Modules:**
   - *Reason:* `platform.college_settings` and `platform.college_modules` do not have an integer `version` column.
   - *Prerequisite:* Schema migration to add `version integer NOT NULL DEFAULT 1` to both tables.

---

## 6. Audit Conclusion & Next Steps

The existing architecture provides solid transactional boundaries, row locking for critical workflows, dual-pool connection management, and secure token scope validation.

The read-only audit is complete. Proceed to **Part B through Part H** implementation following the minimal safe remediation scope:
1. Harden Request ID, Structured Logging, and Panic Recovery.
2. Implement in-process Event Dispatcher and wire cache invalidation.
3. Provide the authenticated `/college/bootstrap` configuration endpoint.
4. Add timeout protection to `/health/db`.
5. Execute Go tests and frontend build to verify zero regressions.
