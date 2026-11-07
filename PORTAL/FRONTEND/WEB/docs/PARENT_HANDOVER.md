# Parent Portal Handover

## Canonical application

The Parent portal is integrated into the unified institutional frontend:

```text
PORTAL/FRONTEND/WEB/
`-- src/
    |-- modules/parent/
    |   |-- pages/
    |   `-- services/parentService.js
    |-- shared/auth/
    |-- shared/routing/
    `-- shared/api/
```

Run the unified portal from the repository root with:

```powershell
npm --prefix PORTAL\FRONTEND\WEB run dev
```

Vite serves it at `http://localhost:5173`. Parent users sign in at `/parent/login`; this route uses the shared `AuthProvider` and login service, stores the shared session, and sends authenticated `PARENT` users with `COLLEGE` scope to `/parent/dashboard`.

## Parent frontend features

| Route | Feature | API |
|---|---|---|
| `/parent/dashboard` | Account overview, unread and recent notifications, today’s menu | Notifications and today’s mess menu |
| `/parent/notifications` | Recipient notifications and mark-as-read | `/college/notifications`, `/college/notifications/:id/read` |
| `/parent/mess` | College-wide today’s menu | `/college/mess/today` |

Student profile and leave-history routes show an unavailable state until the backend can enforce Parent-to-student ownership. The Parent UI must not call the existing college-wide student or leave list/detail endpoints as a substitute for that authorization.

## Backend location

There is no isolated Parent backend. Backend code remains in the shared Go API because handlers, services, repositories, and routes are wired into shared Go packages and the central router:

- Routes: `API/internal/server/router.go`
- Notifications: `API/internal/server/notification_handler.go`, `API/internal/repository/notification_repository.go`
- Mess: `API/internal/server/mess_handler.go`, `API/internal/repository/mess_repository.go`
- Parent profile administration: `API/internal/server/people_parent_handler.go`, `API/internal/service/people_parent_service.go`, `API/internal/repository/people_parent_repository.go`

Parent profile CRUD is administrative functionality; it is not a self-service Parent portal API. Do not copy shared API files into a second backend tree because that would duplicate code and break the existing package and router wiring.

Before adding student-linked Parent features, provide server-side ownership checks derived from the authenticated Parent-to-student relationship. Do not authorize access based on a client-supplied student ID or a college-wide role permission alone.

## Validation

Run the Parent portal build from the repository root:

```powershell
npm --prefix PORTAL\FRONTEND\WEB run build
```

The former standalone app under `MODULES/PARENT/FRONTEND/WEB` has been retired; use the unified portal for development and deployment.
