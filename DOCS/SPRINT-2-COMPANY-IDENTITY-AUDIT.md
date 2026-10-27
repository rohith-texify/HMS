# HMS SUPER ADMIN — SPRINT 2: ARCHITECTURE AUDIT REPORT
**Company Staff / Platform Identity Architecture & College Admin Frontend Integration**

**Date:** 2026-10-27  
**Scope:** `D:\HMS\MODULES\SUPER-ADMIN\BACKEND` & `D:\HMS\MODULES\SUPER-ADMIN\FRONTEND\WEB`  
**Shared Auth Inspected:** `D:\HMS\API\internal\auth`  
**Database Schema Inspected:** `D:\HMS\DATABASE\migrations` (Zero schema modifications)  

---

## 1. Executive Summary

This architecture audit evaluates the company-level identity model and platform staff capabilities within the existing HMS platform architecture, following the completion of the College Admin account backend in Sprint 1.

Key findings:
1. **Shared Identity Realm with Scoped Roles:** The system does not have a separate database table or isolated identity store for company staff. All users (platform administrators, college administrators, wardens, students, parents) reside in `app.users`.
2. **Platform Identity Boundary:** Platform identity is established exclusively via `platform.user_roles` where `role_id` points to a role with `scope = 'PLATFORM'` and `college_id IS NULL`. College users always have `scope = 'COLLEGE'` and a non-null `college_id`.
3. **Database Seed Limitation for Company Roles:** In `D:\HMS\DATABASE\migrations\903_seed.sql`, the only role seeded with `scope = 'PLATFORM'` is `SUPER_ADMIN`. The six architectural roles (`PO`, `SA`, `CA`, `SU`, `OP`, `AU`) are not defined in `platform.roles`. Furthermore, `D:\HMS\API\internal\auth\service.go` explicitly restricts platform logins to `membership.RoleCode == "SUPER_ADMIN"`.
4. **MFA State:** While `app.users` has an `mfa_enabled boolean` column, `API/internal/auth/service.go` currently fails closed (`"MFA verification required; second-factor verification is not yet available"`) because no TOTP/SMS second-factor delivery engine exists.
5. **Pending Approvals on Offboarding:** `platform.approval_steps` contains `approver_id uuid` referencing `app.users(user_id)`. Active pending approval requests can be queried for departing platform staff.

---

## 2. Identity Architecture Audit

### 2.1 User Representation (`app.users`)
All identities share `app.users`:
- `user_id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `email citext UNIQUE`
- `phone varchar(30)`
- `password_hash text`
- `status varchar(30) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('INVITED', 'ACTIVE', 'LOCKED', 'SUSPENDED', 'DEACTIVATED'))`
- `mfa_enabled boolean NOT NULL DEFAULT false`
- `last_login_at timestamptz`
- `created_at timestamptz`, `updated_at timestamptz`

There is no separate `company_users` or `platform_users` table.

### 2.2 Role Catalog (`platform.roles`)
Seeded roles in `903_seed.sql`:
| Role Code | Role Name | Scope | Is System Role |
| :--- | :--- | :--- | :--- |
| `SUPER_ADMIN` | Super Administrator | `PLATFORM` | `TRUE` |
| `COLLEGE_ADMIN` | College Administrator | `COLLEGE` | `TRUE` |
| `HOSTEL_ADMIN` | Hostel Administrator | `COLLEGE` | `TRUE` |
| `WARDEN` | Warden | `COLLEGE` | `TRUE` |
| `INCHARGE` | Hostel Incharge | `COLLEGE` | `TRUE` |
| `SECURITY` | Security Staff | `COLLEGE` | `TRUE` |
| `STAFF` | Staff | `COLLEGE` | `TRUE` |
| `STUDENT` | Student | `COLLEGE` | `TRUE` |
| `PARENT` | Parent | `COLLEGE` | `TRUE` |

### 2.3 User-to-Role Association (`platform.user_roles`)
Tenant membership vs Platform membership is governed by:
- **Platform User:** `ur.college_id IS NULL` AND `r.scope = 'PLATFORM'`
- **College Tenant User:** `ur.college_id IS NOT NULL` AND `r.scope = 'COLLEGE'`

A check constraint enforces this model.

### 2.4 Authentication & Token Issuance (`API/internal/auth/service.go`)
During login:
```go
if membership.RoleScope == repositoryRoleScopePlatform {
    if membership.RoleCode != "SUPER_ADMIN" {
        return nil, apierrors.New(
            apierrors.Forbidden,
            "unsupported platform role",
        )
    }
    accessToken, err := s.jwt.GeneratePlatformAccessToken(
        identity.UserID,
        membership.RoleCode,
    )
    ...
}
```
Platform tokens have:
- `Scope = "PLATFORM"`
- `Role = "SUPER_ADMIN"`
- `TenantID = nil`

The database session layer (`app.is_platform_admin()`) checks:
```sql
SELECT 1 FROM platform.user_roles ur
JOIN platform.roles r ON r.role_id = ur.role_id
WHERE ur.user_id = app.current_user_id()
  AND ur.college_id IS NULL
  AND ur.status = 'ACTIVE'
  AND r.role_code IN ('SUPER_ADMIN', 'PLATFORM_OPERATOR');
```

---

## 3. Company Staff Role Model Analysis

The architecture document specifies 6 granular platform roles:
1. **PO (Platform Owner):** Ultimate platform authority and break-glass operations.
2. **SA (Super Admin):** Day-to-day platform administration.
3. **CA (Configuration Admin):** Onboarding, college configuration, entitlements, structure setup.
4. **SU (Support Admin):** Approved troubleshooting and support access.
5. **OP (Operations Admin):** Operations, monitoring, notifications, reporting.
6. **AU (Auditor):** Read-only audit and security-event access.

### Database Reality & Limitation:
- None of `PO`, `SA`, `CA`, `SU`, `OP`, `AU` exist in `platform.roles` in the current database migration scripts.
- Only `SUPER_ADMIN` exists with `scope = 'PLATFORM'`.
- Only two platform permissions exist in `platform.permissions`: `platform.view` and `platform.manage`.
- Because **mandatory rule #3 & #4** strictly forbid executing database migrations, creating tables, or inserting seed records into the database, we cannot invent or seed these 6 roles directly in the active PostgreSQL database.
- **Architectural Resolution for Sprint 2:**
  - Map `SUPER_ADMIN` as the canonical Platform Owner / Super Admin.
  - Structure the backend models to recognize the granular role codes (`PO`, `SA`, `CA`, `SU`, `OP`, `AU`) in API contracts and permission checks.
  - Implement the Platform Staff backend to manage platform-scoped users (`ur.college_id IS NULL`, `r.scope = 'PLATFORM'`).
  - Document the required schema migration for future sprint approval.

---

## 4. Offboarding & Approval Reassignment Analysis

When offboarding a platform staff member:
1. `platform.approval_steps` contains `approver_id uuid` referencing `app.users(user_id)`.
2. When a staff account is deactivated or offboarded, uncompleted steps (`decision = 'PENDING'`) associated with that staff member must be identified.
3. Maker-checker segregation is enforced by database trigger `trg_validate_approval_segregation`:
   `requester cannot approve their own request`.
4. Reassignment must be audited in `platform.audit_logs`.

---

## 5. Security & Session Revocation Limitations

1. **Stateless JWT Tokens:**
   `API/internal/auth/jwt.go` issues HMAC-SHA256 tokens valid for 24 hours. The database has no token revocation list or Redis cache. Deactivating a user prevents generating new tokens, but existing JWTs remain valid until their expiration.
2. **Push Device Tokens vs User Sessions:**
   The backend only deactivates `platform.device_tokens`. In the frontend UI, this must be accurately labeled as "Invalidate Push Device Tokens", and must not claim that stateless JWT access tokens are immediately revoked.
3. **Password Reset Links:**
   No one-time reset token persistence or external email service (SMTP/SES) exists. Therefore, no simulated email reset flow will be created in the UI.

---

## 6. Implementation Scope for Sprint 2

### Part A: College Admin Frontend
- Implement `D:\HMS\MODULES\SUPER-ADMIN\FRONTEND\WEB\src\pages\CollegeAdminsPage.jsx`.
- Update `D:\HMS\MODULES\SUPER-ADMIN\FRONTEND\WEB\src\services\collegeService.js` with all 7 Sprint 1 endpoints.
- Integrate routes into `AppRoutes.jsx` (`/colleges/:id/admins`).
- Add navigation links from `CollegeDetailPage.jsx`.
- Provide accurate labeling, status badges, last-admin deactivation rejection handling, unlock controls, and authentic login history.

### Part B: Company Staff / Super Admin Backend
- Create models, repository, service, handler, and routes for Platform Staff in `MODULES/SUPER-ADMIN/BACKEND`:
  - `GET /super-admin/staff` — List platform staff with pagination and status filter.
  - `GET /super-admin/staff/:user_id` — Get platform staff details.
  - `PATCH /super-admin/staff/:user_id` — Update permitted profile fields (`phone`).
  - `PUT /super-admin/staff/:user_id/status` — Update status with Last Platform Owner / Super Admin protection.
  - `GET /super-admin/staff/:user_id/pending-approvals` — Inspect pending approval requests assigned to staff member.
- Maintain immutable audit trail in `platform.audit_logs`.
- Enforce `platform.view` and `platform.manage` permissions.
