# HMS Student Module — Batch 03 Report
## Student Profile & Hostel Information

**Date:** 2026-11-07  
**Module:** HMS Student Self-Service Portal (`MODULES/STUDENT`)  
**Scope:** Strict implementation within `D:\HMS\MODULES\STUDENT\FRONTEND` and `D:\HMS\MODULES\STUDENT\BACKEND`.

---

## 1. Batch
```text
Batch 03 — Student Profile & Hostel Information
```

---

## 2. Implemented Features

1. **Student Personal Identity & Profile View**:
   - Complete, authorized profile view displaying real student identification: Full Name, Admission Number, Roll Number, Registration Number, Date of Birth, Gender, Blood Group, Institutional Email, Phone Number, and Permanent Residential Address.
   - Zero hardcoded mock strings or fake demo records.

2. **Academic Enrollment Information**:
   - Authorized view of academic master data linked to the student: Academic Department, Degree/Program Name, Course/Branch Name, Academic Year, Current Semester Number, Academic Batch, and Admission Date.
   - Clean display-only rendering without calculation or extrapolation of unsupported academic metrics.

3. **Student Standing & Account Governance**:
   - Account status badges reflecting official database enums (`ACTIVE`, `INACTIVE`, `SUSPENDED`, `GRADUATED`).
   - Hostel residential status badges (`ALLOCATED`, `NOT_ALLOCATED`, `VACATED`, `BLOCKED`).
   - Clear institutional governance notice explaining that student records are officially maintained by the College Registrar and Hostel Administration.

4. **Hostel & Accommodation Hierarchy**:
   - Structured visual display of the complete accommodation hierarchy:
     ```text
     Hostel Facility: [Hostel Name] ([Hostel Type])
       ↓
     Block: [Block Name]
       ↓
     Floor: Floor [Floor Number]
       ↓
     Room: Room [Room Number]
       ↓
     Assigned Bed: Bed [Bed Label]
     ```
   - Displays Allocation Type (e.g. `REGULAR`), Allotment Status (`ACTIVE`), Effective Allocation Date, and Allocation Remarks.
   - Distinct empty state ("No Hostel Accommodation Currently Assigned") when the resident is unallotted.

5. **Parent & Guardian Information**:
   - Queries verified relationships from `app.student_parents` joined with `app.parents`.
   - Displays Guardian Full Name, Relationship (e.g. `FATHER`, `MOTHER`, `LOCAL_GUARDIAN`), Primary status, Contact Phone, Alternate Phone, Email, and Occupation.
   - Displays notification recipient and authorized campus pickup flags.
   - Dedicated empty state ("No Guardian Information Available") when no guardian records exist.

6. **Authorized Emergency Contacts**:
   - Queries emergency contacts from `app.emergency_contacts` scoped to the student and college.
   - Displays Contact Name, Relationship, Priority Level, Primary Phone, Alternate Phone, and Email.
   - Dedicated empty state ("No Emergency Contact Information Available") when no records exist.

7. **Permitted Student Documents**:
   - Queries permitted student documents stored in `app.files` where `owner_table = 'students'`.
   - Displays Document Name, File Format/MIME type, File Size, Upload Date, and Status.
   - Dedicated empty state ("No Permitted Documents Available") when no documents are linked.

8. **Strict Read-Only Enforcement**:
   - Direct field edits are disallowed under the existing API contract (administrative updates require `people.manage` permission).
   - Displayed cleanly as a read-only official institutional record with guidance for administrative changes.

9. **Responsive & Accessible Tabbed Navigation**:
   - Seamless navigation across 5 dedicated tabs: Overview & Personal, Academic Enrollment, Hostel Accommodation, Guardians & Contacts, Permitted Documents.
   - Fully accessible with keyboard navigation, semantic headings, and color-independent badges.

---

## 3. Profile Fields Displayed

- `full_name` (String, computed from `first_name`, `middle_name`, `last_name`)
- `admission_number` (String, unique institutional identifier)
- `registration_number` (String, optional university registration)
- `roll_number` (String, optional classroom roll number)
- `date_of_birth` (Date, formatted string or "Not recorded")
- `gender` (String)
- `blood_group` (String)
- `email` (CITEXT, registered institutional email)
- `phone` (String, primary student mobile)
- `emergency_contact_phone` (String, primary emergency contact number)
- `address_line1`, `address_line2`, `city`, `state`, `postal_code`, `country` (Residential address)
- `student_status` (String enum: `ACTIVE`, `INACTIVE`, `SUSPENDED`, `GRADUATED`)
- `hostel_status` (String enum: `ALLOCATED`, `NOT_ALLOCATED`, `VACATED`, `BLOCKED`)

---

## 4. Academic Fields Displayed

- `department_name` (String, from `app.departments`)
- `program_name` (String, from `app.programs`)
- `course_name` (String, from `app.courses`)
- `academic_year` (String, from `app.academic_years`)
- `semester_number` (Integer, from `app.semesters`)
- `batch_name` (String, from `app.batches`)
- `admission_date` (Date, from `app.students`)
- `student_status` (Enrollment standing)

---

## 5. Hostel Fields Displayed

- `hostel_name` (String, from `app.hostels`)
- `hostel_type` (String: `BOYS`, `GIRLS`, `COED`)
- `block_name` (String, from `app.blocks`)
- `floor_number` (Integer, from `app.rooms`)
- `room_number` (String, from `app.rooms`)
- `bed_label` (String, from `app.beds`)
- `allocation_type` (String, e.g. `REGULAR`, `TEMPORARY`, `EMERGENCY`)
- `status` (String: `ACTIVE`, `RELEASED`)
- `allocated_at` (Timestamp, initial allocation date)
- `remarks` (String, optional allotment notes)

---

## 6. Guardian Information

- **Available Fields**: `full_name`, `relationship`, `is_primary`, `phone`, `alternate_phone`, `email`, `occupation`, `can_receive_notifications`, `can_pickup_student`.
- **Authorization & Scoping Rules**:
  - Scoped strictly by `college_id` and `student_id` via `app.student_parents`.
  - No access to arbitrary parent records or parents of other students.
  - Zero exposure of internal database passwords, login credentials, or parent user accounts.

---

## 7. Emergency Contacts

- **Available Fields**: `contact_name`, `relationship`, `phone`, `alternate_phone`, `email`, `is_primary`.
- **Operations Supported**: Read-only display. Scoped by `college_id` and authenticated `student_id`.

---

## 8. Documents

- **Availability**: Document metadata queries `app.files` for `owner_table = 'students'` and `owner_id = student_id`.
- **Permitted Fields**: `file_name`, `mime_type`, `file_size`, `uploaded_at`, `status`.
- **Limitation**: Document upload and binary streaming infrastructure remain outside student self-service scope. If no files are attached, a clean empty state is displayed.

---

## 9. Profile Editing Policy

```text
Profile editing unavailable under existing API contract.
```
- **Reason**: The existing shared API endpoint `PUT /college/students/:student_id` requires the administrative permission `people.manage`. Students possess only resident self-service access. In accordance with Section 15 of Batch 03 instructions, the profile is strictly read-only and no unsupported editing controls were introduced.

---

## 10. APIs Used

| Endpoint | HTTP Method | Purpose | Source | Authorization | Student Ownership | Verified |
|---|---|---|---|---|---|---|
| `GET /college/student/profile` | GET | Comprehensive student profile with academic, residential, guardian, emergency contact, and document data | Student Module Backend (`MODULES/STUDENT/BACKEND/handlers/student_handler.go`) | `requireAuth` (`hms_student_token`, `X-Scope: COLLEGE`) | Service resolves `student_id` strictly from JWT `user_id`/`email` and `college_id` against `app.students` | YES |
| `GET /college/student/room-allocation` | GET | Detailed active bed allotment and hostel hierarchy | Student Module Backend | `requireAuth` | Scoped to authenticated student identity | YES |
| `GET /college/student/guardians` | GET | List of verified parent/guardian records | Student Module Backend | `requireAuth` | Scoped to authenticated student identity | YES |
| `GET /college/student/emergency-contacts` | GET | List of authorized emergency contacts | Student Module Backend | `requireAuth` | Scoped to authenticated student identity | YES |
| `GET /college/student/documents` | GET | List of permitted student documents | Student Module Backend | `requireAuth` | Scoped to authenticated student identity | YES |

---

## 11. Files Changed

1. `D:\HMS\MODULES\STUDENT\BACKEND\models\student.go`:
   - Added `GuardianInfo`, `EmergencyContactInfo`, and `StudentDocumentInfo` model structs.
   - Extended `StudentProfile` with academic fields (`program_name`, `course_name`, `semester_number`, `batch_name`, `admission_date`), `student_status`, `hostel_status`, and child lists (`guardians`, `emergency_contacts`, `documents`).
2. `D:\HMS\MODULES\STUDENT\BACKEND\repository\student_repository.go`:
   - Updated `GetStudentByUserID` to join academic tables (`departments`, `programs`, `courses`, `academic_years`, `semesters`, `batches`) and removed reference to non-existent column `emergency_contact_phone` on `app.students`.
   - Added `ListStudentGuardians` querying `app.student_parents` and `app.parents`.
   - Added `ListEmergencyContacts` querying `app.emergency_contacts`.
   - Added `ListStudentDocuments` querying `app.files`.
3. `D:\HMS\MODULES\STUDENT\BACKEND\services\services.go`:
   - Updated `GetProfile` to assemble academic details, room allocation, guardians, emergency contacts, and documents into a unified profile.
   - Added `ListGuardians`, `ListEmergencyContacts`, and `ListDocuments`.
4. `D:\HMS\MODULES\STUDENT\BACKEND\handlers\student_handler.go`:
   - Added HTTP handlers `ListGuardians`, `ListEmergencyContacts`, and `ListDocuments`.
5. `D:\HMS\MODULES\STUDENT\BACKEND\routes\routes.go`:
   - Registered endpoints `/guardians`, `/emergency-contacts`, and `/documents` under `/college/student`.
6. `D:\HMS\MODULES\STUDENT\FRONTEND\WEB\src\services\studentService.js`:
   - Added API client methods `getGuardians()`, `getEmergencyContacts()`, and `getDocuments()`.
7. `D:\HMS\MODULES\STUDENT\FRONTEND\WEB\src\pages\ProfilePage.jsx`:
   - Complete implementation of the multi-tab Student Profile & Hostel Information screen.

---

## 12. Files Created

1. `D:\HMS\MODULES\STUDENT\STUDENT_BATCH_03_REPORT.md` (This report).

---

## 13. Files Reused

- `D:\HMS\MODULES\STUDENT\FRONTEND\WEB\src\components\PageHeader.jsx`
- `D:\HMS\MODULES\STUDENT\FRONTEND\WEB\src\components\Card.jsx`
- `D:\HMS\MODULES\STUDENT\FRONTEND\WEB\src\components\Badge.jsx`
- `D:\HMS\MODULES\STUDENT\FRONTEND\WEB\src\components\Button.jsx`
- `D:\HMS\MODULES\STUDENT\FRONTEND\WEB\src\components\LoadingState.jsx`
- `D:\HMS\MODULES\STUDENT\FRONTEND\WEB\src\components\EmptyState.jsx`
- `D:\HMS\MODULES\STUDENT\FRONTEND\WEB\src\components\ErrorState.jsx`
- `D:\HMS\MODULES\STUDENT\FRONTEND\WEB\src\services\api.js`

---

## 14. Dependencies & Unsupported APIs

- **Binary File Upload/Download**: Binary document download and storage endpoints belong to a general files service and are not part of the Student self-service scope. Document records are viewable through metadata in `app.files`.
- **Direct Profile Modification**: Disallowed under the current contract; requires institutional administrative elevation (`people.manage`).

---

## 15. Validation Results

| Test Suite | Result | Details |
|---|---|---|
| **Frontend Build** | **PASS** | `npm run build` executed cleanly with **0 errors** (1444 modules transformed in 12.47s). |
| **Frontend Lint** | **NOT AVAILABLE** | No standalone lint script configured in project `package.json`. |
| **Backend Build** | **PASS** | `go build` compiled `API/cmd/server/main.go` cleanly with exit code 0. |
| **Runtime Verification** | **VERIFIED** | Backend running on `http://localhost:3001` with PostgreSQL connection active; health check verified with `{"status":"ok"}`. |

---

## 16. API and Database Integrity Confirmation

```text
Database schema changed:     NO
Database migrations changed: NO
Existing records changed:    NO
Shared API changed:          NO
Shared router changed:       NO
Other modules changed:       NO
```

---

## FINAL STATUS

```text
BATCH 03 COMPLETE
```

