# Parent Module API Contract & Permission Matrix

## 1. Operational Endpoints (Built & Tested)

### 1.1 Parent Management
| Method | Endpoint | Handler | Permission | Description |
|---|---|---|---|---|
| `GET` | `/parents/status` | Inline | `people.view` | Operational health check for Parent module |
| `GET` | `/parents` | `ParentHandler.ListParents` | `people.view` | Paginated parent directory (limit: 1-100, default: 50) |
| `GET` | `/parents/:parent_id` | `ParentHandler.GetParent` | `people.view` | Fetch parent profile by UUID |
| `POST` | `/parents` | `ParentHandler.CreateParent` | `people.manage` | Create parent profile + auto-provision user account with `PARENT` role |
| `PUT` | `/parents/:parent_id` | `ParentHandler.UpdateParent` | `people.manage` | Update parent contact and personal info |

### 1.2 Student-Parent Associations
| Method | Endpoint | Handler | Permission | Description |
|---|---|---|---|---|
| `GET` | `/students/:student_id/parents` | `StudentParentHandler.ListStudentParents` | `people.view` | List parents linked to student |
| `POST` | `/students/:student_id/parents` | `StudentParentHandler.CreateStudentParent` | `people.manage` | Associate a parent with a student |
| `GET` | `/students/:student_id/parents/:relationship_id` | `StudentParentHandler.GetStudentParent` | `people.view` | Get specific linkage |
| `PUT` | `/students/:student_id/parents/:relationship_id` | `StudentParentHandler.UpdateStudentParent` | `people.manage` | Update relationship flags |
| `DELETE` | `/students/:student_id/parents/:relationship_id` | `StudentParentHandler.DeleteStudentParent` | `people.manage` | Remove linkage |

### 1.3 Parent Portal Features
| Method | Endpoint | Required Permission | Parent Role Seed Status | Frontend Status |
|---|---|---|---|---|
| `GET` | `/college/notifications` | User-scoped (no extra permission) | N/A | **BUILT** |
| `GET` | `/college/notifications/unread-count` | User-scoped (no extra permission) | N/A | **BUILT** |
| `GET` | `/college/notifications/:notification_id` | User-scoped (no extra permission) | N/A | **BUILT** |
| `PATCH` | `/college/notifications/:notification_id/read` | User-scoped (no extra permission) | N/A | **BUILT** |
| `GET` | `/college/mess/today` | `hostel.view` | **GRANTED** | **BUILT** |

---

## 2. Currently Blocked Features (Documented Gaps)

Per architectural audit `PARENT_MODULE_AUDIT_REPORT.md`, the following capabilities require dedicated parent-scoped endpoints and permission grants before frontend activation:

| Feature | Missing Required API Endpoint | Missing Required Permission | Action Required |
|---|---|---|---|
| **Linked Student Profile** | `GET /college/me/students` | `people.view` | Add endpoint returning only students linked to authenticated parent |
| **Accommodation Details** | `GET /college/me/students/:student_id/accommodation` | `people.view` | Add student-scoped bed allocation detail route |
| **Attendance Tracking** | `GET /college/me/students/:student_id/attendance` | `people.view` | Add student-scoped attendance records route |
| **Leave Management (Read)** | `GET /college/me/students/:student_id/leaves` | Has `requests.view` | Add student-scoped leave list route |
| **Leave Management (Action)** | `POST /college/leaves/:leave_id/decision` | `requests.manage` | Add parent approval route & grant `requests.manage` |
| **Outing & Gate Passes** | `GET /college/me/students/:student_id/gate-passes` | `movement.view` | Add gate-pass read contracts with parent validation |
| **Visitors & Parcels** | `GET /college/me/students/:student_id/visitors` | `support.view` | Implement visitor/parcel contracts |
| **Complaints & Maintenance** | `GET /college/me/students/:student_id/complaints` | `requests.view` / `hostel.manage` | Add parent complaint submission & tracking |
| **Documents & Records** | `GET /college/me/students/:student_id/documents` | `resources.view` | Implement document repository endpoints |

---

## 3. Current Seed Permissions for `PARENT` Role
From `DATABASE/migrations/903_seed.sql`:
- `hostel.view` (Allows viewing today's mess menu)
- `movement.view`
- `requests.view`
- `support.view`
- `communication.view`
- `meals.view`

Missing permissions:
- `people.view`
- `requests.manage`
- `hostel.manage`

