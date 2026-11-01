# College Admin Frontend Structure & Architecture Documentation
## Unified Institutional Portal (`PORTAL/FRONTEND/WEB`)

**Document Version:** 1.0.0  
**Target Environment:** React 18+ | Vite 5.4 | React Router v6 | Tailwind CSS Tokens | Axios  
**Target Module:** `src/modules/admin/`  
**Host Application:** Shared Institutional Portal (`http://localhost:5173`)  
**Backend API Boundary:** Go/Gin REST API (`http://localhost:3001`)  
**Last Verified Date:** November 1, 2026  

---

## 1. Project Overview

The College Administrator frontend provides an enterprise web interface for managing higher-education residential operations. Designed as a key tenant-level application within the unified institutional portal, it enables college administrators, hostel administrators, wardens, and chief security officers to govern residential life across all campuses.

### 1.1 Core System Capabilities
- **Multi-Tenant Resident Governance**: Complete life-cycle management of student residents, guardians, and emergency contact networks.
- **Physical Asset & Space Topology**: Deep hierarchical management across Hostels, Blocks, Floors, Rooms, and Beds with capacity and occupancy calculations.
- **Housing Allocation Engine**: Assignment, transfer, and release of student bed allocations with double-booking prevention.
- **Curfew & Daily Roll-Call**: Nightly hostel curfew attendance tracking with manual and bulk attendance workflows.
- **Requests & Leave Governance**: End-to-end processing of student leave and outpass requests with status tracking.
- **Service Desk & Facility Maintenance**: Student maintenance ticket intake, assignment to maintenance teams, and multi-stage status resolution.
- **Dining Services & Campus Notices**: Meal timings, weekly menus, and tenant-wide notification broadcasts.
- **Executive Analytics & Governance**: Aggregated institutional KPI metrics and data export capabilities.

### 1.2 Technology Stack
- **UI Framework**: React 18.3.1 (SPA architecture)
- **Bundler & Tooling**: Vite 5.4.21 with `@vitejs/plugin-react`
- **Routing**: `react-router-dom` v6.28.0 (declarative nested routes, dynamic parameters, programmatic navigation)
- **HTTP Client**: Axios 1.7.9 with centralized request/response interceptors
- **Icons**: `lucide-react` 0.460.0 (high-consistency SVG icon library)
- **Styling Architecture**: Custom CSS architecture with design tokens defined in `src/shared/styles/variables.css` and `src/shared/styles/portal.css`
- **Build Pipeline**: Postbuild SPA fallback generator (`postbuild.js`) ensuring zero 404s on static deep links

---

## 2. Directory Structure

The following tree represents the verified directory layout of the College Admin frontend and its supporting shared infrastructure inside `D:/HMS/PORTAL/FRONTEND/WEB/`:

```
D:/HMS/PORTAL/FRONTEND/WEB/
├── package.json                          # Dependencies, scripts, and module metadata
├── vite.config.js                        # Vite bundler configuration & dev server proxy
├── postbuild.js                          # SPA deep-link routing fallback generator
├── index.html                            # Application HTML entry point
│
├── src/
│   ├── main.jsx                          # React DOM initialization & root mount
│   ├── App.jsx                           # Top-level application component with AuthProvider
│   │
│   ├── modules/
│   │   ├── admin/                        # College Administrator Domain Module
│   │   │   ├── pages/                    # 20 Administration Domain Pages
│   │   │   │   ├── AllocationsPage.jsx   # Bed allocation, transfer & release
│   │   │   │   ├── AnnouncementsPage.jsx # Circulars, notices & broadcasts
│   │   │   │   ├── AttendancePage.jsx    # Daily roll-call & attendance summary
│   │   │   │   ├── AuditLogPage.jsx      # Operational event activity stream
│   │   │   │   ├── ComplaintsPage.jsx    # Maintenance complaints service desk
│   │   │   │   ├── DashboardPage.jsx     # Institutional KPI metrics & quick links
│   │   │   │   ├── FeesPage.jsx          # Fee structure & billing policy guide
│   │   │   │   ├── FoodPage.jsx          # Dining menus, meal times & food feedback
│   │   │   │   ├── GatePassesPage.jsx    # Approved leave departure clearances
│   │   │   │   ├── HostelsPage.jsx       # Hostels, blocks, floors, rooms & beds
│   │   │   │   ├── LeavesPage.jsx        # Student leave request approvals
│   │   │   │   ├── MovementPage.jsx      # Checkpoint security & movement desk
│   │   │   │   ├── ParcelsPage.jsx       # Courier intake & parcel desk
│   │   │   │   ├── ParentsPage.jsx       # Parent & guardian directory
│   │   │   │   ├── ReportsPage.jsx       # 9x Analytical reports with CSV export
│   │   │   │   ├── SettingsPage.jsx      # Institutional settings & preferences
│   │   │   │   ├── SOSPage.jsx           # Emergency protocols & hotline directory
│   │   │   │   ├── StaffPage.jsx         # Staff, incharges & security assignments
│   │   │   │   ├── StudentsPage.jsx      # Student directory & profile views
│   │   │   │   └── VisitorsPage.jsx      # Visitor reception desk & logs
│   │   │   │
│   │   │   └── services/
│   │   │       └── adminService.js       # Centralized API service for College Admin
│   │   │
│   │   ├── hostel-incharge/              # Hostel Incharge module (sibling role)
│   │   ├── parent/                       # Parent Portal module (sibling role)
│   │   ├── security/                     # Campus Security module (sibling role)
│   │   └── student/                      # Student Portal module (sibling role)
│   │
│   ├── pages/                            # Global Top-Level Application Pages
│   │   ├── NotFoundPage.jsx              # Universal 404 view with recovery navigation
│   │   ├── SharedLoginPage.jsx           # Unified multi-role authentication page
│   │   └── UnauthorizedPage.jsx          # 403 Access denied view with return button
│   │
│   ├── shared/                           # Shared Cross-Module Infrastructure
│   │   ├── api/
│   │   │   └── api.js                    # Core Axios instance with tenant headers
│   │   │
│   │   ├── auth/
│   │   │   ├── AuthContext.jsx           # React Context for authentication state
│   │   │   ├── AuthProvider.jsx          # Provider component managing JWT session
│   │   │   ├── portalAuthService.js      # Login, logout & token management service
│   │   │   └── useAuth.js                # Custom hook for consuming auth context
│   │   │
│   │   ├── components/                   # Reusable Enterprise UI Components
│   │   │   ├── Alert.jsx                 # Contextual banner alerts (info, warning, error)
│   │   │   ├── Badge.jsx                 # Status tags and priority indicators
│   │   │   ├── Button.jsx                # Standardized button with loading state
│   │   │   ├── Card.jsx                  # Card wrapper with header and content slots
│   │   │   ├── ConfirmationDialog.jsx    # Destructive action modal dialog
│   │   │   ├── DataTable.jsx             # Sortable, paginated, responsive data table
│   │   │   ├── EmptyState.jsx            # Standardized zero-records presentation
│   │   │   ├── ErrorState.jsx            # Recoverable error presentation with retry
│   │   │   ├── FilterControls.jsx        # Composable search and filter toolbar
│   │   │   ├── FormField.jsx             # Labeled input/select wrapper with validation
│   │   │   ├── LoadingSpinner.jsx        # Inline and full-page loading indicators
│   │   │   ├── LoadingState.jsx          # Standardized section loader component
│   │   │   ├── Modal.jsx                 # Accessible backdrop dialog with close on ESC
│   │   │   ├── NotificationDisplay.jsx   # Toast and in-app message notifications
│   │   │   ├── PageHeader.jsx            # Unified view header with breadcrumb trail
│   │   │   ├── SearchInput.jsx           # Debounced search bar with clear button
│   │   │   └── index.js                  # Barrel export for shared components
│   │   │
│   │   ├── layouts/                      # Layout Templates
│   │   │   ├── InstitutionalLayout.jsx   # Shared layout with header, sidebar & user menu
│   │   │   └── roleNavigation.js         # Navigation items and permissions mapping
│   │   │
│   │   ├── routing/                      # Route Configuration
│   │   │   ├── AppRoutes.jsx             # Declarative route hierarchy for all 5 roles
│   │   │   ├── RoleProtectedRoute.jsx    # Scope- and role-aware route protection
│   │   │   └── roleNavigation.js         # Re-export of layout role navigation
│   │   │
│   │   ├── styles/                       # CSS Variables & Stylesheets
│   │   │   ├── layout.css                # Sidebar, header & grid layout rules
│   │   │   ├── portal.css                # Base portal styles, reset & component classes
│   │   │   └── variables.css             # Colors, typography, shadows & spacing tokens
│   │   │
│   │   └── utils/                        # Shared Utilities
│   │       └── exportUtils.js            # Client-side CSV and JSON export utilities
│   │
│   └── docs/                             # Release & Architectural Documentation
│       ├── README.md                     # Main documentation index
│       ├── COLLEGE_ADMIN_FRONTEND_STRUCTURE.md
│       ├── COLLEGE_ADMIN_FUNCTIONAL_COMPLETION_MATRIX.md
│       ├── COLLEGE_ADMIN_API_INTEGRATION_COVERAGE.md
│       ├── COLLEGE_ADMIN_KNOWN_LIMITATIONS.md
│       ├── COLLEGE_ADMIN_TEST_REPORT.md
│       ├── COLLEGE_ADMIN_BUILD_REPORT.md
│       ├── COLLEGE_ADMIN_USER_GUIDE.md
│       ├── COLLEGE_ADMIN_MODULE_HANDOVER.md
│       └── COLLEGE_ADMIN_RELEASE_CHECKLIST.md
```

---

## 3. Application Architecture & Request Flow

The College Administrator frontend enforces a unidirectional request and execution pipeline that safeguards authentication, tenant isolation, and RBAC permissions on every route transition and API request.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             HTTP REQUEST & RENDER FLOW                      │
└─────────────────────────────────────────────────────────────────────────────┘

   1. User Interaction (Browser Navigation / Link Click)
         │
         ▼
   2. React Router Engine (`AppRoutes.jsx`)
         │
         ▼
   3. Security Boundary: `RoleProtectedRoute.jsx`
      ├── Checks authenticated session (`useAuth`)
      │   └── Not Authenticated? ──► Redirects to `/login?redirect={path}`
      ├── Checks Scope (`requiredScope: "COLLEGE"`)
      │   └── Scope is `PLATFORM`? ──► Redirects to `/unauthorized`
      └── Checks User Role (`allowedRoles: ['COLLEGE_ADMIN', 'HOSTEL_ADMIN', 'ADMIN']`)
          └── Sibling Role (e.g., Student/Parent)? ──► Redirects to `/unauthorized`
         │
         ▼
   4. Layout Rendering: `InstitutionalLayout.jsx`
      ├── Generates dynamic navigation from `roleNavigation.js`
      ├── Resolves breadcrumbs and page title
      ├── Displays tenant branding and user profile
      └── Renders child page inside `<main>` via `<Outlet />`
         │
         ▼
   5. Page Component Lifecycle (e.g., `StudentsPage.jsx`)
      ├── Mounts and invokes `useEffect`
      ├── Sets `loading = true` (renders `LoadingState`)
      └── Dispatches call to `adminService` (e.g., `adminService.getStudents()`)
         │
         ▼
   6. Domain Service Layer: `adminService.js`
      ├── Normalizes parameters (pagination, filters, search query)
      └── Delegates to centralized Axios client (`api.js`)
         │
         ▼
   7. HTTP Client Interceptors: `src/shared/api/api.js`
      ├── Injects `Authorization: Bearer <jwt_token>`
      ├── Injects `X-Scope: COLLEGE`
      └── Dispatches HTTP request over wire to `http://localhost:3001`
         │
         ▼
   8. Go/Gin Backend API (`API/cmd/server/server.exe`)
      ├── Validates JWT signature and expiry
      ├── Enforces `auth.RequireCollegeScope()`
      ├── Derives Tenant ID via `TenantContextMiddleware()`
      └── Queries Neon PostgreSQL database under tenant isolation
         │
         ▼
   9. Response Handling & State Reconciliation
      ├── 200 OK: Data extracted from response envelope (`res.data.data`)
      ├── 401 Unauthorized: Interceptor clears token and redirects to `/login`
      ├── 403 Forbidden: Interceptor raises error or redirects to `/unauthorized`
      └── 500 Error: Caught in page `try/catch` ──► renders `ErrorState` with Retry
```

---

## 4. Routing & Navigation Configuration

### 4.1 Route Table
All College Admin routes are defined as child routes of `/admin` inside `AppRoutes.jsx`.

| Route Path | Page Component | Allowed Roles | Required Permission | Description |
| :--- | :--- | :--- | :--- | :--- |
| `/admin` | *Redirect to `/admin/dashboard`* | `COLLEGE_ADMIN`, `HOSTEL_ADMIN`, `ADMIN` | — | Root admin redirect |
| `/admin/dashboard` | `AdminDashboardPage` | `COLLEGE_ADMIN`, `HOSTEL_ADMIN`, `ADMIN` | `hostel.view` | Institutional metrics and KPI summary |
| `/admin/hostels` | `AdminHostelsPage` | `COLLEGE_ADMIN`, `HOSTEL_ADMIN`, `ADMIN` | `hostel.view` | Residential hostels and blocks |
| `/admin/rooms` | `AdminHostelsPage` | `COLLEGE_ADMIN`, `HOSTEL_ADMIN`, `ADMIN` | `hostel.view` | Room inventory and bed capacity |
| `/admin/allocations` | `AdminAllocationsPage` | `COLLEGE_ADMIN`, `HOSTEL_ADMIN`, `ADMIN` | `people.view` | Bed allocations, transfers and releases |
| `/admin/staff` | `AdminStaffPage` | `COLLEGE_ADMIN`, `HOSTEL_ADMIN`, `ADMIN` | `people.view` | Staff directory and roles |
| `/admin/incharges` | `AdminStaffPage` (`defaultTab="incharges"`) | `COLLEGE_ADMIN`, `HOSTEL_ADMIN`, `ADMIN` | `people.view` | Hostel warden assignments |
| `/admin/security-assignments`| `AdminStaffPage` (`defaultTab="security"`) | `COLLEGE_ADMIN`, `HOSTEL_ADMIN`, `ADMIN` | `people.view` | Campus gate security postings |
| `/admin/passwords` | `AdminStaffPage` (`defaultTab="passwords"`) | `COLLEGE_ADMIN`, `HOSTEL_ADMIN`, `ADMIN` | `people.view` | Staff access and credential management |
| `/admin/students` | `AdminStudentsPage` | `COLLEGE_ADMIN`, `HOSTEL_ADMIN`, `ADMIN` | `people.view` | Student residents directory |
| `/admin/parents` | `AdminParentsPage` | `COLLEGE_ADMIN`, `HOSTEL_ADMIN`, `ADMIN` | `people.view` | Parent contacts and student links |
| `/admin/attendance` | `AdminAttendancePage` | `COLLEGE_ADMIN`, `HOSTEL_ADMIN`, `ADMIN` | `people.view` | Curfew attendance and daily logs |
| `/admin/leaves` | `AdminLeavesPage` | `COLLEGE_ADMIN`, `HOSTEL_ADMIN`, `ADMIN` | `requests.view` | Leave requests and approvals |
| `/admin/movement` | `AdminMovementPage` | `COLLEGE_ADMIN`, `HOSTEL_ADMIN`, `ADMIN` | `people.view` | Student movement and security gates |
| `/admin/gate-passes` | `AdminGatePassesPage` | `COLLEGE_ADMIN`, `HOSTEL_ADMIN`, `ADMIN` | `requests.view` | Gate departure clearances |
| `/admin/complaints` | `AdminComplaintsPage` | `COLLEGE_ADMIN`, `HOSTEL_ADMIN`, `ADMIN` | `requests.view` | Maintenance and facility tickets |
| `/admin/visitors` | `AdminVisitorsPage` | `COLLEGE_ADMIN`, `HOSTEL_ADMIN`, `ADMIN` | `people.view` | Visitor reception and visitor logs |
| `/admin/parcels` | `AdminParcelsPage` | `COLLEGE_ADMIN`, `HOSTEL_ADMIN`, `ADMIN` | `people.view` | Student courier parcel intake |
| `/admin/sos` | `AdminSOSPage` | `COLLEGE_ADMIN`, `HOSTEL_ADMIN`, `ADMIN` | `people.view` | Emergency coordination protocols |
| `/admin/food` | `AdminFoodPage` | `COLLEGE_ADMIN`, `HOSTEL_ADMIN`, `ADMIN` | `hostel.view` | Dining schedules, menus and feedback |
| `/admin/announcements` | `AdminAnnouncementsPage` | `COLLEGE_ADMIN`, `HOSTEL_ADMIN`, `ADMIN` | `hostel.view` | Notices and broadcast messages |
| `/admin/fees` | `AdminFeesPage` | `COLLEGE_ADMIN`, `HOSTEL_ADMIN`, `ADMIN` | `people.view` | Institutional fees guide and billing |
| `/admin/reports` | `AdminReportsPage` | `COLLEGE_ADMIN`, `HOSTEL_ADMIN`, `ADMIN` | `reports.view` | 9x Reports and analytics exports |
| `/admin/settings` | `AdminSettingsPage` | `COLLEGE_ADMIN`, `HOSTEL_ADMIN`, `ADMIN` | `hostel.view` | Institution profile and parameters |
| `/admin/audit-logs` | `AdminAuditLogPage` | `COLLEGE_ADMIN`, `HOSTEL_ADMIN`, `ADMIN` | `people.view` | Operational activity stream |

### 4.2 Navigation Sidebar Groups
Navigation items in `roleNavigation.js` are organized into 6 semantic sections:
1. **Overview**: Dashboard
2. **Facility & Inventory**: Hostels & Blocks, Rooms & Beds, Room Allocations
3. **Community Management**: College Staff, Hostel In-Charges, Security Personnel, Students Directory, Parents & Guardians, Password & Access
4. **Operations & Movement**: Daily Attendance, Leave Requests, Student Movement, Gate Clearances
5. **Support & Safety**: Student Complaints, Visitor Access, Student Parcels, SOS & Emergency
6. **Campus Living & Welfare**: Hostel Mess & Food, Notice & Broadcasts, Hostel Fees & Invoicing
7. **Administration & Governance**: Reports & Analytics, Institution Settings, Audit & Activity Log

---

## 5. Shared Component Architecture

The College Admin pages reuse enterprise components from `src/shared/components/` ensuring consistent accessibility, interaction patterns, and visual styling:

- **`DataTable`**: Renders tabular datasets with support for custom cell renderers, sorting by column key, built-in client-side pagination, empty state fallback, and responsive horizontal scrolling.
- **`FilterControls`**: Provides a standard toolbar containing a search input, status filters, dropdown selectors, and action buttons.
- **`Modal` & `ConfirmationDialog`**: Accessible modal overlays supporting focus trapping, backdrop click dismissal, `Escape` key listeners, and explicit affirmative/cancel buttons for destructive actions.
- **`PageHeader`**: Standardized header presenting the page title, icon, subtitle, dynamic breadcrumbs, and primary action buttons.
- **`EmptyState` & `ErrorState`**: User-friendly states featuring vector iconography, descriptive guidance, and call-to-action buttons (e.g. Retry or Create Record).
- **`LoadingState` & `LoadingSpinner`**: Skeleton and spinner visual feedback preventing cumulative layout shift during asynchronous fetches.
- **`exportUtils`**: Utility functions (`exportToCSV`, `exportToJSON`) that serialize in-memory datasets and trigger browser file downloads with timestamped filenames.
