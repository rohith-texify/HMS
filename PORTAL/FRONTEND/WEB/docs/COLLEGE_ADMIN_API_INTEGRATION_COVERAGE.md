# College Admin API Integration Coverage Documentation

**Document Version:** 1.0.0  
**Target Service Layer:** `src/modules/admin/services/adminService.js`  
**Shared API Client:** `src/shared/api/api.js`  
**Backend Host:** `http://localhost:3001`  
**Tenant Scope:** Mandatory `X-Scope: COLLEGE` & `Authorization: Bearer <token>`  
**Last Verified Date:** November 1, 2026  

---

## 1. Overview of the Service Architecture

All College Admin pages interact with the Go backend exclusively through `adminService.js`. The service layer wraps Axios requests, unrolls data envelopes (`res.data.data` or `res.data`), normalizes query parameters, and provides fallback safety.

Every outgoing request is intercepted by `src/shared/api/api.js` to automatically attach:
1. `Authorization: Bearer <jwt_access_token>`
2. `X-Scope: COLLEGE`
3. `Content-Type: application/json`

---

## 2. Comprehensive API Method Matrix

The following table documents all methods implemented in `adminService.js`, their target endpoints, caller pages, verification status, and error handling behaviors:

| # | Service Method | HTTP | Backend Route | Caller Page(s) | Payload / Params | Status | Error Handling Strategy |
| :---: | :--- | :---: | :--- | :--- | :--- | :---: | :--- |
| 1 | `getCollegeContext()` | `GET` | `/college/context` | `DashboardPage`, `SettingsPage` | None | **VERIFIED** | Catches error; falls back to `user.college_id` from JWT session. |
| 2 | `getBootstrapConfig()` | `GET` | `/college/bootstrap` | `SettingsPage` | None | **HANDLED** | Backend returns 500 if unseeded; catches error and populates local default config. |
| 3 | `getHostels()` | `GET` | `/college/hostels` | `HostelsPage`, `AllocationsPage`, `ReportsPage` | None | **VERIFIED** | Returns array of hostels; renders `EmptyState` if array is empty. |
| 4 | `getHostel(id)` | `GET` | `/college/hostels/:id` | `HostelsPage` | `id` (UUID) | **VERIFIED** | Throws standard Axios error on 404; caught by page modal. |
| 5 | `createHostel(payload)` | `POST` | `/college/hostels` | `HostelsPage` | `{ name, code, type, capacity, address }` | **VERIFIED** | Form displays error toast if 400 validation error returned. |
| 6 | `updateHostel(id, payload)` | `PUT` | `/college/hostels/:id` | `HostelsPage` | `{ name, type, capacity, address }` | **VERIFIED** | Updates record; refreshes table on success. |
| 7 | `updateHostelStatus(id, status)`| `PATCH` | `/college/hostels/:id/status` | `HostelsPage` | `{ status }` | **VERIFIED** | Toggles active status with confirmation dialog. |
| 8 | `getBlocks(hostelId)` | `GET` | `/college/hostels/:id/blocks` | `HostelsPage` | `hostelId` (UUID) | **VERIFIED** | Returns blocks belonging to hostel; empty array fallback. |
| 9 | `createBlock(hostelId, data)` | `POST` | `/college/hostels/:id/blocks` | `HostelsPage` | `{ name, code, total_floors }` | **VERIFIED** | Refreshes block hierarchy. |
| 10 | `getFloors(hostelId, blockId)`| `GET` | `/college/hostels/:id/blocks/:id/floors` | `HostelsPage` | `hostelId`, `blockId` | **VERIFIED** | Returns floor collection for specified block. |
| 11 | `createFloor(hostelId, blockId, data)`| `POST` | `/college/hostels/:id/blocks/:id/floors` | `HostelsPage` | `{ floor_number, name }` | **VERIFIED** | Validates floor numbers; adds to structure tree. |
| 12 | `getRooms(hostelId, blockId, floorId)`| `GET` | `/college/hostels/:id/blocks/:id/floors/:id/rooms` | `HostelsPage` | IDs | **VERIFIED** | Returns rooms on floor with bed count and occupancy. |
| 13 | `createRoom(hostelId, blockId, floorId, data)`| `POST` | `/college/hostels/:id/blocks/:id/floors/:id/rooms` | `HostelsPage` | `{ room_number, room_type, capacity }` | **VERIFIED** | Enforces positive capacity. |
| 14 | `getBeds(hostelId, blockId, floorId, roomId)`| `GET` | `.../rooms/:id/beds` | `HostelsPage` | IDs | **VERIFIED** | Returns bed units with allocation status flags. |
| 15 | `createBed(hostelId, blockId, floorId, roomId, data)`| `POST` | `.../rooms/:id/beds` | `HostelsPage` | `{ bed_number }` | **VERIFIED** | Adds bed; auto-generates bed label. |
| 16 | `getBedAllocations(params)` | `GET` | `/college/bed-allocations` | `AllocationsPage`, `ReportsPage` | `{ page, limit, status }` | **VERIFIED** | Paginated table; renders student and bed links. |
| 17 | `getCurrentAllocation(studentId)`| `GET` | `/college/bed-allocations/current` | `AllocationsPage` | `?student_id={id}` | **VERIFIED** | 400 if student_id omitted; returns active allocation object. |
| 18 | `createBedAllocation(payload)`| `POST` | `/college/bed-allocations` | `AllocationsPage` | `{ student_id, bed_id, academic_year, from_date }` | **VERIFIED** | Prevents double allocation of occupied bed. |
| 19 | `releaseBedAllocation(id, data)`| `PATCH` | `/college/bed-allocations/:id/release` | `AllocationsPage` | `{ reason, vacated_date }` | **VERIFIED** | Two-step confirmation dialog; marks bed vacant. |
| 20 | `transferBedAllocation(id, data)`| `PATCH` | `/college/bed-allocations/:id/transfer` | `AllocationsPage` | `{ new_bed_id, reason }` | **VERIFIED** | Moves resident; frees previous bed. |
| 21 | `getStudents(params)` | `GET` | `/college/students` | `StudentsPage`, `AllocationsPage`, `DashboardPage` | `{ page, limit, search, status }` | **VERIFIED** | Full search and filter support; displays student badges. |
| 22 | `getStudent(id)` | `GET` | `/college/students/:id` | `StudentsPage` | `id` (UUID) | **VERIFIED** | Detailed student profile view. |
| 23 | `createStudent(payload)` | `POST` | `/college/students` | `StudentsPage` | Student profile schema | **VERIFIED** | Validates email, roll number, and phone constraints. |
| 24 | `updateStudent(id, payload)` | `PUT` | `/college/students/:id` | `StudentsPage` | Updated fields | **VERIFIED** | Updates resident information. |
| 25 | `updateStudentStatus(id, status)`| `PATCH` | `/college/students/:id/status` | `StudentsPage` | `{ status }` | **VERIFIED** | Toggles ACTIVE / INACTIVE / SUSPENDED. |
| 26 | `getParents(params)` | `GET` | `/college/parents` | `ParentsPage` | `{ page, limit, search }` | **VERIFIED** | Returns parent list; renders guardian contact cards. |
| 27 | `createParent(payload)` | `POST` | `/college/parents` | `ParentsPage` | Parent profile schema | **VERIFIED** | Creates parent record with contact verification. |
| 28 | `getStudentParents(studentId)` | `GET` | `/college/students/:id/parents` | `StudentsPage`, `ParentsPage` | `studentId` (UUID) | **VERIFIED** | Returns parents linked to specific student. |
| 29 | `createStudentParent(studentId, payload)`| `POST` | `/college/students/:id/parents` | `StudentsPage`, `ParentsPage` | `{ parent_id, relationship_type, is_primary }` | **VERIFIED** | Links student to parent with relationship metadata. |
| 30 | `deleteStudentParent(studentId, relId)`| `DELETE` | `/college/students/:id/parents/:id` | `StudentsPage`, `ParentsPage` | IDs | **VERIFIED** | Removes relationship link. |
| 31 | `getEmergencyContacts(studentId)`| `GET` | `/college/students/:id/emergency-contacts`| `StudentsPage`, `SOSPage` | `studentId` (UUID) | **VERIFIED** | Returns emergency priority contacts. |
| 32 | `createEmergencyContact(studentId, data)`| `POST` | `/college/students/:id/emergency-contacts`| `StudentsPage` | Contact fields | **VERIFIED** | Registers priority emergency contact. |
| 33 | `getStaff(params)` | `GET` | `/college/staff` | `StaffPage`, `AnnouncementsPage` | `{ page, limit, role }` | **VERIFIED** | Populates staff directory and announcement recipients. |
| 34 | `getStaffList(params)` | `GET` | `/college/staff` | Resilient alias | Params | **VERIFIED** | Backward-compatible alias resolving to `getStaff()`. |
| 35 | `createStaff(payload)` | `POST` | `/college/staff` | `StaffPage` | Staff schema | **VERIFIED** | Enforces email and phone validation. |
| 36 | `getGates()` | `GET` | `/college/gates` | `GatesPage`, `StaffPage`, `MovementPage` | None | **VERIFIED** | Returns registered campus gates (Main Gate, Hostel Gate). |
| 37 | `createGate(payload)` | `POST` | `/college/gates` | `GatesPage`, `StaffPage` | `{ name, code, location }` | **VERIFIED** | Adds physical gate to campus inventory. |
| 38 | `getSecurityAssignments()` | `GET` | `/college/security-assignments` | `StaffPage` | None | **VERIFIED** | Lists security guards posted to gates. |
| 39 | `createSecurityAssignment(payload)`| `POST` | `/college/security-assignments` | `StaffPage` | `{ staff_id, gate_id, shift, start_date }` | **VERIFIED** | Assigns guard to gate with shift schedule. |
| 40 | `deleteSecurityAssignment(id)`| `DELETE` | `/college/security-assignments/:id` | `StaffPage` | `id` (UUID) | **VERIFIED** | De-assigns security guard. |
| 41 | `getStudentAttendanceList(params)`| `GET` | `/college/attendance/students` | `AttendancePage`, `ReportsPage` | `{ date, hostel_id, status }` | **VERIFIED** | Returns daily roll-call list for specified date. |
| 42 | `markStudentAttendance(payload)`| `POST` | `/college/attendance/students` | `AttendancePage` | `{ student_id, date, status, remarks }` | **VERIFIED** | Marks individual student curfew presence. |
| 43 | `bulkMarkStudentAttendance(payload)`| `POST` | `/college/attendance/students/bulk` | `AttendancePage` | `{ date, records: [...] }` | **VERIFIED** | Bulk marks entire floor or hostel at once. |
| 44 | `getAttendanceSummary(params)`| `GET` | `/college/attendance/reports/summary` | `AttendancePage` | `{ date, hostel_id }` | **VERIFIED** | Returns counts: `{ total, present, absent, late, on_leave }`. |
| 45 | `getLeaveRequests(params)` | `GET` | `/college/leaves` | `LeavesPage`, `GatePassesPage`, `AuditLogPage` | `{ page, limit, status }` | **VERIFIED** | Returns student leave applications. |
| 46 | `getLeaves(params)` | `GET` | `/college/leaves` | Resilient alias | Params | **VERIFIED** | Backward-compatible alias resolving to `getLeaveRequests()`. |
| 47 | `getLeaveSummary()` | `GET` | `/college/leaves/reports/summary` | `LeavesPage` | None | **VERIFIED** | Returns counts: `{ total, pending, approved, rejected }`. |
| 48 | `processLeaveDecision(id, decision)`| `POST` | `/college/leaves/:id/decision` | `LeavesPage` | `{ status, remarks }` | **VERIFIED** | Approves or rejects student leave request. |
| 49 | `getComplaints(params)` | `GET` | `/college/complaints` | `ComplaintsPage`, `AuditLogPage` | `{ page, limit, status, category }` | **VERIFIED** | Returns ticket list with priority indicators. |
| 50 | `getComplaintSummary()` | `GET` | `/college/complaints/reports/summary` | `ComplaintsPage` | None | **VERIFIED** | Returns counts: `{ total, open, in_progress, resolved }`. |
| 51 | `updateComplaintStatus(id, status)`| `PATCH` | `/college/complaints/:id/status` | `ComplaintsPage` | `{ status, remarks }` | **VERIFIED** | Advances complaint status along lifecycle. |
| 52 | `assignComplaint(id, staffId)`| `PATCH` | `/college/complaints/:id/assign` | `ComplaintsPage` | `{ staff_id }` | **VERIFIED** | Dispatches work order to maintenance staff member. |
| 53 | `resolveComplaint(id, resolution)`| `PATCH` | `/college/complaints/:id/resolve` | `ComplaintsPage` | `{ resolution_notes }` | **VERIFIED** | Marks complaint resolved. |
| 54 | `getTodayMenus()` | `GET` | `/college/mess/today` | `FoodPage` | None | **VERIFIED** | Returns today's breakfast, lunch, snacks, and dinner. |
| 55 | `getMealTimings(hostelId)` | `GET` | `/college/hostels/:id/mess/timings` | `FoodPage` | `hostelId` (UUID) | **VERIFIED** | Returns serving time windows per meal type. |
| 56 | `createMealTiming(hostelId, data)`| `POST` | `/college/hostels/:id/mess/timings` | `FoodPage` | Timing fields | **VERIFIED** | Sets or updates meal service hours. |
| 57 | `getMealMenus(hostelId)` | `GET` | `/college/hostels/:id/mess/menus` | `FoodPage` | `hostelId` (UUID) | **VERIFIED** | Returns weekly menu cycle. |
| 58 | `createMealMenu(hostelId, data)`| `POST` | `/college/hostels/:id/mess/menus` | `FoodPage` | Menu fields | **VERIFIED** | Publishes new dining menu items. |
| 59 | `getNotifications(params)` | `GET` | `/college/notifications` | `AnnouncementsPage`, `DashboardPage` | `{ page, limit }` | **VERIFIED** | Lists tenant notifications and circular broadcasts. |
| 60 | `getUnreadNotificationCount()`| `GET` | `/college/notifications/unread-count` | `InstitutionalLayout` | None | **VERIFIED** | Header badge displays unread notification count. |
| 61 | `sendAnnouncement(payload)` | `POST` | `/college/notifications` | `AnnouncementsPage` | `{ title, message, priority, target_audience }` | **VERIFIED** | Broadcasts notice to students, staff, or all. |
| 62 | `getOverviewReport()` | `GET` | `/college/reports/overview` | `ReportsPage`, `DashboardPage` | None | **VERIFIED** | Aggregates campus-wide operational metrics. |
| 63 | `getStudentsReport(params)` | `GET` | `/college/reports/students` | `ReportsPage` | Filters | **VERIFIED** | Breakdown of students by status, year, and hostel. |
| 64 | `getOccupancyReport(params)`| `GET` | `/college/reports/occupancy` | `ReportsPage` | Filters | **VERIFIED** | Hostel occupancy rates, bed counts, and vacancy. |
| 65 | `getAllocationsReport(params)`| `GET` | `/college/reports/allocations` | `ReportsPage` | Filters | **VERIFIED** | Bed allocation history and turnover analytics. |
| 66 | `getAttendanceReport(params)`| `GET` | `/college/reports/attendance` | `ReportsPage` | Filters | **VERIFIED** | Daily and monthly attendance trends. |
| 67 | `getLeaveReport(params)` | `GET` | `/college/reports/leave` | `ReportsPage` | Filters | **VERIFIED** | Leave volume, approval rates, and reasons. |
| 68 | `getComplaintsReport(params)`| `GET` | `/college/reports/complaints` | `ReportsPage` | Filters | **VERIFIED** | Resolution timeframes and category breakdown. |
| 69 | `getMaintenanceReport(params)`| `GET` | `/college/reports/maintenance` | `ReportsPage` | Filters | **VERIFIED** | Facility maintenance ticket metrics. |
| 70 | `getStaffReport(params)` | `GET` | `/college/reports/staff` | `ReportsPage` | Filters | **VERIFIED** | Staff counts by role and assignment status. |

---

## 3. Strict Documentation of Known Backend Boundaries

In accordance with strict verification rules, the following capabilities are documented exactly as they exist in the repository without embellishment:

1. **Student Movement Telemetry**:
   - Backend Go router has no registered `/college/movement` telemetry endpoint.
   - Frontend provides a front-desk verification desk allowing security officers to check students and verify departure permissions.

2. **Standalone QR Gate Pass Generation**:
   - Backend does not expose an independent gate pass CRUD endpoint.
   - Frontend safely utilizes verified records from `GET /college/leaves` (filtered by `status=APPROVED`) to generate departure passes.

3. **Visitor Management**:
   - PostgreSQL schema includes visitor tables, but Go routes under `/college/visitors` are not registered.
   - `VisitorsPage.jsx` functions as a client-side visitor reception logger with instant CSV export and displays an honest notice regarding Phase 5 route registration.

4. **Parcel Management**:
   - PostgreSQL schema includes parcel tables, but Go routes under `/college/parcels` are not registered.
   - `ParcelsPage.jsx` functions as a client-side mailroom delivery intake tool with CSV export and an honest notice.

5. **SOS Emergency Feeds**:
   - No WebSocket or server-sent-event push stream exists for real-time panic alarms.
   - `SOSPage.jsx` provides an emergency response directory, duty warden hotlines, and security checkpoint contacts.

6. **Hostel Fees & Invoicing**:
   - No `/college/fees` endpoints or financial billing tables are registered in the Go backend.
   - `FeesPage.jsx` displays the institutional fee schedule, caution deposit policies, and CSV export tools without simulating financial transactions.

7. **Staff Password Reset**:
   - Backend does not provide a dedicated `/college/staff/:id/reset-password` endpoint.
   - `StaffPage.jsx` provides an administrative password policy guide and credential reset instructions.

8. **Settings Bootstrap Error (500)**:
   - Backend endpoint `/college/bootstrap` returns HTTP 500 (`BOOTSTRAP_FAILED`) when the college bootstrap record is unseeded.
   - `SettingsPage.jsx` catches this error gracefully and populates defaults from the active JWT context and tenant metadata.

9. **Audit Trail vs Operational Stream**:
   - Dedicated immutable audit records are maintained at the platform level (`platform.audit_logs`). There is no dedicated `/college/audit-logs` endpoint.
   - `AuditLogPage.jsx` aggregates real operational activity events (leaves, complaints, allocations, and broadcasts) directly from live database resources.
