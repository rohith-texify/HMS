# MODULE 20 & SHARED CAPABILITY 21 — ARCHITECTURE AUDIT REPORT
## Reports & Analytics + Multi-Tenant Isolation and Platform Boundary

**Project**: Hostel Management System (HMS)  
**Document Target**: `D:\HMS\DOCS\MODULE-20-21-ARCHITECTURE-AUDIT.md`  
**Date**: October 29, 2026  
**Auditor**: Antigravity AI  
**Scope**: Module 20 (Reports & Analytics) & Shared Capability 21 (Multi-Tenant Isolation & Platform Boundary)

---

## 1. Executive Summary

This read-only architecture audit evaluates the operational readiness and security posture of:
1. **Module 20: Reports & Analytics** — Providing verifiable, auditable platform metrics, module adoption trends, login activity, system analytics, export capabilities, and privacy-preserving small-count suppression.
2. **Shared Capability 21: Multi-Tenant Isolation & Platform Boundary** — Validating identity realms, trusted tenant-context derivations, PostgreSQL RLS barriers, transaction isolation, tenant lifecycle guards, and small-count disclosure protections.

All findings are grounded strictly in the existing database migrations (`001_platform.sql` - `010_super_admin_platform.sql`), Go backend services (`API/internal` and `MODULES/SUPER-ADMIN/BACKEND`), and React web clients.

---

## 2. Data Sources & Schema Availability Audit (Part A1)

| Analytical Metric / Dimension | Real Schema Table | Columns Verified | Data Availability Status |
|---|---|---|---|
| **Colleges & Lifecycle Status** | `platform.colleges` | `college_id`, `college_code`, `name`, `status` (`ONBOARDING`, `ACTIVE`, `SUSPENDED`, `DEACTIVATED`), `created_at` | **VERIFIED & ACTIVE** |
| **Module Catalog & Adoption** | `platform.modules`, `platform.college_modules` | `module_id`, `code`, `name`, `is_active`, `college_id`, `status` (`ACTIVE`, `DISABLED`), `mode` (`FULL`, `READ_ONLY`) | **VERIFIED & ACTIVE** |
| **Platform Users & Roles** | `app.users`, `platform.user_roles`, `platform.roles` | `user_id`, `email`, `role`, `status`, `college_id` (nullable for platform users) | **VERIFIED & ACTIVE** |
| **Authentication & Login Events** | `platform.login_events` | `event_id`, `user_id`, `college_id`, `event_at`, `result` (`SUCCESS`, `FAILED`, `LOCKED`, `BLOCKED`), `ip_address`, `device` | **VERIFIED & ACTIVE** |
| **Platform System Audit Logs** | `platform.audit_logs` | `id`, `user_id`, `user_email`, `user_role`, `college_id`, `action`, `resource`, `resource_id`, `status`, `created_at` | **VERIFIED & ACTIVE** |
| **Configuration Change Sets** | `platform.approval_requests` | `request_id`, `operation_type`, `payload`, `snapshot`, `requested_by`, `status`, `created_at`, `executed_at` | **VERIFIED & ACTIVE** |
| **Approval Execution History** | `platform.approval_requests`, `platform.approval_steps` | `request_id`, `step_order`, `decision`, `decided_at`, `approver_id` | **VERIFIED & ACTIVE** |
| **Saved Report Definitions** | N/A | None exists in schema | **BLOCKED — SCHEMA CHANGE REQUIRED** |
| **Persistent Report Scheduling** | N/A | No persistent cron/queue table exists | **BLOCKED — INFRASTRUCTURE REQUIRED** |

---

## 3. Existing API & Backend Architecture (Part A2)

1. **Authentication & Scope Enforcement**:
   - `API/internal/auth/claims.go`: Generates structured claims distinguishing `ScopePlatform` (`PLATFORM`) from `ScopeCollege` (`COLLEGE`).
   - `API/internal/auth/scope_middleware.go`: Enforces `RequirePlatformScope()` and `RequireCollegeScope()`. Requests lacking proper scope receive `403 Forbidden`.
   - `MODULES/SUPER-ADMIN/BACKEND/handlers/context_helper.go`: Extracts verified `auth_user_id` and `auth_role` directly from Gin context populated by JWT token validation. Client-supplied headers or query params cannot spoof the actor.
2. **Tenant Context Derivation**:
   - `API/internal/middleware/tenant_context.go`: Extracts `tenant_id` exclusively from validated JWT claims (`auth.ContextTenantIDKey`). **Never trusts user-supplied query or path parameters for tenant context.**
   - `API/internal/middleware/tenant_transaction.go`: Begins request-scoped database transactions and executes `database.SetTenantContext(txCtx, tx)`, binding tenant context to PostgreSQL session local settings.
   - `API/internal/middleware/tenant_status.go`: Verifies that the tenant is `ACTIVE`. Rejects calls to suspended or deactivated tenants with `403 Forbidden` (`TENANT_NOT_ACTIVE`).
3. **Existing Reporting Endpoints**:
   - `API/internal/server/report_handler.go`: Exposes `GetPlatformOverview` and `GetPlatformActivity`.
   - `MODULES/SUPER-ADMIN/BACKEND/services/dashboard_service.go`: Aggregates active college counts, entitlement summaries, and real health probes.

---

## 4. Multi-Tenant Isolation & Security Boundary Assessment (Part C)

### 4.1 Platform vs. Tenant Identity Realms
- **Finding**: Platform administrators have `college_id = NULL` in `app.users` and JWT claims with `scope: "PLATFORM"`. College users possess `scope: "COLLEGE"` bound to their specific `tenant_id`.
- **Barrier**: College tokens cannot invoke `/super-admin/*` routes because `RequirePlatformScope` verifies `c.Get("auth_scope") == "PLATFORM"`.

### 4.2 Trusted Tenant-Context Derivation & RLS
- **Finding**: PostgreSQL RLS is enabled across all tenant operational tables (`app.students`, `app.attendance_logs`, `app.leaves`, etc.) using tenant context derived by `tenant_context.go`.
- **Barrier**: A user cannot switch tenants by modifying URL parameters (e.g., `/colleges/:id/students`). The database RLS policy queries `app.current_tenant_id()`, which is initialized only from the cryptographically verified JWT claim.

### 4.3 Small-Count Suppression
- **Requirement**: Prevent identification of individual users or tenants when grouping counts in sparse cohorts (e.g., cohorts < 5).
- **Implementation Strategy**: In aggregate analytical queries, groups with counts between `1` and `4` will be masked with `< 5` or aggregated into an `"OTHER"` category to eliminate re-identification via differencing attacks.

---

## 5. Export Security & Anti-Formula Injection

- **CSV Formula Injection**: All exported cell values starting with dangerous spreadsheet formula characters (`=`, `+`, `-`, `@`, `\t`, `\r`) must be sanitized by prefixing with a single quote (`'`).
- **Audit Logging**: Every report export operation must record an immutable audit log in `platform.audit_logs` specifying actor, report type, filter parameters, and row count. Export writes fail-closed if audit persistence fails.

---

## 6. Proposed Files to Add / Modify

### Backend (`MODULES/SUPER-ADMIN/BACKEND`)
- `models/report.go` *(New)*: Report filter parameters, analytics summary models, export models, and suppression rules.
- `services/report_service.go` *(New)*: Analytics calculation service (college usage, active users, module adoption, login security trends, small-count suppression, CSV stream generation with formula-sanitization).
- `handlers/report_handler.go` *(New)*: Endpoints for analytics summaries, usage breakdowns, activity reports, and audited CSV exports.
- `routes/routes.go` *(Modified)*: Register `/super-admin/reports` route group.
- `tests/reports_isolation_test.go` *(New)*: Focused unit tests for small-count suppression, CSV formula injection defense, tenant scope validation, and filter verification.

### Frontend (`MODULES/SUPER-ADMIN/FRONTEND/WEB`)
- `src/services/reportService.js` *(New)*: API client for analytics and CSV downloads.
- `src/pages/ReportsAnalyticsPage.jsx` *(New)*: Comprehensive analytics console featuring KPI cards, module adoption charts, login security activity, and audited CSV export triggers.
- `src/components/Sidebar.jsx` *(Modified)*: Add Reports & Analytics navigation link.
- `src/routes/AppRoutes.jsx` *(Modified)*: Register `/reports` route.

---

## 7. Features Blocked by Missing Schema / Infrastructure

1. **Saved Report Definitions**:
   - *Status*: `BLOCKED — SCHEMA CHANGE REQUIRED`
   - *Reason*: No `platform.saved_reports` table exists. Storing report definitions in unrelated tables or JSON columns is prohibited by constraint #4.
2. **Persistent Scheduled Report Delivery**:
   - *Status*: `BLOCKED — INFRASTRUCTURE REQUIRED`
   - *Reason*: No persistent task scheduler or background worker infrastructure exists. Unreliable in-memory timers are prohibited by constraint #6.
