# College Admin Frontend (Standalone Web Module)
## `MODULES/ADMIN/FRONTEND/WEB`

Standalone, enterprise React/Vite single-page application for the College Administration module of the Hostel Management System (HMS), architecturally structured identically to the Super-Admin module (`MODULES/SUPER-ADMIN/FRONTEND/WEB`).

---

## 1. Features & Capabilities

- **Executive Dashboard**: Occupancy analytics, resident metrics, and quick operational links.
- **Student & Parent Governance**: Full CRUD directory, guardian linkages, and emergency contacts.
- **Space Hierarchy**: Interactive topology of Hostels, Blocks, Floors, Rooms, and Beds.
- **Housing Allocation Engine**: Bed assignments, transfers, and releases with conflict prevention.
- **Staff & Security Gates**: Warden assignments, security shift schedules, and staff profiles.
- **Curfew & Daily Roll-Call**: Nightly attendance tracking with bulk check-in capabilities.
- **Leaves & Gate Clearances**: End-to-end student leave approvals and departure clearances.
- **Maintenance Service Desk**: Multi-category facility work order intake, assignment, and resolution.
- **Hostel Dining & Food**: Meal serving schedules, daily menus, and food feedback review.
- **Notices & Broadcasts**: Targeted circular announcements across student residences and staff.
- **Institutional Reports**: 9 analytical report streams with dynamic CSV and JSON exports.
- **Settings & Operational Activity**: Profile configuration and aggregated operational event stream.

---

## 2. Getting Started

### Installation
```bash
npm install
```

### Development Server (Port 3002)
```bash
npm run dev
```

### Production Build
```bash
npm run build
```

---

## 3. Directory Layout
```
src/
├── components/   # Reusable UI components (DataTable, Modal, PageHeader, etc.)
├── hooks/        # AuthContext, AuthProvider, useAuth
├── layouts/      # AdminLayout & roleNavigation
├── pages/        # 20 Domain Admin Pages + LoginPage, Unauthorized, NotFound
├── routes/       # AppRoutes & ProtectedRoute
├── services/     # adminService.js, api.js, authService.js
├── styles/       # variables.css, portal.css, layout.css, main.css
└── utils/        # exportUtils.js
```

