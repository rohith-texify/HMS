# College Admin Backend Module
## `MODULES/ADMIN/BACKEND`

Architecture, services, handlers, and repository layer for the College Administration module of the Hostel Management System (HMS), designed with exact symmetry to the Super-Admin module (`MODULES/SUPER-ADMIN/BACKEND`).

---

## 1. Module Structure

```
MODULES/ADMIN/BACKEND/
├── docs/          # Architecture and design documentation
├── handlers/      # Gin HTTP request handlers
├── models/        # Go structs for college domain entities
├── repository/    # PostgreSQL data access layer
├── routes/        # routes.go with RegisterCollegeAdminRoutes
├── services/      # Business logic services
└── validators/    # Input and UUID validation helpers
```

---

## 2. Integration with Core API

The College Admin module registers its route hierarchy through:
```go
import adminroutes "github.com/yourusername/hostel-management-system/MODULES/ADMIN/BACKEND/routes"

adminroutes.RegisterCollegeAdminRoutes(
    collegeProtected,
    db,
    permissionMiddleware.RequirePermission("people.view"),
    permissionMiddleware.RequirePermission("people.manage"),
)
```

---

## 3. Scope Isolation & Multi-Tenancy

- **Mandatory Scope:** `COLLEGE`
- **Tenant Context:** Derived automatically from JWT claims (`membership.college_id`).
- **Database Connection:** Uses `db.CollegePool` with Row-Level Security (RLS) enforcement.
