# HMS Phase 19.7: Database Migration Remediation Package

**Document Status:** READ-ONLY AUDIT & REMEDIATION PLAN  
**Date:** 2026-10-17  
**Scope:** `D:\HMS\DATABASE\` and Associated Security Architecture  
**Execution Authority:** Antigravity Autonomous Security Subsystem  
**Target File:** `D:\HMS\DOCS\security\HMS_PHASE_19_7_DATABASE_REMEDIATION_PACKAGE.md`  

---

## 1. Executive Summary & Verdict

### Executive Verdict: **READY FOR REVIEW (WITH DESIGN DECISION MATRIX)**

| Evaluation Dimension | Status | Key Evidence / Conclusion |
| :--- | :---: | :--- |
| **SEC-02: RLS Policy Architecture** | **CONFIRMED DEFECT** | `900_security.sql` implements `AS RESTRICTIVE` policies across all tenant tables without an underlying `AS PERMISSIVE` baseline policy. Under PostgreSQL rules, this causes an unconditional default-deny deadlock for any non-superuser role (`hms_app`). |
| **Database Role & Grants** | **CONFIRMED DEFECT** | `900_security.sql` revokes all privileges from `PUBLIC`, but no migration creates `hms_app` or grants table, sequence, or schema privileges. The application cannot connect or execute queries as a least-privilege role. |
| **Broken Triggers** | **CONFIRMED DEFECT** | Trigger functions in `008_communication.sql` (line 417) and `009_meals_resources.sql` (line 589) reference non-existent column `app.users.college_id`. Runtime inserts into `app.notification_recipients` and `app.reports_saved` crash with `column does not exist`. |
| **View Security Invocation** | **CONFIRMED DEFECT** | All 9 operational/reporting views in `902_views.sql` omit `WITH (security_invoker = true)`. Under PostgreSQL 15+, views default to `security_definer`, bypassing caller RLS policies. |
| **Proposed Patch Traps in `scratch/`** | **VERIFIED RISKS** | `scratch/proposed_patch/` contains severe regressions: `009_meals_resources.sql` was truncated from 777 to 145 lines (omitting all triggers/indexes); `901_indexes.sql` referenced a non-existent column `priority` on `app.emergency_contacts`. These patches must **NEVER** be applied. |
| **Safety Compliance** | **STRICTLY PRESERVED** | `DATABASE\` was 100% frozen. Zero SQL executed. No Docker containers started or stopped. Zero `.env` secrets exposed. |

---

## 2. Mandatory Safety Confirmation

In strict compliance with the boundaries of Phase 19.7:
1. `D:\HMS\DATABASE\` remained completely **UNTOUCHED**. No file was created, modified, deleted, renamed, or reformatted.
2. Zero SQL statements were executed against any database.
3. No database containers were started, stopped, or created.
4. No database roles, grants, schemas, or policies were altered.
5. No application source code, configuration, or dependencies were modified.
6. Zero `.env` secrets, credentials, or tokens were exposed.
7. All proposed patches in `scratch/proposed_patch/` were analyzed read-only and rejected due to verified defects.
8. Every SQL proposal in this document is explicitly marked **UNAPPROVED — NOT EXECUTED**.

---

## 3. Prior Security Reports Inspected

The following security documentation in `D:\HMS\DOCS\security\` and the artifact repository was reviewed to establish continuity:

1. **`DATABASE_SECURITY_REVIEW_PHASE_18_5.md`**: Initial database migration security review identifying SEC-01 through SEC-10.
2. **`HMS_PHASE_18_6_CRITICAL_SECURITY_VERIFICATION.md`**: In-depth verification of SEC-01 (Go context disconnection) and SEC-02 (RLS restrictive policy deadlock).
3. **`HMS_PHASE_19_REMEDIATION_PLAN.md`**: Master roadmap detailing the phased remediation approach.
4. **`HMS_PHASE_19_3_19_4_VERIFICATION.md`**: Static analysis of trigger column mismatches and role architecture gaps.
5. **`HMS_PHASE_19_5_TENANT_CONTEXT_REMEDIATION.md`**: Verification of Go-side request transaction middleware and savepoint re-entrancy.
6. **`HMS_PHASE_19_6_INDEPENDENT_AUDIT.md`**: Independent audit confirming Go application remediation is defect-free while database-level blockers remain.

---

## 4. Canonical Migration Inventory & Dependency Map

An exhaustive audit of `D:\HMS\DATABASE\migrations\` identified 15 sequential migration files comprising 68 base tables, 9 views, and core functions:

```
000_extensions.sql
       │
       ▼
001_platform.sql ◄─────────────────────────────────────────────┐
       │                                                       │
       ├─────────────────┬─────────────────┬───────────────────┤
       ▼                 ▼                 ▼                   │
002_academic.sql  003_hostel.sql    010_super_admin.sql        │
       │                 │                                     │
       └────────┬────────┘                                     │
                ▼                                              │
         004_people.sql                                        │
                │                                              │
       ┌────────┴────────┐                                     │
       ▼                 ▼                                     │
005_movement.sql  006_requests.sql                             │
       │                 │                                     │
       ├─────────────────┴────────┬───────────────────┐        │
       ▼                          ▼                   ▼        │
007_support.sql            008_communication.sql 009_meals.sql │
       │                          │                   │        │
       └──────────────────────────┼───────────────────┘        │
                                  ▼                            │
                           900_security.sql                    │
                                  │                            │
                                  ├───────────────────┐        │
                                  ▼                   ▼        │
                           901_indexes.sql     902_views.sql   │
                                  │                   │        │
                                  └─────────┬─────────┘        │
                                            ▼                  │
                                     903_seed.sql ─────────────┘
```

### Complete Migration Inventory Table

| File | Size (Bytes) | Lines | Primary Purpose | Key Objects Created / Altered | Dependencies |
| :--- | :---: | :---: | :--- | :--- | :--- |
| `000_extensions.sql` | 1,531 | 48 | Foundation extensions & schemas | Extensions `pgcrypto`, `citext`; Schemas `platform`, `app`; Function `platform.generate_uuid()` | None |
| `001_platform.sql` | 28,350 | 949 | Platform control-plane & identity | 17 tables: `platform.colleges`, `app.users`, `platform.roles`, `platform.user_roles`, `platform.modules`, `platform.permissions`, `platform.role_permissions`, `platform.college_modules`, `platform.entitlement_templates`, `platform.college_settings`, `platform.college_onboarding`, `platform.approval_requests`, `platform.approval_steps`, `platform.audit_logs`, `platform.login_events`, `platform.support_access_grants`, `platform.device_tokens` | `000` |
| `002_academic.sql` | 24,922 | 865 | Academic structure | 6 tables: `app.departments`, `app.programs`, `app.courses`, `app.academic_years`, `app.semesters`, `app.batches` | `000`, `001` |
| `003_hostel.sql` | 28,289 | 1,016 | Hostel physical structure | 8 tables: `app.hostels`, `app.blocks`, `app.floors`, `app.rooms`, `app.beds`, `app.bed_allocations` (initial), `app.room_maintenance`, `app.gates` | `000`, `001` |
| `004_people.sql` | 25,640 | 1,010 | Student, parent, staff profiles | 7 tables: `app.students`, `app.parents`, `app.student_parents`, `app.emergency_contacts`, `app.staff_profiles`, `app.incharge_hostels`, `app.security_assignments`; Alters `app.bed_allocations` (adds `student_id`) | `000`, `001`, `002`, `003` |
| `005_movement.sql` | 17,055 | 582 | Attendance & gate movement | 4 tables: `app.attendance_cards`, `app.attendance_records`, `app.entry_exit_records`, `app.record_corrections` | `000`, `001`, `003`, `004` |
| `006_requests.sql` | 23,484 | 844 | Requests, passes & visitors | 9 tables: `app.leave_requests`, `app.leave_approvals`, `app.leave_verification_logs`, `app.gate_passes`, `app.gate_pass_verifications`, `app.visitor_requests`, `app.visitors`, `app.visitor_visits`, `app.parcels` | `000`, `001`, `003`, `004`, `005` |
| `007_support.sql` | 18,232 | 584 | Complaints, SOS, security incidents | 5 tables: `app.complaints`, `app.complaint_updates`, `app.sos_alerts`, `app.security_incidents`, `app.incident_updates` | `000`, `001`, `003`, `004` |
| `008_communication.sql` | 15,583 | 556 | Notifications & announcements | 4 tables: `app.notifications`, `app.notification_recipients`, `app.announcements`, `app.platform_notifications`; Trigger `trg_validate_notification_recipients_tenant` (**DEFECTIVE**) | `000`, `001` |
| `009_meals_resources.sql` | 22,066 | 777 | Mess, resources, files, saved reports | 8 tables: `app.meal_menus`, `app.meal_timings`, `app.mess_notices`, `app.food_feedback`, `app.resource_items`, `app.resource_availability`, `app.reports_saved`, `app.files`; Trigger `validate_meals_resources_tenant_consistency` (**DEFECTIVE**) | `000`, `001`, `003`, `004` |
| `010_super_admin_platform.sql` | 15,915 | 576 | Platform lifecycle & audit extensions | Alters `platform.colleges`, `platform.college_modules`, `platform.approval_requests`, `platform.approval_steps`, `platform.audit_logs`, `platform.support_access_grants` | `001` |
| `900_security.sql` | 10,919 | 413 | Row Level Security & Isolation | Functions `app.current_tenant_id()`, `app.has_tenant_context()`, `app.tenant_row_visible()`; Dynamic RLS enablement on `app.*`; RESTRICTIVE policies (**DEFECTIVE**); `REVOKE ALL FROM PUBLIC` (**DEFECTIVE: missing role grant**) | `001`–`010` |
| `901_indexes.sql` | 37,491 | 1,165 | Production performance indexes | B-tree indexes across all tables; Contains redundant index definition on `app.emergency_contacts(student_id)` | `001`–`010` |
| `902_views.sql` | 13,216 | 568 | Operational & reporting views | 9 views in `app`: `v_current_student_bed_allocation`, `v_student_current_location`, `v_hostel_occupancy`, `v_open_complaint_summary`, `v_active_sos_alerts`, `v_today_meal_menus`, `v_resource_availability`, `v_pending_leave_requests`, `v_current_visitor_activity` (**DEFECTIVE: missing security_invoker**) | `001`–`010`, `900` |
| `903_seed.sql` | 14,877 | 719 | Seed catalog data | Seeds `platform.modules`, `platform.roles`, `platform.permissions`, `platform.role_permissions`, `platform.entitlement_templates` | `001`, `010` |
| `validate.sql` | 17,794 | 623 | Schema structural validator | Validates 68 tables, 9 views, extensions, PKs, FKs, RLS enablement, and constraint integrity | All |

---

## 5. Remediation Finding A — SEC-02: RLS Policy Architecture

### 5.1 Root Cause Analysis of Restrictive-Only Deadlock
In `900_security.sql` lines 195–208, the policy generation loop executes:
```sql
CREATE POLICY %I
ON %I.%I
AS RESTRICTIVE
FOR ALL
USING (college_id = app.current_tenant_id())
WITH CHECK (college_id = app.current_tenant_id())
```
Under PostgreSQL documentation and engine specifications:
1. When Row-Level Security is enabled on a table, PostgreSQL evaluates policies in two sets: **Permissive** (`OR`-combined) and **Restrictive** (`AND`-combined).
2. Effective row visibility evaluates as:
   $$\text{Allowed} = (\text{Permissive}_1 \lor \text{Permissive}_2 \lor \dots) \land \text{Restrictive}_1 \land \text{Restrictive}_2 \land \dots$$
3. If **zero permissive policies** exist on a table, the permissive set evaluates to an empty set, which PostgreSQL defaults to **`FALSE`** (implicit deny).
4. Therefore, regardless of whether `app.current_tenant_id()` is validly populated, the expression evaluates to:
   $$\text{Allowed} = \text{FALSE} \land (\text{college\_id} = \text{tenant\_id}) = \text{FALSE}$$
5. Result: Any non-superuser role (such as `hms_app`) experiences an immediate, total read/write lock-out across all 49 tenant tables.

### 5.2 Proposed Dual-Policy Architecture
To eliminate the deadlock while preserving strict, mathematically unbreakable tenant isolation, every tenant-scoped table must implement the **Paired Dual-Policy Model**:
1. **Base Access Policy (`AS PERMISSIVE`)**: Grants the application role (`hms_app`) permission to access table rows subject to tenant matching:
   ```sql
   -- UNAPPROVED — NOT EXECUTED
   CREATE POLICY app_tenant_base_<tablename>
   ON app.<tablename>
   AS PERMISSIVE
   FOR ALL
   TO hms_app
   USING (college_id = app.current_tenant_id())
   WITH CHECK (college_id = app.current_tenant_id());
   ```
2. **Boundary Enforcement Policy (`AS RESTRICTIVE`)**: Re-asserts the boundary as restrictive so that no future permissive policy (e.g., added for reporting or auditing) can accidentally broaden access across tenant boundaries:
   ```sql
   -- UNAPPROVED — NOT EXECUTED
   CREATE POLICY tenant_isolation_<tablename>
   ON app.<tablename>
   AS RESTRICTIVE
   FOR ALL
   USING (college_id = app.current_tenant_id())
   WITH CHECK (college_id = app.current_tenant_id());
   ```

### 5.3 Table Classification & RLS Policy Matrix

| Classification Category | Target Tables | RLS / Force RLS | Permissive Policy Expression | Restrictive Policy Expression | Rationale & Access Control |
| :--- | :--- | :---: | :--- | :--- | :--- |
| **Category 1: Direct College Tenant Tables** (47 tables) | `app.departments`, `app.programs`, `app.courses`, `app.academic_years`, `app.semesters`, `app.batches`, `app.hostels`, `app.blocks`, `app.floors`, `app.rooms`, `app.beds`, `app.bed_allocations`, `app.room_maintenance`, `app.gates`, `app.students`, `app.parents`, `app.student_parents`, `app.emergency_contacts`, `app.staff_profiles`, `app.incharge_hostels`, `app.security_assignments`, `app.attendance_cards`, `app.attendance_records`, `app.entry_exit_records`, `app.record_corrections`, `app.leave_requests`, `app.leave_approvals`, `app.leave_verification_logs`, `app.gate_passes`, `app.gate_pass_verifications`, `app.visitor_requests`, `app.visitors`, `app.visitor_visits`, `app.parcels`, `app.complaints`, `app.complaint_updates`, `app.sos_alerts`, `app.security_incidents`, `app.incident_updates`, `app.notifications`, `app.announcements`, `app.meal_menus`, `app.meal_timings`, `app.mess_notices`, `app.food_feedback`, `app.resource_items`, `app.resource_availability`, `app.reports_saved` | **ENABLE & FORCE** | `TO hms_app USING (college_id = app.current_tenant_id()) WITH CHECK (college_id = app.current_tenant_id())` | `FOR ALL USING (college_id = app.current_tenant_id()) WITH CHECK (college_id = app.current_tenant_id())` | Direct tenant isolation. Each row belongs strictly to one college. Denies when tenant context is `NULL`. |
| **Category 2: Indirectly Scoped Tables** (1 table) | `app.notification_recipients` | **ENABLE & FORCE** | `TO hms_app USING (EXISTS (SELECT 1 FROM app.notifications n WHERE n.id = notification_recipients.notification_id AND n.college_id = app.current_tenant_id())) WITH CHECK (...)` | `FOR ALL USING (EXISTS (SELECT 1 FROM app.notifications n WHERE n.id = notification_recipients.notification_id AND n.college_id = app.current_tenant_id())) WITH CHECK (...)` | Does not contain `college_id`. Tenant identity is derived via parent notification. |
| **Category 3: Platform Tables with College Tenant Partitioning** (5 tables) | `platform.approval_requests`, `platform.approval_steps`, `platform.college_settings`, `platform.college_modules`, `platform.college_onboarding`, `platform.support_access_grants` | **ENABLE & FORCE** | `TO hms_app USING (college_id = app.current_tenant_id() OR app.current_tenant_id() IS NULL) WITH CHECK (college_id = app.current_tenant_id() OR app.current_tenant_id() IS NULL)` | `FOR ALL USING (college_id = app.current_tenant_id() OR app.current_tenant_id() IS NULL) WITH CHECK (...)` | Hybrid control plane. When called from college scope, restricted to `college_id`. When called from Super Admin (where tenant context is `NULL`), permits global access. |
| **Category 4: Global Identity & Catalog Tables** (9 tables) | `app.users`, `platform.colleges`, `platform.roles`, `platform.user_roles`, `platform.modules`, `platform.permissions`, `platform.role_permissions`, `platform.entitlement_templates`, `platform.device_tokens` | **DISABLED** | N/A (Protected via PostgreSQL table grants: `SELECT` to `hms_app`, `INSERT/UPDATE` to specific platform routes) | N/A | Global shared data. Users must authenticate across colleges. Roles/permissions are system-wide catalogs. RLS would break login/auth. |
| **Category 5: Hybrid / Nullable Tenant Tables** (3 tables) | `app.files`, `app.platform_notifications`, `platform.audit_logs`, `platform.login_events` | **ENABLE & FORCE** | `TO hms_app USING (college_id = app.current_tenant_id() OR college_id IS NULL) WITH CHECK (college_id = app.current_tenant_id() OR (college_id IS NULL AND app.current_tenant_id() IS NULL))` | `FOR ALL USING (college_id = app.current_tenant_id() OR college_id IS NULL) WITH CHECK (...)` | Files and notifications can be platform-wide (where `college_id IS NULL`) or college-specific. Audits record both college and global events. |

---

## 6. Remediation Finding B — Application Database Role

### 6.1 Current Gap
In `900_security.sql` lines 350–374:
```sql
REVOKE ALL ON ALL TABLES IN SCHEMA app FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA platform FROM PUBLIC;
...
```
All privileges are revoked from `PUBLIC`, but no migration creates an application role or grants permissions to `hms_app`. If an administrator configures `DB_USER=hms_app` in `.env`, the application fails on startup with:
`ERROR: permission denied for schema app` or `permission denied for table colleges`.

### 6.2 Proposed Role Provisioning Architecture
A dedicated migration (`900_roles.sql` or integrated into `900_security.sql`) must provision the application role adhering strictly to least privilege:

```sql
-- UNAPPROVED — NOT EXECUTED
-- 1. Create role if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hms_app') THEN
        CREATE ROLE hms_app WITH
            LOGIN
            NOSUPERUSER
            NOCREATEDB
            NOCREATEROLE
            NOINHERIT
            NOREPLICATION
            NOBYPASSRLS;
    ELSE
        ALTER ROLE hms_app WITH
            NOSUPERUSER
            NOCREATEDB
            NOCREATEROLE
            NOBYPASSRLS;
    END IF;
END
$$;

-- 2. Schema Usage
GRANT USAGE ON SCHEMA platform, app TO hms_app;

-- 3. App Schema Table Privileges (Full DML for Tenant Operations)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO hms_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app TO hms_app;

-- 4. Platform Schema Table Privileges (Segregated Least Privilege)
-- Read-only on catalogs
GRANT SELECT ON TABLE
    platform.colleges,
    platform.roles,
    platform.user_roles,
    platform.modules,
    platform.permissions,
    platform.role_permissions,
    platform.entitlement_templates
TO hms_app;

-- Read/Write on mutable operational platform tables
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
    platform.college_modules,
    platform.college_settings,
    platform.college_onboarding,
    platform.approval_requests,
    platform.approval_steps,
    platform.support_access_grants,
    platform.device_tokens
TO hms_app;

-- Append-only on platform logs and audit tables
GRANT SELECT, INSERT ON TABLE
    platform.audit_logs,
    platform.login_events
TO hms_app;

-- Restricted update on platform.colleges (status and lifecycle management)
GRANT UPDATE (status, timezone, activated_at, suspended_at, deactivated_at, archived_at, lifecycle_reason, updated_at)
ON TABLE platform.colleges TO hms_app;

-- 5. Function Execution Privileges
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA platform, app TO hms_app;

-- 6. Future Table Default Privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA app
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hms_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA app
    GRANT USAGE, SELECT ON SEQUENCES TO hms_app;
```

---

## 7. Remediation Finding C — Broken Triggers

### 7.1 Trigger 1: `app.validate_communication_tenant_consistency` (`008_communication.sql`)
#### Defect Evidence
Lines 413–421 of `008_communication.sql`:
```sql
        IF related_college_id IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1
                FROM app.users u
                WHERE u.user_id = NEW.user_id
                  AND u.college_id = related_college_id
            ) THEN
                RAISE EXCEPTION 'Notification recipient belongs to a different college';
            END IF;
        END IF;
```
- **Error:** Table `app.users` has **no column `college_id`** (asserted as missing by `validate.sql` line 318).
- **Runtime Failure:** Any notification broadcast inserting recipients into `app.notification_recipients` crashes with `ERROR: column u.college_id does not exist`.

#### Proposed Correction
Determine user college association through `platform.user_roles` where the user holds an active, non-expired role for that college:
```sql
-- UNAPPROVED — NOT EXECUTED
        IF related_college_id IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1
                FROM platform.user_roles ur
                WHERE ur.user_id = NEW.user_id
                  AND ur.college_id = related_college_id
                  AND ur.status = 'ACTIVE'
                  AND (ur.expires_at IS NULL OR ur.expires_at > now())
            ) THEN
                RAISE EXCEPTION
                    'Notification recipient % does not hold active membership in college %',
                    NEW.user_id, related_college_id;
            END IF;
        END IF;
```

### 7.2 Trigger 2: `app.validate_meals_resources_tenant_consistency` (`009_meals_resources.sql`)
#### Defect Evidence
Lines 585–593 of `009_meals_resources.sql`:
```sql
        IF NOT EXISTS (
            SELECT 1
            FROM app.users
            WHERE user_id = NEW.owner_user_id
              AND college_id = NEW.college_id
        ) THEN
            RAISE EXCEPTION 'Report owner belongs to a different college';
        END IF;
```
- **Error:** Query asserts `app.users.college_id = NEW.college_id`.
- **Runtime Failure:** Any insert or update into `app.reports_saved` crashes with `ERROR: column "college_id" does not exist`.

#### Proposed Correction
Validate report owner membership through `platform.user_roles`:
```sql
-- UNAPPROVED — NOT EXECUTED
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
```

---

## 8. Remediation Finding D — Migration Integrity Audit & Lead Verification

An exhaustive verification of historical audit leads against the canonical migration files was conducted:

| Audit Lead / Suspected Area | Target File & Line Range | Audit Verification Outcome | Severity & Confidence | Required Action |
| :--- | :--- | :--- | :---: | :--- |
| **Foreign Keys referencing incorrect PK columns** | `004_people.sql` (143–175, 526–535) | **FALSE LEAD / VERIFIED CORRECT.** All FK references (`department_id`, `program_id`, `course_id`, `academic_year_id`, `semester_id`, `batch_id`, `id`) exactly match primary key definitions in `002_academic.sql` and `003_hostel.sql`. Nullable `bed_allocations.student_id` with `ON DELETE SET NULL` is valid. | **NONE** (Confidence: 100%) | No change required. Preserved as-is. |
| **Duplicate Migration Content** | `005_movement.sql` vs `006_requests.sql` | **FALSE LEAD / VERIFIED CORRECT.** `005_movement.sql` defines 4 attendance/gate tables. `006_requests.sql` defines 9 leave/gate-pass/visitor tables. Zero duplicate tables or constraints exist in canonical migrations. Duplicate content existed only in unmerged scratch scripts (`scratch/recovered_movement_schema.sql`). | **NONE** (Confidence: 100%) | Ensure `scratch/` files remain ignored and unmerged. |
| **Truncation & Missing Objects in `009`** | `009_meals_resources.sql` vs `scratch/proposed_patch/009_meals_resources.sql` | **CONFIRMED RISK IN PROPOSED PATCH.** The canonical migration in `DATABASE/migrations/009_meals_resources.sql` (777 lines) is complete with all 8 tables and triggers. The patch in `scratch/proposed_patch/009_meals_resources.sql` was truncated to 145 lines, stripping all triggers, comments, and indexes. | **CRITICAL RISK** (Confidence: 100%) | **Reject proposed patch.** Fix the trigger directly in the canonical 777-line file. |
| **Non-existent column in index (`publish_at` vs `published_at`)** | `901_indexes.sql` (963, 980, 1043) | **VERIFIED CORRECT IN CANONICAL.** `app.announcements`, `app.platform_notifications`, and `app.mess_notices` all possess `publish_at timestamptz`. Indexes target valid existing columns. | **NONE** (Confidence: 100%) | No change required. |
| **Non-existent column in emergency contact index** | `901_indexes.sql` (482) vs `scratch/proposed_patch/901_indexes.sql` (470) | **CONFIRMED DEFECT IN PROPOSED PATCH.** Canonical `901_indexes.sql` correctly indexes `is_primary`. The proposed patch in `scratch/proposed_patch/901_indexes.sql` attempted to index `priority`, which does not exist on `app.emergency_contacts`. | **HIGH RISK IN PATCH** (Confidence: 100%) | **Reject proposed patch.** Retain canonical column `is_primary`. |
| **Redundant duplicate indexes** | `004_people.sql` (960) & `901_indexes.sql` (479) | **CONFIRMED MINOR DEFECT.** `idx_emergency_contacts_student` is created in both `004_people.sql` and `901_indexes.sql`. | **LOW** (Confidence: 100%) | Remove duplicate index definition in `901_indexes.sql` during index consolidation. |
| **View Security Invocation (`security_invoker`)** | `902_views.sql` (lines 30, 116, 200, etc.) | **CONFIRMED DEFECT.** All 9 views omit `WITH (security_invoker = true)`. In PostgreSQL 15+, views execute as view owner, bypassing caller RLS policies. | **HIGH** (Confidence: 100%) | Add `WITH (security_invoker = true)` to all 9 views in `902_views.sql`. |
| **Module Priority Check Constraint** | `001_platform.sql` (271) vs `903_seed.sql` (45, 54, etc.) | **VERIFIED CORRECT.** `001_platform.sql` enforces `CHECK (priority IN ('M', 'S', 'R'))`. `903_seed.sql` uniformly seeds `'M'`. Zero constraint violations exist. | **NONE** (Confidence: 100%) | No change required. |

---

## 9. File-by-File Remediation Specifications

All code below is **UNAPPROVED — NOT EXECUTED** and serves as the precise engineering blueprint for when `DATABASE\` is unfrozen:

### 9.1 File: `DATABASE/migrations/008_communication.sql`
- **Location:** Lines 413–421
- **Action:** Replace invalid `app.users.college_id` check with `platform.user_roles` membership query.
```sql
-- UNAPPROVED — NOT EXECUTED
-- REPLACEMENT CHUNK FOR 008_communication.sql (Line 413-421)
        IF related_college_id IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1
                FROM platform.user_roles ur
                WHERE ur.user_id = NEW.user_id
                  AND ur.college_id = related_college_id
                  AND ur.status = 'ACTIVE'
                  AND (ur.expires_at IS NULL OR ur.expires_at > now())
            ) THEN
                RAISE EXCEPTION
                    'Notification recipient % does not belong to college %',
                    NEW.user_id, related_college_id;
            END IF;
        END IF;
```

### 9.2 File: `DATABASE/migrations/009_meals_resources.sql`
- **Location:** Lines 585–593
- **Action:** Replace invalid `app.users.college_id` check with `platform.user_roles` membership query.
```sql
-- UNAPPROVED — NOT EXECUTED
-- REPLACEMENT CHUNK FOR 009_meals_resources.sql (Line 585-593)
        IF NOT EXISTS (
            SELECT 1
            FROM platform.user_roles ur
            WHERE ur.user_id = NEW.owner_user_id
              AND ur.college_id = NEW.college_id
              AND ur.status = 'ACTIVE'
              AND (ur.expires_at IS NULL OR ur.expires_at > now())
        ) THEN
            RAISE EXCEPTION
                'Report owner % does not belong to college %',
                NEW.owner_user_id, NEW.college_id;
        END IF;
```

### 9.3 File: `DATABASE/migrations/900_security.sql`
- **Action:** 
  1. Add application role creation (`hms_app` with `NOBYPASSRLS`).
  2. Implement dual-policy model: Paired `AS PERMISSIVE` base access grant + `AS RESTRICTIVE` boundary.
  3. Include Category 3 platform tables (`approval_requests`, `college_settings`, `college_modules`, `college_onboarding`) in RLS enforcement.
  4. Grant explicit table, sequence, and function privileges to `hms_app`.
```sql
-- UNAPPROVED — NOT EXECUTED
-- SECTION 4 & 5 REPLACEMENT IN 900_security.sql
-- 1. Create hms_app role if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hms_app') THEN
        CREATE ROLE hms_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
    ELSE
        ALTER ROLE hms_app WITH NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
    END IF;
END
$$;

-- 2. Paired RLS Policy Loop for App Tables with college_id
DO $$
DECLARE
    table_record record;
    perm_policy text;
    rest_policy text;
BEGIN
    FOR table_record IN
        SELECT c.table_schema, c.table_name
        FROM information_schema.columns c
        JOIN information_schema.tables t
          ON t.table_schema = c.table_schema AND t.table_name = c.table_name
        WHERE c.table_schema = 'app'
          AND c.column_name = 'college_id'
          AND t.table_type = 'BASE TABLE'
        ORDER BY c.table_name
    LOOP
        EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', table_record.table_schema, table_record.table_name);
        EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', table_record.table_schema, table_record.table_name);

        perm_policy := 'tenant_base_' || table_record.table_name;
        rest_policy := 'tenant_isolation_' || table_record.table_name;

        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', perm_policy, table_record.table_schema, table_record.table_name);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', rest_policy, table_record.table_schema, table_record.table_name);

        -- Permissive base grant to hms_app
        EXECUTE format(
            'CREATE POLICY %I ON %I.%I AS PERMISSIVE FOR ALL TO hms_app
             USING (college_id = app.current_tenant_id())
             WITH CHECK (college_id = app.current_tenant_id())',
            perm_policy, table_record.table_schema, table_record.table_name
        );

        -- Restrictive isolation boundary
        EXECUTE format(
            'CREATE POLICY %I ON %I.%I AS RESTRICTIVE FOR ALL
             USING (college_id = app.current_tenant_id())
             WITH CHECK (college_id = app.current_tenant_id())',
            rest_policy, table_record.table_schema, table_record.table_name
        );
    END LOOP;
END
$$;
```

### 9.4 File: `DATABASE/migrations/902_views.sql`
- **Action:** Update all 9 views to specify `WITH (security_invoker = true)`.
```sql
-- UNAPPROVED — NOT EXECUTED
-- Example definition for View 1
CREATE OR REPLACE VIEW app.v_current_student_bed_allocation
WITH (security_invoker = true) AS
SELECT
    ba.id AS allocation_id,
    ba.college_id,
    ...
```

---

## 10. Proposed Implementation Order & Dependencies

When authorization is granted to unfreeze `DATABASE\`, modifications must proceed in this exact sequence:

1. **Step 1: Fix Trigger Functions (`008_communication.sql`, `009_meals_resources.sql`)**  
   *Rationale:* Eliminates references to non-existent columns before any test data or migrations execute triggers.
2. **Step 2: Update View Definitions (`902_views.sql`)**  
   *Rationale:* Establishes `security_invoker = true` before permissions are revoked or RLS validated.
3. **Step 3: Update Security Policies & Role Grants (`900_security.sql`)**  
   *Rationale:* Provisions `hms_app`, grants schema/table privileges, and creates the paired permissive/restrictive policies.
4. **Step 4: Update Schema Validator (`validate.sql`)**  
   *Rationale:* Adds assertion validating that `hms_app` exists with `NOBYPASSRLS` and that permissive policies exist on all tenant tables.

---

## 11. Verification Matrix

| Defect ID | Target Object | Proposed Fix | Planned Automated Verification Test |
| :--- | :--- | :--- | :--- |
| **SEC-02** | `app.*` tenant tables | Dual-policy RLS (Permissive base + Restrictive boundary) | `go test -v ./internal/repository -run TestTenantRLS_Isolation_Integration` |
| **SEC-03** | `app.validate_communication_tenant_consistency` | Query `platform.user_roles` instead of `app.users.college_id` | SQL test inserting recipient with valid college role (passes) and mismatched college role (aborts with exception) |
| **SEC-04** | `app.validate_meals_resources_tenant_consistency` | Query `platform.user_roles` instead of `app.users.college_id` | SQL test inserting saved report with valid owner role (passes) and mismatched owner (aborts with exception) |
| **SEC-05** | `platform.approval_requests`, `platform.college_settings` | Enable RLS and add college/platform hybrid policies | SQL test querying settings as College A (sees College A only) and Super Admin (sees all) |
| **SEC-06** | `app.v_*` views (9 views) | Add `WITH (security_invoker = true)` | SQL query against views as `hms_app` under College A context (returns College A rows only) |
| **SEC-07** | `hms_app` role | Provision `hms_app` with `NOBYPASSRLS` and explicit table grants | Test connecting as `hms_app`, querying tables, and verifying `rolbypassrls = false` |

---

## 12. Disposable PostgreSQL Validation Plan

### 12.1 Execution Preconditions
- The validation script must target **ONLY** an isolated, disposable database container.
- Safety check: Database name must strictly end in `_test` (e.g., `hms_disposable_test`).
- The script must abort immediately if targeting any host or port matching a production or primary development database.

### 12.2 Step-by-Step Validation Workflow
1. **Container Initialization:** Start a disposable PostgreSQL 16 container (`docker run --name hms-test-db -e POSTGRES_PASSWORD=... -p 5433:5432 -d postgres:16-alpine`).
2. **Sequential Migration Execution:**
   Execute migrations 000 through 903 sequentially using `psql -v ON_ERROR_STOP=1`. Capture exact exit codes and execution logs for each migration file.
3. **Structural Schema Validation:**
   Execute `validate.sql`. Confirm exit code 0 and all `PASS` notices.
4. **Role & Privilege Verification:**
   Query `pg_roles` to verify `hms_app` has `rolsuper = false` and `rolbypassrls = false`. Connect as `hms_app` and verify schema access.
5. **Multi-Tenant Isolation Test (College A vs College B):**
   - Insert College A and College B records into `platform.colleges`.
   - As `hms_app`, set `app.current_tenant_id` to College A.
   - Insert a hostel into `app.hostels` for College A.
   - Set `app.current_tenant_id` to College B.
   - Execute `SELECT * FROM app.hostels`. Assert **0 rows returned**.
   - Attempt `UPDATE app.hostels SET name = 'Hacked'` where `college_id = College A`. Assert **0 rows affected**.
   - Attempt `DELETE FROM app.hostels` where `college_id = College A`. Assert **0 rows affected**.
6. **Missing Tenant Context Test (Fail-Closed):**
   - Reset connection (`app.current_tenant_id` is `NULL`).
   - Execute `SELECT * FROM app.hostels`. Assert **0 rows returned** (proves permissive policy does not leak when context is unset).
7. **Trigger Membership Validation:**
   - Create user in `app.users`. Assign role in College A via `platform.user_roles`.
   - Create notification in College A. Add user to `app.notification_recipients`. Assert **Insert succeeds**.
   - Create notification in College B. Attempt adding user to `app.notification_recipients`. Assert **Insert fails with tenant exception**.
8. **View Security Invocation Test:**
   - As `hms_app` with College A context, query `app.v_hostel_occupancy`.
   - Assert only College A occupancy data is returned.
9. **Automated Go Test Execution:**
   - Set `TEST_DATABASE_URL=postgres://hms_app:password@localhost:5433/hms_disposable_test?sslmode=disable`.
   - Run `go test -v -count=1 ./internal/repository -run TestTenantRLS`.
   - Run `go test -v -count=1 ./internal/service -run TestBedAllocation`.
10. **Tear Down:** Stop and remove disposable container (`docker rm -f hms-test-db`).

---

## 13. Outstanding Design Decisions & Approvals Required

Before changes are applied, the following technical decisions require architectural sign-off:

1. **Category 3 Platform Tables Access Model:**
   - *Option A (Recommended):* Apply RLS with hybrid policy: `USING (college_id = app.current_tenant_id() OR app.current_tenant_id() IS NULL)`. College users see only their settings; Super Admin (with `NULL` tenant context) sees all settings.
   - *Option B:* Keep platform tables outside RLS and enforce tenant filtering strictly in the Go service layer.
2. **Expired User Role Grace Periods:**
   - Triggers currently check `(ur.expires_at IS NULL OR ur.expires_at > now())`. Should an expired student/staff member immediately lose receipt of historical notifications, or should expiration only prevent new operational assignments? (Recommended: immediate strict cutoff).
3. **Role Management File Structure:**
   - *Option A (Recommended):* Embed `hms_app` creation and grants directly into `900_security.sql`.
   - *Option B:* Create a separate migration `001_roles.sql` run before `001_platform.sql`.

---

## 14. Record of Files Audited & Created

### Files Read & Inspected
- `D:\HMS\DATABASE\migrations\000_extensions.sql`
- `D:\HMS\DATABASE\migrations\001_platform.sql`
- `D:\HMS\DATABASE\migrations\002_academic.sql`
- `D:\HMS\DATABASE\migrations\003_hostel.sql`
- `D:\HMS\DATABASE\migrations\004_people.sql`
- `D:\HMS\DATABASE\migrations\005_movement.sql`
- `D:\HMS\DATABASE\migrations\006_requests.sql`
- `D:\HMS\DATABASE\migrations\007_support.sql`
- `D:\HMS\DATABASE\migrations\008_communication.sql`
- `D:\HMS\DATABASE\migrations\009_meals_resources.sql`
- `D:\HMS\DATABASE\migrations\010_super_admin_platform.sql`
- `D:\HMS\DATABASE\migrations\900_security.sql`
- `D:\HMS\DATABASE\migrations\901_indexes.sql`
- `D:\HMS\DATABASE\migrations\902_views.sql`
- `D:\HMS\DATABASE\migrations\903_seed.sql`
- `D:\HMS\DATABASE\validate.sql`
- `D:\HMS\DATABASE\README.md`
- `D:\HMS\scratch\proposed_patch\*` (all 7 files)
- `D:\HMS\scratch\build_005.ps1`
- `D:\HMS\API\internal\config\config.go`
- `D:\HMS\DOCS\security\HMS_PHASE_18_6_CRITICAL_SECURITY_VERIFICATION.md`
- `D:\HMS\DOCS\security\HMS_PHASE_19_REMEDIATION_PLAN.md`
- `D:\HMS\DOCS\security\HMS_PHASE_19_3_19_4_VERIFICATION.md`
- `D:\HMS\DOCS\security\HMS_PHASE_19_5_TENANT_CONTEXT_REMEDIATION.md`
- `D:\HMS\DOCS\security\HMS_PHASE_19_6_INDEPENDENT_AUDIT.md`

### Files Created
- `D:\HMS\DOCS\security\HMS_PHASE_19_7_DATABASE_REMEDIATION_PACKAGE.md`
- Artifact Copy: `C:\Users\rohit\.gemini\antigravity-ide\brain\9549ce15-0cad-456b-8209-732c99eb4301\HMS_PHASE_19_7_DATABASE_REMEDIATION_PACKAGE.md`
