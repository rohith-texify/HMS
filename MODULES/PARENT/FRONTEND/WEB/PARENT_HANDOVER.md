# Parent Frontend Handover

## 1. Final folder structure

`MODULES/PARENT/BACKEND` does not exist. The Parent module implementation in this handover is the frontend at `MODULES/PARENT/FRONTEND/WEB`.

```text
WEB/
|-- .env.example
|-- .eslintrc.cjs
|-- index.html
|-- package.json
|-- vercel.json
|-- vite.config.js
`-- src/
    |-- App.jsx
    |-- main.jsx
    |-- components/
    |   |-- PageBoundary.jsx
    |   |-- PageStates.jsx
    |   |-- ToastContext.js
    |   `-- ToastProvider.jsx
    |-- config/
    |   `-- navigation.js
    |-- hooks/
    |   |-- AuthContext.js
    |   |-- AuthProvider.jsx
    |   |-- useAuth.js
    |   `-- useToast.js
    |-- layouts/
    |   `-- AppLayout.jsx
    |-- pages/
    |   |-- DashboardPage.jsx
    |   |-- LoginPage.jsx
    |   |-- MessPage.jsx
    |   |-- NotFoundPage.jsx
    |   `-- NotificationsPage.jsx
    |-- routes/
    |   |-- AppRoutes.jsx
    |   `-- ProtectedRoute.jsx
    |-- services/
    |   |-- api.js
    |   |-- authService.js
    |   `-- parentService.js
    `-- styles/
        `-- main.css
```

The root configuration files provide the Vite app, lint/build settings, deployment routing, and environment-variable example. `src/components` contains local display states, a rendering error boundary, and toast UI/context. `src/hooks` contains Parent auth context/hooks and the toast hook. `src/config`, `src/layouts`, and `src/routes` define role-filtered navigation, the responsive shell, and lazy protected routes. `src/pages` contains the login, available feature pages, and not-found page. `src/services` contains the existing Parent auth/API integration and thin feature service. `src/styles` contains the Parent-local responsive styling.

## 2. Feature-to-page-to-API-to-permission mapping

Parent seed permissions, from `DATABASE/migrations/903_seed.sql`, are `hostel.view`, `movement.view`, `requests.view`, `support.view`, `communication.view`, and `meals.view`.

| Parent feature | Page / route | API endpoint(s) | Permission | Status |
|---|---|---|---|---|
| Dashboard | `DashboardPage.jsx`, `/dashboard` | `GET /college/notifications/unread-count`; `GET /college/notifications`; `GET /college/mess/today` | Notification reads have no explicit permission middleware and are user-scoped to the authenticated recipient. Mess requires `hostel.view`. | **BUILT** |
| Student Profile & Accommodation | No page or route | Student and bed-allocation endpoints were checked; see blockers below. | `people.view`, which Parent does not have. | **BLOCKED** |
| Attendance | No page or route | `GET /college/attendance/students`; `GET /college/attendance/students/:record_id`; `GET /college/attendance/reports/summary` | `people.view`, which Parent does not have. | **BLOCKED** |
| Leave | No page or route | `GET /college/leaves`; `GET /college/leaves/:leave_id`; action routes described below. | Read routes require `requests.view` (Parent has it). Create, cancel, and decision routes require `requests.manage` (Parent does not have it). | **BLOCKED** |
| Outing & Gate-Pass | No page or route | No outing or gate-pass endpoint found. | No route establishes a required permission. Parent has `movement.view`, but that does not supply a missing endpoint. | **BLOCKED** |
| Visitors & Parcels | No page or route | No visitor or parcel endpoint found. | No route establishes a required permission. Parent has `support.view`, but that does not supply missing endpoints. | **BLOCKED** |
| Complaints & Maintenance | No page or route | Complaint and maintenance endpoints described below. | Read permissions are present, but ownership checks are missing. Create/action permissions are unavailable to Parent. | **BLOCKED** |
| Mess | `MessPage.jsx`, `/mess` (today's menu only) | `GET /college/mess/today` | `hostel.view` (Parent has it). College-wide reference data; no student ownership check applies. | **BUILT** |
| Announcements & Notifications | `NotificationsPage.jsx`, `/notifications` | `GET /college/notifications`; `GET /college/notifications/unread-count`; `GET /college/notifications/:notification_id`; `PATCH /college/notifications/:notification_id/read` | No explicit permission middleware on these notification read/read-status routes; records are scoped to the authenticated recipient. | **BUILT** |
| Documents & Records | No page or route | No document API endpoint found. | No route establishes a required permission. `resources.view` is not in the Parent seed baseline. | **BLOCKED** |

Announcements are represented by notification records with `notification_type` equal to `ANNOUNCEMENT`; no separate announcements page or endpoint was added.

## 3. Reuse decisions and Parent-local components

- The existing Parent login and auth/session implementation is in `src/hooks/AuthContext.js`, `src/hooks/AuthProvider.jsx`, `src/hooks/useAuth.js`, and `src/services/authService.js`. It validates the `PARENT` role and `COLLEGE` scope, checks session expiry, and handles logout/session cleanup.
- The existing Parent Axios client in `src/services/api.js` is reused by `src/services/parentService.js`; no second API client or auth system was added.
- No components or services are imported from `PORTAL` or `SHARED`.
- Parent-local reusable components are `PageBoundary.jsx`, `PageStates.jsx` (loading, empty, error, success, unauthorized, and not-found states), `ToastContext.js`, and `ToastProvider.jsx`. `useToast.js` exposes the toast mechanism.
- Layout, route configuration, and navigation are Parent-local: `AppLayout.jsx`, `AppRoutes.jsx`, `ProtectedRoute.jsx`, and `navigation.js`.

## 4. Blockers, known limitations, and requested backend work

The API router is `API/internal/server/router.go`. Handlers and repositories cited below are under `API/internal/server` and `API/internal/repository`. All endpoint paths below are under the `/college` route group unless otherwise noted. Parent's seed baseline is the six permissions listed in section 2.

| Feature / action | Endpoint checked and required permission | Parent permission | Exact missing piece |
|---|---|---|---|
| Linked student profile | `GET /college/students` and `GET /college/students/:student_id`, requiring `people.view` | Does not have `people.view`. | These are not scoped to the authenticated Parent's linked students. No endpoint returns the students linked to the logged-in Parent. Do not use a caller-supplied student ID as an authorization substitute. |
| Accommodation | `GET /college/bed-allocations`, `/college/bed-allocations/current`, and `/college/bed-allocations/:allocation_id`, requiring `people.view` | Does not have `people.view`. | No Parent-linked-student ownership enforcement; read endpoints are college-scoped. |
| Attendance | `GET /college/attendance/students`, `/college/attendance/students/:record_id`, and `/college/attendance/reports/summary`, requiring `people.view` | Does not have `people.view`. | Missing permission and linked-student ownership enforcement. A list `student_id` filter is not authorization. |
| Leave reads and history | `GET /college/leaves` and `/college/leaves/:leave_id`, requiring `requests.view`; the list accepts an optional student filter. | Has `requests.view`. | List/detail are college-scoped, not Parent-linked-student-scoped. No leave approval-history read endpoint was found; leave detail does not provide that history. |
| Leave create | `POST /college/leaves`, requiring `requests.manage` | Does not have `requests.manage`. | Missing permission and linked-student ownership validation for the supplied student ID. |
| Leave cancel | `POST /college/leaves/:leave_id/cancel`, requiring `requests.manage` | Does not have `requests.manage`. | Missing permission and Parent-to-student/leave ownership check. |
| Leave decision/respond | `POST /college/leaves/:leave_id/decision`, requiring `requests.manage` | Does not have `requests.manage`. | Missing permission and Parent-to-student/leave ownership check. |
| Outing and gate-pass | No endpoint found. | Has `movement.view`; no route defines a required permission. | Implement the appropriate API contracts first, with Parent-linked-student ownership checks. |
| Visitors and parcels | No visitor or parcel endpoint found. | Has `support.view`; no route defines a required permission. | Implement the appropriate API contracts first, with Parent-linked-student ownership checks. |
| Complaint reads/history | `GET /college/complaints`, `/college/complaints/:complaint_id`, and `/college/complaints/:complaint_id/updates`, requiring `requests.view`. | Has `requests.view`. | List/detail/history are college-scoped; no Parent-to-student ownership check. |
| Raise complaint | `POST /college/complaints`, requiring `requests.manage`. | Does not have `requests.manage`. | Missing create permission and ownership validation for optional `student_id`. |
| Complaint status/actions | `PATCH /college/complaints/:complaint_id/status`, `/assign`, and `/resolve`, requiring `requests.manage`. | Does not have `requests.manage`. | Missing permission and Parent-to-student ownership checks. |
| Maintenance reads/status | `GET /college/maintenance` and `/college/maintenance/:maintenance_id`, requiring `hostel.view`. | Has `hostel.view`. | Records are college-scoped and room-based, not Parent-linked-student-scoped. No maintenance history route was found. |
| Raise/resolve maintenance | `POST /college/maintenance` and `PATCH /college/maintenance/:maintenance_id/resolve`, requiring `hostel.manage`. | Does not have `hostel.manage`. | Missing permission; requests are room-based and have no Parent-linked-student authorization. |
| Weekly menu and meal timings | `GET /college/hostels/:hostel_id/mess/menus` and `/college/hostels/:hostel_id/mess/timings`, requiring `hostel.view`; `GET /college/hostels` requires `people.view`. | Has `hostel.view`, but does not have `people.view`. | Weekly menu/timing routes require a hostel ID, and Parent cannot list hostels through the existing endpoint. No ID inference or client-side workaround is used. |
| Documents | No document API endpoint found. | `resources.view` is not in the Parent baseline; no route-defined requirement exists to verify. | Implement a document read endpoint with appropriate Parent authorization and ownership scope before adding a UI. |
| Notification pagination | `GET /college/notifications`; handler accepts `unread`, not `page` or `limit`. | No explicit permission middleware; user-scoped to authenticated recipient. | API returns an unpaginated list. Add server-side pagination/limit support if needed; the UI must not describe a locally sliced response as server-paginated. |

The today-menu route `GET /college/mess/today` is the available college-wide reference endpoint and is used by the existing page. It requires `hostel.view`.

### Requested backend work

1. Provide an authenticated endpoint that returns the students linked to the logged-in Parent, and reusable authorization checks that scope student-related list, detail, action, and history endpoints to those relationships.
2. Decide and seed the intended Parent permissions for profile/accommodation, attendance, leave reads/actions, complaints, maintenance, and any new movement, visitor, parcel, or document APIs. Parent currently lacks `people.view`, `requests.manage`, and `hostel.manage`.
3. Add Parent-scoped outing/gate-pass, visitor, parcel, and document read contracts; add leave approval-history and maintenance history read routes.
4. Provide a Parent-usable way to select/list hostels for the existing weekly-menu/timing reads, or expose suitable college-wide read endpoints.
5. Add server-side pagination parameters and response metadata to notifications if pagination is required.

## 5. Build and development instructions

Run commands from the repository root:

```powershell
npm install --workspace=MODULES/PARENT/FRONTEND/WEB
npm run dev --workspace=MODULES/PARENT/FRONTEND/WEB
npm run lint --workspace=MODULES/PARENT/FRONTEND/WEB
npm run build --workspace=MODULES/PARENT/FRONTEND/WEB
```

The Parent `.env.example` declares `VITE_API_BASE_URL`. The API client also reads `VITE_API_URL` as a fallback in code. Configure variable names as needed for the environment; no environment values are included here.

## 6. Release checklist

| Item | Status | Notes |
|---|---|---|
| Parent workspace lint | **DONE** | Batch 08: `npm run lint --workspace=MODULES/PARENT/FRONTEND/WEB` passed. |
| Parent workspace build | **DONE** | Batch 08: `npm run build --workspace=MODULES/PARENT/FRONTEND/WEB` passed; generated `dist` was removed. |
| No files outside the Parent folder changed | **DONE** | Batch 08 diff check against `main` found no changed paths outside `MODULES/PARENT/FRONTEND/WEB`. |
| No mock/test/sample data added | **DONE** | No such data was added in the Parent implementation batches. |
| Live login using a valid existing Parent account | **NOT DONE** | No valid Parent account was available; no account or credential was created. |
| npm audit review | **NOT DONE** | 7 vulnerabilities were reported; they were not fixed as part of the constrained batches. |
| `prop-types` declared in Parent `package.json` | **DONE** | Present in the Parent workspace dependencies. |
| Production readiness / bug-free status | **NOT CLAIMED** | Live login/data checks remain unavailable and API blockers remain. |

## 7. Implementation file location

Every Parent implementation file is already under `MODULES/PARENT/FRONTEND/WEB`. No relocation is needed. The separate `MODULES/PARENT/BACKEND` directory does not exist.
