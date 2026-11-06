# HMS Parent Module — Backend Ownership & Architecture

## 1. Module Overview
This package defines the backend domain models, repository access, services, HTTP handlers, validators, and route registration for the **Parent Module** of the Hostel Management System (HMS).

It mirrors the established architectural standards of:
- `MODULES/SUPER-ADMIN/BACKEND`
- `MODULES/HOSTEL-INCHARGE/BACKEND`
- `MODULES/ADMIN/BACKEND`

## 2. Directory Layout
```
MODULES/PARENT/BACKEND/
├── README.md               # Architecture & operational guide
├── API_CONTRACT.md         # API endpoints, payloads, permission matrix & gaps
├── handlers/               # HTTP Gin handlers & context helpers
│   ├── context_helper.go
│   ├── error_helper.go
│   ├── parent_handler.go
│   └── student_parent_handler.go
├── models/                 # Pure Go domain structs
│   └── parent.go
├── repository/             # Database access layer for app.parents & app.student_parents
│   ├── repository.go
│   ├── parent_repository.go
│   └── student_parent_repository.go
├── routes/                 # Route registrar
│   └── routes.go
├── services/               # Business logic, validation, quota checks, password hashing
│   ├── parent_service.go
│   └── student_parent_service.go
├── tests/                  # Unit tests
│   └── parent_test.go
└── validators/             # Request validation rules
    └── parent_validator.go
```

## 3. Database Schema Ownership
- `app.parents`: Stores parent profile records (names, contact info, address, optional `user_id` linkage).
- `app.student_parents`: Association table linking `app.students` to `app.parents` with relationship flags (`is_primary`, `can_receive_notifications`, `can_pickup_student`).
- `app.users`: User account credentials (email, password hash, status).
- `platform.user_roles`: Role assignment with `role_code = 'PARENT'` and `scope = 'COLLEGE'`.

## 4. Integration with Central Go API
The central API entry point resides at `API/cmd/server/main.go` and is configured via `API/internal/server/router.go`.
To register this module's endpoints, call:
```go
parentroutes.RegisterParentRoutes(collegeProtected, db, requireView, requireManage)
```
Existing endpoints inside `API/internal/server` remain operational to guarantee backward compatibility without regressions.

