# Feature 4 — College Configuration Implementation Report

## 1. Overview & Architecture Conformance

This document records the backend implementation of **Feature 4: College Configuration** for the HMS Super Admin module, according to `HMS_Super_Admin_Architecture.pdf`, Section 7.4.

College Configuration provides platform administrators with centralized governance over platform-level tenant settings for onboarded colleges, strictly bounded from college-owned operational policies (e.g., hostel curfew, daily gate passes, room allocation).

All changes were strictly constrained within:
`D:\HMS\MODULES\SUPER-ADMIN\BACKEND\`

Zero modifications were made to root `go.mod`, database schemas/migrations, API core, or frontend files.

---

## 2. Configuration Registry & Supported Categories

The platform configuration schema is governed by `GlobalSettingDefinitions` in `models/setting.go`.

### A. General Category (`category: "general"`)
| Key | Data Type | Description | Default Value | Security/Validation Rules |
|---|---|---|---|---|
| `college_name` | `string` | Display name of the institution | Inherited from `platform.colleges.name` | 1-200 characters, non-empty |
| `logo_url` | `string` | Branding logo asset URL | `""` | Valid HTTP/HTTPS URI or empty |
| `contact_email` | `string` | Administrative alert email | Inherited from `platform.colleges.contact_email` | RFC 5322 email address format |
| `contact_phone` | `string` | Administrative phone contact | `""` | Valid international/national phone format |
| `address` | `string` | Campus physical address | `""` | Max 500 characters |
| `timezone` | `string` | Institution timezone | `Asia/Kolkata` (or college record) | Valid IANA timezone identifier (`time.LoadLocation`) |
| `locale` | `string` | Default UI locale | `en-IN` | Supported locale tag (`en-IN`, `hi-IN`, `ta-IN`, `te-IN`, `en-US`, etc.) |
| `academic_year_start` | `string` | Academic cycle start month | `"06"` (June) | Month representation `"01"` to `"12"` |

### B. Security Category (`category: "security"`)
Tenant-level security settings may be **stricter** than platform minimums, but must **never weaken mandatory company-wide security floors**:
| Key | Data Type | Description | Platform Default / Security Floor | Mandatory Security Floor Rules |
|---|---|---|---|---|
| `password_policy` | `object` | Tenant password policy | `min_length: 8`<br>`max_age_days: 90`<br>`require_uppercase: true`<br>`require_number: true` | - `min_length >= 8` (attempt to set < 8 is **REJECTED**)<br>- `max_age_days <= 90` (attempt to set > 90 is **REJECTED**)<br>- `require_uppercase` cannot be false<br>- `require_number` cannot be false |
| `session_policy` | `object` | Tenant session timeouts | `idle_timeout_minutes: 30`<br>`absolute_timeout_hours: 24`<br>`max_concurrent_sessions: 2` | - `idle_timeout_minutes <= 30` (attempt to set > 30 is **REJECTED**)<br>- `absolute_timeout_hours <= 24` (attempt to set > 24 is **REJECTED**)<br>- `max_concurrent_sessions` between 1 and 5 |

### C. System Category (`category: "system"`)
| Key | Data Type | Description | Default Value | Validation Rules |
|---|---|---|---|---|
| `data_retention_policy` | `object` | Statutory data retention policy | `classification: "STANDARD"`<br>`retention_years: 7` | Classification must be one of: `STANDARD`, `EXTENDED`, `ARCHIVAL`, `LEGAL_HOLD`. Years 1-30. |
| `allowed_notification_channels` | `array` | Permitted outbound alert channels | `["EMAIL", "IN_APP"]` | Non-empty array drawn from: `EMAIL`, `SMS`, `WHATSAPP`, `IN_APP`. |

---

## 3. Ownership Boundary Enforcement

Super Admin manages **platform tenant governance**. Operational daily hostel administration belongs exclusively to the **College Admin** module.

The following keys are defined as `CollegeOwnedOperationalSettings` and are **rejected** with HTTP 400 Bad Request if attempted via Super Admin:
- `curfew_time`
- `attendance_tolerance`
- `room_allocation_rules`
- `leave_approval_policy`
- `visitor_policy`
- `gate_pass_rules`
- `meal_schedule`
- `night_curfew_exceptions`

---

## 4. API Endpoints Specification

All endpoints are registered under `/api/v1/super-admin/colleges/:id/settings`:

### 1. View Effective Configuration
- **Method & Path**: `GET /api/v1/super-admin/colleges/:id/settings`
- **Permission**: `requireView`
- **Query Parameters**:
  - `category` (optional): `general`, `security`, `system`
  - `include_sensitive` (optional): `true` / `false` (requires `SUPER_ADMIN` or `PLATFORM_ADMIN`)
  - `limit` (optional): bounded pagination (1-100, default 50)
  - `offset` (optional): pagination offset (>= 0)
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "settings": [
        {
          "setting_key": "timezone",
          "category": "general",
          "display_name": "Institutional Timezone",
          "value": "Asia/Kolkata",
          "source": "GLOBAL_DEFAULT",
          "is_overridden": false,
          "is_sensitive": false,
          "data_type": "string"
        }
      ],
      "total": 12,
      "limit": 50,
      "offset": 0
    }
  }
  ```

### 2. View Specific Setting
- **Method & Path**: `GET /api/v1/super-admin/colleges/:id/settings/:key`
- **Permission**: `requireView` (privileged auth required if setting is sensitive)
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "setting": {
        "setting_key": "password_policy",
        "category": "security",
        "display_name": "Password Security Policy",
        "value": {
          "min_length": 10,
          "max_age_days": 60,
          "require_uppercase": true,
          "require_number": true
        },
        "source": "EXPLICIT_OVERRIDE",
        "is_overridden": true,
        "is_sensitive": false,
        "data_type": "object",
        "updated_at": "2026-10-19T22:00:00Z"
      }
    }
  }
  ```

### 3. Compare with Global Defaults
- **Method & Path**: `GET /api/v1/super-admin/colleges/:id/settings/compare`
- **Permission**: `requireView`
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "comparisons": [
        {
          "setting_key": "session_policy",
          "category": "security",
          "display_name": "User Session Expiry Policy",
          "global_default": {
            "idle_timeout_minutes": 30,
            "absolute_timeout_hours": 24,
            "max_concurrent_sessions": 2
          },
          "effective_value": {
            "idle_timeout_minutes": 15,
            "absolute_timeout_hours": 12,
            "max_concurrent_sessions": 2
          },
          "is_overridden": true,
          "is_override_valid": true,
          "is_sensitive": false
        }
      ]
    }
  }
  ```

### 4. Update Permitted Configuration
- **Method & Path**: `PUT /api/v1/super-admin/colleges/:id/settings/:key`
- **Permission**: `requireManage` + privileged role (`SUPER_ADMIN` or `PLATFORM_ADMIN`)
- **Request Body**:
  ```json
  {
    "setting_value": {
      "idle_timeout_minutes": 15,
      "absolute_timeout_hours": 12,
      "max_concurrent_sessions": 2
    }
  }
  ```
- **Response**: HTTP 200 with updated setting object.

### 5. Reset Setting to Global Default
- **Method & Path**: `POST /api/v1/super-admin/colleges/:id/settings/:key/reset`
- **Permission**: `requireManage` + privileged role
- **Request Body**:
  ```json
  {
    "reason": "Realigning with company-wide baseline policy"
  }
  ```
- **Behavior**:
  - Confirms an explicit override exists; if not, returns 400 (`setting does not have an explicit override to reset`).
  - Re-validates the global default value before applying.
  - Deletes explicit override row in transaction.
  - Records `RESET_COLLEGE_SETTING` audit log with actor ID, reason, old value, and new value atomically.

### 6. View Setting History
- **Method & Path**: `GET /api/v1/super-admin/colleges/:id/settings/history`
- **Permission**: `requireView`
- **Query Parameters**: `key` (optional filter), `limit` (default 20, max 100), `offset`
- **Response**: Paginated audit log records for setting changes.

### 7. Revert to Historical Version
- **Method & Path**: `POST /api/v1/super-admin/colleges/:id/settings/:key/revert`
- **Permission**: `requireManage` + privileged role
- **Request Body**:
  ```json
  {
    "audit_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "reason": "Reverting incorrect configuration changes applied earlier"
  }
  ```
- **Behavior**:
  - Validates historical audit entry exists in `platform.audit_logs`.
  - **Revalidates the historical value against CURRENT mandatory security limits** (prevents restoring stale policies that violate newer company security floors).
  - Applies historical value as a new update (preserves history; never erases intervening audit logs).
  - Records `REVERT_COLLEGE_SETTING` audit log with `reverted_from_audit_id`.

---

## 5. Security & Transaction Guarantees

1. **Transaction Integrity**: All mutations (`UpdateCollegeSetting`, `ResetCollegeSetting`, `RevertCollegeSetting`) execute inside `WithPlatformTransaction`. If the database write fails or the audit log write fails, the entire transaction rolls back.
2. **Fail Closed**: If actor context extraction fails, mutations reject immediately with HTTP 401 Unauthorized.
3. **No Secret Leakage**: Sensitive settings are masked as `"[REDACTED]"` on reads and comparison unless explicitly requested by an authorized privileged caller. Raw passwords/tokens are prohibited.
4. **Router Order**: Static Gin subpaths (`/settings/compare` and `/settings/history`) are registered before parameterized route `/:id/settings/:key` to avoid routing collisions.

---

## 6. Schema Findings & Future Schema Notes

- **Current Schema Support**: `platform.college_settings` uses `(college_id, setting_key)` as a primary key with `setting_value JSONB` and `is_sensitive BOOLEAN`. It lacks an integer `version` column.
- **Truthful Audit-Based Versioning**: Rather than fabricating an in-memory version counter, configuration versions and history are truthfully sourced and referenced via `platform.audit_logs` records (`audit_id UUID`), fulfilling versioning and reversion requirements.
- **Future Schema Recommendation**: A dedicated column `version INTEGER DEFAULT 1 NOT NULL` on `platform.college_settings` would enable optimistic concurrency control (`ETag` / `If-Match`) for multi-administrator concurrent editing.
