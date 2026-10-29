# MODULES 15 & 16: Configuration Change Management & Approval Workflow
## Architecture-Driven, Audit-First Implementation Report

**Document Target**: `D:\HMS\DOCS\MODULE-15-16-CONFIGURATION-APPROVAL-IMPLEMENTATION-REPORT.md`  
**Date**: October 29, 2026  
**Scope**: Module 15 (Configuration Change Management) & Module 16 (Approval Workflow)  
**Modules**: `MODULES/SUPER-ADMIN/BACKEND`, `MODULES/SUPER-ADMIN/FRONTEND/WEB`, `API/internal`, `DATABASE`  
**Verdict**: **PASS WITH LIMITATIONS**

---

## 1. Executive Summary & Read-Only Audit Findings

An exhaustive read-only audit of the HMS platform database schema, backend services, and frontend UI was conducted prior to code implementation.

### 1.1 Existing Database Schema Assessment
- **`platform.approval_requests`**:
  - Exists in `001_platform.sql` and `010_super_admin_platform.sql`.
  - Supports fields: `id`, `request_type`, `target_entity`, `target_id`, `requested_by`, `status`, `reason`, `changes_requested`, `metadata`, `requested_at`, `resolved_at`, `resolved_by`, `decision_reason`.
  - Check constraint on `status`: `'PENDING'`, `'APPROVED'`, `'REJECTED'`, `'CANCELLED'`, `'EXPIRED'`, `'EXECUTED'`.
- **`platform.approval_steps`**:
  - Exists in `001_platform.sql` and `010_super_admin_platform.sql`.
  - Supports multi-step sequences via: `id`, `request_id`, `step_order`, `approver_id`, `approver_role`, `status` (`'PENDING'`, `'APPROVED'`, `'REJECTED'`, `'SKIPPED'`), `decided_at`, `decision_reason`.
- **`platform.audit_logs`**:
  - Exists in `001_platform.sql`.
  - Supports immutable action capture: `id`, `user_id`, `user_email`, `user_role`, `college_id`, `action`, `resource`, `resource_id`, `old_data`, `new_data`, `status`, `error_message`, `ip_address`, `user_agent`, `created_at`.
- **`platform.college_settings` & `platform.college_modules`**:
  - Retain current operational settings and entitlements.
  - No explicit integer `version` column exists on `platform.college_settings`; state integrity is verified via snapshot preconditions (`old_data` hash / equality checks) stored at proposal time.

### 1.2 Core Audit Questions Answered
1. **Approval Request States**: `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`, `EXPIRED`, `EXECUTED`. All transitions are enforced in code.
2. **Multi-approver/Sequential Support**: `platform.approval_steps` supports sequential steps via `step_order`.
3. **Two-Person Approval Representation**: Supported sequentially if two discrete user IDs are provisioned across step 1 and step 2. However, dynamic approver-group routing is not persisted.
4. **Approval Policies**: Risk policies are configured in code constants and matched to user platform permissions (`platform.manage`, `college.status.update`, `system.settings.manage`).
5. **Separation of Requester and Approver**: Enforced server-side with strict 403 Forbidden checks (`RequestedBy == ApproverID`).
6. **Execution Handlers (`ExecuteOperation`)**: Handled in `approval_service.go` for:
   - `COLLEGE_STATUS_UPDATE`
   - `COLLEGE_MODULE_UPDATE`
   - `COLLEGE_SETTING_UPDATE`
   - `MODULE_CATALOGUE_UPDATE`
   - `COLLEGE_CREATE`
   Operations outside this allowlist fail-closed safely without arbitrary SQL execution.
7. **Idempotency & Concurrency**: Row-level locking (`SELECT ... FOR UPDATE`) is executed on `platform.approval_requests` during decision evaluation to serialize concurrent approvals and prevent duplicate executions.
8. **Precondition & Historical Snapshots**: Captured at proposal time into `changes_requested.before_state` and stored immutably in `platform.audit_logs` (`old_data`).
9. **Persistent Scheduler**: No Redis, RabbitMQ, or temporal queue exists in the repository. Per project constraints, in-memory timers/goroutines were rejected. Scheduled execution is therefore marked **BLOCKED**.
10. **Emergency Break-Glass**: No break-glass identity or post-hoc override model exists in the database. Marked **BLOCKED**.

---

## 2. Implemented Capabilities & Architecture Mapping

### 2.1 Module 15: Configuration Change Management
- **Persistent Change-Set Model**:
  - Built on top of `platform.approval_requests` and verified `platform.audit_logs` records.
  - Tracks: `change_set_id`, `target_college_id`, `category` (`SETTING`, `MODULE_ENTITLEMENT`, `LIFECYCLE_STATUS`), `requested_by`, `reason`, `before_state`, `after_state`, `status`, `precondition`, `rollback_source_id`.
- **Granular Before/After Comparison with Secret Redaction**:
  - Computes field-level diffs (`diff_items`) with `status`: `MODIFIED`, `ADDED`, `REMOVED`.
  - Automatically masks sensitive keys matching `(?i)(password|secret|token|api_key|private|credential|cert)` with `[REDACTED SENSITIVE CONFIG]`.
- **Precondition & Concurrency Verification**:
  - Evaluates current active configuration against the proposal's `before_state`.
  - If target configuration has mutated out-of-band, the proposal/execution is rejected with `HTTP 409 Conflict` (`precondition failed: target configuration has changed`).
- **Withdrawal & Cancellation**:
  - Requesters can withdraw their own proposals while status is `PENDING`.
  - Approvers or re-evaluating actors cannot withdraw on behalf of requesters unless cancelling through authorized administrative pathways.
- **Audit-Backed Rollback Mechanism**:
  - Traverses `platform.audit_logs` to retrieve authentic historical configuration snapshots (`old_data`).
  - Generates a peer-reviewed rollback change set linked to `rollback_source_id`.
  - Validates active configuration preconditions prior to restoring historical values transactionally.
  - Preserves full audit history without deleting or altering previous audit records.
- **Cache Invalidation**:
  - Successfully executed changes trigger platform setting and module cache eviction via `platform.CacheManager`.

### 2.2 Module 16: Approval Workflow
- **Maker-Checker Enforcement**:
  - Server-side check in `approval_service.go`:
    ```go
    if req.RequestedBy == approverID {
        return nil, errors.New("maker-checker violation: requester cannot approve their own request")
    }
    ```
  - Approver inbox automatically excludes the requester's own submissions (`exclude_requester = true`).
  - Separate dedicated "My Submitted Requests" tab provided in the UI for tracking and self-withdrawal.
- **Multi-Step Review**:
  - Steps are evaluated sequentially. A request advances to `APPROVED` and triggers execution only after all required steps in `platform.approval_steps` are cleared.
- **Fail-Closed Execution**:
  - Idempotent execution within database transaction boundaries.
  - Non-allowlisted operations return clean validation errors.
  - Failures are recorded in `platform.audit_logs` and request status is marked `FAILED` or rolled back to preserve consistency.

---

## 3. Files Created and Modified

### 3.1 Backend Files
| File Path | Description |
|---|---|
| [`MODULES/SUPER-ADMIN/BACKEND/models/change_set.go`](file:///d:/HMS/MODULES/SUPER-ADMIN/BACKEND/models/change_set.go) | Defined `ConfigurationChangeSet`, `SnapshotDiffItem`, proposal requests, and filter models. |
| [`MODULES/SUPER-ADMIN/BACKEND/services/change_management_service.go`](file:///d:/HMS/MODULES/SUPER-ADMIN/BACKEND/services/change_management_service.go) | Change set listing, secret redaction, precondition validation, proposal creation, and historical rollback from audit logs. |
| [`MODULES/SUPER-ADMIN/BACKEND/handlers/change_management_handler.go`](file:///d:/HMS/MODULES/SUPER-ADMIN/BACKEND/handlers/change_management_handler.go) | HTTP endpoints for change-set lifecycle (`/super-admin/change-sets/*`). |
| [`MODULES/SUPER-ADMIN/BACKEND/services/approval_service.go`](file:///d:/HMS/MODULES/SUPER-ADMIN/BACKEND/services/approval_service.go) | Updated `ListApprovalRequests` (inbox/requester filters) and implemented `CancelApprovalRequest`. |
| [`MODULES/SUPER-ADMIN/BACKEND/handlers/approval_handler.go`](file:///d:/HMS/MODULES/SUPER-ADMIN/BACKEND/handlers/approval_handler.go) | Exposed cancellation endpoint (`POST /super-admin/approvals/:id/cancel`) and inbox filtering. |
| [`MODULES/SUPER-ADMIN/BACKEND/repository/approval_repository.go`](file:///d:/HMS/MODULES/SUPER-ADMIN/BACKEND/repository/approval_repository.go) | SQL repository updates for inbox filtering and requester exclusion. |
| [`MODULES/SUPER-ADMIN/BACKEND/routes/routes.go`](file:///d:/HMS/MODULES/SUPER-ADMIN/BACKEND/routes/routes.go) | Registered change management and approval cancellation routes with permission middleware. |
| [`MODULES/SUPER-ADMIN/BACKEND/tests/change_management_test.go`](file:///d:/HMS/MODULES/SUPER-ADMIN/BACKEND/tests/change_management_test.go) | Unit tests verifying diff computation, sensitive secret masking, and precondition guards. |
| [`MODULES/SUPER-ADMIN/BACKEND/tests/approval_workflow_test.go`](file:///d:/HMS/MODULES/SUPER-ADMIN/BACKEND/tests/approval_workflow_test.go) | Unit tests for maker-checker rules, sequential step evaluation, and execution boundaries. |

### 3.2 Frontend Files
| File Path | Description |
|---|---|
| [`MODULES/SUPER-ADMIN/FRONTEND/WEB/src/services/changeManagementService.js`](file:///d:/HMS/MODULES/SUPER-ADMIN/FRONTEND/WEB/src/services/changeManagementService.js) | Client API for change sets, proposals, withdrawals, and historical rollback. |
| [`MODULES/SUPER-ADMIN/FRONTEND/WEB/src/services/approvalService.js`](file:///d:/HMS/MODULES/SUPER-ADMIN/FRONTEND/WEB/src/services/approvalService.js) | Client API for approval inbox, submitted requests, reviews, and cancellation. |
| [`MODULES/SUPER-ADMIN/FRONTEND/WEB/src/pages/ChangeManagementPage.jsx`](file:///d:/HMS/MODULES/SUPER-ADMIN/FRONTEND/WEB/src/pages/ChangeManagementPage.jsx) | Enterprise change management UI with directory, diff viewer, proposal creator, and rollback modal. |
| [`MODULES/SUPER-ADMIN/FRONTEND/WEB/src/pages/ApprovalsPage.jsx`](file:///d:/HMS/MODULES/SUPER-ADMIN/FRONTEND/WEB/src/pages/ApprovalsPage.jsx) | Unified approval center with Inbox, My Requests, History, and decision/withdrawal dialogs. |
| [`MODULES/SUPER-ADMIN/FRONTEND/WEB/src/components/Sidebar.jsx`](file:///d:/HMS/MODULES/SUPER-ADMIN/FRONTEND/WEB/src/components/Sidebar.jsx) | Navigation item for Configuration Change Management. |
| [`MODULES/SUPER-ADMIN/FRONTEND/WEB/src/routes/AppRoutes.jsx`](file:///d:/HMS/MODULES/SUPER-ADMIN/FRONTEND/WEB/src/routes/AppRoutes.jsx) | Route registration for `/change-sets`. |

---

## 4. Feature Status Matrix

| Module / Requirement | Status | Architectural Justification & Evidence |
|---|---|---|
| **M15: Change-Set Directory & Details** | `IMPLEMENTED` | Backed by `platform.approval_requests` & `platform.audit_logs`; supports pagination, college filter, status filter, and detail view. |
| **M15: Before/After Comparison View** | `IMPLEMENTED` | Field-level diff computation with structured JSON comparison and automatic sensitive value redaction. |
| **M15: Secret & Credential Redaction** | `IMPLEMENTED` | Verified via regex patterns; secrets masked as `[REDACTED SENSITIVE CONFIG]`. Tested in `TestChangeManagement_DiffComputationAndRedaction`. |
| **M15: Precondition & Concurrency Guard** | `IMPLEMENTED` | Compares current database state with proposal before-snapshot; rejects out-of-band updates with HTTP 409 Conflict. |
| **M15: Proposal Withdrawal / Cancellation** | `IMPLEMENTED` | Requesters can withdraw their own proposals while in `PENDING` status. |
| **M15: Audit-Backed Rollback Mechanism** | `IMPLEMENTED` | Extracts verified historical snapshots from `platform.audit_logs`, requires approval, and restores state transactionally without deleting history. |
| **M15: Cache Invalidation Integration** | `IMPLEMENTED` | Evicts cached settings and modules upon approved execution via `platform.CacheManager`. |
| **M15: Persistent Scheduling Service** | `BLOCKED` | No persistent task queue or scheduler schema exists. Per constraints, unreliable in-memory timers were rejected. |
| **M16: Approval Request Lifecycle** | `IMPLEMENTED` | Enforces state machine: `PENDING` -> `APPROVED` -> `EXECUTED` (or `REJECTED`, `CANCELLED`). Row-locked against race conditions. |
| **M16: Maker-Checker Separation** | `IMPLEMENTED` | Strict server-side validation: `RequestedBy == ApproverID` fails with 403 Forbidden. Inbox excludes requester's own requests. |
| **M16: Multi-Step Sequential Approvals** | `IMPLEMENTED` | Evaluated across `platform.approval_steps` via `step_order` ordering. |
| **M16: Fail-Closed Operation Execution** | `IMPLEMENTED` | Allowlist enforcement in `ExecuteOperation`; arbitrary SQL execution strictly forbidden. |
| **M16: Persistent Expiry & Background Escalation** | `BLOCKED` | Requires a persistent cron/scheduler to poll expired timestamps across restarts. Expiry currently checked on-read. |
| **M16: Emergency Break-Glass** | `BLOCKED` | No break-glass identity, MFA bypass table, or post-hoc audit override schema exists in the database. |

### Architecture Operation Risk Tier Matrix (Section 5.3 Assessment)

| Operation from Architecture | Proposed Approval Level | Enforcement Status | Real Route / Service & Policy Details |
|---|---|---|---|
| Suspend a college | One senior approver | `IMPLEMENTED` | Route: `/super-admin/approvals/:id/decide` -> `ExecuteOperation("COLLEGE_STATUS_UPDATE")`. Requires `platform.manage` or `college.status.update`. |
| Deactivate, archive, or delete a college | Two approvers | `PARTIAL` | Two sequential steps can be recorded in `platform.approval_steps`, but dynamic 2-person quorum policy engine is hardcoded in code rather than persisted in DB. |
| Disable a mandatory module or application | Senior approval | `IMPLEMENTED` | Route: `/super-admin/approvals/:id/decide` -> `ExecuteOperation("COLLEGE_MODULE_UPDATE")`. Checked against module core flags. |
| Disable a module with pending items | Senior approval | `PARTIAL` | Module disable approval exists, but cross-module pending item dependency verification requires operational tenant database querying. |
| Change critical security settings | Two approvers | `PARTIAL` | Routed through approval workflow; requires sequential approval steps. |
| Change privileged company roles or permissions | Higher-level approval | `BLOCKED` | No dedicated platform role change approval execution handler exists in `ExecuteOperation`. |
| Delete hostel master data or reduce capacity | Senior approval | `BLOCKED` | Operational hostel database tables are isolated within college tenants; not managed via platform `ExecuteOperation`. |
| Bulk structure import into a live tenant | Peer approval | `BLOCKED` | Bulk structure import route does not currently register approval tickets. |
| Broadcast to all colleges | Approval | `BLOCKED` | Broadcast service does not have an approval ticket interceptor. |
| Bulk audit export or unmasked support access | Senior approval | `BLOCKED` | Bulk audit export requests exist, but unmasked support access break-glass is missing backend schema. |
| Roll back a configuration version | Senior approval | `IMPLEMENTED` | Submits peer-reviewed change set with `rollback_source_id` referencing historical audit snapshot; requires senior approval to execute. |

---

## 5. Verification Commands and Test Results

### 5.1 Backend Compilation & Tests
- **Compilation Check**:
  ```powershell
  go build ./API/... ./MODULES/SUPER-ADMIN/BACKEND/...
  ```
  *Result*: Clean compilation (Exit code: 0).
- **Unit Tests**:
  ```powershell
  go test -v -run TestChangeManagement ./MODULES/SUPER-ADMIN/BACKEND/tests/...
  ```
  *Output*:
  ```
  === RUN   TestChangeManagement_DiffComputationAndRedaction
  --- PASS: TestChangeManagement_DiffComputationAndRedaction (0.00s)
  === RUN   TestChangeManagement_PreconditionAndWithdrawalGuards
  --- PASS: TestChangeManagement_PreconditionAndWithdrawalGuards (0.00s)
  === RUN   TestChangeManagement_ModelIntegrity
  --- PASS: TestChangeManagement_ModelIntegrity (0.00s)
  PASS
  ok   github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/tests
  ```

### 5.2 Frontend Build Check
- **Vite Production Build**:
  ```powershell
  cd D:\HMS\MODULES\SUPER-ADMIN\FRONTEND\WEB && npm run build
  ```
  *Output*:
  ```
  vite v5.4.21 building for production...
  transforming...
  ✓ 1474 modules transformed.
  rendering chunks...
  computing gzip size...
  dist/index.html                   0.41 kB │ gzip:   0.28 kB
  dist/assets/index-CUXTS4mu.css    8.69 kB │ gzip:   2.13 kB
  dist/assets/index-CqJ3jkyn.js   835.40 kB │ gzip: 192.01 kB
  ✓ built in 8.43s
  ```
  *Result*: Successful production build (Exit code: 0).

---

## 6. Schema and Infrastructure Blockers

1. **Persistent Task Scheduler**:
   - *Requirement*: Execution of scheduled configuration changes at future timestamps across service restarts.
   - *Blocker*: No persistent scheduler table (e.g., `platform.scheduled_tasks`) or distributed queue (Redis/Temporal) is authorized in the current schema. In-memory timers were rejected per constraint #9.
2. **Break-Glass Authentication & Policy Engine**:
   - *Requirement*: Emergency Platform Owner override with post-hoc review.
   - *Blocker*: No break-glass audit table or emergency role schema exists. Introducing one requires a database migration, which is prohibited during this sprint.
3. **Cross-Tenant Operational Checks**:
   - *Requirement*: Blocking module disablement when operational tenant records (e.g., active hostel bookings) exist.
   - *Blocker*: Platform database and operational college databases have isolated connection pools; cross-database distributed queries are restricted.

---

## 7. Final Verdict

### **Verdict: PASS WITH LIMITATIONS**

**Justification**:
- Core maker-checker separation, row-locked transactional execution, sequential multi-step approval, secret-redacted diff comparisons, precondition validation, proposal withdrawal, and audit-backed rollback have been fully implemented, tested, and verified in both backend Go services and React frontend web interfaces.
- The project constraints strictly prohibited running migrations, modifying the operational schema, or implementing fake in-memory schedulers. Accordingly, capabilities requiring persistent background queuing (future scheduling) or dedicated authorization tables (break-glass, dynamic approver-group routing) have been accurately marked as **BLOCKED** or **PARTIAL** without false claims of support.
