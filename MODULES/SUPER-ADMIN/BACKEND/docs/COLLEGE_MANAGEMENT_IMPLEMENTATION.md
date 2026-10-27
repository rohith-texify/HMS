# College / Tenant Management Implementation — Module 02

## 1. Overview
This document specifies the technical architecture, endpoint contracts, database query mappings, status representations, validation rules, approval integration, and frontend integration for Module 02: **College / Tenant Management** within the Hostel Management System (`HMS`).

All implementations strictly adhere to:
- Code modification boundary: `D:\HMS\MODULES\SUPER-ADMIN\BACKEND\` and `D:\HMS\MODULES\SUPER-ADMIN\FRONTEND\WEB\`.
- Preservation of database schema, migrations, tables, columns, constraints, and seed data.
- Preservation of existing Go module structure, React/Vite build toolchain, and platform authentication models.

---

## 2. Implemented Features

### 2.1 College Directory & Search
- Paginated listing with server-side filtering:
  - `limit` (default 20, max 100)
  - `offset` (0-indexed)
  - `status` (`ALL`, `ONBOARDING`, `ACTIVE`, `SUSPENDED`, `DEACTIVATED`)
  - `search` (case-insensitive search matching `name` or `college_code` via `ILIKE`)
- Standardized response envelope with pagination metadata (`meta.total`, `meta.limit`, `meta.offset`).
- Safe parameterization across all query conditions.

### 2.2 College Onboarding & Creation
- Creates a new college tenant in initial status `ONBOARDING`.
- Input fields:
  - `college_code`: Required, alphanumeric with hyphens/underscores, max 100 chars. Treated as unique and immutable after creation.
  - `name`: Required, max 200 chars.
  - `timezone`: Required, IANA timezone string.
  - `city`: Optional, max 100 chars.
  - `state`: Optional, max 100 chars.
  - `contact_email`: Optional, validated RFC 5322 format.
- Duplicate college code detection uses PostgreSQL SQLSTATE `23505` on `uq_colleges_college_code` constraint, returning clean HTTP 409 Conflict.
- Atomic creation audit logged in `platform.audit_logs`.

### 2.3 College Detail & Profile Retrieval
- Retrieves full college identity: `college_id`, `college_code`, `name`, `status`, `timezone`, `city`, `state`, `contact_email`, `created_at`, `updated_at`, `activated_at`, `suspended_at`, `deactivated_at`, `lifecycle_reason`.
- Validates UUID syntax, returning HTTP 400 for malformed UUIDs and HTTP 404 for non-existent IDs.
- Retrieves canonical onboarding checklist steps from `platform.college_onboarding` for tenant readiness overview.

### 2.4 Profile Updates (Mutable Fields Only)
- Permitted mutable fields: `name`, `city`, `state`, `timezone`, `contact_email`.
- Enforces immutability: `college_code` cannot be altered after creation.
- Enforces lifecycle guard: Colleges in `DEACTIVATED` or `ARCHIVED` status cannot be updated until reactivated.
- Profile update audit record logged with before-and-after values in `platform.audit_logs`.

### 2.5 College Lifecycle State Machine
Enforces canonical state transitions allowed by database check constraint `ck_colleges_status`:
- `ONBOARDING` → `ACTIVE` (requires all 6 canonical onboarding steps to be COMPLETED) or `DEACTIVATED`.
- `ACTIVE` → `SUSPENDED` or `DEACTIVATED`.
- `SUSPENDED` → `ACTIVE` (reinstate) or `DEACTIVATED`.
- `DEACTIVATED` → `ACTIVE` (reactivate).
- Self-transitions (repeating the current status) and unsupported jumps (e.g. `ONBOARDING` → `SUSPENDED` or `DEACTIVATED` → `SUSPENDED`) are strictly rejected.
- Requires non-empty `lifecycle_reason` for administrative tracking.
- Row-level lock (`SELECT status FROM platform.colleges WHERE college_id = $1 FOR UPDATE`) ensures concurrent status changes cannot race or bypass prerequisites.
- Dual execution paths supported:
  1. **Direct Execution**: Via `PUT /super-admin/colleges/:id/status` (requires `platform.manage` permission).
  2. **Maker-Checker Approval**: Via `POST /super-admin/approvals` (`operation_type = COLLEGE_STATUS_UPDATE`), generating a pending request requiring two-administrator authorization.

---

## 3. Endpoint Contracts

| Method | Path | Permission Required | Description |
|---|---|---|---|
| `GET` | `/super-admin/colleges` | `platform.view` | List colleges with pagination, status filter, and name/code search |
| `POST` | `/super-admin/colleges` | `platform.manage` | Onboard a new college tenant in ONBOARDING status |
| `GET` | `/super-admin/colleges/:id` | `platform.view` | Retrieve single college details |
| `PUT` / `PATCH` | `/super-admin/colleges/:id` | `platform.manage` | Update mutable college profile details |
| `PUT` / `PATCH` | `/super-admin/colleges/:id/status` | `platform.manage` | Update college lifecycle status with reason |
| `GET` | `/super-admin/colleges/:id/onboarding` | `platform.view` | Retrieve canonical onboarding checklist steps |
| `POST` | `/super-admin/approvals` | `platform.manage` | Submit maker-checker approval request for status changes |

---

## 4. Frontend Routes & Components

| UI Route | Component | Features |
|---|---|---|
| `/colleges` | `CollegesPage.jsx` | Directory table, server-side search input, status dropdown, pagination controls (10/20/50), View Profile button, link to Create College |
| `/colleges/new` | `CreateCollegePage.jsx` | College onboarding form, code validation, timezone dropdown, duplicate detection, success navigation |
| `/colleges/:id` | `CollegeDetailPage.jsx` | College identity cards, onboarding checklist summary, profile edit modal, lifecycle action transition controls (Direct & Approval options) |
| `/dashboard` | `DashboardPage.jsx` | Preserved existing dashboard with Quick Action link to `/colleges/new` and College Summary drilldown to `/colleges` |

---

## 5. Test & Build Execution Evidence

### 5.1 Backend Unit & Lifecycle Tests
**Command**:
```powershell
go test -count=1 -p 1 ./MODULES/SUPER-ADMIN/BACKEND/...
```
**Results**:
- `repository`: **PASS** (1.189s)
- `tests`: **PASS** (0.139s)
- `TestListCollegesParams_Validation`: PASS
- `TestCollegeService_ListColleges_FailClosed`: PASS
- `TestCollegeService_GetCollege_NilID`: PASS
- `TestLifecycleStatusTransitions`: PASS
- `TestValidateUpdateCollegeStatusRequest`: PASS
- `TestValidateCreateCollegeRequest`: PASS
- `TestValidateUpdateCollegeRequest`: PASS

### 5.2 Workspace Full Regression
**Command**:
```powershell
go test -p 1 ./...
```
**Results**: **PASS** across all packages (`API/internal/server`, `API/internal/service`, `API/internal/repository`, etc.).

### 5.3 Frontend Linter
**Command**:
```powershell
npm run lint (in MODULES/SUPER-ADMIN/FRONTEND/WEB)
```
**Results**: **PASS** (0 errors, 0 warnings).

### 5.4 Frontend Production Build
**Command**:
```powershell
npm run build (in MODULES/SUPER-ADMIN/FRONTEND/WEB)
```
**Results**: **PASS** (110 modules transformed, production bundles generated in `dist/`).

---

## 6. Architectural Boundary Confirmations
- **Database Schema**: Preserved 100%. No tables, columns, indexes, constraints, or migrations added or modified.
- **Core API Files**: Preserved 100%. Zero files outside `MODULES/SUPER-ADMIN/` were edited.
- **Data Protection**: Zero credentials, tokens, or student-level records are exposed.
