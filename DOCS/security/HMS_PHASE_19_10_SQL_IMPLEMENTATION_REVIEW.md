# HMS Phase 19.10 — Post-Remediation SQL Review and Test Readiness Report

**Document Version:** 1.0.0  
**Phase:** HMS Phase 19.10 (Post-Remediation SQL Review & Test Readiness)  
**Date:** 2026-10-17  
**Execution Context:** Autonomous Controlled Implementation Review  
**Project Root:** `D:\HMS`  

---

## 1. Executive Summary & Verdict

### Verdict: **PASS WITH FINDINGS (DEPLOYMENT BLOCKED)**

A comprehensive, forensic SQL review of the remediated HMS migration files against their Phase 19.9 backups has been completed. 

All tenant isolation controls, paired permissive/restrictive policies, view invoker modes, and trigger consistency logic remain structurally sound and free from unintended object loss. Three precision SQL refinements were implemented:
1. `validate_communication_tenant_consistency()` was hardened with an explicit `NOT FOUND` check for parent notification existence.
2. `900_security.sql` role provisioning was wrapped in `insufficient_privilege` exception handling to decouple least-privilege migration runners (`hms_migrator`) from cluster-level role management (`CREATEROLE`).
3. `validate.sql` was upgraded to dynamically assert that **every** tenant table in schema `app` with `college_id` possesses an applicable `PERMISSIVE` policy explicitly granted to `hms_app`.

**Deployment Status:** **BLOCKED.**  
Production and staging deployment remain strictly blocked pending:
1. Architectural resolution of the platform authorization boundary (`app.is_platform_admin()` relying on mutable session variables rather than database-authenticated identity).
2. Live runtime migration and RLS validation against an authorized, disposable PostgreSQL 16 instance (blocked by Docker daemon unavailability on the host).

---

## 2. Review Tasks & Forensic Findings

### 2.1 Diff Comparison: Remediated Files vs. Phase 19.9 Backups
Every edited canonical migration was diffed against its backup in `D:\HMS\BACKUPS\phase_19_9_pre_remediation_backup\`:

| Canonical Migration File | Backup Verification | Exact Diffs Observed | Unrelated Objects / Constraints Lost |
| :--- | :--- | :--- | :--- |
| `DATABASE/migrations/008_communication.sql` | `BACKUPS/phase_19_9_pre_remediation_backup/008_communication.sql` | Fixed non-existent `app.users.college_id` by checking `platform.user_roles` membership; added active status check for global notifications. Added `IF NOT FOUND` guard. | **None.** All 4 tables, 15+ constraints, and indexes preserved intact. |
| `DATABASE/migrations/009_meals_resources.sql` | `BACKUPS/phase_19_9_pre_remediation_backup/009_meals_resources.sql` | Fixed `reports_saved` trigger to verify `owner_user_id` membership against `platform.user_roles`. | **None.** Full 777-line schema and all 9 tables preserved. |
| `DATABASE/migrations/900_security.sql` | `BACKUPS/phase_19_9_pre_remediation_backup/900_security.sql` | Replaced deadlocking `AS RESTRICTIVE` policy loop with paired `AS PERMISSIVE` (granted to `hms_app`) + `AS RESTRICTIVE` boundaries; added `app.is_platform_admin()`; added Category 3 platform table isolation; granted explicit schema/table privileges to `hms_app`. | **None.** Core functions (`current_tenant_id`, `has_tenant_context`) and comments preserved. |
| `DATABASE/migrations/901_indexes.sql` | `BACKUPS/phase_19_9_pre_remediation_backup/901_indexes.sql` | Pruned duplicate `idx_emergency_contacts_student` (line 479) already defined in `004_people.sql`. | **None.** All 213 remaining indexes and partial conditions preserved. |
| `DATABASE/migrations/902_views.sql` | `BACKUPS/phase_19_9_pre_remediation_backup/902_views.sql` | Added `WITH (security_invoker = true)` to all 9 views. | **None.** View query definitions, joins, aggregates, and column aliases identical. |
| `DATABASE/validate.sql` | `BACKUPS/phase_19_9_pre_remediation_backup/validate.sql` | Added role property checks (`NOBYPASSRLS`, `NOSUPERUSER`) and dynamic multi-table permissive policy assertions. | **None.** All 22 original validation checks preserved. |

---

### 2.2 Deep Audit of Role Provisioning & Privileges in `900_security.sql`

#### Role Creation Commands & Execution Privilege
- **Finding:** `900_security.sql` previously contained unconditional `CREATE ROLE hms_app` and `ALTER ROLE hms_app` statements.
- **Architectural Conflict:** In the documented deployment architecture (Phase 19.8 Section 5.1), migrations are executed by `hms_migrator`:
  ```sql
  CREATE ROLE hms_migrator WITH LOGIN PASSWORD '...' CREATEDB NOCREATEROLE;
  ```
  Because `hms_migrator` has `NOCREATEROLE`, executing `CREATE ROLE` or `ALTER ROLE` inside a migration causes an immediate PostgreSQL fatal exception (`ERROR: permission denied to create/alter role`).
- **Correction Made in Phase 19.10:** Wrapped role provisioning in an exception-handling block:
  ```sql
  DO $$
  BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hms_app') THEN
          BEGIN
              CREATE ROLE hms_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
          EXCEPTION
              WHEN insufficient_privilege THEN
                  RAISE EXCEPTION
                      'Prerequisite role "hms_app" does not exist and migration runner lacks CREATEROLE privilege. Run cluster provisioning first.';
          END;
      ELSE
          BEGIN
              ALTER ROLE hms_app WITH NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
          EXCEPTION
              WHEN insufficient_privilege THEN
                  NULL; -- Role exists; migration runner lacks CREATEROLE to alter cluster attributes.
          END;
      END IF;
  END
  $$;
  ```
- **Policy Creation Prerequisite:** In PostgreSQL, `CREATE POLICY ... TO hms_app` requires that `hms_app` exists in `pg_roles` at the moment of execution. The Tier 1 infrastructure bootstrap script must provision `hms_app` before migrations run. If running in a developer environment as `postgres`, the migration runner safely provisions `hms_app` automatically.
- **RLS Bypass Guarantee:** `hms_app` is explicitly created with `NOBYPASSRLS` and `NOSUPERUSER`. Furthermore, `validate.sql` explicitly asserts:
  ```sql
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hms_app' AND (rolbypassrls = true OR rolsuper = true)) THEN
      RAISE EXCEPTION 'VALIDATION FAILED: Role hms_app must have NOBYPASSRLS and NOSUPERUSER';
  END IF;
  ```

---

### 2.3 Verification of Tenant-Table RLS Policies

#### Algebra of Tenant Isolation
PostgreSQL evaluates RLS using:
$$\text{Row Visible} = (\text{Permissive Policy}) \land (\text{Restrictive Policy})$$

1. **Category 1 Tables (47 tenant-owned application tables):**
   - **Permissive Policy (`tenant_base_<table_name>`):**
     `AS PERMISSIVE FOR ALL TO hms_app USING (college_id = app.current_tenant_id()) WITH CHECK (college_id = app.current_tenant_id())`
   - **Restrictive Policy (`tenant_isolation_<table_name>`):**
     `AS RESTRICTIVE FOR ALL USING (college_id = app.current_tenant_id()) WITH CHECK (college_id = app.current_tenant_id())`
   - **DML Operations:**
     - `SELECT`: Restricted to rows where `college_id = app.current_tenant_id()`.
     - `INSERT`: Rejects any row where `NEW.college_id != app.current_tenant_id()`.
     - `UPDATE`: Prevents selecting rows of another college (`USING`) and prevents reassigning `college_id` (`WITH CHECK`).
     - `DELETE`: Prevents deleting rows of another college.
   - **Missing Context:** When `app.current_tenant_id()` is `NULL`, `college_id = NULL` evaluates to `NULL` (falsy). **Returns 0 rows (Fail-Closed).**
2. **Category 2 Tables (`app.notification_recipients`):**
   - Derived tenant policy via parent `app.notifications.college_id`. Permissive and restrictive policies both enforce tenant matching or platform notification scope.
3. **Category 3 Partitioned Platform Tables (`approval_requests`, `college_settings`, `college_modules`, `college_onboarding`, `support_access_grants`, `approval_steps`):**
   - Dual-path policy: accessible to college tenants for their own `college_id`, or platform administrators when `app.is_platform_admin()` evaluates to `TRUE`.

---

### 2.4 Audit of `app.is_platform_admin()` & Session Setting Boundary

#### Architectural Analysis
The PL/pgSQL function in `900_security.sql`:
```sql
CREATE OR REPLACE FUNCTION app.is_platform_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = platform, app, pg_temp
AS $$
DECLARE
    scope_val text;
    uid_val text;
    parsed_uid uuid;
    is_admin boolean;
BEGIN
    scope_val := current_setting('app.current_scope', true);
    IF scope_val IS DISTINCT FROM 'PLATFORM' THEN
        RETURN false;
    END IF;

    uid_val := current_setting('app.current_user_id', true);
    IF uid_val IS NULL OR btrim(uid_val) = '' THEN
        RETURN false;
    END IF;

    BEGIN
        parsed_uid := uid_val::uuid;
    EXCEPTION
        WHEN invalid_text_representation THEN
            RETURN false;
    END;

    SELECT EXISTS (
        SELECT 1
        FROM platform.user_roles ur
        JOIN platform.roles r ON r.role_id = ur.role_id
        WHERE ur.user_id = parsed_uid
          AND r.scope = 'PLATFORM'
          AND r.role_code IN ('SUPER_ADMIN', 'PLATFORM_OPERATOR')
          AND ur.status = 'ACTIVE'
          AND (ur.expires_at IS NULL OR ur.expires_at > now())
    ) INTO is_admin;

    RETURN coalesce(is_admin, false);
END;
$$;
```

#### Critical Boundary Findings:
1. **Identity Spoofing Vulnerability via Session Settings:**
   - Both `app.current_scope` and `app.current_user_id` are set via SQL `set_config(...)`.
   - Because all application traffic connects as the single database role `hms_app`, and `hms_app` has `SELECT` access to `platform.user_roles` and `platform.roles`, any attacker capable of SQL injection or connection hijacking can query a valid Super Admin `user_id` and execute:
     ```sql
     SELECT set_config('app.current_scope', 'PLATFORM', false);
     SELECT set_config('app.current_user_id', '<super_admin_uuid>', false);
     ```
   - Once set, `app.is_platform_admin()` will evaluate to `TRUE`. The database engine cannot distinguish whether this setting was set by authorized Go middleware or manufactured in SQL.
2. **Runtime Disconnect in Go Backend:**
   - Inspection of `API/internal/database/platform_transaction.go` revealed that `WithPlatformTransaction` begins a raw transaction but **does not call `set_config` for `app.current_scope` or `app.current_user_id`**.
   - As a result, in the current Go codebase, any query executed inside `WithPlatformTransaction` against Category 3 platform tables will evaluate `is_platform_admin()` as `FALSE` and return **0 rows**.
3. **Recursion & Privileges:**
   - `platform.user_roles` does not have RLS enabled. Therefore, querying it inside `is_platform_admin()` does not trigger recursive policy evaluation.
   - `SECURITY DEFINER` and `SET search_path = platform, app, pg_temp` are properly configured to prevent path spoofing.
4. **Verdict on Platform Boundary:**
   - **BLOCKED.** In accordance with the prompt mandate (*"Do not assume that a role or scope stored in a mutable session setting proves identity. If robust platform authorization cannot be established from the current design, report the issue and keep deployment blocked"*), the database-enforced Super Admin boundary remains an open architectural issue.

---

### 2.5 Audit of Corrected Trigger Functions

1. **`app.validate_communication_tenant_consistency()` (`008_communication.sql`):**
   - **Recipient Membership Check:** Correctly queries `platform.user_roles` with `ur.user_id = NEW.user_id AND ur.college_id = related_college_id AND ur.status = 'ACTIVE' AND (ur.expires_at IS NULL OR ur.expires_at > now())`.
   - **Multiple Roles:** Handled correctly via `EXISTS(...)`. If the user holds multiple roles in the college, at least one active non-expired role satisfies the condition.
   - **Expiration Handling:** Correctly allows `expires_at IS NULL` (permanent memberships) and enforces `expires_at > now()` for time-bounded roles.
   - **Global Notifications:** When `related_college_id IS NULL`, verifies that the recipient is in `app.users` with status `ACTIVE` or `INVITED`.
   - **Hardening Added:** Added `IF NOT FOUND THEN RAISE EXCEPTION 'Notification % does not exist', NEW.notification_id;` to ensure non-existent notifications fail fast rather than treating the notification as global.
2. **`app.validate_meals_resources_tenant_consistency()` (`009_meals_resources.sql`):**
   - **Report Owner Check:** Correctly requires `owner_user_id` to hold active, non-expired membership in `platform.user_roles` for `NEW.college_id`.
   - **Files Check:** Allows `NEW.college_id IS NULL` for platform files; validates `platform.colleges` foreign reference when `college_id IS NOT NULL`.

---

### 2.6 Audit of View Security Mode in `902_views.sql`

- **PostgreSQL 16 Compatibility:** `WITH (security_invoker = true)` was introduced in PostgreSQL 15 and is fully supported in PostgreSQL 16.
- **Security Definer Risk Eliminated:** Previously, views defaulted to `security_definer`, causing queries by `hms_app` to run as view owner (`hms_migrator`), which bypassed RLS and exposed cross-tenant data across all colleges.
- **Invoker Enforcement:** Under `security_invoker = true`, PostgreSQL enforces the caller's (`hms_app`) RLS policies on the underlying tables (`students`, `bed_allocations`, `hostels`, `complaints`, etc.).
- **Privilege Alignment:** `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO hms_app` in `900_security.sql` automatically includes all 9 views in schema `app`.

---

### 2.7 Verification of Enhanced `DATABASE/validate.sql`

The validation script was enhanced to prevent false positive successes:
```sql
----------------------------------------------------------------
-- 11A. APPLICATION ROLE VALIDATION
----------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hms_app') THEN
    RAISE EXCEPTION 'VALIDATION FAILED: Application role hms_app does not exist';
END IF;

IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hms_app' AND (rolbypassrls = true OR rolsuper = true)) THEN
    RAISE EXCEPTION 'VALIDATION FAILED: Role hms_app must have NOBYPASSRLS and NOSUPERUSER';
END IF;

----------------------------------------------------------------
-- 11B. PERMISSIVE RLS POLICY VERIFICATION (SEC-02 REMEDIATION)
----------------------------------------------------------------
-- Dynamically asserts that EVERY tenant base table with college_id
-- has an applicable PERMISSIVE policy granted explicitly to hms_app.
IF EXISTS (
    SELECT 1
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'app'
      AND c.column_name = 'college_id'
      AND t.table_type = 'BASE TABLE'
      AND NOT EXISTS (
          SELECT 1
          FROM pg_policies p
          WHERE p.schemaname = 'app'
            AND p.tablename = c.table_name
            AND p.permissive = 'PERMISSIVE'
            AND 'hms_app' = ANY(p.roles)
      )
) THEN
    RAISE EXCEPTION 'VALIDATION FAILED: Tenant table in app schema lacks applicable PERMISSIVE policy for hms_app';
END IF;

IF NOT EXISTS (
    SELECT 1
    FROM pg_policies p
    WHERE p.schemaname = 'app'
      AND p.tablename = 'notification_recipients'
      AND p.permissive = 'PERMISSIVE'
      AND 'hms_app' = ANY(p.roles)
) THEN
    RAISE EXCEPTION 'VALIDATION FAILED: app.notification_recipients lacks applicable PERMISSIVE policy for hms_app';
END IF;
```
This guarantees that `validate.sql` fails if even a single tenant table lacks an applicable permissive grant to `hms_app`.

---

### 2.8 Comprehensive Index Reconciliation (`901_indexes.sql`)

A full static reconciliation was conducted across all 213 indexes in `901_indexes.sql`:
1. **Target Table Validation:** All 67 tables referenced by indexes in `901_indexes.sql` exist in the canonical schema and match `validate.sql` required tables.
2. **Column Validity:**
   - `publish_at` exists on `app.announcements` (`008_communication.sql:238`) and `app.platform_notifications` (`008_communication.sql:330`).
   - `is_primary` exists on `app.emergency_contacts` (`004_people.sql:445`).
   - `student_id` is added to `app.bed_allocations` in `004_people.sql:522`.
   - `check_in_at` and `check_out_at` exist on `app.visitor_visits` (`006_requests.sql:472-473`).
3. **Redundant Index Pruning:** Pruned duplicate `idx_emergency_contacts_student` from `901_indexes.sql` line 479 (previously defined in `004_people.sql` line 960).

---

## 3. Safe Static Validation Execution & Outcomes

Commands executed from `D:\HMS`:

| Command | Working Directory | Exit Code | Outcome |
| :--- | :--- | :---: | :--- |
| `docker ps` | `D:\HMS` | `1` | Failed to connect to docker API named pipe. Docker Desktop daemon is not running. |
| `psql --version` | `D:\HMS` | `1` | `psql` command not in system PATH. |
| `go test -count=1 ./...` | `D:\HMS` | `0` | All 10 test packages passed (`API/internal/auth`, `config`, `database`, `middleware`, `telegram`, `repository`, `server`, `service`, `response`, and `MODULES/SUPER-ADMIN/BACKEND/tests`). |
| `go vet ./...` | `D:\HMS` | `0` | Clean; 0 warnings or errors. |
| `go build ./...` | `D:\HMS` | `0` | All packages compiled successfully. |

### Development Database Protection Affirmation
- Host PostgreSQL service (`postgres.exe`, PID 10476, port 5432) was detected.
- In strict adherence to constraints, **no connections, migrations, queries, or resets were performed against port 5432**.
- Zero `.env` secrets or database passwords were read or printed.

---

## 4. Unresolved Issues & Blockers Summary

1. **Docker Runtime Unavailable:**  
   Docker Desktop Linux engine is offline. No disposable container could be provisioned.
2. **Live SQL Migration Execution Blocked:**  
   Per project rules, live migration tests and runtime RLS validation cannot be claimed without real execution against a disposable test database.
3. **Platform Scope Session-Setting Security Gap:**  
   `app.is_platform_admin()` relies on `current_setting('app.current_scope')` and `current_setting('app.current_user_id')`. Because `hms_app` is shared across requests, this model does not provide database-enforced protection against arbitrary SQL execution or middleware misconfiguration.
4. **Runtime Transaction Gap in Go Backend:**  
   `API/internal/database/platform_transaction.go` does not inject `app.current_scope` or `app.current_user_id` into database transactions.

---

## 5. Next Safe Test Step

When Docker Desktop or a verified disposable PostgreSQL 16 test database becomes authorized and available:
1. Provision isolated test instance on a dedicated non-default port (e.g., 5433).
2. Execute Tier 1 cluster bootstrap script to create `hms_migrator` and `hms_app`.
3. Apply migration sequence `001_platform.sql` through `903_seed.sql` using `hms_migrator`.
4. Run `validate.sql` to verify that table counts, views, role properties, and permissive policies evaluate to `PASS`.
5. Connect as `hms_app` without superuser privileges and run the multi-tenant cross-isolation test matrix.
