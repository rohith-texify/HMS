# HOSTEL_INCHARGE — RELEASE READINESS, ARCHITECTURE DOCUMENTATION & HANDOVER PACKAGE
**Phase:** Module Finalization & Governance Handover  
**Module Name:** `HOSTEL_INCHARGE`  
**Permanent Location:** `D:\HMS\MODULES\HOSTEL-INCHARGE`  
**Frontend Root:** `D:\HMS\MODULES\HOSTEL-INCHARGE\FRONTEND\WEB`  
**Backend Reference Boundary:** Unified Go Backend API (`D:\HMS\API\internal\...` and `D:\HMS\MODULES\ADMIN\BACKEND`)  
**Scope Authority:** Role `HOSTEL_INCHARGE` (and verified alias `INCHARGE`), Scope `COLLEGE`, Assigned Hostel ID (`hostel_id`)

---

## 1. Architecture Overview

The `HOSTEL_INCHARGE` module serves as the dedicated operational terminal for residential hostel supervisors and in-charge staff within the Hostel Management System (HMS). It operates strictly within the institutional college tenant scope (`COLLEGE`) and enforces assigned-hostel physical boundaries.

### Architectural Core Principles
1. **Decoupled Frontend / Unified Backend**: The module frontend is a self-contained, enterprise-grade Single Page Application (SPA) built with React 18 and Vite. It consumes backend services provided by the central Go API server (`API/internal/server`) and the College Admin domain services (`MODULES/ADMIN/BACKEND`).
2. **Authority Inversion**: The frontend never acts as the security boundary. Authentication, RBAC (Role-Based Access Control), tenant boundary isolation, and hostel resource scoping are authoritatively verified on every request by backend middleware and database row-level security (RLS).
3. **No Standalone Backend Directory**: In contrast to multi-service designs, the Hostel In-Charge does not maintain a parallel, disconnected backend. Operations are serviced directly by the unified Go API using `COLLEGE` scope claims and assigned hostel filters (`hostel_id`).
4. **Honest Boundary Enforcement**: Workspaces whose backend services are currently incomplete (e.g. binary document storage, centralized audit query APIs, real-time IoT SOS hardware) operate strictly in verified reference-directory mode with clear, user-facing boundary notices.

---

## 2. Permanent Folder Structure

Discovered physical structure of `D:\HMS\MODULES\HOSTEL-INCHARGE`:

```text
D:\HMS\MODULES\HOSTEL-INCHARGE\
│
├── docs\
│   └── RELEASE_HANDOVER_PACKAGE.md         # Canonical module handover documentation
│
└── FRONTEND\
    └── WEB\
        ├── .env.example                    # Environment variable template
        ├── .eslintrc.cjs                   # ESLint enterprise rule configuration
        ├── index.html                      # Single page application HTML host
        ├── package.json                    # Dependencies, scripts, and build targets
        ├── postcss.config.js               # PostCSS styling pipeline
        ├── tailwind.config.js              # Tailwind utility design tokens
        ├── vite.config.js                  # Vite bundler, proxy & path alias config
        │
        └── src\
            ├── main.jsx                    # React root bootstrap entrypoint
            ├── App.jsx                     # Root application container & providers
            │
            ├── app\
            │   └── ErrorBoundary.jsx       # Global unhandled crash & fault isolator
            │
            ├── components\
            │   ├── Alert.jsx               # Institutional alert boxes
            │   ├── Badge.jsx               # Color-coded status & priority chips
            │   ├── Button.jsx              # Accessible button with loading locks
            │   ├── Card.jsx                # Layout cards & stat cards
            │   ├── ConfirmationDialog.jsx  # Double-confirmation mutation dialogs
            │   ├── DataTable.jsx           # Responsive paginated table
            │   ├── EmptyState.jsx          # Context-rich fallback graphics
            │   ├── ErrorState.jsx          # Network & API failure displays with retry
            │   ├── FilterControls.jsx      # Filter toolbar wrapper
            │   ├── FormField.jsx           # Form label and error container
            │   ├── index.js                # Common component export index
            │   ├── LoadingSpinner.jsx      # Centered institutional loader
            │   ├── LoadingState.jsx        # Skeleton loader during data fetching
            │   ├── Modal.jsx               # Accessible dialog with keyboard trapping
            │   ├── NotFoundState.jsx       # Missing resource component
            │   ├── NotificationDisplay.jsx # Bell dropdown notification panel
            │   ├── PageHeader.jsx          # Standardized breadcrumb & title banner
            │   ├── SearchInput.jsx         # 300 ms debounced search input
            │   └── UnauthorizedState.jsx   # Access forbidden state container
            │
            ├── constants\
            │   ├── permissions.js          # Canonical permission keys
            │   └── routes.js               # Canonical URL routing paths
            │
            ├── hooks\
            │   ├── AuthContext.jsx         # React context for auth credentials
            │   ├── AuthProvider.jsx        # Context provider with token handling
            │   ├── useAuth.js              # Hook for authentication context
            │   └── usePermissions.js       # Hook for RBAC permission evaluations
            │
            ├── layouts\
            │   ├── InchargeLayout.jsx      # Main layout with responsive sidebar
            │   └── inchargeNavigation.js   # RBAC-filtered navigation configuration
            │
            ├── pages\
            │   ├── AllocationsPage.jsx     # Batch 05: Room & Bed Allocations
            │   ├── AnnouncementsPage.jsx   # Batch 10: Notices & Broadcasts
            │   ├── AttendancePage.jsx      # Batch 06: Curfew & Roll Call
            │   ├── AuditLogPage.jsx        # Batch 11: Governance & Activity Trail
            │   ├── ComplaintsPage.jsx      # Batch 09: Grievance Resolution
            │   ├── DashboardPage.jsx       # Batch 02: Operational Dashboard
            │   ├── DocumentsPage.jsx       # Batch 11: Resident Document Registry
            │   ├── GatePassesPage.jsx      # Batch 07: Movement & Gate Passes
            │   ├── HostelOverviewPage.jsx  # Batch 04: Facility Structure Hierarchy
            │   ├── LeavesPage.jsx          # Batch 07: Student Leave Applications
            │   ├── LoginPage.jsx           # Batch 01: Incharge Authentication
            │   ├── MaintenancePage.jsx     # Batch 09: Work Orders & Repairs
            │   ├── MessPage.jsx            # Batch 10: Dining Menus & Timings
            │   ├── NotFoundPage.jsx        # 404 Route Not Found
            │   ├── ParcelsPage.jsx         # Batch 08: Parcel Recipient Verification
            │   ├── ReportsPage.jsx         # Batch 11: Authoritative Analytics & Reports
            │   ├── RoomsPage.jsx           # Batch 04: Room Inventory & Bed Grid
            │   ├── SOSPage.jsx             # Batch 08: Emergency Contact Directory
            │   ├── StudentsPage.jsx        # Batch 03: Resident Student Directory
            │   ├── UnauthorizedPage.jsx    # 403 Access Denied
            │   └── VisitorsPage.jsx        # Batch 08: Resident Parent/Guardian Directory
            │
            ├── routes\
            │   ├── AppRoutes.jsx           # Master route declarations & lazy loading
            │   ├── PermissionRoute.jsx     # Route-level RBAC guard
            │   └── ProtectedRoute.jsx      # Session & role access guard
            │
            ├── services\
            │   ├── api.js                  # Axios client with interceptors
            │   ├── authService.js          # Authentication service wrapper
            │   └── inchargeService.js      # Comprehensive domain API service layer
            │
            ├── styles\
            │   ├── index.css               # Global baseline stylesheet
            │   ├── layout.css              # Grid, sidebar & responsive utilities
            │   └── portal.css              # Component-specific styles
            │
            └── utils\
                ├── exportUtils.js          # RFC 4180 CSV export with UTF-8 BOM & print
                └── formatUtils.js          # Date, currency & phone formatters
```

---

## 3. File Ownership & Responsibility Map

| File / Group | Module Ownership | Responsibility & Scope |
|---|---|---|
| `src/services/api.js` | Module Owned | Configures the central Axios HTTP client, injects `Bearer <token>` and `X-Scope: COLLEGE` headers, normalizes response envelopes, and intercepts 401 Unauthorized responses to trigger clean session termination. |
| `src/services/authService.js` | Module Owned | Authenticates credentials against `POST /auth/login`, enforces role boundary (`HOSTEL_INCHARGE` / `INCHARGE`), and synchronizes token and user profile into web storage. |
| `src/services/inchargeService.js` | Module Owned | Centralized API client mapping all 50+ backend endpoints across hostels, rooms, allocations, attendance, leaves, complaints, maintenance, mess, notifications, reports, and student profiles. |
| `src/routes/AppRoutes.jsx` | Module Owned | Master React Router v6 tree with code-splitting lazy imports (`React.lazy`), wrapping routes with `ProtectedRoute` and `PermissionRoute`. |
| `src/layouts/InchargeLayout.jsx` | Module Owned | Implements the responsive institutional layout, dynamic role-based navigation sidebar, header profile display, and unread notification drawer. |
| `src/pages/*.jsx` (21 pages) | Module Owned | Full suite of daily hostel management interfaces covering Batches 01 through 11. |
| `src/utils/exportUtils.js` | Module Owned / Shared Pattern | Implements client-side RFC 4180 compliant CSV serialization with UTF-8 Byte Order Mark (`\uFEFF`) and browser print formatting. |

---

## 4. Feature Coverage Matrix (Feature → Page → API → Permission)

| Feature Area | Route | Main Page | API Endpoint | Method | Required Permission | Required Scope | Mutation Supported | Status |
|---|---|---|---|---|---|---|---|---|
| **Authentication** | `/login` | `LoginPage.jsx` | `/auth/login` | `POST` | None (Public) | Global | Yes | `VERIFIED` |
| **Dashboard** | `/dashboard` | `DashboardPage.jsx` | `/college/incharges/my-hostel`<br>`/college/incharges/my-hostel/residents`<br>`/college/complaints/reports/summary`<br>`/college/leaves/reports/summary` | `GET` | `hostel.view`<br>`requests.view` | `COLLEGE` (Assigned Hostel) | No | `VERIFIED` |
| **Residents Directory** | `/students` | `StudentsPage.jsx` | `/college/incharges/my-hostel/residents`<br>`/college/students/:id`<br>`/college/students/:id/parents` | `GET` | `people.view` | `COLLEGE` (Assigned Hostel) | No | `VERIFIED` |
| **Hostel Structure** | `/hostel` | `HostelOverviewPage.jsx` | `/college/incharges/my-hostel`<br>`/college/hostels/:id/blocks`<br>`/college/hostels/:id/blocks/:id/floors` | `GET` | `hostel.view` | `COLLEGE` (Assigned Hostel) | No | `VERIFIED` |
| **Rooms & Beds** | `/rooms` | `RoomsPage.jsx` | `/college/hostels/:id/blocks/:id/floors/:id/rooms`<br>`/college/hostels/:id/.../rooms/:id/beds`<br>`/college/hostels/:id/rooms/:id/status`<br>`/college/hostels/:id/beds/:id/status` | `GET`<br>`GET`<br>`PATCH`<br>`PATCH` | `hostel.view`<br>`hostel.view`<br>`hostel.manage`<br>`hostel.manage` | `COLLEGE` (Assigned Hostel) | Yes | `VERIFIED` |
| **Bed Allocations** | `/allocations` | `AllocationsPage.jsx` | `/college/bed-allocations`<br>`/college/bed-allocations/current`<br>`/college/bed-allocations`<br>`/college/bed-allocations/transfer`<br>`/college/bed-allocations/release`<br>`/college/incharges/unallocated-students` | `GET`<br>`GET`<br>`POST`<br>`POST`<br>`POST`<br>`GET` | `hostel.view`<br>`hostel.view`<br>`hostel.manage`<br>`hostel.manage`<br>`hostel.manage`<br>`hostel.view` | `COLLEGE` (Assigned Hostel) | Yes | `VERIFIED` |
| **Attendance Roll Call** | `/attendance` | `AttendancePage.jsx` | `/college/attendance/students`<br>`/college/attendance/mark`<br>`/college/attendance/bulk`<br>`/college/attendance/reports/summary`<br>`/college/attendance/corrections` | `GET`<br>`POST`<br>`POST`<br>`GET`<br>`POST` | `people.view`<br>`people.manage`<br>`people.manage`<br>`people.view`<br>`people.manage` | `COLLEGE` (Assigned Hostel) | Yes | `VERIFIED` |
| **Leaves & Movements** | `/leaves` | `LeavesPage.jsx` | `/college/leaves`<br>`/college/leaves/:id`<br>`/college/leaves/:id/decision`<br>`/college/leaves/reports/summary` | `GET`<br>`GET`<br>`POST`<br>`GET` | `requests.view`<br>`requests.view`<br>`requests.manage`<br>`requests.view` | `COLLEGE` (Assigned Hostel) | Yes | `VERIFIED` |
| **Gate Passes** | `/gate-passes` | `GatePassesPage.jsx` | `/college/leaves`<br>`/college/leaves/:id` | `GET` | `movement.view` | `COLLEGE` (Assigned Hostel) | No | `VERIFIED` |
| **Visitors Directory** | `/visitors` | `VisitorsPage.jsx` | `/college/incharges/my-hostel/residents`<br>`/college/students/:id/parents` | `GET` | `requests.view`<br>`people.view` | `COLLEGE` (Assigned Hostel) | No | `API-LIMITED` |
| **Parcel Verification** | `/parcels` | `ParcelsPage.jsx` | `/college/incharges/my-hostel/residents`<br>`/college/gates`<br>`/college/security-assignments` | `GET` | `requests.view`<br>`staff.view` | `COLLEGE` (Assigned Hostel) | No | `API-LIMITED` |
| **SOS & Emergency** | `/emergency` | `SOSPage.jsx` | `/college/incharges/my-hostel/residents`<br>`/college/students/:id/emergency-contacts`<br>`/college/staff` | `GET` | `people.view`<br>`staff.view` | `COLLEGE` (Assigned Hostel) | No | `API-LIMITED` |
| **Complaints & Grievances** | `/complaints` | `ComplaintsPage.jsx` | `/college/complaints`<br>`/college/complaints/:id`<br>`/college/complaints`<br>`/college/complaints/:id/status`<br>`/college/complaints/:id/resolve`<br>`/college/complaints/:id/assign`<br>`/college/complaints/:id/updates`<br>`/college/complaints/reports/summary` | `GET`<br>`GET`<br>`POST`<br>`PATCH`<br>`PATCH`<br>`PATCH`<br>`GET`<br>`GET` | `requests.view`<br>`requests.view`<br>`requests.manage`<br>`requests.manage`<br>`requests.manage`<br>`requests.manage`<br>`requests.view`<br>`requests.view` | `COLLEGE` | Yes | `VERIFIED` |
| **Maintenance Orders** | `/maintenance` | `MaintenancePage.jsx` | `/college/maintenance`<br>`/college/maintenance/:id`<br>`/college/maintenance`<br>`/college/maintenance/:id/resolve` | `GET`<br>`GET`<br>`POST`<br>`PATCH` | `hostel.view`<br>`hostel.view`<br>`hostel.manage`<br>`hostel.manage` | `COLLEGE` (Assigned Hostel) | Yes | `VERIFIED` |
| **Mess & Dining Menus** | `/mess` | `MessPage.jsx` | `/college/mess/today`<br>`/college/hostels/:id/mess/menus`<br>`/college/hostels/:id/mess/menus`<br>`/college/hostels/:id/mess/timings`<br>`/college/hostels/:id/mess/timings`<br>`/college/mess/feedback` | `GET`<br>`GET`<br>`POST`<br>`GET`<br>`POST`<br>`POST` | `hostel.view`<br>`hostel.view`<br>`hostel.manage`<br>`hostel.view`<br>`hostel.manage`<br>`hostel.view` | `COLLEGE` (Assigned Hostel) | Yes | `VERIFIED` |
| **Announcements** | `/announcements` | `AnnouncementsPage.jsx` | `/college/notifications`<br>`/college/notifications/unread-count`<br>`/college/notifications`<br>`/college/notifications/:id/read`<br>`/college/notifications/read-all` | `GET`<br>`GET`<br>`POST`<br>`PATCH`<br>`PATCH` | Authenticated<br>Authenticated<br>`hostel.manage`<br>Authenticated<br>Authenticated | `COLLEGE` | Yes | `VERIFIED` |
| **Documents Registry** | `/documents` | `DocumentsPage.jsx` | `/college/incharges/my-hostel/residents`<br>`/college/students/:id` | `GET` | `people.view` | `COLLEGE` (Assigned Hostel) | No | `API-LIMITED` |
| **Reports & Analytics** | `/reports` | `ReportsPage.jsx` | `/college/reports/overview`<br>`/college/reports/occupancy`<br>`/college/reports/students`<br>`/college/reports/allocations`<br>`/college/reports/attendance`<br>`/college/reports/leave`<br>`/college/reports/complaints`<br>`/college/reports/maintenance`<br>`/college/reports/staff` | `GET` | `reports.view`<br>(with domain summary fallbacks) | `COLLEGE` | No | `VERIFIED` |
| **Activity Trail** | `/audit` | `AuditLogPage.jsx` | `/college/notifications`<br>`/college/complaints/:id/updates` | `GET` | Authenticated<br>`requests.view` | `COLLEGE` | No | `API-LIMITED` |

---

## 5. Authentication & Role Architecture

1. **Authentication Handshake**:
   - The user submits email and password to `/auth/login`.
   - The response delivers a JWT `access_token`, `user_id`, and `membership` object.
   - The frontend validates that `membership.role_code` is strictly `HOSTEL_INCHARGE` (or the recognized database alias `INCHARGE`). Unrelated roles (e.g. `SUPER_ADMIN`, `COLLEGE_ADMIN`, `SECURITY`, `STUDENT`) are rejected at the login gateway.
2. **Session Persistence**:
   - Tokens are stored in `localStorage` (if "Remember Me" is selected) or `sessionStorage`.
   - The Axios client automatically injects `Authorization: Bearer <token>` and `X-Scope: COLLEGE` on every outbound request.
3. **Session Expiration & Invalidation**:
   - A 401 Unauthorized response from any endpoint automatically clears web storage and redirects the browser to `/login`.
4. **Assigned Hostel Resolution**:
   - Upon authentication, the frontend invokes `GET /college/incharges/my-hostel` to resolve the authoritative `hostel_id` and hostel metadata from the server.
   - The resolved hostel is stored in `AuthContext` and passed to scoped child routes.

---

## 6. Permission Matrix & Enforcement Hierarchy

The system implements a four-tiered authorization model:
1. **Navigation Tier**: `inchargeNavigation.js` evaluates the user's permissions array via `getFilteredNavigation()`. Menu items for unassigned permissions are omitted.
2. **Route Tier**: `ProtectedRoute.jsx` verifies active session and role membership (`HOSTEL_INCHARGE`). `PermissionRoute.jsx` evaluates required permission tokens (e.g. `hostel.manage`) before mounting page components.
3. **UI Action Tier**: Mutation controls (e.g. *Publish Menu*, *Release Bed*, *Mark Attendance*) check `usePermissions().hasPermission()` to disable or suppress action triggers.
4. **Backend Authoritative Tier**: The Go API middleware (`RequirePermission`) and PostgreSQL RLS policies independently enforce authorization on every request, ensuring frontend bypass attempts fail with 403 Forbidden.

| Permission Code | Verified Backend Usage | Frontend Pages & Actions Governed |
|---|---|---|
| `hostel.view` | `API/internal/server/router.go` | Dashboard, Hostel Overview, Rooms/Beds viewing, Mess schedule inspection. |
| `hostel.manage` | `API/internal/server/router.go` | Room/Bed status changes, Bed allocation/transfer/release, Menu publishing, Timings configuration, Maintenance ticket resolution. |
| `people.view` | `API/internal/server/router.go` | Student profiles, Parent/Guardian contacts, Emergency contacts, Document verification registry. |
| `people.manage` | `API/internal/server/router.go` | Curfew attendance marking, Bulk attendance submission, Attendance correction filing. |
| `movement.view` | `API/internal/server/router.go` | Attendance records inspection, Outing & gate pass tracking. |
| `requests.view` | `API/internal/server/router.go` | Leave request listing, Complaint inspection, Resolution update history. |
| `requests.manage` | `API/internal/server/router.go` | Leave request approval/rejection decision, Complaint logging, Complaint resolution, Complaint technician assignment. |
| `reports.view` | `API/internal/server/router.go` | Access to authoritative server-side aggregate reports (`/college/reports/*`). |

---

## 7. College Admin Provisioning Boundary

The boundary between `COLLEGE_ADMIN` and `HOSTEL_INCHARGE` is strictly maintained:
- **College Admin (Provisioning Authority)**:
  - Creates and manages staff user accounts.
  - Assigns staff to the `HOSTEL_INCHARGE` role in `platform.user_roles`.
  - Links the user to a specific hostel in `app.hostel_incharges`.
  - Manages building physical structures (creating hostels, blocks, floors, rooms, and beds).
- **Hostel In-Charge (Operational Consumer)**:
  - Cannot create user accounts or assign credentials.
  - Cannot create new hostels, blocks, or floors.
  - Operates exclusively within the pre-provisioned hostel structure assigned by College Administration.

---

## 8. Component Reuse & Origin Map

| Component | Physical Path | Origin & Classification |
|---|---|---|
| `PageHeader` | `src/components/PageHeader.jsx` | `HOSTEL-INCHARGE OWNED` (Symmetrically modeled on College Admin pattern) |
| `DataTable` | `src/components/DataTable.jsx` | `HOSTEL-INCHARGE OWNED` (Standardized responsive table) |
| `SearchInput` | `src/components/SearchInput.jsx` | `HOSTEL-INCHARGE OWNED` (Debounced 300 ms text input) |
| `Badge` | `src/components/Badge.jsx` | `HOSTEL-INCHARGE OWNED` (Consistent institutional status pills) |
| `Button` | `src/components/Button.jsx` | `HOSTEL-INCHARGE OWNED` (Loading lockable action buttons) |
| `Modal` | `src/components/Modal.jsx` | `HOSTEL-INCHARGE OWNED` (Accessible dialog with escape key & blur) |
| `LoadingState` / `ErrorState` / `EmptyState` | `src/components/*.jsx` | `HOSTEL-INCHARGE OWNED` (Cohesive feedback primitives) |
| `exportUtils` | `src/utils/exportUtils.js` | `UTILITY` (RFC 4180 CSV serializer with UTF-8 BOM & browser print) |

---

## 9. API Coverage & Integration Boundary Summary

| Domain | Total Endpoints Consumed | Verified Complete | API-Limited | Unsupported |
|---|---|---|---|---|
| **Authentication & Profile** | 2 | 2 | 0 | 0 |
| **Hostel & Physical Structure** | 7 | 7 | 0 | 0 |
| **Allocations & Movement** | 6 | 6 | 0 | 0 |
| **Attendance & Curfew** | 5 | 5 | 0 | 0 |
| **Leaves & Gate Passes** | 5 | 5 | 0 | 0 |
| **Visitors & Parents** | 2 | 0 | 2 | 0 |
| **Parcels & Gate Security** | 3 | 0 | 3 | 0 |
| **SOS & Emergency Contacts** | 3 | 0 | 3 | 0 |
| **Complaints & Grievances** | 8 | 8 | 0 | 0 |
| **Maintenance Work Orders** | 4 | 4 | 0 | 0 |
| **Mess & Dining** | 6 | 5 | 1 (`GET /feedback`) | 0 |
| **Notifications & Notices** | 5 | 5 | 0 | 0 |
| **Documents Registry** | 2 | 0 | 2 | 0 |
| **Reports & Analytics** | 9 | 9 | 0 | 0 |
| **Audit & Activity Trail** | 2 | 0 | 2 | 0 |

---

## 10. Authoritative Report Coverage

All analytics presented on `/reports` derive from server-side database aggregate queries (`/college/reports/*`) and domain summary views:
1. **Hostel Occupancy & Capacity Utilization**: Sourced from `/college/reports/occupancy` (total beds, occupied beds, vacant beds, occupancy percentage).
2. **Daily Curfew & Attendance Distribution**: Sourced from `/college/reports/attendance` and `/college/attendance/reports/summary` (present, absent, late, on-leave counts).
3. **Resident Leave & Movement Distribution**: Sourced from `/college/reports/leave` and `/college/leaves/reports/summary` (pending, approved, rejected, cancelled counts).
4. **Complaints & Maintenance SLAs**: Sourced from `/college/reports/complaints` and `/college/reports/maintenance` (open, in progress, resolved, closed).
5. **Bed Allocation Velocity**: Sourced from `/college/reports/allocations` (cumulative allocated vs released bed counts).

---

## 11. Export Capability Matrix

| Export Type | Technology | File Format | Scope / Dataset | Authoritative Data Source |
|---|---|---|---|---|
| **Resident Directory Export** | Client-Side RFC 4180 | `.csv` (UTF-8 BOM) | Filtered Active Roster | `GET /college/incharges/my-hostel/residents` |
| **Complaints Export** | Client-Side RFC 4180 | `.csv` (UTF-8 BOM) | Filtered Complaints List | `GET /college/complaints` |
| **Maintenance Export** | Client-Side RFC 4180 | `.csv` (UTF-8 BOM) | Filtered Maintenance List | `GET /college/maintenance` |
| **Occupancy Report Export** | Client-Side RFC 4180 | `.csv` (UTF-8 BOM) | Full Facility Capacity Table | `GET /college/reports/occupancy` |
| **Attendance Report Export** | Client-Side RFC 4180 | `.csv` (UTF-8 BOM) | Aggregate Curfew Breakdown | `GET /college/reports/attendance` |
| **Leave Report Export** | Client-Side RFC 4180 | `.csv` (UTF-8 BOM) | Aggregate Leave Breakdown | `GET /college/reports/leave` |
| **Printable Report View** | Browser Native Print | PDF / Paper | Formatted Active Report | Clean Print Stylesheet via `triggerPrintReport` |
| **Server-Side Binary PDF/Excel** | N/A | `.pdf` / `.xlsx` | None | **Unsupported by Backend** (Microservice absent) |

---

## 12. Unsupported Capability Register

| Feature / Workspace | Missing Backend Dependency | Architectural Evidence | Current Frontend Implementation |
|---|---|---|---|
| **Document File Storage** | `POST /college/documents/upload`<br>`GET /college/documents/:id/download` | No document tables in `DATABASE` and no upload/download routes in `API/internal/server/router.go`. | Operates as a resident onboarding document compliance registry with an explicit integration boundary alert. |
| **Centralized College Audit Log** | `GET /college/audit-logs` | `platform.audit_logs` is restricted to Super Admin with `PLATFORM` scope via `/platform/reports/activity`. | Operates as an activity trail showing real notification dispatch logs and complaint transition update histories. |
| **Operational Visitor Registration** | `POST /college/visitors`<br>`PATCH /college/visitors/:id/checkout` | No visitor registration routes exist in `API/internal/server/router.go`. | Operates as a verified Resident Parent/Guardian Contact Directory. |
| **Operational Parcel Intake** | `POST /college/parcels`<br>`PATCH /college/parcels/:id/deliver` | No parcel management routes exist in `API/internal/server/router.go`. | Operates as a verified Parcel Recipient Verification Directory linked to security gate assignments. |
| **Real-Time SOS Alarm Ingestion** | IoT webhook / push event bus | No panic button IoT ingestion routes exist in `API/internal/server/router.go`. | Operates as an Emergency Contact & Institutional Duty Desk Escalation Directory. |
| **Server-Side PDF/Excel Exporters** | Go binary export handlers (`github.com/jung-kurt/gofpdf` or `excelize`) | No binary export handlers exist in `API/internal/server/report_handler.go`. | Replaced by client-side RFC 4180 CSV export with UTF-8 BOM and browser print formatting. |

---

## 13. Deferred Work Register

| Deferred Feature | Reason for Deferral | Backend Dependency Required | Frontend Readiness | Priority |
|---|---|---|---|---|
| **Electronic KYC File Upload** | Binary cloud storage layer not provisioned in backend architecture. | S3/GCS or local persistent volume blob handler + `app.documents` table. | Dossier UI ready; requires file picker input when endpoint arrives. | Medium |
| **Turnstile Gate Scan Events** | Belongs exclusively to Security module hardware integration. | Hardware gate access event stream API. | UI currently surfaces approved gate passes cleanly. | Low |
| **Multi-Hostel Supervision** | Persona is strictly single assigned hostel in-charge. | Multi-hostel assignment schema in `platform.user_roles`. | Architectural rule: strictly single hostel scope. | Low |

---

## 14. Performance & Algorithmic Design Notes

1. **Algorithmic Join Optimization**:
   - Multiple pages (`RoomsPage`, `AllocationsPage`, `AttendancePage`) process relational datasets (e.g. rooms, beds, residents, attendance records).
   - In place of nested $O(N \times M)$ scans, collections are indexed once into $O(1)$ lookup structures (`Map` and `Set`), ensuring linear $O(N + M)$ performance during client-side rendering.
2. **Search Input Debouncing**:
   - All search fields implement a 250–350 ms debounce delay, preventing unnecessary re-filtering on every keystroke.
3. **Stale Request Guard**:
   - Asynchronous data fetching utilizes an incrementing sequence counter (`reqSeqRef.current = ++reqSeqRef.current`). Late-arriving responses from superseded requests are discarded.
4. **Code Splitting & Asset Optimization**:
   - Every page component is lazy-loaded via `React.lazy()` and chunked into separate bundles ranging from 14 kB to 37 kB.

---

## 15. Build & Run Instructions

All commands must be executed within `D:\HMS\MODULES\HOSTEL-INCHARGE\FRONTEND\WEB`:

### 1. Install Dependencies
```powershell
cd D:\HMS\MODULES\HOSTEL-INCHARGE\FRONTEND\WEB
npm install
```

### 2. Development Dev Server
```powershell
npm run dev
```
*Launches Vite development server on `http://localhost:3003` with automated API proxying to backend on port 3001.*

### 3. Production Compilation
```powershell
npm run build
```
*Compiles optimized production bundle into `dist/`.*

### 4. Code Quality & Linting
```powershell
npm run lint
```
*Executes ESLint across all `.js` and `.jsx` files with `--max-warnings 0`. Verified exit code: 0.*

---

## 16. Environment Variables

The frontend relies strictly on the following optional environment variable:
- `VITE_API_BASE_URL`: Base URL of the backend Go API. (Defaults to empty in development, leveraging the Vite development proxy on port 3001).
- `VITE_BACKEND_TARGET`: Proxy target override for local development (defaults to `http://localhost:3001`).

*Security Note: Zero secret keys, passwords, database credentials, or private tokens are stored in the frontend repository.*

---

## 17. Release Checklist

| Category | Checklist Item | Status | Verification Evidence |
|---|---|---|---|
| **Repository** | Module located strictly in permanent root `D:\HMS\MODULES\HOSTEL-INCHARGE` | **PASS** | `git status` verifies no foreign directories. |
| **Repository** | No duplicate frontend or backend applications created | **PASS** | Verified single SPA in `FRONTEND/WEB`. |
| **Authentication** | Authentication connects to live `/auth/login` | **PASS** | Interceptor injects JWT token and `X-Scope`. |
| **Authentication** | Role strictly restricted to `HOSTEL_INCHARGE` / `INCHARGE` | **PASS** | Role boundary enforced in `authService.js` and `ProtectedRoute.jsx`. |
| **Scope** | Scope strictly restricted to assigned hostel | **PASS** | `AuthContext` injects `assignedHostel.id` across all queries. |
| **Permissions** | Navigation and routes guarded by verified permissions | **PASS** | `inchargeNavigation.js` and `PermissionRoute.jsx` verified. |
| **Functional** | Batches 01–11 functional pages complete | **PASS** | All 21 page routes render with live data. |
| **Quality** | ESLint validation passes with 0 errors and 0 warnings | **PASS** | `npm run lint` exited with code 0. |
| **Quality** | Vite production build passes with 0 errors | **PASS** | `npm run build` exited with code 0. |
| **Responsive** | Mobile, tablet, and desktop layouts responsive | **PASS** | Responsive flex/grid layouts with table horizontal scrolling. |
| **Accessibility** | ARIA labels, semantic HTML, visible focus states | **PASS** | Verified across form fields, modals, and buttons. |
| **Regression** | Zero changes to `API`, `DATABASE`, `ADMIN`, `SUPER-ADMIN`, `SHARED` | **PASS** | Git status confirms only `MODULES/HOSTEL-INCHARGE` modified. |

---

## 18. Release Blocker Register

| Blocker ID | Domain | Missing Dependency | Current Behavior | Impact | Required Future Work | Approved? |
|---|---|---|---|---|---|---|
| **BLK-01** | Documents | Binary Document Storage API (`POST /college/documents/upload`) | Displays resident compliance records with boundary alert. | Cannot view or download student PDF uploads. | Backend team must implement cloud object storage. | Approved (Reference Mode) |
| **BLK-02** | Audit | Tenant Audit Log API (`GET /college/audit-logs`) | Displays notice logs and complaint update timelines. | Whole-system audit log restricted to Super Admin. | Backend team must implement college audit view. | Approved (Reference Mode) |
| **BLK-03** | Visitors | Visitor Management API (`POST /college/visitors`) | Displays verified Parent/Guardian directory. | Cannot check in physical visitors at hostel desk. | Backend team must implement visitor endpoints. | Approved (Reference Mode) |
| **BLK-04** | Parcels | Parcel Intake API (`POST /college/parcels`) | Displays verified resident directory for parcel lookup. | Cannot mark parcels as received or collected. | Backend team must implement parcel endpoints. | Approved (Reference Mode) |
| **BLK-05** | Reports | Server-side PDF/Excel exporter | Client-side RFC 4180 CSV export with UTF-8 BOM + Print. | High-volume binary PDF generation is client-side. | Backend team must implement PDF generator. | Approved (CSV / Print) |

---

## 19. Regression & Boundary Confirmation

- **Backend Go Code (`D:\HMS\API`)**: **0 files modified**.
- **PostgreSQL Schemas & Migrations (`D:\HMS\DATABASE`)**: **0 files modified**.
- **College Admin Module (`D:\HMS\MODULES\ADMIN`)**: **0 files modified**.
- **Super Admin Module (`D:\HMS\MODULES\SUPER-ADMIN`)**: **0 files modified**.
- **Security Module (`D:\HMS\MODULES\SECURITY`)**: **0 files modified**.
- **Shared Architecture (`D:\HMS\SHARED`)**: **0 files modified**.
- **Student & Parent Portals**: **0 files modified**.

All changes are contained strictly inside `D:\HMS\MODULES\HOSTEL-INCHARGE`.

---

## 20. Final Release Status

# **`RELEASE READY WITH DOCUMENTED API LIMITATIONS`**

### Acceptance Summary
The `HOSTEL_INCHARGE` frontend module is completely integrated, tested, and validated against the live HMS architecture. The application builds cleanly for production, adheres strictly to ESLint quality rules with zero warnings, enforces assigned-hostel boundaries, and gracefully presents verified operational workspaces while transparently alerting users to known backend API limitations.

