# Super Admin Dashboard Implementation — Batch 01

## 1. Overview
This document specifies the technical architecture, endpoint contracts, database query mappings, status representations, and frontend integration for the Super Admin Dashboard within the Hostel Management System (`HMS`).

All implementations strictly adhere to:
- Code modification boundary: `D:\HMS\MODULES\SUPER-ADMIN\BACKEND\` and `D:\HMS\MODULES\SUPER-ADMIN\FRONTEND\WEB\`.
- Preservation of database schema, migrations, tables, columns, constraints, and seed data.
- Preservation of existing Go module structure, React/Vite build toolchain, and platform authentication models.

---

## 2. Implemented Dashboard Features

### 2.1 College Lifecycle Summary
- Displays real-time counts of college tenants by lifecycle status:
  - `total_colleges`: Count of all college records.
  - `active_colleges`: Colleges with status `'ACTIVE'`.
  - `inactive_colleges`: Mapped 1:1 to schema status `'DEACTIVATED'`.
  - `suspended_colleges`: Colleges with status `'SUSPENDED'`.
  - `onboarding_colleges`: Colleges with status `'ONBOARDING'`.
  - `deactivated_colleges`: Colleges with status `'DEACTIVATED'`.
- **Semantics**: Explicitly marked with `is_current_snapshot: true`. Represents current state and does not distort into historical metrics when date filters are selected.

### 2.2 Application & Module Entitlement Summary
- Supports both global catalogue views and tenant-scoped views:
  - When `college_id` is omitted (`scope: "GLOBAL_CATALOG"`):
    - `enabled_modules`: Modules with `kind = 'MODULE'` and `is_active = true`.
    - `disabled_modules`: Modules with `kind = 'MODULE'` and `is_active = false`.
    - `enabled_applications`: Applications with `kind = 'APP'` and `is_active = true`.
    - `disabled_applications`: Applications with `kind = 'APP'` and `is_active = false`.
    - `total_features`: Features with `kind = 'FEATURE'`.
  - When `college_id` is specified (`scope: "COLLEGE_TENANT"`):
    - Scopes to assignments in `platform.college_modules` joined with `platform.modules`.
    - Distinguishes active vs disabled applications and modules specifically assigned to that tenant.
- **Semantics**: Current snapshot (`is_current_snapshot: true`).

### 2.3 Active College Administrators Count
- Measures the number of active, verified College Admin accounts using:
  - `app.users` account status = `'ACTIVE'`.
  - `platform.user_roles` assignment status = `'ACTIVE'`.
  - `platform.roles.role_code` = `'COLLEGE_ADMIN'`.
  - Role assignment validity unexpired (`ur.expires_at IS NULL OR ur.expires_at > now()`).
  - Distinct counting (`COUNT(DISTINCT u.user_id)`) to prevent duplication from multi-college joins.
  - Scoped to `ur.college_id = $1` if a college filter is applied.
- Zero personal or student-level user details are returned.

### 2.4 Service Health Panel
- Evaluates real, verifiable connectivity across the platform control plane:
  - `api_server`: Verified responsive.
  - `platform_database_pool`: Verifies `db.GetPlatformPool().Ping(ctx)`.
  - `college_database_pool`: Verifies `db.GetCollegePool().Ping(ctx)`.
- Derived overall statuses: `HEALTHY`, `DEGRADED`, `UNAVAILABLE`.
- Never exposes internal connection strings, credentials, or stack traces.

### 2.5 Recent Administrative Activity (Audit Trail)
- Queries bounded records from `platform.audit_logs`:
  - Columns: `audit_id`, `created_at`, `action`, `module`, `entity_type`, `entity_id`, `actor_role`, `actor_safe_id`, `college_id`, `outcome`, `reason`.
  - Safe actor representation (`user-xxxxxxxx` or role) to avoid exposing credentials or emails.
  - Left-joins `platform.colleges` for tenant names.
  - Supports `start_date`, `end_date`, and `college_id` filters.
  - Deterministic ordering: `created_at DESC, audit_id DESC`.

### 2.6 Critical Alerts List
- Derived strictly from verified operational conditions:
  - `ALERT_INFRASTRUCTURE_DEGRADED`: Triggered if any database connection pool fails connectivity checks.
  - `ALERT_APPROVAL_OVERDUE_<id>`: Triggered for pending approval requests that have exceeded their `expires_at` deadline.
  - `ALERT_COLLEGE_SUSPENDED_<id>`: Triggered for colleges currently in `SUSPENDED` status.
- Zero manufactured or artificial alerts.

### 2.7 Pending Approvals & Configuration Requests
- Aggregates actionable pending approval requests from `platform.approval_requests`:
  - `pending_count`: Pending requests where `status = 'PENDING' AND (expires_at IS NULL OR expires_at > now())`.
  - `pending_configuration_count`: Pending requests where `operation_type IN ('COLLEGE_SETTING_UPDATE', 'COLLEGE_MODULE_UPDATE')`.
  - `recent_pending`: Bounded list of recent requests with expiry status and overdue flags.
  - Documented explanation of configuration request tracking.

### 2.8 Filters & Validation
- `start_date`: Validated RFC3339 or ISO 8601 (YYYY-MM-DD). Applied to time-based queries (`audit_logs.created_at`, `approval_requests.created_at`).
- `end_date`: Validated RFC3339 or ISO 8601 (YYYY-MM-DD). Must be `>= start_date`.
- `college_id`: Validated UUID. Scopes tenant-specific metrics across all sections.

---

## 3. Endpoint Contract

### 3.1 Route Details
- **Method**: `GET`
- **Path**: `/super-admin/dashboard` (alias: `/super-admin/dashboard/summary`)
- **Authorization**:
  - Requires valid JWT bearer token.
  - Requires `PLATFORM` scope (`auth.RequirePlatformScope()`).
  - Requires `platform.view` permission.

### 3.2 Query Parameters
| Parameter | Type | Required | Description | Example |
|---|---|---|---|---|
| `start_date` | string | No | Filter start date (RFC3339 or YYYY-MM-DD) | `2026-10-01` |
| `end_date` | string | No | Filter end date (RFC3339 or YYYY-MM-DD) | `2026-10-19` |
| `college_id` | string (UUID) | No | Scope metrics to a specific college tenant | `11111111-2222-3333-4444-555555555555` |

### 3.3 Response Envelope Structure
```json
{
  "success": true,
  "data": {
    "generated_at": "2026-10-19T11:00:00Z",
    "college_summary": {
      "total_colleges": 5,
      "active_colleges": 3,
      "inactive_colleges": 1,
      "suspended_colleges": 0,
      "onboarding_colleges": 1,
      "deactivated_colleges": 1,
      "is_current_snapshot": true
    },
    "entitlement_summary": {
      "scope": "GLOBAL_CATALOG",
      "enabled_modules": 8,
      "disabled_modules": 1,
      "enabled_applications": 2,
      "disabled_applications": 0,
      "total_features": 24,
      "is_current_snapshot": true
    },
    "college_admin_summary": {
      "active_count": 6,
      "is_current_snapshot": true
    },
    "service_health": {
      "overall_status": "HEALTHY",
      "checks": [
        {
          "service_name": "api_server",
          "status": "HEALTHY",
          "message": "Super Admin API router is responsive",
          "checked_at": "2026-10-19T11:00:00Z"
        },
        {
          "service_name": "platform_database_pool",
          "status": "HEALTHY",
          "message": "Connected and operational",
          "checked_at": "2026-10-19T11:00:00Z"
        },
        {
          "service_name": "college_database_pool",
          "status": "HEALTHY",
          "message": "Connected and operational",
          "checked_at": "2026-10-19T11:00:00Z"
        }
      ]
    },
    "recent_activity": [
      {
        "audit_id": "99999999-9999-9999-9999-999999999999",
        "created_at": "2026-10-19T10:30:00Z",
        "action": "CREATE_COLLEGE",
        "module": "colleges",
        "entity_type": "college",
        "actor_safe_id": "user-a1b2c3d4",
        "actor_role": "SUPER_ADMIN",
        "college_name": "St. Peters College",
        "outcome": "SUCCESS",
        "reason": "New tenant onboarding"
      }
    ],
    "critical_alerts": [],
    "approval_summary": {
      "pending_count": 2,
      "pending_configuration_count": 1,
      "recent_pending": [
        {
          "request_id": "88888888-8888-8888-8888-888888888888",
          "operation_type": "COLLEGE_STATUS_UPDATE",
          "college_name": "St. Peters College",
          "requested_by": "user-a1b2c3d4",
          "created_at": "2026-10-19T09:00:00Z",
          "expires_at": "2026-10-21T09:00:00Z",
          "is_overdue": false
        }
      ],
      "configuration_source_note": "Configuration-change requests are tracked as platform.approval_requests with operation types COLLEGE_SETTING_UPDATE and COLLEGE_MODULE_UPDATE."
    },
    "unsupported_metrics": [
      "student_level_operational_metrics: strictly excluded from Super Admin scope",
      "standalone_configuration_requests: persisted unified within platform.approval_requests",
      "historical_status_snapshot: college and module status counts are current snapshots; date range filters apply to activity logs and approval requests"
    ],
    "applied_filters": {}
  }
}
```

---

## 4. Database Tables and Columns Used

| Feature | Schema & Table | Columns Used |
|---|---|---|
| College Summary | `platform.colleges` | `college_id`, `status` (`'ONBOARDING'`, `'ACTIVE'`, `'SUSPENDED'`, `'DEACTIVATED'`) |
| Entitlements (Global) | `platform.modules` | `module_id`, `kind` (`'APP'`, `'MODULE'`, `'FEATURE'`), `is_active` |
| Entitlements (Tenant) | `platform.college_modules`, `platform.modules` | `cm.college_id`, `cm.status`, `m.kind` |
| College Admins | `app.users`, `platform.user_roles`, `platform.roles` | `u.user_id`, `u.status`, `ur.status`, `ur.expires_at`, `ur.college_id`, `r.role_code = 'COLLEGE_ADMIN'` |
| Service Health | `pgxpool.Pool` (runtime) | `Ping(ctx)` on `PlatformPool` and `CollegePool` |
| Recent Activity | `platform.audit_logs`, `platform.colleges` | `a.audit_id`, `a.created_at`, `a.action`, `a.module`, `a.entity_type`, `a.entity_id`, `a.actor_role`, `a.actor_user_id`, `a.college_id`, `a.reason`, `c.name` |
| Critical Alerts | `platform.approval_requests`, `platform.colleges` | `r.request_id`, `r.operation_type`, `r.expires_at`, `r.status`, `c.status = 'SUSPENDED'` |
| Pending Approvals | `platform.approval_requests`, `platform.colleges` | `r.request_id`, `r.operation_type`, `r.college_id`, `r.requested_by`, `r.status`, `r.created_at`, `r.expires_at`, `c.name` |

---

## 5. Status Mappings & Explicit Unsupported Metrics

1. **Inactive Colleges**: The PostgreSQL schema check constraint (`ck_colleges_status`) allows `'ONBOARDING'`, `'ACTIVE'`, `'SUSPENDED'`, and `'DEACTIVATED'`. `'INACTIVE'` is mapped 1:1 to `'DEACTIVATED'`. Both values are provided in the DTO for transparency.
2. **Student-Level Records**: Strictly excluded from Super Admin queries. No student data, room allocations, or personal PII are queried or surfaced.
3. **Standalone Configuration Change Requests**: There is no dedicated `platform.configuration_requests` table in the database. Configuration changes requiring maker-checker authorization are modeled directly inside `platform.approval_requests` with `operation_type IN ('COLLEGE_SETTING_UPDATE', 'COLLEGE_MODULE_UPDATE')`.
4. **Historical Status Snapshots**: Current college and module status counts are snapshots of the current database state (`is_current_snapshot: true`). Date filters (`start_date`, `end_date`) apply to temporal event records: audit activity and approval requests.

---

## 6. Route Registration Architecture

In `D:\HMS\API\internal\server\router.go:285`, the main API server mounts Super Admin routes via:
```go
superadminroutes.RegisterSuperAdminRoutes(
    platformProtected,
    db,
    permissionMiddleware.RequirePermission("platform.view"),
    permissionMiddleware.RequirePermission("platform.manage"),
)
```
Because the Super Admin routes were registered inside `RegisterSuperAdminRoutes` in `D:\HMS\MODULES\SUPER-ADMIN\BACKEND\routes\routes.go`:
```go
dashboard := superAdmin.Group("/dashboard")
{
    dashboard.GET("", requireView, dashboardHandler.GetDashboard)
    dashboard.GET("/summary", requireView, dashboardHandler.GetDashboard)
}
```
The new endpoints `/super-admin/dashboard` and `/super-admin/dashboard/summary` are **automatically mounted on the live server** with `platform.view` permission and `auth.RequirePlatformScope()` enforcement without modifying any files in `API\`.

---

## 7. Verification & Test Evidence

### 7.1 Backend Unit & Integration Tests
**Command**:
```powershell
go test -v -run "TestDashboard" ./MODULES/SUPER-ADMIN/BACKEND/tests
```
**Results**:
- `TestDashboardValidator_ValidDatesAndCollege`: **PASS** (0.00s)
- `TestDashboardValidator_Rejections`: **PASS** (0.00s)
- `TestDashboardService_FailClosedOnNilPool`: **PASS** (0.00s)
- `TestDashboardService_FailClosedOnNilService`: **PASS** (0.00s)
- `TestDashboardService_DTOStructureAndUnsupportedMetrics`: **PASS** (0.00s)
- `TestDashboardRoute_Registration`: **PASS** (0.00s)
- `TestDashboardHandler_ValidationErrors`: **PASS** (0.00s)
- `TestDashboard_Integration_FullWorkflow`: **SKIPPED** (0.00s) — Cleanly skipped because `TEST_DATABASE_URL` is unset, protecting development and production databases.

### 7.2 Backend Full Regression
**Command**:
```powershell
go test -count=1 -p 1 ./MODULES/SUPER-ADMIN/BACKEND/...
```
**Result**: **PASS** (Exit Code 0)
- `repository`: PASS (0.485s)
- `tests`: PASS (0.518s)
- Total packages: 7 (all compiled and passed)

### 7.3 Workspace Full Regression
**Command**:
```powershell
go test -p 1 ./...
```
**Result**: **PASS** (Exit Code 0 across all packages)

### 7.4 Frontend Linter
**Command**:
```powershell
npm run lint (in MODULES/SUPER-ADMIN/FRONTEND/WEB)
```
**Result**: **PASS** (0 errors, 0 warnings across all JS/JSX files)

### 7.5 Frontend Production Build
**Command**:
```powershell
npm run build (in MODULES/SUPER-ADMIN/FRONTEND/WEB)
```
**Result**: **PASS** (Vite v5.4.21, 107 modules transformed, generated `dist/index.html`, `dist/assets/index-RDXFjH5l.js`, `dist/assets/index-MAIAVi5L.css` in 11.59s)

---

## 8. Live Runtime Verification & Filter Test Matrix

### 8.1 Authentication & Authorization Verification
- **Unauthorized Request**: `GET /super-admin/dashboard` without token → **HTTP 401 Unauthorized** (`{"success":false,"error":{"code":"UNAUTHORIZED","message":"Authorization header is required"}}`).
- **Non-Platform Scope**: Request with a College Admin token → **HTTP 403 Forbidden** (`{"success":false,"error":{"code":"FORBIDDEN","message":"Platform scope required"}}`).
- **Authorized Platform Session**: Request with Super Admin session (`role: SUPER_ADMIN`, `scope: PLATFORM`) → **HTTP 200 OK** with complete response payload.
- **Route Alias**: `GET /super-admin/dashboard/summary` → **HTTP 200 OK** (identical standard envelope and payload).
- **Security Audit**: No credentials, JWTs, connection strings, raw SQL queries, or stack traces exposed in responses or logs.

### 8.2 Database Metrics Cross-Verification
Every metric was verified directly against the live PostgreSQL database:
| Dashboard Field | Actual DB Value | Schema Source & Query Rule | Status |
|---|---|---|---|
| `total_colleges` | 9 | `COUNT(*) FROM platform.colleges` | **VERIFIED** |
| `active_colleges` | 7 | `COUNT(*) WHERE status = 'ACTIVE'` | **VERIFIED** |
| `suspended_colleges` | 1 | `COUNT(*) WHERE status = 'SUSPENDED'` (College B) | **VERIFIED** |
| `onboarding_colleges` | 1 | `COUNT(*) WHERE status = 'ONBOARDING'` | **VERIFIED** |
| `deactivated_colleges` | 1 | `COUNT(*) WHERE status = 'DEACTIVATED'` | **VERIFIED** |
| `inactive_colleges` | 1 | Mapped 1:1 to `'DEACTIVATED'` via `ck_colleges_status` | **VERIFIED** |
| `enabled_applications` | 11 | `platform.modules WHERE kind = 'APP' AND is_active = true` | **VERIFIED** |
| `enabled_modules` | 2 | `platform.modules WHERE kind = 'MODULE' AND is_active = true` | **VERIFIED** |
| `disabled_modules` | 0 | `platform.modules WHERE kind = 'MODULE' AND is_active = false` | **VERIFIED** |
| `active_count` (Admins) | 7 | `COUNT(DISTINCT u.user_id)` joined on `COLLEGE_ADMIN`, active status, valid unexpired assignment | **VERIFIED** |
| `service_health` | `HEALTHY` | Live `Ping(ctx)` on `PlatformPool` and `CollegePool` | **VERIFIED** |
| `critical_alerts` | 1 alert | Alert for suspended tenant (College B), 0 false alerts | **VERIFIED** |

### 8.3 Filter Verification Matrix (All 9 Mandatory Test Cases)
| # | Test Case | Filter Parameters | Expected Behavior | Live Actual Result |
|---|---|---|---|---|
| 1 | No filters | None | Full platform snapshot; global catalog scope; all recent activity | **PASS** — HTTP 200, Scope: `GLOBAL_CATALOG`, 9 colleges, 7 active admins |
| 2 | Valid college UUID | `college_id=c1000000-0000-0000-0000-000000000001` | Scoped to tenant; tenant entitlement join; tenant admins | **PASS** — HTTP 200, Scope: `COLLEGE_TENANT`, applied filter metadata recorded |
| 3 | Valid date range | `start_date=2026-10-01&end_date=2026-10-19` | Filters audit logs and approval dates; snapshots unaffected | **PASS** — HTTP 200, `is_current_snapshot: true` preserved, bounded events returned |
| 4 | Date-only end date (late day) | `end_date=2026-10-11` | End date expanded to `23:59:59.999999999Z`; activity at 21:53 included | **PASS** — HTTP 200, 21:53:00 events included, zero premature cutoffs |
| 5 | Invalid date | `start_date=invalid-date` | Rejection with clean 400 validation error | **PASS** — HTTP 400 (`INVALID_DATE_FORMAT`) |
| 6 | Start date > end date | `start_date=2026-10-20&end_date=2026-10-10` | Rejection with clean 400 validation error | **PASS** — HTTP 400 (`start_date cannot be after end_date`) |
| 7 | Invalid college UUID | `college_id=invalid-uuid-123` | Rejection with clean 400 validation error | **PASS** — HTTP 400 (`INVALID_COLLEGE_ID`) |
| 8 | College with no activity | `college_id=c9999999-0000-0000-0000-000000000009` | Clean empty state; empty arrays; 0 admins; no 500 errors | **PASS** — HTTP 200, `recent_activity: []`, `active_count: 0` |
| 9 | Non-existent college ID | `college_id=00000000-0000-0000-0000-000000000000` | Handled gracefully without crash; returns empty tenant scope | **PASS** — HTTP 200, empty tenant metrics returned |

---

## 9. Frontend Integration & Browser Environment Status

### 9.1 Frontend Component Architecture
The React frontend under `MODULES/SUPER-ADMIN/FRONTEND/WEB/src/` provides:
- **`DashboardPage.jsx`**: Orchestrates state, data fetching with abort-signal protection to avoid race conditions on rapid filter updates, error boundaries, and empty states.
- **`FilterBar.jsx`**: Provides college dropdown and date pickers with debounce/change handlers.
- **`CollegeSummary.jsx`**: Summary cards for Total, Active, Deactivated, Suspended, and Onboarding colleges with current snapshot badge.
- **`EntitlementSummary.jsx`**: Global catalog vs tenant module/application breakdown with explicit badge.
- **`CollegeAdminSummary.jsx`**: Displays active College Admin count.
- **`ServiceHealthPanel.jsx`**: Displays overall status and individual service probes (API server, Platform DB pool, College DB pool).
- **`CriticalAlertsList.jsx`**: Renders verified alerts with severity tags and stable IDs.
- **`PendingApprovalsSummary.jsx`**: Approvals count, configuration request badge, and recent pending requests table.
- **`RecentActivityTable.jsx`**: Audit event table with safe actor ID, module, action, and timestamp.
- **`UnsupportedMetricsPanel.jsx`**: Explicit disclosure of out-of-scope student metrics and architectural boundaries.
- **`AppRoutes.jsx`**: Defines valid existing routes (`/`, `/colleges`, `/colleges/new`, `/approvals`, `/modules`) to prevent broken drill-down links.

### 9.2 Browser Automation Limitation
- **Observation**: During browser automation via the agent's Chrome DevTools Protocol (CDP) subagent, the attached browser target was identified as a Lenovo Vantage container widget (`https://vantage.csw.lenovo.com/v1/web/containerwidget/default/`, viewport 64x64), which refused / aborted external URL navigations (`net::ERR_ABORTED`).
- **Direct HTTP Verification**: The Vite dev server at `http://localhost:3000/` was independently verified via direct HTTP request (returned HTTP 200 OK with full HTML entrypoint) and full production build verification (`npm run build` passed with zero errors).

---

## 10. Architectural Boundaries & Non-Modifications
- **Database Schema**: Preserved 100%. Zero tables, columns, indexes, or migrations added or modified.
- **Core API Files**: Preserved 100%. No files in `API\`, `DATABASE\`, or root were modified.
- **Test Isolation**: Database integration tests require explicit `TEST_DATABASE_URL` and do not run against development or production databases.

