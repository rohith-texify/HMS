# HMS SUPER ADMIN — SPRINT 1: ARCHITECTURE AUDIT REPORT
**College Admin Account Management Backend**

**Date:** 2026-10-27  
**Scope:** `D:\HMS\MODULES\SUPER-ADMIN\BACKEND`  
**Frontend Audited:** `D:\HMS\MODULES\SUPER-ADMIN\FRONTEND\WEB` (Read-only inspection)  
**Schema Inspected:** `D:\HMS\DATABASE\migrations\` (Read-only, zero modifications)  
**Target Delivery:** Secure College Admin Account Management Backend  

---

## 1. Existing Relevant Files and Responsibilities

### Backend Files
- [D:\HMS\MODULES\SUPER-ADMIN\BACKEND\routes\routes.go](file:///D:/HMS/MODULES/SUPER-ADMIN/BACKEND/routes/routes.go):
  - Registers all Super Admin HTTP endpoints under `/super-admin`.
  - Currently exposes single-admin endpoints: `GET /colleges/:id/admin` and `PUT/POST /colleges/:id/admin/password`.
  - Applies `requireView` (`platform.admin.read`) and `requireManage` (`platform.admin.write`) permission middleware.
- [D:\HMS\MODULES\SUPER-ADMIN\BACKEND\handlers\college_handler.go](file:///D:/HMS/MODULES/SUPER-ADMIN/BACKEND/handlers/college_handler.go):
  - Handles HTTP requests for colleges and admin accounts (`GetCollegeAdmin`, `UpdateCollegeAdminPassword`).
  - Extracts actor ID (`database.PlatformUserIDFromContext`) and actor role from gin context.
- [D:\HMS\MODULES\SUPER-ADMIN\BACKEND\services\college_service.go](file:///D:/HMS/MODULES/SUPER-ADMIN/BACKEND/services/college_service.go):
  - Enforces business logic, transactional execution via `s.db.WithPlatformTransaction`, bcrypt password hashing, and audit logging.
- [D:\HMS\MODULES\SUPER-ADMIN\BACKEND\repository\college_repository.go](file:///D:/HMS/MODULES/SUPER-ADMIN/BACKEND/repository/college_repository.go):
  - Direct SQL queries on `app.users`, `platform.roles`, `platform.user_roles`, `platform.colleges`, and `platform.audit_logs`.
  - Implements `GetCollegeAdmin` (fetches single latest active admin), `UpsertCollegeAdmin` (creates or updates user & binds `COLLEGE_ADMIN` role), and `RecordCollegeAdminPasswordAudit`.
- [D:\HMS\MODULES\SUPER-ADMIN\BACKEND\models\college.go](file:///D:/HMS/MODULES/SUPER-ADMIN/BACKEND/models/college.go):
  - Data contracts: `CollegeAdminAccount` struct containing `user_id`, `college_id`, `email`, `status`, `role_code`, `role_name`, `has_password`, `last_login_at`, and `created_at`.
- [D:\HMS\API\internal\auth\service.go](file:///D:/HMS/API/internal/auth/service.go) & [jwt.go](file:///D:/HMS/API/internal/auth/jwt.go):
  - Central login verification and stateless HS256 JWT generation (`GenerateCollegeAccessToken`, `GeneratePlatformAccessToken`).
  - Enforces `user.status == 'ACTIVE'`, checks bcrypt password, evaluates role membership.
  - Logs authentication outcomes to `platform.login_events` (`SUCCESS`, `FAILED`, `LOCKED`, `BLOCKED`).

### Frontend Files (Inspected Only)
- [D:\HMS\MODULES\SUPER-ADMIN\FRONTEND\WEB\src\services\api.js](file:///D:/HMS/MODULES/SUPER-ADMIN/FRONTEND/WEB/src/services/api.js):
  - Axios client attaching Bearer token from localStorage/sessionStorage and `X-Scope: PLATFORM`. Unwraps `{ success: true, data }`.
- [D:\HMS\MODULES\SUPER-ADMIN\FRONTEND\WEB\src\services\collegeService.js](file:///D:/HMS/MODULES/SUPER-ADMIN/FRONTEND/WEB/src/services/collegeService.js):
  - Consumes `/super-admin/colleges/:id/admin` and `PUT /super-admin/colleges/:id/admin/password`.

---

## 2. Existing Endpoints and Permission Checks

| Endpoint | Method | Middleware / Check | Description |
| :--- | :--- | :--- | :--- |
| `/super-admin/colleges/:id/admin` | `GET` | `requireView` (`platform.admin.read`) | Retrieves the latest active College Admin for a college. |
| `/super-admin/colleges/:id/admin/password` | `PUT`, `POST` | `requireManage` (`platform.admin.write`) | Sets or updates a college administrator's password and marks the onboarding step complete. |

---

## 3. Existing Database Tables and Verified Columns

### 1. `app.users` (`001_platform.sql:94-130`)
- `user_id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `email citext UNIQUE`
- `phone varchar(30)`
- `password_hash text`
- `status varchar(30) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('INVITED', 'ACTIVE', 'LOCKED', 'SUSPENDED', 'DEACTIVATED'))`
- `mfa_enabled boolean NOT NULL DEFAULT false`
- `last_login_at timestamptz`
- `created_at timestamptz`, `updated_at timestamptz`
*Constraint:* `email IS NOT NULL OR phone IS NOT NULL`.

### 2. `platform.roles` (`001_platform.sql:142-165`)
- `role_id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `role_code varchar(100) UNIQUE NOT NULL` (e.g. `'COLLEGE_ADMIN'`)
- `role_name varchar(150) NOT NULL`
- `scope varchar(20) NOT NULL CHECK (scope IN ('PLATFORM', 'COLLEGE'))`
- `is_system_role boolean NOT NULL DEFAULT false`

### 3. `platform.user_roles` (`001_platform.sql:177-223`)
- `user_role_id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `user_id uuid NOT NULL REFERENCES app.users(user_id)`
- `role_id uuid NOT NULL REFERENCES platform.roles(role_id)`
- `college_id uuid REFERENCES platform.colleges(college_id)` (mandatory for `COLLEGE` scope)
- `status varchar(30) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'REVOKED', 'EXPIRED'))`
- `assigned_by uuid REFERENCES app.users(user_id)`
- `expires_at timestamptz`
- `created_at timestamptz`, `updated_at timestamptz`

### 4. `platform.audit_logs` (`001_platform.sql:649-687`)
- `audit_id uuid PRIMARY KEY`
- `college_id uuid`, `actor_user_id uuid`, `actor_role varchar(100)`
- `module varchar(150) NOT NULL`, `action varchar(100) NOT NULL`
- `entity_type varchar(150)`, `entity_id uuid`
- `old_data jsonb`, `new_data jsonb`, `reason text`, `ip_address inet`, `user_agent text`, `created_at timestamptz`

### 5. `platform.login_events` (`001_platform.sql:696-736`)
- `login_event_id uuid PRIMARY KEY`
- `user_id uuid`, `college_id uuid`
- `result varchar(30) NOT NULL CHECK (result IN ('SUCCESS', 'FAILED', 'LOCKED', 'BLOCKED', 'LOGOUT', 'MFA_FAILED'))`
- `ip_address inet`, `device varchar(255)`, `user_agent text`, `event_at timestamptz`

---

## 4. Analysis of Capabilities: Password Reset, Verification, Sessions, and Login History

1. **Password Reset:**
   - There is **no** dedicated `password_resets` or one-time reset token table in the platform database schema.
   - Authentication passwords are confirmed directly through bcrypt comparison in `API/internal/auth/service.go`.
   - The Super Admin module currently resets passwords directly via `UpsertCollegeAdmin` with a bcrypt hash.
2. **Contact Verification:**
   - `app.users` lacks `email_verified`, `email_verified_at`, or `phone_verified_at` columns.
   - Profile verification flags are present for specific request forms (`app.leave_verification_logs`, `app.gate_pass_verifications`), but not on user accounts.
3. **Session Revocation:**
   - Access tokens are stateless HS256 JWTs (`API/internal/auth/jwt.go`).
   - The database does **not** contain a `user_sessions` or JWT blacklist/blocklist table.
   - As a result, stateless JWTs cannot be revoked immediately before expiration (configured to 24h by default) without schema changes. However, setting `app.users.status = 'DEACTIVATED'` or `LOCKED` will immediately block re-authentication and token refresh attempts. Furthermore, device notification push tokens can be invalidated in `platform.device_tokens`.
4. **Login History & Failed Logins:**
   - Full authentication attempts and lockout outcomes are stored in `platform.login_events`.
   - `app.users.last_login_at` stores the timestamp of the most recent successful login.

---

## 5. Missing Capabilities and Security Gaps

1. **Multi-Admin Management:**
   - Existing repository query `GetCollegeAdmin` retrieves only `LIMIT 1` admin. If a college has multiple administrators assigned, they cannot be viewed, audited, or managed independently.
2. **First Admin Provisioning Boundary:**
   - Existing `UpsertCollegeAdmin` automatically overwrites an existing admin's password if any admin exists for the college. A distinct "Provision First Admin" operation with duplicate-prevention guarantees is missing.
3. **Last Active College Admin Protection:**
   - No protection exists to prevent deactivating all administrators of a college, which would leave a college orphaned.
4. **Editable Profile Fields / Allowlist:**
   - Currently, updating an admin updates the password directly. A distinct endpoint allowing safe update of `phone` or email without tampering with security roles or user IDs is required.
5. **Force Password Reset Flag:**
   - `app.users` lacks a `must_change_password` or `force_password_reset` column. The authentication service (`API/internal/auth/service.go`) has no logic to check such a flag.
6. **One-Time Reset Link & Token Delivery:**
   - No email/SMS sending service (e.g. SES/SendGrid/Twilio) or token hashing repository exists for Super Admin. Fabricating a fake email sender is strictly forbidden by the prompt rules.

---

## 6. Exact Files to Modify / Create

### Files to Modify
- [D:\HMS\MODULES\SUPER-ADMIN\BACKEND\models\college.go](file:///D:/HMS/MODULES/SUPER-ADMIN/BACKEND/models/college.go):
  - Add request and response models:
    - `CollegeAdminListItem`, `ListCollegeAdminsResponse`
    - `ProvisionCollegeAdminRequest`, `UpdateCollegeAdminProfileRequest`
    - `UpdateCollegeAdminStatusRequest`, `CollegeAdminLoginHistoryItem`
- [D:\HMS\MODULES\SUPER-ADMIN\BACKEND\repository\college_repository.go](file:///D:/HMS/MODULES/SUPER-ADMIN/BACKEND/repository/college_repository.go):
  - Add `ListCollegeAdmins(ctx, collegeID, limit, offset)`
  - Add `CountActiveCollegeAdmins(ctx, collegeID)`
  - Add `ProvisionFirstCollegeAdmin(ctx, collegeID, email, phone, passwordHash, actorID)`
  - Add `UpdateCollegeAdminProfile(ctx, collegeID, userID, phone)`
  - Add `UpdateCollegeAdminStatus(ctx, collegeID, userID, targetStatus, actorID)` with atomic last-admin check
  - Add `UnlockCollegeAdminAccount(ctx, collegeID, userID, actorID)`
  - Add `RevokeCollegeAdminSessions(ctx, collegeID, userID)`
  - Add `GetCollegeAdminLoginHistory(ctx, collegeID, userID, limit)`
- [D:\HMS\MODULES\SUPER-ADMIN\BACKEND\services\college_service.go](file:///D:/HMS/MODULES/SUPER-ADMIN/BACKEND/services/college_service.go):
  - Implement business logic, permission checks, transaction boundaries, bcrypt hashing, and audit logging for the above operations.
- [D:\HMS\MODULES\SUPER-ADMIN\BACKEND\handlers\college_handler.go](file:///D:/HMS/MODULES/SUPER-ADMIN/BACKEND/handlers/college_handler.go):
  - Implement HTTP request decoding, param parsing, input validation, and standardized responses.
- [D:\HMS\MODULES\SUPER-ADMIN\BACKEND\routes\routes.go](file:///D:/HMS/MODULES/SUPER-ADMIN/BACKEND/routes/routes.go):
  - Register the new endpoints under `/super-admin/colleges/:id/admins`.

### Files to Create
- [D:\HMS\MODULES\SUPER-ADMIN\BACKEND\tests\college_admin_management_test.go](file:///D:/HMS/MODULES/SUPER-ADMIN/BACKEND/tests/college_admin_management_test.go):
  - Complete unit test suite verifying validation, last-admin protection logic, profile update allowlists, safe serialization, and fail-closed behaviors.

---

## 7. Proposed Endpoint Contracts

All endpoints are prefixed under `/super-admin/colleges/:id/admins` and require valid JWT authentication with Super Admin permissions.

### 1. List College Admin Accounts
- **Path:** `GET /super-admin/colleges/:id/admins`
- **Permission:** `platform.admin.read`
- **Query Params:** `limit` (default 20, max 100), `offset` (default 0), `status` (optional)
- **Response:**
  ```json
  {
    "success": true,
    "data": {
      "college_id": "uuid",
      "admins": [
        {
          "user_id": "uuid",
          "email": "admin@college.edu",
          "phone": "+919876543210",
          "status": "ACTIVE",
          "role_code": "COLLEGE_ADMIN",
          "role_name": "College Administrator",
          "last_login_at": "2026-10-27T00:00:00Z",
          "created_at": "2026-10-01T00:00:00Z"
        }
      ],
      "total": 1
    }
  }
  ```
- **Security:** Plaintext passwords, hashes, reset tokens, and MFA secrets are never returned.

### 2. Provision / Create First College Admin
- **Path:** `POST /super-admin/colleges/:id/admins/first`
- **Permission:** `platform.admin.write`
- **Request Body:**
  ```json
  {
    "email": "principal@college.edu",
    "phone": "+919876543210",
    "password": "StrongInitialPassword123!"
  }
  ```
- **Behavior:**
  - Verifies target college exists.
  - Checks if an active `COLLEGE_ADMIN` already exists for this college. If one exists, returns `409 Conflict` ("First administrator has already been provisioned").
  - Hashes password using bcrypt.
  - Creates `app.users` record and binds `COLLEGE_ADMIN` role in `platform.user_roles`.
  - Marks onboarding step `COLLEGE_ADMIN` as `COMPLETED`.
  - Audits `COLLEGE_ADMIN_PROVISIONED`.

### 3. Edit Permitted Account Details
- **Path:** `PATCH /super-admin/colleges/:id/admins/:admin_id`
- **Permission:** `platform.admin.write`
- **Request Body:**
  ```json
  {
    "phone": "+919876543211"
  }
  ```
- **Allowlist:** Strictly allows `phone`. Modifying roles, tenant boundaries, user IDs, or direct database credentials is rejected.
- **Audit:** Records `COLLEGE_ADMIN_PROFILE_UPDATED`.

### 4. Activate & Deactivate Accounts (with Last-Admin Protection)
- **Path:** `PUT /super-admin/colleges/:id/admins/:admin_id/status`
- **Permission:** `platform.admin.write`
- **Request Body:**
  ```json
  {
    "status": "DEACTIVATED", // or "ACTIVE", "SUSPENDED"
    "reason": "Administrative departure"
  }
  ```
- **Last-Admin Protection:**
  - Runs inside a database transaction with `SELECT COUNT(*) FROM platform.user_roles ... FOR UPDATE`.
  - If the requested status is `DEACTIVATED` or `SUSPENDED` and there is only 1 active admin for the college, the request is rejected with `409 Conflict` ("Cannot deactivate the last active College Administrator for this college").
- **Audit:** Records `COLLEGE_ADMIN_STATUS_CHANGED`.

### 5. Unlock Account
- **Path:** `POST /super-admin/colleges/:id/admins/:admin_id/unlock`
- **Permission:** `platform.admin.write`
- **Behavior:** Validates account is currently `LOCKED`. Transitions status to `ACTIVE`. Preserves all prior audit events in `platform.login_events`.
- **Audit:** Records `COLLEGE_ADMIN_UNLOCKED`.

### 6. Revoke Sessions
- **Path:** `POST /super-admin/colleges/:id/admins/:admin_id/revoke-sessions`
- **Permission:** `platform.admin.write`
- **Behavior:**
  - Deactivates device notification push tokens in `platform.device_tokens`.
  - Re-verifies user status.
  - Documents limitation: Stateless JWT access tokens cannot be invalidated mid-flight until their expiry (24h) unless the user account status is set to non-`ACTIVE`.
- **Audit:** Records `COLLEGE_ADMIN_SESSIONS_REVOKED`.

### 7. Retrieve Login History
- **Path:** `GET /super-admin/colleges/:id/admins/:admin_id/login-history`
- **Permission:** `platform.admin.read`
- **Response:**
  - Retrieves authentic events from `platform.login_events` (`event_at`, `result`, `ip_address`, `device`, `user_agent`).
  - No fabricated timestamps or mock data.

---

## 8. Test Strategy & Safe Database Requirements

- **Test Database Policy:**
  - Under no circumstances will tests write dummy/test admin accounts or colleges into the live PostgreSQL database or alter genuine college `7203`.
  - Integration tests requiring live database mutations require `TEST_DATABASE_URL`. If unset, tests run using mock interfaces and unconfigured pool fail-closed validations.
- **Unit & Static Testing:**
  - Test payload validators (`ValidateProvisionFirstAdmin`, `ValidateUpdateAdminProfile`, `ValidateAdminStatus`).
  - Test JSON marshaling to guarantee zero leakage of `password_hash`, reset secrets, or credentials.
  - Test fail-closed behavior when service or database pool is nil.
  - Test last-admin guard logic.
  - `go test -v ./MODULES/SUPER-ADMIN/BACKEND/tests/...`
  - `go vet ./MODULES/SUPER-ADMIN/BACKEND/...`

---

## 9. Features Blocked by Missing Schema or Infrastructure

The following features cannot be implemented without modifying the database schema or external email/SMS infrastructure:

1. **Force Password Reset at Next Login:**
   - **Gap:** `app.users` lacks a `must_change_password boolean` or `password_reset_required` column, and `API/internal/auth/service.go` has no password reset check.
   - **Resolution:** Documented limitation. Will not fabricate a client-side only flag that gives a false sense of security.
2. **Password Reset Through One-Time Link:**
   - **Gap:** No `password_reset_tokens` table exists to persist secure token hashes and expiry timestamps. No email or SMS transmission service exists in the platform infrastructure.
   - **Resolution:** Documented limitation. The platform continues to support direct administrator password reset by authorized Super Admins via `/super-admin/colleges/:id/admin/password`.
3. **Instant Stateless Token Invalidation:**
   - **Gap:** `API/internal/auth/jwt.go` issues standard stateless HS256 JWTs without a database-backed session table or Redis blocklist.
   - **Resolution:** Revoking sessions deactivates device push tokens and deactivating the user prevents any new token generation. Existing JWTs expire naturally according to `JWT_DURATION`.
