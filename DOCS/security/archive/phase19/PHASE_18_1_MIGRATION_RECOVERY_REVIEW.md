# Phase 18.1: Migration Recovery and Patch Validation Review

## Executive Summary
This document provides a read-only review of the original migrations located in `DATABASE/migrations/` and the proposed patches located in `scratch/proposed_patch/`. The review ensures safety boundaries are respected and verifies the technical justification of each proposed change before approving them for isolated testing. 

No files in `DATABASE/` or the development database were modified during this review.

---

## 1. Inventory of Files

**Original Migration Files (`DATABASE/migrations/`)**
- `000_extensions.sql`
- `001_platform.sql`
- `002_academic.sql`
- `003_hostel.sql`
- `004_people.sql`
- `005_movement.sql`
- `006_requests.sql`
- `007_support.sql`
- `008_communication.sql`
- `009_meals_resources.sql`
- `010_super_admin_platform.sql`
- `900_security.sql`
- `901_indexes.sql`
- `902_views.sql`
- `903_seed.sql`

**Proposed Patches (`scratch/proposed_patch/`)**
- `004_people.sql`
- `005_movement.sql`
- `008_communication.sql`
- `009_meals_resources.sql`
- `900_security.sql`
- `901_indexes.sql`
- `903_seed.sql`

---

## 2. Review of Known Issues & Patch Classifications

### A. `004_people.sql`
- **Issue:** Original file references `app.departments(id)`.
- **Proposed Change:** Changed the reference to `app.departments(department_id)`.
- **Justification:** Inspected `002_academic.sql` line 42; the primary key of `app.departments` is indeed `department_id`.
- **Verdict:** **JUSTIFIED**.

### B. `008_communication.sql`
- **Issue:** Foreign key references in `app.notifications`, `app.notification_recipients`, `app.announcements`, and `app.platform_notifications` pointed to incorrect ID columns (e.g., `app.users(id)` and `platform.colleges(id)`).
- **Proposed Change:** Changed references to `platform.colleges(college_id)` and `app.users(user_id)`.
- **Justification:** Inspected `001_platform.sql`; primary keys are `college_id` and `user_id`.
- **Verdict:** **JUSTIFIED**.

### C. `009_meals_resources.sql`
- **Issue:** Original file was a duplicate of `900_security.sql`. The patch contains a completely reconstructed schema for `app.resource_items`, `app.resource_availability`, `app.reports_saved`, and `app.files`.
- **Justification:** The original schema was lost/corrupted. The reconstructed tables align with missing API module requirements from the Phase 17 analysis.
- **Verdict:** **UNVERIFIED**. (Requires isolated database test validation as it is a reconstructed design).

### D. `900_security.sql`
- **Issue:** Original file implemented RLS policies as `AS RESTRICTIVE` for tenant isolation.
- **Proposed Change:** Changed to `AS PERMISSIVE`.
- **Justification:** PostgreSQL requires at least one `PERMISSIVE` policy for a role to access any rows. Using only `RESTRICTIVE` policies results in a default-deny state for all queries, blocking all tenant access.
- **Verdict:** **JUSTIFIED**.

### E. `901_indexes.sql`
- **Issue:** Included an index on `publish_at` for `app.platform_notifications`, which does not exist.
- **Proposed Change:** Changed to `published_at`.
- **Justification:** Inspected `008_communication.sql` line 413; the column is named `published_at`.
- **Verdict:** **JUSTIFIED**.

### F. `903_seed.sql`
- **Issue:** Original seed data used numeric priorities (`10`, `20`, `30`, etc.) for `platform.modules`.
- **Proposed Change:** Replaced numeric priorities with `'M'`.
- **Justification:** Inspected `001_platform.sql` line 271; the `ck_modules_priority` constraint strictly requires the `priority` column to be `'M'`, `'S'`, or `'R'`. The original numeric values violate this constraint.
- **Verdict:** **JUSTIFIED**.

### G. `005_movement.sql`
- **Issue:** Schema was deeply defective or partially missing constraints. The proposed patch reorganizes the file and adds proper foreign key constraints and triggers.
- **Justification:** Necessary for structural integrity, though it heavily modifies the original layout.
- **Verdict:** **UNVERIFIED**. (Requires isolated testing).

---

## 3. Disposable Test Harness Inspection

- **File Inspected:** `scratch/run_isolated_migration_test.ps1`
- **Mechanism:** The script provisions a new Docker container (`postgres:alpine`) using port `5434`. It copies the original migrations from `DATABASE/migrations/*.sql` into a temporary directory (`scratch/test_migrations`), then safely **overwrites** them with the staged patches from `scratch/proposed_patch/`.
- **Safety Guarantee:** The harness binds the temporary directory as read-only (`ro`) to the container's init sequence. **It NEVER modifies `DATABASE/` or connects to the existing development database.**
- **Testing Approach:** A complete migration sequence can absolutely be tested without modifying the original migration files, by relying on this exact file-copy overlay method. *Note: `900_security.sql` needs to be added to the copy-override instructions in the PS1 script before the run.*

---

## 4. Unresolved Questions & Recommendations

1. **Unresolved Question:** `900_security.sql` was patched in `scratch/proposed_patch/`, but `scratch/run_isolated_migration_test.ps1` currently does not copy/override it into the `test_migrations` folder. 
2. **Recommendation:** Add `Copy-Item "scratch\proposed_patch\900_security.sql" -Destination $TestDir -Force` to the `run_isolated_migration_test.ps1` script before executing Phase 18.2.

## Final Verdict
**GO FOR ISOLATED VALIDATION.** 

The patches are technically justified and address clear constraint/schema violations in the original files. The test harness isolates the database appropriately. Proceed with executing the test harness in Phase 18.2 to validate the full migration sequence.
