# HMS Phase 19.8: Final Database Security Design Review

**Document Status:** FINAL ARCHITECTURAL DESIGN REVIEW (READ-ONLY)  
**Date:** 2026-10-17  
**Scope:** `D:\HMS\DATABASE\` Canonical Schema, Security Engine & Application Boundaries  
**Target File:** `D:\HMS\DOCS\security\HMS_PHASE_19_8_FINAL_DATABASE_SECURITY_DESIGN.md`  

---

## 1. Executive Summary & Verdict

### Executive Verdict: **DESIGN APPROVED — READY FOR CONTROLLED IMPLEMENTATION**

| Architectural Pillar | Evaluation | Resolution Summary |
| :--- | :---: | :--- |
| **SEC-02: RLS Architecture** | **RESOLVED IN DESIGN** | Solves the restrictive-only deadlock using the **Paired Dual-Policy Model**: an explicit `AS PERMISSIVE` base access grant paired with an immutable `AS RESTRICTIVE` tenant boundary. |
| **Super Admin Access Model** | **REDESIGNED (FAIL-CLOSED)** | Rejects naive `current_tenant_id() IS NULL` fallbacks. Establishes positive cryptographic session proof via `app.is_platform_admin()`. College tables **never** permit Super Admin bypass; platform tables fail closed when context is absent. |
| **Role & Privilege Model** | **RESOLVED IN DESIGN** | Clearly segregates cluster-level infrastructure role creation from schema-level migration grants. Application role `hms_app` is provisioned with `NOBYPASSRLS` and minimal required DML privileges. |
| **Broken Triggers (008 & 009)** | **RESOLVED IN DESIGN** | Replaces non-existent `app.users.college_id` queries with active membership verification against `platform.user_roles`. Preserves global/platform notification support. |
| **View Security (902_views)** | **RESOLVED IN DESIGN** | Evaluated all 9 views. Mandates `WITH (security_invoker = true)` across all 9 views to guarantee that caller RLS policies govern view execution under PostgreSQL 15+. |
| **Migration Integrity & Ordering** | **VERIFIED CLEAN** | Canonical migrations are complete and sequential. Historical duplicate reports were isolated to obsolete scratch patches; proposed patches in `scratch/proposed_patch/` are formally rejected. |
| **Safety Compliance** | **100% PRESERVED** | `DATABASE\` remained completely frozen. Zero SQL statements executed. No database roles or Docker containers modified. |

---

## 2. Mandatory Safety Confirmation

In compliance with the Phase 19.8 mandate:
- `D:\HMS\DATABASE\` remained completely **FROZEN** and unchanged.
- No migrations, DDL, or DML were executed against any database.
- No database containers, clusters, or Docker daemons were started or stopped.
- No Go source files, `.env` settings, or project structures were altered.
- All code samples and DDL proposals in this document are strictly labeled **UNAPPROVED — NOT EXECUTED**.

---

## 3. Redesigned Super Admin & Tenant Authorization Model

### 3.1 The Vulnerability of `current_tenant_id() IS NULL` Fallbacks
In preliminary remediation designs, it was suggested that hybrid tables allow access when:
$$\text{USING } (\text{college\_id} = \text{app.current\_tenant\_id}() \lor \text{app.current\_tenant\_id}() \text{ IS NULL})$$
**The Security Flaw:**
If a college endpoint handler experiences a bug (e.g., missing middleware, context timeout, uninitialized request context, or unauthenticated query), `app.current_tenant_id()` is `NULL`. Under the naive OR condition, this unauthenticated or broken request **fails open**, returning or modifying every college's rows in the table. In security engineering, **the absence of a tenant context must never be equated to Super Admin authorization.**

### 3.2 Architectural Boundary: The Two Operational Planes
The HMS database schema is fundamentally partitioned into two operational planes:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   COLLEGE OPERATIONAL PLANE (app.*)                   │
├────────────────────────────────────────────────────────────────────────┤
│ • 47 Tables: students, hostels, rooms, complaints, attendance, leaves  │
│ • STRICT TENANT BOUNDARY: college_id = app.current_tenant_id()         │
│ • ZERO Super Admin bypass. Even Super Admins inspecting a college must │
│   do so via delegated support access (SET LOCAL tenant_id = <college>) │
│ • If app.current_tenant_id() IS NULL ──▶ 100% REJECTED / 0 ROWS        │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   │ (Segregated from)
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   PLATFORM CONTROL PLANE (platform.*)                  │
├────────────────────────────────────────────────────────────────────────┤
│ • Global Catalogs (roles, modules, permissions): SELECT to hms_app     │
│ • Partitioned Control (settings, modules, approvals, onboarding):      │
│   - College Access: college_id = app.current_tenant_id()               │
│   - Platform Admin: POSITIVE PROOF via app.is_platform_admin()        │
│ • Missing Context ──▶ 100% REJECTED / FAIL-CLOSED                      │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Positive Cryptographic Proof: `app.is_platform_admin()`
When a Super Admin or platform operator executes a request:
1. Go middleware ([`auth.RequirePlatformScope()`](file:///D:/HMS/API/internal/server/router.go#L257)) cryptographically verifies the caller's JWT: `claims.Scope == "PLATFORM"`.
2. The transaction session explicitly sets transaction-local configuration parameters:
   ```sql
   SELECT set_config('app.current_scope', 'PLATFORM', true);
   SELECT set_config('app.current_user_id', '<uuid>', true);
   ```
3. PostgreSQL evaluates authorization via a dedicated `SECURITY DEFINER` function:
   ```sql
   -- UNAPPROVED — NOT EXECUTED
   CREATE OR REPLACE FUNCTION app.is_platform_admin()
   RETURNS boolean
   LANGUAGE sql
   STABLE
   SECURITY DEFINER
   SET search_path = platform, app, pg_temp
   AS $$
       SELECT current_setting('app.current_scope', true) = 'PLATFORM'
          AND EXISTS (
              SELECT 1
              FROM platform.user_roles ur
              JOIN platform.roles r ON r.role_id = ur.role_id
              WHERE ur.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
                AND r.scope = 'PLATFORM'
                AND r.role_code IN ('SUPER_ADMIN', 'PLATFORM_OPERATOR')
                AND ur.status = 'ACTIVE'
                AND (ur.expires_at IS NULL OR ur.expires_at > now())
          );
   $$;
   ```

**Security Guarantees:**
- If `app.current_tenant_id` is missing, but `app.is_platform_admin()` is `FALSE`, the query returns **0 rows**.
- A college tenant token can **never** trigger `is_platform_admin()` because `auth.RequireCollegeScope()` rejects platform scope, and `platform.user_roles` lacks platform roles for college users.
- An attacker stripping tenant headers fails closed.

---

## 4. Final Proposed RLS Policy Matrix

### 4.1 Policy Composition Rules
To guarantee mathematical isolation and eliminate the default-deny deadlock:
1. Every protected table has exactly **one `AS PERMISSIVE` base access policy** granted to `hms_app`.
2. Every protected table has exactly **one `AS RESTRICTIVE` isolation policy** for all commands (`FOR ALL`).
3. Under PostgreSQL policy algebra:
   $$\text{Result} = (\text{Permissive}_{\text{hms\_app}}) \land \text{Restrictive}_{\text{Tenant}}$$
   Both must evaluate to `TRUE`. If either is `FALSE`, the operation is denied.

### 4.2 Comprehensive Table Classification Matrix

| Table Category | Tables Included | RLS & Force RLS | Permissive Policy Expression (`TO hms_app`) | Restrictive Policy Expression (`FOR ALL`) | Access Semantics |
| :--- | :--- | :---: | :--- | :--- | :--- |
| **Category 1: College Tenant Tables** (47 tables) | `app.departments`, `app.programs`, `app.courses`, `app.academic_years`, `app.semesters`, `app.batches`, `app.hostels`, `app.blocks`, `app.floors`, `app.rooms`, `app.beds`, `app.bed_allocations`, `app.room_maintenance`, `app.gates`, `app.students`, `app.parents`, `app.student_parents`, `app.emergency_contacts`, `app.staff_profiles`, `app.incharge_hostels`, `app.security_assignments`, `app.attendance_cards`, `app.attendance_records`, `app.entry_exit_records`, `app.record_corrections`, `app.leave_requests`, `app.leave_approvals`, `app.leave_verification_logs`, `app.gate_passes`, `app.gate_pass_verifications`, `app.visitor_requests`, `app.visitors`, `app.visitor_visits`, `app.parcels`, `app.complaints`, `app.complaint_updates`, `app.sos_alerts`, `app.security_incidents`, `app.incident_updates`, `app.notifications`, `app.announcements`, `app.meal_menus`, `app.meal_timings`, `app.mess_notices`, `app.food_feedback`, `app.resource_items`, `app.resource_availability`, `app.reports_saved` | **ENABLE & FORCE** | `USING (college_id = app.current_tenant_id()) WITH CHECK (college_id = app.current_tenant_id())` | `USING (college_id = app.current_tenant_id()) WITH CHECK (college_id = app.current_tenant_id())` | **Strict Tenant Isolation.** Zero Super Admin bypass. Missing tenant context returns 0 rows. |
| **Category 2: Indirectly Scoped Tables** (1 table) | `app.notification_recipients` | **ENABLE & FORCE** | `USING (EXISTS (SELECT 1 FROM app.notifications n WHERE n.id = notification_recipients.notification_id AND (n.college_id = app.current_tenant_id() OR (n.college_id IS NULL AND app.current_tenant_id() IS NULL)))) WITH CHECK (...)` | `USING (EXISTS (SELECT 1 FROM app.notifications n WHERE n.id = notification_recipients.notification_id AND (n.college_id = app.current_tenant_id() OR (n.college_id IS NULL AND app.current_tenant_id() IS NULL)))) WITH CHECK (...)` | Tenant derived from parent notification. Supports college notifications and global platform notifications. |
| **Category 3: Partitioned Platform Tables** (6 tables) | `platform.approval_requests`, `platform.approval_steps`, `platform.college_settings`, `platform.college_modules`, `platform.college_onboarding`, `platform.support_access_grants` | **ENABLE & FORCE** | `USING ((app.current_tenant_id() IS NOT NULL AND college_id = app.current_tenant_id()) OR (app.is_platform_admin())) WITH CHECK ((app.current_tenant_id() IS NOT NULL AND college_id = app.current_tenant_id()) OR (app.is_platform_admin()))` | `USING ((app.current_tenant_id() IS NOT NULL AND college_id = app.current_tenant_id()) OR (app.is_platform_admin())) WITH CHECK (...)` | **Fail-Closed Dual Access.** College users see only their college. Super Admin must positively prove platform admin status. Missing context denies. |
| **Category 4: Global Catalogs & Identity** (9 tables) | `app.users`, `platform.colleges`, `platform.roles`, `platform.user_roles`, `platform.modules`, `platform.permissions`, `platform.role_permissions`, `platform.entitlement_templates`, `platform.device_tokens` | **DISABLED** | N/A (Secured via PostgreSQL table permissions: `SELECT` to `hms_app`; DML restricted to platform endpoints) | N/A | Global shared data. Users must authenticate across colleges. Roles/permissions are system-wide catalogs. |
| **Category 5: Hybrid / Nullable Tenant Tables** (4 tables) | `app.files`, `app.platform_notifications`, `platform.audit_logs`, `platform.login_events` | **ENABLE & FORCE** | `USING ((college_id = app.current_tenant_id()) OR (college_id IS NULL AND (app.is_platform_admin() OR app.current_tenant_id() IS NOT NULL))) WITH CHECK ((college_id = app.current_tenant_id()) OR (college_id IS NULL AND app.is_platform_admin()))` | `USING ((college_id = app.current_tenant_id()) OR (college_id IS NULL AND (app.is_platform_admin() OR app.current_tenant_id() IS NOT NULL))) WITH CHECK (...)` | College rows visible only to that college. Global rows (`college_id IS NULL`) readable system-wide; writable only by verified Platform Admins. |

---

## 5. Application Role & Privilege Architecture

### 5.1 Two-Tier Provisioning Model
To ensure least privilege and avoid embedding credentials in application migrations:
1. **Tier 1: Cluster-Level Infrastructure Provisioning (DBA / Terraform / Bootstrap Script):**
   - Role creation is a PostgreSQL cluster-level operation.
   - Executed once by `postgres` or cloud admin before migration execution.
   ```sql
   -- UNAPPROVED — NOT EXECUTED
   -- Infrastructure Bootstrap Script (init-user-db.sh / Terraform)
   CREATE ROLE hms_migrator WITH LOGIN PASSWORD '<migrator_secret>' CREATEDB NOCREATEROLE;
   CREATE ROLE hms_app WITH LOGIN PASSWORD '<app_secret>' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
   GRANT hms_app TO hms_migrator;
   ```
2. **Tier 2: Schema-Level Idempotent Grants (`900_security.sql`):**
   - Executed by `hms_migrator` as part of the automated migration sequence.
   - Ensures `hms_app` has strictly necessary permissions.

### 5.2 Explicit Privilege Matrix for `hms_app`

| Schema | Target Objects | Permitted Privileges | Prohibited Privileges | Security Enforcement Rationale |
| :--- | :--- | :--- | :--- | :--- |
| `platform`, `app` | Schemas | `USAGE` | `CREATE`, `DROP` | Allows schema resolution without permitting schema alterations. |
| `app` | All 47 Tenant Tables | `SELECT, INSERT, UPDATE, DELETE` | `TRUNCATE, REFERENCES, TRIGGER` | Runtime DML for operational records. RLS enforces tenant boundaries. |
| `app` | All Sequences | `USAGE, SELECT` | `UPDATE` | Generation of UUIDs/identifiers. |
| `platform` | Catalogs (`roles`, `modules`, `permissions`, `entitlement_templates`, `colleges`) | `SELECT` | `INSERT, UPDATE, DELETE, TRUNCATE` | System catalogs are read-only for application runtime. |
| `platform` | Operational (`college_settings`, `college_modules`, `college_onboarding`, `approval_requests`, `approval_steps`, `support_access_grants`, `device_tokens`) | `SELECT, INSERT, UPDATE, DELETE` | `TRUNCATE` | College-level configuration and approval workflows. |
| `platform` | Audits & Logs (`audit_logs`, `login_events`) | `SELECT, INSERT` | `UPDATE, DELETE, TRUNCATE` | Append-only security audit log. Immutability guaranteed at database privilege level. |
| `platform` | `platform.colleges` | `UPDATE (status, timezone, activated_at, suspended_at, deactivated_at, archived_at, lifecycle_reason, updated_at)` | `INSERT, DELETE, UPDATE(college_id, code)` | Lifecycle updates only. Prevents altering college primary keys or identifiers. |
| `platform`, `app` | Functions | `EXECUTE` | `ALTER, DROP` | Allows executing `current_tenant_id()`, `is_platform_admin()`, and triggers. |

---

## 6. Trigger-by-Trigger Correction Design

### 6.1 `app.validate_communication_tenant_consistency` (`008_communication.sql`)
- **Verified Schema State:** `app.users` contains identity columns (`user_id`, `email`, `phone`, `status`, `password_hash`). It **does not have `college_id`**.
- **Role Association Architecture:** College membership is established through `platform.user_roles(user_id, college_id, status, expires_at)`.
- **Global Notification Architecture:** `app.notifications.college_id` is nullable. When `NULL`, the notification is global/platform-wide.

```sql
-- UNAPPROVED — NOT EXECUTED
-- REFINED TRIGGER FUNCTION FOR 008_communication.sql
CREATE OR REPLACE FUNCTION app.validate_communication_tenant_consistency()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    related_college_id uuid;
BEGIN
    -- NOTIFICATIONS
    IF TG_TABLE_NAME = 'notifications' THEN
        IF NEW.college_id IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1 FROM platform.colleges
                WHERE college_id = NEW.college_id AND status = 'ACTIVE'
            ) THEN
                RAISE EXCEPTION 'Invalid or inactive college_id in notifications: %', NEW.college_id;
            END IF;
        END IF;

    -- NOTIFICATION RECIPIENTS
    ELSIF TG_TABLE_NAME = 'notification_recipients' THEN
        SELECT college_id INTO related_college_id
        FROM app.notifications
        WHERE id = NEW.notification_id;

        IF related_college_id IS NOT NULL THEN
            -- College-scoped notification: recipient must hold ACTIVE, non-expired role in that college
            IF NOT EXISTS (
                SELECT 1
                FROM platform.user_roles ur
                WHERE ur.user_id = NEW.user_id
                  AND ur.college_id = related_college_id
                  AND ur.status = 'ACTIVE'
                  AND (ur.expires_at IS NULL OR ur.expires_at > now())
            ) THEN
                RAISE EXCEPTION
                    'Notification recipient % does not have active membership in college %',
                    NEW.user_id, related_college_id;
            END IF;
        ELSE
            -- Global/Platform notification: recipient must be an active system user
            IF NOT EXISTS (
                SELECT 1 FROM app.users u
                WHERE u.user_id = NEW.user_id AND u.status IN ('ACTIVE', 'INVITED')
            ) THEN
                RAISE EXCEPTION 'Notification recipient % is not an active user', NEW.user_id;
            END IF;
        END IF;

    -- ANNOUNCEMENTS
    ELSIF TG_TABLE_NAME = 'announcements' THEN
        IF NOT EXISTS (
            SELECT 1 FROM platform.colleges
            WHERE college_id = NEW.college_id AND status = 'ACTIVE'
        ) THEN
            RAISE EXCEPTION 'Invalid or inactive college_id in announcements: %', NEW.college_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;
```

### 6.2 `app.validate_meals_resources_tenant_consistency` (`009_meals_resources.sql`)
- **Verified Schema State:** `app.reports_saved` requires `owner_user_id` to hold active membership in `NEW.college_id`.
- **Files Architecture:** `app.files.college_id` is nullable. When `NULL`, the file is a platform-level file; when populated, it must belong to a valid college.

```sql
-- UNAPPROVED — NOT EXECUTED
-- REFINED TRIGGER FUNCTION FOR 009_meals_resources.sql (reports_saved & files segment)
    ...
    -- SAVED REPORTS
    ELSIF TG_TABLE_NAME = 'reports_saved' THEN
        IF NOT EXISTS (
            SELECT 1 FROM platform.colleges
            WHERE college_id = NEW.college_id AND status = 'ACTIVE'
        ) THEN
            RAISE EXCEPTION 'Invalid or inactive college_id in reports_saved: %', NEW.college_id;
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM platform.user_roles ur
            WHERE ur.user_id = NEW.owner_user_id
              AND ur.college_id = NEW.college_id
              AND ur.status = 'ACTIVE'
              AND (ur.expires_at IS NULL OR ur.expires_at > now())
        ) THEN
            RAISE EXCEPTION
                'Report owner % does not hold active membership in college %',
                NEW.owner_user_id, NEW.college_id;
        END IF;

    -- FILES
    ELSIF TG_TABLE_NAME = 'files' THEN
        IF NEW.college_id IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1 FROM platform.colleges
                WHERE college_id = NEW.college_id AND status = 'ACTIVE'
            ) THEN
                RAISE EXCEPTION 'Invalid or inactive college_id in files: %', NEW.college_id;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;
```

---

## 7. Individual Assessment of All Nine Views (`902_views.sql`)

Under PostgreSQL 15+, views created without `security_invoker = true` default to `security_definer`, executing under the view owner's context. Because `hms_migrator` (or `postgres`) owns the views, querying a view as `hms_app` **completely bypasses RLS on underlying tables**.

Every view was individually audited for `WITH (security_invoker = true)` suitability:

| View Name | Underlying Tables Queried | Aggregations / Joins | Security Assessment & Invoker Mandate |
| :--- | :--- | :--- | :--- |
| `app.v_current_student_bed_allocation` | `bed_allocations`, `students`, `beds`, `rooms`, `floors`, `blocks`, `hostels` | Multi-table INNER/LEFT joins | **MANDATORY.** If run as definer, student bed allocations across all colleges are exposed. Caller RLS must restrict base rows to `current_tenant_id`. |
| `app.v_student_current_location` | `students`, `entry_exit_records` | Lateral join selecting latest gate scan | **MANDATORY.** Exposes real-time physical student locations. Bypassing RLS would allow cross-college student tracking. |
| `app.v_hostel_occupancy` | `hostels`, `beds`, `bed_allocations` | `COUNT(...)`, `GROUP BY`, occupancy percentage calculation | **MANDATORY.** Definitive multi-tenant aggregation risk. As definer, occupancy counts would aggregate across colleges. As invoker, base rows filter first. |
| `app.v_open_complaint_summary` | `complaints` | `COUNT(*)`, `MIN/MAX(created_at)`, `GROUP BY` | **MANDATORY.** Summarizes active complaints. Must aggregate only the calling tenant's complaints. |
| `app.v_active_sos_alerts` | `sos_alerts`, `students` | Real-time emergency joins | **MANDATORY.** High-sensitivity safety data. SOS alerts must never cross college boundaries. |
| `app.v_today_meal_menus` | `meal_menus`, `hostels` | Date filter on published mess menus | **MANDATORY.** Prevents students/staff in College A from viewing or modifying meal menus of College B. |
| `app.v_resource_availability` | `resource_items`, `resource_availability` | Inventory join | **MANDATORY.** Prevents cross-college inventory visibility. |
| `app.v_pending_leave_requests` | `leave_requests`, `students` | Active pending leave requests | **MANDATORY.** Exposes student travel itineraries, destinations, and phone numbers. Strict caller RLS required. |
| `app.v_current_visitor_activity` | `visitor_visits`, `visitors`, `students` | Active check-in visitor activity | **MANDATORY.** Exposes visitor personal details (phone, email, purpose). Strict caller RLS required. |

**Verdict:** All 9 views strictly query Category 1 tenant tables in schema `app`. **All 9 views must be defined with `WITH (security_invoker = true)`.**

---

## 8. Migration Ordering & Integrity Verification

A definitive source-level verification was conducted across all files:

1. **Movement / Requests Separation:**
   - Source inspection verified that `005_movement.sql` (4 tables: attendance cards, records, entry/exit, corrections) and `006_requests.sql` (9 tables: leave requests, approvals, verification logs, gate passes, visitor requests, visitors, visits, parcels) define completely distinct, non-overlapping tables.
   - **Conclusion:** Zero duplication exists in canonical migrations. Obsolete scratch patches were the sole source of historical confusion.
2. **Index Target Column Validation:**
   - `901_indexes.sql`: Verified that `publish_at` exists on `app.announcements`, `app.platform_notifications`, and `app.mess_notices`.
   - Verified that `is_primary` exists on `app.emergency_contacts`. The broken patch in `scratch/` referencing `priority` is rejected.
   - **Cleanup:** Redundant duplicate index `idx_emergency_contacts_student` defined in both `004_people.sql` (line 960) and `901_indexes.sql` (line 479) will be pruned from `901_indexes.sql`.
3. **Foreign Key Alignment:**
   - Verified that all academic foreign keys in `004_people.sql` correctly match `<name>_id` primary keys in `002_academic.sql`.
   - Verified that `app.bed_allocations.student_id` is nullable and references `app.students(id)` `ON DELETE SET NULL`.
4. **Seed Constraint Compatibility:**
   - `001_platform.sql` line 271 defines `CHECK (priority IN ('M', 'S', 'R'))`.
   - `903_seed.sql` uniformly seeds `'M'`. Zero constraint violations exist.

---

## 9. File-by-File Implementation Sequence

When `DATABASE\` is unfrozen, changes must be applied in the following dependency order:

```
Step 1: Fix Trigger Functions (008 & 009)
   │
   ▼
Step 2: Update View Definitions (902_views)
   │
   ▼
Step 3: Update Security Engine & Role Grants (900_security)
   │
   ▼
Step 4: Prune Duplicate Index (901_indexes)
   │
   ▼
Step 5: Extend Schema Validator (validate.sql)
```

### Detailed Sequence & Regression Tests

| Step | Target File | Exact Modifications | Preconditions & Risks | Rollback Procedure | Specific Regression Test |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **1** | `DATABASE/migrations/008_communication.sql` | Refactor `validate_communication_tenant_consistency()` lines 413–421 to query `platform.user_roles`. | Low risk. No table structural change. | Revert file from git. | Insert recipient with valid college role (passes); insert recipient with invalid college role (aborts). |
| **2** | `DATABASE/migrations/009_meals_resources.sql` | Refactor `validate_meals_resources_tenant_consistency()` lines 585–593 to query `platform.user_roles`. | Low risk. No table structural change. | Revert file from git. | Insert saved report with valid owner (passes); insert with mismatched owner (aborts). |
| **3** | `DATABASE/migrations/902_views.sql` | Add `WITH (security_invoker = true)` to all 9 view statements. | Requires PostgreSQL 15+. Views must be owned by `hms_migrator`. | Remove `WITH (security_invoker = true)` clause. | Query `v_hostel_occupancy` as `hms_app` under College A context. Assert 0 College B rows. |
| **4** | `DATABASE/migrations/900_security.sql` | 1. Add `app.is_platform_admin()`.<br/>2. Add paired Permissive + Restrictive policies.<br/>3. Add Category 3 platform table policies.<br/>4. Add table grants to `hms_app`. | Critical step. Incorrect policy syntax locks out `hms_app`. | Revert `900_security.sql` to baseline. | Connect as `hms_app`, set tenant context, select from `app.students`. Assert exactly College A rows returned. |
| **5** | `DATABASE/migrations/901_indexes.sql` | Remove duplicate `idx_emergency_contacts_student` on line 479. | Low risk. Pruning redundant index. | Revert file from git. | Confirm index on `app.emergency_contacts(student_id)` exists and is utilized by `EXPLAIN`. |
| **6** | `DATABASE/validate.sql` | Add assertions: `hms_app` exists with `NOBYPASSRLS`; all 9 views have `security_invoker = true`; all tenant tables have permissive policies. | Must reflect new security architecture. | Revert file from git. | Run `validate.sql` via `psql`. Assert 0 exceptions and complete PASS notice. |

---

## 10. Outstanding Design Decisions Requiring Sign-Off

The following technical decisions are fully designed and documented, ready for formal architectural sign-off:

1. **Platform Table Access Policy (Decision Confirmed):**
   - **Adopted Design:** Enforce dual access on Category 3 platform tables via `app.is_platform_admin()`. College users access only their rows; Super Admins access all rows upon cryptographic proof; missing context fails closed.
2. **Expired Role Cutoff (Decision Confirmed):**
   - **Adopted Design:** Strict cutoff via `(expires_at IS NULL OR expires_at > now())`. When a student or staff role expires, notification delivery to that recipient is immediately blocked to prevent leaking post-tenure institutional communications.
3. **Cluster Role Initialization vs Migrations:**
   - **Adopted Design:** Role `hms_app` creation script is maintained in `INFRASTRUCTURE/docker/init-db.sh` for development and Terraform for production. `900_security.sql` includes an idempotent `IF NOT EXISTS` block to ensure standalone migration runs succeed seamlessly.

---

## 11. Final Verification & Next Safe Step

### Final Safety Statement
This design review was conducted in a purely read-only manner:
- Zero repository files were modified or deleted.
- Zero SQL statements were executed against any database.
- No Docker daemons or containers were started or stopped.
- Staging and production deployment remain strictly **NOT APPROVED** until the remediation sequence is executed and validated in a disposable test environment.

### Next Safe Step
1. **Request Authorization to Unfreeze `DATABASE\`**:
   Unfreeze `D:\HMS\DATABASE\` for controlled source modifications.
2. **Apply Verified File-by-File Fixes**:
   Implement Steps 1 through 6 in `008_communication.sql`, `009_meals_resources.sql`, `902_views.sql`, `900_security.sql`, `901_indexes.sql`, and `validate.sql`.
3. **Execute Disposable PostgreSQL Validation Workflow**:
   Spin up an isolated container `hms_disposable_test` and run the full end-to-end verification script to confirm exit code 0 across all migrations, RLS isolation, and automated Go test suites.
