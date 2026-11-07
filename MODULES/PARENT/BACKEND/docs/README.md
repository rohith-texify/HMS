# HMS Parent Backend Module (`MODULES/PARENT/BACKEND`)

## Overview
The Parent Backend module delivers domain logic, data models, validation, and REST API handlers for parent profiles and student-parent associations in the Hostel Management System (HMS).

## Architectural Structure
Consistent with other HMS domain modules (`MODULES/ADMIN/BACKEND`, `MODULES/HOSTEL-INCHARGE/BACKEND`, `MODULES/SUPER-ADMIN/BACKEND`):

```
MODULES/PARENT/BACKEND/
├── docs/
│   └── README.md
├── handlers/
│   ├── context_helper.go        # Gin context tenant extraction
│   ├── error_helper.go          # Standard HTTP error mapping
│   ├── parent_handler.go        # CRUD handlers for /parents
│   └── student_parent_handler.go# Association handlers for /students/:student_id/parents
├── models/
│   ├── parent.go                # Parent entity DTOs & query params
│   └── student_parent.go        # StudentParent entity DTOs & query params
├── repository/
│   ├── repository.go            # DB connection & transaction context helpers
│   ├── parent_repository.go     # SQL access for app.parents
│   └── student_parent_repository.go # SQL access for app.student_parents
├── routes/
│   └── routes.go                # Route registration hook (RegisterParentRoutes)
├── services/
│   ├── parent_service.go        # Business logic, bcrypt hashing, quota enforcement
│   └── student_parent_service.go# Primary parent constraints & relationship validation
└── validators/
    └── validator.go             # Request payload & parameter validators
```

## Route Endpoints Registered
All routes are mounted under `collegeProtected` with role-based permission checks:

| Method | Endpoint | Permission | Handler Description |
|---|---|---|---|
| `GET` | `/parents` | `people.view` | Paginated listing of college parents |
| `POST` | `/parents` | `people.manage` | Create parent profile & optional login |
| `GET` | `/parents/:parent_id` | `people.view` | Get parent profile by ID |
| `PUT` | `/parents/:parent_id` | `people.manage` | Update parent profile by ID |
| `GET` | `/students/:student_id/parents` | `people.view` | List parents linked to student |
| `POST` | `/students/:student_id/parents` | `people.manage` | Link parent to student |
| `GET` | `/students/:student_id/parents/:relationship_id` | `people.view` | Get specific student-parent link |
| `PUT` | `/students/:student_id/parents/:relationship_id` | `people.manage` | Update student-parent link |
| `DELETE` | `/students/:student_id/parents/:relationship_id` | `people.manage` | Remove student-parent link |
| `GET` | `/parent/status` | `people.view` | Module operational status check |

