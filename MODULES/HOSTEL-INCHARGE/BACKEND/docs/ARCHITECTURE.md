# HOSTEL_INCHARGE — Backend Architecture Specification

## Overview
The `HOSTEL-INCHARGE/BACKEND` module provides a decoupled, modular domain package supporting all residential management operations for assigned hostel in-charges and wardens.

It mirrors the architectural structure of `MODULES/SUPER-ADMIN/BACKEND` and `MODULES/ADMIN/BACKEND`.

---

## Directory Layout

```
D:\HMS\MODULES\HOSTEL-INCHARGE\BACKEND
├── docs/
│   └── ARCHITECTURE.md          # Architecture & API specification
├── handlers/
│   ├── context_helper.go        # Tenant and user authentication context resolution
│   ├── error_helper.go          # Consistent API error mapping
│   └── handlers.go              # Incharge HTTP handlers with canonical response payloads
├── models/
│   └── models.go                # Domain DTOs, inputs, and response models
├── repository/
│   ├── repository.go            # Multi-tenant DB connection pool & transaction manager
│   └── incharge_repository.go   # Scoped SQL queries for assigned hostel & residents
├── routes/
│   └── routes.go                # RegisterHostelInchargeRoutes routing registrar
└── validators/
    └── validator.go             # Request payload & UUID validation helpers
```

---

## Registered Endpoints

Base path: `/college/incharges`

| Method | Endpoint | Permission | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/status` | `people.view` | Module operational status check |
| `GET` | `/my-hostel` | `people.view` | Verified assigned hostel profile for incharge |
| `GET` | `/my-hostel/residents` | `people.view` | Filtered list of enrolled hostel residents |
| `GET` | `/my-hostel/vacant-beds`| `people.view` | List of unoccupied available beds |
| `GET` | `/unallocated-students`| `people.view` | Enrolled students awaiting hostel placement |
| `GET` | `/dashboard/summary` | `people.view` | Live occupancy, roll-call & complaint aggregates |
| `POST`| `/create-account` | `people.manage` | Atomic staff creation and incharge assignment |

---

## API Clean Registration

In `API/internal/server/router.go`, the module is registered via:

```go
inchargeroutes.RegisterHostelInchargeRoutes(
    collegeProtected,
    db,
    permissionMiddleware.RequirePermission("people.view"),
    permissionMiddleware.RequirePermission("people.manage"),
)
```

