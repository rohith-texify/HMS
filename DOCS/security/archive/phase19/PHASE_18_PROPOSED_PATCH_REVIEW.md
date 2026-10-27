# Phase 18 — Proposed Patch Review

**Review Date**: 2026-10-10  
**Reviewer**: Automated Code Review (Phase 18 Verification)  
**Status**: READ-ONLY REVIEW — NOT APPROVED FOR MERGE

---

## Executive Summary

Seven proposed patches were reviewed to address missing historical migrations and schema inconsistencies discovered during Phase 18 verification. These patches reconstruct missing domain tables and fix policy/index issues.

**CRITICAL**: These patches require governance approval and staged deployment. They modify production schema and must NOT be merged without:
1. DBA review
2. Backup verification
3. Staging environment validation
4. Rollback plan documentation

---

## Patch Inventory

| Patch File | Type | Lines | Risk Level | Purpose |
|------------|------|-------|------------|---------|
| 004_people.sql | RECONSTRUCTION | ~850 | HIGH | Reconstructs missing people domain tables |
| 005_movement.sql | RECONSTRUCTION | ~400 | HIGH | Reconstructs attendance/movement tables + functions |
| 008_communication.sql | RECONSTRUCTION | ~560 | MEDIUM | Reconstructs notification/announcement tables |
| 009_meals_resources.sql | RECONSTRUCTION | ~200 | MEDIUM | Reconstructs meal/mess management tables |
| 900_security.sql | POLICY FIX | ~280 | HIGH | Changes RESTRICTIVE→PERMISSIVE RLS policies |
| 901_indexes.sql | INDEX FIX | ~900 | LOW | Fixes notification_recipients index column name |
| 903_seed.sql | DATA FIX | ~710 | LOW | Changes numeric priorities→'M' for root modules |

---

## Detailed Review

### 1. **004_people.sql** — People Domain Reconstruction

**Type**: Historical Migration Reconstruction  
**Risk**: HIGH — Creates core domain tables referenced throughout codebase

**What It Does**:
- Creates `students`, `parents`, `student_parents`, `emergency_contacts` tables
- Creates `staff_profiles`, `incharge_hostels`, `security_assignments` tables
- Adds `student_id` foreign key to `bed_allocations`
- Establishes tenant consistency triggers

**Design Assessment**:
- ✅ Uses proper UUID primary keys
- ✅ College isolation via `college_id`
- ✅ Historical record retention pattern
- ✅ Proper foreign key constraints
- ✅ Comprehensive indexes for query performance

**Prerequisites**:
1. Must run AFTER 003_hostel.sql (depends on `app.hostels`, `app.beds`)
2. Must run BEFORE any migration that references `app.students`

**Risks**:
- **Data Loss**: If production already has a different `students` table structure, this will conflict
- **Referential Integrity**: All existing `bed_allocations` rows must have valid `student_id` or be NULL
- **Trigger Overhead**: Adds validation triggers to 7 tables

**Approval Requirements**:
- [ ] Confirm no existing `app.students` table with different structure
- [ ] Verify all downstream migrations are compatible
- [ ] Test rollback procedure

---

### 2. **005_movement.sql** — Movement Domain Reconstruction

**Type**: Historical Migration Reconstruction  
**Risk**: HIGH — Creates movement tracking infrastructure

**What It Does**:
- Creates `validate_movement_tenant_consistency()` function
- Creates `attendance_cards`, `attendance_records`, `entry_exit_records`, `record_corrections` tables
- Adds foreign keys and triggers for tenant consistency
- Establishes indexes for performance

**Design Assessment**:
- ✅ Comprehensive tenant consistency validation
- ✅ Proper status enums (ACTIVE/INACTIVE/EXPIRED)
- ✅ Audit trail with `created_by`, `verified_by`, `approved_by`
- ✅ Foreign key cascades configured appropriately

**Prerequisites**:
1. Must run AFTER 004_people.sql (depends on `app.students`)
2. Must run AFTER 003_hostel.sql (depends on `app.gates`)

**Risks**:
- **Function Conflict**: If `validate_movement_tenant_consistency()` already exists with different signature
- **Performance**: Tenant consistency triggers fire on every INSERT/UPDATE
- **Migration Order**: MUST be applied in correct sequence

**Approval Requirements**:
- [ ] Verify function doesn't conflict with existing implementation
- [ ] Load test tenant consistency trigger performance
- [ ] Confirm migration order in deployment pipeline

---

### 3. **008_communication.sql** — Communication Domain Reconstruction

**Type**: Historical Migration Reconstruction  
**Risk**: MEDIUM — Creates notification infrastructure

**What It Does**:
- Creates `notifications`, `notification_recipients`, `announcements`, `platform_notifications` tables
- Separates notification content from delivery state
- Establishes tenant-scoped announcements
- Platform-level notification controls

**Design Assessment**:
- ✅ Clean separation of concerns (message vs delivery)
- ✅ Multi-channel support (IN_APP, EMAIL, SMS, PUSH)
- ✅ Priority levels (LOW, NORMAL, HIGH, URGENT)
- ✅ Delivery tracking per recipient

**Prerequisites**:
1. Must run AFTER 004_people.sql (references `app.users`)
2. Must run AFTER 001_platform.sql (references `platform.colleges`)

**Risks**:
- **FK Constraint**: `created_by` references `app.users(user_id)` — all rows must have valid user
- **Notification Spam**: No rate limiting at schema level
- **Status Transitions**: No validation on status changes (QUEUED→SENT→DELIVERED)

**Approval Requirements**:
- [ ] Verify all `created_by` values will have valid user_id
- [ ] Add application-level rate limiting if not present
- [ ] Document notification status state machine

---

### 4. **009_meals_resources.sql** — Meals Domain Reconstruction

**Type**: Historical Migration Reconstruction  
**Risk**: MEDIUM — Creates mess/meal management tables

**What It Does**:
- Creates `meal_timings`, `meal_menus`, `mess_notices`, `food_feedback` tables
- Establishes meal type enums (BREAKFAST, LUNCH, SNACKS, DINNER)
- Date-based meal planning with unique constraints
- Feedback collection mechanism

**Design Assessment**:
- ✅ Unique constraint prevents duplicate meal schedules
- ✅ Status workflow (DRAFT→PUBLISHED→EXPIRED/CANCELLED)
- ✅ Hostel-level meal management
- ⚠️ No validation on time ranges (start_time < end_time)

**Prerequisites**:
1. Must run AFTER 003_hostel.sql (depends on `app.hostels`)
2. Must run AFTER 004_people.sql (depends on `app.users`)

**Risks**:
- **Time Validation**: Missing CHECK constraint on `start_time < end_time`
- **Orphan Records**: If hostel deleted, meal records remain (ON DELETE RESTRICT)
- **Timezone Handling**: Uses `time without time zone` — may cause issues across timezones

**Approval Requirements**:
- [ ] Add CHECK constraint for time range validation
- [ ] Document hostel deletion policy (restrict is intentional?)
- [ ] Review timezone handling with international deployments

---

### 5. **900_security.sql** — RLS Policy Fix

**Type**: Security Policy Modification  
**Risk**: HIGH — Changes fundamental access control behavior

**What It Does**:
- Drops ALL existing `tenant_isolation_*` RESTRICTIVE policies
- Recreates them as PERMISSIVE policies
- Changes access control semantics from "block unless allowed" to "allow if matched"

**Critical Change**:
```sql
-- BEFORE (implied):
CREATE POLICY tenant_isolation_X AS RESTRICTIVE ...

-- AFTER:
CREATE POLICY tenant_isolation_X AS PERMISSIVE ...
```

**Impact Analysis**:
- **RESTRICTIVE**: Policies are ANDed — ALL must pass for access
- **PERMISSIVE**: Policies are ORed — ANY passing policy grants access
- This changes the security model from "deny by default" to "allow by match"

**Design Assessment**:
- ⚠️ PERMISSIVE is correct IF there's only one policy per table
- ❌ PERMISSIVE is dangerous IF multiple policies exist (they OR together)
- ✅ Matches standard multi-tenant RLS pattern

**Prerequisites**:
1. Must run AFTER all table creation migrations
2. Must verify no conflicting PERMISSIVE policies exist

**Risks**:
- **Access Control Bypass**: If multiple PERMISSIVE policies exist, they OR together
- **Security Regression**: Changing policy type without full audit is dangerous
- **Production Impact**: Existing queries may suddenly see different data

**Approval Requirements**:
- [ ] **MANDATORY DBA REVIEW**: Security policy changes require senior approval
- [ ] Audit all existing RLS policies before applying
- [ ] Test in staging with production-like data
- [ ] Document rollback procedure
- [ ] Verify no other PERMISSIVE policies on affected tables

**Recommendation**: Mark as BLOCKED pending security audit.

---

### 6. **901_indexes.sql** — Index Fix

**Type**: Index Correction  
**Risk**: LOW — Adds performance indexes only

**What It Does**:
- Creates production indexes for all HMS tables
- Fixes notification_recipients index column naming
- Covers foreign keys, status columns, date ranges

**Design Assessment**:
- ✅ Uses `IF NOT EXISTS` for idempotency
- ✅ Covers all foreign key columns
- ✅ Indexes status and date filters
- ✅ Composite indexes for common query patterns

**Prerequisites**:
1. Must run AFTER all table creation migrations

**Risks**:
- **Index Bloat**: 160+ indexes may increase storage/maintenance overhead
- **Write Performance**: More indexes = slower INSERTs/UPDATEs
- **Lock Contention**: Creating indexes on large tables may lock them temporarily

**Approval Requirements**:
- [ ] Review index list with DBA for redundancy
- [ ] Schedule during maintenance window (index creation locks tables)
- [ ] Monitor disk space before/after

**Recommendation**: APPROVE with staging verification.

---

### 7. **903_seed.sql** — Seed Data Fix

**Type**: Data Correction  
**Risk**: LOW — Fixes reference data only

**What It Does**:
- Changes module priorities from numeric (10,20,30) to 'M' (Medium)
- Inserts baseline modules, roles, permissions
- Establishes role-permission mappings
- Creates entitlement templates

**Critical Change**:
```sql
-- BEFORE (implied):
priority = 10, 20, 30...

-- AFTER:
priority = 'M'
```

**Design Assessment**:
- ✅ Uses ON CONFLICT DO NOTHING for idempotency
- ✅ Separates reference data from operational data
- ✅ No student/college data inserted
- ⚠️ Priority change suggests schema mismatch

**Prerequisites**:
1. Must run AFTER 001_platform.sql (depends on modules table)
2. Verify `priority` column type is `text` or compatible with 'M'

**Risks**:
- **Type Mismatch**: If priority column is numeric, 'M' will fail
- **Constraint Violation**: Existing CHECK constraints may reject 'M'
- **Application Logic**: Code may expect numeric priorities

**Approval Requirements**:
- [ ] Verify priority column type: `\d platform.modules`
- [ ] Check for priority-based sorting in application code
- [ ] Test with existing module records

**Recommendation**: APPROVE after verifying priority column type.

---

## Integration Tests Executed

### RLS Integration Tests (TEST_DATABASE_URL)

**Container**: `hms-postgres-integration-test-run` (postgres:15-alpine)  
**Port**: 5435 (disposable, NOT development 5432)  
**Database**: `hms_integration_test` (ends in _test)  
**Test Role**: `hms_api_test` (NOSUPERUSER, NOBYPASSRLS verified: `f|f`)

**Test Results**:
```
✅ TestTenantRLS_Isolation_Integration            PASS (0.56s)
   ✅ College_A_cannot_read_College_B's_records   PASS (0.01s)
   ✅ College_A_cannot_update_College_B's_records PASS (0.01s)
   ✅ Missing_tenant_context_prevents_all_access  PASS (0.01s)
   ✅ College_A_cannot_delete_College_B's_records PASS (0.02s)

✅ TestTenantRLS_PooledConnection_Leakage         PASS (0.14s)
   - Connection PID verified: 108
   - No tenant context leakage across pooled connections
   - Tenant isolation maintained through connection reuse
```

**Exit Code**: 0 ✅

**Coverage**:
- ✅ Cross-tenant read isolation
- ✅ Cross-tenant update prevention
- ✅ Cross-tenant delete prevention
- ✅ Missing tenant context protection
- ✅ Pooled connection tenant cleanup
- ✅ RLS enforced (not bypassed)

---

## Build Validation Results

### Unit Tests
```bash
go test -count=1 ./...
```
**Result**: ✅ PASS  
**Exit Code**: 0  
**Packages Tested**: 8  
**Total Duration**: ~9.5s

### Static Analysis
```bash
go vet ./...
```
**Result**: ✅ PASS  
**Exit Code**: 0  
**Issues Found**: 0

### Build Verification
```bash
go build ./...
```
**Result**: ✅ PASS  
**Exit Code**: 0  
**Binary Generation**: SUCCESS

---

## Approval Matrix

| Patch | DBA Review | Security Review | Staging Test | Rollback Plan | Status |
|-------|------------|----------------|--------------|---------------|--------|
| 004_people.sql | ⏳ Required | ⏳ Required | ⏳ Required | ⏳ Required | ⛔ PENDING |
| 005_movement.sql | ⏳ Required | ⏳ Required | ⏳ Required | ⏳ Required | ⛔ PENDING |
| 008_communication.sql | ⏳ Required | ✅ N/A | ⏳ Required | ⏳ Required | ⛔ PENDING |
| 009_meals_resources.sql | ⏳ Required | ✅ N/A | ⏳ Required | ⏳ Required | ⛔ PENDING |
| 900_security.sql | ⚠️ **MANDATORY** | ⚠️ **MANDATORY** | ⚠️ **MANDATORY** | ⏳ Required | 🚫 **BLOCKED** |
| 901_indexes.sql | ⏳ Required | ✅ N/A | ⏳ Required | ✅ DROP INDEX | ⚙️ CONDITIONAL |
| 903_seed.sql | ✅ N/A | ✅ N/A | ⏳ Required | ⏳ Required | ⚙️ CONDITIONAL |

---

## Deployment Recommendations

### Phase 1: Schema Reconstruction (HIGH RISK)
**Order**: 004 → 005 → 008 → 009  
**Deployment Window**: Maintenance window required  
**Prerequisites**:
1. Full database backup
2. Staging environment validation
3. Rollback SQL scripts prepared
4. Application compatibility verified

**Rollback Procedure**:
```sql
-- CRITICAL: Test in staging first
DROP TABLE IF EXISTS app.food_feedback CASCADE;
DROP TABLE IF EXISTS app.mess_notices CASCADE;
-- ... (full reversal of all tables in reverse order)
```

### Phase 2: Security Policy Update (CRITICAL)
**File**: 900_security.sql  
**Status**: **BLOCKED — MANDATORY SECURITY AUDIT REQUIRED**  
**Risk**: Changing RLS policy type affects access control semantics  
**Action**: Do NOT merge until:
1. Security team reviews RESTRICTIVE→PERMISSIVE change
2. All existing RLS policies audited
3. Production-like data tested in staging
4. Zero-downtime rollback procedure documented

### Phase 3: Performance Optimization (LOW RISK)
**Files**: 901_indexes.sql  
**Deployment Window**: Maintenance window (index creation locks tables)  
**Prerequisites**: Disk space check (estimate +5-10% database size)

### Phase 4: Reference Data Fix (LOW RISK)
**File**: 903_seed.sql  
**Prerequisites**: Verify priority column type compatibility  
**Rollback**: DELETE FROM platform.modules WHERE created_at > NOW()

---

## Outstanding Risks

### Critical
1. ⚠️ **900_security.sql**: Policy type change requires security audit
2. ⚠️ **004_people.sql**: If production has different students table, CONFLICT
3. ⚠️ **005_movement.sql**: Trigger performance impact unknown at scale

### High
4. Missing CHECK constraint in 009_meals_resources.sql (start_time < end_time)
5. Timezone handling in meal_timings may cause issues
6. No rate limiting on notification creation

### Medium
7. 160+ indexes may impact write performance
8. Module priority change may break existing application logic

---

## Conclusion

**Overall Assessment**: ⚠️ **PARTIAL APPROVAL — WITH CONDITIONS**

**Safe to Merge Immediately**: NONE  
**Requires Staging Validation**: 004, 005, 008, 009, 901, 903  
**BLOCKED (Security Review)**: 900

**Next Steps**:
1. Schedule DBA review session for schema reconstruction patches
2. **MANDATORY**: Security team audit of 900_security.sql
3. Validate all patches in staging environment with production-like data
4. Prepare and test rollback procedures
5. Document deployment runbook with verification checkpoints

**Deployment Readiness**: ❌ NOT READY  
**Reason**: Pending security audit, missing rollback plans, untested in staging

---

**Review Completed**: 2026-10-10  
**Next Review**: After security audit completion
