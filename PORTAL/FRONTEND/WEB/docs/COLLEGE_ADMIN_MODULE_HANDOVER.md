# College Admin Module Handover Documentation
## Technical & Engineering Guide for Incoming Development Teams

**Document Version:** 1.0.0  
**Target Repository:** `D:/HMS`  
**Frontend Project Path:** `D:/HMS/PORTAL/FRONTEND/WEB`  
**Primary Contact / Domain:** Institutional Portal & College Administration  
**Last Verified Date:** November 1, 2026  

---

## 1. Technical Architecture Overview

The College Administrator frontend is structured as a modular single-page application (SPA) integrated into the unified institutional portal (`PORTAL/FRONTEND/WEB`). It shares authentication, layout, styling tokens, and API client utilities with four other institutional roles (Student, Parent, Hostel In-Charge, and Security Guard).

### 1.1 Key Technical Anchors
- **Application Root:** `src/main.jsx` mounts `src/App.jsx`.
- **Authentication Provider:** `src/shared/auth/AuthProvider.jsx` wraps the React DOM tree and provides authentication context via `src/shared/auth/AuthContext.jsx`.
- **Declarative Router:** `src/shared/routing/AppRoutes.jsx` defines nested routes under `<Route path="/admin">`.
- **Security Boundary:** `src/shared/routing/RoleProtectedRoute.jsx` enforces `requiredScope: "COLLEGE"` and allowed role checks.
- **Master Layout:** `src/shared/layouts/InstitutionalLayout.jsx` provides the unified responsive shell, header, breadcrumb resolver, and sidebar.
- **Centralized Admin Service:** `src/modules/admin/services/adminService.js` serves as the sole communication bridge to the Go API backend.
- **Shared API Client:** `src/shared/api/api.js` provides the Axios instance with automated Bearer token injection and `X-Scope: COLLEGE` headers.

---

## 2. Developer Guide: How to Extend the College Admin Module

### 2.1 Adding a New Administration Page
1. **Create the Page Component:**  
   Add your new view in `src/modules/admin/pages/NewFeaturePage.jsx`.
2. **Follow Component Patterns:**  
   Reuse shared components (`PageHeader`, `DataTable`, `FilterControls`, `Modal`, `LoadingState`, `EmptyState`, `ErrorState`).
   ```jsx
   import React, { useState, useEffect } from 'react';
   import { PageHeader, DataTable, LoadingState, ErrorState, EmptyState } from '../../../shared/components';
   import adminService from '../services/adminService';

   export default function NewFeaturePage() {
     const [data, setData] = useState([]);
     const [loading, setLoading] = useState(true);
     const [error, setError] = useState(null);

     const loadData = async () => {
       try {
         setLoading(true);
         const res = await adminService.getNewFeatureData();
         setData(res?.data || res || []);
       } catch (err) {
         setError(err.message || 'Failed to load data');
       } finally {
         setLoading(false);
       }
     };

     useEffect(() => { loadData(); }, []);

     if (loading) return <LoadingState message="Loading feature..." />;
     if (error) return <ErrorState message={error} onRetry={loadData} />;
     if (!data.length) return <EmptyState title="No Records" description="No data found." />;

     return (
       <div className="space-y-6">
         <PageHeader title="New Feature" subtitle="Manage new feature" />
         {/* Render Data */}
       </div>
     );
   }
   ```

### 2.2 Adding an API Method in `adminService.js`
1. Open `src/modules/admin/services/adminService.js`.
2. Add your method following existing parameter unrolling conventions:
   ```javascript
   async getNewFeatureData(params = {}) {
     const res = await api.get('/college/new-feature', { params });
     return res.data || res;
   },
   async createNewFeatureRecord(payload) {
     const res = await api.post('/college/new-feature', payload);
     return res.data || res;
   },
   ```

### 2.3 Registering the Route in `AppRoutes.jsx`
1. Open `src/shared/routing/AppRoutes.jsx`.
2. Import your page component (or use `React.lazy()` for automatic code splitting):
   ```javascript
   const AdminNewFeaturePage = lazy(() => import('../../modules/admin/pages/NewFeaturePage'));
   ```
3. Register the child route inside `<Route path="/admin">`:
   ```jsx
   <Route path="new-feature" element={<AdminNewFeaturePage />} />
   ```

### 2.4 Adding Navigation in `roleNavigation.js`
1. Open `src/shared/layouts/roleNavigation.js`.
2. Locate `COLLEGE_ADMIN.navGroups` and add your navigation item under the appropriate semantic group:
   ```javascript
   {
     label: 'New Feature',
     path: '/admin/new-feature',
     icon: Sparkles, // Import from lucide-react
     permission: 'hostel.view',
     description: 'Detailed description of new capability',
   }
   ```

---

## 3. Backend Dependency Handover: Missing Endpoints

The incoming backend development team must prioritize registering the following endpoints to transition partially-implemented features into fully-verified, database-backed workflows:

| Priority | Missing Endpoint / Route | HTTP Method | Target Feature | Database Schema Status |
| :---: | :--- | :---: | :--- | :--- |
| **P1** | `/college/fees/*` | `GET/POST` | Institutional Fees & Invoicing | Schema not created. Deferred to Phase 5. |
| **P1** | `/college/visitors` | `GET/POST` | Campus Visitor Reception | Table exists in PostgreSQL (`college.visitors`). Needs Go route handler. |
| **P1** | `/college/parcels` | `GET/POST` | Student Courier Parcels | Table exists in PostgreSQL (`college.parcels`). Needs Go route handler. |
| **P2** | `/college/staff/:id/reset-password` | `POST` | Staff Credential Management | Auth service needs tokenized reset handler. |
| **P2** | `/college/movement` | `GET/POST` | Gate Checkpoint Telemetry | IoT edge telemetry ingestion route needed. |
| **P2** | `/college/bootstrap` | `PUT` | College Settings Persistence | Fix 500 error by seeding initial tenant configuration row. |
| **P3** | `/college/audit-logs` | `GET` | Dedicated College Audit View | Provide read-only view over tenant-scoped `platform.audit_logs`. |

---

## 4. Maintenance Guidelines & Best Practices

To preserve architectural integrity across future iterations, adhere strictly to the following rules:

1. **Maintain Single-Source Service Layer**: Never invoke Axios or `fetch` directly inside React components. All backend calls must go through `adminService.js`.
2. **Preserve Scope Isolation**: Never remove `X-Scope: COLLEGE` or disable `RoleProtectedRoute`. SuperAdmin and College Admin domains must remain isolated.
3. **Handle Data Envelopes Defensively**: Backend Gin handlers wrap responses in `{"success": true, "data": ...}`. Always handle both `res.data.data` and `res.data` to prevent undefined property crashes.
4. **Honest Capability Presentation**: If a backend endpoint does not exist, present a transparent architectural notice or front-desk fallback. Never fabricate mock data or simulate backend state.
5. **Preserve Shared Components**: Do not duplicate core UI components (buttons, modals, tables, badges). Extend `src/shared/components/` with backwards compatibility.
6. **Code Splitting**: Ensure all major pages continue to use `React.lazy()` inside `AppRoutes.jsx` to maintain small bundle sizes (<100 kB initial load).
